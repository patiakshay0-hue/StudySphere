"""SQLite persistence — users, credits, transactions, and per-user RAG data."""
import json
import sqlite3
from datetime import datetime, timezone
from typing import List, Optional

from app.config import DB_PATH, SIGNUP_BONUS_CREDITS


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                plan          TEXT NOT NULL DEFAULT 'free',
                credits       INTEGER NOT NULL DEFAULT 0,
                created_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS files (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL,
                name        TEXT NOT NULL,
                file_type   TEXT NOT NULL,
                semester    TEXT,
                subject     TEXT,
                doc_kind    TEXT,
                char_count  INTEGER DEFAULT 0,
                chunk_count INTEGER DEFAULT 0,
                upload_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS chunks (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                idx     INTEGER NOT NULL,
                text    TEXT NOT NULL,
                page    INTEGER,
                source  TEXT NOT NULL,
                FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS chat_history (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                question   TEXT NOT NULL,
                answer     TEXT NOT NULL,
                sources    TEXT NOT NULL,
                mode       TEXT DEFAULT 'offline',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL,
                plan        TEXT NOT NULL,
                amount      INTEGER NOT NULL,
                credits     INTEGER NOT NULL,
                order_id    TEXT,
                payment_id  TEXT,
                status      TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );
            """
        )


# --------------------------------------------------------------------------- #
# Users / credits
# --------------------------------------------------------------------------- #
def create_user(name: str, email: str, password_hash: str) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO users (name, email, password_hash, plan, credits, created_at)
               VALUES (?, ?, ?, 'free', ?, ?)""",
            (name, email.lower(), password_hash, SIGNUP_BONUS_CREDITS, _now()),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (int(cur.lastrowid),)).fetchone()
        return dict(row)


def get_user(user_id: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email.lower(),)
        ).fetchone()
        return dict(row) if row else None


def deduct_credits(user_id: int, amount: int) -> bool:
    """Atomically subtract credits; returns False if the user lacks enough."""
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?",
            (amount, user_id, amount),
        )
        return cur.rowcount > 0


def add_credits(user_id: int, credits: int, plan: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE users SET credits = credits + ?, plan = ? WHERE id = ?",
            (credits, plan, user_id),
        )


def record_transaction(
    user_id: int,
    plan: str,
    amount: int,
    credits: int,
    order_id: Optional[str],
    payment_id: Optional[str],
    status: str,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO transactions
               (user_id, plan, amount, credits, order_id, payment_id, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, plan, amount, credits, order_id, payment_id, status, _now()),
        )


# --------------------------------------------------------------------------- #
# Files / chunks (per user)
# --------------------------------------------------------------------------- #
def insert_file(
    user_id: int,
    name: str,
    file_type: str,
    semester: Optional[str],
    subject: Optional[str],
    doc_kind: Optional[str],
    char_count: int,
    chunk_count: int,
) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO files
               (user_id, name, file_type, semester, subject, doc_kind, char_count, chunk_count, upload_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, name, file_type, semester, subject, doc_kind, char_count, chunk_count, _now()),
        )
        return int(cur.lastrowid)


def list_files(user_id: int) -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM files WHERE user_id = ? ORDER BY upload_date DESC", (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_file(file_id: int, user_id: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM files WHERE id = ? AND user_id = ?", (file_id, user_id)
        ).fetchone()
        return dict(row) if row else None


def delete_file(file_id: int, user_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM files WHERE id = ? AND user_id = ?", (file_id, user_id)
        )
        return cur.rowcount > 0


def insert_chunks(file_id: int, user_id: int, chunks: List[dict]) -> None:
    with get_conn() as conn:
        conn.executemany(
            "INSERT INTO chunks (file_id, user_id, idx, text, page, source) VALUES (?, ?, ?, ?, ?, ?)",
            [(file_id, user_id, c["idx"], c["text"], c.get("page"), c["source"]) for c in chunks],
        )


def all_chunks(user_id: Optional[int] = None, file_id: Optional[int] = None) -> List[dict]:
    with get_conn() as conn:
        q = "SELECT * FROM chunks"
        params: list = []
        clauses = []
        if user_id is not None:
            clauses.append("user_id = ?")
            params.append(user_id)
        if file_id is not None:
            clauses.append("file_id = ?")
            params.append(file_id)
        if clauses:
            q += " WHERE " + " AND ".join(clauses)
        q += " ORDER BY id"
        rows = conn.execute(q, params).fetchall()
        return [dict(r) for r in rows]


# --------------------------------------------------------------------------- #
# Chat history (per user)
# --------------------------------------------------------------------------- #
def insert_chat(user_id: int, question: str, answer: str, sources: List[str], mode: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO chat_history (user_id, question, answer, sources, mode, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, question, answer, json.dumps(sources), mode, _now()),
        )


def list_chat(user_id: int, limit: int = 50) -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["sources"] = json.loads(d["sources"])
            out.append(d)
        return out


def stats(user_id: int) -> dict:
    with get_conn() as conn:
        files = conn.execute("SELECT COUNT(*) AS n FROM files WHERE user_id = ?", (user_id,)).fetchone()["n"]
        chunks = conn.execute("SELECT COUNT(*) AS n FROM chunks WHERE user_id = ?", (user_id,)).fetchone()["n"]
        chats = conn.execute("SELECT COUNT(*) AS n FROM chat_history WHERE user_id = ?", (user_id,)).fetchone()["n"]
        subjects = conn.execute(
            "SELECT COUNT(DISTINCT subject) AS n FROM files WHERE user_id = ? AND subject IS NOT NULL AND subject != ''",
            (user_id,),
        ).fetchone()["n"]
        return {"files": files, "chunks": chunks, "conversations": chats, "subjects": subjects}

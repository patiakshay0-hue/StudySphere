"""A dependency-free TF-IDF retrieval engine.

This is the "vector database" for StudySphere. Rather than pulling in heavy
native dependencies (FAISS / Chroma / sentence-transformers), it implements
classic TF-IDF vectors with cosine similarity in pure Python. That keeps the
project trivial to install and run on any machine while still giving genuine
semantic-ish keyword retrieval with relevance scores.

The index is held in memory and rebuilt from SQLite on startup; chunks are
added incrementally as files are uploaded.
"""
import math
import re
import threading
from collections import Counter
from typing import Dict, List, Optional

from app import db

_TOKEN_RE = re.compile(r"[a-z0-9]+")

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to", "in",
    "on", "for", "with", "as", "by", "at", "from", "is", "are", "was", "were",
    "be", "been", "being", "this", "that", "these", "those", "it", "its", "we",
    "you", "they", "he", "she", "i", "me", "my", "our", "your", "their", "can",
    "will", "would", "should", "could", "do", "does", "did", "has", "have", "had",
    "not", "no", "so", "such", "than", "too", "very", "what", "which", "who",
    "whom", "how", "when", "where", "why", "all", "any", "both", "each", "few",
    "more", "most", "other", "some", "into", "about", "also", "may", "use", "used",
}


def tokenize(text: str) -> List[str]:
    return [
        t for t in _TOKEN_RE.findall(text.lower())
        if len(t) > 1 and t not in STOPWORDS
    ]


class VectorStore:
    """In-memory TF-IDF index with cosine similarity search."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # Each record: {id, file_id, text, page, source, tf: Counter}
        self._records: List[dict] = []
        self._df: Counter = Counter()
        self._idf: Dict[str, float] = {}

    # -- lifecycle --------------------------------------------------------- #
    def load_from_db(self) -> None:
        rows = db.all_chunks()
        with self._lock:
            self._records = []
            self._df = Counter()
            for row in rows:
                self._records.append(self._build_record(row))
            self._recompute()

    def add_chunks(self, file_id: int, user_id: int, chunks: List[dict]) -> None:
        with self._lock:
            for c in chunks:
                row = {
                    "id": c.get("id", -1),
                    "file_id": file_id,
                    "user_id": user_id,
                    "text": c["text"],
                    "page": c.get("page"),
                    "source": c["source"],
                }
                self._records.append(self._build_record(row))
            self._recompute()

    def reload(self) -> None:
        self.load_from_db()

    # -- internals --------------------------------------------------------- #
    @staticmethod
    def _build_record(row: dict) -> dict:
        tf = Counter(tokenize(row["text"]))
        return {
            "id": row.get("id"),
            "file_id": row["file_id"],
            "user_id": row.get("user_id"),
            "text": row["text"],
            "page": row.get("page"),
            "source": row["source"],
            "tf": tf,
        }

    def _recompute(self) -> None:
        self._df = Counter()
        for rec in self._records:
            for term in rec["tf"]:
                self._df[term] += 1
        n = max(len(self._records), 1)
        self._idf = {
            term: math.log((n + 1) / (df + 1)) + 1.0
            for term, df in self._df.items()
        }

    def _vectorize(self, tf: Counter) -> Dict[str, float]:
        return {t: c * self._idf.get(t, 0.0) for t, c in tf.items()}

    @staticmethod
    def _cosine(a: Dict[str, float], b: Dict[str, float]) -> float:
        if not a or not b:
            return 0.0
        # iterate the smaller vector
        small, large = (a, b) if len(a) <= len(b) else (b, a)
        dot = sum(w * large.get(t, 0.0) for t, w in small.items())
        if dot == 0.0:
            return 0.0
        na = math.sqrt(sum(w * w for w in a.values()))
        nb = math.sqrt(sum(w * w for w in b.values()))
        return dot / (na * nb) if na and nb else 0.0

    # -- query ------------------------------------------------------------- #
    def search(
        self,
        query: str,
        user_id: int,
        k: int = 5,
        file_id: Optional[int] = None,
    ) -> List[dict]:
        q_tf = Counter(tokenize(query))
        if not q_tf:
            return []
        with self._lock:
            q_vec = self._vectorize(q_tf)
            scored = []
            for rec in self._records:
                if rec.get("user_id") != user_id:
                    continue
                if file_id is not None and rec["file_id"] != file_id:
                    continue
                score = self._cosine(q_vec, self._vectorize(rec["tf"]))
                if score > 0:
                    scored.append((score, rec))
            scored.sort(key=lambda x: x[0], reverse=True)
            return [
                {
                    "text": rec["text"],
                    "page": rec["page"],
                    "source": rec["source"],
                    "file_id": rec["file_id"],
                    "score": round(score, 4),
                }
                for score, rec in scored[:k]
            ]

    def count(self) -> int:
        with self._lock:
            return len(self._records)


# Module-level singleton used across the app.
store = VectorStore()


def citation(chunk: dict) -> str:
    """Render a human-readable citation like ``ML_Notes.pdf - Page 42``."""
    if chunk.get("page"):
        return f"{chunk['source']} - Page {chunk['page']}"
    return chunk["source"]

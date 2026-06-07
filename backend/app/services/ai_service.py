"""AI layer for StudySphere.

Online mode goes through the Anthropic SDK and is metered in credits. Offline
mode never calls the API and assembles answers from the retrieved notes.

``complete()`` raises ``AIUnavailable`` on any failure so the API layer can avoid
charging credits for a request that didn't actually produce an AI result.
"""
from typing import List, Optional, Tuple

from app import config, db
from app.services.vector_store import citation, store

_client = None


class AIUnavailable(Exception):
    """Raised when an online (AI) generation cannot be produced."""


def _get_client():
    global _client
    if not config.AI_ENABLED:
        return None
    if _client is None:
        import anthropic

        _client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


def complete(system: str, prompt: str, max_tokens: int = 2000) -> str:
    """Online completion. Raises ``AIUnavailable`` if it can't produce text."""
    client = _get_client()
    if client is None:
        raise AIUnavailable("Online mode is not configured on this server.")
    try:
        resp = client.messages.create(
            model=config.MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text").strip()
        if not text:
            raise AIUnavailable("The model returned an empty response.")
        return text
    except AIUnavailable:
        raise
    except Exception as exc:  # network / auth / rate-limit
        raise AIUnavailable(str(exc)) from exc


# --------------------------------------------------------------------------- #
# RAG question answering
# --------------------------------------------------------------------------- #
ANSWER_SYSTEM = (
    "You are StudySphere, a study assistant for MCA (Master of Computer "
    "Applications) students. Answer strictly using the provided notes excerpts. "
    "Explain concepts clearly and simply, as if teaching a student. If the notes "
    "do not contain the answer, say so honestly and give a brief general "
    "explanation, clearly marked as outside the notes. Be accurate and concise."
)


def answer_query(
    question: str, user_id: int, file_id: Optional[int], online: bool
) -> Tuple[str, List[str], List[dict], bool]:
    """Retrieve chunks and answer. Returns (answer, sources, chunks, used_ai)."""
    chunks = store.search(question, user_id=user_id, k=config.TOP_K, file_id=file_id)
    sources = _unique([citation(c) for c in chunks])

    if not chunks:
        answer = (
            "I couldn't find anything relevant in your uploaded notes. "
            "Try uploading material for this topic, or rephrasing your question."
        )
        db.insert_chat(user_id, question, answer, sources, "offline")
        return answer, sources, chunks, False

    if online:
        context = _format_context(chunks)
        prompt = (
            f"Notes excerpts:\n{context}\n\n"
            f"Question: {question}\n\n"
            "Answer the question using the excerpts above. Do not repeat the "
            "sources — they are shown separately."
        )
        answer = complete(ANSWER_SYSTEM, prompt, max_tokens=1500)  # may raise
        used_ai = True
    else:
        answer = _extractive_answer(chunks)
        used_ai = False

    db.insert_chat(user_id, question, answer, sources, "online" if used_ai else "offline")
    return answer, sources, chunks, used_ai


def _format_context(chunks: List[dict]) -> str:
    return "\n\n".join(
        f"[{i}] ({citation(c)})\n{c['text']}" for i, c in enumerate(chunks, start=1)
    )


def _extractive_answer(chunks: List[dict]) -> str:
    lines = [
        "Here is what your notes say about this (offline mode — switch to online "
        "mode for an AI-written explanation):",
        "",
    ]
    for c in chunks[:3]:
        snippet = c["text"]
        if len(snippet) > 600:
            snippet = snippet[:600].rsplit(" ", 1)[0] + "…"
        lines.append(f"• ({citation(c)}) {snippet}")
    return "\n".join(lines)


def _unique(items: List[str]) -> List[str]:
    seen, out = set(), []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out

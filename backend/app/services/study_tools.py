"""Advanced study tools.

Each tool runs in one of two modes:
  - online=True  -> Claude-generated output (raises AIUnavailable on failure)
  - online=False -> offline output built directly from the user's notes

Every result dict carries ``used_ai`` so the API layer only charges credits when
an AI result was actually produced.
"""
import json
import re
from collections import Counter
from typing import List, Optional

from app import config
from app import db
from app.services import ai_service
from app.services.vector_store import store, tokenize


def _corpus(user_id: int, file_id: Optional[int]) -> str:
    chunks = db.all_chunks(user_id=user_id, file_id=file_id)
    return "\n\n".join(c["text"] for c in chunks)


def _trim(text: str, limit: int = 12000) -> str:
    return text if len(text) <= limit else text[:limit]


# --------------------------------------------------------------------------- #
# 1. Notes summarizer
# --------------------------------------------------------------------------- #
def summarize(user_id: int, file_id: Optional[int], online: bool) -> dict:
    corpus = _corpus(user_id, file_id)
    if not corpus.strip():
        return {"summary": "No notes available to summarize. Upload a file first.", "used_ai": False}

    if online:
        system = (
            "You are StudySphere. Summarize MCA study notes into a crisp exam-revision "
            "sheet. Use markdown with sections: Key Concepts, Important Definitions, "
            "and Likely Exam Questions. Keep it focused and student-friendly."
        )
        out = ai_service.complete(system, f"Notes:\n{_trim(corpus)}", max_tokens=1800)
        return {"summary": out, "used_ai": True, "mode": "ai"}
    return {"summary": _offline_summary(corpus), "used_ai": False, "mode": "offline"}


def _offline_summary(corpus: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", corpus)
    sentences = [s.strip() for s in sentences if 40 <= len(s.strip()) <= 280]
    keywords = [w for w, _ in Counter(tokenize(corpus)).most_common(12)]
    ranked = sorted(
        sentences, key=lambda s: sum(1 for k in keywords if k in s.lower()), reverse=True
    )
    lines = ["## Key Concepts (offline summary)", ""]
    lines += [f"- {s}" for s in ranked[:8]]
    lines += ["", "## Important Terms", "", ", ".join(keywords)]
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# 2. Quiz generator (MCQs)
# --------------------------------------------------------------------------- #
def generate_quiz(user_id: int, topic: str, count: int, file_id: Optional[int], online: bool) -> dict:
    chunks = store.search(topic, user_id=user_id, k=8, file_id=file_id) if topic else []
    context = "\n\n".join(c["text"] for c in chunks) or _trim(_corpus(user_id, file_id), 8000)
    if not context.strip():
        return {"questions": [], "message": "Upload notes to generate a quiz.", "used_ai": False}

    if online:
        system = (
            "You are StudySphere, an MCA exam quiz generator. Create multiple-choice "
            "questions from the provided notes. Respond ONLY with a JSON array. Each "
            "item: {\"question\": str, \"options\": [4 strings], \"answer\": int "
            "(0-based index of the correct option), \"explanation\": str}. No prose "
            "outside the JSON."
        )
        prompt = f"Generate {count} MCQs on '{topic or 'these notes'}'.\n\nNotes:\n{context}"
        out = ai_service.complete(system, prompt, max_tokens=2500)
        questions = _parse_json_array(out)
        if not questions:
            raise ai_service.AIUnavailable("Could not parse quiz output.")
        return {"questions": questions[:count], "used_ai": True, "mode": "ai"}

    return {"questions": _offline_quiz(context, count), "used_ai": False, "mode": "offline"}


def _offline_quiz(context: str, count: int) -> List[dict]:
    terms = [w for w, _ in Counter(tokenize(context)).most_common(40) if len(w) > 4]
    sentences = re.split(r"(?<=[.!?])\s+", context)
    questions: List[dict] = []
    used = set()
    for term in terms:
        if len(questions) >= count:
            break
        sent = next(
            (s.strip() for s in sentences if term in s.lower() and len(s.strip()) > 50), None
        )
        if not sent or term in used:
            continue
        used.add(term)
        distractors = [t for t in terms if t != term][:3]
        if len(distractors) < 3:
            continue
        questions.append(
            {
                "question": f'Which term does this describe? "{sent}"',
                "options": [term] + distractors,
                "answer": 0,
                "explanation": f"The passage defines '{term}'.",
            }
        )
    return questions


# --------------------------------------------------------------------------- #
# 3. Question paper generator
# --------------------------------------------------------------------------- #
def generate_paper(user_id: int, subject: str, level: str, file_id: Optional[int], online: bool) -> dict:
    context = _trim(_corpus(user_id, file_id), 10000)
    if not context.strip():
        return {"paper": "Upload notes for this subject to generate a paper.", "used_ai": False}

    if online:
        system = (
            "You are StudySphere, an MCA university exam paper setter. Generate a "
            "well-structured question paper in markdown following a university pattern:\n"
            "Section A: short questions (2 marks each), Section B: medium questions "
            "(5 marks), Section C: long/essay questions (10 marks). Include marks and "
            "instructions. Base questions on the provided notes."
        )
        prompt = f"Subject: {subject or 'the uploaded notes'}\nDifficulty: {level}\n\nNotes:\n{context}"
        out = ai_service.complete(system, prompt, max_tokens=2200)
        return {"paper": out, "used_ai": True, "mode": "ai"}

    return {"paper": _offline_paper(subject, context), "used_ai": False, "mode": "offline"}


def _offline_paper(subject: str, context: str) -> str:
    terms = [w for w, _ in Counter(tokenize(context)).most_common(30) if len(w) > 4]
    lines = [
        f"# {subject or 'Uploaded Notes'} — Practice Question Paper",
        "_Time: 3 Hours    Max Marks: 70_",
        "",
        "## Section A — Short Answers (5 × 2 = 10 marks)",
    ]
    for t in terms[:5]:
        lines.append(f"1. Define **{t}**.")
    lines += ["", "## Section B — Medium Answers (3 × 5 = 15 marks)"]
    for t in terms[5:8]:
        lines.append(f"1. Explain the concept of **{t}** with an example.")
    lines += ["", "## Section C — Long Answers (3 × 10 = 30 marks)"]
    for t in terms[8:11]:
        lines.append(f"1. Discuss **{t}** in detail.")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# 4. Revision / exam-prep planner
# --------------------------------------------------------------------------- #
def revision_plan(user_id: int, days: int, subject: str, file_id: Optional[int], online: bool) -> dict:
    context = _trim(_corpus(user_id, file_id), 8000)
    days = max(1, min(days, 60))

    if online:
        system = (
            "You are StudySphere, an exam-prep planner for MCA students. Produce a "
            "day-by-day revision schedule in markdown. Each day should list topics to "
            "cover, a practice task, and a short revision tip. Distribute the notes' "
            "topics sensibly across the available days, leaving the last day for full "
            "revision and mock tests."
        )
        prompt = f"Days available: {days}\nSubject: {subject or 'the uploaded notes'}\n\nNotes:\n{context}"
        out = ai_service.complete(system, prompt, max_tokens=2000)
        return {"plan": out, "used_ai": True, "mode": "ai"}

    return {"plan": _offline_plan(days, subject, context), "used_ai": False, "mode": "offline"}


def _offline_plan(days: int, subject: str, context: str) -> str:
    terms = [w for w, _ in Counter(tokenize(context)).most_common(days * 2) if len(w) > 4]
    if not terms:
        terms = ["fundamentals", "core concepts", "applications"]
    per_day = max(1, len(terms) // days)
    lines = [f"# {days}-Day Revision Plan — {subject or 'Uploaded Notes'}", ""]
    for d in range(1, days + 1):
        if d == days:
            lines.append(f"**Day {d}:** Full revision + solve a mock question paper.")
        else:
            topics = terms[(d - 1) * per_day : d * per_day] or ["review previous topics"]
            lines.append(f"**Day {d}:** Study {', '.join(topics)}. Practice: write short notes & self-quiz.")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# 5. Previous-paper analysis (offline keyword frequency, AI insight when online)
# --------------------------------------------------------------------------- #
def analyze_papers(user_id: int, file_id: Optional[int], online: bool) -> dict:
    chunks = db.all_chunks(user_id=user_id, file_id=file_id)
    if not chunks:
        return {"topics": [], "message": "Upload previous question papers to analyze.", "used_ai": False}

    text = "\n".join(c["text"] for c in chunks)
    counts = Counter(t for t in tokenize(text) if len(t) > 4)
    top = counts.most_common(15)
    if not top:
        return {"topics": [], "message": "Not enough text to analyze.", "used_ai": False}

    max_count = top[0][1]
    topics = [
        {"topic": term.capitalize(), "frequency": count, "weight": round(count / max_count, 2)}
        for term, count in top
    ]

    used_ai = False
    if online:
        system = (
            "You are StudySphere. Given the most frequent topics from previous "
            "question papers, write a 2-3 sentence study recommendation telling the "
            "student which topics to prioritise. Be specific and encouraging."
        )
        insight = ai_service.complete(system, f"Frequent topics: {json.dumps(top)}", max_tokens=300)
        used_ai = True
    else:
        names = ", ".join(t["topic"] for t in topics[:5])
        insight = f"Focus your revision on the most repeated topics: {names}."

    return {"topics": topics, "insight": insight, "used_ai": used_ai}


# --------------------------------------------------------------------------- #
def _parse_json_array(text: str) -> Optional[List[dict]]:
    if not text:
        return None
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, list) else None
    except (json.JSONDecodeError, ValueError):
        return None

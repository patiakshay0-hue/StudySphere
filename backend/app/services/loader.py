"""Document ingestion: extract text from PDF / DOCX / TXT and split it into
overlapping, page-aware chunks suitable for retrieval.
"""
import os
import tempfile
from typing import List, Optional, Tuple

import docx2txt
import pdfplumber
from fastapi import UploadFile

SUPPORTED = {"pdf", "docx", "doc", "txt", "md"}

CHUNK_SIZE = 900
CHUNK_OVERLAP = 150


async def extract_pages(file: UploadFile) -> Tuple[List[Tuple[Optional[int], str]], str]:
    """Return ``([(page_no, text), ...], suffix)`` for an uploaded file.

    ``page_no`` is the 1-based PDF page; it is ``None`` for formats without
    pages (DOCX/TXT), where the whole document is treated as one logical page.
    """
    content = await file.read()
    suffix = (file.filename or "").lower().rsplit(".", 1)[-1]
    if suffix not in SUPPORTED:
        raise ValueError(
            f"Unsupported file type '.{suffix}'. Supported: {', '.join(sorted(SUPPORTED))}."
        )

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{suffix}") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        if suffix == "pdf":
            pages = _extract_pdf(tmp_path)
        elif suffix in {"docx", "doc"}:
            pages = [(None, _extract_docx(tmp_path))]
        else:  # txt / md
            pages = [(None, content.decode("utf-8", errors="ignore"))]
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    pages = [(p, t) for p, t in pages if t and t.strip()]
    if not pages:
        raise ValueError("No readable text could be extracted from this file.")
    return pages, suffix


def _extract_pdf(path: str) -> List[Tuple[Optional[int], str]]:
    out: List[Tuple[Optional[int], str]] = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                out.append((i, text))
    return out


def _extract_docx(path: str) -> str:
    return docx2txt.process(path) or ""


def chunk_pages(
    pages: List[Tuple[Optional[int], str]],
    source_name: str,
    size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[dict]:
    """Split extracted pages into overlapping chunks, preserving page numbers."""
    chunks: List[dict] = []
    idx = 0
    for page_no, text in pages:
        normalized = " ".join(text.split())
        start = 0
        length = len(normalized)
        while start < length:
            end = min(start + size, length)
            # Prefer to break on a sentence/word boundary near the chunk end.
            if end < length:
                window = normalized[start:end]
                cut = max(window.rfind(". "), window.rfind("? "), window.rfind("! "))
                if cut > size * 0.5:
                    end = start + cut + 1
            piece = normalized[start:end].strip()
            if piece:
                chunks.append(
                    {
                        "idx": idx,
                        "text": piece,
                        "page": page_no,
                        "source": source_name,
                    }
                )
                idx += 1
            if end >= length:
                break
            start = max(end - overlap, start + 1)
    return chunks


def full_text(pages: List[Tuple[Optional[int], str]]) -> str:
    return "\n\n".join(t for _, t in pages)

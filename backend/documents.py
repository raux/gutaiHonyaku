"""PDF document ingestion and in-memory document storage helpers."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import re
import tempfile
import uuid

from pypdf import PdfReader

MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 40
MAX_BLOCK_CHARS = 1200


def _normalise_whitespace(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text or "").strip()


def _chunk_paragraph(paragraph: str, max_chars: int = MAX_BLOCK_CHARS) -> list[str]:
    paragraph = _normalise_whitespace(paragraph)
    if not paragraph:
        return []
    if len(paragraph) <= max_chars:
        return [paragraph]

    sentences = re.split(r"(?<=[.!?。！？])\s+", paragraph)
    chunks: list[str] = []
    current = ""

    for sentence in filter(None, sentences):
        candidate = sentence if not current else f"{current} {sentence}"
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(sentence) <= max_chars:
            current = sentence
            continue
        for idx in range(0, len(sentence), max_chars):
            chunks.append(sentence[idx: idx + max_chars].strip())
        current = ""

    if current:
        chunks.append(current)

    return [chunk for chunk in chunks if chunk]


def split_text_into_blocks(text: str, max_chars: int = MAX_BLOCK_CHARS) -> list[str]:
    paragraphs = re.split(r"\n\s*\n", text or "")
    blocks: list[str] = []

    for paragraph in paragraphs:
        cleaned = _normalise_whitespace(paragraph.replace("\r", "\n").replace("\n", " "))
        if not cleaned:
            continue
        blocks.extend(_chunk_paragraph(cleaned, max_chars=max_chars))

    return blocks


class DocumentStore:
    """Minimal in-memory document state backed by temporary PDF files."""

    def __init__(self, root_dir: Path | None = None):
        base_dir = root_dir or Path(tempfile.gettempdir()) / "gutaiHonyaku-documents"
        self.root_dir = Path(base_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._documents: dict[str, dict] = {}

    def _serialise(self, document: dict) -> dict:
        payload = deepcopy(document)
        payload.pop("_pdf_path", None)
        payload.pop("_block_index", None)
        return payload

    def create_pdf_document(self, filename: str, payload: bytes) -> dict:
        if not payload:
            raise ValueError("Uploaded PDF is empty.")
        if len(payload) > MAX_PDF_SIZE_BYTES:
            raise ValueError(
                f"PDF exceeds the {MAX_PDF_SIZE_BYTES // (1024 * 1024)} MB upload limit."
            )

        try:
            reader = PdfReader(BytesIO(payload))
        except Exception as exc:  # pragma: no cover - exercised via API tests
            raise ValueError("Could not parse the uploaded PDF.") from exc

        if len(reader.pages) > MAX_PDF_PAGES:
            raise ValueError(f"PDF exceeds the {MAX_PDF_PAGES}-page limit.")

        document_id = uuid.uuid4().hex
        safe_name = Path(filename or "document.pdf").name or "document.pdf"
        pdf_path = self.root_dir / f"{document_id}-{safe_name}"
        pdf_path.write_bytes(payload)

        pages: list[dict] = []
        blocks_by_id: dict[str, dict] = {}
        total_characters = 0

        for page_number, page in enumerate(reader.pages, start=1):
            page_text = (page.extract_text() or "").strip()
            page_blocks = []
            for block_index, block_text in enumerate(split_text_into_blocks(page_text), start=1):
                block_id = f"p{page_number}-b{block_index}"
                block = {
                    "block_id": block_id,
                    "page_number": page_number,
                    "block_index": block_index,
                    "text": block_text,
                    "character_count": len(block_text),
                }
                page_blocks.append(block)
                blocks_by_id[block_id] = block

            total_characters += len(page_text)
            pages.append(
                {
                    "page_number": page_number,
                    "text": page_text,
                    "character_count": len(page_text),
                    "blocks": page_blocks,
                }
            )

        if not any(page["text"].strip() for page in pages):
            raise ValueError(
                "Could not extract text from the PDF. It may be scanned or image-only and would require OCR."
            )

        document = {
            "document_id": document_id,
            "source_type": "pdf",
            "filename": safe_name,
            "mime_type": "application/pdf",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "page_count": len(pages),
            "character_count": total_characters,
            "pages": pages,
            "pdf_url": f"/documents/{document_id}/pdf",
            "translation": None,
            "_pdf_path": pdf_path,
            "_block_index": blocks_by_id,
        }
        self._documents[document_id] = document
        return self._serialise(document)

    def get_document(self, document_id: str) -> dict:
        document = self._documents.get(document_id)
        if not document:
            raise KeyError(document_id)
        return document

    def get_document_payload(self, document_id: str) -> dict:
        return self._serialise(self.get_document(document_id))

    def get_pdf_path(self, document_id: str) -> Path:
        document = self.get_document(document_id)
        return document["_pdf_path"]

    def get_block(self, document_id: str, block_id: str) -> dict:
        document = self.get_document(document_id)
        block = document["_block_index"].get(block_id)
        if not block:
            raise KeyError(block_id)
        return block

    def set_translation(self, document_id: str, translation_payload: dict) -> dict:
        document = self.get_document(document_id)
        document["translation"] = deepcopy(translation_payload)
        return deepcopy(document["translation"])

    def get_translation(self, document_id: str) -> dict | None:
        document = self.get_document(document_id)
        return deepcopy(document.get("translation"))

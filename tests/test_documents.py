"""Tests for PDF document ingestion and translation flows."""
from fastapi.testclient import TestClient
import pytest

from backend import documents, main


client = TestClient(main.app)


class FakePage:
    def __init__(self, text):
        self._text = text

    def extract_text(self):
        return self._text


class FakePdfReader:
    def __init__(self, _stream):
        self.pages = [
            FakePage("First page paragraph one.\n\nFirst page paragraph two."),
            FakePage("Second page text."),
        ]


@pytest.fixture()
def isolated_document_store(tmp_path, monkeypatch):
    store = documents.DocumentStore(tmp_path)
    monkeypatch.setattr(main, "document_store", store)
    return store


def test_upload_pdf_returns_structured_document(monkeypatch, isolated_document_store):
    monkeypatch.setattr(documents, "PdfReader", FakePdfReader)

    response = client.post(
        "/documents/upload",
        files={"file": ("sample.pdf", b"%PDF-1.4 sample", "application/pdf")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_type"] == "pdf"
    assert payload["page_count"] == 2
    assert payload["pages"][0]["page_number"] == 1
    assert payload["pages"][0]["blocks"][0]["block_id"] == "p1-b1"
    assert payload["pages"][0]["blocks"][1]["block_id"] == "p1-b2"
    assert payload["pages"][1]["blocks"][0]["block_id"] == "p2-b1"
    assert payload["pdf_url"].endswith("/pdf")


def test_upload_pdf_rejects_image_only_document(monkeypatch, isolated_document_store):
    class BlankPdfReader:
        def __init__(self, _stream):
            self.pages = [FakePage(" "), FakePage("")]

    monkeypatch.setattr(documents, "PdfReader", BlankPdfReader)

    response = client.post(
        "/documents/upload",
        files={"file": ("scan.pdf", b"%PDF-1.4 blank", "application/pdf")},
    )

    assert response.status_code == 400
    assert "require OCR" in response.json()["detail"]


def test_translate_document_keeps_page_and_block_mappings(monkeypatch, isolated_document_store):
    monkeypatch.setattr(documents, "PdfReader", FakePdfReader)
    upload = client.post(
        "/documents/upload",
        files={"file": ("sample.pdf", b"%PDF-1.4 sample", "application/pdf")},
    )
    document_id = upload.json()["document_id"]

    monkeypatch.setattr(main, "_make_client", lambda *args, **kwargs: (object(), "test-model"))

    def fake_translate(_client, _model, text, _source_lang, _target_lang):
        return {
            "translation": f"JP::{text}",
            "reasoning": f"reason::{text}",
            "pairs": [{"src": "page", "tgt": "ページ"}],
        }

    monkeypatch.setattr(main, "translate_text", fake_translate)

    response = client.post(
        f"/documents/{document_id}/translate",
        json={"source_lang": "English", "target_lang": "Japanese"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["document_id"] == document_id
    assert len(payload["blocks"]) == 3
    assert payload["blocks"][0]["mapping"] == {
        "page_number": 1,
        "source_block_id": "p1-b1",
        "translated_block_id": "p1-b1",
    }
    assert payload["page_mappings"][0] == {
        "page_number": 1,
        "source_block_ids": ["p1-b1", "p1-b2"],
        "translated_block_ids": ["p1-b1", "p1-b2"],
    }
    assert payload["pages"][1]["translation"] == "JP::Second page text."


def test_adjust_document_block_updates_only_selected_block(monkeypatch, isolated_document_store):
    monkeypatch.setattr(documents, "PdfReader", FakePdfReader)
    upload = client.post(
        "/documents/upload",
        files={"file": ("sample.pdf", b"%PDF-1.4 sample", "application/pdf")},
    )
    document_id = upload.json()["document_id"]

    monkeypatch.setattr(main, "_make_client", lambda *args, **kwargs: (object(), "test-model"))
    monkeypatch.setattr(
        main,
        "translate_text",
        lambda *_args, **_kwargs: {
            "translation": "initial translation",
            "reasoning": "initial reasoning",
            "pairs": [{"src": "First", "tgt": "最初"}],
        },
    )
    client.post(
        f"/documents/{document_id}/translate",
        json={"source_lang": "English", "target_lang": "Japanese"},
    )

    def fake_adjust(_client, _model, original, current_translation, instruction, _source_lang, _target_lang):
        return {
            "translation": f"{current_translation} [{instruction}] for {original}",
            "reasoning": "updated reasoning",
            "pairs": [{"src": "First", "tgt": "更新"}],
        }

    monkeypatch.setattr(main, "adjust_translation", fake_adjust)

    response = client.post(
        f"/documents/{document_id}/blocks/p1-b2/adjust",
        json={"instruction": "make it formal", "source_lang": "English", "target_lang": "Japanese"},
    )

    assert response.status_code == 200
    payload = response.json()
    updated_block = next(block for block in payload["blocks"] if block["block_id"] == "p1-b2")
    untouched_block = next(block for block in payload["blocks"] if block["block_id"] == "p1-b1")
    assert "make it formal" in updated_block["translation"]
    assert updated_block["reasoning"] == "updated reasoning"
    assert untouched_block["translation"] == "initial translation"

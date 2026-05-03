"""main.py – FastAPI entry point for gutaiHonyaku."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel

from backend.documents import DocumentStore
from backend.translator import translate_text, adjust_translation, generate_furigana

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

LM_STUDIO_BASE_URL = os.environ.get("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
DEFAULT_MODEL = os.environ.get("LM_STUDIO_MODEL", "")
PROVIDER_TIMEOUT_SECONDS = 5
document_store = DocumentStore()


def _provider_defaults(provider: str | None) -> tuple[str, str]:
    """Return the default base URL and API key for the selected provider."""
    if provider == "ollama":
        return OLLAMA_BASE_URL, "ollama"
    return LM_STUDIO_BASE_URL, "lm-studio"


def _normalize_base_url(base_url: str) -> str:
    """Normalise a provider URL so it includes a scheme and ends with /v1."""
    normalized = (base_url or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="base_url must not be empty")

    if not normalized.startswith(("http://", "https://")):
        normalized = f"http://{normalized}"

    parsed = urlparse(normalized)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid provider URL")

    normalized = normalized.rstrip("/")
    if not normalized.endswith("/v1"):
        normalized = f"{normalized}/v1"

    return normalized


def _resolve_provider_request(base_url: str | None, provider: str | None) -> tuple[str, str]:
    """Resolve a provider request to a normalised OpenAI-compatible base URL and API key."""
    default_url, api_key = _provider_defaults(provider)
    return _normalize_base_url(base_url or default_url), api_key


async def _fetch_provider_models(base_url: str, api_key: str) -> httpx.Response:
    """Fetch the provider's model list from its OpenAI-compatible /models endpoint."""
    async with httpx.AsyncClient(timeout=PROVIDER_TIMEOUT_SECONDS) as client:
        return await client.get(
            f"{base_url}/models",
            headers={"Authorization": f"Bearer {api_key}"},
        )


def _make_client(
    lm_studio_url: str | None,
    model: str | None,
    provider: str | None,
) -> tuple[OpenAI, str]:
    """Create an OpenAI-compatible client and resolve the model name."""
    base_url, api_key = _resolve_provider_request(lm_studio_url, provider)

    client = OpenAI(base_url=base_url, api_key=api_key)

    # Resolve model
    resolved_model = model or DEFAULT_MODEL
    if not resolved_model:
        try:
            models = client.models.list()
            if models.data:
                resolved_model = models.data[0].id
        except Exception:
            resolved_model = "default"

    return client, resolved_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("gutaiHonyaku backend starting up")
    yield
    logger.info("gutaiHonyaku backend shutting down")


app = FastAPI(title="gutaiHonyaku", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "English"
    target_lang: str = "Japanese"
    lm_studio_url: str | None = None
    model: str | None = None
    provider: str | None = "lm_studio"


class AdjustRequest(BaseModel):
    original: str
    translation: str
    instruction: str
    source_lang: str = "English"
    target_lang: str = "Japanese"
    lm_studio_url: str | None = None
    model: str | None = None
    provider: str | None = "lm_studio"


class FuriganaRequest(BaseModel):
    text: str


class ProviderRequest(BaseModel):
    base_url: str | None = None
    provider: str | None = "lm_studio"


class DocumentTranslateRequest(BaseModel):
    source_lang: str = "English"
    target_lang: str = "Japanese"
    lm_studio_url: str | None = None
    model: str | None = None
    provider: str | None = "lm_studio"


class DocumentAdjustRequest(DocumentTranslateRequest):
    instruction: str


def _build_document_translation_payload(document: dict, translated_blocks: list[dict]) -> dict:
    blocks_by_id = {block["block_id"]: block for block in translated_blocks}
    translated_pages: list[dict] = []

    for page in document["pages"]:
        page_blocks = [blocks_by_id[block["block_id"]] for block in page["blocks"] if block["block_id"] in blocks_by_id]
        page_translation = "\n\n".join(block["translation"] for block in page_blocks if block["translation"].strip())
        translated_pages.append(
            {
                "page_number": page["page_number"],
                "source_text": page["text"],
                "translation": page_translation,
                "blocks": page_blocks,
            }
        )

    full_translation = "\n\n\n".join(page["translation"] for page in translated_pages if page["translation"].strip())
    page_mappings = [
        {
            "page_number": page["page_number"],
            "source_block_ids": [block["block_id"] for block in page["blocks"]],
            "translated_block_ids": [block["block_id"] for block in page["blocks"]],
        }
        for page in translated_pages
    ]

    return {
        "document_id": document["document_id"],
        "source_type": document["source_type"],
        "filename": document["filename"],
        "pdf_url": document["pdf_url"],
        "page_count": document["page_count"],
        "translation": full_translation,
        "pages": translated_pages,
        "blocks": translated_blocks,
        "page_mappings": page_mappings,
        "selected_block_id": translated_blocks[0]["block_id"] if translated_blocks else None,
    }


def _translate_document(document: dict, client: OpenAI, model: str, source_lang: str, target_lang: str) -> dict:
    translated_blocks: list[dict] = []

    for page in document["pages"]:
        for block in page["blocks"]:
            result = translate_text(client, model, block["text"], source_lang, target_lang)
            translated_blocks.append(
                {
                    "block_id": block["block_id"],
                    "page_number": block["page_number"],
                    "block_index": block["block_index"],
                    "source_text": block["text"],
                    "translation": result["translation"],
                    "reasoning": result.get("reasoning", ""),
                    "pairs": result.get("pairs", []),
                    "source_furigana": result.get("source_furigana"),
                    "target_furigana": result.get("target_furigana"),
                    "mapping": {
                        "page_number": block["page_number"],
                        "source_block_id": block["block_id"],
                        "translated_block_id": block["block_id"],
                    },
                }
            )

    return _build_document_translation_payload(document, translated_blocks)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "gutaiHonyaku"}


@app.get("/status")
async def status():
    """Check whether LM Studio and Ollama are reachable."""
    results: dict = {}

    # LM Studio
    try:
        lm_url, lm_api_key = _resolve_provider_request(None, "lm_studio")
        r = await _fetch_provider_models(lm_url, lm_api_key)
        results["lm_studio"] = {"reachable": r.status_code == 200}
    except Exception:
        results["lm_studio"] = {"reachable": False}

    # Ollama
    try:
        ollama_url, ollama_api_key = _resolve_provider_request(None, "ollama")
        r = await _fetch_provider_models(ollama_url, ollama_api_key)
        results["ollama"] = {"reachable": r.status_code == 200}
    except Exception:
        results["ollama"] = {"reachable": False}

    return results


@app.post("/provider-health")
async def provider_health(req: ProviderRequest):
    """Check whether a specific LM Studio or Ollama URL is reachable."""
    try:
        base_url, api_key = _resolve_provider_request(req.base_url, req.provider)
        response = await _fetch_provider_models(base_url, api_key)
        return {"reachable": response.status_code == 200}
    except HTTPException:
        raise
    except Exception:
        return {"reachable": False}


@app.post("/models")
async def list_models(req: ProviderRequest):
    """Fetch models for a specific LM Studio or Ollama URL via the backend."""
    try:
        base_url, api_key = _resolve_provider_request(req.base_url, req.provider)
        response = await _fetch_provider_models(base_url, api_key)
        response.raise_for_status()
        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail="Provider returned a non-JSON models response.",
            ) from exc
        return {"data": payload.get("data", [])}
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Provider returned HTTP {exc.response.status_code} while listing models.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Could not reach the local provider to list models.",
        ) from exc


@app.post("/translate")
async def translate(req: TranslateRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    try:
        client, model = _make_client(req.lm_studio_url, req.model, req.provider)
        result = translate_text(client, model, req.text, req.source_lang, req.target_lang)
        return result
    except Exception as e:
        msg = str(e)
        if any(k in msg.lower() for k in ("connection", "refused", "offline", "reachable")):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Local server offline – make sure LM Studio or Ollama is running "
                    "and a model is loaded."
                ),
            )
        raise HTTPException(status_code=500, detail=msg)


@app.post("/adjust")
async def adjust(req: AdjustRequest):
    if not req.instruction.strip():
        raise HTTPException(status_code=400, detail="instruction must not be empty")

    try:
        client, model = _make_client(req.lm_studio_url, req.model, req.provider)
        result = adjust_translation(
            client,
            model,
            req.original,
            req.translation,
            req.instruction,
            req.source_lang,
            req.target_lang,
        )
        return result
    except Exception as e:
        msg = str(e)
        if any(k in msg.lower() for k in ("connection", "refused", "offline", "reachable")):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Local server offline – make sure LM Studio or Ollama is running "
                    "and a model is loaded."
                ),
            )
        raise HTTPException(status_code=500, detail=msg)


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    filename = file.filename or "document.pdf"
    suffix = Path(filename).suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF.")

    payload = await file.read()
    try:
        return document_store.create_pdf_document(filename, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/documents/{document_id}")
async def get_document(document_id: str):
    try:
        return document_store.get_document_payload(document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Document not found.") from exc


@app.get("/documents/{document_id}/pdf")
async def get_document_pdf(document_id: str):
    try:
        pdf_path = document_store.get_pdf_path(document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Document not found.") from exc
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path.name)


@app.post("/documents/{document_id}/translate")
async def translate_document(document_id: str, req: DocumentTranslateRequest):
    try:
        document = document_store.get_document(document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Document not found.") from exc

    try:
        client, model = _make_client(req.lm_studio_url, req.model, req.provider)
        result = _translate_document(document, client, model, req.source_lang, req.target_lang)
        document_store.set_translation(document_id, result)
        return result
    except Exception as e:
        msg = str(e)
        if any(k in msg.lower() for k in ("connection", "refused", "offline", "reachable")):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Local server offline – make sure LM Studio or Ollama is running "
                    "and a model is loaded."
                ),
            )
        raise HTTPException(status_code=500, detail=msg)


@app.post("/documents/{document_id}/blocks/{block_id}/adjust")
async def adjust_document_block(document_id: str, block_id: str, req: DocumentAdjustRequest):
    if not req.instruction.strip():
        raise HTTPException(status_code=400, detail="instruction must not be empty")

    try:
        source_block = document_store.get_block(document_id, block_id)
        current_translation = document_store.get_translation(document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Document or block not found.") from exc

    if not current_translation:
        raise HTTPException(status_code=409, detail="Translate the PDF before adjusting a block.")

    translated_block = next((block for block in current_translation["blocks"] if block["block_id"] == block_id), None)
    if not translated_block:
        raise HTTPException(status_code=404, detail="Translated block not found.")

    try:
        client, model = _make_client(req.lm_studio_url, req.model, req.provider)
        result = adjust_translation(
            client,
            model,
            source_block["text"],
            translated_block["translation"],
            req.instruction,
            req.source_lang,
            req.target_lang,
        )
    except Exception as e:
        msg = str(e)
        if any(k in msg.lower() for k in ("connection", "refused", "offline", "reachable")):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Local server offline – make sure LM Studio or Ollama is running "
                    "and a model is loaded."
                ),
            )
        raise HTTPException(status_code=500, detail=msg)

    updated_blocks = []
    for block in current_translation["blocks"]:
        if block["block_id"] == block_id:
            updated_blocks.append(
                {
                    **block,
                    "translation": result["translation"],
                    "reasoning": result.get("reasoning", ""),
                    "pairs": result.get("pairs", []),
                    "source_furigana": result.get("source_furigana"),
                    "target_furigana": result.get("target_furigana"),
                }
            )
        else:
            updated_blocks.append(block)

    updated_translation = _build_document_translation_payload(document_store.get_document(document_id), updated_blocks)
    document_store.set_translation(document_id, updated_translation)
    return updated_translation


@app.post("/furigana")
async def furigana(req: FuriganaRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")
    return {"furigana": generate_furigana(req.text)}


# ---------------------------------------------------------------------------
# Serve the built frontend (single-server mode)
# ---------------------------------------------------------------------------
# After running `cd frontend && npm run build`, the static assets live in
# frontend/dist/.  Mount them here so that only uvicorn needs to run.

if FRONTEND_DIR.is_dir():
    # Serve hashed JS/CSS bundles produced by Vite
    _assets_dir = FRONTEND_DIR / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="frontend-assets")

    _FRONTEND_INDEX = FRONTEND_DIR / "index.html"

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend static files, falling back to index.html for SPA routing."""
        if full_path:
            file_path = (FRONTEND_DIR / full_path).resolve()
            # Only serve files that exist inside the dist directory
            if file_path.is_relative_to(FRONTEND_DIR) and file_path.is_file():
                return FileResponse(file_path)
        return FileResponse(_FRONTEND_INDEX)

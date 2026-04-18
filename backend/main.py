"""main.py – FastAPI entry point for gutaiHonyaku."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel

from backend.translator import translate_text, adjust_translation, generate_furigana

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

LM_STUDIO_BASE_URL = os.environ.get("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
DEFAULT_MODEL = os.environ.get("LM_STUDIO_MODEL", "")


def _make_client(
    lm_studio_url: str | None,
    model: str | None,
    provider: str | None,
) -> tuple[OpenAI, str]:
    """Create an OpenAI-compatible client and resolve the model name."""
    if provider == "ollama":
        base_url = lm_studio_url or OLLAMA_BASE_URL
        api_key = "ollama"
    else:
        base_url = lm_studio_url or LM_STUDIO_BASE_URL
        api_key = "lm-studio"

    # Normalise base URL – ensure it ends with /v1
    stripped = base_url.rstrip("/")
    if not stripped.endswith("/v1"):
        base_url = stripped + "/v1"
    else:
        base_url = stripped

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
    lm_url = LM_STUDIO_BASE_URL.rstrip("/v1").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(
                f"{lm_url}/v1/models",
                headers={"Authorization": "Bearer lm-studio"},
            )
            results["lm_studio"] = {"reachable": r.status_code == 200}
    except Exception:
        results["lm_studio"] = {"reachable": False}

    # Ollama
    ollama_url = OLLAMA_BASE_URL.rstrip("/v1").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(
                f"{ollama_url}/v1/models",
                headers={"Authorization": "Bearer ollama"},
            )
            results["ollama"] = {"reachable": r.status_code == 200}
    except Exception:
        results["ollama"] = {"reachable": False}

    return results


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

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend static files, falling back to index.html for SPA routing."""
        file_path = (FRONTEND_DIR / full_path).resolve()
        # Prevent directory traversal
        if file_path.is_file() and str(file_path).startswith(str(FRONTEND_DIR)):
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")

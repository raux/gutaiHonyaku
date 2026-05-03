# AGENTS.md – gutaiHonyaku

## What it does

Word-level translation app (English ⇄ Japanese) powered by local LLMs (LM Studio or Ollama). Two frontends: Streamlit (`app.py`) and React/Vite (`frontend/`). FastAPI backend serves the React app and exposes `/translate`, `/adjust`, `/furigana` APIs.

## Architecture

| Layer | Path | Role |
|---|---|---|
| **Backend** | `backend/main.py` | FastAPI app — routes, lifespan, serves `frontend/dist/` static |
| **Core** | `backend/translator.py` | `_chat()`, `extract_json()`, `translate_text()`, `adjust_translation()`, `generate_furigana()` |
| **Frontend** | `frontend/src/` | React + Vite + Tailwind (built to `frontend/dist/`) |
| **Streamlit** | `app.py` | Legacy single-stack frontend (uses `pdf_extractor.py`, `word_align.py`) |
| **Config** | `backend/.env` | `LM_STUDIO_BASE_URL`, `LM_STUDIO_MODEL`, `OLLAMA_BASE_URL` |

## Key gotchas

- **LLM server must be running** before translating — returns 503 if LM Studio/Ollama is unreachable
- **`extract_json()`** strips markdown fences and grabs the first `{...}` block — small models often produce invalid JSON
- **Furigana requires `pykakasi`** — returns `[]` silently if not installed; only meaningful for text containing kanji
- **`source_lang == "Japanese"` triggers `source_furigana`**; `target_lang == "Japanese"` triggers `target_furigana`
- **Backend deps are pinned** in `backend/requirements.txt` (not root `requirements.txt`) — install from there
- **Frontend must be built** (`cd frontend && npm run build`) before the FastAPI server serves it — otherwise 404/blank page

## Setup & run

```bash
# 1. Backend
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# 2. Frontend
cd frontend && npm install && npm run build && cd ..

# 3. Start LM Studio or Ollama with a model loaded

# 4. Server
uvicorn backend.main:app --reload --port 8000
```

Or use the convenience scripts: `./run_all.sh` (install + build), `./start_app.sh` (build + start).

## Tests

```bash
python -m pytest tests/ -v
```

21 tests in `tests/test_translator.py` with `DummyClient` — covers `extract_json`, `translate_text`, `adjust_translation`, `generate_furigana`.

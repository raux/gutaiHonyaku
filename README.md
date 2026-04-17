# gutaiHonyaku – 具体翻訳

**Word-level language translation with bidirectional alignment, powered by a local LLM (LM Studio or Ollama).**

![gutaiHonyaku screenshot](https://github.com/user-attachments/assets/9b6ae7dd-32e1-4e4c-b42f-60d2d0c78097)

Type (or paste) source text into any of the five document sections, click **Translate**, and the translation appears side-by-side.  Hover over any word to see which word(s) it maps to in the other panel.  Double-click a word to edit it inline.  Use the **Adjust Translation** chat bar to give free-form instructions such as *"make it more formal"* or *"translate 'book' as 本 not 書物"*.

---

## Features

| Feature | Description |
|---|---|
| **5 document sections** | Title · Introduction · Background & Main Text · Discussion · Conclusion |
| **Any language pair** | 15 languages built-in; source ⇄ target swap with one click |
| **Word-level alignment** | Hover a word on either side to highlight the aligned word(s) on the other side |
| **Inline word editing** | Double-click any word in source or translation to replace it |
| **Adjust Translation chat** | Per-section chat panel: type an instruction and the LLM updates the translation |
| **Translate All** | One button translates every non-empty section sequentially |
| **Local LLM** | Works with [LM Studio](https://lmstudio.ai) or [Ollama](https://ollama.com) – no data leaves your machine |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | ≥ 3.11 | Backend |
| Node.js | ≥ 18 | Frontend build |
| [LM Studio](https://lmstudio.ai) **or** [Ollama](https://ollama.com) | latest | Local LLM server |

> **Recommended models:** any instruction-following model works well.  
> Examples: `llama3`, `mistral`, `gemma3`, `qwen2.5`.

---

## Installation

### 1 – Clone the repository

```bash
git clone https://github.com/raux/gutaiHonyaku.git
cd gutaiHonyaku
```

### 2 – Backend

```bash
# Create and activate a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

#### Configuration (optional)

Copy / edit `backend/.env` to point at a non-default server URL or pin a model:

```dotenv
# backend/.env
LM_STUDIO_BASE_URL=http://localhost:1234/v1   # default LM Studio URL
LM_STUDIO_MODEL=                              # leave blank → first available model

# Uncomment for Ollama on a non-default port:
# OLLAMA_BASE_URL=http://localhost:11434/v1
```

### 3 – Frontend

```bash
cd frontend
npm install
```

---

## Running the Application

You need **three** things running at the same time: the LLM server, the FastAPI backend, and the Vite dev server.

### Step 1 – Start your LLM server

**LM Studio:**  Open LM Studio → load a model → click **Start Server** (defaults to `http://localhost:1234`).

**Ollama:**
```bash
ollama serve          # starts on http://localhost:11434
ollama pull llama3    # download a model if you haven't already
```

### Step 2 – Start the backend

```bash
# From the repo root (with your venv active)
cd backend
uvicorn main:app --reload --port 8000
```

The API is now at `http://localhost:8000`.  
Check it is alive: `curl http://localhost:8000/health`

### Step 3 – Start the frontend

```bash
# In a second terminal, from the repo root
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Usage

### Connecting to your LLM

The top bar shows the connection status.

1. Choose your provider (**LM Studio** or **Ollama**) from the dropdown.
2. Verify (or edit) the server URL – defaults are `http://localhost:1234` and `http://localhost:11434`.
3. Click **🔌 Connect**.  The status dot turns green and the model list is populated.
4. Select the model you want to use.

### Translating a section

1. Select a section tab – **Title**, **Introduction**, **Background & Main Text**, **Discussion**, or **Conclusion**.
2. Choose the **source** and **target** languages from the language bar.
3. Type or paste your text into the left (source) panel.
4. Click **Translate** (per-section) or **Translate All** (all sections at once).

### Word alignment

After a translation, both panels display the text as interactive word spans:

- **Hover** any word on either side – the aligned word(s) on the opposite side light up.  
  Source highlights: **amber**. Translation highlights: **teal**.
- Words that have alignment data respond to hover; unaligned words are muted.

### Editing words

- **Double-click** any word in either panel to open the edit modal.
- Type the replacement, then press **Enter** or click **Apply**.
- Editing a *translation* word rebuilds the alignment map immediately.
- Editing a *source* word marks the translation as stale (⚠ source changed) and enables **Re-translate**.

### Adjusting a section via chat

1. Click **💬 Adjust Translation** at the bottom of any section panel.
2. Type a free-form instruction, e.g.:
   - *"make the tone more formal"*
   - *"translate 'heart' as 心 not ハート"*
   - *"the third sentence should be shorter"*
3. Press **Enter** or click the send button.
4. The LLM returns a new translation with a brief explanation of changes.  
   The word alignment is rebuilt automatically.

---

## Running Tests

```bash
# From the repo root (with your venv active)
pip install pytest
python -m pytest tests/ -v
```

All 13 tests cover `extract_json`, `translate_text`, and `adjust_translation` with mock LLM clients.

---

## Project Structure

```
gutaiHonyaku/
├── backend/
│   ├── main.py           # FastAPI app – /translate, /adjust, /health, /status
│   ├── translator.py     # LLM chat wrapper + word-alignment JSON extraction
│   ├── requirements.txt
│   └── .env              # Server URL / model config (safe to commit as template)
├── frontend/
│   ├── src/
│   │   ├── App.jsx                        # Root layout – tabs, language bar, Translate All
│   │   ├── api.js                         # Axios client + LM Studio/Ollama helpers
│   │   └── components/
│   │       ├── LmStudioConfig.jsx         # Provider/URL/model connection bar
│   │       ├── SectionPanel.jsx           # Source ↔ Translation split view + word-edit modal
│   │       ├── WordDisplay.jsx            # Interactive word spans + alignment algorithm
│   │       └── AdjustChat.jsx             # Per-section adjustment chat
│   ├── package.json
│   └── vite.config.js    # Proxies /translate & /adjust → http://localhost:8000
└── tests/
    └── test_translator.py
```

---

## Production Build

```bash
cd frontend
npm run build          # outputs to frontend/dist/
```

Serve `frontend/dist/` with any static file server (nginx, Caddy, etc.) and point your backend at the same origin, or configure a reverse proxy.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Local server offline" in the UI | Make sure LM Studio or Ollama is running and a model is loaded/started |
| Model dropdown is empty | Click **🔌 Connect** – the models list is fetched on connection |
| Translation returns garbled JSON | Try a different (larger) model; some small models don't reliably follow JSON instructions |
| `uvicorn: command not found` | Make sure your virtual environment is activated and `pip install -r backend/requirements.txt` has been run |
| Frontend can't reach backend | Ensure the backend is on port 8000; the Vite proxy is hard-coded to `http://localhost:8000` |


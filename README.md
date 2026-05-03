# gutaiHonyaku – 具体翻訳

**Word-level language translation with bidirectional alignment, powered by a local LLM (LM Studio or Ollama).**

![gutaiHonyaku main interface](https://github.com/user-attachments/assets/9b6ae7dd-32e1-4e4c-b42f-60d2d0c78097)

Type (or paste) source text into a single document workspace, or upload a PDF to preserve page references while extracting text for translation. Hover over any word to see which word(s) it maps to in the other panel. Double-click a word to edit it inline in plain-text mode. Use the **Adjust Translation** chat bar to give free-form instructions such as *"make it more formal"* or *"translate 'book' as 本 not 書物"*. A dedicated **LLM Reasoning** panel shows the model's latest explanation of its translation choices.

## Table of Contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Usage Guide](#usage-guide)
  - [Connecting to your LLM](#connecting-to-your-llm)
  - [Translating a document](#translating-a-document)
  - [Word alignment](#word-alignment)
  - [Editing words](#editing-words)
  - [Adjusting translations](#adjusting-translations)
- [Running Tests](#running-tests)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Production Build](#production-build)
- [Troubleshooting](#troubleshooting)

---

## Screenshots

### Main Interface

![Main interface with language selection](https://github.com/user-attachments/assets/9b6ae7dd-32e1-4e4c-b42f-60d2d0c78097)
*Single document workspace with side-by-side translation panels*

### Word Alignment in Action

<div align="center">
<img src="https://github.com/user-attachments/assets/word-alignment-demo.png" alt="Word alignment hover effect" width="700"/>
</div>

*Hover any word to see its translation highlighted – bidirectional alignment works both ways*

### LLM Connection Bar

<div align="center">
<img src="https://github.com/user-attachments/assets/lm-studio-config.png" alt="LM Studio configuration bar" width="700"/>
</div>

*Connect to LM Studio or Ollama with auto-detection of available models*

### Adjust Translation Chat

<div align="center">
<img src="https://github.com/user-attachments/assets/adjust-chat.png" alt="Adjust translation chat interface" width="700"/>
</div>

*Give the LLM free-form instructions to refine translations without editing the source*

---

## Features

| Feature | Description |
|---|---|
| **Single document workspace** | Translate one full document in a single source ↔ translation view |
| **PDF ingestion with page links** | Upload a PDF, extract text by page/block, and keep the translation linked back to each source page |
| **Any language pair** | English ⇄ Japanese built-in; source ⇄ target swap with one click |
| **Word-level alignment** | Hover a word on either side to highlight the aligned word(s) on the other side |
| **Inline word editing** | Double-click any word in source or translation to replace it |
| **Adjust Translation chat** | Document-level chat panel: type an instruction and the LLM updates the translation |
| **LLM reasoning panel** | Dedicated space that shows the model's latest explanation for the current translation |
| **Furigana (振り仮名)** | Automatic ruby annotations for Japanese kanji, showing hiragana readings above characters |
| **Local LLM** | Works with [LM Studio](https://lmstudio.ai) or [Ollama](https://ollama.com) – no data leaves your machine |

---

## Quick Start

**TL;DR** – Get translating in 5 minutes:

```bash
# 1. Clone and install
git clone https://github.com/raux/gutaiHonyaku.git
cd gutaiHonyaku

# 2. Backend setup
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# 3. Frontend setup
cd frontend
npm install
npm run build
cd ..

# 4. Start LM Studio or Ollama with a model loaded

# 5. Start the server
uvicorn backend.main:app --reload --port 8000

# 6. Open http://localhost:8000 and start translating!
```

**First time?** Follow the detailed [Installation](#installation) and [Running the Application](#running-the-application) sections below.

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
npm run build
```

This produces the static assets in `frontend/dist/`, which the FastAPI backend will serve automatically.

---

## Running the Application

You need **two** things running at the same time: the LLM server and the gutaiHonyaku server.

### Step 1 – Start your LLM server

**LM Studio:**  Open LM Studio → load a model → click **Start Server** (defaults to `http://localhost:1234`).

**Ollama:**
```bash
ollama serve          # starts on http://localhost:11434
ollama pull llama3    # download a model if you haven't already
```

### Step 2 – Start the server

```bash
# From the repo root (with your venv active)
uvicorn backend.main:app --reload --port 8000
```

The application is now at `http://localhost:8000`.  
Check it is alive: `curl http://localhost:8000/health`

Open **http://localhost:8000** in your browser.

> **💡 Development mode:** If you prefer Vite's hot-reload during frontend development, you can still run `cd frontend && npm run dev` in a separate terminal. The Vite dev server proxies API requests to port 8000 automatically.

---

## Usage Guide

### Connecting to your LLM

Before you can start translating, you need to connect gutaiHonyaku to your local LLM server.

<div align="center">
<img src="https://github.com/user-attachments/assets/connection-bar-example.png" alt="LM Studio connection bar" width="800"/>
<p><i>The connection bar at the top of the interface</i></p>
</div>

**Steps:**

1. Choose your provider (**LM Studio** or **Ollama**) from the dropdown.
2. Verify (or edit) the server URL:
   - LM Studio default: `http://localhost:1234`
   - Ollama default: `http://localhost:11434`
3. Click **🔌 Connect**. The status indicator will turn green and available models will be loaded.
4. Select the model you want to use from the model dropdown.

> **💡 Tip:** The connection status auto-polls every 5 seconds, so if your LLM server goes down, you'll see the status indicator turn red.

---

### Translating a document

gutaiHonyaku now uses a single document workspace. Paste the full text you want to translate into the source panel, then work with the translated result in the panel beside it.

<div align="center">
<img src="https://github.com/user-attachments/assets/translation-workflow.png" alt="Translation workflow" width="800"/>
<p><i>Source text on the left, translation on the right</i></p>
</div>

**Steps:**

1. **Choose languages** – Select source and target languages from the language bar. Use the **⇄** button to swap them.
2. **Enter text** – Type or paste your text into the left (source) panel.
3. **Translate** – Click **Translate** to translate the current document.

The translation appears in the right panel with word-level alignment automatically computed.

---

### Translating a PDF

You can also switch the source mode to **PDF upload** and translate an extracted document while preserving page-level links.

**Steps:**

1. **Switch to PDF upload** – Use the source mode toggle at the top of the workspace.
2. **Upload a PDF** – Select a `.pdf` file. The backend stores it temporarily, extracts text page by page, and splits long pages into smaller blocks.
3. **Review extracted pages** – The left panel shows an embedded PDF viewer plus the extracted text blocks for each page.
4. **Translate the PDF** – Click **Translate PDF** to translate each extracted block while keeping its original page number.
5. **Jump between views** – Click a translated block to jump to the corresponding PDF page, or click an extracted source block to focus the linked translation.
6. **Adjust only one block** – Use **Adjust Translation** after selecting a translated PDF block to rework that block without retranslating the entire file.

> **Note:** Image-only or scanned PDFs without extractable text are rejected with a message that OCR is required.

---

### Word alignment

After translation, both panels switch to an interactive word-span view where you can explore the alignment between source and translation.

<div align="center">
<img src="https://github.com/user-attachments/assets/word-alignment-hover.png" alt="Word alignment on hover" width="800"/>
<p><i>Hovering "translation" highlights its Japanese equivalent "翻訳"</i></p>
</div>

**How it works:**

- **Hover** any word on either side – the aligned word(s) on the opposite side highlight.
  - Source words highlight in **amber** when you hover the translation
  - Translation words highlight in **teal** when you hover the source
- The alignment is bidirectional and phrase-aware (one word can map to multiple words).
- Words without alignment data appear muted and don't respond to hover.

This feature helps you understand how the LLM interpreted each part of the source text.

---

### Editing words

You can edit individual words in either the source or translation directly without re-translating the entire document.

<div align="center">
<img src="https://github.com/user-attachments/assets/word-edit-modal.png" alt="Word edit modal" width="400"/>
<p><i>Double-click any word to edit it inline</i></p>
</div>

**Steps:**

1. **Double-click** any word in either panel to open the edit modal.
2. Type the replacement text.
3. Press **Enter** or click **Apply**.

**Behavior:**

- **Editing a translation word**: The alignment map is rebuilt immediately to reflect the change.
- **Editing a source word**: The translation is marked as stale (⚠ source changed) and a **Re-translate** button appears. The alignment is cleared until you re-translate.

> **💡 Use case:** Quickly fix terminology without re-translating the entire document.

---

### Adjusting translations

Use the **Adjust Translation** chat to give the LLM free-form instructions to refine the translation without editing the source.

<div align="center">
<img src="https://github.com/user-attachments/assets/adjust-chat-panel.png" alt="Adjust Translation chat panel" width="800"/>
<p><i>Document-level chat for iterative refinement</i></p>
</div>

**Steps:**

1. Click **💬 Adjust Translation** at the top of the document workspace to expand the chat.
2. Type a free-form instruction in natural language, for example:
   - *"make the tone more formal"*
   - *"translate 'heart' as 心 instead of ハート"*
   - *"shorten the third sentence"*
   - *"use passive voice in the second paragraph"*
3. Press **Enter** or click the send button.
4. The LLM returns:
    - A new translation
    - A brief reasoning summary of what changed
    - Updated word alignment pairs

The chat history is maintained for the current document, so you can iteratively refine translations.

**Example conversation:**

```
You: make it more formal
Assistant: I've adjusted the translation to use より instead of もっと and desu/masu forms throughout.

You: translate "book" as 本 not 書物
Assistant: Updated. I've replaced all instances of 書物 with 本 as requested.
```

> **💡 Tip:** This feature is perfect for domain-specific terminology or stylistic preferences that are hard to specify upfront.

---

## Running Tests

```bash
# From the repo root (with your venv active)
pip install pytest
python -m pytest tests/ -v
```

Frontend checks are available separately:

```bash
cd frontend
npm install
npm run lint
npm test
npm run build
```

The test suite covers backend route and translator behavior plus frontend document-link helpers.

---

## Architecture Overview

gutaiHonyaku is a **single-server application**: a FastAPI backend exposes the translation APIs and, when `frontend/dist/` exists, also serves the built React/Vite frontend.

### High-level layers

1. **React frontend**
   - `App.jsx` owns the top-level shell: header, provider/model bar, language selection, and the document workspace.
   - `SectionPanel.jsx` manages the main workflows for plain-text translation and PDF translation.
   - Supporting components such as `LmStudioConfig`, `AdjustChat`, and `WordDisplay` handle provider connectivity, refinement prompts, and word-level alignment display.
   - `api.js` is the browser-side gateway to the backend, and `documentLinks.js` keeps PDF blocks and translated blocks synchronized in the UI.

2. **FastAPI backend**
   - `backend/main.py` defines the HTTP API for health checks, provider checks, plain-text translation, PDF upload, PDF translation, block adjustment, furigana generation, and static frontend serving.
   - The backend normalizes LM Studio / Ollama URLs, resolves available models, and translates frontend requests into OpenAI-compatible client calls.

3. **Translation and document services**
   - `backend/translator.py` contains the LLM-facing translation, adjustment, JSON extraction, alignment, and furigana logic.
   - `backend/documents.py` handles PDF ingestion, text extraction, block chunking, temporary file storage, and in-memory document state for uploaded PDFs.

### Request flow

- **Plain text**
  1. The frontend sends `/translate` or `/adjust`.
  2. FastAPI creates an OpenAI-compatible client for LM Studio or Ollama.
  3. `translator.py` returns the translation, reasoning, alignment pairs, and optional furigana.
  4. The frontend renders the aligned source/target text and exposes inline editing and follow-up adjustments.

- **PDF workflow**
  1. The frontend uploads a PDF to `/documents/upload`.
  2. `DocumentStore` extracts text per page, splits pages into blocks, and persists the uploaded PDF in a temporary directory.
  3. The frontend requests `/documents/{document_id}/translate` to translate each block.
  4. The backend rebuilds a document-level payload with page mappings so the UI can link PDF pages, extracted text blocks, and translated blocks.
  5. Follow-up refinement calls use `/documents/{document_id}/blocks/{block_id}/adjust` to update only the selected translated block.

---

## Project Structure

```
gutaiHonyaku/
├── backend/
│   ├── main.py           # FastAPI app, provider helpers, document routes, and frontend static serving
│   ├── documents.py      # PDF ingestion, block chunking, and in-memory document storage
│   ├── translator.py     # LLM translation, adjustment, alignment extraction, and furigana generation
│   ├── requirements.txt
│   └── .env              # Optional server URL / model config
├── frontend/
│   ├── index.html        # Vite HTML entry point
│   ├── src/
│   │   ├── main.jsx                       # React entry point
│   │   ├── index.css                      # Global styles (Tailwind directives)
│   │   ├── App.jsx                        # Root layout for the unified translation workspace
│   │   ├── api.js                         # HTTP client for backend routes
│   │   ├── documentLinks.js               # PDF/source/translation linking helpers
│   │   └── components/
│   │       ├── LmStudioConfig.jsx         # Provider, URL, and model connection bar
│   │       ├── SectionPanel.jsx           # Plain-text and PDF translation workflows
│   │       ├── WordDisplay.jsx            # Word token rendering, alignment hover, and editing support
│   │       └── AdjustChat.jsx             # Translation refinement chat panel
│   ├── tests/
│   │   └── documentLinks.test.js          # Frontend unit tests for PDF/document linking helpers
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js    # Dev proxy and build output config
├── tests/
│   ├── test_documents.py    # PDF ingestion and document storage tests
│   ├── test_main.py         # Backend route and provider URL helper tests
│   └── test_translator.py   # Translator and furigana unit tests
├── run_all.sh            # One-command install + build (backend + frontend)
├── start_app.sh          # Build frontend + start the server
└── setup.py              # Minimal setuptools config for namespace imports
```

---

## Production Build

```bash
cd frontend
npm run build          # outputs to frontend/dist/
```

The FastAPI backend automatically serves the built frontend from `frontend/dist/`. Simply run `uvicorn backend.main:app --port 8000` and the full application is available at `http://localhost:8000`.

For a reverse-proxy setup (nginx, Caddy, etc.), point the proxy at the single uvicorn process.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Local server offline" in the UI | Make sure LM Studio or Ollama is running and a model is loaded/started |
| Model dropdown is empty | Click **🔌 Connect** – the models list is fetched on connection |
| Translation returns garbled JSON | Try a different (larger) model; some small models don't reliably follow JSON instructions |
| `uvicorn: command not found` | Make sure your virtual environment is activated and `pip install -r backend/requirements.txt` has been run |
| Frontend shows 404 / blank page | Run `cd frontend && npm run build` to generate the static files in `frontend/dist/` |

---

## Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue on GitHub.

---

## License

This project is open source. Check the repository for license details.

---

## Acknowledgments

Built with:
- **[LM Studio](https://lmstudio.ai)** and **[Ollama](https://ollama.com)** for local LLM inference
- **[FastAPI](https://fastapi.tiangolo.com)** for the backend API
- **[React](https://react.dev)** + **[Vite](https://vitejs.dev)** for the frontend
- **[Tailwind CSS](https://tailwindcss.com)** for styling
- **[Lucide](https://lucide.dev)** for icons
- **[pykakasi](https://codeberg.org/miurahr/pykakasi)** for Japanese furigana generation

---

<div align="center">

**🌐 gutaiHonyaku – 具体翻訳**

*Word-level translation with alignment, powered by local LLMs*

Made with ❤️ for the translation community

</div>

---

> **📸 Note on Screenshots:** Some screenshot URLs in this README point to placeholder image paths. To add your own screenshots:
> 1. Run the application and capture screenshots of the features you want to showcase
> 2. Upload them to your GitHub repository (e.g., in a `docs/images/` folder) or use GitHub's issue attachment feature to generate URLs
> 3. Replace the placeholder URLs in this README with your actual screenshot URLs

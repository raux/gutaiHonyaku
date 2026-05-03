# gutaiHonyaku – 具体翻訳

**Word-level language translation with bidirectional alignment, powered by a local LLM (LM Studio or Ollama).**

![gutaiHonyaku main interface](https://github.com/user-attachments/assets/9b6ae7dd-32e1-4e4c-b42f-60d2d0c78097)

Type (or paste) source text into a single document workspace, click **Translate**, and the translation appears side-by-side. Hover over any word to see which word(s) it maps to in the other panel. Double-click a word to edit it inline. Use the **Adjust Translation** chat bar to give free-form instructions such as *"make it more formal"* or *"translate 'book' as 本 not 書物"*. A dedicated **LLM Reasoning** panel shows the model's latest explanation of its translation choices.

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

The backend test suite currently includes 25 tests covering provider URL helpers, `extract_json`, `translate_text`, `adjust_translation`, and `generate_furigana` with mock LLM clients.

---

## Project Structure

```
gutaiHonyaku/
├── backend/
│   ├── main.py           # FastAPI app – /translate, /adjust, /furigana, /health, /status
│   ├── translator.py     # LLM chat wrapper + word-alignment JSON extraction + furigana generation
│   ├── requirements.txt
│   └── .env              # Server URL / model config (safe to commit as template)
├── frontend/
│   ├── index.html        # Vite HTML entry point
│   ├── src/
│   │   ├── main.jsx                       # React entry point
│   │   ├── index.css                      # Global styles (Tailwind directives)
│   │   ├── App.jsx                        # Root layout – connection bar, language bar, single document workspace
│   │   ├── api.js                         # Axios client + LM Studio/Ollama helpers
│   │   └── components/
│   │       ├── LmStudioConfig.jsx         # Provider/URL/model connection bar
│   │       ├── SectionPanel.jsx           # Source ↔ Translation split view + word-edit modal
│   │       ├── WordDisplay.jsx            # Interactive word spans + alignment + furigana display
│   │       └── AdjustChat.jsx             # Document adjustment chat
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js    # Proxies API calls in dev mode; build outputs to dist/
├── tests/
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

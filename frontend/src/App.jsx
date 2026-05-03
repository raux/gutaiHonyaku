/**
 * App.jsx – Main application layout for gutaiHonyaku.
 *
 * Layout (top → bottom):
 *   Header          – app title + subtitle
 *   LmStudioConfig  – provider / URL / model connection bar
 *   Language bar    – source lang ⇄ target lang
 *   Document panel  – single source ↔ translation workspace
 * @typedef {import('./types').Language} Language
 * @typedef {import('./types').LmConfig} LmConfig
 */
import { useState, useCallback } from 'react';
import LmStudioConfig from './components/LmStudioConfig.jsx';
import SectionPanel   from './components/SectionPanel.jsx';

const LANGUAGES = [
  'English',
  'Japanese',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  const [lmConfig, setLmConfig]         = useState({ lmStudioUrl: '', model: '', provider: 'lm_studio' });
  const [sourceLang, setSourceLang]     = useState('English');
  const [targetLang, setTargetLang]     = useState('Japanese');

  const handleConfigChange = useCallback((cfg) => {
    setLmConfig(cfg);
  }, []);

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">

      {/* ── App header ────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 py-3 bg-slate-800
                         border-b border-slate-700 flex-shrink-0">
        <span className="text-lg font-semibold tracking-tight">🌐 gutaiHonyaku</span>
        <span className="text-xs text-slate-500 hidden sm:block">
          具体翻訳 · word-level translation with alignment · powered by LM Studio / Ollama
        </span>
      </header>

      {/* ── LM Studio / Ollama connection bar ─────────────────────────── */}
      <LmStudioConfig onConfigChange={handleConfigChange} />

      {/* ── Language selection ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-slate-800
                      border-b border-slate-700 flex-shrink-0">
        {/* Source language */}
        <select
          value={sourceLang}
          onChange={e => setSourceLang(e.target.value)}
          className="bg-slate-900 text-slate-200 text-xs border border-slate-600 rounded
                     px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {/* Swap button */}
        <button
          onClick={swapLanguages}
          className="text-slate-400 hover:text-slate-200 transition-colors text-base"
          title="Swap languages"
        >
          ⇄
        </button>

        {/* Target language */}
        <select
          value={targetLang}
          onChange={e => setTargetLang(e.target.value)}
          className="bg-slate-900 text-slate-200 text-xs border border-slate-600 rounded
                     px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

      </div>

      {/* ── Document panel ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <SectionPanel
          documentName="Document"
          srcLang={sourceLang}
          tgtLang={targetLang}
          lmConfig={lmConfig}
        />
      </div>

    </div>
  );
}

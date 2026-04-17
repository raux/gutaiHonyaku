/**
 * App.jsx – Main application layout for gutaiHonyaku.
 *
 * Layout (top → bottom):
 *   Header          – app title + subtitle
 *   LmStudioConfig  – provider / URL / model connection bar
 *   Language bar    – source lang ⇄ target lang + "Translate All" button
 *   Section tabs    – Title | Introduction | Background & Main Text | Discussion | Conclusion
 *   Section panel   – fills remaining height; all 5 panels are always mounted
 *                     (only the active one is visible) so state is preserved when
 *                     switching tabs.
 */
import { useState, useRef, useCallback } from 'react';
import { Languages } from 'lucide-react';
import LmStudioConfig from './components/LmStudioConfig.jsx';
import SectionPanel   from './components/SectionPanel.jsx';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'title',      name: 'Title' },
  { id: 'intro',      name: 'Introduction' },
  { id: 'background', name: 'Background & Main Text' },
  { id: 'discussion', name: 'Discussion' },
  { id: 'conclusion', name: 'Conclusion' },
];

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
  const [activeSection, setActiveSection] = useState('title');
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);

  // Individual refs for each section panel (for "Translate All")
  const titleRef      = useRef(null);
  const introRef      = useRef(null);
  const backgroundRef = useRef(null);
  const discussionRef = useRef(null);
  const conclusionRef = useRef(null);

  const sectionRefs = {
    title:      titleRef,
    intro:      introRef,
    background: backgroundRef,
    discussion: discussionRef,
    conclusion: conclusionRef,
  };

  const handleConfigChange = useCallback((cfg) => {
    setLmConfig(cfg);
  }, []);

  const handleTranslateAll = async () => {
    setIsTranslatingAll(true);
    for (const section of SECTIONS) {
      await sectionRefs[section.id].current?.translate();
    }
    setIsTranslatingAll(false);
  };

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

      {/* ── Language selection + Translate All ────────────────────────── */}
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

        <div className="flex-1" />

        {/* Translate All */}
        <button
          onClick={handleTranslateAll}
          disabled={isTranslatingAll}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs
                     bg-indigo-600 hover:bg-indigo-500 text-white
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isTranslatingAll ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white
                               border-t-transparent rounded-full animate-spin" />
              Translating All…
            </>
          ) : (
            <>
              <Languages size={12} />
              Translate All
            </>
          )}
        </button>
      </div>

      {/* ── Section tabs ──────────────────────────────────────────────── */}
      <nav className="flex border-b border-slate-700 bg-slate-800 flex-shrink-0
                      overflow-x-auto">
        {SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap
                        transition-colors border-b-2 ${
              activeSection === section.id
                ? 'text-blue-400 border-blue-400 bg-slate-900'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            {section.name}
          </button>
        ))}
      </nav>

      {/* ── Section panels ────────────────────────────────────────────── */}
      {/* All panels are mounted; only the active one is visible.
          This preserves state (text, translation, alignment) when switching tabs. */}
      <div className="flex-1 overflow-hidden">
        {SECTIONS.map(section => (
          <div
            key={section.id}
            className={`h-full ${activeSection !== section.id ? 'hidden' : ''}`}
          >
            <SectionPanel
              ref={sectionRefs[section.id]}
              section={section}
              srcLang={sourceLang}
              tgtLang={targetLang}
              lmConfig={lmConfig}
            />
          </div>
        ))}
      </div>

    </div>
  );
}

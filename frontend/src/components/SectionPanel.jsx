/**
 * SectionPanel.jsx – Single document workspace with source + word-aligned translation.
 *
 * Layout:
 *   │  💬 Adjust Translation  (collapsible)              │
 *   ┌─────────────────────────┬─────────────────────────┐
 *   │  SOURCE  (src lang)     │  TRANSLATION (tgt lang) │
 *   │  [textarea / word view] │  [word spans]           │
 *   └─────────────────────────┴─────────────────────────┘
 *
 * Source starts as an editable textarea.  After a successful translation the
 * source switches to a word-span view so both sides can participate in the
 * bidirectional hover-alignment feature.  An "Edit" button lets the user return
 * to the textarea at any time.
 *
 * Double-clicking any word in either panel opens a small inline modal for
 * direct word replacement.  Editing a translation word immediately rebuilds
 * the alignment map; editing a source word marks the translation as stale and
 * prompts a re-translate.
 *
 */
import {
  useCallback,
  useState,
} from 'react';
import { Languages, Pencil } from 'lucide-react';
import WordDisplay, {
  buildAlignment,
  tokenizeWords,
  replaceWordAtIndex,
} from './WordDisplay.jsx';
import AdjustChat from './AdjustChat.jsx';
import { translateText } from '../api.js';

export default function SectionPanel({
  documentName = 'Document',
  srcLang,
  tgtLang,
  lmConfig,
}) {
  // ── Text state ─────────────────────────────────────────────────────────
  const [srcText, setSrcText] = useState('');
  const [tgtText, setTgtText] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [pairs,   setPairs]   = useState([]);
  const [alignment, setAlignment] = useState({ srcToTgt: {}, tgtToSrc: {} });

  // Furigana data for Japanese text (source or target)
  const [srcFurigana, setSrcFurigana] = useState(null);
  const [tgtFurigana, setTgtFurigana] = useState(null);

  // 'input'   → show source as editable textarea
  // 'aligned' → show source as interactive word spans (after translation)
  const [sourceMode, setSourceMode] = useState('input');

  // true when the source text was edited after the last successful translation
  const [srcStale, setSrcStale] = useState(false);

  // ── Async state ─────────────────────────────────────────────────────────
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError]                 = useState('');

  // ── Hover state (bidirectional alignment) ──────────────────────────────
  const [hoveredSrcIdx, setHoveredSrcIdx] = useState(null);
  const [hoveredTgtIdx, setHoveredTgtIdx] = useState(null);

  // ── Word-edit modal state ───────────────────────────────────────────────
  const [editModal, setEditModal] = useState(null); // { side, wordIdx }
  const [editValue, setEditValue] = useState('');

  // ── Chat panel ──────────────────────────────────────────────────────────
  const [showChat, setShowChat] = useState(false);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSrcChange = (e) => {
    setSrcText(e.target.value);
    if (tgtText) {
      setSrcStale(true);
      setReasoning('');
    }
  };

  const handleTranslate = useCallback(async () => {
    if (!srcText.trim() || isTranslating) return;
    setIsTranslating(true);
    setError('');
    try {
      const result = await translateText(
        srcText,
        srcLang,
        tgtLang,
        lmConfig.lmStudioUrl || null,
        lmConfig.model        || null,
        lmConfig.provider     || null,
      );
      setTgtText(result.translation);
      setReasoning(result.reasoning || '');
      setPairs(result.pairs || []);
      setAlignment(buildAlignment(srcText, result.translation, result.pairs || []));
      setSrcFurigana(result.source_furigana || null);
      setTgtFurigana(result.target_furigana || null);
      setSourceMode('aligned');
      setSrcStale(false);
    } catch (err) {
      const detail   = err?.response?.data?.detail || err?.message || 'Unknown error';
      const isOffline =
        detail.toLowerCase().includes('offline') ||
        detail.toLowerCase().includes('reachable') ||
        err?.response?.status === 503;
      setError(
        isOffline
          ? '⚠️ Local server offline – make sure LM Studio or Ollama is running and a model is loaded.'
          : `❌ ${detail}`,
      );
    } finally {
      setIsTranslating(false);
    }
  }, [srcText, srcLang, tgtLang, lmConfig, isTranslating]);

  // ── Word editing ────────────────────────────────────────────────────────

  const openEditModal = (side, wordIdx, currentText) => {
    setEditModal({ side, wordIdx });
    setEditValue(currentText);
  };

  const applyWordEdit = () => {
    if (!editModal) return;
    const { side, wordIdx } = editModal;

    if (side === 'tgt') {
      const newTgt = replaceWordAtIndex(tgtText, wordIdx, editValue);
      setTgtText(newTgt);
      setAlignment(buildAlignment(srcText, newTgt, pairs));
    } else {
      const newSrc = replaceWordAtIndex(srcText, wordIdx, editValue);
      setSrcText(newSrc);
      // Source edited → mark translation as stale; alignment no longer valid
      setSrcStale(true);
      setReasoning('');
      setAlignment({ srcToTgt: {}, tgtToSrc: {} });
    }

    setEditModal(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditModal(null);
    setEditValue('');
  };

  // ── Adjusted by AdjustChat ──────────────────────────────────────────────

  const handleAdjusted = (
    newTranslation,
    newPairs,
    newSrcFurigana,
    newTgtFurigana,
    newReasoning = '',
  ) => {
    const usedPairs = newPairs?.length ? newPairs : pairs;
    setTgtText(newTranslation);
    setReasoning(newReasoning);
    setPairs(usedPairs);
    setAlignment(buildAlignment(srcText, newTranslation, usedPairs));
    if (newSrcFurigana) setSrcFurigana(newSrcFurigana);
    if (newTgtFurigana) setTgtFurigana(newTgtFurigana);
  };

  // ── Derived helpers ─────────────────────────────────────────────────────

  const srcWordCount = tokenizeWords(srcText).filter(t => t.isWord).length;
  const tgtWordCount = tgtText ? tokenizeWords(tgtText).filter(t => t.isWord).length : 0;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Adjust-translation chat ────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-700">
        <button
          onClick={() => setShowChat(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-800
                     hover:bg-slate-700/60 text-xs text-slate-400 hover:text-slate-200
                     transition-colors"
        >
          <span>💬 Adjust Translation</span>
          <span>{showChat ? '▲' : '▼'}</span>
        </button>

        {showChat && (
          <AdjustChat
            documentName={documentName}
            original={srcText}
            translation={tgtText}
            srcLang={srcLang}
            tgtLang={tgtLang}
            lmConfig={lmConfig}
            onAdjusted={handleAdjusted}
            disabled={!tgtText}
          />
        )}
      </div>

      {/* ── Model reasoning ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-700 bg-slate-950/60">
        <div className="px-4 py-2 border-b border-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-400">
          🧠 LLM Reasoning
        </div>
        <div className="px-4 py-3 text-xs text-slate-300 min-h-[72px] max-h-32 overflow-y-auto">
          {reasoning
            ? <p className="whitespace-pre-wrap">{reasoning}</p>
            : <p className="text-slate-500">Reasoning will appear here after the model returns it.</p>}
        </div>
      </div>

      {/* ── Translation panels ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Source panel */}
        <div className="flex flex-col w-1/2 border-r border-slate-700">
          {/* Source header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800
                          border-b border-slate-700 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide
                               whitespace-nowrap">
                Source · {srcLang}
              </span>
              {srcWordCount > 0 && (
                <span className="text-xs text-slate-600">{srcWordCount}w</span>
              )}
              {srcStale && (
                <span className="text-xs text-amber-400 whitespace-nowrap">
                  ⚠ source changed
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Toggle source view/edit */}
              {sourceMode === 'aligned' && (
                <button
                  onClick={() => setSourceMode('input')}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs
                             bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  title="Edit source text"
                >
                  <Pencil size={11} /> Edit
                </button>
              )}

              {/* Translate button */}
              <button
                onClick={handleTranslate}
                disabled={!srcText.trim() || isTranslating}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs
                           bg-blue-700 hover:bg-blue-600 text-white
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isTranslating ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white
                                     border-t-transparent rounded-full animate-spin" />
                    Translating…
                  </>
                ) : (
                  <>
                    <Languages size={12} />
                    {srcStale && tgtText ? 'Re-translate' : 'Translate'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Source content */}
          <div className="flex-1 overflow-y-auto">
            {sourceMode === 'input' || !tgtText ? (
              <textarea
                value={srcText}
                onChange={handleSrcChange}
                placeholder={`Enter ${documentName.toLowerCase()} text here…`}
                className="w-full h-full min-h-[200px] resize-none bg-slate-900 text-slate-200
                           text-sm p-4 focus:outline-none placeholder-slate-600"
              />
            ) : (
              <WordDisplay
                text={srcText}
                side="src"
                alignment={alignment}
                externalHoveredIdx={hoveredTgtIdx}
                onHoverWord={setHoveredSrcIdx}
                onEditWord={(wi, txt) => openEditModal('src', wi, txt)}
                placeholder=""
                furigana={srcFurigana}
              />
            )}
          </div>
        </div>

        {/* Translation panel */}
        <div className="flex flex-col w-1/2">
          {/* Translation header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800
                          border-b border-slate-700 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide
                               whitespace-nowrap">
                Translation · {tgtLang}
              </span>
              {tgtWordCount > 0 && (
                <span className="text-xs text-slate-600">{tgtWordCount}w</span>
              )}
            </div>

            {tgtText && (
              <span className="text-xs text-slate-600 hidden sm:block">
                hover to align · double-click to edit
              </span>
            )}
          </div>

          {/* Translation content */}
          <div className="flex-1 overflow-y-auto bg-slate-900">
            <WordDisplay
              text={tgtText}
              side="tgt"
              alignment={alignment}
              externalHoveredIdx={hoveredSrcIdx}
              onHoverWord={setHoveredTgtIdx}
              onEditWord={(wi, txt) => openEditModal('tgt', wi, txt)}
              placeholder="Translation will appear here…"
              furigana={tgtFurigana}
            />
          </div>
        </div>

      </div>

      {/* ── Error bar ──────────────────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-700/50
                        text-xs text-red-400 flex-shrink-0">
          {error}
        </div>
      )}

      {/* ── Word-edit modal ────────────────────────────────────────────── */}
      {editModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={cancelEdit}
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96
                       shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              Edit {editModal.side === 'tgt' ? 'Translation' : 'Source'} Word
            </h3>
            {editModal.side === 'src' && (
              <p className="text-xs text-amber-400 mb-3">
                Editing the source will mark the translation as stale.
              </p>
            )}

            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') applyWordEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              autoFocus
              className="w-full bg-slate-900 text-slate-100 text-sm border border-slate-600
                         rounded px-3 py-2 focus:outline-none focus:border-blue-500 mb-4"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelEdit}
                className="px-4 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600
                           text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyWordEdit}
                className="px-4 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-500
                           text-white transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

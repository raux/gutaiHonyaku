/**
 * SectionPanel.jsx – Document workspace for plain text and PDF-backed translation.
 */
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { FileText, Languages, Pencil, Upload } from 'lucide-react';
import WordDisplay, {
  buildAlignment,
  tokenizeWords,
  replaceWordAtIndex,
} from './WordDisplay.jsx';
import AdjustChat from './AdjustChat.jsx';
import {
  adjustDocumentBlock,
  adjustTranslation,
  translateDocument,
  translateText,
  uploadPdfDocument,
} from '../api.js';
import {
  buildPdfViewerSrc,
  flattenDocumentBlocks,
  getLinkedBlockState,
} from '../documentLinks.js';


const EMPTY_ALIGNMENT = { srcToTgt: {}, tgtToSrc: {} };
const noopEditHandler = () => {};

export default function SectionPanel({
  documentName = 'Document',
  srcLang,
  tgtLang,
  lmConfig,
}) {
  const [sourceType, setSourceType] = useState('text');

  // ── Plain-text workflow state ────────────────────────────────────────────
  const [srcText, setSrcText] = useState('');
  const [tgtText, setTgtText] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [pairs, setPairs] = useState([]);
  const [alignment, setAlignment] = useState(EMPTY_ALIGNMENT);
  const [srcFurigana, setSrcFurigana] = useState(null);
  const [tgtFurigana, setTgtFurigana] = useState(null);
  const [sourceMode, setSourceMode] = useState('input');
  const [srcStale, setSrcStale] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editValue, setEditValue] = useState('');

  // ── PDF workflow state ───────────────────────────────────────────────────
  const [pdfDocument, setPdfDocument] = useState(null);
  const [pdfTranslation, setPdfTranslation] = useState(null);
  const [selectedPdfBlockId, setSelectedPdfBlockId] = useState(null);
  const [selectedPdfPage, setSelectedPdfPage] = useState(1);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // ── Shared async / UI state ──────────────────────────────────────────────
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState('');
  const [hoveredSrcIdx, setHoveredSrcIdx] = useState(null);
  const [hoveredTgtIdx, setHoveredTgtIdx] = useState(null);
  const [showChat, setShowChat] = useState(false);

  const pdfLinkState = useMemo(
    () => getLinkedBlockState(pdfDocument, pdfTranslation, selectedPdfBlockId),
    [pdfDocument, pdfTranslation, selectedPdfBlockId],
  );
  const selectedPdfSourceBlock = pdfLinkState.selectedSourceBlock;
  const selectedPdfTranslatedBlock = pdfLinkState.selectedTranslatedBlock;
  const pdfAlignment = useMemo(
    () => (
      selectedPdfTranslatedBlock
        ? buildAlignment(
          selectedPdfTranslatedBlock.source_text,
          selectedPdfTranslatedBlock.translation,
          selectedPdfTranslatedBlock.pairs || [],
        )
        : EMPTY_ALIGNMENT
    ),
    [selectedPdfTranslatedBlock],
  );
  const pdfViewerSrc = buildPdfViewerSrc(
    pdfDocument?.pdf_url,
    selectedPdfPage || pdfLinkState.selectedPageNumber || 1,
  );

  const activeReasoning = sourceType === 'pdf'
    ? selectedPdfTranslatedBlock?.reasoning || ''
    : reasoning;

  const handlePdfBlockSelect = useCallback((blockId, pageNumber) => {
    setSelectedPdfBlockId(blockId);
    setSelectedPdfPage(pageNumber);
    setHoveredSrcIdx(null);
    setHoveredTgtIdx(null);
  }, []);

  const handleSourceTypeChange = (nextType) => {
    setSourceType(nextType);
    setError('');
    setHoveredSrcIdx(null);
    setHoveredTgtIdx(null);
  };

  // ── Plain-text handlers ──────────────────────────────────────────────────

  const handleSrcChange = (e) => {
    setSrcText(e.target.value);
    if (tgtText) {
      setSrcStale(true);
      setReasoning('');
    }
  };

  const handleTextTranslate = useCallback(async () => {
    if (!srcText.trim() || isTranslating) return;
    const result = await translateText(
      srcText,
      srcLang,
      tgtLang,
      lmConfig.lmStudioUrl || null,
      lmConfig.model || null,
      lmConfig.provider || null,
    );
    setTgtText(result.translation);
    setReasoning(result.reasoning || '');
    setPairs(result.pairs || []);
    setAlignment(buildAlignment(srcText, result.translation, result.pairs || []));
    setSrcFurigana(result.source_furigana || null);
    setTgtFurigana(result.target_furigana || null);
    setSourceMode('aligned');
    setSrcStale(false);
  }, [srcText, srcLang, tgtLang, lmConfig, isTranslating]);

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
      setSrcStale(true);
      setReasoning('');
      setAlignment(EMPTY_ALIGNMENT);
    }

    setEditModal(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditModal(null);
    setEditValue('');
  };

  const handleTextAdjust = useCallback(async (instruction) => {
    const result = await adjustTranslation(
      srcText,
      tgtText,
      instruction,
      srcLang,
      tgtLang,
      lmConfig.lmStudioUrl || null,
      lmConfig.model || null,
      lmConfig.provider || null,
    );
    const usedPairs = result.pairs?.length ? result.pairs : pairs;
    setTgtText(result.translation);
    setReasoning(result.reasoning || result.explanation || '');
    setPairs(usedPairs);
    setAlignment(buildAlignment(srcText, result.translation, usedPairs));
    if (result.source_furigana) setSrcFurigana(result.source_furigana);
    if (result.target_furigana) setTgtFurigana(result.target_furigana);
    return result;
  }, [srcText, tgtText, srcLang, tgtLang, lmConfig, pairs]);

  // ── PDF handlers ─────────────────────────────────────────────────────────

  const handlePdfUpload = async (event) => {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file || isUploadingPdf) return;

    setIsUploadingPdf(true);
    setError('');

    try {
      const uploaded = await uploadPdfDocument(file);
      const firstBlock = flattenDocumentBlocks(uploaded)[0] || null;
      setPdfDocument(uploaded);
      setPdfTranslation(null);
      setSelectedPdfBlockId(firstBlock?.block_id || null);
      setSelectedPdfPage(firstBlock?.page_number || 1);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
      setError(`❌ ${detail}`);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handlePdfTranslate = useCallback(async () => {
    if (!pdfDocument?.document_id || isTranslating) return;
    const result = await translateDocument(
      pdfDocument.document_id,
      srcLang,
      tgtLang,
      lmConfig.lmStudioUrl || null,
      lmConfig.model || null,
      lmConfig.provider || null,
    );
    const nextBlockId = selectedPdfBlockId || result.selected_block_id || result.blocks?.[0]?.block_id || null;
    setPdfTranslation(result);
    if (nextBlockId) {
      const nextBlock = result.blocks.find(block => block.block_id === nextBlockId) || result.blocks?.[0];
      if (nextBlock) {
        handlePdfBlockSelect(nextBlock.block_id, nextBlock.page_number);
      }
    }
  }, [pdfDocument, srcLang, tgtLang, lmConfig, isTranslating, selectedPdfBlockId, handlePdfBlockSelect]);

  const handlePdfAdjust = useCallback(async (instruction) => {
    if (!pdfDocument?.document_id || !selectedPdfTranslatedBlock) {
      throw new Error('Translate the PDF and select a translated block first.');
    }

    const updatedTranslation = await adjustDocumentBlock(
      pdfDocument.document_id,
      selectedPdfTranslatedBlock.block_id,
      instruction,
      srcLang,
      tgtLang,
      lmConfig.lmStudioUrl || null,
      lmConfig.model || null,
      lmConfig.provider || null,
    );
    const updatedBlock = updatedTranslation.blocks.find(
      block => block.block_id === selectedPdfTranslatedBlock.block_id,
    );
    setPdfTranslation(updatedTranslation);
    if (updatedBlock) {
      handlePdfBlockSelect(updatedBlock.block_id, updatedBlock.page_number);
      return updatedBlock;
    }
    return {
      translation: '',
      reasoning: '',
      pairs: [],
    };
  }, [pdfDocument, selectedPdfTranslatedBlock, srcLang, tgtLang, lmConfig, handlePdfBlockSelect]);

  // ── Shared translate handler / error handling ────────────────────────────

  const handleTranslate = useCallback(async () => {
    setIsTranslating(true);
    setError('');
    try {
      if (sourceType === 'pdf') {
        await handlePdfTranslate();
      } else {
        await handleTextTranslate();
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
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
  }, [sourceType, handlePdfTranslate, handleTextTranslate]);

  const srcWordCount = tokenizeWords(srcText).filter(token => token.isWord).length;
  const tgtWordCount = tgtText ? tokenizeWords(tgtText).filter(token => token.isWord).length : 0;
  const pdfSourceBlockCount = pdfLinkState.sourceBlocks.length;
  const pdfTranslatedBlockCount = pdfLinkState.translatedBlocks.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSourceTypeChange('text')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              sourceType === 'text'
                ? 'bg-blue-700 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Plain text
          </button>
          <button
            onClick={() => handleSourceTypeChange('pdf')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              sourceType === 'pdf'
                ? 'bg-blue-700 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            PDF upload
          </button>
        </div>

        {sourceType === 'pdf' && (
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer transition-colors">
            {isUploadingPdf ? (
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            {pdfDocument ? 'Replace PDF' : 'Upload PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handlePdfUpload}
              disabled={isUploadingPdf}
            />
          </label>
        )}
      </div>

      <div className="flex-shrink-0 border-b border-slate-700">
        <button
          onClick={() => setShowChat(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-800 hover:bg-slate-700/60 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span>💬 Adjust Translation</span>
          <span>{showChat ? '▲' : '▼'}</span>
        </button>

        {showChat && (
          <AdjustChat
            documentName={
              sourceType === 'pdf'
                ? `${pdfDocument?.filename || 'PDF'} · ${selectedPdfBlockId || 'block'}`
                : documentName
            }
            onRequestAdjust={sourceType === 'pdf' ? handlePdfAdjust : handleTextAdjust}
            disabled={sourceType === 'pdf' ? !selectedPdfTranslatedBlock : !tgtText}
          />
        )}
      </div>

      <div className="flex-shrink-0 border-b border-slate-700 bg-slate-950/60">
        <div className="px-4 py-2 border-b border-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-400">
          🧠 LLM Reasoning
        </div>
        <div className="px-4 py-3 text-xs text-slate-300 min-h-[72px] max-h-32 overflow-y-auto">
          {activeReasoning
            ? <p className="whitespace-pre-wrap">{activeReasoning}</p>
            : (
              <p className="text-slate-500">
                {sourceType === 'pdf'
                  ? 'Reasoning for the selected translated PDF block will appear here.'
                  : 'Reasoning will appear here after the model returns it.'}
              </p>
            )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col w-1/2 border-r border-slate-700">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                Source · {srcLang}
              </span>
              {sourceType === 'text' && srcWordCount > 0 && (
                <span className="text-xs text-slate-600">{srcWordCount}w</span>
              )}
              {sourceType === 'pdf' && pdfDocument && (
                <span className="text-xs text-slate-600">
                  {pdfDocument.page_count}p · {pdfSourceBlockCount} blocks
                </span>
              )}
              {srcStale && sourceType === 'text' && (
                <span className="text-xs text-amber-400 whitespace-nowrap">⚠ source changed</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {sourceType === 'text' && sourceMode === 'aligned' && (
                <button
                  onClick={() => setSourceMode('input')}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  title="Edit source text"
                >
                  <Pencil size={11} /> Edit
                </button>
              )}

              <button
                onClick={handleTranslate}
                disabled={
                  sourceType === 'pdf'
                    ? !pdfDocument?.document_id || isUploadingPdf || isTranslating
                    : !srcText.trim() || isTranslating
                }
                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isTranslating ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Translating…
                  </>
                ) : (
                  <>
                    <Languages size={12} />
                    {sourceType === 'pdf'
                      ? (pdfTranslation ? 'Re-translate PDF' : 'Translate PDF')
                      : (srcStale && tgtText ? 'Re-translate' : 'Translate')}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-900">
            {sourceType === 'text' ? (
              sourceMode === 'input' || !tgtText ? (
                <textarea
                  value={srcText}
                  onChange={handleSrcChange}
                  placeholder={`Enter ${documentName.toLowerCase()} text here…`}
                  className="w-full h-full min-h-[200px] resize-none bg-slate-900 text-slate-200 text-sm p-4 focus:outline-none placeholder-slate-600"
                />
              ) : (
                <WordDisplay
                  text={srcText}
                  side="src"
                  alignment={alignment}
                  externalHoveredIdx={hoveredTgtIdx}
                  onHoverWord={setHoveredSrcIdx}
                  onEditWord={(wordIdx, text) => openEditModal('src', wordIdx, text)}
                  placeholder=""
                  furigana={srcFurigana}
                />
              )
            ) : (
              pdfDocument ? (
                <div className="flex flex-col h-full">
                  <div className="px-3 py-2 border-b border-slate-700 bg-slate-950/70 text-xs text-slate-400 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-slate-200">{pdfDocument.filename}</div>
                      <div>{pdfDocument.character_count} extracted chars</div>
                    </div>
                    <div className="flex gap-2">
                      {pdfDocument.pages.map(page => (
                        <button
                          key={page.page_number}
                          onClick={() => setSelectedPdfPage(page.page_number)}
                          className={`px-2 py-1 rounded transition-colors ${
                            selectedPdfPage === page.page_number
                              ? 'bg-blue-700 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          P{page.page_number}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-1/2 min-h-[240px] border-b border-slate-700 bg-white">
                    <iframe
                      title="Uploaded PDF preview"
                      src={pdfViewerSrc}
                      className="w-full h-full"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {pdfDocument.pages.map(page => (
                      <div key={page.page_number} className="border-b border-slate-800">
                        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-950/40">
                          Page {page.page_number}
                        </div>
                        {(page.blocks || []).length > 0 ? (
                          page.blocks.map(block => (
                            <button
                              key={block.block_id}
                              onClick={() => handlePdfBlockSelect(block.block_id, page.page_number)}
                              className={`w-full text-left px-4 py-3 border-t border-slate-800 transition-colors ${
                                selectedPdfBlockId === block.block_id
                                  ? 'bg-blue-900/30 text-slate-100'
                                  : 'hover:bg-slate-800/60 text-slate-300'
                              }`}
                            >
                              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                                Block {block.block_index}
                              </div>
                              <p className="text-sm whitespace-pre-wrap line-clamp-4">{block.text}</p>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-500">No extractable text on this page.</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-6 text-center text-sm text-slate-500">
                  Upload a PDF to extract text, maintain page references, and translate by linked blocks.
                </div>
              )
            )}
          </div>
        </div>

        <div className="flex flex-col w-1/2">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                Translation · {tgtLang}
              </span>
              {sourceType === 'text' && tgtWordCount > 0 && (
                <span className="text-xs text-slate-600">{tgtWordCount}w</span>
              )}
              {sourceType === 'pdf' && pdfTranslation && (
                <span className="text-xs text-slate-600">
                  {pdfTranslation.page_count}p · {pdfTranslatedBlockCount} linked blocks
                </span>
              )}
            </div>

            {(sourceType === 'text' ? tgtText : selectedPdfTranslatedBlock) && (
              <span className="text-xs text-slate-600 hidden sm:block">
                {sourceType === 'pdf'
                  ? 'click a block to jump to its PDF page'
                  : 'hover to align · double-click to edit'}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-900">
            {sourceType === 'text' ? (
              <WordDisplay
                text={tgtText}
                side="tgt"
                alignment={alignment}
                externalHoveredIdx={hoveredSrcIdx}
                onHoverWord={setHoveredTgtIdx}
                onEditWord={(wordIdx, text) => openEditModal('tgt', wordIdx, text)}
                placeholder="Translation will appear here…"
                furigana={tgtFurigana}
              />
            ) : (
              pdfTranslation ? (
                <div className="flex flex-col h-full">
                  <div className="max-h-72 overflow-y-auto border-b border-slate-700">
                    {pdfTranslation.pages.map(page => (
                      <div key={page.page_number} className="border-b border-slate-800 last:border-b-0">
                        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-950/40">
                          Page {page.page_number}
                        </div>
                        {page.blocks.map(block => (
                          <button
                            key={block.block_id}
                            onClick={() => handlePdfBlockSelect(block.block_id, block.page_number)}
                            className={`w-full text-left px-4 py-3 border-t border-slate-800 transition-colors ${
                              selectedPdfBlockId === block.block_id
                                ? 'bg-emerald-900/30 text-slate-100'
                                : 'hover:bg-slate-800/60 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                              <span>Linked block {block.block_index}</span>
                              <span className="inline-flex items-center gap-1">
                                <FileText size={11} />
                                jump to PDF
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap line-clamp-4">{block.translation}</p>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 flex-1 min-h-0">
                    <div className="border-r border-slate-700 min-h-0">
                      <div className="px-4 py-2 border-b border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-400 bg-slate-950/50">
                        Selected source block
                      </div>
                      <div className="h-full overflow-y-auto">
                        <WordDisplay
                          text={selectedPdfSourceBlock?.text || ''}
                          side="src"
                          alignment={pdfAlignment}
                          externalHoveredIdx={hoveredTgtIdx}
                          onHoverWord={setHoveredSrcIdx}
                          onEditWord={noopEditHandler}
                          placeholder="Select a PDF block to inspect its extracted source text…"
                          furigana={selectedPdfTranslatedBlock?.source_furigana || null}
                        />
                      </div>
                    </div>

                    <div className="min-h-0">
                      <div className="px-4 py-2 border-b border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-400 bg-slate-950/50">
                        Selected translated block
                      </div>
                      <div className="h-full overflow-y-auto">
                        <WordDisplay
                          text={selectedPdfTranslatedBlock?.translation || ''}
                          side="tgt"
                          alignment={pdfAlignment}
                          externalHoveredIdx={hoveredSrcIdx}
                          onHoverWord={setHoveredTgtIdx}
                          onEditWord={noopEditHandler}
                          placeholder="Translate the PDF to inspect block-level alignment and page links…"
                          furigana={selectedPdfTranslatedBlock?.target_furigana || null}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-6 text-center text-sm text-slate-500">
                  Translate the uploaded PDF to render linked page blocks and block-scoped alignment.
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-700/50 text-xs text-red-400 flex-shrink-0">
          {error}
        </div>
      )}

      {editModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={cancelEdit}
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96 shadow-2xl"
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
              className="w-full bg-slate-900 text-slate-100 text-sm border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 mb-4"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelEdit}
                className="px-4 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyWordEdit}
                className="px-4 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
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

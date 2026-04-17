/**
 * WordDisplay.jsx – Renders text as interactive word spans with bidirectional
 * hover alignment highlighting.
 *
 * When a word in one panel is hovered, the aligned word(s) in the other panel
 * are highlighted in a contrasting colour.  Double-clicking a word triggers the
 * inline edit callback.
 *
 * Also exports the pure helper functions `tokenizeWords` and `buildAlignment`
 * so SectionPanel can use them without importing a separate utils file.
 */

// ---------------------------------------------------------------------------
// Pure helpers (exported for use in SectionPanel)
// ---------------------------------------------------------------------------

/** Returns true when text contains CJK / Asian characters that have no spaces. */
function isAsian(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text);
}

/**
 * Split text into an array of token objects.
 *   { text: string, isWord: boolean, wordIdx: number | undefined }
 *
 * For western text: whitespace-separated words.
 * For CJK text: individual non-whitespace characters become word tokens.
 */
export function tokenizeWords(text) {
  const tokens = [];
  let wordIdx = 0;

  if (isAsian(text)) {
    // Each non-whitespace character is a separate word token for CJK text
    for (const char of text) {
      if (/\s/.test(char)) {
        tokens.push({ text: char, isWord: false });
      } else {
        tokens.push({ text: char, isWord: true, wordIdx: wordIdx++ });
      }
    }
  } else {
    // Western text: split on whitespace boundaries
    const re = /(\S+|\s+)/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const tok = match[1];
      if (tok.trim()) {
        tokens.push({ text: tok, isWord: true, wordIdx: wordIdx++ });
      } else {
        tokens.push({ text: tok, isWord: false });
      }
    }
  }

  return tokens;
}

/** Strip punctuation and lowercase for fuzzy matching. */
function normalise(s) {
  return s
    .replace(/[.,!?;:'"()\[\]{}\u3002\u3001\uff01\uff1f\u300c\u300d]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Find the first occurrence of `phraseWords` (array of strings) in `words`
 * (array of token objects) starting from `startFrom`.
 * Falls back to searching from index 0 if not found from `startFrom`.
 * Returns the index in `words`, or -1 if not found.
 */
function findWordSequence(words, phraseWords, startFrom) {
  const search = (from) => {
    for (let i = from; i <= words.length - phraseWords.length; i++) {
      let hit = true;
      for (let j = 0; j < phraseWords.length; j++) {
        const wn = normalise(words[i + j].text);
        const pn = normalise(phraseWords[j]);
        // Allow partial containment for morphological variants
        if (wn !== pn && !wn.includes(pn) && !pn.includes(wn)) {
          hit = false;
          break;
        }
      }
      if (hit) return i;
    }
    return -1;
  };

  const idx = search(startFrom);
  if (idx >= 0) return idx;
  // Try again from the beginning in case the LLM reordered pairs slightly
  return startFrom > 0 ? search(0) : -1;
}

/**
 * Build bidirectional alignment maps from LLM word pairs.
 *
 * @param {string} srcText  – original source text
 * @param {string} tgtText  – translated text
 * @param {Array<{src:string, tgt:string}>} pairs – LLM alignment pairs in order
 * @returns {{ srcToTgt: Object, tgtToSrc: Object }}
 *   srcToTgt[srcWordIdx] = [tgtWordIdx, ...]
 *   tgtToSrc[tgtWordIdx] = [srcWordIdx, ...]
 */
export function buildAlignment(srcText, tgtText, pairs) {
  if (!pairs || pairs.length === 0) return { srcToTgt: {}, tgtToSrc: {} };

  const srcTokens = tokenizeWords(srcText);
  const tgtTokens = tokenizeWords(tgtText);

  const srcWords = srcTokens.filter(t => t.isWord);
  const tgtWords = tgtTokens.filter(t => t.isWord);

  const srcToTgt = {};
  const tgtToSrc = {};

  let srcSearchFrom = 0;
  let tgtSearchFrom = 0;

  for (const pair of pairs) {
    if (!pair.src || !pair.tgt) continue;

    // For CJK, split the phrase into individual characters; otherwise by space
    const splitPhrase = (phrase, sampleText) =>
      isAsian(sampleText)
        ? [...phrase.replace(/\s/g, '')]        // CJK → characters
        : phrase.trim().split(/\s+/).filter(Boolean); // western → words

    const srcPhraseWords = splitPhrase(pair.src, srcText);
    const tgtPhraseWords = splitPhrase(pair.tgt, tgtText);

    if (srcPhraseWords.length === 0 || tgtPhraseWords.length === 0) continue;

    const si = findWordSequence(srcWords, srcPhraseWords, srcSearchFrom);
    const ti = findWordSequence(tgtWords, tgtPhraseWords, tgtSearchFrom);

    if (si >= 0 && ti >= 0) {
      for (let a = 0; a < srcPhraseWords.length && si + a < srcWords.length; a++) {
        const srcIdx = srcWords[si + a].wordIdx;
        for (let b = 0; b < tgtPhraseWords.length && ti + b < tgtWords.length; b++) {
          const tgtIdx = tgtWords[ti + b].wordIdx;
          if (!srcToTgt[srcIdx]) srcToTgt[srcIdx] = [];
          if (!srcToTgt[srcIdx].includes(tgtIdx)) srcToTgt[srcIdx].push(tgtIdx);
          if (!tgtToSrc[tgtIdx]) tgtToSrc[tgtIdx] = [];
          if (!tgtToSrc[tgtIdx].includes(srcIdx)) tgtToSrc[tgtIdx].push(srcIdx);
        }
      }
      srcSearchFrom = si + srcPhraseWords.length;
      tgtSearchFrom = ti + tgtPhraseWords.length;
    }
  }

  return { srcToTgt, tgtToSrc };
}

/**
 * Replace the word at `targetWordIdx` with `newWord` inside `text`.
 */
export function replaceWordAtIndex(text, targetWordIdx, newWord) {
  return tokenizeWords(text)
    .map(tok => (tok.isWord && tok.wordIdx === targetWordIdx ? newWord : tok.text))
    .join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WordDisplay
 *
 * Props:
 *   text               {string}          – the text to display
 *   side               {'src'|'tgt'}     – which panel this is
 *   alignment          {{srcToTgt, tgtToSrc}}
 *   externalHoveredIdx {number|null}     – word index hovered in the OTHER panel
 *   onHoverWord        {(idx|null)=>void}
 *   onEditWord         {(wordIdx, currentText)=>void}
 *   placeholder        {string}
 */
export default function WordDisplay({
  text,
  side,
  alignment,
  externalHoveredIdx,
  onHoverWord,
  onEditWord,
  placeholder = 'Translation will appear here…',
}) {
  if (!text) {
    return (
      <div className="p-4 text-slate-500 italic text-sm select-none">
        {placeholder}
      </div>
    );
  }

  const tokens = tokenizeWords(text);
  const { srcToTgt = {}, tgtToSrc = {} } = alignment || {};

  // Which word indices on THIS side should be highlighted (due to external hover)?
  const highlightedSet = new Set();
  if (externalHoveredIdx !== null && externalHoveredIdx !== undefined) {
    const aligned =
      side === 'tgt'
        ? srcToTgt[externalHoveredIdx] || []
        : tgtToSrc[externalHoveredIdx] || [];
    aligned.forEach(i => highlightedSet.add(i));
  }

  return (
    <div className="p-4 leading-relaxed text-sm select-text">
      {tokens.map((tok, idx) => {
        if (!tok.isWord) {
          // Preserve whitespace characters exactly
          return (
            <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>
              {tok.text}
            </span>
          );
        }

        const wi = tok.wordIdx;
        const isHighlighted = highlightedSet.has(wi);
        const hasAlignment  =
          side === 'src'
            ? (srcToTgt[wi]?.length > 0)
            : (tgtToSrc[wi]?.length > 0);

        // Colour scheme:
        //   highlighted (externally hovered pair) → amber for src, teal for tgt
        //   has alignment but not highlighted      → subtle hover tint
        //   no alignment data                      → muted text, no hover tint
        let colourCls;
        if (isHighlighted) {
          colourCls =
            side === 'src'
              ? 'bg-amber-400 text-slate-900'
              : 'bg-teal-400 text-slate-900';
        } else if (hasAlignment) {
          colourCls =
            side === 'src'
              ? 'text-slate-100 hover:bg-blue-800/60'
              : 'text-slate-100 hover:bg-emerald-800/60';
        } else {
          colourCls = 'text-slate-400 hover:text-slate-200';
        }

        return (
          <span
            key={idx}
            className={`cursor-pointer rounded px-0.5 transition-colors duration-100 ${colourCls}`}
            onMouseEnter={() => onHoverWord?.(wi)}
            onMouseLeave={() => onHoverWord?.(null)}
            onDoubleClick={() => onEditWord?.(wi, tok.text)}
            title={hasAlignment ? 'Double-click to edit' : undefined}
          >
            {tok.text}
          </span>
        );
      })}
    </div>
  );
}

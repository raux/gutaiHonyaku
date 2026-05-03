import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPdfViewerSrc,
  getLinkedBlockState,
} from '../src/documentLinks.js';


test('getLinkedBlockState keeps page-linked selection in sync', () => {
  const document = {
    pages: [
      {
        page_number: 1,
        blocks: [
          { block_id: 'p1-b1', text: 'alpha', page_number: 1 },
          { block_id: 'p1-b2', text: 'beta', page_number: 1 },
        ],
      },
      {
        page_number: 2,
        blocks: [
          { block_id: 'p2-b1', text: 'gamma', page_number: 2 },
        ],
      },
    ],
  };
  const translation = {
    blocks: [
      { block_id: 'p1-b1', translation: 'アルファ', page_number: 1 },
      { block_id: 'p1-b2', translation: 'ベータ', page_number: 1 },
      { block_id: 'p2-b1', translation: 'ガンマ', page_number: 2 },
    ],
  };

  const state = getLinkedBlockState(document, translation, 'p2-b1');

  assert.equal(state.selectedPageNumber, 2);
  assert.equal(state.selectedSourceBlock?.text, 'gamma');
  assert.equal(state.selectedTranslatedBlock?.translation, 'ガンマ');
});


test('buildPdfViewerSrc appends page fragments for page jumps', () => {
  assert.equal(buildPdfViewerSrc('/documents/doc-1/pdf', 3), '/documents/doc-1/pdf#page=3');
  assert.equal(buildPdfViewerSrc('/documents/doc-1/pdf', null), '/documents/doc-1/pdf');
});

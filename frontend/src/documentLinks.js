export function flattenDocumentBlocks(document) {
  if (!document?.pages) return [];
  return document.pages.flatMap(page =>
    (page.blocks || []).map(block => ({
      ...block,
      page_number: block.page_number ?? page.page_number,
    })),
  );
}

export function resolveSelectedBlock(blocks, selectedBlockId) {
  if (!blocks?.length) return null;
  return blocks.find(block => block.block_id === selectedBlockId) || blocks[0];
}

export function getLinkedBlockState(document, translation, selectedBlockId) {
  const sourceBlocks = flattenDocumentBlocks(document);
  const translatedBlocks = translation?.blocks || [];
  const selectedTranslatedBlock = resolveSelectedBlock(translatedBlocks, selectedBlockId);
  const selectedSourceBlock = selectedTranslatedBlock
    ? sourceBlocks.find(block => block.block_id === selectedTranslatedBlock.block_id) || null
    : resolveSelectedBlock(sourceBlocks, selectedBlockId);

  return {
    sourceBlocks,
    translatedBlocks,
    selectedSourceBlock,
    selectedTranslatedBlock,
    selectedPageNumber:
      selectedTranslatedBlock?.page_number || selectedSourceBlock?.page_number || null,
  };
}

export function buildPdfViewerSrc(pdfUrl, pageNumber) {
  if (!pdfUrl) return '';
  return pageNumber ? `${pdfUrl}#page=${pageNumber}` : pdfUrl;
}

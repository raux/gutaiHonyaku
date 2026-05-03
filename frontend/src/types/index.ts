export type Language = 'English' | 'Japanese';

export type Provider = 'lm_studio' | 'ollama';

export type SourceType = 'text' | 'pdf';

export interface LmConfig {
  lmStudioUrl: string;
  model: string;
  provider: Provider;
}

export interface WordPair {
  src: string;
  tgt: string;
}

export interface FuriganaPair {
  text: string;
  reading: string;
}

export interface TranslationResponse {
  translation: string;
  reasoning?: string;
  pairs: WordPair[];
  source_furigana?: FuriganaPair[] | null;
  target_furigana?: FuriganaPair[] | null;
}

export interface AdjustResponse extends TranslationResponse {
  explanation?: string;
}

export interface TranslateRequestPayload {
  text: string;
  source_lang: Language;
  target_lang: Language;
  lm_studio_url?: string | null;
  model?: string | null;
  provider?: Provider | null;
}

export interface AdjustRequestPayload {
  original: string;
  translation: string;
  instruction: string;
  source_lang: Language;
  target_lang: Language;
  lm_studio_url?: string | null;
  model?: string | null;
  provider?: Provider | null;
}

export interface FuriganaRequest {
  text: string;
}

export interface FuriganaResponse {
  furigana: FuriganaPair[];
}

export interface DocumentBlock {
  block_id: string;
  block_index: number;
  text: string;
  translation?: string;
  page_number: number;
  reasoning?: string;
  pairs?: WordPair[];
  source_furigana?: FuriganaPair[] | null;
  target_furigana?: FuriganaPair[] | null;
}

export interface DocumentPage {
  page_number: number;
  blocks: DocumentBlock[];
}

export interface Document {
  document_id: string;
  filename: string;
  page_count: number;
  character_count: number;
  pdf_url: string;
  pages: DocumentPage[];
}

export interface DocumentTranslateResponse extends Document {
  selected_block_id?: string;
}

export interface HealthResponse {
  status: string;
}

export interface ProviderHealthRequest {
  base_url: string | null;
  provider: Provider;
}

export interface ProviderHealthResponse {
  reachable: boolean;
}

export interface ModelsResponse {
  data: Array<{ id: string }>;
}

export interface ProviderRequest {
  base_url: string | null;
  provider: Provider;
}

export const PROVIDER_DEFAULTS: Record<Provider, string> = {
  lm_studio: 'http://localhost:1234',
  ollama: 'http://localhost:11434',
};

export interface EditModalState {
  side: 'src' | 'tgt';
  wordIdx: number;
}

export interface Alignment {
  srcToTgt: Record<number, number[]>;
  tgtToSrc: Record<number, number[]>;
}

export interface Token {
  text: string;
  isWord: boolean;
  startIdx: number;
  endIdx: number;
}

export interface PdfLinkState {
  sourceBlocks: DocumentBlock[];
  translatedBlocks: DocumentBlock[];
  selectedSourceBlock: DocumentBlock | null;
  selectedTranslatedBlock: DocumentBlock | null;
  selectedPageNumber: number | null;
}
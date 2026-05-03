/**
 * api.js – Axios instance for the gutaiHonyaku backend.
 *
 * The Vite dev-server proxy routes backend endpoints to http://localhost:8000,
 * so we only need a relative base URL here.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  timeout: 180_000, // 3 minutes – translation of long documents can take a while
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Translation endpoints
// ---------------------------------------------------------------------------

/**
 * Translate a document with word-level alignment.
 *
 * @param {string}      text         – source text to translate
 * @param {string}      srcLang      – source language name (e.g. "English")
 * @param {string}      tgtLang      – target language name (e.g. "Japanese")
 * @param {string|null} lmStudioUrl  – optional server URL override
 * @param {string|null} model        – optional model ID override
 * @param {string|null} provider     – "lm_studio" | "ollama"
 * @returns {Promise<{translation: string, pairs: Array<{src:string, tgt:string}>}>}
 */
export async function translateText(
  text,
  srcLang,
  tgtLang,
  lmStudioUrl = null,
  model = null,
  provider = null,
) {
  const payload = { text, source_lang: srcLang, target_lang: tgtLang };
  if (lmStudioUrl) payload.lm_studio_url = lmStudioUrl;
  if (model)       payload.model         = model;
  if (provider)    payload.provider      = provider;
  const { data } = await api.post('/translate', payload);
  return data;
}

/**
 * Adjust a translation based on a user instruction.
 *
 * @param {string}      original     – original source text
 * @param {string}      translation  – current translation text
 * @param {string}      instruction  – adjustment instruction from the user
 * @param {string}      srcLang      – source language name
 * @param {string}      tgtLang      – target language name
 * @param {string|null} lmStudioUrl  – optional server URL override
 * @param {string|null} model        – optional model ID override
 * @param {string|null} provider     – "lm_studio" | "ollama"
 * @returns {Promise<{translation: string, explanation: string, pairs: Array<{src:string, tgt:string}>}>}
 */
export async function adjustTranslation(
  original,
  translation,
  instruction,
  srcLang,
  tgtLang,
  lmStudioUrl = null,
  model = null,
  provider = null,
) {
  const payload = {
    original,
    translation,
    instruction,
    source_lang: srcLang,
    target_lang: tgtLang,
  };
  if (lmStudioUrl) payload.lm_studio_url = lmStudioUrl;
  if (model)       payload.model         = model;
  if (provider)    payload.provider      = provider;
  const { data } = await api.post('/adjust', payload);
  return data;
}

/**
 * Fetch furigana (reading) annotations for Japanese text.
 *
 * @param {string} text – Japanese text to annotate
 * @returns {Promise<Array<{text: string, reading: string}>>}
 */
export async function fetchFurigana(text) {
  const { data } = await api.post('/furigana', { text });
  return data.furigana || [];
}

// ---------------------------------------------------------------------------
// Health / status
// ---------------------------------------------------------------------------

/** Check whether the FastAPI backend itself is alive. */
export async function checkBackendHealth() {
  const { data } = await api.get('/health');
  return data;
}

/** Ask the backend whether it can reach LM Studio and/or Ollama. */
export async function checkServerStatus() {
  const { data } = await api.get('/status');
  return data;
}

// ---------------------------------------------------------------------------
// Local AI server helpers (used by LmStudioConfig)
// ---------------------------------------------------------------------------

/** Default base URLs for each provider */
export const PROVIDER_DEFAULTS = {
  lm_studio: 'http://localhost:1234',
  ollama:    'http://localhost:11434',
};

function buildProviderRequest(baseUrl, provider = 'lm_studio') {
  return {
    base_url: baseUrl || null,
    provider,
  };
}

/**
 * Fetch the list of models from a local AI server via the backend.
 *
 * @param {string} baseUrl – e.g. "http://localhost:1234" or "http://localhost:11434"
 * @param {string} provider – "lm_studio" | "ollama"
 * @returns {Array<{id: string}>}
 */
export async function fetchModels(baseUrl, provider = 'lm_studio') {
  try {
    const { data } = await api.post('/models', buildProviderRequest(baseUrl, provider), {
      timeout: 5000,
    });
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Ping a local AI server via the backend and return true if it responds successfully.
 *
 * @param {string} baseUrl – e.g. "http://localhost:1234" or "http://localhost:11434"
 * @param {string} provider – "lm_studio" | "ollama"
 */
export async function pingServer(baseUrl, provider = 'lm_studio') {
  try {
    const { data } = await api.post('/provider-health', buildProviderRequest(baseUrl, provider), {
      timeout: 5000,
    });
    return Boolean(data.reachable);
  } catch {
    return false;
  }
}

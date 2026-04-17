/**
 * api.js – Axios instance for the gutaiHonyaku backend.
 *
 * The Vite dev-server proxy routes /translate, /adjust, /health, and /status
 * to http://localhost:8000, so we only need a relative base URL here.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  timeout: 180_000, // 3 minutes – translation of long sections can take a while
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Translation endpoints
// ---------------------------------------------------------------------------

/**
 * Translate a section of text with word-level alignment.
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

const LM_STUDIO_API_KEY = 'lm-studio';

/**
 * Normalise a server base URL so it never ends with /v1 or /v1/.
 * Avoids double-/v1 when the caller appends /v1/models.
 */
function stripV1Suffix(url) {
  return url.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
}

/**
 * Fetch the list of models from a local AI server (LM Studio or Ollama).
 *
 * @param {string} baseUrl – e.g. "http://localhost:1234" or "http://localhost:11434"
 * @returns {Array<{id: string}>}
 */
export async function fetchModels(baseUrl) {
  try {
    const resp = await fetch(`${stripV1Suffix(baseUrl)}/v1/models`, {
      headers: { Authorization: `Bearer ${LM_STUDIO_API_KEY}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Ping a local AI server and return true if it responds successfully.
 *
 * @param {string} baseUrl – e.g. "http://localhost:1234" or "http://localhost:11434"
 */
export async function pingServer(baseUrl) {
  try {
    const resp = await fetch(`${stripV1Suffix(baseUrl)}/v1/models`, {
      headers: { Authorization: `Bearer ${LM_STUDIO_API_KEY}` },
      signal: AbortSignal.timeout(2500),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

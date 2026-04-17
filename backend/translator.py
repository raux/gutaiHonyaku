"""translator.py – Translation and word-alignment logic for gutaiHonyaku."""
from __future__ import annotations

import json
import logging
import re

from openai import OpenAI

try:
    import pykakasi

    _kakasi = pykakasi.kakasi()
    _HAS_PYKAKASI = True
except ImportError:  # pragma: no cover
    _HAS_PYKAKASI = False

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


TRANSLATE_SYSTEM = (
    "You are a professional translation assistant. "
    "Translate text accurately while preserving meaning, tone, and nuance. "
    "Always respond with valid JSON only – no markdown, no explanation outside the JSON."
)

ADJUST_SYSTEM = (
    "You are a professional translation editor. "
    "Adjust translations based on user instructions while preserving accuracy. "
    "Always respond with valid JSON only – no markdown, no explanation outside the JSON."
)

_JAPANESE = "japanese"


def _chat(client: OpenAI, model: str, system: str, user: str) -> str:
    """Send a single-turn chat request and return the assistant text."""
    logger.debug(
        "LLM request → model=%s, system_prompt length=%d, user_prompt length=%d",
        model,
        len(system),
        len(user),
    )
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
    )
    content = response.choices[0].message.content or ""
    logger.debug(
        "LLM response ← model=%s, finish_reason=%s, content length=%d",
        response.model,
        response.choices[0].finish_reason,
        len(content),
    )
    return content


def extract_json(text: str) -> dict:
    """Extract the first JSON object from an LLM response, stripping markdown fences."""
    # Strip markdown code fences
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```", "", text)
    # Find JSON object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError(f"No JSON object found in LLM response: {text[:300]}")


def _has_kanji(text: str) -> bool:
    """Return True if *text* contains at least one CJK Unified Ideograph."""
    return any("\u4e00" <= ch <= "\u9fff" or "\u3400" <= ch <= "\u4dbf" for ch in text)


def generate_furigana(text: str) -> list[dict]:
    """Generate furigana (reading) annotations for Japanese text.

    Returns a list of ``{"text": str, "reading": str}`` objects.
    ``reading`` is non-empty only for segments containing kanji.
    """
    if not _HAS_PYKAKASI or not text or not text.strip():
        return []

    segments: list[dict] = []
    for item in _kakasi.convert(text):
        orig = item["orig"]
        hira = item["hira"]
        reading = hira if _has_kanji(orig) else ""
        segments.append({"text": orig, "reading": reading})
    return segments


def translate_text(
    client: OpenAI,
    model: str,
    text: str,
    source_lang: str,
    target_lang: str,
) -> dict:
    """
    Translate text and return word-level alignment pairs.

    Returns:
        {
            "translation": str,
            "pairs": [{"src": str, "tgt": str}, ...]
        }
    """
    logger.info("Translating %d chars from %s to %s", len(text), source_lang, target_lang)
    user_prompt = (
        f"Translate the following {source_lang} text to {target_lang}.\n\n"
        f'Source text: "{text}"\n\n'
        "Return ONLY a JSON object in exactly this format:\n"
        "{\n"
        '  "translation": "<complete translation here>",\n'
        '  "pairs": [\n'
        '    {"src": "<source word or short phrase>", "tgt": "<corresponding target word or phrase>"},\n'
        "    ...\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- List pairs in source text order\n"
        "- Include all significant content words (skip pure punctuation)\n"
        "- Each pair maps one source word/phrase to its target equivalent\n"
        "- Return only valid JSON, nothing else"
    )

    raw = _chat(client, model, TRANSLATE_SYSTEM, user_prompt)
    logger.debug("Raw translation response: %s", raw[:500])

    parsed = extract_json(raw)

    translation = parsed.get("translation", "")
    result: dict = {
        "translation": translation,
        "pairs": parsed.get("pairs", []),
    }

    # Attach furigana for any Japanese text
    if source_lang.lower() == _JAPANESE:
        result["source_furigana"] = generate_furigana(text)
    if target_lang.lower() == _JAPANESE:
        result["target_furigana"] = generate_furigana(translation)

    return result


def adjust_translation(
    client: OpenAI,
    model: str,
    original: str,
    current_translation: str,
    instruction: str,
    source_lang: str,
    target_lang: str,
) -> dict:
    """
    Adjust a translation based on a user instruction.

    Returns:
        {
            "translation": str,
            "explanation": str,
            "pairs": [{"src": str, "tgt": str}, ...]
        }
    """
    logger.info("Adjusting translation: instruction=%s", instruction[:100])

    user_prompt = (
        f"Adjust the following {target_lang} translation based on the user's instruction.\n\n"
        f'Original {source_lang} text: "{original}"\n'
        f'Current {target_lang} translation: "{current_translation}"\n'
        f'User instruction: "{instruction}"\n\n'
        "Return ONLY a JSON object in exactly this format:\n"
        "{\n"
        '  "translation": "<adjusted translation>",\n'
        '  "explanation": "<brief explanation of what was changed and why>",\n'
        '  "pairs": [\n'
        '    {"src": "<source word>", "tgt": "<adjusted target word>"},\n'
        "    ...\n"
        "  ]\n"
        "}\n\n"
        "Return only valid JSON, nothing else."
    )

    raw = _chat(client, model, ADJUST_SYSTEM, user_prompt)
    logger.debug("Raw adjust response: %s", raw[:500])

    parsed = extract_json(raw)

    translation = parsed.get("translation", "")
    result: dict = {
        "translation": translation,
        "explanation": parsed.get("explanation", ""),
        "pairs": parsed.get("pairs", []),
    }

    # Attach furigana for any Japanese text
    if source_lang.lower() == _JAPANESE:
        result["source_furigana"] = generate_furigana(original)
    if target_lang.lower() == _JAPANESE:
        result["target_furigana"] = generate_furigana(translation)

    return result

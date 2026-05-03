"""test_translator.py – Unit tests for gutaiHonyaku translator module."""
import json
import pytest
from backend.translator import extract_json, translate_text, adjust_translation, generate_furigana


# ---------------------------------------------------------------------------
# Dummy OpenAI client
# ---------------------------------------------------------------------------

class DummyMessage:
    def __init__(self, content, reasoning_content=None, reasoning=None, model_extra=None):
        self.content = content
        self.reasoning_content = reasoning_content
        self.reasoning = reasoning
        self.model_extra = model_extra or {}


class DummyChoice:
    def __init__(self, content, reasoning_content=None, reasoning=None, model_extra=None):
        self.message = DummyMessage(content, reasoning_content, reasoning, model_extra)
        self.finish_reason = "stop"


class DummyResponse:
    def __init__(self, content, reasoning_content=None, reasoning=None, model_extra=None):
        self.choices = [DummyChoice(content, reasoning_content, reasoning, model_extra)]
        self.model = "test-model"


class DummyCompletions:
    def __init__(self, content, reasoning_content=None, reasoning=None, model_extra=None):
        self._content = content
        self._reasoning_content = reasoning_content
        self._reasoning = reasoning
        self._model_extra = model_extra

    def create(self, model=None, messages=None, temperature=0.3):
        return DummyResponse(
            self._content,
            reasoning_content=self._reasoning_content,
            reasoning=self._reasoning,
            model_extra=self._model_extra,
        )


class DummyChat:
    def __init__(self, content, reasoning_content=None, reasoning=None, model_extra=None):
        self.completions = DummyCompletions(content, reasoning_content, reasoning, model_extra)


class DummyClient:
    def __init__(self, response_content, reasoning_content=None, reasoning=None, model_extra=None):
        self.chat = DummyChat(response_content, reasoning_content, reasoning, model_extra)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TRANSLATION_RESPONSE = json.dumps({
    "translation": "こんにちは世界",
    "reasoning": "Used the standard Japanese greeting and a direct noun translation.",
    "pairs": [
        {"src": "Hello", "tgt": "こんにちは"},
        {"src": "world", "tgt": "世界"},
    ],
})

ADJUST_RESPONSE = json.dumps({
    "translation": "こんにちは、世界！",
    "reasoning": "Added a comma and exclamation mark for emphasis",
    "pairs": [
        {"src": "Hello", "tgt": "こんにちは"},
        {"src": "world", "tgt": "世界"},
    ],
})


# ---------------------------------------------------------------------------
# extract_json tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "input_text,expected_key",
    [
        ('{"key": "value"}', "key"),
        ('Some text before {"key": "value"} and after', "key"),
        ('```json\n{"key": "value"}\n```', "key"),
        ('```\n{"key": "value"}\n```', "key"),
        ('Here is the JSON: {"translation": "hello", "pairs": []}', "translation"),
    ],
)
def test_extract_json_valid(input_text, expected_key):
    result = extract_json(input_text)
    assert expected_key in result


def test_extract_json_no_json_raises():
    with pytest.raises(ValueError, match="No JSON object found"):
        extract_json("there is no json here at all")


def test_extract_json_nested():
    data = {"outer": {"inner": "value"}, "list": [1, 2, 3]}
    result = extract_json(json.dumps(data))
    assert result["outer"]["inner"] == "value"
    assert result["list"] == [1, 2, 3]


# ---------------------------------------------------------------------------
# translate_text tests
# ---------------------------------------------------------------------------

def test_translate_text_returns_translation():
    client = DummyClient(TRANSLATION_RESPONSE)
    result = translate_text(client, "test-model", "Hello world", "English", "Japanese")

    assert result["translation"] == "こんにちは世界"
    assert result["reasoning"] == "Used the standard Japanese greeting and a direct noun translation."
    assert isinstance(result["pairs"], list)
    assert len(result["pairs"]) == 2


def test_translate_text_pairs_structure():
    client = DummyClient(TRANSLATION_RESPONSE)
    result = translate_text(client, "test-model", "Hello world", "English", "Japanese")

    first_pair = result["pairs"][0]
    assert "src" in first_pair
    assert "tgt" in first_pair
    assert first_pair["src"] == "Hello"
    assert first_pair["tgt"] == "こんにちは"


def test_translate_text_empty_pairs_on_missing_key():
    """If the LLM omits the pairs key, we return an empty list."""
    response = json.dumps({"translation": "Bonjour"})
    client = DummyClient(response)
    result = translate_text(client, "test-model", "Hello", "English", "French")

    assert result["translation"] == "Bonjour"
    assert result["pairs"] == []


def test_translate_text_uses_provider_reasoning_when_json_missing():
    response = json.dumps({"translation": "Bonjour", "pairs": []})
    client = DummyClient(response, reasoning_content="Chose the most common French equivalent.")
    result = translate_text(client, "test-model", "Hello", "English", "French")

    assert result["reasoning"] == "Chose the most common French equivalent."


# ---------------------------------------------------------------------------
# adjust_translation tests
# ---------------------------------------------------------------------------

def test_adjust_translation_returns_fields():
    client = DummyClient(ADJUST_RESPONSE)
    result = adjust_translation(
        client,
        "test-model",
        "Hello world",
        "こんにちは世界",
        "add more emphasis",
        "English",
        "Japanese",
    )

    assert "translation" in result
    assert "reasoning" in result
    assert "explanation" in result
    assert "pairs" in result


def test_adjust_translation_content():
    client = DummyClient(ADJUST_RESPONSE)
    result = adjust_translation(
        client,
        "test-model",
        "Hello world",
        "こんにちは世界",
        "add punctuation",
        "English",
        "Japanese",
    )

    assert result["translation"] == "こんにちは、世界！"
    assert "comma" in result["reasoning"].lower() or "emphasis" in result["reasoning"].lower()
    assert result["reasoning"] == result["explanation"]


def test_adjust_translation_missing_explanation():
    """If the LLM omits reasoning, we return an empty string."""
    response = json.dumps({
        "translation": "Adjusted text",
        "pairs": [],
    })
    client = DummyClient(response)
    result = adjust_translation(
        client, "test-model", "Source", "Translation", "instruction", "English", "French"
    )
    assert result["reasoning"] == ""
    assert result["explanation"] == ""


def test_adjust_translation_uses_legacy_explanation_key():
    response = json.dumps({
        "translation": "Adjusted text",
        "explanation": "Made the tone more formal.",
        "pairs": [],
    })
    client = DummyClient(response)
    result = adjust_translation(
        client, "test-model", "Source", "Translation", "instruction", "English", "French"
    )

    assert result["reasoning"] == "Made the tone more formal."
    assert result["explanation"] == "Made the tone more formal."


# ---------------------------------------------------------------------------
# generate_furigana tests
# ---------------------------------------------------------------------------

def test_generate_furigana_kanji():
    """Kanji segments should have a non-empty hiragana reading."""
    segments = generate_furigana("漢字")
    assert len(segments) >= 1
    # At least one segment should have a non-empty reading for kanji
    readings = [s for s in segments if s["reading"]]
    assert len(readings) >= 1


def test_generate_furigana_hiragana_only():
    """Pure hiragana text should have empty readings (no furigana needed)."""
    segments = generate_furigana("ひらがな")
    assert len(segments) >= 1
    for seg in segments:
        assert seg["reading"] == ""


def test_generate_furigana_empty():
    """Empty text returns an empty list."""
    assert generate_furigana("") == []
    assert generate_furigana("   ") == []


def test_generate_furigana_mixed():
    """Mixed kanji + hiragana text: only kanji portions have readings."""
    segments = generate_furigana("東京は美しい")
    assert len(segments) >= 1
    texts_joined = "".join(s["text"] for s in segments)
    assert texts_joined == "東京は美しい"
    # At least one segment should have a reading (東京, 美しい)
    readings = [s for s in segments if s["reading"]]
    assert len(readings) >= 1


# ---------------------------------------------------------------------------
# translate_text furigana integration tests
# ---------------------------------------------------------------------------

def test_translate_text_includes_target_furigana():
    """When target_lang is Japanese, result should include target_furigana."""
    client = DummyClient(TRANSLATION_RESPONSE)
    result = translate_text(client, "test-model", "Hello world", "English", "Japanese")
    assert "target_furigana" in result
    assert isinstance(result["target_furigana"], list)


def test_translate_text_includes_source_furigana():
    """When source_lang is Japanese, result should include source_furigana."""
    jp_response = json.dumps({
        "translation": "Hello world",
        "pairs": [
            {"src": "こんにちは", "tgt": "Hello"},
            {"src": "世界", "tgt": "world"},
        ],
    })
    client = DummyClient(jp_response)
    result = translate_text(client, "test-model", "こんにちは世界", "Japanese", "English")
    assert "source_furigana" in result
    assert isinstance(result["source_furigana"], list)


def test_translate_text_no_furigana_for_non_japanese():
    """When neither language is Japanese, no furigana fields should be present."""
    response = json.dumps({"translation": "Bonjour", "pairs": []})
    client = DummyClient(response)
    result = translate_text(client, "test-model", "Hello", "English", "French")
    assert "source_furigana" not in result
    assert "target_furigana" not in result


def test_adjust_translation_includes_furigana():
    """adjust_translation includes furigana when target is Japanese."""
    client = DummyClient(ADJUST_RESPONSE)
    result = adjust_translation(
        client,
        "test-model",
        "Hello world",
        "こんにちは世界",
        "add emphasis",
        "English",
        "Japanese",
    )
    assert "target_furigana" in result
    assert isinstance(result["target_furigana"], list)

"""test_translator.py – Unit tests for gutaiHonyaku translator module."""
import json
import pytest
from backend.translator import extract_json, translate_text, adjust_translation


# ---------------------------------------------------------------------------
# Dummy OpenAI client
# ---------------------------------------------------------------------------

class DummyMessage:
    def __init__(self, content):
        self.content = content


class DummyChoice:
    def __init__(self, content):
        self.message = DummyMessage(content)
        self.finish_reason = "stop"


class DummyResponse:
    def __init__(self, content):
        self.choices = [DummyChoice(content)]
        self.model = "test-model"


class DummyCompletions:
    def __init__(self, content):
        self._content = content

    def create(self, model=None, messages=None, temperature=0.3):
        return DummyResponse(self._content)


class DummyChat:
    def __init__(self, content):
        self.completions = DummyCompletions(content)


class DummyClient:
    def __init__(self, response_content):
        self.chat = DummyChat(response_content)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TRANSLATION_RESPONSE = json.dumps({
    "translation": "こんにちは世界",
    "pairs": [
        {"src": "Hello", "tgt": "こんにちは"},
        {"src": "world", "tgt": "世界"},
    ],
})

ADJUST_RESPONSE = json.dumps({
    "translation": "こんにちは、世界！",
    "explanation": "Added a comma and exclamation mark for emphasis",
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
    assert "comma" in result["explanation"].lower() or "emphasis" in result["explanation"].lower()


def test_adjust_translation_missing_explanation():
    """If the LLM omits explanation, we return an empty string."""
    response = json.dumps({
        "translation": "Adjusted text",
        "pairs": [],
    })
    client = DummyClient(response)
    result = adjust_translation(
        client, "test-model", "Source", "Translation", "instruction", "English", "French"
    )
    assert result["explanation"] == ""

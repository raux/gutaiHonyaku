"""Tests for backend.main network helper endpoints."""
from fastapi.testclient import TestClient

from backend import main


client = TestClient(main.app)


class DummyResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            request = main.httpx.Request("GET", "http://provider.test/v1/models")
            response = main.httpx.Response(self.status_code, request=request)
            raise main.httpx.HTTPStatusError("boom", request=request, response=response)


def test_normalize_base_url_adds_scheme_and_v1():
    assert main._normalize_base_url("localhost:1234") == "http://localhost:1234/v1"


def test_resolve_provider_request_uses_provider_api_key():
    base_url, api_key = main._resolve_provider_request("http://localhost:11434", "ollama")
    assert base_url == "http://localhost:11434/v1"
    assert api_key == "ollama"


def test_provider_health_uses_normalized_url(monkeypatch):
    captured = {}

    async def fake_fetch(base_url, api_key):
        captured["base_url"] = base_url
        captured["api_key"] = api_key
        return DummyResponse(status_code=200)

    monkeypatch.setattr(main, "_fetch_provider_models", fake_fetch)

    response = client.post("/provider-health", json={"base_url": "localhost:1234", "provider": "lm_studio"})

    assert response.status_code == 200
    assert response.json() == {"reachable": True}
    assert captured == {
        "base_url": "http://localhost:1234/v1",
        "api_key": "lm-studio",
    }


def test_list_models_returns_backend_payload(monkeypatch):
    async def fake_fetch(base_url, api_key):
        assert base_url == "http://localhost:11434/v1"
        assert api_key == "ollama"
        return DummyResponse(
            status_code=200,
            payload={"data": [{"id": "llama3"}, {"id": "qwen2.5"}]},
        )

    monkeypatch.setattr(main, "_fetch_provider_models", fake_fetch)

    response = client.post("/models", json={"base_url": "http://localhost:11434", "provider": "ollama"})

    assert response.status_code == 200
    assert response.json() == {"data": [{"id": "llama3"}, {"id": "qwen2.5"}]}

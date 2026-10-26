"""Tests for the web server. Run: python -m pytest  (no internet or API key needed)"""

import json

import pytest
from fastapi.testclient import TestClient

import app as server
import core
from samples import SAMPLES


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    server._hits.clear()
    server._cache.clear()
    return TestClient(server.app)


def test_config_lists_reviewers_and_examples(client):
    data = client.get("/api/config").json()
    assert data["server_key"] is False
    assert {p["id"] for p in data["personas"]} == set(core.PERSONAS)
    assert "style" not in data["personas"][0]  # the AI instructions stay on the server
    assert len(data["samples"]) == 3


def test_homepage_is_served(client):
    r = client.get("/")
    assert r.status_code == 200 and "CommitRoast" in r.text


def test_demo_mode_answers_examples_in_each_voice(client):
    pirate = client.post("/api/roast", json={"diff": SAMPLES["leak"]["diff"], "persona": "pirate"}).json()
    chef = client.post("/api/roast", json={"diff": SAMPLES["leak"]["diff"], "persona": "chef"}).json()
    assert pirate["demo"] and pirate["report"]["risk_score"] == 10
    assert pirate["report"]["roast"] != chef["report"]["roast"]


def test_own_diff_without_key_asks_for_one(client):
    r = client.post("/api/roast", json={"diff": "+print('hi')", "persona": "staff"})
    assert r.status_code == 400 and "key" in r.json()["detail"]


GOOD = json.dumps(dict(roast="r", summary="s", risk_score=4, concerns=["c"], conventional_commit="fix: x"))


def fake_gemini(monkeypatch, calls):
    class Models:
        def generate_content(self, model, contents, config):
            calls.append(model)
            return type("R", (), {"text": GOOD})()
    monkeypatch.setattr(core.genai, "Client", lambda api_key: type("C", (), {"models": Models()})())


def test_real_review_with_server_key_counts_down_and_caches(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "server-key")
    calls = []
    fake_gemini(monkeypatch, calls)
    body = {"diff": "+print('hi')", "persona": "sre"}
    first = client.post("/api/roast", json=body)
    assert first.status_code == 200 and first.json()["demo"] is False
    assert first.headers["X-Roasts-Left"] == str(server.ROASTS_PER_HOUR - 1)
    client.post("/api/roast", json=body)
    assert len(calls) == 1  # the repeat came from the cache


def test_rate_limit_on_shared_key(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "server-key")
    fake_gemini(monkeypatch, [])
    monkeypatch.setattr(server, "ROASTS_PER_HOUR", 2)
    codes = [client.post("/api/roast", json={"diff": f"+line {i}", "persona": "staff"}).status_code for i in range(3)]
    assert codes == [200, 200, 429]


def test_visitor_key_skips_the_limit(client, monkeypatch):
    fake_gemini(monkeypatch, [])
    monkeypatch.setattr(server, "ROASTS_PER_HOUR", 0)
    r = client.post("/api/roast", json={"diff": "+x", "persona": "staff", "api_key": "my-own-key"})
    assert r.status_code == 200

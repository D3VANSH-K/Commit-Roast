"""Quick tests for the parts that don't need the internet. Run: python -m pytest"""

import pytest
from pydantic import ValidationError

from core import ReviewReport, diff_stats, looks_like_diff, prepare_diff
from samples import SAMPLES

SAMPLE_DIFFS = {k: v["diff"] for k, v in SAMPLES.items()}


def test_diff_stats_counts_lines_and_files():
    s = diff_stats(SAMPLE_DIFFS["clean"])
    assert s.files == ["utils/dates.py", "tests/test_dates.py"]
    assert s.added == 8
    assert s.removed == 2


def test_diff_stats_single_file():
    s = diff_stats(SAMPLE_DIFFS["leak"])
    assert s.file_count == 1 and s.added == 6 and s.removed == 2


def test_looks_like_diff():
    assert looks_like_diff(SAMPLE_DIFFS["test"])
    assert not looks_like_diff("print('hello')")


def test_prepare_diff_truncates_on_line_boundary():
    big = "\n".join(f"+line {i}" for i in range(10_000))
    out, cut = prepare_diff(big, limit=1000)
    assert cut and len(out) < 1100
    assert out.splitlines()[-2].startswith("+line")  # no half lines


def test_score_is_clamped():
    data = dict(roast="r", summary="s", concerns=["c"], conventional_commit="fix: x")
    assert ReviewReport(risk_score=42, **data).risk_score == 10
    assert ReviewReport(risk_score=-3, **data).risk_score == 1


def test_missing_field_is_rejected():
    with pytest.raises(ValidationError):
        ReviewReport.model_validate_json('{"roast": "only a roast"}')


# ---- AI call logic, tested with a fake Gemini client (no internet needed) ----
import json
from google.genai import errors
import core


@pytest.fixture(autouse=True)
def fresh_cooldowns():
    core._cooldown.clear()
    yield
    core._cooldown.clear()

GOOD = json.dumps(dict(roast="r", summary="s", risk_score=7, concerns=["c"], conventional_commit="fix: x"))


class FakeModels:
    def __init__(self, behaviour):
        self.behaviour, self.calls = behaviour, []

    def generate_content(self, model, contents, config):
        self.calls.append((model, config.thinking_config is not None))
        action = self.behaviour(model, config)
        if isinstance(action, Exception):
            raise action
        return type("R", (), {"text": action})()


def fake_client(monkeypatch, behaviour):
    models = FakeModels(behaviour)
    monkeypatch.setattr(core.genai, "Client", lambda api_key, http_options=None: type("C", (), {"models": models})())
    return models


def err(code, msg="x"):
    return errors.ClientError(code, {"error": {"code": code, "message": msg, "status": "S"}})


def test_falls_back_when_first_model_is_unavailable(monkeypatch):
    m = fake_client(monkeypatch, lambda model, cfg: err(404) if model == core.DEFAULT_MODELS[0] else GOOD)
    res = core.analyze_diff("+x", "genz", api_key="k")
    assert res.model == core.DEFAULT_MODELS[1] and res.report.risk_score == 7


def test_retries_without_thinking_on_400(monkeypatch):
    m = fake_client(monkeypatch, lambda model, cfg: err(400) if cfg.thinking_config else GOOD)
    res = core.analyze_diff("+x", "p", api_key="k")
    assert m.calls == [(core.DEFAULT_MODELS[0], True), (core.DEFAULT_MODELS[0], False)]


def test_bad_key_stops_immediately(monkeypatch):
    m = fake_client(monkeypatch, lambda model, cfg: err(400, "API key not valid. Please pass a valid API key."))
    with pytest.raises(core.CommitRoastError, match="rejected"):
        core.analyze_diff("+x", "p", api_key="k")
    assert len(m.calls) == 1


def test_all_models_fail_gives_friendly_error(monkeypatch):
    fake_client(monkeypatch, lambda model, cfg: err(429))
    with pytest.raises(core.CommitRoastError, match="quota"):
        core.analyze_diff("+x", "p", api_key="k")


def test_schema_violation_moves_to_next_model(monkeypatch):
    fake_client(monkeypatch, lambda model, cfg: '{"roast":"x"}' if model == core.DEFAULT_MODELS[0] else GOOD)
    assert core.analyze_diff("+x", "p", api_key="k").model == core.DEFAULT_MODELS[1]


def test_find_persona_accepts_ids_and_names():
    assert core.find_persona("pirate") == "pirate"
    assert core.find_persona("Angry Chef") == "chef"
    assert core.find_persona("nonsense") == core.DEFAULT_PERSONA


def test_failed_model_is_skipped_next_time(monkeypatch):
    first = core.DEFAULT_MODELS[0]
    m = fake_client(monkeypatch, lambda model, cfg: err(429) if model == first else GOOD)
    core.analyze_diff("+x", "p", api_key="k")
    m.calls.clear()
    core.analyze_diff("+y", "p", api_key="k")
    assert m.calls[0][0] != first  # went straight to a working model


class SlowError(Exception):
    pass
SlowError.__name__ = "ReadTimeout"


def test_timeout_moves_to_next_model(monkeypatch):
    first = core.DEFAULT_MODELS[0]
    fake_client(monkeypatch, lambda model, cfg: SlowError("timed out") if model == first else GOOD)
    res = core.analyze_diff("+x", "p", api_key="k")
    assert res.model != first and core.cooling(first)


def test_gives_up_before_the_time_budget(monkeypatch):
    monkeypatch.setattr(core, "TOTAL_BUDGET_S", 0)
    fake_client(monkeypatch, lambda model, cfg: GOOD)
    with pytest.raises(core.CommitRoastError, match="out of time"):
        core.analyze_diff("+x", "p", api_key="k")


def test_preferred_model_goes_first():
    assert core.model_order("gemini-3.8-flash")[0] == "gemini-3.8-flash"
    assert core.DEFAULT_MODELS[0] == "gemini-3.5-flash-lite"

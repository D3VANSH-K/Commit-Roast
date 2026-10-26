"""
CommitRoast: web server (FastAPI).

It does two jobs:
  1. Answers the website's questions at /api/config and /api/roast
  2. Serves the website itself (the files in the static/ folder)

Run locally:   python app.py        then open http://localhost:8000
On Vercel:     found automatically (it looks for a FastAPI object called `app` in app.py)
"""

import hashlib
import os
import time
from collections import defaultdict, deque
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from core import MAX_DIFF_CHARS, PERSONAS, CommitRoastError, analyze_diff, find_persona
from samples import SAMPLES, demo_report, match_sample

load_dotenv()  # reads GEMINI_API_KEY from a local .env file, if there is one

ROASTS_PER_HOUR = 20       # per visitor, when they use the site's own key
CACHE_SECONDS = 60 * 60    # same diff + same reviewer within an hour = free repeat

app = FastAPI(title="CommitRoast", docs_url=None, redoc_url=None)


# ---------- request / response shapes (Pydantic again) ----------
class RoastRequest(BaseModel):
    diff: str = Field(min_length=1, max_length=200_000)
    persona: str = "staff"
    api_key: Optional[str] = Field(default=None, max_length=200)  # optional: visitor's own key


class RoastResponse(BaseModel):
    report: dict
    persona: str
    model: str
    truncated: bool
    demo: bool


# ---------- tiny in-memory helpers ----------
_hits: dict = defaultdict(deque)   # visitor ip -> times of recent roasts
_cache: dict = {}                  # (diff hash, persona) -> (time, response)


def server_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "").strip()


def visitor_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def roasts_left(ip: str) -> int:
    now, q = time.time(), _hits[ip]
    while q and now - q[0] > 3600:
        q.popleft()
    return max(0, ROASTS_PER_HOUR - len(q))


# ---------- API ----------
@app.get("/api/config")
def config(request: Request):
    """Everything the page needs to draw itself: reviewers, examples, and whether a key is set up."""
    personas = [{"id": pid, **{k: v for k, v in p.items() if k != "style"}} for pid, p in PERSONAS.items()]
    samples = [{"id": sid, **s} for sid, s in SAMPLES.items()]
    return {
        "server_key": bool(server_key()),
        "roasts_left": roasts_left(visitor_ip(request)),
        "max_diff_chars": MAX_DIFF_CHARS,
        "personas": personas,
        "samples": samples,
    }


@app.post("/api/roast", response_model=RoastResponse)
def roast(body: RoastRequest, request: Request, response: Response):
    persona = find_persona(body.persona)
    diff = body.diff.strip()
    own_key = (body.api_key or "").strip()
    key = own_key or server_key()

    # No key anywhere: built-in examples still work with pre-written reviews.
    if not key:
        sample = match_sample(diff)
        if not sample:
            raise HTTPException(400, "Your own diffs need a Gemini API key. Add one in Settings (it's free), or try an example.")
        return RoastResponse(report=demo_report(sample, persona).model_dump(), persona=persona,
                             model="demo", truncated=False, demo=True)

    cache_key = (hashlib.sha256(diff.encode()).hexdigest(), persona)
    hit = _cache.get(cache_key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]

    ip = visitor_ip(request)
    if not own_key:
        left = roasts_left(ip)
        if left == 0:
            raise HTTPException(429, "You've used this hour's free roasts. Add your own free Gemini key in Settings to keep going.")

    try:
        result = analyze_diff(diff, persona, api_key=key)
    except CommitRoastError as e:
        raise HTTPException(502, str(e))

    if not own_key:
        _hits[ip].append(time.time())
        response.headers["X-Roasts-Left"] = str(roasts_left(ip))

    out = RoastResponse(report=result.report.model_dump(), persona=persona,
                        model=result.model, truncated=result.truncated, demo=False)
    _cache[cache_key] = (time.time(), out)
    return out


# ---------- the website itself (must come AFTER the API routes) ----------
# (On Vercel these files are copied to its fast CDN automatically. The folder is called "static",
#  not "public", because Vercel reserves "public" for its own use.)
app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static"), html=True), name="site")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print(f"\n  CommitRoast is running → http://localhost:{port}\n")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)

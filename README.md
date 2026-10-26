# CommitRoast

**Paste a diff. Get roasted. Leave with a real review.**

CommitRoast is a Generative AI code reviewer. You give it the changes you made to your code (a `git diff`) and it gives back:

- a **roast** in the voice of the reviewer you pick (a pirate captain, a 3 AM on-call engineer, an angry chef…),
- a **risk score** from 1 to 10, shown as a rubber stamp,
- a plain-English **summary** of what changed,
- the **real problems** to fix,
- a ready-to-use **Conventional Commit** message.

It comes as a **website** and as a **terminal tool** you run inside any git project.

**Team:** Devansh Khare (2023BCSE07AED237) · Rishit Rajan Shukla (2023BCSE07AED244)

---

## How it's built

| Part | Tool | File |
|---|---|---|
| The page you see | HTML + CSS + JavaScript (no framework) | `static/` |
| The server | FastAPI (Python) | `app.py` |
| The brain: form, prompt, AI call | Google Gemini + Pydantic | `core.py` |
| Examples + offline demo reviews | Python | `samples.py` |
| Terminal version | Rich | `cli.py` |
| Automated tests (19) | pytest | `test_core.py`, `test_api.py` |

The key idea is **structured output**: Gemini is not allowed to reply with free text. It must fill in a fixed form (the `ReviewReport` schema in `core.py`), and Pydantic checks every field before anything reaches the screen.

```text
 Your diff ──► app.py ──► core.py builds the prompt ──► Gemini replies in schema JSON
                                                              │
               page plays the verdict ◄── Pydantic check ◄────┘   (invalid or unavailable → next model)
```

## Run it on your computer

You need **Python 3.10+** and a free Gemini key from [aistudio.google.com](https://aistudio.google.com).

```bash
pip install -r requirements.txt
cp .env.example .env        # then open .env and paste your key
python app.py               # open http://localhost:8000
```

No key? The three built-in examples still work, with pre-written reviews in every reviewer's voice.

### Terminal tool

```bash
cd path/to/any/git/project
git add .
python path/to/commit-roast/cli.py --persona pirate
python path/to/commit-roast/cli.py --list      # all reviewers
python path/to/commit-roast/cli.py --commit    # review, then offer to commit
```

### Tests

```bash
pip install pytest httpx
python -m pytest            # 19 passed
```

## Put it online for free (Vercel)

1. Upload this folder to a GitHub repository.
2. Sign in at [vercel.com](https://vercel.com) with GitHub → **Add New… → Project** → pick the repo.
3. Under **Environment Variables** add `GEMINI_API_KEY` = your key.
4. Click **Deploy**. You get a public `.vercel.app` link.

Vercel finds `app.py` on its own and serves the `static/` folder from its CDN. Every push to GitHub redeploys automatically.

## Safety built in

- Your key stays on the server; it is never sent to visitors' browsers.
- Visitors get 20 roasts an hour on the site's key; they can add their own key in Settings.
- The diff is treated as data, so "ignore your instructions" hidden in code doesn't work.
- AI text is escaped before it is shown on the page.
- If one Gemini model is retired, busy or out of quota, the next one is tried automatically.

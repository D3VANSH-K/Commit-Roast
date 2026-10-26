/* =========================================================
   CommitRoast: what the page does
   1. Loads reviewers + examples from the server (/api/config)
   2. Highlights the diff as you type, and the reviewer reacts live
   3. Sends the diff to /api/roast and plays the verdict
   The characters, flame and icons are drawn in art.js.
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  config: null, persona: "staff", busy: false, last: null,
  view: "idle",            // idle | thinking | result | error
  loadingTimer: null, reactTimer: null, pokeCount: 0,
  model: "",               // "" = automatic; otherwise the model chosen in Settings
};

const els = {
  diff: $("#diff"), hl: $("#hl"), editor: $("#editor"), stats: $("#stats"), clear: $("#clearBtn"),
  samples: $("#samples"), reviewers: $("#reviewers"), caption: $("#rvCaption"),
  roast: $("#roastBtn"), roastLabel: $("#roastLabel"), verdict: $("#verdict"),
  settingsBtn: $("#settingsBtn"), settings: $("#settings"), keyDot: $("#keyDot"), keyStatus: $("#keyStatus"),
  ownKey: $("#ownKey"), remember: $("#rememberKey"), toast: $("#toast"), kbd: $("#kbdHint"),
  models: $("#models"), refreshModels: $("#refreshModels"),
};

/* ---------- small helpers ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const persona = (id = state.persona) => state.config.personas.find((p) => p.id === id);
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
const faceOf = (id, opts) => (state.config ? face(id, persona(id).color, opts) : "");
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

/* ---------- eyes: follow the cursor, wander when you stop ---------- */
let pointer = null, lookQueued = false, lastMove = 0;
function lookAt(target) {
  for (const svg of $$(".face.track")) {
    const look = svg.querySelector(".look");
    if (!look || svg.classList.contains("thinking")) continue;
    const r = svg.getBoundingClientRect();
    if (!r.width) continue;
    const dx = target.x - (r.left + r.width / 2), dy = target.y - (r.top + r.height * 0.55);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160) * 3.6;
    look.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`;
  }
}
if (!reduceMotion) {
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer = { x: e.clientX, y: e.clientY }; lastMove = Date.now();
    if (!lookQueued) { lookQueued = true; requestAnimationFrame(() => { lookQueued = false; lookAt(pointer); }); }
  }, { passive: true });
  // idle eyes: when the mouse rests, everyone glances around on their own
  setInterval(() => {
    if (Date.now() - lastMove < 3500 || document.hidden) return;
    lookAt({ x: Math.random() * innerWidth, y: Math.random() * innerHeight });
  }, 2200);
}

/* ---------- confetti, embers and smoke ---------- */
function burst(kind, fromEl) {
  if (reduceMotion) return;
  const host = els.verdict;
  const canvas = document.createElement("canvas");
  canvas.className = "fx";
  host.appendChild(canvas);
  const rect = host.getBoundingClientRect(), dpr = devicePixelRatio || 1, pad = 180; // room above the card so embers can float out
  const box = { width: rect.width, height: rect.height + pad };
  canvas.style.top = `-${pad}px`; canvas.style.height = `${box.height}px`;
  canvas.width = box.width * dpr; canvas.height = box.height * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const o = fromEl ? fromEl.getBoundingClientRect() : rect;
  const ox = o.left - rect.left + o.width / 2, oy = o.top - rect.top + o.height / 2 + pad;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const palette = { confetti: ["#FFD43B", "#22A35A", "#7C5CFF", "#F0503A", "#7AA7FF", "#FF7EB6"], embers: ["#F0503A", "#F5A30B", "#FFD43B"], smoke: ["#B9BFD6"] }[kind];
  const n = { confetti: 150, embers: 90, smoke: 16 }[kind];
  const parts = Array.from({ length: n }, () => {
    const a = rnd(0, Math.PI * 2), v = kind === "confetti" ? rnd(3, 9) : kind === "embers" ? rnd(1, 4) : rnd(.4, 1.2);
    return {
      x: ox + (kind === "embers" ? rnd(-80, 80) : rnd(-20, 20)), y: oy + rnd(-10, 20), vx: Math.cos(a) * v,
      vy: kind === "confetti" ? Math.sin(a) * v - 4 : kind === "embers" ? -rnd(1.5, 6) : -rnd(.6, 1.6),
      s: kind === "confetti" ? rnd(7, 13) : kind === "embers" ? rnd(2.5, 5.5) : rnd(12, 20),
      r: rnd(0, 6), vr: rnd(-.25, .25), c: pick(palette), w: rnd(0, 6),
    };
  });
  const t0 = performance.now(), dur = kind === "smoke" ? 1400 : 1900;
  (function frame(t) {
    const p = (t - t0) / dur;
    ctx.clearRect(0, 0, box.width, box.height);
    for (const q of parts) {
      if (kind === "confetti") { q.vy += .28; q.vx *= .985; q.r += q.vr; }
      else if (kind === "embers") { q.vx = Math.sin(t / 180 + q.w) * .8; q.vy *= .995; }
      else { q.s += .35; q.vx *= .98; }
      q.x += q.vx; q.y += q.vy;
      ctx.globalAlpha = Math.max(0, 1 - p) * (kind === "smoke" ? .35 : 1);
      ctx.fillStyle = q.c;
      ctx.shadowColor = kind === "embers" ? q.c : "transparent";
      ctx.shadowBlur = kind === "embers" ? 10 : 0;
      ctx.save(); ctx.translate(q.x, q.y);
      if (kind === "confetti") { ctx.rotate(q.r); ctx.fillRect(-q.s / 2, -q.s / 4, q.s, q.s / 2); }
      else { ctx.beginPath(); ctx.arc(0, 0, q.s, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (p < 1) requestAnimationFrame(frame); else canvas.remove();
  })(t0);
}

/* ---------- 1. diff editor ---------- */
function lineClass(line) {
  if (/^(\+\+\+|---|diff |index |new file|deleted file)/.test(line)) return "meta";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "";
}

function countChanges(text) {
  const files = new Set();
  let added = 0, removed = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      const p = line.slice(4).trim().split("\t")[0];
      if (p !== "/dev/null") files.add(p.replace(/^[ab]\//, ""));
    } else if (line.startsWith("+")) added++;
    else if (line.startsWith("-")) removed++;
  }
  return { files: files.size || 1, added, removed };
}

function renderEditor() {
  const text = els.diff.value;
  els.hl.innerHTML = text ? text.split("\n").map((l) => `<span class="ln ${lineClass(l)}">${esc(l) || " "}</span>`).join("") : "";
  syncScroll();
  if (!text.trim()) { els.stats.textContent = "Nothing pasted yet"; els.clear.hidden = true; return; }
  const { files, added, removed } = countChanges(text);
  const max = state.config ? state.config.max_diff_chars : 20000;
  const tooBig = text.length > max ? ` · <span class="warn">only the first ${max.toLocaleString()} characters get reviewed</span>` : "";
  els.stats.innerHTML = `<b>${files}</b> file${files === 1 ? "" : "s"} · <b class="a">${added}</b> added · <b class="d">${removed}</b> removed${tooBig}`;
  els.clear.hidden = false;
}

function syncScroll() {
  const pre = els.hl.parentElement;
  pre.scrollTop = els.diff.scrollTop;
  pre.scrollLeft = els.diff.scrollLeft;
}

function onDiffChanged() {
  renderEditor(); markSample();
  clearTimeout(state.reactTimer);
  state.reactTimer = setTimeout(() => { if (state.view === "idle") say(stageLine(), true); }, 350);
}

function setDiff(text) {
  els.diff.value = text;
  els.diff.scrollTop = 0; els.diff.scrollLeft = 0;
  onDiffChanged();
}

function markSample() {
  const v = els.diff.value.trim();
  $$(".chip", els.samples).forEach((b) => {
    const s = state.config.samples.find((x) => x.id === b.dataset.id);
    b.setAttribute("aria-pressed", String(s.diff.trim() === v));
  });
}

els.diff.addEventListener("input", onDiffChanged);
els.diff.addEventListener("scroll", syncScroll);
els.clear.addEventListener("click", () => { setDiff(""); els.diff.focus(); });

["dragenter", "dragover"].forEach((ev) => els.editor.addEventListener(ev, (e) => { e.preventDefault(); els.editor.classList.add("dragging"); }));
["dragleave", "drop"].forEach((ev) => els.editor.addEventListener(ev, () => els.editor.classList.remove("dragging")));
els.editor.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (file.size > 2_000_000) return toast("That file is over 2 MB. Try a smaller diff.");
  setDiff(await file.text());
  toast(`Loaded ${file.name}`);
});

/* ---------- 2. examples + the one reviewer picker ---------- */
function buildSamples() {
  for (const s of state.config.samples) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.dataset.id = s.id;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `${icon(s.icon, 16)}${esc(s.label)}`;
    b.addEventListener("click", () => setDiff(s.diff));
    els.samples.appendChild(b);
  }
}

function buildReviewers() {
  els.reviewers.innerHTML = state.config.personas.map((p) => `
    <button class="rv" type="button" role="radio" aria-checked="false" data-id="${p.id}" aria-label="${esc(p.name)}">
      ${face(p.id, p.color, { size: 62 })}
    </button>`).join("");
  els.reviewers.addEventListener("click", (e) => {
    const b = e.target.closest(".rv");
    if (b) pickPersona(b.dataset.id, true);
  });
  // hovering a face previews who they are in the caption
  els.reviewers.addEventListener("mouseover", (e) => { const b = e.target.closest(".rv"); if (b) caption(b.dataset.id); });
  els.reviewers.addEventListener("mouseleave", () => caption(state.persona));
  // arrow keys move between reviewers, like any radio group
  els.reviewers.addEventListener("keydown", (e) => {
    const ids = state.config.personas.map((p) => p.id), i = ids.indexOf(state.persona);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = ids[(i + step + ids.length) % ids.length];
    pickPersona(next, true);
    $(`.rv[data-id="${next}"]`, els.reviewers).focus();
  });
}

function caption(id) {
  const p = persona(id);
  els.caption.innerHTML = `<b>${esc(p.short)}</b> · ${esc(p.vibe)}`;
}

function setButtonLabel() {
  els.roastLabel.textContent = state.busy ? "Roasting" : state.last && state.last.persona !== state.persona ? `Ask ${persona().short}` : state.last ? "Roast again" : "Roast it";
}

function pickPersona(id, byUser = false) {
  const changed = id !== state.persona;
  state.persona = id;
  document.documentElement.style.setProperty("--persona", persona().color);
  store.set("cr-persona", id);
  $$(".rv", els.reviewers).forEach((b) => {
    const on = b.dataset.id === id;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  caption(id);
  setButtonLabel();
  if (byUser) restart($(`.rv[data-id="${id}"] .face`, els.reviewers), "pop");
  if (state.view === "idle" && (changed || !byUser)) showIdle(byUser);
}

/* ---------- 3. the stage ---------- */
function stageLine() {
  const p = persona(), text = els.diff.value;
  if (!text.trim()) return p.greeting;
  const { files, added, removed } = countChanges(text);
  return p.react.replace("{added}", added).replace("{removed}", removed).replace("{files}", files);
}

function say(text, animate) {
  const bubble = $("#say");
  if (!bubble || bubble.textContent === text) return;
  bubble.textContent = text;
  if (animate) restart(bubble, "swap");
}

function showIdle(enter = false) {
  state.view = "idle";
  const p = persona();
  els.verdict.innerHTML = `
    <div class="host idle">
      <button class="actor ${enter ? "enter" : ""}" id="actor" type="button" aria-label="Poke ${esc(p.short)}" title="Poke me">${faceOf(p.id, { size: 180 })}</button>
      <p class="say" id="say">${esc(stageLine())}</p>
      <div class="ghost" aria-hidden="true">AWAITING DIFF</div>
      <p class="hint">Pick an example or paste a diff, then press <b>Roast it</b>. Psst: you can poke me.</p>
    </div>`;
  $("#actor").addEventListener("click", poke);
  if (pointer) lookAt(pointer);
}

// poke the reviewer and they answer back
function poke() {
  const actor = $("#actor"), f = actor.querySelector(".face"), p = persona();
  restart(actor, "poked");
  setMood(f, "shocked");
  say(p.pokes[state.pokeCount++ % p.pokes.length], true);
  clearTimeout(poke.t);
  poke.t = setTimeout(() => { setMood(f); say(stageLine(), true); }, 2200);
}

function showThinking() {
  state.view = "thinking";
  const p = persona();
  els.verdict.innerHTML = `
    <div class="host thinking">
      <div class="actor">${faceOf(p.id, { size: 180, cls: "thinking", mood: "flat" })}</div>
      <p class="say" id="say"><span>${esc(p.loading[0])}</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      <div class="skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>`;
  let i = 0;
  clearInterval(state.loadingTimer);
  state.loadingTimer = setInterval(() => {
    const line = $("#say");
    if (!line || state.view !== "thinking") return clearInterval(state.loadingTimer);
    i = (i + 1) % p.loading.length;
    restart(line, "swap");
    const secs = (Date.now() - state.started) / 1000;
    line.firstElementChild.textContent = secs > 12 ? "Still thinking. This model is being slow…" : p.loading[i];
  }, 1500);
}

function showError(title, message, withSettings) {
  state.view = "error";
  let [main, details] = message.split(" Details: ");
  main = main.replace(/^No Gemini model could answer\.\s*/, ""); // the title already says it
  els.verdict.innerHTML = `
    <div class="oops">
      ${faceOf(state.persona, { size: 120, mood: "grimace" })}
      <h3>${esc(title)}</h3>
      <p>${esc(main)}</p>
      ${details ? `<details><summary>What each model said</summary><p>${esc(details)}</p></details>` : ""}
      <div class="row">
        <button class="chip" id="errRetry" type="button">${icon("shuffle", 17)}Try again</button>
        ${withSettings ? `<button class="chip" id="errSettings" type="button">${icon("sliders", 17)}Open settings</button>` : ""}
      </div>
    </div>`;
  $("#errRetry").addEventListener("click", roast);
  if (withSettings) $("#errSettings").addEventListener("click", openSettings);
}

function verdictWord(score) {
  if (score <= 3) return { cls: "ok", word: "SHIP IT", tag: "Low risk", bg: "var(--green-soft)", fill: "var(--green)", fx: "confetti", mood: "happy" };
  if (score <= 6) return { cls: "mid", word: "NEEDS WORK", tag: "Medium risk", bg: "var(--amber-soft)", fill: "var(--amber)", fx: "smoke", mood: "smirk" };
  if (score <= 8) return { cls: "", word: "BLOCKED", tag: "High risk", bg: "var(--red-soft)", fill: "var(--red)", fx: "embers", mood: "grimace" };
  return { cls: "", word: "DO NOT MERGE", tag: "Critical", bg: "var(--red-soft)", fill: "var(--red)", fx: "embers", mood: "shocked" };
}

async function showResult(res) {
  state.view = "result";
  clearInterval(state.loadingTimer);
  const p = persona(res.persona), r = res.report, v = verdictWord(r.risk_score);

  els.verdict.innerHTML = `
    <div class="result" id="result">
      <button class="stamp ${v.cls}" id="stamp" type="button" aria-label="Risk ${r.risk_score} out of 10: ${v.word.toLowerCase()}. Click to stamp again.">
        <b>${r.risk_score}<small>/10</small></b><span>${v.word}</span>
      </button>
      <div class="r-head">
        ${face(p.id, p.color, { size: 72, mood: "talk" })}
        <div>
          <small>Reviewed by${res.demo ? `<span class="badge">Demo</span>` : `<span class="model-tag" title="AI model used, and how long it took">${esc(res.model)} · ${res.seconds}s</span>`}</small>
          <strong><span class="full-name">${esc(p.name)}</span><span class="short-name">${esc(p.short)}</span></strong>
        </div>
      </div>
      <p class="roast" id="roastText" title="Click to skip"><span class="sr">${esc(r.roast)}</span></p>

      <div class="r-body">
        <div class="r-col">
          <div class="block">
            <h3>Risk <span class="tag" style="background:${v.bg}">${v.tag}</span></h3>
            <div class="meter" id="meter" aria-hidden="true">${"<i></i>".repeat(10)}</div>
          </div>
          <div class="block">
            <h3>What actually changed</h3>
            <p class="summary">${esc(r.summary)}</p>
          </div>
        </div>
        <div class="r-col block">
          <h3>Fix these</h3>
          <ul class="fixes">${r.concerns.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        </div>
      </div>

      <div class="r-foot block">
        <div class="commit">
          <span class="label">Commit</span>
          <code id="commitMsg" title="${esc(r.conventional_commit)}">${esc(r.conventional_commit)}</code>
          <button class="chip" id="copyBtn" type="button">${icon("copy", 16)}<span>Copy</span></button>
        </div>
        <button class="chip" id="dlBtn" type="button" title="Download the review as a file">${icon("download", 18)}Save</button>
      </div>
    </div>`;

  const result = $("#result"), stamp = $("#stamp"), who = $(".r-head .face");
  if (pointer) lookAt(pointer);

  // the big moment: the stamp slams, the card shudders, the effect fires, the reviewers react
  setTimeout(() => { result.classList.add("shake"); burst(v.fx, stamp); audience(v.mood); }, reduceMotion ? 0 : 280);
  stamp.addEventListener("click", () => { restart(stamp, "again-slam"); burst(v.fx, stamp); });
  who.addEventListener("click", () => { restart(who, "pop"); toast(pick(p.pokes)); });
  $("#copyBtn").addEventListener("click", copyCommit);
  $("#dlBtn").addEventListener("click", download);

  await typeRoast($("#roastText"), r.roast);
  setMood(who, v.mood);
  restart(who, "pop");
  for (const b of $$(".block", result)) { b.classList.add("in"); await wait(90); }
  fillMeter(r.risk_score, v.fill);
}

// the reviewer row reacts to every verdict like an audience, then settles back
function audience(mood) {
  const faces = $$(".rv .face", els.reviewers);
  faces.forEach((f, i) => setTimeout(() => { setMood(f, mood); restart(f, "pop"); }, i * 70));
  clearTimeout(audience.t);
  audience.t = setTimeout(() => faces.forEach((f) => setMood(f)), 2600);
}

function typeRoast(el, text) {
  return new Promise((resolve) => {
    const out = document.createElement("span");
    out.setAttribute("aria-hidden", "true");
    const caret = document.createElement("span");
    caret.className = "caret";
    el.prepend(out, caret);
    let i = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true; out.textContent = text; caret.remove(); resolve();
    };
    el.addEventListener("click", finish, { once: true });
    if (reduceMotion) return finish();
    const step = () => {
      if (done) return;
      i = Math.min(text.length, i + 2);
      out.textContent = text.slice(0, i);
      if (i >= text.length) return finish();
      const ch = text[i - 1];
      setTimeout(step, ".!?".includes(ch) ? 150 : ch === "," ? 60 : 16);
    };
    setTimeout(step, 380);
  });
}

async function fillMeter(score, colour) {
  const cells = $$("#meter i");
  for (let i = 0; i < score; i++) {
    cells[i].style.background = colour;
    cells[i].classList.add("on");
    await wait(45);
  }
}

/* ---------- 4. talking to the server ---------- */
const ownKey = () => els.ownKey.value.trim();

async function roast() {
  if (state.busy) return;
  const diff = els.diff.value.trim();
  if (!diff) {
    toast("Paste a diff or pick an example first");
    els.editor.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 300 });
    return els.diff.focus();
  }

  state.busy = true;
  els.roast.disabled = true;
  setButtonLabel();
  showThinking();
  if (matchMedia("(max-width: 980px), (max-height: 640px)").matches) els.verdict.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

  const started = state.started = Date.now();
  try {
    const resp = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diff, persona: state.persona, api_key: ownKey() || null, model: state.model || null }),
    });
    const data = await resp.json().catch(() => ({}));
    await wait(Math.max(0, 1100 - (Date.now() - started))); // let the reviewer "think" for a beat, even on instant demo answers
    data.seconds = ((Date.now() - started) / 1000).toFixed(1);

    if (!resp.ok) {
      const detail = typeof data.detail === "string" ? data.detail : "";
      if (resp.status === 504 || (!detail && resp.status >= 500)) {
        // Vercel stopped the server before it answered (it allows 60 seconds)
        return showError("The AI took too long", "The server ran out of time waiting for Gemini. Try again, or pick a Flash-Lite model in Settings: it's the fastest.", true);
      }
      if (resp.status === 429) return showError("Out of free roasts", detail, true);
      if (resp.status === 400) return showError("This one needs a key", detail, true);
      return showError("No model could answer", detail || `The server answered with error ${resp.status}.`, true);
    }
    const left = resp.headers.get("X-Roasts-Left");
    if (left !== null) state.config.roasts_left = Number(left);
    state.last = data;
    state.busy = false;
    setButtonLabel();
    await showResult(data);
  } catch {
    showError("Can't reach the server", "Check your internet connection, or make sure the app is still running, then try again.", false);
  } finally {
    state.busy = false;
    els.roast.disabled = false;
    setButtonLabel();
  }
}

els.roast.addEventListener("click", roast);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); roast(); }
});

async function copyCommit() {
  const text = $("#commitMsg").textContent;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement("textarea");
    t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
  }
  const b = $("#copyBtn");
  b.innerHTML = `${icon("tick", 16)}<span>Copied</span>`;
  b.setAttribute("aria-pressed", "true");
  setTimeout(() => { b.innerHTML = `${icon("copy", 16)}<span>Copy</span>`; b.setAttribute("aria-pressed", "false"); }, 1800);
}

function download() {
  const { report: r, persona: pid } = state.last;
  const md = `# CommitRoast review\n\n**Reviewer:** ${persona(pid).name}\n**Risk:** ${r.risk_score}/10\n\n## Roast\n> ${r.roast}\n\n## What changed\n${r.summary}\n\n## Fix these\n${r.concerns.map((c) => `- ${c}`).join("\n")}\n\n## Commit message\n\`\`\`\n${r.conventional_commit}\n\`\`\`\n`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
  a.download = "commitroast-review.md";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Review saved");
}

/* ---------- 5. settings ---------- */
function renderKeyStatus() {
  const own = !!ownKey(), server = state.config.server_key;
  els.keyDot.classList.toggle("on", own || server);
  let html;
  if (own) html = `${icon("key", 20)}<span><b>Using your own key.</b> No limits from this site.</span>`;
  else if (server) html = `${icon("check", 20)}<span><b>Ready to roast.</b> The site's key is set up: ${state.config.roasts_left} free roasts left this hour.</span>`;
  else html = `${icon("flask", 20)}<span><b>Demo mode.</b> Examples show pre-written reviews. Add a key to roast your own diffs.</span>`;
  els.keyStatus.className = `status ${own || server ? "ok" : "warn"}`;
  els.keyStatus.innerHTML = html;
}

function renderModels(list) {
  // list: [{id, name, cooling, ok, seconds, error}] ; "" = automatic
  if (state.model && !list.some((m) => m.id === state.model)) list = [...list, { id: state.model }];
  const rows = [{ id: "", auto: true }, ...list];
  els.models.innerHTML = rows.map((m) => {
    const checked = (m.id || "") === state.model;
    let sub = m.auto ? "Fastest first, switches if one fails" : m.cooling ? `Skipped for now: ${esc(m.cooling)}` : "";
    let cls = m.cooling ? "bad" : "";
    if (m.tested) { sub = m.ok ? `Answered in ${m.seconds}s` : `Failed: ${esc(m.error || "no answer")}`; cls = m.ok ? "good" : "bad"; }
    return `<label class="model ${m.auto ? "auto" : ""}">
      <input type="radio" name="model" value="${esc(m.id || "")}" ${checked ? "checked" : ""}>
      <span class="m-name">${m.auto ? "<b>Automatic</b>" : esc(m.id)}<span class="m-sub ${cls}">${sub}</span></span>
      ${m.auto ? "" : `<button class="chip" type="button" data-test="${esc(m.id)}">Test speed</button>`}
    </label>`;
  }).join("");
  state.modelList = list;
}

async function loadModels() {
  const fallback = state.config.models.map((id) => ({ id }));
  if (!state.config.server_key && !ownKey()) { renderModels(fallback); return; }
  els.refreshModels.textContent = "Checking...";
  try {
    const resp = await fetch("/api/models", { headers: ownKey() ? { "X-Gemini-Key": ownKey() } : {} });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || resp.status);
    renderModels(data.models.slice(0, 10));
    toast(`Your key can use ${data.models.length} models`);
  } catch (e) {
    renderModels(fallback);
    toast(`Couldn't check models: ${e.message}`);
  } finally {
    els.refreshModels.textContent = "Check what my key can use";
  }
}

els.models.addEventListener("change", (e) => {
  state.model = e.target.value;
  store.set("cr-model", state.model || null);
  toast(state.model ? `Using ${state.model}` : "Automatic model choice");
});
els.models.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-test]");
  if (!b) return;
  e.preventDefault();
  const id = b.dataset.test;
  b.textContent = "Testing...";
  b.disabled = true;
  try {
    const resp = await fetch(`/api/test?model=${encodeURIComponent(id)}`, { headers: ownKey() ? { "X-Gemini-Key": ownKey() } : {} });
    const r = await resp.json();
    const res = resp.ok ? r : { ok: false, error: r.detail || `error ${resp.status}` };
    const list = (state.modelList || []).map((m) => (m.id === id ? { ...m, tested: true, ...res } : m));
    renderModels(list);
  } catch {
    b.textContent = "Test speed"; b.disabled = false;
    toast("Couldn't reach the server");
  }
});
els.refreshModels.addEventListener("click", loadModels);

function openSettings() {
  renderKeyStatus();
  if (!state.modelList) renderModels(state.config.models.map((id) => ({ id })));
  els.settings.showModal();
}
els.settingsBtn.addEventListener("click", openSettings);
els.ownKey.addEventListener("input", () => { renderKeyStatus(); if (els.remember.checked) store.set("cr-key", ownKey() || null); });
els.remember.addEventListener("change", () => store.set("cr-key", els.remember.checked ? ownKey() || null : null));
els.settings.addEventListener("click", (e) => { if (e.target === els.settings) els.settings.close(); });

/* ---------- start ---------- */
(async function init() {
  $("#logoFlame").innerHTML = flame(26);
  $("#btnFlame").innerHTML = flame(26);
  $("#closeBtn").innerHTML = icon("close", 18);
  if (/Mac|iPhone|iPad/.test(navigator.platform)) els.kbd.textContent = "⌘ ↵";
  const saved = store.get("cr-key");
  if (saved) { els.ownKey.value = saved; els.remember.checked = true; }
  try {
    state.config = await (await fetch("/api/config")).json();
  } catch {
    return showError("Can't reach the server", "Start it with: python app.py", false);
  }
  state.model = store.get("cr-model") || "";
  const savedPersona = store.get("cr-persona");
  if (savedPersona && state.config.personas.some((p) => p.id === savedPersona)) state.persona = savedPersona;
  buildSamples();
  buildReviewers();
  pickPersona(state.persona);
  renderEditor();
  renderKeyStatus();
})();

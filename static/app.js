/* =========================================================
   CommitRoast: what the page does
   1. Loads reviewers + examples from the server (/api/config)
   2. Highlights the diff as you type and counts the changes
   3. Sends the diff to /api/roast and plays the verdict
   The characters, flame and icons come from art.js.
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = { config: null, persona: "staff", busy: false, last: null, loadingTimer: null };

const els = {
  diff: $("#diff"), hl: $("#hl"), editor: $("#editor"), stats: $("#stats"), clear: $("#clearBtn"),
  samples: $("#samples"), personas: $("#personas"), parade: $("#parade"), roast: $("#roastBtn"), verdict: $("#verdict"),
  settingsBtn: $("#settingsBtn"), settings: $("#settings"), keyDot: $("#keyDot"), keyStatus: $("#keyStatus"),
  ownKey: $("#ownKey"), remember: $("#rememberKey"), toast: $("#toast"), kbd: $("#kbdHint"),
};

/* ---------- small helpers ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const persona = (id = state.persona) => state.config.personas.find((p) => p.id === id);
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
const faceOf = (id, opts) => (state.config ? face(id, persona(id).color, opts) : "");

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

/* ---------- eyes that follow the cursor ---------- */
let pointer = null, lookQueued = false;
function updateLooks() {
  lookQueued = false;
  if (!pointer) return;
  for (const svg of $$(".face.track")) {
    const look = svg.querySelector(".look");
    if (!look || svg.classList.contains("thinking")) continue;
    const r = svg.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height * 0.55);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160) * 3.6;
    look.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`;
  }
}
if (!reduceMotion) {
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer = { x: e.clientX, y: e.clientY };
    if (!lookQueued) { lookQueued = true; requestAnimationFrame(updateLooks); }
  }, { passive: true });
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
      x: ox + (kind === "embers" ? rnd(-80, 80) : rnd(-20, 20)), y: oy + rnd(-10, 20), vx: Math.cos(a) * v, vy: kind === "confetti" ? Math.sin(a) * v - 4 : kind === "embers" ? -rnd(1.5, 6) : -rnd(.6, 1.6),
      s: kind === "confetti" ? rnd(7, 13) : kind === "embers" ? rnd(2.5, 5.5) : rnd(12, 20),
      r: rnd(0, 6), vr: rnd(-.25, .25), c: palette[Math.floor(Math.random() * palette.length)], w: rnd(0, 6),
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
  return { files: files.size, added, removed };
}

function renderEditor() {
  const text = els.diff.value;
  els.hl.innerHTML = text ? text.split("\n").map((l) => `<span class="ln ${lineClass(l)}">${esc(l) || " "}</span>`).join("") : "";
  syncScroll();
  if (!text.trim()) { els.stats.textContent = "Nothing pasted yet"; els.clear.hidden = true; return; }
  const { files, added, removed } = countChanges(text);
  const f = files || 1;
  const max = state.config ? state.config.max_diff_chars : 20000;
  const tooBig = text.length > max ? ` · <span class="warn">only the first ${max.toLocaleString()} characters get reviewed</span>` : "";
  els.stats.innerHTML = `<b>${f}</b> file${f === 1 ? "" : "s"} · <b class="a">${added}</b> added · <b class="d">${removed}</b> removed${tooBig}`;
  els.clear.hidden = false;
}

function syncScroll() {
  const pre = els.hl.parentElement;
  pre.scrollTop = els.diff.scrollTop;
  pre.scrollLeft = els.diff.scrollLeft;
}

function setDiff(text) {
  els.diff.value = text;
  els.diff.scrollTop = 0; els.diff.scrollLeft = 0;
  renderEditor(); markSample();
}

function markSample() {
  const v = els.diff.value.trim();
  $$(".chip", els.samples).forEach((b) => {
    const s = state.config.samples.find((x) => x.id === b.dataset.id);
    b.setAttribute("aria-pressed", String(s.diff.trim() === v));
  });
}

els.diff.addEventListener("input", () => { renderEditor(); markSample(); });
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

/* ---------- 2. examples + reviewers ---------- */
function buildSamples() {
  for (const s of state.config.samples) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.dataset.id = s.id;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `${icon(s.icon, 17)}${esc(s.label)}`;
    b.addEventListener("click", () => setDiff(s.diff));
    els.samples.appendChild(b);
  }
}

function buildPersonas() {
  els.personas.innerHTML = state.config.personas.map((p) => `
    <div class="persona" style="--c:${p.color}">
      <input type="radio" name="persona" id="p-${p.id}" value="${p.id}" ${p.id === state.persona ? "checked" : ""}>
      <label for="p-${p.id}" title="${esc(p.name)}">
        ${face(p.id, p.color, { size: 60 })}
        <span class="name">${esc(p.short)}</span>
        <span class="vibe">${esc(p.vibe)}</span>
      </label>
    </div>`).join("");
  els.personas.addEventListener("change", (e) => pickPersona(e.target.value));

  els.parade.innerHTML = state.config.personas.map((p, i) => `
    <button type="button" data-id="${p.id}" aria-pressed="false" aria-label="Pick ${esc(p.short)}" title="${esc(p.short)}" style="--d:${(i * 0.35).toFixed(2)}s">
      ${face(p.id, p.color, { size: 76 })}
    </button>`).join("");
  els.parade.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (!b) return;
    pickPersona(b.dataset.id);
    const f = b.querySelector(".face");
    f.classList.remove("pop"); void f.offsetWidth; f.classList.add("pop");
  });
}

function pickPersona(id) {
  state.persona = id;
  document.documentElement.style.setProperty("--persona", persona().color);
  store.set("cr-persona", id);
  const radio = $(`#p-${id}`);
  if (radio && !radio.checked) radio.checked = true;
  $$("button", els.parade).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
  if (!state.busy && !state.last) showIdle(true);
}

/* ---------- 3. verdict states ---------- */
function showIdle(swap = false) {
  const p = persona();
  els.verdict.innerHTML = `
    <div class="stage"><div class="host idle">
      ${faceOf(p.id, { size: 128 })}
      <p class="say ${swap ? "swap" : ""}">${esc(p.greeting)}</p>
      <div class="ghost" aria-hidden="true">AWAITING DIFF</div>
      <p class="hint">Pick an example or paste a diff, then press <b>Roast it</b>.</p>
    </div></div>`;
  updateLooks();
}

function showThinking() {
  const p = persona();
  els.verdict.innerHTML = `
    <div class="stage"><div class="host thinking">
      ${faceOf(p.id, { size: 128, cls: "thinking", mood: "flat" })}
      <p class="say" id="loadingLine"><span>${esc(p.loading[0])}</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      <div class="skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
    </div></div>`;
  let i = 0;
  clearInterval(state.loadingTimer);
  state.loadingTimer = setInterval(() => {
    const line = $("#loadingLine");
    if (!line) return clearInterval(state.loadingTimer);
    i = (i + 1) % p.loading.length;
    line.classList.remove("swap"); void line.offsetWidth; line.classList.add("swap");
    line.firstElementChild.textContent = p.loading[i];
  }, 1500);
}

function showError(title, message, withSettings) {
  els.verdict.innerHTML = `
    <div class="oops">
      ${faceOf(state.persona, { size: 104, mood: "grimace" })}
      <h3>${esc(title)}</h3>
      <p>${esc(message)}</p>
      ${withSettings ? `<button class="chip" id="errSettings" type="button">${icon("sliders", 17)}Open settings</button>` : ""}
    </div>`;
  if (withSettings) $("#errSettings").addEventListener("click", openSettings);
  updateLooks();
}

function verdictWord(score) {
  if (score <= 3) return { cls: "ok", word: "SHIP IT", tag: "Low risk", bg: "var(--green-soft)", fill: "var(--green)", fx: "confetti", mood: "happy" };
  if (score <= 6) return { cls: "mid", word: "NEEDS WORK", tag: "Medium risk", bg: "var(--amber-soft)", fill: "var(--amber)", fx: "smoke", mood: "smirk" };
  if (score <= 8) return { cls: "", word: "BLOCKED", tag: "High risk", bg: "var(--red-soft)", fill: "var(--red)", fx: "embers", mood: "grimace" };
  return { cls: "", word: "DO NOT MERGE", tag: "Critical", bg: "var(--red-soft)", fill: "var(--red)", fx: "embers", mood: "shocked" };
}

async function showResult(res) {
  clearInterval(state.loadingTimer);
  const p = persona(res.persona);
  const r = res.report;
  const v = verdictWord(r.risk_score);
  const others = state.config.personas.filter((x) => x.id !== p.id);

  els.verdict.innerHTML = `
    <div class="result" id="result">
      <button class="stamp ${v.cls}" id="stamp" type="button" aria-label="Risk ${r.risk_score} out of 10: ${v.word.toLowerCase()}. Click to stamp again.">
        <b>${r.risk_score}<small>/10</small></b><span>${v.word}</span>
      </button>
      <div class="who">
        ${face(p.id, p.color, { size: 68, mood: "talk" })}
        <div><small>Reviewed by</small><strong><span class="full-name">${esc(p.name)}</span><span class="short-name">${esc(p.short)}</span></strong></div>
      </div>
      <p class="roast" id="roastText" title="Click to skip"><span class="sr">${esc(r.roast)}</span></p>

      <div class="block">
        <h3>Risk <span class="tag" style="background:${v.bg}">${v.tag}</span></h3>
        <div class="meter" id="meter" aria-hidden="true">${"<i></i>".repeat(10)}</div>
      </div>
      <div class="block">
        <h3>What actually changed</h3>
        <p class="summary">${esc(r.summary)}</p>
      </div>
      <div class="block">
        <h3>Fix these</h3>
        <ul class="fixes">${r.concerns.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      </div>
      <div class="block">
        <h3>Commit message</h3>
        <div class="commit">
          <code id="commitMsg">${esc(r.conventional_commit)}</code>
          <button class="chip" id="copyBtn" type="button">${icon("copy", 16)}<span>Copy</span></button>
        </div>
      </div>
      <div class="block again">
        <div class="again-who">
          <span>Second opinion?</span>
          <div class="minis">${others.map((o) => `<button class="mini" type="button" data-id="${o.id}" title="Roast again as ${esc(o.short)}" aria-label="Roast again as ${esc(o.short)}">${face(o.id, o.color, { size: 44 })}</button>`).join("")}</div>
        </div>
        <button class="chip" id="dlBtn" type="button">${icon("download", 16)}Download review</button>
      </div>
      <p class="block note">${res.demo ? `<span class="badge">Demo</span>Pre-written review: no API key is set up.` : `Reviewed by ${esc(res.model)}${res.truncated ? ". Large diff: first 20,000 characters only." : ""}`}</p>
    </div>`;

  const result = $("#result"), stamp = $("#stamp"), who = $(".who .face");
  updateLooks();

  // the big moment: the stamp slams, the card shudders, the effect fires, the reviewer talks
  setTimeout(() => { result.classList.add("shake"); burst(v.fx, stamp); audience(v.mood); }, reduceMotion ? 0 : 280);
  stamp.addEventListener("click", () => {
    stamp.classList.remove("again-slam"); void stamp.offsetWidth; stamp.classList.add("again-slam");
    burst(v.fx, stamp);
  });
  $("#copyBtn").addEventListener("click", copyCommit);
  $("#dlBtn").addEventListener("click", download);
  $$(".mini", result).forEach((b) => b.addEventListener("click", () => { pickPersona(b.dataset.id); roast(); }));

  await typeRoast($("#roastText"), r.roast);
  setMood(who, v.mood);
  who.classList.add("pop");
  for (const b of $$(".block", result)) { b.classList.add("in"); await wait(90); }
  fillMeter(r.risk_score, v.fill);
}

// the six faces by the headline react to every verdict, then settle back
function audience(mood) {
  const faces = $$(".face", els.parade);
  faces.forEach((f, i) => setTimeout(() => { setMood(f, mood); f.classList.remove("pop"); void f.offsetWidth; f.classList.add("pop"); }, i * 70));
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
      done = true;
      out.textContent = text;
      caret.remove();
      resolve();
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
  $(".roast-label", els.roast).textContent = "Roasting";
  showThinking();
  if (matchMedia("(max-width: 960px)").matches) els.verdict.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

  const started = Date.now();
  try {
    const resp = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diff, persona: state.persona, api_key: ownKey() || null }),
    });
    const data = await resp.json().catch(() => ({}));
    await wait(Math.max(0, 1100 - (Date.now() - started))); // let the reviewer "think" for a beat, even on instant demo answers

    if (!resp.ok) {
      const msg = typeof data.detail === "string" ? data.detail : "The server couldn't review that. Try again in a moment.";
      const needsKey = resp.status === 400 || resp.status === 429 || /key/i.test(msg);
      showError(resp.status === 429 ? "Out of free roasts" : needsKey ? "This one needs a key" : "That didn't work", msg, needsKey);
      return;
    }
    const left = resp.headers.get("X-Roasts-Left");
    if (left !== null) state.config.roasts_left = Number(left);
    state.last = data;
    await showResult(data);
  } catch {
    showError("Can't reach the server", "Check your internet connection, or make sure the app is still running, then try again.", false);
  } finally {
    state.busy = false;
    els.roast.disabled = false;
    $(".roast-label", els.roast).textContent = "Roast it";
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
  toast("Review downloaded");
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

function openSettings() { renderKeyStatus(); els.settings.showModal(); }
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
  const savedPersona = store.get("cr-persona");
  if (savedPersona && state.config.personas.some((p) => p.id === savedPersona)) state.persona = savedPersona;
  buildSamples();
  buildPersonas();
  pickPersona(state.persona);
  renderEditor();
  renderKeyStatus();
  showIdle();
})();

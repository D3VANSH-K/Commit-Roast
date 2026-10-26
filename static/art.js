/* =========================================================
   CommitRoast art: hand-drawn SVG characters, flame and icons.
   No images, no emoji: everything is drawn in code so it can
   blink, look at your cursor, talk and change expression.
   ========================================================= */
const INK = "#14172B";

/* ---------- mouths (one per expression) ---------- */
const MOUTHS = {
  smirk:   `<path d="M48 86 Q58 93 71 82" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  flat:    `<path d="M50 87 L70 87" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  happy:   `<path d="M46 82 Q60 99 74 82 Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M53 90 Q60 95 67 90 Q60 92 53 90Z" fill="#FF7E9A"/>`,
  shocked: `<ellipse cx="60" cy="88" rx="6.5" ry="8.5" fill="${INK}"/>`,
  grimace: `<rect x="46" y="81" width="28" height="12" rx="4" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M46 87 H74 M53 81 V93 M60 81 V93 M67 81 V93" stroke="${INK}" stroke-width="2"/>`,
  talk:    `<ellipse class="jaw" cx="60" cy="87" rx="8" ry="6" fill="${INK}"/>`,
};

/* ---------- shared parts ---------- */
const eyeWhites = (ry = 8.5) =>
  `<ellipse cx="47" cy="64" rx="8.5" ry="${ry}" fill="#fff" stroke="${INK}" stroke-width="3"/>
   <ellipse cx="73" cy="64" rx="8.5" ry="${ry}" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
const pupils = (r = 4) => `<g class="look"><circle cx="47" cy="64" r="${r}" fill="${INK}"/><circle cx="73" cy="64" r="${r}" fill="${INK}"/></g>`;
const cheeks = `<circle cx="37" cy="79" r="5" fill="#FF7E9A" opacity=".35"/><circle cx="83" cy="79" r="5" fill="#FF7E9A" opacity=".35"/>`;

/* ---------- the six reviewers ---------- */
const CHARACTERS = {
  staff: {
    mood: "smirk",
    under: (c) => ``,
    eyes: () => eyeWhites() + pupils(),
    over: (c) => `
      <path d="M30 58 Q30 30 60 29 Q90 30 91 54 Q76 40 58 42 Q40 44 30 58Z" fill="${INK}"/>
      <path d="M38 51 Q46 42 55 48" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <path d="M66 50 L81 49" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="73" cy="64" r="12.5" fill="#fff" fill-opacity=".25" stroke="${INK}" stroke-width="3.5"/>
      <path d="M85 68 Q95 86 88 102" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3"/>`,
  },
  pirate: {
    mood: "smirk",
    under: () => ``,
    eyes: () => eyeWhites() + pupils(),
    over: () => `
      <circle cx="47" cy="64" r="11" fill="${INK}"/>
      <path d="M38 57 L26 49 M56 59 L95 50" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <path d="M16 50 Q60 4 104 50 Q60 34 16 50Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M24 46 Q60 28 96 46" fill="none" stroke="#FFD43B" stroke-width="4" stroke-linecap="round"/>
      <circle cx="60" cy="27" r="4.5" fill="#fff"/>
      <path d="M44 96 l2 0 M52 99 l2 0 M66 99 l2 0 M74 96 l2 0" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>`,
  },
  chef: {
    mood: "flat",
    mouthY: 5,
    under: () => ``,
    eyes: () => eyeWhites() + pupils(),
    over: () => `
      <path d="M37 52 L55 58 M83 52 L65 58" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M46 79 Q53 73 60 78 Q67 73 74 79 Q67 84 60 80 Q53 84 46 79Z" fill="${INK}"/>
      <rect x="36" y="32" width="48" height="14" rx="3" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
      <path d="M40 33 C24 30 28 10 44 15 C46 2 74 2 76 15 C92 10 96 30 80 33 Z" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M52 22 V30 M68 22 V30" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".35"/>`,
  },
  sre: {
    mood: "flat",
    under: () => `<path d="M24 66 Q24 24 60 24 Q96 24 96 66" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    eyes: (c) => eyeWhites() + pupils() + `
      <path d="M38.5 64 A8.5 8.5 0 0 1 55.5 64 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M64.5 64 A8.5 8.5 0 0 1 81.5 64 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
    over: () => `
      <path d="M40 76 Q47 80 54 76 M66 76 Q73 80 80 76" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".45"/>
      <path d="M50 33 L54 22 L58 33 L62 20 L66 33" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <rect x="17" y="58" width="11" height="19" rx="4" fill="${INK}"/><rect x="92" y="58" width="11" height="19" rx="4" fill="${INK}"/>
      <path d="M23 77 Q27 95 45 94" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="47" cy="94" r="3.5" fill="${INK}"/>`,
  },
  genz: {
    mood: "smirk",
    under: () => ``,
    eyes: () => `
      <rect x="33" y="56" width="25" height="16" rx="7" fill="${INK}"/><rect x="62" y="56" width="25" height="16" rx="7" fill="${INK}"/>
      <path d="M58 61 H62 M33 61 L25 58 M87 61 L95 58" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <g class="look"><path d="M38 60 L45 60 M67 60 L74 60" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".85"/></g>`,
    over: () => `
      <path d="M26 52 Q27 22 60 22 Q93 22 94 52 Q60 42 26 52Z" fill="#FFD43B" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M60 23 V44" stroke="${INK}" stroke-width="2" opacity=".35"/><circle cx="60" cy="22" r="3.5" fill="${INK}"/>
      <circle cx="26" cy="83" r="3" fill="none" stroke="#FFD43B" stroke-width="2.5"/>`,
  },
  auditor: {
    mood: "flat",
    under: () => ``,
    eyes: () => eyeWhites(5) + pupils(3.5),
    over: () => `
      <path d="M38 55 L55 58 M82 55 L65 58" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="60" cy="42" rx="45" ry="8" fill="${INK}"/>
      <path d="M36 42 Q35 14 60 17 Q85 14 84 42Z" fill="${INK}"/>
      <path d="M37 34 H83 V40 H37Z" fill="#FFD43B"/>
      <path d="M30 104 L48 93 L60 106 L72 93 L90 104" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
  },
};

/** One reviewer as an SVG. mood: smirk | flat | happy | shocked | grimace | talk */
function face(id, color, { mood, size = 56, track = true, cls = "" } = {}) {
  const ch = CHARACTERS[id] || CHARACTERS.staff;
  const m = mood || ch.mood;
  const delay = (Math.random() * 4).toFixed(2);
  return `<svg class="face ${track ? "track" : ""} ${cls}" data-id="${id}" data-mood="${m}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false">
    <g class="body">
      ${ch.under(color)}
      <circle cx="60" cy="68" r="36" fill="${color}" stroke="${INK}" stroke-width="4"/>
      ${cheeks}
      <g class="eyes" style="animation-delay:${delay}s">${ch.eyes(color)}</g>
      <g class="mouth" transform="translate(0 ${ch.mouthY || 0})">${MOUTHS[m]}</g>
      ${ch.over(color)}
    </g>
  </svg>`;
}

/** Change a drawn face's expression in place. */
function setMood(svg, mood) {
  if (!svg) return;
  const id = svg.dataset.id;
  const m = mood || (CHARACTERS[id] || CHARACTERS.staff).mood;
  svg.dataset.mood = m;
  svg.querySelector(".mouth").innerHTML = MOUTHS[m];
}

/* ---------- flame ---------- */
function flame(size = 22, cls = "") {
  return `<svg class="flame ${cls}" viewBox="0 0 24 32" width="${size * 0.75}" height="${size}" aria-hidden="true" focusable="false">
    <path class="outer" d="M12 1.5 C14 7 21 11 21 19.5 C21 26 17 30.5 12 30.5 C7 30.5 3 26 3 19.5 C3 14 6 11 8 7.5 C9 11 11 12.5 12.2 12.5 C12 8.5 11 5.5 12 1.5Z" fill="#F0503A" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path class="inner" d="M12 15 C13 18 16 20 16 23.5 C16 26.6 14.2 28.6 12 28.6 C9.8 28.6 8 26.6 8 23.5 C8 20.6 10 19 11.2 16.8Z" fill="#FFD43B"/>
  </svg>`;
}

/* ---------- line icons ---------- */
const ICON_PATHS = {
  lock: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  flask: `<path d="M9 3h6M10 3v6l-5.2 9.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9V3M7.6 15h8.8"/>`,
  check: `<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>`,
  tick: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  copy: `<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>`,
  download: `<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>`,
  sliders: `<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>`,
  key: `<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M15 8l3 3"/>`,
  shuffle: `<path d="M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.9-3.6M13.1 9.6C14.2 8 15.4 7 17 7h3M17 4l3 3-3 3M17 14l3 3-3 3"/>`,
};
function icon(name, size = 18) {
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ""}</svg>`;
}

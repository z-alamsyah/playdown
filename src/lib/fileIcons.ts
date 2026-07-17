/** VSCode-material-style file badges: a solid colored tile with a white
 *  glyph or type label. Hand-rolled inline SVG (~1KB) instead of shipping
 *  the multi-MB material-icon-theme pack. Rendered by FileTree inside a
 *  24×24 viewBox. */

const DARK_INK = "#1c2733";

function badgeText(color: string, label: string, fg = "#ffffff", size = 8.5): string {
  return (
    `<rect x="3" y="3.5" width="18" height="17" rx="3.5" fill="${color}"/>` +
    `<text x="12" y="15.3" text-anchor="middle" font-size="${size}" font-weight="700" fill="${fg}" font-family="-apple-system,'Segoe UI',sans-serif">${label}</text>`
  );
}

function badgeGlyph(color: string, glyph: string): string {
  return `<rect x="3" y="3.5" width="18" height="17" rx="3.5" fill="${color}"/>` + glyph;
}

const IMG_GLYPH =
  '<circle cx="9.2" cy="9.6" r="1.5" fill="#fff"/>' +
  '<path d="m5.8 16.6 3.7-3.7 2.7 2.7 2.3-2.3 3.7 3.3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

const CODE_GLYPH =
  '<path d="m9.8 9-3 3 3 3M14.2 9l3 3-3 3" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

const TERM_GLYPH =
  '<path d="m7.5 9 3 3-3 3M12.5 15.5H17" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

const GEAR_GLYPH =
  '<circle cx="12" cy="12" r="2.2" fill="none" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M12 7.6V6M12 18v-1.6M16.4 12H18M6 12h1.6M15.1 8.9l1.2-1.2M7.7 16.3l1.2-1.2M15.1 15.1l1.2 1.2M7.7 7.7l1.2 1.2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>';

/** Plain filled document with a fold — the neutral fallback. */
const DOC =
  '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5l-5-5z" fill="#8b98a5"/>' +
  '<path d="M14 3.5v5h5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.4"/>';

const folder = (color: string): string =>
  `<path d="M3 6.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.6.8l.9 1.2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10z" fill="${color}"/>`;

/* Special folder colors (material-icon-theme conventions). */
const FOLDER_COLORS: Record<string, string> = {
  src: "#4caf50",
  lib: "#8d6e63",
  assets: "#ff9800",
  images: "#ff9800",
  img: "#ff9800",
  docs: "#42a5f5",
  doc: "#42a5f5",
  test: "#e57373",
  tests: "#e57373",
  __tests__: "#e57373",
  components: "#7e57c2",
  config: "#78909c",
  scripts: "#607d8b",
  public: "#ffca28",
};
const FOLDER_DEFAULT = "#90a4ae";

const BY_EXT: Record<string, string> = {
  md: badgeText("#42a5f5", "M↓"),
  markdown: badgeText("#42a5f5", "M↓"),
  mdx: badgeText("#42a5f5", "M↓"),
  json: badgeText("#fbc02d", "{}", DARK_INK),
  jsonc: badgeText("#fbc02d", "{}", DARK_INK),
  yml: badgeText("#ff5252", "Y"),
  yaml: badgeText("#ff5252", "Y"),
  toml: badgeText("#ff7043", "T"),
  css: badgeText("#42a5f5", "#"),
  scss: badgeText("#ec407a", "#"),
  sass: badgeText("#ec407a", "#"),
  less: badgeText("#2196f3", "#"),
  html: badgeGlyph("#e44d26", CODE_GLYPH),
  htm: badgeGlyph("#e44d26", CODE_GLYPH),
  ts: badgeText("#0288d1", "TS"),
  tsx: badgeText("#0288d1", "TS"),
  js: badgeText("#ffca28", "JS", DARK_INK),
  jsx: badgeText("#ffca28", "JS", DARK_INK),
  mjs: badgeText("#ffca28", "JS", DARK_INK),
  cjs: badgeText("#ffca28", "JS", DARK_INK),
  py: badgeText("#3776ab", "PY"),
  go: badgeText("#00acd7", "GO"),
  rs: badgeText("#ff7043", "RS"),
  rb: badgeText("#e53935", "RB"),
  java: badgeText("#f44336", "J"),
  php: badgeText("#7986cb", "P"),
  vue: badgeText("#41b883", "V"),
  svelte: badgeText("#ff3e00", "S"),
  sh: badgeGlyph("#4caf50", TERM_GLYPH),
  bash: badgeGlyph("#4caf50", TERM_GLYPH),
  zsh: badgeGlyph("#4caf50", TERM_GLYPH),
  png: badgeGlyph("#26a69a", IMG_GLYPH),
  jpg: badgeGlyph("#26a69a", IMG_GLYPH),
  jpeg: badgeGlyph("#26a69a", IMG_GLYPH),
  gif: badgeGlyph("#26a69a", IMG_GLYPH),
  webp: badgeGlyph("#26a69a", IMG_GLYPH),
  bmp: badgeGlyph("#26a69a", IMG_GLYPH),
  ico: badgeGlyph("#26a69a", IMG_GLYPH),
  avif: badgeGlyph("#26a69a", IMG_GLYPH),
  svg: badgeText("#ffb300", "SVG", DARK_INK, 6.5),
  pdf: badgeText("#e53935", "PDF", "#ffffff", 6.5),
  csv: badgeText("#43a047", "X"),
  tsv: badgeText("#43a047", "X"),
  xls: badgeText("#43a047", "X"),
  xlsx: badgeText("#43a047", "X"),
  woff: badgeText("#f44336", "A"),
  woff2: badgeText("#f44336", "A"),
  ttf: badgeText("#f44336", "A"),
  otf: badgeText("#f44336", "A"),
  eot: badgeText("#f44336", "A"),
};

const CONFIG_NAMES = new Set([
  ".gitignore", ".editorconfig", ".env", "dockerfile", "makefile", ".npmrc", ".prettierrc",
]);
const GEAR = badgeGlyph("#78909c", GEAR_GLYPH);

/** Inner SVG markup (24×24 viewBox) for a tree node's icon. */
export function iconFor(name: string, isDir: boolean): string {
  if (isDir) {
    return folder(FOLDER_COLORS[name.toLowerCase()] ?? FOLDER_DEFAULT);
  }
  const lower = name.toLowerCase();
  if (CONFIG_NAMES.has(lower) || lower.endsWith("rc")) return GEAR;
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  return BY_EXT[ext] ?? DOC;
}

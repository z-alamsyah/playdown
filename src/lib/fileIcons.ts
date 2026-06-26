/** Tiny file-tree icon set: a colored folder + per-extension file glyphs.
 *  Returns inner SVG markup (24×24 viewBox) + a color, rendered by FileTree. */
type Icon = { paths: string; color: string; fill?: boolean };

const FOLDER: Icon = {
  fill: true,
  color: "#d6a84a",
  paths:
    '<path d="M3 6a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.6.8l.9 1.2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/>',
};

const doc = (color: string): Icon => ({
  color,
  paths: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
});

const IMAGE: Icon = {
  color: "#4aa564",
  paths:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="m21 15-4.5-4.5L6 21"/>',
};

const code = (color: string): Icon => ({
  color,
  paths: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
});

const HASH: Icon = {
  color: "#4c9aff",
  paths:
    '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
};

const FONT: Icon = {
  color: "#cb3837",
  paths: '<path d="M5 20 12 4l7 16"/><path d="M8 14h8"/>',
};

const GEAR: Icon = {
  color: "#8b96a5",
  paths:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

const BY_EXT: Record<string, Icon> = {
  md: doc("#4c9aff"), markdown: doc("#4c9aff"), mdx: doc("#4c9aff"),
  json: doc("#e2c08d"), jsonc: doc("#e2c08d"),
  yml: doc("#8b96a5"), yaml: doc("#8b96a5"), toml: doc("#8b96a5"),
  css: HASH, scss: HASH, sass: HASH, less: HASH,
  png: IMAGE, jpg: IMAGE, jpeg: IMAGE, gif: IMAGE, webp: IMAGE, svg: IMAGE, bmp: IMAGE, ico: IMAGE, avif: IMAGE,
  woff: FONT, woff2: FONT, ttf: FONT, otf: FONT, eot: FONT,
  ts: code("#4c9aff"), tsx: code("#4c9aff"),
  js: code("#e2c08d"), jsx: code("#e2c08d"), mjs: code("#e2c08d"), cjs: code("#e2c08d"),
  rs: code("#d98b6a"), py: code("#4c9aff"), go: code("#4c9aff"),
  html: code("#e37933"), vue: code("#42b883"), svelte: code("#e37933"),
  sh: code("#8bbf73"), bash: code("#8bbf73"), zsh: code("#8bbf73"),
};

const CONFIG_NAMES = new Set([
  ".gitignore", ".editorconfig", ".env", "dockerfile", "makefile", ".npmrc", ".prettierrc",
]);

/** Resolve the icon for a tree node. */
export function iconFor(name: string, isDir: boolean): { paths: string; color: string; fill: boolean } {
  if (isDir) return { paths: FOLDER.paths, color: FOLDER.color, fill: true };
  const lower = name.toLowerCase();
  if (CONFIG_NAMES.has(lower) || lower.endsWith("rc")) return { paths: GEAR.paths, color: GEAR.color, fill: false };
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  const ic = BY_EXT[ext] ?? doc("#8b96a5");
  return { paths: ic.paths, color: ic.color, fill: ic.fill ?? false };
}

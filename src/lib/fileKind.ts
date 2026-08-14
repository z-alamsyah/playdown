export type FileKind = "markdown" | "json" | "image" | "text" | "diff" | "code";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;
const MARKDOWN_RE = /\.(md|markdown|mdx|mdown)$/i;
// Source files that get syntax colors in the editor (via language-data —
// highlighting only, no compilation or diagnostics).
const CODE_RE =
  /\.(ts|tsx|js|jsx|mjs|cjs|go|rs|py|rb|java|kt|kts|swift|c|h|cc|cpp|hpp|cs|php|sh|bash|zsh|yml|yaml|toml|xml|html?|css|scss|less|sql|vue|svelte|lua|zig|dart|ex|exs|erl|hs|scala|clj|r|pl|proto|graphql|gql|tf|nix|cmake|gradle|bat|ps1|dockerfile)$/i;
const CODE_BASENAME_RE = /(^|\/)(dockerfile|makefile|cmakelists\.txt)$/i;

export function fileKind(path: string): FileKind {
  if (path.startsWith("diff://") || path.startsWith("gitdiff://")) return "diff";
  if (IMAGE_RE.test(path)) return "image";
  if (/\.json$/i.test(path)) return "json";
  if (MARKDOWN_RE.test(path)) return "markdown";
  if (CODE_RE.test(path) || CODE_BASENAME_RE.test(path)) return "code";
  return "text";
}

export const isImage = (path: string) => IMAGE_RE.test(path);
export const isHtml = (path: string) => /\.html?$/i.test(path);

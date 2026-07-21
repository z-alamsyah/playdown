export type FileKind = "markdown" | "json" | "image" | "text" | "diff";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;
const MARKDOWN_RE = /\.(md|markdown|mdx|mdown)$/i;

export function fileKind(path: string): FileKind {
  if (path.startsWith("diff://") || path.startsWith("gitdiff://")) return "diff";
  if (IMAGE_RE.test(path)) return "image";
  if (/\.json$/i.test(path)) return "json";
  if (MARKDOWN_RE.test(path)) return "markdown";
  return "text";
}

export const isImage = (path: string) => IMAGE_RE.test(path);
export const isHtml = (path: string) => /\.html?$/i.test(path);

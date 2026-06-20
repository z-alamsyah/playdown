export type FileKind = "markdown" | "json" | "image" | "text";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;
const MARKDOWN_RE = /\.(md|markdown|mdx|mdown)$/i;

export function fileKind(path: string): FileKind {
  if (IMAGE_RE.test(path)) return "image";
  if (/\.json$/i.test(path)) return "json";
  if (MARKDOWN_RE.test(path)) return "markdown";
  return "text";
}

export const isImage = (path: string) => IMAGE_RE.test(path);

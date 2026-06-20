import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import frontMatter from "markdown-it-front-matter";
import hljs from "highlight.js/lib/common";
import yaml from "js-yaml";
import { slugify } from "./slug";

let capturedFrontmatter = "";
let slugCounts: Record<string, number> = {};

function uniqueSlug(text: string): string {
  const base = slugify(text) || "section";
  const n = slugCounts[base] ?? 0;
  slugCounts[base] = n + 1;
  return n === 0 ? base : `${base}-${n}`;
}

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: (str, lang): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const out = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code>${out}</code></pre>`;
      } catch {
        /* fall through */
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

md.use(taskLists, { enabled: true, label: true });
md.use(frontMatter, (fm: string) => {
  capturedFrontmatter = fm;
});

// Add slug ids to headings (so the outline can jump to them).
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const inline = tokens[idx + 1];
  const text = inline?.content ?? "";
  tokens[idx].attrSet("id", uniqueSlug(text));
  return self.renderToken(tokens, idx, options);
};

// Render ```mermaid blocks as <div class="mermaid"> for client-side rendering.
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim().toLowerCase() === "mermaid") {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

export interface RenderResult {
  html: string;
  frontmatter: Record<string, unknown> | null;
  hasMermaid: boolean;
}

export function render(source: string): RenderResult {
  capturedFrontmatter = "";
  slugCounts = {};
  const html = md.render(source);

  let frontmatter: Record<string, unknown> | null = null;
  if (capturedFrontmatter.trim()) {
    try {
      const parsed = yaml.load(capturedFrontmatter);
      if (parsed && typeof parsed === "object") {
        frontmatter = parsed as Record<string, unknown>;
      }
    } catch {
      frontmatter = null;
    }
  }

  return {
    html,
    frontmatter,
    hasMermaid: /```mermaid/.test(source),
  };
}

/** Pretty-print + syntax-highlight a JSON document for preview. */
export function renderJson(content: string): RenderResult {
  if (!content.trim()) {
    return { html: "", frontmatter: null, hasMermaid: false };
  }
  try {
    const pretty = JSON.stringify(JSON.parse(content), null, 2);
    const code = hljs.highlight(pretty, { language: "json" }).value;
    return {
      html: `<pre class="hljs json-preview"><code>${code}</code></pre>`,
      frontmatter: null,
      hasMermaid: false,
    };
  } catch (e) {
    return {
      html: `<div class="render-error">Invalid JSON — ${md.utils.escapeHtml(String(e))}</div>`,
      frontmatter: null,
      hasMermaid: false,
    };
  }
}

export interface Heading {
  level: number;
  text: string;
  line: number; // 0-based line index in the source
  slug: string;
}

/** Extract ATX headings (skipping frontmatter and fenced code). */
export function outline(source: string): Heading[] {
  const lines = source.split("\n");
  const headings: Heading[] = [];
  const counts: Record<string, number> = {};
  let inFence = false;
  let fenceMarker = "";
  let start = 0;

  // Skip a leading YAML frontmatter block.
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        start = i + 1;
        break;
      }
    }
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1];
      } else if (line.trim().startsWith(fenceMarker)) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) {
      const text = m[2].trim();
      const base = slugify(text) || "section";
      const n = counts[base] ?? 0;
      counts[base] = n + 1;
      headings.push({
        level: m[1].length,
        text,
        line: i,
        slug: n === 0 ? base : `${base}-${n}`,
      });
    }
  }

  return headings;
}

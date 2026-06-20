import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import frontMatter from "markdown-it-front-matter";
import hljs from "highlight.js/lib/common";
import yaml from "js-yaml";

let capturedFrontmatter = "";

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

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { render, renderJson, ensureHighlighter } from "../markdown/render";
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import type { FileKind } from "../fileKind";

  let { path, groupId, kind }: { path: string; groupId: string; kind: FileKind } = $props();

  let body: HTMLDivElement;

  // Bumped once the lazy highlighter loads so the preview re-renders with
  // syntax highlighting (mirrors the lazy mermaid pattern in the effect below).
  let hlReady = $state(0);

  const result = $derived.by(() => {
    void hlReady;
    return kind === "json"
      ? renderJson(groups.docContent(path))
      : render(groups.docContent(path));
  });

  function formatVal(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.map(formatVal).join(", ");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  onMount(() => {
    groups.registerPreview(groupId, body);
    void ensureHighlighter().then(() => hlReady++);
  });
  onDestroy(() => groups.unregisterPreview(groupId));

  // Inject rendered HTML, wire external links to the OS browser, render mermaid.
  $effect(() => {
    if (!body) return;
    body.innerHTML = result.html;

    body.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      if (/^https?:\/\//i.test(href)) {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          void openUrl(href);
        });
      }
    });

    if (result.hasMermaid) {
      const isDark = settings.theme === "dark";
      void import("mermaid")
        .then(({ default: mermaid }) => {
          mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? "dark" : "default",
          });
          const nodes = body.querySelectorAll<HTMLElement>(".mermaid");
          if (nodes.length) void mermaid.run({ nodes });
        })
        .catch((e) => console.error("mermaid failed:", e));
    }
  });
</script>

<div class="preview">
  {#if result.frontmatter}
    <div class="frontmatter-card">
      <div class="fm-title">frontmatter</div>
      <dl>
        {#each Object.entries(result.frontmatter) as [key, value]}
          <div class="fm-row">
            <dt>{key}</dt>
            <dd>{formatVal(value)}</dd>
          </div>
        {/each}
      </dl>
    </div>
  {/if}
  <div class="markdown-body" bind:this={body}></div>
</div>

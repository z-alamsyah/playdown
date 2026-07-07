<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { render, renderJson, ensureHighlighter } from "../markdown/render";
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";
  import { annotations } from "../stores/annotations.svelte";
  import { ui } from "../stores/ui.svelte";
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

  // ---- annotate mode -------------------------------------------------------
  const annotating = $derived(annotations.enabled && kind === "markdown");

  function blockOf(t: EventTarget | null): HTMLElement | null {
    const el = (t as HTMLElement | null)?.closest?.("[data-line]") ?? null;
    return el && body.contains(el) ? (el as HTMLElement) : null;
  }

  // Highlight only the innermost block under the cursor (delegated, so it
  // survives innerHTML re-renders).
  let hoverEl: HTMLElement | null = null;
  function onHover(e: MouseEvent) {
    const el = annotating ? blockOf(e.target) : null;
    if (el === hoverEl) return;
    hoverEl?.classList.remove("ann-hover");
    hoverEl = el;
    hoverEl?.classList.add("ann-hover");
  }
  function clearHover() {
    hoverEl?.classList.remove("ann-hover");
    hoverEl = null;
  }
  $effect(() => {
    if (!annotating) clearHover();
  });

  // Capture-phase click so links don't navigate while annotating.
  function onAnnotateClick(e: MouseEvent) {
    if (!annotating) return;
    const el = blockOf(e.target);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const line = Number(el.dataset.line);
    const sel = window.getSelection();
    let quote = "";
    if (sel && !sel.isCollapsed && sel.anchorNode && body.contains(sel.anchorNode)) {
      quote = sel.toString().trim().replace(/\s+/g, " ").slice(0, 300);
    }
    if (!quote) quote = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    ui.showPrompt({
      title: `Annotate line ${line + 1}`,
      placeholder: "What should change here?",
      confirmLabel: "Add",
      multiline: true,
      detail: quote,
      onSubmit: (text) => {
        ui.closePrompt();
        annotations.add(path, line, quote, text);
      },
    });
  }

  // Mark blocks that already have annotations (re-applied after re-renders).
  $effect(() => {
    void result;
    const anns = annotations.listFor(path);
    if (!body) return;
    body.querySelectorAll(".annotated").forEach((n) => n.classList.remove("annotated"));
    for (const a of anns) {
      body.querySelector(`[data-line="${a.line}"]`)?.classList.add("annotated");
    }
  });

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
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events, a11y_mouse_events_have_key_events -->
  <div
    class="markdown-body"
    class:annotating
    bind:this={body}
    onmouseover={onHover}
    onmouseleave={clearHover}
    onclickcapture={onAnnotateClick}
  ></div>
</div>

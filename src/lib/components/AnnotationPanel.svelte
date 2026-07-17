<script lang="ts">
  import { confirm } from "@tauri-apps/plugin-dialog";
  import type { Side } from "../types";
  import { annotations } from "../stores/annotations.svelte";
  import { groups } from "../stores/groups.svelte";
  import { workspace } from "../stores/workspace.svelte";
  import { settings } from "../stores/settings.svelte";
  import { terminal } from "../stores/terminal.svelte";
  import { copyText } from "../tauri/clipboard";

  let { side }: { side: Side } = $props();

  const path = $derived(groups.activeTab?.path ?? null);
  const list = $derived(annotations.listFor(path));
  const others = $derived(path ? annotations.otherFiles(path) : []);
  const hasAny = $derived(list.length > 0 || others.length > 0);

  let copied = $state(false);

  function buildPrompt(): string {
    return annotations.formatPrompt((p) => workspace.relativeOf(p));
  }

  function copyPrompt() {
    const text = buildPrompt();
    if (!text) return;
    void copyText(text);
    copied = true;
    setTimeout(() => (copied = false), 1600);
  }

  function sendToTerminal() {
    const text = buildPrompt();
    if (!text) return;
    if (!settings.terminalOpen) void settings.setTerminalOpen(true);
    terminal.ensureOne();
    terminal.requestPaste(text);
    // Hand-off done — start the next review round with a clean slate.
    annotations.clearAll();
  }

  async function clearFile() {
    if (!path) return;
    const ok = await confirm("Remove all annotations for this file?", {
      title: "Clear annotations",
      kind: "warning",
    });
    if (ok) annotations.clear(path);
  }

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  function startResize(e: PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = settings.annotationWidth;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = side === "right" ? startW - dx : startW + dx;
      settings.annotationWidth = clamp(next, 200, window.innerWidth * 0.6);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      void settings.setAnnotationWidth(settings.annotationWidth);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

<aside class="outline annotations-panel panel-{side}" style="width: {settings.annotationWidth}px">
  <button
    class="panel-resize {side}"
    aria-label="Resize annotations panel"
    onpointerdown={startResize}
  ></button>
  <div class="panel-header">
    <span class="panel-title">Annotations{list.length ? ` · ${list.length}` : ""}</span>
    <button
      class="icon-btn"
      title="Close annotate mode (⌘⇧A)"
      onclick={() => (annotations.enabled = false)}>×</button
    >
  </div>

  <div class="ann-actions">
    <button class="btn-secondary" onclick={copyPrompt} disabled={!hasAny}>
      {copied ? "Copied!" : "Copy as prompt"}
    </button>
    <button class="btn-secondary" onclick={sendToTerminal} disabled={!hasAny}>
      Send to terminal
    </button>
  </div>

  <div class="outline-list ann-list">
    {#if !path}
      <div class="muted">Open a markdown file to annotate.</div>
    {:else if list.length === 0}
      <div class="muted">Click a block in the preview to annotate it. Select text first to quote it precisely.</div>
    {:else}
      {#each list as a (a.id)}
        <div
          class="ann-item"
          role="button"
          tabindex="0"
          onclick={() => groups.scrollToLine(a.line)}
          onkeydown={(e) => e.key === "Enter" && groups.scrollToLine(a.line)}
        >
          <div class="ann-top">
            <span class="ann-line">L{a.line + 1}</span>
            <button
              class="icon-btn ann-del"
              title="Delete annotation"
              onclick={(e) => {
                e.stopPropagation();
                if (path) annotations.remove(path, a.id);
              }}>×</button
            >
          </div>
          <div class="ann-quote">“{a.quote}”</div>
          <div class="ann-text">{a.text}</div>
        </div>
      {/each}
      <button class="link-btn ann-clear" onclick={clearFile}>clear all for this file</button>
    {/if}
    {#if others.length}
      <div class="muted ann-others">
        +{others.length} other file{others.length > 1 ? "s" : ""} included in the export
      </div>
    {/if}
  </div>
</aside>

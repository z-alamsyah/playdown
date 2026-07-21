<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { EditorView } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { readFile } from "../tauri/fs";
  import { groups } from "../stores/groups.svelte";
  import { workspace } from "../stores/workspace.svelte";
  import { settings } from "../stores/settings.svelte";
  import { editorTheme } from "../editor/setup";

  let { path }: { path: string } = $props();

  let container: HTMLDivElement;
  let mv: { destroy(): void } | undefined;
  let loading = $state(true);
  let error = $state<string | null>(null);

  interface Spec {
    left: string;
    right: string;
    git: boolean;
  }

  function parseVirtual(p: string): Spec | null {
    if (p.startsWith("gitdiff://")) {
      const t = p.slice("gitdiff://".length);
      return { left: t, right: t, git: true };
    }
    if (p.startsWith("diff://")) {
      const [l, r] = p.slice("diff://".length).split("\u001f");
      if (l && r) return { left: l, right: r, git: false };
    }
    return null;
  }

  const spec = $derived(parseVirtual(path));
  const base = (p: string) => p.split(/[/\\]/).filter(Boolean).pop() ?? p;
  const leftLabel = $derived(spec ? (spec.git ? `${base(spec.left)} @ HEAD` : base(spec.left)) : "");
  const rightLabel = $derived(spec ? (spec.git ? "Working copy" : base(spec.right)) : "");

  onMount(async () => {
    if (!spec) {
      error = "Invalid diff reference.";
      loading = false;
      return;
    }
    try {
      // Lazy: the merge view only loads when a diff tab is opened.
      const { MergeView } = await import("@codemirror/merge");
      const [leftDoc, rightDoc] = await Promise.all([
        spec.git
          ? invoke<string>("git_head_content", { root: workspace.root, path: spec.left })
          : readFile(spec.left),
        // Right side prefers the live buffer (unsaved edits visible in the diff).
        Promise.resolve(
          groups.documents[spec.right]?.content ?? null,
        ).then((c) => (c !== null ? c : readFile(spec.right))),
      ]);
      const shared = () => [
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
        editorTheme(settings.theme),
      ];
      mv = new MergeView({
        a: { doc: leftDoc, extensions: shared() },
        b: { doc: rightDoc, extensions: shared() },
        parent: container,
        collapseUnchanged: { margin: 3, minSize: 6 },
        highlightChanges: true,
        gutter: true,
      });
      loading = false;
    } catch (e) {
      error = String(e);
      loading = false;
    }
  });

  onDestroy(() => mv?.destroy());
</script>

<div class="diff-pane">
  <div class="diff-head">
    <span class="diff-side removed">− {leftLabel}</span>
    <span class="diff-side added">+ {rightLabel}</span>
  </div>
  <div class="diff-body" bind:this={container}>
    {#if loading}<div class="muted">Loading diff…</div>{/if}
    {#if error}<div class="render-error">{error}</div>{/if}
  </div>
</div>

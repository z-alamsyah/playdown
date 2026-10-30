<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import {
    EditorView,
    Decoration,
    ViewPlugin,
    lineNumbers,
    type DecorationSet,
    type ViewUpdate,
  } from "@codemirror/view";
  import { EditorState, RangeSetBuilder } from "@codemirror/state";
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
      const { MergeView, getChunks } = await import("@codemirror/merge");

      // Tag every changed line with what KIND of change it is, so the three
      // read differently at a glance: a line that only exists on the left was
      // removed, one that only exists on the right was added, and a line that
      // exists on both sides was edited in place. The merge view itself paints
      // all three the same.
      const buildKinds = (state: EditorState): DecorationSet => {
        const info = getChunks(state);
        if (!info) return Decoration.none;
        const left = info.side === "a";
        const doc = state.doc;
        const b = new RangeSetBuilder<Decoration>();
        for (const c of info.chunks) {
          const start = left ? c.fromA : c.fromB;
          const end = left ? c.toA : c.toB; // exclusive; may sit past the end
          if (start >= end) continue; // this side has no lines in the chunk
          const kind =
            c.fromA === c.toA ? "pd-added"
            : c.fromB === c.toB ? "pd-removed"
            : left ? "pd-edited-old" : "pd-edited-new";
          const deco = Decoration.line({ class: kind });
          for (let pos = start; pos < end && pos <= doc.length; ) {
            const line = doc.lineAt(pos);
            b.add(line.from, line.from, deco);
            pos = line.to + 1;
          }
        }
        return b.finish();
      };
      const changeKinds = ViewPlugin.fromClass(
        class {
          decorations: DecorationSet;
          constructor(view: EditorView) {
            this.decorations = buildKinds(view.state);
          }
          update(u: ViewUpdate) {
            if (u.docChanged || u.transactions.length) this.decorations = buildKinds(u.state);
          }
        },
        { decorations: (v) => v.decorations },
      );
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
        // Line numbers on both sides: long files are compared by line.
        lineNumbers(),
        changeKinds,
        editorTheme(settings.theme),
      ];
      mv = new MergeView({
        a: { doc: leftDoc, extensions: shared() },
        b: { doc: rightDoc, extensions: shared() },
        parent: container,
        collapseUnchanged: { margin: 3, minSize: 6 },
        highlightChanges: true,
        // The per-kind edge on each line replaces merge's own change gutter,
        // which colours by side (red left / green right) and clashed with the
        // amber "edited" edge.
        gutter: false,
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
    <span class="diff-side added">
      <span class="diff-name">+ {rightLabel}</span>
      <span class="diff-legend" aria-label="Legend">
        <i class="k pd-removed"></i>removed
        <i class="k pd-added"></i>added
        <i class="k pd-edited"></i>edited
      </span>
    </span>
  </div>
  <div class="diff-body" bind:this={container}>
    {#if loading}<div class="muted">Loading diff…</div>{/if}
    {#if error}<div class="render-error">{error}</div>{/if}
  </div>
</div>

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView } from "@codemirror/view";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { createEditor, themeCompartment, editorTheme, type EditorLanguage } from "../editor/setup";
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";
  import { workspace } from "../stores/workspace.svelte";
  import type { GitGutterHandle } from "../editor/gitGutter";
  import type { FileKind } from "../fileKind";

  let { path, groupId, kind }: { path: string; groupId: string; kind: FileKind } = $props();

  let container: HTMLDivElement;
  let view: EditorView | undefined;
  let gutterHandle: GitGutterHandle | undefined;
  let unlistenGit: UnlistenFn | undefined;

  onMount(() => {
    const language: EditorLanguage =
      kind === "json" ? "json"
      : kind === "markdown" ? "markdown"
      : kind === "code" ? "code"
      : "text";
    view = createEditor({
      parent: container,
      doc: groups.docContent(path),
      theme: editorTheme(settings.theme),
      language,
      filename: path.split("/").pop(),
      onChange: (v) => groups.setDocContent(path, v),
      onSave: () => void groups.saveDoc(path),
    });
    groups.registerEditor(groupId, view);

    // Git change indicators (lazy; silently skipped for untracked files).
    const root = workspace.root;
    if (workspace.isGitRepo && root && path.startsWith(root)) {
      void (async () => {
        try {
          const head = await invoke<string>("git_head_content", { root, path });
          const { attachGitGutter } = await import("../editor/gitGutter");
          if (!view) return;
          gutterHandle = attachGitGutter(view, head, () => groups.openGitDiff(path));
          // A commit moves HEAD (the watcher sees .git change) → new baseline.
          unlistenGit = await listen<string[]>("fs-change", async (e) => {
            if (!(e.payload ?? []).some((p) => p.includes("/.git/"))) return;
            try {
              const h = await invoke<string>("git_head_content", { root, path });
              gutterHandle?.refreshHead(h);
            } catch {
              /* file no longer tracked */
            }
          });
        } catch {
          /* untracked / new file — no baseline to diff against */
        }
      })();
    }
  });

  // React to live theme changes without rebuilding the editor.
  $effect(() => {
    const theme = editorTheme(settings.theme);
    view?.dispatch({
      effects: themeCompartment.reconfigure(theme),
    });
  });

  onDestroy(() => {
    unlistenGit?.();
    gutterHandle?.detach();
    groups.unregisterEditor(groupId);
    view?.destroy();
  });
</script>

<div class="editor" bind:this={container}></div>

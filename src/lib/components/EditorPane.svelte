<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView } from "@codemirror/view";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { createEditor, themeCompartment, type EditorLanguage } from "../editor/setup";
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";
  import type { FileKind } from "../fileKind";

  let { path, groupId, kind }: { path: string; groupId: string; kind: FileKind } = $props();

  let container: HTMLDivElement;
  let view: EditorView | undefined;

  onMount(() => {
    const language: EditorLanguage =
      kind === "json" ? "json" : kind === "markdown" ? "markdown" : "text";
    view = createEditor({
      parent: container,
      doc: groups.docContent(path),
      dark: settings.theme === "dark",
      language,
      onChange: (v) => groups.setDocContent(path, v),
      onSave: () => void groups.saveDoc(path),
    });
    groups.registerEditor(groupId, view);
    view.focus();
  });

  // React to live theme changes without rebuilding the editor.
  $effect(() => {
    const dark = settings.theme === "dark";
    view?.dispatch({
      effects: themeCompartment.reconfigure(dark ? oneDark : []),
    });
  });

  onDestroy(() => {
    groups.unregisterEditor(groupId);
    view?.destroy();
  });
</script>

<div class="editor" bind:this={container}></div>

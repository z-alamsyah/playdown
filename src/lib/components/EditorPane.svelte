<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView } from "@codemirror/view";
  import { createEditor, themeCompartment, editorTheme, type EditorLanguage } from "../editor/setup";
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
      theme: editorTheme(settings.theme),
      language,
      onChange: (v) => groups.setDocContent(path, v),
      onSave: () => void groups.saveDoc(path),
    });
    groups.registerEditor(groupId, view);
  });

  // React to live theme changes without rebuilding the editor.
  $effect(() => {
    const theme = editorTheme(settings.theme);
    view?.dispatch({
      effects: themeCompartment.reconfigure(theme),
    });
  });

  onDestroy(() => {
    groups.unregisterEditor(groupId);
    view?.destroy();
  });
</script>

<div class="editor" bind:this={container}></div>

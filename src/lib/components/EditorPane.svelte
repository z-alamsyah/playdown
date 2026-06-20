<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView } from "@codemirror/view";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { createEditor, themeCompartment } from "../editor/setup";
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";

  let { path }: { path: string } = $props();

  let container: HTMLDivElement;
  let view: EditorView | undefined;

  onMount(() => {
    view = createEditor({
      parent: container,
      doc: groups.docContent(path),
      dark: settings.theme === "dark",
      onChange: (v) => groups.setDocContent(path, v),
      onSave: () => void groups.saveDoc(path),
    });
    view.focus();
  });

  // React to live theme changes without rebuilding the editor.
  $effect(() => {
    const dark = settings.theme === "dark";
    view?.dispatch({
      effects: themeCompartment.reconfigure(dark ? oneDark : []),
    });
  });

  onDestroy(() => view?.destroy());
</script>

<div class="editor" bind:this={container}></div>

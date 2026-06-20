<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView } from "@codemirror/view";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { createEditor, themeCompartment } from "../editor/setup";
  import { tabs } from "../stores/tabs.svelte";
  import { settings } from "../stores/settings.svelte";

  let container: HTMLDivElement;
  let view: EditorView | undefined;

  onMount(() => {
    const tab = tabs.active;
    if (!tab) return;
    view = createEditor({
      parent: container,
      doc: tab.content,
      dark: settings.theme === "dark",
      onChange: (v) => tabs.setContent(v),
      onSave: () => void tabs.save(),
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

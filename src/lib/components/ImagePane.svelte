<script lang="ts">
  import { onMount } from "svelte";
  import { readImageDataUrl } from "../tauri/fs";

  let { path }: { path: string } = $props();

  let src = $state<string | null>(null);
  let error = $state<string | null>(null);

  const name = $derived(path.split(/[/\\]/).pop() ?? path);

  onMount(async () => {
    try {
      src = await readImageDataUrl(path);
    } catch (e) {
      error = String(e);
    }
  });
</script>

<div class="image-pane">
  {#if error}
    <div class="render-error">{error}</div>
  {:else if src}
    <img {src} alt={name} />
  {:else}
    <div class="muted">Loading image…</div>
  {/if}
</div>

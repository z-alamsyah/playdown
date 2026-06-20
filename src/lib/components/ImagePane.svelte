<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";

  let { path }: { path: string } = $props();

  // Native asset-protocol URL — no bytes read into JS, no base64. Lightweight.
  const src = $derived(convertFileSrc(path));
  const name = $derived(path.split(/[/\\]/).pop() ?? path);
</script>

<div class="image-pane">
  <img {src} alt={name} />
</div>

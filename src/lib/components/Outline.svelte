<script lang="ts">
  import type { Side } from "../types";
  import { outline } from "../markdown/render";
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";

  let { side }: { side: Side } = $props();

  const headings = $derived.by(() => {
    const t = groups.activeTab;
    return t ? outline(groups.docContent(t.path)) : [];
  });

  const minLevel = $derived(
    headings.length ? Math.min(...headings.map((h) => h.level)) : 1,
  );
</script>

<aside class="outline panel-{side}">
  <div class="panel-header">
    <span class="panel-title">Outline</span>
    <button
      class="icon-btn"
      title="Hide outline"
      onclick={() => settings.setOutlineVisible(false)}>×</button
    >
  </div>
  <div class="outline-list">
    {#if headings.length === 0}
      <div class="muted">No headings</div>
    {:else}
      {#each headings as h (h.line)}
        <button
          class="outline-row"
          style="padding-left: {(h.level - minLevel) * 12 + 10}px"
          onclick={() => groups.scrollToHeading(h)}
        >
          <span class="ol-level">H{h.level}</span>
          <span class="ol-text">{h.text}</span>
        </button>
      {/each}
    {/if}
  </div>
</aside>

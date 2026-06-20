<script lang="ts">
  import { tabs } from "../stores/tabs.svelte";
</script>

{#if tabs.tabs.length > 0}
  <div class="tabbar">
    {#each tabs.tabs as tab, i (tab.path)}
      <div
        class="tab"
        class:active={i === tabs.activeIndex}
        role="button"
        tabindex="0"
        title={tab.path}
        onclick={() => tabs.setActive(i)}
        onkeydown={(e) => e.key === "Enter" && tabs.setActive(i)}
      >
        <span class="tab-name">{tab.name}</span>
        {#if tabs.isDirty(tab)}
          <span class="dirty" title="Unsaved changes">●</span>
        {/if}
        <button
          class="close"
          title="Close (⌘W)"
          onclick={(e) => {
            e.stopPropagation();
            tabs.close(i);
          }}
        >
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}

<script lang="ts">
  import { ui } from "../stores/ui.svelte";

  const menu = $derived(ui.menu);

  // Keep the menu within the viewport.
  const pos = $derived.by(() => {
    if (!menu) return { left: 0, top: 0 };
    const w = 200;
    const h = (menu.items.length + 1) * 30;
    return {
      left: Math.min(menu.x, window.innerWidth - w - 8),
      top: Math.min(menu.y, window.innerHeight - h - 8),
    };
  });
</script>

{#if menu}
  <div
    class="ctx-backdrop"
    role="presentation"
    onclick={() => ui.closeMenu()}
    oncontextmenu={(e) => {
      e.preventDefault();
      ui.closeMenu();
    }}
  ></div>
  <div class="context-menu" style="left: {pos.left}px; top: {pos.top}px;">
    {#each menu.items as item}
      {#if item.separator}<div class="ctx-sep"></div>{/if}
      <button
        class="ctx-item"
        class:danger={item.danger}
        onclick={() => {
          item.action();
          ui.closeMenu();
        }}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}

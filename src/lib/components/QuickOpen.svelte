<script lang="ts">
  import { onMount } from "svelte";
  import { workspace } from "../stores/workspace.svelte";
  import { groups } from "../stores/groups.svelte";

  let { onClose }: { onClose: () => void } = $props();

  let query = $state("");
  let selected = $state(0);
  let inputEl: HTMLInputElement;

  /** Subsequence fuzzy match; lower score = better, -1 = no match. */
  function fuzzyScore(q: string, text: string): number {
    let ti = 0;
    let score = 0;
    let last = -1;
    for (const ch of q) {
      const found = text.indexOf(ch, ti);
      if (found === -1) return -1;
      score += found - last - 1; // gaps penalty
      last = found;
      ti = found + 1;
    }
    return score + (text.length - q.length) * 0.05;
  }

  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const files = workspace.files;
    if (!q) return files.slice(0, 100);
    return files
      .map((f) => ({ f, s: fuzzyScore(q, f.rel.toLowerCase()) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, 100)
      .map((x) => x.f);
  });

  $effect(() => {
    if (selected >= results.length) selected = Math.max(0, results.length - 1);
  });

  onMount(() => inputEl?.focus());

  function choose(i: number) {
    const f = results[i];
    if (f) {
      void groups.openFile(f.path, f.name);
      onClose();
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selected = Math.min(selected + 1, results.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(selected);
    }
  }
</script>

<div
  class="quickopen-backdrop"
  role="presentation"
  onclick={onClose}
></div>
<div class="quickopen" role="dialog" aria-modal="true">
  <input
    bind:this={inputEl}
    bind:value={query}
    onkeydown={onKey}
    placeholder="Search files by name…"
    spellcheck="false"
  />
  <ul>
    {#each results as f, i (f.path)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        class:sel={i === selected}
        role="option"
        aria-selected={i === selected}
        tabindex="-1"
        onclick={() => choose(i)}
        onmouseenter={() => (selected = i)}
      >
        <span class="qo-name">{f.name}</span>
        <span class="qo-rel">{f.rel}</span>
      </li>
    {/each}
    {#if results.length === 0}
      <li class="qo-empty">No files match</li>
    {/if}
  </ul>
</div>

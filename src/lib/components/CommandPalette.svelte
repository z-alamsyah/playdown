<script lang="ts">
  import { onMount } from "svelte";
  import { ACTIONS, keymap, prettyCombo, type Action } from "../stores/keymap.svelte";
  import { settings } from "../stores/settings.svelte";
  import { workspace } from "../stores/workspace.svelte";
  import { closeFolder } from "../fileActions";

  let { onRun, onClose }: { onRun: (a: Action) => void; onClose: () => void } = $props();

  let query = $state("");
  let selected = $state(0);
  let inputEl: HTMLInputElement;

  onMount(() => inputEl?.focus());

  interface Cmd {
    id: string;
    label: string;
    hint: string;
    run: () => void;
  }

  const commands = $derived.by(() => {
    const cmds: Cmd[] = ACTIONS.map((a) => ({
      id: a.id,
      label: a.label,
      hint: prettyCombo(keymap.combo(a.id)),
      run: () => onRun(a.id),
    }));
    if (workspace.root) {
      cmds.push({ id: "closeFolder", label: "Close folder", hint: "", run: () => void closeFolder() });
    }
    for (const p of settings.recentFolders) {
      if (p === workspace.root) continue;
      const name = p.split(/[/\\]/).filter(Boolean).pop() ?? p;
      cmds.push({
        id: `recent:${p}`,
        label: `Open recent: ${name}`,
        hint: p,
        run: () => void workspace.setRoot(p),
      });
    }
    return cmds;
  });

  /** Subsequence fuzzy match; lower score = better, -1 = no match. */
  function fuzzyScore(q: string, text: string): number {
    let ti = 0;
    let score = 0;
    let last = -1;
    for (const ch of q) {
      const found = text.indexOf(ch, ti);
      if (found === -1) return -1;
      score += found - last - 1;
      last = found;
      ti = found + 1;
    }
    return score + (text.length - q.length) * 0.05;
  }

  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands
      .map((c) => ({ c, s: fuzzyScore(q, c.label.toLowerCase()) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .map((x) => x.c);
  });

  $effect(() => {
    if (selected >= results.length) selected = Math.max(0, results.length - 1);
  });

  function choose(i: number) {
    const c = results[i];
    if (!c) return;
    onClose();
    c.run();
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

<div class="quickopen-backdrop" role="presentation" onclick={onClose}></div>
<div class="quickopen" role="dialog" aria-modal="true">
  <input
    bind:this={inputEl}
    bind:value={query}
    onkeydown={onKey}
    placeholder="Run a command…"
    spellcheck="false"
  />
  <ul>
    {#each results as c, i (c.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        class:sel={i === selected}
        role="option"
        aria-selected={i === selected}
        tabindex="-1"
        onclick={() => choose(i)}
        onmouseenter={() => (selected = i)}
      >
        <span class="qo-name">{c.label}</span>
        <span class="qo-rel cp-hint">{c.hint}</span>
      </li>
    {/each}
    {#if results.length === 0}
      <li class="qo-empty">No matching command</li>
    {/if}
  </ul>
</div>

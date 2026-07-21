<script lang="ts">
  import { onMount } from "svelte";
  import { workspace } from "../stores/workspace.svelte";
  import { groups } from "../stores/groups.svelte";
  import { searchInFiles, type SearchMatch } from "../tauri/fs";

  let { onClose }: { onClose: () => void } = $props();

  let query = $state("");
  let matches = $state<SearchMatch[]>([]);
  let searching = $state(false);
  let selected = $state(0);
  let inputEl: HTMLInputElement;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  onMount(() => inputEl?.focus());

  function onInput() {
    clearTimeout(debounce);
    const q = query.trim();
    if (!q || !workspace.root) {
      matches = [];
      searching = false;
      return;
    }
    searching = true;
    debounce = setTimeout(async () => {
      const mySeq = ++seq;
      try {
        const res = await searchInFiles(workspace.root!, q);
        if (mySeq === seq) {
          matches = res;
          selected = 0;
        }
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        if (mySeq === seq) searching = false;
      }
    }, 200);
  }

  /** Matches grouped per file, preserving result order. */
  const grouped = $derived.by(() => {
    const map = new Map<string, SearchMatch[]>();
    for (const m of matches) {
      const list = map.get(m.path);
      if (list) list.push(m);
      else map.set(m.path, [m]);
    }
    return [...map.entries()];
  });

  $effect(() => {
    if (selected >= matches.length) selected = Math.max(0, matches.length - 1);
  });

  /** Flat index of a match within the grouped render order. */
  function flatIndex(path: string, i: number): number {
    let idx = 0;
    for (const [p, list] of grouped) {
      if (p === path) return idx + i;
      idx += list.length;
    }
    return -1;
  }

  const flat = $derived(grouped.flatMap(([, list]) => list));

  async function choose(i: number) {
    const m = flat[i];
    if (!m) return;
    onClose();
    await groups.openFile(m.path);
    // Let the editor/preview mount before jumping.
    setTimeout(() => groups.scrollToLine(m.line), 80);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selected = Math.min(selected + 1, flat.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void choose(selected);
    }
  }

  /** Split an excerpt around the (case-insensitive) match for highlighting. */
  function parts(text: string): [string, string, string] {
    const at = text.toLowerCase().indexOf(query.trim().toLowerCase());
    if (at < 0) return [text, "", ""];
    const q = query.trim();
    return [text.slice(0, at), text.slice(at, at + q.length), text.slice(at + q.length)];
  }
</script>

<div class="quickopen-backdrop" role="presentation" onclick={onClose}></div>
<div class="quickopen global-search" role="dialog" aria-modal="true">
  <input
    bind:this={inputEl}
    bind:value={query}
    oninput={onInput}
    onkeydown={onKey}
    placeholder="Search in files…"
    spellcheck="false"
  />
  <ul>
    {#each grouped as [path, list] (path)}
      <li class="gs-file">
        <span class="qo-name">{path.split(/[/\\]/).pop()}</span>
        <span class="qo-rel">{workspace.relativeOf(path)}</span>
        <span class="gs-count">{list.length}</span>
      </li>
      {#each list as m, i (m.path + ":" + m.line)}
        {@const fi = flatIndex(path, i)}
        {@const [pre, hit, post] = parts(m.text)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          class="gs-match"
          class:sel={fi === selected}
          role="option"
          aria-selected={fi === selected}
          tabindex="-1"
          onclick={() => void choose(fi)}
          onmouseenter={() => (selected = fi)}
        >
          <span class="gs-line">{m.line + 1}</span>
          <span class="gs-text">{pre}<mark>{hit}</mark>{post}</span>
        </li>
      {/each}
    {/each}
    {#if query.trim() && !searching && matches.length === 0}
      <li class="qo-empty">No results</li>
    {/if}
    {#if searching}
      <li class="qo-empty">Searching…</li>
    {/if}
    {#if matches.length >= 500}
      <li class="qo-empty">Showing first 500 matches — refine the query.</li>
    {/if}
  </ul>
</div>

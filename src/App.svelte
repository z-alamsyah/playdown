<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import Layout from "./lib/components/Layout.svelte";
  import StatusBar from "./lib/components/StatusBar.svelte";
  import QuickOpen from "./lib/components/QuickOpen.svelte";
  import { workspace } from "./lib/stores/workspace.svelte";
  import { groups } from "./lib/stores/groups.svelte";
  import { settings } from "./lib/stores/settings.svelte";
  import { isDir } from "./lib/tauri/fs";

  let sidebarOpen = $state(true);
  let quickOpen = $state(false);
  let fileHover = $state(false);
  let unlisten: (() => void) | undefined;

  const showWelcome = $derived(
    !workspace.root && !groups.groups.some((g) => g.tabs.length),
  );

  onMount(async () => {
    await settings.load();
    if (settings.lastFolder) {
      await workspace.setRoot(settings.lastFolder);
    }
    const restored = await groups.restore(settings.session);
    if (!restored) groups.ensureInitial();

    unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        fileHover = true;
      } else if (payload.type === "leave") {
        fileHover = false;
      } else if (payload.type === "drop") {
        fileHover = false;
        const paths = payload.paths ?? [];
        let openedFolder = false;
        for (const path of paths) {
          if (await isDir(path)) {
            await workspace.setRoot(path);
            openedFolder = true;
            break;
          }
        }
        if (!openedFolder) {
          for (const path of paths) {
            if (/\.(md|markdown|mdx|mdown)$/i.test(path)) {
              await groups.openFile(path);
            }
          }
        }
      }
    });
  });

  onDestroy(() => unlisten?.());

  // Persist the editor session (layout + open tabs) whenever it changes.
  $effect(() => {
    if (!settings.loaded) return;
    const snap = groups.serialize();
    void settings.setSession(snap);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (quickOpen) return; // palette manages its own keys

    if (e.ctrlKey && e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) groups.prevTab();
      else groups.nextTab();
      return;
    }

    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      groups.focusAdjacentGroup(e.key === "ArrowRight" ? 1 : -1);
      return;
    }

    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      groups.selectTab(parseInt(e.key, 10) - 1);
      return;
    }

    switch (e.key.toLowerCase()) {
      case "p":
        e.preventDefault();
        quickOpen = true;
        break;
      case "s":
        e.preventDefault();
        void groups.saveActive();
        break;
      case "e":
        e.preventDefault();
        groups.toggleViewActive();
        break;
      case "b":
        e.preventDefault();
        sidebarOpen = !sidebarOpen;
        break;
      case "o":
        e.preventDefault();
        void workspace.openFolder();
        break;
      case "\\":
        e.preventDefault();
        groups.splitActive("right");
        break;
      case "w": {
        const g = groups.activeGroup;
        if (g && g.activeIndex >= 0) {
          e.preventDefault();
          groups.closeTab(g.id, g.activeIndex);
        }
        break;
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if quickOpen}
  <QuickOpen onClose={() => (quickOpen = false)} />
{/if}

<div class="app">
  {#if sidebarOpen}
    <Sidebar />
  {/if}

  <main class="main">
    {#if showWelcome}
      <div class="empty">
        <div class="empty-logo">📝</div>
        <h1>Playdown</h1>
        <p class="empty-sub">Lightweight markdown editor &amp; viewer</p>
        <button class="primary" onclick={() => workspace.openFolder()}>
          Open Folder
        </button>
        <div class="empty-hints">
          <span><kbd>⌘O</kbd> open folder</span>
          <span><kbd>⌘P</kbd> find file</span>
          <span><kbd>⌘E</kbd> toggle view</span>
          <span><kbd>⌘\</kbd> split</span>
        </div>
        <p class="empty-drop">…or drag a folder onto the window</p>
      </div>
    {:else if groups.layout}
      <Layout node={groups.layout} />
    {/if}
    <StatusBar />
  </main>

  {#if fileHover}
    <div class="file-drop-overlay">
      <div class="file-drop-card">📂 Drop folder or markdown to open</div>
    </div>
  {/if}
</div>

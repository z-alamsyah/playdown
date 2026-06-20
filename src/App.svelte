<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import Outline from "./lib/components/Outline.svelte";
  import Layout from "./lib/components/Layout.svelte";
  import StatusBar from "./lib/components/StatusBar.svelte";
  import QuickOpen from "./lib/components/QuickOpen.svelte";
  import Settings from "./lib/components/Settings.svelte";
  import { workspace } from "./lib/stores/workspace.svelte";
  import { groups } from "./lib/stores/groups.svelte";
  import { settings } from "./lib/stores/settings.svelte";
  import { keymap, IS_MAC, type Action } from "./lib/stores/keymap.svelte";
  import { isDir } from "./lib/tauri/fs";
  import { applyZoom, zoomIn, zoomOut, zoomReset, zoomBy } from "./lib/tauri/zoom";

  let quickOpen = $state(false);
  let settingsOpen = $state(false);
  let fileHover = $state(false);
  let unlisten: (() => void) | undefined;

  const outlineSide = $derived(settings.sidebarSide === "left" ? "right" : "left");
  const showWelcome = $derived(
    !workspace.root && !groups.groups.some((g) => g.tabs.length),
  );

  onMount(async () => {
    await settings.load();
    keymap.hydrate(settings.keymap);
    applyZoom();

    if (settings.lastFolder) await workspace.setRoot(settings.lastFolder);
    const restored = await groups.restore(settings.session);
    if (!restored) groups.ensureInitial();

    window.addEventListener("wheel", onWheel, { passive: false });

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

  onDestroy(() => {
    unlisten?.();
    window.removeEventListener("wheel", onWheel);
  });

  // Persist the editor session (layout + open tabs) whenever it changes.
  $effect(() => {
    if (!settings.loaded) return;
    const snap = groups.serialize();
    void settings.setSession(snap);
  });

  // Trackpad pinch emits a wheel event with ctrlKey set.
  function onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? -0.05 : 0.05);
    }
  }

  function runAction(a: Action) {
    switch (a) {
      case "openFolder": void workspace.openFolder(); break;
      case "quickOpen": quickOpen = true; break;
      case "save": void groups.saveActive(); break;
      case "toggleView": groups.toggleViewActive(); break;
      case "toggleSidebar": settings.toggleSidebar(); break;
      case "toggleOutline": settings.toggleOutline(); break;
      case "splitRight": groups.splitActive("right"); break;
      case "nextTab": groups.nextTab(); break;
      case "prevTab": groups.prevTab(); break;
      case "focusNextGroup": groups.focusAdjacentGroup(1); break;
      case "focusPrevGroup": groups.focusAdjacentGroup(-1); break;
      case "zoomIn": zoomIn(); break;
      case "zoomOut": zoomOut(); break;
      case "zoomReset": zoomReset(); break;
      case "openSettings": settingsOpen = true; break;
      case "closeTab": {
        const g = groups.activeGroup;
        if (g && g.activeIndex >= 0) groups.closeTab(g.id, g.activeIndex);
        break;
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (quickOpen || settingsOpen) return;

    const primary = IS_MAC ? e.metaKey : e.ctrlKey;
    if (primary && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      groups.selectTab(parseInt(e.key, 10) - 1);
      return;
    }

    const action = keymap.match(e);
    if (!action) return;
    e.preventDefault();
    runAction(action);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if quickOpen}
  <QuickOpen onClose={() => (quickOpen = false)} />
{/if}
{#if settingsOpen}
  <Settings onClose={() => (settingsOpen = false)} />
{/if}

{#snippet mainArea()}
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
          <span><kbd>⌘,</kbd> settings</span>
        </div>
        <p class="empty-drop">…or drag a folder onto the window</p>
      </div>
    {:else if groups.layout}
      <Layout node={groups.layout} />
    {/if}
    <StatusBar onOpenSettings={() => (settingsOpen = true)} />
  </main>
{/snippet}

<div class="app">
  {#if settings.sidebarSide === "left"}
    {#if settings.sidebarVisible}<Sidebar side="left" />{/if}
    {@render mainArea()}
    {#if settings.outlineVisible}<Outline side="right" />{/if}
  {:else}
    {#if settings.outlineVisible}<Outline side="left" />{/if}
    {@render mainArea()}
    {#if settings.sidebarVisible}<Sidebar side="right" />{/if}
  {/if}

  {#if fileHover}
    <div class="file-drop-overlay">
      <div class="file-drop-card">📂 Drop folder or markdown to open</div>
    </div>
  {/if}
</div>

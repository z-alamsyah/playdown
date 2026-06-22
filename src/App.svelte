<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import Outline from "./lib/components/Outline.svelte";
  import Layout from "./lib/components/Layout.svelte";
  import StatusBar from "./lib/components/StatusBar.svelte";
  import QuickOpen from "./lib/components/QuickOpen.svelte";
  import Settings from "./lib/components/Settings.svelte";
  import ContextMenu from "./lib/components/ContextMenu.svelte";
  import PromptModal from "./lib/components/PromptModal.svelte";
  import TerminalPanel from "./lib/components/TerminalPanel.svelte";
  import { workspace } from "./lib/stores/workspace.svelte";
  import { groups } from "./lib/stores/groups.svelte";
  import { settings } from "./lib/stores/settings.svelte";
  import { keymap, IS_MAC, type Action } from "./lib/stores/keymap.svelte";
  import { ui } from "./lib/stores/ui.svelte";
  import { copyText } from "./lib/tauri/clipboard";
  import { applyZoom, zoomIn, zoomOut, zoomReset, zoomBy } from "./lib/tauri/zoom";

  let quickOpen = $state(false);
  let settingsOpen = $state(false);
  let unlistenCli: (() => void) | undefined;

  // Mount the terminal lazily on first open, then keep it mounted (just
  // hidden) so toggling the panel never kills running shell sessions.
  let terminalMounted = $state(false);
  $effect(() => {
    if (settings.terminalOpen) terminalMounted = true;
  });

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

    // CLI: `playdown <dir>` — open the launch folder, and respond to later invocations.
    try {
      const launch = await invoke<string | null>("get_launch_path");
      if (launch) await workspace.setRoot(launch);
    } catch {
      /* not launched via CLI */
    }
    unlistenCli = await listen<string>("cli-open", (e) => {
      if (e.payload) void workspace.setRoot(e.payload);
    });

    window.addEventListener("wheel", onWheel, { passive: false });
  });

  onDestroy(() => {
    unlistenCli?.();
    window.removeEventListener("wheel", onWheel);
  });

  // Persist the editor session (layout + open tabs) whenever it changes.
  // Debounced so dragging split dividers doesn't flood the store.
  let sessionTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (!settings.loaded) return;
    const snap = groups.serialize();
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => void settings.setSession(snap), 300);
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
      case "formatDoc": groups.formatActive(); break;
      case "toggleTerminal": settings.toggleTerminal(); break;
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

    // Copy the selected sidebar path with ⌘C/Ctrl+C — unless the user is
    // copying selected text or typing in a form field (then let it pass).
    if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C") && ui.selectedPath) {
      const ae = document.activeElement as HTMLElement | null;
      const tag = ae?.tagName;
      const hasTextSelection = (window.getSelection()?.toString().length ?? 0) > 0;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !hasTextSelection) {
        e.preventDefault();
        void copyText(ui.selectedPath);
        return;
      }
    }

    // Find in the active editor (focus it first so ⌘F works from anywhere).
    if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F") && !e.shiftKey && !e.altKey) {
      if (groups.openSearch()) {
        e.preventDefault();
        return;
      }
    }

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

<ContextMenu />
<PromptModal />

{#snippet mainArea()}
  <main class="main">
    <div class="main-body" class:dock-right={settings.terminalSide === "right"}>
    <div class="editor-area">
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
      </div>
    {:else if groups.layout}
      <Layout node={groups.layout} />
    {/if}
    </div>
    {#if terminalMounted}
      <TerminalPanel hidden={!settings.terminalOpen} />
    {/if}
    </div>
    <StatusBar onOpenSettings={() => (settingsOpen = true)} />
  </main>
{/snippet}

<div class="window">
  <div class="titlebar" data-tauri-drag-region>
    <span class="titlebar-title">📝 Playdown</span>
    {#if groups.activeTab}
      <span class="titlebar-file">— {groups.activeTab.name}</span>
    {/if}
  </div>

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
  </div>
</div>

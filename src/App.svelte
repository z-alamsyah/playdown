<script lang="ts">
  import { onMount } from "svelte";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import TabBar from "./lib/components/TabBar.svelte";
  import EditorPane from "./lib/components/EditorPane.svelte";
  import PreviewPane from "./lib/components/PreviewPane.svelte";
  import StatusBar from "./lib/components/StatusBar.svelte";
  import { workspace } from "./lib/stores/workspace.svelte";
  import { tabs } from "./lib/stores/tabs.svelte";
  import { settings } from "./lib/stores/settings.svelte";

  let sidebarOpen = $state(true);

  onMount(async () => {
    await settings.load();
    if (settings.lastFolder) {
      await workspace.setRoot(settings.lastFolder);
    }
    // Reopen the tabs from the last session.
    for (const path of settings.openTabs) {
      const name = path.split(/[/\\]/).filter(Boolean).pop() ?? path;
      try {
        await tabs.open(path, name);
      } catch {
        /* file may have moved/been deleted — skip */
      }
    }
    tabs.setActive(0);
  });

  // Persist the set of open tabs whenever it changes.
  $effect(() => {
    const paths = tabs.openPaths();
    if (settings.loaded) void settings.setOpenTabs(paths);
  });

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    switch (e.key.toLowerCase()) {
      case "s":
        e.preventDefault();
        void tabs.save();
        break;
      case "e":
        e.preventDefault();
        settings.toggleView();
        break;
      case "b":
        e.preventDefault();
        sidebarOpen = !sidebarOpen;
        break;
      case "o":
        e.preventDefault();
        void workspace.openFolder();
        break;
      case "w":
        if (tabs.activeIndex >= 0) {
          e.preventDefault();
          tabs.close(tabs.activeIndex);
        }
        break;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app">
  {#if sidebarOpen}
    <Sidebar />
  {/if}

  <main class="main">
    <TabBar />
    <div class="pane">
      {#if tabs.active}
        {#key tabs.activeIndex}
          {#if settings.viewMode === "edit"}
            <EditorPane />
          {:else}
            <PreviewPane />
          {/if}
        {/key}
      {:else}
        <div class="empty">
          <div class="empty-logo">📝</div>
          <h1>Playdown</h1>
          <p class="empty-sub">Lightweight markdown editor &amp; viewer</p>
          <button class="primary" onclick={() => workspace.openFolder()}>
            Open Folder
          </button>
          <div class="empty-hints">
            <span><kbd>⌘O</kbd> open folder</span>
            <span><kbd>⌘B</kbd> sidebar</span>
            <span><kbd>⌘E</kbd> toggle view</span>
            <span><kbd>⌘S</kbd> save</span>
          </div>
        </div>
      {/if}
    </div>
    <StatusBar />
  </main>
</div>

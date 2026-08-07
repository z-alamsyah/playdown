<script lang="ts">
  import { settings, TITLEBAR_COLORS } from "../stores/settings.svelte";
  import {
    keymap,
    ACTIONS,
    prettyCombo,
    eventToCombo,
    type Action,
  } from "../stores/keymap.svelte";
  import { zoomIn, zoomOut, zoomReset } from "../tauri/zoom";
  import { invoke } from "@tauri-apps/api/core";
  import type { TitlebarColor } from "../types";

  const titlebarColors = Object.keys(TITLEBAR_COLORS) as TitlebarColor[];

  let cliStatus = $state("");
  async function installCli() {
    cliStatus = "Installing…";
    try {
      const path = await invoke<string>("install_cli");
      cliStatus = `Installed → ${path}`;
    } catch (e) {
      cliStatus = `Failed: ${e}`;
    }
  }

  const INSTALL_CMD =
    "curl -fsSL https://raw.githubusercontent.com/z-alamsyah/playdown-remote/main/install.sh | sh";

  let qrTab = $state(0);
  let phoneError = $state("");
  // Known at open time so the install note shows BEFORE the user toggles.
  let companionInstalled = $state(true);
  $effect(() => {
    void invoke<boolean>("remote_companion_installed").then((v) => (companionInstalled = v));
  });
  function toggleRemote(v: boolean) {
    return async () => {
      phoneError = "";
      qrTab = 0;
      try {
        await settings.setRemoteAccess(v);
      } catch (e) {
        phoneError = String(e);
      }
    };
  }
  async function recheckCompanion() {
    phoneError = "";
    try {
      await settings.tryStartCompanion();
      companionInstalled = !settings.companionMissing;
    } catch (e) {
      phoneError = String(e);
    }
  }
  async function copyText(text: string) {
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  }

  let { onClose }: { onClose: () => void } = $props();

  let capturing = $state<Action | null>(null);

  function onCaptureKey(e: KeyboardEvent) {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      capturing = null;
      return;
    }
    const combo = eventToCombo(e);
    if (!combo) return; // lone modifier — keep waiting
    keymap.set(capturing, combo);
    capturing = null;
  }
</script>

<svelte:window onkeydown={capturing ? onCaptureKey : undefined} />

<div class="modal-backdrop" role="presentation" onclick={onClose}></div>
<div class="modal settings-modal" role="dialog" aria-modal="true">
  <div class="modal-header">
    <h2>Settings</h2>
    <button class="icon-btn" title="Close" onclick={onClose}>×</button>
  </div>

  <div class="modal-body">
    <section>
      <h3>Appearance</h3>
      <div class="setting-row">
        <span>Theme</span>
        <div class="seg">
          <button class:on={settings.theme === "dark"} onclick={() => settings.setTheme("dark")}>🌙 Dark</button>
          <button class:on={settings.theme === "light"} onclick={() => settings.setTheme("light")}>☀️ Light</button>
        </div>
      </div>
      <div class="setting-row">
        <span>Title bar color</span>
        <div class="swatches">
          {#each titlebarColors as c}
            <button
              class="swatch"
              class:on={settings.titlebarColor === c}
              style="--sw: {TITLEBAR_COLORS[c][0]}"
              title={c}
              aria-label={c}
              onclick={() => settings.setTitlebarColor(c)}
            ></button>
          {/each}
        </div>
      </div>
      <div class="setting-row">
        <span>Sidebar position</span>
        <div class="seg">
          <button class:on={settings.sidebarSide === "left"} onclick={() => settings.setSidebarSide("left")}>Left</button>
          <button class:on={settings.sidebarSide === "right"} onclick={() => settings.setSidebarSide("right")}>Right</button>
        </div>
      </div>
      <div class="setting-row">
        <span>Zoom</span>
        <div class="seg">
          <button onclick={zoomOut}>−</button>
          <button onclick={zoomReset}>{Math.round(settings.zoom * 100)}%</button>
          <button onclick={zoomIn}>+</button>
        </div>
      </div>
    </section>

    <section>
      <h3>Command line</h3>
      <div class="setting-row">
        <span>Install <code>playdown</code> command</span>
        <button class="btn-secondary" onclick={installCli}>Install</button>
      </div>
      {#if cliStatus}<p class="muted small">{cliStatus}</p>{/if}
      <p class="muted small">Then run <code>playdown .</code> in any folder from your terminal.</p>
    </section>

    <section>
      <h3>Terminal &amp; agents</h3>
      <div class="setting-row">
        <span>Notify when a background agent needs input / finishes</span>
        <div class="seg">
          <button class:on={settings.agentNotifications} onclick={() => settings.setAgentNotifications(true)}>On</button>
          <button class:on={!settings.agentNotifications} onclick={() => settings.setAgentNotifications(false)}>Off</button>
        </div>
      </div>
      <div class="setting-row">
        <span>Agent command <span class="muted-inline">(“New agent terminal”)</span></span>
        <input
          class="setting-input"
          value={settings.agentCommand}
          onchange={(e) => settings.setAgentCommand((e.currentTarget as HTMLInputElement).value)}
          spellcheck="false"
        />
      </div>
      <div class="setting-row">
        <span>Remote access <span class="muted-inline">(phone · Telegram · companions)</span></span>
        <div class="seg">
          <button class:on={settings.remoteAccess} onclick={toggleRemote(true)}>On</button>
          <button class:on={!settings.remoteAccess} onclick={toggleRemote(false)}>Off</button>
        </div>
      </div>
      {#if phoneError}
        <p class="muted small phone-error">{phoneError}</p>
      {/if}
      {#if !settings.remoteAccess && !companionInstalled}
        <p class="muted small">
          Phone access needs the <a href="https://github.com/z-alamsyah/playdown-remote" target="_blank" rel="noreferrer">playdown-remote</a> companion — install it first:
        </p>
        <p class="muted small qr-url">
          <code>{INSTALL_CMD}</code>
          <button class="btn-secondary" onclick={() => copyText(INSTALL_CMD)}>Copy</button>
        </p>
      {/if}
      {#if settings.remoteAccess && settings.companionMissing}
        <p class="muted small">Bridge is on. For phone access, install the companion:</p>
        <p class="muted small qr-url">
          <code>{INSTALL_CMD}</code>
          <button class="btn-secondary" onclick={() => copyText(INSTALL_CMD)}>Copy</button>
          <button class="btn-secondary" onclick={recheckCompanion}>Check again</button>
        </p>
      {/if}
      {#if settings.remoteAccess && settings.companion}
        <div class="setting-row">
          <span class="muted-inline">Scan from your phone</span>
          <div class="seg">
            {#each settings.companion.urls as u, i (u.url)}
              <button class:on={qrTab === i} onclick={() => (qrTab = i)}>
                {u.kind === "tailscale" ? "Tailscale" : "Wi-Fi"}
              </button>
            {/each}
          </div>
        </div>
        {#if settings.companion.urls[qrTab]}
          {@const cur = settings.companion.urls[qrTab]}
          {#if cur.qr}<pre class="qr">{cur.qr}</pre>{/if}
          <p class="muted small qr-url">
            <code>{cur.url}</code>
            <button class="btn-secondary" onclick={() => copyText(cur.url)}>Copy</button>
          </p>
          <p class="muted small">
            {cur.kind === "tailscale"
              ? "Works from anywhere — both devices on Tailscale."
              : "Phone must be on the same Wi-Fi."} New link on every start.
          </p>
        {/if}
        <div class="setting-row">
          <span>Companion arguments <span class="muted-inline">(optional, e.g. --telegram …)</span></span>
          <input
            class="setting-input"
            value={settings.remoteArgs}
            onchange={(e) => settings.setRemoteArgs((e.currentTarget as HTMLInputElement).value)}
            placeholder="--view-only"
            spellcheck="false"
          />
        </div>
      {/if}
      {#if settings.remoteAccess && settings.bridgeSocket}
        <p class="muted small">Bridge socket: <code>{settings.bridgeSocket}</code> — protocol in <code>BRIDGE_PROTOCOL.md</code></p>
      {/if}
    </section>

    <section>
      <h3>JSON</h3>
      <div class="setting-row">
        <span>Sort keys on format / minify</span>
        <div class="seg">
          <button class:on={settings.jsonSortKeys} onclick={() => settings.setJsonSortKeys(true)}>On</button>
          <button class:on={!settings.jsonSortKeys} onclick={() => settings.setJsonSortKeys(false)}>Off</button>
        </div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h3>Shortcuts</h3>
        <button class="link-btn" onclick={() => keymap.resetAll()}>reset all</button>
      </div>
      <div class="shortcut-list">
        {#each ACTIONS as a (a.id)}
          <div class="shortcut-row">
            <span class="sc-label">{a.label}</span>
            <button
              class="sc-key"
              class:capturing={capturing === a.id}
              onclick={() => (capturing = a.id)}
            >
              {capturing === a.id ? "Press keys…" : prettyCombo(keymap.combo(a.id))}
            </button>
          </div>
        {/each}
      </div>
      <p class="muted small">Click a shortcut, then press the new combo. Esc cancels.</p>
    </section>
  </div>
</div>

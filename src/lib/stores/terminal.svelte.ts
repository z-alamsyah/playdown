/** Agent-at-a-glance status, derived from primary PTY signals:
 *  output flow = working, BEL = blocked (agents ring the bell when they need
 *  input), silence after work in a background tab = done. */
export type TermStatus = "idle" | "working" | "blocked" | "done";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { settings } from "./settings.svelte";
import { notifyNative } from "../tauri/notify";

export interface TermSession {
  id: string;
  /** display label, e.g. "zsh" */
  label: string;
  /** Title set by the running program (OSC), e.g. Claude Code's task title. */
  title?: string;
  /** User-given name (double-click the tab) — wins over title/label. */
  custom?: string;
  /** Command auto-run once the PTY opens ("New agent terminal"). */
  initialCommand?: string;
  status: TermStatus;
  lastOutput: number;
  lastInput: number;
  /** Output bytes since the last 1s tick (rate-based status detection). */
  burstBytes: number;
  /** Consecutive near-silent ticks while "working" (demotion hysteresis). */
  quietTicks: number;
  /** The agent said it's waiting on subagents ("Waiting for … to finish") —
   *  hold "working" through the silence until real output resumes. */
  waitHold: boolean;
}

function uid(): string {
  return crypto.randomUUID();
}

/** Multi-session terminal manager (VSCode-style). PTYs live in Rust;
 *  each session's <TerminalView> owns its xterm + lifecycle. */
class TerminalStore {
  sessions = $state<TermSession[]>([]);
  activeId = $state<string | null>(null);
  shellName = $state("shell");
  /** Bumped to ask the active <TerminalView> to grab keyboard focus. */
  focusSeq = $state(0);

  requestFocus() {
    this.focusSeq++;
  }

  /** Ask the active <TerminalView> to paste text (bracketed paste via xterm,
   *  so multi-line prompts don't auto-execute in the shell). */
  pasteReq = $state<{ seq: number; text: string } | null>(null);

  requestPaste(text: string) {
    this.pasteReq = { seq: (this.pasteReq?.seq ?? 0) + 1, text };
  }

  /** Called by the session that handled the paste, so no other session
   *  replays the request later (e.g. when it becomes active). */
  consumePaste() {
    this.pasteReq = null;
  }

  get active(): TermSession | null {
    return this.sessions.find((s) => s.id === this.activeId) ?? null;
  }

  create(initialCommand?: string): string {
    const id = uid();
    this.sessions.push({
      id,
      label: this.shellName,
      initialCommand,
      status: "idle",
      lastOutput: 0,
      lastInput: 0,
      burstBytes: 0,
      quietTicks: 0,
      waitHold: false,
    });
    this.activeId = id;
    this.ensureTicker();
    this.syncBridge();
    return id;
  }

  /** Display name: user-given > program title > shell label. */
  displayName(s: TermSession): string {
    return s.custom || s.title || s.label;
  }

  rename(id: string, name: string) {
    const s = this.sessions.find((x) => x.id === id);
    if (s) s.custom = name.trim() || undefined;
    this.syncBridge();
  }

  /** Single funnel for status changes — keeps the remote bridge in sync. */
  private setStatus(s: TermSession, status: TermStatus) {
    if (s.status === status) return;
    s.status = status;
    this.syncBridge();
  }

  /** Push the session list (names + statuses) to the Rust bridge, debounced.
   *  No-op when the bridge is off (the command just updates a snapshot). */
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private syncBridge() {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      void invoke("bridge_sync", {
        sessions: this.sessions.map((s) => ({
          id: s.id,
          label: s.label,
          title: s.title ?? null,
          custom: s.custom ?? null,
          status: s.status,
        })),
      }).catch(() => {});
    }, 50);
  }

  setActive(id: string) {
    this.activeId = id;
    // Deliberately does NOT clear statuses: "done" stays green and "blocked"
    // stays red until you actually respond — glancing isn't resolving.
  }

  // ---- agent-at-a-glance status ---------------------------------------------
  // "Working" means the AGENT is processing, not merely that bytes arrived:
  // idle TUIs still repaint their statusline now and then, and title text is
  // no signal either (Claude Code keeps its "✻" in the title even at rest).
  // Status is derived purely from the OUTPUT RATE, with hysteresis in the
  // ticker: a real burst promotes, moderate flow (thinking updates) sustains,
  // sustained near-silence demotes.
  noteOutput(id: string, bytes: number) {
    const s = this.sessions.find((x) => x.id === id);
    if (!s) return;
    const now = Date.now();
    // Output right after a keystroke is just the echo — typing at the shell
    // prompt must not count toward the work burst.
    if (now - s.lastInput < 400) return;
    s.lastOutput = now;
    s.burstBytes += bytes;
  }

  noteBell(id: string) {
    const s = this.sessions.find((x) => x.id === id);
    // During a wait-hold the bell is Claude's "turn ended" notification, not
    // a request for input — the work continues in subagents.
    if (!s || s.waitHold) return;
    const was = s.status;
    this.setStatus(s, "blocked");
    // Surface it when the user isn't looking at this session.
    if (
      was !== "blocked" &&
      settings.agentNotifications &&
      (!document.hasFocus() || s.id !== this.activeId)
    ) {
      void notifyNative("Agent needs input", this.displayName(s));
    }
  }

  /** The agent announced it's waiting on subagents/workflows. */
  noteWaiting(id: string) {
    const s = this.sessions.find((x) => x.id === id);
    if (!s) return;
    s.waitHold = true;
    this.setStatus(s, "working");
    s.quietTicks = 0;
  }

  /** Real keyboard input (mouse/focus reports are filtered by the caller). */
  noteInput(id: string) {
    const s = this.sessions.find((x) => x.id === id);
    if (!s) return;
    s.lastInput = Date.now();
    s.waitHold = false;
    if (s.status === "blocked" || s.status === "done") this.setStatus(s, "idle");
  }

  setTitle(id: string, title: string) {
    const s = this.sessions.find((x) => x.id === id);
    if (s) s.title = title.trim() || undefined;
    this.syncBridge();
  }

  /** 1s tick, rate hysteresis per session:
   *  - promote: >2KB in a tick = real streaming / command output
   *    (idle statusline repaints are a few hundred bytes at most)
   *  - sustain: ≥128B keeps "working" alive (thinking-phase updates)
   *  - demote:  4 consecutive near-silent ticks → done (or idle if active)
   *  Stopped when the last session closes. */
  private ticker: ReturnType<typeof setInterval> | undefined;
  private ensureTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      for (const s of this.sessions) {
        if (s.waitHold) {
          // Waiting on subagents: pin "working" through the silence. Real
          // output resuming (results streaming back) ends the hold.
          if (s.burstBytes >= 512) s.waitHold = false;
          else {
            this.setStatus(s, "working");
            s.quietTicks = 0;
            s.burstBytes = 0;
            continue;
          }
        }
        if (s.status !== "blocked" && s.burstBytes > 2000) {
          this.setStatus(s, "working");
          s.quietTicks = 0;
        } else if (s.status === "working") {
          if (s.burstBytes < 128) {
            if (++s.quietTicks >= 4) {
              const next = s.id === this.activeId ? "idle" : "done";
              this.setStatus(s, next);
              s.quietTicks = 0;
              if (next === "done" && settings.agentNotifications && !document.hasFocus()) {
                void notifyNative("Agent finished", this.displayName(s));
              }
            }
          } else {
            s.quietTicks = 0;
          }
        }
        s.burstBytes = 0;
      }
    }, 1000);
  }

  /** Cycle the active session forward (1) or backward (-1). */
  cycle(dir: 1 | -1) {
    if (this.sessions.length < 2) return;
    const i = this.sessions.findIndex((s) => s.id === this.activeId);
    const cur = i < 0 ? 0 : i;
    const next = (cur + dir + this.sessions.length) % this.sessions.length;
    this.activeId = this.sessions[next].id;
  }

  /** Remove a session; <TerminalView> unmount kills its PTY. */
  close(id: string) {
    const i = this.sessions.findIndex((s) => s.id === id);
    if (i < 0) return;
    this.sessions.splice(i, 1);
    if (this.activeId === id) {
      this.activeId = this.sessions[Math.max(0, i - 1)]?.id ?? null;
    }
    if (this.sessions.length === 0 && this.ticker) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
    this.syncBridge();
  }

  ensureOne() {
    if (this.sessions.length === 0) this.create();
  }
}

export const terminal = new TerminalStore();

// Remote bridge tab management (see BRIDGE_PROTOCOL.md): companions ask to
// open/close tabs; sessions are owned by the UI, so the requests land here.
// "open" is handled by the main window only — the emit reaches every window,
// and without the filter each one would spawn a tab. "close" is by unique id,
// so exactly the window owning that session acts on it.
void listen<{ agent: boolean }>("bridge://open", (e) => {
  if (getCurrentWebviewWindow().label !== "main") return;
  settings.setTerminalOpen(true);
  terminal.create(e.payload.agent ? settings.agentCommand || "claude" : undefined);
});
void listen<string>("bridge://close", (e) => {
  if (terminal.sessions.some((s) => s.id === e.payload)) terminal.close(e.payload);
});

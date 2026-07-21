import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { StateField, StateEffect, Compartment } from "@codemirror/state";
import { presentableDiff } from "@codemirror/merge";

/** VSCode-style change indicators in the editor gutter: lines added /
 *  modified / deleted vs the file's HEAD version. Loaded dynamically so
 *  @codemirror/merge stays out of the cold-start bundle. */

type LineStatus = "added" | "modified" | "deleted";

const setStatuses = StateEffect.define<Map<number, LineStatus>>();

const statusField = StateField.define<Map<number, LineStatus>>({
  create: () => new Map(),
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setStatuses)) return e.value;
    return value;
  },
});

class Mark extends GutterMarker {
  constructor(private cls: string) {
    super();
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = `git-mark ${this.cls}`;
    return el;
  }
}

function compute(head: string, view: EditorView): Map<number, LineStatus> {
  const doc = view.state.doc;
  const map = new Map<number, LineStatus>();
  for (const ch of presentableDiff(head, doc.toString())) {
    if (ch.fromB === ch.toB) {
      // Pure deletion — mark the line at the deletion point.
      const n = doc.lineAt(Math.min(ch.fromB, doc.length)).number;
      if (!map.has(n)) map.set(n, "deleted");
    } else {
      const st: LineStatus = ch.fromA === ch.toA ? "added" : "modified";
      const from = doc.lineAt(Math.min(ch.fromB, doc.length)).number;
      const to = doc.lineAt(Math.min(Math.max(ch.toB - 1, ch.fromB), doc.length)).number;
      for (let n = from; n <= to; n++) map.set(n, st);
    }
  }
  return map;
}

export interface GitGutterHandle {
  /** Swap the HEAD baseline (after a commit) and recompute. */
  refreshHead(head: string): void;
  detach(): void;
}

export function attachGitGutter(
  view: EditorView,
  initialHead: string,
  onOpenDiff: () => void,
): GitGutterHandle {
  let head = initialHead;
  let destroyed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const recompute = () => {
    if (destroyed) return;
    view.dispatch({ effects: setStatuses.of(compute(head, view)) });
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(recompute, 300);
  };

  const comp = new Compartment();
  const ext = [
    statusField,
    gutter({
      class: "cm-git-gutter",
      lineMarker(v, line) {
        const st = v.state
          .field(statusField, false)
          ?.get(v.state.doc.lineAt(line.from).number);
        return st ? new Mark(st) : null;
      },
      lineMarkerChange: (u) =>
        u.docChanged || u.transactions.some((t) => t.effects.some((e) => e.is(setStatuses))),
      domEventHandlers: {
        mousedown() {
          onOpenDiff();
          return true;
        },
      },
    }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) schedule();
    }),
  ];
  view.dispatch({ effects: StateEffect.appendConfig.of(comp.of(ext)) });
  recompute();

  return {
    refreshHead(newHead: string) {
      head = newHead;
      schedule();
    },
    detach() {
      destroyed = true;
      clearTimeout(timer);
      try {
        view.dispatch({ effects: comp.reconfigure([]) });
      } catch {
        /* view already destroyed */
      }
    },
  };
}

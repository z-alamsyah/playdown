import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import { foldService } from "@codemirror/language";

/** Locate a leading `--- ... ---` YAML frontmatter block, if present. */
function frontmatterRange(state: EditorState): { from: number; to: number } | null {
  if (state.doc.lines < 2) return null;
  const first = state.doc.line(1);
  if (first.text.trim() !== "---") return null;
  for (let i = 2; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (line.text.trim() === "---") {
      return { from: first.from, to: line.to };
    }
  }
  return null;
}

const fmLine = Decoration.line({ class: "cm-frontmatter" });

const frontmatterDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const range = frontmatterRange(view.state);
      if (range) {
        let pos = range.from;
        while (pos <= range.to) {
          const line = view.state.doc.lineAt(pos);
          builder.add(line.from, line.from, fmLine);
          if (line.to + 1 > view.state.doc.length) break;
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

/** Make the frontmatter block foldable from its first line. */
const frontmatterFold = foldService.of((state, lineStart) => {
  const first = state.doc.line(1);
  if (lineStart !== first.from) return null;
  const range = frontmatterRange(state);
  if (range && range.from === lineStart) {
    return { from: first.to, to: range.to };
  }
  return null;
});

export const frontmatterExtension: Extension = [frontmatterDecorations, frontmatterFold];

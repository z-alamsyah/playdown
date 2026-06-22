export interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  separator?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export interface PromptState {
  title: string;
  placeholder?: string;
  value?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
}

/** Transient UI: context menu, prompt modal, sidebar selection. */
class UI {
  menu = $state<ContextMenuState | null>(null);
  prompt = $state<PromptState | null>(null);
  /** Currently selected node in the sidebar tree (for ⌘C copy path, etc.). */
  selectedPath = $state<string | null>(null);
  selectedIsDir = $state(false);

  select(path: string, isDir: boolean) {
    this.selectedPath = path;
    this.selectedIsDir = isDir;
  }

  showMenu(x: number, y: number, items: MenuItem[]) {
    this.menu = { x, y, items };
  }
  closeMenu() {
    this.menu = null;
  }

  showPrompt(state: PromptState) {
    this.prompt = state;
  }
  closePrompt() {
    this.prompt = null;
  }
}

export const ui = new UI();

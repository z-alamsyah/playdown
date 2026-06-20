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

/** Transient UI: context menu and prompt modal. */
class UI {
  menu = $state<ContextMenuState | null>(null);
  prompt = $state<PromptState | null>(null);

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

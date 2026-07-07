<script lang="ts">
  import { ui } from "../stores/ui.svelte";
  import { IS_MAC } from "../stores/keymap.svelte";

  const prompt = $derived(ui.prompt);

  let value = $state("");
  let inputEl = $state<HTMLInputElement>();
  let taEl = $state<HTMLTextAreaElement>();

  // Seed + focus when a prompt opens.
  $effect(() => {
    if (prompt) {
      value = prompt.value ?? "";
      if (prompt.multiline) {
        taEl?.focus();
      } else {
        inputEl?.focus();
        inputEl?.select();
      }
    }
  });

  function submit() {
    const p = ui.prompt;
    if (p && value.trim()) p.onSubmit(value.trim());
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      ui.closePrompt();
    }
  }

  // Textarea: Enter inserts a newline; Cmd/Ctrl+Enter submits.
  function onTaKey(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      ui.closePrompt();
    }
  }
</script>

{#if prompt}
  <div class="modal-backdrop" role="presentation" onclick={() => ui.closePrompt()}></div>
  <div class="modal prompt-modal" role="dialog" aria-modal="true">
    <div class="modal-header"><h2>{prompt.title}</h2></div>
    <div class="modal-body">
      {#if prompt.detail}
        <div class="prompt-detail">{prompt.detail}</div>
      {/if}
      {#if prompt.multiline}
        <textarea
          bind:this={taEl}
          bind:value
          placeholder={prompt.placeholder ?? ""}
          onkeydown={onTaKey}
          spellcheck="false"
        ></textarea>
        <p class="muted small prompt-hint">{IS_MAC ? "⌘↵" : "Ctrl+Enter"} to submit</p>
      {:else}
        <input
          bind:this={inputEl}
          bind:value
          placeholder={prompt.placeholder ?? ""}
          onkeydown={onKey}
          spellcheck="false"
          autocomplete="off"
        />
      {/if}
      <div class="prompt-actions">
        <button class="btn-secondary" onclick={() => ui.closePrompt()}>Cancel</button>
        <button class="btn-primary" onclick={submit}>{prompt.confirmLabel ?? "OK"}</button>
      </div>
    </div>
  </div>
{/if}

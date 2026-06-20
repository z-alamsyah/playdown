<script lang="ts">
  import { ui } from "../stores/ui.svelte";

  const prompt = $derived(ui.prompt);

  let value = $state("");
  let inputEl = $state<HTMLInputElement>();

  // Seed + focus when a prompt opens.
  $effect(() => {
    if (prompt) {
      value = prompt.value ?? "";
      inputEl?.focus();
      inputEl?.select();
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
</script>

{#if prompt}
  <div class="modal-backdrop" role="presentation" onclick={() => ui.closePrompt()}></div>
  <div class="modal prompt-modal" role="dialog" aria-modal="true">
    <div class="modal-header"><h2>{prompt.title}</h2></div>
    <div class="modal-body">
      <input
        bind:this={inputEl}
        bind:value
        placeholder={prompt.placeholder ?? ""}
        onkeydown={onKey}
        spellcheck="false"
        autocomplete="off"
      />
      <div class="prompt-actions">
        <button class="btn-secondary" onclick={() => ui.closePrompt()}>Cancel</button>
        <button class="btn-primary" onclick={submit}>{prompt.confirmLabel ?? "OK"}</button>
      </div>
    </div>
  </div>
{/if}

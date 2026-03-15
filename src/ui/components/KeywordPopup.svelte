<script lang="ts">
  import { getKeywordDefinition } from '../../data/keywords'

  interface Props {
    keywordId: string
    x: number
    y: number
    ondismiss: () => void
  }

  let { keywordId, x, y, ondismiss }: Props = $props()

  const def = $derived(getKeywordDefinition(keywordId))
</script>

{#if def}
  <button class="keyword-backdrop" aria-label="Dismiss keyword tooltip" onclick={ondismiss}></button>
  <div
    class="keyword-popup"
    style="left: {Math.min(x, window.innerWidth - 200)}px; top: {Math.max(y - 80, 8)}px;"
    role="tooltip"
  >
    <div class="keyword-name">{def.name}</div>
    <div class="keyword-desc">{def.description}</div>
  </div>
{/if}

<style>
  .keyword-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 199;
    border: none;
    padding: 0;
    cursor: default;
  }

  .keyword-popup {
    position: fixed;
    z-index: 200;
    max-width: 200px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 8px;
    padding: 8px 10px;
    pointer-events: auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  .keyword-name {
    font-size: 13px;
    font-weight: 800;
    color: #fbbf24;
    margin-bottom: 4px;
  }

  .keyword-desc {
    font-size: 11px;
    color: #e2e8f0;
    line-height: 1.4;
  }
</style>

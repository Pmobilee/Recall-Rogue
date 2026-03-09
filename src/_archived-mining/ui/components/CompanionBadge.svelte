<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { getSpeciesById } from '../../data/fossils'

  /** Derived: currently active companion species, or null. */
  const companion = $derived.by(() => {
    const save = $playerSave
    if (!save?.activeCompanion) return null
    return getSpeciesById(save.activeCompanion) ?? null
  })
</script>

{#if companion}
  <div class="companion-badge" aria-label="Active companion: {companion.name}">
    <div class="companion-icon" aria-hidden="true">{companion.icon}</div>
    <div class="companion-info">
      <div class="companion-name">{companion.name}</div>
      {#if companion.companionBonus}
        <div class="companion-bonus">{companion.companionBonus}</div>
      {/if}
    </div>
    <div class="companion-label" aria-hidden="true">Companion</div>
  </div>
{:else}
  <div class="companion-badge companion-empty" aria-label="No active companion">
    <div class="companion-icon empty-icon" aria-hidden="true">?</div>
    <div class="companion-info">
      <div class="companion-name-empty">No companion</div>
      <div class="companion-bonus-empty">Revive a fossil to set one</div>
    </div>
  </div>
{/if}

<style>
  .companion-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: color-mix(in srgb, #d4a574 14%, var(--color-surface) 86%);
    border: 1px solid rgba(212, 165, 116, 0.45);
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(212, 165, 116, 0.15), inset 0 0 12px rgba(212, 165, 116, 0.05);
    font-family: 'Courier New', monospace;
    position: relative;
  }

  .companion-empty {
    background: color-mix(in srgb, var(--color-bg) 40%, var(--color-surface) 60%);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: none;
    opacity: 0.65;
  }

  .companion-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
    filter: drop-shadow(0 0 4px rgba(212, 165, 116, 0.4));
  }

  .empty-icon {
    font-size: 1.4rem;
    color: var(--color-text-dim);
    filter: none;
    opacity: 0.45;
    width: 2rem;
    text-align: center;
  }

  .companion-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .companion-name {
    color: #d4a574;
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .companion-name-empty {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .companion-bonus {
    color: #c89060;
    font-size: 0.72rem;
    font-style: italic;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .companion-bonus-empty {
    color: var(--color-text-dim);
    font-size: 0.68rem;
    font-style: italic;
    line-height: 1.3;
    opacity: 0.7;
  }

  .companion-label {
    position: absolute;
    top: 5px;
    right: 10px;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(212, 165, 116, 0.55);
  }
</style>

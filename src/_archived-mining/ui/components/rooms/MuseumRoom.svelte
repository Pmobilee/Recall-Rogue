<script lang="ts">
  import { playerSave } from '../../stores/playerData'
  import { audioManager } from '../../../services/audioService'

  interface Props {
    onBack?: () => void
    onFossils?: () => void
    onZoo?: () => void
  }

  let { onBack, onFossils, onZoo }: Props = $props()

  const fossilsRecord = $derived($playerSave?.fossils ?? {})
  const discoveredFossilCount = $derived(Object.keys(fossilsRecord).length)
  const revivedFossilCount = $derived(Object.values(fossilsRecord).filter(f => f.revived).length)

  function handleFossils(): void {
    audioManager.playSound('button_click')
    onFossils?.()
  }

  function handleZoo(): void {
    audioManager.playSound('button_click')
    onZoo?.()
  }
</script>

<!-- ========== MUSEUM ========== -->
{#if onBack}
  <button class="back-btn" type="button" onclick={onBack}>← Back</button>
{/if}
<div class="card room-header-card">
  <div class="room-header-info">
    <span class="room-header-icon" aria-hidden="true">🏛️</span>
    <div>
      <h2 class="room-header-title">Museum</h2>
      <p class="room-header-desc">Your fossil discoveries and companions</p>
    </div>
  </div>
</div>

<div class="card museum-progress-card" aria-label="Fossil collection progress">
  <div class="museum-progress-header">
    <h2>Fossil Collection</h2>
    <span class="museum-progress-count">{discoveredFossilCount} species found</span>
  </div>
  {#if discoveredFossilCount === 0}
    <p class="empty-note">No fossils discovered yet. Dig deep — fossils appear below 35% depth.</p>
  {:else}
    <p class="museum-revived-summary">Revived: {revivedFossilCount} / {discoveredFossilCount}</p>
  {/if}
</div>

<div class="card actions-card" aria-label="Museum actions">
  <button class="action-button fossil-button" type="button" onclick={handleFossils}>
    <span>Fossil Gallery</span>
    {#if discoveredFossilCount > 0}
      <span class="fossil-count">{revivedFossilCount}/{discoveredFossilCount}</span>
    {:else}
      <span class="empty-note">No fossils yet</span>
    {/if}
  </button>

  <button class="action-button zoo-button" type="button" onclick={handleZoo} aria-label="Visit The Zoo">
    <span>The Zoo</span>
    {#if revivedFossilCount > 0}
      <span class="zoo-count">{revivedFossilCount}/10</span>
    {:else}
      <span class="empty-note">No companions yet</span>
    {/if}
  </button>
</div>

<div class="card museum-zoo-card" aria-label="Companion Zoo">
  <h2>Companion Zoo</h2>
  <p class="empty-note museum-zoo-placeholder">Revive fossils in the gallery to add companions to your zoo.</p>
</div>

<style>
  .back-btn {
    background: none;
    border: 1px solid var(--border-color, #444);
    color: var(--text-primary, #e0e0e0);
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    align-self: flex-start;
    margin-bottom: 0.5rem;
  }
  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
  }

  h2 {
    color: var(--color-text);
    font-size: 1rem;
    margin: 0 0 10px;
  }

  .room-header-card {
    margin: 8px 8px 4px;
    padding: 12px 16px;
  }

  .room-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .room-header-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .room-header-title {
    color: var(--color-warning);
    font-size: 1.1rem;
    margin: 0 0 2px;
  }

  .room-header-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    margin: 0;
    line-height: 1.3;
  }

  .museum-progress-card {
    min-height: 80px;
  }

  .museum-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .museum-progress-header h2 {
    margin-bottom: 0;
  }

  .museum-progress-count {
    color: #d4a574;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .museum-revived-summary {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    margin-top: 4px;
  }

  .actions-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-button {
    min-height: 56px;
    border: 0;
    border-radius: 12px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    cursor: pointer;
  }

  .action-button:active {
    transform: translateY(1px);
  }

  .fossil-button {
    background: color-mix(in srgb, #d4a574 28%, var(--color-surface) 72%);
  }

  .fossil-count {
    min-width: 28px;
    height: 28px;
    border-radius: 999px;
    background: rgba(212, 165, 116, 0.3);
    color: #d4a574;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 0 8px;
  }

  .zoo-button {
    background: color-mix(in srgb, #0d9488 28%, var(--color-surface) 72%);
    border: 1px solid rgba(13, 148, 136, 0.4);
  }

  .zoo-count {
    min-width: 28px;
    height: 28px;
    border-radius: 999px;
    background: rgba(0, 210, 180, 0.22);
    color: #00d2b4;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 0 8px;
  }

  .empty-note {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  .museum-zoo-card {
    margin-bottom: 20px;
  }

  .museum-zoo-placeholder {
    margin-top: 4px;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .action-button {
      font-size: 1rem;
    }
  }
</style>

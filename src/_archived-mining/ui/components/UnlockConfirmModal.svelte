<script lang="ts">
  import type { HubFloor } from '../../data/hubLayout'

  interface Props {
    floor: HubFloor
    onConfirm: (floorId: string) => void
    onCancel: () => void
  }

  const { floor, onConfirm, onCancel }: Props = $props()

  const req = $derived(floor.unlockRequirements)
</script>

<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Unlock Floor">
  <div class="modal-panel">
    <h2 class="modal-title">Unlock {floor.name}?</h2>
    <p class="modal-desc">{floor.description}</p>

    {#if req}
      <div class="cost-section">
        <h3>Cost</h3>
        {#if req.dustCost}
          <span class="cost-line">💎 {req.dustCost} dust</span>
        {/if}
      </div>
    {/if}

    <div class="modal-buttons">
      <button class="confirm-btn" onclick={() => onConfirm(floor.id)}>Confirm Unlock</button>
      <button class="cancel-btn" onclick={onCancel}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 260;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Press Start 2P', monospace;
  }
  .modal-panel {
    background: #1a1a2e;
    border: 2px solid #4ecca3;
    border-radius: 8px;
    padding: 24px;
    max-width: 320px;
    width: 90%;
    text-align: center;
  }
  .modal-title { color: #e0c97f; font-size: 12px; margin: 0 0 12px; }
  .modal-desc { color: #aaa; font-size: 8px; margin: 0 0 16px; line-height: 1.5; }
  .cost-section h3 { color: #4ecca3; font-size: 9px; margin: 0 0 8px; }
  .cost-line { color: #ccc; font-size: 8px; }
  .modal-buttons { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
  .confirm-btn {
    padding: 12px;
    background: #4ecca3;
    color: #0a0a1a;
    border: none;
    border-radius: 4px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    min-height: 44px;
  }
  .cancel-btn {
    padding: 8px;
    background: none;
    border: 1px solid #444;
    color: #888;
    border-radius: 4px;
    font-family: inherit;
    font-size: 8px;
    cursor: pointer;
  }
</style>

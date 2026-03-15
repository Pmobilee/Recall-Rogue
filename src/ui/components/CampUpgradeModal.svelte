<script lang="ts">
  import { playerSave } from '../stores/playerData'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  let dustBalance = $derived($playerSave?.minerals.dust ?? 0)
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose}>
  <div class="modal-card" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>Camp Shop</h2>
      <button type="button" class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
    </div>

    <div class="dust-display">
      <span class="dust-pill">✦ {dustBalance} Dust</span>
    </div>

    <div class="empty-state">
      <div class="empty-icon">🏕️</div>
      <p class="empty-title">Camp upgrades coming soon!</p>
      <p class="empty-desc">Spend dust to upgrade your camp, unlock companions, and customize your look. Check back later.</p>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-card {
    background: #0f172a;
    border: 1px solid rgba(148, 163, 184, 0.34);
    border-radius: 16px;
    max-width: 400px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    padding: 16px;
    color: #e2e8f0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: #ffe0a6;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(30, 41, 59, 0.8);
    color: #e2e8f0;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dust-display {
    margin-bottom: 16px;
  }

  .dust-pill {
    display: inline-block;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 214, 143, 0.5);
    background: rgba(54, 38, 22, 0.7);
    color: #ffd89d;
    font-size: 13px;
    font-weight: 700;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: #fbbf24;
    margin: 0 0 8px;
  }

  .empty-desc {
    font-size: 13px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.5;
    max-width: 280px;
  }
</style>

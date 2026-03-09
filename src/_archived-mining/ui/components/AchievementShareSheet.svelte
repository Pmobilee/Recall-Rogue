<script lang="ts">
  import { sharePainting } from '../../services/shareService'
  import type { Painting } from '../../data/paintings'
  import { TIER_VISUALS } from '../../data/achievementTiers'

  let { painting, onClose }: {
    painting: Painting & { unlocked: boolean }
    onClose: () => void
  } = $props()

  let status: 'idle' | 'exporting' | 'success' | 'error' = $state('idle')
  const visuals = $derived(TIER_VISUALS[painting.tier])

  async function handleExport() {
    status = 'exporting'
    const ok = await sharePainting(painting)
    status = ok ? 'success' : 'error'
    if (ok) setTimeout(onClose, 1500)
  }
</script>

<div
  class="sheet-backdrop"
  onclick={(e) => { if (e.target === e.currentTarget) onClose() }}
  onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
  role="button"
  aria-label="Close share sheet"
  tabindex="0"
>
  <div class="sheet" role="dialog" aria-label="Share painting" tabindex="-1">
    <h2 class="sheet-title" style="color: {visuals.badgeColor}">Share Achievement</h2>

    <img
      class="preview-img"
      src="/assets/sprites-hires/dome/{painting.spriteKey}.png"
      alt="{painting.title} preview"
      draggable="false"
    />

    <p class="painting-name">{painting.title}</p>
    <p class="sheet-hint">Save a composited card image to your device or share directly.</p>

    {#if status === 'idle'}
      <button class="export-btn" onclick={handleExport}>
        Save to Gallery
      </button>
    {:else if status === 'exporting'}
      <p class="status-text">Compositing card...</p>
    {:else if status === 'success'}
      <p class="status-text success">Saved!</p>
    {:else}
      <p class="status-text error">Export failed. Try again.</p>
      <button class="export-btn" onclick={handleExport}>Retry</button>
    {/if}

    <button class="cancel-btn" onclick={onClose}>Cancel</button>
  </div>
</div>

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .sheet {
    background: #1a1a2e;
    border-top: 2px solid #2a2a4a;
    border-radius: 8px 8px 0 0;
    padding: 24px 20px 32px;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    font-family: 'Press Start 2P', monospace;
  }

  .sheet-title { font-size: 11px; margin: 0; }

  .preview-img {
    width: 120px;
    height: 120px;
    object-fit: contain;
    image-rendering: pixelated;
    border: 2px solid #2a2a4a;
    border-radius: 3px;
  }

  .painting-name { font-size: 10px; color: #c0c0d0; margin: 0; }
  .sheet-hint { font-size: 8px; color: #666; text-align: center; line-height: 1.7; margin: 0; }

  .export-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    background: #4ecca3;
    color: #0a0a0a;
    border: none;
    padding: 10px 24px;
    cursor: pointer;
    border-radius: 3px;
  }

  .cancel-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    background: transparent;
    border: 1px solid #444;
    color: #888;
    padding: 8px 16px;
    cursor: pointer;
    border-radius: 3px;
  }

  .status-text { font-size: 9px; color: #c8c8e8; margin: 0; }
  .success { color: #4ecca3; }
  .error   { color: #e05050; }
</style>

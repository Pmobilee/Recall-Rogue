<script lang="ts">
  /**
   * AchievementGalleryView.svelte
   *
   * Full-screen gallery view showing all 20 paintings in a responsive grid.
   * Locked paintings appear as greyscale silhouettes with a "???" title.
   * Unlocked paintings show color art, title, tier badge, and a share button.
   */
  import { allPaintings, completionStats } from '../stores/achievements'
  import PaintingCard from './PaintingCard.svelte'
  import AchievementShareSheet from './AchievementShareSheet.svelte'
  import { TIER_ORDER, type AchievementTier } from '../../data/achievementTiers'
  import type { Painting } from '../../data/paintings'

  /** Emit 'close' to the parent (HubView) to dismiss this view. */
  let { onClose }: { onClose: () => void } = $props()

  let selectedPainting: (Painting & { unlocked: boolean }) | null = $state(null)
  let showShare = $state(false)

  /** Group paintings by tier for display */
  const grouped = $derived(
    TIER_ORDER.reduce((acc, tier) => {
      acc[tier] = $allPaintings.filter(p => p.tier === tier)
      return acc
    }, {} as Record<AchievementTier, (Painting & { unlocked: boolean })[]>)
  )

  function openCard(painting: Painting & { unlocked: boolean }) {
    selectedPainting = painting
  }

  function handleShare() {
    if (selectedPainting?.unlocked) showShare = true
  }

  function closeCard() {
    selectedPainting = null
    showShare = false
  }
</script>

<div class="gallery-view">
  <header class="gallery-header">
    <button class="back-btn" onclick={onClose} aria-label="Close gallery">◀ Back</button>
    <h1>Achievement Gallery</h1>
    <span class="completion-badge">
      {$completionStats.unlocked}/{$completionStats.total}
      ({$completionStats.percentage}%)
    </span>
  </header>

  <div class="gallery-scroll">
    {#each TIER_ORDER as tier}
      <section class="tier-section">
        <h2 class="tier-heading tier-{tier}">{tier.toUpperCase()}</h2>
        <div class="painting-grid">
          {#each grouped[tier] ?? [] as painting (painting.id)}
            <PaintingCard
              {painting}
              onclick={() => openCard(painting)}
            />
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <!-- Detail panel -->
  {#if selectedPainting}
    <div class="detail-panel" role="dialog" aria-label="Painting detail">
      <button class="close-btn" onclick={closeCard} aria-label="Close detail">✕</button>
      <img
        class="detail-image"
        src="/assets/sprites-hires/dome/{selectedPainting.unlocked ? selectedPainting.spriteKey : selectedPainting.silhouetteKey}.png"
        alt={selectedPainting.unlocked ? selectedPainting.title : 'Locked painting'}
        draggable="false"
      />
      <h2 class="detail-title">
        {selectedPainting.unlocked ? selectedPainting.title : '???'}
      </h2>
      {#if selectedPainting.unlocked}
        <p class="detail-desc">{selectedPainting.description}</p>
        <p class="detail-gaia"><span class="gaia-label">G.A.I.A.:</span> {selectedPainting.gaiaComment}</p>
        <button class="share-btn" onclick={handleShare}>Save to Gallery</button>
      {:else}
        <p class="detail-locked">Complete your journey to reveal this painting.</p>
      {/if}
    </div>
  {/if}

  {#if showShare && selectedPainting}
    <AchievementShareSheet
      painting={selectedPainting}
      onClose={() => { showShare = false }}
    />
  {/if}
</div>

<style>
  .gallery-view {
    position: fixed;
    inset: 0;
    z-index: 800;
    background: #0e0e1a;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Press Start 2P', monospace;
  }

  .gallery-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #1a1a2e;
    border-bottom: 2px solid #2a2a4a;
    flex-shrink: 0;
  }

  h1 {
    font-size: 12px;
    color: #ffe8a0;
    margin: 0;
    flex: 1;
    text-align: center;
  }

  .back-btn, .close-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    background: transparent;
    border: 1px solid #4a4a6a;
    color: #c8c8e8;
    padding: 6px 10px;
    cursor: pointer;
    border-radius: 2px;
  }

  .completion-badge {
    font-size: 8px;
    color: #888;
    white-space: nowrap;
  }

  .gallery-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .tier-section { display: flex; flex-direction: column; gap: 12px; }

  .tier-heading {
    font-size: 10px;
    margin: 0;
    letter-spacing: 2px;
  }

  .tier-bronze  { color: #cd7f32; }
  .tier-silver  { color: #c0c0c0; }
  .tier-gold    { color: #ffd700; }
  .tier-platinum { color: #e5e4e2; }

  .painting-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .detail-panel {
    position: fixed;
    inset: 0;
    z-index: 850;
    background: rgba(10, 10, 26, 0.96);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
  }

  .detail-image {
    width: min(280px, 70vw);
    height: min(280px, 70vw);
    object-fit: contain;
    image-rendering: pixelated;
    border: 3px solid #4a4a6a;
    border-radius: 4px;
  }

  .detail-title { font-size: 12px; color: #ffe8a0; margin: 0; text-align: center; }
  .detail-desc  { font-size: 8px; color: #a0a0c0; max-width: 400px; text-align: center; line-height: 1.8; margin: 0; }
  .detail-gaia  { font-size: 8px; color: #c8f0e8; max-width: 400px; text-align: center; line-height: 1.8; margin: 0; }
  .detail-locked{ font-size: 9px; color: #555; text-align: center; margin: 0; }
  .gaia-label   { color: #4ecca3; }

  .share-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    background: #4ecca3;
    color: #0a0a0a;
    border: none;
    padding: 10px 20px;
    cursor: pointer;
    border-radius: 3px;
    margin-top: 8px;
  }

  .share-btn:active { transform: scale(0.97); }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
  }
</style>

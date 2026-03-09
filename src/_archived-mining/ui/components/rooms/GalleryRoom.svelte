<script lang="ts">
  import { achievementManager } from '../../../game/managers/AchievementManager'

  export let onClose: (() => void) | undefined = undefined

  let paintings = achievementManager.getAllPaintings()
  let selectedPainting: (typeof paintings)[0] | null = null
  let stats = achievementManager.getCompletionStats()

  function selectPainting(p: (typeof paintings)[0]): void {
    if (p.unlocked) selectedPainting = p
  }

  function closeDetail(): void {
    selectedPainting = null
  }
</script>

<div class="gallery-room">
  <div class="gallery-header">
    <button class="back-btn" on:click={onClose} aria-label="Back">&larr;</button>
    <h2>Paintings Gallery</h2>
    <span class="completion">{stats.unlocked}/{stats.total} ({stats.percentage}%)</span>
  </div>

  {#if selectedPainting}
    <div
      class="painting-detail"
      on:click={(e) => { if (e.target === e.currentTarget) closeDetail() }}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === 'Escape' && closeDetail()}
    >
      <div class="detail-card">
        <div class="painting-frame {selectedPainting.rarity}">
          <div class="painting-image" style="background-image: url(/sprites/{selectedPainting.spriteKey}.png)"></div>
        </div>
        <h3 class="painting-title">{selectedPainting.title}</h3>
        <p class="painting-desc">{selectedPainting.description}</p>
        <p class="gaia-quote">"{selectedPainting.gaiaComment}"</p>
        <span class="rarity-badge {selectedPainting.rarity}">{selectedPainting.rarity}</span>
        <button class="close-detail-btn" on:click={closeDetail}>Close</button>
      </div>
    </div>
  {/if}

  <div class="gallery-grid">
    {#each paintings as painting}
      <button
        class="gallery-slot"
        class:unlocked={painting.unlocked}
        class:locked={!painting.unlocked}
        on:click={() => selectPainting(painting)}
        aria-label={painting.unlocked ? painting.title : 'Locked painting'}
      >
        {#if painting.unlocked}
          <div class="painting-thumb {painting.rarity}" style="background-image: url(/sprites/{painting.spriteKey}.png)"></div>
          <span class="thumb-title">{painting.title}</span>
        {:else}
          <div class="painting-thumb locked-thumb">
            <span class="lock-icon">&#x1F512;</span>
          </div>
          <span class="thumb-title">???</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .gallery-room { padding: 16px; pointer-events: auto; height: 100%; overflow-y: auto; }
  .gallery-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .back-btn { background: none; border: none; color: #e94560; font-size: 20px; cursor: pointer; padding: 4px 8px; }
  .gallery-header h2 { font-family: 'Press Start 2P', monospace; font-size: 12px; color: #e94560; margin: 0; flex: 1; }
  .completion { font-size: 11px; color: #888; }
  .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .gallery-slot {
    background: #0f3460; border-radius: 8px; padding: 8px; cursor: pointer;
    border: 2px solid transparent; transition: border-color 0.3s; text-align: center;
  }
  .gallery-slot.unlocked:hover { border-color: #e94560; }
  .gallery-slot.locked { opacity: 0.5; cursor: default; }
  .painting-thumb {
    width: 100%; aspect-ratio: 1; border-radius: 6px;
    background-size: cover; background-position: center; background-color: #1a1a2e;
    display: flex; align-items: center; justify-content: center;
  }
  .locked-thumb { background: #1a1a2e; }
  .lock-icon { font-size: 24px; opacity: 0.5; }
  .thumb-title { display: block; font-size: 9px; color: #ccc; margin-top: 6px; font-family: 'Press Start 2P', monospace; }
  .painting-thumb.common { border: 2px solid #aaa; }
  .painting-thumb.uncommon { border: 2px solid #2ecc71; }
  .painting-thumb.rare { border: 2px solid #3498db; }
  .painting-thumb.epic { border: 2px solid #9b59b6; }
  .painting-thumb.legendary { border: 2px solid #f39c12; }
  .painting-thumb.mythic { border: 2px solid #e94560; }

  .painting-detail {
    position: fixed; inset: 0; background: rgba(0,0,0,0.9);
    display: flex; align-items: center; justify-content: center;
    z-index: 210; pointer-events: auto;
  }
  .detail-card { background: #16213e; border-radius: 10px; padding: 24px; max-width: 340px; width: 90%; text-align: center; }
  .painting-frame { width: 200px; height: 200px; margin: 0 auto 16px; border-radius: 8px; overflow: hidden; }
  .painting-frame.legendary { border: 3px solid #f39c12; box-shadow: 0 0 20px rgba(243,156,18,0.3); }
  .painting-frame.mythic { border: 3px solid #e94560; box-shadow: 0 0 20px rgba(233,69,96,0.3); }
  .painting-image { width: 100%; height: 100%; background-size: cover; background-position: center; background-color: #0f3460; }
  .painting-title { font-family: 'Press Start 2P', monospace; font-size: 12px; color: #e0e0e0; margin: 0 0 8px; }
  .painting-desc { color: #a0a0a0; font-size: 12px; line-height: 1.5; margin: 0 0 10px; }
  .gaia-quote { color: #e94560; font-style: italic; font-size: 11px; margin: 0 0 12px; }
  .rarity-badge {
    display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 9px;
    font-family: 'Press Start 2P', monospace; text-transform: uppercase; margin-bottom: 12px;
  }
  .rarity-badge.common { background: #333; color: #aaa; }
  .rarity-badge.uncommon { background: #1a4a2a; color: #2ecc71; }
  .rarity-badge.rare { background: #1a3a5a; color: #3498db; }
  .rarity-badge.epic { background: #3a1a4a; color: #9b59b6; }
  .rarity-badge.legendary { background: #4a3a1a; color: #f39c12; }
  .rarity-badge.mythic { background: #4a1a2a; color: #e94560; }
  .close-detail-btn {
    display: block; margin: 0 auto; background: #0f3460; color: #ccc; border: 1px solid #1a3a6e;
    padding: 8px 20px; border-radius: 6px; font-size: 11px; cursor: pointer;
  }
</style>

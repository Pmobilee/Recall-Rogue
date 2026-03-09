<script lang="ts">
  import { playerSave, equipDustCatCosmetic } from '../stores/playerData'
  import {
    getDustCatCosmeticsBySlot,
    playerOwnsDustCatCosmetic,
  } from '../../data/dustCatCosmetics'
  import type { DustCatCosmeticSlot } from '../../data/dustCatCosmetics'

  export let onClose: () => void = () => {}

  const slots: DustCatCosmeticSlot[] = ['hat', 'accessory', 'color']
  const slotLabels: Record<DustCatCosmeticSlot, string> = {
    hat: 'Hats',
    accessory: 'Accessories',
    color: 'Colours',
  }

  $: equipped = $playerSave?.dustCatCosmetics ?? {}
  $: ownedCosmetics = $playerSave?.ownedCosmetics ?? []

  /** CSS filter for the preview based on equipped color cosmetic. */
  $: previewFilter = (() => {
    const colorId = equipped['color']
    if (!colorId) return ''
    const cosmetics = getDustCatCosmeticsBySlot('color')
    const item = cosmetics.find(c => c.id === colorId)
    return item?.colorFilter ?? ''
  })()

  function equip(slot: DustCatCosmeticSlot, id: string): void {
    equipDustCatCosmetic(slot, id)
  }
</script>

<div class="wardrobe-overlay" role="dialog" aria-label="Dust Cat Wardrobe">
  <div class="wardrobe-panel">
    <div class="wardrobe-header">
      <h2 class="wardrobe-title">Dust Cat Wardrobe</h2>
      <button class="close-btn" on:click={onClose} aria-label="Close wardrobe">✕</button>
    </div>

    <div class="wardrobe-body">
      <!-- Preview section -->
      <div class="preview-section">
        <div class="preview-cat" style="filter: {previewFilter};">
          <div class="cat-sprite">🐱</div>
          <!-- Hat overlay -->
          {#if equipped['hat'] && equipped['hat'] !== 'hat_none'}
            <div class="hat-overlay">🎩</div>
          {/if}
          <!-- Accessory overlay -->
          {#if equipped['accessory'] && equipped['accessory'] !== 'acc_none'}
            <div class="acc-overlay">✨</div>
          {/if}
        </div>
        <div class="preview-label">Preview</div>
      </div>

      <!-- Three columns for each slot -->
      <div class="columns">
        {#each slots as slot}
          <div class="column">
            <h3 class="column-title">{slotLabels[slot]}</h3>
            <div class="cosmetic-list">
              {#each getDustCatCosmeticsBySlot(slot) as cosmetic}
                {@const owned = playerOwnsDustCatCosmetic(cosmetic.id, ownedCosmetics)}
                {@const isEquipped = equipped[slot] === cosmetic.id}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <div
                  class="cosmetic-item"
                  class:owned
                  class:locked={!owned}
                  class:equipped={isEquipped}
                  role="button"
                  tabindex={owned ? 0 : -1}
                  on:click={() => owned && equip(slot, cosmetic.id)}
                  on:keydown={(e) => e.key === 'Enter' && owned && equip(slot, cosmetic.id)}
                  title={owned ? cosmetic.description : `Locked: ${cosmetic.unlockDescription}`}
                >
                  <div class="cosmetic-icon">
                    {#if !owned}
                      🔒
                    {:else if slot === 'hat'}
                      🎩
                    {:else if slot === 'accessory'}
                      ✨
                    {:else}
                      🎨
                    {/if}
                  </div>
                  <div class="cosmetic-info">
                    <div class="cosmetic-name">{cosmetic.name}</div>
                    {#if !owned}
                      <div class="unlock-desc">{cosmetic.unlockDescription}</div>
                    {/if}
                  </div>
                  {#if isEquipped}
                    <div class="equipped-badge">On</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .wardrobe-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .wardrobe-panel {
    background: #1a1a2e;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    width: min(700px, 95vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #fff;
  }

  .wardrobe-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .wardrobe-title {
    font-size: 18px;
    font-weight: bold;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .wardrobe-body {
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  .preview-cat {
    position: relative;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cat-sprite {
    font-size: 56px;
    line-height: 1;
  }

  .hat-overlay {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 24px;
  }

  .acc-overlay {
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 18px;
  }

  .preview-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .column-title {
    font-size: 13px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cosmetic-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cosmetic-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: background 0.15s ease;
    min-height: 44px;
  }

  .cosmetic-item.owned {
    cursor: pointer;
  }

  .cosmetic-item.owned:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .cosmetic-item.locked {
    opacity: 0.45;
    cursor: default;
  }

  .cosmetic-item.equipped {
    background: rgba(76, 175, 80, 0.15);
    border-color: rgba(76, 175, 80, 0.4);
  }

  .cosmetic-icon {
    font-size: 18px;
    min-width: 24px;
    text-align: center;
  }

  .cosmetic-info {
    flex: 1;
    min-width: 0;
  }

  .cosmetic-name {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .unlock-desc {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .equipped-badge {
    font-size: 10px;
    background: #4CAF50;
    color: #fff;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: bold;
    flex-shrink: 0;
  }
</style>

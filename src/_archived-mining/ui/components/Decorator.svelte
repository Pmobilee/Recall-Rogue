<script lang="ts">
  import { FLOOR_BACKGROUNDS, type FloorBackground } from '../../data/floorBackgrounds'
  import { playerSave, setFloorWallpaper, persistPlayer } from '../stores/playerData'
  import { audioManager } from '../../services/audioService'
  import { getDefaultHubStack } from '../../data/hubFloors'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  const hubStack = getDefaultHubStack()

  // Which floor we're decorating
  const unlockedIds = $derived($playerSave?.hubState?.unlockedFloorIds ?? ['starter'])
  const unlockedFloors = $derived(hubStack.floors.filter(f => unlockedIds.includes(f.id)))
  let selectedFloorId = $state('starter')

  // Current active background per floor
  const activeBackgrounds = $derived($playerSave?.hubState?.activeWallpapers ?? {})
  const currentBgId = $derived(activeBackgrounds[selectedFloorId] ?? null)

  // Player resources
  const dust = $derived($playerSave?.minerals?.dust ?? 0)

  // Purchased backgrounds (stored in ownedBackgrounds array in save)
  const ownedBackgrounds = $derived($playerSave?.ownedBackgrounds ?? ['floor_bg_steel_grate'])

  function isOwned(bg: FloorBackground): boolean {
    return ownedBackgrounds.includes(bg.id)
  }

  function isActive(bg: FloorBackground): boolean {
    return currentBgId === bg.id
  }

  function canAfford(bg: FloorBackground): boolean {
    return dust >= bg.dustCost
  }

  function handleBuy(bg: FloorBackground): void {
    if (!canAfford(bg) || isOwned(bg)) return
    audioManager.playSound('button_click')
    // Deduct dust and add to owned
    playerSave.update(s => {
      if (!s) return s
      return {
        ...s,
        minerals: { ...s.minerals, dust: (s.minerals.dust ?? 0) - bg.dustCost },
        ownedBackgrounds: [...(s.ownedBackgrounds ?? ['floor_bg_steel_grate']), bg.id],
      }
    })
    persistPlayer()
  }

  function handleApply(bg: FloorBackground): void {
    if (!isOwned(bg)) return
    audioManager.playSound('button_click')
    if (isActive(bg)) {
      // Remove background (revert to default)
      setFloorWallpaper(selectedFloorId, null)
    } else {
      setFloorWallpaper(selectedFloorId, bg.id)
    }
  }

  function handleBack(): void {
    audioManager.playSound('button_click')
    onBack()
  }
</script>

<div class="decorator-screen">
  <header class="decorator-header">
    <button class="back-btn" onclick={handleBack}>&#8592; Back</button>
    <h2>Decorator</h2>
    <span class="dust-display">&#x1F48E; {dust}</span>
  </header>

  <!-- Floor selector tabs -->
  <div class="floor-tabs">
    {#each unlockedFloors as floor}
      <button
        class="floor-tab"
        class:active={selectedFloorId === floor.id}
        onclick={() => { selectedFloorId = floor.id }}
      >
        {floor.name}
      </button>
    {/each}
  </div>

  <!-- Background grid -->
  <div class="bg-grid">
    {#each FLOOR_BACKGROUNDS as bg}
      <div class="bg-card" class:active={isActive(bg)} class:owned={isOwned(bg)}>
        <div class="bg-preview">
          <span class="bg-icon">&#x1F3A8;</span>
        </div>
        <div class="bg-info">
          <h3>{bg.name}</h3>
          <p>{bg.description}</p>
        </div>
        <div class="bg-actions">
          {#if isOwned(bg)}
            <button
              class="action-btn"
              class:equipped={isActive(bg)}
              onclick={() => handleApply(bg)}
            >
              {isActive(bg) ? 'Remove' : 'Apply'}
            </button>
          {:else}
            <button
              class="action-btn buy"
              disabled={!canAfford(bg)}
              onclick={() => handleBuy(bg)}
            >
              Buy &middot; {bg.dustCost} &#x1F48E;
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .decorator-screen {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: linear-gradient(180deg, #0a0a2e 0%, #1a1a3e 100%);
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    font-family: 'Press Start 2P', monospace;
    overflow-y: auto;
  }

  .decorator-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.4);
    border-bottom: 2px solid #4ecca3;
  }

  .decorator-header h2 {
    font-size: 14px;
    color: #4ecca3;
    margin: 0;
  }

  .back-btn {
    background: none;
    border: 1px solid #4ecca3;
    color: #4ecca3;
    padding: 6px 12px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 4px;
  }

  .back-btn:hover {
    background: rgba(78, 204, 163, 0.2);
  }

  .dust-display {
    font-size: 11px;
    color: #ffd700;
  }

  .floor-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 16px;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .floor-tab {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #aaa;
    padding: 6px 12px;
    font-family: inherit;
    font-size: 9px;
    cursor: pointer;
    border-radius: 4px;
    white-space: nowrap;
  }

  .floor-tab.active {
    background: rgba(78, 204, 163, 0.2);
    border-color: #4ecca3;
    color: #4ecca3;
  }

  .bg-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    flex: 1;
  }

  .bg-card {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    align-items: center;
  }

  .bg-card.active {
    border-color: #4ecca3;
    background: rgba(78, 204, 163, 0.1);
  }

  .bg-card.owned {
    border-color: rgba(78, 204, 163, 0.4);
  }

  .bg-preview {
    width: 64px;
    height: 64px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: #222;
  }

  .bg-info {
    flex: 1;
    min-width: 0;
  }

  .bg-info h3 {
    font-size: 11px;
    margin: 0 0 4px 0;
    color: #fff;
  }

  .bg-info p {
    font-size: 8px;
    margin: 0;
    color: #999;
    line-height: 1.4;
  }

  .bg-actions {
    flex-shrink: 0;
  }

  .action-btn {
    background: rgba(78, 204, 163, 0.2);
    border: 1px solid #4ecca3;
    color: #4ecca3;
    padding: 8px 14px;
    font-family: inherit;
    font-size: 9px;
    cursor: pointer;
    border-radius: 4px;
    white-space: nowrap;
  }

  .action-btn:hover {
    background: rgba(78, 204, 163, 0.4);
  }

  .action-btn.equipped {
    background: #4ecca3;
    color: #0a0a2e;
  }

  .action-btn.buy {
    background: rgba(255, 215, 0, 0.15);
    border-color: #ffd700;
    color: #ffd700;
  }

  .action-btn.buy:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>

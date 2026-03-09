<script lang="ts">
  import { playerSave, upgradeFloor } from '../../stores/playerData'
  import { audioManager } from '../../../services/audioService'
  import MineralConverter from '../MineralConverter.svelte'
  import FloorUpgradePanel from '../FloorUpgradePanel.svelte'
  import type { FloorUpgradeTier } from '../../../data/hubLayout'
  import { currentFloorIndex } from '../../stores/gameState'
  import { getDefaultHubStack } from '../../../data/hubFloors'

  // Resource icon sprites
  const iconDust = '/assets/sprites/icons/icon_dust.png'
  const iconShard = '/assets/sprites/icons/icon_shard.png'
  const iconCrystal = '/assets/sprites/icons/icon_crystal.png'
  const iconGeode = '/assets/sprites/icons/icon_geode.png'

  interface Props {
    onMaterializer?: () => void
    onPremiumMaterializer?: () => void
  }

  let { onMaterializer, onPremiumMaterializer }: Props = $props()

  // Floor upgrade state
  let showUpgradePanel = $state(false)
  const hubStack = getDefaultHubStack()
  const unlockedIds = $derived($playerSave?.hubState?.unlockedFloorIds ?? ['starter'])
  const floorTiers = $derived(($playerSave?.hubState?.floorTiers ?? { starter: 0 }) as Record<string, number>)
  const unlockedFloors = $derived(hubStack.floors.filter(f => unlockedIds.includes(f.id)))
  const currentFloorId = $derived(unlockedFloors[$currentFloorIndex]?.id ?? 'starter')
  const currentFloorTier = $derived((floorTiers[currentFloorId] ?? 0) as FloorUpgradeTier)

  function handleUpgrade(floorId: string, targetTier: FloorUpgradeTier): void {
    upgradeFloor(floorId, targetTier)
    showUpgradePanel = false
  }

  const dust = $derived($playerSave?.minerals.dust ?? 0)
  const shard = $derived($playerSave?.minerals.shard ?? 0)
  const crystal = $derived($playerSave?.minerals.crystal ?? 0)
  const geode = $derived($playerSave?.minerals.geode ?? 0)

  let showConverter = $state(false)

  function handleMaterializer(): void {
    audioManager.playSound('button_click')
    onMaterializer?.()
  }

  function handlePremiumMaterializer(): void {
    audioManager.playSound('button_click')
    onPremiumMaterializer?.()
  }

  function handleOpenConverter(): void {
    audioManager.playSound('button_click')
    showConverter = true
  }
</script>

<!-- ========== WORKSHOP ========== -->
<div class="card room-header-card">
  <div class="room-header-info">
    <span class="room-header-icon" aria-hidden="true">⚒️</span>
    <div>
      <h2 class="room-header-title">Workshop</h2>
      <p class="room-header-desc">Craft equipment and convert minerals</p>
    </div>
  </div>
</div>

<div class="card resources-card" aria-label="Mineral resources">
  <div class="resource-item">
    <img class="resource-icon-img" src={iconDust} alt="Dust" />
    <span class="resource-label">Dust</span>
    <span class="resource-value">{dust}</span>
  </div>
  <div class="resource-item">
    <img class="resource-icon-img" src={iconShard} alt="Shard" />
    <span class="resource-label">Shard</span>
    <span class="resource-value">{shard}</span>
  </div>
  <div class="resource-item">
    <img class="resource-icon-img" src={iconCrystal} alt="Crystal" />
    <span class="resource-label">Crystal</span>
    <span class="resource-value">{crystal}</span>
  </div>
  <div class="resource-item">
    <img class="resource-icon-img" src={iconGeode} alt="Geode" />
    <span class="resource-label">Geode</span>
    <span class="resource-value">{geode}</span>
  </div>
</div>

<!-- Crafting Section -->
<div class="card section-card">
  <h3 class="section-title">⚒️ Crafting</h3>
  <button class="action-button materializer-button" type="button" onclick={handleMaterializer}>
    <span>Materializer</span>
    <span class="action-arrow" aria-hidden="true">&#8594;</span>
  </button>
  <button class="action-button convert-btn" type="button" onclick={handleOpenConverter}>
    <span>Convert Minerals</span>
    <span class="action-arrow" aria-hidden="true">&#8594;</span>
  </button>
</div>

<!-- Dome Upgrades Section -->
<div class="card section-card">
  <h3 class="section-title">🏗️ Dome Upgrades</h3>
  <div class="upgrade-info">
    <span class="upgrade-floor-name">{unlockedFloors[$currentFloorIndex]?.name ?? 'Starter Hub'}</span>
    <span class="upgrade-tier-badge">Tier {currentFloorTier}</span>
  </div>
  <p class="upgrade-desc">Improve dome floors to unlock new rooms and machines.</p>
  <button class="action-button upgrade-btn" type="button" onclick={() => { audioManager.playSound('button_click'); showUpgradePanel = true }}>
    <span>Upgrade Current Floor</span>
    <span class="action-arrow" aria-hidden="true">&#8594;</span>
  </button>
</div>

<div class="card workshop-info-card" aria-label="Workshop tip">
  <p class="workshop-tip">Craft permanent upgrades and consumables in the Materializer. Convert lower-tier minerals to higher tiers using a 110:1 ratio.</p>
</div>

{#if showConverter}
  <MineralConverter onClose={() => { showConverter = false }} />
{/if}

{#if showUpgradePanel}
  <FloorUpgradePanel
    floorId={currentFloorId}
    currentTier={currentFloorTier}
    onClose={() => { showUpgradePanel = false }}
    onUpgrade={handleUpgrade}
  />
{/if}

<style>
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

  .resources-card {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .resource-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    background: color-mix(in srgb, var(--color-bg) 35%, var(--color-surface) 65%);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .resource-icon-img {
    width: 18px;
    height: 18px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }

  .resource-label {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  .resource-value {
    margin-left: auto;
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 700;
  }

  .section-title {
    color: var(--color-accent, #4ecca3);
    font-size: 0.9rem;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .upgrade-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--color-bg) 35%, var(--color-surface) 65%);
    border-radius: 8px;
  }

  .upgrade-floor-name {
    color: var(--color-text);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .upgrade-tier-badge {
    color: var(--color-warning, #f0a030);
    font-size: 0.8rem;
    padding: 2px 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-warning, #f0a030) 15%, transparent);
  }

  .upgrade-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    margin: 0;
    line-height: 1.4;
  }

  .upgrade-btn {
    background: color-mix(in srgb, var(--color-accent, #4ecca3) 20%, var(--color-surface) 80%);
    border-color: var(--color-accent, #4ecca3);
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

  .materializer-button {
    background: color-mix(in srgb, #a78bfa 28%, var(--color-surface) 72%);
  }

  .action-arrow {
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.1rem;
  }

  .convert-btn {
    background: color-mix(in srgb, var(--color-warning) 24%, var(--color-surface) 76%);
    color: var(--color-warning);
  }

  .workshop-info-card {
    border-left: 3px solid #a78bfa;
    background: color-mix(in srgb, #a78bfa 8%, var(--color-surface) 92%);
    margin-bottom: 20px;
  }

  .workshop-tip {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .resources-card {
      grid-template-columns: 1fr;
    }

    .action-button {
      font-size: 1rem;
    }
  }
</style>

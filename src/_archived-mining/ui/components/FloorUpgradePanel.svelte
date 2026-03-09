<script lang="ts">
  import type { FloorUpgradeTier } from '../../data/hubLayout'
  import { FLOOR_UPGRADES, getUpgradeDef, canUpgrade } from '../../data/hubUpgrades'
  import { playerSave } from '../stores/playerData'

  interface Props {
    floorId: string
    currentTier: FloorUpgradeTier
    onClose: () => void
    onUpgrade: (floorId: string, targetTier: FloorUpgradeTier) => void
  }

  const { floorId, currentTier, onClose, onUpgrade }: Props = $props()

  const nextTier = $derived((currentTier + 1) as FloorUpgradeTier)
  const upgradeDef = $derived(getUpgradeDef(floorId, nextTier))
  const upgradeCheck = $derived(
    $playerSave ? canUpgrade(floorId, nextTier, $playerSave) : { allowed: false, reason: 'No save' }
  )
  const floorDefs = $derived(FLOOR_UPGRADES[floorId] ?? [])

  function handleUpgrade() {
    if (upgradeCheck.allowed) {
      onUpgrade(floorId, nextTier)
    }
  }
</script>

<div class="upgrade-overlay" role="dialog" aria-modal="true" aria-label="Floor Upgrade">
  <div class="upgrade-panel">
    <button class="close-btn" onclick={onClose}>✕</button>
    <h2 class="panel-title">Floor Upgrade</h2>

    <!-- Tier progress bar -->
    <div class="tier-bar">
      {#each [0, 1, 2, 3] as t}
        <div class="tier-pip" class:filled={t <= currentTier} class:next={t === currentTier + 1}></div>
      {/each}
    </div>
    <p class="tier-label">Tier {currentTier} / 3</p>

    {#if upgradeDef && currentTier < 3}
      <div class="next-tier-info">
        <h3>Next: {upgradeDef.label} (Tier {upgradeDef.tier})</h3>
        <p class="desc">{upgradeDef.description}</p>
        <div class="costs">
          <span class="cost-item">💎 {upgradeDef.dustCost} dust</span>
          {#each upgradeDef.premiumCosts as pc}
            <span class="cost-item">✦ {pc.count}x {pc.materialId}</span>
          {/each}
          <span class="cost-item">📚 {upgradeDef.minFactsMastered} mastered facts</span>
        </div>
        {#if upgradeDef.unlocksObjectIds.length > 0}
          <p class="unlocks">Unlocks: {upgradeDef.unlocksObjectIds.join(', ')}</p>
        {/if}
      </div>

      <button
        class="upgrade-btn"
        class:disabled={!upgradeCheck.allowed}
        disabled={!upgradeCheck.allowed}
        onclick={handleUpgrade}
      >
        {upgradeCheck.allowed ? 'Upgrade' : upgradeCheck.reason}
      </button>
    {:else}
      <p class="max-tier">This floor is fully upgraded!</p>
    {/if}

    <!-- Show all tier definitions as reference -->
    {#if floorDefs.length > 0}
      <div class="tier-list">
        {#each floorDefs as def}
          <div class="tier-row" class:done={currentTier >= def.tier}>
            <span class="tier-row-label">{def.tier}. {def.label}</span>
            <span class="tier-row-cost">{def.dustCost}💎</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .upgrade-overlay {
    position: fixed;
    inset: 0;
    z-index: 250;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Press Start 2P', monospace;
    pointer-events: auto;
  }

  .upgrade-panel {
    background: #1a1a2e;
    border: 2px solid #4ecca3;
    border-radius: 8px;
    padding: 20px;
    max-width: 340px;
    width: 90%;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #888;
    font-size: 16px;
    cursor: pointer;
  }

  .panel-title {
    color: #4ecca3;
    font-size: 12px;
    margin: 0 0 16px;
    text-align: center;
  }

  .tier-bar {
    display: flex;
    gap: 4px;
    justify-content: center;
    margin-bottom: 8px;
  }

  .tier-pip {
    width: 32px;
    height: 8px;
    border-radius: 2px;
    background: #333;
    border: 1px solid #555;
  }

  .tier-pip.filled { background: #4ecca3; border-color: #4ecca3; }
  .tier-pip.next { background: #333; border-color: #4ecca3; animation: pulse 1.5s ease infinite; }

  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .tier-label {
    text-align: center;
    color: #aaa;
    font-size: 8px;
    margin: 0 0 16px;
  }

  .next-tier-info h3 {
    color: #e0c97f;
    font-size: 10px;
    margin: 0 0 8px;
  }

  .desc { color: #ccc; font-size: 8px; margin: 0 0 12px; line-height: 1.5; }

  .costs { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }

  .cost-item { color: #aaa; font-size: 8px; }

  .unlocks { color: #4ecca3; font-size: 8px; margin: 0 0 12px; }

  .upgrade-btn {
    width: 100%;
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

  .upgrade-btn.disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
  }

  .max-tier {
    text-align: center;
    color: #4ecca3;
    font-size: 10px;
    padding: 20px 0;
  }

  .tier-list {
    margin-top: 16px;
    border-top: 1px solid #333;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tier-row {
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: #666;
  }

  .tier-row.done {
    color: #4ecca3;
    text-decoration: line-through;
  }

  .tier-row-label { flex: 1; }
  .tier-row-cost { white-space: nowrap; }
</style>

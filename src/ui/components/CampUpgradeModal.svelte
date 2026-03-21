<script lang="ts">
  import { campState, getCampUpgradeCost, setCampTier, CAMP_MAX_TIERS } from '../stores/campState'
  import type { CampElement } from '../stores/campState'
  import { playerSave, spendDust } from '../stores/playerData'
  import { getCampUpgradeUrl } from '../utils/campArtManifest'
  import { getLevelProgress, getUnlockedRelicIds, getRelicUnlockLevel, MAX_LEVEL, getLevelReward } from '../../services/characterLevel'
  import type { LevelReward } from '../../services/characterLevel'
  import { UNLOCKABLE_RELICS } from '../../data/relics/unlockable'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  let activeTab = $state<'upgrades' | 'relics'>('upgrades')

  let dustBalance = $derived($playerSave?.minerals?.dust ?? 0)
  let totalXP = $derived($playerSave?.totalXP ?? 0)
  let levelInfo = $derived(getLevelProgress(totalXP))
  let unlockedRelicIds = $derived(new Set(getUnlockedRelicIds(levelInfo.level)))

  const ELEMENT_CONFIG: { element: CampElement; name: string }[] = [
    { element: 'tent', name: 'Tent' },
    { element: 'campfire', name: 'Campfire' },
    { element: 'character', name: 'Character' },
    { element: 'pet', name: 'Pet' },
    { element: 'library', name: 'Library' },
    { element: 'questboard', name: 'Quest Board' },
    { element: 'shop', name: 'Shop' },
    { element: 'journal', name: 'Journal' },
    { element: 'doorway', name: 'Dungeon Gate' },
  ]

  function handleUpgrade(element: CampElement): void {
    const currentTier = $campState.tiers[element]
    const cost = getCampUpgradeCost(element, currentTier)
    if (cost === null) return
    if (spendDust(cost)) {
      setCampTier(element, currentTier + 1)
    }
  }

  /** Bounding boxes (left, top, width, height as % of full canvas) for zooming previews. */
  const ELEMENT_BOUNDS: Record<CampElement, { left: number; top: number; width: number; height: number }> = {
    tent:       { left: 64.5, top: 44.2, width: 35.5, height: 21.5 },
    campfire:   { left: 35.9, top: 62.0, width: 27.9, height: 13.9 },
    character:  { left: 57.4, top: 57.9, width: 21.1, height: 11.2 },
    pet:        { left: 67.0, top: 69.3, width: 9.9,  height: 3.5  },
    library:    { left: 2.1,  top: 31.7, width: 31.4, height: 22.1 },
    questboard: { left: 72.2, top: 75.5, width: 26.4, height: 19.2 },
    shop:       { left: 52.1, top: 87.6, width: 19.1, height: 10.6 },
    journal:    { left: 4.6,  top: 76.2, width: 23.0, height: 8.4  },
    doorway:    { left: 27.8, top: 11.4, width: 44.5, height: 26.8 },
  }

  function getPreviewBgStyle(element: CampElement): string {
    const b = ELEMENT_BOUNDS[element]
    if (!b) return 'background-size: contain; background-position: center;'
    // Scale the image so the element region fills ~85% of the 56x56 preview box.
    // bgSize is expressed as a % of the container; 100% = image fits container exactly.
    // We want the element region (b.width % of image) to occupy 85% of container,
    // so total image should be bgSize = 85 / b.width * 100 (in container-relative %).
    const maxDim = Math.max(b.width, b.height)
    const bgSize = Math.round(85 / maxDim * 100)
    // Center the background on the center of the element region.
    const posX = b.left + b.width / 2
    const posY = b.top + b.height / 2
    return `background-size: ${bgSize}%; background-position: ${posX}% ${posY}%; background-repeat: no-repeat;`
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose}>
  <div class="modal-card" onclick={(e) => e.stopPropagation()}>

    <div class="modal-header">
      <h2>Camp Shop</h2>
      <span class="dust-pill">✦ {dustBalance} Dust</span>
      <button type="button" class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
    </div>

    <div class="tab-bar">
      <button
        class="tab-btn"
        class:active={activeTab === 'upgrades'}
        onclick={() => activeTab = 'upgrades'}
      >Camp Upgrades</button>
      <button
        class="tab-btn"
        class:active={activeTab === 'relics'}
        onclick={() => activeTab = 'relics'}
      >Relics</button>
    </div>

    {#if activeTab === 'upgrades'}
      <div class="upgrade-grid">
        {#each ELEMENT_CONFIG as { element, name }}
          {@const tier = $campState.tiers[element]}
          {@const maxTier = CAMP_MAX_TIERS[element]}
          {@const cost = getCampUpgradeCost(element, tier)}
          {@const canAfford = cost !== null && dustBalance >= cost}
          {@const isMaxed = tier >= maxTier}

          <div class="upgrade-card" class:maxed={isMaxed}>
            <div
              class="card-preview"
              style="background-image: url({getCampUpgradeUrl(element, tier)}); {getPreviewBgStyle(element)}"
              role="img"
              aria-label={name}
            ></div>
            <div class="card-info">
              <span class="element-name">{name}</span>
              <div class="tier-pips">
                {#each { length: maxTier } as _, i}
                  <span class="pip" class:filled={i < tier}></span>
                {/each}
              </div>
              <span class="tier-label">Tier {tier} / {maxTier}</span>
            </div>
            <div class="card-action">
              {#if isMaxed}
                <span class="max-badge">MAX</span>
              {:else}
                <button
                  class="upgrade-btn"
                  class:affordable={canAfford}
                  disabled={!canAfford}
                  onclick={() => handleUpgrade(element)}
                >
                  Upgrade<br /><span class="cost-label">{cost} Dust</span>
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="relics-content">
        <!-- Level + XP Progress Bar -->
        <div class="level-header">
          <span class="level-badge">Lv. {levelInfo.level}</span>
          <div class="xp-bar-container">
            <div class="xp-bar-fill" style="width: {levelInfo.isMaxLevel ? 100 : levelInfo.progress * 100}%"></div>
          </div>
          <span class="xp-text">
            {#if levelInfo.isMaxLevel}
              MAX
            {:else}
              {levelInfo.xpIntoCurrentLevel} / {levelInfo.xpForNextLevel} XP
            {/if}
          </span>
        </div>

        <!-- Relic Grid -->
        <div class="relic-grid">
          {#each UNLOCKABLE_RELICS as relic}
            {@const unlockLevel = getRelicUnlockLevel(relic.id) ?? 99}
            {@const isUnlocked = unlockedRelicIds.has(relic.id)}

            <div class="relic-card" class:locked={!isUnlocked}>
              <div class="relic-icon-box">
                <span class="relic-emoji" class:greyed={!isUnlocked}>{relic.icon}</span>
              </div>
              <div class="relic-info">
                <span class="relic-name">{isUnlocked ? relic.name : '???'}</span>
                {#if isUnlocked}
                  <span class="relic-desc-text">{relic.description}</span>
                {:else}
                  <span class="relic-lock-text">Unlocks at Level {unlockLevel}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-card {
    background: #0f172a;
    border: 1px solid rgba(148, 163, 184, 0.34);
    border-radius: 16px;
    width: 100%;
    max-width: 640px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    color: #e2e8f0;
    overflow: hidden;
  }

  /* ── Header ── */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: #ffe0a6;
    flex: 1;
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
    white-space: nowrap;
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
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: rgba(71, 85, 105, 0.8);
  }

  /* ── Tab bar ── */
  .tab-bar {
    display: flex;
    gap: 4px;
    margin: 0 12px 12px;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 8px;
    padding: 3px;
    flex-shrink: 0;
  }

  .tab-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #94a3b8;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Press Start 2P', monospace;
    font-size: 11px;
  }

  .tab-btn.active {
    background: rgba(255, 224, 166, 0.15);
    color: #ffe0a6;
    box-shadow: 0 0 8px rgba(255, 200, 100, 0.3);
  }

  .tab-btn:not(.active):hover {
    background: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
  }

  /* Subtle pulse on the Relics tab to draw attention */
  .tab-btn:not(.active):last-child {
    animation: relicPulse 3s ease-in-out infinite;
  }

  @keyframes relicPulse {
    0%, 100% { color: #94a3b8; }
    50% { color: #c4a87a; }
  }

  /* ── Relics tab ── */
  .relics-content {
    overflow-y: auto;
    padding: 12px;
  }

  .level-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    padding: 10px;
    background: rgba(30, 41, 59, 0.8);
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .level-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    color: #fbbf24;
    white-space: nowrap;
    min-width: 60px;
  }

  .xp-bar-container {
    flex: 1;
    height: 12px;
    background: #1e293b;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .xp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
    border-radius: 6px;
    transition: width 0.5s ease;
  }

  .xp-text {
    font-size: 11px;
    color: #94a3b8;
    white-space: nowrap;
    min-width: 80px;
    text-align: right;
  }

  .relic-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .relic-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: #1e293b;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
  }

  .relic-card.locked {
    opacity: 0.6;
    background: rgba(15, 23, 42, 0.6);
  }

  .relic-icon-box {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 8px;
    flex-shrink: 0;
  }

  .relic-emoji.greyed {
    filter: grayscale(1);
    opacity: 0.4;
  }

  .relic-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .relic-name {
    font-size: 13px;
    font-weight: 700;
    color: #e2e8f0;
  }

  .relic-desc-text {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.3;
  }

  .relic-lock-text {
    font-size: 11px;
    color: #64748b;
    font-style: italic;
  }

  /* ── Scrollable grid ── */
  .upgrade-grid {
    overflow-y: auto;
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  /* ── Individual upgrade card ── */
  .upgrade-card {
    background: #1e293b;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    transition: border-color 0.2s;
  }

  .upgrade-card.maxed {
    border-color: rgba(78, 204, 163, 0.35);
    background: rgba(30, 41, 59, 0.6);
  }

  /* ── Sprite thumbnail ── */
  .card-preview {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    background-color: rgba(15, 23, 42, 0.6);
    border: 2px solid #000;
    image-rendering: pixelated;
  }

  /* ── Text + pips ── */
  .card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .element-name {
    font-size: 14px;
    font-weight: 700;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tier-pips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .pip {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #334155;
    border: 1px solid rgba(148, 163, 184, 0.25);
    transition: background 0.2s, border-color 0.2s;
  }

  .pip.filled {
    background: #f59e0b;
    border-color: #fbbf24;
    box-shadow: 0 0 4px rgba(251, 191, 36, 0.5);
  }

  .tier-label {
    font-size: 11px;
    color: #64748b;
  }

  /* ── Action area ── */
  .card-action {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .max-badge {
    display: inline-block;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(78, 204, 163, 0.15);
    border: 1px solid rgba(78, 204, 163, 0.5);
    color: #4ecca3;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .upgrade-btn {
    padding: 7px 12px;
    border-radius: 8px;
    border: 1px solid rgba(100, 70, 20, 0.6);
    background: rgba(30, 20, 5, 0.8);
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    cursor: not-allowed;
    text-align: center;
    line-height: 1.3;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .upgrade-btn.affordable {
    background: #3d2e0a;
    border-color: rgba(255, 180, 60, 0.5);
    color: #ffe0a6;
    cursor: pointer;
  }

  .upgrade-btn.affordable:hover {
    background: #4d3a0f;
    border-color: rgba(255, 200, 80, 0.7);
  }

  .upgrade-btn.affordable:active {
    background: #2a1f06;
  }

  .cost-label {
    font-size: 11px;
    font-weight: 400;
    opacity: 0.85;
  }
</style>

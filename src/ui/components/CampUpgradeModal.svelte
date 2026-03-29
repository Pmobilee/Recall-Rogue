<script lang="ts">
  import { campState, getCampUpgradeCost, setCampTier, setCampForm, CAMP_MAX_TIERS } from '../stores/campState'
  import type { CampElement } from '../stores/campState'
  import { playerSave, spendGreyMatter } from '../stores/playerData'
  import { getCampUpgradeUrl } from '../utils/campArtManifest'
  import { getLevelProgress, MAX_LEVEL } from '../../services/characterLevel'
  import { UNLOCKABLE_RELICS } from '../../data/relics/unlockable'
  import { isLandscape } from '../../stores/layoutStore'
  import { getGreyMatterIconPath } from '../utils/iconAssets'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  let activeTab = $state<'upgrades' | 'relics'>('upgrades')

  let greyMatterBalance = $derived($playerSave?.minerals?.greyMatter ?? 0)
  let totalXP = $derived($playerSave?.totalXP ?? 0)
  let levelInfo = $derived(getLevelProgress(totalXP))
  // Use stored characterLevel as primary (survives XP desync), fall back to XP-derived
  let effectiveLevel = $derived(Math.max($playerSave?.characterLevel ?? 0, levelInfo.level))

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
    if (spendGreyMatter(cost)) {
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
  <div class="modal-card" class:landscape={$isLandscape} onclick={(e) => e.stopPropagation()}>

    <div class="modal-header">
      <h2>Camp Shop</h2>
      <span class="gm-pill"><img class="gm-pill-icon" src={getGreyMatterIconPath()} alt="" aria-hidden="true" /> {greyMatterBalance} Grey Matter</span>
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
          {@const canAfford = cost !== null && greyMatterBalance >= cost}
          {@const isMaxed = tier >= maxTier}

          {@const currentForm = $campState.forms?.[element] ?? tier}

          <div class="upgrade-card" class:maxed={isMaxed}>
            <div class="preview-with-form">
              {#if tier > 0}
                <button
                  class="form-arrow form-arrow-left"
                  onclick={() => setCampForm(element, currentForm - 1)}
                  disabled={currentForm <= 0}
                  aria-label="Previous form"
                >◀</button>
              {/if}
              <div class="card-preview-wrapper">
                <div
                  class="card-preview"
                  style="background-image: url({getCampUpgradeUrl(element, currentForm)}); {getPreviewBgStyle(element)}"
                  role="img"
                  aria-label={name}
                ></div>
                {#if tier > 0}
                  <span class="form-label">{currentForm}/{tier}</span>
                {/if}
              </div>
              {#if tier > 0}
                <button
                  class="form-arrow form-arrow-right"
                  onclick={() => setCampForm(element, currentForm + 1)}
                  disabled={currentForm >= tier}
                  aria-label="Next form"
                >▶</button>
              {/if}
            </div>
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
                  Upgrade<br /><span class="cost-label">{cost} Grey Matter</span>
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
          <span class="level-badge">Lv. {effectiveLevel}</span>
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
            {@const unlockLevel = relic.unlockLevel ?? 0}
            {@const isUnlocked = effectiveLevel >= unlockLevel}

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
    padding: calc(16px * var(--layout-scale, 1));
  }

  .modal-card {
    background: #0f172a;
    border: 1px solid rgba(148, 163, 184, 0.34);
    border-radius: calc(16px * var(--layout-scale, 1));
    width: 100%;
    max-width: calc(640px * var(--layout-scale, 1));
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
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
    color: #ffe0a6;
    flex: 1;
  }

  .gm-pill {
    display: inline-flex;
    align-items: center;
    padding: calc(5px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: 999px;
    border: 1px solid rgba(255, 214, 143, 0.5);
    background: rgba(54, 38, 22, 0.7);
    color: #ffd89d;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    white-space: nowrap;
  }

  .gm-pill-icon {
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    object-fit: contain;
    vertical-align: middle;
    margin-right: calc(2px * var(--layout-scale, 1));
  }

  .close-btn {
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    border-radius: 50%;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(30, 41, 59, 0.8);
    color: #e2e8f0;
    font-size: calc(20px * var(--text-scale, 1));
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
    gap: calc(4px * var(--layout-scale, 1));
    margin: 0 calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.6);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(3px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .tab-btn {
    flex: 1;
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    background: transparent;
    color: #94a3b8;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    font-family: var(--font-rpg);
    font-size: calc(11px * var(--text-scale, 1));
  }

  .tab-btn.active {
    background: rgba(255, 224, 166, 0.15);
    color: #ffe0a6;
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(255, 200, 100, 0.3);
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
    padding: calc(12px * var(--layout-scale, 1));
  }

  .level-header {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    margin-bottom: calc(16px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
    background: rgba(30, 41, 59, 0.8);
    border-radius: calc(10px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .level-badge {
    font-family: var(--font-rpg);
    font-size: calc(14px * var(--text-scale, 1));
    color: #fbbf24;
    white-space: nowrap;
    min-width: calc(60px * var(--layout-scale, 1));
  }

  .xp-bar-container {
    flex: 1;
    height: calc(12px * var(--layout-scale, 1));
    background: #1e293b;
    border-radius: calc(6px * var(--layout-scale, 1));
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .xp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
    border-radius: calc(6px * var(--layout-scale, 1));
    transition: width 0.5s ease;
  }

  .xp-text {
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    white-space: nowrap;
    min-width: calc(80px * var(--layout-scale, 1));
    text-align: right;
  }

  .relic-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .relic-card {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
    background: #1e293b;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: calc(10px * var(--layout-scale, 1));
  }

  .relic-card.locked {
    opacity: 0.6;
    background: rgba(15, 23, 42, 0.6);
  }

  .relic-icon-box {
    width: calc(40px * var(--layout-scale, 1));
    height: calc(40px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(24px * var(--text-scale, 1));
    background: rgba(15, 23, 42, 0.6);
    border-radius: calc(8px * var(--layout-scale, 1));
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
    gap: calc(2px * var(--layout-scale, 1));
  }

  .relic-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
  }

  .relic-desc-text {
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    line-height: 1.3;
  }

  .relic-lock-text {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    font-style: italic;
  }

  /* ── Scrollable grid ── */
  .upgrade-grid {
    overflow-y: auto;
    padding: calc(12px * var(--layout-scale, 1));
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: calc(10px * var(--layout-scale, 1));
  }

  .upgrade-card:last-child:nth-child(odd) {
    grid-column: 1 / -1;
    max-width: 50%;
    justify-self: center;
  }

  /* ── Individual upgrade card ── */
  .upgrade-card {
    background: #1e293b;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: calc(12px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
    transition: border-color 0.2s;
  }

  .upgrade-card.maxed {
    border-color: rgba(78, 204, 163, 0.35);
    background: rgba(30, 41, 59, 0.6);
  }

  /* ── Sprite thumbnail ── */
  .card-preview {
    width: calc(56px * var(--layout-scale, 1));
    height: calc(56px * var(--layout-scale, 1));
    flex-shrink: 0;
    border-radius: calc(8px * var(--layout-scale, 1));
    overflow: hidden;
    background-color: rgba(15, 23, 42, 0.6);
    border: calc(2px * var(--layout-scale, 1)) solid #000;
    image-rendering: pixelated;
  }

  /* ── Text + pips ── */
  .card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: calc(5px * var(--layout-scale, 1));
  }

  .element-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tier-pips {
    display: flex;
    gap: calc(4px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .pip {
    width: calc(10px * var(--layout-scale, 1));
    height: calc(10px * var(--layout-scale, 1));
    border-radius: 50%;
    background: #334155;
    border: 1px solid rgba(148, 163, 184, 0.25);
    transition: background 0.2s, border-color 0.2s;
  }

  .pip.filled {
    background: #f59e0b;
    border-color: #fbbf24;
    box-shadow: 0 0 calc(4px * var(--layout-scale, 1)) rgba(251, 191, 36, 0.5);
  }

  .tier-label {
    font-size: calc(11px * var(--text-scale, 1));
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
    padding: calc(5px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: 999px;
    background: rgba(78, 204, 163, 0.15);
    border: 1px solid rgba(78, 204, 163, 0.5);
    color: #4ecca3;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .upgrade-btn {
    padding: calc(7px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid rgba(100, 70, 20, 0.6);
    background: rgba(30, 20, 5, 0.8);
    color: #64748b;
    font-size: calc(12px * var(--text-scale, 1));
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
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 400;
    opacity: 0.85;
  }

  /* ── Form picker ── */
  .preview-with-form {
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .card-preview-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .form-arrow {
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border-radius: 50%;
    border: 1px solid rgba(255, 180, 60, 0.4);
    background: rgba(61, 46, 10, 0.8);
    color: #ffe0a6;
    font-size: calc(10px * var(--text-scale, 1));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }

  .form-arrow:hover:not(:disabled) {
    background: rgba(77, 58, 15, 0.9);
    border-color: rgba(255, 200, 80, 0.7);
  }

  .form-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .form-label {
    font-size: calc(9px * var(--text-scale, 1));
    color: #94a3b8;
    text-align: center;
    white-space: nowrap;
  }

  /* ── Landscape overrides ── */
  .modal-card.landscape {
    max-width: calc(900px * var(--layout-scale, 1));
  }

  .modal-card.landscape .upgrade-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .modal-card.landscape .upgrade-card:last-child:nth-child(odd) {
    max-width: 100%;
    grid-column: auto;
    justify-self: auto;
  }

  .modal-card.landscape .card-preview {
    width: calc(64px * var(--layout-scale, 1));
    height: calc(64px * var(--layout-scale, 1));
  }
</style>

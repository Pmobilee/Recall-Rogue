<script lang="ts">
  import type { RunSummary } from '../../services/hubState'
  import { playerSave, deductMinerals } from '../stores/playerData'
  import {
    campState,
    CAMP_MAX_TIER,
    PET_UNLOCK_COSTS,
    getCampUpgradeCost,
    setCampTier,
    setCampOutfit,
    unlockCampPet,
    setActiveCampPet,
    type CampElement,
    type CampOutfit,
    type CampPet,
  } from '../stores/campState'

  interface Props {
    streak: number
    lastRunSummary: RunSummary | null
    onStartRun: () => void
    onOpenLibrary: () => void
    onOpenSettings: () => void
    onOpenProfile: () => void
    onOpenJournal: () => void
    onOpenLeaderboards: () => void
  }

  let {
    streak,
    lastRunSummary,
    onStartRun,
    onOpenLibrary,
    onOpenSettings,
    onOpenProfile,
    onOpenJournal,
    onOpenLeaderboards,
  }: Props = $props()

  interface CampObject {
    id: string
    label: string
    icon: string
    top: string
    left: string
    upgradeElement: CampElement
    action: () => void
  }

  let campObjects = $derived<CampObject[]>([
    {
      id: 'tent',
      label: 'Tent',
      icon: '⛺',
      top: '58%',
      left: '18%',
      upgradeElement: 'tent',
      action: () => onOpenProfile(),
    },
    {
      id: 'campfire',
      label: 'Campfire',
      icon: '🔥',
      top: '68%',
      left: '50%',
      upgradeElement: 'campfire',
      action: () => onStartRun(),
    },
    {
      id: 'seating',
      label: 'Workshop Bench',
      icon: '🪑',
      top: '62%',
      left: '76%',
      upgradeElement: 'seating',
      action: () => onOpenJournal(),
    },
    {
      id: 'decor',
      label: 'Signpost',
      icon: '🪧',
      top: '48%',
      left: '88%',
      upgradeElement: 'decor',
      action: () => onOpenSettings(),
    },
    {
      id: 'library',
      label: 'Archive Crate',
      icon: '📖',
      top: '46%',
      left: '10%',
      upgradeElement: 'decor',
      action: () => onOpenLibrary(),
    },
  ])

  const OUTFITS: Array<{ id: CampOutfit; label: string; icon: string }> = [
    { id: 'scout', label: 'Scout', icon: '🧥' },
    { id: 'warden', label: 'Warden', icon: '🛡' },
    { id: 'scholar', label: 'Scholar', icon: '📚' },
    { id: 'vanguard', label: 'Vanguard', icon: '⚔' },
  ]

  const PETS: Array<{ id: CampPet; label: string; icon: string }> = [
    { id: 'cat', label: 'Cat', icon: '🐈' },
    { id: 'owl', label: 'Owl', icon: '🦉' },
    { id: 'fox', label: 'Fox', icon: '🦊' },
    { id: 'dragon_whelp', label: 'Dragon Whelp', icon: '🐉' },
  ]

  const UPGRADE_LABELS: Record<CampElement, string> = {
    tent: 'Tent',
    seating: 'Seating',
    campfire: 'Campfire',
    decor: 'Decor',
  }
  const UPGRADE_ELEMENTS: CampElement[] = ['tent', 'seating', 'campfire', 'decor']

  let selectedElement = $state<CampElement>('campfire')
  let campTip = $state('Tap camp objects to navigate. Upgrade visuals in the camp shop.')

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return 'Today'
    }
  }

  let dustBalance = $derived($playerSave?.minerals.dust ?? 0)
  let defeatedBosses = $derived(($playerSave?.defeatedBosses ?? []).slice(-6))

  function campTier(element: CampElement): number {
    return $campState.tiers[element] ?? 0
  }

  function currentUpgradeCost(element: CampElement): number | null {
    return getCampUpgradeCost(campTier(element))
  }

  function pickCampObject(object: CampObject): void {
    selectedElement = object.upgradeElement
    campTip = `${object.label}: ${object.id === 'campfire' ? 'start your next run' : 'open feature'}`
    object.action()
  }

  function buyUpgrade(element: CampElement): void {
    const cost = currentUpgradeCost(element)
    if (cost === null) {
      campTip = `${UPGRADE_LABELS[element]} is already at max tier.`
      return
    }
    if (dustBalance < cost) {
      campTip = `Need ${cost - dustBalance} more dust to upgrade ${UPGRADE_LABELS[element]}.`
      return
    }
    deductMinerals('dust', cost)
    setCampTier(element, campTier(element) + 1)
    selectedElement = element
    campTip = `${UPGRADE_LABELS[element]} upgraded to tier ${campTier(element) + 1}.`
  }

  function setOutfit(outfit: CampOutfit): void {
    setCampOutfit(outfit)
    campTip = `Equipped ${outfit} outfit.`
  }

  function usePet(pet: CampPet): void {
    const unlocked = $campState.unlockedPets.includes(pet)
    if (unlocked) {
      setActiveCampPet(pet)
      campTip = `${PETS.find((p) => p.id === pet)?.label ?? 'Pet'} is now at camp.`
      return
    }
    const cost = PET_UNLOCK_COSTS[pet]
    if (dustBalance < cost) {
      campTip = `Need ${cost - dustBalance} more dust to unlock ${PETS.find((p) => p.id === pet)?.label ?? 'pet'}.`
      return
    }
    deductMinerals('dust', cost)
    unlockCampPet(pet)
    campTip = `Unlocked ${PETS.find((p) => p.id === pet)?.label ?? 'pet'}.`
  }

  function outfitIcon(outfit: CampOutfit): string {
    return OUTFITS.find((entry) => entry.id === outfit)?.icon ?? '🧥'
  }
</script>

<section class="hub-screen" aria-label="Camp hub">
  <header class="hero">
    <h1>Recall Rogue Camp</h1>
    <p>Upgrade the camp, set your look, then head back into the dungeon.</p>
    <div class="camp-tip">{campTip}</div>
  </header>

  <section class="camp-scene" aria-label="Camp scene">
    <div class="sky-layer" aria-hidden="true"></div>
    <div class="ridge-layer" aria-hidden="true"></div>
    <div class="dungeon-gate" aria-hidden="true">🕳</div>

    <div class={`player-avatar outfit-${$campState.outfit}`} aria-label={`Current outfit: ${$campState.outfit}`}>
      <span class="avatar-icon">{outfitIcon($campState.outfit)}</span>
      <span class="avatar-label">You</span>
    </div>

    {#each campObjects as object (object.id)}
      <button
        type="button"
        class={`camp-object tier-${campTier(object.upgradeElement)}`}
        class:selected={selectedElement === object.upgradeElement}
        style={`top: ${object.top}; left: ${object.left};`}
        onclick={() => pickCampObject(object)}
      >
        <span class="obj-icon">{object.icon}</span>
        <span class="obj-name">{object.label}</span>
        <span class="obj-tier">Tier {campTier(object.upgradeElement) + 1}</span>
      </button>
    {/each}

    <div class="pet-slot" aria-label="Active camp pet">
      <span class="pet-icon">{PETS.find((pet) => pet.id === $campState.activePet)?.icon ?? '🐈'}</span>
      <span class="pet-label">{PETS.find((pet) => pet.id === $campState.activePet)?.label ?? 'Cat'}</span>
    </div>

    {#if defeatedBosses.length > 0}
      <div class="trophy-rack" aria-label="Boss trophies">
        {#each defeatedBosses as bossId}
          <span class="trophy" title={bossId}>🏴</span>
        {/each}
      </div>
    {/if}
  </section>

  <section class="camp-shop" aria-label="Camp upgrade shop">
    <div class="shop-header">
      <h2>Camp Upgrade Shop</h2>
      <span class="dust-pill">Dust: {dustBalance}</span>
    </div>

    <div class="upgrade-grid">
      {#each UPGRADE_ELEMENTS as element}
        {@const tier = campTier(element)}
        {@const cost = currentUpgradeCost(element)}
        <div class="upgrade-card" class:selected={selectedElement === element}>
          <div class="upgrade-name">{UPGRADE_LABELS[element]}</div>
          <div class="upgrade-tier">Tier {tier + 1} / {CAMP_MAX_TIER + 1}</div>
          <button
            type="button"
            class="upgrade-btn"
            onclick={() => buyUpgrade(element)}
            disabled={cost === null}
          >
            {#if cost === null}
              Maxed
            {:else}
              Upgrade ({cost} dust)
            {/if}
          </button>
        </div>
      {/each}
    </div>

    <div class="shop-columns">
      <div class="shop-block">
        <h3>Outfit</h3>
        <div class="pill-row">
          {#each OUTFITS as outfit}
            <button
              type="button"
              class="pill-btn"
              class:active={$campState.outfit === outfit.id}
              onclick={() => setOutfit(outfit.id)}
            >
              {outfit.icon} {outfit.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="shop-block">
        <h3>Companion</h3>
        <div class="pill-row">
          {#each PETS as pet}
            {@const unlocked = $campState.unlockedPets.includes(pet.id)}
            <button
              type="button"
              class="pill-btn"
              class:active={$campState.activePet === pet.id}
              onclick={() => usePet(pet.id)}
            >
              {pet.icon} {pet.label}
              {#if !unlocked} ({PET_UNLOCK_COSTS[pet.id]} dust){/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <section class="meta-row">
    <div class="streak-card" aria-label="Daily streak">
      <div class="streak-title">🔥 {streak} Day Streak</div>
      <div class="streak-sub">Complete one encounter daily to keep it alive.</div>
    </div>

    {#if lastRunSummary}
      <section class="run-summary" aria-label="Last run summary">
        <div class="summary-head">Last Run • {formatDate(lastRunSummary.runDate)}</div>
        <div class="summary-line">Depth {lastRunSummary.floorReached} • {lastRunSummary.enemiesDefeated} encounters</div>
        <div class="summary-line">{lastRunSummary.goldEarned} camp gold • {lastRunSummary.factsLearned} facts</div>
        <button type="button" class="mini-btn" onclick={onOpenJournal}>View Summary</button>
      </section>
    {/if}
  </section>

  <div class="grid-actions" aria-label="Hub features">
    <button type="button" class="start-btn" data-testid="btn-start-run" onclick={onStartRun}>Start Run</button>
    <button type="button" class="tile" onclick={onOpenLeaderboards} aria-label="Leaderboards">🏆<span>Leaderboards</span></button>
  </div>
</section>

<style>
  .hub-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: 16px 14px 96px;
    background:
      radial-gradient(circle at 18% 8%, rgba(255, 185, 117, 0.2), transparent 34%),
      radial-gradient(circle at 92% 3%, rgba(152, 202, 255, 0.18), transparent 26%),
      linear-gradient(180deg, #0e1522 0%, #0c1119 100%);
    color: #e2e8f0;
    display: grid;
    gap: 14px;
  }

  .hero h1 {
    margin: 0;
    font-size: calc(24px * var(--text-scale, 1));
    letter-spacing: 1.2px;
    color: #ffe3ab;
  }

  .hero p {
    margin: 4px 0 0;
    color: #d3dce9;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .camp-tip {
    margin-top: 8px;
    font-size: calc(12px * var(--text-scale, 1));
    color: #a8b8cb;
    background: rgba(14, 23, 36, 0.65);
    border: 1px solid rgba(136, 169, 205, 0.32);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .camp-scene {
    position: relative;
    min-height: 290px;
    border-radius: 18px;
    border: 1px solid rgba(255, 217, 156, 0.32);
    background: linear-gradient(180deg, rgba(21, 30, 43, 0.95), rgba(10, 15, 24, 0.95));
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  }

  .sky-layer {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 52% 20%, rgba(255, 237, 189, 0.22), transparent 34%),
      linear-gradient(180deg, rgba(72, 102, 145, 0.3), rgba(27, 41, 60, 0.9));
  }

  .ridge-layer {
    position: absolute;
    left: -8%;
    right: -8%;
    bottom: 26%;
    height: 46%;
    background:
      radial-gradient(circle at 22% 80%, rgba(33, 56, 84, 0.9), transparent 52%),
      radial-gradient(circle at 78% 90%, rgba(24, 39, 64, 0.88), transparent 48%),
      linear-gradient(180deg, rgba(26, 39, 59, 0.5), rgba(13, 21, 33, 0.95));
    clip-path: polygon(0 68%, 11% 54%, 24% 62%, 37% 48%, 50% 58%, 64% 41%, 78% 55%, 100% 40%, 100% 100%, 0 100%);
  }

  .dungeon-gate {
    position: absolute;
    left: 50%;
    top: 43%;
    transform: translate(-50%, -50%);
    font-size: 52px;
    filter: drop-shadow(0 0 14px rgba(255, 205, 128, 0.45));
    opacity: 0.75;
  }

  .player-avatar {
    position: absolute;
    left: 50%;
    top: 73%;
    transform: translate(-50%, -50%);
    width: 78px;
    height: 84px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.26);
    background: linear-gradient(180deg, rgba(24, 37, 53, 0.9), rgba(10, 17, 27, 0.94));
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 4px;
    z-index: 3;
  }

  .outfit-scout { box-shadow: 0 0 0 1px rgba(144, 214, 255, 0.45); }
  .outfit-warden { box-shadow: 0 0 0 1px rgba(160, 245, 183, 0.45); }
  .outfit-scholar { box-shadow: 0 0 0 1px rgba(214, 188, 255, 0.45); }
  .outfit-vanguard { box-shadow: 0 0 0 1px rgba(255, 177, 137, 0.45); }

  .avatar-icon {
    font-size: 28px;
    line-height: 1;
  }

  .avatar-label {
    font-size: 11px;
    color: #d5deea;
    letter-spacing: 0.4px;
  }

  .camp-object {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 100px;
    min-height: 84px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    background: rgba(17, 27, 40, 0.86);
    color: #f6f8fb;
    display: grid;
    place-items: center;
    gap: 2px;
    padding: 6px 4px;
    z-index: 4;
    transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
  }

  .camp-object:hover {
    transform: translate(-50%, -53%);
  }

  .camp-object.selected {
    box-shadow: 0 0 0 2px #ffd58b;
  }

  .camp-object .obj-icon {
    font-size: 20px;
  }

  .camp-object .obj-name {
    font-size: calc(12px * var(--text-scale, 1));
    text-align: center;
  }

  .camp-object .obj-tier {
    font-size: calc(10px * var(--text-scale, 1));
    color: #9ec8ff;
  }

  .camp-object.tier-1 { background: rgba(20, 35, 47, 0.9); }
  .camp-object.tier-2 { background: rgba(22, 41, 54, 0.92); border-color: rgba(143, 213, 249, 0.55); }
  .camp-object.tier-3 { background: rgba(26, 47, 60, 0.94); border-color: rgba(255, 214, 147, 0.66); }

  .pet-slot {
    position: absolute;
    left: 72%;
    top: 78%;
    transform: translate(-50%, -50%);
    background: rgba(13, 24, 36, 0.84);
    border: 1px solid rgba(160, 190, 222, 0.4);
    border-radius: 999px;
    padding: 6px 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    z-index: 4;
  }

  .pet-icon {
    font-size: 18px;
  }

  .pet-label {
    font-size: 11px;
    color: #dbe7f5;
  }

  .trophy-rack {
    position: absolute;
    left: 50%;
    top: 19%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
    background: rgba(10, 17, 26, 0.7);
    border: 1px solid rgba(255, 204, 115, 0.44);
    border-radius: 999px;
    padding: 6px 10px;
    z-index: 4;
  }

  .trophy {
    font-size: 16px;
    filter: drop-shadow(0 0 5px rgba(255, 183, 92, 0.45));
  }

  .camp-shop,
  .streak-card,
  .run-summary {
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.34);
    background: rgba(15, 23, 42, 0.72);
    padding: 12px;
  }

  .shop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .shop-header h2 {
    margin: 0;
    font-size: calc(16px * var(--text-scale, 1));
    color: #ffe0a6;
  }

  .dust-pill {
    padding: 5px 9px;
    border-radius: 999px;
    border: 1px solid rgba(255, 214, 143, 0.5);
    background: rgba(54, 38, 22, 0.7);
    color: #ffd89d;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
  }

  .upgrade-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .upgrade-card {
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(21, 33, 50, 0.8);
    padding: 8px;
    display: grid;
    gap: 4px;
  }

  .upgrade-card.selected {
    border-color: #ffd18a;
    box-shadow: 0 0 0 1px rgba(255, 211, 144, 0.35);
  }

  .upgrade-name {
    font-size: calc(12px * var(--text-scale, 1));
    color: #eaf2ff;
    font-weight: 700;
  }

  .upgrade-tier {
    font-size: calc(11px * var(--text-scale, 1));
    color: #9ec8ff;
  }

  .upgrade-btn {
    min-height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(100, 165, 219, 0.6);
    background: rgba(20, 53, 84, 0.8);
    color: #dff4ff;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
  }

  .upgrade-btn:disabled {
    opacity: 0.6;
  }

  .shop-columns {
    margin-top: 10px;
    display: grid;
    gap: 10px;
  }

  .shop-block h3 {
    margin: 0 0 6px;
    font-size: calc(13px * var(--text-scale, 1));
    color: #c9d6e5;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill-btn {
    min-height: 34px;
    border-radius: 999px;
    border: 1px solid rgba(143, 164, 187, 0.45);
    background: rgba(28, 43, 62, 0.84);
    color: #e8f0fa;
    padding: 0 10px;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .pill-btn.active {
    border-color: #ffd18a;
    color: #ffe0ad;
  }

  .meta-row {
    display: grid;
    gap: 10px;
  }

  .streak-title {
    font-size: calc(16px * var(--text-scale, 1));
    color: #fbbf24;
    font-weight: 700;
  }

  .streak-sub {
    margin-top: 4px;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .summary-head {
    color: #93c5fd;
    font-size: calc(12px * var(--text-scale, 1));
    margin-bottom: 6px;
  }

  .summary-line {
    font-size: calc(13px * var(--text-scale, 1));
    color: #f8fafc;
    margin: 2px 0;
  }

  .mini-btn {
    margin-top: 8px;
    min-height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(125, 211, 252, 0.55);
    background: rgba(30, 64, 96, 0.75);
    color: #e0f2fe;
    padding: 0 12px;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .start-btn {
    min-height: 56px;
    border: 2px solid #f59e0b;
    border-radius: 14px;
    background: linear-gradient(180deg, #2f7a35, #1f5c28);
    color: #f8fafc;
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 800;
    letter-spacing: 0.6px;
  }

  .grid-actions {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 10px;
  }

  .tile {
    min-height: 56px;
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(30, 41, 59, 0.86);
    color: #f8fafc;
    display: grid;
    place-items: center;
    font-size: 22px;
    padding: 6px;
    gap: 2px;
  }

  .tile span {
    font-size: calc(11px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  @media (max-width: 560px) {
    .camp-scene {
      min-height: 260px;
    }

    .camp-object {
      width: 88px;
      min-height: 74px;
    }

    .grid-actions {
      grid-template-columns: 1fr;
    }
  }
</style>

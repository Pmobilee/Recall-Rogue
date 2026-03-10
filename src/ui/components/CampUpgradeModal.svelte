<script lang="ts">
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
    onClose: () => void
  }

  let { onClose }: Props = $props()

  const OUTFITS: Array<{ id: CampOutfit; label: string; icon: string }> = [
    { id: 'scout', label: 'Scout', icon: '\u{1F9E5}' },
    { id: 'warden', label: 'Warden', icon: '\u{1F6E1}' },
    { id: 'scholar', label: 'Scholar', icon: '\u{1F4DA}' },
    { id: 'vanguard', label: 'Vanguard', icon: '\u{2694}' },
  ]

  const PETS: Array<{ id: CampPet; label: string; icon: string }> = [
    { id: 'cat', label: 'Cat', icon: '\u{1F408}' },
    { id: 'owl', label: 'Owl', icon: '\u{1F989}' },
    { id: 'fox', label: 'Fox', icon: '\u{1F98A}' },
    { id: 'dragon_whelp', label: 'Dragon Whelp', icon: '\u{1F409}' },
  ]

  const UPGRADE_LABELS: Record<CampElement, string> = {
    tent: 'Tent',
    seating: 'Seating',
    campfire: 'Campfire',
    decor: 'Decor',
  }

  const UPGRADE_ELEMENTS: CampElement[] = ['tent', 'seating', 'campfire', 'decor']

  let selectedElement = $state<CampElement>('campfire')
  let statusTip = $state('')

  let dustBalance = $derived($playerSave?.minerals.dust ?? 0)

  function campTier(element: CampElement): number {
    return $campState.tiers[element] ?? 0
  }

  function currentUpgradeCost(element: CampElement): number | null {
    return getCampUpgradeCost(campTier(element))
  }

  function buyUpgrade(element: CampElement): void {
    const cost = currentUpgradeCost(element)
    if (cost === null) {
      statusTip = `${UPGRADE_LABELS[element]} is already at max tier.`
      return
    }
    if (dustBalance < cost) {
      statusTip = `Need ${cost - dustBalance} more dust to upgrade ${UPGRADE_LABELS[element]}.`
      return
    }
    deductMinerals('dust', cost)
    setCampTier(element, campTier(element) + 1)
    selectedElement = element
    statusTip = `${UPGRADE_LABELS[element]} upgraded to tier ${campTier(element) + 1}.`
  }

  function setOutfit(outfit: CampOutfit): void {
    setCampOutfit(outfit)
    statusTip = `Equipped ${outfit} outfit.`
  }

  function usePet(pet: CampPet): void {
    const unlocked = $campState.unlockedPets.includes(pet)
    if (unlocked) {
      setActiveCampPet(pet)
      statusTip = `${PETS.find((p) => p.id === pet)?.label ?? 'Pet'} is now at camp.`
      return
    }
    const cost = PET_UNLOCK_COSTS[pet]
    if (dustBalance < cost) {
      statusTip = `Need ${cost - dustBalance} more dust to unlock ${PETS.find((p) => p.id === pet)?.label ?? 'pet'}.`
      return
    }
    deductMinerals('dust', cost)
    unlockCampPet(pet)
    statusTip = `Unlocked ${PETS.find((p) => p.id === pet)?.label ?? 'pet'}.`
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose}>
  <div class="modal-card" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>Camp Upgrades</h2>
      <button type="button" class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
    </div>

    <div class="dust-display">
      <span class="dust-pill">Dust: {dustBalance}</span>
    </div>

    {#if statusTip}
      <div class="status-tip">{statusTip}</div>
    {/if}

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
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-card {
    background: #0f172a;
    border: 1px solid rgba(148, 163, 184, 0.34);
    border-radius: 16px;
    max-width: 400px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    padding: 16px;
    color: #e2e8f0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: #ffe0a6;
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
  }

  .dust-display {
    margin-bottom: 10px;
  }

  .dust-pill {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 999px;
    border: 1px solid rgba(255, 214, 143, 0.5);
    background: rgba(54, 38, 22, 0.7);
    color: #ffd89d;
    font-size: 12px;
    font-weight: 700;
  }

  .status-tip {
    font-size: 12px;
    color: #a8b8cb;
    background: rgba(14, 23, 36, 0.65);
    border: 1px solid rgba(136, 169, 205, 0.32);
    border-radius: 8px;
    padding: 6px 10px;
    margin-bottom: 10px;
  }

  .upgrade-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
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
    font-size: 12px;
    color: #eaf2ff;
    font-weight: 700;
  }

  .upgrade-tier {
    font-size: 11px;
    color: #9ec8ff;
  }

  .upgrade-btn {
    min-height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(100, 165, 219, 0.6);
    background: rgba(20, 53, 84, 0.8);
    color: #dff4ff;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .upgrade-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .shop-columns {
    display: grid;
    gap: 10px;
  }

  .shop-block h3 {
    margin: 0 0 6px;
    font-size: 13px;
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
    font-size: 11px;
    cursor: pointer;
  }

  .pill-btn.active {
    border-color: #ffd18a;
    color: #ffe0ad;
  }
</style>

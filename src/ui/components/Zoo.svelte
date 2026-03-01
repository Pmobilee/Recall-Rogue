<script lang="ts">
  import { FOSSIL_SPECIES } from '../../data/fossils'
  import { playerSave } from '../stores/playerData'
  import type { FossilState } from '../../data/types'
  import { audioManager } from '../../services/audioService'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  const fossils = $derived($playerSave?.fossils ?? {} as Record<string, FossilState>)

  const revivedSpecies = $derived(
    FOSSIL_SPECIES.filter(s => fossils[s.id]?.revived === true)
  )

  const revivedCount = $derived(revivedSpecies.length)
  const totalCount = FOSSIL_SPECIES.length

  /** Era display color map */
  function getEraColor(era: string): string {
    switch (era) {
      case 'Paleozoic': return '#8B6534'
      case 'Mesozoic': return '#3a7d44'
      case 'Cretaceous': return '#1a8a7a'
      case 'Pleistocene': return '#2563eb'
      case 'Cenozoic': return '#7c3aed'
      case 'Holocene': return '#ea7030'
      case 'Jurassic': return '#c0891a'
      default: return '#6b7280'
    }
  }

  /** Rarity glow / border color */
  function getRarityColor(rarity: string): string {
    switch (rarity) {
      case 'common': return '#9ca3af'
      case 'uncommon': return '#22c55e'
      case 'rare': return '#3b82f6'
      case 'legendary': return '#f59e0b'
      default: return '#9ca3af'
    }
  }

  /** Number of filled stars for rarity */
  function getRarityStars(rarity: string): number {
    switch (rarity) {
      case 'common': return 1
      case 'uncommon': return 2
      case 'rare': return 3
      case 'legendary': return 4
      default: return 1
    }
  }

  function formatRevivedDate(revivedAt: number | undefined): string {
    if (!revivedAt) return 'Unknown date'
    const d = new Date(revivedAt)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  /** Collector badge based on revived count milestones */
  type CollectorBadge = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'

  function getCollectorBadge(count: number): CollectorBadge {
    if (count >= 10) return 'platinum'
    if (count >= 7) return 'gold'
    if (count >= 5) return 'silver'
    if (count >= 3) return 'bronze'
    return 'none'
  }

  const collectorBadge = $derived(getCollectorBadge(revivedCount))

  const MILESTONES: { count: number; badge: CollectorBadge; icon: string; label: string }[] = [
    { count: 3, badge: 'bronze', icon: '🥉', label: 'Bronze' },
    { count: 5, badge: 'silver', icon: '🥈', label: 'Silver' },
    { count: 7, badge: 'gold', icon: '🥇', label: 'Gold' },
    { count: 10, badge: 'platinum', icon: '🏆', label: 'Platinum' },
  ]

  const badgeLabel: Record<CollectorBadge, string> = {
    none: '',
    bronze: 'Bronze Collector',
    silver: 'Silver Collector',
    gold: 'Gold Collector',
    platinum: 'Platinum Collector',
  }

  const badgeColor: Record<CollectorBadge, string> = {
    none: '',
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#e5e4e2',
  }

  const nextMilestone = $derived(
    revivedCount < 3 ? 3
    : revivedCount < 5 ? 5
    : revivedCount < 7 ? 7
    : revivedCount < 10 ? 10
    : null
  )

  /** All unique eras present among revived species */
  const revivedEras = $derived(
    [...new Set(revivedSpecies.map(s => s.era))]
  )

  const unrevidedSpecies = $derived(
    FOSSIL_SPECIES.filter(s => !fossils[s.id]?.revived)
  )

  function handleBack(): void {
    audioManager.playSound('button_click')
    onBack()
  }
</script>

<div class="zoo" aria-label="The Zoo — Museum of Natural History">
  <!-- Header -->
  <div class="zoo-header">
    <button class="back-btn" type="button" onclick={handleBack} aria-label="Back to base">
      Back
    </button>
    <div class="zoo-title-group">
      <h1 class="zoo-title">The Zoo</h1>
      <span class="zoo-subtitle">Museum of Natural History</span>
    </div>
    <div class="collection-progress" aria-label="Collection progress">
      <span class="progress-count">{revivedCount}/{totalCount}</span>
      <span class="progress-label">Species Revived</span>
    </div>
  </div>

  <div class="zoo-body">
    <!-- Revived species section -->
    {#if revivedCount === 0}
      <div class="empty-museum">
        <div class="empty-icon" aria-hidden="true">🦴</div>
        <p class="empty-title">The halls are quiet...</p>
        <p class="empty-desc">Revive fossil companions in the Fossil Gallery to populate your museum.</p>
      </div>
    {:else}
      <!-- Era-grouped display -->
      {#each revivedEras as era}
        {@const speciesInEra = revivedSpecies.filter(s => s.era === era)}
        <div class="era-section" aria-label="{era} era">
          <div class="era-header">
            <div class="era-line"></div>
            <span class="era-label" style="color: {getEraColor(era)}; border-color: {getEraColor(era)}44">
              {era}
            </span>
            <div class="era-line"></div>
          </div>

          <div class="species-grid">
            {#each speciesInEra as species}
              {@const state = fossils[species.id]}
              {@const rarityColor = getRarityColor(species.rarity)}
              {@const stars = getRarityStars(species.rarity)}

              <div
                class="species-card card-revived"
                style="--rarity-color: {rarityColor}; border-color: {rarityColor}55"
                aria-label="{species.name}, {species.era} era, {species.rarity} rarity"
              >
                <!-- Rarity glow ring behind icon -->
                <div class="icon-wrapper" aria-hidden="true">
                  <div class="icon-glow" style="background: radial-gradient(circle, {rarityColor}22 0%, transparent 70%)"></div>
                  <span class="species-icon">{species.icon}</span>
                </div>

                <!-- Name -->
                <div class="species-name">{species.name}</div>

                <!-- Era badge -->
                <span
                  class="era-badge"
                  style="background: {getEraColor(species.era)}22; color: {getEraColor(species.era)}; border-color: {getEraColor(species.era)}55"
                >
                  {species.era}
                </span>

                <!-- Rarity stars -->
                <div class="rarity-stars" aria-label="{species.rarity} — {stars} star{stars !== 1 ? 's' : ''}">
                  {#each Array(4) as _, i}
                    <span class="star" class:star-filled={i < stars} style={i < stars ? `color: ${rarityColor}` : ''}>
                      {i < stars ? '★' : '☆'}
                    </span>
                  {/each}
                </div>

                <!-- Description -->
                <p class="species-desc">{species.description}</p>

                <!-- Companion bonus -->
                {#if species.companionBonus}
                  <div class="bonus-row" aria-label="Companion bonus">
                    <span class="bonus-label">Bonus:</span>
                    <span class="bonus-value">{species.companionBonus}</span>
                  </div>
                {/if}

                <!-- Revived date -->
                <div class="revived-date" aria-label="Revival date">
                  Revived: {formatRevivedDate(state?.revivedAt)}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}

    <!-- Unrevived / mystery species section -->
    {#if unrevidedSpecies.length > 0}
      <div class="era-section unrevealed-section" aria-label="Undiscovered species">
        <div class="era-header">
          <div class="era-line"></div>
          <span class="era-label era-label-dim">Awaiting Discovery</span>
          <div class="era-line"></div>
        </div>
        <div class="species-grid">
          {#each unrevidedSpecies as species}
            {@const rarityColor = getRarityColor(species.rarity)}
            {@const stars = getRarityStars(species.rarity)}
            <div
              class="species-card card-unrevived"
              aria-label="Unknown species, {species.rarity} rarity"
            >
              <div class="icon-wrapper" aria-hidden="true">
                <span class="species-icon icon-hidden">?</span>
              </div>
              <div class="species-name species-name-dim">???</div>
              <span class="era-badge era-badge-dim">??? Era</span>
              <!-- Rarity stars (hint) -->
              <div class="rarity-stars" aria-label="Rarity hint: {species.rarity}">
                {#each Array(4) as _, i}
                  <span class="star" class:star-filled={i < stars} style={i < stars ? `color: ${rarityColor}88` : ''}>
                    {i < stars ? '★' : '☆'}
                  </span>
                {/each}
              </div>
              <p class="species-desc species-desc-dim">Discover and revive this species to learn more.</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Prestige / milestone section -->
    <div class="prestige-section" aria-label="Collector prestige milestones">
      <h2 class="prestige-title">Collector Prestige</h2>

      <!-- Current badge -->
      {#if collectorBadge !== 'none'}
        <div class="current-badge" style="border-color: {badgeColor[collectorBadge]}55; background: {badgeColor[collectorBadge]}10">
          <span class="badge-icon" aria-hidden="true">
            {collectorBadge === 'bronze' ? '🥉' : collectorBadge === 'silver' ? '🥈' : collectorBadge === 'gold' ? '🥇' : '🏆'}
          </span>
          <div class="badge-info">
            <span class="badge-name" style="color: {badgeColor[collectorBadge]}">{badgeLabel[collectorBadge]}</span>
            <span class="badge-sub">{revivedCount} species revived</span>
          </div>
        </div>
      {:else}
        <div class="no-badge">
          <span class="no-badge-text">Revive 3 species to earn your first badge</span>
        </div>
      {/if}

      <!-- Milestone track -->
      <div class="milestones" aria-label="Collection milestones">
        {#each MILESTONES as milestone}
          {@const reached = revivedCount >= milestone.count}
          <div
            class="milestone-item"
            class:milestone-reached={reached}
            aria-label="{milestone.label} collector at {milestone.count} species — {reached ? 'achieved' : 'locked'}"
          >
            <span class="milestone-icon" aria-hidden="true">{milestone.icon}</span>
            <span class="milestone-label" style={reached ? `color: ${badgeColor[milestone.badge]}` : ''}>{milestone.label}</span>
            <span class="milestone-count">{milestone.count} species</span>
            {#if reached}
              <span class="milestone-check" aria-hidden="true">&#10003;</span>
            {:else}
              <span class="milestone-remaining">{milestone.count - revivedCount} left</span>
            {/if}
          </div>
        {/each}
      </div>

      {#if nextMilestone !== null}
        <p class="next-milestone-hint">
          Revive {nextMilestone - revivedCount} more to reach the next milestone!
        </p>
      {:else}
        <p class="next-milestone-hint collection-complete">
          All milestones achieved! You are a Platinum Collector!
        </p>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ===================== Layout ===================== */
  .zoo {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    background: #0d0d18;
    font-family: 'Courier New', monospace;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: var(--color-text);
  }

  /* ===================== Header ===================== */
  .zoo-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #141428;
    border-bottom: 1px solid rgba(0, 210, 180, 0.25);
    flex-shrink: 0;
  }

  .back-btn {
    min-height: 40px;
    padding: 0 16px;
    border: 1px solid rgba(0, 210, 180, 0.4);
    border-radius: 8px;
    background: rgba(0, 210, 180, 0.1);
    color: #00d2b4;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .back-btn:active {
    background: rgba(0, 210, 180, 0.22);
    transform: translateY(1px);
  }

  .zoo-title-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .zoo-title {
    margin: 0;
    color: #00d2b4;
    font-size: clamp(1.1rem, 4vw, 1.5rem);
    font-family: Georgia, 'Times New Roman', serif;
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .zoo-subtitle {
    color: rgba(0, 210, 180, 0.55);
    font-size: 0.7rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .collection-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .progress-count {
    color: #00d2b4;
    font-size: 1.15rem;
    font-weight: 800;
    line-height: 1;
  }

  .progress-label {
    color: rgba(0, 210, 180, 0.55);
    font-size: 0.65rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ===================== Body ===================== */
  .zoo-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* ===================== Empty state ===================== */
  .empty-museum {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 3rem;
    opacity: 0.4;
  }

  .empty-title {
    margin: 0;
    color: var(--color-text-dim);
    font-size: 1rem;
    font-weight: 700;
    font-family: Georgia, serif;
  }

  .empty-desc {
    margin: 0;
    color: var(--color-text-dim);
    font-size: 0.82rem;
    line-height: 1.45;
    opacity: 0.7;
    max-width: 280px;
  }

  /* ===================== Era section ===================== */
  .era-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .unrevealed-section {
    opacity: 0.6;
  }

  .era-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .era-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .era-label {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid;
    border-radius: 999px;
    padding: 3px 10px;
    font-family: 'Courier New', monospace;
  }

  .era-label-dim {
    color: var(--color-text-dim);
    border-color: rgba(255, 255, 255, 0.15);
  }

  /* ===================== Species grid ===================== */
  .species-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  @media (min-width: 640px) {
    .species-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .species-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
  }

  /* ===================== Species card ===================== */
  @keyframes card-breathe {
    0%, 100% { box-shadow: 0 0 8px var(--rarity-color, #9ca3af)22, 0 0 0 1px var(--rarity-color, #9ca3af)22; }
    50%       { box-shadow: 0 0 18px var(--rarity-color, #9ca3af)44, 0 0 0 1px var(--rarity-color, #9ca3af)44; }
  }

  .species-card {
    position: relative;
    border-radius: 14px;
    padding: 14px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    border: 1px solid transparent;
    background: #161628;
    transition: transform 0.12s;
  }

  .card-revived {
    animation: card-breathe 3.5s ease-in-out infinite;
    background: #181830;
  }

  .card-unrevived {
    background: #111120;
    border-color: rgba(255, 255, 255, 0.07) !important;
  }

  .species-card:active {
    transform: scale(0.97);
  }

  /* ===================== Icon ===================== */
  .icon-wrapper {
    position: relative;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2px;
  }

  .icon-glow {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    pointer-events: none;
  }

  .species-icon {
    font-size: 3rem;
    line-height: 1;
    position: relative;
    z-index: 1;
  }

  .icon-hidden {
    font-size: 2rem;
    color: var(--color-text-dim);
    opacity: 0.35;
    filter: grayscale(1);
  }

  /* ===================== Name / Era ===================== */
  .species-name {
    font-family: Georgia, 'Times New Roman', serif;
    color: var(--color-text);
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .species-name-dim {
    color: var(--color-text-dim);
    opacity: 0.5;
  }

  .era-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border: 1px solid;
    border-radius: 999px;
    padding: 2px 8px;
    line-height: 1.4;
  }

  .era-badge-dim {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-dim);
    border-color: rgba(255, 255, 255, 0.1);
    opacity: 0.5;
  }

  /* ===================== Stars ===================== */
  .rarity-stars {
    display: flex;
    gap: 2px;
    font-size: 0.85rem;
  }

  .star {
    color: rgba(255, 255, 255, 0.2);
    line-height: 1;
  }

  .star-filled {
    /* color injected via style attribute */
  }

  /* ===================== Description ===================== */
  .species-desc {
    color: var(--color-text-dim);
    font-size: 0.72rem;
    line-height: 1.4;
    margin: 0;
    font-style: italic;
  }

  .species-desc-dim {
    opacity: 0.5;
  }

  /* ===================== Companion bonus ===================== */
  .bonus-row {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    background: rgba(0, 210, 180, 0.07);
    border: 1px solid rgba(0, 210, 180, 0.18);
    border-radius: 8px;
    padding: 5px 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .bonus-label {
    color: #00d2b4;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .bonus-value {
    color: #7eeadb;
    font-size: 0.7rem;
    line-height: 1.3;
  }

  /* ===================== Revived date ===================== */
  .revived-date {
    color: rgba(255, 255, 255, 0.25);
    font-size: 0.62rem;
    margin-top: 2px;
  }

  /* ===================== Prestige section ===================== */
  .prestige-section {
    background: #141424;
    border: 1px solid rgba(0, 210, 180, 0.18);
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .prestige-title {
    margin: 0;
    color: #00d2b4;
    font-size: 0.95rem;
    font-weight: 700;
    font-family: Georgia, serif;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Current badge display */
  .current-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 2px solid;
    border-radius: 12px;
    padding: 12px 14px;
  }

  .badge-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .badge-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .badge-name {
    font-family: Georgia, serif;
    font-size: 1rem;
    font-weight: 700;
  }

  .badge-sub {
    color: var(--color-text-dim);
    font-size: 0.75rem;
  }

  .no-badge {
    padding: 12px;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    text-align: center;
  }

  .no-badge-text {
    color: var(--color-text-dim);
    font-size: 0.8rem;
    font-style: italic;
  }

  /* Milestone track */
  .milestones {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  @media (min-width: 480px) {
    .milestones {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .milestone-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 10px 8px;
    text-align: center;
    opacity: 0.5;
    transition: opacity 0.2s, border-color 0.2s;
  }

  .milestone-reached {
    opacity: 1;
    border-color: rgba(0, 210, 180, 0.3);
    background: rgba(0, 210, 180, 0.05);
  }

  .milestone-icon {
    font-size: 1.4rem;
    line-height: 1;
  }

  .milestone-label {
    font-weight: 700;
    font-size: 0.78rem;
    color: var(--color-text-dim);
    font-family: Georgia, serif;
  }

  .milestone-count {
    color: var(--color-text-dim);
    font-size: 0.65rem;
  }

  .milestone-check {
    color: var(--color-success, #22c55e);
    font-size: 0.9rem;
    font-weight: 900;
  }

  .milestone-remaining {
    color: var(--color-text-dim);
    font-size: 0.62rem;
    font-style: italic;
  }

  .next-milestone-hint {
    margin: 0;
    color: rgba(0, 210, 180, 0.6);
    font-size: 0.75rem;
    text-align: center;
    font-style: italic;
  }

  .collection-complete {
    color: #ffd700;
    font-style: normal;
    font-weight: 700;
  }
</style>

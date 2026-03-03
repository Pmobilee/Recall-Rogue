<script lang="ts">
  import { getDueReviews, playerSave } from '../../stores/playerData'
  import { audioManager } from '../../../services/audioService'
  import { BALANCE } from '../../../data/balance'

  interface Props {
    onStudy: () => void
    onKnowledgeStore?: () => void
    gaiaVisible: boolean
    idleSpriteUrl: string
    idleExpressionId: string
    gaiaComment: string
    gaiaNameLabel: string
  }

  let {
    onStudy,
    onKnowledgeStore,
    gaiaVisible,
    idleSpriteUrl,
    idleExpressionId,
    gaiaComment,
    gaiaNameLabel,
  }: Props = $props()

  const dueReviews = $derived.by(() => {
    $playerSave
    return getDueReviews()
  })
  const dueReviewCount = $derived(dueReviews.length)
  const hasDueReviews = $derived(dueReviewCount > 0)

  const kp = $derived($playerSave?.knowledgePoints ?? 0)

  interface RitualState {
    active: boolean
    type: 'morning' | 'evening' | null
    completed: boolean
  }

  function getRitualState(): RitualState {
    const hour = new Date().getHours()
    const today = new Date().toISOString().split('T')[0]
    if (hour >= BALANCE.MORNING_REVIEW_HOUR && hour < BALANCE.MORNING_REVIEW_END) {
      return { active: true, type: 'morning', completed: $playerSave?.lastMorningReview === today }
    }
    if (hour >= BALANCE.EVENING_REVIEW_HOUR && hour < BALANCE.EVENING_REVIEW_END) {
      return { active: true, type: 'evening', completed: $playerSave?.lastEveningReview === today }
    }
    return { active: false, type: null, completed: false }
  }

  let ritualState = $state<RitualState>(getRitualState())

  $effect(() => {
    $playerSave
    ritualState = getRitualState()
  })

  $effect(() => {
    const interval = setInterval(() => {
      ritualState = getRitualState()
    }, 60_000)
    return () => clearInterval(interval)
  })

  function handleStudy(): void {
    audioManager.playSound('button_click')
    onStudy()
  }

  function handleKnowledgeStore(): void {
    audioManager.playSound('button_click')
    onKnowledgeStore?.()
  }

  function handleStartRitual(): void {
    audioManager.playSound('button_click')
    onStudy()
  }
</script>

<!-- ========== RESEARCH LAB ========== -->
<div class="card room-header-card">
  <div class="room-header-info">
    <span class="room-header-icon" aria-hidden="true">🔬</span>
    <div>
      <h2 class="room-header-title">Research Lab</h2>
      <p class="room-header-desc">Study, review, and expand your knowledge</p>
    </div>
  </div>
</div>

<div class="gaia-card" class:gaia-visible={gaiaVisible} aria-label="GAIA comment" aria-live="polite">
  <div class="gaia-avatar-col">
    <img class="gaia-avatar-img" src={idleSpriteUrl} alt={`G.A.I.A. ${idleExpressionId}`} width="56" height="56" />
    <span class="gaia-name">{gaiaNameLabel}</span>
  </div>
  <div class="gaia-body">
    <span class="gaia-text">{gaiaComment}</span>
  </div>
</div>

<!-- Review Ritual Banner -->
{#if ritualState.active}
  <div
    class="ritual-banner"
    class:ritual-completed={ritualState.completed}
    aria-label={ritualState.type === 'morning' ? 'Morning review ritual' : 'Evening review ritual'}
  >
    {#if ritualState.completed}
      <span class="ritual-check">&#10003;</span>
      <span class="ritual-complete-text">
        {ritualState.type === 'morning' ? 'Morning' : 'Evening'} ritual complete!
      </span>
    {:else}
      <div class="ritual-info">
        <span class="ritual-icon">{ritualState.type === 'morning' ? '&#9728;' : '&#127769;'}</span>
        <div class="ritual-text">
          {#if ritualState.type === 'morning'}
            <span class="ritual-title">Morning Review</span>
            <span class="ritual-desc">Start your day with {BALANCE.RITUAL_CARD_COUNT} cards (+{BALANCE.RITUAL_BONUS_DUST} dust bonus!)</span>
          {:else}
            <span class="ritual-title">Evening Review</span>
            <span class="ritual-desc">End your day right (+{BALANCE.RITUAL_BONUS_DUST} dust bonus!)</span>
          {/if}
        </div>
      </div>
      {#if hasDueReviews}
        <button class="ritual-start-btn" type="button" onclick={handleStartRitual}>
          Start Ritual
        </button>
      {:else}
        <span class="ritual-no-cards">No cards due</span>
      {/if}
    {/if}
  </div>
{/if}

<div class="card actions-card" aria-label="Lab actions">
  <button
    class="action-button study-button"
    class:dimmed={!hasDueReviews}
    type="button"
    onclick={handleStudy}
    aria-label="Start memory strengthening session"
  >
    <span>Memory Strengthening</span>
    {#if hasDueReviews}
      <span class="count-badge">{dueReviewCount} due</span>
    {:else}
      <span class="empty-note">No reviews due</span>
    {/if}
  </button>

  <button class="action-button knowledge-store-button" type="button" onclick={handleKnowledgeStore}>
    <span>Knowledge Store</span>
    <span class="kp-badge">{kp} KP</span>
  </button>
</div>

<div class="card lab-tip-card" aria-label="Lab tip">
  <p class="lab-tip-text">Tip: Nailing a field scan earns dust. Missing one vents a little O2 — but you'll remember it better!</p>
</div>

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
    font-size: 0.85rem;
    margin: 0;
    line-height: 1.3;
  }

  .gaia-card {
    margin: 8px;
    padding: 10px 14px;
    background: rgba(20, 20, 40, 0.6);
    border-left: 3px solid #ffd369;
    border-radius: 6px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 0.8rem;
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .gaia-visible {
    opacity: 1;
  }

  .gaia-avatar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .gaia-avatar-img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    image-rendering: pixelated;
    border-radius: 8px;
    filter: drop-shadow(0 0 6px rgba(34, 217, 217, 0.4));
  }

  .gaia-name {
    color: #22d9d9;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .gaia-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .gaia-text {
    color: #b0b0c8;
    font-style: italic;
    line-height: 1.4;
  }

  .actions-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
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

  .study-button {
    background: var(--color-primary);
  }

  .knowledge-store-button {
    background: color-mix(in srgb, #a060ef 28%, var(--color-surface) 72%);
  }

  .kp-badge {
    font-size: 0.78rem;
    font-weight: 700;
    color: #e0c8ff;
    background: rgba(160, 100, 255, 0.22);
    border: 1px solid rgba(160, 100, 255, 0.4);
    border-radius: 999px;
    padding: 4px 10px;
  }

  .count-badge {
    min-width: 28px;
    height: 28px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-text) 92%, var(--color-bg) 8%);
    color: var(--color-bg);
    display: grid;
    place-items: center;
    font-size: 0.9rem;
    font-weight: 800;
    padding: 0 8px;
  }

  .empty-note {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  .dimmed {
    opacity: 0.7;
  }

  /* ---- Review Ritual Banner ---- */
  @keyframes ritual-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 186, 0, 0.35); }
    50% { box-shadow: 0 0 0 6px rgba(255, 186, 0, 0); }
  }

  .ritual-banner {
    margin: 8px;
    padding: 14px 16px;
    border: 2px solid #ffba00;
    border-radius: 12px;
    background: color-mix(in srgb, #3a2800 55%, var(--color-surface) 45%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    animation: ritual-pulse 2s ease-in-out infinite;
    font-family: inherit;
  }

  .ritual-banner.ritual-completed {
    border-color: var(--color-success);
    background: color-mix(in srgb, #003a1a 55%, var(--color-surface) 45%);
    animation: none;
  }

  .ritual-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .ritual-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .ritual-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ritual-title {
    color: #ffba00;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .ritual-desc {
    color: #c89000;
    font-size: 0.8rem;
    line-height: 1.3;
  }

  .ritual-start-btn {
    flex-shrink: 0;
    border: 0;
    border-radius: 9px;
    background: #ffba00;
    color: #1a0e00;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 9px 16px;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: opacity 0.15s, transform 0.1s;
  }

  .ritual-start-btn:active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .ritual-no-cards {
    flex-shrink: 0;
    color: #c89000;
    font-size: 0.8rem;
    font-style: italic;
  }

  .ritual-check {
    color: var(--color-success);
    font-size: 1.3rem;
    font-weight: 900;
    flex-shrink: 0;
  }

  .ritual-complete-text {
    color: var(--color-success);
    font-size: 0.9rem;
    font-weight: 700;
    flex: 1;
  }

  .lab-tip-card {
    border-left: 3px solid var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface) 92%);
    margin-bottom: 20px;
  }

  .lab-tip-text {
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

    .action-button {
      font-size: 1rem;
    }
  }
</style>

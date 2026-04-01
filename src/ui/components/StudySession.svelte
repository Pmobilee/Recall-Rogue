<script lang="ts">
  import type { Fact, ReviewState } from '../../data/types'
  import type { AnkiButton } from '../../services/sm2'
  import { getButtonIntervals } from '../../services/sm2'
  import { audioManager } from '../../services/audioService'
  import { playCardAudio } from '../../services/cardAudioManager'
  import KnowledgeTree from './KnowledgeTree.svelte'
  import { initialLOD } from './tree/TreeLOD'

  // Stable no-op LOD state for decorative tree previews in StudySession
  const _previewLOD = initialLOD()

  interface Props {
    facts: Fact[]
    reviewStates: ReviewState[]
    onAnswer: (factId: string, button: AnkiButton) => void
    onComplete: () => void
  }

  let { facts, reviewStates, onAnswer, onComplete }: Props = $props()

  // ── Session size selection ──────────────────────────────────
  type SessionSize = 5 | 10 | 20
  let sessionSize = $state<SessionSize | null>(null)

  // ── Card queue (set once sessionSize is chosen) ─────────────
  let queue = $state<Fact[]>([])
  let cardIndex = $state(0)

  // ── Card flip state ─────────────────────────────────────────
  let isFlipped = $state(false)

  // ── Score tracking ──────────────────────────────────────────
  let correctCount = $state(0)
  let isDone = $state(false)

  // ── Again re-queue (session loop) ─────────────────────────
  let againCounts = $state<Map<string, number>>(new Map())
  const MAX_AGAIN_REQUEUES = 2
  let originalTotal = $state(0)

  // ── Phase 57.2: Tree shimmer on correct answer ────────────
  let lastAnswerCorrect = $state(false)

  // ── FSRS indicator shown briefly after rating ───────────
  let srsIndicator = $state<'+' | '-' | '=' | null>(null)

  function onCorrectAnswer(): void {
    lastAnswerCorrect = true
    setTimeout(() => { lastAnswerCorrect = false }, 800)
  }

  // ── Derived helpers ─────────────────────────────────────────
  const currentFact = $derived(queue[cardIndex] ?? null)
  const totalCards = $derived(queue.length)
  const progressLabel = $derived(`${Math.min(cardIndex + 1, originalTotal)} / ${originalTotal}`)
  const progressPct = $derived(originalTotal > 0 ? Math.min(((cardIndex) / originalTotal) * 100, 100) : 0)
  const progressOver50 = $derived(progressPct > 50)

  const allCorrect = $derived(isDone && correctCount === originalTotal)
  const mostlyCorrect = $derived(isDone && !allCorrect && correctCount / originalTotal > 0.7)

  const summaryMessage = $derived.by(() => {
    if (!isDone) return ''
    if (allCorrect) return 'Perfect session! Your knowledge grows stronger.'
    if (mostlyCorrect) return 'Solid review. The tree appreciates your effort.'
    return 'Some of those need more practice. The tree will wait.'
  })

  // ── Progress bar color based on fill percentage ──────────────
  const progressColor = $derived.by(() => {
    if (progressPct >= 90) return '#ffd369'   // gold near complete
    if (progressPct >= 50) return '#4ecca3'   // green over halfway
    return '#6464ff'                           // blue at start
  })

  // ── Category color for top label ────────────────────────────
  const CATEGORY_COLORS: Record<string, string> = {
    'Language':        '#a78bfa',
    'Life Sciences':   '#34d399',
    'History':         '#f59e0b',
    'Culture':         '#f472b6',
    'Natural Sciences':'#60a5fa',
    'Geography':       '#4ade80',
    'Technology':      '#38bdf8',
  }

  function getCategoryColor(categories: string[]): string {
    const top = categories[0] ?? ''
    return CATEGORY_COLORS[top] ?? '#9ca3af'
  }

  // ── 3-button order ─────────────────────────────────────────
  const buttonOrder: { key: AnkiButton; label: string }[] = [
    { key: 'again', label: 'Again' },
    { key: 'okay', label: 'Okay' },
    { key: 'good', label: 'Good' },
  ]

  // ── Interval previews derived from current card's review state ──
  const intervals = $derived.by(() => {
    if (!currentFact) return { again: '', okay: '', good: '' }
    const rs = reviewStates.find(r => r.factId === currentFact.id)
    if (!rs) return { again: '1m', okay: '1d', good: '4d' }
    return getButtonIntervals(rs)
  })

  // ── Handlers ────────────────────────────────────────────────

  /** Choose session size and build the card queue. */
  function chooseSize(size: SessionSize): void {
    audioManager.playSound('button_click')
    playCardAudio('rest-study')
    sessionSize = size
    queue = facts.slice(0, size)
    cardIndex = 0
    isFlipped = false
    correctCount = 0
    isDone = false
    againCounts = new Map()
    originalTotal = queue.length
  }

  /** Flip the card to reveal the answer. */
  function revealCard(): void {
    if (isFlipped) return
    audioManager.playSound('button_click')
    isFlipped = true
  }

  /** Player self-rates and advances to the next card. */
  async function rate(button: AnkiButton): Promise<void> {
    if (!currentFact) return
    const correct = button !== 'again'
    audioManager.playSound(correct ? 'quiz_correct' : 'quiz_wrong')
    if (correct) {
      correctCount++
      onCorrectAnswer()
    }
    onAnswer(currentFact.id, button)

    // Set FSRS indicator based on button choice
    srsIndicator = button === 'again' ? '-' : '+'

    // Re-queue Again cards at the end (max MAX_AGAIN_REQUEUES times per card)
    if (button === 'again') {
      const count = againCounts.get(currentFact.id) ?? 0
      if (count < MAX_AGAIN_REQUEUES) {
        queue = [...queue, currentFact]
        againCounts.set(currentFact.id, count + 1)
      }
    }

    // Brief visual pause before transitioning
    await new Promise<void>(r => setTimeout(r, 300))

    srsIndicator = null

    if (cardIndex + 1 >= totalCards) {
      isDone = true
    } else {
      isFlipped = false
      cardIndex++
    }
  }

  function handleComplete(): void {
    audioManager.playSound('button_click')
    onComplete()
  }
</script>

<div class="study-session" role="main" aria-label="Memory strengthening session">

  <!-- ── AMBIENT PARTICLES ─────────────────────────────────────── -->
  <div class="particles" aria-hidden="true">
    <span class="particle particle-1"></span>
    <span class="particle particle-2"></span>
    <span class="particle particle-3"></span>
    <span class="particle particle-4"></span>
    <span class="particle particle-5"></span>
    <span class="particle particle-6"></span>
    <span class="particle particle-7"></span>
    <span class="particle particle-8"></span>
    <span class="particle particle-9"></span>
    <span class="particle particle-10"></span>
  </div>

  <!-- ── BREATHING GUIDE ────────────────────────────────────────── -->
  <div class="breathing-guide" aria-hidden="true"></div>

  <!-- ── TREE SILHOUETTE (Phase 57.2) ────────────────────────────── -->
  <div class="tree-silhouette" class:shimmer={lastAnswerCorrect} aria-hidden="true"></div>

  <!-- ── SIZE SELECTOR ───────────────────────────────────────── -->
  {#if sessionSize === null}
    <div class="selector-screen">
      <!-- Tree preview decoration in corner -->
      <div class="tree-preview" aria-hidden="true">
        <KnowledgeTree
          {facts}
          lod={_previewLOD}
          showMode="learned"
          onMainBranchTap={() => {}}
          onSubBranchTap={() => {}}
          onLeafTap={() => {}}
          onLeafLongPress={() => {}}
          onPinchIn={() => {}}
          onPinchOut={() => {}}
        />
      </div>

      <h1 class="selector-title">
        <span class="tree-icon" aria-hidden="true">🌿</span>
        Memory Strengthening
      </h1>
      <p class="selector-sub">
        Choose your session
      </p>
      <p class="selector-card-count">
        {facts.length} fact{facts.length === 1 ? '' : 's'} ready to strengthen
      </p>
      <div class="selector-buttons">
        <button
          class="size-btn"
          type="button"
          disabled={facts.length === 0}
          onclick={() => chooseSize(5)}
        >
          <span class="size-number">5</span>
          <span class="size-label">Quick review</span>
        </button>
        <button
          class="size-btn"
          type="button"
          disabled={facts.length === 0}
          onclick={() => chooseSize(10)}
        >
          <span class="size-number">10</span>
          <span class="size-label">Standard session</span>
        </button>
        <button
          class="size-btn"
          type="button"
          disabled={facts.length === 0}
          onclick={() => chooseSize(20)}
        >
          <span class="size-number">20</span>
          <span class="size-label">Deep session</span>
        </button>
      </div>

      {#if facts.length === 0}
        <p class="no-cards-note">No cards due right now. Dive to discover more facts!</p>
        <p class="db-hint">Facts database may still be loading. Try again in a few seconds.</p>
      {/if}

      <button class="back-link" type="button" onclick={handleComplete}>
        Return to Base
      </button>
    </div>

  <!-- ── COMPLETE SCREEN ─────────────────────────────────────── -->
  {:else if isDone}
    <div class="complete-screen">
      {#if allCorrect}
        <!-- Confetti burst for perfect score -->
        <div class="confetti-wrap" aria-hidden="true">
          <span class="confetti c1"></span>
          <span class="confetti c2"></span>
          <span class="confetti c3"></span>
          <span class="confetti c4"></span>
          <span class="confetti c5"></span>
          <span class="confetti c6"></span>
          <span class="confetti c7"></span>
          <span class="confetti c8"></span>
        </div>
      {/if}
      <h1 class="complete-title">Memory Strengthened!</h1>
      <div class="score-display">
        <span class="score-correct">{correctCount}</span>
        <span class="score-sep">/</span>
        <span class="score-total">{originalTotal}</span>
      </div>
      <p class="score-label">locked in</p>
      <p class="summary-message">{summaryMessage}</p>
      <button class="return-btn" type="button" onclick={handleComplete}>
        Return to Base
      </button>
    </div>

  <!-- ── CARD INTERFACE ──────────────────────────────────────── -->
  {:else if currentFact}
    <!-- Tree preview in corner for card phase -->
    <div class="tree-preview tree-preview--card" aria-hidden="true">
      <KnowledgeTree
        {facts}
        lod={_previewLOD}
        showMode="learned"
        onMainBranchTap={() => {}}
        onSubBranchTap={() => {}}
        onLeafTap={() => {}}
        onLeafLongPress={() => {}}
        onPinchIn={() => {}}
        onPinchOut={() => {}}
      />
    </div>

    <!-- Category breadcrumb (outside the card) -->
    <p class="top-category" style="color: {getCategoryColor(currentFact.category)};">
      {currentFact.category.join(' › ')}
    </p>

    <!-- Progress bar -->
    <div class="progress-bar-wrap" aria-label="Session progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {progressPct}%; background: {progressColor};"
        >
          {#if progressOver50}
            <span class="progress-sparkle" aria-hidden="true">✦</span>
          {/if}
        </div>
      </div>
      <span class="progress-label" data-testid="study-progress">{progressLabel}</span>
    </div>

    <!-- Card scene -->
    <div class="card-scene" aria-live="polite">
      {#if !isFlipped}
        <div
          class="card-face card-front"
          role="button"
          tabindex={0}
          aria-label="Reveal answer"
          onclick={() => void revealCard()}
          onkeydown={e => { if (e.key === 'Enter' || e.key === ' ') void revealCard() }}
        >
          <p class="card-question" data-testid="study-card-question">{currentFact.quizQuestion}</p>
          <p class="tap-hint">Tap card or press Reveal</p>
          <button
            class="reveal-btn"
            type="button"
            onclick={e => { e.stopPropagation(); void revealCard() }}
          >
            Reveal
          </button>
        </div>
      {:else}
        <div class="card-face card-back">
          <p class="card-answer" data-testid="study-card-answer">{currentFact.correctAnswer}</p>
          <div class="card-sprite" aria-hidden="true">
            <span class="card-sprite-label">sprite</span>
          </div>
          {#if currentFact.explanation || currentFact.mnemonic || currentFact.gaiaComment}
            <div class="card-details">
              {#if currentFact.explanation}
                <p class="detail-explanation" data-testid="study-explanation">{currentFact.explanation}</p>
              {/if}
              {#if currentFact.mnemonic}
                <p class="detail-mnemonic" data-testid="study-mnemonic">{currentFact.mnemonic}</p>
              {/if}
              {#if currentFact.gaiaComment}
                <p class="detail-gaia" data-testid="study-gaia-comment">{currentFact.gaiaComment}</p>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Self-rating buttons (only after flip) -->
    {#if isFlipped}
      <div class="rating-buttons">
        {#if srsIndicator !== null}
          <span
            class="srs-indicator"
            class:srs-indicator--plus={srsIndicator === '+'}
            class:srs-indicator--minus={srsIndicator === '-'}
          >SRS {srsIndicator}</span>
        {/if}
        {#each buttonOrder as btn}
          <button class="rating-btn rating-btn--{btn.key}" type="button" onclick={() => void rate(btn.key)}>
            <span class="rating-label">{btn.label}</span>
            <span class="rating-interval">{intervals[btn.key]}</span>
          </button>
        {/each}
      </div>
    {:else}
      <!-- Placeholder to prevent layout shift -->
      <div class="rating-buttons rating-buttons--hidden" aria-hidden="true">
        <div class="rating-btn-placeholder"></div>
        <div class="rating-btn-placeholder"></div>
        <div class="rating-btn-placeholder"></div>
      </div>
    {/if}
  {/if}

</div>

<style>
  /* ── Layout ─────────────────────────────────────────────────── */
  .study-session {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: radial-gradient(ellipse at 50% 110%, #1a2a4a 0%, #0a1525 70%);
    font-family: 'Courier New', monospace;
    padding: 1rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Ambient floating particles ──────────────────────────────── */
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }

  .particle {
    position: absolute;
    border-radius: 50%;
    will-change: transform;
    background: rgba(180, 180, 255, 0.2);
  }

  /* 10 particles — varied sizes, positions, speeds, horizontal sway */
  .particle-1  { width: 2px; height: 2px; left: 8%;   bottom: -10px; animation: float-up 14s  2.0s ease-in-out infinite; opacity: 0.18; }
  .particle-2  { width: 3px; height: 3px; left: 20%;  bottom: -10px; animation: float-up 11s  0.5s ease-in-out infinite; opacity: 0.22; }
  .particle-3  { width: 2px; height: 2px; left: 33%;  bottom: -10px; animation: float-up 16s  4.0s ease-in-out infinite; opacity: 0.15; }
  .particle-4  { width: 4px; height: 4px; left: 45%;  bottom: -10px; animation: float-up 12s  1.2s ease-in-out infinite; opacity: 0.20; }
  .particle-5  { width: 2px; height: 2px; left: 58%;  bottom: -10px; animation: float-up 18s  6.5s ease-in-out infinite; opacity: 0.17; }
  .particle-6  { width: 3px; height: 3px; left: 70%;  bottom: -10px; animation: float-up 13s  3.0s ease-in-out infinite; opacity: 0.25; }
  .particle-7  { width: 2px; height: 2px; left: 82%;  bottom: -10px; animation: float-up 15s  0.0s ease-in-out infinite; opacity: 0.19; }
  .particle-8  { width: 3px; height: 3px; left: 25%;  bottom: -10px; animation: float-up 10s  7.0s ease-in-out infinite; opacity: 0.28; }
  .particle-9  { width: 2px; height: 2px; left: 55%;  bottom: -10px; animation: float-up 17s  2.8s ease-in-out infinite; opacity: 0.16; }
  .particle-10 { width: 4px; height: 4px; left: 90%;  bottom: -10px; animation: float-up 12s  5.0s ease-in-out infinite; opacity: 0.22; }

  @keyframes float-up {
    0%   { transform: translateY(0)    translateX(0);   opacity: 0;    }
    10%  { opacity: 1; }
    50%  { transform: translateY(-50vh) translateX(12px); }
    90%  { opacity: 0.8; }
    100% { transform: translateY(-105vh) translateX(-8px); opacity: 0; }
  }

  /* ── Tree silhouette (Phase 57.2) ────────────────────────────── */
  .tree-silhouette {
    position: absolute;
    bottom: 0;
    right: 5%;
    width: 120px;
    height: 55%;
    pointer-events: none;
    z-index: 0;
    opacity: 0.3;
    background:
      /* Trunk */
      linear-gradient(to top, #0d1a2d 0%, #0d1a2d 40%, transparent 40%) no-repeat center bottom / 12px 100%,
      /* Lower canopy */
      radial-gradient(ellipse 60px 50px at 50% 55%, #0d1a2d 60%, transparent 61%),
      /* Middle canopy */
      radial-gradient(ellipse 50px 45px at 55% 42%, #0d1a2d 60%, transparent 61%),
      /* Upper canopy */
      radial-gradient(ellipse 35px 40px at 48% 28%, #0d1a2d 60%, transparent 61%),
      /* Top tuft */
      radial-gradient(ellipse 20px 25px at 50% 15%, #0d1a2d 60%, transparent 61%);
    transition: opacity 0.3s ease;
  }

  .tree-silhouette.shimmer {
    animation: leaf-shimmer 0.8s ease-out;
  }

  @keyframes leaf-shimmer {
    0%   { opacity: 0.3; filter: brightness(1); }
    30%  { opacity: 0.7; filter: brightness(1.8) hue-rotate(30deg); }
    100% { opacity: 0.3; filter: brightness(1); }
  }

  /* ── Breathing guide ─────────────────────────────────────────── */
  .breathing-guide {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(100, 100, 255, 0.25) 0%, transparent 70%);
    pointer-events: none;
    will-change: transform;
    animation: breathe 4s ease-in-out infinite;
    z-index: 0;
  }

  @keyframes breathe {
    0%, 100% { transform: translateX(-50%) scale(0.8);  opacity: 0.08; }
    50%       { transform: translateX(-50%) scale(1.2);  opacity: 0.12; }
  }

  /* ── Tree preview (decorative corner) ───────────────────────── */
  .tree-preview {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 150px;
    height: 100px;
    overflow: hidden;
    pointer-events: none;
    opacity: 0.22;
    border-radius: 8px;
    z-index: 1;
  }

  .tree-preview--card {
    top: 10px;
    right: 10px;
  }

  /* ── Size selector ───────────────────────────────────────────── */
  .selector-screen {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    max-width: 380px;
  }

  .selector-title {
    color: var(--color-warning);
    font-family: Georgia, serif;
    font-size: clamp(1.8rem, 5vw, 2.4rem);
    margin: 0;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tree-icon {
    font-size: 0.85em;
    line-height: 1;
  }

  .selector-sub {
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 300;
    margin: -0.5rem 0 0;
    letter-spacing: 0.5px;
  }

  .selector-card-count {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    margin: -0.5rem 0 0;
  }

  .selector-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .size-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    min-height: 68px;
    border: 1.5px solid rgba(100, 100, 255, 0.35);
    border-radius: 18px;
    background: rgba(30, 30, 60, 0.6);
    color: var(--color-text);
    font-family: inherit;
    cursor: pointer;
    padding: 0 1.5rem;
    transition: background 160ms ease, border-color 160ms ease, transform 100ms ease, box-shadow 160ms ease;
    backdrop-filter: blur(4px);
  }

  .size-btn:hover:not(:disabled) {
    border-color: rgba(130, 130, 255, 0.65);
    background: rgba(50, 50, 100, 0.65);
    box-shadow: 0 0 18px rgba(100, 100, 255, 0.18);
  }

  .size-btn:active:not(:disabled) {
    transform: scale(0.97);
    background: rgba(60, 60, 120, 0.75);
  }

  .size-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .size-number {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--color-warning);
    min-width: 2.5rem;
    text-align: center;
  }

  .size-label {
    color: var(--color-text-dim);
    font-size: 0.9rem;
    font-weight: 400;
  }

  .no-cards-note {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    text-align: center;
    font-style: italic;
  }

  .db-hint {
    font-size: 0.75rem;
    color: var(--color-warning, #f2c94c);
    margin-top: 0.5rem;
    text-align: center;
  }

  .back-link {
    background: transparent;
    border: 1px solid rgba(150, 150, 180, 0.3);
    border-radius: 12px;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.9rem;
    padding: 0.6rem 1.5rem;
    cursor: pointer;
    transition: border-color 160ms, color 160ms, box-shadow 160ms;
  }

  .back-link:hover {
    border-color: rgba(150, 150, 200, 0.65);
    color: var(--color-text);
    box-shadow: 0 0 10px rgba(120, 120, 200, 0.12);
  }

  /* ── Top category breadcrumb ───────────────────────────────── */
  .top-category {
    font-size: 0.65rem;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    text-align: center;
    margin: 0;
    padding-top: 0.5rem;
    z-index: 2;
    font-weight: 600;
    line-height: 1.3;
  }

  /* ── Progress bar ────────────────────────────────────────────── */
  .progress-bar-wrap {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 420px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .progress-bar {
    flex: 1;
    height: 7px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    position: relative;
    height: 100%;
    border-radius: 999px;
    transition: width 300ms ease, background 500ms ease;
    box-shadow: 0 0 8px currentColor;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    overflow: visible;
  }

  .progress-sparkle {
    position: absolute;
    right: -2px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    line-height: 1;
    animation: sparkle-pulse 1.2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes sparkle-pulse {
    0%, 100% { opacity: 0.6; transform: translateY(-50%) scale(0.9); }
    50%       { opacity: 1.0; transform: translateY(-50%) scale(1.2); }
  }

  .progress-label {
    color: var(--color-text-dim);
    font-size: 0.8rem;
    white-space: nowrap;
    min-width: 3.5rem;
    text-align: right;
  }

  /* ── Card scene ────────────────────────────────────────────── */
  .card-scene {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 420px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    margin-bottom: 0;
    padding-bottom: 100px;
  }

  .card-face {
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.25rem 1rem;
    gap: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.07);
    width: 100%;
  }

  /* Card front: dark base with blue/purple glow */
  .card-front {
    flex: 1;
    min-height: 0;
    justify-content: center;
    background: #1a1a2e;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.55),
      0 0 15px rgba(100, 100, 255, 0.15);
  }

  /* Card back: slightly lighter background */
  .card-back {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: #252540;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.55),
      0 0 15px rgba(78, 204, 163, 0.12);
  }

  /* ── Sprite placeholder ──────────────────────────────────────── */
  .card-sprite {
    width: 80px;
    height: 80px;
    border-radius: 8px;
    border: 2px dashed rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .card-sprite-label {
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.15);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .card-question {
    color: var(--color-warning);
    font-size: clamp(0.9rem, 2.5vw, 1.1rem);
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  .tap-hint {
    color: var(--color-text-dim);
    font-size: 0.75rem;
    font-style: italic;
    margin: 0;
    opacity: 0.7;
  }

  .reveal-btn {
    margin-top: 0.5rem;
    min-width: 140px;
    min-height: 46px;
    border: 1.5px solid rgba(100, 100, 255, 0.5);
    border-radius: 12px;
    background: rgba(40, 40, 100, 0.5);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 120ms ease, transform 100ms ease, box-shadow 120ms ease;
  }

  .reveal-btn:hover {
    background: rgba(60, 60, 140, 0.65);
    box-shadow: 0 0 12px rgba(100, 100, 255, 0.25);
  }

  .reveal-btn:active {
    transform: scale(0.96);
    background: rgba(80, 80, 170, 0.7);
  }

  .card-answer {
    color: var(--color-success);
    font-size: clamp(1.1rem, 4vw, 1.5rem);
    font-weight: 800;
    text-align: center;
    line-height: 1.3;
    margin: 0;
    letter-spacing: 0.5px;
  }

  /* ── Detail box ────────────────────────────────────────────── */
  .card-details {
    width: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0.75rem;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-explanation {
    color: #8a8aa0;
    font-size: 0.8rem;
    text-align: center;
    line-height: 1.55;
    margin: 0;
  }

  .detail-mnemonic {
    color: #a78bfa;
    font-style: italic;
    font-size: 0.8rem;
    line-height: 1.4;
    margin: 0;
    text-align: center;
  }

  .detail-gaia {
    color: #4ecca3;
    font-size: 0.8rem;
    line-height: 1.4;
    margin: 0;
    text-align: center;
  }

  .detail-gaia::before {
    content: 'GAIA: ';
    font-weight: 700;
    opacity: 0.7;
  }

  /* ── Rating buttons ──────────────────────────────────────────── */
  .rating-buttons {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    gap: 0.5rem;
    width: 100%;
    max-width: 420px;
    margin: 0 auto;
    padding: 0.75rem 1rem;
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
    background: linear-gradient(to top, rgba(10,21,37,0.95) 60%, transparent);
  }

  .rating-buttons--hidden {
    position: static;
    pointer-events: none;
    opacity: 0;
    min-height: 90px;
    background: none;
    padding: 0;
  }

  .rating-btn {
    flex: 1;
    min-height: 48px;
    border: 0;
    border-radius: 14px;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 100ms ease, filter 120ms ease;
  }

  .rating-btn:active {
    transform: scale(0.97);
  }

  .rating-btn--again {
    background: color-mix(in srgb, #e74c3c 55%, #0d0d1a 45%);
    color: #fff;
  }
  .rating-btn--again:hover { filter: brightness(1.1); }

  .rating-btn--okay {
    background: var(--color-success);
    color: #0b231a;
    flex: 1.3;
  }
  .rating-btn--okay:hover { filter: brightness(1.05); }

  .rating-btn--good {
    background: color-mix(in srgb, #60a5fa 55%, #0d0d1a 45%);
    color: #fff;
  }
  .rating-btn--good:hover { filter: brightness(1.1); }

  .rating-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .rating-interval {
    display: block;
    font-size: 0.65rem;
    font-weight: 400;
    opacity: 0.7;
    margin-top: 2px;
  }

  .rating-btn-placeholder {
    flex: 1;
    min-height: 48px;
  }

  /* ── FSRS indicator ──────────────────────────────────────────── */
  .srs-indicator {
    position: absolute;
    top: calc(-4px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%) translateY(-100%);
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    opacity: 0.7;
    pointer-events: none;
    white-space: nowrap;
    color: #9CA3AF;
  }

  .srs-indicator--plus { color: #4ADE80; }
  .srs-indicator--minus { color: #EF4444; }

  /* ── Complete screen ─────────────────────────────────────────── */
  .complete-screen {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
    max-width: 360px;
  }

  /* Confetti burst for perfect score */
  .confetti-wrap {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .confetti {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    will-change: transform, opacity;
  }

  .c1 { background: #ffd369; animation: confetti-burst 1.2s 0.0s ease-out forwards; }
  .c2 { background: #4ecca3; animation: confetti-burst 1.2s 0.1s ease-out forwards; }
  .c3 { background: #a78bfa; animation: confetti-burst 1.2s 0.05s ease-out forwards; }
  .c4 { background: #f472b6; animation: confetti-burst 1.2s 0.15s ease-out forwards; }
  .c5 { background: #60a5fa; animation: confetti-burst 1.2s 0.08s ease-out forwards; }
  .c6 { background: #ffd369; animation: confetti-burst 1.2s 0.2s ease-out forwards; }
  .c7 { background: #4ecca3; animation: confetti-burst 1.2s 0.03s ease-out forwards; }
  .c8 { background: #f472b6; animation: confetti-burst 1.2s 0.12s ease-out forwards; }

  @keyframes confetti-burst {
    0%   { transform: translate(0, 0)    scale(1);   opacity: 1; }
    100% { transform: var(--burst-dir, translate(60px, -80px)) scale(0.3); opacity: 0; }
  }

  /* Give each confetti dot a different direction via custom property fallbacks */
  .c1 { --burst-dir: translate(-80px, -90px); }
  .c2 { --burst-dir: translate(80px,  -90px); }
  .c3 { --burst-dir: translate(-110px, -50px); }
  .c4 { --burst-dir: translate(110px, -50px); }
  .c5 { --burst-dir: translate(-60px, -120px); }
  .c6 { --burst-dir: translate(60px,  -120px); }
  .c7 { --burst-dir: translate(-40px, -100px); }
  .c8 { --burst-dir: translate(40px,  -100px); }

  .complete-title {
    color: var(--color-warning);
    font-family: Georgia, serif;
    font-size: clamp(1.8rem, 5vw, 2.4rem);
    margin: 0;
    letter-spacing: 1px;
  }

  .score-display {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    font-size: clamp(3rem, 12vw, 5rem);
    font-weight: 800;
    line-height: 1;
    margin-top: 0.5rem;
  }

  .score-correct {
    color: var(--color-success);
  }

  .score-sep {
    color: var(--color-text-dim);
    font-size: 0.5em;
  }

  .score-total {
    color: var(--color-text-dim);
  }

  .score-label {
    color: var(--color-text-dim);
    font-size: 0.9rem;
    margin: -0.5rem 0 0;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .summary-message {
    color: var(--color-text);
    font-size: 0.95rem;
    font-style: italic;
    line-height: 1.5;
    max-width: 280px;
    margin: 0.5rem 0;
  }

  .return-btn {
    margin-top: 0.5rem;
    min-width: 200px;
    min-height: 56px;
    border: 1.5px solid rgba(78, 204, 163, 0.5);
    border-radius: 14px;
    background: rgba(20, 50, 40, 0.6);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 1px;
    transition: background 160ms ease, transform 100ms ease, box-shadow 160ms ease;
  }

  .return-btn:hover {
    background: rgba(30, 70, 55, 0.75);
    box-shadow: 0 0 18px rgba(78, 204, 163, 0.25);
  }

  .return-btn:active {
    transform: scale(0.97);
    background: rgba(40, 90, 70, 0.8);
  }
</style>

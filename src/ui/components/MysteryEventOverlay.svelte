<script lang="ts">
  import type { MysteryEvent, MysteryEffect } from '../../services/floorManager'
  import { getRandomRoomBg, getRoomDepthMap, getMysteryEventBg, getMysteryEventDepthMap } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { getMysteryEventIconPath, getMysteryEventEmoji } from '../utils/iconAssets'
  import { isLandscape } from '../../stores/layoutStore'
  import ParallaxTransition from './ParallaxTransition.svelte'
  import { playCardAudio } from '../../services/cardAudioManager'
  import EventQuiz from './EventQuiz.svelte'
  import { get } from 'svelte/store'
  import { activeRunState } from '../../services/runStateStore'
  import { getCuratedDeckFacts } from '../../data/curatedDeckStore'

  interface Props {
    event: MysteryEvent | null
    playerHp: number
    playerMaxHp: number
    onresolve: (effect: MysteryEffect) => void
  }

  let { event, playerHp, playerMaxHp, onresolve }: Props = $props()

  const genericBgUrl = getRandomRoomBg('mystery')
  const genericDepthUrl = getRoomDepthMap('mystery')
  let depthUrl = $derived(event ? getMysteryEventDepthMap(event.id) : genericDepthUrl)

  // Use a per-event background if the event has one, falling back to the generic mystery bg.
  // The <img> onerror handler below falls back to genericBgUrl if the per-event asset 404s.
  let bgUrl = $derived(event ? getMysteryEventBg(event.id) : genericBgUrl)

  let showRoomTransition = $state(true)
  holdScreenTransition()
  preloadImages([genericBgUrl]).then(releaseScreenTransition)

  let effectIcon = $derived(getEffectIcon(event?.effect))
  let showCardReveal = $state(false)

  // ——— Quiz / rival duel state ———
  // quizPhase: 'intro' = show event desc + Start button; 'quiz' = EventQuiz active; 'results' = show outcome
  type QuizPhase = 'intro' | 'quiz' | 'results'
  let quizPhase: QuizPhase = $state('intro')

  /** Accumulated effects to apply via compound when quiz results are confirmed. */
  let pendingQuizEffects: MysteryEffect[] = $state([])

  /** Human-readable lines to show in the results panel. */
  let resultLines: string[] = $state([])

  $effect(() => {
    if (event) {
      playCardAudio('mystery-appear')
      // Reset quiz state when a new event is shown
      quizPhase = 'intro'
      pendingQuizEffects = []
      resultLines = []
    }
  })

  function getEffectIcon(effect: MysteryEffect | undefined): string {
    if (!effect) return 'choice' // fallback
    switch (effect.type) {
      case 'heal': return 'heal'
      case 'healPercent': return 'heal'
      case 'damage': return 'damage'
      case 'freeCard': return 'free_card'
      case 'cardReward': return 'free_card'
      case 'upgradeRandomCard': return 'free_card'
      case 'transformCard': return 'free_card'
      case 'nothing': return 'nothing'
      case 'choice': return 'choice'
      case 'currency': return 'heal'
      case 'maxHpChange': return 'heal'
      case 'removeRandomCard': return 'damage'
      case 'combat': return 'damage'
      case 'compound': return getEffectIcon(effect.effects[0])
      case 'random': return 'choice'
      case 'quiz': return 'choice'
      case 'rivalDuel': return 'choice'
      case 'study': return 'free_card'
      case 'reviewMuseum': return 'free_card'
      case 'meditation': return 'heal'
      default: return 'choice'
    }
  }

  function isNegativeEffect(effect: MysteryEffect): boolean {
    if (effect.type === 'damage' || effect.type === 'removeRandomCard' || effect.type === 'combat') return true
    if (effect.type === 'compound') return effect.effects.some(e => isNegativeEffect(e))
    if (effect.type === 'random') return effect.outcomes.some(outcome => outcome.some(e => isNegativeEffect(e)))
    return false
  }

  function handleContinue(): void {
    if (event) {
      playCardAudio(isNegativeEffect(event.effect) ? 'event-negative' : 'event-positive')
      onresolve(event.effect)
    }
  }

  function handleChoiceOption(choiceEffect: MysteryEffect): void {
    playCardAudio('event-choice')
    if (isNegativeEffect(choiceEffect)) {
      playCardAudio('event-negative')
      showCardReveal = true
      setTimeout(() => {
        onresolve(choiceEffect)
      }, 1200)
    } else {
      playCardAudio('event-positive')
      onresolve(choiceEffect)
    }
  }

  /** Human-readable description of a MysteryEffect for result display. */
  function describeEffect(effect: MysteryEffect): string {
    switch (effect.type) {
      case 'currency': return effect.amount >= 0 ? `+${effect.amount} gold` : `${effect.amount} gold`
      case 'heal': return `Heal ${effect.amount} HP`
      case 'healPercent': return `Heal ${effect.percent}% HP`
      case 'damage': return `Take ${effect.amount} damage`
      case 'maxHpChange': return effect.amount >= 0 ? `+${effect.amount} max HP` : `${effect.amount} max HP`
      case 'upgradeRandomCard': return 'Upgrade a card'
      case 'freeCard': return 'Gain a card'
      case 'removeRandomCard': return 'Remove a card'
      case 'nothing': return effect.message
      case 'compound': return effect.effects.map(describeEffect).join(', ')
      default: return 'Special reward'
    }
  }

  /** Called by EventQuiz when all questions have been answered (quiz effect type). */
  function handleQuizComplete(correct: number, total: number, factIds: string[]): void {
    if (!event || event.effect.type !== 'quiz') return
    const quizEffect = event.effect
    const earned: MysteryEffect[] = []
    const lines: string[] = []

    for (let i = 0; i < total; i++) {
      if (i < correct) {
        const reward = quizEffect.perCorrectRewards[i]
        if (reward) {
          earned.push(reward)
          lines.push(`Q${i + 1}: ✓ ${describeEffect(reward)}`)
        } else {
          lines.push(`Q${i + 1}: ✓ (no additional reward)`)
        }
      } else {
        if (quizEffect.perWrongPenalty) {
          earned.push(quizEffect.perWrongPenalty)
          lines.push(`Q${i + 1}: ✗ ${describeEffect(quizEffect.perWrongPenalty)}`)
        } else {
          lines.push(`Q${i + 1}: ✗`)
        }
      }
    }

    // AR-273: Tutor's Office enhancement — apply +30% damage bonus to quizzed facts.
    // Bonus expires 2 encounters from now.
    if (event.id === 'tutors_office' && factIds.length > 0) {
      const runState = get(activeRunState)
      const tracker = runState?.inRunFactTracker
      if (tracker) {
        const currentEncounter = tracker.getCurrentEncounter()
        for (const factId of factIds) {
          tracker.addDamageBonus(factId, 0.3)
          const state = tracker.getState(factId)
          if (state) {
            state.tutorBonusExpiresAtEncounter = currentEncounter + 2
          }
        }
      }
      lines.push('Tutor bonus: studied facts deal +30% damage for 2 encounters.')
    }

    pendingQuizEffects = earned
    resultLines = lines
    quizPhase = 'results'
    playCardAudio(correct > 0 ? 'event-positive' : 'event-negative')
  }

  /** Called by EventQuiz when all questions have been answered (rivalDuel effect type). */
  function handleRivalDuelComplete(correct: number, total: number, _factIds: string[]): void {
    if (!event || event.effect.type !== 'rivalDuel') return
    const duelEffect = event.effect

    // Rival's score: use seeded-ish probability for each question
    let rivalCorrect = 0
    for (let i = 0; i < total; i++) {
      if (Math.random() < duelEffect.rivalAccuracy) rivalCorrect++
    }

    let outcomeEffect: MysteryEffect
    let outcomeLabel: string

    if (correct > rivalCorrect) {
      outcomeEffect = duelEffect.winEffect
      outcomeLabel = `You win! (${correct}–${rivalCorrect}) — ${describeEffect(duelEffect.winEffect)}`
    } else if (correct === rivalCorrect) {
      outcomeEffect = duelEffect.tieEffect
      outcomeLabel = `It's a tie! (${correct}–${rivalCorrect}) — ${describeEffect(duelEffect.tieEffect)}`
    } else {
      outcomeEffect = duelEffect.loseEffect
      outcomeLabel = `You lose. (${correct}–${rivalCorrect}) — ${describeEffect(duelEffect.loseEffect)}`
    }

    pendingQuizEffects = [outcomeEffect]
    resultLines = [
      `Your score: ${correct} / ${total}`,
      `Rival score: ${rivalCorrect} / ${total}`,
      outcomeLabel,
    ]
    quizPhase = 'results'
    playCardAudio(correct >= rivalCorrect ? 'event-positive' : 'event-negative')
  }

  function handleQuizResultsDone(): void {
    if (pendingQuizEffects.length === 0) {
      onresolve({ type: 'nothing', message: 'The event concludes.' })
    } else if (pendingQuizEffects.length === 1) {
      onresolve(pendingQuizEffects[0])
    } else {
      onresolve({ type: 'compound', effects: pendingQuizEffects })
    }
  }

  /** Whether the active event uses a quiz flow (quiz or rivalDuel). */
  let isQuizEvent = $derived(
    event?.effect.type === 'quiz' || event?.effect.type === 'rivalDuel'
  )

  // ——— Study session state (flashcard_merchant) ———
  interface StudyFact {
    factId: string
    question: string
    answer: string
    chainThemeId?: number
  }
  let studyFacts: StudyFact[] = $state([])
  let studyComplete: boolean = $state(false)

  /** Build the study fact list from the curated deck. */
  function buildStudyFacts(): void {
    const runState = get(activeRunState)
    if (!runState?.deckMode || runState.deckMode.type !== 'study') {
      studyFacts = []
      return
    }
    const allFacts = getCuratedDeckFacts(runState.deckMode.deckId, runState.deckMode.subDeckId, runState.deckMode.examTags)
    if (allFacts.length === 0) {
      studyFacts = []
      return
    }
    // Pick 3 random facts
    const shuffled = [...allFacts].sort(() => Math.random() - 0.5).slice(0, 3)
    studyFacts = shuffled.map(f => ({
      factId: f.id,
      question: f.quizQuestion,
      answer: f.correctAnswer,
      chainThemeId: f.chainThemeId,
    }))
    studyComplete = false
  }

  function handleStudyComplete(): void {
    const runState = get(activeRunState)
    const tracker = runState?.inRunFactTracker
    if (tracker) {
      for (const sf of studyFacts) {
        tracker.addDamageBonus(sf.factId, 0.2)
      }
    }
    studyComplete = true
    playCardAudio('event-positive')
  }

  function handleStudyDone(): void {
    // Resolve with currency cost (25g) if this is the paid variant
    if (event?.id === 'flashcard_merchant') {
      onresolve({ type: 'currency', amount: -25 })
    } else {
      onresolve({ type: 'nothing', message: 'Study session complete.' })
    }
  }

  // ——— Wrong Answer Museum state ———
  interface MuseumEntry {
    factId: string
    question: string
    wrongAnswer: string
    correctAnswer: string
    studied: boolean
  }
  let museumEntries: MuseumEntry[] = $state([])
  let museumGoldEarned: number = $state(0)

  function buildMuseumEntries(): void {
    const runState = get(activeRunState)
    const tracker = runState?.inRunFactTracker
    if (!tracker || !runState?.deckMode || runState.deckMode.type !== 'study') {
      museumEntries = []
      return
    }
    const allFacts = getCuratedDeckFacts(runState.deckMode.deckId, runState.deckMode.subDeckId, runState.deckMode.examTags)
    const factById = new Map(allFacts.map(f => [f.id, f]))
    const mistakes = tracker.getAllStates().filter(s => s.wrongCount > 0)
    museumEntries = mistakes.slice(0, 8).map(s => {
      const fact = factById.get(s.factId)
      return {
        factId: s.factId,
        question: fact?.quizQuestion ?? s.factId,
        wrongAnswer: s.confusedWith.length > 0
          ? (factById.get(s.confusedWith[0])?.correctAnswer ?? '?')
          : '?',
        correctAnswer: fact?.correctAnswer ?? '?',
        studied: false,
      }
    })
    museumGoldEarned = 0
  }

  function handleMuseumStudy(entry: MuseumEntry): void {
    const runState = get(activeRunState)
    const tracker = runState?.inRunFactTracker
    if (tracker) {
      const state = tracker.getState(entry.factId)
      if (state && state.wrongCount > 0) {
        state.wrongCount = Math.max(0, state.wrongCount - 1)
      }
    }
    entry.studied = true
    museumGoldEarned += 1
    museumEntries = [...museumEntries]
    playCardAudio('event-positive')
  }

  function handleMuseumLeave(): void {
    if (museumGoldEarned > 0) {
      onresolve({ type: 'currency', amount: museumGoldEarned })
    } else {
      onresolve({ type: 'nothing', message: 'You leave the museum.' })
    }
  }

  // ——— Meditation Chamber state ———
  interface ThemeAccuracy {
    themeId: number
    themeName: string
    answered: number
    correct: number
    pct: number
  }
  let themeStats: ThemeAccuracy[] = $state([])
  let meditationSelected: boolean = $state(false)
  let meditationThemeName: string = $state('')

  function buildThemeStats(): void {
    const runState = get(activeRunState)
    const tracker = runState?.inRunFactTracker
    if (!tracker || !runState?.deckMode || runState.deckMode.type !== 'study') {
      themeStats = []
      return
    }
    const allFacts = getCuratedDeckFacts(runState.deckMode.deckId, runState.deckMode.subDeckId, runState.deckMode.examTags)
    // Gather theme names from facts (use chainThemeId as key)
    const themeNameMap = new Map<number, string>()
    for (const f of allFacts) {
      if (!themeNameMap.has(f.chainThemeId)) {
        // Use the chainThemeName if available, else fall back to "Theme N"
        themeNameMap.set(f.chainThemeId, (f as any).chainThemeName ?? `Theme ${f.chainThemeId}`)
      }
    }
    // Aggregate accuracy per theme from tracker states
    const themeData = new Map<number, { answered: number; correct: number }>()
    for (const state of tracker.getAllStates()) {
      const fact = allFacts.find(f => f.id === state.factId)
      if (!fact) continue
      const tid = fact.chainThemeId
      const cur = themeData.get(tid) ?? { answered: 0, correct: 0 }
      cur.answered += state.correctCount + state.wrongCount
      cur.correct += state.correctCount
      themeData.set(tid, cur)
    }
    const stats: ThemeAccuracy[] = []
    for (const [themeId, data] of themeData) {
      if (data.answered === 0) continue
      stats.push({
        themeId,
        themeName: themeNameMap.get(themeId) ?? `Theme ${themeId}`,
        answered: data.answered,
        correct: data.correct,
        pct: Math.round((data.correct / data.answered) * 100),
      })
    }
    stats.sort((a, b) => a.pct - b.pct) // Worst performance first
    themeStats = stats
    meditationSelected = false
  }

  function handleMeditate(theme: ThemeAccuracy): void {
    const runState = get(activeRunState)
    if (runState) {
      runState.meditatedThemeId = theme.themeId
      activeRunState.set(runState)
    }
    meditationSelected = true
    meditationThemeName = theme.themeName
    playCardAudio('event-positive')
  }

  function handleMeditationLeave(): void {
    onresolve({ type: 'nothing', message: meditationSelected
      ? `You leave the chamber focused on ${meditationThemeName}.`
      : 'You leave the chamber at peace.' })
  }

  // ——— Initialize custom handlers when event changes ———
  $effect(() => {
    if (event?.effect.type === 'study') buildStudyFacts()
    if (event?.effect.type === 'reviewMuseum') buildMuseumEntries()
    if (event?.effect.type === 'meditation') buildThemeStats()
  })
</script>

{#if event}
  <div class="mystery-overlay">
    <img class="overlay-bg" src={bgUrl} alt="" aria-hidden="true"
      onerror={(e) => { (e.currentTarget as HTMLImageElement).src = genericBgUrl }} />
    <div class="mystery-card">
      <h2 class="event-name">{event.name}</h2>
      <span class="effect-icon">
        <img class="mystery-icon-img" src={getMysteryEventIconPath(effectIcon)} alt=""
          onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
        <span style="display:none">{getMysteryEventEmoji(effectIcon)}</span>
      </span>
      <p class="event-desc">{event.description}</p>

      <div class="hp-info">
        HP: {playerHp} / {playerMaxHp}
      </div>

      {#if isQuizEvent}
        <!-- Quiz / Rival Duel flow -->
        {#if quizPhase === 'intro'}
          {#if event.effect.type === 'quiz'}
            <p class="quiz-meta">
              {event.effect.questionCount} question{event.effect.questionCount !== 1 ? 's' : ''} —
              {event.effect.difficulty} difficulty
            </p>
          {:else if event.effect.type === 'rivalDuel'}
            <p class="quiz-meta">
              Duel: {event.effect.questionCount} questions vs. the Rival
            </p>
          {/if}
          <button
            class="continue-btn"
            data-testid="mystery-continue"
            onclick={() => { quizPhase = 'quiz' }}
          >
            Begin Quiz
          </button>
        {:else if quizPhase === 'quiz'}
          <EventQuiz
            questionCount={event.effect.type === 'quiz' ? event.effect.questionCount : event.effect.type === 'rivalDuel' ? event.effect.questionCount : 1}
            onComplete={event.effect.type === 'quiz' ? handleQuizComplete : handleRivalDuelComplete}
          />
        {:else if quizPhase === 'results'}
          <div class="quiz-results">
            {#each resultLines as line (line)}
              <p class="result-line">{line}</p>
            {/each}
          </div>
          <button
            class="continue-btn"
            data-testid="mystery-continue"
            onclick={handleQuizResultsDone}
          >
            Continue
          </button>
        {/if}
      {:else if event.effect.type === 'choice'}
        <div class="choice-buttons">
          {#each event.effect.options as option, i (i)}
            <button
              class="choice-btn"
              onclick={() => handleChoiceOption(option.effect)}
            >
              {option.label}
            </button>
          {/each}
        </div>

      {:else if event.effect.type === 'study'}
        <!-- Study Session (Flashcard Merchant) -->
        <div class="study-header">Study Session — cost: 25 gold</div>
        {#if studyFacts.length === 0}
          <p class="study-empty">No facts available in study mode.</p>
          <button class="continue-btn" onclick={() => onresolve({ type: 'nothing', message: 'Nothing to study here.' })}>Leave</button>
        {:else if !studyComplete}
          <div class="study-facts">
            {#each studyFacts as sf (sf.factId)}
              <div class="study-fact-card">
                <p class="study-question">{sf.question}</p>
                <p class="study-answer">{sf.answer}</p>
              </div>
            {/each}
          </div>
          <button class="continue-btn" data-testid="mystery-continue" onclick={handleStudyComplete}>
            Complete Study (+20% damage bonus per fact)
          </button>
        {:else}
          <p class="study-success">3 facts studied! Each deals +20% more damage when you Charge correctly.</p>
          <button class="continue-btn" data-testid="mystery-continue" onclick={handleStudyDone}>Leave (–25 gold)</button>
        {/if}

      {:else if event.effect.type === 'reviewMuseum'}
        <!-- Wrong Answer Museum -->
        {#if museumEntries.length === 0}
          <p class="museum-empty">No mistakes on record. Impressive!</p>
          <button class="continue-btn" onclick={() => onresolve({ type: 'nothing', message: 'The museum is empty for you.' })}>Leave</button>
        {:else}
          <div class="museum-entries">
            {#each museumEntries as entry (entry.factId)}
              <div class="museum-entry" class:museum-studied={entry.studied}>
                <div class="museum-q">{entry.question}</div>
                <div class="museum-answers">
                  <span class="museum-wrong">{entry.wrongAnswer}</span>
                  <span class="museum-arrow">→</span>
                  <span class="museum-correct">{entry.correctAnswer}</span>
                </div>
                {#if !entry.studied}
                  <button class="museum-study-btn" onclick={() => handleMuseumStudy(entry)}>Study (+1g)</button>
                {:else}
                  <span class="museum-done-badge">Studied</span>
                {/if}
              </div>
            {/each}
          </div>
          <div class="museum-gold">Gold earned: {museumGoldEarned}g</div>
          <button class="continue-btn" data-testid="mystery-continue" onclick={handleMuseumLeave}>Leave Museum</button>
        {/if}

      {:else if event.effect.type === 'meditation'}
        <!-- Meditation Chamber -->
        {#if meditationSelected}
          <p class="meditation-confirmed">Meditating on: <strong>{meditationThemeName}</strong><br>Distractors for this topic are reduced.</p>
          <button class="continue-btn" data-testid="mystery-continue" onclick={handleMeditationLeave}>Leave Chamber</button>
        {:else if themeStats.length === 0}
          <p class="meditation-empty">No topic data yet. Answer some questions first.</p>
          <button class="continue-btn" onclick={() => onresolve({ type: 'nothing', message: 'The chamber is quiet.' })}>Leave</button>
        {:else}
          <p class="meditation-intro">Choose a topic to meditate on — distractors for that topic will be reduced.</p>
          <div class="meditation-themes">
            {#each themeStats as theme (theme.themeId)}
              <button class="meditation-theme-btn" onclick={() => handleMeditate(theme)}>
                <span class="theme-name">{theme.themeName}</span>
                <span class="theme-accuracy" class:theme-low={theme.pct < 60} class:theme-mid={theme.pct >= 60 && theme.pct < 80} class:theme-high={theme.pct >= 80}>{theme.pct}%</span>
              </button>
            {/each}
          </div>
          <button class="continue-btn-outline" onclick={handleMeditationLeave}>Leave Chamber</button>
        {/if}

      {:else}
        <button
          class="continue-btn"
          data-testid="mystery-continue"
          onclick={handleContinue}
        >
          Continue
        </button>
      {/if}
    </div>
    {#if showCardReveal}
      <div class="card-reveal-overlay">
        <div class="card-reveal">
          <div class="card-reveal-inner">
            <div class="card-reveal-front">
              <span class="reveal-icon">🃏</span>
              <span class="reveal-text">New Card!</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if showRoomTransition}
  <ParallaxTransition
    imageUrl={bgUrl}
    depthUrl={depthUrl}
    type="enter"
    onComplete={() => { showRoomTransition = false }}
      persist
  />
{/if}

<style>
  .mystery-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .overlay-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
  }

  .mystery-card {
    background: #161B22;
    border: 2px solid #9B59B6;
    border-radius: 12px;
    padding: calc(24px * var(--layout-scale, 1));
    max-width: calc(340px * var(--layout-scale, 1));
    max-height: 90vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    position: relative;
    z-index: 1;
    overflow-y: auto;
  }

  .event-name {
    font-size: calc(18px * var(--layout-scale, 1));
    color: #9B59B6;
    margin: 0;
    text-align: center;
  }

  .effect-icon {
    font-size: calc(48px * var(--layout-scale, 1));
  }

  .event-desc {
    font-size: calc(14px * var(--layout-scale, 1));
    color: #C9D1D9;
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  .hp-info {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #8B949E;
  }

  .choice-buttons {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .choice-btn {
    width: 100%;
    padding: calc(12px * var(--layout-scale, 1));
    background: #1E2D3D;
    border: 1px solid #484F58;
    border-radius: 8px;
    color: #E6EDF3;
    font-size: calc(14px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 0.15s;
  }

  .choice-btn:hover {
    background: #2D333B;
  }

  .continue-btn {
    width: 100%;
    padding: calc(14px * var(--layout-scale, 1));
    background: #9B59B6;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: calc(16px * var(--layout-scale, 1));
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .continue-btn:hover {
    transform: scale(1.03);
  }

  .mystery-icon-img {
    width: calc(4rem * var(--layout-scale, 1));
    height: calc(4rem * var(--layout-scale, 1));
    image-rendering: pixelated;
    display: inline-block;
  }

  .quiz-meta {
    font-size: calc(12px * var(--text-scale, 1));
    color: #8B949E;
    text-align: center;
    margin: 0;
  }

  .quiz-results {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(8px * var(--layout-scale, 1));
  }

  .result-line {
    font-size: calc(13px * var(--text-scale, 1));
    color: #C9D1D9;
    margin: 0;
    line-height: 1.4;
  }

  .card-reveal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 210;
    animation: revealFadeIn 200ms ease-out;
  }

  .card-reveal {
    perspective: 800px;
  }

  .card-reveal-inner {
    width: calc(180px * var(--layout-scale, 1));
    height: calc(260px * var(--layout-scale, 1));
    border-radius: 14px;
    background: linear-gradient(145deg, #2a1f4e, #1a1040);
    border: 3px solid #c084fc;
    box-shadow:
      0 0 30px rgba(192, 132, 252, 0.4),
      0 20px 60px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: cardWaveReveal 1000ms ease-out;
  }

  .card-reveal-front {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .reveal-icon {
    font-size: calc(64px * var(--layout-scale, 1));
    animation: revealPulse 600ms ease-in-out 200ms;
  }

  .reveal-text {
    font-family: var(--font-pixel);
    font-size: calc(14px * var(--layout-scale, 1));
    color: #e9d5ff;
    text-shadow:
      calc(-2px * var(--layout-scale, 1)) 0 #000, calc(2px * var(--layout-scale, 1)) 0 #000, 0 calc(-2px * var(--layout-scale, 1)) #000, 0 calc(2px * var(--layout-scale, 1)) #000;
    letter-spacing: calc(1px * var(--layout-scale, 1));
  }

  @keyframes cardWaveReveal {
    0% {
      transform: rotateY(-90deg) rotateZ(5deg) scale(0.6);
      opacity: 0;
    }
    30% {
      transform: rotateY(15deg) rotateZ(-2deg) scale(1.05);
      opacity: 1;
    }
    50% {
      transform: rotateY(-8deg) rotateZ(1deg) scale(1);
    }
    70% {
      transform: rotateY(4deg) rotateZ(0deg) scale(1);
    }
    100% {
      transform: rotateY(0deg) rotateZ(0deg) scale(1);
    }
  }

  @keyframes revealFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes revealPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-reveal-inner {
      animation: none;
    }
    .reveal-icon {
      animation: none;
    }
  }

  /* ── Study Session (Flashcard Merchant) ─────────────────────────────────── */
  .study-header {
    font-size: calc(13px * var(--text-scale, 1));
    color: #9B59B6;
    font-weight: 700;
    text-align: center;
  }

  .study-empty, .museum-empty, .meditation-empty {
    font-size: calc(13px * var(--text-scale, 1));
    color: #8B949E;
    text-align: center;
    margin: 0;
  }

  .study-facts {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
  }

  .study-fact-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
  }

  .study-question {
    font-size: calc(12px * var(--text-scale, 1));
    color: #8B949E;
    margin: 0 0 calc(4px * var(--layout-scale, 1)) 0;
    line-height: 1.4;
  }

  .study-answer {
    font-size: calc(14px * var(--text-scale, 1));
    color: #3fb950;
    font-weight: 700;
    margin: 0;
  }

  .study-success {
    font-size: calc(13px * var(--text-scale, 1));
    color: #3fb950;
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  /* ── Wrong Answer Museum ─────────────────────────────────────────────────── */
  .museum-entries {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
    max-height: calc(280px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  .museum-entry {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .museum-entry.museum-studied {
    opacity: 0.55;
    border-color: #3fb950;
  }

  .museum-q {
    font-size: calc(11px * var(--text-scale, 1));
    color: #8B949E;
    line-height: 1.3;
  }

  .museum-answers {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
  }

  .museum-wrong {
    color: #f85149;
    text-decoration: line-through;
  }

  .museum-arrow {
    color: #8B949E;
  }

  .museum-correct {
    color: #3fb950;
    font-weight: 700;
  }

  .museum-study-btn {
    align-self: flex-end;
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: #1E2D3D;
    border: 1px solid #484F58;
    border-radius: calc(4px * var(--layout-scale, 1));
    color: #E6EDF3;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
  }

  .museum-study-btn:hover {
    background: #2D333B;
    border-color: #9B59B6;
  }

  .museum-done-badge {
    align-self: flex-end;
    font-size: calc(11px * var(--text-scale, 1));
    color: #3fb950;
  }

  .museum-gold {
    font-size: calc(13px * var(--text-scale, 1));
    color: #e3b341;
    text-align: center;
    font-weight: 700;
  }

  /* ── Meditation Chamber ──────────────────────────────────────────────────── */
  .meditation-intro {
    font-size: calc(12px * var(--text-scale, 1));
    color: #8B949E;
    text-align: center;
    margin: 0;
    line-height: 1.4;
  }

  .meditation-themes {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    width: 100%;
    max-height: calc(280px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  .meditation-theme-btn {
    width: 100%;
    padding: calc(10px * var(--layout-scale, 1));
    background: #1E2D3D;
    border: 1px solid #484F58;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #E6EDF3;
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.15s;
  }

  .meditation-theme-btn:hover {
    background: #2D333B;
    border-color: #9B59B6;
  }

  .theme-name {
    text-align: left;
  }

  .theme-accuracy {
    font-weight: 700;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .theme-low { color: #f85149; }
  .theme-mid { color: #e3b341; }
  .theme-high { color: #3fb950; }

  .meditation-confirmed {
    font-size: calc(13px * var(--text-scale, 1));
    color: #3fb950;
    text-align: center;
    margin: 0;
    line-height: 1.6;
  }

  .continue-btn-outline {
    width: 100%;
    padding: calc(12px * var(--layout-scale, 1));
    background: transparent;
    border: 1px solid #484F58;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #8B949E;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    transition: border-color 0.15s;
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .continue-btn-outline:hover {
    border-color: #9B59B6;
    color: #E6EDF3;
  }
</style>

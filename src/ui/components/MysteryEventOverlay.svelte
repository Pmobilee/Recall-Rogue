<script lang="ts">
  import type { MysteryEvent, MysteryEffect } from '../../services/floorManager'
  import { getRandomRoomBg, getRoomDepthMap, getMysteryEventBg, getMysteryEventDepthMap } from '../../data/backgroundManifest'
  import { factsDB } from '../../services/factsDB'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { getMysteryEventIconPath, getMysteryEventEmoji } from '../utils/iconAssets'
  import { isLandscape } from '../../stores/layoutStore'
  import ParallaxTransition from './ParallaxTransition.svelte'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { ambientAudio } from '../../services/ambientAudioService'
  import EventQuiz from './EventQuiz.svelte'
  import { get } from 'svelte/store'
  import { activeRunState } from '../../services/runStateStore'
  import { getCuratedDeckFacts } from '../../data/curatedDeckStore'
  import { staggerPopIn } from '../utils/roomPopIn'
  import { tick } from 'svelte'

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

  let overlayEl = $state<HTMLElement>(null!)
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
      void ambientAudio.setContext('mystery')
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
      case 'doubleOrNothing': return 'choice'
      case 'speedRound': return 'choice'
      case 'cardRoulette': return 'choice'
      case 'factOrFiction': return 'choice'
      case 'knowledgeShop': return 'choice'
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
    if (event?.effect.type === 'doubleOrNothing') {
      donPot = 10
      donQuestionIndex = 0
      donPhase = 'question'
      donCurrentQ = getRandomTriviaQuestion('easy')
    }
    if (event?.effect.type === 'speedRound') {
      srScore = 0
      srPhase = 'active'
      srTimeLimit = (event.effect.timeSeconds ?? 15) * 1000
      srCurrentQ = getRandomTriviaQuestion('easy')
      srStartedAt = Date.now()
      srElapsedMs = 0
      startSpeedRoundTimer()
    }
    if (event?.effect.type === 'cardRoulette') {
      crPicksLeft = event.effect.pickLimit
      crPickCost = event.effect.pickCost
      crResults = []
      crDone = false
      const outcomes: RouletteCard['outcome'][] = ['upgrade', 'freeCard', 'gold', 'damage', 'curse']
      const shuffled = outcomes.sort(() => Math.random() - 0.5)
      crCards = shuffled.map(o => ({
        outcome: o,
        flipped: false,
        label: getRouletteLabel(o),
      }))
    }
    if (event?.effect.type === 'factOrFiction') {
      const count = event.effect.statementCount
      fofStatements = buildFactOrFictionStatements(count)
      fofCurrentIndex = 0
      fofScore = 0
      fofWrong = 0
      fofPhase = 'playing'
    }
    if (event?.effect.type === 'knowledgeShop') {
      ksStepIndex = 0
      ksPurchasedEffects = []
      ksTotalHpCost = 0
      ksDone = false
    }
  })

  // ——— Shared trivia helper ———
  interface TriviaQuestion {
    question: string
    correctAnswer: string
    choices: string[]
    factId: string
  }

  /** Pick a random trivia fact from factsDB, filtered by difficulty. */
  function getRandomTriviaQuestion(difficulty: 'easy' | 'medium' | 'hard'): TriviaQuestion | null {
    const allFacts = factsDB.getTriviaFacts()
    let pool: typeof allFacts
    if (difficulty === 'easy') pool = allFacts.filter(f => (f.difficulty ?? 3) <= 2)
    else if (difficulty === 'medium') pool = allFacts.filter(f => (f.difficulty ?? 3) === 3)
    else pool = allFacts.filter(f => (f.difficulty ?? 3) >= 4)

    if (pool.length === 0) pool = allFacts // fallback
    const fact = pool[Math.floor(Math.random() * pool.length)]
    if (!fact) return null

    // Pick 3 distractors
    const distractors = [...fact.distractors].sort(() => Math.random() - 0.5).slice(0, 3)
    // Shuffle choices (correct + 3 distractors)
    const choices = [fact.correctAnswer, ...distractors].sort(() => Math.random() - 0.5)

    return {
      question: fact.quizQuestion,
      correctAnswer: fact.correctAnswer,
      choices,
      factId: fact.id,
    }
  }

  // ——— Double or Nothing state ———
  let donPot = $state(10)
  let donQuestionIndex = $state(0)
  let donCurrentQ: TriviaQuestion | null = $state(null)
  let donPhase: 'question' | 'cashOrDouble' | 'lost' | 'cashed' = $state('question')
  const DON_DIFFICULTIES: Array<'easy' | 'medium' | 'hard'> = ['easy', 'easy', 'medium', 'hard']
  const DON_MAX_QUESTIONS = 4

  function handleDonAnswer(choice: string): void {
    if (!donCurrentQ) return
    if (choice === donCurrentQ.correctAnswer) {
      donPot *= 2
      donQuestionIndex++
      if (donQuestionIndex >= DON_MAX_QUESTIONS) {
        donPhase = 'cashed'
        playCardAudio('event-positive')
      } else {
        donPhase = 'cashOrDouble'
        playCardAudio('event-positive')
      }
    } else {
      donPot = 0
      donPhase = 'lost'
      playCardAudio('event-negative')
    }
  }

  function handleDonCashOut(): void {
    donPhase = 'cashed'
    playCardAudio('event-positive')
    onresolve({ type: 'currency', amount: donPot })
  }

  function handleDonDoubleDown(): void {
    const diff = DON_DIFFICULTIES[donQuestionIndex] ?? 'hard'
    donCurrentQ = getRandomTriviaQuestion(diff)
    donPhase = 'question'
  }

  function handleDonLostDone(): void {
    onresolve({ type: 'currency', amount: 3 }) // consolation
  }

  // ——— Speed Round state ———
  let srScore = $state(0)
  let srCurrentQ: TriviaQuestion | null = $state(null)
  let srPhase: 'active' | 'done' = $state('active')
  let srStartedAt = $state(0)
  let srElapsedMs = $state(0)
  let srRafId = $state(0)
  let srTimeLimit = $state(15000)

  let srSecondsLeft = $derived(Math.max(0, Math.ceil((srTimeLimit - srElapsedMs) / 1000)))

  function startSpeedRoundTimer(): void {
    function tick(): void {
      if (srPhase !== 'active') return
      srElapsedMs = Date.now() - srStartedAt
      if (srElapsedMs >= srTimeLimit) {
        srPhase = 'done'
        playCardAudio(srScore > 0 ? 'event-positive' : 'event-negative')
        return
      }
      srRafId = requestAnimationFrame(tick)
    }
    srRafId = requestAnimationFrame(tick)
  }

  function handleSrAnswer(choice: string): void {
    if (!srCurrentQ || srPhase !== 'active') return
    if (choice === srCurrentQ.correctAnswer) {
      srScore++
    }
    // Load next question regardless of correct/wrong
    srCurrentQ = getRandomTriviaQuestion('easy')
  }

  function handleSrDone(): void {
    cancelAnimationFrame(srRafId)
    const effects: MysteryEffect[] = []
    if (srScore > 0) {
      effects.push({ type: 'currency', amount: srScore * 5 })
      effects.push({ type: 'healPercent', percent: srScore * 3 })
    }
    if (effects.length === 0) {
      onresolve({ type: 'currency', amount: 3 }) // consolation
    } else {
      onresolve({ type: 'compound', effects })
    }
  }

  // Cancel speed round RAF on unmount/event change
  $effect(() => {
    return () => {
      if (srRafId) cancelAnimationFrame(srRafId)
    }
  })

  // ——— Card Roulette state ———
  interface RouletteCard {
    outcome: 'upgrade' | 'freeCard' | 'gold' | 'damage' | 'curse'
    flipped: boolean
    label: string
  }
  let crCards: RouletteCard[] = $state([])
  let crPicksLeft = $state(3)
  let crPickCost = $state(5)
  let crResults: string[] = $state([])
  let crDone = $state(false)

  function getRouletteLabel(outcome: RouletteCard['outcome']): string {
    switch (outcome) {
      case 'upgrade': return 'Upgrade a card!'
      case 'freeCard': return 'Free card added!'
      case 'gold': return '+20g!'
      case 'damage': return 'Trap! -15 HP!'
      case 'curse': return 'Cursed! A card weakened.'
    }
  }

  function handleCrFlip(index: number): void {
    if (crCards[index].flipped || crPicksLeft <= 0 || crDone) return
    crCards[index].flipped = true
    crPicksLeft--
    const outcome = crCards[index].outcome

    if (outcome === 'damage' || outcome === 'curse') {
      playCardAudio('event-negative')
    } else {
      playCardAudio('event-positive')
    }

    crResults = [...crResults, crCards[index].label]
    // Force reactivity on crCards
    crCards = [...crCards]
  }

  function handleCrDone(): void {
    crDone = true
    const effects: MysteryEffect[] = []
    const flippedCount = crCards.filter(c => c.flipped).length
    if (flippedCount > 0) {
      effects.push({ type: 'damage', amount: flippedCount * crPickCost })
    }
    for (const card of crCards.filter(c => c.flipped)) {
      switch (card.outcome) {
        case 'upgrade': effects.push({ type: 'upgradeRandomCard' }); break
        case 'freeCard': effects.push({ type: 'freeCard' }); break
        case 'gold': effects.push({ type: 'currency', amount: 20 }); break
        case 'damage': effects.push({ type: 'damage', amount: 15 }); break
        case 'curse': break // TODO: curse effect when implemented
      }
    }
    if (effects.length === 0) {
      onresolve({ type: 'currency', amount: 3 })
    } else {
      onresolve({ type: 'compound', effects })
    }
  }

  // ——— Fact or Fiction state ———
  interface FofStatement {
    text: string
    isTrue: boolean
    answered: boolean
    correct: boolean | null
    factQuestion: string
  }
  let fofStatements: FofStatement[] = $state([])
  let fofCurrentIndex = $state(0)
  let fofScore = $state(0)
  let fofWrong = $state(0)
  let fofPhase: 'playing' | 'feedback' | 'done' = $state('playing')
  let fofFeedbackTimer = $state(0)

  // ——— Knowledge Shop (Knowing Skull) state ———
  let ksStepIndex = $state(0)
  let ksPurchasedEffects: MysteryEffect[] = $state([])
  let ksTotalHpCost = $state(0)
  let ksDone = $state(false)

  function buildFactOrFictionStatements(count: number): FofStatement[] {
    const allFacts = factsDB.getTriviaFacts().filter(
      f => f.statement && f.correctAnswer && f.distractors?.length > 0
    )
    const shuffled = [...allFacts].sort(() => Math.random() - 0.5)
    const statements: FofStatement[] = []

    let usedIdx = 0
    for (let i = 0; i < count && usedIdx < shuffled.length; i++) {
      const fact = shuffled[usedIdx++]
      const makeTrue = i % 2 === 0

      if (makeTrue) {
        statements.push({
          text: fact.statement,
          isTrue: true,
          answered: false,
          correct: null,
          factQuestion: fact.quizQuestion,
        })
      } else {
        const distractor = fact.distractors[Math.floor(Math.random() * fact.distractors.length)]
        const falsified = fact.statement.replace(fact.correctAnswer, distractor)
        if (falsified !== fact.statement) {
          statements.push({
            text: falsified,
            isTrue: false,
            answered: false,
            correct: null,
            factQuestion: fact.quizQuestion,
          })
        } else {
          // Fallback: use as true if replacement failed
          statements.push({
            text: fact.statement,
            isTrue: true,
            answered: false,
            correct: null,
            factQuestion: fact.quizQuestion,
          })
        }
      }
    }
    // Shuffle the final order so true/false aren't alternating
    return statements.sort(() => Math.random() - 0.5)
  }

  function handleFofAnswer(answeredTrue: boolean): void {
    const stmt = fofStatements[fofCurrentIndex]
    if (!stmt || stmt.answered) return

    const isCorrect = answeredTrue === stmt.isTrue
    stmt.answered = true
    stmt.correct = isCorrect
    // Force reactivity
    fofStatements = [...fofStatements]

    if (isCorrect) {
      fofScore++
      playCardAudio('event-positive')
    } else {
      fofWrong++
      playCardAudio('event-negative')
    }

    fofPhase = 'feedback'
    fofFeedbackTimer = window.setTimeout(() => {
      if (fofCurrentIndex < fofStatements.length - 1) {
        fofCurrentIndex++
        fofPhase = 'playing'
      } else {
        fofPhase = 'done'
      }
    }, 800)
  }

  function handleFofDone(): void {
    clearTimeout(fofFeedbackTimer)
    const effects: MysteryEffect[] = []
    if (fofScore > 0) effects.push({ type: 'currency', amount: fofScore * 8 })
    if (fofWrong > 0) effects.push({ type: 'damage', amount: fofWrong * 6 })
    if (effects.length === 0) {
      onresolve({ type: 'currency', amount: 3 })
    } else {
      onresolve({ type: 'compound', effects })
    }
  }

  // ——— Knowledge Shop (Knowing Skull) handlers ———
  function handleKsBuy(): void {
    if (!event || event.effect.type !== 'knowledgeShop') return
    const step = event.effect.steps[ksStepIndex]
    if (!step) return

    ksTotalHpCost += step.cost
    ksPurchasedEffects = [...ksPurchasedEffects, step.reward]
    playCardAudio('event-positive')

    if (ksStepIndex < event.effect.steps.length - 1) {
      ksStepIndex++
    } else {
      // All steps purchased
      ksDone = true
    }
  }

  function handleKsLeave(): void {
    if (!event || event.effect.type !== 'knowledgeShop') return
    ksTotalHpCost += event.effect.leaveCost
    ksDone = true
  }

  function handleKsDone(): void {
    const effects: MysteryEffect[] = []
    // Apply HP cost first
    if (ksTotalHpCost > 0) {
      effects.push({ type: 'damage', amount: ksTotalHpCost })
    }
    // Then all purchased rewards
    effects.push(...ksPurchasedEffects)

    if (effects.length === 0) {
      onresolve({ type: 'currency', amount: 3 })
    } else {
      onresolve({ type: 'compound', effects })
    }
  }
</script>

{#if event}
  <div class="mystery-overlay" bind:this={overlayEl}>
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

      {:else if event.effect.type === 'doubleOrNothing'}
        <!-- Double or Nothing -->
        <div class="minigame-don">
          <div class="don-pot">Pot: {donPot}g</div>
          {#if donPhase === 'question' && donCurrentQ}
            <p class="don-question">{donCurrentQ.question}</p>
            <div class="don-choices">
              {#each donCurrentQ.choices as choice (choice)}
                <button class="choice-btn" onclick={() => handleDonAnswer(choice)}>{choice}</button>
              {/each}
            </div>
          {:else if donPhase === 'cashOrDouble'}
            <p class="don-correct">Correct! The pot is now {donPot}g.</p>
            <div class="don-actions">
              <button class="continue-btn" onclick={handleDonCashOut}>Cash Out ({donPot}g)</button>
              <button class="choice-btn don-double" onclick={handleDonDoubleDown}>Double Down ({donPot * 2}g)</button>
            </div>
          {:else if donPhase === 'lost'}
            <p class="don-lost">Wrong! You lost everything.</p>
            <button class="continue-btn" onclick={handleDonLostDone}>Leave Empty-Handed</button>
          {:else if donPhase === 'cashed'}
            <p class="don-won">You walk away with {donPot}g!</p>
            <button class="continue-btn" onclick={() => onresolve({ type: 'currency', amount: donPot })}>Collect Winnings</button>
          {/if}
        </div>

      {:else if event.effect.type === 'speedRound'}
        <!-- Speed Round -->
        <div class="minigame-sr">
          {#if srPhase === 'active' && srCurrentQ}
            <div class="sr-header">
              <span class="sr-timer" class:sr-urgent={srSecondsLeft <= 5}>{srSecondsLeft}s</span>
              <span class="sr-score">Score: {srScore}</span>
            </div>
            <p class="sr-question">{srCurrentQ.question}</p>
            <div class="sr-choices">
              {#each srCurrentQ.choices as choice (choice)}
                <button class="choice-btn" onclick={() => handleSrAnswer(choice)}>{choice}</button>
              {/each}
            </div>
          {:else}
            <div class="sr-results">
              <p class="sr-result-title">Time's Up!</p>
              <p class="sr-result-score">You answered {srScore} correctly!</p>
              {#if srScore > 0}
                <p class="sr-result-reward">+{srScore * 5}g, +{srScore * 3}% heal</p>
              {:else}
                <p class="sr-result-reward">Better luck next time. (3g consolation)</p>
              {/if}
            </div>
            <button class="continue-btn" data-testid="mystery-continue" onclick={handleSrDone}>Continue</button>
          {/if}
        </div>

      {:else if event.effect.type === 'cardRoulette'}
        <!-- Card Roulette -->
        <div class="minigame-cr">
          <div class="cr-info">
            <span>Picks remaining: {crPicksLeft}</span>
            <span>Cost per pick: {crPickCost} HP</span>
          </div>
          <div class="cr-cards">
            {#each crCards as card, i (i)}
              <button
                class="cr-card"
                class:cr-flipped={card.flipped}
                class:cr-positive={card.flipped && card.outcome !== 'damage' && card.outcome !== 'curse'}
                class:cr-negative={card.flipped && (card.outcome === 'damage' || card.outcome === 'curse')}
                disabled={card.flipped || crPicksLeft <= 0}
                onclick={() => handleCrFlip(i)}
              >
                {#if card.flipped}
                  <span class="cr-result">{card.label}</span>
                {:else}
                  <span class="cr-back">?</span>
                {/if}
              </button>
            {/each}
          </div>
          {#if crResults.length > 0}
            <div class="cr-log">
              {#each crResults as result (result)}
                <p>{result}</p>
              {/each}
            </div>
          {/if}
          <button class="continue-btn" data-testid="mystery-continue" onclick={handleCrDone}>
            {crPicksLeft > 0 && crCards.some(c => !c.flipped) ? 'Walk Away' : 'Continue'}
          </button>
        </div>

      {:else if event.effect.type === 'factOrFiction'}
        <!-- Fact or Fiction -->
        <div class="minigame-fof">
          {#if fofPhase !== 'done'}
            <div class="fof-progress">{fofCurrentIndex + 1} / {fofStatements.length}</div>
            {@const stmt = fofStatements[fofCurrentIndex]}
            {#if stmt}
              <p class="fof-statement" class:fof-correct={stmt.correct === true} class:fof-wrong={stmt.correct === false}>
                "{stmt.text}"
              </p>
              {#if fofPhase === 'playing'}
                <div class="fof-buttons">
                  <button class="choice-btn fof-true" onclick={() => handleFofAnswer(true)}>True</button>
                  <button class="choice-btn fof-false" onclick={() => handleFofAnswer(false)}>False</button>
                </div>
              {:else}
                <p class="fof-feedback">{stmt.correct ? 'Correct!' : `Wrong! This was ${stmt.isTrue ? 'true' : 'false'}.`}</p>
              {/if}
            {/if}
          {:else}
            <div class="fof-results">
              <p class="fof-result-title">Results</p>
              <p class="fof-result-score">{fofScore} / {fofStatements.length} correct</p>
              {#if fofScore > 0}<p class="fof-reward">+{fofScore * 8}g earned</p>{/if}
              {#if fofWrong > 0}<p class="fof-penalty">-{fofWrong * 6} HP damage</p>{/if}
            </div>
            <button class="continue-btn" data-testid="mystery-continue" onclick={handleFofDone}>Continue</button>
          {/if}
        </div>

      {:else if event.effect.type === 'knowledgeShop'}
        <!-- Knowledge Shop (Knowing Skull) -->
        <div class="minigame-ks">
          {#if !ksDone}
            {@const step = event.effect.steps[ksStepIndex]}
            <div class="ks-info">
              <span class="ks-step">Step {ksStepIndex + 1} of {event.effect.steps.length}</span>
              <span class="ks-hp-spent">HP spent: {ksTotalHpCost}</span>
            </div>
            {#if step}
              <div class="ks-offer">
                <p class="ks-label">{step.label}</p>
                <p class="ks-cost">Cost: {step.cost} HP</p>
              </div>
              <div class="ks-actions">
                <button class="choice-btn ks-buy" onclick={handleKsBuy}>
                  Pay {step.cost} HP
                </button>
                <button class="choice-btn ks-leave" onclick={handleKsLeave}>
                  Leave (costs {event.effect.leaveCost} HP)
                </button>
              </div>
            {/if}
            {#if ksPurchasedEffects.length > 0}
              <div class="ks-purchased">
                <p class="ks-purchased-title">Purchased:</p>
                {#each ksPurchasedEffects as _, i (i)}
                  <span class="ks-purchased-item">{event.effect.steps[i]?.label}</span>
                {/each}
              </div>
            {/if}
          {:else}
            <div class="ks-results">
              <p class="ks-result-title">The skull falls silent.</p>
              <p class="ks-result-cost">Total HP spent: {ksTotalHpCost}</p>
              {#if ksPurchasedEffects.length > 0}
                <p class="ks-result-gained">Items gained: {ksPurchasedEffects.length}</p>
              {:else}
                <p class="ks-result-nothing">You gained nothing but paid the price.</p>
              {/if}
            </div>
            <button class="continue-btn" data-testid="mystery-continue" onclick={handleKsDone}>Continue</button>
          {/if}
        </div>

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
    onSettle={() => {
      tick().then(() => {
        if (!overlayEl) return
        staggerPopIn({
          container: overlayEl,
          elements: ['.mystery-card', '.event-name', '.effect-icon', '.event-desc', '.hp-info', '.continue-btn'],
          totalDuration: 2000,
        })
      })
    }}
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
    max-width: min(90%, calc(480px * var(--layout-scale, 1)));
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

  /* ── Double or Nothing ──────────────────────────────────────────────────── */
  .minigame-don {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .don-pot {
    font-size: calc(22px * var(--text-scale, 1));
    font-weight: 700;
    color: #e3b341;
    text-align: center;
    padding: calc(6px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(227, 179, 65, 0.1);
    border: 1px solid #e3b341;
    border-radius: calc(8px * var(--layout-scale, 1));
  }

  .don-question {
    font-size: calc(14px * var(--text-scale, 1));
    color: #C9D1D9;
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  .don-choices {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
  }

  .don-correct {
    font-size: calc(14px * var(--text-scale, 1));
    color: #3fb950;
    text-align: center;
    margin: 0;
  }

  .don-lost {
    font-size: calc(14px * var(--text-scale, 1));
    color: #f85149;
    text-align: center;
    margin: 0;
  }

  .don-won {
    font-size: calc(16px * var(--text-scale, 1));
    color: #e3b341;
    text-align: center;
    font-weight: 700;
    margin: 0;
  }

  .don-actions {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
  }

  .don-double {
    border-color: #e3b341;
    color: #e3b341;
  }

  .don-double:hover {
    background: rgba(227, 179, 65, 0.15);
    border-color: #e3b341;
  }

  /* ── Speed Round ─────────────────────────────────────────────────────────── */
  .minigame-sr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .sr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(8px * var(--layout-scale, 1));
  }

  .sr-timer {
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 700;
    color: #3fb950;
    transition: color 0.2s;
  }

  .sr-timer.sr-urgent {
    color: #f85149;
  }

  .sr-score {
    font-size: calc(14px * var(--text-scale, 1));
    color: #C9D1D9;
    font-weight: 700;
  }

  .sr-question {
    font-size: calc(14px * var(--text-scale, 1));
    color: #C9D1D9;
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  .sr-choices {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
  }

  .sr-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(8px * var(--layout-scale, 1));
    width: 100%;
  }

  .sr-result-title {
    font-size: calc(18px * var(--text-scale, 1));
    color: #9B59B6;
    font-weight: 700;
    margin: 0;
  }

  .sr-result-score {
    font-size: calc(14px * var(--text-scale, 1));
    color: #C9D1D9;
    margin: 0;
  }

  .sr-result-reward {
    font-size: calc(13px * var(--text-scale, 1));
    color: #3fb950;
    margin: 0;
  }

  /* ── Card Roulette ───────────────────────────────────────────────────────── */
  .minigame-cr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .cr-info {
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: calc(12px * var(--text-scale, 1));
    color: #8B949E;
    padding: calc(4px * var(--layout-scale, 1)) 0;
  }

  .cr-cards {
    display: flex;
    flex-direction: row;
    gap: calc(8px * var(--layout-scale, 1));
    justify-content: center;
    width: 100%;
    flex-wrap: wrap;
  }

  .cr-card {
    width: calc(70px * var(--layout-scale, 1));
    height: calc(90px * var(--layout-scale, 1));
    background: #1E2D3D;
    border: 2px solid #484F58;
    border-radius: calc(8px * var(--layout-scale, 1));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(11px * var(--text-scale, 1));
    color: #C9D1D9;
    text-align: center;
    padding: calc(4px * var(--layout-scale, 1));
    transition: border-color 0.15s, background 0.15s;
  }

  .cr-card:hover:not(:disabled) {
    background: #2D333B;
    border-color: #9B59B6;
  }

  .cr-card:disabled {
    cursor: default;
    opacity: 0.85;
  }

  .cr-card.cr-positive {
    border-color: #3fb950;
    background: rgba(63, 185, 80, 0.1);
  }

  .cr-card.cr-negative {
    border-color: #f85149;
    background: rgba(248, 81, 73, 0.1);
  }

  .cr-back {
    font-size: calc(28px * var(--text-scale, 1));
    color: #484F58;
    font-weight: 700;
  }

  .cr-result {
    font-size: calc(10px * var(--text-scale, 1));
    color: #E6EDF3;
    line-height: 1.3;
  }

  .cr-log {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1));
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(6px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #8B949E;
    max-height: calc(80px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  .cr-log p {
    margin: 0;
  }

  /* ── Fact or Fiction ─────────────────────────────────────────────────────── */
  .minigame-fof {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .fof-progress {
    font-size: calc(11px * var(--text-scale, 1));
    color: #8B949E;
    text-align: center;
  }

  .fof-statement {
    font-size: calc(15px * var(--text-scale, 1));
    color: #C9D1D9;
    text-align: center;
    margin: 0;
    line-height: 1.6;
    padding: calc(10px * var(--layout-scale, 1));
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(8px * var(--layout-scale, 1));
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }

  .fof-statement.fof-correct {
    border-color: #3fb950;
    color: #3fb950;
  }

  .fof-statement.fof-wrong {
    border-color: #f85149;
    color: #f85149;
  }

  .fof-buttons {
    display: flex;
    flex-direction: row;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .fof-true {
    flex: 1;
    background: rgba(63, 185, 80, 0.1);
    border-color: #3fb950;
    color: #3fb950;
  }

  .fof-true:hover {
    background: rgba(63, 185, 80, 0.25);
  }

  .fof-false {
    flex: 1;
    background: rgba(248, 81, 73, 0.1);
    border-color: #f85149;
    color: #f85149;
  }

  .fof-false:hover {
    background: rgba(248, 81, 73, 0.25);
  }

  .fof-feedback {
    font-size: calc(13px * var(--text-scale, 1));
    color: #C9D1D9;
    text-align: center;
    margin: 0;
    font-style: italic;
  }

  .fof-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(8px * var(--layout-scale, 1));
    width: 100%;
  }

  .fof-result-title {
    font-size: calc(18px * var(--text-scale, 1));
    color: #9B59B6;
    font-weight: 700;
    margin: 0;
  }

  .fof-result-score {
    font-size: calc(14px * var(--text-scale, 1));
    color: #C9D1D9;
    margin: 0;
  }

  .fof-reward {
    font-size: calc(13px * var(--text-scale, 1));
    color: #3fb950;
    margin: 0;
    font-weight: 700;
  }

  .fof-penalty {
    font-size: calc(13px * var(--text-scale, 1));
    color: #f85149;
    margin: 0;
    font-weight: 700;
  }

  /* ── Knowledge Shop (Knowing Skull) ─────────────────────────────────────── */
  .minigame-ks {
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
    align-items: center;
    width: 100%;
  }
  .ks-info {
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: calc(14px * var(--text-scale, 1));
    color: #aaa;
  }
  .ks-offer {
    text-align: center;
    padding: calc(16px * var(--layout-scale, 1));
    background: rgba(0, 200, 200, 0.1);
    border: 1px solid rgba(0, 200, 200, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    width: 100%;
    box-sizing: border-box;
  }
  .ks-label {
    font-size: calc(18px * var(--text-scale, 1));
    color: #4dd;
    margin: 0 0 calc(8px * var(--layout-scale, 1)) 0;
  }
  .ks-cost {
    font-size: calc(16px * var(--text-scale, 1));
    color: #e44;
    font-weight: bold;
    margin: 0;
  }
  .ks-actions {
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
    width: 100%;
  }
  .ks-actions .choice-btn {
    flex: 1;
  }
  .ks-buy {
    border-color: rgba(0, 200, 200, 0.5) !important;
  }
  .ks-leave {
    border-color: rgba(200, 100, 100, 0.5) !important;
  }
  .ks-purchased {
    width: 100%;
    padding: calc(8px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.05);
    border-radius: calc(4px * var(--layout-scale, 1));
    box-sizing: border-box;
  }
  .ks-purchased-title {
    font-size: calc(12px * var(--text-scale, 1));
    color: #888;
    margin: 0 0 calc(4px * var(--layout-scale, 1)) 0;
  }
  .ks-purchased-item {
    display: block;
    font-size: calc(13px * var(--text-scale, 1));
    color: #4d4;
    padding: calc(2px * var(--layout-scale, 1)) 0;
  }
  .ks-results {
    text-align: center;
  }
  .ks-result-title {
    font-size: calc(18px * var(--text-scale, 1));
    color: #4dd;
    margin: 0 0 calc(8px * var(--layout-scale, 1)) 0;
  }
  .ks-result-cost {
    font-size: calc(14px * var(--text-scale, 1));
    color: #e44;
    margin: 0;
  }
  .ks-result-gained {
    font-size: calc(14px * var(--text-scale, 1));
    color: #4d4;
    margin: 0;
  }
  .ks-result-nothing {
    font-size: calc(14px * var(--text-scale, 1));
    color: #888;
    margin: 0;
  }
</style>

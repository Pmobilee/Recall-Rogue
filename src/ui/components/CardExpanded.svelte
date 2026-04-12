<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Card, FactDomain } from '../../data/card-types'
  import { isLandscape } from '../../stores/layoutStore'
  import { inputService } from '../../services/inputService'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getChainColor, getChainGlowColor } from '../../services/chainVisuals'
  import { getBorderUrl, getBannerUrl, getBaseFrameUrl, getUpgradeIconUrl } from '../utils/cardFrameV2'
  import { getCardTypeEmoji, getCardTypeIconCandidates } from '../utils/iconAssets'
  import { getMechanicDefinition } from '../../data/mechanics'
  import { getMasteryStats } from '../../services/cardUpgradeService'
  import {
    CHARGE_CORRECT_MULTIPLIER,
    CORRECT_ANSWER_RESUME_DELAY,
    WRONG_ANSWER_RESUME_BASE,
    WRONG_ANSWER_RESUME_PER_CHAR,
    WRONG_ANSWER_RESUME_MAX,
  } from '../../data/balance'
  import { answerDisplaySpeed, autoResumeAfterAnswer } from '../stores/settings'
  import GrammarTypingInput from './GrammarTypingInput.svelte'
  import TypingInput from './TypingInput.svelte'
  import KeywordPopup from './KeywordPopup.svelte'
  import FuriganaText from '../FuriganaText.svelte'
  import WordHover from './WordHover.svelte'
  import GrammarSentenceFurigana from './GrammarSentenceFurigana.svelte'
  import { deckOptions } from '../../services/deckOptionsService'
  import DeckOptionsPanel from '../DeckOptionsPanel.svelte'
  import { getLanguageConfig } from '../../types/vocabulary'
  import { displayAnswer, isNumericalAnswer } from '../../services/numericalDistractorService'
  import ChessBoard from './ChessBoard.svelte'
  import { getPlayerContext, gradeChessMove, isInCheck as chessIsInCheck, applyMove, getOpponentResponse } from '../../services/chessGrader'
  import { updateChessElo } from '../../services/chessEloService'
  import { audioManager } from '../../services/audioService'
  import MapPinDrop from './MapPinDrop.svelte'
  import { updateGeoElo, tierToRating } from '../../services/geoEloService'

  interface Props {
    card: Card
    question: string
    answers: string[]
    correctAnswer: string
    timerDuration: number
    timerEnabled?: boolean
    speedBonusThreshold?: number
    timerColorVariant?: 'default' | 'gold' | 'slowReader'
    showMasteryTrialHeader?: boolean
    allowCancel?: boolean
    questionImageUrl?: string
    /** AR-220: When true, show the charged effect value (1.5x + mastery bonus) instead of base. */
    isCharging?: boolean
    /** Language code of the quiz fact (e.g. 'ja'). Used for furigana rendering. */
    factLanguage?: string
    /** Pronunciation/reading string from the fact. Used to parse furigana from the question. */
    factPronunciation?: string
    /** Quiz presentation mode: 'text' (default), 'image_question', 'image_answers', 'chess_tactic'. */
    quizMode?: 'text' | 'image_question' | 'image_answers' | 'chess_tactic'
    /** Path to the image shown above the question in image_question mode. */
    imageAssetPath?: string
    /** Parallel image paths for each answer choice in image_answers mode. */
    answerImagePaths?: string[]
    /** Optional deck display name shown in the card header (e.g., "Japanese → N3 Vocabulary"). */
    deckDisplayName?: string
    /** Quiz variant/template type (e.g. 'reading', 'forward', 'reverse'). Suppresses furigana on reading questions to avoid giving away the answer. */
    quizVariantType?: string
    /** Language code for the settings cogwheel (shows only when language has configurable options). */
    quizLanguageCode?: string
    /** Rich grammar explanation shown on wrong answers for language/grammar facts. */
    grammarNote?: string
    /** Bold header extracted from the explanation (e.g. "さえ (even; only; just)"). */
    grammarPointHeader?: string
    /** Quiz response mode: 'choice' (default multiple choice), 'typing' (text input), 'chess_move' (interactive board), or 'map_pin' (geography pin drop). */
    quizResponseMode?: 'choice' | 'typing' | 'chess_move' | 'map_pin'
    /** FEN string for chess puzzle positions. Required when quizResponseMode is 'chess_move'. */
    fenPosition?: string
    /** Solution move sequence in UCI notation. Required when quizResponseMode is 'chess_move'. */
    solutionMoves?: string[]
    /** Lichess puzzle rating for Elo calculation after a chess quiz attempt. */
    lichessRating?: number
    /** Pre-baked furigana segments for Japanese grammar sentences. When present, replaces runtime tokenization. */
    sentenceFurigana?: Array<{ t: string; r?: string; g?: string }>
    /** Pre-baked whole-sentence romaji for Japanese grammar sentences. */
    sentenceRomaji?: string
    /** First-class English translation for Japanese grammar sentences. */
    sentenceTranslation?: string
    /** Short grammar-point label shown as hint above typing input (e.g., "が — subject marker particle"). */
    grammarPointLabel?: string
    /** Hint level for chess puzzles: 0 = no hint, 1 = from-square highlighted, 2 = from+to squares highlighted. */
    chessHintLevel?: number
    /** Lat/lng for map pin drop quiz mode. */
    mapCoordinates?: [number, number]
    /** Geographic region for map centering. */
    mapRegion?: string
    /** Location difficulty tier 1-5. */
    mapDifficultyTier?: number
    onanswer: (answerIndex: number, isCorrect: boolean, speedBonus: boolean, partialAccuracy?: number) => void
    onskip: () => void
    oncancel: () => void
  }

  let {
    card,
    question,
    answers,
    correctAnswer,
    timerDuration,
    timerEnabled = true,
    speedBonusThreshold = 0.25,
    timerColorVariant = 'default',
    showMasteryTrialHeader = false,
    allowCancel = true,
    questionImageUrl,
    isCharging = true,
    factLanguage,
    factPronunciation,
    quizMode = 'text',
    imageAssetPath,
    answerImagePaths,
    deckDisplayName,
    quizLanguageCode,
    quizVariantType,
    grammarNote,
    grammarPointHeader,
    quizResponseMode = 'choice',
    sentenceFurigana,
    sentenceRomaji,
    sentenceTranslation,
    grammarPointLabel,
    chessHintLevel = 0,
    fenPosition,
    solutionMoves,
    lichessRating,
    mapCoordinates,
    mapRegion,
    mapDifficultyTier,
    onanswer,
    onskip,
    oncancel,
  }: Props = $props()

  let chargedEffectValue = $derived.by(() => {
    const mechanic = getMechanicDefinition(card.mechanicId)
    const stats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0)
    if (mechanic) {
      // masteryBonus = stats.qpValue - mechanic.quickPlayValue (addend applied after CC multiplier, preserving original behaviour)
      const masteryBonus = stats ? stats.qpValue - mechanic.quickPlayValue : 0
      return Math.round(mechanic.quickPlayValue * CHARGE_CORRECT_MULTIPLIER) + masteryBonus
    }
    // Fallback: no mechanic def means getMasteryStats also returns null, so bonus is 0.
    return Math.round(card.baseEffectValue * card.effectMultiplier)
  })
  let domainName = $derived(getDomainMetadata(card.domain).displayName)
  let domainColor = $derived(getDomainMetadata(card.domain).colorTint)
  let typeIconCandidates = $derived(getCardTypeIconCandidates(card.cardType))
  let typeIconFallback = $derived(getCardTypeEmoji(card.cardType))
  let typeIconAttempt = $state(0)
  let typeIconPath = $derived(typeIconCandidates[typeIconAttempt] ?? null)
  // V2: frame is now rendered as layered images, not a CSS background variable

  const TIMER_UPDATE_INTERVAL_MS = 33

  let startTime = $state(0)
  let lastTimerUpdateMs = 0
  let elapsed = $state(0)
  let timerTotalMs = $state(1000)
  let timerFraction = $derived(Math.max(0, 1 - elapsed / timerTotalMs))
  let secondsRemaining = $derived(Math.max(0, Math.ceil((timerTotalMs - elapsed) / 1000)))
  let timerColor = $derived.by(() => {
    if (timerColorVariant === 'gold') {
      return timerFraction > 0.5 ? '#D4AF37' : timerFraction > 0.25 ? '#F1C40F' : '#E67E22'
    }
    if (timerColorVariant === 'slowReader') {
      return timerFraction > 0.5 ? '#D88D24' : timerFraction > 0.25 ? '#F0B44D' : '#B86A0F'
    }
    return timerFraction > 0.5 ? '#27AE60' : timerFraction > 0.25 ? '#F1C40F' : '#E74C3C'
  })

  let selectedAnswerIndex = $state<number | null>(null)
  let answerRevealed = $state(false)
  let answersDisabled = $state(false)

  // --- Chess puzzle state ---
  const chessContext = $derived.by(() => {
    if (quizResponseMode !== 'chess_move' || !fenPosition || !solutionMoves || solutionMoves.length < 2) return null
    try {
      return getPlayerContext(fenPosition, solutionMoves)
    } catch {
      return null
    }
  })
  let chessLastMove = $state<{ from: string; to: string } | undefined>(undefined)
  let chessDisabled = $state(false)
  let chessCheckState = $state(false)
  let chessMoveTimeoutId: ReturnType<typeof setTimeout> | undefined
  /** Current move index in a multi-move puzzle (0 = first player move). */
  let chessCurrentMoveIndex = $state(0)
  /** Tracks whether the last chess puzzle attempt was correct (null = not yet answered). */
  let chessWasCorrect = $state<boolean | null>(null)
  /** Tracks current board FEN for multi-move puzzles (updates after each ply). */
  let chessBoardFen = $state<string | undefined>(undefined)
  /** True while the opponent's animated response is playing (disables player input). */
  let chessAnimatingOpponent = $state(false)
  /** Setup animation phase: pre-move (showing base FEN), animating (setup move playing), ready (player can move). */
  let chessSetupPhase = $state<'pre-move' | 'animating' | 'ready'>('ready')
  /** Highlight squares for chess hints: empty = no hint, [from] = hint 1, [from, to] = hint 2. */
  const chessHighlightSquares = $derived.by(() => {
    if (!chessContext || !chessHintLevel) return undefined
    const squares: string[] = []
    const solutionUCI = chessContext.solutionUCI
    if (chessHintLevel >= 1) squares.push(solutionUCI.substring(0, 2)) // from-square
    if (chessHintLevel >= 2) squares.push(solutionUCI.substring(2, 4)) // to-square
    return squares.length > 0 ? squares : undefined
  })

  /** Elo rating change after the last chess puzzle attempt (+N or -N). */
  let eloChange = $state<number | null>(null)

  // --- Map pin drop state ---
  let mapDisabled = $state(false)
  let mapEloChange = $state<number | null>(null)

  $effect(() => {
    if (chessContext) {
      // Start with the base FEN (before opponent's setup move)
      chessSetupPhase = 'pre-move'
      chessBoardFen = chessContext.baseFen ?? chessContext.playerFen
      chessLastMove = undefined
      chessDisabled = true
      chessCheckState = false
      chessCurrentMoveIndex = 0
      chessWasCorrect = null
      chessAnimatingOpponent = false
      eloChange = null

      // After a brief pause, animate the opponent's setup move
      const setupTimer = setTimeout(() => {
        chessSetupPhase = 'animating'
        chessBoardFen = chessContext!.playerFen
        chessLastMove = chessContext!.setupMove
        chessCheckState = chessIsInCheck(chessContext!.playerFen)
        audioManager.playSound('chess_move')

        // After animation completes, enable interaction
        const readyTimer = setTimeout(() => {
          chessSetupPhase = 'ready'
          chessDisabled = false
        }, 350)
        chessMoveTimeoutId = readyTimer
      }, 500)
      chessMoveTimeoutId = setupTimer
    }
  })

  /** Landscape-only: shows CORRECT/WRONG flash overlay for 500ms after answering. */
  let quizResultState = $state<'correct' | 'wrong' | null>(null)
  let showSpeedBonus = $state(false)
  let timerExpired = $state(false)
  let waitingForGotIt = $state(false)
  let showTimerExpiredLabel = $state(false)
  let touchStartY = $state<number | null>(null)
  let eliminatedIndices = $state<Set<number>>(new Set())
  let activeKeyword = $state<{ id: string; x: number; y: number } | null>(null)

  /** CSS class for question text auto-scaling based on character count. */
  let questionLengthClass = $derived.by(() => {
    const len = question.length
    if (len < 30) return 'quiz-text-short'
    if (len < 80) return 'quiz-text-medium'
    if (len < 150) return 'quiz-text-long'
    if (len < 250) return 'quiz-text-extra-long'
    return 'quiz-text-max-long'
  })

  /** Content-aware grid class for answer buttons based on count and text length. */
  let answerLayoutClass = $derived.by(() => {
    const count = answers.length
    const maxLen = Math.max(...answers.map(a => a.length))
    // True/False: always side-by-side
    if (count === 2 && answers.every(a => ['True', 'False', 'Yes', 'No'].includes(a)))
      return 'answers-tf-pair'
    // Any answer >50 chars OR more than 4 answers: single column
    if (maxLen > 50 || count > 4) return 'answers-single-column'
    // 2 short answers: side-by-side
    if (count === 2 && maxLen < 30) return 'answers-two-wide'
    // 3-4 short answers: 2x2 grid
    if (count >= 3 && count <= 4 && maxLen < 30) return 'answers-grid-2x2'
    return 'answers-single-column'
  })

  /** Reduces answer button font size when any answer is very long. */
  let answerFontClass = $derived.by(() => {
    const maxLen = Math.max(...answers.map(a => a.length))
    return maxLen > 80 ? 'answer-font-small' : ''
  })

  /** Left-aligns question text for longer questions to improve readability. */
  let questionAlignClass = $derived.by(() => {
    return question.length >= 80 ? 'quiz-align-left' : ''
  })

  /** Whether the current fact is Japanese. */
  const isJapaneseFact = $derived(factLanguage === 'ja')
  /** Whether the current fact is Chinese. */
  const isChineseFact = $derived(factLanguage === 'zh')
  /** Whether the current fact is Korean. */
  const isKoreanFact = $derived(factLanguage === 'ko')

  /** Whether the cogwheel settings button should be shown (language has configurable options). */
  const hasLanguageOptions = $derived(
    quizLanguageCode
      ? (getLanguageConfig(quizLanguageCode)?.options?.length ?? 0) > 0
      : false
  )

  /** Local state for the in-card settings popup. */
  let showSettings = $state(false)

  /** Whether kana-only mode is active (read from deckOptions store). */
  const kanaOnly = $derived.by(() => {
    if (!isJapaneseFact) return false
    return $deckOptions?.ja?.kanaOnly ?? false
  })

  /** Whether romaji mode is active for Japanese grammar sentences. */
  const showRomaji = $derived.by(() => {
    if (!isJapaneseFact) return false
    return $deckOptions?.ja?.romaji ?? false
  })

  /** Whether always-write mode is active for the current language (grammar typing instead of MC). */
  const alwaysWriteEnabled = $derived.by(() => {
    const opts = $deckOptions
    return opts?.[quizLanguageCode ?? '']?.alwaysWrite ?? false
  })

  /** Effective response mode: 'map_pin', 'chess_move', 'typing', or 'choice'. */
  const effectiveResponseMode = $derived(
    quizResponseMode === 'map_pin' ? 'map_pin' :
    quizResponseMode === 'chess_move' ? 'chess_move' :
    alwaysWriteEnabled || quizResponseMode === 'typing' ? 'typing' : 'choice'
  )

  /** Whether this fact should be excluded from typing mode (fall back to multiple choice). */
  const isTypingExcluded = $derived.by(() => {
    if (quizMode === 'image_question' || quizMode === 'image_answers' || quizMode === 'chess_tactic' || quizResponseMode === 'map_pin') return true
    if (isNumericalAnswer(correctAnswer)) return true
    if (displayAnswer(correctAnswer).length > 80) return true
    return false
  })

  /**
   * Parse a Japanese question into { before, word, reading, after } parts.
   * Parses inline Japanese reading from question text.
   * Expects format: "What does '食べる' (たべる) mean..." or "What does '食べる' mean..."
   * Returns null if the question cannot be parsed.
   */
  function parseJapaneseQuestion(q: string, pronunciation?: string): { before: string; word: string; reading: string; after: string } | null {
    // Match both single quotes ('食べる') and double quotes ("食べる") with optional inline reading
    const match = q.match(/^(.*?)['""「]([^'""」]+)['""」](?:\s*[(\uff08]([^)\uff09]+)[)\uff09])?\s*(.*)$/)
    if (!match) return null
    const [, before, word, inlineReading, after] = match
    const reading = inlineReading ?? pronunciation ?? ''
    if (!reading) return null
    return { before: before ?? '', word, reading, after: after ?? '' }
  }

  /**
   * Parsed Japanese parts for the question, or null for non-Japanese / unparseable questions.
   */
  const japaneseParts = $derived.by(() => {
    if (!isJapaneseFact) return null
    if (quizVariantType === 'reading') return null  // Reading questions: furigana gives away the answer
    // Try parsing even without factPronunciation — reading may be inline in the question
    return parseJapaneseQuestion(question, factPronunciation)
  })

  /** Parsed CJK question parts for Chinese pinyin display. */
  const chineseParts = $derived.by(() => {
    if (!isChineseFact || !factPronunciation) return null
    if (quizVariantType === 'reading') return null  // Reading questions: pinyin gives away the answer
    const opts = $deckOptions
    if (!(opts?.zh?.pinyin ?? true)) return null  // pinyin disabled
    return parseJapaneseQuestion(question, factPronunciation)
  })

  /** Whether pinyin-only mode is active for Chinese questions. */
  const pinyinOnly = $derived.by(() => {
    const opts = $deckOptions
    return opts?.zh?.pinyinOnly ?? false
  })

  /** Parsed CJK question parts for Korean romanization display. */
  const koreanParts = $derived.by(() => {
    if (!isKoreanFact || !factPronunciation) return null
    if (quizVariantType === 'reading') return null  // Reading questions: romanization gives away the answer
    const opts = $deckOptions
    if (!(opts?.ko?.romanization ?? false)) return null  // romanization disabled
    return parseJapaneseQuestion(question, factPronunciation)
  })

  $effect(() => {
    if (import.meta.env.DEV) {
      if (factLanguage || quizLanguageCode) {
        console.log('[CardExpanded] Language props:', { factLanguage, quizLanguageCode, factPronunciation: factPronunciation?.substring(0, 20), isJapaneseFact, japaneseParts: japaneseParts ? 'parsed' : 'null', question: question?.substring(0, 60) })
      }
    }
  })

  /**
   * Check if a text string contains Japanese characters (kanji, hiragana, katakana).
   */
  function hasJapanese(text: string): boolean {
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text)
  }

  /** Index of the answer button currently highlighted by keyboard input (150ms flash). */
  let keyboardHighlightIndex = $state<number | null>(null)

  function handleKeywordTap(e: MouseEvent, keywordId: string): void {
    activeKeyword = { id: keywordId, x: e.clientX, y: e.clientY }
  }

  function dismissKeyword(): void {
    activeKeyword = null
  }

  let rafId: number | undefined
  let feedbackTimeoutId: ReturnType<typeof setTimeout> | undefined
  let correctRevealTimeoutId: ReturnType<typeof setTimeout> | undefined
  let speedBonusTimeoutId: ReturnType<typeof setTimeout> | undefined
  let quizResultTimeoutId: ReturnType<typeof setTimeout> | undefined
  let timerExpiredLabelTimeoutId: ReturnType<typeof setTimeout> | undefined
  let autoResumeTimeoutId: ReturnType<typeof setTimeout> | undefined

  function timerTick(now: number): void {
    if (!timerEnabled || answersDisabled || timerExpired) return
    const nextElapsed = now - startTime
    if (nextElapsed >= timerTotalMs) {
      elapsed = timerTotalMs
      timerExpired = true
      return
    }
    if ((nextElapsed - lastTimerUpdateMs) >= TIMER_UPDATE_INTERVAL_MS) {
      elapsed = nextElapsed
      lastTimerUpdateMs = nextElapsed
    }
    rafId = requestAnimationFrame(timerTick)
  }

  $effect(() => {
    timerTotalMs = Math.max(1000, timerDuration * 1000)
    startTime = performance.now()
    lastTimerUpdateMs = 0
    elapsed = 0
    timerExpired = false
    waitingForGotIt = false
    showTimerExpiredLabel = false
    eliminatedIndices = new Set()
    if (timerEnabled) {
      rafId = requestAnimationFrame(timerTick)
    }
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      if (feedbackTimeoutId !== undefined) clearTimeout(feedbackTimeoutId)
      if (correctRevealTimeoutId !== undefined) clearTimeout(correctRevealTimeoutId)
      if (speedBonusTimeoutId !== undefined) clearTimeout(speedBonusTimeoutId)
      if (quizResultTimeoutId !== undefined) clearTimeout(quizResultTimeoutId)
      if (timerExpiredLabelTimeoutId !== undefined) clearTimeout(timerExpiredLabelTimeoutId)
      if (autoResumeTimeoutId !== undefined) clearTimeout(autoResumeTimeoutId)
    }
  })

  $effect(() => {
    if (timerExpired) {
      showTimerExpiredLabel = true
      timerExpiredLabelTimeoutId = setTimeout(() => {
        showTimerExpiredLabel = false
      }, 2000)
    }
  })

  $effect(() => {
    card.cardType
    typeIconAttempt = 0
  })

  function handleAnswer(index: number): void {
    if (answersDisabled || eliminatedIndices.has(index)) return
    answersDisabled = true
    selectedAnswerIndex = index

    const isCorrect = answers[index] === correctAnswer
    const elapsedNow = timerEnabled
      ? Math.min(timerTotalMs, Math.max(elapsed, performance.now() - startTime))
      : elapsed
    elapsed = elapsedNow
    const speedBonus = timerEnabled
      ? elapsedNow < (timerTotalMs * speedBonusThreshold)
      : false
    if (isCorrect && speedBonus) {
      showSpeedBonus = true
      speedBonusTimeoutId = setTimeout(() => {
        showSpeedBonus = false
      }, 500)
    }

    if (!isCorrect) {
      correctRevealTimeoutId = setTimeout(() => {
        answerRevealed = true
        waitingForGotIt = true
      }, 800)
    } else {
      answerRevealed = true
    }

    // Landscape quiz result overlay — flash for 500ms then clear
    if ($isLandscape) {
      quizResultState = isCorrect ? 'correct' : 'wrong'
      quizResultTimeoutId = setTimeout(() => {
        quizResultState = null
      }, 500)
    }

    if ($autoResumeAfterAnswer) {
      // Auto-resume: calculate delay based on correct/wrong and answer display speed
      const speed = $answerDisplaySpeed
      if (isCorrect) {
        const delay = Math.round(CORRECT_ANSWER_RESUME_DELAY * speed)
        feedbackTimeoutId = setTimeout(() => {
          onanswer(index, isCorrect, speedBonus)
        }, delay)
      } else {
        // Wrong: show answer for long enough to read it based on answer length
        let baseDelay = Math.min(
          WRONG_ANSWER_RESUME_BASE + correctAnswer.length * WRONG_ANSWER_RESUME_PER_CHAR,
          WRONG_ANSWER_RESUME_MAX,
        )
        // Grammar notes need extra reading time
        if (grammarNote) baseDelay += 3000
        const delay = Math.round(baseDelay * speed)
        autoResumeTimeoutId = setTimeout(() => {
          if (waitingForGotIt) {
            waitingForGotIt = false
            onanswer(index, false, false)
          }
        }, delay)
      }
    } else {
      // Manual mode: correct auto-dismisses after 1600ms, wrong waits for "Continue"
      if (isCorrect) {
        feedbackTimeoutId = setTimeout(() => {
          onanswer(index, isCorrect, speedBonus)
        }, 1600)
      }
      // Wrong answers wait for "Continue" button tap — no auto-dismiss
    }
  }

  function getAnswerClass(index: number): string {
    if (eliminatedIndices.has(index)) return 'answer-eliminated'
    if (selectedAnswerIndex === null) return ''
    const isCorrect = answers[index] === correctAnswer
    if (index === selectedAnswerIndex) {
      return isCorrect ? 'answer-correct' : 'answer-wrong'
    }
    if (answerRevealed && isCorrect) {
      return 'answer-reveal-correct'
    }
    return ''
  }

  function handleTouchStart(e: TouchEvent): void {
    touchStartY = e.touches[0].clientY
  }

  function handleTouchMove(e: TouchEvent): void {
    if (!allowCancel) return
    if (touchStartY === null) return
    const deltaY = e.touches[0].clientY - touchStartY
    if (deltaY > 40) {
      touchStartY = null
      oncancel()
    }
  }

  function handleTouchEnd(): void {
    touchStartY = null
  }

  let kbdHighlightTimeoutId: ReturnType<typeof setTimeout> | undefined

  /**
   * Handle a QUIZ_ANSWER action from the input service (landscape keyboard shortcut).
   * Briefly highlights the button (150 ms) before submitting, so the player can see
   * which answer was selected before it is processed.
   */
  function handleKeyboardAnswer(index: number): void {
    if (answersDisabled || eliminatedIndices.has(index)) return
    if (index < 0 || index >= answers.length) return

    keyboardHighlightIndex = index
    kbdHighlightTimeoutId = setTimeout(() => {
      keyboardHighlightIndex = null
      handleAnswer(index)
    }, 150)
  }

  onMount(() => {
    const unsub = inputService.on('QUIZ_ANSWER', (action) => {
      if (action.type !== 'QUIZ_ANSWER') return
      if (!$isLandscape) return
      handleKeyboardAnswer(action.index)
    })
    return unsub
  })

  /**
   * Handle a move from the ChessBoard component.
   * For multi-move puzzles: validates each step, animates opponent responses,
   * then fires handleAnswer only when the full sequence is complete or fails.
   */
  function handleChessMove(uci: string): void {
    if (!chessContext || chessDisabled || chessAnimatingOpponent) return

    const currentMove = chessContext.moveSequence[chessCurrentMoveIndex]
    if (!currentMove) return

    const isCorrect = gradeChessMove(uci, currentMove.solutionUCI)

    if (!isCorrect) {
      // Wrong at any step = fail the whole puzzle.
      // Bypass handleAnswer entirely — for chess, answers = [correctAnswer] only,
      // so handleAnswer(any index) always resolves to correct. Call onanswer directly.
      chessWasCorrect = false
      chessDisabled = true
      chessLastMove = { from: uci.substring(0, 2), to: uci.substring(2, 4) }

      if (lichessRating) {
        const result = updateChessElo(lichessRating, false)
        eloChange = result.ratingChange
      }

      selectedAnswerIndex = 0
      answersDisabled = true

      chessMoveTimeoutId = setTimeout(() => {
        answerRevealed = true
        if ($isLandscape) {
          quizResultState = 'wrong'
          quizResultTimeoutId = setTimeout(() => { quizResultState = null }, 500)
        }
        if ($autoResumeAfterAnswer) {
          const speed = $answerDisplaySpeed
          const baseDelay = Math.min(
            WRONG_ANSWER_RESUME_BASE + correctAnswer.length * WRONG_ANSWER_RESUME_PER_CHAR,
            WRONG_ANSWER_RESUME_MAX,
          )
          autoResumeTimeoutId = setTimeout(() => {
            onanswer(0, false, false)
          }, Math.round(baseDelay * speed))
        } else {
          waitingForGotIt = true
        }
      }, 800)
      return
    }

    // Correct move — apply it to the board
    try {
      const newFen = applyMove(chessBoardFen ?? currentMove.fen, uci)
      chessBoardFen = newFen
      chessLastMove = { from: uci.substring(0, 2), to: uci.substring(2, 4) }
      chessCheckState = chessIsInCheck(newFen)

      if (chessCheckState) {
        audioManager.playSound('chess_check')
      } else {
        audioManager.playSound('chess_move')
      }
    } catch {
      // Fallback if applyMove throws (shouldn't happen for a graded-correct move)
      chessLastMove = { from: uci.substring(0, 2), to: uci.substring(2, 4) }
    }

    // Check if there are more player moves
    if (chessCurrentMoveIndex < chessContext.totalPlayerMoves - 1) {
      // More moves needed — animate opponent response
      chessAnimatingOpponent = true
      chessDisabled = true

      const oppUCI = getOpponentResponse(solutionMoves!, chessCurrentMoveIndex)
      if (oppUCI) {
        chessMoveTimeoutId = setTimeout(() => {
          try {
            const oppFen = applyMove(chessBoardFen!, oppUCI)
            chessBoardFen = oppFen
            chessLastMove = { from: oppUCI.substring(0, 2), to: oppUCI.substring(2, 4) }
            chessCheckState = chessIsInCheck(oppFen)
            audioManager.playSound('chess_move')
          } catch {
            // Fallback
          }
          chessCurrentMoveIndex++
          chessAnimatingOpponent = false
          chessDisabled = false
        }, 600)
      } else {
        // No opponent response — advance directly
        chessCurrentMoveIndex++
        chessAnimatingOpponent = false
        chessDisabled = false
      }
    } else {
      // Last player move — puzzle complete!
      // Bypass handleAnswer — call onanswer directly with isCorrect=true.
      chessWasCorrect = true
      chessDisabled = true

      if (lichessRating) {
        const result = updateChessElo(lichessRating, true)
        eloChange = result.ratingChange
      }

      selectedAnswerIndex = 0
      answersDisabled = true
      answerRevealed = true

      chessMoveTimeoutId = setTimeout(() => {
        if ($isLandscape) {
          quizResultState = 'correct'
          quizResultTimeoutId = setTimeout(() => { quizResultState = null }, 500)
        }
        const elapsedNow = timerEnabled
          ? Math.min(timerTotalMs, Math.max(elapsed, performance.now() - startTime))
          : elapsed
        elapsed = elapsedNow
        const speedBonus = timerEnabled
          ? elapsedNow < (timerTotalMs * speedBonusThreshold)
          : false
        if (speedBonus) {
          showSpeedBonus = true
          speedBonusTimeoutId = setTimeout(() => { showSpeedBonus = false }, 500)
        }
        if ($autoResumeAfterAnswer) {
          feedbackTimeoutId = setTimeout(() => {
            onanswer(0, true, speedBonus)
          }, Math.round(CORRECT_ANSWER_RESUME_DELAY * $answerDisplaySpeed))
        } else {
          feedbackTimeoutId = setTimeout(() => {
            onanswer(0, true, speedBonus)
          }, 1600)
        }
      }, 400)
    }
  }

  /**
   * Handle a pin placement from the MapPinDrop component.
   * Fires onanswer with partial accuracy so the damage pipeline applies partial credit.
   */
  function handleMapPinConfirm(pinCoordinates: [number, number], distanceKm: number, accuracy: number): void {
    mapDisabled = true

    // Update geography Elo
    if (mapDifficultyTier) {
      const locationRating = tierToRating(mapDifficultyTier)
      const result = updateGeoElo(locationRating, accuracy, distanceKm, mapRegion)
      mapEloChange = result.ratingChange
    }

    const isCorrect = accuracy >= 0.5
    const correctIdx = answers.indexOf(correctAnswer)
    const wrongIdx = answers.findIndex(a => a !== correctAnswer)

    setTimeout(() => {
      onanswer(isCorrect ? (correctIdx >= 0 ? correctIdx : 0) : (wrongIdx >= 0 ? wrongIdx : 0), isCorrect, false, accuracy)
    }, 500)
  }

  onDestroy(() => {
    if (rafId !== undefined) cancelAnimationFrame(rafId)
    if (feedbackTimeoutId !== undefined) clearTimeout(feedbackTimeoutId)
    if (correctRevealTimeoutId !== undefined) clearTimeout(correctRevealTimeoutId)
    if (speedBonusTimeoutId !== undefined) clearTimeout(speedBonusTimeoutId)
    if (kbdHighlightTimeoutId !== undefined) clearTimeout(kbdHighlightTimeoutId)
    if (quizResultTimeoutId !== undefined) clearTimeout(quizResultTimeoutId)
    if (timerExpiredLabelTimeoutId !== undefined) clearTimeout(timerExpiredLabelTimeoutId)
    if (autoResumeTimeoutId !== undefined) clearTimeout(autoResumeTimeoutId)
    if (chessMoveTimeoutId !== undefined) clearTimeout(chessMoveTimeoutId)
  })
</script>

<div
  class="card-expanded"
  class:card-expanded-landscape={$isLandscape}
  style={`border: 1px solid ${getChainColor(card.chainType ?? 0)}; box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5), 0 0 12px ${getChainGlowColor(card.chainType ?? 0)};`}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="dialog"
  aria-label="Card question"
  tabindex="-1"
>
  <!-- V2 frame removed from expanded quiz view — quiz has its own UI -->

  {#if showMasteryTrialHeader}
    <div class="mastery-trial-header">MASTERY TRIAL</div>
  {/if}

  <div class="card-header">
    <span class="header-domain">
      {deckDisplayName ?? domainName}
    </span>
    <span class="header-icon">
      {#if hasLanguageOptions && quizLanguageCode}
        <button
          class="card-settings-btn"
          onclick={() => { showSettings = !showSettings }}
          aria-label="Language display settings"
        >⚙</button>
      {/if}
    </span>
  </div>
  {#if showSettings && quizLanguageCode}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="settings-modal-backdrop" onclick={() => { showSettings = false }}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="settings-modal-container" onclick={(e) => e.stopPropagation()}>
        <div class="settings-modal-header">
          <span class="settings-modal-title">Display Settings</span>
          <button class="settings-modal-close" onclick={() => { showSettings = false }} aria-label="Close settings">✕</button>
        </div>
        <DeckOptionsPanel languageCode={quizLanguageCode} />
      </div>
    </div>
  {/if}

  <div class="question-zone">
  {#if questionImageUrl}
    <div class="question-image-container">
      <img
        class="question-image"
        src={questionImageUrl}
        alt="Question illustration"
        onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  {/if}
  {#if quizMode === 'image_question' && imageAssetPath}
    <div class="quiz-asset-image-container">
      <img src={imageAssetPath} alt="Identify this" class="quiz-asset-image" />
    </div>
  {/if}
  <div class="card-question {questionLengthClass} {questionAlignClass}">
    {#if japaneseParts}
      {japaneseParts.before}<FuriganaText
        text={kanaOnly && japaneseParts.reading ? japaneseParts.reading : japaneseParts.word}
        reading={japaneseParts.reading}
        size="md"
      /> {japaneseParts.after}
    {:else if isJapaneseFact && question.includes('{___}')}
      {@const fallbackSentence = question.split('\n')[0]}
      {@const translation = sentenceTranslation || (question.split('\n')[1] || '').replace(/^\((.+)\)$/, '$1')}
      <GrammarSentenceFurigana
        segments={sentenceFurigana ?? []}
        fallbackText={fallbackSentence}
        excludeWords={[correctAnswer]}
      />
      {#if translation}
        <p class="grammar-translation">{translation}</p>
      {/if}
      {#if showRomaji && sentenceRomaji}
        <p class="grammar-romaji">{sentenceRomaji}</p>
      {/if}
    {:else if chineseParts}
      {chineseParts.before}<FuriganaText
        text={pinyinOnly && chineseParts.reading ? chineseParts.reading : chineseParts.word}
        reading={chineseParts.reading}
        size="md"
      /> {chineseParts.after}
    {:else if koreanParts}
      {koreanParts.before}<FuriganaText
        text={koreanParts.word}
        reading={koreanParts.reading}
        size="md"
      /> {koreanParts.after}
    {:else}
      {question}
    {/if}
  </div>
  </div><!-- end .question-zone -->
  {#if timerEnabled}
    <div class="timer-bar-container">
      <div
        class="timer-bar-fill"
        style="--fraction: {timerFraction}; background: {timerExpired ? '#64748b' : timerColor};"
      ></div>
      <div
        class="speed-bonus-marker"
        style="left: {(1 - speedBonusThreshold) * 100}%"
      ></div>
      <span class="timer-seconds">{secondsRemaining}s</span>
    </div>
    {#if showTimerExpiredLabel}
      <div class="timer-expired-label" aria-live="polite" role="status">Speed Bonus lost!</div>
    {/if}
  {/if}

  <div class="answer-zone">
  {#if effectiveResponseMode === 'map_pin' && mapCoordinates}
    <div class="map-pin-quiz-container">
      <MapPinDrop
        targetCoordinates={mapCoordinates}
        targetRegion={mapRegion}
        masteryLevel={card.masteryLevel ?? 0}
        disabled={mapDisabled || answersDisabled}
        onconfirm={handleMapPinConfirm}
      />
      {#if mapEloChange !== null}
        <div class="elo-change-badge" class:elo-positive={mapEloChange > 0} class:elo-negative={mapEloChange < 0}>
          {mapEloChange > 0 ? '+' : ''}{mapEloChange}
        </div>
      {/if}
    </div>
  {:else if effectiveResponseMode === 'chess_move'}
    <div class="chess-puzzle-container">
      {#if chessContext}
        {#if chessSetupPhase === 'pre-move' || chessSetupPhase === 'animating'}
          <div class="chess-setup-label">Opponent plays...</div>
        {/if}
        {#if chessContext.totalPlayerMoves > 1 && chessSetupPhase === 'ready'}
          <div class="chess-move-progress">
            Move {chessCurrentMoveIndex + 1} / {chessContext.totalPlayerMoves}
          </div>
        {/if}
        <ChessBoard
          fen={chessBoardFen ?? chessContext.playerFen}
          orientation={chessContext.orientation}
          onmove={handleChessMove}
          disabled={chessDisabled || answersDisabled || chessAnimatingOpponent}
          lastMove={chessLastMove}
          isInCheck={chessCheckState}
          highlightSquares={chessHighlightSquares}
          showNotationInput={$isLandscape}
          onSoundEvent={(event) => {
            if (event === 'capture') audioManager.playSound('chess_capture')
            // move sounds handled in handleChessMove for player moves; setup handled in init effect
          }}
        />
        {#if chessDisabled && selectedAnswerIndex !== null}
          <div class="chess-solution-display">
            <span class="chess-solution-label">
              {chessWasCorrect ? 'Correct!' : 'Solution:'}
            </span>
            <span class="chess-solution-move">
              {correctAnswer}
            </span>
          </div>
          {#if eloChange !== null}
            <div class="elo-change-badge" class:elo-positive={eloChange > 0} class:elo-negative={eloChange < 0}>
              {eloChange > 0 ? '+' : ''}{eloChange}
            </div>
          {/if}
        {/if}
      {:else}
        <div class="chess-puzzle-error">
          <span>Invalid puzzle position</span>
        </div>
      {/if}
    </div>
  {:else if effectiveResponseMode === 'typing' && !isTypingExcluded && !answersDisabled}
    {#if quizLanguageCode === 'ja'}
      {#if grammarPointLabel || sentenceTranslation}
        <div class="grammar-typing-hints">
          {#if grammarPointLabel}
            <p class="grammar-hint-label">{grammarPointLabel}</p>
          {/if}
          {#if sentenceTranslation}
            <p class="grammar-hint-translation">{sentenceTranslation}</p>
          {/if}
        </div>
      {/if}
      <GrammarTypingInput
        {correctAnswer}
        acceptableAlternatives={[]}
        onsubmit={(correct, _typed) => {
          if (correct) {
            handleAnswer(answers.indexOf(correctAnswer))
          } else {
            const wrongIdx = answers.findIndex(a => a !== correctAnswer)
            handleAnswer(wrongIdx >= 0 ? wrongIdx : 0)
          }
        }}
      />
    {:else}
      <TypingInput
        {correctAnswer}
        acceptableAlternatives={[]}
        language={quizLanguageCode ?? ''}
        onsubmit={(correct, _typed) => {
          if (correct) {
            handleAnswer(answers.indexOf(correctAnswer))
          } else {
            const wrongIdx = answers.findIndex(a => a !== correctAnswer)
            handleAnswer(wrongIdx >= 0 ? wrongIdx : 0)
          }
        }}
      />
    {/if}
  {:else if quizMode === 'image_answers' && answerImagePaths?.length}
    <div class="card-answers-image-grid">
      {#each answers as answer, i}
        <button
          class="answer-image-btn {getAnswerClass(i)}"
          class:answer-kbd-highlight={keyboardHighlightIndex === i}
          data-testid="quiz-answer-{i}"
          disabled={answersDisabled || eliminatedIndices.has(i)}
          aria-label={eliminatedIndices.has(i) ? `${answer} — eliminated by hint` : answer}
          onclick={() => handleAnswer(i)}
        >
          <span class="kbd-hint" aria-hidden="true">{i + 1}</span>
          <img src={answerImagePaths[i]} alt="" class="answer-flag-img" />
          {#if selectedAnswerIndex !== null}
            <span class="answer-image-label">{answer}</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <div
      class="card-answers {$isLandscape ? answerLayoutClass : ''} {answerFontClass}"
    >
      {#each answers as answer, i}
        <button
          class="answer-btn {getAnswerClass(i)}"
          class:answer-kbd-highlight={keyboardHighlightIndex === i}
          data-testid="quiz-answer-{i}"
          disabled={answersDisabled || eliminatedIndices.has(i)}
          aria-label={eliminatedIndices.has(i) ? `${answer} — eliminated by hint` : answer}
          onclick={() => handleAnswer(i)}
        >
          {#if $isLandscape}
            <span class="kbd-hint" aria-hidden="true">{i + 1}</span>
          {/if}
          {#if isJapaneseFact && hasJapanese(answer)}
            <FuriganaText text={answer} size="sm" />
          {:else}
            {answer}
          {/if}
        </button>
      {/each}
    </div>
  {/if}
  </div><!-- end .answer-zone -->

  {#if waitingForGotIt && grammarNote}
    <div class="grammar-note" role="note" aria-label="Grammar Note">
      {#if grammarPointHeader}
        <span class="grammar-note-header">{grammarPointHeader}</span>
      {/if}
      <p class="grammar-note-text">{grammarNote}</p>
    </div>
  {/if}

  {#if waitingForGotIt}
    <button
      class="got-it-btn"
      onclick={() => {
        if (autoResumeTimeoutId !== undefined) clearTimeout(autoResumeTimeoutId)
        waitingForGotIt = false
        onanswer(selectedAnswerIndex!, false, false)
      }}
    >
      Continue
    </button>
  {/if}

  {#if showSpeedBonus}
    <div class="speed-bonus-badge" aria-live="polite" role="status">SPEED BONUS</div>
  {/if}

  {#if activeKeyword}
    <KeywordPopup
      keywordId={activeKeyword.id}
      x={activeKeyword.x}
      y={activeKeyword.y}
      ondismiss={dismissKeyword}
    />
  {/if}

  {#if $isLandscape && quizResultState}
    <div
      class="quiz-result-overlay"
      class:quiz-result-correct={quizResultState === 'correct'}
      class:quiz-result-wrong={quizResultState === 'wrong'}
      role="status"
      aria-live="assertive"
    >
      <span class="quiz-result-text">
        {quizResultState === 'correct' ? 'CORRECT' : 'WRONG'}
      </span>
      {#if quizResultState === 'wrong' && answerRevealed}
        <span class="quiz-result-correct-answer">{displayAnswer(correctAnswer)}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card-expanded {
    position: fixed;
    /* Needed so absolute-positioned children (settings popup) anchor here */
    isolation: isolate;
    top: 55%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(320px * var(--layout-scale, 1));
    max-width: min(560px, calc(100vw - 24px));
    max-height: 80vh;
    overflow: hidden;
    overflow-x: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    background:
      linear-gradient(rgba(14, 20, 30, 1.0), rgba(16, 22, 32, 1.0)),
      #1a2332;
    border-radius: 12px;
    border: 1px solid rgba(100, 140, 200, 0.25);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5), 0 0 calc(20px * var(--layout-scale, 1)) rgba(80, 120, 180, 0.15);
    z-index: 30;
    animation: slide-up 200ms ease-out;
  }

  /* Landscape quiz panel — slides in from left edge (spec §1 + §5) */
  .card-expanded-landscape {
    position: fixed;
    /* LEFT-aligned: takes ~58% of viewport width */
    left: 0;
    right: auto;
    width: 58vw;
    max-width: 58vw;
    /* Vertically: fill arena above stats bar + card hand */
    top: calc(var(--topbar-height, 4.5vh) + calc(40px * var(--layout-scale, 1)));
    bottom: calc(9vh + calc(16px * var(--layout-scale, 1)));
    /* Two-zone flex layout: question-zone (40%) + answer-zone (60%) */
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    /* isolation: isolate creates a containing block for absolute children (badge)
       without overriding position: fixed — position: relative would break top/bottom pinning */
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    /* Layout overrides */
    overflow: hidden;
    overflow-x: hidden;
    /* Override portrait transform/centering */
    transform: none;
    margin: 0;
    max-height: none;
    /* Animation: slide from left */
    animation: slide-from-left 200ms ease-out;
    /* Enhanced dark background for landscape quiz panel */
    background:
      linear-gradient(180deg, rgba(12, 16, 28, 1.0) 0%, rgba(8, 11, 20, 1.0) 100%),
      #0a0e1a;
    border-right: 1px solid rgba(100, 140, 200, 0.25);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 0 calc(20px * var(--layout-scale, 1)) rgba(80, 120, 180, 0.15);
  }

  @keyframes slide-from-left {
    from { transform: translateX(-100%); }
    to   { transform: translateX(0); }
  }

  /* Category badge — absolute top-left in landscape so it does not consume flex space */
  .card-expanded-landscape .card-header {
    position: absolute;
    top: calc(12px * var(--layout-scale, 1));
    left: calc(16px * var(--layout-scale, 1));
    right: auto;
    padding: 0;
    min-height: auto;
    z-index: 5;
  }

  .card-expanded-landscape .header-domain {
    font-size: calc(11px * var(--text-scale, 1));
    font-variant: small-caps;
    letter-spacing: 0.1em;
    color: rgba(200, 180, 120, 0.65);
  }

  /* Two-zone layout: question zone takes ~40% flex space in landscape */
  .card-expanded-landscape .question-zone {
    flex: 1 1 40%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
  }

  /* Two-zone layout: answer zone takes ~60% flex space in landscape */
  .card-expanded-landscape .answer-zone {
    flex: 1 1 60%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-height: 0;
    overflow: hidden;
  }

  /* Content-based answer grid layouts (landscape only) */
  .answers-tf-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .answers-two-wide {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .answers-grid-2x2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .answers-single-column {
    display: grid;
    grid-template-columns: 1fr;
    gap: calc(8px * var(--layout-scale, 1));
  }

  /* Answer font reduction when any answer is very long (>80 chars) */
  .answer-font-small .answer-btn {
    font-size: calc(14px * var(--text-scale, 1));
  }

  /* Image question max-height in landscape */
  .card-expanded-landscape .quiz-asset-image {
    max-height: 40vh;
  }

  /* AR-76: Keyboard shortcut badge on answer buttons — gold-toned game style */
  .kbd-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    min-width: calc(20px * var(--layout-scale, 1));
    border-radius: 4px;
    background: rgba(200, 180, 120, 0.2);
    border: 1px solid rgba(200, 180, 120, 0.4);
    font-size: calc(10px * var(--layout-scale, 1));
    font-family: var(--font-rpg);
    color: #c8b478;
    margin-right: calc(10px * var(--layout-scale, 1));
    flex-shrink: 0;
    line-height: 1;
  }

  /* AR-76: Brief keyboard-triggered highlight on answer button */
  .answer-kbd-highlight {
    border-color: #60a5fa !important;
    background: rgba(96, 165, 250, 0.15) !important;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4);
  }

  .card-expanded::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 40px));
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  /* ── Card Frame V2 decorative accent in expanded view ── */
  .expanded-v2-frame {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    border-radius: 12px;
    /* Render at very low opacity — purely decorative accent */
    opacity: 0.12;
  }

  .expanded-banner,
  .expanded-border-accent,
  .expanded-base {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
  }

  .expanded-upgrade-icon {
    position: absolute;
    bottom: 8%;
    left: 4%;
    width: 10%;
    height: auto;
    object-fit: contain;
    animation: upgradeFloat 1.5s ease-in-out infinite;
  }

  @keyframes upgradeFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  .mastery-trial-header {
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    font-size: calc(11px * var(--layout-scale, 1));
    font-weight: 800;
    letter-spacing: 1px;
    background: linear-gradient(90deg, #5b4510, #9f7e1e);
    color: #f4e7b0;
    text-align: center;
  }

  /* ── Domain header: subtle gold text, no colored background bar ── */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    min-height: calc(24px * var(--layout-scale, 1));
    box-sizing: border-box;
  }

  .header-domain {
    font-size: calc(13px * var(--text-scale, 1));
    font-family: var(--font-rpg);
    color: #c8b478;
    display: inline-flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .header-icon {
    font-size: calc(14px * var(--layout-scale, 1));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: calc(4px * var(--layout-scale, 1));
    opacity: 0.7;
  }

  /* In-card settings cogwheel button */
  .card-settings-btn {
    background: #b45309;
    color: #fff;
    border: none;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    line-height: 1;
    z-index: 10;
    box-shadow: 0 calc(1px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.4);
  }

  .card-settings-btn:hover {
    background: #92400e;
  }

  /* Settings modal — centered overlay */
  .settings-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .settings-modal-container {
    background: #1a1a2e;
    border: 1px solid #b45309;
    border-radius: calc(12px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    width: calc(340px * var(--layout-scale, 1));
    max-width: 90vw;
    box-shadow: 0 calc(8px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.8);
  }

  .settings-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: calc(12px * var(--layout-scale, 1));
  }

  .settings-modal-title {
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
  }

  .settings-modal-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: calc(18px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(4px * var(--layout-scale, 1));
    line-height: 1;
  }

  .settings-modal-close:hover {
    color: #e2e8f0;
  }

  .header-type-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }


  /* ── Question text: pixel font, auto-scales by length ── */
  .card-question {
    font-family: var(--font-rpg);
    font-size: calc(14px * var(--text-scale, 1));
    color: #e8edf5;
    line-height: 1.6;
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    text-align: center;
  }

  /* AR-221: Auto-scaling font sizes based on question character count */
  .card-question.quiz-text-short {
    font-size: calc(26px * var(--text-scale, 1));
  }

  .card-question.quiz-text-medium {
    font-size: calc(22px * var(--text-scale, 1));
  }

  .card-question.quiz-text-long {
    font-size: calc(18px * var(--text-scale, 1));
  }

  .card-question.quiz-text-extra-long {
    font-size: calc(16px * var(--text-scale, 1));
  }

  .card-question.quiz-text-max-long {
    font-size: calc(15px * var(--text-scale, 1));
  }

  .card-question.quiz-align-left {
    text-align: left;
  }

  .grammar-blank {
    display: inline-block;
    min-width: calc(60px * var(--layout-scale, 1));
    border-bottom: calc(2px * var(--layout-scale, 1)) solid var(--color-warning, #f0c040);
    margin: 0 calc(2px * var(--layout-scale, 1));
    text-align: center;
    color: var(--color-warning, #f0c040);
    letter-spacing: calc(2px * var(--layout-scale, 1));
    font-weight: bold;
  }

  .grammar-translation {
    color: var(--color-text-dim, #8899aa);
    font-size: calc(13px * var(--text-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
    text-align: center;
    font-style: italic;
    line-height: 1.3;
  }

  .grammar-romaji {
    margin: calc(4px * var(--layout-scale, 1)) 0 0;
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.65);
    text-align: center;
    font-style: italic;
  }

  .grammar-typing-hints {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    margin-bottom: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(78, 205, 196, 0.08);
    border-left: calc(3px * var(--layout-scale, 1)) solid rgba(78, 205, 196, 0.5);
    border-radius: calc(6px * var(--layout-scale, 1));
  }

  .grammar-hint-label {
    margin: 0;
    font-size: calc(14px * var(--text-scale, 1));
    color: #4ecdc4;
    font-weight: 600;
  }

  .grammar-hint-translation {
    margin: 0;
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.75);
    font-style: italic;
  }

  .card-answers {
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  /* ── Answer buttons: dark gradient with gold hover ── */
  .answer-btn {
    min-height: calc(48px * var(--layout-scale, 1));
    width: 100%;
    background: linear-gradient(180deg, rgba(30, 40, 60, 0.95) 0%, rgba(20, 28, 45, 0.98) 100%);
    border: 1.5px solid rgba(150, 160, 180, 0.3);
    border-radius: 6px;
    color: #e2e8f0;
    font-family: var(--font-rpg);
    font-size: calc(18px * var(--text-scale, 1));
    line-height: 1.5;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    text-align: left;
    transition: all 150ms ease;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .answer-btn:hover:not(:disabled) {
    background: linear-gradient(180deg, rgba(40, 55, 80, 0.95) 0%, rgba(30, 42, 65, 0.98) 100%);
    border-color: rgba(200, 180, 120, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .answer-btn.answer-correct {
    border-color: rgba(34, 197, 94, 0.7);
    background: linear-gradient(180deg, rgba(5, 46, 22, 0.97) 0%, rgba(3, 32, 14, 0.99) 100%);
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
  }

  .answer-btn.answer-wrong {
    border-color: rgba(220, 38, 38, 0.7);
    background: linear-gradient(180deg, rgba(63, 18, 23, 0.97) 0%, rgba(45, 12, 16, 0.99) 100%);
  }

  .answer-btn.answer-reveal-correct {
    border-color: rgba(234, 179, 8, 0.8);
    box-shadow: 0 0 10px rgba(234, 179, 8, 0.2), inset 0 0 0 1px rgba(234, 179, 8, 0.4);
  }

  .answer-btn.answer-eliminated {
    opacity: 0.35;
    text-decoration: line-through;
  }

  .speed-bonus-badge {
    position: absolute;
    right: calc(12px * var(--layout-scale, 1));
    top: calc(40px * var(--layout-scale, 1));
    background: #2563eb;
    color: #fff;
    font-family: var(--font-rpg);
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    border-radius: 8px;
    padding: calc(4px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
  }

  /* ── Timer bar: blue gradient ── */
  .timer-bar-container {
    position: relative;
    width: 100%;
    height: calc(4px * var(--layout-scale, 1));
    background: rgba(30, 40, 60, 0.6);
    border-radius: 2px;
    /* overflow: hidden removed so speed-bonus-marker is not clipped */
    overflow: visible;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .timer-bar-fill {
    height: 100%;
    transform-origin: left;
    transform: scaleX(var(--fraction));
    border-radius: 2px;
    will-change: transform;
    transition: transform 100ms linear, background 500ms ease;
  }

  .timer-seconds {
    position: absolute;
    right: calc(8px * var(--layout-scale, 1));
    top: calc(-18px * var(--layout-scale, 1));
    font-family: var(--font-rpg);
    font-size: calc(10px * var(--text-scale, 1));
    color: #94a3b8;
  }

  .question-image-container {
    display: flex;
    justify-content: center;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) 0;
  }

  .question-image {
    max-height: calc(80px * var(--layout-scale, 1));
    max-width: calc(120px * var(--layout-scale, 1));
    object-fit: contain;
    border: 2px solid #334155;
    border-radius: 6px;
    background: #fff;
    padding: calc(4px * var(--layout-scale, 1));
  }

  /* ── Image quiz modes ──────────────────────────────────────────────────── */

  .quiz-asset-image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) 0;
  }

  .quiz-asset-image {
    width: calc(340px * var(--layout-scale, 1));
    height: auto;
    max-height: calc(240px * var(--layout-scale, 1));
    object-fit: contain;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: calc(4px * var(--layout-scale, 1));
    box-shadow: 0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
  }

  .card-answers-image-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
  }

  .answer-image-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(8px * var(--layout-scale, 1));
    border: calc(2px * var(--layout-scale, 1)) solid rgba(150, 160, 180, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    background: linear-gradient(180deg, rgba(30, 40, 60, 0.95) 0%, rgba(20, 28, 45, 0.98) 100%);
    cursor: pointer;
    transition: border-color 0.2s, transform 0.2s;
  }

  .answer-image-btn:hover:not(:disabled) {
    border-color: rgba(200, 180, 120, 0.5);
    transform: translateY(-1px);
  }

  .answer-image-btn .kbd-hint {
    position: absolute;
    top: calc(4px * var(--layout-scale, 1));
    left: calc(4px * var(--layout-scale, 1));
  }

  .answer-flag-img {
    width: 100%;
    height: auto;
    max-height: calc(90px * var(--layout-scale, 1));
    object-fit: contain;
    border-radius: calc(2px * var(--layout-scale, 1));
  }

  .answer-image-label {
    margin-top: calc(4px * var(--layout-scale, 1));
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    font-family: var(--font-rpg);
  }

  .answer-image-btn.answer-correct {
    border-color: rgba(34, 197, 94, 0.7);
    background: linear-gradient(180deg, rgba(5, 46, 22, 0.97) 0%, rgba(3, 32, 14, 0.99) 100%);
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
  }

  .answer-image-btn.answer-wrong {
    border-color: rgba(220, 38, 38, 0.7);
    background: linear-gradient(180deg, rgba(63, 18, 23, 0.97) 0%, rgba(45, 12, 16, 0.99) 100%);
  }

  .answer-image-btn.answer-reveal-correct {
    border-color: rgba(234, 179, 8, 0.8);
    box-shadow: 0 0 10px rgba(234, 179, 8, 0.2), inset 0 0 0 1px rgba(234, 179, 8, 0.4);
  }

  .answer-image-btn.answer-eliminated {
    opacity: 0.35;
  }

  /* §1 Quiz Result overlay — landscape only, flashes over the quiz panel */
  .quiz-result-overlay {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--layout-scale, 1));
    pointer-events: none;
    z-index: 10;
    animation: quiz-result-flash 300ms ease-out forwards;
  }

  .quiz-result-correct {
    background: rgba(34, 197, 94, 0.14);
    border: 2px solid rgba(34, 197, 94, 0.4);
  }

  .quiz-result-wrong {
    background: rgba(239, 68, 68, 0.13);
    border: 2px solid rgba(239, 68, 68, 0.4);
  }

  .quiz-result-text {
    font-size: 2.8rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
  }

  .quiz-result-correct .quiz-result-text {
    color: #4ade80;
  }

  .quiz-result-wrong .quiz-result-text {
    color: #f87171;
  }

  .quiz-result-correct-answer {
    font-size: 1rem;
    font-weight: 600;
    color: #e2e8f0;
    background: rgba(0, 0, 0, 0.45);
    padding: 4px 12px;
    border-radius: 6px;
    text-align: center;
    max-width: 80%;
  }

  @keyframes quiz-result-flash {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* Grammar note panel shown on wrong answers for language/grammar facts */
  .grammar-note {
    margin-top: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(10, 8, 20, 0.85);
    border-left: calc(3px * var(--layout-scale, 1)) solid #4ecdc4;
    border-radius: calc(6px * var(--layout-scale, 1));
  }

  .grammar-note-header {
    display: block;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    color: #ffffff;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .grammar-note-text {
    font-size: calc(13px * var(--text-scale, 1));
    line-height: 1.4;
    color: #e0e0e0;
    margin: 0;
  }

  /* Sub-step 1: "Got it" confirmation button after wrong answer */
  .got-it-btn {
    display: block;
    width: calc(100% - 24px * var(--layout-scale, 1));
    min-height: calc(48px * var(--layout-scale, 1));
    margin: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: linear-gradient(180deg, rgba(30, 50, 80, 0.95) 0%, rgba(20, 35, 60, 0.98) 100%);
    border: 1.5px solid rgba(100, 140, 220, 0.5);
    border-radius: 8px;
    color: #93c5fd;
    font-family: var(--font-rpg);
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    text-align: center;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.15);
  }

  .got-it-btn:hover {
    background: linear-gradient(180deg, rgba(40, 65, 100, 0.95) 0%, rgba(28, 48, 80, 0.98) 100%);
    border-color: rgba(100, 140, 220, 0.8);
    box-shadow: 0 0 14px rgba(96, 165, 250, 0.3);
  }

  .got-it-btn:active {
    transform: scale(0.98);
  }

  /* Sub-step 7: "Speed Bonus lost!" label shown when timer expires */
  .timer-expired-label {
    text-align: center;
    color: #94a3b8;
    font-family: var(--font-rpg);
    font-size: calc(8px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    animation: fade-in-out 2s ease forwards;
  }

  @keyframes fade-in-out {
    0%   { opacity: 0; }
    15%  { opacity: 1; }
    75%  { opacity: 1; }
    100% { opacity: 0; }
  }

  /* Sub-step 8: gold speed bonus threshold marker on timer bar */
  .speed-bonus-marker {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: #D4AF37;
    border-radius: 1px;
    pointer-events: none;
    z-index: 1;
  }
  /* --- Chess puzzle container --- */
  .chess-puzzle-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
    max-height: 100%;
    padding: calc(4px * var(--layout-scale, 1));
  }

  .chess-puzzle-error {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1;
    background: rgba(220, 38, 38, 0.1);
    border: calc(2px * var(--layout-scale, 1)) solid rgba(220, 38, 38, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #ef4444;
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 600;
  }

  .chess-solution-display {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 600;
  }

  .chess-solution-label {
    color: var(--text-muted, #94a3b8);
  }

  .chess-solution-move {
    color: var(--text-primary, #e2e8f0);
    font-family: monospace;
    font-size: calc(18px * var(--text-scale, 1));
  }

  /* Elo rating change badge shown after chess puzzle answer */
  .elo-change-badge {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    margin-top: calc(6px * var(--layout-scale, 1));
    animation: elo-float 1.5s ease-out forwards;
  }

  .elo-positive {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.15);
  }

  .elo-negative {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }

  @keyframes elo-float {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(calc(-20px * var(--layout-scale, 1))); }
  }

  /* Multi-move puzzle progress indicator */
  .chess-move-progress {
    font-size: calc(13px * var(--text-scale, 1));
    color: var(--text-muted, #94a3b8);
    text-align: center;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  /* Setup animation label shown while opponent's opening move plays */
  .chess-setup-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: var(--text-muted, #94a3b8);
    text-align: center;
    font-style: italic;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  /* Map pin drop quiz container */
  .map-pin-quiz-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 1;
    min-height: calc(300px * var(--layout-scale, 1));
    position: relative;
  }

</style>

import { get } from 'svelte/store'
import { gaiaMessage, gaiaExpression, gaiaThoughtBubble, type DiveResults } from '../../ui/stores/gameState'
import { playerSave, persistPlayer, getDueReviews, addMinerals } from '../../ui/stores/playerData'
import { gaiaMood, gaiaChattiness } from '../../ui/stores/settings'
import { getGaiaLine, GAIA_TRIGGERS, BIOME_TEASER_CATEGORY } from '../../data/gaiaDialogue'
import { getGaiaExpression } from '../../data/gaiaAvatar'
import { getMasteryLevel, isDue } from '../../services/sm2'
import { factsDB } from '../../services/factsDB'
import { PREMIUM_MATERIALS, type PremiumMaterial } from '../../data/premiumRecipes'
import { getEffectiveArchetype, ARCHETYPE_GAIA_EMPHASIS } from '../../services/archetypeDetector'
import { deriveJourneyMemoryVars } from '../../services/journeyMemory'

/** Tutorial-specific GAIA dialogue lines (Phase 14). Verbatim — do not paraphrase. */
const TUTORIAL_GAIA_LINES: Record<string, string> = {
  artifact_found: "An artifact! Quick — bring it back to my terminal at the dome. I need to analyze it.",
  fossil_found: "Wait. That's a fossil node. Something is preserved in there. Intact. This is... this is significant. Collect it. Carefully.",
  quiz_gate_first: "A Quiz Gate. I've locked this area with a knowledge challenge. Answer correctly to pass. Wrong answers cost oxygen — so think before you tap.",
  earthquake_warning: "WARNING — ground instability detected. This is an EARTHQUAKE ZONE. When you feel the screen shake — that's your warning. Move away before the collapse. You have moves to react. Use them.",
  earthquake_after_safe: "Good instincts. Earthquakes always give you warning moves. Remember: count your steps, don't panic.",
  earthquake_after_hurt: "Earthquakes give you warning moves to escape. You'll need to use them next time. The deeper you go, the more frequent they become.",
  oxygen_low_first: "Oxygen at 30%. Time to consider heading back. The exit ladder is always available — surface before you're forced to.",
  first_depletion_rescue: "Emergency oxygen protocol activated. You won't lose anything this time. Learn the Send-Up Stations for next time.",
  tutorial_dive_complete: "That was your first dive. Bring those artifacts to my terminal — let's see what we've got.",
  fossil_first_reveal: "Wait. I'm analyzing the fossil fragment you brought back. This is... a trilobite. Arthropod. 520 million years old. They dominated the seas for 270 million years before the extinction event. We have enough genetic data to start reconstruction. Learn 10 facts about the Cambrian period and I can bring it back to life.",
}

/**
 * Manages GAIA (ship AI) commentary and premium material awards.
 * Extracted from GameManager to keep GAIA logic self-contained.
 */
export class GaiaManager {
  /** Tracks whether a low-oxygen warning has already been issued this dive. */
  gaiaLowO2Warned = false

  /** Tracks whether the return-engagement greeting has already fired this session. */
  private sessionReturnFired = false

  /** Tracks per-fact wrong answer counts within the current session for failure escalation. */
  private sessionWrongCounts: Map<string, number> = new Map()

  constructor() {
    // Listen for fact mastery events dispatched by playerData.updateReviewState()
    document.addEventListener('game:fact-mastered', (e: Event) => {
      const detail = (e as CustomEvent<{ factId: string; masteryNumber: number }>).detail
      const fact = factsDB.getById(detail.factId)
      if (fact) {
        this.fireMasteryCelebration(
          detail.factId,
          fact.statement.slice(0, 50),
          detail.masteryNumber,
        )
      }
    })
  }

  // =========================================================
  // Phase 15.5 — Return Engagement Hooks
  // =========================================================

  /**
   * Fire a contextual GAIA greeting when the player opens or returns to the app.
   * Fires at most once per session (guarded by `sessionReturnFired`).
   *
   * Priority order:
   *   1. Streak urgency  — streak > 0, not dived today, < 4 hours until day end
   *   2. Overdue reviews — 5+ facts are currently due
   *   3. Multi-day gap   — 2+ full days away
   *   4. Next-day return — 6+ hours away (but < 2 days)
   *   5. Same-day        — any other return
   *
   * Should be called from HubView's onMount, before the idle bubble timer starts.
   */
  fireReturnEngagement(): void {
    if (this.sessionReturnFired) return
    this.sessionReturnFired = true

    const mood = get(gaiaMood)
    const save = get(playerSave)

    // Compute time-away metrics from lastPlayedAt.
    const now = Date.now()
    const lastPlayedAt: number = save?.lastPlayedAt ?? now
    const msAway = Math.max(0, now - lastPlayedAt)
    const hoursAway = msAway / (1000 * 60 * 60)
    const daysAway = Math.floor(hoursAway / 24)

    // Streak data
    const currentStreak: number = save?.stats.currentStreak ?? 0
    const lastDiveDate: string | undefined = save?.lastDiveDate
    const today = new Date().toISOString().split('T')[0]

    // Hours until the current calendar day ends (for streak urgency).
    const todayEnd = new Date(today)
    todayEnd.setDate(todayEnd.getDate() + 1)
    const msUntilDayEnd = todayEnd.getTime() - now
    const hoursUntilStreakEnd = Math.floor(msUntilDayEnd / (1000 * 60 * 60))

    // Count overdue review states.
    const reviewStates = save?.reviewStates ?? []
    const overdueCount = reviewStates.filter(rs => isDue(rs)).length

    // Helper: derive time-of-day label.
    const hour = new Date().getHours()
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

    // --- Priority 1: Streak urgency ---
    if (currentStreak > 0 && lastDiveDate !== today && hoursUntilStreakEnd < 4) {
      const text = getGaiaLine('returnStreakUrgency', mood, {
        hoursUntilStreakEnd,
        currentStreak,
      })
      const expr = getGaiaExpression('returnStreakUrgency', mood)
      gaiaExpression.set('worried')
      gaiaMessage.set(text)
      void expr  // expression context available but we override to 'worried'
      return
    }

    // --- Priority 2: Overdue reviews ---
    if (overdueCount >= 5) {
      const text = getGaiaLine('returnOverdueReviews', mood, { overdueCount })
      gaiaExpression.set('thinking')
      gaiaMessage.set(text)
      return
    }

    // --- Priority 3: Multi-day gap ---
    if (daysAway >= 2) {
      const text = getGaiaLine('returnMultiDay', mood, { daysAway, overdueCount })
      gaiaExpression.set('surprised')
      gaiaMessage.set(text)
      return
    }

    // --- Priority 4: Next-day return (6+ hours away) ---
    if (hoursAway >= 6) {
      const text = getGaiaLine('returnNextDay', mood, { timeOfDay, currentStreak })
      gaiaExpression.set('happy')
      gaiaMessage.set(text)
      return
    }

    // --- Priority 5: Same-day return ---
    const text = getGaiaLine('returnSameDay', mood)
    gaiaExpression.set('neutral')
    gaiaMessage.set(text)
  }

  // =========================================================
  // Phase 15.2 — Idle Thought Bubble System
  // =========================================================

  /** Active timeout handle for the next scheduled bubble. */
  private bubbleTimer: ReturnType<typeof setInterval> | null = null

  /** Minimum interval between bubbles in milliseconds (chattiness 10). */
  private readonly bubbleMinInterval = 30_000

  /** Maximum interval between bubbles in milliseconds (chattiness 1). */
  private readonly bubbleMaxInterval = 60_000

  /**
   * Start the idle thought bubble timer for the dome/base view.
   * Clears any existing timer before scheduling the first bubble.
   * Should be called when HubView mounts.
   */
  startIdleBubbleTimer(): void {
    this.stopIdleBubbleTimer()
    this.scheduleNextBubble()
  }

  /**
   * Stop the idle thought bubble timer.
   * Clears the current timeout handle and sets it to null.
   * Should be called when HubView unmounts.
   */
  stopIdleBubbleTimer(): void {
    if (this.bubbleTimer !== null) {
      clearTimeout(this.bubbleTimer)
      this.bubbleTimer = null
    }
  }

  /**
   * Schedule the next idle thought bubble, scaling the delay inversely with
   * the player's chattiness setting (0–10).
   *
   * Chattiness 0  → no bubbles at all (returns early).
   * Chattiness 10 → fires at the minimum interval (30 s).
   * Intermediate  → linearly interpolated between min and max.
   */
  private scheduleNextBubble(): void {
    const chattiness = get(gaiaChattiness)
    if (chattiness <= 0) return

    // Linearly scale: chattiness 10 → minInterval, chattiness 1 → maxInterval
    const fraction = (chattiness - 1) / 9  // 0.0 … 1.0
    const delay = Math.round(
      this.bubbleMaxInterval - fraction * (this.bubbleMaxInterval - this.bubbleMinInterval)
    )

    this.bubbleTimer = setTimeout(() => {
      this.emitThoughtBubble()
      this.scheduleNextBubble()
    }, delay)
  }

  /**
   * Determine and emit the next thought bubble.
   *
   * Priority order:
   *   1. 30 % chance: study_due (if any facts are due within 48 hours)
   *   2. 25 % chance: near_mastery (if any facts are in 'known' tier with interval >= 20)
   *   3. Default: idle quip from idleThoughtBubble pool
   */
  emitThoughtBubble(): void {
    const mood = get(gaiaMood)
    const MS_48H = 48 * 60 * 60 * 1000

    // --- Candidate: study_due ---
    if (Math.random() < 0.30) {
      const dueReviews = getDueReviews()
      const upcoming = dueReviews.filter(rs => rs.nextReviewAt <= Date.now() + MS_48H)
      if (upcoming.length > 0) {
        const rs = upcoming[Math.floor(Math.random() * upcoming.length)]
        const fact = factsDB.getById(rs.factId)
        if (fact) {
          const msUntil = rs.nextReviewAt - Date.now()
          const dueIn = msUntil <= 0
            ? 'now'
            : msUntil < 60 * 60 * 1000
              ? 'soon'
              : 'in a few hours'

          const text = getGaiaLine('studySuggestionDue', mood, {
            factStatement: this.truncate(fact.statement, 50),
            dueIn,
          })

          const expr = getGaiaExpression('idle', mood)
          gaiaThoughtBubble.set({
            text,
            expressionId: expr.id,
            action: 'study_due',
            actionData: rs.factId,
          })
          return
        }
      }
    }

    // --- Candidate: near_mastery ---
    if (Math.random() < 0.25) {
      const save = get(playerSave)
      if (save) {
        const nearMastery = save.reviewStates.filter(rs => {
          const level = getMasteryLevel(rs)
          return level === 'known' && rs.interval >= 20
        })
        if (nearMastery.length > 0) {
          const rs = nearMastery[Math.floor(Math.random() * nearMastery.length)]
          const fact = factsDB.getById(rs.factId)
          if (fact) {
            // Estimate reviews remaining: mastery threshold is ~60 days for general facts.
            // Rough heuristic: how many more SM-2 cycles until interval >= 60.
            const reviewsLeft = Math.max(1, Math.ceil(Math.log(60 / rs.interval) / Math.log(rs.easeFactor)))
            const plural = reviewsLeft === 1 ? '' : 's'

            const text = getGaiaLine('studySuggestionNearMastery', mood, {
              factStatement: this.truncate(fact.statement, 50),
              reviewsLeft,
              plural,
            })

            const expr = getGaiaExpression('idle', mood)
            gaiaThoughtBubble.set({
              text,
              expressionId: expr.id,
              action: 'study_near_mastery',
              actionData: rs.factId,
            })
            return
          }
        }
      }
    }

    // --- Default: idle quip ---
    const text = getGaiaLine('idleThoughtBubble', mood)
    const expr = getGaiaExpression('idle', mood)
    gaiaThoughtBubble.set({
      text,
      expressionId: expr.id,
      action: 'dismiss',
    })
  }

  /**
   * Truncates a string to a maximum character length, appending '…' if cut.
   */
  private truncate(s: string, max: number): string {
    return s.length <= max ? s : s.slice(0, max - 1) + '…'
  }

  /**
   * Pick a random line and push it to the gaiaMessage store,
   * subject to the player's chattiness setting.
   * Level 10 = always speaks; level 0 = never; intermediate = proportional probability.
   * The toast UI will display and auto-dismiss it.
   */
  randomGaia(lines: string[], trigger = 'idle'): void {
    const chattiness = get(gaiaChattiness)
    if (Math.random() * 10 >= chattiness) return
    const msg = lines[Math.floor(Math.random() * lines.length)]
    const mood = get(gaiaMood)
    const expr = getGaiaExpression(trigger, mood)
    gaiaExpression.set(expr.id)
    gaiaMessage.set(msg)
  }

  /**
   * Emit a mood-aware GAIA line for the given named trigger, respecting chattiness.
   * Also updates the gaiaExpression store so the toast and avatar reflect context.
   */
  triggerGaia(trigger: keyof typeof GAIA_TRIGGERS): void {
    const chattiness = get(gaiaChattiness)
    if (Math.random() * 10 >= chattiness) return
    const mood = get(gaiaMood)
    const text = getGaiaLine(trigger, mood)
    const expr = getGaiaExpression(trigger, mood)
    gaiaExpression.set(expr.id)
    gaiaMessage.set(text)
  }

  /**
   * Returns a short archetype-themed prefix for GAIA commentary.
   * Returns empty string if archetype is undetected.
   */
  getArchetypePrefix(): string {
    const save = get(playerSave)
    if (!save?.archetypeData) return ''
    const archetype = getEffectiveArchetype(save.archetypeData)
    if (archetype === 'undetected') return ''
    const emphasis = ARCHETYPE_GAIA_EMPHASIS[archetype]
    const prefixes: Record<string, string[]> = {
      discovery: ['Explorer\'s log: ', 'New territory! ', 'Chart this: '],
      mastery: ['Scholar\'s note: ', 'Study tip: ', 'Knowledge check: '],
      completionist: ['Collection update: ', 'Catalog entry: ', 'Archive: '],
      streak: ['Speed run! ', 'Quick note: ', 'On the move: '],
      neutral: [''],
    }
    const options = prefixes[emphasis] ?? ['']
    return options[Math.floor(Math.random() * options.length)]
  }

  /**
   * Emits a GAIA line with optional archetype-themed prefix, respecting chattiness.
   * Used for general commentary where archetype flavor adds personality.
   */
  archetypeGaia(lines: string[], trigger = 'idle'): void {
    const chattiness = get(gaiaChattiness)
    if (Math.random() * 10 >= chattiness) return
    const prefix = this.getArchetypePrefix()
    const msg = lines[Math.floor(Math.random() * lines.length)]
    const mood = get(gaiaMood)
    const expr = getGaiaExpression(trigger, mood)
    gaiaExpression.set(expr.id)
    gaiaMessage.set(prefix + msg)
  }

  /**
   * Capitalise the first character of a string.
   * Used to derive pool keys such as `petCommentaryTrilobite` from species IDs.
   */
  private capitalise(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  /**
   * Fire a mood-aware GAIA pet commentary line and set the avatar expression to 'happy'.
   *
   * For non-passive contexts (eating / sleeping / playing), the matching trigger pool is
   * used directly.  For the 'passive' context the method first looks for a species-specific
   * pool (`petCommentary<Species>`) and falls back to `petCommentaryGeneric` when the
   * species has no dedicated lines.
   *
   * NOTE: the idle-bubble rotation system (emitThoughtBubble, added in Phase 15.2) can
   * call this method with context 'passive' to include pet commentary in the ambient cycle.
   *
   * @param speciesId - The fossil pet species identifier (e.g. 'trilobite', 'mammoth').
   * @param context   - The situation triggering the comment.
   */
  firePetCommentary(speciesId: string, context: 'passive' | 'eating' | 'sleeping' | 'playing'): void {
    const mood = get(gaiaMood)

    let trigger: keyof typeof GAIA_TRIGGERS

    if (context === 'eating') {
      trigger = 'petEating'
    } else if (context === 'sleeping') {
      trigger = 'petSleeping'
    } else if (context === 'playing') {
      trigger = 'petPlaying'
    } else {
      // Passive context: prefer species-specific pool, fall back to generic.
      const speciesKey = `petCommentary${this.capitalise(speciesId)}` as keyof typeof GAIA_TRIGGERS
      trigger = speciesKey in GAIA_TRIGGERS ? speciesKey : 'petCommentaryGeneric'
    }

    const text = getGaiaLine(trigger, mood)
    gaiaExpression.set('happy')
    gaiaMessage.set(text)
  }

  /**
   * Fire contextual GAIA commentary when the player returns from a dive.
   *
   * Sequence:
   *   1. Immediately: depth-bracket reaction line (shallow / generic / deep).
   *   2. After 5 s: biome-specific line (if a matching pool exists for the biome).
   *   3. After biome line + 5.5 s: 20% chance biome-category teaser.
   *   4. After 3.5 s (parallel to step 2): 15% chance free-dust gift.
   *
   * Also persists `lastDiveBiome` to the player save.
   *
   * @param results    - Summary data from the completed dive.
   * @param biomeId    - Biome ID of the last visited layer in the dive.
   */
  firePostDiveReaction(results: DiveResults, biomeId: string): void {
    const mood = get(gaiaMood)
    const save = get(playerSave)

    // Persist the last dive biome for future reference.
    if (save) {
      playerSave.update(s => s ? { ...s, lastDiveBiome: biomeId } : s)
      persistPlayer()
    }

    const totalDives = (save?.stats.totalDivesCompleted ?? 0)
    const depth = results.maxDepth
    const artifacts = results.artifactsFound
    const blocks = results.blocksMined
    const dust = results.dustCollected

    const vars: Record<string, string | number> = {
      depth,
      layer: depth,  // alias for templates that prefer {{layer}}
      artifacts,
      blocks,
      dust,
      dives: totalDives,
    }

    // Step 1: Depth-bracket line.
    let depthTrigger: keyof typeof GAIA_TRIGGERS
    if (depth < 30) {
      depthTrigger = 'postDiveShallow'
    } else if (depth >= 75) {
      depthTrigger = 'postDiveDeep'
    } else {
      depthTrigger = 'postDiveReaction'
    }

    const depthText = getGaiaLine(depthTrigger, mood, vars)
    const depthExpr = getGaiaExpression(depthTrigger, mood)
    gaiaExpression.set(depthExpr.id)
    gaiaMessage.set(depthText)

    // Step 2: Biome-specific line after 5 s.
    // Derive the biome type group key from the biome ID for pool lookup.
    // Maps e.g. 'limestone_caves' → 'sedimentary', 'magma_shelf' → 'volcanic', etc.
    const getBiomeGroup = (id: string): string | null => {
      if (['limestone_caves', 'clay_basin', 'iron_seam', 'basalt_maze', 'coal_veins',
           'obsidian_rift', 'salt_flats', 'sandstone_arch', 'shale_corridors'].includes(id)) {
        return 'sedimentary'
      }
      if (['magma_shelf', 'sulfur_springs'].includes(id)) {
        return 'volcanic'
      }
      if (['crystal_geode', 'quartz_halls'].includes(id)) {
        return 'crystalline'
      }
      return null
    }

    const biomeGroup = getBiomeGroup(biomeId)
    const biomeTrigger = biomeGroup
      ? (`postDiveBiome_${biomeGroup}` as keyof typeof GAIA_TRIGGERS)
      : null

    if (biomeTrigger && biomeTrigger in GAIA_TRIGGERS) {
      setTimeout(() => {
        const biomeText = getGaiaLine(biomeTrigger, mood, vars)
        const biomeExpr = getGaiaExpression('dive_return', mood)
        gaiaExpression.set(biomeExpr.id)
        gaiaMessage.set(biomeText)

        // Step 3: Biome category teaser after biome line + 5.5 s (20% chance).
        setTimeout(() => {
          if (Math.random() < 0.20) {
            const category = BIOME_TEASER_CATEGORY[biomeId] ?? BIOME_TEASER_CATEGORY[biomeGroup ?? ''] ?? 'Earth Science'
            const teaserText = getGaiaLine('postDiveBiomeTeaser', mood, { category })
            const teaserExpr = getGaiaExpression('postDiveBiomeTeaser', mood)
            gaiaExpression.set(teaserExpr.id)
            gaiaMessage.set(teaserText)
          }
        }, 5500)
      }, 5000)
    }

    // Step 4: 15% chance free-dust gift after 3.5 s.
    setTimeout(() => {
      if (Math.random() < 0.15) {
        const giftAmount = Math.floor(Math.random() * 11) + 5  // 5–15 inclusive
        addMinerals('dust', giftAmount)
        persistPlayer()
        const giftText = getGaiaLine('postDiveFreeGift', mood, { giftAmount })
        const giftExpr = getGaiaExpression('postDiveFreeGift', mood)
        gaiaExpression.set(giftExpr.id)
        gaiaMessage.set(giftText)
      }
    }, 3500)
  }

  // =========================================================
  // Phase 15.6 — Teaching Behaviors
  // =========================================================

  /**
   * Clears the per-fact wrong answer count map at the start of a new dive or session.
   * Call this whenever a fresh dive begins so escalation levels reset.
   */
  resetSessionWrongCounts(): void {
    this.sessionWrongCounts.clear()
  }

  /**
   * Fire a failure-escalation GAIA line based on how many times the player has
   * missed this specific fact in the current session.
   *
   * Count 1-2: failureEscalation1 (expression: 'thinking')
   * Count 3-4: failureEscalation2 (expression: 'thinking')
   * Count 5+:  failureEscalation3 (expression: 'worried')
   *
   * @param factId      - The fact the player just got wrong.
   * @param explanation - Explanation text to inject into the template (truncated to 100 chars).
   */
  fireFailureEscalation(factId: string, explanation: string): void {
    const count = (this.sessionWrongCounts.get(factId) ?? 0) + 1
    this.sessionWrongCounts.set(factId, count)

    const mood = get(gaiaMood)
    const truncated = explanation.length > 100 ? explanation.slice(0, 99) + '…' : explanation

    let trigger: keyof typeof GAIA_TRIGGERS
    let expressionId: string

    if (count <= 2) {
      trigger = 'failureEscalation1'
      expressionId = 'thinking'
    } else if (count <= 4) {
      trigger = 'failureEscalation2'
      expressionId = 'thinking'
    } else {
      trigger = 'failureEscalation3'
      expressionId = 'worried'
    }

    const text = getGaiaLine(trigger, mood, { explanation: truncated })
    gaiaExpression.set(expressionId)
    gaiaMessage.set(text)
  }

  /**
   * Fire a mastery celebration GAIA line when a fact crosses the mastery threshold.
   * Also dispatches DOM events so other systems can react.
   *
   * #1:     masteryFirst — expression 'excited', dispatches 'gaia:mastery-first'
   * #2-9:   masteryEarly — expression 'happy'
   * #10-24: masteryRegular — expression 'happy'
   * #25+:   masteryMajor — expression 'excited', dispatches 'gaia:mastery-major'
   *
   * @param factId        - The fact that was just mastered.
   * @param factStatement - Short statement text (pre-truncated to ~50 chars).
   * @param masteryNumber - The player's total count of mastered facts after this one.
   */
  fireMasteryCelebration(factId: string, factStatement: string, masteryNumber: number): void {
    const mood = get(gaiaMood)

    let trigger: keyof typeof GAIA_TRIGGERS
    let expressionId: string

    if (masteryNumber === 1) {
      trigger = 'masteryFirst'
      expressionId = 'excited'
      document.dispatchEvent(new CustomEvent('gaia:mastery-first', { detail: { factId } }))
    } else if (masteryNumber <= 9) {
      trigger = 'masteryEarly'
      expressionId = 'happy'
    } else if (masteryNumber <= 24) {
      trigger = 'masteryRegular'
      expressionId = 'happy'
    } else {
      trigger = 'masteryMajor'
      expressionId = 'excited'
      document.dispatchEvent(new CustomEvent('gaia:mastery-major', { detail: { factId, masteryNumber } }))
    }

    const text = getGaiaLine(trigger, mood, { factStatement, masteryNumber })
    gaiaExpression.set(expressionId)
    gaiaMessage.set(text)
  }

  /**
   * Fire a category-completion GAIA line when all facts in a category are mastered.
   * Dispatches 'gaia:category-complete' on the document.
   *
   * @param categoryName - Human-readable category name (e.g. 'Geology').
   * @param factCount    - Total facts in the completed category.
   */
  fireCategoryComplete(categoryName: string, factCount: number): void {
    const mood = get(gaiaMood)
    const text = getGaiaLine('categoryComplete', mood, { categoryName, factCount })
    gaiaExpression.set('excited')
    gaiaMessage.set(text)
    document.dispatchEvent(new CustomEvent('gaia:category-complete', { detail: { categoryName, factCount } }))
  }

  /**
   * Awards one unit of the given premium material to the player's save and shows a
   * GAIA toast. Premium materials are rare in-game drops — never sold for real money.
   *
   * @param materialId - The premium material to award.
   */
  awardPremiumMaterial(materialId: PremiumMaterial): void {
    const meta = PREMIUM_MATERIALS.find(m => m.id === materialId)
    if (!meta) return

    playerSave.update(s => {
      if (!s) return s
      const current = (s.premiumMaterials ?? {})[materialId] ?? 0
      return {
        ...s,
        premiumMaterials: {
          ...(s.premiumMaterials ?? {}),
          [materialId]: current + 1,
        },
      }
    })
    persistPlayer()

    // Always show a GAIA toast for premium drops — they are rare enough to be noteworthy.
    gaiaMessage.set(`${meta.icon} Rare find! ${meta.name}!`)
    setTimeout(() => gaiaMessage.set(null), 4000)
  }

  // =========================================================
  // Phase 15.4 — Journey Memory System
  // =========================================================

  /**
   * Fire a GAIA line that references the player's actual learning history.
   * Selects one of six memory trigger pools at random and populates
   * {{variable}} placeholders with live data from the player save.
   *
   * No-ops when the player has fewer than 5 learned facts (insufficient history).
   */
  fireJourneyMemory(): void {
    const save = get(playerSave)
    if (!save || save.learnedFacts.length < 5) return

    const vars = deriveJourneyMemoryVars(save)
    if (!vars) return

    const mood = get(gaiaMood)
    const triggerPool = [
      'memoryFactSpecific',
      'memoryCategory',
      'memoryMilestone',
      'memoryStreak',
      'memoryFavoriteCategory',
      'memoryTotalFacts',
    ] as const

    const trigger = triggerPool[Math.floor(Math.random() * triggerPool.length)]
    const text = getGaiaLine(trigger, mood, vars as unknown as Record<string, string | number>)
    const expr = getGaiaExpression('memory', mood)
    gaiaExpression.set(expr.id)
    gaiaMessage.set(text)
  }

  // =========================================================
  // Phase 14 — Tutorial Dialogue & Progressive Unlocks
  // =========================================================

  /**
   * Returns a tutorial-specific GAIA line by key.
   * Shows the line as a GAIA toast message.
   */
  tutorialGaiaLine(key: string): void {
    const line = TUTORIAL_GAIA_LINES[key]
    if (line) {
      gaiaMessage.set(line)
      // Tutorial messages stay longer (8s)
      setTimeout(() => gaiaMessage.set(null), 8000)
    }
  }

  /**
   * Returns a GAIA narration line for progressive system unlocks, or null if no unlock fires.
   * Called once per dive completion, keyed on diveCount (the count AFTER the completed dive).
   */
  postDiveProgressiveUnlock(diveCount: number): { message: string; highlightTarget: string } | null {
    switch (diveCount) {
      case 2:
        return {
          message: "Your first fact is in my database now. Come — I want to show you the Knowledge Tree. It grows every time you learn something new.",
          highlightTarget: 'knowledgeTree',
        }
      case 3:
        return {
          message: "You have facts in rotation now. Some are due for review. The study session will help you lock them in — and every review earns you bonus oxygen.",
          highlightTarget: 'studySession',
        }
      case 4:
        return {
          message: "I found a recipe fragment in your last dive. The Materializer can combine your minerals into something more powerful. Let me show you.",
          highlightTarget: 'materializer',
        }
      default:
        return null
    }
  }
}

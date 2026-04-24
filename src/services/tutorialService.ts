/**
 * Tutorial orchestration service.
 *
 * Manages the reactive tutorial overlay lifecycle: which step is active, when to
 * advance, when to dismiss, and how to integrate with the existing onboarding flags.
 *
 * Usage pattern:
 *   - Call startTutorial(mode) when entering combat or study temple for the first time.
 *   - In a Svelte $effect, build a TutorialContext from live state and call evaluateTutorialStep(ctx).
 *   - The exported stores reflect current display state — bind the UI overlay to these.
 *   - The UI calls advanceStep() when the player clicks "Got it".
 *   - The UI calls skipTutorial() when the player clicks "Skip Tutorial".
 *
 * Stores are intentionally defined here (not in a separate tutorialStore.ts) because
 * the store values and mutation logic are tightly coupled — separating them would require
 * import cycles or overly broad shared state.
 *
 * Step evaluation uses a sequential cursor (stepCursor) rather than a free scan.
 * Proactive steps fire immediately when the cursor reaches them (getMessage null = skip).
 * Reactive steps pause the cursor until showWhen becomes true.
 */

import { writable, get } from 'svelte/store'
import {
  markCombatTutorialSeen,
  markStudyTutorialSeen,
  markTutorialDismissedEarly,
  markOnboardingTooltipSeen,
} from './cardPreferences'
import {
  COMBAT_TUTORIAL_STEPS,
  STUDY_TUTORIAL_STEPS,
  type TutorialMode,
  type TutorialContext,
  type TutorialStep,
  type TutorialAnchor,
} from '../data/tutorialSteps'

// ---------------------------------------------------------------------------
// Exported stores — consumed by TutorialOverlay.svelte (ui-agent territory)
// ---------------------------------------------------------------------------

/** Whether any tutorial is currently active. */
export const tutorialActive = writable<boolean>(false)

/** Which tutorial mode is running, or null when idle. */
export const tutorialMode = writable<TutorialMode | null>(null)

/** The id of the currently displayed step, or null when no step is showing. */
export const tutorialStepId = writable<string | null>(null)

/** The text to display in the tooltip bubble. null means nothing to show. */
export const tutorialMessage = writable<string | null>(null)

/** Anchor information for positioning the tooltip bubble. */
export const tutorialAnchor = writable<TutorialAnchor | null>(null)

/** Whether the current step requests a spotlight (background dim behind anchor). */
export const tutorialSpotlight = writable<boolean>(false)

/** Whether the current step blocks game input (proactive + spotlight or blockInput). */
export const tutorialBlocksInput = writable<boolean>(false)

/**
 * Increments on every step advance — UI tracks this to re-trigger evaluation.
 * Fixes the proactive-step chaining issue where the $effect in CardCombatOverlay
 * wouldn't re-run after "Got it" because no game-state store changed.
 */
export const tutorialEvalTrigger = writable<number>(0)

// ---------------------------------------------------------------------------
// Internal state — not exported; mutated only by this module
// ---------------------------------------------------------------------------

/** Steps that have been shown and dismissed (by doneWhen or advanceStep). */
let completedSteps = new Set<string>()

/** The step currently displayed, or null when idle between steps. */
let currentStep: TutorialStep | null = null

/** Timestamp (performance.now()) when the current step started displaying. */
let currentStepStartTime = 0

/** Handle for the maxDisplayMs auto-dismiss timer. */
let maxDisplayTimer: ReturnType<typeof setTimeout> | null = null

/** Index into the steps array — the next step to evaluate. */
let stepCursor = 0

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clearMaxDisplayTimer(): void {
  if (maxDisplayTimer !== null) {
    clearTimeout(maxDisplayTimer)
    maxDisplayTimer = null
  }
}

function getStepsForMode(mode: TutorialMode): TutorialStep[] {
  return mode === 'combat' ? COMBAT_TUTORIAL_STEPS : STUDY_TUTORIAL_STEPS
}

/**
 * When a tutorial step is completed, cross-mark the related onboarding tooltip flag
 * so the legacy tooltip system doesn't re-show the same guidance.
 */
function markRelatedTooltips(stepId: string): void {
  switch (stepId) {
    case 'tap_card_prompt':
    case 'hand_intro':
      markOnboardingTooltipSeen('hasSeenCardTapTooltip')
      break
    case 'card_selected':
    case 'card_selected_qp':
      markOnboardingTooltipSeen('hasSeenCastTooltip')
      break
    case 'end_turn_prompt':
      markOnboardingTooltipSeen('hasSeenEndTurnTooltip')
      break
    case 'ap_intro':
    case 'ap_status_reminder':
      markOnboardingTooltipSeen('hasSeenAPTooltip')
      break
  }
}

/** Clear all display stores to the idle state. */
function clearDisplayState(): void {
  tutorialStepId.set(null)
  tutorialMessage.set(null)
  tutorialAnchor.set(null)
  tutorialSpotlight.set(false)
}

/** Activate a step and update all display stores. */
function activateStep(step: TutorialStep, msg: string): void {
  clearMaxDisplayTimer()
  currentStep = step
  currentStepStartTime = performance.now()

  const blocking = !!(step.proactive && step.spotlight) || step.blockInput === true
  tutorialStepId.set(step.id)
  tutorialMessage.set(msg)
  tutorialAnchor.set(step.anchor)
  tutorialSpotlight.set(step.spotlight)
  tutorialBlocksInput.set(blocking)

  if (step.maxDisplayMs !== undefined) {
    maxDisplayTimer = setTimeout(() => {
      advanceStep()
    }, step.maxDisplayMs)
  }
}

/** Dismiss the current step, advance the cursor, and clear blocking state. */
function completeCurrentStep(): void {
  if (currentStep) {
    completedSteps.add(currentStep.id)
    markRelatedTooltips(currentStep.id)
    currentStep = null
    stepCursor++
  }
  clearMaxDisplayTimer()
  clearDisplayState()
  tutorialBlocksInput.set(false)
  // Increment trigger so the UI $effect re-runs to pick up the next proactive step
  tutorialEvalTrigger.update(n => n + 1)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the tutorial for the given mode.
 * Resets all internal state — safe to call even if a tutorial is already running.
 */
export function startTutorial(mode: TutorialMode): void {
  clearMaxDisplayTimer()
  completedSteps = new Set()
  currentStep = null
  currentStepStartTime = 0
  stepCursor = 0

  tutorialActive.set(true)
  tutorialMode.set(mode)
  tutorialBlocksInput.set(false)
  clearDisplayState()
  // Trigger initial evaluation so proactive steps fire immediately
  tutorialEvalTrigger.update(n => n + 1)
}

/**
 * Skip (dismiss) the entire tutorial.
 * Persists the seen flag and the early-dismiss flag so it won't auto-trigger again.
 */
export function skipTutorial(): void {
  clearMaxDisplayTimer()
  const mode = get(tutorialMode)
  if (mode === 'combat') markCombatTutorialSeen()
  if (mode === 'study') markStudyTutorialSeen()
  markTutorialDismissedEarly()

  tutorialActive.set(false)
  tutorialMode.set(null)
  tutorialBlocksInput.set(false)
  clearDisplayState()
  currentStep = null
}

/**
 * Soft-dismiss the tutorial without persisting any flags.
 * Use this when the tutorial must be interrupted for a system reason (e.g. the player
 * enters a multiplayer lobby mid-tutorial). The tutorial will still auto-trigger on the
 * next eligible solo session because no seen/dismissed flags are written.
 */
export function softDismissTutorial(): void {
  clearMaxDisplayTimer()
  tutorialActive.set(false)
  tutorialMode.set(null)
  tutorialBlocksInput.set(false)
  clearDisplayState()
  currentStep = null
}

/**
 * Manually advance past the current step (player clicked "Got it").
 * The step is marked complete and the overlay clears immediately, regardless of minDisplayMs.
 */
export function advanceStep(): void {
  completeCurrentStep()
}

/**
 * Core reactive evaluator — sequential cursor engine.
 *
 * Call this from a Svelte $effect whenever game state changes. It reads the current
 * TutorialContext, decides whether to advance the current step or activate a new one,
 * and updates the exported stores accordingly.
 *
 * Design invariants:
 * - Never interrupts a step that is still within its minDisplayMs window.
 * - Steps are evaluated in cursor order; proactive steps fire immediately, reactive steps
 *   pause the cursor until showWhen becomes true.
 * - A step already shown in currentStep is not replaced by a later step.
 * - When all steps are consumed, marks the tutorial seen and deactivates.
 */
export function evaluateTutorialStep(ctx: TutorialContext): void {
  if (!get(tutorialActive)) return

  const mode = get(tutorialMode)
  if (!mode) return

  const steps = getStepsForMode(mode)
  const now = performance.now()

  // ── Check if current step should complete ─────────────────────────
  if (currentStep) {
    const elapsed = now - currentStepStartTime
    if (currentStep.doneWhen(ctx) && elapsed >= currentStep.minDisplayMs) {
      if (currentStep.autoDismiss) {
        completeCurrentStep()
      }
      // If not autoDismiss, wait for manual advanceStep()
    }
    // Current step still active — don't replace it
    if (currentStep) return
  }

  // ── Advance cursor to next step ───────────────────────────────────
  while (stepCursor < steps.length) {
    const step = steps[stepCursor]

    // Skip already-completed steps
    if (completedSteps.has(step.id)) {
      stepCursor++
      continue
    }

    if (step.proactive) {
      // Proactive: fire immediately, but check getMessage for null (skip if null)
      const msg = step.getMessage(ctx)
      if (msg === null) {
        // Skip this step entirely (e.g. no enemy passives)
        completedSteps.add(step.id)
        stepCursor++
        continue
      }
      activateStep(step, msg)
      return
    } else {
      // Reactive: check showWhen
      if (step.showWhen(ctx)) {
        const msg = step.getMessage(ctx)
        if (msg !== null) {
          activateStep(step, msg)
          return
        }
        // getMessage returned null — skip
        completedSteps.add(step.id)
        stepCursor++
        continue
      }
      // showWhen not yet true — check if step's purpose is already fulfilled
      if (step.doneWhen(ctx)) {
        // Player already passed this point — skip the step
        completedSteps.add(step.id)
        stepCursor++
        continue
      }
      // Wait for condition to become true
      return
    }
  }

  // ── All steps consumed — tutorial complete ────────────────────────
  if (!currentStep) {
    if (mode === 'combat') markCombatTutorialSeen()
    if (mode === 'study') markStudyTutorialSeen()
    tutorialActive.set(false)
    tutorialMode.set(null)
  }
}

/** Returns true if a tutorial is currently running. Useful for conditional rendering logic. */
export function isTutorialActive(): boolean {
  return get(tutorialActive)
}

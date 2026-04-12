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
    case 'tap_card':
    case 'hand_intro':
      markOnboardingTooltipSeen('hasSeenCardTapTooltip')
      break
    case 'card_selected':
      markOnboardingTooltipSeen('hasSeenCastTooltip')
      break
    case 'end_turn_prompt':
      markOnboardingTooltipSeen('hasSeenEndTurnTooltip')
      break
    case 'ap_running_low':
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

/** Dismiss the current step and add it to the completed set. */
function completeCurrentStep(): void {
  if (currentStep) {
    completedSteps.add(currentStep.id)
    markRelatedTooltips(currentStep.id)
    currentStep = null
  }
  clearMaxDisplayTimer()
  clearDisplayState()
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

  tutorialActive.set(true)
  tutorialMode.set(mode)
  clearDisplayState()
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
 * Core reactive evaluator.
 *
 * Call this from a Svelte $effect whenever game state changes. It reads the current
 * TutorialContext, decides whether to advance the current step or activate a new one,
 * and updates the exported stores accordingly.
 *
 * Design invariants:
 * - Never interrupts a step that is still within its minDisplayMs window.
 * - Steps are evaluated in array order; first match wins.
 * - A step already shown in currentStep is not replaced by a later step.
 * - When all steps are completed, marks the tutorial seen and deactivates.
 */
export function evaluateTutorialStep(ctx: TutorialContext): void {
  if (!get(tutorialActive)) return

  const mode = get(tutorialMode)
  if (!mode) return

  const now = performance.now()

  // Check if the currently displayed step's doneWhen has fired
  if (currentStep) {
    const elapsed = now - currentStepStartTime
    if (currentStep.doneWhen(ctx) && elapsed >= currentStep.minDisplayMs) {
      // Step is done — auto-dismiss if configured, otherwise wait for manual "Got it"
      if (currentStep.autoDismiss) {
        completeCurrentStep()
      }
      // If not autoDismiss, the step stays until advanceStep() is called manually
    } else {
      // Current step still active — don't replace it
      return
    }
  }

  // Find the next uncompleted step whose showWhen fires and has a non-null message
  const steps = getStepsForMode(mode)
  let nextStep: TutorialStep | null = null

  for (const step of steps) {
    if (completedSteps.has(step.id)) continue
    if (step.showWhen(ctx)) {
      const msg = step.getMessage(ctx)
      if (msg !== null) {
        nextStep = step
        break
      }
    }
  }

  if (nextStep !== null) {
    clearMaxDisplayTimer()
    currentStep = nextStep
    currentStepStartTime = now

    tutorialStepId.set(nextStep.id)
    tutorialMessage.set(nextStep.getMessage(ctx))
    tutorialAnchor.set(nextStep.anchor)
    tutorialSpotlight.set(nextStep.spotlight)

    // Schedule auto-dismiss after maxDisplayMs if the step defines one
    if (nextStep.maxDisplayMs !== undefined) {
      maxDisplayTimer = setTimeout(() => {
        advanceStep()
      }, nextStep.maxDisplayMs)
    }
    return
  }

  // No step active and no next step found — check if all steps are done
  const allDone = steps.every((s) => completedSteps.has(s.id))
  if (allDone && !currentStep) {
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

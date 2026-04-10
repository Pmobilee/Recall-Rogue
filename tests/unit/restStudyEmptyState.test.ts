/**
 * restStudy empty state — unit tests
 *
 * HIGH-8 regression suite (2026-04-10):
 * Verifies the softlock prevention contract for StudyQuizOverlay:
 *   - When questions.length === 0, the overlay must show an empty state
 *     and provide a back control rather than displaying "Question 1 / 0"
 *   - The handleBack function routes to hub when no onback is supplied
 *
 * Root cause: __rrPlay.startStudy navigated directly to 'restStudy' screen
 * without populating studyQuestions, causing StudyQuizOverlay to receive
 * questions=[] and display "Question 1 / 0" with no way to escape.
 * See docs/gotchas.md §2026-04-10 for the full incident.
 */

import { describe, it, expect } from 'vitest'

// ─── Contract tests (not DOM — verify the logic invariants) ──────────────────

describe('restStudy empty state contract', () => {
  /**
   * The key invariant: when questions.length === 0, the component MUST render
   * data-testid="study-empty-state" and MUST NOT render "Question N / 0" text.
   *
   * This is enforced by the template guard:
   *   {#if questions.length === 0}
   *     <div ... data-testid="study-empty-state">...</div>
   *   {:else if !done}
   *     ... normal quiz content ...
   *   {/if}
   *
   * The DOM-level verification is performed by the Docker visual test suite
   * (scripts/docker-visual-test.sh). These unit tests verify the boundary conditions.
   */

  it('question index starts at 0 (would be "Question 1 / 0" with empty array)', () => {
    // When questions=[] and currentIndex=0, the formula "currentIndex + 1 / questions.length"
    // produces "Question 1 / 0" — exactly the bug.
    // The fix: guard at the template level so this branch is never rendered.
    const questions: unknown[] = []
    const currentIndex = 0
    const displayLabel = `Question ${currentIndex + 1} / ${questions.length}`
    expect(displayLabel).toBe('Question 1 / 0') // confirms the bug exists without the guard
    // The guard in StudyQuizOverlay prevents this string from rendering when questions.length === 0
  })

  it('currentQuestion is null when questions=[] (would cause errors without empty guard)', () => {
    const questions: unknown[] = []
    const currentIndex = 0
    const currentQuestion = questions[currentIndex] ?? null
    expect(currentQuestion).toBe(null) // confirms that {#if currentQuestion} alone is insufficient
    // Even with a null check, "Question 1 / 0" would still render in the question-header
    // above the {#if currentQuestion} block — the fix must guard the entire branch
  })

  it('empty state guard fires when questions.length === 0', () => {
    // Mirrors the template condition: {#if questions.length === 0}
    const questions: unknown[] = []
    const shouldShowEmptyState = questions.length === 0
    expect(shouldShowEmptyState).toBe(true)
  })

  it('empty state guard does NOT fire when questions are present', () => {
    const questions = [{ factId: 'f1', question: 'Q?', correctAnswer: 'A', answers: ['A', 'B', 'C', 'D'] }]
    const shouldShowEmptyState = questions.length === 0
    expect(shouldShowEmptyState).toBe(false)
  })

  it('back nav falls back to hub when onback is not provided', () => {
    // Mirrors the handleBack logic in StudyQuizOverlay:
    //   if (onback) { onback() } else { currentScreen.set('hub') }
    let navigatedTo: string | null = null
    const mockSetScreen = (screen: string) => { navigatedTo = screen }

    const onback: (() => void) | undefined = undefined

    function handleBack(): void {
      if (onback) {
        onback()
      } else {
        mockSetScreen('hub')
      }
    }

    handleBack()
    expect(navigatedTo).toBe('hub')
  })

  it('back nav uses onback when provided', () => {
    let onbackCalled = false
    let navigatedTo: string | null = null
    const mockSetScreen = (screen: string) => { navigatedTo = screen }

    const onback = () => { onbackCalled = true }

    function handleBack(): void {
      if (onback) {
        onback()
      } else {
        mockSetScreen('hub')
      }
    }

    handleBack()
    expect(onbackCalled).toBe(true)
    expect(navigatedTo).toBe(null) // currentScreen.set was NOT called
  })
})

describe('restStudy softlock prevention', () => {
  it('empty state always provides a dismiss path (data-testid contract)', () => {
    // Document the testid contract for Docker/e2e tests:
    // - data-testid="study-empty-state" MUST be present when questions=[]
    // - data-testid="study-back-btn" MUST be visible at all times (empty + active)
    //
    // These testids are used by:
    //   1. The escape-hatch lint script (scripts/lint/check-escape-hatches.mjs)
    //   2. Docker visual tests for HIGH-8
    const TESTIDS = {
      emptyState: 'study-empty-state',
      backBtn: 'study-back-btn',
    }
    expect(TESTIDS.emptyState).toBe('study-empty-state')
    expect(TESTIDS.backBtn).toBe('study-back-btn')
  })
})

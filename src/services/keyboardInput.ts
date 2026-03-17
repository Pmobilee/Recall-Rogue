/**
 * keyboardInput.ts — Keyboard listener that dispatches semantic GameActions.
 *
 * AR-74: Input System Overhaul
 *
 * IMPORTANT: Keyboard shortcuts are ONLY active in landscape mode.
 * This module subscribes to `layoutMode` and binds/unbinds listeners accordingly.
 *
 * Context-awareness:
 * - When quiz overlay is visible (cardPlayStage === 'committed'), 1-4 = QUIZ_ANSWER.
 * - When card hand is visible (cardPlayStage === 'hand' | 'selected'), 1-5 = SELECT_CARD.
 * - This module reads game state via the `quizVisible` flag exposed by the combat overlay.
 *
 * Keys are blocked when the user is typing in a text input (checks activeElement tag).
 */

import { get } from 'svelte/store'
import { layoutMode } from '../stores/layoutStore'
import { inputService } from './inputService'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Whether keyboard listeners are currently bound. */
let listenersActive = false

/** External flag set by combat overlay to indicate quiz is showing. */
let _quizVisible = false

/**
 * Set by CardCombatOverlay to tell this module whether a quiz is currently
 * visible. When true, number keys dispatch QUIZ_ANSWER instead of SELECT_CARD.
 */
export function setQuizVisible(visible: boolean): void {
  _quizVisible = visible
}

// ---------------------------------------------------------------------------
// Typing guard
// ---------------------------------------------------------------------------

/**
 * Returns true if the user is currently typing in a focusable input element.
 * We do NOT intercept keyboard events while the user is typing.
 */
function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

// ---------------------------------------------------------------------------
// Key handler
// ---------------------------------------------------------------------------

function handleKeyDown(e: KeyboardEvent): void {
  // Never intercept when typing
  if (isTyping()) return

  // Only active in landscape mode
  if (get(layoutMode) !== 'landscape') return

  const key = e.key

  // Number keys: context-sensitive
  if (key >= '1' && key <= '5') {
    const index = parseInt(key, 10) - 1
    if (_quizVisible && index <= 3) {
      // Quiz visible: 1-4 = quiz answers
      e.preventDefault()
      inputService.dispatch({ type: 'QUIZ_ANSWER', index })
    } else if (!_quizVisible && index <= 4) {
      // Card hand visible: 1-5 = select card
      e.preventDefault()
      inputService.dispatch({ type: 'SELECT_CARD', index })
    }
    return
  }

  switch (key.toLowerCase()) {
    case 'q':
      e.preventDefault()
      inputService.dispatch({ type: 'QUICK_PLAY' })
      break

    case 'e':
      e.preventDefault()
      inputService.dispatch({ type: 'CHARGE' })
      break

    case 'escape':
      e.preventDefault()
      if (_quizVisible) {
        // Don't cancel during quiz — that would be unfair
        break
      }
      inputService.dispatch({ type: 'CANCEL' })
      break

    case ' ':
      // Space: confirm OR skip animation
      e.preventDefault()
      inputService.dispatch({ type: 'CONFIRM' })
      inputService.dispatch({ type: 'SKIP_ANIMATION' })
      break

    case 'tab':
      e.preventDefault()
      inputService.dispatch({ type: 'TOGGLE_DECK_VIEW' })
      break

    case 'enter':
      e.preventDefault()
      inputService.dispatch({ type: 'END_TURN' })
      break

    case '?':
    case '/':
      e.preventDefault()
      inputService.dispatch({ type: 'TOGGLE_KEYBOARD_HELP' })
      break

    default:
      break
  }
}

// ---------------------------------------------------------------------------
// Bind / unbind
// ---------------------------------------------------------------------------

function bindListeners(): void {
  if (listenersActive) return
  document.addEventListener('keydown', handleKeyDown)
  listenersActive = true
}

function unbindListeners(): void {
  if (!listenersActive) return
  document.removeEventListener('keydown', handleKeyDown)
  listenersActive = false
}

// ---------------------------------------------------------------------------
// Layout mode subscription — only activate in landscape
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  layoutMode.subscribe((mode) => {
    if (mode === 'landscape') {
      bindListeners()
    } else {
      unbindListeners()
    }
  })
}

/**
 * Manually activate keyboard listeners (for testing or explicit initialization).
 * Normal usage: just import this module — the subscription handles activation.
 */
export function initKeyboardInput(): void {
  if (get(layoutMode) === 'landscape') {
    bindListeners()
  }
}

/** Teardown: remove all listeners. */
export function destroyKeyboardInput(): void {
  unbindListeners()
}

/**
 * inputService.ts — Game-action pub/sub dispatcher for the input abstraction layer.
 *
 * AR-74: Input System Overhaul
 *
 * This service provides a lightweight event bus that decouples input sources
 * (keyboard, gamepad, touch) from the UI components that respond to them.
 * Components register handlers via `on()` and keyboard/other input modules
 * call `dispatch()` with semantic game actions.
 *
 * Keyboard shortcuts are acceleration, NOT requirements. Every action must
 * remain performable via mouse/touch without any keyboard involvement.
 */

/** Union of all semantic game actions the input system can emit. */
export type GameAction =
  | { type: 'SELECT_CARD'; index: number }      // 0-4: select card at hand position
  | { type: 'QUICK_PLAY' }                       // Q: quick-play selected card (no quiz)
  | { type: 'CHARGE' }                           // E: charge-play selected card (with quiz)
  | { type: 'DESELECT' }                         // Deselect current card
  | { type: 'CONFIRM' }                          // Space: confirm current action
  | { type: 'CANCEL' }                           // Escape: cancel / close
  | { type: 'QUIZ_ANSWER'; index: number }       // 1-4: select quiz answer (overrides card select when quiz is visible)
  | { type: 'NAVIGATE_BACK' }                    // Escape: navigate back (context-dependent)
  | { type: 'PAUSE' }                            // Pause / open menu
  | { type: 'TOGGLE_DECK_VIEW' }                 // Tab: toggle deck/discard pile view
  | { type: 'SKIP_ANIMATION' }                   // Space: skip ongoing animation
  | { type: 'END_TURN' }                         // Enter: end turn (combat)
  | { type: 'TOGGLE_KEYBOARD_HELP' }             // ?: open/close keyboard shortcut help overlay

type ActionHandler = (action: GameAction) => void

class InputService {
  private handlers: Map<string, Set<ActionHandler>> = new Map()

  /**
   * Register a handler for a specific action type (or '*' wildcard for all actions).
   * Returns an unsubscribe function — call it in onDestroy to avoid leaks.
   */
  on(actionType: string, handler: ActionHandler): () => void {
    if (!this.handlers.has(actionType)) {
      this.handlers.set(actionType, new Set())
    }
    this.handlers.get(actionType)!.add(handler)
    return () => {
      this.handlers.get(actionType)?.delete(handler)
    }
  }

  /**
   * Dispatch a game action to all registered handlers.
   * Notifies both specific-type handlers AND '*' wildcard handlers.
   */
  dispatch(action: GameAction): void {
    // Notify specific-type handlers
    const specific = this.handlers.get(action.type)
    if (specific) {
      for (const handler of specific) {
        try {
          handler(action)
        } catch (err) {
          console.error('[inputService] Handler error for action', action.type, err)
        }
      }
    }
    // Notify wildcard handlers
    const wildcard = this.handlers.get('*')
    if (wildcard) {
      for (const handler of wildcard) {
        try {
          handler(action)
        } catch (err) {
          console.error('[inputService] Wildcard handler error for action', action.type, err)
        }
      }
    }
  }

  /** Remove all registered handlers. Called on full app teardown or layout mode switch. */
  clear(): void {
    this.handlers.clear()
  }
}

/** Singleton input service — import this instance everywhere. */
export const inputService = new InputService()

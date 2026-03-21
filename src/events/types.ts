// src/events/types.ts
// Central registry of ALL cross-boundary event types.
// Import from here — never use raw string event names.

/** Emitted when the player moves one tile. */
export interface PlayerMovedEvent {
  gridX: number
  gridY: number
  direction: 'up' | 'down' | 'left' | 'right'
}

/** Emitted by Svelte QuizOverlay when the player selects an answer. */
export interface QuizAnswerSubmittedEvent {
  factId: string
  selectedDistractorIndex: number | 'correct'
  isCorrect: boolean
}

/** Emitted when a new Keeper toast should appear. */
export interface KeeperToastRequestedEvent {
  message: string
  mood: 'calm' | 'excited' | 'stern' | 'curious'
  duration?: number
}

/** Master event map: event name → payload type */
export interface GameEventMap {
  'player-moved': PlayerMovedEvent
  'quiz-answer-submitted': QuizAnswerSubmittedEvent
  'keeper-toast-requested': KeeperToastRequestedEvent
  // Lifecycle events (no payload)
  'dive-start-requested': void
  'dive-end-requested': void
  'save-requested': void
}

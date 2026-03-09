// src/events/types.ts
// Central registry of ALL cross-boundary event types.
// Import from here — never use raw string event names.

import type { BlockType, MineralTier } from '../data/types'

/** Emitted by CombatScene when a block is fully destroyed. */
export interface BlockMinedEvent {
  x: number
  y: number
  blockType: BlockType
  loot: Array<{ type: string; tier: MineralTier }>
}

/** Emitted when the player moves one tile. */
export interface PlayerMovedEvent {
  gridX: number
  gridY: number
  direction: 'up' | 'down' | 'left' | 'right'
}

/** Emitted when oxygen level changes for any reason. */
export interface OxygenChangedEvent {
  current: number
  max: number
  delta: number
  cause: 'movement' | 'hazard' | 'quiz-wrong' | 'replenish'
}

/** Emitted by Svelte QuizOverlay when the player selects an answer. */
export interface QuizAnswerSubmittedEvent {
  factId: string
  selectedDistractorIndex: number | 'correct'
  isCorrect: boolean
}

/** Emitted when a floor transition begins. */
export interface LayerTransitionEvent {
  fromLayer: number
  toLayer: number
  biome: string
}

/** Emitted when the score count updates. */
export interface ScoreUpdatedEvent {
  dust: number
  shards: number
  crystals: number
  geodes: number
  essence: number
}

/** Emitted when a new Keeper toast should appear. */
export interface KeeperToastRequestedEvent {
  message: string
  mood: 'calm' | 'excited' | 'stern' | 'curious'
  duration?: number
}

/** Master event map: event name → payload type */
export interface GameEventMap {
  'block-mined': BlockMinedEvent
  'player-moved': PlayerMovedEvent
  'oxygen-changed': OxygenChangedEvent
  'quiz-answer-submitted': QuizAnswerSubmittedEvent
  'layer-transition': LayerTransitionEvent
  'score-updated': ScoreUpdatedEvent
  'keeper-toast-requested': KeeperToastRequestedEvent
  // Lifecycle events (no payload)
  'dive-start-requested': void
  'dive-end-requested': void
  'save-requested': void
}

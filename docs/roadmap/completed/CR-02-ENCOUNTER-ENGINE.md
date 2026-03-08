# CR-02: Encounter Engine

> Turn-based combat loop, enemy system, and card effect resolution. Pure logic layer -- no rendering, no Phaser, no Svelte.

---

## Overview

| Field | Value |
|-------|-------|
| **Phase ID** | CR-02 |
| **Title** | Encounter Engine |
| **Depends On** | CR-01 Card Foundation |
| **Complexity** | Medium |
| **Estimated Files** | 6 new + 1 test file |
| **Goal** | Implement the complete turn-based encounter loop: enemy creation, intent telegraphing, card effect resolution, damage/shield/heal/status effects, combo multipliers, turn management, and encounter rewards. All logic is framework-agnostic TypeScript -- no imports from Phaser, Svelte, or DOM APIs. |

### What CR-01 Provides (Dependencies)

These types and functions MUST exist before CR-02 work begins. Reference them by import path.

From `src/data/cardTypes.ts`:
```typescript
type CardType = 'attack' | 'shield' | 'heal' | 'utility' | 'buff' | 'debuff' | 'regen' | 'wild'
type FactDomain = 'science' | 'history' | 'geography' | 'language' | 'math' | 'arts' | 'medicine' | 'technology'

interface Card {
  id: string
  factId: string
  cardType: CardType
  domain: FactDomain
  tier: 1 | 2 | 3
  baseEffectValue: number
  effectMultiplier: number   // derived from SM-2 ease factor
  name: string               // thematic name (e.g. "Crystalline Strike")
}
```

From `src/services/deckManager.ts`:
```typescript
interface DeckState {
  drawPile: Card[]
  hand: Card[]
  discardPile: Card[]
  exhaustPile: Card[]
}

function drawHand(deck: DeckState, count?: number): DeckState
function playCard(deck: DeckState, cardId: string): { deck: DeckState; card: Card }
function discardCard(deck: DeckState, cardId: string): DeckState
```

From `src/data/cardBalance.ts`:
```typescript
const HAND_SIZE = 5
const COMBO_MULTIPLIERS: Record<number, number>   // comboCount -> multiplier
const SPEED_BONUS_MULTIPLIER = 1.5
const FLOOR_TIMER: Record<number, number>          // floor -> seconds
const PLAYER_START_HP = 80
const TIER_MULTIPLIERS: Record<1 | 2 | 3, number> // tier -> damage multiplier
```

From existing codebase:
- `src/services/sm2.ts` -- `reviewCard(state, button)` with `AnkiButton = 'again' | 'okay' | 'good'`
- `src/services/quizService.ts` -- `getQuizChoices(fact)`, `gradeAnswer(fact, answer)`
- `src/data/types.ts` -- `Fact`, `ReviewState`, `Rarity`
- `src/ui/stores/playerData.ts` -- `updateReviewState(factId, correct)`

---

## Sub-step 1: Status Effect Types

**File:** `src/data/statusEffects.ts`

Define the shared status effect types used by both enemies and players.

```typescript
/** All status effect types in the encounter system. */
export type StatusEffectType = 'poison' | 'regen' | 'strength' | 'weakness' | 'vulnerable'

/** A single active status effect on a combatant. */
export interface StatusEffect {
  type: StatusEffectType
  /** Magnitude of the effect per tick (poison damage, regen heal, strength bonus, etc.) */
  value: number
  /** Number of turns remaining before this effect expires. Decremented at turn end. */
  turnsRemaining: number
}

/**
 * Apply a status effect to an existing list. If the same type already exists,
 * refresh duration to whichever is longer and add values.
 */
export function applyStatusEffect(
  effects: StatusEffect[],
  newEffect: StatusEffect
): StatusEffect[]

/**
 * Tick all status effects: decrement turnsRemaining, remove expired ones.
 * Returns { effects: remaining effects, poisonDamage, regenHeal }.
 */
export function tickStatusEffects(
  effects: StatusEffect[]
): { effects: StatusEffect[]; poisonDamage: number; regenHeal: number }

/**
 * Get the current strength modifier from status effects.
 * strength -> positive multiplier bonus, weakness -> negative.
 * Returns a multiplier (e.g., 1.0 = no change, 1.25 = +25% damage, 0.75 = -25% damage).
 */
export function getStrengthModifier(effects: StatusEffect[]): number

/**
 * Check if a combatant has the 'vulnerable' status.
 * Vulnerable targets take 50% more damage.
 */
export function isVulnerable(effects: StatusEffect[]): boolean
```

### Acceptance Criteria
- [ ] All 5 status effect types defined
- [ ] `applyStatusEffect` stacks same-type effects correctly (add value, max duration)
- [ ] `tickStatusEffects` returns correct poison/regen values and removes expired effects
- [ ] `getStrengthModifier` returns correct multiplier for strength/weakness combinations
- [ ] `isVulnerable` returns boolean based on presence of vulnerable effect
- [ ] No imports from Phaser, Svelte, or DOM APIs
- [ ] All functions exported, all have JSDoc comments

---

## Sub-step 2: Enemy Types and Data

**File:** `src/data/enemies.ts`

Define enemy templates, intent system, and the full enemy roster.

```typescript
import type { StatusEffect, StatusEffectType } from './statusEffects'
import type { FactDomain } from './cardTypes'

/** Enemy categories that determine encounter difficulty and rewards. */
export type EnemyCategory = 'common' | 'elite' | 'boss'

/** A possible action an enemy can take on its turn. */
export interface EnemyIntent {
  /** What the enemy does. */
  type: 'attack' | 'buff_self' | 'debuff_player' | 'heal_self' | 'multi_attack'
  /** Damage dealt, buff amount, heal amount, or status value. */
  value: number
  /** Probability weight for random selection from the intent pool. */
  weight: number
  /** Short text/icon key shown to the player before the enemy acts. */
  telegraph: string
  /** Optional: status effect applied alongside the intent. */
  statusEffect?: { type: StatusEffectType; value: number; turns: number }
  /** For multi_attack: number of hits. */
  hitCount?: number
}

/** Blueprint for creating enemy instances. Immutable reference data. */
export interface EnemyTemplate {
  id: string
  name: string
  category: EnemyCategory
  baseHP: number
  intentPool: EnemyIntent[]
  description: string
  /** If set, this enemy is immune to cards from this domain. */
  immuneDomain?: FactDomain
  /** For multi-phase enemies: HP threshold (0-1) that triggers phase transition. */
  phaseTransitionAt?: number
  /** Intent pool used after phase transition. */
  phase2IntentPool?: EnemyIntent[]
}

/** A live enemy in an encounter. Mutable combat state. */
export interface EnemyInstance {
  template: EnemyTemplate
  currentHP: number
  maxHP: number
  /** The intent the enemy WILL execute on its next turn. Visible to the player. */
  nextIntent: EnemyIntent
  statusEffects: StatusEffect[]
  /** Current phase (1 or 2). Transitions when HP drops below phaseTransitionAt. */
  phase: number
}
```

Define the full roster as exported constants:

```typescript
/** All enemy templates, keyed by id. */
export const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = { ... }
```

**Common enemies:**

| ID | Name | HP | Intent Pool | Notes |
|----|------|----|-------------|-------|
| `cave_bat` | Cave Bat | 15 | attack(2, w:3, "Bite"), multi_attack(1, w:1, hitCount:3, "Frenzy") | Low HP, fast attacks. Teaches "answer quickly." |
| `crystal_golem` | Crystal Golem | 40 | attack(8, w:2, "Slam"), buff_self(3, w:1, strength, 2 turns, "Harden") | High HP, hits every intent. Buff makes later hits hurt. |
| `toxic_spore` | Toxic Spore | 12 | debuff_player(2, w:3, poison 3 turns, "Spew"), attack(3, w:1, "Lash") | Low HP, poison. Teaches "prioritize healing cards." |
| `shadow_mimic` | Shadow Mimic | 20 | attack(4, w:2, "Echo"), debuff_player(0, w:1, weakness 2 turns, "Drain") | Moderate. Weakness debuff reduces player damage. |

**Elite enemies:**

| ID | Name | HP | Intent Pool | Notes |
|----|------|----|-------------|-------|
| `ore_wyrm` | Ore Wyrm | 50 | Phase 1: attack(6, w:2), heal_self(8, w:1). Phase 2 (below 50% HP): attack(12, w:3), multi_attack(4, w:1, hitCount:3) | Multi-phase. Phase 2 doubles attack. |
| `fossil_guardian` | Fossil Guardian | 45 | attack(7, w:2), buff_self(4, w:1, strength 3 turns), debuff_player(0, w:1, vulnerable 2 turns) | `immuneDomain` set randomly per encounter from the player's primary domain. |

**Boss enemies:**

| ID | Name | HP | Intent Pool | Notes |
|----|------|----|-------------|-------|
| `the_excavator` | The Excavator | 60 | attack(5, w:3, "Drill"), buff_self(2, w:1, strength 2 turns, "Rev Up"), attack(10, w:1, "Overload") | Predictable pattern. Teaches boss mechanics. Floor 3 boss. |
| `magma_core` | Magma Core | 80 | attack(6, w:2, "Eruption"), debuff_player(3, w:2, poison 2 turns, "Magma Spray"), multi_attack(3, w:1, hitCount:4, "Barrage") | Escalating damage via poison stacking. Floor 6 boss. |
| `the_archivist` | The Archivist | 100 | attack(8, w:2, "Tome Strike"), debuff_player(0, w:1, weakness 3 turns, "Silence"), buff_self(5, w:1, strength 99 turns, "Archive") | Permanent strength stacking. Floor 9 boss. Must kill fast. |

### Acceptance Criteria
- [ ] `EnemyTemplate`, `EnemyIntent`, `EnemyInstance` interfaces exported
- [ ] 4 common, 2 elite, 3 boss templates defined in `ENEMY_TEMPLATES`
- [ ] Each template has at least 2 intents in its pool
- [ ] Intent weights are positive numbers
- [ ] `ore_wyrm` has `phaseTransitionAt: 0.5` and `phase2IntentPool`
- [ ] `fossil_guardian` has `immuneDomain` property (set at encounter creation, not in template)
- [ ] All templates have `description` and `telegraph` strings
- [ ] No imports from Phaser, Svelte, or DOM APIs

---

## Sub-step 3: Enemy Instance Manager

**File:** `src/services/enemyManager.ts`

Functions for creating and managing enemy instances during combat.

```typescript
import type { EnemyTemplate, EnemyInstance, EnemyIntent } from '../data/enemies'
import type { StatusEffect } from '../data/statusEffects'

/**
 * Create a live enemy instance from a template with floor-based HP scaling.
 * @param template - The enemy blueprint
 * @param floor - Current floor number (1-based), used for HP scaling
 * @returns A new EnemyInstance with scaled HP and a pre-rolled first intent
 */
export function createEnemy(template: EnemyTemplate, floor: number): EnemyInstance

/**
 * Returns the HP/damage scaling multiplier for a given floor.
 * Floor 1 = 1.0, scales linearly: multiplier = 1.0 + (floor - 1) * 0.12
 * Floor 3 = 1.24, Floor 6 = 1.60, Floor 9 = 1.96, Floor 12 = 2.32
 */
export function getFloorScaling(floor: number): number

/**
 * Roll the enemy's next intent using weighted random selection from the
 * current phase's intent pool. Stores result in enemy.nextIntent.
 * @returns The selected intent (same reference stored on the enemy)
 */
export function rollNextIntent(enemy: EnemyInstance): EnemyIntent

/**
 * Apply damage to an enemy. Checks for phase transition (e.g., Ore Wyrm at 50% HP).
 * @returns { defeated: true } if enemy HP <= 0, otherwise { defeated: false, remainingHP }
 */
export function applyDamageToEnemy(
  enemy: EnemyInstance,
  damage: number
): { defeated: boolean; remainingHP: number }

/**
 * Execute the enemy's telegraphed intent against the player.
 * Does NOT modify playerState directly -- returns the results for the caller to apply.
 * Handles: attack (single), multi_attack (N hits), buff_self, debuff_player, heal_self.
 * Applies enemy strength modifier to outgoing damage.
 * @returns Damage to deal to player and any status effects to apply to player
 */
export function executeEnemyIntent(
  enemy: EnemyInstance
): { damage: number; playerEffects: StatusEffect[]; enemyHealed: number }

/**
 * Tick the enemy's own status effects (e.g., poison applied by player debuff cards).
 * Applies poison damage to enemy, regen healing, and removes expired effects.
 */
export function tickEnemyStatusEffects(
  enemy: EnemyInstance
): { poisonDamage: number; regenHeal: number }
```

### Implementation Notes

- `createEnemy` should apply `getFloorScaling(floor)` to `template.baseHP` (round to nearest integer). It should call `rollNextIntent` to pre-populate `nextIntent`.
- `rollNextIntent` uses weighted random: sum all weights, pick a random number in [0, totalWeight), iterate pool to find the matching intent. For multi-phase enemies, use `phase2IntentPool` when `enemy.phase === 2`.
- `applyDamageToEnemy` must check if `enemy.currentHP / enemy.maxHP <= enemy.template.phaseTransitionAt` after applying damage. If transitioning, set `enemy.phase = 2` and immediately roll a new intent from phase 2 pool.
- `executeEnemyIntent` applies the enemy's own strength modifier (from `getStrengthModifier(enemy.statusEffects)`) to damage. For `multi_attack`, total damage = `value * hitCount * strengthMod`. For `buff_self`, add the status to the enemy's own effects. For `heal_self`, clamp healing at `enemy.maxHP`.

### Acceptance Criteria
- [ ] `createEnemy` produces an instance with HP = `round(baseHP * getFloorScaling(floor))`
- [ ] `createEnemy` pre-rolls `nextIntent`
- [ ] `getFloorScaling(1)` returns `1.0`, `getFloorScaling(9)` returns approximately `1.96`
- [ ] `rollNextIntent` respects weight distribution (verifiable statistically in tests)
- [ ] `applyDamageToEnemy` triggers phase transition at correct HP threshold
- [ ] `applyDamageToEnemy` returns `{ defeated: true }` when HP reaches 0 or below
- [ ] `executeEnemyIntent` correctly computes multi_attack damage as `value * hitCount * strengthMod`
- [ ] `executeEnemyIntent` returns status effects for `debuff_player` intents
- [ ] `tickEnemyStatusEffects` applies poison damage and removes expired effects
- [ ] No imports from Phaser, Svelte, or DOM APIs

---

## Sub-step 4: Player Combat State

**File:** `src/services/playerCombatState.ts`

Manages the player's mutable state during an encounter.

```typescript
import type { StatusEffect } from '../data/statusEffects'
import { PLAYER_START_HP } from '../data/cardBalance'

/** Player's mutable combat state for one encounter. */
export interface PlayerCombatState {
  hp: number
  maxHP: number
  shield: number              // Blocks damage this turn, resets each turn
  statusEffects: StatusEffect[]
  comboCount: number          // Consecutive correct answers this turn
  hintsRemaining: number      // Reserved for future use
  cardsPlayedThisTurn: number
}

/**
 * Create a fresh player combat state for a new encounter.
 * HP defaults to PLAYER_START_HP (80).
 * Optionally accepts a custom maxHP for scaling.
 */
export function createPlayerCombatState(maxHP?: number): PlayerCombatState

/**
 * Add shield points to the player. Shield stacks within a turn.
 */
export function applyShield(state: PlayerCombatState, amount: number): void

/**
 * Deal damage to the player. Shield absorbs first, remainder hits HP.
 * @returns { actualDamage: HP lost (after shield), defeated: true if HP <= 0 }
 */
export function takeDamage(
  state: PlayerCombatState,
  damage: number
): { actualDamage: number; defeated: boolean }

/**
 * Heal the player. Capped at maxHP.
 * @returns actual amount healed
 */
export function healPlayer(state: PlayerCombatState, amount: number): number

/**
 * Tick the player's status effects at turn end.
 * Applies poison damage (calls takeDamage internally), regen healing.
 * Removes expired effects.
 * @returns { poisonDamage, regenHeal, defeated }
 */
export function tickPlayerStatusEffects(
  state: PlayerCombatState
): { poisonDamage: number; regenHeal: number; defeated: boolean }

/**
 * Reset per-turn state: clear shield, reset comboCount and cardsPlayedThisTurn.
 * Called at the start of each new player turn.
 */
export function resetTurnState(state: PlayerCombatState): void
```

### Acceptance Criteria
- [ ] `createPlayerCombatState()` returns HP=80, shield=0, comboCount=0, empty statusEffects
- [ ] `createPlayerCombatState(100)` returns HP=100, maxHP=100
- [ ] `applyShield` stacks: calling twice with 5 results in shield=10
- [ ] `takeDamage` absorbs shield first: shield=8, damage=12 -> shield=0, HP reduced by 4
- [ ] `takeDamage` returns `defeated: true` when HP drops to 0 or below
- [ ] `healPlayer` caps at maxHP: HP=70, maxHP=80, heal(20) -> HP=80, returns 10
- [ ] `tickPlayerStatusEffects` applies poison through `takeDamage` (so shield blocks it)
- [ ] `resetTurnState` clears shield to 0 and comboCount to 0
- [ ] All functions modify state in-place (mutate the passed object)
- [ ] No imports from Phaser, Svelte, or DOM APIs

---

## Sub-step 5: Card Effect Resolver

**File:** `src/services/cardEffectResolver.ts`

Resolves a played card's effect against the current encounter state.

```typescript
import type { Card, CardType } from '../data/cardTypes'
import type { PlayerCombatState } from './playerCombatState'
import type { EnemyInstance } from '../data/enemies'
import type { StatusEffect } from '../data/statusEffects'
import { COMBO_MULTIPLIERS, SPEED_BONUS_MULTIPLIER, TIER_MULTIPLIERS } from '../data/cardBalance'

/** Result of resolving a single card's effect. */
export interface CardEffectResult {
  /** Which card type produced this effect. */
  effectType: CardType
  /** Value before multipliers. */
  rawValue: number
  /** Value after all multipliers (tier, combo, speed, effectMultiplier). */
  finalValue: number
  /** Whether the effect successfully hit/applied. Always true for correct answers. */
  targetHit: boolean
  /** Damage dealt to enemy (attack, debuff-damage). 0 for non-damage effects. */
  damageDealt: number
  /** Shield applied to player. 0 for non-shield effects. */
  shieldApplied: number
  /** HP healed on player. 0 for non-heal effects. */
  healApplied: number
  /** Status effects applied (to enemy or player depending on type). */
  statusesApplied: StatusEffect[]
  /** Extra cards drawn (utility effect). */
  extraCardsDrawn: number
  /** Whether the enemy was defeated by this card. */
  enemyDefeated: boolean
}

/**
 * Resolve a card's effect in the current encounter context.
 *
 * Final value formula:
 *   finalValue = baseEffectValue * TIER_MULTIPLIERS[tier] * effectMultiplier
 *                * comboMultiplier * (speedBonus ? SPEED_BONUS_MULTIPLIER : 1.0)
 *
 * Effect application by cardType:
 *   attack  -> deal finalValue damage to enemy
 *   shield  -> add finalValue to player shield
 *   heal    -> heal player by finalValue
 *   buff    -> set buffNextCard on turn state (percentage boost for next card)
 *   debuff  -> apply weakness/vulnerable status to enemy, OR deal reduced damage
 *   regen   -> apply regen status to player (finalValue HP/turn for 3 turns)
 *   utility -> draw 1 extra card (returns extraCardsDrawn=1)
 *   wild    -> if lastCardType provided, act as that type; otherwise act as attack
 *
 * @param card - The card being played
 * @param playerState - Player's current combat state (for shield/heal application)
 * @param enemy - The enemy instance (for damage application and immunity check)
 * @param comboCount - Current combo count this turn (0 = no combo bonus)
 * @param speedBonus - Whether the player answered within the speed bonus window
 * @param buffNextCard - Percentage buff from a previous buff card this turn (0 = none)
 * @param lastCardType - The cardType of the previously played card (for wild card copying)
 */
export function resolveCardEffect(
  card: Card,
  playerState: PlayerCombatState,
  enemy: EnemyInstance,
  comboCount: number,
  speedBonus: boolean,
  buffNextCard: number,
  lastCardType?: CardType
): CardEffectResult

/**
 * Check if a card's domain is blocked by the enemy's immuneDomain.
 * If the enemy is immune, the card fizzles even on correct answer.
 * @returns true if the card is blocked
 */
export function isCardBlocked(card: Card, enemy: EnemyInstance): boolean
```

### Implementation Notes

- The `comboMultiplier` is looked up from `COMBO_MULTIPLIERS[comboCount]`. If comboCount=0 or not in the table, multiplier is 1.0.
- `buffNextCard` is a percentage (e.g., 25 means +25%). Applied as `* (1 + buffNextCard / 100)`.
- For `wild` cards: use `lastCardType` to determine behavior. If no previous card was played (`lastCardType` is undefined), default to `attack`.
- For `debuff` cards: apply `weakness` status (2 turns, value = `floor(finalValue / 2)`) to enemy. If `finalValue >= 5`, also apply `vulnerable` (2 turns).
- For `regen` cards: apply regen status to player (3 turns, value = `ceil(finalValue / 3)` per turn).
- `isCardBlocked` checks `enemy.template.immuneDomain === card.domain`.
- The function should NOT call `applyDamageToEnemy` or `applyShield` directly -- it returns the result for the turn manager to apply. Exception: utility (draw) returns `extraCardsDrawn` count for the turn manager.

### Acceptance Criteria
- [ ] `resolveCardEffect` computes `finalValue` using the full multiplier chain
- [ ] Attack cards return `damageDealt = finalValue`
- [ ] Shield cards return `shieldApplied = finalValue`
- [ ] Heal cards return `healApplied = min(finalValue, maxHP - hp)`
- [ ] Buff cards return `finalValue` as the percentage buff (stored by turn manager)
- [ ] Debuff cards return weakness status effect with correct duration and value
- [ ] Regen cards return regen status effect (3 turns, value = ceil(finalValue/3))
- [ ] Utility cards return `extraCardsDrawn = 1`
- [ ] Wild cards copy `lastCardType` behavior; default to attack if no previous card
- [ ] `isCardBlocked` returns true when card domain matches enemy immuneDomain
- [ ] Cards blocked by immunity return `targetHit: false` and all zero values
- [ ] No imports from Phaser, Svelte, or DOM APIs

---

## Sub-step 6: Turn Manager (Core Loop)

**File:** `src/services/turnManager.ts`

Orchestrates the full encounter loop: draw phase, card plays, enemy turns, and encounter resolution.

```typescript
import type { Card, CardType } from '../data/cardTypes'
import type { DeckState } from '../services/deckManager'
import type { PlayerCombatState } from './playerCombatState'
import type { EnemyInstance } from '../data/enemies'
import type { CardEffectResult } from './cardEffectResolver'
import type { StatusEffect } from '../data/statusEffects'

/** Phases of a single turn within an encounter. */
export type TurnPhase = 'draw' | 'player_action' | 'enemy_turn' | 'turn_end' | 'encounter_end'

/** Complete state of an ongoing encounter. */
export interface TurnState {
  phase: TurnPhase
  turnNumber: number
  playerState: PlayerCombatState
  enemy: EnemyInstance
  deck: DeckState
  comboCount: number           // Consecutive correct answers this turn
  cardsPlayedThisTurn: number
  /** Percentage buff applied to the next card played (from buff-type cards). Resets each turn. */
  buffNextCard: number
  /** The cardType of the most recently played card (for wild card copying). */
  lastCardType?: CardType
  /** Encounter result. Only set when phase === 'encounter_end'. */
  result?: 'victory' | 'defeat'
  /** Log of effects this turn, for UI animation sequencing. */
  turnLog: TurnLogEntry[]
}

/** A single logged event during a turn, for UI replay. */
export interface TurnLogEntry {
  type: 'card_played' | 'card_fizzled' | 'card_skipped' | 'card_blocked'
      | 'enemy_attack' | 'enemy_buff' | 'enemy_debuff' | 'enemy_heal'
      | 'poison_tick' | 'regen_tick' | 'player_defeated' | 'enemy_defeated'
      | 'phase_transition' | 'combo_milestone'
  /** Human-readable description for debug/UI. */
  message: string
  /** Associated numeric value (damage dealt, HP healed, etc.). */
  value?: number
  /** Card ID if this entry relates to a card play. */
  cardId?: string
}

/** Result of playing a single card. */
export interface PlayCardResult {
  /** The resolved card effect, or null if the card fizzled/was blocked. */
  effect: CardEffectResult | null
  /** Current combo count after this play. */
  comboCount: number
  /** Whether the enemy was defeated by this card. */
  enemyDefeated: boolean
  /** Whether the card fizzled (wrong answer). */
  fizzled: boolean
  /** Whether the card was blocked by enemy immunity. */
  blocked: boolean
  /** Updated turn state. */
  turnState: TurnState
}

/** Result of the enemy's turn. */
export interface EnemyTurnResult {
  /** Total damage dealt to the player (after shield absorption). */
  damageDealt: number
  /** Status effects applied to the player. */
  effectsApplied: StatusEffect[]
  /** Whether the player was defeated. */
  playerDefeated: boolean
  /** The enemy's next telegraphed intent (for display). */
  nextEnemyIntent: string
  /** Updated turn state. */
  turnState: TurnState
}

// ---- Core Functions ----

/**
 * Initialize a new encounter. Sets up turn 1, draws the first hand,
 * rolls the enemy's first intent.
 * @param deck - The player's deck state (from CR-01 DeckManager)
 * @param enemy - A pre-created EnemyInstance (from enemyManager.createEnemy)
 * @param playerMaxHP - Optional custom max HP (default: PLAYER_START_HP)
 * @returns Initial TurnState with phase='player_action' and hand drawn
 */
export function startEncounter(
  deck: DeckState,
  enemy: EnemyInstance,
  playerMaxHP?: number
): TurnState

/**
 * Play a card from the player's hand.
 *
 * Flow:
 * 1. Validate card is in hand
 * 2. Check enemy immunity (isCardBlocked)
 * 3. If answeredCorrectly:
 *    a. Resolve card effect (with combo multiplier and speed bonus)
 *    b. Apply effect results (damage to enemy, shield/heal to player, statuses)
 *    c. Increment combo count
 *    d. Store lastCardType for wild card
 *    e. Set buffNextCard if card was a buff type
 *    f. If utility: draw extra card(s)
 * 4. If answeredIncorrectly:
 *    a. Card fizzles -- discarded with no effect
 *    b. Reset combo count to 0
 * 5. Move card from hand to discard pile
 * 6. Increment cardsPlayedThisTurn
 * 7. Check for encounter end (enemy defeated)
 * 8. Log the event
 *
 * @param turnState - Current encounter state
 * @param cardId - ID of the card to play
 * @param answeredCorrectly - Whether the player answered the card's question correctly
 * @param speedBonusEarned - Whether the answer was within the speed bonus window
 * @returns PlayCardResult with updated state
 */
export function playCard(
  turnState: TurnState,
  cardId: string,
  answeredCorrectly: boolean,
  speedBonusEarned: boolean
): PlayCardResult

/**
 * Skip a card without playing it. No penalty, no effect.
 * Card moves from hand to discard pile.
 * Does NOT reset combo count.
 */
export function skipCard(turnState: TurnState, cardId: string): TurnState

/**
 * End the player's turn and execute the enemy's action.
 *
 * Flow:
 * 1. Execute enemy's telegraphed intent (from enemy.nextIntent)
 * 2. Apply damage to player (takeDamage handles shield absorption)
 * 3. Apply any status effects from enemy intent
 * 4. Tick player status effects (poison, regen)
 * 5. Tick enemy status effects (poison from debuffs, etc.)
 * 6. Reset player turn state (clear shield, reset combo)
 * 7. Roll enemy's next intent
 * 8. Advance turn number
 * 9. Draw new hand
 * 10. Check for encounter end (player defeated)
 *
 * @returns EnemyTurnResult with damage dealt and new state
 */
export function endPlayerTurn(turnState: TurnState): EnemyTurnResult

/**
 * Check whether the encounter has ended.
 * @returns { ended: false, result: 'ongoing' } or { ended: true, result: 'victory'|'defeat' }
 */
export function checkEncounterEnd(
  turnState: TurnState
): { ended: boolean; result: 'victory' | 'defeat' | 'ongoing' }

/**
 * Check if the player's hand is empty (all cards played or skipped).
 */
export function isHandEmpty(turnState: TurnState): boolean

/**
 * Get the number of cards remaining in the player's hand.
 */
export function getHandSize(turnState: TurnState): number
```

### Implementation Notes

- `startEncounter` should create a `PlayerCombatState` via `createPlayerCombatState()`, then call `drawHand(deck)` to populate the hand. Set `phase = 'player_action'`, `turnNumber = 1`.
- `playCard` should use `resolveCardEffect` for effect computation but apply the results itself (call `applyDamageToEnemy`, `applyShield`, `healPlayer`, `applyStatusEffect` as appropriate).
- After a buff card, store the `finalValue` in `turnState.buffNextCard`. The next card played consumes and clears it.
- After a utility card with `extraCardsDrawn > 0`, draw that many additional cards into the hand from the draw pile (using deck manager functions).
- `endPlayerTurn` must handle the full sequence in order. If poison kills the player during `tickPlayerStatusEffects`, set `phase = 'encounter_end'` and `result = 'defeat'`.
- `turnLog` entries should be appended throughout. Clear the log at the start of each new player turn (in the draw phase of `endPlayerTurn`).

### Acceptance Criteria
- [ ] `startEncounter` returns TurnState with phase='player_action', turnNumber=1, hand drawn
- [ ] `playCard` with correct answer resolves effect and increments combo
- [ ] `playCard` with wrong answer fizzles card and resets combo to 0
- [ ] `playCard` with blocked card (enemy immunity) returns `blocked: true`, no effect
- [ ] `playCard` applies buff to the NEXT card, not the current one
- [ ] `skipCard` discards without penalty and does NOT reset combo
- [ ] `endPlayerTurn` executes enemy intent, ticks status effects, draws new hand
- [ ] `endPlayerTurn` rolls new enemy intent for next turn
- [ ] `endPlayerTurn` resets shield and combo count
- [ ] `checkEncounterEnd` returns victory when enemy HP <= 0
- [ ] `checkEncounterEnd` returns defeat when player HP <= 0
- [ ] `isHandEmpty` returns true when hand array is empty
- [ ] Turn log captures all significant events
- [ ] No imports from Phaser, Svelte, or DOM APIs

---

## Sub-step 7: Encounter Rewards

**File:** `src/services/encounterRewards.ts`

Generate post-victory rewards: card choices and currency.

```typescript
import type { Card } from '../data/cardTypes'
import type { Fact } from '../data/types'
import type { EnemyCategory } from '../data/enemies'

/** A set of reward options presented to the player after an encounter victory. */
export interface EncounterRewardOptions {
  /** Card choices (pick 1 of N). */
  cardChoices: Card[]
  /** Currency earned (banked automatically). */
  currencyReward: number
  /** Bonus currency from combo performance. */
  comboBonus: number
}

/**
 * Generate card reward choices after a victorious encounter.
 * Creates N cards from the available fact pool, biased toward:
 * - Facts the player hasn't seen yet (discovery)
 * - Facts from domains the player is weak in
 * - Higher-tier cards on deeper floors
 *
 * @param floor - Current floor number (affects card tier distribution)
 * @param availableFacts - Facts eligible for card creation (not already in deck)
 * @param count - Number of card choices to generate (default: 3)
 * @returns Array of Card objects for the player to choose from
 */
export function generateCardRewards(
  floor: number,
  availableFacts: Fact[],
  count?: number
): Card[]

/**
 * Generate currency reward for an encounter victory.
 * Base reward scales with floor and enemy category.
 *
 * Formula:
 *   base = { common: 10, elite: 25, boss: 50 }[category]
 *   reward = floor(base * (1 + (floor - 1) * 0.15))
 *
 * @param floor - Current floor number
 * @param enemyCategory - The defeated enemy's category
 * @returns Currency amount earned
 */
export function generateCurrencyReward(
  floor: number,
  enemyCategory: EnemyCategory
): number

/**
 * Calculate combo bonus currency.
 * Bonus = maxComboAchieved * 2 (simple scaling).
 *
 * @param maxComboAchieved - Highest combo count reached during the encounter
 * @returns Bonus currency amount
 */
export function generateComboBonus(maxComboAchieved: number): number

/**
 * Build complete reward options for an encounter victory.
 */
export function buildEncounterRewards(
  floor: number,
  enemyCategory: EnemyCategory,
  availableFacts: Fact[],
  maxComboAchieved: number
): EncounterRewardOptions
```

### Implementation Notes

- `generateCardRewards` should create `Card` objects using the card creation function from CR-01. The tier distribution by floor:
  - Floors 1-3: 80% Tier 1, 20% Tier 2
  - Floors 4-6: 50% Tier 1, 40% Tier 2, 10% Tier 3
  - Floors 7-9: 20% Tier 1, 50% Tier 2, 30% Tier 3
  - Floors 10+: 10% Tier 1, 40% Tier 2, 50% Tier 3
- If `availableFacts` is too small, generate as many as possible without duplicates.
- Card domain should match the fact's category mapping (this mapping is defined in CR-01).

### Acceptance Criteria
- [ ] `generateCardRewards` returns exactly `count` cards (default 3)
- [ ] `generateCardRewards` returns fewer cards if `availableFacts` has fewer than `count` entries
- [ ] Cards have appropriate tier distribution for the given floor
- [ ] `generateCurrencyReward` scales with floor: floor 1 common = 10, floor 5 common = 16
- [ ] `generateCurrencyReward` scales with category: boss rewards are 5x common at same floor
- [ ] `generateComboBonus(5)` returns 10
- [ ] `buildEncounterRewards` assembles all three reward components
- [ ] No imports from Phaser, Svelte, or DOM APIs

---

## Sub-step 8: Unit Tests

**File:** `tests/unit/encounter-engine.test.ts`

Comprehensive test suite covering all encounter engine modules.

### Test Groups

**Group 1: Status Effects (`statusEffects.ts`)**
```
- applyStatusEffect adds new effect to empty list
- applyStatusEffect stacks same type (adds value, maxes duration)
- applyStatusEffect adds different types independently
- tickStatusEffects decrements turns and removes expired
- tickStatusEffects returns correct poison damage
- tickStatusEffects returns correct regen heal
- getStrengthModifier returns 1.0 with no effects
- getStrengthModifier returns > 1.0 with strength effect
- getStrengthModifier returns < 1.0 with weakness effect
- isVulnerable returns false with no vulnerable status
- isVulnerable returns true with vulnerable status
```

**Group 2: Enemy Creation and Management (`enemies.ts`, `enemyManager.ts`)**
```
- ENEMY_TEMPLATES contains all 9 defined enemies
- Each template has valid intentPool with positive weights
- createEnemy at floor 1 has HP equal to baseHP
- createEnemy at floor 5 has HP scaled by getFloorScaling(5)
- createEnemy pre-rolls nextIntent
- getFloorScaling returns 1.0 for floor 1
- getFloorScaling returns ~1.96 for floor 9
- rollNextIntent selects from correct phase pool
- rollNextIntent respects weight distribution (run 1000 trials, chi-squared test)
- applyDamageToEnemy reduces HP correctly
- applyDamageToEnemy returns defeated when HP <= 0
- applyDamageToEnemy triggers phase transition for ore_wyrm at 50% HP
- applyDamageToEnemy does not transition below threshold if already in phase 2
- executeEnemyIntent returns correct damage for attack intent
- executeEnemyIntent returns correct multi_attack damage (value * hitCount)
- executeEnemyIntent applies strength modifier to damage
- executeEnemyIntent returns status effects for debuff_player
- executeEnemyIntent heals enemy for heal_self (capped at maxHP)
- tickEnemyStatusEffects applies poison and removes expired
```

**Group 3: Player Combat State (`playerCombatState.ts`)**
```
- createPlayerCombatState defaults to 80 HP
- createPlayerCombatState accepts custom maxHP
- applyShield stacks across multiple calls
- takeDamage absorbs shield first then HP
- takeDamage with shield fully absorbing returns actualDamage 0
- takeDamage with no shield applies full damage to HP
- takeDamage returns defeated when HP <= 0
- healPlayer caps at maxHP
- healPlayer returns actual amount healed
- tickPlayerStatusEffects applies poison through takeDamage
- tickPlayerStatusEffects applies regen healing
- tickPlayerStatusEffects returns defeated if poison kills player
- resetTurnState clears shield, comboCount, cardsPlayedThisTurn
```

**Group 4: Card Effect Resolution (`cardEffectResolver.ts`)**
```
- resolveCardEffect computes finalValue with tier * effectMultiplier
- resolveCardEffect applies combo multiplier from COMBO_MULTIPLIERS
- resolveCardEffect applies speed bonus (1.5x)
- resolveCardEffect applies buffNextCard percentage
- attack card returns damageDealt equal to finalValue
- shield card returns shieldApplied equal to finalValue
- heal card returns healApplied capped at maxHP - hp
- buff card returns finalValue as buff percentage
- debuff card returns weakness status effect
- debuff card with high value also applies vulnerable
- regen card returns regen status (3 turns, ceil(finalValue/3) per turn)
- utility card returns extraCardsDrawn = 1
- wild card copies lastCardType behavior
- wild card defaults to attack when no lastCardType
- isCardBlocked returns true for immune domain match
- isCardBlocked returns false when domains differ
- blocked card returns all-zero effect result
```

**Group 5: Turn Manager — Full Loop (`turnManager.ts`)**
```
- startEncounter creates valid TurnState with hand drawn
- startEncounter sets phase to player_action and turnNumber to 1
- playCard correct answer applies effect and increments combo
- playCard wrong answer fizzles and resets combo to 0
- playCard blocked card returns blocked flag
- playCard increments cardsPlayedThisTurn
- playCard removes card from hand
- playCard buff followed by attack applies buff to attack
- skipCard removes card from hand without combo penalty
- endPlayerTurn executes enemy intent and applies damage
- endPlayerTurn ticks status effects for both sides
- endPlayerTurn resets shield and combo
- endPlayerTurn rolls new enemy intent
- endPlayerTurn draws new hand
- endPlayerTurn advances turnNumber
- full encounter: player defeats weak enemy in 2 turns
- full encounter: enemy defeats player when HP reaches 0
- full encounter: poison kills player during turn end
- full encounter: wild card copies previous attack
- combo counter resets between turns but accumulates within a turn
- turnLog records all significant events
```

**Group 6: Encounter Rewards (`encounterRewards.ts`)**
```
- generateCardRewards returns 3 cards by default
- generateCardRewards returns fewer when pool is small
- generateCurrencyReward scales with floor
- generateCurrencyReward scales with enemy category
- generateComboBonus returns maxCombo * 2
- buildEncounterRewards assembles all components
```

### Test Implementation Notes

- Use `vitest` (already configured in the project).
- For weighted random tests, run 1000+ iterations and verify distribution is within expected bounds (chi-squared or simple percentage check with tolerance).
- Create mock/helper factory functions for Card, EnemyTemplate, DeckState to keep tests concise.
- Import from `src/data/enemies` and `src/services/*` using the project's TypeScript path aliases.
- Each test group should be in a `describe` block.

### Acceptance Criteria
- [ ] All test groups implemented with the listed test cases
- [ ] Tests run with `npx vitest run tests/unit/encounter-engine.test.ts` and pass
- [ ] No flaky tests (weighted random tests use sufficient iterations and reasonable tolerances)
- [ ] Tests do not depend on external state or browser APIs
- [ ] Test helpers/factories are reusable across groups

---

## Verification Gate

All of the following MUST pass before CR-02 is marked complete:

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] `npx vitest run tests/unit/encounter-engine.test.ts` -- all tests pass
- [ ] `npx vitest run` -- existing 215+ tests still pass (no regressions)
- [ ] No file imports Phaser, Svelte, or any DOM/browser API
- [ ] All exported functions have JSDoc comments
- [ ] All interfaces and types are exported
- [ ] Enemy roster matches the spec (4 common, 2 elite, 3 boss)
- [ ] Full turn loop can be executed programmatically: `startEncounter` -> N x `playCard` -> `endPlayerTurn` -> repeat -> victory/defeat

---

## Files Affected

### New Files (7)

| File | Purpose |
|------|---------|
| `src/data/statusEffects.ts` | StatusEffect types and utility functions |
| `src/data/enemies.ts` | EnemyTemplate, EnemyIntent, EnemyInstance types + full roster |
| `src/services/enemyManager.ts` | Enemy creation, intent rolling, damage application |
| `src/services/playerCombatState.ts` | Player combat state management |
| `src/services/cardEffectResolver.ts` | Card effect computation and resolution |
| `src/services/turnManager.ts` | Core turn-based encounter loop |
| `src/services/encounterRewards.ts` | Post-encounter reward generation |
| `tests/unit/encounter-engine.test.ts` | Comprehensive unit test suite |

### Modified Files (0)

No existing files are modified. CR-02 is entirely additive.

### Dependencies (from CR-01, must exist)

| File | What CR-02 imports |
|------|-------------------|
| `src/data/cardTypes.ts` | `Card`, `CardType`, `FactDomain` |
| `src/data/cardBalance.ts` | `HAND_SIZE`, `COMBO_MULTIPLIERS`, `SPEED_BONUS_MULTIPLIER`, `FLOOR_TIMER`, `PLAYER_START_HP`, `TIER_MULTIPLIERS` |
| `src/services/deckManager.ts` | `DeckState`, `drawHand`, `playCard`, `discardCard` |

### Dependencies (existing codebase)

| File | What CR-02 imports |
|------|-------------------|
| `src/data/types.ts` | `Fact`, `Rarity` |
| `src/services/sm2.ts` | (referenced conceptually, not directly imported by encounter engine) |
| `src/services/quizService.ts` | (referenced conceptually -- quiz answering happens in the UI layer, not in the engine) |

# AR-58 — Full Status Effect Icon System (Slay the Spire Style)

## Overview
**Goal:** Display EVERY active buff, debuff, and status effect on both player and enemy as clickable icons — just like Slay the Spire. Currently only `statusEffects[]` (poison, weakness, vulnerable, strength, regen, immunity) show as icons. Many combat-relevant states tracked in TurnState (thorns, empower, double strike, focus, fortify, foresight, slow, overclock) have no visual indicator.

Additionally: clicking ANY icon should open a popup showing ALL active effects on that target with short, natural descriptions (e.g., "6 poison damage at end of turn", "Next card costs -1 AP").

**Dependencies:** AR-56 (StatusEffectBar component exists), AR-57 (all mechanics implemented).
**Estimated complexity:** Medium (extend existing StatusEffectBar to also read TurnState flags).

## What Needs Icons

### From statusEffects[] (already showing — verify)
| Effect | Target | Icon | Description |
|--------|--------|------|-------------|
| poison | both | ☠️ | "{value} poison damage at end of turn" |
| weakness | both | 💧 | "Attacks deal 25% less damage" |
| vulnerable | both | 🎯 | "Takes 50% more damage" |
| strength | enemy | 💪 | "Attacks deal 25% more damage per stack" |
| regen | both | 💚 | "Heals {value} HP at end of turn" |
| immunity | player | 🛡️ | "Absorbs next poison instance" |

### From TurnState (NOT showing yet — must add)
| Flag | Target | Icon | Description |
|------|--------|------|-------------|
| thornsActive | player | 🌿 | "Deals {thornsValue} damage back when hit" |
| buffNextCard > 0 | player | ⚡ | "Next card gets +{value}% effect" |
| doubleStrikeReady | player | ⚔️ | "Next attack hits twice at 60%" |
| focusActive/buffNextCard (from focus) | player | 🔮 | "Next card gets min 1.3x multiplier" |
| foresightTurnsRemaining > 0 | player | 👁️ | "Can see enemy intents {turns} turns ahead" |
| fortifyBlock > 0 | player | 🏰 | "Block persists into next turn" |
| overclockActive | player | ⚙️ | "Next card doubled, draw -1 next turn" |
| slowApplied | enemy | 🐌 | "Skips next defend/buff action" |

## Sub-steps

### 1. Collect ALL active effects into a unified list
- In `CardCombatOverlay.svelte`, create a derived that merges:
  - `turnState.enemy.statusEffects` → enemy effects list
  - `turnState.playerState.statusEffects` → player effects list
  - TurnState flags (thornsActive, buffNextCard, doubleStrikeReady, foresightTurnsRemaining, etc.) → converted to virtual StatusEffect-like objects
- Each virtual effect has: `type`, `value`, `turnsRemaining`, `name`, `description`

**Files:** `src/ui/components/CardCombatOverlay.svelte`
**Acceptance:** Derived lists contain both statusEffects AND turnState flags.

### 2. Extend StatusEffectBar to handle virtual effects
- Update `StatusEffectBar.svelte` to accept both real StatusEffect objects and virtual ones from TurnState
- Add icons and descriptions for all new effect types (thorns, empower, double strike, focus, foresight, fortify, overclock, slow)
- The component should handle any effect type gracefully (fallback icon for unknown types)

**Files:** `src/ui/components/StatusEffectBar.svelte`
**Acceptance:** All active effects show as icons. New types have appropriate emoji icons.

### 3. Change popup to show ALL effects on target
- Currently: tapping one icon shows that icon's info
- New behavior: tapping ANY icon on a target (enemy/player) shows a popup listing ALL active effects on that target
- Popup is a scrollable list with icon + name + description for each effect
- Short, natural language descriptions: "6 poison damage at end of turn", "Next attack hits twice at 60%", "Takes 50% more damage for 2 turns"

**Files:** `src/ui/components/StatusEffectBar.svelte`
**Acceptance:** Tapping any player icon shows full list of all player effects. Same for enemy.

### 4. Generate natural language descriptions
- Each effect needs a short, player-friendly description
- Descriptions are dynamic based on value and turns:
  - "3 poison damage at end of turn (2 turns left)"
  - "Next card deals +30% damage"
  - "Deals 2 damage back when attacked"
  - "Attacks deal 25% less damage (1 turn left)"
- Store description generators in StatusEffectBar or a shared config

**Files:** `src/ui/components/StatusEffectBar.svelte`
**Acceptance:** All descriptions read naturally and include relevant numbers.

### 5. Update GAME_DESIGN.md
- Document the full icon system with all effect types

**Files:** `docs/GAME_DESIGN.md`
**Acceptance:** Doc lists all status effect icons and their meanings.

## Files Affected
| File | Changes |
|------|---------|
| `src/ui/components/CardCombatOverlay.svelte` | Derive unified effect lists from statusEffects + TurnState |
| `src/ui/components/StatusEffectBar.svelte` | Handle virtual effects, all-effects popup, descriptions |
| `docs/GAME_DESIGN.md` | Document icon system |

## Verification Gate
- [ ] Thorns icon appears when thorns card played
- [ ] Empower icon appears when empower card played, disappears after next card
- [ ] Double Strike icon appears, disappears after next attack
- [ ] Foresight icon shows with turn countdown
- [ ] Poison icon on enemy when hex played, on player when enemy debuffs
- [ ] Weakness/vulnerable icons show correctly
- [ ] Strength icon on enemy when it buffs itself
- [ ] Tapping any icon shows ALL effects on that target
- [ ] Descriptions are natural language with correct numbers
- [ ] Icons disappear when effects expire
- [ ] `npm run typecheck` — 0 errors
- [ ] `npx vitest run` — no new failures

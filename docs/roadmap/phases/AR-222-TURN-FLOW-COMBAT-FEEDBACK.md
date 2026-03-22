# AR-222: Turn Flow & Combat Feedback

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #25, #26
> **Priority:** P1 — Game feel and combat juice
> **Complexity:** Large (auto-end turn is simple, but enemy visual feedback is a deep creative AR)
> **Dependencies:** AR-218 (HUD layout), AR-219 (enemy display)

---

## Overview

Two major changes: (1) Auto-end turn when AP is depleted and no quiz is active. (2) Comprehensive enemy action feedback — delay before enemy acts, floating damage/block numbers, visual effects for EVERY enemy action type (buffs, debuffs, attacks, heals, special abilities). This is the "game feel" AR that makes combat visceral and readable.

---

## User's Exact Words

- **#25:** "Turn should end automatically if there's no AP left and there's no quiz popup."
- **#26:** "The enemy should wait a second after our turn is ended to perform its intent, right now it happens immediately. Also, I want to see damage indicators nicely on the screen like 8 in red, or 10 in blue when it blocks etc. We also need visual indicators for when it buffs itself, like the sprite flashing red for strength buff etc. We need to dive deep into all the possible attacks enemies can do, and ultra creatively implement any and all of these for the enemies! Big AR for that one."

---

## Sub-Steps

### 1. Auto-End Turn When No AP
- **What:** If the player has 0 AP remaining AND there is no active quiz popup, automatically end the player's turn.
- **Timing:** Check after each card play resolves. Small delay (300ms) before auto-ending to prevent jarring transitions.
- **Edge cases:**
  - If a card play grants AP (e.g., Quicken), don't auto-end
  - If a quiz popup is active (waiting for answer), don't auto-end
  - If Focus discount makes a card playable at 0 displayed AP, don't auto-end
  - If ALL remaining hand cards cost more AP than available, auto-end (even if AP > 0)
- **Acceptance:** Turn auto-ends when no playable actions remain. No premature endings. Smooth transition.

### 2. Enemy Action Delay
- **What:** After the player's turn ends (manually or auto), add a 1-second pause before the enemy performs its action.
- **During delay:** Enemy sprite can have a subtle "preparing" animation (slight scale-up or lean-forward).
- **Acceptance:** Visible 1-second gap between turn end and enemy action. Feels deliberate, not laggy.

### 3. Floating Damage Numbers
- **What:** When damage is dealt to any target, show a floating number that rises and fades out.
- **Styles:**
  - **Player damage to enemy:** Number in RED, rises from enemy sprite, bold, slight random x-offset for multiple hits
  - **Enemy damage to player:** Number in RED, appears near player HP bar area
  - **Block gained:** Number in BLUE, same floating behavior
  - **Healing:** Number in GREEN
  - **Poison tick damage:** Number in PURPLE/GREEN (poison color)
  - **Burn damage:** Number in ORANGE
  - **Bleed bonus damage:** Number in DARK RED
- **Animation:** Float upward ~60px over 1 second, fade from full opacity to 0. Slight scale-up at start.
- **Multiple simultaneous:** Offset slightly so numbers don't overlap.
- **Acceptance:** All damage/heal/block events produce visible floating numbers. Colors match the type. Smooth animation.

### 4. Enemy Action Visual Effects — Complete Taxonomy
- **What:** Every enemy action type must have a distinct visual effect on the enemy sprite. This is the creative deep-dive the user requested.

#### Attack Actions
| Action | Visual Effect |
|--------|---------------|
| Basic attack | Sprite lunges forward slightly (100ms), screen edge flash red (50ms), return to position |
| Heavy attack | Sprite winds up (lean back 200ms), lunges forward with screen shake (intensity based on damage), brief red vignette |
| Multi-hit | Rapid sprite jitter (2-3 quick lunges), each hit has its own floating number |

#### Buff Actions
| Action | Visual Effect |
|--------|---------------|
| Strength buff | Sprite flashes RED briefly (200ms), subtle red particle burst upward, strength icon pulses |
| Block/Shield | Sprite flashes BLUE (200ms), shield-like blue shimmer around sprite, block icon appears |
| Heal | Sprite flashes GREEN (200ms), green cross particles rising, HP bar fills with smooth animation |
| Enrage | Sprite rapidly grows 5% then returns (pulse), red aura persists for 1 turn, intense red particles |
| Speed/Haste | Brief afterimage effect (ghost copy at 30% opacity trailing behind), yellow flash |

#### Debuff Actions (applied to player)
| Action | Visual Effect |
|--------|---------------|
| Weakness applied | Player HP area flashes orange, "WEAKENED" text floats up from player |
| Vulnerability applied | Player HP area flashes red, cracking visual overlay (brief) |
| Poison applied | Green bubbles rise from player HP bar, PURPLE/GREEN tint flash |
| Burn applied | Orange flame particles burst near player HP area |
| Bleed applied | Red droplets fall from player area |

#### Special/Unique Actions
| Action | Visual Effect |
|--------|---------------|
| Summoning | Sprite glows white, pulsing, particles swirl inward |
| Charging up (multi-turn) | Progressive glow buildup each turn, energy lines converge on sprite |
| Fleeing/Retreating | Sprite shrinks and fades (if applicable) |
| Nothing/Skip | Sprite briefly shows "..." or idle animation intensifies |

### 5. Enemy Sprite Flash System
- **What:** Create a reusable sprite flash system in Phaser that can tint the enemy sprite any color for a specified duration.
- **API:** `flashSprite(color: number, duration: number, intensity: number)`
- **Implementation:** Use Phaser's tint system or a white sprite overlay with blend mode.
- **Acceptance:** Sprite flash works for any color, any duration, composable with other effects.

### 6. Screen Effects
- **What:** Screen-level effects for high-impact moments:
  - **Screen shake:** Configurable intensity (light/medium/heavy). Used for heavy attacks, crits.
  - **Red vignette:** Brief red overlay at screen edges for damage taken. Intensity scales with damage.
  - **Blue flash:** Brief blue edge flash when significant block is gained.
- **Acceptance:** Screen effects trigger appropriately, don't obstruct gameplay, feel impactful.

---

## Files Affected

- `src/services/turnManager.ts` — auto-end turn logic, enemy action delay
- `src/game/systems/EnemySpriteSystem.ts` — sprite flash, lunge animations
- `src/ui/combat/FloatingNumbers.svelte` (NEW) — floating damage/heal/block numbers
- `src/ui/combat/ScreenEffects.svelte` (NEW) — screen shake, vignette, flash
- `src/ui/combat/CardCombatOverlay.svelte` — integrate floating numbers and screen effects
- `src/services/cardEffectResolver.ts` — emit events for floating numbers
- `src/data/enemies/` — enemy action type classification for visual mapping

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Auto-end turn works when 0 AP and no quiz active
- [ ] 1-second delay before enemy action
- [ ] Floating numbers appear for: damage (red), block (blue), heal (green), poison (purple), burn (orange)
- [ ] Enemy sprite flashes on buff (red for strength, blue for block, green for heal)
- [ ] Screen shake on heavy attacks
- [ ] Red vignette on player damage
- [ ] Multiple floating numbers don't overlap
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: add Turn Flow auto-end, Enemy Turn visual feedback system

# AR-222: Turn Flow & Combat Feedback

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #25, #26
> **Priority:** P1 — Game feel and combat juice
> **Complexity:** Large (auto-end turn is moderate, enemy visual feedback is a deep creative AR)
> **Dependencies:** AR-218 (HUD layout), AR-219 (enemy display — provides `enemyLayoutStore` for number positioning)

---

## Overview

Two major changes: (1) Auto-end turn when no playable cards remain and no quiz is active. (2) Comprehensive enemy action feedback — delay before enemy acts, floating damage/block numbers, visual effects for every enemy action type (buffs, debuffs, attacks, heals, special abilities). This is the "game feel" AR that makes combat visceral and readable.

---

## User's Exact Words

- **#25:** "Turn should end automatically if there's no AP left and there's no quiz popup."
- **#26:** "The enemy should wait a second after our turn is ended to perform its intent, right now it happens immediately. Also, I want to see damage indicators nicely on the screen like 8 in red, or 10 in blue when it blocks etc. We also need visual indicators for when it buffs itself, like the sprite flashing red for strength buff etc. We need to dive deep into all the possible attacks enemies can do, and ultra creatively implement any and all of these for the enemies! Big AR for that one."

---

## Worker Notes — Read Before Implementing

These are critical pre-existing systems to extend. Do NOT create parallel duplicates.

- **`DamageNumber.svelte` ALREADY EXISTS** at `src/ui/components/DamageNumber.svelte`. It already supports gold color and critical variant. Extend it with a `type` prop for `'damage' | 'block' | 'heal' | 'poison' | 'burn' | 'bleed'` and a `position` prop for `'enemy' | 'player'`. Do NOT create a separate `FloatingNumbers.svelte`.
- **`ScreenShakeSystem.ts` ALREADY EXISTS** at `src/game/systems/ScreenShakeSystem.ts` with `micro`, `medium`, and `heavy` tiers. It is NOT yet wired to `CombatScene.ts` — wire it in this AR. Replace the raw `cameras.main.shake()` calls that already exist in CombatScene.
- **`CombatScene.ts` ALREADY HAS** most enemy animation methods: `playPlayerDamageFlash()`, `pulseEdgeGlow()`, `pulseFlash()`, `cameras.main.shake()`, `playEnemyAttackAnimation()`, `playEnemyMultiAttackAnimation()`, `playEnemyDefendAnimation()`, `playEnemyBuffAnimation()`, `playEnemyDebuffAnimation()`, `playEnemyHealAnimation()`, `playBlockAbsorbFlash()`. These are already wired in `encounterBridge.ts > handleEndTurn()`. Enhance these methods — do NOT rebuild them from scratch.
- **Red vignette is PARTIALLY IMPLEMENTED** inside `playPlayerDamageFlash()`, which already calls `pulseFlash(COLOR_HP_RED, 0.15, 110)`, `pulseEdgeGlow(COLOR_HP_RED, 0.35, 300)`, and `cameras.main.shake()`. Enhance rather than duplicate.
- **`EnemySpriteSystem.ts`** has `playAttack()`, `playHit()`, a tint system, and an enrage system. Add the colored-flash helper here.
- **`WeaponAnimationSystem.ts`** has sword slash, tome cast, and shield raise animations.
- **Enemy action delay** belongs in `encounterBridge.ts > handleEndTurn()`. The delay should be wrapped with `turboDelay()` to respect turbo mode. Game state (HP, block) is resolved synchronously before animations — consider whether to delay HP bar updates alongside animation calls to avoid a visible HP-jump-before-animation issue.
- **Floating number positioning** at the enemy sprite requires a Phaser-to-Svelte coordinate bridge. Use `enemyLayoutStore` from AR-219 for the enemy's screen position. Do not read private CombatScene fields directly.
- **Sprite flash colored tints:** Phaser's `setTint()` multiplies with the texture color, which produces muddy results on colored sprites. Use an additive overlay rectangle (same pattern as the existing enrage glow rect in EnemySpriteSystem) for clean colored flashes.
- Do NOT create `FloatingNumbers.svelte` or `ScreenEffects.svelte` as separate new components.

---

## Sub-Steps

### 1. Auto-End Turn When No Playable Cards Remain

**What:** After each card play resolves, check whether any card in hand is still playable. If none are and no quiz popup is active, auto-end the player's turn after a short delay.

**Trigger point:** `CardCombatOverlay.svelte` — after each `handlePlayCard` call resolves, call a new `checkAutoEndTurn()` function defined in the same file.

**New helper required:** Add `isAnyCardPlayable(turnState): boolean` to `src/services/turnManager.ts`. This function must account for:
- Current AP vs. card costs
- Focus discount (reduces effective cost)
- `warcryFreeChargeActive` flag (makes charge cards cost 0 AP)
- `nextChargeFree` flag (next charge card costs 0 AP)
- `battleTranceRestriction` (AR-207) — if active and no quiz is pending, treat hand as unplayable

**Quiz-active check:** In `CardCombatOverlay.svelte`, check `cardPlayStage === 'committed'` to determine whether a quiz popup is active before auto-ending.

**Delay:** 300ms before calling `onendturn()` to prevent jarring transitions. Use `turboDelay()` wrapper.

**Edge cases:**
- Card play grants AP (e.g., Quicken) — re-evaluate playability after state updates, not before
- Quiz popup is open — do not auto-end under any circumstances
- Focus discount or warcry makes a card playable at 0 displayed AP — do not auto-end
- `battleTranceRestriction` active AND no quiz — auto-end immediately (no cards can be played anyway)

**Files:** `src/services/turnManager.ts` (new `isAnyCardPlayable()`), `src/ui/components/CardCombatOverlay.svelte` (new `checkAutoEndTurn()`, import and call after `handlePlayCard`)

**Acceptance:** Turn auto-ends when no playable actions remain. No premature endings during quiz. Smooth 300ms transition. Turbo mode shortens or eliminates delay.

---

### 2. Enemy Action Delay

**What:** After the player's turn ends (manually or via auto-end), add a visible pause before the enemy executes its action. The gap should feel deliberate, not laggy.

**Implementation:** In `encounterBridge.ts > handleEndTurn()`, wrap the `scene.play*Animation()` call sequence in a `turboDelay(1000)` (1 second in normal mode, reduced or zero in turbo). Game state (damage, block, status effects) is already resolved synchronously before this point.

**HP bar timing:** Because state resolves before animations, HP bars would otherwise update instantly and then the animation plays — creating a visible HP-jump-before-hit. Consider whether to buffer the HP bar store update until after the animation fires, or to accept the current behavior if it reads as acceptable. Document the decision in code comments.

**During delay (optional enhancement):** Enemy sprite plays a subtle "preparing" state — slight scale pulse (1.0 → 1.05 → 1.0 over 600ms) via a new `playPreparing()` method on `EnemySpriteSystem`. Skip in turbo mode.

**Files:** `src/services/encounterBridge.ts` (wrap animation calls with `turboDelay()`), `src/game/systems/EnemySpriteSystem.ts` (optional `playPreparing()`)

**Acceptance:** Visible ~1-second gap between turn end and enemy action in normal mode. Turbo mode bypasses or minimizes delay. No state desync.

---

### 3. Floating Damage / Block / Heal Numbers

**What:** Extend the existing `DamageNumber.svelte` component (at `src/ui/components/DamageNumber.svelte`) to support all combat event types. Show floating numbers for every damage, block, heal, and status-effect-tick event.

**Extend `DamageNumber.svelte` with:**
- `type` prop: `'damage' | 'block' | 'heal' | 'poison' | 'burn' | 'bleed'` (keep existing `'critical'` and `'gold'` variants)
- `position` prop: `'enemy' | 'player'` — controls where the number anchors on screen
- Color mapping by type:
  - `damage` → RED (`#FF4444`)
  - `block` → BLUE (`#4499FF`)
  - `heal` → GREEN (`#44FF88`)
  - `poison` → PURPLE (`#AA44FF`)
  - `burn` → ORANGE (`#FF8833`)
  - `bleed` → DARK RED (`#CC1111`)

**Positioning:**
- Enemy-position numbers: use `enemyLayoutStore` (from AR-219) to get the enemy sprite's screen coordinates. Numbers float upward from the sprite center with a small random x-offset (±20px) to prevent stacking.
- Player-position numbers: anchor near the player HP bar area in the HUD.

**Animation:** Float upward ~60px over 900ms, fade from full opacity to 0. Slight scale-up (1.0 → 1.2) in first 100ms. Multiple simultaneous numbers offset by 20px horizontal jitter so they don't stack.

**Emit points:** Numbers must be triggered from `encounterBridge.ts` or `cardEffectResolver.ts` — wherever the resolved delta values are available. Use a Svelte store event (`damageNumberStore` or similar) that `CardCombatOverlay.svelte` subscribes to and renders.

**Files:** `src/ui/components/DamageNumber.svelte` (extend existing), `src/ui/components/CardCombatOverlay.svelte` (subscribe to event store, render numbers), `src/services/encounterBridge.ts` or `src/services/cardEffectResolver.ts` (emit events with value + type + target)

**Acceptance:** All damage/heal/block events produce visible floating numbers. Colors match the type. Numbers don't stack on top of each other. Smooth animation. Works for both enemy and player targets.

---

### 4. Enemy Action Visual Effects — Complete Taxonomy

**What:** Every enemy action type must have a distinct, readable visual effect. Enhance the existing methods in `CombatScene.ts` and `EnemySpriteSystem.ts` — do NOT rebuild from scratch.

#### Attack Actions

| Action | Visual Effect |
|--------|---------------|
| Basic attack | `playEnemyAttackAnimation()` — sprite lunges forward ~30px (100ms), triggers red edge flash, returns to position |
| Heavy attack | Wind-up: lean back 200ms (scale x slight squash), then fast lunge forward with `ScreenShakeSystem.medium()`, brief red vignette via `pulseEdgeGlow()` |
| Multi-hit | `playEnemyMultiAttackAnimation()` — 2-3 rapid short lunges in sequence, each produces its own floating damage number |

#### Buff Actions (on enemy)

| Action | Visual Effect |
|--------|---------------|
| Strength buff | `playEnemyBuffAnimation()` — colored additive overlay rectangle pulses RED (200ms), not raw `setTint()`. Strength icon in intent area pulses. |
| Block / Shield | `playEnemyDefendAnimation()` — overlay pulses BLUE, shield shimmer, block number floats in BLUE |
| Heal | `playEnemyHealAnimation()` — overlay pulses GREEN, HP bar fill animates smoothly, green heal number floats |
| Enrage | Sprite rapidly scales 1.0 → 1.08 → 1.0 (pulse), red additive overlay aura persists for the turn, enrage glow rect (existing system) activates |
| Speed / Haste | Ghost afterimage: render a 30%-opacity copy of the sprite offset -20px for 400ms, yellow overlay flash |

#### Debuff Actions (applied to player)

| Action | Visual Effect |
|--------|---------------|
| Weakness applied | Player HP bar area flashes ORANGE, "WEAKENED" text floats upward as a DamageNumber-style label |
| Vulnerability applied | Player HP bar area flashes RED, short cracking visual (brief red grid overlay at 20% opacity) |
| Poison applied | `pulseEdgeGlow()` in green/purple, PURPLE floating DamageNumber shows stack count |
| Burn applied | `pulseEdgeGlow()` in orange, ORANGE floating DamageNumber shows stack count |
| Bleed applied | DARK RED edge pulse, red droplets particle effect near player HP area |

#### Special / Unique Actions

| Action | Visual Effect |
|--------|---------------|
| Summoning | Sprite glows white (additive overlay), particles swirl inward for 600ms, flash at spawn moment |
| Charging up (multi-turn) | `playEnemyBuffAnimation()` with progressive intensity each turn — glow rect opacity increases each charge turn |
| Defend / Brace | `playEnemyDefendAnimation()` — shield-raise animation (WeaponAnimationSystem has shield raise), blue shimmer |
| Nothing / Stagger / Skip | Sprite briefly shows a "..." floating label via DamageNumber text variant; idle animation intensifies (slight sway) |

**Implementation note on colored flashes:** Use an additive overlay rectangle (same approach as the existing enrage glow rect in `EnemySpriteSystem.ts`) rather than Phaser's `setTint()`. This prevents muddy color multiplication on colored sprite textures and produces clean additive color overlays.

**Files:** `src/game/scenes/CombatScene.ts` (enhance existing `play*Animation()` methods), `src/game/systems/EnemySpriteSystem.ts` (add overlay-based flash helpers, optional `playPreparing()`), `src/services/encounterBridge.ts` (call correct animation based on action type)

**Acceptance:** Every enemy action type has a visually distinct effect. No action is silent. Effects are readable and do not obscure the sprite permanently.

---

### 5. Enemy Sprite Colored-Flash Helper

**What:** Add a reusable `flashColor(color: number, duration: number, intensity: number)` method to `EnemySpriteSystem.ts`. This is used by the taxonomy effects above.

**Implementation:** Use an additive-blend overlay rectangle (Phaser `Graphics` object positioned over the sprite, blend mode `Phaser.BlendModes.ADD`), not `setTint()`. Tweens the rectangle alpha from `intensity` to 0 over `duration` ms, then destroys it. Multiple concurrent flashes are allowed (each creates its own rectangle).

**API:**
```ts
flashColor(color: number, duration: number, intensity: number): void
```

**Files:** `src/game/systems/EnemySpriteSystem.ts`

**Acceptance:** Flash works for any color without muddying the sprite's own colors. Multiple simultaneous flashes don't conflict. Method is composable with existing lunge and tint animations.

---

### 6. Screen Effects — Wire ScreenShakeSystem, Enhance Vignette

**What:** Wire `ScreenShakeSystem.ts` into `CombatScene.ts` to replace raw `cameras.main.shake()` calls. Enhance the already-partially-implemented vignette and edge-glow effects.

**ScreenShakeSystem wiring:**
- Import and instantiate `ScreenShakeSystem` in `CombatScene.ts`
- Replace all direct `cameras.main.shake(...)` calls with `screenShakeSystem.micro()`, `.medium()`, or `.heavy()` based on impact severity
- Existing tiers: `micro` (light card play feedback), `medium` (standard attack), `heavy` (boss hit, crits)
- Add a `blue` edge flash path in `pulseEdgeGlow()` or a new `pulseEdgeGlowBlue()` for block events — currently only red is used

**Red vignette (already partially implemented in `playPlayerDamageFlash()`):**
- Already calls `pulseFlash(COLOR_HP_RED, 0.15, 110)` and `pulseEdgeGlow(COLOR_HP_RED, 0.35, 300)` and `cameras.main.shake()`
- Enhancement: scale intensity based on damage-to-max-HP ratio (heavy hit = stronger vignette). Pass damage fraction as a parameter to `playPlayerDamageFlash(damageFraction: number)`.

**Blue edge flash (new):**
- Trigger on significant block gain (e.g., block >= 5 in one event)
- Use `pulseEdgeGlow(COLOR_BLOCK_BLUE, 0.25, 250)` or equivalent

**Files:** `src/game/scenes/CombatScene.ts` (wire ScreenShakeSystem, parameterize `playPlayerDamageFlash`, add blue edge flash), `src/game/systems/ScreenShakeSystem.ts` (no structural changes expected — just being wired)

**Acceptance:** Screen shake uses ScreenShakeSystem tiers (not raw camera shake). Red vignette intensity scales with damage. Blue edge flash triggers on significant block. No Phaser console errors from the wiring.

---

## Files Affected

| File | Change |
|------|--------|
| `src/services/turnManager.ts` | Add `isAnyCardPlayable(turnState): boolean` |
| `src/ui/components/CardCombatOverlay.svelte` | Add `checkAutoEndTurn()`, subscribe to floating-number event store, render DamageNumber components |
| `src/ui/components/DamageNumber.svelte` | Extend with `type` and `position` props, color mapping for all event types |
| `src/services/encounterBridge.ts` | Wrap animation calls with `turboDelay(1000)`, emit floating-number events, call correct animation per action type |
| `src/game/scenes/CombatScene.ts` | Wire `ScreenShakeSystem`, replace raw shake calls, parameterize `playPlayerDamageFlash(damageFraction)`, add blue edge flash |
| `src/game/systems/EnemySpriteSystem.ts` | Add `flashColor()` additive overlay helper, optional `playPreparing()` |
| `src/game/systems/ScreenShakeSystem.ts` | No structural changes — wired to CombatScene (was orphaned) |
| `src/services/cardEffectResolver.ts` | Emit floating-number events at damage/block/heal resolution points |
| `docs/GAME_DESIGN.md` | Add Turn Flow auto-end section, Enemy Turn Visual Feedback system |

**Do NOT create:**
- `src/ui/combat/FloatingNumbers.svelte` — use existing `DamageNumber.svelte`
- `src/ui/combat/ScreenEffects.svelte` — screen effects live in CombatScene and ScreenShakeSystem

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (1900+ tests)
- [ ] Auto-end turn fires after card play when no cards are playable and no quiz is active
- [ ] Auto-end does NOT fire when a quiz popup is open (`cardPlayStage === 'committed'`)
- [ ] Auto-end accounts for Focus discount, `warcryFreeChargeActive`, `nextChargeFree`, `battleTranceRestriction`
- [ ] Auto-end respects turbo mode delay
- [ ] ~1-second pause visible between player turn end and enemy action (normal mode)
- [ ] Turbo mode reduces or eliminates enemy action delay
- [ ] Floating numbers appear for: player damage to enemy (red), enemy damage to player (red), block gained (blue), heal (green), poison (purple), burn (orange), bleed (dark red)
- [ ] Multiple simultaneous floating numbers do not overlap (jitter offset applied)
- [ ] Floating numbers position correctly relative to enemy sprite (via `enemyLayoutStore`) and player HP bar
- [ ] Enemy sprite flashes correct color for each action type (via additive overlay, not raw tint)
- [ ] Screen shake uses `ScreenShakeSystem` tiers — no raw `cameras.main.shake()` calls remain in CombatScene
- [ ] Red vignette on player damage — intensity scales with damage fraction
- [ ] Blue edge flash on significant block gain
- [ ] `docs/GAME_DESIGN.md` updated with auto-end turn and enemy feedback system documentation
- [ ] Visual inspection via Playwright screenshot confirms floating numbers render, effects trigger, no visual regressions

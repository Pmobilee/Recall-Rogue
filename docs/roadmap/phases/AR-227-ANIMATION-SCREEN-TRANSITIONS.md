# AR-227: Animation & Screen Transition Polish

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #39, #41
> **Priority:** P2 — Polish/feel
> **Complexity:** Medium (animation scaling fix + entry animation additions)
> **Dependencies:** AR-218, AR-219 (layout changes affect animation positioning)

---

## Overview

Two animation issues: (1) The sword/attack animation is oversized and mispositioned in landscape mode because it scales relative to viewport width instead of the enemy sprite. (2) Every screen needs a walk-in entry animation, but non-combat rooms must NOT have exit animations.

---

## User's Exact Words

- **#39:** "The sword animation was great in portrait but really weird in landscape, it's also gigantic so scale it to what it is in portrait mode, and move it down and keep it relative to the enemy at all time no matter where it moves."
- **#41:** "EVERY SINGLE SCREEN must have a walk in animation. But mystery, reward, victory, descent rooms etc, non-combat rooms, must NOT have an exit animation."

---

## Key Architecture Facts

- **Sword animation:** `src/game/systems/WeaponAnimationSystem.ts`
  - Entry point: `playSwordSlash(enemyX, enemyY)` — accepts enemy coordinates but does NOT use them for positioning
  - Actual position: hardcoded as `handleX = w * 0.7`, `handleY = this.displayH * 0.88` (viewport-relative, ignores parameters)
  - Scale: `w / BASE_WIDTH` where `BASE_WIDTH` is a constant — scales with viewport width, so the sword becomes much larger in landscape (wider viewport) relative to the enemy sprite
- **Combat scene call site:** `src/game/scenes/CombatScene.ts` line ~1389 — `weaponAnimations.playSwordSlash(this.getEnemyX(), this.currentEnemyY)`
- **Enemy sprite bounds:** Use `EnemySpriteSystem.getContainer().getBounds()` to get the enemy's actual rendered bounding box for scale reference
- **Screen routing:** `src/ui/components/CardApp.svelte` — main screen router, controls which screen components are rendered. Entry animations go here as Svelte `transition:` directives on screen wrapper elements.
- **Screen flow orchestration:** `src/services/gameFlowController.ts`
- NO `src/services/screenManager.ts` exists. NO `src/ui/transitions/` directory exists.

---

## Sub-Steps

### 1. Sword Animation — Landscape Scaling Fix

- **Root cause:** `playSwordSlash()` accepts `(enemyX, enemyY)` parameters but hardcodes the actual draw position to `handleX = w * 0.7` and `handleY = this.displayH * 0.88`. Scale uses `w / BASE_WIDTH`, which inflates the sword in landscape because the viewport is wider.
- **Fix in `src/game/systems/WeaponAnimationSystem.ts`:**
  - Use the `enemyX` and `enemyY` parameters passed in to set the sword's draw position (they are already the correct enemy-relative coordinates — CombatScene passes `this.getEnemyX()` and `this.currentEnemyY`)
  - Replace viewport-width scale (`w / BASE_WIDTH`) with enemy-sprite-relative scale: call `EnemySpriteSystem.getContainer().getBounds()` to get the enemy's rendered height/width, then compute sword size as a fixed percentage of that bounding box
  - The animation must play at the enemy's position at the moment of the card play — it does NOT track the enemy during idle bob
- **Scope:** The same scaling fix must be applied to ALL attack animations, not just the sword:
  - Sword (Strike cards)
  - Shield effects (Block cards)
  - Spell effects (Debuff/Buff cards)
  - Any other card-play visual effects in `WeaponAnimationSystem.ts`
- **Acceptance:** Attack animations are correctly sized in both portrait and landscape — visually the same relative size as portrait. Sword lands on the enemy position, not a hardcoded viewport coordinate. Verified via Playwright screenshot in landscape (1920x1080) AND portrait.

### 2. Screen Entry Animations — Every Screen

- **What:** EVERY screen transition must have a visible walk-in / entry animation. None may be an instant cut.
- **Where:** `src/ui/components/CardApp.svelte` — add Svelte `transition:` directives (e.g., `transition:fade` or `transition:fly`) on the wrapper element for each screen component rendered in the router.
- **Style:** Fade-in combined with a slight slide-up (translateY from ~8px to 0). Duration: 300–500ms. Keep it snappy — this is a game, not a web page.
- **Screens that need entry animations (verify each exists; add if missing):**
  - Combat
  - Shop
  - Rest Site
  - Mystery Room
  - Reward Room
  - Treasure Room
  - Victory Screen
  - Defeat Screen
  - Map Screen
  - Descent/Delve Screen
  - Boss Intro
- **Acceptance:** Every screen in the list above has a visible entry animation. None are instant cuts. Verified via Playwright — navigate to each screen and confirm the animation plays on arrival.

### 3. Non-Combat Rooms — No Exit Animation

- **What:** Non-combat rooms must NOT play any exit animation when leaving. The transition out should be instant (or at most a very brief fade — no elaborate sequences).
- **Where:** `src/ui/components/CardApp.svelte` — use Svelte's `out:` vs `in:` transition split. Apply `in:` (entry) animations to all screens, but only apply `out:` (exit) animations to combat.
- **Rooms with NO exit animation (instant cut out):**
  - Mystery Room
  - Reward Room
  - Treasure Room
  - Victory Screen
  - Descent/Delve Screen
  - Rest Site
  - Shop
- **Rooms that KEEP exit animations:**
  - Combat (existing combat-end sequence stays)
- **Acceptance:** Navigating away from any non-combat room is instant or near-instant. No animation plays on exit. Combat exit sequence is unaffected.

---

## Files Affected

- `src/game/systems/WeaponAnimationSystem.ts` — sword/attack animation position and scale fix
- `src/game/systems/EnemySpriteSystem.ts` — read enemy bounding box for scale reference
- `src/game/scenes/CombatScene.ts` — verify call site at ~line 1389 passes correct coordinates (no change expected, but confirm)
- `src/ui/components/CardApp.svelte` — add Svelte `in:`/`transition:` entry animations per screen; restrict `out:` to combat only

> NOTE: There is NO `src/services/screenManager.ts` and NO `src/ui/transitions/` directory. Screen transition logic belongs in `src/ui/components/CardApp.svelte` using Svelte's built-in transition directives.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] Sword animation correctly sized in landscape (matches portrait visual size relative to enemy)
- [ ] Sword animation positioned at enemy coordinates, not hardcoded viewport position
- [ ] All attack animation variants (sword, shield, spell) use enemy-relative scale
- [ ] Every screen in the list has a visible entry animation (Playwright screenshot per screen)
- [ ] Non-combat rooms (mystery, reward, rest, shop, victory, defeat, map, descent) have NO exit animation
- [ ] Combat exit sequence is unaffected
- [ ] Update `docs/GAME_DESIGN.md` section: Screen Transitions, Attack Animations

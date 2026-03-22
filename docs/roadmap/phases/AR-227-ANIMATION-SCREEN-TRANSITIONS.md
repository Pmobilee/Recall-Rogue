# AR-227: Animation & Screen Transition Polish

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #39, #41
> **Priority:** P2 — Polish/feel
> **Complexity:** Medium (animation scaling fix + entry/exit animation audit)
> **Dependencies:** AR-218, AR-219 (layout changes affect animation positioning)

---

## Overview

Two animation issues: (1) The sword/attack animation is oversized and mispositioned in landscape mode. (2) Every screen needs a walk-in animation, but non-combat rooms must NOT have exit animations.

---

## User's Exact Words

- **#39:** "The sword animation was great in portrait but really weird in landscape, it's also gigantic so scale it to what it is in portrait mode, and move it down and keep it relative to the enemy at all time no matter where it moves."
- **#41:** "EVERY SINGLE SCREEN must have a walk in animation. But mystery, reward, victory, descent rooms etc, non-combat rooms, must NOT have an exit animation."

---

## Sub-Steps

### 1. Sword Animation — Landscape Scaling Fix
- **What:** The sword (Strike) attack animation is designed for portrait mode and appears oversized in landscape.
- **Fix:**
  - Scale the sword animation to match its visual size in portrait mode (relative to the enemy sprite, not the viewport)
  - Position it relative to the enemy sprite's center/position, so it always hits the enemy regardless of enemy position
  - The animation must NOT move with the enemy during idle bob/other animations — it plays at the enemy's current static position
- **Scope:** This applies to ALL attack animations, not just the sword:
  - Sword (Strike)
  - Shield effects (Block)
  - Spell effects (Debuff/Buff)
  - Any other card-play animations
- **Method:** Use the enemy sprite's bounding box to calculate scale. Animation size = percentage of enemy size, not viewport size.
- **Acceptance:** Attack animations are correctly sized in both portrait and landscape. Positioned on the enemy. Not oversized.

### 2. Screen Entry Animations — Every Screen
- **What:** EVERY screen transition must have a walk-in/entry animation.
- **Screens that need entry animations (add if missing):**
  - Combat (exists? verify)
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
- **Style:** Fade-in + slight slide-up (or screen-specific thematic entry). 300-500ms duration.
- **Acceptance:** Every screen has a visible entry animation. None are instant cuts.

### 3. Non-Combat Rooms — No Exit Animation
- **What:** Non-combat rooms must NOT play an exit animation when leaving.
- **Rooms with NO exit animation:**
  - Mystery Room
  - Reward Room
  - Treasure Room
  - Victory Screen
  - Descent Screen
  - Rest Site (debatable — check with user if needed)
  - Shop
- **Rooms that KEEP exit animations:**
  - Combat (combat-end sequence)
- **Acceptance:** Non-combat rooms transition out instantly (or with minimal fade). No elaborate exit sequences.

---

## Files Affected

- `src/game/systems/AttackAnimationSystem.ts` or equivalent — animation scaling
- `src/game/systems/EnemySpriteSystem.ts` — enemy position reference for animations
- `src/ui/screens/*.svelte` — entry/exit animation additions
- `src/ui/transitions/` — shared transition components
- `src/services/screenManager.ts` or equivalent — transition orchestration

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Sword animation correctly sized in landscape (matches portrait visual size)
- [ ] Attack animation positioned on enemy, not viewport-relative
- [ ] Every screen has entry animation (verified via Playwright)
- [ ] Non-combat rooms have NO exit animation
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: Screen transitions

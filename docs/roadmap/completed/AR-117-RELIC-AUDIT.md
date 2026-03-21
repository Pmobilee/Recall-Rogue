# AR-117: Full Relic Audit — Validate Every Relic Effect

## Overview
Every single relic in the game needs to be tested and validated. Several relics may be silently broken — effects not triggering, wrong values applied, or visual feedback missing.

**Complexity**: Large
**Priority**: Critical — broken relics undermine player trust in the reward system.

## Approach
1. List ALL relics with their expected effects
2. For each relic, write or verify a unit test
3. For each relic, verify visually in combat (Playwright or device)
4. Fix any broken relics
5. Verify relic descriptions match actual effects

## Sub-steps
1. Export complete relic list from `src/data/relics/` (starter, unlockable, boss relics)
2. Cross-reference with `relicEffectResolver.ts` — every relic ID must have a corresponding effect handler
3. Write unit tests for each trigger condition (ON_TURN_START, ON_CARD_PLAYED, ON_DAMAGE_TAKEN, etc.)
4. Run headless sim with each relic equipped to verify stats change
5. Fix any missing/broken effect handlers
6. Update relic descriptions to match actual behavior

## Files Affected
- `src/data/relics/starter.ts`
- `src/data/relics/unlockable.ts`
- `src/data/relics/boss.ts`
- `src/services/relicEffectResolver.ts`
- `tests/unit/relicEffectResolver.test.ts` (new/updated)

## Verification Gate
- [ ] Every relic has a passing unit test
- [ ] Headless sim confirms stat changes for each relic
- [ ] Visual verification for UI-affecting relics (extra draw, heal on kill, etc.)
- [ ] Relic descriptions match actual effects

# AR-98: Enemy Variety & Encounter Tuning

## Overview

Four changes to improve enemy variety and encounter diversity across runs.

## Changes

### 1. Increase Elite Encounter Rate (35% → 50%)

**File:** `src/data/balance.ts`

Find `ELITE_ENCOUNTER_CHANCE` or `CHALLENGE_MODE_CHANCE` (or whatever constant controls the 35% elite roll). Change to 50%.

Elites are the most interesting combat encounters — they're tougher, grant relic rewards, and test different strategies. At 35%, most players rarely see them. At 50%, elites become a regular part of the experience.

### 2. Boss Rotation (No Same Boss Twice in a Row)

**File:** `src/services/encounterBridge.ts` or `src/services/floorManager.ts`

Currently, boss selection picks from a hardcoded map (e.g., floor 3 → The Excavator). Boss alternates exist but are rarely rolled.

**Change:** Track the last boss fought (per act) in the run save or player save. On boss encounter, exclude the last-fought boss for that act and pick randomly from the remaining pool.

```typescript
function getBossForFloor(floor: number, lastBossId?: string): EnemyTemplate {
  const pool = ACT_ENEMY_POOLS[act].bosses;
  const filtered = lastBossId ? pool.filter(b => b.id !== lastBossId) : pool;
  return filtered.length > 0 ? seededRandom(filtered) : seededRandom(pool);
}
```

Store `lastBossIds: Record<number, string>` in player save (per act number).

### 3. Clean Up Legacy Region/Act Mismatch

**File:** `src/services/floorManager.ts`

The legacy `getRegionForFloor()` maps floors differently than the V2 act system:
- Legacy: floors 1-6 = shallow, 7-12 = deep_caverns, 13-18 = abyss, 19+ = archive
- V2: Act 1 = floors 1-4, Act 2 = 5-8, Act 3 = 9-12

**Change:** Update `getRegionForFloor()` to match the V2 act boundaries:
```typescript
function getRegionForFloor(floor: number): EnemyRegion {
  if (floor <= 4) return 'shallow_depths';
  if (floor <= 8) return 'deep_caverns';
  if (floor <= 12) return 'the_archive';
  return 'the_abyss'; // endless mode
}
```

Remove or deprecate the old 1-6/7-12/13-18/19+ mapping. Ensure all enemy selection paths use the V2 act pools as primary, with region fallback only for edge cases.

### 4. Add More Act 1 Common Variety

**File:** `src/data/enemies.ts`

Act 1 has 11 commons vs Act 2's 24. Add 3-4 more common enemies to Act 1 to improve early-game variety:

Suggested new Act 1 commons (simple enemies that teach basic mechanics):
- **Dust Mite** — Low HP (12), fast attacks (6 dmg), teaches "kill fast"
- **Stalactite Bat** — Alternates between attack and defend, teaches reading intents
- **Glow Worm** — Heals 3 HP per turn, teaches "burst damage before they heal"
- **Rock Crab** — High block (gains 8 block every 2 turns), low attack, teaches "use debuffs"

For each new enemy:
- Add to `ENEMY_TEMPLATES` with appropriate stats
- Add to `ACT_ENEMY_POOLS.act1.commons`
- Create a simple intent pool (attack, defend, buff patterns)
- No sprite needed yet (use placeholder or existing similar sprite)

## Acceptance Criteria

- [ ] Elite encounter rate = 50%
- [ ] Boss rotation prevents same boss twice in consecutive runs
- [ ] `getRegionForFloor()` matches V2 act boundaries
- [ ] Act 1 has 14-15 common enemies (was 11)
- [ ] All existing encounters still work
- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` passes (enemy-related tests)

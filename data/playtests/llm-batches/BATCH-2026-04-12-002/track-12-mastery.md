# Track 12 — Card Mastery Level Scaling
## Verdict: PASS (with methodology gotcha documented)

Verified card mastery stat tables (L0-L5) via Docker warm container (track-12) using `spawn` + `patch` approach. All observed values match `MASTERY_STAT_TABLES` in `src/services/cardUpgradeService.ts`.

---

## Mastery Scaling Table — Core Mechanics (QP = Quick Play value)

### strike (ap: 1 at all levels)
| L0 | L1 | L2 | L3 | L4 | L5 | AP Changes? |
|----|----|----|----|----|----|----|
| 4  | 4  | 5  | 6  | 7  | 8  | No (always 1 AP) |

Source table: ✓ matches. Monotonic: ✓ (plateau at L0→L1, then climbs).

### heavy_strike (ap: 2 → 1 at L5)
| L0 | L1 | L2 | L3 | L4 | L5 | AP Changes? |
|----|----|----|----|----|----|----|
| 7  | 8  | 9  | 10 | 11 | 12 | YES: ap:2 L0-L4, ap:1 at L5 |

Source table: ✓ matches. Monotonic: ✓. AP reduction at L5: ✓ CONFIRMED.

### block (ap: 1 at all levels)
| L0 | L1 | L2 | L3 | L4 | L5 | AP Changes? |
|----|----|----|----|----|----|----|
| 4  | 4  | 5  | 6  | 7  | 8  | No (always 1 AP) |

Source table: ✓ matches. Monotonic: ✓ (plateau at L0→L1, then climbs).

### multi_hit (ap: 2 at all levels; hitCount scales but not visible via getCombatState)
| L0 | L1 | L2 | L3 | L4 | L5 | AP Changes? |
|----|----|----|----|----|----|----|
| 2  | 2  | 2  | 2  | 2  | 3  | No (always 2 AP) |

Source table: ✓ matches (L5 qp jumps to 3). hitCount (2→3 at L1, 4 at L4) not exposed via getCombatState — internal only. Monotonic: ✓ (flat with L5 jump, by design).

### lifetap (ap: 2 → 1 at L5)
| L0 | L1 | L2 | L3 | L4 | L5 | AP Changes? |
|----|----|----|----|----|----|----|
| 5  | 5  | 5  | 6  | 7  | 8  | YES: ap:2 L0-L4, ap:1 at L5 |

Source table: ✓ matches. Monotonic: ✓ (plateau L0-L2, then climbs). AP reduction at L5: ✓ CONFIRMED.

---

## AP-Reduction Mechanics Sweep (L0 / L3 / L5)

| Mechanic | L0 qp | L0 ap | L3 qp | L3 ap | L5 qp | L5 ap | Expected L5 ap |
|----------|-------|-------|-------|-------|-------|-------|----------------|
| chain_lightning | 4 | 2 | 5 | 2 | 6 | 1 | 1 ✓ |
| fortify | 5 | 2 | 8 | 2 | 10 | 1 | 1 ✓ |
| smite | 7 | 2 | 10 | 2 | 12 | 1 | 1 ✓ |
| guard | 8 | 2 | 11 | 2 | 14 | 1 | 1 ✓ |
| overheal | 6 | 2 | 8 | 1 | 9 | 1 | 1 ✓ (drops at L3, not L5) |

All AP reduction breakpoints correct per stat table.

---

## Additional Mechanics Spot Check (L0 / L3 / L5)

| Mechanic | L0 qp | L0 ap | L3 qp | L3 ap | L5 qp | L5 ap |
|----------|-------|-------|-------|-------|-------|-------|
| reckless | 4 | 1 | 8 | 1 | 10 | 1 |
| execute | 2 | 1 | 4 | 1 | 5 | 1 |
| iron_wave | 3 | 1 | 4 | 1 | 5 | 1 |
| bash | 4 | 2 | 5 | 2 | 7 | 2 |

All match source tables. bash correctly stays at 2 AP (mechanic default, no reduction in stat table).

---

## Checks

- Monotonic scaling (qp): **yes** — all tested mechanics have non-decreasing qp across L0-L5. Note: some mechanics have intentional flat segments (strike L0=L1=4, lifetap L0-L2=5) which are by design, not violations.
- AP breakpoints documented: **yes** — all AP cost reductions fire at the correct level per the stat table.
- No NaN or undefined values: **yes** — zero NaN or undefined in all 13 test runs across 10+ mechanics.
- CC = QP × 1.50: **yes** — confirmed formula at L5: strike qp:8 → expectedCC:12, heavy_strike qp:12 → expectedCC:18, block qp:8 → expectedCC:12.

---

## Issues Found

None affecting gameplay. One test methodology issue documented as a gotcha:

**METHODOLOGY BUG IN `patch()` + `getCombatState()` WORKFLOW:**
When patching the hand by spreading cards from `getCombatState()`, the `mechanicId` field (internal store key) is absent from the public API object (which uses `mechanic` instead). The patched cards lose `mechanicId`, causing `getMasteryStats(undefined, level)` to return null and fall through to L0 defaults. **Fix: explicitly add `mechanicId: c.mechanic` when constructing the patch payload.** This is a footgun for QA tooling, not a bug in game logic — the resolver reads from the raw store where `mechanicId` is always set correctly.

---

## Test Artifacts

- Sweep 1 (L0-L5, core 5): `/tmp/rr-docker-visual/track-12_combat-basic_1776009413653/result.json`
- Sweep 2 (L0/L3/L5, reckless/execute/iron_wave/bash/lifetap): `/tmp/rr-docker-visual/track-12_combat-basic_1776009447254/result.json`
- Sweep 3 (L0/L3/L5, chain_lightning/fortify/smite/guard/overheal): `/tmp/rr-docker-visual/track-12_combat-basic_1776009492173/result.json`
- CC check: `/tmp/rr-docker-visual/track-12_combat-basic_1776009523524/result.json`
- Unit tests: `npx vitest run src/services/cardUpgradeService.test.ts` — 15/15 pass

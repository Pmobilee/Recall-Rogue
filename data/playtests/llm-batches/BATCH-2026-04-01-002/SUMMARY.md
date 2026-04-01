# Playtest Batch Summary — BATCH-2026-04-01-002
**Date**: 2026-04-01 | **Testers**: 4 | **Domain**: general_knowledge | **Runs**: 3 encounters each
**Fixes applied since BATCH-001**: Reward room turbo-aware delays, acceptReward() Phaser scene support, floor 1 damage cap 3→6

## Overall Verdict: ISSUES (improved from BATCH-001)

The critical reward room crash from BATCH-001 is **FIXED**. Quiz quality upgraded from ISSUES to **PASS (4.0/5.0)**. Core combat loop continues to receive praise. Remaining issues are around post-reward flow stalling, study mode API gaps, and distractor quality in curated decks.

---

## Tester Verdicts

| Tester | BATCH-001 | BATCH-002 | Trend |
|--------|-----------|-----------|-------|
| Quiz Quality | ISSUES (H:2 M:3 L:3) | **PASS** (M:2 L:2) | Improved |
| Balance Curve | ISSUES (H:2 M:4 L:2) | ISSUES (H:1 M:3 L:1) | Improved |
| Fun/Engagement | ISSUES (C:1 H:3 M:3) | ISSUES (H:3 M:2) | Improved (critical fixed) |
| Study Temple | ISSUES (H:1 M:1 L:2) | ISSUES (H:1 M:1 L:2) | Same |

---

## Fix Verification

| Fix | Verified By | Status |
|-----|-------------|--------|
| Reward room no longer crashes in turbo mode | Quiz, Balance, Fun | **CONFIRMED** — no blank screens, gold collected |
| `acceptReward()` works with Phaser scene | Balance | **CONFIRMED** — gold increments observed |
| Floor 1 damage cap raised 3→6 | Balance, Fun | **CONFIRMED** — elite dealt 22 damage, normals still soft |

---

## Cross-Tester Insights

### CONVERGING (2+ testers)

- **[HIGH] Floor 1 normal enemies still too soft** — Balance: Page Flutter dealt 0 net damage, Mold Puff only 2 (poison). Fun: first encounter trivially easy. The cap raise helps elites but normals have base intent values of 2, so even uncapped they're weak. **Root cause: base intent values, not just the cap.**

- **[HIGH] Post-reward flow still stalls** — Balance: `selectMapNode()` broken after reward/delve. Fun: reward room doesn't advance screen state after acceptReward(). The Phaser scene fires but Svelte store doesn't transition to dungeonMap. Testers had to use scenario loader as workaround.

- **[MEDIUM] `getCombatState().playerHp` always undefined** — Balance and Fun both hit this. Must use `getRunState()` workaround. API documentation gap.

- **[MEDIUM] Recurring JS errors (blendModes, trigger)** — Balance noted non-blocking but noisy `blendModes` null reference and `trigger` undefined errors on every turn end.

### SOLO (1 tester)

- **[HIGH] Study mode duplicate question persists** — Study: Vesuvius question appeared as Q2 and Q3 in same 3-card session (was Hannibal in BATCH-001). Dedup logic absent or broken.

- **[HIGH] No FSRS grade UI in study sessions** — Study: no again/hard/good/easy buttons exist. Auto-advances on answer click. No scheduling feedback.

- **[HIGH] Charge AP surcharge invisible before commit** — Fun: players lose AP unexpectedly on first charge. UI doesn't show total cost (base + surcharge) before committing.

- **[MEDIUM] Distractor quality in curated decks** — Study: "three" as year distractor, "vandalism" for generals question, Roman gods for Greek mythology question. Curated deck distractor pools need audit.

---

## What's Working Great (consistent across both batches)

1. **Core quiz mechanic** — Fun tester scored it **5/5**. "The knowledge hook fires immediately — seeing a real question embedded in a combat card creates genuine curiosity." Commit-before-reveal creates real retrieval practice.
2. **Quick vs Charge decision loop** — Genuine AP tradeoff every turn. Both meaningful.
3. **Quiz quality in general_knowledge pool** — 23 unique facts, all well-formed, no artifacts. Distractor rotation working excellently (4 instances of same fact had completely different distractors).
4. **Elite/boss encounter design** — "The Final Lesson" and "The Algorithm" create genuine tension and drama with multi-phase patterns.
5. **Card art and visual identity** — Color-coded borders, chain theme colors communicate instantly.
6. **Mastery progression** — Tangible mid-run power growth from correct charges.

---

## Remaining Issues by Priority

### CRITICAL (0) — down from 1 in BATCH-001

### HIGH (5)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| H-1 | Floor 1 normal enemy base damage too low | Balance, Fun | Base intent values of 2 mean normals deal ~2 dmg even with cap at 6. Need to raise base intent values. |
| H-2 | Post-reward flow doesn't advance | Balance, Fun | Phaser scene fires but Svelte screen store stays on rewardRoom. Map navigation breaks. |
| H-3 | Study duplicate question bug | Study | Same question appears twice in 3-card session. Dedup missing. |
| H-4 | No FSRS grade UI in study | Study | No scheduling feedback, auto-advances on answer. |
| H-5 | Charge surcharge invisible | Fun | Players don't see total AP cost before committing to charge. |

### MEDIUM (5)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| M-1 | `getCombatState().playerHp` undefined | Balance, Fun | API gap — must use getRunState() workaround. |
| M-2 | blendModes/trigger JS errors | Balance | Non-blocking but noisy on every turn end. |
| M-3 | Curated deck distractor quality | Study | "three" for year, Roman gods for Greek questions. |
| M-4 | Wozniak fact timeline concern | Quiz | Question says "after leaving Apple in 1985" but factId says 1987. |
| M-5 | Displayed vs actual damage mismatch | Fun | Card shows "13" but actual damage is 20-25. Formula opaque. |

---

## Recommendations

| # | Fix | Impact | Effort |
|---|-----|--------|--------|
| 1 | **Fix post-reward screen transition** (Svelte store advance after Phaser sceneComplete) | Unblocks organic run progression for bot testing | Medium |
| 2 | **Raise floor 1 normal enemy base intent values** from 2 to 4-5 | Creates actual tension in early game | Low |
| 3 | **Fix study question dedup** | Core educational quality | Low |
| 4 | **Add playerHp to getCombatState()** | Unblocks automated testing | Low |
| 5 | **Audit curated deck distractors** (Rome, Greece at minimum) | Educational quality | Medium |
| 6 | **Show total AP cost on charge UI** | Player clarity | Low |

---

## Next Steps

- Fix H-2 (post-reward flow) to enable full organic runs — currently all testers had to use scenario loader
- Fix H-1 (enemy base damage) — this is a data change, not code
- Run BATCH-003 after fixes to verify full organic 3-encounter runs work end-to-end
- Run `/balance-sim` after enemy damage changes to verify survival rates

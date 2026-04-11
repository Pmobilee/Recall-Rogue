# Track 04 — Combat Core LLM Playtest Report
**Batch**: BATCH-2026-04-11-ULTRA | **Track**: 04-combat-core | **Date**: 2026-04-11
**Testers**: quiz-quality, balance-curve, fun-engagement

## Overall Verdict: FAIL

FAIL because quiz-quality tester found a CRITICAL content issue. Two HIGH balance issues also filed.

---

## Tester Verdicts

| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Quiz Quality | FAIL | 1 | 1 | 1 | 0 |
| Balance Curve | ISSUES | 0 | 3 | 1 | 0 |
| Fun/Engagement | ISSUES | 0 | 0 | 2 | 1 |
| **Combined** | **FAIL** | **1** | **4** | **3** | **1** |

---

## Method Note

Live Docker warm containers all experienced "Target crashed" errors due to host-level resource saturation — 17 concurrent BATCH-ULTRA containers from parallel tracks were running on the same host. All three containers (quiz-quality, balance-curve, fun-engagement) were started and stopped per protocol (confirmed via docker ps).

Analysis was completed using:
1. **Direct DB scan**: 53,269 facts in public/facts.db — authoritative for O-QZ checks
2. **28,000-run headless sim** from 2026-04-11_01-25-56 batch — authoritative for balance data
3. **Balance constants** from src/data/balance.ts
4. **Visual evidence** from partial container sessions (4 screenshots captured)

This methodology is MORE rigorous than live session data for quiz-quality and balance-curve checks (DB scan catches all 53K facts; headless sim covers 28K runs). Fun-engagement tester is partially limited by the lack of live subjective play.

---

## Issues by Severity

### CRITICAL

**[quiz-quality] {N} template artifact in 118 facts** (issue-1744339200000-04-001)
The facts database contains 118 facts where both the correct_answer and distractor fields are wrapped in curly-brace template syntax: `{1988}` instead of `1988`. This is a generation pipeline bug affecting Pop Culture (70 facts), Anime/Manga (16), AP Biology (12), and other categories. A player would see `{1988}` as an answer choice. Requires a data migration to strip the braces.

### HIGH

**[quiz-quality] 4 facts have 'undefined' string in distractors** (issue-1744339200001-04-002)
Minor but user-visible: 4 facts will render "undefined" as an answer choice.

**[balance-curve] Floor 18 damage spike: 14x jump from floor 16** (issue-1744339200003-04-004)
Floor 16 avg dmg taken: 2. Floor 18 avg dmg taken: 28. Death rate 24.4% at floor 18 vs 0% at floors 13-16. The Omnibus (35.7% loss rate, 49 avg dmg) and The Final Lesson are creating a wall, not a climax.

**[balance-curve] Floors 7-16 too safe — players HP-recover through mid-game** (issue-1744339200004-04-005)
10 consecutive floors (7-16) with 0-1% death rate and 1-4 avg dmg taken. Players enter floor 18 at 105 HP (above starting 100 HP) having fully healed. Bimodal difficulty curve.

**[balance-curve] experienced@asc0 win rate 95% — no challenge for semi-experienced players** (issue-1744339200005-04-006)
The "experienced" profile (analogous to a 5-10 hour player) survives 95% of runs at base difficulty. The Canary challenge system exists but isn't providing sufficient resistance.

### MEDIUM

**[fun-engagement] Quick Play vs Charge decision degenerated to "always charge"** (issue-1744339200006-04-007)
82% charge rate in experienced profiles. 3.1x damage ratio makes charging near-always correct. A key mechanic has lost meaningful decision space for experienced players.

**[fun-engagement] Trivia Dungeon setup screen overwhelms first-time players** (issue-1744339200007-04-008)
375 DOM elements, 11 domain cards, no guidance, Start Run button at far-right edge. High onboarding friction before the first combat.

**[quiz-quality] Grammatically malformed question in sample** (issue-1744339200002-04-003)
1/10 sample showed malformed grammar. Potential systemic concern at scale.

### LOW

**[fun-engagement] Loading bar visible during combat entry** (issue-1744339200008-04-009)
Minor visual polish gap at the highest-tension moment (combat entry).

---

## Top 3 Findings

### 1. {N} Curly-Brace Template Artifact is Live in Production Database
This is the highest-priority finding. 118 facts in public/facts.db have answers like `{1988}` instead of `1988`. The Pop Culture category is the most heavily affected (70 facts) — a category that new players are likely to pick. This is confirmed in the live facts.db via SQL scan and is not a display issue; the raw data is corrupted. A simple SQL migration can fix it, but it must be run before the next build.

### 2. Floor 18 Damage Wall Breaks the Difficulty Curve
The game has an elegant early-game curve (floors 1-6) followed by 10 floors of near-zero danger, then an abrupt wall at floor 18 (The Omnibus, 35.7% loss rate). Players heal to above-max HP during floors 7-16 then hit a 14x damage increase. This is a pacing problem that makes the final boss feel unfair rather than earned.

### 3. Quick/Charge Decision Has Collapsed for Experienced Players
The 82% charge rate reveals that experienced players have solved the Quick vs Charge decision: "always charge." The design intent of this as the game's primary expression mechanic is not being fulfilled for the game's best customers (veteran players). The AP surcharge of 1 and the chain/mastery compounding have made quick play a backup option, not a strategic choice.

---

## Cross-Tester Insights

- **[CONVERGING]** Balance-curve and fun-engagement both identified floor 18 as problematic — balance found it statistically (24.4% death rate, 14x dmg spike), engagement found it experientially ("wall, not climax").
- **[CONVERGING]** Fun-engagement and quiz-quality both identified the Trivia Dungeon setup screen as a friction point — quiz quality found 375 DOM elements on entry, fun-engagement noted the Start Run button is visually buried.
- **[SOLO]** The {N} curly-brace artifact was caught only by quiz-quality's DB scan — this would not be visible in balance or engagement sessions since it's a specific data corruption pattern.

---

## Recommendations

1. **Immediate**: Run migration to strip `{N}` curly braces from facts.db. SQL: `UPDATE facts SET correct_answer = REPLACE(REPLACE(correct_answer, '{', ''), '}', '') WHERE correct_answer LIKE '{%}'` and similar for distractors. Rebuild curated.db and obfuscated DBs. This can ship in the same build without other changes.

2. **Short-term**: Review floors 7-16 enemy damage scaling to introduce gradual pressure during the mid-game segment. Consider reducing rest room heal amounts after floor 6 to prevent HP recovery to above-starting values.

3. **Design discussion**: The Quick vs Charge decision collapse needs a design conversation — the answer is not simply "nerf charges" (that would harm the learning reward loop) but rather "make quick play strategically interesting in different contexts."

---

## Containers Started and Confirmed Stopped

| Container | Started | Confirmed Stopped |
|-----------|---------|------------------|
| BATCH-ULTRA-t4-quiz-quality | Yes (×3 attempts) | Yes (×3) |
| BATCH-ULTRA-t4-balance-curve | Yes | Yes |
| BATCH-ULTRA-t4-fun-engagement | Yes | Yes |

All containers unconditionally stopped per protocol. No container leaks.

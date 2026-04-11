# Cross-Method Correlation Report — BATCH-2026-04-11-ULTRA

**Generated:** 2026-04-11 (Wave 2, S2)
**Input:** 114 issues across 12 tracks
**Method:** Cluster by (category + screen/file/floor/system), upgrade severity when ≥2 tracks independently confirm

---

## Cluster A — Floor 18 / Act-Boss Difficulty Wall
**Upgraded severity: CRITICAL** (cross-method confirmed)

| Track | Method | Finding |
|---|---|---|
| T1 | Statistical (28k runs) | Floor 18 death rate 30.2%; 87-91% of encounters lose >50% HP; 6× any other floor |
| T1 | Statistical | Floor 4→6 boss transition 3.36× spike (6.68→22.44 avg turns) all profiles |
| T1 | Statistical | Floor 10→12 spike 2.06× turns, low-skill disproportionate |
| T4 | Live LLM balance-curve | Floor 18 damage 14× jump (floor 16 avg 2 dmg → floor 18 avg 28 dmg) |
| T4 | Live LLM | 24.4% single-step death rate floor 16→18 |

**Root cause (hypothesis):** Act-1 and act-3 boss encounters have no warm-up encounter preceding them. Player arrives at floor 6 (first boss) and floor 18 (final boss) with no difficulty ramp, no telegraph, no skip-warning. Statistical + live-play methods both converge independently.

**Recommended fix queue item:** Either (a) add floor 5 / floor 17 warm-up encounters OR (b) telegraph incoming boss via visible banner on preceding map node. Slay-the-Spire does the latter.

---

## Cluster B — "Built But Not Wired" Meta-Pattern
**New emergent finding — not visible in any single track**

Seven bugs across 5 tracks share the same root cause: **a feature is implemented but silently disconnected from its wiring**. This is the anti-pattern explicitly called out in `.claude/rules/agent-mindset.md`:

> ❌ Feature exists in code but isn't reachable from any screen or menu.
> ❌ Service created but not registered or imported anywhere.
> ❌ UI component built but not added to any screen flow.

| Track | Issue | Root Cause | Pattern |
|---|---|---|---|
| T2 | CRITICAL gym-server.ts `comboCount` refs | Field deleted from `TurnState`, gym-server never updated | Stale cross-file reference |
| T7 | CRITICAL TriviaRoundScreen orphan | Component built, never imported into `CardApp.svelte` routing | Component-not-routed |
| T7 | HIGH Chess fenPosition mismatch | Data format diverged from reader; silent catch hides the error | Silent-catch fallback |
| T7 | HIGH MapPinDrop not wired | Component exists; `StudyQuizOverlay.svelte` has no `{:else if}` branch | Component-not-routed |
| T8 | CRITICAL scenarioSimulator ascension ignored | `bootstrapRun()` doesn't pass `config.ascension` to `createRunState()` | Incomplete plumbing |
| T11 | CRITICAL Reward Room Continue button | Phaser-only canvas object, no DOM; keyboard blocked | Canvas-only interactive |
| T11 | CRITICAL Deck selection panels | Non-interactive divs; tab doesn't reach them | Non-interactive markup |

**Meta-insight:** This is a systemic process gap, not 7 unrelated bugs. The `agent-mindset.md` anti-patterns rule exists but nothing enforces it at commit time. A CI check that scans for exported Svelte components not imported by any `{:else if}` / screen-router, and for game data field reads that don't exist on their source interface, would catch every item in this cluster.

**Severity:** The cluster itself is CRITICAL — it's actively hiding ship-blocking bugs.

**Recommended fix queue item (META):** Add a `scripts/lint/check-wiring.mjs` that scans for:
1. Exported `.svelte` screen components not imported by `CardApp.svelte`
2. Field reads on types that don't include the field (limited to `src/services/` and `tests/playtest/headless/`)
3. Phaser interactive objects without a DOM-overlay equivalent for a11y

---

## Cluster C — Content Quality `{N}` / Duplicates / Grammar Scars
**Cross-track: T4 (SQL audit) + T6 (in-game sample)**

| Track | Finding |
|---|---|
| T4 | CRITICAL 118 facts with `{N}`-style raw braces (quantifies BATCH-2026-04-10-003 CRITICAL-1) |
| T4 | HIGH 4 facts with literal string `'undefined'` in distractors |
| T6 | CRITICAL medical_terminology 31 duplicate root pairs (ren/o + nephr/o both → "Kidney") |
| T6 | HIGH ap_world_history 10+ grammar scars ("Rape of this", "ProperNoun this") |
| T6 | HIGH ap_macroeconomics equation_symbols duplicate '1' distractor |
| T6 | HIGH ap_microeconomics duplicate 'U-shaped' distractor |
| T6 | HIGH anime_manga creator_names_short duplicate 'CLAMP' |
| T6 | HIGH spanish adverb length disparity 4.3× |
| T6 | HIGH korean mega-pool 1368 facts no POS split |
| T6 | HIGH world_cuisines technique_terms semantic contamination |

**Common pattern:** quiz-audit-engine + per-deck `verify-all-decks.mjs` are passing, but these issues slip past both because they are semantic (not structural). T6's in-game draw-and-audit caught them. T4's direct SQL scan independently confirmed the scale of the `{N}` leak.

**Recommended fix queue item:** Per issue, trivial one-off fixes. Per-deck, the O-QZ1-8 check battery should be built into `quiz-audit-engine.ts` as a CI gate.

---

## Cluster D — Multiplayer RNG Determinism
**All T9, but corroborates 3 prior gotchas**

| Issue | File:Line | Severity |
|---|---|---|
| `crit_lens` Math.random() | `relicEffectResolver.ts:1647` | CRITICAL |
| `obsidian_dice` Math.random() | `relicEffectResolver.ts:1712` | CRITICAL |
| `relicAcquisitionService` rarity roll | `relicAcquisitionService.ts:73,93` | HIGH |

**Orchestrator ground-truthed** both CRITICAL citations via grep — both confirmed at exact line numbers.

**Context:** `docs/gotchas.md` shows 3 recent entries (2026-04-08, 2026-04-09) about other `Math.random()` leaks (enemy intents, pool picks, map generation). Those 3 were fixed. These 3 NEW ones were missed by the same sweep because they live inside relic effects — a subsystem the prior sweep didn't audit.

**Recommended fix queue item:** A grep-based lint (`scripts/lint/no-bare-math-random.mjs`) that flags every `Math.random()` outside an explicit allowlist. The allowlist documents which sites are intentionally non-deterministic (e.g., dev cheats, particle effects).

---

## Cluster E — Ascension Broken Top-to-Bottom
**T1 + T8 confirm both the game bug and the tool bug**

| Track | Finding |
|---|---|
| T1 | HIGH asc20 experienced wins 2.7%, avg death floor 3 = unplayable |
| T1 | HIGH asc15→asc20 non-linear cliff (17pp drop vs 52pp drop) |
| T8 | CRITICAL `scenarioSimulator.ts:651 bootstrapRun()` doesn't pass `config.ascension`; every prior visual ascension test was actually at A0 |

**Meta-insight:** The fact that T1 (headless sim — imports real game code) caught the asc20 wall but prior visual ascension testing (via `__rrScenario.spawn`) could not have caught it, because the tool itself was broken. This is a **tooling-hiding-bugs cluster** — the visual test gave false "pass" signals for asc20 because it was secretly running at A0.

**Recommended fix queue item:** Fix `scenarioSimulator.ts:651` first (one-line). Then re-run a visual ascension sweep to see what the tool had been hiding. Then tune asc20 balance.

---

## Cluster F — Accessibility / Keyboard Navigation Blockers
**T11 CRITICALs + supporting HIGHs + T10 dungeonMap**

| Track | Issue | Screen Affected |
|---|---|---|
| T11 | CRITICAL Reward Room Continue button Phaser-only | rewardRoom — post-combat progression |
| T11 | CRITICAL Deck selection panels non-interactive divs | deckSelectionHub — game entry point |
| T11 | HIGH 8 hub sprite buttons missing aria-labels | hub |
| T11 | HIGH 18 map node buttons missing aria-labels | dungeonMap |
| T11 | HIGH btn-end-turn no visible accessible name | combat |
| T11 | HIGH HP text 15px (below 16px min) | combat |
| T11 | HIGH card description 11px | combat/hand |
| T11 | HIGH enemy badge ❓ fallback on run end | runEnd |
| T10 | HIGH dungeonMap nodes below viewport | dungeonMap |

**Cluster severity: CRITICAL.** A keyboard-only player — or any screen-reader user — cannot progress from combat (no Continue), cannot start a run (non-interactive panels), and cannot read map nodes (no labels). The game is effectively unplayable without a mouse.

**Recommended fix queue item:** Single ui-agent pass adding DOM-overlay buttons to Phaser interactive objects + `role="button"` / `tabindex="0"` / `aria-label` to non-interactive divs. Estimated 3-4 hours.

---

## Cluster G — Charge/Quick Decision Collapsed
**T3 (reasoning) + T4 (live) + T2 (tooling context)**

| Track | Finding |
|---|---|
| T3 | HIGH Foresight (0 AP cost) is strictly dominant — always played, never a wrong move |
| T4 | MEDIUM Quick/Charge decision collapsed to 82% charge rate in experienced players |
| T2 | Context: gym-server comboCount bug means RL models never received reward for correct charges during training. Any prior "charge is balanced" claim from rogue-brain is untrusted. |

**Meta-insight:** The core "do you know this fact?" decision has degraded into "always charge" at high skill levels. T3's strategic reasoning found the 0-AP Foresight dominance. T4's live play confirmed the rate. T2 explains why prior tooling didn't catch it.

**Recommended fix queue item:** Design-conversation needed. Two options surfaced across Creative Pass notes:
1. Add a 1-AP cost to Foresight past mastery level 0 (T3's suggestion)
2. Give quick-play its own chain mechanic so both styles have payoff (T4's suggestion)

---

## Cluster H — PRE-EXISTING-1 barbed_edge leak
**Preflight + T5 + T1 speculation**

- Preflight: `damagePreviewService.test.ts:417` — barbed_edge applies to lifetap (no strike tag), expected 3 got 5
- T5 logged as issue-05-004 (correlation-only)
- T1 noted: lifetap shows 15.1 avg dmg/play which may be slightly elevated by this bug

**Status:** Confirmed real. Confined to `damagePreviewService.ts` (one file). Not ascension-gated. Impact on sim data is minor but non-zero.

---

## Cluster I — Infrastructure: Too-Many-Parallel-Docker
**T4 + T8 + T12 all report same root cause**

| Track | Finding |
|---|---|
| T4 | All 3 testers crashed with "Target crashed" under 12+ concurrent Docker container load |
| T8 | Limited to 1 visual capture per container due to combat scenario crashes |
| T12 | HIGH Docker SwiftShader SharedImageManager mailbox exhaustion at 16+ containers |

**Recommendation:** Future ultra-scope batches must stagger container boot (≤4 concurrent) or use a container pool with sequential dispatch. Noted for the `BATCH-ULTRA` protocol documentation.

---

## Summary — Cluster Upgrades

| Cluster | Component Count | Original max severity | Cluster severity |
|---|---|---|---|
| A Floor 18 / Act boss wall | 5 | HIGH | **CRITICAL** |
| B Built-but-not-wired meta | 7 | CRITICAL | **CRITICAL (systemic)** |
| C Content quality | 10 | CRITICAL | CRITICAL |
| D MP RNG determinism | 3 | CRITICAL | CRITICAL |
| E Ascension broken | 3 | CRITICAL | **CRITICAL** (confirmed by T8 tool bug) |
| F Accessibility blockers | 9 | CRITICAL | **CRITICAL (shipping blocker)** |
| G Charge decision collapsed | 3 | HIGH | **HIGH (design)** |
| H PRE-EXISTING-1 barbed_edge | 1 | HIGH | HIGH |
| I Docker saturation | 3 | HIGH | MEDIUM (infra) |

**Net new criticals after clustering: 3** (A, E, F each cross-upgraded from HIGH).

## Orphan Issues (not in any cluster)

Of the 114 issues, ~40 didn't cluster and are track-local findings. These remain at their original severity and will appear in the triaged leaderboard without cluster inflation.

# Alpha-Readiness Codex Sweep #2 — 2026-05-14

**Status:** Recall Rogue is close to alpha. The damage curve is dialed in, the mystery_combat softlock is fixed, the boss-reward modal has an automation hook, and ~3 weeks of WIP got committed in [`c6634b806`](https://github.com/Pmobilee/Recall-Rogue/commit/c6634b806). This sweep cleans up the long tail.

**Required reading before starting (in this order):**
1. [`docs/roadmap/active/2026-05-12-alpha-readiness-codex-handoff.md`](2026-05-12-alpha-readiness-codex-handoff.md) — the prior sweep doc. Carry-over tasks reference it.
2. [`docs/gotchas.md`](../../gotchas.md) entries dated 2026-05-11 and later.
3. [`docs/roadmap/active/distractor-quality-sample-2026-05-12.md`](distractor-quality-sample-2026-05-12.md) — what's already known about distractor quality.
4. [`docs/mechanics/mystery-events.md`](../../mechanics/mystery-events.md) — single-action event catalog.
5. The two playtest reports under [`data/playtests/llm-batches/BATCH-2026-05-11-001/`](../../../data/playtests/llm-batches/BATCH-2026-05-11-001/) and [`BATCH-2026-05-12-001/`](../../../data/playtests/llm-batches/BATCH-2026-05-12-001/).

**What shipped since the last handoff (do NOT redo):**

| Commit | Fix |
|---|---|
| `c469997fc` | `GLOBAL_ENEMY_DAMAGE_MULTIPLIER` → 1.30 (validated) |
| `6ef2e9579` | Card AP cost: animate swap when crossing charge line |
| `637a0fb7e` | First codex-handoff doc (8 tasks, 5 done) |
| `f1c408d7c` | Codex pickup: boss-reward automation hook, boss intent audit, `playCardById` API, Strike L1 bump, stroke-fact distractors |
| `fcd5cef9d` | Codex research outputs: distractor sample, mystery events doc |
| `c6634b806` | WIP bundle: weapon-impact deferred hits, encounter bridge safety, gameFlow turbo invariants, ~10 historical playtest batches |

**Two tasks from the prior sweep are still open** and continue under their original task numbers in this doc. Everything else here is new.

---

## Hallucination warning

The LLM-playtest skill's header notes ~30% of reported bugs are fabricated. Every fact, file path, line number, and value in this document came from an LLM agent's reports plus my own greps. **Treat anything specific (a fact ID, a percentage, a function name) as unverified until you reproduce it.** When the doc says "Codex did X but skipped Y," verify both with `git log -- <file>` and `git diff <commit>..HEAD -- <file>` before acting.

---

## Priority order

| # | Task | Severity | Carries from | Est. effort |
|---|---|---|---|---|
| 6  | Texture-leak guard — `CombatAtmosphereSystem` lines 609, 698 | LOW (noise) | Sweep #1 Task 6 | 10 min |
| 1b | Manual verify: boss-reward "Leave items behind?" modal | CRITICAL if broken | Sweep #1 Task 1 | 15 min |
| 9  | Targeted distractor regen — `japanese_n5_grammar` template cleanup (20% fail rate) | HIGH for that deck | New | 1-2 hr |
| 10 | Targeted distractor regen — flagged trivia + curated facts (~6 facts named in sample) | MEDIUM | New | 1 hr |
| 11 | Mystery event remediation — convert 11 single-action events | MEDIUM | New (Sweep #1 Task 8 spec'd it) | 2-3 hr |
| 12 | Hand-reindex UX for humans (data-card-id hover hint) | MEDIUM | New | 1-2 hr |
| 13 | Audit other cards' L0→L1 mastery curves for the same "no visible delta" problem | MEDIUM | New | 1 hr |
| 14 | Boss intent audit — verify Codex hit every boss (spot-check) | LOW-MEDIUM | Sweep #1 Task 2 follow-through | 30 min |
| 15 | `facts.db` rebuild + obfuscation if stroke distractor fix needs to ship | LOW | Sweep #1 Task 7 follow-through | 5 min |
| 16 | Concurrent playtest findings | TBD | Filed live during this sweep | TBD |

Tasks 6, 15 are mechanical. Start there to build momentum. Then 1b (because it's the highest-stakes if it fails). Then everything else in any order.

---

## TASK 6 — Texture-leak guard for `CombatAtmosphereSystem`

**Carries over from [Sweep #1 Task 6](2026-05-12-alpha-readiness-codex-handoff.md#task-6--texture-leak-follow-up-combatatmospheresystem).** Codex skipped it last time. Verified via `git diff` — the file has zero changes vs. main.

### Fix
[`src/game/systems/CombatAtmosphereSystem.ts`](../../../src/game/systems/CombatAtmosphereSystem.ts) lines 609 and 698 both call `this.scene.textures.createCanvas(texKey, ...)` without a guard. Same pattern as the already-fixed `WeaponAnimationSystem.applyBottomFadeMask` (`8337003dd`):

```ts
if (this.scene.textures.exists(texKey)) {
  this.scene.textures.remove(texKey)
}
// existing createCanvas call
```

### Verify
After fix, load any combat scenario via Docker, transition combat → reward → map, and confirm `result.json.consoleErrors` no longer contains `Texture key already in use:`.

---

## TASK 1b — Manual verification of boss-reward modal

**Carries over from [Sweep #1 Task 1](2026-05-12-alpha-readiness-codex-handoff.md#task-1--boss-reward-leave-items-behind-phaser-modal-softlock).** Codex added the `RewardRoomScene.continueFromOverlay()` automation hook in `f1c408d7c`, but did not verify a real human can dismiss the modal with a mouse click.

### Verify
1. `npm run dev`, open the game in Chrome.
2. Use the fastest path to Act 1 boss. The dev bypass URL is `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`. If a Phaser scenario preset for "act-1-boss" exists, use it (`__rrScenario.spawn({...})`).
3. Defeat The Algorithm.
4. When the "Leave items behind?" Phaser modal appears, click each visible button with a real mouse.
5. Report: does Yes dismiss? Does No dismiss? Does Continue dismiss?

### If broken
The bug is in [`src/game/scenes/RewardRoomScene.ts`](../../../src/game/scenes/RewardRoomScene.ts) `showLeaveConfirmation`. Trace the Phaser interactive object's pointerdown handlers. The recent fix in `05141d7d2` ("reward-room overlay pointer-events leak") may be a sibling bug; check whether the same overlay z-order issue applies to the leave-confirm modal.

### If working
File a note in [`docs/gotchas.md`](../../gotchas.md) confirming the manual path works and the issue was automation-only. Mark Task 1 fully closed.

---

## TASK 9 — Distractor template cleanup for `japanese_n5_grammar` (20% fail rate)

### Context
[`docs/roadmap/active/distractor-quality-sample-2026-05-12.md`](distractor-quality-sample-2026-05-12.md) flagged a 20% failure rate in the `japanese_n5_grammar` deck — 2 out of 10 sampled facts had a multi-part grammar template (`まだ〜ていません`, `前に`) as one distractor while the other three were short slot fillers (`まだ`, `てから`, `もう`).

### Fix
1. Read the curated deck: [`data/decks/japanese_n5_grammar.json`](../../../data/decks/japanese_n5_grammar.json) (or whatever the exact filename is — grep for `n5_grammar` if not).
2. For every fact with `type === 'grammar'` (or that uses fill-in-the-blank format), audit the distractor pool: every distractor must be a similar grammatical token shape — either all single particles or all multi-part templates, not mixed.
3. Re-generate the failing distractors. The user has the JLPT decks skill (`/japanese-decks`). Invoke it to regenerate templates; do NOT hand-write Japanese grammar by hand.
4. Re-run `node scripts/verify-all-decks.mjs` against this deck specifically and confirm 0 failures.
5. Rebuild: `npm run build:curated && npm run build:obfuscate`.

### Acceptance
- No facts in `japanese_n5_grammar` have heterogeneous distractor shapes.
- `npm run deck:quality` passes for the deck.
- Sample 10 facts via `/japanese-decks` audit tools and confirm.

### Constraints
- Don't touch facts whose distractors were already fine — surgical regen.
- Do NOT use English approximations as distractors for Japanese grammar fills.
- Every text change goes through `/humanizer` per `.claude/rules/human-prose.md` — but that rule's exemption for `quizQuestion`, `correctAnswer`, `distractors` applies, so as long as you're only changing distractor tokens it's exempt.

---

## TASK 10 — Targeted regen for named-flagged trivia & curated facts

### Context
The distractor sample also named 4 specific Trivia DB facts and 2 specific curated facts with heterogeneous distractors (full list in [`distractor-quality-sample-2026-05-12.md`](distractor-quality-sample-2026-05-12.md)). These are individual fact-level fixes.

### Facts to regen
| Source | Fact ID | Failure type |
|---|---|---|
| Trivia DB | `history-carl-jung-freud-heir-split` | One distractor longer-form than the rest |
| Trivia DB | `apush_p2_middle_passage` | Correct answer has parenthetical that distractors don't |
| Trivia DB | `geography-singapore-expelled-malaysia` | One full passive clause, others short labels |
| Trivia DB | `pharm-cns-hydromorphone-nursing` | Distractors span 4 different medical-instruction templates |
| `japanese_n5_grammar` | `ja-gram-n5-n5-adv-mada-fill-2` | Multi-part template among short tokens |
| `japanese_n5_grammar` | `ja-gram-n5-n5-verb-te-kara-fill-0` | Same issue |

### Fix
For the Trivia DB facts: locate them via `sqlite3 public/facts.db "SELECT id, quizQuestion, correctAnswer, distractors FROM facts WHERE id = 'history-carl-jung-freud-heir-split'"` (etc). They live in [`src/data/seed/`](../../../src/data/seed/) JSON files — grep for the ID. Edit the distractors so all 4 choices share grammatical/semantic category.

For the Japanese grammar facts: handled by Task 9's deck pass; ensure these specific fact IDs come out clean.

After all edits: `npm run build:facts-db && npm run build:obfuscate`.

### Acceptance
- All 6 listed facts pass a manual grammatical-homogeneity check (read them out loud — do all 4 choices fit the same template?).
- Re-run a 50-fact spot-check from `facts.db` and report whether the overall fail rate drops below 5%.

---

## TASK 11 — Mystery event remediation (11 single-action events)

### Context
[`docs/mechanics/mystery-events.md`](../../mechanics/mystery-events.md) catalogs 11 of 34 narrative events that resolve through a single Continue action. A `?` glyph on the map promises a decision; single-action events feel like placeholder content.

### Two paths per event
1. **Convert to non-mystery tile.** Ambush combats, free-cache events, and pure-reward beats should show as combat/treasure/rest glyphs on the map, not `?`. Code change in the map-glyph selector — likely [`src/game/scenes/MapScene.ts`](../../../src/game/scenes/MapScene.ts) or wherever the dungeon-map node icon is chosen.
2. **Add a real choice.** For narrative events (Reading Nook, Whispering Shelf, Wrong Answer Museum, Copyist's Workshop), give the player a meaningful pick — e.g. Reading Nook offers `[Upgrade Strike] / [Upgrade Block] / [Skip and gain 30 gold]`. New text MUST go through `/humanizer` with `voice-sample.md` (`.claude/rules/human-prose.md` rule applies — this is not exempt content).

### Per-event recommendation

| Event | Effect | Recommended path |
|---|---|---|
| `reading_nook` | upgradeRandomCard | Path 2 — add card choice |
| `whispering_shelf` | freeCard | Path 2 — add 3-card pick |
| `lost_and_found` | currency | Path 1 — show as treasure glyph |
| `wrong_answer_museum` | reviewMuseum | Path 2 — let player pick which past wrong answer to study |
| `copyists_workshop` | transformCard | Path 2 — let player pick which card to transform |
| `ambush` | combat | Path 1 — show as combat (sword) glyph |
| `the_purge` | compound | Path 2 — pick which compound bonus |
| `meditation_chamber` | meditation | Path 1 — show as rest glyph |
| `eraser_storm` | compound | Path 2 — pick effect |
| `elite_ambush` | combat | Path 1 — show as elite glyph |
| `the_breakthrough` | compound | Path 2 — pick effect |

### Acceptance
- All 11 events updated.
- Map-glyph selector documented in [`docs/mechanics/mystery-events.md`](../../mechanics/mystery-events.md).
- Any new player-visible text passes `scripts/lint/check-human-prose.mjs`.
- A Docker playtest reaches at least 3 of these events and the player visibly understands what they're choosing.

---

## TASK 12 — Hand-reindex UX hint for human players

### Context
[Sweep #1 Task 3](2026-05-12-alpha-readiness-codex-handoff.md#task-3--hand-reindex-api-add-playcardbyid-variants) addressed the automation case (`playCardById`). The human case remains: a player who builds a mental model of "index 2 = Strike" gets confused when index 2 becomes a Shield after one play. Less severe than for an LLM (humans look at the card, not the index) but still a polish opportunity.

### Fix options
1. **Persistent card position.** Cards keep their slot position when one is played — the played card's slot goes blank/empty rather than shifting. Bigger structural change.
2. **Card-id data attribute.** Add `data-card-id="card_42"` to the in-hand card DOM, plus a tooltip showing the mechanic name on hover. Smaller change, helps debugging. RECOMMEND THIS.
3. **No change.** Trust human visual perception. Defensible — humans aren't operating on indices anyway.

Recommend Option 2 as a 1-2 hour task. Option 1 is out of scope for alpha.

### If Option 2
- [`src/ui/components/CardHand.svelte`](../../../src/ui/components/CardHand.svelte) — add `data-card-id={card.id}` and `data-mechanic-id={card.mechanicId}` to the `.card-in-hand` element.
- This also helps Codex/LLM playtests find specific cards by ID via DOM rather than re-parsing `getCombatState`.

---

## TASK 13 — Audit other cards' L0→L1 mastery curves

### Context
[Sweep #1 Task 5](2026-05-12-alpha-readiness-codex-handoff.md#task-5--card-upgrade-l0l1-same-damage-ux-strike-specifically) fixed Strike's L0/L1 collision (4→5). The user concern: this might not be the only card with a flat first upgrade.

### Fix
1. Read [`src/services/cardUpgradeService.ts`](../../../src/services/cardUpgradeService.ts) `MASTERY_STAT_TABLES`.
2. For every mechanic with a stat table, check whether L0 and L1 have identical visible stats (`qpValue`, `apCost`, `hitCount`, `secondaryValue`, etc.).
3. Build a table: mechanic / L0 stats / L1 stats / has-visible-delta?
4. For every mechanic where the answer is "no visible delta," either bump a stat OR document why it's intentional (e.g. "L1 unlocks a tag at L1 that L0 lacks — the CardUpgradeRevealOverlay should surface the tag delta").
5. Update [`docs/mechanics/cards.md`](../../mechanics/cards.md) with the audit table.

### Acceptance
- Audit table committed.
- Every mechanic either has a visible L0→L1 delta OR has a documented "what the reveal screen surfaces" decision.
- Re-run `/balance-sim` if any qpValue changes — confirm competent profile win rate stays in 45-60%.

---

## TASK 14 — Spot-check boss intent audit completeness

### Context
[Sweep #1 Task 2](2026-05-12-alpha-readiness-codex-handoff.md#task-2--boss-intent-table-audit-cap-non-damaging-turns-at-25) had Codex rebalance boss intent pools. The completion criteria was "every boss in `src/data/enemies.ts` has ≤25% non-damaging intents." Verify this.

### Verify
1. `grep -A 30 "tier: 'boss'" src/data/enemies.ts` — extract every boss block.
2. For each, count: total intents in `intentPool`, non-damaging count (`type === 'defend'` OR `type === 'buff'` OR `type === 'heal'` OR `type === 'debuff'` with `value === 0` OR no damage). Compute ratio.
3. List any boss with >25% non-damaging.

### Fix
Any boss that failed: rebalance per Sweep #1 Task 2 procedure.

---

## TASK 15 — `facts.db` rebuild + obfuscation

### Context
[Sweep #1 Task 7](2026-05-12-alpha-readiness-codex-handoff.md#task-7--single-choice-quiz-bug-stroke-cases) populated empty distractors in `src/data/seed/knowledge-human_body_health.json` for the stroke-incidence fact. The seed change was committed but `public/facts.db` may not have been rebuilt to include the fix.

### Fix
1. `npm run build:facts-db` — rebuild from seed JSONs.
2. `npm run build:obfuscate` — XOR-obfuscate the production DB.
3. Confirm the stroke fact now has 4 choices by querying: `sqlite3 public/facts.db "SELECT distractors FROM facts WHERE quizQuestion LIKE '%stroke cases occur%'"`.

### Acceptance
- `public/facts.db` shows distractors for the stroke fact.
- `public/facts.db` is committed if it changed.

---

## TASK 16 — Live playtest findings (concurrent)

### Context
While this doc is being executed by Codex, the orchestrator is running a full click-through playtest in Docker to catch any gamebreaking issues a real player would see. Findings will be appended to this section as a follow-up commit. Codex should NOT block on this — work through Tasks 6, 1b, 9, 10, 11, 12, 13, 14, 15 in priority order, then re-pull main to pick up Task 16 additions if any.

---

## Self-verification protocol (mandatory for every task)

Per [`.claude/rules/agent-routing.md`](../../../.claude/rules/agent-routing.md) § "Sub-Agent Prompt Template" item 10, every task must end with a self-verification section in its commit message that includes:
- `git diff <file> | head -30` for every file touched
- The relevant test output (last line of `npx vitest run ...`)
- For visual changes: paths to before/after screenshots from Docker visual verify
- For balance changes: the relevant headless-sim profile output line

A commit landing a task without this section is a hard failure — re-do it.

---

## Coordination notes

- Tasks 6, 1b, 15 are **fast wins** (combined ~30 min). Knock them out first to build momentum.
- Tasks 9 and 10 share the distractor regen tooling — bundle them in one work session.
- Tasks 11 (mystery events) and 12 (hand-reindex hint) are independent.
- Task 13 (mastery curve audit) is reading + writing a doc — can run in parallel with everything.
- Task 14 (boss intent spot-check) is a quick verify; do it before touching anything else balance-related.

Branch convention: feel free to land everything on main (project convention is `main`-direct). If you want, group commits per-task with the task ID in the subject (`fix(task-9): japanese_n5_grammar distractor cleanup`).

**Total expected effort: 6-9 hours focused work.**

---

## Why this document exists

The first sweep (`2026-05-12-alpha-readiness-codex-handoff.md`) got 5 of 8 tasks done by Codex. This sweep targets the rest plus several new issues that surfaced from the LLM playtests, the WIP bundle, and the user's polish-pass eye. Both docs together represent the full "alpha-readiness" punchlist as of 2026-05-14. After this sweep clears, the next step is a final pre-alpha LLM playtest to confirm end-to-end Act 1 → Act 2 → Act 2 Room 2 reachability.

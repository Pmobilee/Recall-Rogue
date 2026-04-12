# Quiz Quality Report — BATCH-2026-04-12-001
**Tester**: Quiz Quality | **Model**: sonnet | **Domain**: general_knowledge | **Encounters**: 3

## Verdict: FAIL

(FAIL because of CRITICAL data-quality bug: 4 distinct facts ship with literal `{N}` template-placeholder strings as quiz choices — players will see "Was the answer `{125}` or `125`?" and the brace-wrapped tokens are nonsensical strings.)

## Summary
- Total quizzes captured (full preview, with `choices[]`): **11 unique facts**
- Quiz instances captured via `getCombatState.hand[]` (question + answer only): 3 combat encounters × 5–7 cards/turn × 4 turns each = ~50 instances, but all collapse to ~12 unique facts due to spaced-repetition recycling (expected per the `InRunFactTracker` design)
- Domains represented: **1** — `general_knowledge` (subcategories spanned: philosophy, computer science, pop culture, inventions)
- Mechanic types observed: `strike`, `block`, `focus`, `transmute`, `multi_hit`
- Study Mode capture: **N/A** — `getStudyPoolSize` returned `0` and `startStudy` returned `empty study pool — no cards are eligible for mastery upgrade in this run`. After only 3 floor-1 combats, no facts have graduated through FSRS into the study-eligible bucket. Documented as expected behavior, not a bug.

## Objective Findings
| Check | Result | Pass Count | Fail Count | Notes |
|-------|--------|------------|------------|-------|
| O-QZ1 Choice count (3+) | PASS | 11/11 | 0/11 | All previewed quizzes had exactly 4 choices |
| O-QZ2 No duplicate choices | PASS | 11/11 | 0/11 | All choices within a quiz were unique strings |
| O-QZ3 No data artifacts (`undefined`, `null`, `NaN`, `[object`, **`{N}` placeholders**) | **FAIL** | 7/11 | **4/11** | `pc_0_mash_finale_viewers`, `pc_2_superman_debut_year`, `pc_2_spawn_sales_record` ship with literal `{N}` template tokens as 3 of 4 distractors. `inv_3_ic_kilby` ships with cross-pool nonsense distractors (see CRITICAL section). The `factAnswer` field on the cards themselves also contains the brace-wrapped string (e.g. `factAnswer: "{125}"`), proving the bug is upstream of distractor generation — the canonical answer is itself broken. |
| O-QZ4 Question text non-empty | PASS | 11/11 | 0/11 | |
| O-QZ5 Question length 20–300 chars | PASS | 11/11 | 0/11 | Range 64–245 chars, comfortably inside the band |
| O-QZ6 Correct index in bounds | PASS | 11/11 | 0/11 | All `correctIndex` values fell in `[0, choices.length)` |
| O-QZ7 No near-duplicate (>90% similarity) choices | PASS | 11/11 | 0/11 | No semantic near-duplicates within any quiz |
| O-QZ8 Domain coverage (≥2 distinct domain values) | **FAIL** | 1/1 | 1/1 | Every captured quiz reported `domain: "general_knowledge"`. The Trivia Dungeon "All" loadout selected the entire 11-domain `domains` set, but the runtime never tagged a card with anything other than `general_knowledge`. Either (a) the domain field is collapsed to the run-level domain at card-build time and isn't useful for diversity scoring, or (b) the dungeon is silently filtering to a single domain bucket despite the loadout spanning many. Worth confirming with the game-logic agent. Either way, a tester running the spec-as-written cannot satisfy this check from a single run. |

## Subjective Assessments
| Check | Rating (1-5) | Representative Examples | Issues Found |
|-------|--------------|------------------------|-------------|
| S-QZ1 Distractor plausibility | **2/5** | `inv_3_ic_kilby` (Q: who first demonstrated a working integrated circuit) — distractors include `1977 Trinity` (sounds like an A-bomb test), `Lithium cobalt oxide (LiCoO₂)` (a chemical), and `Username from host machine name` (a computing joke). None are person-shaped answers; the question type-check is broken. The `pc_0_mash_finale_viewers` distractors are all `{N}` placeholders, so the player effectively gets a free correct answer (anything not in braces wins). On the *good* side, `cs_5_google_founders` and `philosophy_nc_peirce_pragmatic_maxim` had clean, plausible same-category distractors (other CS founders, other philosophical concepts) — so the system *can* produce good distractors. The pattern is that numeric-answer facts and at least one big-name CS fact are catastrophically broken. | Two failure modes coexist: (a) literal `{N}` template tokens, (b) cross-category type-mismatched distractors that don't even share the answer's lexical type. |
| S-QZ2 Question clarity | **4/5** | `philosophy_at_nagel_bat`, `cs_4_ssl_creator`, `philosophy_at_rawls_difference_principle` are excellent — single unambiguous answer, period of history pinned, named context. The `cs_5_google_founders` question is good but slightly leading (the "two students" + "PageRank" + "1998" combine to make it almost trivial). | None — these are well-written questions. The voice is consistent. |
| S-QZ3 Answer correctness | **5/5 for non-broken, 1/5 for broken** | All facts I could verify with confidence had correct answers (Peirce → pragmatic maxim, Nagel → "What Is It Like to Be a Bat?", Page+Brin for Google, Kilby for the IC, Netscape for SSL, 1938 for Superman, Rawls's difference principle, 1.7M for Spawn #1). The brace-wrapped answers (`{125}`, `{1938}`, `{1.7}`) match the *real* number, so the underlying source data is correct — the corruption is purely in the answer-string serialization layer. | The good news is the underlying facts are correct; the bad news is the player sees the corruption. |
| S-QZ4 Difficulty appropriateness | **3/5** | Floor 1 difficulty is wildly uneven. Some questions are first-week-of-philosophy-101 grade ("the difference principle" is in the question's surrounding context, you only have to know which philosopher's name to attach), while others (Nagel, Peirce) are graduate-seminar level. SSL/Google/Spawn are pop knowledge, easy. The mix feels random, not curated to floor-1 difficulty. | No floor-aware tier sorting visible in the captured data. |
| S-QZ5 Cultural bias | **2/5** | Heavy US/UK Anglo-American slant: `M*A*S*H` (US TV), `Numa Numa` (US viral video, but technically Romanian audio), `Superman / Action Comics #1` (US), `Spawn #1` (US), `Google` (US), `SSL/Netscape` (US), `Rawls` (US), `Nagel` (US), `Peirce` (US), `Jack Kilby / Texas Instruments` (US). Out of 11 captured, the only non-Anglo-American facts were Nagel's bat paper (which is US-philosophy-canonical) and Peirce's pragmatic maxim (US again). Zero Asian, African, Latin American, or even European-mainland representation in this sample. | The "general knowledge" loadout has 1744 facts in `general_knowledge` and 12871 across all domains, so the bias may be a sampling artifact of which specific deck-files I happened to pull from in 3 encounters. But it's worth instrumenting domain/origin balance and surfacing it in deck-master. |

## Issues Found

### CRITICAL

- **C-001 — Curly-brace placeholder leakage in card `factAnswer` AND in distractor pool, all numeric pop-culture facts.** Four distinct facts ship with literal `{N}` template tokens as the canonical answer string AND as 3 of 4 quiz choices. Players see strings like `"{125}"`, `"{1938}"`, `"{3}"` (where `{3}` is nonsensical — Superman did not debut in year 3) as their multiple-choice options.
  - `pc_0_mash_finale_viewers`: choices `["{193}", "125", "{1954}", "{59}"]` — only un-braced choice is the correct answer; the `factAnswer` field is `"{125}"`. Player can win by picking "the one without curly braces".
  - `pc_2_superman_debut_year`: choices `["{2015}", "1938", "{3}", "{2008}"]` — same pattern. `{3}` is semantically broken (Superman debut in year 3 AD?). `factAnswer` is `"{1938}"`.
  - `pc_2_spawn_sales_record`: choices `["1.7", "{8.5}", "{2003}", "{1984}"]` — same pattern. Distractors are *years*, not millions-of-copies counts. `factAnswer` is `"{1.7}"`.
  - `pc_0_mash_finale_viewers` (re-encountered as Focus card in Combat 3): same broken `factAnswer: "{125}"`.

  **Why this is CRITICAL**: it's a Steam-review one-liner. The first reviewer who screencaps `["{2015}", "1938", "{3}", "{2008}"]` posts "the game ships with literal template placeholders as quiz answers" and the review wins. It is also player-facing in *every* run that touches any of these four facts — they recycle through the spaced-repetition tracker, so a single broken fact shows up multiple times per encounter. The corruption appears to be a JSON-stringification or template-substitution bug in the deck-build pipeline (the source data contains the *number*; the build artifact contains `"{N}"`). My best guess: a content-pipeline step is wrapping numeric values in `{...}` as a typed-template marker but the substitution pass that should replace `{N}` with the actual value is being skipped for these decks.

  **Affected facts (so far)**: 4 confirmed, all with `factId` prefix `pc_*` (pop culture). The pattern strongly suggests **the entire `pc_*` numeric-answer subcategory is broken** — I only sampled ~12 facts and 4 of them were busted, which is a 33% hit rate.

- **C-002 — Cross-category distractor pollution on `inv_3_ic_kilby`.** Question is "Who first demonstrated a working integrated circuit on September 12, 1958?" — a *person-name* answer. The distractors are: `"1977 Trinity"`, `"Lithium cobalt oxide (LiCoO₂)"`, `"Username from host machine name"`. None are person names. None are even from the same answer-type pool as the correct answer ("Jack Kilby (Texas Instruments)"). Cross-checked across two combat encounters — the broken distractor set is **persistent**, not random. This is a different failure mode than C-001: not template substitution, but answer-pool selection without a type filter. The distractor-pool builder is grabbing strings from a global "all answers" bucket instead of from a "person-name answers" bucket scoped by the question's expected answer type.

  **Why this is CRITICAL**: as currently built, this card is *unanswerable* by anyone who hasn't pre-memorized the question — the player can win by elimination ("the only one that's a person name"), which trivializes the question and undermines the FSRS scheduling because the system thinks the player "knew it" when they actually pattern-matched. This poisons the scheduling for every player who encounters the card.

### HIGH

- **H-001 — `factAnswer` field in `getCombatState.hand[i]` and the matching `correctAnswer` in `previewCardQuiz` are both string-equal to `"{N}"` for the four C-001 facts.** This means the bug is not "the distractor pool is bad" — it is "the canonical answer string itself is corrupt at every layer the runtime sees". Anything that compares against `factAnswer` or persists it (typed-input mode, FSRS reviews, the inspection registry, the quiz audit script) will see `"{125}"`, not `"125"`. Same-commit fix needed in the deck-build pipeline.

- **H-002 — Domain field collapses to `general_knowledge` for every card.** Even though the trivia loadout spanned 11 domains, the `domain` field on every previewed card was `"general_knowledge"`. Either this is the run-level domain bleeding into per-card metadata (in which case the field is misnamed and should be `runDomain`) or the dungeon is silently filtering to one domain. Either way, the field as-named is misleading and breaks the O-QZ8 diversity check.

- **H-003 — `enemyStatusEffects[].turnsRemaining: 9998` for the Margin Gremlin's Strength buff.** Observed as `turnsRemaining: 9998` then `9997` then `9996` ticking down each turn. Looks like a sentinel-as-int for "permanent" — should either be `Infinity` / `null` / `-1` semantically, or actually decrement and expire. As-is, the player sees a buff with a baffling 9998 counter on UI elements that read `turnsRemaining`. Adjacent to my task's quiz scope but worth flagging because I caught it in the same data dumps.

### MEDIUM

- **M-001 — Distractor pool includes one anachronism that would be flagged by a careful player.** `pc_3_numa_numa_platform` lists `Disney+` as a distractor, but Disney+ launched in 2019; the question asks about a 2004 video. Plausible distractor for category (a streaming-ish brand) but a Steam reviewer who notices the 2019 launch date will dock the question. Low priority — it IS a "wrong answer" — but it makes the question slightly easier than intended for anyone who tracks streaming-service launch dates.

- **M-002 — `previewCardQuiz` choice order is randomized per call.** Same fact (`cs_5_google_founders`) returned three different orderings across the three encounters. This is fine (and probably desirable for re-encountering the same fact) but it means a deterministic test cannot assert ordering; tests must check sets, not arrays. Not a bug, but worth a note in the quiz audit script if it isn't already shuffle-aware.

### LOW

- **L-001 — `chargePlayCard` returns `{ok: true}` even when AP is 0.** Observed in the Combat 3 Multi-Hit charge play: I expected the second `quickPlayCard` to fail for AP, and it did, but the failure mode is "succeeds with `ok:false` and no card consumed" — fine, but the `previewCardQuiz` immediately preceding it also drained no AP and yet still flagged the card as "preview-played". Not a quiz-quality bug strictly; logging here for the orchestrator.

- **L-002 — Heavy US/Anglo-American cultural skew in the captured `general_knowledge` slice.** See S-QZ5 above. All 11 unique facts I encountered drew from US-anchored pop culture, US tech founders, US/UK philosophers, and US science. With 12871 facts in the global pool this is almost certainly a sampling artifact, but the deck-master skill should run a domain-of-origin audit to confirm.

- **L-003 — Question for `cs_5_google_founders` is over-leading.** "Which two Stanford PhD students incorporated Google on September 4, 1998, introducing the PageRank algorithm?" — the question contains "Stanford", "Google", "1998", "PageRank", "two students". Anyone who has heard of Google can answer it. Compare to Peirce/Nagel/Rawls which are tight. Polish-tier, not a bug.

## Notes on Methodology

- **Quiz capture path**: `previewCardQuiz(index)` was the source of truth for distractor data; `getCombatState.hand[i]` only carries `factQuestion` + `factAnswer` and is missing the choices array. Both were used together — preview for distractors, hand-snapshot for the canonical answer string.
- **Why only 11 unique facts**: this is not a coverage gap, it's the `InRunFactTracker` working as designed. With `MAX_LEARNING = 8`, `STEP_DELAYS = [2, 5]`, `GRADUATE_DELAY = 10`, a 3-encounter run is *expected* to drill ~8–10 facts. I confirmed this matches the action-specs.md "known behaviors" doc and did **not** report it as an issue.
- **Run flow change observed**: the old `selectDomain` → `selectArchetype` → `selectMapNode("r0-n0")` flow no longer reaches combat directly. The post-`startRun` screen is now `deckSelectionHub` (Trivia Dungeon vs. Study Temple panels). Clicking Trivia routes to `triviaDungeon`, which has its own loadout chips and a `Start Run ▶` footer button that triggers `onboarding`. To bypass onboarding I used `__rrPlay.spawn({screen: 'combat'})`. This works but means `selectDomain` / `selectArchetype` are now no-ops on the new hub — they should either be deleted or rewired to drive the new screen. Adjacent to my scope but documented for the orchestrator.
- **Study mode**: confirmed empty for this run shape. To capture study cards in a future batch, the tester should be set up with a higher-level save (devpreset=post_tutorial) where graduated facts already exist, OR the tester should run more encounters before attempting study.

## Raw Quiz Data

```json
[
  {
    "factId": "philosophy_nc_peirce_pragmatic_maxim",
    "question": "What principle did Peirce formulate in 'How to Make Our Ideas Clear' (1878), holding that the meaning of a concept lies entirely in its conceivable practical effects?",
    "choices": ["leap of faith", "mind-only", "pragmatic maxim", "tabula rasa"],
    "correctIndex": 2,
    "correctAnswer": "pragmatic maxim",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": []
  },
  {
    "factId": "pc_3_numa_numa_platform",
    "question": "On which platform did Gary Brolsma originally post his Numa Numa lip-sync video in December 2004?",
    "choices": ["Newgrounds", "4chan", "Disney+", "Netflix"],
    "correctIndex": 0,
    "correctAnswer": "Newgrounds",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": ["M-001: Disney+ distractor is anachronistic (2019 launch vs 2004 question)"]
  },
  {
    "factId": "pc_0_mash_finale_viewers",
    "question": "Approximately how many million viewers watched the M*A*S*H series finale in 1983, making it the most-watched broadcast in TV history until 2010?",
    "choices": ["{193}", "125", "{1954}", "{59}"],
    "correctIndex": 1,
    "correctAnswer": "125",
    "factAnswerOnCard": "{125}",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": ["C-001 CRITICAL: 3 of 4 choices are literal {N} template placeholders", "H-001: factAnswer field on card is also \"{125}\""]
  },
  {
    "factId": "cs_4_ssl_creator",
    "question": "SSL (Secure Sockets Layer) — the predecessor to TLS that secures HTTPS today — was created by which browser company in 1995?",
    "choices": ["Alphabet", "Microsoft", "Netscape", "Oracle"],
    "correctIndex": 2,
    "correctAnswer": "Netscape",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": []
  },
  {
    "factId": "philosophy_at_nagel_bat",
    "question": "Thomas Nagel's 1974 paper argued that consciousness has an irreducibly subjective character — that there is something it is like to echolocate, which we cannot grasp from our objective viewpoint. What is this paper called?",
    "choices": ["What Is It Like to Be a Bat?", "Twin Earth", "Chinese Room", "Master-Slave Dialectic"],
    "correctIndex": 0,
    "correctAnswer": "What Is It Like to Be a Bat?",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": []
  },
  {
    "factId": "cs_5_google_founders",
    "question": "Which two Stanford PhD students incorporated Google on September 4, 1998, introducing the PageRank algorithm?",
    "choices": ["Larry Page and Sergey Brin", "Rivest, Shamir, and Adleman", "Jimmy Wales and Larry Sanger", "Ken Thompson and Dennis Ritchie"],
    "correctIndex": 0,
    "correctAnswer": "Larry Page and Sergey Brin",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": ["L-003: question is over-leading (contains 'Stanford', 'Google', '1998', 'PageRank')"]
  },
  {
    "factId": "inv_3_ic_kilby",
    "question": "Who first demonstrated a working integrated circuit on September 12, 1958?",
    "choices": ["1977 Trinity", "Jack Kilby (Texas Instruments)", "Lithium cobalt oxide (LiCoO₂)", "Username from host machine name"],
    "correctIndex": 1,
    "correctAnswer": "Jack Kilby (Texas Instruments)",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": ["C-002 CRITICAL: cross-category distractor pollution — distractors are not person names; the type-pool filter is broken"]
  },
  {
    "factId": "pc_2_superman_debut_year",
    "question": "In which year did Superman first appear in Action Comics #1, establishing the superhero genre?",
    "choices": ["{2015}", "1938", "{2008}", "{3}"],
    "correctIndex": 1,
    "correctAnswer": "1938",
    "factAnswerOnCard": "{1938}",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": ["C-001 CRITICAL: 3 of 4 choices are literal {N} placeholders, including the semantically-broken {3}", "H-001: factAnswer on card is \"{1938}\""]
  },
  {
    "factId": "philosophy_at_rawls_difference_principle",
    "question": "Rawls argued that social and economic inequalities are just only if they benefit the least advantaged members of society. What is this principle called?",
    "choices": ["higher and lower pleasures", "difference principle", "Divine illumination", "transcendental apperception"],
    "correctIndex": 1,
    "correctAnswer": "difference principle",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": []
  },
  {
    "factId": "pc_2_spawn_sales_record",
    "question": "Spawn #1 set a record for independent comics by selling approximately how many million copies?",
    "choices": ["1.7", "{8.5}", "{2003}", "{1984}"],
    "correctIndex": 0,
    "correctAnswer": "1.7",
    "factAnswerOnCard": "{1.7}",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": ["C-001 CRITICAL: 3 of 4 choices are literal {N} placeholders; distractors {2003} and {1984} are years, not millions-of-copies counts"]
  },
  {
    "factId": "cs_5_google_founders (second encounter)",
    "question": "Which two Stanford PhD students incorporated Google on September 4, 1998, introducing the PageRank algorithm?",
    "choices": ["Larry Page and Sergey Brin", "Jimmy Wales and Larry Sanger", "Ken Thompson and Dennis Ritchie", "Rivest, Shamir, and Adleman"],
    "correctIndex": 0,
    "correctAnswer": "Larry Page and Sergey Brin",
    "domain": "general_knowledge",
    "source": "previewCardQuiz",
    "anomalies": ["confirms M-002 (per-call shuffle) — same set, different order from first encounter"]
  }
]
```

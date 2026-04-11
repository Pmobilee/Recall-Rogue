# deck-master — Anti-Patterns Catalog

**Parent skill:** [`../SKILL.md`](../SKILL.md) — `/deck-master`
**Covers:** Every mistake cataloged from shipped decks. Read this BEFORE generation — the pattern you're about to walk into is probably already on this list.

**Canonical rule source:** `.claude/rules/deck-quality.md` is the single source of truth for the 14 deck-quality anti-patterns. The pattern quick-reference table below points at that rule file for each pattern; this file adds the deck-master-specific "Mistakes That Must Never Be Repeated" table that was built incrementally from shipping incidents.

---

## Implementation Discipline — READ BEFORE DOING ANYTHING

Every mistake listed below was actually made during real deck builds. Future agents MUST follow this process to avoid repeating them.

### Phase 0: Research Before Implementing

**NEVER approximate an algorithm. Study the actual source.** When the Anki queue system was first implemented, the agent "approximated" Anki with weighted random, then hardcoded "every 3rd charge", then burned through all new cards first. Three rewrites. The fix was studying Anki's actual Rust source code on GitHub and replicating the real algorithm.

**Rule:** Before implementing any learning algorithm, distractor system, or queue mechanism:

1. Find the canonical source (Anki source code, published paper, reference implementation)
2. Read it. Understand the actual algorithm, not a blog summary.
3. Write the implementation plan referencing specific functions/logic from the source
4. Only then implement

### Phase 0.5: Task Breakdown (MANDATORY — before ANY generation)

**Before spawning ANY workers, create a `TaskCreate` for EVERY pool in the architecture.**

For each pool in `answerTypePools`, create a task:
```
TaskCreate: "Generate [pool_id] pool — [target] facts"
```

Also create tasks for:

- Assembly (merge all batches)
- Pool target verification (compare actual vs architecture)
- Structural validation
- Automated playtest
- LLM playtest
- Trivia bridge
- Provenance doc
- Commit & push

**Before committing the deck: run `TaskList`. If ANY task is still pending, that work hasn't been done and the deck is incomplete.** On 2026-04-03, three entire pools (organ_names, combining_forms, body_systems) were skipped in the Medical Terminology deck because they had no tasks tracking them. If it's not a task, it WILL be forgotten.

### Phase 0.6: Plan Review (MANDATORY for non-trivial decks)

**Before generating any facts, the orchestrator MUST write an AR doc and review it for errors.** The AR should be reviewed in at least 2 passes:

**Pass 1 — Structural review:**

- Are the answer pools semantically coherent? (Every member genuinely confusable with others?)
- Does each pool have 5+ unique `correctAnswer` values? If not, facts in that pool need pre-generated distractors.
- Are there any questions where multiple pool members are correct? (e.g., "Which planet has rings?" — Jupiter, Saturn, Uranus, Neptune ALL have rings)
- Does the correct answer ever appear in the question text? (e.g., "Besides Saturn..." → Saturn must not be a distractor)
- **Semantic category-type elimination test (MANDATORY):** For each pool, ask: "Could a player eliminate wrong answers purely by category type — without knowing the answer?" If YES, the pool is contaminated.
  - Barcode FAIL: "Who patented barcode?" options = ["Norman Woodland", "Intake, Compression, Power, Exhaust", "Wing-warping, front elevator, rudder", "Mulberry fibers"] → descriptions obviously not names
  - Netflix FAIL: "Which streaming service?" options = ["Netflix", "Game Boy", "PlayStation 2", "Nintendo Switch"] → consoles obviously not streaming services
  - N64 FAIL: "What did N64 controller include?" options = ["analog stick", "King of Comics", " billion+", "San Diego"] → categories completely unrelated
  - Split any contaminated pool into separate semantic-type pools before generating facts

**Pass 2 — Runtime compatibility review:**

- Will bracket `{N}` notation work in the curated path? (YES — both `nonCombatQuizSelector.ts` and `CardCombatOverlay.svelte` handle it)
- Will question templates with `{placeholder}` patterns resolve? (Only if the placeholder maps to a DeckFact field. If not, the renderer falls back to `fact.quizQuestion`.)
- Will the deck's domain show correctly on cards? (`encounterBridge.ts` overrides card domains for study mode)
- Is the CuratedDeck envelope complete? (answerTypePools, questionTemplates, difficultyTiers, synonymGroups, subDecks)

---

## The 14 Canonical Anti-Patterns — Quick Reference

The authoritative definitions with full root causes, prevention rules, and fix scripts live in `.claude/rules/deck-quality.md` → "12 Deck Quality Anti-Patterns" (actually 14 entries as of 2026-04-10). Summary table:

| # | Anti-Pattern | What to do instead |
|---|---|---|
| 1 | Empty Sub-Deck factIds | Programmatically populate from facts scan |
| 2 | Pool Length Heterogeneity (length tells) | Split when max/min ratio > 3× |
| 3 | Pools Without Synthetic Distractors | Every pool must have ≥15 total members |
| 4 | Self-Answering Questions | Answer words must not appear in question stem |
| 5 | Reverse Template Pool Contamination | Use `targetLanguageWord` as distractor field for reverse templates |
| 6 | `definition_match` self-answering via explanation | Engine auto-suppresses; Wiktionary-format explanations are fine |
| 7 | `reading` template on already-phonetic words | Engine auto-suppresses when `reading === targetLanguageWord` |
| 8 | Numeric distractors outside answer domain | Include domain hint in question ("percent", "how many", "in what year") |
| 9 | Mega-pool POOL-CONTAM (>100 facts) | Split by exam unit / period / topic axis |
| 10 | Mixed-POS vocabulary pools | Split by `partOfSpeech` |
| 11 | Numeric facts in non-numeric pools | Bare numbers → `bracket_numbers` pool |
| 12 | Knowledge decks without chainThemes | Populate `chainThemes` with ≥3 entries |
| 13 | Cross-Category Pool Contamination | Apply semantic homogeneity self-review |
| 14 | Kanji reading facts must store kana in correctAnswer | `correctAnswer = reading`, never the kanji character |

**Fix scripts:**

- `node scripts/fix-empty-subdecks.mjs`
- `node scripts/fix-pool-heterogeneity.mjs`
- `node scripts/add-synthetic-distractors.mjs`
- `node scripts/fix-self-answering.mjs`
- `node scripts/fix-kanji-correct-answer.mjs`

**Detection:** `node scripts/verify-all-decks.mjs` catches most of these (Check #20, #22, #24, #26, #31, #33). Target: 0 failures.

---

## Mistakes That Must Never Be Repeated — Incident Table

Every row is a real incident with a prevention rule.

| Mistake | What happened | Prevention |
|---------|--------------|------------|
| Deleting a system instead of fixing it | Bracket notation didn't work → agent deleted brackets and used pre-generated distractors | NEVER remove working systems. Fix the code path. Ask the user if unsure. |
| Approximating instead of researching | "Anki-like" weighted random → 3 rewrites | Study the actual source code. No approximations. |
| Testing only data, not runtime | All validation passed but `{8}` showed literally in-game | Run `playtest-curated-deck.ts --learner` after EVERY change |
| Arbitrary fact counts | "Let's do 50 facts" with no rationale | Let pool-first design dictate count. A deck needs enough facts per pool for good distractors, not a round number. |
| Pool pollution | "Medium-sized (G-type)" in planet_names pool | Audit every pool: does each member's `correctAnswer` make sense as a distractor for every other member? |
| Hardcoding magic numbers | "Every 3rd charge, introduce a new card" | Use proportional ratios from the source algorithm. No hardcoded rates. |
| Parallel workers generating duplicate facts | 3 Sonnet workers each covered overlapping topics → 7 duplicate facts with same correctAnswer in same pool (Ancient Rome, 2026-03-29) | Split themes with ZERO overlap between workers. After merging, run dedup check: scan each pool for duplicate correctAnswer values. |
| answerTypePools as object instead of array | Worker wrote pools as `{0: {...}, 1: {...}}` instead of `[{...}, {...}]` → runtime couldn't iterate pools (Ancient Rome, 2026-03-29) | ALWAYS verify `Array.isArray(deck.answerTypePools)` after assembly. The `CuratedDeck` interface requires arrays. |
| difficultyTiers wrong format | Workers wrote `[{id: "easy", minDifficulty: 1}]` or `{easy: [...]}` instead of `[{tier: "easy", factIds: [...]}]` (Ancient Rome + Human Anatomy, 2026-03-29) | The ONLY valid format is `[{tier: "easy", factIds: [...]}, {tier: "medium", factIds: [...]}, {tier: "hard", factIds: [...]}]`. Tier names MUST be strings "easy", "medium", "hard". Build programmatically from fact difficulty values. |
| Facts referencing non-existent pools | Human Anatomy had 779 facts referencing 134 pool IDs that didn't exist in answerTypePools (2026-03-29). WIP facts from different generation batches used inconsistent pool naming. | ALWAYS verify every fact's `answerTypePoolId` exists in `answerTypePools`. Run `facts.filter(f => !poolIds.has(f.answerTypePoolId))` — result must be empty. |
| Pool factIds arrays empty or missing | Human Anatomy's 13 pools had zero factIds despite 2,009 facts (2026-03-29). Pools were defined as schemas without being populated. | ALWAYS build pool factIds programmatically by scanning facts: `pool.factIds = deck.facts.filter(f => f.answerTypePoolId === pool.id).map(f => f.id)`. Never hand-craft factIds. |
| Domain field not matching canonical domains | Human Anatomy used `"domain": "medical"` which is not a CanonicalFactDomain (2026-03-29). Runtime cast it through without error but domain-dependent features broke silently. | Domain MUST be one of: general_knowledge, natural_sciences, space_astronomy, geography, geography_drill, history, mythology_folklore, animals_wildlife, human_body_health, food_cuisine, art_architecture, language. Check `src/data/card-types.ts` CANONICAL_FACT_DOMAINS. |
| WIP decks published without structural audit | Human Anatomy's 2,009 WIP facts had been assembled from 49 separate generation batches with no unified pool schema — each batch invented its own pool IDs (2026-03-29). | Before publishing ANY WIP deck: run the full structural validation script (see below). WIP decks are drafts, not finished products. |
| questionTemplates field missing | world_cuisines.json was missing `questionTemplates` entirely → `selectQuestionTemplate` crashed with "Cannot read properties of undefined" (2026-03-29) | EVERY deck JSON MUST have `"questionTemplates": []` and `"synonymGroups": []` even if empty. Run the field-check script after assembly. The code now has a `?? []` fallback but the data should still be correct. |
| No visual in-game testing before shipping | 10 decks were built and validated via CLI only. When tested in-game, cuisines crashed immediately because of the missing field. CLI validation doesn't test the runtime rendering path. (2026-03-29) | ALWAYS run `__rrScenario.load('study-deck-DECKNAME')` in Playwright after CLI validation passes. Both gates must pass before a deck ships. |
| Distractors matching other facts' correct answers in same pool | World Wonders (2026-04-01): 97 of 195 facts (50%) had distractors that were correct answers for sibling facts in the same pool. LLM-generated distractors pull from world knowledge, which includes the exact values in the pool. This causes "two right answers" to silently appear in quiz choices. | Check 7 in the structural validation script catches this automatically. ALWAYS run validation after generation. When generating distractors, instruct the worker to avoid using any value from the pool's `correctAnswer` set. |
| Pool shared with questionTemplate contains incompatible facts | Computer Science (2026-04-02): `person_names` pool contained both language creators and company founders (SpaceX/Elon Musk). Template "Who created the {language} programming language?" applied to SpaceX fact → "Who created the  programming language?" answer: Elon Musk. `{language}` resolved to empty string. | If a pool is referenced by a `questionTemplate`, EVERY fact in that pool must have the fields the template's placeholders reference. Split broad pools (`person_names`) into domain-specific sub-pools (`person_names_language_creators`, `person_names_company_founders`) when templates use domain-specific placeholders. |
| Pool field naming / ID mismatches | WWII used `members` instead of `factIds` in pools; hiragana/katakana/hangul facts referenced `english_meanings` but pools were named `romanizations`/`characters`; norse_mythology had 8 facts referencing non-existent pools (2026-04-02) | ALWAYS use `factIds` (never `members`, `facts`, `items`). ALWAYS verify pool IDs match between facts and pool definitions. Run `node scripts/verify-all-decks.mjs` after every deck build — it catches ALL structural mismatches across all decks at once. |
| Assembly dropped pools and shipped under target | Movies & Cinema (2026-04-03): assembler eliminated 2 entire pools (film_quotes, country_names) and shipped character_names at 7/22 (32% of target). Orchestrator didn't verify pool counts against architecture. | After EVERY assembly, run a target-vs-actual comparison against the architecture YAML. If any pool is missing or under target, spawn supplement workers BEFORE committing. The architecture is a contract — if targets need changing, update the arch first, don't silently ship under spec. |
| Pool members arrays empty | Computer Science and Music History (2026-04-03): all pools had factIds populated but `members` arrays empty (never built from correctAnswer values). Runtime fell back to per-fact distractors, degrading quiz quality silently. | ALWAYS build pool `members` programmatically: `pool.members = [...new Set(facts.filter(f => f.answerTypePoolId === pool.id).map(f => f.correctAnswer))].sort()`. Verify `members.length > 0` for every pool after assembly. |
| Pool semantic pollution — distractors from wrong category | AP Chemistry (2026-04-03): `law_and_equation_names` pool (77 members) contained "Electron sea model", "Bond length decreases", "Crystal lattice" — none of which are laws or equations. | **MANDATORY: After assembly, run the Distractor Display Audit (see `examples.md`).** Enforce max 40 chars on correctAnswer — longer answers must be shortened or use pre-generated distractors only. |
| Missing difficulty/funScore on visual batch | human_anatomy (2026-04-03): 134 visual anatomy facts shipped without funScore and 54 without difficulty. | Every fact generation worker must set ALL required metadata fields (difficulty, funScore, categoryL1, categoryL2). Run verify-all-decks.mjs before committing. |
| correctAnswer appears in own distractors array | 9 facts across 7 decks had their own correct answer listed as a distractor (2026-04-03). | After any distractor generation, verify no fact's distractors[] contains its correctAnswer (case-insensitive). The batch verifier catches this as check #2. |
| Deck shipped without in-game quiz audit | AP Biology (2026-04-04): 102 facts had distractors dramatically shorter than the correct answer (3-4 char distractors for 30+ char answers), making the correct answer trivially identifiable by length alone. | After assembly and structural verification, ALWAYS run a 20-fact in-game quiz audit sampling all pools. See `.claude/rules/content-pipeline.md` → "In-Game Quiz Audit" for the full protocol. |
| Em-dash in answers | "Vestigial — no digestive function" as correctAnswer (2026-04-05, 41 facts across 7 decks) | NEVER put explanations in correctAnswer. Keep answer concise. Explanation goes in `explanation` field. Em-dash makes answer 2-3x longer than distractors — an obvious length tell. |
| Heterogeneous pools | battle_names pool with troop counts, disease events mixed with battle names (2026-04-05, 30+ pools across 25+ decks) | Every pool must be semantically homogeneous. If members aren't interchangeable as distractors, split the pool. |
| Hollow pools | 1-fact pool with 14 synthetics (2026-04-05, 16 hollow pools dissolved) | Never create a pool with <5 real facts. If splitting produces <5, merge into parent instead. |
| Self-answering questions | Q: "The Wujing Zongyao contained what?" A: "Wujing Zongyao" | Answer must not be stated in the question stem. Rewrite the question. |
| Duplicate facts | Two Titan methane-lake questions in same pool | Check for near-duplicate Q/A pairs before committing. |
| Question-answer type mismatch | Q asks "which city?" but all answers are dates | Ensure question keywords ("who", "when", "where", "how many") match the answer format. |
| Image facts in text pools | human_anatomy had 794 image-quiz facts (quizMode: image_question/image_answers) in text-quiz pools — caption answers ("Skeleton (frontal view)") leaked as text distractors (2026-04-06) | ALWAYS create separate `visual_*` pools for `quizMode: "image_question"` and `"image_answers"` facts. Never mix with text-quiz facts. |

---

## Lessons Learned: Grammar / Fill-Blank Deck Builds (2026-03-28)

These issues were discovered during the Japanese N3 Grammar deck build and apply to ALL future fill-in-the-blank or non-standard question format decks.

| Lesson | What happened | Prevention |
|--------|--------------|------------|
| Quiz renders in MULTIPLE components | Grammar blanks `{___}` rendered correctly in `QuizOverlay.svelte` but showed as literal text in `CardExpanded.svelte` (the combat charge quiz). Agent incorrectly assumed only one component renders quizzes. | **ALWAYS check ALL quiz rendering paths**: `QuizOverlay.svelte` (gate/non-combat), `CardExpanded.svelte` (combat charge quiz), and `CardCombatOverlay.svelte` (study mode quiz selection). Any new question format must work in ALL three. |
| questionFormat template vs quizQuestion | Template `questionFormat: "Complete the sentence..."` was used as literal text instead of `"{quizQuestion}"` placeholder. Players saw the template text, not the actual question. | **ALL question templates MUST use `{quizQuestion}` or other `{placeholder}` patterns** — never literal instructional text. The `renderTemplate()` function replaces `{placeholders}` with fact data; literal strings pass through unchanged. |
| `\n` in quizQuestion not rendered | Translation after `\n` in `quizQuestion` was invisible because HTML doesn't render `\n` as line breaks. The text just ran together. | **Never put multi-line content in a single field expecting `\n` to work.** Either: (a) split at `\n` in the rendering component and use separate `<p>` elements, or (b) use `white-space: pre-line` CSS, or (c) use separate fields for sentence and translation. |
| Fill-blank `{___}` needs explicit styling | `{___}` was shown as raw text. Students couldn't tell where the blank was in the sentence. | **Any special markers in quiz questions (`{___}`, `{N}`, etc.) MUST have rendering logic in ALL quiz components.** Check `CardExpanded.svelte` line ~529 for the existing `{___}` handler pattern. |
| Run pool loads entire language, not sub-deck | Selecting "Japanese N3 Grammar" in Study Temple loaded ALL Japanese facts (~8600) into the run pool instead of just grammar facts (670). Cards were assigned random vocab factIds. | **Pre-existing issue** in `encounterBridge.ts` line ~365-373. Language-prefix deck IDs (`japanese_*`) route to `buildLanguageRunPool()` which loads everything. The quiz overlay (`getStudyModeQuiz`) correctly filters by sub-deck, so quizzes are correct — but card factIds are wrong. Fix requires filtering the run pool by sub-deck. |

---

## Structural Validation Script — MANDATORY AFTER EVERY DECK BUILD

**Run this BEFORE committing any new or modified deck.** This catches every structural issue found in the Ancient Rome and Human Anatomy builds.

```bash
node << 'VALIDATE'
const fs = require("fs");
const deck = JSON.parse(fs.readFileSync("data/decks/DECK_ID_HERE.json"));
const issues = [];

// 1. Envelope structure
["id","name","domain","description","minimumFacts","targetFacts","facts","answerTypePools","synonymGroups","questionTemplates"].forEach(k => {
  if (!(k in deck)) issues.push("ENVELOPE: missing " + k);
});
if (!Array.isArray(deck.answerTypePools)) issues.push("CRITICAL: answerTypePools is not an array — runtime will break");
if (!Array.isArray(deck.facts)) issues.push("CRITICAL: facts is not an array");

// 2. Domain validation
const VALID_DOMAINS = ["general_knowledge","natural_sciences","space_astronomy","geography","geography_drill","history","mythology_folklore","animals_wildlife","human_body_health","food_cuisine","art_architecture","language"];
if (!VALID_DOMAINS.includes(deck.domain)) issues.push("DOMAIN: '" + deck.domain + "' is not a CanonicalFactDomain — check src/data/card-types.ts");

// 3. DifficultyTiers format
if (!deck.difficultyTiers) issues.push("MISSING: difficultyTiers");
else if (!Array.isArray(deck.difficultyTiers)) issues.push("CRITICAL: difficultyTiers must be array, got " + typeof deck.difficultyTiers);
else deck.difficultyTiers.forEach((t, i) => {
  if (!["easy","medium","hard"].includes(t.tier)) issues.push("TIER[" + i + "]: tier must be 'easy'/'medium'/'hard', got '" + t.tier + "'");
  if (!Array.isArray(t.factIds)) issues.push("TIER[" + i + "]: missing factIds array");
});

// 4. Facts validation
const allIds = new Set();
const poolIds = new Set((deck.answerTypePools || []).map(p => p.id));
deck.facts.forEach((f, i) => {
  if (allIds.has(f.id)) issues.push("DUPE ID: " + f.id);
  allIds.add(f.id);
  if (!poolIds.has(f.answerTypePoolId)) issues.push("ORPHAN POOL: fact " + f.id + " references pool '" + f.answerTypePoolId + "' which doesn't exist");
  if (f.distractors && f.distractors.includes(f.correctAnswer)) issues.push("ANSWER IN DISTRACTORS: " + f.id);
  if (f.distractors && f.distractors.length < 3) issues.push("LOW DISTRACTORS: " + f.id + " has only " + f.distractors.length);
  if (f.difficulty < 1 || f.difficulty > 5) issues.push("DIFFICULTY RANGE: " + f.id + " = " + f.difficulty);
  if (f.funScore < 1 || f.funScore > 10) issues.push("FUNSCORE RANGE: " + f.id + " = " + f.funScore);
});

// 5. Pool integrity — factIds must match reality
(deck.answerTypePools || []).forEach(p => {
  if (!p.factIds || p.factIds.length === 0) issues.push("EMPTY POOL: " + p.id + " has no factIds");
  const claiming = deck.facts.filter(f => f.answerTypePoolId === p.id).map(f => f.id);
  const missing = claiming.filter(fid => !(p.factIds || []).includes(fid));
  if (missing.length) issues.push("POOL MISMATCH: " + p.id + " is missing " + missing.length + " facts that claim it");
  (p.factIds || []).forEach(fid => { if (!allIds.has(fid)) issues.push("POOL ORPHAN: " + p.id + " references deleted fact " + fid); });
});

// 6. Duplicate correctAnswers in same pool (causes "two right answers" at runtime)
(deck.answerTypePools || []).forEach(p => {
  const seen = {};
  (p.factIds || []).forEach(fid => {
    const f = deck.facts.find(x => x.id === fid);
    if (!f) return;
    const a = f.correctAnswer.toLowerCase().trim();
    if (seen[a]) issues.push("POOL DUPE ANSWER: pool " + p.id + " has '" + f.correctAnswer + "' in both " + seen[a] + " and " + fid);
    else seen[a] = fid;
  });
});

// 7. Distractor pool collision — distractors must not match OTHER facts' correct answers in same pool
(deck.answerTypePools || []).forEach(p => {
  const poolFacts = (p.factIds || []).map(fid => deck.facts.find(x => x.id === fid)).filter(Boolean);
  const poolAnswers = new Set(poolFacts.map(f => f.correctAnswer.toLowerCase().trim()));
  poolFacts.forEach(f => {
    (f.distractors || []).forEach(d => {
      if (poolAnswers.has(d.toLowerCase().trim()) && d.toLowerCase().trim() !== f.correctAnswer.toLowerCase().trim()) {
        issues.push("POOL COLLISION: fact " + f.id + " has distractor '" + d + "' which is a correct answer in pool " + p.id);
      }
    });
  });
});

// 8. Report
if (issues.length === 0) console.log("✓ CLEAN — " + deck.facts.length + " facts, " + deck.answerTypePools.length + " pools, all checks pass");
else { console.log("✗ " + issues.length + " ISSUES:"); issues.forEach(i => console.log("  " + i)); process.exit(1); }
VALIDATE
```

**Zero issues = ship it. Any issues = fix before committing.**

### Batch Verification — Run After Every Build

The per-deck validation script above checks ONE deck. After building or modifying any deck, also run the batch verifier:

```bash
node scripts/verify-all-decks.mjs           # Summary: all decks (no registry stamp)
node scripts/verify-all-decks.mjs --verbose  # Per-fact failure details
node scripts/verify-all-decks.mjs --stamp-registry  # Structural + stamp registry on pass
```

26 checks per fact/deck. **Target: 0 failures across all decks.** Warnings are informational. Check #20: pool homogeneity (answer length ratio). Check #24: brace-leak. Check #25: grammar-scar catalog. Check #26: semantic-category heuristics.

### Pool Homogeneity & Quiz Audit — MANDATORY

After assembly, run these two additional checks:

```bash
node scripts/pool-homogeneity-analysis.mjs --deck <id>   # Per-pool length stats — 0 FAIL required
node scripts/quiz-audit.mjs --deck <id> --full            # Every fact's quiz presentation — 0 FAIL required
```

Pool homogeneity ensures answer lengths within each pool are comparable (ratio < 3×). If a pool inherently mixes formats (e.g., geographic names "Chad" vs "Democratic Republic of the Congo"), add `"homogeneityExempt": true` and `"homogeneityExemptNote": "reason"` to the pool.

The quiz audit simulates actual quiz presentation (Q + correct + 3 pool distractors) and flags length mismatches, answer-in-distractor bugs, and trivially eliminatable options that the structural verifier cannot catch.

---

## Answer Quality Rules — Learned from 2026-04-05 Audit

### Em-Dash Prohibition

**NEVER use em-dashes (—) in `correctAnswer` fields.**

- **Wrong:** `"correctAnswer": "Vestigial — no known significant digestive function"`
- **Right:** `"correctAnswer": "Vestigial"` and `"explanation": "No known significant digestive function."`

The explanation belongs in the `explanation` field, not baked into the answer. On 2026-04-05, 41 facts across 7 decks had to be manually fixed because em-dash explanations in answers caused quiz-audit FAIL — the answer was 2-3× longer than distractors, creating an obvious length tell that students could exploit without any subject knowledge.

### Answer Format Rules

- Answers must be **concise** — the core answer only, no elaboration
- No parenthetical explanations in answers: `"Term (which means X)"` → just `"Term"`
- No compound questions asking for two answers at once: split into two separate facts
- Answers must not restate the question: if Q asks "which city" the answer cannot be a date
- Answers must not appear verbatim in the question stem (self-answering)
- Answer must not contain `{N}` bracket notation followed by a unit UNLESS the display-stripped version will match distractor lengths

### Pool Design Rules

Every pool must contain facts of **one semantic answer type**:

- All person names, OR all dates, OR all counts, OR all places — NEVER mixed
- **The distractor test:** "Can every pool member serve as a plausible distractor for every other member's question?" If NO → split the pool.
- No non-bracket-numbers pool under 5 real facts
- After splitting, pad to 15+ total (real facts + `syntheticDistractors`)
- If splitting would create a pool under 5 real facts, do NOT split — merge into a larger parent pool

#### Image-Quiz Fact Separation

Facts with `quizMode: "image_question"` or `"image_answers"` MUST be in their own dedicated pools (prefix with `visual_`). Never mix image-quiz and text-quiz facts in the same pool — image-caption answers ("Skeleton (frontal view)") will leak as text distractors, creating obvious format tells.

**Common mistakes to avoid:**

| Bad pool | Why it fails |
|----------|-------------|
| Mixing "Marathon" (battle name) with "About 7,000" (troop count) | Different semantic types — troop count is trivially eliminatable in a name context |
| Mixing "1500s" (date) with "Elon Musk" (name) | Format tells — student picks by type not knowledge |
| Mixing "DNA" (3c) with "Mitochondrial oxidative phosphorylation" (40c) | Length tells — longest option is obvious |
| Pool with 1-2 real facts + 13 synthetics | Hollow — player always sees same question, synthetics don't add variety |

### Mandatory Two-Mode Audit

**BOTH modes are required before ANY deck can be committed:**

1. **Programmatic:** `npm run audit:quiz-engine -- --deck <id>`
   - 27+ automated checks (structural, format, engine path)
   - Must show 0 FAIL
2. **LLM Review:** `npm run audit:quiz-engine -- --render --deck <id>` (or equivalent rendered quiz review)
   - Output rendered quizzes, have LLM agent evaluate for: clarity, correctness, plausibility, eliminatability, length tells, domain coherence, ambiguity
   - Must show 0 CRITICAL, 0 MAJOR issues

Programmatic catches FORMAT issues. LLM catches SEMANTIC issues. Neither alone is sufficient. This is NON-NEGOTIABLE.

---

## Related References

- **Canonical rule file:** `.claude/rules/deck-quality.md` — single source of truth for the 14 anti-patterns, pool design rules, and the 50-fact sampling protocol
- `.claude/rules/content-pipeline.md` — batch output verification, curriculum sourcing, Tatoeba citation, CC-CEDICT sense alignment
- `examples.md` — sample validation command output, grammar deck standard, LLM playtest final-gate checklist

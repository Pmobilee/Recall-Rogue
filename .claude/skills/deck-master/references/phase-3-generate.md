# deck-master — Phase 3: Generate

**Parent skill:** [`../SKILL.md`](../SKILL.md) — `/deck-master`
**Covers:** The generation phase — two-phase pipeline (Sonnet research + Opus polish), Wikidata SPARQL reference, worker batch limits, per-fact requirements, age tagging, distractor rules, bracket notation, synthetic pool members, runtime fact selection, and the final CuratedDeck envelope assembly.

---

## Goal

Produce the complete fact dataset conforming to the architecture spec.

---

## Two-Phase Generation Pipeline — MANDATORY

Deck generation uses a **two-phase pipeline** to ensure both factual accuracy and writing quality. This is non-negotiable — never skip phases or combine them.

### Phase 1: Sonnet Workers — Truth-Grounded Fact Generation

**Purpose:** Generate structurally complete facts grounded in ACTUAL source data. Sonnet ensures factual accuracy by working directly from fetched Wikipedia/Wikidata text.

**Before spawning workers, the orchestrator MUST:**

1. **Query Wikidata via SPARQL MCP** (`mcp__wikidata__query`) — get machine-verified structured data (dates, locations, casualty figures, participants, relationships). Example: `SELECT ?startDate ?endDate WHERE { wd:Q38789 wdt:P580 ?startDate. wd:Q38789 wdt:P582 ?endDate. }` returns exact Battle of Stalingrad dates. This is the PRIMARY source for all verifiable numerical/date claims.
2. **Fetch Wikipedia articles** via WebFetch for narrative context, quotes, explanations, and details that Wikidata doesn't capture (stories, motivations, consequences).
3. **Pass BOTH to workers** — Wikidata results (structured, machine-verified) + Wikipedia text (narrative context). Workers use Wikidata for dates/numbers and Wikipedia for explanations/stories.

**Why Wikidata SPARQL first:** During the WWII deck build (2026-03-25), 51 factual errors (6.9%) were found — almost all were wrong dates, inflated casualty figures, or rounded numbers. These are exactly the claims Wikidata stores as structured, verified data. Using SPARQL eliminates this entire error class.

**Sonnet worker setup:**

- Spawn **Sonnet** sub-agents (`model: "sonnet"`) for ALL fact generation. Haiku is not acceptable for database content.
- Each worker receives:
  - The architecture spec (pool definitions, chain themes, sub-deck assignments)
  - **ACTUAL Wikipedia/Wikidata text** for the entities being processed — this is the truth source
  - The master worker prompt from `docs/RESEARCH/SOURCES/master-worker-prompt.md` if it exists
  - A batch of entities to process (max 10 per worker to avoid token limits)
  - Max 6 workers running simultaneously
- **Core rule:** The question + correct answer of every fact MUST be verifiable in the provided source text. Workers must NOT generate facts from training knowledge alone — the source data is the ground truth.
- Workers produce structurally complete facts with all required fields (see "Per-fact requirements" below)
- Workers MAY use world knowledge for distractors, since plausible wrong answers don't need source verification.

### Phase 2: Opus Quality Pass — Prose Polish & Narrative Interweaving

**Purpose:** Elevate writing quality without changing factual content. Opus rewrites prose for engagement, adds narrative connections between sub-decks, and ensures stories read as connected arcs.

**The orchestrator (Opus) reads all Sonnet-generated facts and rewrites ONLY these fields:**

- `explanation` — make it richer, add cross-references to other entities/sub-decks
- `wowFactor` — make it genuinely surprising and share-worthy
- `visualDescription` — make it vivid and memorable for pixel art generation
- `statement` — make it clear and compelling

**Opus MUST NOT change these fields:**

- `correctAnswer` — the truth stays as Sonnet verified it
- `quizQuestion` — the question stays as written
- `distractors` — pool-based, already correct
- `difficulty` — calibrated by Sonnet against source material
- `answerTypePoolId` — structural, not prose
- `chainThemeId` — structural
- `ageGroup` — content-based, already assessed
- `id`, `sourceUrl`, `sourceName`, `volatile` — metadata

**Narrative interweaving rules for Opus pass:**

- At least 20% of explanations should reference entities from OTHER sub-decks
- Narrative arcs (e.g., Trojan War, Ragnarok, 12 Labors) should have explanations that connect sequential facts ("This is the same Fleece that Jason sailed to Colchis to find")
- Add "bridge" references between sub-decks where natural connections exist

**Why two phases?**

- Sonnet is excellent at structured extraction from source text — it stays faithful to the data
- Opus is excellent at creative writing and seeing narrative connections — it makes facts engaging
- Combining both in one step risks Opus "improving" facts by changing them to be more interesting but less accurate
- Separating phases means truth is locked in before quality polish begins

### When to Skip the Opus Pass

The two-phase pipeline is the ideal. However, Sonnet workers often produce high-quality prose that needs no polish.

**Skip the Opus pass when:**

- Sonnet explanations already connect facts into narrative arcs
- Questions already force reasoning (not just recall)
- Distractors are already semantically coherent
- The orchestrator samples 5-10 facts and finds no prose quality issues

**Do the Opus pass when:**

- Explanations are flat/disconnected ("X happened in Y year")
- Cross-subdeck references are absent
- wowFactor fields are generic or missing
- The deck is a flagship product where prose quality is a differentiator

---

## Worker Batch Size & Parallelism — CRITICAL

These limits were discovered during the WWII deck build (2026-03-25, 735 facts generated). Violating them wastes tokens and produces incomplete output.

| Rule | Detail |
|------|--------|
| **Max 30 facts per worker** | Requesting 50+ facts in a single Sonnet worker hits the 32K output token limit and silently truncates. The Holocaust subdeck (60 facts) had to be split into 2x30 after a total failure at 60. |
| **Always verify counts after return** | Workers routinely underdeliver. Western Front batch 2 was asked for 24, returned 14. ALWAYS check `len(facts)` and spawn supplement workers for shortfalls. |
| **3 parallel batches per subdeck** | Split entities into ~3 batches of 8-10 entities each, run all 3 in parallel with `run_in_background: true`. This maximizes throughput while keeping each worker under the token limit. |
| **Supplement shortfalls immediately** | After all batches return, count total. If under target, spawn one more worker with specific gap-filling instructions referencing what's already been generated. |

### Parallel Worker Deduplication Rules

When splitting fact generation across multiple parallel workers:

1. **Theme boundaries are HARD WALLS.** Worker A gets themes 0-2, Worker B gets themes 3-5, Worker C gets themes 6-7. NO overlap.
2. **After merging, scan for duplicate `correctAnswer` values within the same `answerTypePoolId`.** Two facts about the same topic in different themes will produce the same answer in the same pool — this causes "two correct answers" at runtime.
3. **Resolution options for pool duplicates:**
   - Delete the lower-quality fact
   - Move one fact to a different (more specific) pool
   - If both are genuinely different questions about the same answer, keep both but ensure the pool can handle it
4. **Run the structural validation script after EVERY merge.** Workers will independently invent formats, miss fields, and create subtle incompatibilities.

---

## Source Data — Workers ALWAYS Need Wikipedia Verification

**The architecture YAML is NOT a verified source.** YAML notes were written by LLMs in previous sessions — they may contain hallucinated dates, wrong numbers, or misattributed claims. The YAML is a research OUTLINE, not a truth source.

**Every worker MUST verify against Wikipedia/Wikidata before generating facts.** The correct workflow is:

1. Orchestrator reads the YAML to identify WHAT entities and topics to cover
2. Orchestrator queries `mcp__wikidata__query` with SPARQL to get structured data (dates, numbers, locations) for each entity — this is machine-verified, zero hallucination risk
3. Workers receive the entity list + Wikidata results AND are instructed to WebFetch Wikipedia articles for narrative context
4. Workers generate facts from the Wikipedia data they actually fetched, citing real URLs they consulted
5. The YAML notes serve as a checklist of what to look for — not as the source of truth

**What went wrong in the WWII build (2026-03-25):** 14 of 16 subdecks were generated with YAML notes passed directly to workers as if they were verified source data. The YAML had been written with research in a prior session, so the data was MOSTLY correct — but this workflow skipped the verification step that catches LLM confabulations. This was expedient but violated the sourcing rule. Future decks must not repeat this shortcut.

**The only acceptable shortcut:** If the orchestrator has PERSONALLY verified a YAML entry against Wikipedia in the current session (via WebSearch/WebFetch), that entry can be passed to workers as verified. But "it was in the YAML" alone is never sufficient provenance.

---

## Wikidata SPARQL MCP Quick Reference

The `mcp__wikidata__query` tool executes SPARQL against `https://query.wikidata.org/sparql`. **Use it as the PRIMARY source for all verifiable dates, numbers, and locations.**

**Find entity ID by name:**
```sparql
SELECT ?item ?itemLabel WHERE {
  ?item rdfs:label "Battle of Stalingrad"@en.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

**Get dates/location for an entity:**
```sparql
SELECT ?startDate ?endDate ?locationLabel WHERE {
  wd:Q38789 wdt:P580 ?startDate.
  wd:Q38789 wdt:P582 ?endDate.
  OPTIONAL { wd:Q38789 wdt:P276 ?location. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

**Bulk query (all WWII battles with dates):**
```sparql
SELECT ?battle ?battleLabel ?startDate ?endDate WHERE {
  ?battle wdt:P31 wd:Q178561.
  ?battle wdt:P361 wd:Q362.
  ?battle wdt:P580 ?startDate.
  OPTIONAL { ?battle wdt:P582 ?endDate. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?startDate
```

**Key Wikidata properties:**

- P580/P582: start/end date
- P276: location
- P1120: number of deaths
- P569/P570: birth/death date
- P1082: population
- P1086: atomic number
- P710: participant

**Workflow:**

1. Find entity ID: SPARQL `rdfs:label` search
2. Query specific properties: `wd:QXXXXX wdt:PXXX ?value`
3. Pass structured results to workers as machine-verified source data

---

## Source Data Caching

For large decks (100+ entities), source data should be cached locally:

- Save fetched Wikipedia text to `data/deck-sources/<deck_id>/` as individual `.txt` files per entity
- This prevents re-fetching on worker retries or subsequent generation batches
- Cache files are NOT committed to git — add to `.gitignore`

---

## Per-Fact Requirements

Each fact must include:

| Field | Requirement |
|-------|-------------|
| `id` | Unique, deck-scoped (e.g., `us_presidents_washington`) |
| `correctAnswer` | Max 5 words / 30 chars; bracket numeric answers: `{1789}` |
| `acceptableAlternatives` | All valid synonyms/alternates |
| `synonymGroupId` | Assigned if fact belongs to a synonym group |
| `chainThemeId` | Generic slot index (0-5), distributed evenly across all facts. Named theme assignments are NOT required for initial decks — use numeric slots only. |
| `answerTypePoolId` | Must match a pool defined in the architecture |
| `difficulty` | 1-5 per architecture tiers |
| `funScore` | 1-10 using calibration anchors from master-worker-prompt |
| `distractors` | 8-12 plausible wrong answers — LLM-generated from world knowledge, NEVER pulled from DB pools |
| `quizQuestion` | Max 15 words, ends with `?`, not self-answering |
| `explanation` | 1-3 sentences, adds context, never circular |
| `wowFactor` | 1 punchy "share-worthy" sentence shown as a popup after correct answers in-game. Must be deck-specific, not generic trivia. |
| `statement` | Clear declarative sentence of the fact (used on card face) |
| `visualDescription` | 20-40 words, vivid mnemonic scene for pixel art cardback |
| `sourceName` | Required — the authoritative source this fact comes from |
| `sourceUrl` | Strongly recommended — direct link to the source page |
| `volatile` | Boolean — true if this fact contains data that changes over time (populations, leaders, records) |
| `ageGroup` | `"all"` (suitable for kids 8+) or `"teen+"` (complex/abstract concepts best for 13+). See Age Appropriateness section below. |

---

## Age Appropriateness — MANDATORY for all decks

Every fact MUST be tagged with an `ageGroup` field. This enables the game to filter deck content based on the player's age setting.

**`"all"` (ages 8+):** The fact is concrete, engaging, and understandable by a bright 8-year-old. Examples: "What is the largest planet?", "Which planet has rings?", "What color is Mars?"

**`"teen+"` (ages 13+):** The fact involves abstract scientific concepts, complex historical context, technical terminology, or requires reasoning beyond concrete thinking. Examples: "Which planet was predicted mathematically before it was observed?", "What causes Io's volcanic activity?" (tidal forces), greenhouse effect explanations.

**Rules:**

- At least 40% of facts in every deck MUST be `"all"` — kids need a full, enjoyable deck experience, not a handful of easy questions
- When in doubt, tag `"teen+"` — it's safer to under-include for kids than to bore/confuse them
- Violence, death, sensitive historical content → always `"teen+"`
- The `ageGroup` tag does NOT affect difficulty rating — a fact can be `"all"` and difficulty 4 (hard but concrete: "Which moon is larger than Mercury?")

---

## Question Quality Rules — MANDATORY for workers

Every worker prompt MUST include these rules. They prevent factual errors that code checks can never catch:

1. **One correct answer only.** Every question must have EXACTLY ONE correct answer from the pool. If the question is "Which planet has rings?" and multiple planets have rings, the question is BAD. Rewrite to make the answer unique: "Which planet was the first discovered to have rings besides Saturn?"
2. **Answer must not appear in question text.** If the question says "Besides Saturn, which..." then Saturn MUST NOT appear as a distractor.
3. **No "trick" exclusion questions.** Questions like "Which planet does NOT have X?" are confusing with multiple choice. Rephrase positively.
4. **Verify claims against source data.** If the worker writes "Jupiter is the only planet with rings" but the source data says Uranus/Neptune also have rings, that's a factual error. Workers must cross-check claims against ALL provided source data.
5. **Distractors must be plausible for THIS question.** "Venus" is a valid planet distractor in general, but for "Which planet has moons named Phobos and Deimos?" Venus (0 moons) is a freebie. Prefer distractors that could genuinely confuse a learner.

---

## Pool Size & Pre-Generated Distractor Fallback

**Runtime distractor selection uses the answer type pool.** But pools with fewer than **5 unique `correctAnswer` values** (after excluding the correct answer and synonyms) are too small for sensible pool-based distractors. The runtime automatically falls back to the fact's pre-generated `distractors[]` array when this happens.

**What this means for deck design:**

- **Pools with 5+ unique answers** (planet_names, moon_names, mission_names): distractors come from the pool at runtime. The `distractors[]` field on each fact is a backup but won't normally be used. You still generate 8 per fact as a safety net.
- **Pools with <5 unique answers** (system_facts, or any small specialty pool): the runtime ignores the pool and uses the fact's pre-generated `distractors[]` directly. These MUST be high quality — 8 plausible wrong answers crafted by the LLM for each specific question.

**When generating facts, workers MUST always provide 8 pre-generated distractors** regardless of pool size. The runtime decides whether to use pool or pre-generated based on pool viability. This is NOT optional — facts with empty `distractors[]` in small pools will have no distractors at all.

---

## Synthetic Pool Members — Padding Small Pools

Some answer type pools have too few real facts to provide good distractor variety, but pooled selection is still preferable to per-fact pre-generated distractors. **Synthetic pool members** solve this: plausible wrong answers stored in `AnswerTypePool.syntheticDistractors` that pad the candidate pool at runtime without corresponding quiz facts.

**What they are:** Strings added to the `syntheticDistractors` array on an `AnswerTypePool` object. They appear as distractors at runtime but have no quiz fact, no FSRS history, and no chainThemeId. They exist solely to widen the distractor candidate pool.

**When to use:**

- Pools with **< 8 real facts** — add synthetics to bring total candidates up
- Critical for pools with **< 5 real facts**: below this threshold the runtime falls back to pre-generated distractors entirely (pool-based selection is skipped). Synthetics can prevent this fallback.
- **Numeric pools**: do NOT use synthetics — use bracket notation instead. The runtime generates numeric distractors automatically.

**How the runtime uses them:**

- Real pool members enter the candidate pool with score **1.0** (always preferred)
- Synthetic pool members enter with score **0.5** (used when real members are exhausted or when more candidates are needed)
- The **pool viability check** counts real + synthetic members combined: if total ≥ 5, pool-based selection proceeds instead of falling back to pre-generated distractors

**Best practices:**

- Add **7–12 synthetics** per small pool — enough for multiple questions without repetition
- Must be **semantically coherent** with the pool (all cities for a city pool, all instrument names for an instrument pool)
- Must **NOT overlap** with any `correctAnswer` in the same pool — that would create two correct answers for the same question
- Must **NOT overlap** with `correctAnswers` in other pools — would confuse the confusion matrix and corrupt adaptive difficulty
- Must be **plausible enough** that a learner could reasonably confuse them with correct answers — the whole point is realistic distractor variety
- For numeric pools: use bracket notation (`{N}`) instead — never add numeric synthetics

**Data format:**

```json
{
  "id": "place_names",
  "format": "place",
  "factIds": ["fact_new_orleans", "fact_ms_delta", "fact_salzburg"],
  "syntheticDistractors": ["Memphis", "Chicago", "Detroit", "Nashville", "Liverpool", "Vienna", "Berlin", "Paris", "London", "St. Louis"]
}
```

**Example — music_history `place_names` pool:**

- 3 real facts: New Orleans, Mississippi Delta, Salzburg
- 10 synthetic distractors: Memphis, Chicago, Detroit, Nashville, Liverpool, Vienna, Berlin, Paris, London, St. Louis
- Combined: 13 candidates for distractor selection — pool viability check passes (≥ 5), pool-based selection proceeds

---

## Distractor Rules — Non-Negotiable

### Distractors Must Be LLM-Generated From World Knowledge

Distractors MUST be generated by the LLM reading the specific question and producing plausible wrong answers from world knowledge. NEVER use `SELECT correct_answer FROM facts WHERE ...` or any DB query to source distractors. Post-generation DB validation is permitted to check for accidental matches.

### Distractor Variation Is BY DESIGN — do not "fix" it

Pool-based distractors deliberately vary between repetitions of the same fact (via jitter shuffle). This is intentional and superior to fixed distractors:

- **Fixed distractors** (Anki-style): player memorizes "not Titan, not Ganymede" through process of elimination. Tests distractor recognition, not knowledge.
- **Varying distractors** (our approach): player sees different wrong answers each time. Must actually KNOW the correct answer, not just eliminate familiar wrong ones. Deeper learning.

**LLM playtests may flag this as a bug** ("distractors should be consistent across repetitions"). It is NOT a bug. If an LLM reviewer says this, note it as "working as designed" and move on.

---

## Bracket Notation for Numeric Answers — SUPPORTED

Curated decks fully support `{N}` bracket notation for numeric answers (e.g., `"{8}"`, `"{4.6} billion years"`, `"About {8} minutes"`). The curated quiz paths (`nonCombatQuizSelector.ts` and `CardCombatOverlay.svelte`) detect bracket answers and route them through `getNumericalDistractors()` + `displayAnswer()` from `numericalDistractorService.ts`.

**How to use:**

1. Set `correctAnswer` to the bracket-notated value: `"{8}"`, `"{101}"`, `"{4.6} billion years"`
2. Set `distractors` to `[]` (empty array) — the runtime generates plausible wrong numbers
3. Set `answerTypePoolId` to `"bracket_numbers"` — these facts form their own pool but distractors come from the bracket generator, NOT from the pool
4. The `bracket_numbers` pool exists for organizational purposes and pool-size validation, but the runtime NEVER uses it for distractor sourcing — bracket facts always self-generate distractors

**What the runtime does:**

- Detects `{N}` via `isNumericalAnswer()` → generates nearby plausible wrong numbers via `getNumericalDistractors()`
- Strips braces for display via `displayAnswer("{8}")` → `"8"`
- The player sees clean numbers, never curly braces

---

## Runtime Fact Selection — Anki-Faithful Learning Step Model

Curated deck fact selection uses Anki's actual learning step model (`curatedFactSelector.ts` + `inRunFactTracker.ts`). Deck designers must understand this because it directly shapes the player experience.

**Three card states (not simple queues — states with timers):**

| State | Meaning | How it got here |
|-------|---------|-----------------|
| **NEW** | Never seen this run | Default for all facts at run start |
| **LEARNING** | Seen but not graduated. Has step counter + due timer. | Correct on NEW card, or wrong on ANY card |
| **GRADUATED** | Completed all learning steps | Correct on final learning step |

**Learning step progression (adapted from Anki's 1min/10min to charges):**

| Event | Result |
|-------|--------|
| NEW card + correct | → LEARNING step 0. Due in **2 charges**. |
| LEARNING step 0 + correct | → LEARNING step 1. Due in **5 charges**. |
| LEARNING step 1 + correct | → **GRADUATED**. Due in **10 charges**. |
| ANY card + **wrong** | → LEARNING step 0. Due in **2 charges**. (Anki "Again") |
| GRADUATED + correct | Stays graduated. Due in **10 charges**. |
| GRADUATED + wrong | **Un-graduates**. Back to LEARNING step 0. |

**Selection priority (exactly Anki):**

1. **Due learning cards** — any LEARNING card whose charge timer expired. ALWAYS shown first. These are time-critical.
2. **Main queue (Intersperser)** — proportional mix of due GRADUATED reviews + NEW cards. Ratio: `P(review) = reviewCount / (reviewCount + newCount)`.
3. **Ahead learning** — LEARNING cards not yet due. Only if nothing else available.
4. **Fallback** — any card except the last one shown.

**New card introduction cap:** Max 8 cards in LEARNING state at once. If 8 cards are learning, no new cards are introduced until some graduate. This prevents overwhelming the player.

**What a typical session looks like (25 charges, all correct):**

- Charges 1-3: Three NEW cards introduced
- Charges 4-6: Those 3 come back as LEARNING (step 0 → step 1)
- Charges 7-9: Three more NEW cards while step-1 cards wait
- Charges 10-12: First batch returns (step 1 → GRADUATE)
- Charges 13-15: Second batch returns (step 0 → step 1)
- Charge 25: First REVIEW appears (graduated card's 10-charge timer expires)

**Never repeats immediately.** The last shown card is always excluded.

**Implications for deck design:**

- Decks need 30+ facts minimum. The learning cap (8) + graduation delays mean ~9 unique cards rotate in early gameplay.
- Wrong answers come back aggressively (2 charges). Design distractors to be plausibly confusing — the confusion matrix feeds on wrong answers.
- The wow factor popup shows after correct answers on Learning-tier cards (max 3 per encounter). Each fact's `wowFactor` field must be present and deck-specific.

---

## Synonym Group Computation

After generation, run the `acceptableAlternatives` intersection algorithm (DECKBUILDER.md section 4.6):

- Vocabulary decks: fully automated
- Knowledge decks: review any flagged overlaps manually before committing

---

## Assembly — CuratedDeck Envelope Format (CRITICAL)

The final deck JSON file is NOT a flat array of facts. It MUST be wrapped in the `CuratedDeck` envelope that the runtime expects (`src/data/curatedDeckTypes.ts`). Workers generate facts as a flat array, then the orchestrator wraps them.

**The orchestrator MUST wrap the merged facts into this structure:**

```json
{
  "id": "solar_system",
  "name": "Solar System",
  "domain": "space_astronomy",
  "subDomain": "solar_system",
  "description": "Player-facing description (1-2 sentences, engaging)",
  "minimumFacts": 60,
  "targetFacts": 76,
  "facts": [ ...all generated facts... ],
  "answerTypePools": [
    {
      "id": "planet_names",
      "label": "Planet Names",
      "answerFormat": "name",
      "factIds": ["...scan facts for answerTypePoolId === 'planet_names'..."],
      "minimumSize": 5
    }
  ],
  "synonymGroups": [
    {
      "id": "venus_names",
      "factIds": ["...facts with overlapping acceptableAlternatives..."],
      "reason": "Same planet, different names"
    }
  ],
  "questionTemplates": [
    {
      "id": "planet_from_feature",
      "answerPoolId": "planet_names",
      "questionFormat": "Which planet has {feature}?",
      "availableFromMastery": 1,
      "difficulty": 2,
      "reverseCapable": false
    }
  ],
  "difficultyTiers": [
    {"tier": "easy", "factIds": ["...difficulty 1-2..."]},
    {"tier": "medium", "factIds": ["...difficulty 3..."]},
    {"tier": "hard", "factIds": ["...difficulty 4-5..."]}
  ],
  "subDecks": [
    {
      "id": "planets",
      "name": "Planets & System",
      "factIds": ["...subset of fact IDs..."]
    }
  ]
}
```

**Build the envelope programmatically** — scan the facts array to populate `answerTypePools[].factIds`, `difficultyTiers[].factIds`, and `synonymGroups[].factIds`. Never hand-craft these arrays.

### Schema Drift Normalization

When assembling the final deck from WIP files, expect schema drift between batches:

| Issue | Fix |
|-------|-----|
| `chainTheme` instead of `chainThemeId` | Rename field |
| `categories` instead of `answerTypePoolId` | Replace with `"historical_events"` default |
| Variants with `answer` instead of `correctAnswer` | Rename field |
| Missing `acceptableAlternatives` | Default to `[]` |
| Missing `volatile` | Default to `false` |
| Bare array `[...]` instead of `{"facts": [...]}` | Wrap in object |

The assembly worker must normalize all of these. Always validate the final deck with a script that checks every fact has all required fields.

### Pool Consolidation Rules (for WIP/Legacy Decks)

When publishing a deck assembled from WIP fragments (like Human Anatomy's 49 batches):

1. **Inventory all pool IDs used by facts** — `new Set(deck.facts.map(f => f.answerTypePoolId))`
2. **Map orphan pools to canonical pools** using semantic similarity (e.g., `anatomy_structures` → `structure_names`)
3. **Create new pools only when no existing pool fits** (e.g., `immune_terms` for immunology-specific content)
4. **Rebuild ALL pool factIds from scratch** — never trust existing factIds arrays from WIP batches
5. **Accept that consolidated pools will have duplicate answers** — multiple facts about "skull" in `structure_names` is educationally valid. The runtime handles this correctly (those facts won't distract each other).

### CRITICAL Structural Checks After Assembly

- `Array.isArray(deck.answerTypePools)` — MUST be true (not an object with numeric keys)
- `Array.isArray(deck.difficultyTiers)` — MUST be true
- Every tier has `.tier` as string ("easy"/"medium"/"hard") and `.factIds` as array
- Every fact's `answerTypePoolId` exists in `answerTypePools`
- Every pool's `factIds` matches reality (scan facts, don't trust pre-built arrays)
- `deck.domain` is a valid `CanonicalFactDomain` from `src/data/card-types.ts`
- Run the structural validation script from `anti-patterns.md` before committing

**MANDATORY envelope fields — ALL must be present even if empty:**

- `questionTemplates: []` — MUST exist (even if empty). The runtime calls `.filter()` on this array. Missing = crash.
- `synonymGroups: []` — MUST exist (even if empty).
- `difficultyTiers: [{tier: "easy", factIds: [...]}, ...]` — MUST be array with string tier names.
- `answerTypePools: [...]` — MUST be array (not object).

---

## Manifest Update

**After writing the deck JSON**, update `data/decks/manifest.json` to include the new deck filename in the `decks` array:

```json
{
  "decks": [
    "existing_deck.json",
    "new_deck.json"
  ]
}
```

The curated deck store (`src/data/curatedDeckStore.ts`) reads this manifest at app startup to discover available decks. If a deck is not in the manifest, it won't be loaded.

---

## What's Next After Generation

Once the deck JSON + manifest are complete, run the full Post-Assembly Quality Gate from `../SKILL.md` → "Post-Assembly Quality Gate", then proceed to the LLM Playtest final gate (described in `examples.md`), then the Trivia Bridge step for knowledge decks.

Before marking the task done, run `TaskList` and verify zero pending tasks. Three entire pools were skipped in the Medical Terminology deck because they weren't tracked as tasks.

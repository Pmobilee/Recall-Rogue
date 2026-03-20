# AR-108: Grounded Fact Pipeline — Wikipedia + Wikidata Verified Facts

**Status:** ACTIVE
**Priority:** CRITICAL — all 3,293 existing knowledge facts are unverified LLM hallucinations
**Estimated complexity:** Large (pipeline rebuild + master system prompt + pilot test)

---

## Problem Statement

Every knowledge fact in the database was generated entirely from LLM memory. The "entity data" from Wikidata contained only labels and Q-IDs — no actual claims. Sonnet invented all numbers, dates, measurements, and specific claims from its training data. The `sourceName: "Wikipedia"` and `sourceUrl` fields are cosmetic — nothing was actually verified against those sources.

**Scale of damage:** 3,293 facts across 10 domains, all unverified.

**Previous QA reviews** (which caught ~40-60% issues) were also LLM-from-memory — reviewer and generator share the same training data, so they agree on the same wrong numbers.

---

## Solution: The LLM Is a Writer, Not a Researcher

The fundamental architecture shift:

```
OLD (broken):
  Sparse entity seed → Sonnet invents facts from memory → unverifiable output

NEW (grounded):
  Wikipedia extract (human-curated interesting content)
  + Wikidata structured claims (machine-verified numbers)
  → Sonnet transforms real data into engaging quiz questions
  → Every number/date/claim traceable to source
```

**The LLM's job changes from RESEARCHER to WRITER.** It decides what's interesting and how to phrase it, but it NEVER invents a factual claim.

---

## Data Sources & What They Provide

### Wikipedia Extract API (the "interestingness filter")
- **Endpoint:** `https://en.wikipedia.org/w/api.php?action=query&titles={TITLE}&prop=extracts&exintro=1&explaintext=1&format=json`
- **What it gives:** Human-curated article introductions — editors already put the most notable/interesting facts first
- **Tested results:**
  - Horse: domestication ~4000 BCE, 45-55M years evolution, sleep standing up, gestation ~11 months, lifespan 25-30 years
  - Pluto: 1/6 mass of Moon, 5.5 hours for light to reach, discovered 1930, reclassified 2006, New Horizons 2015
- **Why it works:** Wikipedia editors are the world's largest volunteer editorial team for "what's interesting about X"

### Wikidata Structured Claims (the "ground truth numbers")
- **Endpoint:** `https://query.wikidata.org/sparql`
- **Query (excluding external IDs):**
```sparql
SELECT ?propLabel ?valueLabel WHERE {
  wd:{QID} ?p ?statement .
  ?statement ?ps ?value .
  ?prop wikibase:claim ?p ;
        wikibase:statementProperty ?ps .
  ?prop wikibase:propertyType ?ptype .
  FILTER(?ptype NOT IN (wikibase:ExternalId, wikibase:Url, wikibase:CommonsMedia))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
```
- **Quality varies by domain:**
  - Space/science entities: RICH (diameter, mass, orbital period, temperature, discovery date)
  - Animals: SPARSE (mostly taxonomic — heart rate, produced sound, has parts)
  - History: MODERATE (birth/death dates, nationality, significant events)
- **Role:** Cross-check any number the LLM puts in a fact. If Wikidata says Pluto's diameter is 2376km and the LLM writes 2300km, flag it.

### Extended Wikipedia Sections (for entities with sparse Wikidata)
- **Endpoint:** `https://en.wikipedia.org/w/api.php?action=query&titles={TITLE}&prop=extracts&explaintext=1&format=json` (full article, not just intro)
- **When to use:** Animal entities where Wikidata has almost no factual claims
- **Parse strategy:** Extract first 3000 chars (intro + first sections), which contain the densest factual content

---

## Master System Prompt for Sonnet Workers

This is the single most important artifact. Every Sonnet worker gets this verbatim. It must be perfect.

### Design Philosophy (informed by research)

**From curiosity psychology (Loewenstein 1994, Kang et al.):**
- Maximum curiosity occurs when the player has PARTIAL knowledge — familiar entity, unfamiliar fact
- The "Goldilocks zone": not too obvious, not too obscure
- Surprising answers that violate expectations are most engaging

**From psychometrics (ETS, NBME item writing guidelines):**
- Distractors should represent common misconceptions, not random alternatives
- All options must be parallel in structure, length, and grammar
- A distractor selected by <5% of test-takers is "nonfunctional" — it's too obviously wrong
- The correct answer should never be distinguishable by length, specificity, or grammar alone

**From quiz game design (Trivial Pursuit, QuizUp, pub quiz masters):**
- Questions that involve unexpected comparisons or superlatives score highest engagement
- "What is the only X that Y?" framing is consistently more compelling than "What is X's Y?"
- The best trivia makes you say "wait, really?" — not "oh, I should have known that"

**From LLM quiz generation research:**
- LLMs achieve only 70-91% factual accuracy when generating from memory
- Accuracy degrades as the batch gets longer (later questions in a batch are worse)
- Numerical answers have the highest hallucination rate
- LLM-validates-LLM approach works but requires grounded source data to be effective

### The Prompt

```
You are a quiz question writer for Recall Rogue, an educational card roguelite game.

## YOUR ROLE
You are a WRITER, not a researcher. You will receive:
1. A Wikipedia extract about an entity (the "interesting content")
2. Wikidata structured claims about that entity (the "verified numbers")

Your job: transform this real data into engaging quiz questions.

## THE GOLDEN RULE
**NEVER invent a factual claim.** Every number, date, measurement, name, and specific assertion
in your output MUST come from either the Wikipedia extract or the Wikidata claims provided.
If neither source mentions a fact, you CANNOT use it — no matter how confident you are.

If the sources contradict each other, use the Wikidata value (more recently updated) and note
the discrepancy in the explanation field.

## WHAT MAKES A GREAT QUIZ FACT

Rank these question types from BEST to WORST:

**TIER 1 — "Wait, really?" (funScore 8-10)**
These make the player stop and think. They violate expectations.
- Unexpected comparisons: "Cleopatra lived closer to the Moon landing than to the Great Pyramid"
- Surprising superlatives: "The shortest war in history lasted 38 minutes"
- Counterintuitive facts: "Bananas are berries, but strawberries aren't"
- "Only X that Y" facts: "Horses are one of the few animals that can't vomit"
Pattern: familiar entity + surprising property

**TIER 2 — "Huh, I didn't know that" (funScore 5-7)**
Genuinely interesting and educational. The player learns something they'd share.
- Notable numbers: "Light takes 5.5 hours to reach Pluto"
- Historical context: "Horses were domesticated around 4000 BCE"
- Vivid details: "A foal can stand and run within hours of birth"
Pattern: educational + memorable

**TIER 3 — "Okay, I guess" (funScore 3-4)**
True but not exciting. Only include if no better facts exist for this entity.
- Basic taxonomy: "Horses belong to the family Equidae"
- Simple definitions: "Pluto is classified as a dwarf planet"
- Common knowledge: "Horses eat grass"
Pattern: true but boring — the player doesn't feel enriched

**NEVER GENERATE (auto-reject):**
- Classification questions: "What type of animal is a horse?" → "mammal"
- Definitional questions: "What is the scientific name for X?"
- Questions where the answer is in the question
- Questions about things the sources don't mention

## HOW TO WRITE QUESTIONS

**Question stem rules:**
- Max 20 words, must end with ?
- Never include the answer or significant answer words (5+ chars) in the question
- Prefer active, specific phrasing over passive/generic
- Use framing that creates curiosity: "What unexpected ability...", "How long...", "Which is the only..."
- NEVER start with "What type/kind/category of..."

**Answer rules:**
- Max 5 words / 30 characters
- Must be the definitive, unambiguous correct answer
- Must come DIRECTLY from the source data provided

**Explanation rules:**
- 1-3 sentences, adds context beyond the question
- Must cite which source the fact comes from
- Never circular ("X is X because X")
- Should make the player go "oh cool" — add a vivid detail or connection

## HOW TO WRITE DISTRACTORS

Distractors are the wrong answers. They are critically important — bad distractors
make the game feel cheap and stupid.

**The distractor test:** Would a smart player who doesn't know the answer find ALL
options equally plausible? If any distractor is obviously wrong, it's garbage.

**Rules:**
1. **Same type as the answer.** If the answer is a number, distractors are numbers.
   If a country, other countries. If a time period, other time periods.
2. **Same format and length.** "4000 BCE" needs distractors like "3500 BCE", "5000 BCE" —
   not "a long time ago" or "ancient times".
3. **Plausible but wrong.** Each distractor should represent a common misconception or
   a reasonable guess. For "How long is a horse's gestation?" (11 months), good distractors
   are 6, 9, 14 months — not 2 days or 10 years.
4. **From the same domain.** For "Who discovered Pluto?" (Clyde Tombaugh), distractors
   should be other astronomers (Edwin Hubble, Percival Lowell, William Herschel) —
   not random scientists.
5. **Generate 8 distractors.** This gives the game engine options for difficulty scaling.
6. **NEVER use:** "Unknown", "None of the above", "All of the above", "N/A",
   generic concept words, numbered placeholders, single characters, empty strings.
7. **NEVER include the correct answer in the distractors.**

**Distractor anti-patterns (auto-reject the entire fact if these appear):**
- Random English nouns as distractors for a specific-domain question
- Distractors that are secretly correct (e.g., "Cougar" as distractor when answer is "Puma")
- Distractors from a completely different category than the answer
- Template distractors reused across multiple facts

## HOW TO WRITE VARIANTS

Each fact needs 4+ question variants — different angles on the same knowledge.

| Type | What it does | Example |
|------|-------------|---------|
| forward | Standard question | "How long is a horse's gestation?" → "11 months" |
| reverse | Answer→Entity | "Which animal has an 11-month gestation?" → "Horse" |
| negative | "Which is NOT..." | "Which is NOT a type of horse breed?" → pick the odd one out |
| truefalse | Statement verification | "Horses can sleep standing up." → "True" |
| context | Scenario-based | "A farmer notices their mare is due after nearly a year. How many months?" → "11" |
| fill_blank | Complete the sentence | "Horses can sleep both ___ and lying down." → "standing up" |

**Each variant MUST have its own tailored distractors** — not copies of the main distractors.
Reverse questions need entity-type distractors (other animals), not property-type distractors.

## CATEGORIZATION

Every fact must be assigned:
- `categoryL1`: The domain (e.g., "animals_wildlife", "space_astronomy")
- `categoryL2`: A valid subcategory from the taxonomy. Use the subcategory that best fits
  the TOPIC of the question, not the entity type. A question about horse evolution goes in
  "animal_behaviors_abilities" or "animal_records_extremes", not just "mammals".

## SOURCE ATTRIBUTION

- `sourceName`: "Wikipedia" if from Wikipedia extract, "Wikidata" if from structured claims
- `sourceUrl`: The Wikipedia article URL for this entity
- `sourceVerified`: true (NEW FIELD — this fact has been verified against source data)

## OUTPUT SCHEMA

Return a JSON array. Each fact:
{
  "id": "domain-entity-slug",
  "type": "knowledge",
  "domain": "Animals & Wildlife",
  "subdomain": "mammals",
  "categoryL1": "animals_wildlife",
  "categoryL2": "mammals",
  "categoryL3": "",
  "statement": "...",
  "quizQuestion": "...",
  "correctAnswer": "...",
  "distractors": ["8 plausible wrong answers"],
  "acceptableAnswers": ["alternate phrasings of correct answer"],
  "explanation": "...",
  "wowFactor": "...",
  "variants": [4+ variants with type/question/answer/distractors],
  "difficulty": 1-5,
  "funScore": 1-10,
  "noveltyScore": 1-10,
  "ageRating": "kid|teen|adult",
  "rarity": "common|uncommon|rare|epic",
  "sourceName": "Wikipedia|Wikidata",
  "sourceUrl": "https://en.wikipedia.org/wiki/...",
  "sourceVerified": true,
  "contentVolatility": "timeless|slow_changing|fast_changing",
  "sensitivityLevel": 0,
  "sensitivityNote": null,
  "visualDescription": "20-40 word vivid pixel art scene",
  "tags": ["relevant", "tags"],
  "_haikuProcessed": true,
  "_haikuProcessedAt": "ISO date"
}

## QUALITY TARGETS

Per entity, generate 3-5 facts. Aim for:
- At least 1 Tier 1 ("wait, really?") fact per entity if the data supports it
- No more than 1 Tier 3 fact per entity (and only if you can't find better)
- Fun score standard deviation across the batch should be > 1.5
- EVERY number in your output must be traceable to a source field
```

---

## Pipeline Architecture

### Stage 1: Entity Enrichment Script

A Node.js script that, for each entity in `data/curated/{domain}/entities.json`:

1. **Fetch Wikipedia extract** via MediaWiki API
2. **Fetch Wikidata claims** via SPARQL (excluding external IDs)
3. **Store enriched entity** in `data/curated/{domain}/entities-enriched.json`

```javascript
// Pseudocode
async function enrichEntity(entity) {
  const wikiTitle = await getWikiTitle(entity.qid); // Wikidata sitelink
  const extract = await fetchWikipediaExtract(wikiTitle);
  const claims = await fetchWikidataClaims(entity.qid);

  return {
    ...entity,
    wikipediaExtract: extract,        // first 3000 chars of article intro
    wikidataClaims: claims,           // filtered factual claims (no external IDs)
    enrichedAt: new Date().toISOString()
  };
}
```

### Stage 2: Fact Generation (Sonnet Workers)

Each worker receives:
- The master system prompt (verbatim, never summarized)
- A batch of 5-10 enriched entities (smaller batches = higher quality, per LLM research)
- The full output schema

Worker outputs JSON facts. Orchestrator validates against 11 gates.

### Stage 3: Source Verification Gate (NEW)

After generation, before merge:
- For every numerical claim in a generated fact, check if it appears in the Wikipedia extract or Wikidata claims
- If a number doesn't match any source data, FLAG IT — it was hallucinated despite instructions
- This is the "trust but verify" layer

### Stage 4: QA Review (existing, but now with source data)

Reviewers receive both the generated facts AND the source data, so they can cross-check.

---

## Sub-Steps

### Phase A: Build the Pipeline (infrastructure)

- [x] **A1.** Create `scripts/content-pipeline/enrich-entities.mjs` — fetches Wikipedia extracts + Wikidata claims for all entities in a domain
- [ ] **A2.** Create `data/curated/{domain}/entities-enriched.json` schema and storage
- [ ] **A3.** Create `scripts/content-pipeline/verify-sources.mjs` — post-generation source verification gate
- [x] **A4.** Save the master system prompt as `docs/RESEARCH/SOURCES/master-worker-prompt.md` (single source of truth, never duplicated)
- [ ] **A5.** Update the ingest skill (`manual-fact-ingest-dedup/SKILL.md`) to reference new pipeline

### Phase B: Pilot Test (Horse + Pluto)

- [x] **B1.** Enrich Horse (Q726) and Pluto (Q339) entities
- [x] **B2.** Generate facts using the new pipeline with a single Sonnet worker
- [x] **B3.** Manually review output quality — are facts grounded? Are they fun?
- [ ] **B4.** Compare quality against the old hallucinated facts for the same entities
- [x] **B5.** Adjust the master system prompt based on pilot results
- [ ] **B6.** Run source verification gate — did the LLM sneak in any unsourced claims?

### Phase C: Scale Decision (after pilot)

- [ ] **C1.** Based on pilot quality, decide: full regeneration of all 3,293 facts, or domain-by-domain?
- [ ] **C2.** Flag existing facts as `sourceVerified: false`
- [ ] **C3.** Regenerate domain-by-domain, enriching entities first
- [ ] **C4.** Rebuild DB after each domain completes

---

## Pilot Results (2026-03-20)

### 4 Pilot Batches Completed

| Batch | Entities | Facts | Quality |
|-------|----------|-------|---------|
| 1 | Horse, Pluto | 8 | Schema issues (wrong field names) — prompted master prompt v1.0 |
| 2 | Leonardo, Jupiter, Chocolate, Cleopatra | 13 | Correct schema, all fields present |
| 3 | Tiger, Great Wall, Bee | 9 | Numerical tagging working, all grounded |
| 4 | Octopus, Great Pyramid, Coffee | 9 | Brace markers working perfectly |

### Key Innovations During Pilot

1. **Brace marker system** — Sonnet marks variable numbers with `{N}` syntax (e.g., `"{107} days"`). Runtime service varies the number for infinite distractor variety. Non-numerical answers get 8 pre-generated distractors.

2. **Runtime numerical distractor service** — `src/services/numericalDistractorService.ts` — handles brace extraction, magnitude-aware number variation, format preservation. Wired into `quizService.getQuizChoices()` and `masteryChallengeService.buildDistractorPool()`.

3. **Wikipedia + Wikidata dual source** — Wikipedia extracts provide the "interestingness filter" (human-curated notable content), Wikidata provides ground truth numbers. The LLM is a writer, not a researcher.

### Files Created/Modified

| File | Action |
|------|--------|
| `scripts/content-pipeline/enrich-entities.mjs` | CREATED — entity enrichment (Wikipedia + Wikidata) |
| `docs/RESEARCH/SOURCES/master-worker-prompt.md` | CREATED — master system prompt for Sonnet workers |
| `src/services/numericalDistractorService.ts` | CREATED — runtime numerical distractor generation |
| `src/services/quizService.ts` | UPDATED — brace-aware quiz choices + grading |
| `src/services/masteryChallengeService.ts` | UPDATED — numerical variant fallback |

---

## Acceptance Criteria

### Pilot (Phase B)
- [ ] Horse generates 3-5 facts, ALL numbers match Wikipedia/Wikidata source data
- [ ] Pluto generates 3-5 facts, ALL numbers match Wikipedia/Wikidata source data
- [ ] Source verification gate catches 0 unsourced numerical claims
- [ ] At least 50% of facts are Tier 1 or Tier 2 (funScore >= 5)
- [ ] No self-answering questions, no secretly-correct distractors
- [ ] All variants have tailored distractors

### Full Pipeline (Phase C)
- [ ] Every generated fact has `sourceVerified: true`
- [ ] Every numerical claim traceable to Wikipedia or Wikidata
- [ ] DB rebuild succeeds with 0 invalid subcategories
- [ ] Fun score distribution: mean >= 5, std_dev >= 1.5

---

## Files Affected

| File | Action |
|------|--------|
| `scripts/content-pipeline/enrich-entities.mjs` | CREATE — entity enrichment script |
| `scripts/content-pipeline/verify-sources.mjs` | CREATE — post-gen source verification |
| `docs/RESEARCH/SOURCES/master-worker-prompt.md` | CREATE — master system prompt |
| `data/curated/{domain}/entities-enriched.json` | CREATE — enriched entity data |
| `.claude/skills/manual-fact-ingest-dedup/SKILL.md` | UPDATE — reference new pipeline |
| `docs/RESEARCH/SOURCES/content-pipeline-spec.md` | UPDATE — new pipeline architecture |
| `src/data/seed/knowledge-*.json` | UPDATE — regenerated facts (Phase C) |

---

## Verification Gate

- [ ] `enrich-entities.mjs` successfully fetches data for Horse and Pluto
- [ ] Enriched entity files contain Wikipedia extract + Wikidata claims
- [ ] Sonnet worker produces grounded facts from enriched data
- [ ] Source verification gate passes (0 unsourced claims)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] DB rebuild succeeds: `node scripts/build-facts-db.mjs`

---

## Research Sources

- Loewenstein (1994) — "The Psychology of Curiosity" — information gap theory
- Kang et al. — curiosity is maximal at partial knowledge, not total ignorance
- Kidd, Piantadosi & Aslin — "Goldilocks effect" — intermediate complexity is most engaging
- ETS/NBME item writing guidelines — distractor plausibility, parallel structure
- Gierl et al. (2017) — "Developing, Analyzing, and Using Distractors" — data-driven distractor design
- The Register (2024) — "LLMs can write quizzes" — 70% accuracy for Gemini Pro, numerical answers worst
- Seyler et al. (2015) — "Generating Quiz Questions from Knowledge Graphs" — entity fame × fact obscurity = interestingness

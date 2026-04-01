# Curated Deck → Trivia Bridge

> **Purpose:** Documents the build-time bridge that extracts representative trivia facts from curated knowledge decks and injects them into `facts.db`, enabling FSRS knowledge transfer between Study Temple and Trivia Dungeon. Also covers the runtime pool-based distractor selection that activates for bridged facts in trivia mode.
> **Last verified:** 2026-04-01
> **Source files:** `scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs`, `scripts/content-pipeline/bridge/deck-bridge-config.json`, `src/data/seed/bridge-curated.json`, `src/services/quizService.ts`, `src/services/curatedDistractorSelector.ts`

---

## What & Why

Recall Rogue has two parallel fact systems that have historically been isolated:

- **Trivia Dungeon** — draws from `facts.db` (SQLite), a pool of general-knowledge trivia facts generated via the content pipeline
- **Study Temple** — draws from curated deck JSONs (`data/decks/*.json`), hand-authored fact sets organized around specific topics

The isolation meant a player could master T-Rex facts in Study Temple (dinosaurs deck) and still see them as "new" facts in Trivia Dungeon — zero knowledge transfer.

The **trivia bridge** fixes this. It is a build-time script that reads curated knowledge deck JSONs, selects the single best trivia question per entity, maps `DeckFact` fields to the `Fact` schema, and outputs a seed file (`bridge-curated.json`) that is ingested into `facts.db` alongside regular trivia.

**Impact:** ~2,000 new trivia facts across 22 knowledge decks — a 32% increase in the trivia pool — with shared FSRS states.

---

## How It Works

1. Script reads `deck-bridge-config.json` to discover which decks to process and their entity-grouping config
2. For each deck, loads the curated deck JSON from `data/decks/<deckId>.json`
3. Groups all facts by entity name (derived from fact ID via prefix/segment config)
4. Selects the single best candidate per entity using the scoring formula (see below)
5. Maps `DeckFact` fields to `Fact` schema (see field mapping table below)
6. Appends `"bridge:{deckId}"` tag for provenance tracking
7. Writes all selected facts to `src/data/seed/bridge-curated.json`
8. Writes a summary manifest to `bridge-manifest.json`
9. `scripts/build-facts-db.mjs` ingests `bridge-curated.json` alongside other seed files

At runtime, `getQuizChoices` in `quizService.ts` detects the `bridge:{deckId}` tag and uses pool-based distractor selection from the source curated deck — see **Runtime Distractor Selection** below.

---

## Entity Grouping

Fact IDs encode entity names using a structured prefix convention. The bridge uses config-driven rules to extract the entity key from each fact ID.

Config fields per deck:

| Field | Description |
|---|---|
| `prefixSegments` | Number of leading ID segments to skip (deck prefix + domain) |
| `entitySegments` | Number of segments after the skip that form the entity name |

**Examples:**

- `dinosaurs` deck: `dino_trex_identity` → skip 1 segment (`dino`), entity segments = 1 → entity key `trex`
- `paintings` deck: `paint_ren_mona_lisa_artist` → skip 2 segments (`paint_ren`), entity segments = 2 → entity key `mona_lisa`
- `presidents` deck: `pres_lincoln_assassination` → skip 1 segment (`pres`), entity segments = 1 → entity key `lincoln`

Facts sharing the same derived entity key compete; only the highest-scoring candidate is selected.

---

## Selection Scoring

Each candidate fact is scored to find the best trivia representative for its entity. Higher score = better trivia question.

| Criterion | Points |
|---|---|
| `funScore × 4` | 0–40 |
| difficulty 2–3 | +20 |
| difficulty 1 or 4 | +10 |
| `min(distractors.length, 10)` | 0–10 |
| answer ≤ 15 chars | +10 |
| answer ≤ 30 chars (and > 15) | +5 |
| has `statement` field | +5 |
| has `variants` field | +5 |
| `image_question` without standalone text | −30 |
| `volatile: true` | −5 |

**Tie-break:** lower difficulty wins; if still tied, alphabetical fact ID.

---

## Field Mapping

| DeckFact Field | Fact Field | Notes |
|---|---|---|
| `id` | `id` | Same ID — shared FSRS state across modes |
| `correctAnswer` | `correctAnswer` | Direct |
| `acceptableAlternatives` | `acceptableAnswers` | Renamed |
| `quizQuestion` | `quizQuestion` | Direct |
| `explanation` | `explanation` | Direct |
| `difficulty` | `difficulty` | Direct |
| `funScore` | `funScore` | Direct |
| `distractors` | `distractors` | Direct |
| `sourceName` | `sourceName` | Direct |
| `sourceUrl` | `sourceUrl` | If present |
| `visualDescription` | `visualDescription` | If present |
| `statement` | `statement` | If present |
| `wowFactor` | `wowFactor` | If present |
| `variants` | `variants` | If present |
| tags + bridge tag | `tags` | Existing tags + `"bridge:{deckId}"` appended |
| (inferred) | `type` | Always `'fact'` |
| (derived) | `rarity` | From rarity formula (see below) |
| (from config) | `ageRating` | Per-deck value in `deck-bridge-config.json` |
| (from deck) | `category` | `[domain display name, deck name]` |
| (from deck) | `categoryL1` | `deck.domain` |
| (from config) | `categoryL2` | Per-deck mapping in `deck-bridge-config.json` |
| `chainThemeId` | (dropped) | Not used in trivia mode |
| `answerTypePoolId` | (dropped) | Not used in trivia mode — but `answerTypePoolId` is still on the source `DeckFact` and is used at runtime by the distractor selector |

---

## Rarity Derivation

```
score = difficulty + (funScore / 2)

score >= 8.0  → legendary
score >= 6.5  → epic
score >= 5.0  → rare
score >= 3.5  → uncommon
else          → common
```

---

## Runtime Distractor Selection

Bridged facts carry a `bridge:{deckId}` tag. `getQuizChoices` in `quizService.ts` detects this tag and calls `getBridgedDistractors(fact, deckId)` before the normal pre-generated distractor path.

`getBridgedDistractors` flow:
1. Looks up the source deck via `getCuratedDeck(deckId)` — returns `null` if deck not loaded
2. Finds the matching `DeckFact` by `fact.id` in `deck.facts` — returns `null` if not found
3. Finds the answer type pool via `deckFact.answerTypePoolId` — returns `null` if pool missing or `pool.factIds.length < 5`
4. Calls `selectDistractors(deckFact, pool, deck.facts, deck.synonymGroups, confusionMatrix, null, BALANCE.QUIZ_DISTRACTORS_SHOWN, 1)` — `inRunTracker` is `null` (no active run in trivia mode), mastery level neutral at 1
5. Returns distractor strings via `.map(d => d.correctAnswer)`, or `null` on empty result to fall through to pre-generated distractors

This means bridged trivia facts benefit from confusion-matrix-weighted distractor selection (same wrong answers the player has previously confused), identical to curated deck mode — without needing an active combat run.

---

## CLI Usage

```bash
# Full bridge run (all configured decks)
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs

# Dry run — stats and sample output, no files written
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --dry-run

# Single deck only
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --deck dinosaurs

# Verbose — log every entity group and score
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --verbose
```

After running, rebuild `facts.db`:

```bash
node scripts/build-facts-db.mjs
```

---

## Adding a New Deck

1. Add an entry to `scripts/content-pipeline/bridge/deck-bridge-config.json`:

```json
{
  "deckId": "my_new_deck",
  "prefixSegments": 1,
  "entitySegments": 1,
  "ageRating": "all",
  "categoryL2": "history_events"
}
```

2. Run the bridge: `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --deck my_new_deck --dry-run`
3. Verify entity grouping looks correct (each group should be a single named subject)
4. Run without `--dry-run` to generate the seed output
5. Rebuild: `node scripts/build-facts-db.mjs`

---

## Provenance

- All bridged facts live in `src/data/seed/bridge-curated.json` (single file for all decks)
- Every bridged fact has a tag `"bridge:{deckId}"` (e.g. `"bridge:dinosaurs"`)
- A summary manifest at `bridge-manifest.json` records per-deck counts, entity groups processed, and facts selected
- Bridge facts can be queried from `facts.db` by filtering `tags LIKE '%bridge:%'`
- Language decks are excluded — vocabulary facts only appear in Study Temple, never Trivia Dungeon

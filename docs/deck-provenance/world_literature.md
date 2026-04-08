# World Literature — Deck Provenance

**Deck ID:** `world_literature`
**Created:** 2026-04-08
**Facts:** 200
**Domain:** art_architecture / literature

## 1. Sources

| Source | URL | License | What was taken |
|--------|-----|---------|----------------|
| Wikipedia | Various article pages | CC-BY-SA-4.0 | Author biographies, work summaries, publication dates, plot details, opening lines |
| Wikidata | https://www.wikidata.org | CC0 | Structured data: birth/death dates, publication years, nationalities, literary movements |
| Project Gutenberg | https://www.gutenberg.org | Public domain | Verification of opening lines for pre-1928 works |
| Norton Anthology / Great Books lists | Wikipedia articles about these lists | CC-BY-SA-4.0 | Canon selection guidance only |

All facts are grounded in Wikipedia/Wikidata. No content was copied from copyrighted study materials.

## 2. Pipeline Steps

| Step | Input | Process | Output |
|------|-------|---------|--------|
| Architecture design | Research report, Wikidata queries | Orchestrator designed pools, sub-decks, templates | `data/deck-architectures/world_literature_arch.yaml` |
| Wikidata verification | SPARQL queries for ~60 authors + ~40 works | MCP `mcp__wikidata__query` tool | Verified dates, nationalities, movements |
| Fact generation (Ancient) | Architecture + Wikipedia | 1 Sonnet sub-agent with WebSearch/WebFetch | 56 facts |
| Fact generation (Renaissance) | Architecture + Wikipedia | 1 Sonnet sub-agent with WebSearch/WebFetch | 52 facts |
| Fact generation (19th Century) | Architecture + Wikipedia | 1 Sonnet sub-agent with WebSearch/WebFetch | 48 facts |
| Fact generation (Modern) | Architecture + Wikipedia | 1 Sonnet sub-agent with WebSearch/WebFetch | 44 facts |
| Assembly & normalization | 4 JSON files (200 facts total) | Sonnet assembly agent | `data/decks/world_literature.json` |
| Pool optimization | Raw pools | Assembly agent split pools by answer length | 11 pools (author_names split into short/long, work_titles split into short/mid/long) |

## 3. Distractor Generation

- **Method:** LLM-generated (Sonnet) reading each specific question
- **Per fact:** 8 distractors from world knowledge
- **Pool-based:** Runtime selects from pool members; pre-generated distractors are fallback
- **Bracket facts:** Publication year facts use runtime numeric distractor generation
- **Synthetic padding:** movement_names, country_names, genre_form_names pools padded with 7 synthetic distractors each

## 4. Fact Verification

- **Method:** Each Sonnet worker used WebSearch + WebFetch to verify against Wikipedia before writing facts
- **Wikidata structured data:** Publication dates, author birth/death dates, nationalities verified via SPARQL
- **Known limitations:** Some ancient dates (Homer, Gilgamesh) are approximate/traditional — marked appropriately
- **Error rate:** No factual errors found in automated or LLM playtest review

## 5. Quality Assurance

| Check | Result |
|-------|--------|
| `verify-all-decks.mjs` | 0 failures, 6 warnings |
| `pool-homogeneity-analysis.mjs` | 0 FAIL |
| `quiz-audit.mjs --full` | 0 fails, 5 warnings |
| Automated playtest (all correct, 30 charges) | 0 issues |
| Automated playtest (30% wrong, 20 charges) | 0 issues |
| Quiz engine audit | 0 failures, 122 warnings (format inconsistency — expected for literature) |
| LLM playtest (Haiku agent) | Reviewed 30-charge transcript |
| `npm run typecheck` | 0 errors |
| `npm run build` | Success |
| Trivia bridge | 67 entities extracted, 0 ID collisions |

## 6. Attribution Requirements

All content is derived from Wikipedia (CC-BY-SA-4.0) and Wikidata (CC0). Attribution: "Facts sourced from Wikipedia and Wikidata" in credits.

## 7. Reproduction Steps

```bash
# 1. Generate facts (requires Claude Code with Sonnet sub-agents)
# Spawn 4 parallel content-agents, one per sub-deck era
# Each agent uses WebSearch/WebFetch for Wikipedia verification

# 2. Assemble deck
# Merge 4 JSON outputs, normalize schema, build envelope
# Write to data/decks/world_literature.json

# 3. Validate
node scripts/verify-all-decks.mjs
node scripts/pool-homogeneity-analysis.mjs --deck world_literature
node scripts/quiz-audit.mjs --deck world_literature --full
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts world_literature --charges 30

# 4. Integrate
npm run build:curated
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs
npm run build
```

## Sub-Deck Breakdown

| Sub-deck | Facts | Key entities |
|----------|-------|-------------|
| Ancient & Classical | 56 | Homer, Sophocles, Virgil, Ovid, Gilgamesh, Tale of Genji, Rumi, Li Bai |
| Renaissance & Early Modern | 52 | Dante, Shakespeare (15), Cervantes, Milton, Goethe, Chaucer |
| 19th Century | 48 | Austen, Dickens, Tolstoy, Dostoevsky, Brontës, Hugo, Poe, Shelley |
| Modern & Contemporary | 44 | Joyce, Woolf, Kafka, Orwell, García Márquez, Morrison, Achebe |

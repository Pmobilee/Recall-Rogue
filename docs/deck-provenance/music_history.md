# Music History Deck — Provenance

## Sources

### Wikidata (CC0)
- **URL**: https://www.wikidata.org
- **License**: CC0 (public domain)
- **What was taken**: Birth/death dates, nationalities, genre classifications for 50+ classical composers, 15+ jazz musicians, 25+ rock/pop artists via SPARQL queries
- **Commercial use**: Yes, unrestricted (CC0)

### Wikipedia (CC-BY-SA-4.0)
- **URL**: https://en.wikipedia.org
- **License**: CC-BY-SA 4.0
- **What was taken**: Narrative context, cultural impact descriptions, historical details for explanations and wowFactor fields
- **Commercial use**: Yes, with attribution and share-alike
- **Attribution**: "Content sourced from Wikipedia contributors, licensed under CC-BY-SA 4.0"

## Pipeline Steps

### Step 1: Wikidata SPARQL Research
- **Input**: SPARQL queries for composers (P106=Q36834), musicians (P106=Q639669), albums
- **Process**: Orchestrator (Opus) queried Wikidata MCP directly
- **Output**: Verified birth/death dates, nationalities for ~90 entities
- **Validation**: Cross-referenced with Wikipedia articles

### Step 2: Architecture Design
- **Input**: Wikidata results + deck-master skill spec
- **Process**: Orchestrator designed pool-first architecture with 8 answer pools, 5 sub-decks
- **Output**: `data/deck-architectures/music_history_arch.yaml`

### Step 3: Fact Generation (3 parallel Sonnet workers)
- **Worker 1**: Classical Composers & Eras (55) + Instruments & Theory (40) → `_wip/music_history_classical_theory.json`
- **Worker 2**: Jazz & Blues (45) → `_wip/music_history_jazz.json`
- **Worker 3**: Rock & Pop (50) + World & Modern (40) → `_wip/music_history_rock_world.json`
- **Process**: Each worker WebSearched/WebFetched Wikipedia for entities in their batch
- **Validation**: Workers verified dates against Wikidata-provided data

### Step 4: Assembly & Validation
- **Input**: 3 WIP JSON files
- **Process**: Orchestrator merged, wrapped in CuratedDeck envelope, ran structural validation
- **Output**: `data/decks/music_history.json`

## Distractor Generation
- **Method**: LLM-generated (Sonnet) from world knowledge for each specific question
- **Sources**: Distractors drawn from musical knowledge — same-era composers, same-genre artists, related works
- **Validation**: Pool collision check (distractor must not be another fact's correct answer in same pool)

## Fact Verification
- **Method**: Every factual claim verified against Wikipedia via WebSearch/WebFetch
- **Sources checked**: Wikidata (structured data), Wikipedia (narrative)
- **Known limitations**: Some early composer dates are approximate (pre-1700)

## Quality Assurance
- [ ] `verify-curated-deck.mjs` — structural validation
- [ ] `playtest-curated-deck.ts --charges 30` — automated playtest (all correct)
- [ ] `playtest-curated-deck.ts --charges 20 --wrong-rate 0.3` — wrong answer testing
- [ ] LLM playtest (Haiku agent) — quality review
- [ ] `npm run typecheck && npm run build` — clean build

## Attribution Requirements
- In-app credits: "Music history content sourced from Wikipedia (CC-BY-SA 4.0) and Wikidata (CC0)"
- Share-alike: Derivative works using Wikipedia-sourced text must also be CC-BY-SA

## Reproduction Steps
```bash
# 1. Architecture is at data/deck-architectures/music_history_arch.yaml
# 2. WIP facts are at data/decks/_wip/music_history_*.json
# 3. Final deck at data/decks/music_history.json
# 4. Validate: node scripts/verify-curated-deck.mjs music_history
# 5. Playtest: npx tsx scripts/playtest-curated-deck.ts music_history --charges 30 --verbose
```

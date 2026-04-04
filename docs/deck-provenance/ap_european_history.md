# Deck Provenance: AP European History

**Deck ID:** `ap_european_history`
**Created:** 2026-04-04
**Pipeline:** deck-master skill (full build)

---

## 1. Sources

| Source | URL | License | What Was Taken | Commercial Use |
|--------|-----|---------|---------------|----------------|
| College Board AP Euro CED | https://apcentral.collegeboard.org/courses/ap-european-history | Educational reference | Unit structure, topic numbering (9 units, ~80 topics) | Yes (scope only, no content copied) |
| Wikipedia | https://en.wikipedia.org/ | CC-BY-SA-4.0 | Fact text, explanations, narrative context, source URLs | Yes with attribution |
| Wikidata | https://www.wikidata.org/ | CC0 | Verified dates, locations, structured data via SPARQL | Yes |
| Encyclopaedia Britannica | https://www.britannica.com/ | Verification only | Cross-reference for factual accuracy | N/A (no content copied) |
| Fiveable AP Euro Guides | https://fiveable.me/ap-euro/ | Reference only | Topic breakdown verification | N/A (no content copied) |

## 2. Pipeline Steps

### Step 1: Scope Research
- **Input:** College Board CED, Fiveable topic guides
- **Process:** WebSearch + WebFetch to extract all 9 units, ~80 topics
- **Output:** Complete topic list with key figures, events, concepts per unit
- **Validation:** Cross-referenced CED structure against multiple sources

### Step 2: Architecture Design
- **Input:** Topic list, existing AP deck formats (APUSH as reference)
- **Process:** Pool-first design — 8 answer type pools, 9 sub-decks
- **Output:** `data/deck-architectures/ap_european_history_arch.yaml`
- **Validation:** Pool sizes verified (all 5+ estimated members)

### Step 3: Wikidata SPARQL Verification
- **Input:** Key events and figures from architecture
- **Process:** `mcp__wikidata__query` SPARQL queries for verified dates
- **Output:** Machine-verified dates for French Revolution, WWII, War of Spanish Succession, key figures' birth/death dates
- **Validation:** Dates cross-checked against Wikipedia articles

### Step 4: Fact Generation (9 parallel Sonnet workers)
- **Input:** Architecture YAML + topic assignments per unit
- **Process:** 9 Sonnet sub-agents, each assigned one CED unit. Workers used WebSearch/WebFetch to verify claims before generating facts.
- **Output:** 9 JSON arrays (one per unit), ~515 facts total
- **Validation:** Workers instructed to verify all dates/names/claims via Wikipedia

### Step 5: Assembly
- **Input:** 9 unit JSON arrays
- **Process:** Merge into CuratedDeck envelope, build pools/tiers/subDecks programmatically
- **Output:** `data/decks/ap_european_history.json`
- **Validation:** Structural validation script, verify-all-decks.mjs

### Step 6: Quality Assurance
- **Checks run:** typecheck, build, structural validation, automated playtest, LLM playtest
- **Results:** [TO BE FILLED AFTER QA]

## 3. Distractor Generation
- **Method:** LLM-generated (Sonnet workers) — each worker reads the specific question and generates 8 plausible wrong answers from world knowledge
- **Sources:** Worker world knowledge (NOT from database queries)
- **Validation:** Structural validation checks for answer-in-distractors, duplicate distractors, pool collision

## 4. Fact Verification
- **Method:** Workers used WebSearch/WebFetch to verify dates, names, and claims against Wikipedia
- **Sources checked:** Wikipedia (primary), Wikidata SPARQL (dates), Britannica (cross-reference)
- **Known limitations:** Workers may have some facts where verification was from training knowledge rather than live fetch
- **Error rate:** [TO BE FILLED AFTER QA]

## 5. Quality Assurance
- [ ] `node scripts/verify-all-decks.mjs` — 0 failures
- [ ] Automated playtest (all correct) — 0 issues
- [ ] Automated playtest (wrong rate 0.3) — 0 issues
- [ ] LLM playtest — all categories 7+/10
- [ ] Distractor display audit — all pools reviewed
- [ ] `npm run typecheck` — pass
- [ ] `npm run build` — pass

## 6. Attribution Requirements
- Wikipedia content used under CC-BY-SA-4.0 — attribution provided via `sourceName` and `sourceUrl` fields on every fact
- Wikidata used under CC0 — no attribution required
- College Board CED referenced for structure only — no exam content reproduced

## 7. Reproduction Steps
```bash
# 1. Architecture is at:
cat data/deck-architectures/ap_european_history_arch.yaml

# 2. Generate via deck-master skill:
# /deck-master generate --architecture data/deck-architectures/ap_european_history_arch.yaml

# 3. Validate:
node scripts/verify-all-decks.mjs --verbose
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts ap_european_history --charges 30 --verbose

# Prerequisites: Node.js 20+, npm dependencies installed
```

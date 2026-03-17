# Chain Tagging Problem: Multi-Domain Decks Can't Chain

## The Problem

Recall Rogue's **chain mechanic** rewards consecutive Charge plays of cards sharing the same `categoryL2` subcategory. This works well for focused decks (1-2 domains), but **breaks completely for multi-domain decks**.

### Current System

- Chain groups = `categoryL2` values (e.g., `mammals`, `asian_cuisine`, `planets_moons`)
- ~74 subcategories across 10 knowledge domains + ~40 language subcategories
- Facts are randomly paired with card slots each hand draw
- Same `categoryL2` in hand = can chain = multiplier (1.3× to 3.0× for 2-chain to 5-chain)

### The Math

A standard hand is **5 cards**. For chaining to work, you need **2+ cards sharing a `categoryL2`**.

| Deck Composition | Unique L2 Values | P(2+ match in 5-card hand) | Verdict |
|---|---|---|---|
| 1 domain, focused | ~3-4 L2s | **High** (~60-80%) | Chains work great |
| 2 domains | ~8-14 L2s | **Medium** (~20-40%) | Occasional chains |
| 5 domains | ~25-35 L2s | **Very low** (<5%) | Almost never chains |
| 10 domains (all) | ~74 L2s | **Near zero** (<1%) | Chain mechanic is dead |
| Mixed knowledge + vocab | ~80+ L2s | **Effectively zero** | Completely broken |

### Why This Matters

1. **Custom decks** — Players who pick many domains for variety are punished with zero chain potential
2. **Vocab + knowledge mixing** — A deck with Japanese N5 + History + Animals has ~20+ L2 values, no chains
3. **Chain relics become worthless** — Chain Reactor, Resonance Crystal, Tag Magnet, Prismatic Shard — entire archetype dies
4. **Balance gap** — Focused decks get 1.7-3.0× multipliers; broad decks get 1.0× always

### Current Mitigations (Insufficient)

- **Tag Magnet relic** (+30% draw bias for matching L2) — helps but doesn't solve the fundamental math
- **Domain selection at run start** — constrains L2 pool, but players may want variety
- **Pool building** concentrates on 5-8 L2 values — only works if player picks 1-2 domains

## What a Solution Must Achieve

1. **Broad decks must have SOME chain potential** — not as strong as focused, but not zero
2. **Focused decks should still be rewarded** — tight L2 chains should remain the gold standard
3. **No new LLM tagging required** (ideal) — or if LLM tags are needed, define exactly what they are
4. **Works for vocab + knowledge mixing** — Japanese N5 + History should have a path to chain
5. **Preserves the "every hand is a fresh chain puzzle" design** — don't make it trivial

## Possible Approaches (Not Exhaustive)

### A. Hierarchical chaining (L1 + L2)
- L2 match = full chain multiplier (current system)
- L1 match (same domain, different L2) = reduced multiplier (e.g., 1.15× instead of 1.3×)
- Pro: No new data. Con: Still doesn't help cross-domain.

### B. Cross-domain semantic tags (LLM-generated)
- Add tags like `food`, `war`, `famous_people`, `numbers`, `dates` that span domains
- "French invented croissants" (food_history) + "Sushi originated in Japan" (asian_cuisine) chain via `food` tag
- Pro: Richest design. Con: Requires tagging every fact in DB.

### C. Chain-at-domain-level for broad decks
- If deck has >N domains, chain threshold lowers to L1
- Dynamic: system detects deck breadth and adjusts
- Pro: Adaptive. Con: Invisible rule, hard to communicate to player.

### D. Universal chain tags (small fixed set)
- Every fact gets 1-2 tags from a ~20-tag universal set (e.g., `people`, `places`, `dates`, `science`, `culture`, `nature`, `conflict`, `invention`, `food`, `language`, `art`, `religion`, `numbers`, `animals`, `geography`, `medical`, `space`, `mythology`, `sports`, `music`)
- Deterministic assignment from existing L1/L2 (no LLM needed for most)
- Pro: Simple, deterministic. Con: Very coarse, may feel arbitrary.

### E. Relic/mechanic-only solution
- Don't fix the base system — instead, add more chain-enabling relics/mechanics
- "Prismatic Chain" relic: any 2 cards from the same domain count as a chain
- Pro: Opt-in design. Con: Chain archetype requires specific relics.

## Reference Data

See `chain-tagging-sample-facts.json` for 2 complete fact rows per domain (including vocab), showing the full schema and current `categoryL1`/`categoryL2`/`tags` fields. Use this to understand what data is available for any tagging solution.

## Constraints

- **No Anthropic API** — all LLM work must go through Claude Code Agent tool (sub-agents)
- **~74 knowledge subcategories + ~40 language subcategories** currently in `src/data/subcategoryTaxonomy.ts`
- **12 domains total** (10 knowledge + geography_drill + language)
- **Facts pair randomly with card slots each draw** — the fact determines the chain color, not the card mechanic
- **Chain multipliers:** 1.0× (none), 1.3× (2), 1.7× (3), 2.2× (4), 3.0× (5)

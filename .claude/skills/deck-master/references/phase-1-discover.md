# deck-master — Phase 1: Discover

**Parent skill:** [`../SKILL.md`](../SKILL.md) — `/deck-master`
**Covers:** The discovery phase — finding high-demand topics, filtering by structural viability, sourcing & licensing rules, and the output format for the deck-ideas brainstorm doc.

---

## Goal

Find what people actually want to learn. Identify high-demand topics with strong structural potential before spending effort on architecture or generation.

---

## Process

1. Search Anki shared deck repositories for download counts (ankiweb.net/shared/decks) — for demand signal only, never copy content.
2. Search Reddit study communities: r/languagelearning, r/medicalschool, r/history, r/learnmath, etc. — look for recurring study requests.
3. Search educational forums and quiz sites (Quizlet, Kahoot popular sets, Sporcle trending quizzes) — demand signal only.
4. Check trending educational content: YouTube edu-channels, popular podcast topics, TikTok edu-creators.
5. Cross-reference `data/deck-ideas.md` — skip topics already researched or in progress.

---

## Filtering Criteria

A topic is a viable deck candidate if it satisfies ALL of:

- **30+ distinct facts** can be extracted from authoritative, commercially-usable sources
- **Answer types fall into at least 2 identifiable pools** with 5+ members each
- **Not a micro-topic** (e.g., "Noble Gases" alone — too small; fold it into "Periodic Table")
- Required visual assets (if any) are available under commercial-friendly licenses

**Note:** natural sub-groupings for chain themes are NOT a current requirement. They are worth noting in the discovery output as future potential, but a topic is not disqualified for lacking them.

---

## Sub-Deck Splitting Rule

**Large topics (100+ entities) SHOULD be evaluated for splitting** into standalone sub-decks when the sub-groups are independently viable (30+ facts each). Examples:

- "World Capitals" (195) → could split into "African Capitals" (54), "European Capitals" (44), "Asian Capitals" (48), etc.
- "Periodic Table" (118) → could keep as one mega-deck with 8+ chain themes (more replayability per run)

The decision depends on whether sub-groups are independently interesting or only meaningful as part of the whole. Players should be able to choose either the full deck or a focused sub-deck.

---

## Data Sourcing Requirements — Programmatic Sourcing Rule

**ALL deck content MUST be programmatically sourced from authoritative, commercially-usable sources.** This is non-negotiable. The game is a commercial product — every fact, every asset, every data point must have a clear provenance chain.

| Requirement | Detail |
|-------------|--------|
| **Facts** | Must be grounded in Wikipedia/Wikidata. Every fact needs a `sourceName` and `sourceUrl` pointing to the authoritative source. Never invent facts from LLM knowledge alone. |
| **Verification** | Cross-reference at least 2 sources for non-trivial claims. Wikipedia + one additional source (Britannica, official government sites, peer-reviewed databases). |
| **Numerical data** | Use the **Wikidata SPARQL MCP** (`mcp__wikidata__query`) for structured numerical facts (populations, dates, measurements). Never approximate. |
| **Visual assets** | Flag SVGs from open-source CC0/public domain repositories (e.g., flag-icons, flagpedia). Map outlines from Natural Earth (public domain). Animal/plant images from Wikimedia Commons (verify license per image). |
| **Commercial licensing** | Every asset must be CC0, CC-BY, public domain, or have explicit commercial-use permission. CC-BY-NC (non-commercial) is NOT acceptable. CC-BY-SA is acceptable if attribution is provided. |
| **Attribution tracking** | Each deck's architecture YAML must include an `asset_sources` section listing every external asset with its license type and attribution requirements. |

### What This Means in Practice

- **Flags of the World deck**: Use `flag-icons` npm package (MIT license) or `flagpedia.net` SVGs (public domain). Do NOT use random Google Image results.
- **Periodic Table deck**: Use PubChem or IUPAC data (public domain). Cross-reference with Wikidata.
- **Animal decks**: Use IUCN Red List data (verify API terms), Wikidata for taxonomy, Wikimedia Commons for reference images (check per-image license).
- **Geography decks**: Use Natural Earth shapefiles (public domain) for any map data. UN Statistics Division for country/population data.
- **Historical decks**: Wikipedia + Britannica cross-reference. Primary sources where available (Library of Congress, National Archives).

### Banned Practices

- Using LLM-generated "facts" without source verification
- Scraping copyrighted content (Quizlet sets, Anki shared decks — use for demand research only, never copy content)
- Using images/assets without verifying commercial license
- Hardcoding data that could drift (populations, "current" leaders, living records) — these need flagging as `volatile: true`
- Generating facts from LLM training knowledge and attributing fake source URLs (the #1 failure mode — happened 2026-03-25, 270 facts thrown away)
- Passing workers a topic list without verified source data and asking them to "generate facts"
- Any worker prompt that does NOT include pre-verified dates, numbers, and source URLs for every claim

---

## Output Format — Append to `data/deck-ideas.md`

Return a ranked list in this format:

```
1. "US Presidents" — 50k Anki downloads, frequent Reddit requests, 46 facts; natural themed groupings exist (Founding Fathers, Civil War Era) — note for future chain theme enhancement
2. "Chemical Elements" — 120k Anki downloads, periodic table grouping maps well; good future chain theme potential (by period, group, metal/nonmetal)
3. "World Capitals" — 200k Anki downloads; verify it can reach 30+ interesting facts (not just name→capital)
4. "Dog Breeds" — niche but passionate community; visual learning potential for cardbacks; groupings by size/type noted for future chains
```

Include:

- A note on any topic that seems popular but structurally weak (pool count, depth, synonym hazards)
- A note on required visual assets and their licensing status
- Whether the topic should be one deck or split into sub-decks

---

## Composite Deck & Era-Based Series

### Composite Deck Architecture

Source decks own their facts. Composite decks (AP World History, AP US History, Ancient Civilizations) reference facts from multiple source decks without duplication. When designing source deck pools:

- Each fact gets a globally unique ID and a `sourceDeckId` field
- SM-2 progress is keyed globally by factId, not per-deck
- Chain themes should be self-contained (composites may pull individual chains)
- Flag facts with high composite reuse potential in notes

**Full architecture:** See `data/deck-ideas.md` Section 2: Composite Deck Architecture.

### Era-Based History Series

World History is structured as 12 chronological era decks (Ancient Mesopotamia through Modern World), aligned with AP World History units where applicable. Each era has full pool architecture, chain themes, and cross-deck linking documented in `data/deck-ideas.md` Section 1.

**ALWAYS consult `data/deck-ideas.md` before starting any new deck work** — it contains pool architecture, estimated fact counts, cross-deck dependencies, and production priority for ~180 planned decks across all domains.

---

## What's Next After Discovery

Once you have a ranked candidate list and you (or the user) picks a topic, proceed to Phase 2: **`phase-2-architect.md`**. Do NOT skip architecture and jump straight to generation — the pool-first design process is what prevents trivia-deck-with-curated-label failures.

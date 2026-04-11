---
name: deck-master
description: Create curated knowledge decks for Recall Rogue. 3 phases: discover (research topics), architect (design deck structure), generate (produce facts). Per DECKBUILDER.md spec. All content programmatically sourced from authoritative, commercially-licensed sources.
---

# deck-master

## Mission

Single skill for creating high-quality curated decks. Every deck is a self-contained educational unit: its own fact pool, answer type pools, synonym groups, chain themes, and question templates. Decks power the curated run system described in `docs/RESEARCH/DECKBUILDER.md`.

**Canonical spec:** `docs/RESEARCH/DECKBUILDER.md` sections 3-9. If anything in this skill conflicts with that doc, the doc wins.

**Living brainstorm doc:** `data/deck-ideas.md` — append all discovered deck candidates here with demand signals and notes. Consult it before discovery runs to avoid duplicate research.

### 🌍 Strategic Priority: Internationalization (adopted 2026-04-09)

Before picking your next deck, **read Section 0 of `data/deck-ideas.md`**. The library currently over-indexes on US exam prep (9 AP decks dominate by fact volume) and is structurally under-served in three areas:

1. **Sports** — FIFA World Cup, Olympics, Formula 1, Chess, Cricket, Tennis (zero sports decks shipped)
2. **International exam systems** — IB DP, GCSE, A-Level, Abitur, Baccalauréat, Gaokao (zero shipped vs 9 AP decks)
3. **Non-US pop culture** — Anime/Manga, K-pop/K-drama, Bollywood, Eurovision (zero shipped)

**Until each of these three pillars has at least 3 shipped decks, new domain openers should lean international.** The Section 4 Production Priority Queue in `data/deck-ideas.md` has been reshuffled accordingly. Follow that order unless the user explicitly overrides it.

---

## Reference Sub-Files — Read Before You Start

This skill is organized into an overview (this file) and five reference sub-files under `.claude/skills/deck-master/references/`. Each sub-file covers a single topic in depth. Read the ones relevant to your current phase before starting work.

| Sub-file | Read when |
|---|---|
| [`references/phase-1-discover.md`](references/phase-1-discover.md) | Finding high-demand topics, licensing research, filtering criteria |
| [`references/phase-2-architect.md`](references/phase-2-architect.md) | Pool-first design philosophy, architecture YAML spec, provenance docs, sub-deck rules |
| [`references/phase-3-generate.md`](references/phase-3-generate.md) | Two-phase pipeline (Sonnet/Opus), worker batch patterns, per-fact requirements, envelope assembly |
| [`references/anti-patterns.md`](references/anti-patterns.md) | Every mistake cataloged from shipped decks — read before generation to avoid repeating them |
| [`references/examples.md`](references/examples.md) | Reference walkthroughs: validation commands, grammar deck standard, sub-deck design, in-game testing |

The canonical rule source for pool design and anti-patterns is `.claude/rules/deck-quality.md`. The reference files link back to that rule file where appropriate rather than duplicating its content.

---

## 🚨 Absolute Rules — Non-Negotiable

These rules override everything else. Violating them has cost us days of rework across multiple decks. Read each rule file for the full rationale.

### 1. SOURCE DATA BEFORE GENERATION

**NEVER generate facts from LLM training knowledge.** This is the #1 content pipeline failure mode. Every fact-generation worker MUST receive verified source data in its prompt — Wikidata SPARQL results for structured claims, Wikipedia excerpts for narrative context. The orchestrator researches first, workers format second. See `.claude/rules/content-pipeline.md` → "Fact Sourcing — ABSOLUTE RULE" and `references/phase-3-generate.md` for the workflow.

### 2. TATOEBA IDs MUST COME FROM THE CORPUS

**NEVER write `sourceRef: "tatoeba:N"` from LLM knowledge.** Every Tatoeba citation must be a real ID verified against the local corpus at `data/_corpora/tatoeba/`. On 2026-04-10 an audit found 92% of `tatoeba:N` refs in shipped Spanish A2/B1/B2 grammar decks were fabricated. Build the corpus via `scripts/tatoeba/build-cefr-corpus.mjs --lang <fra|spa|...>`, give sub-agents only slices of `{lang}_{level}_pool.tsv`, and audit with `scripts/tatoeba/audit-deck-ids.mjs` before committing. Use `sourceRef: "llm_authored"` honestly for gaps. Full rule: `.claude/rules/content-pipeline.md` → "Tatoeba Citation".

### 3. CURRICULUM-SOURCED SCOPE FOR EDUCATIONAL DECKS

**For any deck where real students depend on completeness** (medical, language, anatomy, exam prep, certifications), the scope MUST come from an authoritative curriculum — a real textbook ToC, official word list, or exam blueprint — NEVER from LLM compilation. The Medical Terminology deck (2026-04-03) shipped missing basic abbreviations (STAT, PRN, BID, NPO) because scope was LLM-compiled instead of curriculum-sourced. Cross-reference 2+ sources. Map deck architecture to the curriculum, not the other way around. Full rule: `.claude/rules/content-pipeline.md` → "Curriculum-Sourced Scope".

### 4. EXAM-ALIGNED DECKS MUST FOLLOW OFFICIAL SCOPE

Any deck covering material tested by an official standardized exam (AP CED, JLPT, CEFR, HSK, IB, SAT) MUST align to that exam's official scope document. Use its unit/topic/learning-objective structure as the deck's architecture. Tag facts with `examTags`. Weight content by exam weighting. Full rule: `.claude/rules/content-pipeline.md` → "Exam-Aligned Deck Standard".

### 5. PROGRAMMATIC SOURCING — ALL CONTENT FROM AUTHORITATIVE, COMMERCIALLY-USABLE SOURCES

Every fact needs `sourceName` + `sourceUrl` pointing to the authoritative source. Cross-reference ≥2 sources for non-trivial claims. All visual assets must be CC0, CC-BY, public domain, or explicitly commercially licensed. CC-BY-NC is not acceptable. See `references/phase-1-discover.md` → "Data Sourcing Requirements" for the full table.

---

## Invocation

```
/deck-master discover [--domain history|science|languages|...]
/deck-master architect --topic "US Presidents" [--target-facts 46]
/deck-master generate --architecture <path/to/arch.yaml>
/deck-master full --topic "Chemical Elements" [--target-facts 118]
```

- `discover` — Phase 1 only: research demand and output ranked deck candidates → see `references/phase-1-discover.md`
- `architect` — Phase 2 only: design deck structure for a chosen topic → see `references/phase-2-architect.md`
- `generate` — Phase 3 only: produce facts from a completed architecture spec → see `references/phase-3-generate.md`
- `full` — All three phases sequentially for a single topic

---

## Three-Phase Overview

### Phase 1 — Discovery

**Goal:** Find what people actually want to learn. Identify high-demand topics with strong structural potential.

**Inputs:** `data/deck-ideas.md`, Anki shared deck download counts (for demand signal only, never copy content), Reddit study communities, Quizlet/Sporcle popularity.

**Outputs:** A ranked list of deck candidates appended to `data/deck-ideas.md`, each with: source URLs, target fact count, pool architecture sketch, licensing notes for visual assets.

**Filtering criteria:** 30+ distinct facts from authoritative sources, ≥2 identifiable answer pools with 5+ members each, not a micro-topic, visual assets (if any) available under commercial-friendly licenses.

Full process, filtering rules, and sub-deck splitting guidance live in **`references/phase-1-discover.md`**.

### Phase 2 — Architecture

**Goal:** Design the complete pedagogical structure BEFORE any facts are generated. The architecture spec is the contract for the generation phase.

**Key principle — Pool-first design:** The answer type pools ARE the deck's educational backbone. Start by asking "What pools of confusable answers can I build?" and "What question templates create interesting difficulty curves?" The entities follow from the pools, not the other way around.

**Outputs:** `data/deck-architectures/<deck_id>_arch.yaml` containing:
- Data sources + licensing
- Answer type pools (5+ members each, semantically homogeneous)
- Question templates spanning mastery 0→5 difficulty curve
- Common confusion pairs (seeded into the confusion matrix)
- Synonym groups
- Chain slots (generic 0-5 for now — named themes are a future enhancement)
- Difficulty tiers (easy/medium/hard)

Pool-first design philosophy, the YAML template, semantic homogeneity tests, and the mandatory provenance doc structure live in **`references/phase-2-architect.md`**.

### Phase 3 — Generation

**Goal:** Produce the complete fact dataset conforming to the architecture spec.

**Two-phase pipeline (mandatory):**
1. **Sonnet workers — Truth-Grounded Fact Generation.** Research + extraction from verified Wikipedia/Wikidata text. Workers produce structurally complete facts whose question+answer is verifiable in the provided source text.
2. **Opus quality pass — Prose Polish & Narrative Interweaving.** Rewrites `explanation`/`wowFactor`/`visualDescription`/`statement` ONLY. Never touches `correctAnswer`, `quizQuestion`, `distractors`, or structural fields. May be skipped when Sonnet prose already connects arcs and the orchestrator samples 5-10 facts finding no issues.

**Before spawning ANY workers — Phase 0.5 Task Breakdown:** Create a `TaskCreate` for every pool in the architecture. Also create tasks for assembly, pool target verification, structural validation, automated playtest, LLM playtest, trivia bridge, provenance doc, and commit. Before committing: run `TaskList`. If anything is pending, that work isn't done. Three entire pools were skipped in the Medical Terminology deck because they weren't tracked as tasks.

Full generation pipeline, Wikidata SPARQL reference, worker batch limits, per-fact requirements, envelope assembly rules, and the assembly quality pipeline live in **`references/phase-3-generate.md`**.

---

## Game Modes Context

Decks serve TWO distinct game modes. Workers building decks must understand both:

### Study Temple (Focused Study)
- Player enters via **Dungeon Selection Screen** → Study Temple tab → browses curated decks by domain → picks a deck tile → optionally focuses on a sub-deck
- All facts for the entire run come from that single deck (or sub-deck)
- Adaptive difficulty via confusion matrix and in-run FSRS
- **ALL vocabulary content lives here** — Japanese N5-N1, Korean, Spanish, etc.
- This is the deep learning mode

### Trivia Dungeon (Casual)
- Player enters via **Dungeon Selection Screen** → Trivia Dungeon tab → picks domains/subdomains
- Facts pulled from general trivia fact pool (`facts.db`)
- **Vocabulary facts are NOT available** — they live exclusively in Study Temple

### Fact Pool Relationship

**Study Temple and Trivia Dungeon share knowledge facts via the Trivia Bridge.** The bridge (`/curated-trivia-bridge` skill) extracts 1 representative fact per entity from each knowledge deck into `facts.db`. Bridged facts keep their original deck IDs so FSRS review states transfer between modes.

**Vocabulary is curated-only.** Language decks are never bridged into Trivia Dungeon.

### Post-Generation: Trivia Bridge — MANDATORY CHECK

| Deck Type | Bridge? | Why |
|-----------|---------|-----|
| **Knowledge decks** (history, science, geography, etc.) | **YES** | Facts appear in both modes; FSRS state transfers |
| **Vocabulary/language decks** | **NO** | Language facts stay in Study Temple only |

If YES, run `/curated-trivia-bridge`:
1. Add deck to `scripts/content-pipeline/bridge/deck-bridge-config.json` (prefixSegments, entitySegments, categoryL2, domain)
2. Dry run: `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --dry-run`
3. Generate: `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs`
4. Rebuild DB: `node scripts/build-facts-db.mjs`
5. Verify: `npx vitest run` — check for ID collisions

See `docs/content/trivia-bridge.md` for full details.

---

## Post-Assembly Quality Gate — MANDATORY

**After assembling ANY new deck, run this COMPLETE pipeline before committing:**

```bash
# 1. Structural validation (22 checks + word-level self-answering detection)
node scripts/verify-all-decks.mjs

# 2. Quiz engine audit — catches length tells, distractor collisions
node scripts/quiz-audit.mjs --full --deck <deck_id>

# 3. Pool heterogeneity auto-fix — splits pools where answer lengths vary >3x
node scripts/fix-pool-heterogeneity.mjs

# 4. Synthetic distractor padding — pads all pools to 15+ members
node scripts/add-synthetic-distractors.mjs

# 5. Self-answering detection — flags questions containing their own answer
node scripts/fix-self-answering.mjs

# 6. Sub-deck factId population — ensures all sub-decks are wired
node scripts/fix-empty-subdecks.mjs

# 7. Rebuild and verify
npm run build:curated
```

**Target: 0 failures everywhere. If ANY step finds issues, fix them BEFORE committing.**

This pipeline was created after a 2026-04-08 audit found 354 quiz failures, 42 empty sub-decks, 151 under-padded pools, and 500+ self-answering questions across 83 shipped decks. Every issue was preventable with these checks.

### LLM Playtest — FINAL GATE

After the automated pipeline passes, spawn a Haiku sub-agent to playtest the deck as a real player. The agent reads each question, evaluates answer choices, picks one (sometimes wrong on purpose), and judges quality from a player's perspective. No code check catches "this question is confusing" or "these distractors are too obvious" — only an LLM reading them naturally can.

Full LLM playtest prompt, run transcript generation command, and the ship checklist (every item required) live in **`references/examples.md`** → "LLM Playtest — Final Gate".

---

## Deck Rules Quick-Reference

| Rule | Detail |
|------|--------|
| Fact count | AIM FOR COMPLETENESS, NOT MINIMUMS. Let content dictate count. Textbook replacement, not trivia sampler. Runtime min 30 facts — shipping at minimum is a failure of ambition. |
| Pool minimum | 5 facts per answer type pool (after synonym exclusions) |
| Pool padding | Pools with <15 total members get `syntheticDistractors` added. Numeric pools use bracket notation instead. |
| Chain themes | NOT required for initial decks. Use generic chain slots (0-5) distributed evenly. Named themes are a future enhancement. |
| Math/numeric answers | Bracket notation `{N}` + runtime generation, not pool distractors |
| Grounding | All facts grounded in Wikipedia/Wikidata — never invented |
| Distractor source | **LLM-generated from world knowledge, reading the specific question.** NEVER pulled from DB queries. Pool-based at runtime for pools with 5+ unique answers; falls back to pre-generated `distractors[]` otherwise. Workers must always generate 8 pre-gen distractors per fact. |
| Model for DB content | Sonnet only; Haiku is not acceptable for facts, distractors, or questions |
| Micro-topics | Forbidden as standalone decks. "Noble Gases" = chain theme inside "Periodic Table", not its own deck |
| Deck ideas log | Always update `data/deck-ideas.md` after a discovery run |
| Age tagging | Every fact MUST have `ageGroup`: `"all"` (kids 8+) or `"teen+"` (13+). At least 40% must be `"all"` per deck. |
| Wow factor | Every fact MUST have a `wowFactor` string — deck-specific, not generic |
| Em-dash in answers | NEVER. Explanations go in `explanation` field. Em-dash answers are 2-3× longer than distractors — an obvious length tell. |
| Pool homogeneity | Every pool must contain ONE semantic answer type. "Can every member serve as a plausible distractor for every other member?" If no → split. |
| No self-answering | Answer must not appear verbatim in question stem. Distinguishing words in the answer must not leak into the question. |
| Image-quiz separation | Facts with `quizMode: "image_question"`/`"image_answers"` MUST be in `visual_*` pools, never mixed with text facts |

Canonical pool design rules and anti-patterns: `.claude/rules/deck-quality.md`.

---

## Batch Verification Command

**Run after modifying ANY curated deck. This is the fastest sanity check.**

```bash
node scripts/verify-all-decks.mjs           # Summary: all decks (no registry stamp)
node scripts/verify-all-decks.mjs --verbose  # Per-fact failure details
node scripts/verify-all-decks.mjs --stamp-registry  # Structural + stamp registry on pass
```

26 checks per fact/deck. **Target: 0 failures across all decks.** Warnings are informational. Default behavior no longer stamps the inspection registry — pass `--stamp-registry` explicitly, per 2026-04-10 gotcha.

For in-depth per-deck examples of validation commands (required fields, distractor count, pool size, chain slot distribution, age groups, synonym groups, source URLs, volatile facts, categoryL2), see **`references/examples.md`** → "Validation Command Cookbook".

---

## Visual In-Game Deck Testing — MANDATORY

After CLI validation passes, test EVERY deck in-game before shipping via Docker visual verify:

```bash
# Docker warm mode (preferred):
scripts/docker-visual-test.sh --warm start --agent-id deck-<id>
scripts/docker-visual-test.sh --warm test --agent-id deck-<id> \
  --actions-file /tmp/deck-test.json --scenario none --wait 5000
scripts/docker-visual-test.sh --warm stop --agent-id deck-<id>
```

The actions file loads the deck via `__rrScenario.loadCustom({ screen: 'restStudy', deckId: 'YOUR_DECK_ID' })` then screenshots + layout dumps the quiz. Both gates required: CLI structural validation AND visual in-game test. Full scenario preset list and in-game checklist in **`references/examples.md`** → "Visual In-Game Testing".

---

## Sub-Agent Prompt Requirements

Every sub-agent spawned by this skill MUST include, in addition to the Sub-Agent Prompt Template from `.claude/rules/agent-routing.md`:

1. "Read `.claude/skills/deck-master/references/phase-{N}-*.md` for the phase you're working on BEFORE writing any facts."
2. "Read `.claude/skills/deck-master/references/anti-patterns.md` to avoid every mistake we've already made."
3. "The question + correct answer of every fact MUST be verifiable in the provided source text. Do NOT generate from training knowledge."
4. "After ANY batch generation, sample 5-10 facts and READ them back. Grep for broken patterns. Sub-agents produce broken output ~15-20% of the time."
5. "Create `TaskCreate` tasks for every pool BEFORE starting. Mark each in_progress/completed. Run `TaskList` before delivering — zero pending."
6. "Run the full Post-Assembly Quality Gate pipeline before claiming done."

---

## Related Skills

- `/curated-trivia-bridge` — bridge knowledge decks into the trivia DB
- `/llm-playtest` — playtest the deck as a real player
- `/inspect` — master orchestrator that can invoke deck verification alongside other checks
- `/validate-data` — data integrity checks across the deck ecosystem

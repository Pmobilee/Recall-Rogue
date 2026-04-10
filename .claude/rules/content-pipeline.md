# Content Pipeline Rules

## Batch Output Verification — MANDATORY (added 2026-04-09)

**After ANY batch content operation (mass question rewrite, distractor generation, fact assembly), SAMPLE 10+ items and READ them back.** Naive word replacement produces broken grammar ~20% of the time ("the this", "Soviet this", "in a who"). Three cleanup passes were needed after 1,561 question rewrites shipped with broken grammar.

**Rules:**
- Never trust batch output without sampling — sub-agents produce broken content ~15-20% of the time
- Grep for known broken patterns: "the this", "a this", "which this", "[Adjective] this", standalone "this" as noun
- Verify grammar reads naturally as proper English
- If >5% of samples are broken, reject the batch and rephrase individually
- Examples of placeholder leaks caught by sampling: "Joseph This" → should be "Joseph Haydn", "Federal this" → should be "Federal Reserve", "device process" → should be "Bessemer process".

## Curriculum-Sourced Scope — For Educational Decks

**For ANY deck where students depend on completeness (medical, language, certifications, exam prep), the SCOPE must come from an authoritative curriculum source — NEVER from LLM compilation.**

Before generating a single fact, you MUST:
1. **Find the canonical curriculum** — a real textbook ToC, official word list, or exam blueprint
2. **Extract the COMPLETE scope from that source** — every chapter, term, learning objective
3. **Cross-reference 2+ sources** to catch gaps
4. **Map deck architecture to the curriculum** — not the other way around

**Why:** On 2026-04-03, Medical Terminology shipped 635 facts scoped from LLM-compiled web search results. It completely missed medical abbreviations (STAT, PRN, BID, NPO) — terms every nursing student uses daily — because no actual curriculum was consulted.

**Examples of correct curriculum sources:**
- Medical terminology → Chabner "Language of Medicine" ToC, NCBI open textbook chapters
- Language vocabulary → Official JLPT/HSK/CEFR/TOPIK word lists (already done correctly)
- Language grammar → Official grammar point lists by level
- Anatomy → Gray's Anatomy chapter structure, A&P course syllabi

**This applies to:** Medical, language, anatomy, certifications, exam prep — any deck where a student would ask "does this cover everything I need to know?"

**This does NOT apply to:** Casual knowledge decks (movies, mythology, history) where completeness means "comprehensive" not "curriculum-aligned."

## Exam-Aligned Deck Standard

**Any deck covering material tested by an official standardized exam MUST align to that exam's official scope document.**

This means:
1. **Find the exam's official Course Description / Syllabus / Scope Document**
2. **Use its structure as the deck's architecture** — units, topics, learning objectives map to sub-decks and chain themes
3. **Cover every testable concept** — if it's in the exam scope, it must be in the deck
4. **Tag facts with exam metadata** — `examTags` field with exam name and unit/section identifiers
5. **Weight content by exam weighting** — units worth more on the exam get proportionally more facts

**Applicable exam frameworks:** AP (College Board CED), JLPT, CEFR, TOPIK, HSK, IB, SAT, GCSE/A-Level, USMLE/NCLEX.

**This does NOT apply to:** Casual knowledge decks where no standardized exam exists.

## Distractor Generation — NEVER From Database

**ALL distractors MUST be LLM-generated**, reading the specific question to produce plausible wrong answers.

NEVER pull from `correct_answer` values of other facts. On 2026-03-12, 58,359 garbage distractors had to be stripped. Scripts like `mine-distractors.mjs` are PERMANENTLY BANNED.

Distractors must:
- Be semantically coherent with what the question asks
- Match format and length of correct answer
- Be factually WRONG but plausible
- Come from LLM world knowledge, NOT database queries

DB queries permitted ONLY for post-generation validation.

## Fact Sourcing — ABSOLUTE RULE

### NEVER GENERATE FACTS FROM LLM KNOWLEDGE

Every fact-generation worker MUST receive verified source data IN ITS PROMPT.

**Correct workflow:**
1. Research: Look up facts from Wikipedia/Wikidata, verify dates/numbers/names
2. Architecture: Write verified data into `data/deck-architectures/*.yaml` with source URLs
3. Generation: Workers FORMAT pre-verified data into DeckFact JSON — they do NOT invent content
4. QA: Review every fact against original sources

**Workers MUST NEVER:**
- Generate dates/numbers from training knowledge
- Generate explanations with unverified claims
- Put Wikipedia URLs in sourceUrl without actually consulting that page
- Generate distractors that might accidentally be correct

**Why:** LLMs confidently produce wrong dates/numbers. QA by another LLM has the SAME blind spots. One wrong fact undermines educational trust in the entire product.

## Tatoeba Citation — MUST Come From Corpus, NEVER Fabricated

**Any `sourceRef: "tatoeba:N"` in a deck fact or `tatoeba_id` in a research TSV MUST be a real ID verified against the local Tatoeba corpus. Fabricating Tatoeba IDs — even as placeholders to fill coverage gaps — is a hard violation.**

### Why this rule exists

On 2026-04-10, an audit of shipped `spanish_a2/b1/b2_grammar.json` decks found **466 of 507 `tatoeba:N` sourceRefs (92%) were fabricated** — sub-agents asked to cite Tatoeba produced sequential ID blocks like `4499175, 4499176, 4499177, ...` with no correspondence to any real sentence. A1 escaped because it was hand-curated. The same pattern was caught in a fresh French A1 research TSV (68 of 94 rows fabricated in the `2699081-2699148` range) before it shipped.

The root cause is structural: **a sub-agent cannot browse the web and has no reliable internal index of Tatoeba IDs.** When a prompt demands "produce N rows with tatoeba IDs", the agent will pad with plausible-looking sequential numbers rather than admit it can't. LLM review has the exact same blind spot — a reviewer cannot verify IDs either.

### Mandatory corpus-backed flow

Before authoring any deck or research TSV that cites Tatoeba:

1. **Ensure the corpus exists.** `data/_corpora/tatoeba/` (gitignored) must contain `{lang}_en_pairs.tsv` and `{lang}_{a1,a2,b1,b2}_pool.tsv` for your target language.
2. **Build it if missing** via `node scripts/tatoeba/build-cefr-corpus.mjs --lang <fra|spa|...>`. This streams the Tatoeba bulk exports (`fra_sentences.tsv.bz2`, `eng_sentences.tsv.bz2`, `links.tar.bz2`) and emits per-CEFR-level filtered pools containing only verified real ID → English translation pairs.
3. **Author from the pool.** Sub-agents given a TSV slice of `{lang}_{level}_pool.tsv` MUST only cite IDs that appear in that slice. They never invent or guess IDs.
4. **Audit before committing** via `node scripts/tatoeba/audit-deck-ids.mjs --lang <code> --glob <pattern>`. This verifies every `tatoeba:N` ref against the corpus. Zero misses required.
5. **Remap if pre-corpus content is found** via `node scripts/tatoeba/remap-deck-ids.mjs --lang <code> --glob <pattern> --write`. Hits update to the real ID; misses become `sourceRef: "llm_authored"` (the sentence is preserved; only the false citation is removed).

### Allowed `sourceRef` values

| Value | When to use |
|---|---|
| `"tatoeba:N"` | N is a verified real ID in `{lang}_en_pairs.tsv`. Audit passes. |
| `"llm_authored"` | Sentence was generated by an LLM (pedagogically correct but not from Tatoeba). Honest alternative when corpus has no matching sentence. |
| `"PCIC-pattern"` / `"Referentiel-pattern"` | Conjugation-paradigm drill with no natural sentence source (e.g., bare present-tense chart rows). |

### Sub-agent prompt requirements for Tatoeba-citing decks

Every sub-agent spawn that authors language content MUST include:

> "You may ONLY cite `tatoeba:N` IDs that appear verbatim in the TSV slice included in this prompt. If a grammar point has no coverage in the slice, leave `sourceRef: \"llm_authored\"` and flag the gap in your return summary. Do NOT invent, guess, or sequentially fill Tatoeba IDs. The orchestrator will verify your output against the corpus before accepting it."

### Retroactive audit backlog

`docs/RESEARCH/SOURCES/content-pipeline-progress.md` tracks the retroactive Tatoeba audit under the `TODO-TATOEBA-AUDIT` tag. Spanish C1/C2 (planned) and any future language grammar decks MUST use the corpus flow from day one.

## Build Artifacts — JSON to SQLite Compilation

**JSON files in `data/decks/` are the authoring format. Never edit `public/curated.db` directly.**

```bash
npm run build:curated    # Compile data/decks/ → public/curated.db
npm run build:obfuscate  # XOR-obfuscate public/facts.db + public/curated.db
npm run build            # Production build (includes both steps above)
```

Key scripts: `scripts/build-curated-db.mjs` (JSON→SQLite), `scripts/obfuscate-db.mjs` (XOR obfuscation). Runtime decode: `src/services/dbDecoder.ts`.

**What is NOT shipped:** `data/decks/*.json` (repo only), `data/seed-pack.json` (repo only).

## CC-CEDICT Sense Alignment — MANDATORY for Chinese Decks

**When ingesting from CC-CEDICT, the `explanation` field MUST come from the SAME sense cluster as the `correctAnswer`.**

CC-CEDICT has multiple headwords per simplified character (different tones/readings). The answer pipeline (`get_usable_meaning()`) picks the quiz answer from one sense; the explanation builder MUST reference that same sense — not a different reading's meaning cluster.

### Validation step (run after every CC-CEDICT ingest):
```python
import json, re
d = json.load(open('data/decks/chinese_hsk6.json'))
suspects = []
for f in d['facts']:
    ans = f.get('correctAnswer', '').lower()
    exp = f.get('explanation', '').lower()
    tokens = [t.strip() for t in re.split(r'[;,/]', ans) if len(t.strip()) >= 4]
    if tokens and not any(t in exp for t in tokens):
        suspects.append(f['id'])
print(f'{len(suspects)} suspects')  # Target: <20
```

If >50 suspects: pipeline bug — fix before shipping. If pipeline fix is deferred: set `explanation` to `"Multiple meanings exist; see dictionary entry for \"<char>\"."` as honest placeholder. **Never ship wrong-sense explanations** — they actively teach incorrect information.

**Root cause of 2026-04-10 HSK6 incident:** 356 facts had mismatched sense (e.g., 作 answer="to do; to make" but explanation described "worker"). Full post-mortem in `docs/gotchas.md`.

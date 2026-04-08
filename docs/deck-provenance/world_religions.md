# Deck Provenance: world_religions

**Deck ID:** `world_religions`
**File:** `data/decks/world_religions.json`
**Total Facts:** 377
**Sub-decks:** 7
**Assembled:** 2026-04-08
**Status:** Shipped

---

## 1. Sources

### Wikipedia (CC BY-SA 4.0)
- **URL:** https://en.wikipedia.org/
- **License:** Creative Commons Attribution-ShareAlike 4.0 International
- **What was taken:** Article text for each major tradition — founding events, key figures, sacred texts, practices, historical periods. Workers fetched individual article pages for every fact and cited the source URL on the fact's `sourceUrl` field.
- **Commercial use:** Permitted. Share-alike obligation applies — derived deck content is itself shareable under the same CC BY-SA 4.0 terms.
- **Attribution required:** "Content derived from Wikipedia (CC BY-SA 4.0)"

### Wikidata (CC0)
- **URL:** https://www.wikidata.org/
- **License:** CC0 (public domain dedication)
- **What was taken:** Structured founder data — birth/death dates and locations for Jesus of Nazareth, Muhammad, Siddhartha Gautama (the Buddha), Confucius, Laozi, Zoroaster, and Abraham. Queried via SPARQL in `data/deck-sources/world_religions/founders_wikidata.md`.
- **Commercial use:** Unrestricted (CC0).
- **Attribution required:** None required, but Wikidata credited in pipeline docs.

### Encyclopedia Britannica
- **URL:** https://www.britannica.com/
- **License:** All rights reserved — cross-check only, no content taken.
- **What was taken:** Nothing. Used solely to cross-verify dates and figures against Wikipedia claims.
- **Commercial use:** N/A.

### Pew Research Center
- **URL:** https://www.pewresearch.org/
- **License:** Free for non-commercial and attribution use. Content was used only for statistical framing (adherent population figures), not as primary fact source.
- **What was taken:** Global adherent estimates cited in introductory framing facts (e.g., Islam has ~1.9 billion adherents). No Pew-proprietary analysis was reproduced verbatim.
- **Commercial use:** Permitted with attribution for statistical data. Facts citing Pew use Wikipedia as the `sourceUrl` where the same figure appears with open licensing.

---

## 2. Pipeline Steps

### Phase 1 — Architecture
- **Input:** Deck design requirements, DECKBUILDER.md spec
- **Process:** Orchestrator authored `data/deck-architectures/world_religions_arch.yaml` defining 7 sub-decks, chain themes, answer type pools, and target fact counts.
- **Output:** Architecture YAML with full pool definitions and sub-deck scope.
- **Validation:** Manual review by orchestrator against DECKBUILDER.md pool-design requirements.

### Phase 2 — Wikidata SPARQL Research
- **Input:** List of founding figures requiring machine-verified dates.
- **Process:** Wikidata SPARQL MCP (`mcp__wikidata__query`) queried for founder birth/death dates, locations, and related structured facts. Results cached at `data/deck-sources/world_religions/founders_wikidata.md`.
- **Output:** Verified structured data for Jesus, Muhammad, Buddha, Confucius, Laozi, Zoroaster, Abraham — exact dates where recorded, circa-dates where uncertain.
- **Validation:** Cross-checked against Wikipedia articles and Britannica for plausibility.

### Phase 3 — Generation (7 Parallel Sonnet Workers)
- **Input:** Architecture YAML + per-tradition Wikipedia article cache.
- **Process:** 7 content-agent Sonnet workers ran in parallel, one per sub-deck. Each worker:
  1. Fetched relevant Wikipedia articles (cached locally under `data/deck-sources/world_religions/<tradition>/`).
  2. Extracted verified facts with real `sourceUrl` values pointing to the fetched articles.
  3. Produced `DeckFact` JSON arrays with `quizQuestion`, `correctAnswer`, `explanation`, `wowFactor`, `distractors`, `difficulty`, `funScore`, and `ageRating`.
- **Output:** 7 WIP JSON files (`data/decks/_wip/world_religions_*.json`) with flat fact arrays.
- **Record counts:** Christianity 70, Islam 66, Judaism 50, Hinduism 60, Buddhism 55, Sikhism 30, Other Living 46.
- **Validation:** Workers instructed to WebFetch every article before extracting facts — no facts from LLM training knowledge.

### Phase 4 — Assembly
- **Input:** 7 WIP fact arrays.
- **Process:** content-agent assembly worker:
  1. Wrapped flat fact arrays into the `CuratedDeck` envelope with `id`, `domain`, `subDomain`, `title`, `description`, `chainThemes`, `subDecks`, `answerTypePools`, `synonymGroups`, `tiers`.
  2. Built 17 answer type pools programmatically by scanning `answerTypePoolId` values across all 377 facts and collecting matching `factId`s into pool `factIds` arrays.
  3. Split 3 large pools into length-banded sub-pools (`religious_concept_names_short` / `religious_concept_names_long`, `religious_figure_names_short` / `religious_figure_names_long`) to pass quiz-audit homogeneity check.
  4. Dropped all question templates — template placeholders (`{definition}`, `{religion}`, `{accomplishment}`) were not present as fields in the fact objects.
  5. Normalized schemas: age ratings, difficulty range, funScore range.
- **Output:** `data/decks/world_religions.json` (377 facts, 17 pools, 3 synonym groups).
- **Validation:** `node scripts/verify-all-decks.mjs` run after assembly — 0 failures.

### Phase 5 — Post-Fix
- **Input:** Assembled deck with pool `members` arrays absent (assembler had omitted them) and 5 content correctness issues.
- **Process:** Orchestrator audited the assembled file and applied targeted fixes:
  1. Populated all pool `members` arrays from `factIds` (assembler had missed this step).
  2. Fixed 7 `bracket_numbers` facts with plain integer `correctAnswer` values — corrected to `{N}` format.
  3. Moved `world_religions_sik_ten_gurus` (`correctAnswer: "ten"`) from `religious_concept_names` to `bracket_numbers` pool (then corrected to `{10}`).
  4. Moved `world_religions_jud_holocaust_shoah` (`correctAnswer: "Six million"`) from `bracket_numbers` to `religious_concept_names` (word form, not numeric).
  5. Moved `world_religions_oth_jainism_buddhism_connection` (`correctAnswer: "6th–5th century BCE"`) from `bracket_numbers` to `religious_concept_names` (date range, not a bracket-notation number).
  6. Moved `world_religions_bud_mother` ("Maya") from `bodhisattva_and_buddhist_figures` to `religious_figure_names_short` (she is Siddhartha's mother, not a bodhisattva).
  7. Moved `world_religions_hin_om_symbol` ("Om") from `religious_object_names` to `religious_concept_names_short` (Om is a sacred syllable/concept, not an object).
  8. Stripped 762 pool-collision distractors from fact-level `distractors[]` arrays (runtime selects from pool at quiz time).
- **Output:** Final `data/decks/world_religions.json` passing all checks.
- **Validation:** `verify-all-decks.mjs` 0 failures. `quiz-audit.mjs --full` 0 failures.

---

## 3. Distractor Generation

**Method:** Pool-based runtime selection (primary) with per-fact pre-generated fallback.

Every fact's `answerTypePoolId` references one of 17 answer type pools containing 5–44 semantically homogeneous members. At quiz time, the runtime selects 3–4 distractors from the pool, weighted by the player's confusion matrix (answers they've confused before appear more often). This approach produces superior distractors because it guarantees semantic type consistency — all options are the same kind of thing (e.g., all religious founder names, all sacred text names).

**Fallback distractors:** Each fact also carries 6–12 pre-generated `distractors[]` values in the fact JSON. These are only used if pool selection fails (e.g., pool has fewer than 4 members excluding the correct answer). Pre-generated distractors were produced by the Sonnet generation workers reading the specific question and producing plausible wrong answers from Wikipedia world knowledge — never pulled from `correctAnswer` values of other facts.

**Sources for distractors:** LLM world knowledge about each tradition — workers read the question and answer before generating distractors to ensure semantic plausibility and factual incorrectness.

**Validation:** Pool homogeneity checked by `node scripts/verify-all-decks.mjs` (check #20: max/min answer length ratio < 3× within each pool). 0 failures after pool splitting in Phase 4.

---

## 4. Fact Verification

**Method:** Wikipedia article fetch with source URL citation on every fact.

Each of the 377 facts carries a `sourceUrl` field pointing to the specific Wikipedia article consulted. Generation workers were instructed to WebFetch the article before extracting each fact — facts may not be generated from LLM training knowledge. The Wikidata SPARQL MCP provided machine-verified structured data for the 7 founding figures where exact dates are historically recorded (dates for some figures such as Abraham and Laozi are traditional/estimated; these facts use appropriately hedged question language).

**Sources checked:**
- Wikipedia articles per tradition (Christianity, Islam, Judaism, Hinduism, Buddhism, Sikhism, and 8 smaller traditions in the "Other Living" sub-deck)
- Wikidata SPARQL for founder biographical data (birth/death dates, locations)
- Encyclopedia Britannica (cross-check only, not a data source)

**Known limitations:**
- Dates for some ancient figures (Abraham ~2000 BCE, Laozi ~6th century BCE, Zoroaster ~1500–600 BCE range) are historically uncertain. Facts use "traditionally dated" or "circa" language where appropriate.
- Pew adherent population estimates (used in a small number of framing facts) are survey-based and change over time; the figures cited reflect the most recent available Wikipedia-cited estimates as of 2026.
- Worker articles were fetched during generation; a small number of Wikipedia articles may have been updated since. Core doctrinal and historical facts are stable; population/statistical facts are the most likely to drift.

**Error rate:** Post-assembly QA by orchestrator found and corrected 5 pool-assignment errors (see Phase 5). No factual inaccuracies were identified during the QA pass.

---

## 5. Quality Assurance

**Checks run:**

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `node scripts/verify-all-decks.mjs` (22 checks, 377 facts) | 0 FAIL |
| `node scripts/quiz-audit.mjs --deck world_religions --full` | 0 FAIL |
| Pool homogeneity (max/min ratio < 3×) | 0 FAIL |
| Automated playtest — all-correct run | PASS |
| Automated playtest — 30% wrong-answer rate | PASS |
| `npx vitest run` (4374 unit tests) | PASS |
| Age-distribution check (≥ 40% `all`-rated facts) | 79% `all` — PASS |

**Known issues / limitations:**
- LLM playtest via Haiku agent: IN PROGRESS (not yet completed as of 2026-04-08). This check should be run before the deck is surfaced to players in production.

**Sample review:** Orchestrator manually inspected approximately 30 facts across all 7 sub-decks for question clarity, answer correctness, and distractor plausibility during the Phase 5 post-fix pass. No systematic quality issues were identified.

---

## 6. Attribution Requirements

**Required attribution text:**

> Content derived from Wikipedia (CC BY-SA 4.0) and Wikidata (CC0). Full attribution list available in the in-app credits screen.

**Where to display:**
- In-app credits screen (required)
- App store listing (optional but recommended)
- Any promotional materials reproducing specific facts (as needed)

**Share-alike obligations:** Because Wikipedia content is licensed under CC BY-SA 4.0 (share-alike), the deck content derived from it is itself subject to the same license terms. This means:
- The deck facts MAY be used commercially (Recall Rogue may sell this content).
- Any third party who reproduces or adapts these facts must also share under CC BY-SA 4.0.
- The Wikidata-sourced facts (founder dates) carry no share-alike obligation (CC0).
- Pew Research statistical figures: attributed to Pew Research in the explanation field where used. No reproduction of full Pew reports.

---

## 7. Reproduction Steps

To regenerate the deck from scratch:

```bash
# 1. Rebuild the curated database from source JSON
npm run build:curated

# 2. Obfuscate for production
npm run build:obfuscate

# 3. Bridge deck facts to the trivia database (if not already done)
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs

# 4. Rebuild facts.db if bridge facts were added
node scripts/build-facts-db.mjs
```

**Originating inputs:**
- Architecture: `data/deck-architectures/world_religions_arch.yaml`
- Research data: `data/deck-sources/world_religions/` (per-tradition article caches and `founders_wikidata.md`)
- WIP sub-deck files: `data/decks/_wip/world_religions_*.json` (7 files)
- Assembly: content-agent Sonnet worker (programmatic CuratedDeck envelope construction)
- Post-fix: orchestrator targeted corrections (5 pool-assignment fixes, bracket_numbers normalization)

**Prerequisites:** Node.js 20+, `better-sqlite3` available, `data/deck-sources/world_religions/` article cache available for re-generation workers.

---

## Sub-Deck Summaries

### Christianity (70 facts)
Covers the life of Jesus (birth, ministry, crucifixion, resurrection), the 12 apostles, the formation of the early church, the New Testament canon, major denominations (Catholic, Orthodox, Protestant), the Reformation (Luther, Calvin), and key doctrines (Trinity, salvation, baptism). Scope: global Christianity across 2,000 years.

### Islam (66 facts)
Covers Muhammad's life and revelation, the five pillars (Shahada, Salat, Zakat, Sawm, Hajj), the Quran and Hadith, the Hijra, the early caliphate, the Sunni-Shia split, key figures (Abu Bakr, Ali, Fatimah), Islamic Golden Age scholarship, and major global practices. Scope: foundational doctrine and early history.

### Judaism (50 facts)
Covers the Torah and Hebrew Bible, the patriarchs (Abraham, Isaac, Jacob, Moses), the Exodus, the Temple in Jerusalem, Rabbinic Judaism, major holidays (Passover, Yom Kippur, Rosh Hashanah, Hanukkah), the Talmud, the Holocaust (Shoah), and the founding of modern Israel. Scope: biblical foundations through the 20th century.

### Hinduism (60 facts)
Covers the Vedas and Upanishads, the Trimurti (Brahma, Vishnu, Shiva), the Mahabharata and Bhagavad Gita, the Ramayana, major deities (Lakshmi, Saraswati, Ganesha, Durga, Krishna), the four Vedic goals (Purusharthas), karma and dharma, yoga traditions, and major festivals (Diwali, Holi). Scope: ancient origins through living practice.

### Buddhism (55 facts)
Covers Siddhartha Gautama's life (birth, Bodhi tree enlightenment, first sermon, parinirvana), the Four Noble Truths, the Eightfold Path, the Three Jewels, major schools (Theravada, Mahayana, Vajrayana), key texts (Dhammapada, Heart Sutra), key figures (Ananda, Nagarjuna, Dalai Lama), and the spread of Buddhism across Asia. Scope: founding through major living traditions.

### Sikhism (30 facts)
Covers Guru Nanak Dev Ji (founder), all ten Gurus, the Guru Granth Sahib (eternal living Guru), the Golden Temple (Harmandir Sahib), the Five Ks (Panj Kakars), the concepts of Waheguru, Seva (selfless service), Langar (community kitchen), and the founding of the Khalsa in 1699. Scope: foundational history and core practices.

### Other Living Traditions (46 facts)
Covers eight additional traditions: Jainism (ahimsa, Mahavira, the three jewels of Jainism), Zoroastrianism (Zoroaster, Ahura Mazda, Avesta, fire temples), Bahá'í Faith (Bahá'u'lláh, progressive revelation, unity principle), Taoism (Laozi, Tao Te Ching, wu wei, yin-yang), Confucianism (Confucius, Analects, five relationships, ren), Shinto (kami, torii gates, Amaterasu, misogi purification), Vodou (lwa/loa spirits, Legba, syncretic origins), and Indigenous Animism (broad survey of animist concepts, sacred land, oral tradition, shamanism). Scope: foundational doctrines and key figures for each tradition.

---

## Sensitivity Notes

### Neutral Framing
All facts are written as descriptive statements about beliefs, practices, and history — not as endorsements or critiques. Language follows academic religious studies conventions: "Muslims believe...", "According to Christian tradition...", "Hindus observe..." where doctrinal claims are not universally verified historical fact.

### Cross-Tradition Figures
Abraham, Moses, and Jesus appear in multiple traditions (Judaism, Christianity, Islam; Jesus also referenced in Islam as a prophet). Facts about these figures are placed in their primary tradition's sub-deck but are written to acknowledge cross-tradition significance in explanations where relevant. Distractors for questions about these figures do not conflate their roles across traditions.

### Age Rating Choices
Facts about the Holocaust/Shoah, sectarian violence, religious martyrdom, and the historical context of human sacrifice are rated `teen+` (not `all`). This includes the `world_religions_jud_holocaust_shoah` fact (six million Jewish deaths), any facts about the Spanish Inquisition or Crusader massacres, and the Aztec sacrifice context in the Hinduism/Indigenous sub-sections. The 79% `all`-rating rate (exceeding the 40% target) reflects that the majority of religious facts describe doctrine, practice, and biography.

### Stereotype Countering
Several facts were specifically included to counter common misconceptions:
- **Vodou (Voodoo):** Facts emphasize the tradition's West African Fon-Ewe origins, syncretic Catholic elements, and community healing role — explicitly not the Hollywood "voodoo doll" representation. The explanation field on every Vodou fact notes the misrepresentation.
- **Zoroastrianism:** The tradition is introduced with its historical importance (influence on Abrahamic religions' concepts of heaven, hell, and angels) to counter its marginalization as "obscure." Fire worship is contextualized as veneration of purity, not literal fire worship.
- **Indigenous Animism:** Facts avoid the "primitive religion" framing. The term "animism" is introduced with its academic definition. Facts emphasize the diversity of Indigenous traditions and the depth of their cosmological systems.
- **Islam:** Facts about Jihad as personal spiritual struggle (greater jihad) are included alongside the historical military context (lesser jihad) to avoid one-sided framing.

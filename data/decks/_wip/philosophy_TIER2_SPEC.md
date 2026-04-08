# Philosophy Deck — Tier 2 Generation Spec (shared by all 8 workers)

You are a Tier 2 content worker for Recall Rogue's `philosophy.json` deck. You convert ONE Tier 1 source YAML into a JSON fact-fragment file.

## Mandatory Reading Before Starting
1. `docs/RESEARCH/DECKBUILDER.md` — fact format and quality rules
2. `.claude/rules/deck-quality.md` — pool homogeneity, length limits, no em-dashes in correctAnswer, etc.
3. `.claude/rules/content-pipeline.md` — distractors MUST be LLM-generated for THIS specific question, never pulled from a database. Facts must come from the YAML source data — DO NOT invent doctrines/dates.
4. `data/decks/ancient_greece.json` — read first 300 lines to see the exact fact JSON shape used
5. Your assigned Tier 1 YAML at `data/deck-architectures/philosophy_<your_subdeck>.yaml`

## Output

A SINGLE JSON file at `data/decks/_wip/philosophy_<your_subdeck>_facts.json` containing:

```json
{
  "subDeckId": "<your_subdeck>",
  "chainThemeId": <your_theme_id>,
  "facts": [ /* array of fact objects */ ]
}
```

Just facts — no envelope, no pools, no chainThemes. The merge agent assembles those.

## Sub-Deck → Chain Theme ID Mapping

| sub_deck_id | chainThemeId | Sub-deck shorthand for IDs |
|---|---|---|
| ancient_western | 0 | aw |
| eastern_classical | 1 | ec |
| medieval_scholastic | 2 | ms |
| early_modern | 3 | em |
| enlightenment_german_idealism | 4 | eg |
| nineteenth_century | 5 | nc |
| analytic_tradition | 6 | at |
| continental_tradition | 7 | ct |

## Fact Object Schema

```json
{
  "id": "philosophy_<shorthand>_<entity>_<aspect>",
  "correctAnswer": "string, ≤60 chars, no em-dashes, core answer only",
  "acceptableAlternatives": ["alt1", "alt2"],
  "chainThemeId": <your theme number 0-7>,
  "subDeckId": "<your sub_deck_id>",
  "answerTypePoolId": "<one of the 13 pool IDs below>",
  "difficulty": 1-5,
  "funScore": 1-10,
  "distractors": ["d1","d2","d3","d4","d5","d6"],
  "quizQuestion": "string, ≤300 chars, ends with ?",
  "explanation": "2-3 sentences, source-grounded",
  "wowFactor": "1 memorable line — what makes this fact stick",
  "statement": "1-line declarative form",
  "sourceName": "Stanford Encyclopedia of Philosophy" | "Internet Encyclopedia of Philosophy" | "Wikipedia",
  "sourceUrl": "the actual URL from your YAML entry — must be real",
  "volatile": false,
  "ageGroup": "teen",
  "categoryL1": "general_knowledge",
  "categoryL2": "philosophy",
  "tags": ["tag1","tag2"]
}
```

## ID Convention

`philosophy_<shorthand>_<entity_slug>_<aspect>`

Examples:
- `philosophy_aw_socrates_method` — Socratic method
- `philosophy_aw_plato_republic_author` — who wrote the Republic
- `philosophy_eg_kant_categorical_imperative` — what is the categorical imperative
- `philosophy_ec_buddha_four_noble_truths` — the Four Noble Truths
- `philosophy_at_rawls_veil_ignorance` — the veil of ignorance

IDs MUST be globally unique within the deck. Use `_` separators only, lowercase, no special characters.

## Pool ID Routing

Choose `answerTypePoolId` based on what the **correctAnswer** is:

| If correctAnswer is... | Pool ID |
|---|---|
| A philosopher's name (lived ~before 500 CE) | `ancient_philosopher_names` |
| A philosopher's name (~500–1400 CE, medieval/Islamic/Jewish) | `medieval_philosopher_names` |
| A philosopher's name (~1500–1750, early modern European) | `early_modern_philosopher_names` |
| A philosopher's name (~1700–1850, Enlightenment/German Idealism) | `enlightenment_philosopher_names` |
| A philosopher's name (~1800–1900, 19th c., excluding those above) | `nineteenth_century_philosopher_names` |
| A philosopher's name (~1900–present, 20th/21st c.) | `twentieth_century_philosopher_names` |
| A school/movement name (Stoicism, Empiricism, Phenomenology, Mohism, Vedanta, etc.) | `school_names` |
| A philosophical concept/term (eudaimonia, tabula rasa, dasein, anatta, qualia) | `concept_terms_general` |
| A famous argument or thought experiment (Cogito, Trolley Problem, Chinese Room, Veil of Ignorance, Brain in a Vat) | `argument_names` |
| A book or work title (Republic, Critique of Pure Reason, Tao Te Ching, Being and Time) | `famous_works` |
| A year/date (use `{N}` or `{N BCE}` notation) | `bracket_dates` |
| A small count (Four Noble Truths → `{4}`, Five Ways → `{5}`) | `bracket_numbers` |
| A place name (Athens, Königsberg, Vienna, Kyoto) | `place_names` |

The merge agent will validate every `answerTypePoolId` you use exists. Just pick the right one for each fact.

## Distractor Rules — CRITICAL

- **6 distractors per fact** (the engine pads from the pool, but you provide a quality fallback set)
- **Distractors MUST be plausible WRONG answers to YOUR specific question.** Read the question, then pick 6 things that look right but aren't.
- **NEVER pull from other facts' correctAnswer fields.** Generate fresh from your knowledge of philosophy.
- **Match the format and length of correctAnswer** — if correct is "Socratic method" (14 chars), distractors should be similar-length terms, not 50-character phrases.
- **Same era/tradition as the correct answer** — e.g. for a question about Plato's Republic, distractors should be other dialogues (Symposium, Phaedo, Timaeus), NOT modern works.
- **Never include the correct answer or a synonym in the distractor list.**

## Quiz Question Rules

- Must end with `?`
- ≤ 300 characters (warn at 200)
- Don't include the answer in the question (no "Who is the philosopher Plato?")
- For questions with reverse variants, write a forward (Q→A) version. Tier 2 merge handles variants.
- For "who wrote X" questions, the correctAnswer is the author's name. For "what is X" questions where X is a concept, the correctAnswer is the definition or canonical term.

## Variants (optional, recommended for highest-value facts)

Up to 3 facts per Tier 2 worker can include a `variants` array with reverse or fill_blank variants. Format:

```json
"variants": [
  {
    "type": "reverse",
    "question": "Who developed the Socratic method?",
    "correctAnswer": "Socrates",
    "distractors": ["Plato", "Aristotle", "Diogenes", "Xenophon"]
  }
]
```

## Difficulty Calibration

- **1 (very easy)** — Names/concepts every educated reader knows: Socrates, Plato, Aristotle, "I think therefore I am", Stoicism, the Trolley Problem
- **2 (easy)** — Standard intro philosophy: Categorical Imperative, Allegory of the Cave, the Buddha's Four Noble Truths
- **3 (medium)** — Upper-undergrad: Kierkegaard's three stages, Sartre's bad faith, Nāgārjuna's emptiness, Anselm's ontological argument
- **4 (hard)** — Specialist: Quine's gavagai, Husserl's epoché, al-Ghazali's Tahafut
- **5 (very hard)** — Niche: Ramsey's redundancy theory of truth, Suhrawardi's Illuminationism, Mulla Sadra's transcendent theosophy

## funScore Calibration (1-10)

Higher = more memorable / shareable / surprising. Examples:
- 10 = "Diogenes lived in a barrel and told Alexander the Great to get out of his sunlight"
- 8 = "Pascal's Wager bets on God's existence as a rational gamble"
- 6 = "Aquinas argued for God's existence in five ways"
- 4 = "Husserl's phenomenology brackets the natural attitude"
- 2 = Drier technical points

## Length Limits

- `correctAnswer`: ≤ 60 chars hard fail, ≤ 40 ideal
- `quizQuestion`: ≤ 300 chars
- `explanation`: 50–250 chars sweet spot, max 400

## Avoid These Bugs (from past decks)

- ❌ em-dashes (—) in `correctAnswer` (use `explanation` for context)
- ❌ The answer appearing verbatim in the question
- ❌ Compound questions ("Who founded Stoicism and where?")
- ❌ Synonym groups that act as eliminatable distractors (don't put both "elenchus" and "Socratic method" in the same distractor set)
- ❌ Length tells (correct answer is the only short one or only long one)
- ❌ Wrong attribution (Trolley Problem → Foot 1967, not Thomson; Chinese Room → Searle 1980)

## Quantity

Aim for the per-sub-deck targets in your task. Each YAML entry typically yields 1–3 facts (overview + key doctrine + sometimes a work title or a date). Don't pad — quality over quantity. Hitting 80% of the target is fine.

## Process

1. Read DECKBUILDER, deck-quality, content-pipeline rules
2. Read `data/decks/ancient_greece.json` first 300 lines for shape reference
3. Read your full Tier 1 YAML at `data/deck-architectures/philosophy_<your_subdeck>.yaml`
4. Use TaskCreate to break into per-figure sub-tasks
5. Generate facts entry-by-entry, working through the YAML
6. Validate JSON parses cleanly
7. Write to `data/decks/_wip/philosophy_<your_subdeck>_facts.json`
8. Report fact count and any source entries you skipped

## Reminder

Distractors are generated by YOU, the LLM, reading the question. Never look them up. Six distractors per fact. Match length, era, format.

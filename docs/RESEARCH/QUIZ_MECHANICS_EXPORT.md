# Recall Rogue — Quiz Mechanics & Sample Data Export

## 10 Example Fact Rows

### Curated Deck Facts (5 examples)

These live in `data/decks/` as JSON files. They belong to structured, themed decks with answer type pools, synonym groups, and question templates.

---

#### 1. Anatomy — Numerical (ha_skel_001)

```json
{
  "id": "ha_skel_001",
  "subDeckId": "skeletal_system",
  "correctAnswer": "8",
  "acceptableAlternatives": ["eight"],
  "chainThemeId": "skull_bones",
  "answerTypePoolId": "number_stats",
  "difficulty": 1,
  "funScore": 2,
  "quizQuestion": "How many bones make up the cranium (cranial vault)?",
  "explanation": "The 8 cranial bones are: frontal (1), parietal (2), temporal (2), occipital (1), sphenoid (1), and ethmoid (1). Together they encase and protect the brain.",
  "sourceName": "Wikipedia",
  "sourceUrl": "https://en.wikipedia.org/wiki/Human_skull",
  "volatile": false,
  "distractors": ["6", "7", "9"],
  "variants": [
    {
      "quizQuestion": "The cranial vault is formed by how many individual bones?",
      "correctAnswer": "8",
      "explanation": "Eight cranial bones — frontal, two parietals, two temporals, occipital, sphenoid, and ethmoid — fuse together in adulthood."
    }
  ]
}
```

#### 2. Anatomy — Named Answer with Multiple Variants (ha_skel_003)

```json
{
  "id": "ha_skel_003",
  "subDeckId": "skeletal_system",
  "correctAnswer": "Stapes",
  "acceptableAlternatives": ["stapes bone"],
  "chainThemeId": "skull_bones",
  "answerTypePoolId": "bone_names",
  "difficulty": 1,
  "funScore": 5,
  "quizQuestion": "What is the smallest bone in the human body?",
  "explanation": "The stapes, one of the three ossicles in the middle ear, measures only about 3 mm. Its name is Latin for 'stirrup' due to its shape.",
  "distractors": ["Malleus", "Incus", "Lacrimal bone"],
  "variants": [
    {
      "quizQuestion": "Which ear ossicle is approximately 3 mm long and is the smallest bone in the body?",
      "correctAnswer": "Stapes"
    },
    {
      "quizQuestion": "The malleus, incus, and ___ are the three ossicles of the middle ear. The last one is the smallest bone in the body.",
      "correctAnswer": "Stapes"
    }
  ]
}
```

#### 3. WWII History — Rich Variant Set (wwii_ef_barbarossa_force_size)

```json
{
  "id": "wwii_ef_barbarossa_force_size",
  "correctAnswer": "3 million",
  "acceptableAlternatives": ["3,000,000", "three million"],
  "answerTypePoolId": "number_stats",
  "difficulty": 2,
  "funScore": 7,
  "quizQuestion": "How many troops did Hitler commit to Operation Barbarossa — the largest land invasion in military history?",
  "explanation": "Operation Barbarossa launched June 22, 1941 with approximately 3 million Axis troops across a 1,000 km front.",
  "distractors": ["1 million", "1.5 million", "2 million", "4 million", "5 million", "500,000", "800,000", "6 million"],
  "variants": [
    {
      "type": "reverse",
      "correctAnswer": "Operation Barbarossa",
      "quizQuestion": "Which operation, launched June 22, 1941, was the largest land invasion in military history with 3 million troops?",
      "distractors": ["Operation Sea Lion", "Operation Citadel", "Operation Overlord", "Operation Market Garden"]
    },
    {
      "type": "context",
      "correctAnswer": "Lebensraum",
      "quizQuestion": "Operation Barbarossa was ideologically driven by Hitler's concept of what — the need for German 'living space' in the east?",
      "distractors": ["Blitzkrieg", "Anschluss", "Weltpolitik", "Drang nach Osten"]
    },
    {
      "type": "true_false",
      "correctAnswer": "True",
      "quizQuestion": "True or False: Operation Barbarossa violated the Molotov-Ribbentrop non-aggression pact.",
      "distractors": ["False"]
    },
    {
      "type": "fill_blank",
      "correctAnswer": "1941",
      "quizQuestion": "Operation Barbarossa, Germany's invasion of the Soviet Union, began on June 22, ____.",
      "distractors": ["1939", "1940", "1942", "1943"]
    }
  ]
}
```

#### 4. Japanese Vocabulary (ja-jlpt-11)

```json
{
  "id": "ja-jlpt-11",
  "correctAnswer": "Yen",
  "acceptableAlternatives": [],
  "answerTypePoolId": "english_meanings",
  "difficulty": 1,
  "funScore": 5,
  "quizQuestion": "What does \"～円\" (～えん) mean?",
  "explanation": "～円 (～えん) — Yen. Part of speech: word.",
  "sourceName": "JMdict + JLPT (jamsinclair)",
  "distractors": [],
  "targetLanguageWord": "～円",
  "reading": "～えん",
  "language": "ja"
}
```

#### 5. Japanese Vocabulary (ja-jlpt-12)

```json
{
  "id": "ja-jlpt-12",
  "correctAnswer": "shop",
  "acceptableAlternatives": [],
  "answerTypePoolId": "english_meanings",
  "difficulty": 1,
  "funScore": 5,
  "quizQuestion": "What does \"～屋\" (～や) mean?",
  "explanation": "～屋 (～や) — ~ shop. Part of speech: word.",
  "sourceName": "JMdict + JLPT (jamsinclair)",
  "distractors": [],
  "targetLanguageWord": "～屋",
  "reading": "～や",
  "language": "ja"
}
```

---

### Trivia DB Facts (5 examples)

These live in `public/facts.db` (SQLite). They are standalone facts without deck structure — no answer pools, no synonym groups, no question templates.

---

#### 6. Biology — Numerical with Brace Markers

```json
{
  "id": "animals_wildlife-corvidae-135-species",
  "type": "knowledge",
  "quiz_question": "How many species are currently included in the corvid family?",
  "correct_answer": "{135} species",
  "acceptable_answers": ["135", "135 species", "about 135"],
  "category_l1": "animals_wildlife",
  "category_l2": "birds",
  "difficulty": 4,
  "rarity": "rare",
  "fun_score": 6,
  "explanation": "The Corvidae family currently includes 135 species. The genus Corvus alone — containing crows, ravens, rooks, and jackdaws — has 47 species.",
  "source_name": "Wikipedia"
}
```

#### 7. Technology — Named Answer

```json
{
  "id": "general_knowledge-javascript-nodejs-runtime",
  "type": "knowledge",
  "quiz_question": "What is the most popular runtime for running JavaScript outside of web browsers?",
  "correct_answer": "Node.js",
  "acceptable_answers": ["Node", "Node.js", "NodeJS"],
  "category_l1": "general_knowledge",
  "category_l2": "inventions_tech",
  "difficulty": 2,
  "rarity": "common",
  "fun_score": 6,
  "explanation": "Node.js transformed JavaScript from a pure front-end language into a full-stack tool capable of running servers, APIs, and command-line tools.",
  "source_name": "Wikipedia"
}
```

#### 8. History — Person Answer

```json
{
  "id": "history-nietzsche-sister-misrepresented",
  "type": "knowledge",
  "quiz_question": "Who edited Nietzsche's writings after his death to falsely associate him with nationalism?",
  "correct_answer": "His sister Elisabeth",
  "acceptable_answers": ["Elisabeth Förster-Nietzsche", "his sister", "Elisabeth Nietzsche"],
  "category_l1": "history",
  "category_l2": "people_leaders",
  "difficulty": 4,
  "rarity": "rare",
  "fun_score": 9,
  "explanation": "Elisabeth Förster-Nietzsche became curator of his manuscripts and edited his unpublished writings to fit her German ultranationalist ideology, contradicting Nietzsche's stated anti-nationalist opinions.",
  "source_name": "Wikipedia"
}
```

#### 9. Chemistry — Short Answer

```json
{
  "id": "natural_sciences-tellurium-garlic-breath",
  "type": "knowledge",
  "quiz_question": "What distinctive smell does tellurium exposure cause on the breath?",
  "correct_answer": "Garlic",
  "acceptable_answers": ["garlic", "garlic-like"],
  "category_l1": "natural_sciences",
  "category_l2": "chemistry_elements",
  "difficulty": 4,
  "rarity": "rare",
  "fun_score": 9,
  "explanation": "Tellurium is partly metabolized into dimethyl telluride, (CH₃)₂Te, a gas with a garlic-like odour exhaled in the breath of victims of tellurium poisoning.",
  "source_name": "Wikipedia"
}
```

#### 10. Health — Concept Answer

```json
{
  "id": "hbh-thyroid-iodine",
  "type": "knowledge",
  "quiz_question": "What mineral deficiency is the world's leading preventable cause of intellectual disability?",
  "correct_answer": "Iodine deficiency",
  "acceptable_answers": null,
  "category_l1": "human_body_health",
  "category_l2": "anatomy_organs",
  "difficulty": 3,
  "rarity": "uncommon",
  "fun_score": 7.8,
  "explanation": "Iodine deficiency — preventing the thyroid from making its hormones — affects hundreds of millions of people globally.",
  "source_name": "Wikipedia"
}
```

---

## Quiz Mechanics

### How a Fact Becomes a Question

```
Player charges a card
       │
       ▼
┌─────────────────────────┐
│ 1. SELECT FACT           │  Anki three-queue system:
│    curatedFactSelector   │  learning (due) → reviews+new → ahead learning
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. SELECT TEMPLATE       │  Filtered by mastery level + answer pool,
│    questionTemplateSelector│ weighted by difficulty match & variety
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. SELECT DISTRACTORS    │  Pool-based, confusion-weighted,
│    curatedDistractorSelector│ mastery-adaptive count (2-4)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. SHUFFLE & DISPLAY     │  Fisher-Yates shuffle, timed quiz
│    quizService           │  Timer: 10-30s (floor-based)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 5. GRADE & UPDATE        │  SM-2 spaced repetition +
│    sm2 + confusionMatrix │  confusion matrix + in-run tracker
└─────────────────────────┘
```

### Question Variants

A single fact can be asked in multiple ways. Variants unlock as card mastery increases:

| Variant Type | Example (Barbarossa fact) | Available From |
|---|---|---|
| **forward** | "How many troops did Hitler commit to Barbarossa?" → `3 million` | Mastery 0 |
| **reverse** | "Which operation used 3 million troops in 1941?" → `Operation Barbarossa` | Mastery 2 |
| **context** | "Barbarossa was driven by what ideology?" → `Lebensraum` | Mastery 2 |
| **fill_blank** | "Barbarossa began on June 22, ____." → `1941` | Mastery 1 |
| **true_false** | "T/F: Barbarossa violated the Molotov-Ribbentrop pact" → `True` | Mastery 1 |

For **vocabulary** decks, the template system provides additional progression:

| Template | Example (Japanese) | Mastery |
|---|---|---|
| **forward** | "What does '～円' mean?" → `Yen` | 0+ |
| **reading** | "What is the reading of '～円'?" → `～えん` | 1+ |
| **reverse** | "How do you say 'Yen' in Japanese?" → `～円` | 2+ |
| **synonym_pick** | "Which word is closest in meaning to '～円'?" | 3+ |
| **definition_match** | "～円 (～えん) — Yen. Part of speech: word." → pick answer | 3+ |

### Answer Variants & Acceptable Alternatives

Each fact defines:
- **`correctAnswer`**: The canonical answer displayed and graded against
- **`acceptableAlternatives`**: Synonyms that are also correct (e.g., `"8"` and `"eight"`, or `"Node.js"` and `"NodeJS"`)

Per-variant answers can differ from the base fact. A reverse variant for `ha_skel_003` asks "Which ear ossicle is ~3mm?" — the answer is still `"Stapes"`, but a context variant on the Barbarossa fact changes the answer to `"Lebensraum"`.

### Numerical Brace Markers

Answers like `"{135} species"` or `"{4} million sq km"` use brace markers (`{N}`) to signal the runtime distractor generator:
- Display answer: `"135 species"` (braces stripped)
- Auto-generated numerical distractors: nearby plausible numbers (e.g., 100, 120, 150, 180)
- This avoids needing hand-written numerical distractors for every fact

### Distractor Selection (Curated Decks)

Distractors are **not random**. They are selected from the fact's **answer type pool** (e.g., all bone names, all English meanings) using a priority scoring system:

| Priority | Source | Score Bonus | Purpose |
|---|---|---|---|
| 1 | **Confusion matrix hits** | +10.0 × count | Player's personal weak spots |
| 2 | **Reverse confusions** | +5.0 × count | Facts this was wrongly chosen for |
| 3 | **In-run struggles** | +3.0 | Session-specific difficulty |
| 4 | **Part-of-speech match** (vocab) | +4.0 | "to eat" gets verb distractors, not nouns |
| 5 | **Difficulty similarity** | +2.0 | Same difficulty band (±1) |
| 6 | **Random jitter** | 0–0.5 | Prevents identical distractor sets |

**Safety rails:**
- **Synonym group exclusion**: If "delicious" and "tasty" are synonyms, one is never a distractor for the other
- **Answer deduplication**: No distractor matches the correct answer (case-insensitive)
- **Question-mention exclusion**: If the question says "Besides Saturn...", Saturn is excluded from choices

**Distractor count scales with mastery:**

| Card Mastery | Distractors | Total Choices |
|---|---|---|
| 0 | 2 | 3 |
| 1–2 | 3 | 4 |
| 3–5 | 4 | 5 |

### Confusion Matrix

The confusion matrix is a **persistent, per-player** record of which facts a player confuses with each other. It survives across runs.

```
Player is asked: "What is the smallest bone?"
Correct answer:  Stapes
Player chose:    Malleus
                    │
                    ▼
Confusion matrix records: (Stapes, Malleus, count: 1)
                    │
                    ▼
Next time "Stapes" is the correct answer:
  → Malleus gets +10.0 priority as a distractor
  → Player MUST confront the exact pair they confused
```

This creates a **personalized difficulty curve** — the game drills exactly where each player is weakest. Over multiple runs, the confusion matrix builds a map of a player's knowledge gaps.

**Data structure:**
```typescript
interface ConfusionEntry {
  targetFactId: string    // What was correct
  confusedFactId: string  // What the player picked
  count: number           // How many times
  lastOccurred: number    // Timestamp
}
```

### Curated vs Trivia: Key Differences

| Feature | Curated Decks | Trivia DB |
|---|---|---|
| Storage | JSON files in `data/decks/` | SQLite `public/facts.db` |
| Answer pools | Yes — grouped by answer type | No |
| Synonym groups | Yes — prevents unfair distractors | No |
| Question templates | Yes — mastery-progressive | No |
| Question variants | Yes — forward, reverse, context, fill_blank, true_false | No |
| Confusion matrix | Yes — personalizes distractors | No |
| Distractor source | Pool-based + confusion-weighted | Pre-generated only |
| Spaced repetition | Full SM-2 with in-run Anki queues | Basic SM-2 |

### SM-2 Spaced Repetition

Every fact answer updates the player's long-term memory model:

- **Correct**: Interval increases (1d → 4d → 10d → 25d → ...), ease factor +0.15
- **Wrong**: Card lapses, re-enters learning queue, ease factor −0.20
- **8+ lapses**: Card becomes a "leech" (suspended — the player genuinely can't learn it)
- **Mastered**: Interval ≥ 60 days (knowledge) or ≥ 40 days (vocabulary)

The in-run tracker uses a separate Anki-style step machine:
- Learning steps: [2 charges, 5 charges] → graduated (10-charge cooldown)
- Wrong answer at any point → reset to step 0
- Max 8 cards in learning simultaneously (prevents overwhelm)

# Quiz Quality Report — BATCH-2026-04-01-001
**Tester**: Quiz Quality | **Model**: claude-sonnet-4-6 | **Domain**: general_knowledge + language | **Encounters**: 6 (combat-basic, combat-scholar, combat-all-chains, combat-elite, combat-relic-heavy, combat-boss)

## Verdict: ISSUES

---

## Summary
- Total quizzes captured: 25 unique
- Unique questions: 25
- Domains represented: general_knowledge, language/fr (French), language/es (Spanish), language/cs (Czech), language/nl (Dutch), language/zh (Chinese/Mandarin), language/ja (Japanese — JLPT + kanji), language/ko (Korean), language/de (German)
- Scenarios played: 6 combat scenarios across floor 1
- Fact repetition observed: `general_knowledge-keyboard-replaced-punched-cards` appeared 6 times in a single 10-card hand (combat-scholar), and was present in every scenario loaded

---

## Objective Findings

| Check | Result | Pass/Fail Count | Notes |
|-------|--------|-----------------|-------|
| O-QZ1 | Choice count (3+) | 25/25 PASS | All quizzes had exactly 4 choices |
| O-QZ2 | No duplicate choices | 25/25 PASS | No identical choices within any quiz |
| O-QZ3 | No data artifacts | 24/25 — 1 ISSUE | Korean quiz (ko-nikl-80) had distractor `"g/k"` which looks like a romanization artifact, not a plausible Korean meaning |
| O-QZ4 | Question completeness | 25/25 PASS | All questions were non-empty |
| O-QZ5 | Question length (20-300 chars) | 25/25 PASS | All within range |
| O-QZ6 | Correct index in bounds | 25/25 PASS | All correctIndex values valid (0-3) |
| O-QZ7 | No near-duplicate choices | 25/25 PASS | No choices with >90% similarity |
| O-QZ8 | Domain coverage (2+ domains) | PASS | 9 distinct language/domain areas represented |

### Bonus Objective Finding — Brace Markers in factAnswer
The `hand` data (from `getCombatState()`) exposes raw factAnswer values with numeric brace markers:
- `"About {13} million"` (fact: general_knowledge-wikipedia-edits-per-second)
- `"{1990}"` (fact: general_knowledge-web-browser-invention-date)
- `"{405} AD"` (fact: general_knowledge-armenian-alphabet)

These brace markers do NOT appear in the quiz display (previewCardQuiz renders them correctly as plain values). However their presence in the raw hand data could be a concern if any UI surfaces `factAnswer` directly.

---

## Subjective Assessments

| Check | Rating (1-5) | Examples | Issues |
|-------|-------------|---------|--------|
| S-QZ1 | Distractor plausibility | 3/5 | Most distractors are plausible. French vocab distractors are generally good (e.g., "pub, tavern / appearance / flame / tearful" for *allure*). However language cognate questions have trivially weak distractors (see S-QZ3 issue). Japanese kanji distractors like "to get stuck with (some job)" for '未' feel oddly specific vs. the simpler correct answer "un-, not yet." Korean distractor `"g/k"` is clearly broken. |
| S-QZ2 | Question clarity | 4/5 | Questions are generally clear and unambiguous. The Wikipedia edits question ("per month as of April 2024") is well-scoped. One concern: "Which medical application field uses nanotechnology to treat disease?" — the correct answer *Nanomedicine* is effectively embedded in the question topic, making it too guessable. |
| S-QZ3 | Answer correctness | 4/5 | All verified answers appear factually correct. One borderline concern: "In what year was the web browser first invented? — 1990" is correct for Tim Berners-Lee's WorldWideWeb browser, but could be argued as 1993 (Mosaic) for popular use. Context-dependent. The Armenian alphabet date (405 AD) is correct. |
| S-QZ4 | Difficulty appropriateness | 3/5 | Cognate language questions are far too easy for floor 1: Czech "ironie"→"irony", German "Argument"→"argument", French "impérial"→"imperial" offer essentially zero challenge to English speakers. Conversely, Japanese kanji questions (卒, 未, 流) and Chinese 如同 are appropriate medium difficulty. General knowledge questions are well-calibrated. |
| S-QZ5 | Cultural bias | 3/5 | Language content is heavily European-language dominant (French appears 5+ times, German, Dutch, Czech, Spanish). Asian language content exists (Japanese, Chinese, Korean) but is proportionally smaller. General knowledge questions skew toward technology/computing topics (keyboard history, Android, compiler, JavaScript, web browser) suggesting a possible content pool imbalance toward tech facts. |

---

## Issues Found

### CRITICAL
None.

### HIGH

**H-1: Extreme fact repetition in deck pools**
`general_knowledge-keyboard-replaced-punched-cards` appeared 6 times in a single 10-card hand (combat-scholar scenario), and recurred across every scenario loaded. This is not the Anki learning algorithm at work (that governs _quiz frequency_, not _card draw_) — this indicates the deck pool for the default scenario is extremely small, or this fact is being heavily over-weighted in card assignment. A player seeing the same question 6 times in one combat turn is a severe engagement and educational quality failure.
- **File to check**: `src/services/` — card-fact assignment logic, specifically how facts are drawn into the deck for a scenario
- **Severity**: Breaks the core promise that "every card is a fact" — it's effectively one fact repeated

**H-2: Trivial cognate language questions undermine difficulty**
Multiple language questions pair a word with its near-identical English cognate as the correct answer, with clearly non-cognate distractors:
- Czech `"ironie"` → `"irony"` (the other choices: "pear", "unreal", "ball")
- German `"Argument"` → `"argument"` (other choices: "planned", "shocked", "birthday person")
- French `"impérial"` → `"imperial"` (other choices: "to monopolize", "demand", "worrying, concerning")

Any English speaker can answer these with zero knowledge of the target language. This undermines the educational value and makes Charge plays trivially free 1.5x multipliers for English speakers.
- **Recommendation**: Filter questions where Levenshtein distance between question word and correct answer is <3 characters, or add a cognate difficulty flag.

### MEDIUM

**M-1: Korean distractor artifact — `"g/k"`**
In `ko-nikl-80` ("겨울" → "winter"), one of the distractors is `"g/k"`. This is not a plausible Korean word meaning — it appears to be a romanization/encoding artifact from deck generation.
- **Expected**: A plausible Korean-language distractor meaning (e.g., "spring", "summer", "morning")
- **File**: Korean deck source data, likely `data/decks/` or similar

**M-2: Nanotechnology question is self-answering**
"Which medical application field uses nanotechnology to treat disease?" with correct answer "Nanomedicine" — the word *nano* in both question and answer makes this trivially guessable even without prior knowledge. The distractor choices (Biochemistry, Pharmacology, Radiotherapy) are all legitimate fields but the question telegraphs the answer.

**M-3: factAnswer brace markers in raw hand data**
`getCombatState().hand[n].factAnswer` returns values like `"About {13} million"` and `"{1990}"`. While these render correctly in quiz UI, any code path that surfaces `factAnswer` directly to the player (e.g., post-answer reveal, study cards, tooltips) would show the raw brace notation. Should be stripped/resolved at the data layer.
- **Fact IDs affected**: `general_knowledge-wikipedia-edits-per-second`, `general_knowledge-web-browser-invention-date`, `general_knowledge-armenian-alphabet`

### LOW

**L-1: Japanese kanji distractor phrasing mismatch**
For `'未'` (un-, not yet), distractor `"to get stuck with (some job)"` is oddly specific and verbose compared to the other choices and the correct answer. Distractors should match the form and register of the correct answer — "not yet" vs "to get stuck with (some job)" are very different grammatical forms.

**L-2: Tech-topic concentration in general_knowledge pool**
Of the 8 unique general_knowledge facts encountered across 6 scenarios, 5 are computing/technology topics (keyboard, Android, compiler, JavaScript, web browser). This suggests the default pool draws heavily from a tech-knowledge subdomain. Players without tech backgrounds may find this unfair; players wanting broad general knowledge may feel under-served.

**L-3: French heavily over-represented in language pool**
French appeared in 5+ unique fact IDs across the session (fr-cefr-728, fr-cefr-3014, fr-cefr-3042, fr-cefr-4816, fr-cefr-832, fr-cefr-488). No other language appeared more than twice. This may be intentional (French deck prominence) but warrants a domain diversity review.

---

## Raw Quiz Data

```json
[
  {
    "factId": "general_knowledge-keyboard-replaced-punched-cards",
    "domain": "general_knowledge",
    "question": "What obsolete technology did computer keyboards replace for inputting data?",
    "choices": ["Light pens", "Punched cards", "Toggle switches", "Morse code taps"],
    "correctAnswer": "Punched cards",
    "correctIndex": 1,
    "cardType": "attack"
  },
  {
    "factId": "general_knowledge-android-tv-wear-automotive",
    "domain": "general_knowledge",
    "question": "Which Android variant is designed specifically for in-car systems?",
    "choices": ["Android Automotive", "Wear OS", "Android Auto", "Android Vehicle"],
    "correctAnswer": "Android Automotive",
    "correctIndex": 0,
    "cardType": "attack"
  },
  {
    "factId": "art_architecture-alhambra-columbus-endorsement",
    "domain": "art_architecture",
    "question": "Where did Christopher Columbus receive royal approval for his first voyage in 1492?",
    "choices": ["Madrid Royal Palace", "Versailles Palace", "Toledo Castle", "The Alhambra"],
    "correctAnswer": "The Alhambra",
    "correctIndex": 3,
    "cardType": "attack"
  },
  {
    "factId": "es-cefr-456",
    "domain": "language",
    "question": "What does \"dinero\" mean?",
    "choices": ["publication", "money", "to reuse", "biennial"],
    "correctAnswer": "money",
    "correctIndex": 1,
    "cardType": "shield"
  },
  {
    "factId": "cs-freq-3002",
    "domain": "language",
    "question": "What does \"polský\" mean?",
    "choices": ["Polish", "to return", "to chat", "handshake"],
    "correctAnswer": "Polish",
    "correctIndex": 0,
    "cardType": "shield"
  },
  {
    "factId": "fr-cefr-728",
    "domain": "language",
    "question": "What does \"rien\" mean?",
    "choices": ["horseman", "to concern", "inspector", "nothing"],
    "correctAnswer": "nothing",
    "correctIndex": 3,
    "cardType": "attack"
  },
  {
    "factId": "general_knowledge-wikipedia-edits-per-second",
    "domain": "general_knowledge",
    "question": "How many edits does Wikipedia receive per month as of April 2024?",
    "choices": ["About 15 million", "About 17 million", "About 13 million", "About 11 million"],
    "correctAnswer": "About 13 million",
    "correctIndex": 2,
    "cardType": "utility",
    "note": "factAnswer in hand shows raw brace marker: 'About {13} million'"
  },
  {
    "factId": "general_knowledge-compiler-translate-code",
    "domain": "general_knowledge",
    "question": "What does a compiler translate source code into?",
    "choices": ["Machine code", "Binary images", "Spreadsheet values", "Web pages"],
    "correctAnswer": "Machine code",
    "correctIndex": 0,
    "cardType": "attack"
  },
  {
    "factId": "fr-cefr-3014",
    "domain": "language",
    "question": "What does \"allure\" mean?",
    "choices": ["pub, tavern", "appearance", "flame", "tearful, grief-stricken"],
    "correctAnswer": "appearance",
    "correctIndex": 1,
    "cardType": "shield"
  },
  {
    "factId": "zh-hsk-3485",
    "domain": "language",
    "question": "What does \"如同\" (rú tóng) mean?",
    "choices": ["like", "in the end", "romantic", "to rescue"],
    "correctAnswer": "like",
    "correctIndex": 0,
    "cardType": "shield"
  },
  {
    "factId": "fr-cefr-3042",
    "domain": "language",
    "question": "What does \"amical\" mean?",
    "choices": ["friendly", "parsley", "crime", "picnic"],
    "correctAnswer": "friendly",
    "correctIndex": 0,
    "cardType": "attack"
  },
  {
    "factId": "nl-cefr-683",
    "domain": "language",
    "question": "What does \"rechts\" mean?",
    "choices": ["different", "big, large", "right", "in love"],
    "correctAnswer": "right",
    "correctIndex": 2,
    "cardType": "attack"
  },
  {
    "factId": "general_knowledge-web-browser-invention-date",
    "domain": "general_knowledge",
    "question": "In what year was the web browser first invented?",
    "choices": ["1970", "2011", "2001", "1990"],
    "correctAnswer": "1990",
    "correctIndex": 3,
    "cardType": "attack",
    "note": "factAnswer in hand shows raw brace marker: '{1990}'"
  },
  {
    "factId": "ja-jlpt-5542",
    "domain": "language",
    "question": "What does \"縁談\" (えんだん) mean?",
    "choices": ["graceful", "document", "express", "marriage proposal"],
    "correctAnswer": "marriage proposal",
    "correctIndex": 3,
    "cardType": "shield"
  },
  {
    "factId": "fr-cefr-488",
    "domain": "language",
    "question": "What does \"maître\" mean?",
    "choices": ["master", "constraint", "advertisement", "reservation"],
    "correctAnswer": "master",
    "correctIndex": 0,
    "cardType": "attack"
  },
  {
    "factId": "general_knowledge-armenian-alphabet",
    "domain": "general_knowledge",
    "question": "In what year was the Armenian alphabet introduced by Mesrop Mashtots?",
    "choices": ["260 AD", "510 AD", "590 AD", "405 AD"],
    "correctAnswer": "405 AD",
    "correctIndex": 3,
    "cardType": "attack",
    "note": "factAnswer in hand shows raw brace marker: '{405} AD'"
  },
  {
    "factId": "fr-cefr-4816",
    "domain": "language",
    "question": "What does \"impérial\" mean?",
    "choices": ["to monopolize", "imperial", "demand", "worrying, concerning"],
    "correctAnswer": "imperial",
    "correctIndex": 1,
    "cardType": "shield",
    "note": "HIGH issue: cognate question — trivially easy for English speakers"
  },
  {
    "factId": "de-cefr-2242",
    "domain": "language",
    "question": "What does \"Argument\" mean?",
    "choices": ["planned", "shocked", "birthday person", "argument"],
    "correctAnswer": "argument",
    "correctIndex": 3,
    "cardType": "attack",
    "note": "HIGH issue: cognate question — trivially easy for English speakers"
  },
  {
    "factId": "ko-nikl-80",
    "domain": "language",
    "question": "What does \"겨울\" mean?",
    "choices": ["cross over", "g/k", "winter", "meaning"],
    "correctAnswer": "winter",
    "correctIndex": 2,
    "cardType": "attack",
    "note": "MEDIUM issue: 'g/k' is a data artifact, not a plausible distractor"
  },
  {
    "factId": "fr-cefr-832",
    "domain": "language",
    "question": "What does \"terrasse\" mean?",
    "choices": ["socket", "action", "terrace", "interpreter"],
    "correctAnswer": "terrace",
    "correctIndex": 2,
    "cardType": "shield"
  },
  {
    "factId": "general_knowledge-nation-modern-construct",
    "domain": "general_knowledge",
    "question": "When did nationalism first become a prominent political ideology, according to scholars?",
    "choices": ["The Renaissance", "Late 18th century", "Ancient Greece", "Early 15th century"],
    "correctAnswer": "Late 18th century",
    "correctIndex": 1,
    "cardType": "attack"
  },
  {
    "factId": "ja-kanji-n3-078",
    "domain": "language",
    "question": "What does the kanji '卒' mean?",
    "choices": ["box", "to set up", "graduate, soldier", "to take (someone) with one"],
    "correctAnswer": "graduate, soldier",
    "correctIndex": 2,
    "cardType": "attack"
  },
  {
    "factId": "ja-kanji-n3-251",
    "domain": "language",
    "question": "What does the kanji '未' mean?",
    "choices": ["swimming", "to feel", "to get stuck with (some job)", "un-, not yet"],
    "correctAnswer": "un-, not yet",
    "correctIndex": 3,
    "cardType": "attack",
    "note": "LOW issue: distractor 'to get stuck with (some job)' is verbosely phrased vs. the terse correct answer"
  },
  {
    "factId": "cs-freq-2435",
    "domain": "language",
    "question": "What does \"ironie\" mean?",
    "choices": ["pear", "irony", "unreal", "ball"],
    "correctAnswer": "irony",
    "correctIndex": 1,
    "cardType": "attack",
    "note": "HIGH issue: cognate question — trivially easy for English speakers"
  },
  {
    "factId": "general_knowledge-nanotechnology-nanomedicine",
    "domain": "general_knowledge",
    "question": "Which medical application field uses nanotechnology to treat disease?",
    "choices": ["Biochemistry", "Pharmacology", "Radiotherapy", "Nanomedicine"],
    "correctAnswer": "Nanomedicine",
    "correctIndex": 3,
    "cardType": "attack",
    "note": "MEDIUM issue: answer is self-telegraphed by the word 'nano' in the question"
  },
  {
    "factId": "ja-kanji-n3-300",
    "domain": "language",
    "question": "What does the kanji '流' mean?",
    "choices": ["bar", "current, a sink", "promise", "to visit"],
    "correctAnswer": "current, a sink",
    "correctIndex": 1,
    "cardType": "shield"
  },
  {
    "factId": "general_knowledge-javascript-created-10-days",
    "domain": "general_knowledge",
    "question": "Who created the JavaScript programming language in 1995?",
    "choices": ["Brendan Eich", "Linus Torvalds", "Anders Hejlsberg", "Ken Thompson"],
    "correctAnswer": "Brendan Eich",
    "correctIndex": 0,
    "cardType": "debuff"
  }
]
```

---

## Appendix: Fact Repetition Observation

In the `combat-scholar` scenario (10-card hand), fact `general_knowledge-keyboard-replaced-punched-cards` appeared **6 times** in a single hand. The remaining 4 slots had 4 different facts. This is the single most severe quality finding: a player would answer the same question 6 times in one combat, then encounter it again in every subsequent scenario loaded. This is not the intended Anki STEP_DELAYS learning cadence — it is a pool diversity problem in the default deck composition for these scenarios.

Across all 6 scenarios, this one fact appeared in **5 of 6** combat scenario hands loaded. No other single fact appeared more than 3 times total.

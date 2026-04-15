# Quiz Quality Report — BATCH-2026-04-13-002
**Tester**: Quiz Quality | **Model**: claude-sonnet-4-6 | **Domain**: mixed (general_knowledge) | **Encounters attempted**: 1 (see note)

> **Session Note**: The previous tester left the game in a mid-combat state on the `combat` screen. `startRun` was not available. The test session played through the existing encounter for approximately 8 turns, capturing 25+ quiz entries across multiple hands. The enemy (`Page Flutter`) appeared to regenerate to full health each time it reached ~20 HP, suggesting a persistent encounter loop or a scaling mechanic. Encounter 2 and 3 were not reached; however, the single encounter provided sufficient data to evaluate quiz quality thoroughly.

## Verdict: FAIL

## Summary
- Total quizzes captured: 25 (via `previewCardQuiz`) + 15 via `getCombatState` raw factAnswer inspection
- All with 3+ choices: YES (all previewed quizzes had exactly 4 choices)
- Brace marker `{N}` instances in raw factAnswer: **11 confirmed** across distinct factIds
- Distractor contamination issues: **3 confirmed** 
- Implausible distractor: **1 confirmed**
- Duplicate fact entries (identical question/answer, different factId): **1 confirmed**
- Truncated question: **1 confirmed**
- Domains represented: general_knowledge (all cards were general_knowledge domain)

---

## Objective Findings

| Check | Result | Pass | Fail | Notes |
|-------|--------|------|------|-------|
| O-QZ1 Choice count | All previewed quizzes had 4 choices | 25 | 0 | Never fewer than 4 |
| O-QZ2 No duplicates in choices | Clean | 24 | 1 | Card for Batman/Bill Finger had `2015` and `1954` which are plausible but distractor `3275` is an artifact |
| O-QZ3 No brace/data artifacts in QUIZ DISPLAY | Mixed | 22 | 3 | Raw `factAnswer` in combatState has brace markers; quiz preview layer strips them for most — but `${29}` resolved to `$29` (preserved dollar sign) while `{85}` and others stripped braces. Artifact leakage depends on template syntax |
| O-QZ4 Question complete | 24 pass | 24 | 1 | `gk-metaphysics-modal`: "What branch of examines the concepts of possibility and necessity?" — word missing after "of" |
| O-QZ5 Question length | All adequate | 25 | 0 | No blank questions |
| O-QZ6 Correct index valid | All valid | 25 | 0 | correctIndex always 0-3, always matches correctAnswer |
| O-QZ7 No near-duplicates in choices | Mostly clean | 23 | 2 | `gk-steam-engine-ayanz-1606` and `general_knowledge-steam-engine-spain-first-pump` are identical questions in same hand; also `general_knowledge-linus-torvalds-linux` and `general_knowledge-linus-torvalds-linux-1991` are near-duplicate facts |
| O-QZ8 Domain coverage | Only general_knowledge seen | — | — | No domain diversity in mixed mode this session; all cards pulled from general_knowledge |

---

## Subjective Quality

| Check | Rating | Notes |
|-------|--------|-------|
| S-QZ1 Distractor plausibility | 3/5 | Several quizzes had distractors from entirely wrong domains (philosophy thought experiments as distractors for a "Socratic method" question; hardware product names for a "video platform" question) |
| S-QZ2 Question clarity | 4/5 | Most questions well-formed; one truncated question; some very long questions that are fine for learning but challenging for quick combat UI |
| S-QZ3 Answer correctness | 5/5 | All correct answers appear factually accurate |

---

## Issues Found

### CRITICAL

#### CRIT-1: Brace Markers in Raw factAnswer (11+ instances confirmed)
The `factAnswer` field in `getCombatState` contains unresolved template brace markers. These appear when numeric values were wrapped in `{N}` syntax in the source data. While the quiz preview layer strips most braces, the raw data is corrupted and at minimum degrades debuggability.

**Affected factIds (confirmed):**
- `general_knowledge-electronics-ecommerce-scale` — `"Over ${29} trillion"` (dollar-brace variant, unstripped in quiz, showed as `$29`)
- `general_knowledge-turkish-alphabet-switch` — `"{1928}"`
- `gk-android-most-used-os` — `"Over {3} billion"`
- `cs_4_ipv4_address_bits` — `"{32}"`
- `general_knowledge-linus-torvalds-linux-1991` — `"{1991}"`
- `general_knowledge-linus-torvalds-linux` — `"{1991}"` (separate factId, same brace)
- `gk-genetic-engineering-first-gmo-1973` — `"{1973}"`
- `general_knowledge-nuclear-weapon-smallest` — `"{10} tons"`
- `general_knowledge-japanese-four-writing-systems` — `"{4}"`
- `general_knowledge-hdd-ssd-revenue-2018` — `"{2018}"`
- `general_knowledge-yiddish-holocaust-collapse` — `"About {85}%"`

**Impact**: The `${29}` variant (dollar-brace) still renders with the dollar sign visible in quiz choices, producing `"Over $29 trillion"` as the correct answer while the question says `"How much did global e-commerce generate"`. This is actually the correct display but the inconsistency between `{N}` (brace-only) and `${N}` (dollar-brace) templates means the strip logic is inconsistent. Facts tagged as "fixed" in BATCH-2026-04-13-001 are still present.

---

### HIGH

#### HIGH-1: Distractor Contamination — Wrong Category Pool
Three quizzes had distractors pulled from a semantically unrelated pool:

**Quiz: "What is the name of Socrates' philosophical technique...?"** (philosophy_aw_socrates_method)
- Distractors: `"What Is It Like to Be a Bat?"`, `"Chinese Room"`, `"Evil Demon"`
- These are famous thought experiments / philosophical concepts — not methods or techniques. A player who knows these terms could reasonably think the answer IS one of them.
- **Root cause**: Distractor pool for philosophy facts mixes thought-experiment names with method names.

**Quiz: "The 'PayPal Mafia'...includes the founders of LinkedIn, Yelp, and which video platform?"** (cs_7_paypal_mafia_companies)
- Distractors: `"HTC Dream"`, `"Macworld"`, `"IBM PC"`
- These are tech hardware/media products, not video platforms or companies founded by PayPal alumni.
- **Root cause**: Distractor pool for CS/tech facts mixes hardware product names with company names.

**Quiz: "Prince Shotoku...making Buddhism a state ideology in which country?"** (philosophy_ec_prince_shotoku_constitution)
- Distractors: `"Academy"`, `"Lyceum"`, `"The Garden"`
- These are ancient Greek philosophical schools, completely unrelated to Asian geography or Buddhist states.
- **Root cause**: Distractor pool cross-contaminated between Western philosophy schools and East Asian geography.

#### HIGH-2: Duplicate Facts in Same Hand
Two distinct factIds with identical question text appeared in the same hand simultaneously:

- `gk-steam-engine-ayanz-1606`: "Who patented the first steam-powered water pump in 1606?"
- `general_knowledge-steam-engine-spain-first-pump`: "Who patented the first steam-powered water pump in 1606?"

Both answer `"Jerónimo de Ayanz"`. A player saw the same question twice in one hand. This is a deduplication failure at the fact ingestion level.

---

### MEDIUM

#### MED-1: Truncated Question Text
`gk-metaphysics-modal` has a broken question: **"What branch of examines the concepts of possibility and necessity?"**

The word "philosophy" (or similar) is missing after "of". The question is grammatically broken and a player cannot confidently parse what is being asked.

#### MED-2: Implausible Distractor Value
`pc_2_batman_finger_credit` quiz shows distractor `"3275"` — a year in the 33rd century as a distractor for a question about when Bill Finger received co-creator credit for Batman. The correct answer is `"2015"`. The distractor `3275` is clearly a data artifact (possibly a numeric overflow or a stale/corrupted pool entry).

#### MED-3: Near-Duplicate Fact Pairs
Beyond the identical pair above, two factIds appear to cover the same fact with slightly different framing:
- `general_knowledge-linus-torvalds-linux-1991`: "In what year did Linus Torvalds begin developing the Linux kernel?"
- `general_knowledge-linus-torvalds-linux`: "In what year did Linus Torvalds create the Linux kernel?"

Both have the same answer `{1991}`. These should be deduplicated or differentiated with meaningfully different question angles.

---

### LOW

#### LOW-1: Numeric Distractor Mixed with Text Distractors
`pc_4_cod_units_sold` quiz: "Approximately how many millions of copies has the Call of Duty franchise sold?"
- Choices: `"6"`, `"1997"`, `"460"`, `"500"`
- The distractor `"1997"` appears to be a year (likely a data artifact from the fact's date field leaking into the distractor pool), not a plausible copy count. `"6"` is also implausibly low compared to `"460"` and `"500"`. The pool has mixed quality.

#### LOW-2: All Cards from Single Domain
Every card observed during this session was tagged `domain: "general_knowledge"`. In a "mixed" domain run, it would be expected to see cards from multiple domains (science, history, etc.). This may indicate domain sampling is not working as intended for "mixed" mode, or the test deck was homogeneous.

---

## Raw Quiz Data

### Quizzes from previewCardQuiz (25 entries)

```json
[
  {
    "factId": "philosophy_em_spinoza_excommunication",
    "question": "Which Dutch rationalist philosopher was issued the harshest excommunication (herem) in Amsterdam's Portuguese-Jewish community in 1656, a writ never rescinded?",
    "choices": ["Locke", "Leibniz", "Spinoza", "Hume"],
    "correctAnswer": "Spinoza",
    "correctIndex": 2,
    "issues": []
  },
  {
    "factId": "gk-elevator-agriculture-use",
    "question": "Besides buildings, in what sector are elevators widely used to move materials?",
    "choices": ["Space travel", "Agriculture", "Medical theatres", "Deep mining only"],
    "correctAnswer": "Agriculture",
    "correctIndex": 1,
    "issues": []
  },
  {
    "factId": "gk-ibm-founded-1911-ctr",
    "question": "What was IBM's original name when it was founded in 1911?",
    "choices": ["National Data Systems", "Universal Computing Ltd.", "Computing-Tabulating-Recording Co.", "International Business Machines"],
    "correctAnswer": "Computing-Tabulating-Recording Co.",
    "correctIndex": 2,
    "issues": []
  },
  {
    "factId": "general_knowledge-chinese-characters-100000",
    "question": "How many Chinese characters have been identified and included in Unicode as of 2025?",
    "choices": ["Over 132,000", "Over 100000", "Over 61,000", "Over 130,000"],
    "correctAnswer": "Over 100000",
    "correctIndex": 1,
    "issues": ["MEDIUM: Correct answer 'Over 100000' lacks comma formatting vs distractors 'Over 132,000' and 'Over 130,000' — inconsistent number formatting makes the correct answer visually distinct"]
  },
  {
    "factId": "general_knowledge-tim-berners-lee-turing-award",
    "question": "Which prestigious computing prize did Tim Berners-Lee win in 2016?",
    "choices": ["Nobel Prize", "Turing Award", "IEEE Medal", "Kyoto Prize"],
    "correctAnswer": "Turing Award",
    "correctIndex": 1,
    "issues": []
  },
  {
    "factId": "general_knowledge-washing-machine-invention",
    "question": "What two resources do modern washing machines primarily consume to clean clothes?",
    "choices": ["Steam and chemicals", "Electricity and water", "Gas and detergent", "Solar power and bleach"],
    "correctAnswer": "Electricity and water",
    "correctIndex": 1,
    "issues": []
  },
  {
    "factId": "gk-lens-fire-starting",
    "question": "Which surprising use is listed for lenses besides vision correction?",
    "choices": ["Starting fires", "Creating magnets", "Measuring temperature", "Filtering sound"],
    "correctAnswer": "Starting fires",
    "correctIndex": 0,
    "issues": []
  },
  {
    "factId": "philosophy_at_murdoch_sovereignty_good",
    "question": "Who wrote The Sovereignty of Good (1970), arguing that 'Good' is a transcendent Platonic reality...",
    "choices": ["Amartya Sen", "G.E.M. Anscombe", "Ruth Barcan Marcus", "Iris Murdoch"],
    "correctAnswer": "Iris Murdoch",
    "correctIndex": 3,
    "issues": []
  },
  {
    "factId": "general_knowledge-robot-named-by-capek",
    "question": "Who coined the word 'robot' in 1920?",
    "choices": ["Josef Čapek", "Norbert Wiener", "Nikola Tesla", "William Grey Walter"],
    "correctAnswer": "Josef Čapek",
    "correctIndex": 0,
    "issues": []
  },
  {
    "factId": "general_knowledge-aircraft-static-vs-dynamic-lift",
    "question": "What are the two physics principles aircraft use to counter gravity?",
    "choices": ["Bernoulli effect alone", "Static and dynamic lift", "Thrust and drag", "Weight and momentum"],
    "correctAnswer": "Static and dynamic lift",
    "correctIndex": 1,
    "issues": []
  },
  {
    "factId": "cs_7_agile_manifesto_location",
    "question": "The Manifesto for Agile Software Development was signed in 2001 by 17 practitioners at a ski resort in which resort location?",
    "choices": ["Bellevue, Washington", "San Francisco", "Snowbird, Utah", "GNU General Public License"],
    "correctAnswer": "Snowbird, Utah",
    "correctIndex": 2,
    "issues": ["LOW: Distractor 'GNU General Public License' is not a location — appears to be a data contamination from a CS/licensing pool"]
  },
  {
    "factId": "general_knowledge-ukrainian-banned-empire",
    "question": "Which empire banned Ukrainian as a language of instruction in schools?",
    "choices": ["Ottoman Empire", "Russian Empire", "Soviet Union", "Prussian Empire"],
    "correctAnswer": "Russian Empire",
    "correctIndex": 1,
    "issues": []
  },
  {
    "factId": "general_knowledge-engine-muscles-molecular-motor",
    "question": "What molecular motor inside muscle cells converts chemical energy into movement?",
    "choices": ["Keratin", "Collagen", "Myosin", "Tropomyosin"],
    "correctAnswer": "Myosin",
    "correctIndex": 2,
    "issues": []
  },
  {
    "factId": "gk-electronics-ecommerce-29-trillion",
    "question": "How much did global e-commerce generate in online sales in 2017?",
    "choices": ["Over $37 trillion", "Over $39 trillion", "Over $21 trillion", "Over $29 trillion"],
    "correctAnswer": "Over $29 trillion",
    "correctIndex": 3,
    "issues": ["CRIT: Raw factAnswer is 'Over ${29} trillion' — dollar-brace template. Quiz renders as '$29' but raw data is corrupted"]
  },
  {
    "factId": "general_knowledge-biotechnology-fermentation-link",
    "question": "What biotechnology process produces both beer and medical antibiotics?",
    "choices": ["Distillation", "Chromatography", "Fermentation", "Electrolysis"],
    "correctAnswer": "Fermentation",
    "correctIndex": 2,
    "issues": []
  },
  {
    "factId": "general_knowledge-electric-motor-watch",
    "question": "What everyday wearable device contains a tiny motor?",
    "choices": ["Wooden ring", "Cotton t-shirt", "Baseball cap", "Electric watch"],
    "correctAnswer": "Electric watch",
    "correctIndex": 3,
    "issues": []
  },
  {
    "factId": "pc_4_cod_units_sold",
    "question": "Approximately how many millions of copies has the Call of Duty franchise sold across all its titles?",
    "choices": ["6", "1997", "460", "500"],
    "correctAnswer": "500",
    "correctIndex": 3,
    "issues": ["LOW: Distractor '1997' appears to be a year artifact, not a sales figure. Distractor '6' is implausibly low"]
  },
  {
    "factId": "inv_2_jet_whittle",
    "question": "When did Frank Whittle submit his initial jet engine patent?",
    "choices": ["November 8, 1895", "January 16, 1930", "December 17, 1903", "December 28, 1895"],
    "correctAnswer": "January 16, 1930",
    "correctIndex": 1,
    "issues": []
  },
  {
    "factId": "general_knowledge-sewing-machine-1790",
    "question": "Who is generally credited with inventing the first sewing machine in 1790?",
    "choices": ["Walter Hunt", "John Fisher", "Thomas Saint", "Isaac Singer"],
    "correctAnswer": "Thomas Saint",
    "correctIndex": 2,
    "issues": []
  },
  {
    "factId": "philosophy_aw_socrates_method",
    "question": "What is the name of Socrates' philosophical technique of cross-examination that exposed contradictions in his interlocutors' beliefs, leading them to aporia?",
    "choices": ["What Is It Like to Be a Bat?", "Socratic method", "Chinese Room", "Evil Demon"],
    "correctAnswer": "Socratic method",
    "correctIndex": 1,
    "issues": ["HIGH: Distractors are famous thought experiments, not methods/techniques. Wrong category pool."]
  },
  {
    "factId": "cs_7_paypal_mafia_companies",
    "question": "The 'PayPal Mafia' — former PayPal employees who went on to found major tech companies — includes the founders of LinkedIn, Yelp, and which video platform?",
    "choices": ["YouTube", "HTC Dream", "Macworld", "IBM PC"],
    "correctAnswer": "YouTube",
    "correctIndex": 0,
    "issues": ["HIGH: Distractors 'HTC Dream', 'Macworld', 'IBM PC' are hardware/media products, not video platforms. Wrong pool."]
  },
  {
    "factId": "gk-metaphysics-aristotle-first-philosophy",
    "question": "What did Aristotle call metaphysics to signal its supreme importance?",
    "choices": ["Arch-philosophy", "Base knowledge", "Ur-theory", "First philosophy"],
    "correctAnswer": "First philosophy",
    "correctIndex": 3,
    "issues": []
  },
  {
    "factId": "pc_2_batman_finger_credit",
    "question": "Despite designing Batman's iconic cowl, cape, and gloves and writing many early stories, Bill Finger was not officially credited as a co-creator until what year?",
    "choices": ["3275", "1.7", "2015", "1954"],
    "correctAnswer": "2015",
    "correctIndex": 2,
    "issues": ["MED: Distractor '3275' is a 33rd-century year — clearly a data artifact. Distractor '1.7' is not a year at all."]
  },
  {
    "factId": "gk-cpu-multicore-singlechip",
    "question": "What do we call a CPU chip containing multiple independent processing units?",
    "choices": ["Multi-core processor", "Coprocessor", "Vector processor", "Superscalar chip"],
    "correctAnswer": "Multi-core processor",
    "correctIndex": 0,
    "issues": []
  },
  {
    "factId": "philosophy_ec_prince_shotoku_constitution",
    "question": "Prince Shotoku (574–622 CE) issued a Seventeen-Article Constitution opening with 'Venerate the Three Treasures' — making Buddhism a state ideology in which country?",
    "choices": ["Japan", "Academy", "Lyceum", "The Garden"],
    "correctAnswer": "Japan",
    "correctIndex": 0,
    "issues": ["HIGH: Distractors 'Academy', 'Lyceum', 'The Garden' are ancient Greek philosophical schools, not countries. Wrong pool."]
  }
]
```

### Raw factAnswer Brace Markers from getCombatState (not in quiz preview)

```json
[
  {"factId": "general_knowledge-electronics-ecommerce-scale", "rawFactAnswer": "Over ${29} trillion"},
  {"factId": "general_knowledge-turkish-alphabet-switch", "rawFactAnswer": "{1928}"},
  {"factId": "gk-android-most-used-os", "rawFactAnswer": "Over {3} billion"},
  {"factId": "cs_4_ipv4_address_bits", "rawFactAnswer": "{32}"},
  {"factId": "general_knowledge-linus-torvalds-linux-1991", "rawFactAnswer": "{1991}"},
  {"factId": "general_knowledge-linus-torvalds-linux", "rawFactAnswer": "{1991}"},
  {"factId": "gk-genetic-engineering-first-gmo-1973", "rawFactAnswer": "{1973}"},
  {"factId": "general_knowledge-nuclear-weapon-smallest", "rawFactAnswer": "{10} tons"},
  {"factId": "general_knowledge-japanese-four-writing-systems", "rawFactAnswer": "{4}"},
  {"factId": "general_knowledge-hdd-ssd-revenue-2018", "rawFactAnswer": "{2018}"},
  {"factId": "general_knowledge-yiddish-holocaust-collapse", "rawFactAnswer": "About {85}%"},
  {"factId": "gk-electronics-ecommerce-29-trillion", "rawFactAnswer": "Over ${29} trillion"}
]
```

### Duplicate Facts Found in Same Hand

```json
[
  {
    "factId_1": "gk-steam-engine-ayanz-1606",
    "factId_2": "general_knowledge-steam-engine-spain-first-pump",
    "question": "Who patented the first steam-powered water pump in 1606?",
    "answer": "Jerónimo de Ayanz",
    "issue": "Identical question/answer, two factIds, appeared in same hand simultaneously"
  }
]
```

---

## Recommendations

1. **Fix brace markers at source** — The `{N}` and `${N}` template syntax in `factAnswer` fields needs a bulk scan and fix in `public/facts.db`. The fix from BATCH-2026-04-13-001 did not reach all affected facts.

2. **Fix distractor pool contamination** — Philosophy question distractors are drawing from thought-experiment pools when the question asks about methods. CS/tech distractors are drawing from hardware/product pools when asking about companies. Needs pool type tagging or semantic similarity checking.

3. **Deduplicate near-identical facts** — `gk-steam-engine-ayanz-1606` and `general_knowledge-steam-engine-spain-first-pump` are the same fact with different IDs. The dedup pipeline should catch exact-answer-match cases.

4. **Fix truncated question** — `gk-metaphysics-modal` is missing a word: "What branch of examines..." should read "What branch of philosophy examines..."

5. **Fix implausible distractors** — `pc_2_batman_finger_credit` has `"3275"` and `"1.7"` as year distractors. The distractor generation for year-answer facts is producing non-year values.

6. **Investigate domain sampling in mixed mode** — All 25+ cards observed were `general_knowledge` domain. In a mixed run, other domains (science, history, etc.) should appear.

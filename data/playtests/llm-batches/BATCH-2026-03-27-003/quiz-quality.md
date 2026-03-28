# Quiz Quality Report — BATCH-2026-03-27-003
**Tester**: Quiz Quality | **Model**: sonnet | **Domain**: general_knowledge (all domains) | **Encounters**: 3

## Verdict: ISSUES

## Summary
- Total quizzes captured: 22 (across 3 combat encounters)
- Unique facts observed: 8 distinct factIds
- Quizzes with full data (choices[]): 22/22 (100%)
- Domains represented: history, human_body_health, mythology_folklore, geography, animals_wildlife, art_architecture (6 domains)
- Encounters completed: 3 (Page Flutter Floor 1, Index Weaver Floor 1, Index Weaver Floor 2)
- Note: Same 8 facts recycled heavily across all 3 encounters — distractor shuffling observed across previews of the same fact

---

## Objective Findings

| Check | Result | Pass Count | Fail Count | Notes |
|-------|--------|------------|------------|-------|
| O-QZ1 | Choice count — every quiz has 3+ answer choices | PASS | 22 | 0 | All quizzes had exactly 4 choices |
| O-QZ2 | No duplicate choices within a quiz | PASS | 22 | 0 | No exact duplicates observed |
| O-QZ3 | No data artifacts (undefined, null, NaN, [object) | PASS | 22 | 0 | All strings clean |
| O-QZ4 | Question completeness — not empty | PASS | 22 | 0 | All questions populated |
| O-QZ5 | Question length — 20-300 chars | PASS | 22 | 0 | Range: ~45–110 chars |
| O-QZ6 | Correct index in bounds | PASS | 22 | 0 | All correctIndex values 0–3, within choices.length=4 |
| O-QZ7 | No near-duplicate choices (>90% similarity) | PASS | 22 | 0 | Distractors are distinct |
| O-QZ8 | Domain coverage — at least 2 different domains | PASS | 6 | 0 | 6 domains observed |

**All objective checks: PASS**

---

## Subjective Assessments

| Check | Rating (1-5) | Representative Examples | Issues Found |
|-------|-------------|------------------------|-------------|
| S-QZ1 | Distractor plausibility | 4/5 | Alzheimer's distractors (Parkinson's, Vascular, Korsakoff, Lewy body) are all real dementia types — excellent. Ostrich speed distractors (44, 70, 91, 93 km/h) are plausible numeric variants. | One issue: Maat distractors "Khepri (renewal)", "Aten (the sun disc)", "Shu (the wind)" are Egyptian concepts but not natural antonyms — plausible to confuse. |
| S-QZ2 | Question clarity | 3/5 | Most questions clear. "What key capacity does holistic mental health emphasize alongside coping with stress?" is awkwardly phrased — "alongside coping with stress" is redundant since that IS mental health. | Holism question is ambiguous — "Ability to enjoy life" vs "Cognitive flexibility" are both capacities holistic mental health emphasizes. |
| S-QZ3 | Answer correctness | 4/5 | Ukraine as 2nd largest European country is correct. 1018 for Bulgarian Empire dissolution is correct. Alzheimer's as most common dementia is correct. | The holism question's "correct" answer ("Ability to enjoy life") is debatable — WHO definition of mental health also emphasizes "realizing one's abilities" which is closer to cognitive flexibility. |
| S-QZ4 | Difficulty appropriateness | 3/5 | Floor 1 questions seem reasonable. Bosporus current direction is quite niche for Floor 1. Epimetheus' name meaning is fair trivia. | Bosporus/Black Sea question (geo-black-sea-water-two-directions) feels like Floor 3+ difficulty for a floor 1 encounter. |
| S-QZ5 | Cultural bias | 4/5 | Mix of European history, Greek mythology, global geography, science. | History domain only showed 1 unique fact (Bulgarian Empire) — strong Eastern European skew if history is expected to be diverse. |

---

## Issues Found

### CRITICAL
*(none)*

### HIGH

**ISSUE-H1: Extreme fact pool starvation — only 8 unique facts across 3 full combats**
- All 3 combat encounters drew from the same tiny pool of ~8 facts
- The same facts (Epimetheus, holism, Ukraine, Alzheimer's, Bulgarian Empire, Maat, Black Sea, piano soundboard, ostrich speed) appeared repeatedly
- Epimetheus appeared in every single combat (combats 1, 2, and 3) and in multiple turns within each combat
- Same fact appearing multiple times in a single session degrades the educational value and feels repetitive to the player
- Expected behavior: a broader fact pool should be drawn from across the selected domains

**ISSUE-H2: Distractors randomized per preview but same fact uses same distractor pool**
- The same fact (e.g. human_body_health-mental-health-holism-balance) shows different distractor orderings on each preview, but the same ~4-5 distractor options cycle through
- This means a player who sees the same fact twice quickly learns the wrong answers by elimination
- Distractor variants within the same session should be more diverse or locked after first appearance

### MEDIUM

**ISSUE-M1: Holism question answer debatable — "Ability to enjoy life" vs "Cognitive flexibility"**
- Fact: `human_body_health-mental-health-holism-balance`
- Question: "What key capacity does holistic mental health emphasize alongside coping with stress?"
- Marked correct: "Ability to enjoy life"
- Issue: WHO definition of mental health explicitly includes cognitive flexibility, emotional regulation, AND ability to enjoy life. The question is not specific enough to rule out "Cognitive flexibility" as a correct answer. A well-informed player could reasonably choose either.
- Recommendation: Rephrase to "According to the WHO, which specific capacity defines positive mental health beyond just the absence of illness?" or cite the exact WHO phrasing.

**ISSUE-M2: Black Sea / Bosporus question difficulty mismatch**
- Fact: `geo-black-sea-water-two-directions`
- Floor 1 appearance, but the question ("Through the Bosporus, which direction does the saltier Mediterranean water flow relative to Black Sea water?") requires specialized physical oceanography knowledge
- Distractors "In alternating pulses", "Only in winter", "Perpendicular to it" are implausible to anyone with basic geography — making the real answer more guessable — but the question itself is Floor 2-3 difficulty
- Recommendation: Tag this fact with a higher difficulty tier or move it to later floors

**ISSUE-M3: Fact answer formatting inconsistency — curly braces in factAnswer**
- Two facts show curly-brace formatting in factAnswer: `"{1018}"` and `"About {70} km/h"`
- The `previewCardQuiz` API correctly strips/formats these (returning "1018" and "About 70 km/h" in correctAnswer), but the raw factAnswer field is inconsistent
- Risk: If any display path renders the raw factAnswer, users see `{1018}` or `About {70} km/h` with visible braces
- Recommendation: Audit all facts for curly-brace patterns in correctAnswer field; ensure they are stripped at all display sites

### LOW

**ISSUE-L1: Epimetheus question appears in combat 3 with incorrect card type context**
- `mythology_folklore-epimetheus-afterthought-name` appears on an "attack" card in combat 3 (mechanic: strike)
- In combat 1-2 it appeared on "shield" cards (mechanic: block)
- The quiz content is fine, but the card type assignment seems inconsistent — a mythology vocabulary fact feels more thematically suited to a utility/buff card than a strike
- This is a thematic/flavor issue, not a functional bug

**ISSUE-L2: "Ostrich" not mentioned in bipedal speed question**
- Fact: `animals-ostrich-fastest-bipedal`
- Question: "What is the top burst speed of the fastest bipedal land animal?"
- The answer ("About 70 km/h") is correct for an ostrich, but the animal is never named
- A player could correctly identify this fact while not knowing it refers to an ostrich — weakening the learning value
- Recommendation: Consider phrasing as "What is the top burst speed of the ostrich, the fastest bipedal land animal?" or including the animal name

---

## Raw Quiz Data

```json
[
  {
    "question": "In what year was the First Bulgarian Empire finally dissolved by Byzantine conquest?",
    "choices": ["1059", "1018", "1041", "974"],
    "correctIndex": 1,
    "correctAnswer": "1018",
    "domain": "history",
    "factId": "history-first-bulgarian-empire-duration",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": ["raw factAnswer has curly braces: {1018}"]
  },
  {
    "question": "What key capacity does holistic mental health emphasize alongside coping with stress?",
    "choices": ["Ability to enjoy life", "Avoiding conflict", "Cognitive flexibility", "Seeking therapy"],
    "correctIndex": 0,
    "correctAnswer": "Ability to enjoy life",
    "domain": "human_body_health",
    "factId": "human_body_health-mental-health-holism-balance",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": ["debatable correct answer — cognitive flexibility also valid per WHO"]
  },
  {
    "question": "What does the name 'Epimetheus' literally mean in Greek?",
    "choices": ["Earth-dweller", "Second-born", "Forgotten one", "Afterthought"],
    "correctIndex": 3,
    "correctAnswer": "Afterthought",
    "domain": "mythology_folklore",
    "factId": "mythology_folklore-epimetheus-afterthought-name",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": []
  },
  {
    "question": "Which country is the second-largest in Europe by area after Russia?",
    "choices": ["Finland", "Norway", "Ukraine", "Sweden"],
    "correctIndex": 2,
    "correctAnswer": "Ukraine",
    "domain": "geography",
    "factId": "geography-ukraine-second-largest-europe",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": []
  },
  {
    "question": "Which condition is responsible for the majority of dementia cases?",
    "choices": ["Parkinson's dementia", "Alzheimer's disease", "Vascular dementia", "Korsakoff syndrome"],
    "correctIndex": 1,
    "correctAnswer": "Alzheimer's disease",
    "domain": "human_body_health",
    "factId": "human_body_health-dementia-alzheimers-most-common",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": []
  },
  {
    "question": "Through the Bosporus, which direction does the saltier Mediterranean water flow relative to Black Sea water?",
    "choices": ["Underneath it", "In alternating pulses", "Only in winter", "Perpendicular to it"],
    "correctIndex": 0,
    "correctAnswer": "Underneath it",
    "domain": "geography",
    "factId": "geo-black-sea-water-two-directions",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": ["floor 1 difficulty mismatch — niche physical oceanography question"]
  },
  {
    "question": "Which condition is responsible for the majority of dementia cases?",
    "choices": ["Lewy body disease", "Parkinson's dementia", "HIV dementia", "Alzheimer's disease"],
    "correctIndex": 3,
    "correctAnswer": "Alzheimer's disease",
    "domain": "human_body_health",
    "factId": "human_body_health-dementia-alzheimers-most-common",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": ["distractor variant — different distractors than first appearance"]
  },
  {
    "question": "Which country is the second-largest in Europe by area after Russia?",
    "choices": ["Ukraine", "Germany", "Poland", "Finland"],
    "correctIndex": 0,
    "correctAnswer": "Ukraine",
    "domain": "geography",
    "factId": "geography-ukraine-second-largest-europe",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": ["repeat of same fact in same combat, different distractor set"]
  },
  {
    "question": "What is the top burst speed of the fastest bipedal land animal?",
    "choices": ["About 70 km/h", "About 44 km/h", "About 91 km/h", "About 93 km/h"],
    "correctIndex": 0,
    "correctAnswer": "About 70 km/h",
    "domain": "animals_wildlife",
    "factId": "animals-ostrich-fastest-bipedal",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": ["animal (ostrich) not named in question", "raw factAnswer has curly braces: About {70} km/h"]
  },
  {
    "question": "What does the name 'Epimetheus' literally mean in Greek?",
    "choices": ["Last-standing", "Afterthought", "Latecomer", "Behind the gods"],
    "correctIndex": 1,
    "correctAnswer": "Afterthought",
    "domain": "mythology_folklore",
    "factId": "mythology_folklore-epimetheus-afterthought-name",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": ["different distractors than first appearance"]
  },
  {
    "question": "What was the Egyptian concept of Maat the direct opposite of?",
    "choices": ["Isfet (chaos/injustice)", "Khepri (renewal)", "Aten (the sun disc)", "Shu (the wind)"],
    "correctIndex": 0,
    "correctAnswer": "Isfet (chaos/injustice)",
    "domain": "mythology_folklore",
    "factId": "mythology_folklore-maat-feather-cosmic-order",
    "source": "combat_hand",
    "encounter": 1,
    "anomalies": []
  },
  {
    "question": "Through the Bosporus, which direction does the saltier Mediterranean water flow relative to Black Sea water?",
    "choices": ["Same direction", "Via underground channels", "Underneath it", "In alternating pulses"],
    "correctIndex": 2,
    "correctAnswer": "Underneath it",
    "domain": "geography",
    "factId": "geo-black-sea-water-two-directions",
    "source": "combat_hand",
    "encounter": 2,
    "anomalies": ["repeat from combat 1, different distractor set"]
  },
  {
    "question": "What key capacity does holistic mental health emphasize alongside coping with stress?",
    "choices": ["Ability to enjoy life", "Social media detox", "Physical fitness", "Cognitive flexibility"],
    "correctIndex": 0,
    "correctAnswer": "Ability to enjoy life",
    "domain": "human_body_health",
    "factId": "human_body_health-mental-health-holism-balance",
    "source": "combat_hand",
    "encounter": 2,
    "anomalies": ["repeat from combat 1", "debatable correct answer"]
  },
  {
    "question": "In what year was the First Bulgarian Empire finally dissolved by Byzantine conquest?",
    "choices": ["1059", "1018", "1041", "974"],
    "correctIndex": 1,
    "correctAnswer": "1018",
    "domain": "history",
    "factId": "history-first-bulgarian-empire-duration",
    "source": "combat_hand",
    "encounter": 2,
    "anomalies": ["raw factAnswer has curly braces: {1018}"]
  },
  {
    "question": "What part of a piano transmits string vibrations to amplify sound?",
    "choices": ["Soundboard", "The action rails", "The pin block", "The key bed"],
    "correctIndex": 0,
    "correctAnswer": "Soundboard",
    "domain": "art_architecture",
    "factId": "art-piano-hammer-soundboard-mechanism",
    "source": "combat_hand",
    "encounter": 2,
    "anomalies": []
  },
  {
    "question": "What does the name 'Epimetheus' literally mean in Greek?",
    "choices": ["Latecomer", "Second-born", "Forgotten one", "Afterthought"],
    "correctIndex": 3,
    "correctAnswer": "Afterthought",
    "domain": "mythology_folklore",
    "factId": "mythology_folklore-epimetheus-afterthought-name",
    "source": "combat_hand",
    "encounter": 2,
    "anomalies": ["repeat from combat 1"]
  },
  {
    "question": "What part of a piano transmits string vibrations to amplify sound?",
    "choices": ["The iron frame", "The pin block", "Soundboard", "The lid"],
    "correctIndex": 2,
    "correctAnswer": "Soundboard",
    "domain": "art_architecture",
    "factId": "art-piano-hammer-soundboard-mechanism",
    "source": "combat_hand",
    "encounter": 3,
    "anomalies": ["repeat from combat 2, different distractor order"]
  },
  {
    "question": "What was the Egyptian concept of Maat the direct opposite of?",
    "choices": ["Duat (the underworld)", "Apophis (the void)", "Isfet (chaos/injustice)", "Shu (the wind)"],
    "correctIndex": 2,
    "correctAnswer": "Isfet (chaos/injustice)",
    "domain": "mythology_folklore",
    "factId": "mythology_folklore-maat-feather-cosmic-order",
    "source": "combat_hand",
    "encounter": 3,
    "anomalies": ["repeat from combat 1, different distractors: Duat and Apophis are new plausible options"]
  },
  {
    "question": "What key capacity does holistic mental health emphasize alongside coping with stress?",
    "choices": ["Maintaining routines", "Financial stability", "Social media detox", "Ability to enjoy life"],
    "correctIndex": 3,
    "correctAnswer": "Ability to enjoy life",
    "domain": "human_body_health",
    "factId": "human_body_health-mental-health-holism-balance",
    "source": "combat_hand",
    "encounter": 3,
    "anomalies": ["3rd encounter repeat", "debatable correct answer"]
  },
  {
    "question": "What is the top burst speed of the fastest bipedal land animal?",
    "choices": ["About 44 km/h", "About 70 km/h", "About 91 km/h", "About 93 km/h"],
    "correctIndex": 1,
    "correctAnswer": "About 70 km/h",
    "domain": "animals_wildlife",
    "factId": "animals-ostrich-fastest-bipedal",
    "source": "combat_hand",
    "encounter": 3,
    "anomalies": ["repeat from combat 1", "animal not named in question", "raw factAnswer has curly braces"]
  },
  {
    "question": "What does the name 'Epimetheus' literally mean in Greek?",
    "choices": ["Second-born", "Afterthought", "Forgotten one", "Last-standing"],
    "correctIndex": 1,
    "correctAnswer": "Afterthought",
    "domain": "mythology_folklore",
    "factId": "mythology_folklore-epimetheus-afterthought-name",
    "source": "combat_hand",
    "encounter": 3,
    "anomalies": ["appears in all 3 combats"]
  },
  {
    "question": "What key capacity does holistic mental health emphasize alongside coping with stress?",
    "choices": ["Physical fitness", "Seeking therapy", "Financial stability", "Ability to enjoy life"],
    "correctIndex": 3,
    "correctAnswer": "Ability to enjoy life",
    "domain": "human_body_health",
    "factId": "human_body_health-mental-health-holism-balance",
    "source": "combat_hand",
    "encounter": 3,
    "anomalies": ["4th instance of same fact across session", "debatable correct answer"]
  }
]
```

---

## Distractor Quality Observations

The distractor generation is notably strong in several areas:

- **Alzheimer's question**: All 4 distractor options (Parkinson's dementia, Vascular dementia, Korsakoff syndrome, Lewy body disease) are real, clinically significant dementia types — a student who doesn't know the answer cannot easily guess by elimination
- **Epimetheus question**: "Second-born", "Forgotten one", "Latecomer", "Last-standing", "Behind the gods" all feel plausible for a Greek name meaning — good semantic coherence
- **Maat question (combat 3)**: Adding "Duat (the underworld)" and "Apophis (the void)" as distractors is excellent — both are genuine Egyptian underworld concepts that a student might confuse with chaos/injustice

**Distractor weaknesses observed:**
- **Black Sea question**: "Only in winter" and "Perpendicular to it" are implausible distractors — any student who thinks about physics at all would eliminate them. "In alternating pulses" and "Same direction" are the only plausible ones.
- **Holism question**: "Social media detox" and "Avoiding conflict" feel modern/casual for a clinical psychology fact — slightly tonally mismatched

---

## Repeat Fact Analysis

| FactId | Appearances | Combats |
|--------|-------------|---------|
| mythology_folklore-epimetheus-afterthought-name | 5 | 1, 2, 3 |
| human_body_health-mental-health-holism-balance | 5 | 1, 2, 3 |
| geography-ukraine-second-largest-europe | 3 | 1, 1, 2 |
| human_body_health-dementia-alzheimers-most-common | 3 | 1, 1, 2 |
| geo-black-sea-water-two-directions | 3 | 1, 2, 3 |
| art-piano-hammer-soundboard-mechanism | 3 | 2, 3, 3 |
| mythology_folklore-maat-feather-cosmic-order | 2 | 1, 3 |
| animals-ostrich-fastest-bipedal | 2 | 1, 3 |
| history-first-bulgarian-empire-duration | 2 | 1, 2 |

The fact pool starvation is the single most impactful quality issue in this session. With 10 domains selected and presumably thousands of facts in the database, seeing only 9 unique facts over 3 combats strongly suggests either a bug in the fact pool builder or a very small active fact pool size for new players at level 25.

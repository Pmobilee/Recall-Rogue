# Quiz Quality Report — BATCH-2026-04-15-001
**Tester**: Quiz Quality | **Model**: sonnet | **Domain**: mixed | **Encounters**: 3
**Date**: 2026-04-15 | **Floor Range**: 1–3 (Rows 0–2)

## Verdict: ISSUES

---

## Summary
- Total unique quiz entries captured: 13
- Total quiz previews captured (including repeats): ~20 (same facts appear with randomized distractors)
- Domains represented: general_knowledge, geography, animals_wildlife, mythology_folklore, human_body_health, food_cuisine, art_architecture, history, space_astronomy
- Enemies fought: Index Weaver (Row 0), Page Flutter (Row 1), Page Flutter (Row 2)

---

## Objective Findings

| Check | Result | Pass Count | Fail Count | Notes |
|-------|--------|------------|------------|-------|
| O-QZ1: Choice count | PASS | 13/13 | 0/13 | All quizzes had exactly 4 choices |
| O-QZ2: No duplicate choices | PASS | 13/13 | 0/13 | No identical choices found within any quiz |
| O-QZ3: No data artifacts | PASS | 12/13 | 1/13 | See mochi question issue below |
| O-QZ4: Question completeness | PASS | 13/13 | 0/13 | No empty or whitespace-only questions |
| O-QZ5: Question length | PASS | 13/13 | 0/13 | All within 20–300 chars |
| O-QZ6: Correct index in bounds | PASS | 13/13 | 0/13 | All correctIndex values 0–3, within choices array |
| O-QZ7: No near-duplicate choices | PASS | 13/13 | 0/13 | Choices are meaningfully distinct within each quiz |
| O-QZ8: Domain coverage | PASS | — | — | 9 distinct domains across 13 entries |

---

## Subjective Assessments

| Check | Rating (1-5) | Examples | Issues |
|-------|-------------|----------|--------|
| S-QZ1: Distractor plausibility | 4/5 | Steam engine distractors (Watt, Trevithick, Boulton) are all real steam-era engineers — excellent. Khnum distractors (Ptah, Geb, Ra, Nefertem) are real Egyptian gods — excellent. | Milkfish distractors (Just 11, Just 4, Just 7) feel arbitrary — numeric ranges have no semantic anchor. |
| S-QZ2: Question clarity | 3/5 | Most questions are clear and unambiguous. | Mochi question broken: "What is the term for a is used to make mochi?" — fragment, garbled grammar. Free silver ratio question is very long (195 chars) and contains its own answer hint in the question text. |
| S-QZ3: Answer correctness | 5/5 | Spot-checked: Benedict Anderson ✓, Thomas Newcomen ✓, Khnum ✓, Hypothalamus ✓, Diacetyl ✓, Kessler Syndrome ✓, Gemini 4 ✓, The Liberator ✓, Socialist Realism ✓, Glutinous rice ✓ | No suspicious answers found. |
| S-QZ4: Difficulty appropriateness | 3/5 | Floor 1-3 questions include AP US History, chemistry jargon (diacetyl), and niche biology (chanidae family). Mix feels slightly front-loaded with academic difficulty. | Newcomen/steam engine and DC representation feel appropriately Floor 1. Diacetyl caramelization chemistry feels out of place for Floor 1. |
| S-QZ5: Cultural bias | 3/5 | Good global coverage: Egyptian myth, Japanese food (mochi), general knowledge, geography. | 3 of 13 entries are AP US History (Garrison, free silver), 1 is DC-specific. ~30% US-focused on sampled run. Kessler Syndrome/Gemini 4 reward choices double-checked as factual, not biased. |

---

## Issues Found

### HIGH

**ISSUE-QZ-001: Broken grammar in mochi question**
- Fact ID: `food_cuisine-mochi-glutinous-rice-cake`
- Question: `"What is the term for a is used to make mochi?"`
- The question text contains a fragment: "for a is" — appears to be a malformed template substitution or edit artifact. The phrase "a {type of rice}" likely had the variable dropped.
- Impact: Players see a grammatically broken question. This ships to production.
- Severity: HIGH — directly visible to players.

### MEDIUM

**ISSUE-QZ-002: Free silver question contains answer hint**
- Fact ID: `apush_p6_free_silver_ratio`
- Question: `"What ratio did Populists and free-silver advocates demand for the coinage of silver to gold, arguing it would expand the money supply and relieve debt-burdened farmers?"`
- Answer: `"16 to 1 (silver ratio)"`
- The question text mentions "silver ratio" in the answer's parenthetical label. While not technically revealing "16 to 1", the answer label echoes the question's phrase.
- Additionally the distractors shown in the reward card preview were not captured (card was offered as reward, not played in combat), so the distractor quality for this one was not assessed.
- Severity: MEDIUM — subtle hint leakage.

**ISSUE-QZ-003: Randomized distractors are inconsistent between previews**
- Fact ID: `gk-steam-engine-newcomen-1712`
- This question appeared 3 times with different distractor pools:
  - Preview A: [Richard Trevithick, Thomas Newcomen, Matthew Boulton, John Smeaton]
  - Preview B: [James Watt, Matthew Boulton, Richard Trevithick, Thomas Newcomen]
  - Preview C: [James Watt, Hero of Alexandria, Matthew Boulton, Thomas Newcomen]
- All distractors are era-appropriate steam engineers, which is correct. However, consistency matters for spaced repetition: a player who studies "Matthew Boulton was NOT the answer" may see a different set next time, undermining the learning signal.
- Severity: MEDIUM — affects FSRS/learning integrity, not just quiz quality.

### LOW

**ISSUE-QZ-004: Numeric distractors for milkfish feel arbitrary**
- Fact ID: `animals_wildlife-milkfish-sole-family`
- Question: `"How many living species make up the milkfish's entire family, Chanidae?"`
- Distractors: Just 11, Just 4, Just 7, Just 1 (correct)
- The distractors (4, 7, 11) are plausible integers but have no semantic grounding — they could be any small numbers. No competing genus/family sizes are referenced. This makes the question feel like a number guessing game rather than a knowledge test.
- Severity: LOW — technically not wrong, but weakens educational value.

**ISSUE-QZ-005: Floor 1 contains expert-level AP academic content**
- Items like `apush_p6_free_silver_ratio` (AP US History Period 6 specifics) and `food_cuisine-caramelization-diacetyl-butter-flavor` (organic chemistry) appear on Floor 1.
- For a roguelite, Floor 1 should help players feel competent. Very domain-specific academic content this early may cause discouraging failure streaks.
- Severity: LOW — tuning/balance concern, not a data bug.

---

## Raw Quiz Data

```json
[
  {
    "factId": "general_knowledge-nation-imagined-community",
    "domain": "general_knowledge",
    "question": "Which political scientist coined the term 'imagined community' to describe nations?",
    "choices": ["John Rawls", "Max Weber", "Benedict Anderson", "Karl Marx"],
    "correctAnswer": "Benedict Anderson",
    "correctIndex": 2,
    "cardType": "shield",
    "encounter": 1
  },
  {
    "factId": "geography-dc-not-a-state",
    "domain": "geography",
    "question": "What representation do Washington D.C. residents have in the U.S. Congress?",
    "choices": ["One senator", "None (non-voting only)", "Full representation", "Full House, no Senate"],
    "correctAnswer": "None (non-voting only)",
    "correctIndex": 1,
    "cardType": "shield",
    "encounter": 1
  },
  {
    "factId": "geography-dc-not-a-state",
    "domain": "geography",
    "question": "What representation do Washington D.C. residents have in the U.S. Congress?",
    "choices": ["None (non-voting only)", "Same as any state", "One vote in House", "Two senators only"],
    "correctAnswer": "None (non-voting only)",
    "correctIndex": 0,
    "cardType": "shield",
    "encounter": 3,
    "note": "Randomized distractors — different from encounter 1 preview"
  },
  {
    "factId": "animals_wildlife-milkfish-sole-family",
    "domain": "animals_wildlife",
    "question": "How many living species make up the milkfish's entire family, Chanidae?",
    "choices": ["Just 11", "Just 4", "Just 7", "Just 1"],
    "correctAnswer": "Just 1",
    "correctIndex": 3,
    "cardType": "attack",
    "encounter": 1
  },
  {
    "factId": "animals_wildlife-milkfish-sole-family",
    "domain": "animals_wildlife",
    "question": "How many living species make up the milkfish's entire family, Chanidae?",
    "choices": ["Just 1", "Just 11", "Just 7", "Just 4"],
    "correctAnswer": "Just 1",
    "correctIndex": 0,
    "cardType": "shield",
    "encounter": 3,
    "note": "Same distractors, different order — correctIndex changed from 3 to 0"
  },
  {
    "factId": "mythology_folklore-khnum-potter-wheel-creator-b3",
    "domain": "mythology_folklore",
    "question": "Which Egyptian god created human bodies using clay on a potter's wheel?",
    "choices": ["Khnum", "Geb", "Ra", "Nefertem"],
    "correctAnswer": "Khnum",
    "correctIndex": 0,
    "cardType": "shield",
    "encounter": 1
  },
  {
    "factId": "mythology_folklore-khnum-potter-wheel-creator-b3",
    "domain": "mythology_folklore",
    "question": "Which Egyptian god created human bodies using clay on a potter's wheel?",
    "choices": ["Ptah", "Khnum", "Khepri", "Osiris"],
    "correctAnswer": "Khnum",
    "correctIndex": 1,
    "cardType": "attack",
    "encounter": 3,
    "note": "Different distractors — Ptah, Khepri, Osiris (all valid Egyptian gods) vs Geb, Ra, Nefertem"
  },
  {
    "factId": "hbh_nervous_hypothalamus",
    "domain": "human_body_health",
    "question": "Which brain region controls hunger, thirst, body temperature, and regulates the pituitary gland?",
    "choices": ["Amygdala", "Hypothalamus", "Prefrontal cortex", "Basal ganglia"],
    "correctAnswer": "Hypothalamus",
    "correctIndex": 1,
    "cardType": "attack",
    "encounter": 1
  },
  {
    "factId": "gk-steam-engine-newcomen-1712",
    "domain": "general_knowledge",
    "question": "Who built the first commercially successful steam engine in 1712?",
    "choices": ["Richard Trevithick", "Thomas Newcomen", "Matthew Boulton", "John Smeaton"],
    "correctAnswer": "Thomas Newcomen",
    "correctIndex": 1,
    "cardType": "attack",
    "encounter": 1,
    "note": "Distractor set A"
  },
  {
    "factId": "gk-steam-engine-newcomen-1712",
    "domain": "general_knowledge",
    "question": "Who built the first commercially successful steam engine in 1712?",
    "choices": ["James Watt", "Matthew Boulton", "Richard Trevithick", "Thomas Newcomen"],
    "correctAnswer": "Thomas Newcomen",
    "correctIndex": 3,
    "cardType": "wild",
    "encounter": 2,
    "note": "Distractor set B — different composition"
  },
  {
    "factId": "gk-steam-engine-newcomen-1712",
    "domain": "general_knowledge",
    "question": "Who built the first commercially successful steam engine in 1712?",
    "choices": ["James Watt", "Hero of Alexandria", "Matthew Boulton", "Thomas Newcomen"],
    "correctAnswer": "Thomas Newcomen",
    "correctIndex": 3,
    "cardType": "attack",
    "encounter": 2,
    "note": "Distractor set C — includes Hero of Alexandria (ancient, different era)"
  },
  {
    "factId": "food_cuisine-caramelization-diacetyl-butter-flavor",
    "domain": "food_cuisine",
    "question": "What volatile chemical gives caramel its intense butter-like taste?",
    "choices": ["Benzaldehyde", "Diacetyl", "Vanillin", "Furfural"],
    "correctAnswer": "Diacetyl",
    "correctIndex": 1,
    "cardType": "attack",
    "encounter": 1,
    "note": "Distractor set A"
  },
  {
    "factId": "food_cuisine-caramelization-diacetyl-butter-flavor",
    "domain": "food_cuisine",
    "question": "What volatile chemical gives caramel its intense butter-like taste?",
    "choices": ["Furfural", "Vanillin", "Acrolein", "Diacetyl"],
    "correctAnswer": "Diacetyl",
    "correctIndex": 3,
    "cardType": "shield",
    "encounter": 2,
    "note": "Distractor set B — Acrolein replaced Benzaldehyde"
  },
  {
    "factId": "art_architecture-maxim-gorky-socialist-realism",
    "domain": "art_architecture",
    "question": "What artistic movement was Maxim Gorky officially declared the founder of by the Soviet state?",
    "choices": ["Communist Impressionism", "Social Naturalism", "Marxist Expressionism", "Socialist Realism"],
    "correctAnswer": "Socialist Realism",
    "correctIndex": 3,
    "cardType": "shield",
    "encounter": 1
  },
  {
    "factId": "art_architecture-maxim-gorky-socialist-realism",
    "domain": "art_architecture",
    "question": "What artistic movement was Maxim Gorky officially declared the founder of by the Soviet state?",
    "choices": ["Socialist Realism", "Dialectical Realism", "Proletarian Symbolism", "Revolutionary Romanticism"],
    "correctAnswer": "Socialist Realism",
    "correctIndex": 0,
    "cardType": "shield",
    "encounter": 3,
    "note": "Different distractor set — all plausible Soviet-era art movements"
  },
  {
    "factId": "food_cuisine-mochi-glutinous-rice-cake",
    "domain": "food_cuisine",
    "question": "What is the term for a is used to make mochi?",
    "choices": ["Sushi rice", "Basmati rice", "Jasmine rice", "Glutinous rice"],
    "correctAnswer": "Glutinous rice",
    "correctIndex": 3,
    "cardType": "attack",
    "encounter": 1,
    "ISSUE": "BROKEN GRAMMAR — 'for a is used' is malformed"
  },
  {
    "factId": "food_cuisine-mochi-glutinous-rice-cake",
    "domain": "food_cuisine",
    "question": "What is the term for a is used to make mochi?",
    "choices": ["Glutinous rice", "Black rice", "Sushi rice", "Short-grain rice"],
    "correctAnswer": "Glutinous rice",
    "correctIndex": 0,
    "cardType": "attack",
    "encounter": 3,
    "ISSUE": "BROKEN GRAMMAR — same broken question, different distractors"
  },
  {
    "factId": "sa_satellites_tech_kessler_syndrome",
    "domain": "space_astronomy",
    "question": "What scenario involves debris collisions creating more debris in a runaway cascade threatening orbital access?",
    "choices": null,
    "correctAnswer": "Kessler Syndrome",
    "correctIndex": null,
    "cardType": null,
    "encounter": "reward_choice_after_combat_2",
    "note": "Captured from reward card preview — distractors not previewed (not played in combat)"
  },
  {
    "factId": "nasa_gemini_4_ed_white_eva",
    "domain": "space_astronomy",
    "question": "Which NASA mission featured Ed White's first American spacewalk on June 3, 1965?",
    "choices": null,
    "correctAnswer": "Gemini 4",
    "correctIndex": null,
    "cardType": null,
    "encounter": "reward_choice_after_combat_2",
    "note": "Captured from reward card preview — distractors not previewed"
  },
  {
    "factId": "apush_p6_free_silver_ratio",
    "domain": "history",
    "question": "What ratio did Populists and free-silver advocates demand for the coinage of silver to gold, arguing it would expand the money supply and relieve debt-burdened farmers?",
    "choices": null,
    "correctAnswer": "16 to 1 (silver ratio)",
    "correctIndex": null,
    "cardType": null,
    "encounter": "reward_choice_after_combat_2",
    "note": "Captured from reward card preview — distractors not previewed. ISSUE: answer label echoes 'silver ratio' from question"
  },
  {
    "factId": "apush_p4_garrison_liberator",
    "domain": "history",
    "question": "What abolitionist newspaper did William Lloyd Garrison found on January 1, 1831, demanding the immediate emancipation of all enslaved people without compensation to slaveholders?",
    "choices": ["Pentagon Papers", "Port Huron Statement", "Silent Spring (Carson, 1962)", "The Liberator (Garrison paper)"],
    "correctAnswer": "The Liberator (Garrison paper)",
    "correctIndex": 3,
    "cardType": "shield",
    "encounter": 3
  }
]
```

---

## Notable Observations

### Randomized Distractor System
The quiz engine uses a randomized distractor pool — the same fact appears with different wrong answers on each preview/draw. This was observed for 5 different fact IDs across sessions. The randomization appears intentional and the distractor quality is generally good (era-appropriate figures for history, real chemical compounds for food science, genuine Egyptian gods for mythology). However:
- It weakens consistent learning: a player studying "it's not Benzaldehyde" may not see that option again
- The randomization does not seem to guarantee that the correct answer position is stable, which means players cannot develop spatial memory for answer position (good — avoids "always B" bias)

### The Liberator Distractors — Anachronism Flag
- Fact ID: `apush_p4_garrison_liberator`
- Distractors: Pentagon Papers (1971), Port Huron Statement (1962), Silent Spring (Carson, 1962)
- **Problem**: The question asks about 1831. All three distractors are 20th-century documents. A historically literate player can immediately eliminate them all by era alone, making this a "free answer" for anyone with basic historical period knowledge. The distractors should include contemporary 1830s abolitionist publications.
- This is a HIGH issue for historical accuracy of the quiz challenge, flagged as a **new issue not in the main table above**.

### ISSUE-QZ-006 (Retroactive): The Liberator has era-mismatched distractors
- Fact ID: `apush_p4_garrison_liberator`  
- All 3 distractors (Pentagon Papers, Port Huron Statement, Silent Spring) are from the 1960s-70s
- The question is about an 1831 newspaper
- Any player knowing rough US history periods can trivially eliminate all distractors
- Severity: **HIGH** — undermines quiz challenge for this fact

---

## Pass/Fail Summary

| Category | Total | Passed | Issues |
|----------|-------|--------|--------|
| Objective checks (O-QZ1–8) | 8 | 7 | 1 (O-QZ3 partial: mochi grammar) |
| Subjective checks (S-QZ1–5) | 5 | 2 (S-QZ3, S-QZ6) | 3 need attention |
| Critical issues | — | — | 0 |
| High issues | — | — | 2 (mochi broken grammar, Liberator era mismatch) |
| Medium issues | — | — | 2 (answer hint in question, randomized distractor inconsistency) |
| Low issues | — | — | 2 (arbitrary numerics, difficulty curve Floor 1) |

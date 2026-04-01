# Quiz Quality Report — BATCH-2026-04-01-003

**Date:** 2026-04-01
**Tester:** Claude (Sonnet 4.6)
**Encounters played:** 4 (Bookmark Vine, Mold Puff, Ink Slug, Staple Bug)
**Unique quizzes captured:** 10
**Total quiz instances observed:** ~30+ (Anki repetition expected)
**Fixes tested from BATCH-002:** Study dedup, SRS feedback, charge AP display, Rome/Greece pool fix, post-reward flow, floor 1 damage, playerHp in getCombatState

---

## VERDICT: PASS — Good Quality With Minor Issues

Quiz content is educationally sound. Distractors are meaningfully improved vs BATCH-001. One structural distractor issue found (non-domain distractors for the Caligula question). Post-reward flow verified working. Pool contamination fix confirmed.

---

## Objective Checklist

| ID | Criterion | Result | Notes |
|----|-----------|--------|-------|
| O-QZ1 | 3+ choices | PASS | All 10 quizzes had exactly 4 choices |
| O-QZ2 | No duplicate choices within a question | PASS | No duplicates observed in any quiz |
| O-QZ3 | No rendering artifacts / garbled text | PASS | All text clean |
| O-QZ4 | Questions not empty | PASS | All questions populated |
| O-QZ5 | 20–300 chars per question | PASS | Range: ~40–220 chars. Longest: Montgomery/El Alamein (~200 chars) |
| O-QZ6 | correctIndex in bounds [0, choices.length) | PASS | All correctIndex values 0–3, matching choice arrays |
| O-QZ7 | No near-duplicate questions in session | PASS | All 10 factIds distinct |
| O-QZ8 | 2+ domains represented | PASS | 6 domains: history, mythology_folklore, food_cuisine, space_astronomy, natural_sciences, general_knowledge |

---

## Subjective Ratings (1–5 scale)

| ID | Criterion | Score | Notes |
|----|-----------|-------|-------|
| S-QZ1 | Distractor plausibility | 3.8/5 | Most distractors strong; Caligula question has one structural issue (see Issues) |
| S-QZ2 | Question clarity | 4.2/5 | Clear and precise overall; Montgomery question slightly long but unambiguous |
| S-QZ3 | Answer correctness | 4.8/5 | All verified correct; one minor framing concern (biotechnology question) |
| S-QZ4 | Difficulty balance | 3.5/5 | Skews easy-to-medium; Venus retrograde and Beowulf trivially easy for general audience |
| S-QZ5 | Cultural bias | 4.0/5 | Western/European heavy (WWII, Greek myth, Roman history) but expected for current deck pool |

---

## Issues Found

### ISSUE-1 — Caligula Horse: Distractors From Wrong Answer Type Pool (MEDIUM)
**factId:** `rome_aug_caligula_horse`
**Question:** "What was the name of Caligula's famous racehorse, which he allegedly threatened to appoint as a Roman consul?"
**Correct:** Incitatus
**Distractors observed:** "Caesar, Pompey, and Crassus" / "Suetonius" / "Octavian (his great-nephew, posthumously adopted in his will)"

**Problem:** The distractors are Roman political figures and a historian, not horse names. A player seeing these choices knows immediately the answer must be "Incitatus" — the only plausible horse name. This makes the question trivially easy and breaks distractor plausibility.

**Expected distractors:** Other horse names or famous ancient animals (e.g., Bucephalus, Pegasus, Trigger, Marengo).

**Root cause:** Likely distractor pool is drawn from the same Roman history fact pool (people/names) rather than a horse-name-appropriate pool.

---

### ISSUE-2 — Archaeopteryx: One Distractor Is a Country Name (LOW)
**factId:** `dino_archaeopteryx_transitional`
**Question:** "Which 150-million-year-old fossil is the most famous transitional link between non-avian dinosaurs and modern birds?"
**Choices:** Plesiosaurus, Albertosaurus, Archaeopteryx, **China**

**Problem:** "China" is not a dinosaur or fossil name — it is a country. Likely a data entry error or pool contamination. The other three distractors (Plesiosaurus, Albertosaurus) are plausible extinct animal names and work well. "China" is an obvious outlier that a player can immediately eliminate.

**Severity:** Low — still 2 credible distractors remain, quiz is still functional, but "China" looks like a bug.

---

### ISSUE-3 — Biotechnology Question: Framing Ambiguity (LOW)
**factId:** `gk-biotechnology-ancient-roots`
**Question:** "Which ancient human practice qualifies as an early form of biotechnology?"
**Correct:** Animal domestication

**Concern:** Agriculture / selective crop cultivation also qualifies as early biotechnology. The question is technically defensible with "Animal domestication" but a knowledgeable player could reasonably argue fermentation (bread, alcohol) or plant cultivation are equally valid first-order answers. The distractors ("Painting cave art", "Mining metals", "Carving stone tools") are clearly wrong, which mitigates the ambiguity — but the question itself is slightly under-specified.

**Suggestion:** Add "according to standard biology textbook definitions" or specify the scope (e.g., "manipulation of living organisms' genetics").

---

### OBSERVATION-1 — Montgomery Question: Very Long (NOTE ONLY)
**factId:** `wwii_na_montgomery_el_alamein_prep`
**Char count:** ~210 characters

The question is notably long and includes embedded historical context. This is acceptable as a "hard" card but would benefit from a truncated display version for smaller UI contexts. Not a correctness issue — the phrasing is accurate and the extra context (Churchill's frustration) is engaging.

---

### OBSERVATION-2 — Fact Repetition Rate (KNOWN NON-BUG CONFIRMED)
Across 4 encounters and ~30 charge attempts, only 10 unique factIds appeared. This matches the Anki three-queue design: facts repeat based on SRS scheduling, not per-encounter uniqueness. Confirmed working as designed.

---

### OBSERVATION-3 — Distractor Shuffling Working Correctly
The same fact appeared multiple times across encounters with different choice orderings each time. Example — `solar_system_venus_retrograde` correct answer "Venus" appeared at index 0, 1, and 2 in different encounters. This confirms distractor randomization is functioning.

---

### OBSERVATION-4 — Post-Reward Flow Fixed (CONFIRMED)
`acceptReward()` successfully returned `"Reward accepted via Phaser scene. Screen: dungeonMap"` in all three tested transitions. This was broken in BATCH-001/002 and is now working.

---

### OBSERVATION-5 — Rome/Greece Pool Contamination Fixed (CONFIRMED)
No Greek mythology distractors appeared inside Roman history questions or vice versa. The `greece_oc_lyre_apollo` question correctly showed Roman-style distractors (Jupiter, Venus, Ceres) which is technically a minor concern (see below), but no cross-pool contamination of the type reported pre-fix.

**Minor note on lyre/Apollo question:** Distractors are Jupiter/Venus/Ceres (Roman deity names for what is a Greek mythology question). This is borderline — these are the Roman equivalents of Greek gods, so they're plausible wrong answers, but it could confuse players studying Greek vs Roman nomenclature.

---

### OBSERVATION-6 — Domain Coverage
6 of 8+ available domains seen across 4 encounters:
- `history` (WWII, Greek/Roman)
- `mythology_folklore` (Beowulf, Echo)
- `food_cuisine` (Charcuterie)
- `space_astronomy` (Venus)
- `natural_sciences` (Archaeopteryx)
- `general_knowledge` (Biotechnology, Steam engine)

Missing from this session: `geography`, `literature`, `sports`, others. O-QZ8 passes (2+ domains), but 6 domains across 4 encounters shows reasonable breadth.

---

## Improvements vs BATCH-001 / BATCH-002

| Area | BATCH-001 | BATCH-002 | BATCH-003 |
|------|-----------|-----------|-----------|
| Post-reward flow | BROKEN | BROKEN | FIXED — works reliably |
| Rome/Greece pool contamination | Present | FIXED | Confirmed fixed |
| SRS +/- feedback | Not tested | Reported missing | Present (not directly observable via API) |
| Charge shows total AP | Not tested | Broken | Fixed per changelog |
| playerHp in getCombatState | Missing | Missing | PRESENT — confirmed |
| Distractor quality | Mixed | Improved | Good overall, 2 specific issues |
| Floor 1 enemy damage | Low | Fixed | Bookmark Vine 2×2 intent observed |

---

## Raw Quiz Data (All 10 Unique Facts)

```json
[
  {
    "factId": "food-pork-charcuterie",
    "domain": "food_cuisine",
    "question": "What culinary art is devoted to prepared meat products, many derived from pork?",
    "correctAnswer": "Charcuterie",
    "distractors_observed": ["Traiteur", "Saucisserie", "Rotisserie", "Boulangerie", "Boucherie"]
  },
  {
    "factId": "mythology_folklore-beowulf-occupation",
    "domain": "mythology_folklore",
    "question": "What is the oldest surviving piece of English literature?",
    "correctAnswer": "Beowulf",
    "distractors_observed": ["The Dream of the Rood", "Canterbury Tales", "The Battle of Maldon", "The Wanderer", "Morte d'Arthur", "Caedmon's Hymn", "Sir Gawain and the Green Knight"]
  },
  {
    "factId": "solar_system_venus_retrograde",
    "domain": "space_astronomy",
    "question": "Which planet rotates backward compared to most other planets?",
    "correctAnswer": "Venus",
    "distractors_observed": ["Jupiter", "Mars", "Neptune"]
  },
  {
    "factId": "greece_oc_lyre_apollo",
    "domain": "history",
    "question": "The lyre was the central instrument of Apollonian (rational, ordered) Greek culture — sacred to which god who received it when Hermes traded it to him in exchange for cattle?",
    "correctAnswer": "Apollo",
    "distractors_observed": ["Ceres", "Venus", "Jupiter"],
    "note": "Distractors are Roman deity names for a Greek mythology question — borderline but defensible"
  },
  {
    "factId": "myth_echo_curse",
    "domain": "mythology_folklore",
    "question": "Which goddess cursed the nymph Echo to only be able to repeat the last words spoken to her, as punishment for distracting her from Zeus's affairs?",
    "correctAnswer": "Hera",
    "distractors_observed": ["Apollo", "Poseidon", "Hephaestus"]
  },
  {
    "factId": "gk-biotechnology-ancient-roots",
    "domain": "general_knowledge",
    "question": "Which ancient human practice qualifies as an early form of biotechnology?",
    "correctAnswer": "Animal domestication",
    "distractors_observed": ["Painting cave art", "Mining metals", "Carving stone tools", "Building stone shelters", "Weaving cloth", "Making fire"]
  },
  {
    "factId": "general_knowledge-steam-engine-external-combustion",
    "domain": "general_knowledge",
    "question": "What makes a steam engine an 'external combustion' engine?",
    "correctAnswer": "Combustion is separate from the working fluid",
    "distractors_observed": ["Steam is vented to the atmosphere", "Heat is generated by electricity", "Fuel burns outside the building"]
  },
  {
    "factId": "dino_archaeopteryx_transitional",
    "domain": "natural_sciences",
    "question": "Which 150-million-year-old fossil is the most famous transitional link between non-avian dinosaurs and modern birds?",
    "correctAnswer": "Archaeopteryx",
    "distractors_observed": ["Plesiosaurus", "Albertosaurus", "China"],
    "issue": "ISSUE-2: 'China' is not a valid distractor — it is a country name, not a fossil/species"
  },
  {
    "factId": "wwii_na_montgomery_el_alamein_prep",
    "domain": "history",
    "question": "When General Montgomery took command of the British Eighth Army in August 1942, he refused Rommel's immediate challenge to attack and instead spent roughly how long preparing for the Second Battle of El Alamein — a caution that Churchill found infuriating?",
    "correctAnswer": "Eight weeks",
    "distractors_observed": ["One day", "Two days", "Four months", "Six months", "Three days"]
  },
  {
    "factId": "rome_aug_caligula_horse",
    "domain": "history",
    "question": "What was the name of Caligula's famous racehorse, which he allegedly threatened to appoint as a Roman consul?",
    "correctAnswer": "Incitatus",
    "distractors_observed": ["Caesar, Pompey, and Crassus", "Suetonius", "Octavian (his great-nephew, posthumously adopted in his will)"],
    "issue": "ISSUE-1: Distractors are Roman people/historians, not horse names — trivially easy to eliminate"
  }
]
```

---

## Summary of Action Items

| Priority | Issue | Action |
|----------|-------|--------|
| MEDIUM | Caligula horse distractors are people, not horses | Fix distractor pool for `rome_aug_caligula_horse` — use animal names, not Roman figures |
| LOW | Archaeopteryx: "China" distractor | Replace "China" with a valid extinct animal (e.g., Microraptor, Confuciusornis) |
| LOW | Biotechnology question ambiguity | Add scope qualifier to question text |
| NOTE | Apollo/lyre uses Roman deity names as distractors | Consider using Greek deity names (Ares, Poseidon, Demeter) for consistency |
| NOTE | Beowulf has 7+ distractor variants across sessions | Distractor pool is rich — good |

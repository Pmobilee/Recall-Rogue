# test_world_capitals — Quiz Audit Findings

## Summary
30 facts in a single `capital_names` pool — a test fixture deck. Quiz dump covers 30 unique facts × 3 mastery levels = 90 rows, all with multi-choice rendering. The single-pool architecture creates a severe LENGTH-TELL problem: pool ratio 6.2× (Bern at 4 chars vs Sri Jayawardenepura Kotte at 25 chars). Questions about simple capitals leak length information, and questions about unusual capitals (Sri Lanka, Kazakhstan) are identifiable by answer length alone. Factually accurate throughout.

**Issue counts:** 0 BLOCKER, 1 MAJOR, 2 MINOR, 1 NIT

---

## Issues

### MAJOR

- **Fact**: All 30 facts @ mastery=4 (capital_names pool)
- **Category**: `LENGTH-TELL`
- **Rendered** (e.g., `wc_sri_lanka` m=4):
  Q: "What is the capital of Sri Lanka?"
  A) Islamabad | B) Bern | C) Rabat | D) Wellington | E) [Sri Jayawardenepura Kotte]

  And conversely (`wc_france` m=4):
  Q: "What is the capital of France?"
  A) Beijing | B) [Paris] | C) Washington, D.C. | D) Rome | E) Madrid
- **Issue**: The `capital_names` pool mixes answers ranging from 4 characters (Bern, Rome) to 25 characters (Sri Jayawardenepura Kotte) — a 6.2× ratio, far exceeding the 3× threshold. This creates bidirectional length-tells:
  - For easy capitals (France, Italy), the correct short answer (Paris, Rome) is surrounded by longer distractors at m=4, making it visually distinct.
  - For unusual capitals (Sri Lanka), the correct long answer is immediately identifiable as the only multi-word, longest option.
  - "Washington, D.C." (16 chars with punctuation) also stands out due to its comma and period formatting when surrounded by simple city names.

  The pool should be split into at least `capital_names_short` (≤8 chars: Bern, Rome, Tokyo, Madrid, Seoul, Cairo, etc.) and `capital_names_long` (>8 chars: Washington D.C., Sri Jayawardenepura Kotte, Buenos Aires, etc.).

---

### MINOR

- **Fact**: `wc_south_africa` @ mastery=all
- **Category**: `AMBIGUOUS-Q`
- **Rendered** (m=4):
  Q: "What is the capital of South Africa?"
  A) Manila | B) [Pretoria] | C) Astana | D) Naypyidaw | E) Sri Jayawardenepura Kotte
- **Issue**: South Africa has three official capitals: Pretoria (executive/administrative), Cape Town (legislative), and Bloemfontein (judicial). The question asks "What is the capital?" without qualification, which is ambiguous. The deck handles this with `acceptableAlternatives: ["Cape Town", "Bloemfontein"]` — which is the correct approach. The MINOR issue is the question wording: "Which city is South Africa's administrative capital?" would be unambiguous. As-is, a player who answers "Cape Town" or "Bloemfontein" might not realize their answer is acceptable until after the round.

---

- **Fact**: All 30 facts @ mastery=all (capital_names pool)
- **Category**: `SYNTHETIC-WEAK`
- **Rendered**: N/A (structural)
- **Issue**: The `capital_names` pool has 30 facts and 0 synthetic distractors. While 30 real capitals provides adequate distractor variety at m=4 (4 distractors from 29 pool members), there is no domain-specific padding. The pool's extreme length heterogeneity (6.2× ratio) means the engine's random distractor selection will frequently pair very short capitals with very long ones, amplifying the LENGTH-TELL issue. Synthetic distractors of consistent length could be targeted at specific capital types to improve homogeneity within rendered option sets.

---

### NIT

- **Fact**: All 30 facts @ mastery=all
- **Category**: `OTHER`
- **Rendered**: N/A
- **Issue**: This deck is explicitly a test fixture (30 facts, one flat pool, no sub-decks, no chain themes). It functions well as a rendering test for text-quiz capital questions. However, it should not be presented to players as a geography deck — it lacks the scope, structure, and challenge of a production deck. If it appears in the player-facing deck selection, it should be gated as dev/preview only. No action required if already gated.

---

## Expected vs Actual
- Expected: LENGTH-TELL < 3× ratio — **actual: 6.2× (FAIL — severe)**
- Expected: South Africa ambiguity handled — **actual: acceptableAlternatives present for Cape Town and Bloemfontein**
- Expected: Factually accurate capitals — **actual: all 30 verified correct (Paris, Tokyo, Berlin, Brasília, Naypyidaw, Bern, etc.)**
- Expected: No broken quiz rendering — **actual: all 90 rows render with proper multi-choice options**
- Expected: No broken grammar — **actual: all 30 questions use clean "What is the capital of X?" format**

## Notes
- All 30 capitals are factually correct, including: Brasília (not São Paulo), Naypyidaw (Myanmar, moved from Yangon in 2006), Astana (Kazakhstan, renamed from Nur-Sultan back to Astana in 2022 — verify this is the current name), Sri Jayawardenepura Kotte (Sri Lanka's official legislative capital, though Colombo is the commercial capital).
- The distractor selection at m=4 for `wc_sri_lanka` includes "Bern", "Islamabad", "Rabat", "Wellington" — all legitimate capitals from the pool but none are in Sri Lanka's region, reducing geographic plausibility of distractors.
- "Astana" — Kazakhstan renamed its capital from Nur-Sultan back to Astana in September 2022. The deck uses "Astana" which is correct as of 2022 onward.

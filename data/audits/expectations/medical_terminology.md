# medical_terminology — Expectations

## 1. Intended Scope
Master the language of medicine: prefixes, suffixes, root words, combining forms, organ-system terminology, body positions, diagnostic abbreviations, condition names, and procedure names. All of healthcare's linguistic building blocks in one deck.

## 2. Canonical Source
Wikipedia (List of medical roots, suffixes and prefixes). Supplemented with Chabner-style term breakdowns in explanations. The 2026-04-03 audit flag noted that medical abbreviations (STAT, PRN, BID, NPO) were entirely absent — this audit will verify whether that gap has been addressed.

## 3. Sub-Deck / Chain Theme List
5 sub-decks (implied by content groupings). Chain themes: NONE defined — chainThemes array is empty; chainThemeId values are numeric integers 0–15.

## 4. Answer Pool Inventory
16 pools total:
- `prefix_meanings_short`: 30 facts — OK
- `prefix_meanings_long`: 51 facts — OK
- `suffix_meanings_short`: 20 facts — OK
- `suffix_meanings_long`: 42 facts — OK
- `root_meanings_short`: 10 facts + 5 synth = 15 — OK
- `root_meanings_mid`: 138 facts — OK (largest pool, potential LENGTH-TELL)
- `root_meanings_long`: 57 facts — OK
- `organ_names_short`: 19 facts — OK
- `organ_names_long`: 31 facts — OK
- `combining_forms`: 50 facts — OK
- `body_systems`: 20 facts + 2 synth = 22 — OK
- `condition_names_short`: 82 facts — OK
- `condition_names_long`: 87 facts — OK
- `procedure_names_short`: 38 facts — OK
- `procedure_names_long`: 23 facts — OK
- `bracket_numbers`: 2 real facts (tri- = 3, quadri- = 4), no synthetics — CRITICAL: only 2 real members, no synthetics, pool is nearly unworkable

## 5. Expected Quality Bar
Strong structural coverage of roots/prefixes/suffixes. Clinical abbreviations are a known gap: PRN, BID, NPO, TID, QID, and SQ are all absent. The 20 abbreviation facts that exist focus on lab panels (CBC, BMP, etc.) — important, but not the dosing instructions that nursing students memorize daily.

## 6. Risk Areas
1. **bracket_numbers pool has only 2 real facts** with NO synthetics — the quiz engine has essentially no pool to draw from for numeric prefix facts (tri-, quadri-). Runtime failure likely.
2. **Missing clinical dosing abbreviations**: PRN (as needed), BID (twice daily), NPO (nothing by mouth), TID (three times daily), QID (four times daily), SQ (subcutaneous) are absent. This was called out in the 2026-04-03 audit note.
3. **SELF-ANSWERING**: 5 facts where the combining form appears verbatim in both question and answer (e.g. "What does ureter/o mean?" → "ureter"; "What does PT/INR stand for?" → "PT/INR").
4. **POOL-CONTAM in prefix_meanings_short vs prefix_meanings_long**: Pool split by "short" vs "long" answer length, but medterm_pre_gastr (answer "Stomach") lands in the short pool while some other short-form roots are in mid/long pools — length-based splits may be inconsistent.
5. **CHAIN THEMES MISSING**: No chain themes defined for a 700-fact knowledge deck.

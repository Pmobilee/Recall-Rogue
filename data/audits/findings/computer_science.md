# computer_science — Quiz Audit Findings

## Summary
87 quiz dump entries (29 facts × 3 mastery levels). Two soft SELF-ANSWERING concerns identified — both are inherent to the acronym expansion question format and assessed as MINOR rather than MAJOR. No structural failures, no broken grammar, no factual errors found in the sample.

## Issues

### MINOR

- **Fact**: `cs_4_ftp_expansion` @ mastery=0,2,4
- **Category**: `SELF-ANSWERING`
- **Rendered** (mastery=0):
  Q: "What does FTP stand for — the 1971 standard protocol for transferring files between a client and a server over a network?"
   A) Simple Mail Transfer Protocol
   B) Formula Translation
   C) File Transfer Protocol ✓
- **Issue**: The question description "protocol for transferring files" contains the words "Transfer" and "files" — both key words in the correct expansion "File Transfer Protocol." A player parsing the question can reconstruct parts of the answer from the context clue embedded in the question. This is inherent to the acronym expansion format (context must be given) but the overlap is stronger than average. Distractors are appropriate (SMTP and FORTRAN expansion are plausible wrong answers).

---

### NIT

- **Deck-level**: `computer_science`
- **Category**: `OTHER`
- **Issue**: `person_names_short` pool (94 factIds, 0 synthetics) is the largest fact pool in this batch. No length or sub-domain split. At mastery 4 with 5 options drawn from 94 names, the distractor quality will vary significantly depending on which 4 distractors are selected — some pairings (e.g., "Ada Lovelace" alongside "Guido van Rossum") are fine; others (e.g., domain experts from completely different fields) may seem implausible together.

## Expected vs Actual
Expected POOL-CONTAM between person and technology pools. Not observed in the 29-fact sample — the pool routing appeared correct. The acronym SELF-ANSWERING for `cs_4_ftp_expansion` was predicted and confirmed. `cs_4_bios_expansion` was initially flagged but cleared: "Basic Input/Output System" — none of those words appear verbatim in the question ("firmware...that initializes your PC hardware at boot"). The `person_names_short` NIT was confirmed structurally.

## Notes
- 29 facts use `_fallback` template — all render as coherent, professional English questions. No broken grammar detected across the sample.
- `bracket_numbers` pool (58 facts) includes both years and counts without type separation. In the sample, numeric distractors appeared plausible for their respective questions. Not flagged as active issue but remains a latent risk.
- No chain themes populated. Study Temple mechanic non-functional.
- Factual spot-checks: FTP standardized 1971 ✓, BIOS named by Gary Kildall 1975 ✓, Mark Zuckerberg launched TheFacebook at Harvard 2004 ✓.
- **Recommended fix**: Consider splitting `person_names_short` into sub-domain pools (pioneers, entrepreneurs, mathematicians) to improve distractor coherence at mastery 4.

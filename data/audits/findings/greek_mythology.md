# greek_mythology — Quiz Audit Findings

## Summary
90 quiz dump entries (30 facts × 3 mastery levels). Zero structural failures. Zero rendering errors. The deck is in excellent shape. Only stylistic (NIT-level) concerns found.

## Issues

### NIT

- **Fact**: `myth_poseidon_created_horses` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "Which god was said to have created the first horse by striking the earth with his trident?"
   A) Hephaestus
   B) Poseidon ✓
   C) Persephone
- **Issue**: "his trident" uses a masculine pronoun that eliminates Persephone and signals a male deity, narrowing the answer space at mastery 0 from 3 to 2 plausible candidates.

---

- **Fact**: `myth_demeter_harvest_seasons` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "Which goddess caused the seasons to exist by grieving when her daughter was taken to the Underworld?"
   A) Persephone
   B) Aphrodite
   C) Demeter ✓
- **Issue**: "Which goddess" restricts to female deities. Combined with "her daughter," any male deity distractor is trivially eliminable. However all three options at mastery 0 are female, so impact is low.

---

- **Fact**: `myth_antigone_burial` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "Which daughter of Oedipus defied King Creon's order and buried her brother Polyneices, accepting death as punishment?"
   A) Hector
   B) Antigone ✓
   C) Orpheus
- **Issue**: "Which daughter" explicitly gendered — eliminates the male distractors Hector and Orpheus without any knowledge. At mastery 0 with only 3 options, this is a meaningful tell.

## Expected vs Actual
Expected solid deck with possible hero_names length heterogeneity. Actual: cleaner than expected. The bracket_numbers pool (4 facts) is below minimum-5 but did not appear in the sampled entries. Hero_names pool produced no visible length tells in the sample.

## Notes
- 30 facts use `_fallback` template — all render coherently and produce natural English questions.
- `roman_equivalents` pool is well-structured and correctly isolated from the main deity pools; no cross-contamination detected.
- Deck has no `chainThemes` array populated despite being a knowledge deck. This means the Study Temple chain-theme mechanic cannot activate. Consider this a content-architecture gap to address separately.
- Overall: **Recommended for ship with no blocking changes.**

# world_literature — Quiz Audit Findings

## Summary
200 facts, 14 pools. Two structural pool problems dominate this deck. First, the `publication_years` pool is misnamed and contaminated: it contains line counts, structural counts (books, circles, tales), a calendar date, and years — seven incompatible numeric value types that cannot serve as plausible distractors for each other. Second, the `genre_form_names_short` pool is severely contaminated with semantically incompatible entries: "himself", "jealousy", "Old English", "Newspeak", "blank verse", "terza rima", "Epic poetry", "Old Comedy" — these cannot function as a coherent distractor set. Author name pools are well-populated and clean. Work title pools are correctly split and function well. Character name pools (short and long) function adequately with appropriate synthetics.

**Issue counts:** BLOCKER 0 / MAJOR 2 / MINOR 3 / NIT 2

---

## Issues

### MAJOR

- **Fact**: pool `publication_years` — all 11 facts
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=0, Iliad lines):
  Q: "How many lines does the Iliad contain in its standard edition?"
   A) 19,000  ← line count range
   B) 15693  ✓
   C) 13,000  ← line count range
- **Rendered** (mastery=2, Dante circles):
  Q: "How many circles of Hell does Dante describe in the Inferno?"
   A) 1
   B) 5
   C) 9  ✓
   D) 8
- **Issue**: The line-count question (15693) and the circles question (9) are in the same pool. At mastery 2–4, the engine draws from this pool. A player who sees "How many circles?" with options including 13,000 or 19,000 would find those trivially eliminable. The pool mixes: 5-digit line counts (15693), structural counts (9, 12, 24, 100, 250), years (1605, 1866, 1869), and a calendar date ("June 16", from the Ulysses Bloomsday fact). These seven subtypes cannot serve as mutual distractors.
- **Additional**: `lit_anc_homer_iliad_lines` is specifically misassigned to `publication_years` — a line count does not belong in a years pool regardless of pool contamination.

---

- **Fact**: pool `genre_form_names_short` — all facts
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=4, Beowulf language):
  Q: "In which language was the epic poem Beowulf originally composed?"
   A) Epic poetry  ← a genre, not a language
   B) Old English  ✓
   C) himself  ← Montaigne's subject pronoun
   D) jealousy  ← emotion/theme descriptor
   E) terza rima  ← verse form
- **Rendered** (mastery=4, Montaigne subject):
  Q: "What unusual subject did Montaigne declare to be the central focus of all his Essais?"
   A) Old Comedy  ← genre
   B) himself  ✓
   C) Newspeak  ← 20th-century coined word
   D) blank verse  ← verse form
   E) terza rima  ← verse form
- **Issue**: The `genre_form_names_short` pool mixes: languages ("Old English"), genre terms ("Epic poetry", "Old Comedy"), verse forms ("blank verse", "terza rima"), personal pronouns ("himself"), emotions or themes ("jealousy"), and invented words ("Newspeak"). When a question asks for a language, genre terms are eliminable. When a question asks for Montaigne's subject, "Newspeak" (a 1984 term) is absurdly anachronistic and trivially eliminable. The pool needs to be split into at minimum: `language_names`, `genre_terms`, `verse_form_names`.

---

### MINOR

- **Fact**: `lit_anc_homer_iliad_lines` (pool misassignment)
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How many lines does the Iliad contain in its standard edition?"
   A) 15693  ✓  (pool: publication_years)
- **Issue**: This fact is assigned to the `publication_years` pool but its answer (15693) is a line count, not a year. At mastery 0, the question functions (numerical distractors 13,000 and 19,000 are plausible line counts). But as the pool is shared with actual year facts (1605, 1866, 1869), future cross-pool contamination depends on the engine's distractor selection behavior. The misassignment should be corrected to a `count_values` or dedicated pool.

---

- **Fact**: `lit_anc_homer_iliad_books`, `lit_anc_virgil_aeneid_books`, `lit_anc_gilgamesh_tablets`, `lit_ren_dante_inferno_circles` in `publication_years`
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=2, circles question): Options include 1, 5, 9, 8 — all plausible counts, working correctly in isolation.
- **Issue**: Structural counts (9, 12, 24) function as plausible distractors for each other, but they coexist in the same pool as the Ulysses calendar date "June 16". If the engine ever serves "June 16" as a distractor for a circles-of-Hell question, it would be trivially eliminable. The JSONL sample did not show this cross-contamination materializing, but the structural risk is present.

---

- **Fact**: `lit_mod_joyce_ulysses_bloomsday` in `publication_years`
- **Category**: `POOL-CONTAM`
- **Rendered**: Q: "On what date does the entire action of James Joyce's Ulysses take place?"
  A) June 16  ✓  (pool: publication_years)
- **Issue**: "June 16" is a calendar date (day + month), not a year or a count. It cannot serve as a plausible distractor for any year question or count question. The fact belongs in a separate pool — perhaps `dates_events` or `literary_calendar_dates`. At mastery 0–2, numerical generation around "June 16" would produce nonsensical year ranges.

---

### NIT

- **Fact**: pool `work_titles_long` — 12 total (below threshold)
- **Category**: `SYNTHETIC-WEAK`
- **Rendered**: Pool has 11 facts + 1 synthetic = 12 total, below the recommended 15.
- **Issue**: At mastery 4 with 5 options needed, the pool is thin. Work titles like "One Thousand and One Nights", "A Midsummer Night's Dream", "The Hunchback of Notre-Dame" are in this pool — well-matched semantically, but limited variety means players will see the same distractor set repeatedly.

---

- **Fact**: `lit_ren_cervantes_author` and similar "greatest X ever written" facts
- **Category**: `AMBIGUOUS-Q`
- **Rendered**: Q: "Who is the Spanish author of Don Quixote, considered one of the greatest novels ever written?"
   A) Cervantes  ✓
- **Issue**: "considered one of the greatest novels ever written" is editorial in the stem. The author question is factual and not contestable, but 7 similar facts embed contestable superlatives in the question stem. Borderline — flagged as NIT since the answer is always unambiguously factual.

---

## Expected vs Actual
Expected publication_years contamination (confirmed, severe: 7 incompatible value types), genre_form_names_short contamination (confirmed: "himself", "jealousy", "Newspeak", verse forms, language names in one pool). Author-work contamination was expected in author_names pools but was not confirmed in the sample — the author pools appear clean. work_titles_long size issue confirmed. The "June 16" calendar date in a years pool was anticipated and confirmed.

## Notes
- `publication_years` pool should be refactored into: `year_values` (1605, 1866, 1869), `structural_count_values` (9, 12, 24, 100, 250), `line_count_values` (15693), and `literary_calendar_dates` (June 16). The pool name itself is misleading.
- `genre_form_names_short` should be split into: `language_names`, `literary_genre_terms`, `verse_form_names`. "himself", "jealousy", "Newspeak" do not belong in any of these and should be moved to bespoke single-use distractor lists on their respective facts.
- The author_names pools are a strength — well-populated with plausible same-era, same-tradition distractors (Greek authors for Greek questions, Renaissance for Renaissance, etc.).

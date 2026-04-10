# movies_cinema — Quiz Audit Findings

## Summary
277 facts, 10 pools. This is the largest deck in the batch. Core pools (director_names, film_titles, actor_names) are large and generate excellent distractors. Major issues are three confirmed BROKEN-GRAMMAR facts (word-replacement artifacts), serious POOL-CONTAM in film_trivia (6 semantically incompatible answer types in one pool), inconsistent film title formatting in the film_titles pool (some entries include director parentheticals, others do not — creating SYNONYM-LEAK and format tells), and one extreme LENGTH-TELL in bracket_counts. The ambiguous-Q superlative count (48 facts) is inflated because many Oscar-winner questions embed "greatest" in the question stem while having a factual correct answer.

**Issue counts:** BLOCKER 0 / MAJOR 4 / MINOR 3 / NIT 2

---

## Issues

### MAJOR

- **Fact**: `cinema_char_jack_torrance` @ mastery=0–4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "Which writer-turned-caretaker, played by this Nicholson in The Shining (1980), smashes through a door and shouts 'Here's Johnny!'?"
   A) Jack Torrance  ✓
   B) ...
- **Issue**: "played by this Nicholson" — "this" is a broken word-replacement artifact. The intended word was "Jack" (Jack Nicholson). The question is grammatically malformed at every mastery level.

---

- **Fact**: `cinema_char_rocky_balboa` @ mastery=0–4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "Which Philadelphia club boxer, played by Sylvester Stallone in this (1976), trains by running up museum steps and gets a shot at the world heavyweight title?"
   A) Rocky Balboa  ✓
- **Issue**: "in this (1976)" — "this" is a broken word-replacement artifact. The intended word was the film title "Rocky". Malformed at every mastery level.

---

- **Fact**: `cinema_hist_cinema_paradiso` @ mastery=0–4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "Which 1988 Italian film by Giuseppe Tornatore, scored by Ennio Morricone, is a nostalgic tribute to this itself set in a Sicilian village?"
   A) Cinema Paradiso  ✓
- **Issue**: "tribute to this itself" — "this" is a broken word-replacement artifact. Intended word was "cinema". Malformed at every mastery level.

---

- **Fact**: pool `film_trivia` — all 6 real facts
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=2, sample): "West Side Story (1961) was inspired by which Shakespeare play?"
   A) Harper Lee  ← (author name — correct answer for a different fact)
   B) Romeo and Juliet  ✓
   C) Heart of Darkness  ← (novella title)
   D) Moon River  ← (song title)
- **Issue**: The `film_trivia` pool contains answers of 6 incompatible semantic types: Shakespeare play names, song titles, author names, novella titles, car models, country names. At mastery 2+, distractors from completely different answer categories appear together, making the correct answer trivially identifiable by semantic type alone. "Harper Lee" is eliminable when the question asks for a Shakespeare play. "DeLorean" is eliminable when the question asks for a novella.

---

### MINOR

- **Fact**: pool `film_titles` — format inconsistency
- **Category**: `SYNONYM-LEAK`
- **Rendered** (mastery=2–4): Film_titles pool mixes "Psycho (Hitchcock)", "Jaws (Spielberg)", "Avatar (Cameron)", "Fargo (Coen Bros)" with plain titles "Star Wars", "Chinatown", "The Departed". When a plain-title question appears, parenthetical-titled distractors look visually different — minor format tell.
- **Issue**: Inconsistent answer format within a single pool. Some titles have director parentheticals added; others do not. The inconsistency makes parenthetical answers slightly easier to identify as distractors when the question asks for a plain title.

---

- **Fact**: `cinema_dir_cameron_grossing_rank` in pool `bracket_counts`
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "James Cameron's films have collectively grossed how much worldwide?"
   A) {5}
   B) {7}
   C) {30}
   D) {10,000,000,000}  ✓
- **Issue**: Correct answer "10,000,000,000" (ten billion) is massively longer than all other pool members ({4}, {5}, {7}, {30}). The length difference makes the correct answer trivially identifiable without any knowledge. Extreme LENGTH-TELL.

---

- **Fact**: pool `bracket_counts` total size = 10
- **Category**: `SYNTHETIC-WEAK`
- **Rendered**: Pool has only 10 members (4 real + 6 synthetic) — below recommended 15.
- **Issue**: Small pool with semantically mixed numeric answers (Oscar counts, billion-dollar grosses, film counts). Synthetic distractors may not be calibrated to the semantic scale of each sub-question.

---

### NIT

- **Fact**: `cinema_dir_spielberg_highest_grossing` and similar superlative questions
- **Category**: `AMBIGUOUS-Q`
- **Rendered**: Q: "Who is described as the highest-grossing film director of all time and a pioneer of the modern blockbuster?"
- **Issue**: "highest-grossing film director" is a quantitative claim and factually correct as sourced. The word "described as" makes this a citation question rather than a contestable opinion, but the question stem uses superlative framing that could be contested if box-office rankings change. VOLATILITY risk.

---

- **Fact**: Multiple Oscar-winner questions embedding "greatest film ever made"
- **Category**: `AMBIGUOUS-Q`
- **Rendered**: Q: "Who directed The Godfather (1972)...which became one of the greatest films ever made?"
- **Issue**: "Greatest films ever made" is editorial in the question stem but does not affect answer correctness (Francis Ford Coppola is factually the director). Borderline — the superlative is in the question stem, not the answer. The distractor options do not become eliminable as a result.

---

## Expected vs Actual
Expected: BROKEN-GRAMMAR (3 confirmed), POOL-CONTAM in film_trivia (confirmed), bracket_counts size issue (confirmed). Actual: all three broken-grammar facts confirmed, film_trivia pool contamination confirmed and worse than expected (6 incompatible answer types), bracket_counts size issue confirmed with extreme length-tell outlier. Film_titles pool format inconsistency was not anticipated but found.

## Notes
- The three BROKEN-GRAMMAR facts affect every mastery level rendering — they need direct question text repair, not pool changes.
- film_trivia pool should be dissolved: each fact reassigned to a semantically appropriate pool (author_names, work_titles, etc.) with appropriate distractors.
- The "{10,000,000,000}" answer in bracket_counts should be moved to a distinct "grossing_amounts" pool or reformatted as "$10 billion" to normalize with other numeric options.
- Film title format should be standardized: either all titles include director parentheticals, or none do.

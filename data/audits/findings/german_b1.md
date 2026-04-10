# german_b1 — Quiz Audit Findings

## Summary
867 facts, 90 quiz dump entries. POS-tell is elevated at B1 (6 instances in 90 entries ≈ 7% of sample) — highest German vocab deck rate. Pool-contamination continues (1 instance with both "old" and "out" as English distractors in a German-word slot). Self-answering (9 instances) and length-tell (15 instances) follow established patterns.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 16 (pool-contam: 1, POS-tell: 6, self-answering: 9) |
| MINOR | 17 (length-tell: 15, compound-answer: 2) |
| NIT | 0 |

---

## Issues

### MAJOR

- **Fact**: `de-cefr-2616` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'quarrel' in German?"
   A) examination
   B) old
   C) out
   D) Streit  ✓
- **Issue**: "old" (English adjective) and "out" (English particle) appear in a reverse-mode question expecting German words. "examination" is also English. Three of four distractors are English words — the correct answer "Streit" is identifiable as the only German word without any knowledge of the German vocabulary.

---

- **Fact**: `de-cefr-2903` @ mastery=0, 2, and 4
- **Category**: `POS-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'lauten' mean?"
   A) complicated
   B) to read  ✓
   C) to inform
- **Issue**: 2 infinitive verbs vs 1 adjective "complicated". The adjective is immediately eliminable. Note: "lauten" primarily means "to say/read (as written)" — the first listed meaning "to read" is also self-answering at mastery=4 (see below).

---

- **Fact**: `de-cefr-3070` @ mastery=0, 2
- **Category**: `POS-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'ärgerlich' mean?"
   A) annoying  ✓
   B) cleaning
   C) to sense
- **Issue**: 1 adjective ("annoying") vs 1 noun ("cleaning") vs 1 infinitive verb ("to sense"). Mixed POS across all three options — "annoying" is the only adjective when "ärgerlich" is clearly an adjective, making elimination possible.

---

- **Fact**: `de-cefr-2903` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "lauten — to be, to read (have a certain content or wording). Also: to sound, to ring..."
   A) to read  ✓  B) to bark  C) to inform  D) to travel there  E) complicated
- **Issue**: "to read" appears in the parenthetical "(have a certain content or wording)" — wait, not quite, but the explanation says "to read" as the second primary definition, so it appears verbatim in the definition_match question stem.

---

- **Fact**: `de-cefr-2387` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Gefahr — danger, hazard, peril, risk. Also: threat"
   A) danger  ✓  B) competence  C) job advertisement  D) federal chancellor  E) fat
- **Issue**: "danger" is the first word of the definition. Cognate self-answering: "Gefahr" translates to "danger" and the explanation leads with "danger".

---

- **Fact**: `de-cefr-2533` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Personal — staff, personnel, employees. Also: ellipsis of Personalabteilung ('hu...'"
   A) administration  B) staff  ✓  C) clever  D) economic miracle  E) enthusiasm
- **Issue**: "staff" appears as the first word of the definition.

---

- **Additional self-answering**: 6 more at mastery=4, all following the same pattern.
- **Additional POS-tell**: 3 more instances.

---

### MINOR

- **Fact**: `de-cefr-2387` @ mastery=2
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "How do you say 'danger' in German?"
   A) job advertisement  (17 chars)
   B) Gefahr  ✓  (6 chars)
   C) competence  (10 chars)
   D) fat  (3 chars)
- **Issue**: "fat" (3 chars) vs "job advertisement" (17 chars) — ratio 5.7×. English words of vastly different lengths appear as distractors in this reverse-mode question.

---

- **Fact**: `de-cefr-2387` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "Gefahr — danger, hazard, peril, risk. Also: threat"
   A) danger  ✓  B) competence  C) job advertisement  D) federal chancellor  E) fat
- **Issue**: "fat" (3 chars) vs "federal chancellor" (18 chars) — ratio 6×. "job advertisement" and "federal chancellor" are long English compound phrases competing against short words.

---

- **Fact**: `de-cefr-2696` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "How do you say 'die' in German?"
   A) screen  B) Würfel  ✓  C) dialect  D) resource  E) workplace accident
- **Issue**: "Würfel" (6 chars) vs "workplace accident" (18 chars) — ratio 3×. Note: the question "How do you say 'die' in German?" asks about the game die (cube), not the verb "to die" — the correct answer "Würfel" (cube/die) makes this a polysemy disambiguation. The question stem should clarify "(the cube)" to avoid confusion.

---

- **Fact**: `de-cefr-2669` @ mastery=0 and 4
- **Category**: `OTHER` (compound answer)
- **Rendered**:
  Q: "What does 'Volksfest' mean?"
   A) fair, festival  ✓  B) keyboard  C) team
- **Issue**: Comma-separated "fair, festival" against single-word distractors.

---

## Expected vs Actual
- Expected: B1 would have more self-answering than A1/A2 due to more complex cognates
- Actual: 9 instances at B1 (in 90 entries) vs 15 at A1 (in 180 entries) — roughly comparable rate when normalized
- Expected: POS-tell would be proportional to verb share
- Actual: B1 has the highest POS-tell rate of German decks (6/90 ≈ 7% of triples). B1 verb density is 231/867 ≈ 27% — similar to A2 (25%). The elevated rate may be due to B1 having more adjectives (66/867 ≈ 8%) and particles competing in the pool.

## Notes
- The `de-cefr-2696` "Würfel" (die/cube) question is ambiguous in English — "How do you say 'die' in German?" could mean the verb "sterben" or the noun "Würfel". This is a genuine AMBIGUOUS-Q concern, not just a length-tell.
- Pool-contamination at B1 shows "old" and "out" — both extremely common English words that have no place as German vocabulary distractors. The systemic nature of this bug (A1: "exam"/"new", A2: "bad"/"less", B1: "old"/"out") confirms it is engine-level, not content-level.

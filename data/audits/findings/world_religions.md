# world_religions — Quiz Audit Findings

## Summary
75 quiz dump entries (25 facts × 3 mastery levels). One MAJOR LENGTH-TELL issue and one NIT (duplicate pool ID). Cross-religion contamination was investigated and found to be functional at the distractor level — distractors from different religions appear but remain plausible wrong answers in context.

## Issues

### MAJOR

- **Fact**: `world_religions_bud_three_jewels` @ mastery=2,4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=2):
  Q: "What are the Three Jewels (or Three Refuges) that Buddhists take refuge in as the foundation of their practice?"
   A) Trimurti
   B) Diaspora
   C) Orishas
   D) Buddha, Dharma, Sangha ✓
- **Issue**: Correct answer "Buddha, Dharma, Sangha" (22 characters, comma-separated triple) is 2.75–3.1× longer than all distractors (7–8 characters each). At both mastery 2 and 4, the correct answer is the obvious visual outlier. Any player can identify the correct option purely by length without knowledge of Buddhist doctrine.

---

### NIT

- **Deck-level**: `world_religions`
- **Category**: `OTHER`
- **Issue**: Pool ID `religious_concept_names_long` is defined twice in `answerTypePools` (instance 0 = 22 factIds, instance 1 = 7 factIds). When a fact references this pool ID for distractor selection, runtime behavior is undefined — one instance will shadow the other, potentially making 7 facts unreachable as distractors. This is a structural defect in the JSON schema.

## Expected vs Actual
Expected significant POOL-CONTAM across religions. Actual: cross-religion distractors appear (e.g., Hindu Trimurti as distractor on a Buddhist question) but are plausible enough to function as wrong answers — they represent real concepts from other traditions. The LENGTH-TELL on `world_religions_bud_three_jewels` was predicted and confirmed. The duplicate pool ID was identified during structural analysis and confirmed.

## Notes
- 25 unique facts in sample; 25 use `_fallback` template. All rendered coherently.
- Cross-religion distractor mixing is present but acceptable: e.g., "Eid al-Adha" appearing as distractor for "Eid al-Fitr" question. This is appropriate intra-Islam difficulty.
- `holy_site_names_long` question `world_religions_jud_ten_commandments` pools correctly (asks about Mount Sinai, distractors are Vatican City and Varanasi — appropriate cross-tradition mix).
- No chain themes populated. Study Temple mechanic non-functional.
- **Fix priority**: (1) Split `world_religions_bud_three_jewels` into its own pool or rephrase the answer to a single concept word. (2) Deduplicate `religious_concept_names_long` pool ID.

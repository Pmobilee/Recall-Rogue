# Japanese N5 Grammar Deck — Provenance Documentation

**Deck ID**: `japanese_n5_grammar`
**Facts**: 375 fill-in-the-blank grammar facts
**Grammar Points**: ~90 foundational JLPT N5 patterns
**Source**: FJSD + standard textbook (CC BY-SA 4.0)
**Reference URL**: https://jlptsensei.com/jlpt-n5-grammar-list/

---

## 1. Deck Structure

| Pool | Facts |
|------|-------|
| particle_case | 114 |
| verb_form | 145 |
| sentence_ender | 60 |
| question_word | 22 |
| demonstrative | 15 |
| existence_pattern | 9 |
| adjective_form | 6 |
| request_permission | 4 |
| **grammar_all (master)** | **375** |

### Synonym Groups
| Group ID | Members | Reason |
|----------|---------|--------|
| syn_direction | particle-ni-location (5), particle-he (4) | に and へ interchangeable for direction |
| syn_but | conj-kedo (4), conj-keredomo (3) | けど/けれども are same word at different formality |
| syn_must | must-* facts (16), verb-cha-ikenai (4) | All express obligation/prohibition |
| syn_reason | reason-kara (5), reason-node (4) | から/ので both mean "because/since" |
| syn_why | qw-doshite (4) | どうして = why (listed for learner awareness) |

---

## 2. QA Fix History

### 2026-04-02 — QA Pass 1 (fix-qa.mjs run)

Script: `data/decks/_wip/japanese_n5_grammar/fix-qa.mjs`

**Fixes applied:**
1. **Synonym enforcement (direction)**: に direction facts (particle-ni-location, particle-ni-he, particle-he) — へ removed from distractors, added to acceptableAlternatives
2. **Indirect-object に cleanup**: particle-ni-indirect facts had へ as a distractor (incorrect — indirect object に is NOT a direction synonym). Removed へ from distractors on all 5 indirect-object facts.
3. **Reason synonym enforcement**: から/ので cross-contamination — removed from each other's distractors, added to acceptableAlternatives
4. **けど/けれども enforcement**: Removed cross-contamination from distractors, added to acceptableAlternatives
5. **conj-kedo / conj-keredomo pool fix**: Reassigned 7 facts from `particle_case` to `sentence_ender` (conjunctions are not case particles)
6. **particle-ka-fill-1 blank position**: Verified sentence-final か blank placement
7. **conj-soshite-fill-3 sentence**: Verified/fixed to natural 朝ごはん sentence
8. **particle-ni-indirect-fill-4 explanation**: Fixed to describe passive agent usage correctly
9. **dem-koko-soko-asoko-fill-2**: Verified correctAnswer=あそこ with matching targetLanguageWord
10. **syn_reason group**: Added/confirmed synonym group with 9 reason facts (から/ので)
11. **Pool rebuild**: grammar_all pool rebuilt to contain all 375 facts; particle_case rebuilt to 114 (removed 7 conjunctions), sentence_ender rebuilt to 60 (added 7 conjunctions)
12. **difficultyTiers rebuild**: Rebuilt from fact difficulty values

---

## 3. Known Remaining Issues

- `particle-ni-indirect` facts: The 5 facts cover indirect object, recipient, and passive agent uses of に. These are distinct from direction に but share the same grammar point group. Future pass could split these into more specific sub-categories.
- No te-form auxiliary conjugation table (unlike N3 deck).

---

## 4. Attribution

> Grammar data sourced from the Full Japanese Study Deck (CC BY-SA 4.0) and jlptsensei.com reference. Examples derived from standard JLPT N5 study materials.

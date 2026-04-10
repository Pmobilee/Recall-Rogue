# chinese_hsk6 — Quiz Audit Findings

## Summary
180 quiz entries (60 facts × 3 mastery levels). Systemic TEMPLATE_MISFIT and POOL_CONTAM continue. Most severe deck in the Chinese series for FACTUAL_SUSPECT: 200 strong contradictions where explanation and correctAnswer describe different meanings — not just alternate readings but fundamentally different concepts. Worst LENGTH_TELL ratio in the entire batch: 23× (哼 at 1 char vs 20+ char English phrases).

Counts: TEMPLATE_MISFIT×35, POOL_CONTAM×30, LENGTH_TELL×40, FACTUAL_SUSPECT×371 (deck-wide, 200 strong contradictions).

---

## Issues

### BLOCKER

- **Fact**: `zh-hsk-6405` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '修车'?"
   A) to repair a vehicle  ✓
   B) to leap
   C) to verify
   D) to tell
- **Issue**: Pinyin "xiū chē" absent. Template claims to test pronunciation, tests meaning.

---

- **Fact**: `zh-hsk-4561` @ mastery=4
- **Category**: `POOL_CONTAM` + `LENGTH_TELL`
- **Rendered**:
  Q: "How do you say 'to groan' in Chinese?"
   A) 哼  ✓ (1 char)
   B) to settle a bill (18)
   C) to pay New Year's visit (22)
   D) to stare blankly (16)
- **Issue**: Length ratio = 23×. One-character answer 哼 is trivially identifiable among multi-word English phrases.

---

- **Fact**: `zh-hsk-6953` @ mastery=4
- **Category**: `POOL_CONTAM` + `LENGTH_TELL`
- **Rendered**:
  Q: "How do you say 'conscientious' in Chinese?"
   A) peaceful (8)
   B) boundless (9)
   C) luxurious (9)
   D) 兢兢业业  ✓ (4 chars)
- **Issue**: Four-character chengyu against one-word English adjectives. Instantly identifiable by script.

---

- **Fact**: `zh-hsk-4436` (deck-wide FACTUAL_SUSPECT pattern)
- **Category**: `FACTUAL_SUSPECT`
- **Rendered** (forward template):
  Q: "What does '哦' (é) mean?"
   Correct: "oh; I see"
   Explanation: "哦 (é) — to chant."
- **Issue**: correctAnswer = "oh; I see" but explanation primary meaning = "to chant". The most common reading of 哦 is ó/ò (interjection) not é (to chant). The CC-CEDICT entry for reading é shows "to chant" but the answer tests the interjection reading. Student who reads the explanation after answering will be actively misinformed.

---

- **Fact**: `zh-hsk-4440`
- **Category**: `FACTUAL_SUSPECT`
- **Rendered**:
  Q: "What does '作' mean?"
   Correct: "to do; to make"
   Explanation: "作 (zuō) — worker. Also: workshop..."
- **Issue**: correctAnswer "to do; to make" describes zuò (fourth tone), but explanation describes zuō (first tone, workshop/worker sense). Fundamentally different meanings for different readings.

---

### MAJOR

- **Fact**: `zh-hsk-4834` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '割'?"
   A) to agree on sth
   B) to respond
   C) to keep improving
   D) to cut  ✓
   E) to sneer
- **Issue**: Five English verb phrases, no pinyin. The 5-option display at mastery=4 makes this worse — player cycles through more misleading options.

---

- **Fact**: `zh-hsk-6791` @ mastery=4
- **Category**: `POOL_CONTAM`
- **Rendered**:
  Q: "How do you say 'faultless' in Chinese?"
   A) 完备 (2 chars)  ✓
   B) criminal (8)
   C) proposal (8)
   D) secretary-general (17)
- **Issue**: Chinese two-char compound among English nouns of varying length. Length ratio = 8.5×.

---

### MINOR

- **Fact**: `zh-hsk-4438` (POS pattern)
- **Category**: `OTHER`
- **Rendered**:
  Q: "What does '如' (rú) mean?"
   Correct: "as"
   partOfSpeech: "noun"
- **Issue**: 如 is a conjunction/preposition meaning "as; like; if". Labeled "noun". 45 such cases in this deck.

---

- **Fact**: `zh-hsk-4443`
- **Category**: `FACTUAL_SUSPECT`
- **Rendered**:
  Q: "What does '嘛' (má) mean?"
   Correct: "obviously; you know"
   Explanation: "嘛 (má) — used in 吽..."
- **Issue**: 嘛 as sentence-final particle (ma, neutral tone) means "obviously/you know", but CC-CEDICT's má entry describes a Buddhist sound. Completely different usage documented in explanation vs. answer.

---

### NIT

- **Fact**: `zh-hsk-4437`
- **Category**: `TEMPLATE_MISFIT` + `OTHER`
- **Rendered**:
  Q: "What does '啦' (lā) mean?"
   Correct: "exclamatory particle"
   Explanation: "啦 (lā) — (onom.) sound of singing..."
- **Issue**: correctAnswer "exclamatory particle" is a metalinguistic label (like HSK2's "interjection"). The more common lā reading (la, neutral tone) is the sentence-final particle meaning "really!; come on!" — not what the explanation describes.

---

## Expected vs Actual
- **Expected**: correctAnswer and explanation describe the same reading/meaning of the character.
- **Actual**: CC-CEDICT alternate-reading entries cause explanation to describe a different meaning or reading than what the answer tests. 200 strong contradictions in 2,666 facts (7.5%).
- **Expected**: Reverse template → Chinese character options only.
- **Actual**: 1–4 char Chinese options vs 8–22 char English phrases; worst LENGTH_TELL in entire batch.

## Notes
- The FACTUAL_SUSPECT rate at HSK6 (371 mismatches, 200 strong contradictions) is categorically more serious than in HSK1–5. At mastery level 6, students trusting explanations to deepen understanding will receive incorrect information about a meaningful fraction of vocabulary items.
- Root cause: CC-CEDICT entries for polysemous characters list all readings; the data import selected the "first" or most common reading for correctAnswer but pulled the explanation from a different reading's entry.
- The chengyu/idiom entries (4-char set phrases like 兢兢业业) are at highest risk: their English translations are long phrases, maximizing LENGTH_TELL severity.

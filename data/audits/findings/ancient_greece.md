# ancient_greece — Quiz Audit Findings

## Summary
Ancient Greece is a high-quality, well-researched deck with strong narrative facts and good explanations. The dominant issue is systemic POOL-CONTAM in the `historical_phrases_long` pool: 87 semantically disparate answers compete as distractors, producing option sets where distractors from completely different domains appear next to each other ("Scientific history", "Died in prison from gangrene", "The Macedonian phalanx" as distractors for a Battle-of-Salamis fact). This is visible in every `historical_phrases_long` question. At mastery 0 (only 2 distractors rendered), the issue is masked, but at mastery 4 (4 distractors), the pool contamination is prominent. No broken rendering or factual errors detected in the 30-fact sample. The single BLOCKER-candidate is the POOL-CONTAM pattern which affects ~35% of all facts.

## Issues

### MAJOR

- **Fact**: `greece_pw_artemisia` @ mastery=2 and mastery=4
- **Category**: `POOL-CONTAM`, `SYNTHETIC-WEAK`
- **Rendered** (mastery 4):
  Q: "At the Battle of Salamis, what did the Persian commander Artemisia I of Caria do that made Xerxes exclaim 'My men have become women; and my women, men'?"
   A) Died in prison from gangrene
   B) Rammed a friendly ship to escape ✓
   C) Scientific history
   D) The Macedonian phalanx
   E) Companion Cavalry
- **Issue**: Distractors B/C/D/E are incoherent phrases from unrelated sub-pools within `historical_phrases_long`. "Scientific history", "The Macedonian phalanx", and "Companion Cavalry" are not plausible answers to this question. A player can trivially identify the correct answer by elimination even without domain knowledge.

- **Fact**: `greece_pw_sparta_carneia` @ mastery=2 and mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 4):
  Q: "What prevented Sparta from marching to help Athens at Marathon in 490 BCE...?"
   A) Everything flows (panta rhei)
   B) He cut it with his sword
   C) The Carneia festival ✓
   D) Hecatomb (100 oxen)
   E) Barred from attending or competing
- **Issue**: "Everything flows (panta rhei)" is a philosophy maxim; "He cut it with his sword" is clearly a narrative action; "Barred from attending or competing" is a clause from a different context. These share a pool with "The Carneia festival" but are semantically incompatible as co-distractors for this question.

- **Fact**: `greece_ph_protagoras_man_measure` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 4):
  Q: "What famous relativist maxim is attributed to the sophist Protagoras...?"
   A) One cloak per year
   B) Man is the measure of all things ✓
   C) Barred from attending or competing
   D) Silver mines at Laurion
   E) League of Corinth
- **Issue**: "One cloak per year" (Spartan clothing), "Silver mines at Laurion", "League of Corinth" are all answers from entirely different topic areas. "Barred from attending or competing" sounds like a rule, not a maxim. The correct answer is easily identified.

- **Fact**: `greece_pw_marathon_commander` @ mastery=0 and mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 2):
  Q: "Which Athenian general commanded the Greek forces at the Battle of Marathon...?"
   A) Theodosius I ← Byzantine/Roman emperor, wrong era
   B) Aristotle ← philosopher, not a general
   C) King Porus ← Indian king (enemy of Alexander)
   D) Miltiades ✓
- **Issue**: Theodosius I (a Roman emperor, 4th century CE) and King Porus (a Mauryan king who fought Alexander) are from different domains and eras entirely. At mastery 2, all three distractors are from the `ruler_general_names` pool but pulled from wildly different periods and contexts. A player knowing even basic history can eliminate by era. CATEGORY-TELL risk: Aristotle (a philosopher) in a "which general..." question is an obvious non-answer.

- **Fact**: `greece_cs_themistocles_fate` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 0):
  Q: "After saving Greece at the Battle of Salamis, what ultimately happened to Themistocles...?"
   A) Rammed a friendly ship to escape
   B) Ostracized; later served Persia ✓
   C) Over 20 cities
- **Issue**: "Rammed a friendly ship to escape" is the answer to the Artemisia question — these two `historical_phrases_long` answers are semantically incompatible as co-options for a question about Themistocles' fate. "Over 20 cities" is a count-style answer. Moderate confusion risk.

- **Fact**: `greece_ph_democritus_laughing` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 0):
  Q: "...known by what affectionate nickname in antiquity..."
   A) Plague of Athens
   B) Fight in narrow straits
   C) The Laughing Philosopher ✓
- **Issue**: "Plague of Athens" and "Fight in narrow straits" are historical events/descriptions, not nicknames. At mastery 0 this is laughably easy.

### MINOR

- **Fact**: `greece_pw_sicinnus_deception` @ mastery=0
- **Category**: `SYNTHETIC-WEAK`
- **Issue**: With only 2 distractors (Herostratus, Dienekes), both are obscure Greek names from the same pool — adequate but Dienekes appears again as a co-distractor for the Thermopylae fact in the same session. Pool cross-contamination across nearby questions.

- **Fact**: `greece_cs_agoge_entry_age` — all mastery levels
- **Category**: No issue. Numeric distractors (4, 12, 20, 21) are well-chosen plausible alternatives. PASS.

- **Fact**: `greece_pw_thermopylae_fight_shade` — all mastery levels
- **Category**: `POOL-CONTAM` (minor at mastery 0–2)
- **Issue**: Distractors Alcibiades and Croesus are at least historically Greek, making this more plausible than some. The mastery=4 addition of Artabanus (a Persian figure) is slightly out-of-domain for a "which Spartan soldier..." question.

## Expected vs Actual

**Expected**: `historical_phrases_long` pool of 87 facts would produce POOL-CONTAM across ~35% of deck.
**Actual**: Confirmed across every `historical_phrases_long` fact sampled. "Scientific history", "Died in prison from gangrene", "The Macedonian phalanx", "Companion Cavalry", "Hecatomb (100 oxen)", "Over 20 cities", "Fight in narrow straits" all appearing as distractors for contextually incompatible questions.

**Expected**: Date pool distractors should be plausibly close years.
**Actual**: Date pool not sampled in this dump (only 30 facts shown, none from `date_events`). Unable to verify.

**Expected**: Chain themes absent (all chainThemeId=0).
**Actual**: Confirmed — no chainThemes array in deck. Sub-deck grouping exists but chain-based quiz mechanics will use fallback.

## Notes
- Factual accuracy appears high throughout; no suspicious claims detected in the 30-fact sample.
- The `ruler_general_names` pool contains legitimate Greek-world figures (Sicinnus, Dienekes, Alcibiades, Artabanus, Croesus, Miltiades, Roxane, King Porus, Theodosius I, Aristotle). The non-Greek entries (Theodosius I, King Porus, Aristotle, Roxane) make contextually inappropriate distractors for "which Greek general" questions.
- No broken grammar, no empty fields, no placeholders detected.
- Do NOT flag: The wording "Barred from attending or competing" — this is a legitimate phrase from the context of the Olympic Games, just a poor pool-mate for the Carneia question.

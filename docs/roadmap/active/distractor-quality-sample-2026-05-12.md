# Distractor Quality Sample — 2026-05-12

> **Purpose:** Quick homogeneity scan for the alpha-readiness handoff. This is a sample, not a full deck audit.

## Method

Sampled 50 Trivia Dungeon facts from `public/facts.db`, split across seven
domains: history, geography, natural sciences, general knowledge, art and
architecture, animals and wildlife, and human body and health.

Sampled 30 curated-deck facts from three representative decks:
`computer_science`, `medical_terminology`, and `japanese_n5_grammar`.

Each fact was checked for obvious answer-choice heterogeneity: mixed numeric
and non-numeric answers, mixed short terms and sentence-like phrases, or a
grammar/vocab token set where one distractor belongs to a visibly different
template shape.

## Results

| Source | Sample | Fails | Fail rate | Recommendation |
|---|---:|---:|---:|---|
| Trivia DB | 50 | 4 | 8.0% | Targeted regen for failing facts |
| Curated decks overall | 30 | 2 | 6.7% | Targeted regen for failing facts |
| `computer_science` | 10 | 0 | 0.0% | Ship this sample |
| `medical_terminology` | 10 | 0 | 0.0% | Ship this sample |
| `japanese_n5_grammar` | 10 | 2 | 20.0% | Targeted grammar-template cleanup |

Overall signal: not a deck-level emergency, but the fail rate is high enough
to justify a targeted regeneration pass for flagged facts and a second sample
afterward. The quick scan does not support a full global distractor regen.

## Fail Examples

| Source | Fact ID | Question | Choices | Why it fails |
|---|---|---|---|---|
| Trivia DB / history | `history-carl-jung-freud-heir-split` | What prestigious position did Freud appoint Jung to before their split? | President of the IPA; Director of the Vienna Clinic; Chair of Zurich Psychiatry; Head of German Psychology | One option is a longer institutional role while the others are compact title-like distractors. |
| Trivia DB / history | `apush_p2_middle_passage` | What term describes the horrific transatlantic voyage of enslaved Africans from West Africa to the Americas, the second leg of the triangular trade? | Middle Passage (slave ship route); Atlantic Crossing; Slave Route; Black Atlantic | Correct answer includes a parenthetical explanation, making it stand out. |
| Trivia DB / geography | `geography-singapore-expelled-malaysia` | How did Singapore become an independent country in 1965? | Expelled from Malaysia; Won a referendum; Declared independence; Was granted freedom by Britain | One distractor is a full passive clause while the others are short event labels. |
| Trivia DB / human body health | `pharm-cns-hydromorphone-nursing` | What is the most critical nursing safety consideration for hydromorphone? | HIGH ALERT: 5-7x more potent than morphine; Monitor INR weekly; Hold if HR < 60; Strict tyramine-free diet | Choices mix a warning statement, lab monitoring, vitals instruction, and diet rule. |
| `japanese_n5_grammar` | `ja-gram-n5-n5-adv-mada-fill-2` | {___}日本語が上手じゃないです。 | まだ; てから; まだ〜ていません; 前に | One distractor is a multi-part grammar template while the others are short insertable tokens. |
| `japanese_n5_grammar` | `ja-gram-n5-n5-verb-te-kara-fill-0` | 結婚し{___}も私働いていいわよ。 | てから; もう; まだ〜ていません; 前に | Same issue: one template-shaped distractor is visibly different from the short slot fillers. |

## Notes

The originally reported “213 cases” stroke question was not part of this
sample because it had only one choice before the content fix. Its root cause
was an empty distractor array in `src/data/seed/knowledge-human_body_health.json`;
that is tracked separately in the alpha-readiness task work.

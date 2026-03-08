# Batch 002 Summary

## Verdict Table

| Question | Title | Verdict | Report |
|---|---|---|---|
| Q01 | First-Contact Fact Retention | PASS | q01-first-contact-retention.md |
| Q02 | SM-2 Interval Accuracy Over 7 Days | INCONCLUSIVE | q02-sm2-interval-accuracy.md |
| Q03 | Distractor Interference | INCONCLUSIVE | q03-distractor-interference.md |
| Q04 | Vocab vs General Fact Mastery Pace | PASS | q04-vocab-vs-general-mastery.md |
| Q05 | Leech Detection Sensitivity | PASS | q05-leech-detection.md |
| Q06 | Morning/Evening Ritual Adherence | PASS | q06-ritual-adherence.md |
| Q07 | Knowledge Tree as Motivation Anchor | PASS | q07-knowledge-tree-motivation.md |
| Q08 | Pop Quiz Frequency Sweet Spot | PASS | q08-quiz-frequency.md |
| Q09 | Quiz Interruption Impact on Flow State | PASS | q09-quiz-flow-interruption.md |
| Q10 | Consistency Penalty Fairness | PASS | q10-consistency-penalty.md |
| Q11 | Layer Entrance Quiz Pressure | PASS | q11-layer-entrance-quiz.md |
| Q12 | Artifact Boost Quiz Value Perception | PASS | q12-artifact-boost-quiz.md |
| Q13 | Quiz Streak Motivation | INCONCLUSIVE | q13-quiz-streak.md |
| Q14 | Difficulty Weighting by Depth | INCONCLUSIVE | q14-difficulty-by-depth.md |
| Q15 | Three-Button Grading Clarity | PASS | q15-three-button-grading.md |
| Q16 | Study Session Length Satisfaction | PASS | q16-session-length.md |
| Q17 | Card Ordering and Cognitive Load | PASS | q17-card-ordering.md |
| Q18 | GAIA Study Feedback Helpfulness | PASS | q18-gaia-feedback.md |
| Q19 | New Card Introduction Pacing | PASS | q19-new-card-pacing.md |
| Q20 | O2 Pacing and Tension Curve | PASS | q20-o2-pacing.md |
| Q21 | Layer Progression Depth vs Breadth | PASS | q21-depth-vs-breadth.md |
| Q22 | Artifact Discovery Rate and Excitement | PASS | q22-artifact-discovery.md |
| Q23 | Risk/Reward Balance on Hazards | PASS | q23-hazard-balance.md |
| Q24 | Mining + Learning Integration Cohesion | PASS | q24-integration-cohesion.md |
| Q25 | Return Visit Drivers | PASS | q25-return-visit-drivers.md |

## Confirmed Bugs / Risks

- **HIGH**: Consistency + layer quiz penalties compound O2 loss in deep runs (Q10/Q11/Q14).
- **HIGH**: Vocab vs general mastery pacing mismatch risk under current dual thresholds (Q4).
- **MEDIUM**: Quiz interruption still risks flow break when bursts occur (Q8/Q9).
- **MEDIUM**: Leech recovery path depends heavily on mnemonic quality and remains fragile (Q5/Q18).
- **MEDIUM**: New-card freshness degrades as backlog climbs near throttle threshold (Q19).

## Recommended Balance Changes

| Variable | Current | Recommended | Rationale |
|---|---:|---:|---|
| `SM2_MASTERY_INTERVAL_VOCAB` | 30 | 35-45 | Q4 shows vocab may need longer runway for stable retention. |
| `CONSISTENCY_PENALTY_O2` | 8 | 5-6 | Q10/Q11 indicate deep-layer penalty stacking can feel punitive. |
| `QUIZ_BASE_RATE` | 0.08 | 0.07-0.10 | Q8/Q9 suggest current range is close but sensitive to burst timing. |
| `LAYER_ENTRANCE_WRONG_O2_COST` | 10 | 6-8 | Q11 pressure is meaningful but can spike at low remaining O2. |
| `NEW_CARDS_PER_SESSION` | 3 | 3-5 adaptive | Q19 indicates freshness tradeoff under high backlog days. |

## Top 5 Actionable Findings

1. Tune penalty stacking (consistency + layer quiz) before deeper-layer balance passes.
2. Revisit vocab mastery threshold and hinting for vocab items with persistent lapses.
3. Improve quiz flow smoothing: reduce burst interruptions near high-tension mining moments.
4. Strengthen mnemonic quality and leech intervention around lapseCount 4-6.
5. Make new-card throttle adaptive to preserve freshness without backlog spikes.

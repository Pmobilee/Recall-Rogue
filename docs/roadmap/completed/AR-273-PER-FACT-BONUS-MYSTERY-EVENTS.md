# AR-273: Per-Fact Bonus System + Full Mystery Event Mechanics

## Overview
Complete the 4 remaining mystery events with their full research-doc mechanics using per-fact damage bonuses and meditation distractor reduction.

## Infrastructure
1. Add `damageBonus: number` to InRunFactState (default 0, applied as multiplier in cardEffectResolver)
2. Add `meditatedThemeId?: number` to RunState (reduces distractors by 1 for that theme)

## Events
1. Tutor's Office — quiz + flag answered facts with +30% bonus for 2 encounters
2. Flashcard Merchant — study UI showing facts + apply +20% bonus for rest of run
3. Wrong Answer Museum — show wrong facts from InRunFactTracker, study each for gold
4. Meditation Chamber — show accuracy by theme, choose one for -1 distractor

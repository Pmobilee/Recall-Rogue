# Game Mechanics Conventions

## Damage & Combat
- All damage is integer (floored after multipliers)
- Block absorbs before HP, resets to 0 each turn unless Fortify
- Card effects resolve through damage pipeline (`cardEffectResolver.ts`, GDD §15.5) — never bypass
- Chain multipliers stack multiplicatively with charge/buff/relic multipliers

## Card Play Values
- Quick Play = quickPlayValue + masteryBonus (1.0× effective)
- Charge Correct = (quickPlayValue + masteryBonus) × 1.5 — mastery included BEFORE multiplier
- Charge Wrong = FIZZLE_EFFECT_RATIO (0.25×) — NEVER zero, always resolves
- +1 AP surcharge for Charging, waived during Surge turns and Chain Momentum

## Mastery Scaling (2-3× targets, rebalanced 2026-03-31)
- perLevelDelta varies per mechanic, targeting 2-3× base at max level
- Modest (1.5-2×): cards with strong tags/secondaries (bash, absorb, precision_strike)
- Solid (2-2.5×): bread-and-butter cards (strike, block, piercing)
- Great (2.5-3×): high-risk/conditional cards (reckless, volatile_slash, gambit)
- Tier-based damage multipliers REMOVED — all active tiers = 1.0×
- Catch-up mastery: newly acquired cards start at 0.5-1.5× deck avg mastery (see catchUpMasteryService.ts)

## Surge System
- Surge every 4th global turn (turns 2, 6, 10, 14...)
- Counter persists across encounters — uses `RunState.globalTurnCounter`
- Do NOT reset per encounter

## Facts & Cards
- Facts assigned at charge-commit time, NOT draw time
- Cards in hand show mechanic + chain theme only, no fact content until charged
- `chargeCorrectValue` field exists but is DEAD DATA — never read by game code

## Knowledge Systems
- FSRS tiers (1/2a/2b/3) for long-term knowledge retention — NO damage scaling (all 1.0×)
- Card slot mastery (0-5) for in-run power scaling (resets each run) — PRIMARY damage scaling axis
- Two modes: Trivia Dungeon (broad pool, no repeats), Study Temple (curated deck, FSRS-weighted)
- Confusion matrix persistent across runs, drives distractor selection

## Deck Types
- Vocabulary decks: generic chain types (Obsidian, Crimson, etc.)
- Knowledge decks: named themed chains, ≥3 themes, facts quiz from theme sub-pool when charged

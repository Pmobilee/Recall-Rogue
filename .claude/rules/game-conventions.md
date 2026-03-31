# Game Mechanics Conventions

## Damage & Combat
- All damage is integer (floored after multipliers)
- Block absorbs before HP, resets to 0 each turn unless Fortify
- Card effects resolve through damage pipeline (`cardEffectResolver.ts`, GDD §15.5) — never bypass
- Chain multipliers stack multiplicatively with charge/buff/relic multipliers

## Card Play Values
- Quick Play = 1.0× base damage
- Charge Correct = 1.5× + mastery bonus
- Charge Wrong = 0.6× (mastery 0) or 0.7× (mastery 1+) — NEVER zero, NEVER "fizzle"
- +1 AP surcharge for Charging, waived during Surge turns and Chain Momentum

## Surge System
- Surge every 4th global turn (turns 2, 6, 10, 14...)
- Counter persists across encounters — uses `RunState.globalTurnCounter`
- Do NOT reset per encounter

## Facts & Cards
- Facts assigned at charge-commit time, NOT draw time
- Cards in hand show mechanic + chain theme only, no fact content until charged
- `chargeCorrectValue` field exists but is DEAD DATA — never read by game code

## Knowledge Systems
- FSRS tiers (1/2a/2b/3) for long-term knowledge retention
- Card slot mastery (0-5) for in-run power scaling (resets each run)
- Two modes: Trivia Dungeon (broad pool, no repeats), Study Temple (curated deck, FSRS-weighted)
- Confusion matrix persistent across runs, drives distractor selection

## Deck Types
- Vocabulary decks: generic chain types (Obsidian, Crimson, etc.)
- Knowledge decks: named themed chains, ≥3 themes, facts quiz from theme sub-pool when charged

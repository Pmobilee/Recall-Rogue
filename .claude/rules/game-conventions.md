# Game Mechanics Conventions

## Damage & Combat
- All damage is integer (floored after multipliers)
- Block absorbs before HP, resets to 0 each turn unless Fortify
- Card effects resolve through damage pipeline (`cardEffectResolver.ts`, GDD §15.5) — never bypass
- Chain multipliers stack multiplicatively with charge/buff/relic multipliers

## Card Play Values
- Quick Play = `getMasteryStats(mechanicId, level).qpValue` (explicit per-level value)
- Charge Correct = `qpValue × CHARGE_CORRECT_MULTIPLIER (1.75)`
- Charge Wrong = `Math.max(0, mechanic.chargeWrongValue + masteryBonus)` — floored at 0
- CHARGE_AP_SURCHARGE = 0 (charging is free in AP)
- Surge turns and Chain Momentum still waive surcharge (no-op while surcharge is 0)

## Mastery Stat Tables (2026-04-03 overhaul, replaces perLevelDelta)
- `MASTERY_STAT_TABLES` in `cardUpgradeService.ts` — 96 mechanics with full L0-L5 stat tables
- `getMasteryStats(mechanicId, level)` is the unified API — returns `MasteryLevelStats`
- Each level defines: qpValue, apCost?, secondaryValue?, drawCount?, hitCount?, tags?, extras?
- Cards start WEAKER at L0 (strike QP=3, block QP=3) and grow through mastery
- Creative milestones at L3/L5: new effects, AP cost reductions, hit count changes
- Old `getMasteryBaseBonus()` / `perLevelDelta` is @deprecated — fallback bridge still works
- CC is ALWAYS computed as `qpValue × 1.75`, never stored in stat tables
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

# AR-94: Humanize All Player-Facing Text

**Status:** In Progress
**Created:** 2026-03-18

## Overview

Run the humanizer skill across all player-facing text to remove AI writing patterns. Based on Wikipedia's "Signs of AI writing" guide — 24 pattern categories. Every description, dialogue line, tooltip, and narrative string should sound like a human wrote it.

## Priority Files (Tier 1-2)

- [ ] **1** `src/data/gaiaDialogue.ts` — GAIA NPC dialogue (150+ lines)
- [ ] **2** `src/data/enemies.ts` — Enemy descriptions, intent text
- [ ] **3** `src/data/mechanics.ts` — Card mechanic descriptions
- [ ] **4** `src/data/cavernTexts.ts` — Cavern wall inscriptions, journal entries
- [ ] **5** `src/data/quoteStones.ts` — GAIA commentary on quotes
- [ ] **6** `src/data/relics.ts` — Relic descriptions and lore
- [ ] **7** `src/data/weeklyChallenges.ts` — Challenge titles/descriptions
- [ ] **8** `src/data/specialEvents.ts` — Special event text
- [ ] **9** `src/data/steamAchievements.ts` — Achievement names/descriptions
- [ ] **10** `src/ui/components/OnboardingCutscene.svelte` — Opening narration
- [ ] **11** `src/ui/components/RunEndScreen.svelte` — Run result text
- [ ] **12** `src/data/biomes.ts` — Biome descriptions

## Rules
- Use the humanizer skill (24 AI pattern checks + final audit pass)
- Preserve game terminology (Charge, Quick Play, Chain, AP, etc.)
- Match the game's dark fantasy/adventure tone
- Keep text concise — mobile screens, small fonts
- Don't change variable names, only string literals
- Run typecheck after each batch

## Verification
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds

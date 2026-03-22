# AR-212: Art Studio — Card & Relic Sprite Generation Prompts

**Source:** docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md — all new cards and relics
**Priority:** Medium (does not block gameplay, only visuals)
**Estimated complexity:** Medium
**Depends on:** AR-208 (all cards finalized), AR-211 (all relics finalized)
**Blocks:** Nothing (art generation is async via ComfyUI)

## Overview

Create sprite generation prompts for all 60 new card art pieces and 36 new relic icons, and queue them in the Art Studio pipeline. Prompts must follow existing art style conventions: pixel art, simple, memorable, visually distinct, easy to read at mobile card sizes. This AR does NOT generate the art — it prepares the prompts and adds them to `artstudio-items.json` so the user can run generation when ready.

Workers MUST read existing art prompts in `sprite-gen/cardback-tool/artstudio-items.json` to understand the style, format, and naming conventions before writing new prompts.

## TODO

### Research

- [x] 1. Analyze existing card art prompts for style patterns
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`, `src/assets/` (existing sprites)
  **What:** Read all existing card art and relic icon prompts. Document:
  - Prompt structure (keywords, style tags, negative prompts)
  - Resolution targets (width x height)
  - Color palette patterns (do card types have color themes?)
  - Naming conventions (file paths, prefixes)
  - What makes the best existing sprites work (simplicity, silhouette readability)
  **Acceptance:** Style guide documented for prompt writing.

### Card Art Prompts (60 new cards)

- [x] 2. Write prompts for Filler cards (8)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Add prompts for: Power Strike, Twin Strike, Iron Wave, Reinforce, Shrug It Off, Bash, Guard, Sap. Each prompt should:
  - Evoke the card's mechanic visually (Twin Strike = two slashes, Guard = large shield, etc.)
  - Use the established pixel art style tags
  - Be simple enough to read at 64x64 or similar card art size
  - Have a distinct silhouette from existing similar cards (Power Strike must look different from Strike)
  **Acceptance:** 8 prompts added to artstudio-items.json with correct metadata.

- [x] 3. Write prompts for Bleed archetype cards (3)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Rupture, Lacerate, Hemorrhage. Visual theme: red, sharp, bleeding wounds, serrated edges. Each must be visually distinct from each other.
  **Acceptance:** 3 prompts added, all sharing a red/blood visual language.

- [x] 4. Write prompts for Burn archetype cards (3)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Kindle, Ignite, Entropy. Visual theme: orange, flames, embers, heat shimmer. Distinct from existing fire-themed sprites.
  **Acceptance:** 3 prompts added, all sharing an orange/fire visual language.

- [x] 5. Write prompts for Chain archetype cards (3)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Chain Lightning, Chain Anchor, Synapse. Visual theme: electric blue, chain links, connected nodes, lightning. Must read as "chain/connection" at small sizes.
  **Acceptance:** 3 prompts added with chain visual language.

- [x] 6. Write prompts for Quiz/Knowledge cards (6)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Gambit, Curse of Doubt, Mark of Ignorance, Knowledge Ward, Dark Knowledge, Knowledge Bomb. Visual theme: mystical knowledge, books, glowing runes, question marks, brain imagery. These are the game's identity cards — they should feel unique to Recall Rogue.
  **Acceptance:** 6 prompts added, all evoking "knowledge as power."

- [x] 7. Write prompts for Exhaust cards (2)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Volatile Slash, Burnout Shield. Visual theme: cracking, shattering, one-use intensity. Should look "powerful but fragile."
  **Acceptance:** 2 prompts added.

- [x] 8. Write prompts for Utility/Wild cards (15)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Absorb, Reactive Shield, Sift, Scavenge, Precision Strike, Stagger, Overcharge, Warcry, Battle Trance, Frenzy, War Drum, Mastery Surge, Phase Shift, Chameleon, Unstable Flux. Mix of tactical, buff, and shape-shifting visuals. Each must have a unique silhouette.
  **Acceptance:** 15 prompts added.

- [x] 9. Write prompts for Advanced cards (14)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Smite, Feedback Loop, Recall, Siphon Strike, Hemorrhage, Eruption, Bulwark, Conversion, Ironhide, Tutor, Recollect, Siphon Knowledge, Reflex, Archive. Mix of powerful/rare visual themes.
  **Acceptance:** 14 prompts added.

- [x] 10. Write prompts for Wild/Copy cards (4)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Catalyst, Mimic, Aftershock, Sacrifice. Visual theme: transformation, duplication, echoes. Mimic should look shape-shifty. Sacrifice should look costly.
  **Acceptance:** 4 prompts added.

- [x] 11. Write prompts for Inscription cards (3)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Inscription of Fury, Inscription of Iron, Inscription of Wisdom. Visual theme: glowing runes carved into stone/metal, permanent/eternal feel. Should look distinct from regular cards — more "artifact" than "action."
  **Acceptance:** 3 prompts added with inscription visual language.

- [x] 12. Write prompts for remaining cards (2)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Prompts for: Corroding Touch, Corrode. Visual theme: acid, decay, dissolution. Green/yellow toxic feel.
  **Acceptance:** 2 prompts added.

### Relic Icon Prompts (36 new relics)

- [x] 13. Write prompts for Common relics (5)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Icon prompts for: Quick Study, Thick Skin, Tattered Notebook, Battle Scars, Brass Knuckles. Relic icons should be simpler than card art — single object, clear silhouette, recognizable at small (32x32) sizes.
  **Acceptance:** 5 relic icon prompts added.

- [x] 14. Write prompts for Uncommon relics (12)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Icon prompts for: Pocket Watch, Chain Link Charm, Worn Shield, Bleedstone, Ember Core, Gambler's Token, Thoughtform, Scar Tissue, Surge Capacitor, Obsidian Dice, Living Grimoire, Gladiator's Mark. Mix of items, artifacts, and abstract concepts.
  **Acceptance:** 12 relic icon prompts added.

- [x] 15. Write prompts for Rare relics (15)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Icon prompts for: Red Fang, Chronometer, Soul Jar, Null Shard, Hemorrhage Lens, Archive Codex, Berserker's Oath, Chain Forge, Deja Vu, Inferno Crown, Mind Palace, Entropy Engine, Bloodstone Pendant, Chromatic Chain, Dragon's Heart. These should look more impressive/ornate than Common/Uncommon — rare items should feel rare.
  **Acceptance:** 15 relic icon prompts added with "rare" visual quality.

- [x] 16. Write prompts for Legendary + Cursed relics (6)
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Icon prompts for: Omniscience, Paradox Engine, Akashic Record, Singularity, Volatile Manuscript, Dragon's Heart (if not already in Rare batch). Legendary items should look spectacular — glowing, ethereal, clearly special. Cursed relics (Paradox Engine, Volatile Manuscript) should look dangerous — dark energy, unstable, warning colors.
  **Acceptance:** 6 prompts added with appropriate legendary/cursed visual language.

### Verification

- [x] 17. Validate all prompts in artstudio-items.json
  **Files:** `sprite-gen/cardback-tool/artstudio-items.json`
  **What:** Verify:
  - All 60 card IDs have corresponding prompts
  - All 36 relic IDs have corresponding prompts
  - No duplicate entries
  - All prompts follow the established style format
  - File is valid JSON
  **Acceptance:** 96 new entries in artstudio-items.json, all valid.

- [x] 18. Create a generation checklist
  **Files:** `docs/roadmap/phases/expansion/art-generation-checklist.md` (new)
  **What:** Create a checklist the user can work through to generate all sprites. Group by: Filler cards → Bleed cards → Burn cards → Chain cards → etc. Include the ComfyUI command pattern for each batch.
  **Acceptance:** Checklist exists with all 96 items organized by batch.

## Testing Plan

1. JSON validation: artstudio-items.json parses correctly
2. Cross-reference: every new mechanic ID in mechanics.ts has a matching art prompt
3. Cross-reference: every new relic ID in relicData.ts has a matching icon prompt
4. Style consistency: spot-check prompts against existing ones for format match

## Verification Gate

```bash
node -e "JSON.parse(require('fs').readFileSync('sprite-gen/cardback-tool/artstudio-items.json'))"
# Must not throw
```

## Files Affected

| File | Change Type |
|------|------------|
| `sprite-gen/cardback-tool/artstudio-items.json` | Add 96 new prompt entries |
| `docs/roadmap/phases/expansion/art-generation-checklist.md` | New file |

## Doc Updates Required

- None (art is tracked via artstudio-items.json, not game design docs)

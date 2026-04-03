---
name: game-design-sync
description: Enforce that docs/GAME_DESIGN.md stays perfectly in sync with every gameplay change. This skill is ALWAYS ACTIVE and must be checked after any code change that touches gameplay, balance, UI, mechanics, enemies, rooms, cards, relics, or player-facing systems.
user_invocable: false
---

# Game Design Document Sync — ALWAYS ACTIVE

## The Rule

**`docs/GAME_DESIGN.md` is the single source of truth for how the game works.** Every gameplay change MUST be reflected in this document. Stale docs are treated as bugs with the same priority as broken tests.

## ACTIVE ENFORCEMENT — Not Passive

This skill doesn't just check after changes — it ACTIVELY URGES completeness:
- **Before ANY gameplay code change**: Check if the affected element exists in the GDD. If not, add it as part of the same task.
- **After ANY worker completes**: Verify the GDD section matches the new code. If it doesn't, spawn a follow-up worker IMMEDIATELY.
- **On every session start**: If gameplay files were modified since the last GDD update, flag the staleness.

## Data File → GDD Section Mapping

| Source File | GDD Section | What to Document |
|-------------|-------------|------------------|
| `src/data/enemies.ts` | §8 Enemy Design | All enemies: HP, intents, traits, phases, quiz phases |
| `src/data/relics/starters.ts` | §16 Relic System | All starter relics: name, rarity, effect, trigger, synergies |
| `src/data/relics/unlockable.ts` | §16 Relic System | All unlockable relics: name, rarity, effect, unlock level |
| `src/data/statusEffects.ts` | §4.5 Status Effects | All status types: stacking, decay, triggers, formulas |
| `src/data/mechanics.ts` | §6 Card Mechanics | All 91 card mechanics with values |
| `src/data/balance.ts` | Inline throughout | Balance constants referenced where used |
| `src/services/ascension.ts` | §27 Ascension Mode | All 20 levels with challenge + buff |
| `src/data/domainMetadata.ts` | §28 Fact Database (Domain List) | All knowledge domains |
| `src/game/scenes/CombatScene.ts` | §2 Card Combat | Turn flow, UI interactions, combat animation orchestration, mood/chain/knowledge visual wiring |
| `src/services/turnManager.ts` | §2 Card Combat | Turn resolution, damage pipeline |
| `src/services/enemyManager.ts` | §8 Enemy Design | Enemy AI, intent selection |
| `src/services/relicEffectResolver.ts` | §16 Relic System | Relic trigger mechanics |
| `src/services/cardUpgradeService.ts` | §5 Card Tiers / §6 Mechanics | Mastery upgrade paths |
| `src/game/systems/DungeonMoodSystem.ts` | §5.6 VFX Systems | Continuous mood state modulating atmosphere |
| `src/game/systems/ForegroundParallaxSystem.ts` | §5.6 VFX Systems | Per-biome foreground depth layer |
| `src/data/foregroundElements.ts` | §5.6 VFX Systems | Foreground element pool configs per biome |

## Per-Element Checklists

### When Adding/Modifying an Enemy
- [ ] Entry exists in §8 with correct HP, intents, traits
- [ ] Combat traits listed in §4.5 "Enemy Combat Traits" if applicable
- [ ] Sprite/animation noted in §5.5 if visual changes
- [ ] Quiz phase documented if boss
- [ ] `data/inspection-registry.json` updated

### When Adding/Modifying a Relic
- [ ] Entry exists in §16 with name, rarity, effect, synergies
- [ ] Listed under correct archetype category
- [ ] Build Archetypes table updated if it enables a new build
- [ ] Trigger type matches code (on_damage_taken, on_chain_complete, etc.)
- [ ] `data/inspection-registry.json` updated

### When Adding/Modifying a Card Mechanic
- [ ] Entry exists in §6 with baseValue, chargeCorrectValue, AP cost
- [ ] Card type noted (attack/shield/buff/debuff/utility/wild)
- [ ] Special Charge bonus documented if any
- [ ] §2 "Charge Damage Pipeline" updated if damage formula changes

### When Adding/Modifying a Status Effect
- [ ] Entry exists in §4.5 reference table
- [ ] Stacking, decay, and trigger rules documented
- [ ] Balance constants from balance.ts cited

### When Changing Balance Constants
- [ ] All GDD sections referencing the changed constant updated
- [ ] Key Numbers Reference (end of GDD) updated

### When Adding/Modifying Ascension Levels
- [ ] §27 table row exists with challenge + buff
- [ ] Cumulative modifier notes updated

## Completeness Audit Commands

```bash
# Count enemies in code vs GDD
echo "Code:" && grep -c "^  {" src/data/enemies.ts && echo "GDD:" && grep -c "^\*\*.*\`.*\`.*—" docs/GAME_DESIGN.md

# Count relics in code
echo "Starters:" && grep -c "id:" src/data/relics/starters.ts && echo "Unlockable:" && grep -c "id:" src/data/relics/unlockable.ts

# Check for stale enemy names in GDD that don't match code IDs
grep -oP '\`\w+\`' docs/GAME_DESIGN.md | sort -u
```

## What Triggers a Doc Update

ANY change that touches:
- New/modified mechanic, card type, enemy, status effect, relic, or system
- Modified balance values, damage numbers, heal amounts, costs
- Changed UX flow, screen transitions, room behavior
- Enemy additions, renames, ability changes
- Card reward system changes
- Ascension modifier changes
- Map/node distribution changes
- New UI components that are player-facing
- Quiz system changes

## What Does NOT Require an Update

- Internal refactors that don't change player-facing behavior
- Bug fixes that restore already-documented behavior
- Test-only changes
- Build/tooling/CI changes
- Sprite asset changes (unless they affect documented behavior)

## GDD Section Quick Reference

| Topic | GDD Section |
|-------|-------------|
| Core philosophy | §1 |
| Card combat, turn structure | §2 |
| Knowledge chains | §3 |
| Curated deck system | §3.5 |
| Knowledge surge | §4 |
| Status effects & combat buffs | §4.5 |
| Inscription keyword | §4.6 |
| Card tiers & mastery | §5 |
| Combat visuals & sprites | §5.5 |
| VFX systems | §5.6 |
| Card mechanics (91) | §6 |
| Run progression & rooms | §7 |
| Enemy design (89 enemies) | §8 |
| Run meta-progression | §13 |
| Relic system (90 relics) | §16 |
| Juice & game feel | §18 |
| Sound design | §19 |
| Accessibility | §20 |
| Daily expedition | §21 |
| Japanese language decks | §22 |
| FSRS integration | §23 |
| Deck selection | §24 |
| Monetization | §25 |
| Post-run summary | §26 |
| Ascension mode (20 levels) | §27 |
| Fact database | §28 |
| Content quality pipeline | §29 |

## Enforcement

- Every worker prompt MUST include the instruction to update GAME_DESIGN.md
- The orchestrator MUST verify docs after every worker task
- **If a worker completed a gameplay change without updating docs**: spawn a follow-up worker BEFORE marking the task done
- **Workers update docs in the SAME task as code** — never as a separate follow-up

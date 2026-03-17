# AR-63: Enemy Sprite Reconciliation — Replace Spriteless Enemies

## Overview
**Goal**: Remove 12 spriteless enemies added during V2 and preserve 5 unique mechanics by transplanting them into existing sprited enemies.
**Dependencies**: None
**Complexity**: Low — single file changes in enemies.ts

## Sub-Steps

### Step 1: Transplant 5 unique mechanics into existing sprited enemies
In `src/data/enemies.ts`, replace the intent pools, HP, special abilities, and descriptions of these 5 existing enemies while keeping their `id`, `name`, `region`, `animationArchetype`, and sprite references:

**1. fossil_guardian → gets the_examiner mechanics**
- Keep: id=fossil_guardian, name="Fossil Guardian", animationArchetype, region
- Replace with: category=elite, baseHp=55, onPlayerNoCharge: applies +3 strength (999 turns), intent pool from the_examiner
- New description: "An ancient fossil guardian that punishes lazy play. Gains +3 Strength every turn you don't Charge."
- Intent pool: Attack(10) w3 "Examiner's strike", Buff(3) w2 "Academic rigor" str+1 2turns, Attack(8) w1 "Pop quiz"

**2. void_mite → gets the_scholar mechanics**
- Keep: id=void_mite, name="Void Mite", animationArchetype, region
- Replace with: category=common, baseHp=40, rarity=standard, spawnWeight=10, onPlayerChargeCorrect: heals 5 HP (capped), intent pool from the_scholar
- New description: "A parasitic void creature that feeds on correct knowledge. Heals 5 HP when you answer correctly — Quick Play to deny healing, or Charge for the multiplier."
- Intent pool: Attack(6) w3 "Academic strike", Defend(8) w2 "Study shield", Heal(5) w1 "Knowledge recovery"

**3. mantle_dragon → gets the_nullifier mechanics**
- Keep: id=mantle_dragon, name="Mantle Dragon", animationArchetype, region
- Replace with: category=elite, baseHp=70, chainMultiplierOverride=1.0, intent pool from the_nullifier
- Remove: immuneDomain, phaseTransition, phase2Pool
- New description: "A dragon that negates Knowledge Chain multipliers. All chain stacking is nullified to 1.0x while it lives."
- Intent pool: Attack(14) w3 "Nullification strike", Debuff(2) w2 "Chain disruption" weakness+1 2turns, Attack(12) w2 "Void impact", Defend(8) w1 "Null barrier"

**4. core_harbinger → gets the_librarian mechanics**
- Keep: id=core_harbinger, name="Core Harbinger", animationArchetype, region
- Replace with: category=elite, baseHp=65, quickPlayImmune=true, intent pool from the_librarian
- Remove: phaseTransition, phase2Pool
- New description: "A core entity immune to Quick Play damage. Only Charged plays deal damage. Forces Charge discipline under duress."
- Intent pool: Attack(12) w3 "Tome strike", Buff(2) w2 "Study buff" str+2 3turns, Attack(10) w2 "Shelf sweep", Defend(10) w1 "Book barrier"

**5. venomfang → gets timer_wyrm mechanics**
- Keep: id=venomfang, name="Venomfang", animationArchetype, region
- Replace with: category=mini_boss, baseHp=45, onEnemyTurnStart: starting turn 4 gains +5 bonus damage permanently, intent pool from timer_wyrm
- New description: "A temporal serpent that grows deadlier each turn. Survive until turn 4 and it enrages — +5 more damage permanently each subsequent turn."
- Intent pool: Attack(12) w3 "Serpent lunge", Attack(10) w2 "Tail whip", Debuff(1) w1 "Venom bite" vulnerable+1 2turns

### Step 2: Remove 12 spriteless enemy definitions
Delete these enemy definitions entirely from `src/data/enemies.ts`:
- dusk_bat, cave_bat_alpha, iron_golem, poison_bloom, dark_shade, grave_warden, lore_keeper
- the_examiner, the_scholar, the_nullifier, the_librarian, timer_wyrm

### Step 3: Update ACT_ENEMY_POOLS
- Remove all 12 deleted enemy IDs from every pool they appear in
- Ensure fossil_guardian stays in Act 2 elites
- Ensure void_mite stays in Act 3 commons
- Ensure mantle_dragon stays in Act 3 elites
- Ensure core_harbinger stays in Act 3 elites
- Ensure venomfang stays in Act 1 miniBosses

### Step 4: Verify no dangling references
- Search for any remaining references to removed enemy IDs in the entire codebase
- Update `src/data/spriteKeys.ts` if needed (it shouldn't need changes since the kept enemies already have sprites)

## Files Affected
- `src/data/enemies.ts` — Primary changes (transplant mechanics, delete definitions, update pools)

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all unit tests pass
- [ ] No references to removed enemy IDs remain in codebase
- [ ] ACT_ENEMY_POOLS contain only enemies that exist in ENEMY_TEMPLATES

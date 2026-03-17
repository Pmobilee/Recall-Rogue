# AR-61: V2 Polish & Integration Fixes

## Overview

Post-v2 overhaul integration cleanup. Parallel agent work created several gaps:
enemy pools are too narrow (only 12 enemies instead of all 88), drag-release
threshold logic has a dead zone, the CHARGE button is misaligned, and other
small UI/data issues. This AR fixes all of them.

**Dependencies**: AR-59 (v2 combat system) must be complete.
**Complexity**: Low-medium — data fixes + CSS tweaks + one logic guard.

---

## Sub-steps

### 1. Expand ACT_ENEMY_POOLS to all 88 enemies

**File**: `src/data/enemies.ts`

Replace the narrow `ACT_ENEMY_POOLS` with full region-mapped pools:

- **Act 1** (shallow_depths):
  - commons: `cave_bat, crystal_golem, toxic_spore, mud_crawler, root_strangler, iron_beetle, limestone_imp, cave_spider, peat_shambler, fungal_sprout, blind_grub, cave_bat_alpha, dusk_bat, iron_golem, poison_bloom`
  - elites: `ore_wyrm, cave_troll`
  - miniBosses: `venomfang, root_mother, iron_matriarch, bog_witch, mushroom_sovereign, timer_wyrm`
  - bosses: `the_excavator, magma_core`

- **Act 2** (deep_caverns + the_abyss):
  - commons: all deep_caverns commons + all the_abyss commons
    - `shadow_mimic, bone_collector, basalt_crawler, salt_wraith, coal_imp, granite_hound, sulfur_sprite, magma_tick, deep_angler, rock_hermit, gas_phantom, stalactite_drake, ember_moth, dark_shade, grave_warden, obsidian_shard, magma_slime, quartz_elemental, fossil_raptor, geode_beetle, lava_crawler, crystal_bat, void_mite, ash_wraith, prismatic_jelly, ember_skeleton`
  - elites: `the_examiner, fossil_guardian, magma_serpent, basalt_titan, geode_king, abyssal_leviathan, crystal_lich`
  - miniBosses: `crystal_guardian, stone_sentinel, sulfur_queen, granite_colossus, deep_lurker, lava_salamander, ember_drake, shade_stalker, obsidian_knight, quartz_hydra, fossil_wyvern, magma_broodmother`
  - bosses: `the_archivist, crystal_warden, shadow_hydra, void_weaver`

- **Act 3** (the_archive):
  - commons: `pressure_djinn, core_worm, biolume_jellyfish, tectonic_scarab, mantle_fiend, iron_core_golem, glyph_sentinel, archive_moth, rune_spider, void_tendril, tome_mimic, the_scholar, lore_keeper`
  - elites: `mantle_dragon, core_harbinger, the_nullifier, the_librarian`
  - miniBosses: `primordial_wyrm, iron_archon, pressure_colossus, biolume_monarch, tectonic_titan, glyph_warden, archive_specter`
  - bosses: `knowledge_golem, the_curator`

**Acceptance Criteria**: `getEnemiesForNode(1, 'combat')` returns 15 enemies; act 2 commons returns 26; act 3 has 7 miniBosses.

---

### 2. Verify background segment mapping

**File**: `src/data/backgroundManifest.ts`

`getRandomCombatBg` already uses `getSegment(floor)` which maps floors to segments 1-5. The v2 acts map to floors:
- Act 1 = floors 1-8 → segment 1 (shallow-depths) ✓
- Act 2 = floors 9-16 → segments 2-3 (deep-caverns + the-abyss) ✓
- Act 3 = floors 17-24 → segment 4 (the-archive) ✓

No change needed — already working. Verify `getSegment` in `floorManager.ts`.

---

### 3. Fix drag threshold — release below 80px cancels (no charge, no quick play)

**File**: `src/ui/components/CardHand.svelte`

Current `handlePointerUp` logic:
- `deltaY > 80` → Charge Play ✓
- `deltaY > 60` → Quick Play (wrong — this 60-80 zone should cancel)
- `!wasDrag` → tap select ✓
- below all → return to hand ✓

Fix: remove the `60-80px = Quick Play` branch entirely. The spec says:
- Release above 80px = Charge Play
- Tap (no drag) = select/quick-play via button
- Everything else = cancel (return to hand)

The `else if (deltaY > 60)` branch that calls `oncastdirect` must be removed.

**Acceptance Criteria**: Dragging up 61px and releasing returns card to hand with no action.

---

### 4. Fix CHARGE button horizontal centering

**File**: `src/ui/components/CardHand.svelte`

Current inline style:
```
style="transform: translate3d({xOffset}px, calc(-80px - var(--card-h)), 0) translateX(-50%);"
```

The `translateX(-50%)` is chained after `translate3d` but does NOT self-center because the button's left edge starts at 0 in the container. The button needs to be centered over the card (which is `--card-w` wide).

Fix: add `left: calc(var(--card-w) / 2)` via a CSS var approach, or change positioning to use `calc` on xOffset to account for half the button width:

```svelte
style="left: calc({xOffset}px + var(--card-w) / 2); transform: translateY(calc(-80px - var(--card-h))) translateX(-50%);"
```

Or simpler — the button is `position: absolute` in the `.card-hand-container` which is `left: 50%; translateX(-50%)` centered. The `xOffset` already centers the card. We need to position the button so it centers on the card:

```svelte
style="transform: translate3d(calc({xOffset}px + var(--card-w) / 2), calc(-80px - var(--card-h)), 0) translateX(-50%);"
```

**Acceptance Criteria**: CHARGE button appears horizontally centered above the selected card.

---

### 5. Verify Block counter visibility

**File**: `src/ui/components/CardCombatOverlay.svelte`

The block badge renders when `playerShield > 0`, where `playerShield = turnState?.playerState.shield`. The shield logic in `playerCombatState.ts` correctly tracks `state.shield`. This appears correct in code.

Quick-play a Block card (`id: 'block'`, `mechanicId: 'block'`) and confirm `turnState.playerState.shield` increases. If the display still doesn't appear, check `cardEffectResolver.ts` to confirm `shieldApplied` is set for shield-type cards.

No code change needed unless investigation reveals a bug. Document findings.

---

## Files Affected

- `src/data/enemies.ts` — expand `ACT_ENEMY_POOLS`
- `src/ui/components/CardHand.svelte` — fix drag threshold (remove 60-80px branch) + fix CHARGE button centering

## Verification Gate

- [x] `npm run typecheck` — 0 errors
- [x] `npm run build` — passes
- [x] `getEnemiesForNode(1, 'combat').length === 15` — confirmed (15 shallow_depths commons)
- [x] `getEnemiesForNode(2, 'combat').length === 26` — confirmed (15 deep_caverns + 11 the_abyss)
- [x] `getEnemiesForNode(3, 'boss').length === 2` — confirmed (knowledge_golem, the_curator)
- [x] Drag threshold 60-80px branch removed — only >80px triggers charge
- [x] CHARGE button centering fixed — uses `calc({xOffset}px + var(--card-w) / 2)` + `translateX(-50%)`
- [ ] Block card quick-play shows shield counter in HP bar — needs runtime verification

## Implementation Notes

- Step 2 (background mapping): No change needed. `getRandomCombatBg` already uses `getSegment(floor)` which correctly maps act floors to segments.
- Step 5 (block display): Code is correct in `CardCombatOverlay.svelte`. The `player-block-badge` renders when `playerShield > 0`. Issue is likely a runtime/testing matter, not a code bug.

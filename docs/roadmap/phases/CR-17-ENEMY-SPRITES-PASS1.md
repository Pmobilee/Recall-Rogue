# CR-17: Enemy Sprites Pass 1

> Phase: P2 — Art Pipeline + First Asset Pass
> Priority: HIGH
> Depends on: CR-14 (NB1 art pipeline)
> Estimated scope: S

Generate sprite sets for the 2 most common enemies: Cave Bat and Crystal Golem. Each enemy gets 3 poses: idle, hit, death. These are the enemies players encounter most frequently on early floors.

## Design Reference

From `src/data/enemies.ts`:

- **Cave Bat** (`cave_bat`): common, 15 HP. "A common cave-dwelling bat. Quick but fragile." Fast attack pattern.
- **Crystal Golem** (`crystal_golem`): common, 40 HP. "A slow golem encrusted with resonating crystals." Tank with shield.

From `docs/GAME_DESIGN.md` (Combat Display):

> Enemies appear in the top 55% display zone (Phaser canvas). Common enemies use 48x64 virtual pixel sprites.

### Enemy Sprite Prompt Template

Style suffix (append to every enemy prompt):

```
full body visible with padding around edges, standing in a neutral pose, pixel art sprite, 32-bit era JRPG style, hand-pixeled, 48x64 pixel character scaled up, clean hard pixel edges, limited color palette, 4-5 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background
```

### Cave Bat (3 sprites)

| Pose | Full Prompt | Filename |
|------|------------|----------|
| Idle | "A large golden pale bat, flying ominously, wings spread wide" + style suffix | `cave_bat_idle.png` |
| Hit | "A large golden pale bat, recoiling from impact, slight knockback pose, brief pain expression" + style suffix | `cave_bat_hit.png` |
| Death | "A large golden pale bat, crumbling apart, defeated and collapsing, breaking into pieces" + style suffix | `cave_bat_death.png` |

**Cave Bat palette:** golds, ambers, dark wing membranes, warm yellows.

### Crystal Golem (3 sprites)

| Pose | Full Prompt | Filename |
|------|------------|----------|
| Idle | "A crystal golem made of purple and blue minerals, hulking, arms at sides" + style suffix | `crystal_golem_idle.png` |
| Hit | "A crystal golem made of purple and blue minerals, recoiling from impact, slight knockback pose, cracks visible" + style suffix | `crystal_golem_hit.png` |
| Death | "A crystal golem made of purple and blue minerals, crumbling apart, defeated and collapsing, shattering into crystal shards" + style suffix | `crystal_golem_death.png` |

**Crystal Golem palette:** purples, blues, dark gray stone base. Explicitly no green elements (green screen conflict).

### Dimensions

48x64 virtual pixels. Generate at native NB1 resolution, then process:

1. Green screen chroma key removal
2. Auto-crop
3. Nearest-neighbor downscale to 96x128 (2x) — primary output
4. Nearest-neighbor downscale to 48x64 (1x) — lo-res variant

## Implementation

### Data Model

No new TypeScript types needed. Sprites are static assets loaded by Phaser's asset loader.

Add 6 entries to `sprite-gen/arcane-prompts.json`:

```json
{
  "id": "cave_bat_idle",
  "category": "enemies",
  "prompt": "A large golden pale bat, flying ominously, wings spread wide, full body visible with padding around edges, standing in a neutral pose, pixel art sprite, 32-bit era JRPG style, hand-pixeled, 48x64 pixel character scaled up, clean hard pixel edges, limited color palette, 4-5 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background",
  "output": "public/assets/sprites/enemies/cave_bat_idle.png",
  "dimensions": { "virtual": "48x64", "output_2x": "96x128", "output_1x": "48x64" }
}
```

Repeat for all 6 enemy sprites, swapping the pose-specific prompt.

### Logic

**Generation order (consistency strategy):**

1. Generate `cave_bat_idle.png` first as Cave Bat reference
2. Generate `cave_bat_hit.png` and `cave_bat_death.png` including the same character description as idle
3. Generate `crystal_golem_idle.png` as Crystal Golem reference
4. Generate `crystal_golem_hit.png` and `crystal_golem_death.png` including the same character description as idle
5. If hit/death pose deviates from idle for either enemy, regenerate with more explicit style matching

**Post-processing pipeline (per sprite):**

```
NB1 raw output
  → chroma key green screen removal (tolerance: same as CR-14 pipeline)
  → auto-crop to bounding box + 2px padding
  → nearest-neighbor resize to 96x128 (2x)
  → save to public/assets/sprites/enemies/{name}.png
  → nearest-neighbor resize to 48x64 (1x)
  → save to public/assets/sprites/enemies/1x/{name}.png
```

### UI

No new Svelte components. The sprites are consumed by Phaser's CombatScene.

**CombatScene integration (idle sprites only for this CR):**

- Replace the colored rectangle enemy placeholder with the appropriate idle sprite based on `enemyId`
- Load via `this.load.image('cave_bat_idle', 'assets/sprites/enemies/cave_bat_idle.png')` etc. in scene preload
- Enemy sprite selection: map `enemy.id` to the corresponding idle sprite key
- Hit and death pose swapping will be wired in a future combat animation CR

### System Interactions

- **Sprite generation pipeline (CR-14):** Uses the same NB1 + green screen removal + resize pipeline.
- **Enemy definitions (`src/data/enemies.ts`):** Sprites map to enemy IDs (`cave_bat`, `crystal_golem`). No changes to enemy data needed.
- **Phaser CombatScene:** Idle sprites replace rectangle placeholders. Future CRs wire hit/death animations.
- **Sprite registry:** All 6 sprites registered in `sprite-gen/sprite-registry.json`.
- **Asset loading:** Sprites in `public/assets/sprites/enemies/` served by Vite's static asset handling.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Bat wings clip to edge of frame | Regenerate with "padding around edges" emphasis |
| Golem too similar to a rock/background | Increase contrast, add glowing crystal accents in prompt |
| Green crystals on golem conflict with green screen | Specify "purple and blue crystals, no green elements" in prompt |
| Death pose looks too similar to hit | Exaggerate death: "fully collapsed, shattered" |
| Size disparity between bat and golem too extreme | Ensure both fit within 48x64 virtual space consistently |
| Cave Bat reads as generic bird at 48x64 | Emphasize bat-specific features: "leathery wings, pointed ears, fangs visible" |
| Crystal Golem crystals look like armor | Emphasize mineral nature: "made entirely of crystal formations, geological, mineral body" |

## Visual Inspection Steps (MANDATORY)

1. Create sprite lineup: all 3 Cave Bat poses side by side, then all 3 Crystal Golem poses
2. Take Playwright screenshot at mobile viewport (Pixel 7 emulation)
3. Verify: consistent proportions per enemy across all 3 poses, clean outlines, no green fringing
4. Verify: Cave Bat and Crystal Golem are visually distinct from each other
5. Verify: poses readable at 48x64 (1x) size
6. Test idle sprites in Phaser CombatScene as enemy sprite replacement (screenshot + snapshot)

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `sprite-gen/arcane-prompts.json` | Add 6 enemy sprite entries |
| Create | `public/assets/sprites/enemies/cave_bat_idle.png` | Cave Bat idle (96x128) |
| Create | `public/assets/sprites/enemies/cave_bat_hit.png` | Cave Bat hit (96x128) |
| Create | `public/assets/sprites/enemies/cave_bat_death.png` | Cave Bat death (96x128) |
| Create | `public/assets/sprites/enemies/crystal_golem_idle.png` | Crystal Golem idle (96x128) |
| Create | `public/assets/sprites/enemies/crystal_golem_hit.png` | Crystal Golem hit (96x128) |
| Create | `public/assets/sprites/enemies/crystal_golem_death.png` | Crystal Golem death (96x128) |
| Create | `public/assets/sprites/enemies/1x/cave_bat_idle.png` | Cave Bat idle (48x64) |
| Create | `public/assets/sprites/enemies/1x/cave_bat_hit.png` | Cave Bat hit (48x64) |
| Create | `public/assets/sprites/enemies/1x/cave_bat_death.png` | Cave Bat death (48x64) |
| Create | `public/assets/sprites/enemies/1x/crystal_golem_idle.png` | Crystal Golem idle (48x64) |
| Create | `public/assets/sprites/enemies/1x/crystal_golem_hit.png` | Crystal Golem hit (48x64) |
| Create | `public/assets/sprites/enemies/1x/crystal_golem_death.png` | Crystal Golem death (48x64) |
| Modify | `sprite-gen/sprite-registry.json` | Register all 6 enemy sprites |

## Done When

- [ ] 6 enemy sprites generated (3 per enemy) via NB1 pipeline
- [ ] Cave Bat and Crystal Golem are visually distinct from each other
- [ ] Each enemy's 3 poses share consistent character design (proportions, colors, silhouette)
- [ ] Green screen cleanly removed (especially careful with Crystal Golem's blue/purple crystals)
- [ ] Output at 96x128 (2x) and 48x64 (1x) resolutions
- [ ] Enemies readable and identifiable at 48x64 (1x) size
- [ ] Sprite lineup screenshot taken via Playwright
- [ ] All 6 registered in sprite-registry.json
- [ ] Idle sprites tested in Phaser CombatScene (replace placeholders)

# CR-18: Boss Sprite — The Excavator

> Phase: P2 — Art Pipeline + First Asset Pass
> Priority: HIGH
> Depends on: CR-14 (NB1 art pipeline)
> Estimated scope: S

Generate sprite set for the first boss: The Excavator. Boss sprites are larger than common enemies to convey threat and importance. 3 poses: idle, hit, death.

## Design Reference

From `src/data/enemies.ts`:

- **The Excavator** (`the_excavator`): boss, 60 HP. "A corrupted mining machine, still drilling after millennia." Attacks: Drill charge (10 dmg), Grinding gears (4x3 dmg), Reinforcing plating (8 block), Oil slick (debuff).

From `src/services/floorManager.ts` BOSS_MAP:

> The Excavator appears as the boss of Floor 3 (Segment 1 boss).

From `docs/GAME_DESIGN.md` (Combat Display):

> Enemies appear in the top 55% display zone (Phaser canvas). Boss enemies are 1.3-1.5x the size of common enemies to convey threat.

### Boss Sprite Prompt Template

Style suffix (append to every boss prompt):

```
full body visible with padding around edges, standing in a neutral pose, pixel art sprite, 32-bit era JRPG boss style, hand-pixeled, imposing large character scaled up, clean hard pixel edges, limited color palette, 5-6 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background
```

### The Excavator (3 sprites)

| Pose | Full Prompt | Filename |
|------|------------|----------|
| Idle | "A massive drill-armed mechanical construct, corrupted and ancient, imposing boss creature with glowing red eyes and rusted metallic body, drill arm prominent" + style suffix | `the_excavator_idle.png` |
| Hit | "A massive drill-armed mechanical construct, recoiling from impact, sparks flying, slight knockback pose, mechanical pain expression, damaged plating" + style suffix | `the_excavator_hit.png` |
| Death | "A massive drill-armed mechanical construct, crumbling apart, defeated and collapsing, drill arm broken, gears scattering, mechanical death" + style suffix | `the_excavator_death.png` |

**The Excavator palette:** rusted oranges, dark metallic grays, glowing red accents, industrial browns. No green elements.

### Dimensions

64x80 virtual pixels (larger than common enemies at 48x64). Generate at native NB1 resolution, then process:

1. Green screen chroma key removal
2. Auto-crop
3. Nearest-neighbor downscale to 128x160 (2x) — primary output
4. Nearest-neighbor downscale to 64x80 (1x) — lo-res variant

### Boss Visual Treatment

- Bosses are approximately 1.3-1.5x the size of common enemies (64x80 vs 48x64)
- The drill arm should be the most prominent visual feature
- Convey age/corruption: rust, cracks, exposed gears — but still functional and threatening
- Mechanical/industrial aesthetic (not organic, not crystal) to differentiate from Crystal Golem

## Implementation

### Data Model

No new TypeScript types needed. Sprites are static assets loaded by Phaser's asset loader.

Add 3 entries to `sprite-gen/arcane-prompts.json`:

```json
{
  "id": "the_excavator_idle",
  "category": "enemies",
  "subcategory": "boss",
  "prompt": "A massive drill-armed mechanical construct, corrupted and ancient, imposing boss creature with glowing red eyes and rusted metallic body, drill arm prominent, full body visible with padding around edges, standing in a neutral pose, pixel art sprite, 32-bit era JRPG boss style, hand-pixeled, imposing large character scaled up, clean hard pixel edges, limited color palette, 5-6 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background",
  "output": "public/assets/sprites/enemies/the_excavator_idle.png",
  "dimensions": { "virtual": "64x80", "output_2x": "128x160", "output_1x": "64x80" }
}
```

Repeat for hit and death poses, swapping the pose-specific prompt.

### Logic

**Generation order (consistency strategy):**

1. Generate `the_excavator_idle.png` first as reference
2. Hit prompt includes the same character description as idle, adding mechanical damage (sparks, dented plating)
3. Death prompt includes the same character description, adding structural collapse (drill detaching, body breaking apart)
4. All 3 poses must clearly be the same machine — if hit/death deviate, regenerate with explicit style matching

**Post-processing pipeline (per sprite):**

```
NB1 raw output
  → chroma key green screen removal (tolerance: same as CR-14 pipeline)
  → auto-crop to bounding box + 2px padding
  → nearest-neighbor resize to 128x160 (2x)
  → save to public/assets/sprites/enemies/{name}.png
  → nearest-neighbor resize to 64x80 (1x)
  → save to public/assets/sprites/enemies/1x/{name}.png
```

**Metallic surface note:** Metallic/reflective surfaces may produce near-green hues that interfere with chroma keying. Use color-distance keying with wider tolerance than organic sprites, and manually inspect edges.

### UI

No new Svelte components. The sprites are consumed by Phaser's CombatScene.

**CombatScene integration (idle only for this CR):**

- Load via `this.load.image('the_excavator_idle', 'assets/sprites/enemies/the_excavator_idle.png')` in scene preload
- Boss sprite selection: when `enemy.type === 'boss'`, use the boss idle sprite key
- Boss sprite should render noticeably larger than common enemy sprites in the scene
- Hit and death pose swapping will be wired in a future combat animation CR

### System Interactions

- **Sprite generation pipeline (CR-14):** Uses the same NB1 + green screen removal + resize pipeline.
- **Enemy definitions (`src/data/enemies.ts`):** Sprite maps to enemy ID `the_excavator`. No changes to enemy data needed.
- **Floor manager (`src/services/floorManager.ts`):** BOSS_MAP assigns The Excavator to Floor 3. No changes needed.
- **Phaser CombatScene:** Idle sprite replaces rectangle placeholder for boss encounters. Boss renders larger than common enemies.
- **CR-17 (common enemies):** The Excavator must be visually distinct from Cave Bat and Crystal Golem, and clearly larger.
- **Sprite registry:** All 3 sprites registered in `sprite-gen/sprite-registry.json`.
- **Asset loading:** Sprites in `public/assets/sprites/enemies/` served by Vite's static asset handling.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Boss not imposing enough at target resolution | Regenerate with stronger "massive, imposing, towering" language |
| Drill arm not prominent enough | Regenerate emphasizing "giant drill arm as primary feature" |
| Metallic surfaces cause green screen issues | Use color-distance keying carefully; metallic reflections may need wider tolerance |
| Boss looks too similar to Crystal Golem | Emphasize mechanical/industrial vs crystal/mineral in prompts |
| Death pose doesn't read as "defeated" | Exaggerate collapse: "completely broken down, drill shattered, sparks and gears everywhere" |
| Boss doesn't look noticeably larger than common enemies | Ensure framing fills the 64x80 virtual space; character should be bulky and imposing |
| Glowing red eyes lost in downscale | Make eyes larger/brighter in prompt or add additional red accent areas |

## Visual Inspection Steps (MANDATORY)

1. Display all 3 Excavator poses side by side
2. Display Excavator idle alongside Cave Bat idle and Crystal Golem idle (from CR-17) for size comparison
3. Take Playwright screenshot at mobile viewport (Pixel 7 emulation)
4. Verify: boss is noticeably larger than common enemies
5. Verify: boss reads as "threatening" and "mechanical" at 64x80 (1x)
6. Verify: clean green screen removal from metallic surfaces (check edges carefully)
7. Verify: drill arm is the dominant visual feature
8. Test idle sprite in Phaser CombatScene as boss replacement (screenshot + snapshot)

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `sprite-gen/arcane-prompts.json` | Add 3 boss sprite entries |
| Create | `public/assets/sprites/enemies/the_excavator_idle.png` | Boss idle (128x160) |
| Create | `public/assets/sprites/enemies/the_excavator_hit.png` | Boss hit (128x160) |
| Create | `public/assets/sprites/enemies/the_excavator_death.png` | Boss death (128x160) |
| Create | `public/assets/sprites/enemies/1x/the_excavator_idle.png` | Boss idle (64x80) |
| Create | `public/assets/sprites/enemies/1x/the_excavator_hit.png` | Boss hit (64x80) |
| Create | `public/assets/sprites/enemies/1x/the_excavator_death.png` | Boss death (64x80) |
| Modify | `sprite-gen/sprite-registry.json` | Register all 3 boss sprites |

## Done When

- [ ] 3 boss sprites generated via NB1 pipeline
- [ ] The Excavator is visually imposing — noticeably larger than common enemies (64x80 vs 48x64)
- [ ] Drill arm is the dominant visual feature
- [ ] Mechanical/industrial aesthetic is clear (not organic, not crystal)
- [ ] 3 poses are consistent (same character, same palette, same silhouette)
- [ ] Green screen cleanly removed from metallic surfaces
- [ ] Output at 128x160 (2x) and 64x80 (1x) resolutions
- [ ] Boss readable and threatening at 64x80 (1x) size
- [ ] Size comparison screenshot with common enemies via Playwright
- [ ] All 3 registered in sprite-registry.json
- [ ] Idle sprite tested in Phaser CombatScene (replaces placeholder)

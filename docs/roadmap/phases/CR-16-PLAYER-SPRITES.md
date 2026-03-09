# CR-16: Player Character Sprites

> Phase: P2 — Art Pipeline + First Asset Pass
> Priority: HIGH
> Depends on: CR-14 (NB1 art pipeline)
> Estimated scope: S

Generate 7 player character pose sprites using NB1 via OpenRouter. The player character appears in the Phaser CombatScene. All poses share the same base character design for visual consistency.

## Design Reference

The player character is an adventurous explorer with a helmet lamp and pickaxe on their back. Fantasy/dungeon aesthetic. The character appears in the top 55% of the screen (Phaser canvas area) during combat.

From `docs/GAME_DESIGN.md` (Split-Stage Portrait Layout):

> Top 55% = display zone (Phaser canvas: enemy, player, effects). Bottom 45% = interaction zone (card hand, quiz panel).

The Phaser CombatScene currently uses a colored rectangle placeholder for the player — the idle sprite will replace it.

### Player Character Prompt Template

Base character prompt: `"An adventurous explorer character with a helmet lamp and pickaxe on back, determined expression, facing right"`

Style suffix (append to every prompt):

```
full body visible with padding around edges, pixel art sprite, 32-bit era JRPG hero style, hand-pixeled, 32x48 pixel character scaled up, clean hard pixel edges, limited color palette, 4-5 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background
```

### 7 Poses to Generate

| Pose | Append to base prompt | Filename | Notes |
|------|----------------------|----------|-------|
| Idle | "standing relaxed, subtle breathing pose, weight on one foot" | `player_idle.png` | Default stance |
| Attack | "lunging forward with arm extended, action pose" | `player_attack.png` | Played during card effect |
| Hit | "flinching backward, arms up defensively, pain expression" | `player_hit.png` | When taking enemy damage |
| Heal | "standing with arms slightly out, peaceful expression, eyes closed" | `player_heal.png` | When heal card activates |
| Shield | "bracing with arms crossed in front, defensive stance" | `player_shield.png` | When shield card activates |
| Death | "collapsed on ground, defeated pose" | `player_death.png` | Run end defeat |
| Victory | "fist raised triumphantly, celebrating" | `player_victory.png` | Run end victory |

### Dimensions

32x48 virtual pixels. Generate at native NB1 resolution, then process:

1. Green screen chroma key removal (same pipeline as CR-14)
2. Auto-crop
3. Nearest-neighbor downscale to 64x96 (2x) — primary output
4. Nearest-neighbor downscale to 32x48 (1x) — lo-res variant
5. Optional: palette quantize to 32 colors for cross-pose consistency

## Implementation

### Data Model

No new TypeScript types needed. Sprites are static assets loaded by Phaser's asset loader.

Add 7 entries to `sprite-gen/arcane-prompts.json`:

```json
{
  "id": "player_idle",
  "category": "player",
  "prompt": "An adventurous explorer character with a helmet lamp and pickaxe on back, determined expression, facing right, standing relaxed, subtle breathing pose, weight on one foot, full body visible with padding around edges, pixel art sprite, 32-bit era JRPG hero style, hand-pixeled, 32x48 pixel character scaled up, clean hard pixel edges, limited color palette, 4-5 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background",
  "output": "public/assets/sprites/player/player_idle.png",
  "dimensions": { "virtual": "32x48", "output_2x": "64x96", "output_1x": "32x48" }
}
```

Repeat for all 7 poses, swapping the pose-specific prompt suffix.

### Logic

**Generation order (consistency strategy):**

1. Generate `player_idle.png` first as the reference pose
2. For subsequent poses, prepend style anchor: `"matching the style of the idle explorer sprite, "` to the base prompt
3. If a generated pose deviates visually from idle (different proportions, palette, or outline weight), regenerate with more explicit style matching
4. All poses must share the same color palette: helmet lamp color, outfit colors, skin tone

**Post-processing pipeline (per sprite):**

```
NB1 raw output
  → chroma key green screen removal (tolerance: same as CR-14 pipeline)
  → auto-crop to bounding box + 2px padding
  → nearest-neighbor resize to 64x96 (2x)
  → save to public/assets/sprites/player/{name}.png
  → nearest-neighbor resize to 32x48 (1x)
  → save to public/assets/sprites/player/1x/{name}.png
```

### UI

No new Svelte components. The sprites are consumed by Phaser's CombatScene.

**CombatScene integration (idle only for this CR):**

- Replace the colored rectangle player placeholder with `player_idle.png`
- Load via `this.load.image('player_idle', 'assets/sprites/player/player_idle.png')` in the scene's preload
- Remaining poses (attack, hit, heal, shield, death, victory) will be wired to combat animations in a future CR

### System Interactions

- **Sprite generation pipeline (CR-14):** Uses the same NB1 + green screen removal + resize pipeline established in CR-14.
- **Phaser CombatScene:** `player_idle.png` replaces the rectangle placeholder. Future CRs will swap sprites for attack/hit/heal/shield/death/victory animations.
- **Sprite registry:** All 7 sprites registered in `sprite-gen/sprite-registry.json` for pipeline tracking.
- **Asset loading:** Sprites in `public/assets/sprites/player/` are served by Vite's static asset handling.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Character facing wrong direction | Regenerate with explicit "facing right" emphasis |
| Inconsistent proportions between poses | Regenerate outlier pose with reference to idle |
| Green screen bleeds into character (green helmet lamp?) | Adjust prompt to specify non-green lamp color ("warm yellow helmet lamp") |
| Pose too similar to another pose | Regenerate with more exaggerated pose description |
| Auto-crop removes too much | Add padding pixels before saving |
| NB1 generates character with wrong equipment | Regenerate with more explicit equipment description ("pickaxe strapped to back, helmet with bright yellow lamp") |
| Sprite looks muddy at 32x48 (1x) | Simplify pose prompt; reduce detail; ensure strong outline survives downscale |

## Visual Inspection Steps (MANDATORY)

1. After generating all 7 poses, create a sprite lineup HTML page showing all poses side by side at both 1x and 2x
2. Take Playwright screenshot at mobile viewport (Pixel 7 emulation)
3. Verify: consistent character proportions across all poses, clean outlines, no green fringing
4. Verify: poses are distinct and readable at 32x48 (1x) size
5. Test `player_idle.png` in Phaser CombatScene by loading as player sprite (screenshot + snapshot)

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `sprite-gen/arcane-prompts.json` | Add 7 player pose entries |
| Create | `public/assets/sprites/player/player_idle.png` | Idle pose (64x96) |
| Create | `public/assets/sprites/player/player_attack.png` | Attack pose (64x96) |
| Create | `public/assets/sprites/player/player_hit.png` | Hit reaction pose (64x96) |
| Create | `public/assets/sprites/player/player_heal.png` | Heal pose (64x96) |
| Create | `public/assets/sprites/player/player_shield.png` | Shield pose (64x96) |
| Create | `public/assets/sprites/player/player_death.png` | Death pose (64x96) |
| Create | `public/assets/sprites/player/player_victory.png` | Victory pose (64x96) |
| Create | `public/assets/sprites/player/1x/player_idle.png` | Idle pose (32x48) |
| Create | `public/assets/sprites/player/1x/player_attack.png` | Attack pose (32x48) |
| Create | `public/assets/sprites/player/1x/player_hit.png` | Hit reaction pose (32x48) |
| Create | `public/assets/sprites/player/1x/player_heal.png` | Heal pose (32x48) |
| Create | `public/assets/sprites/player/1x/player_shield.png` | Shield pose (32x48) |
| Create | `public/assets/sprites/player/1x/player_death.png` | Death pose (32x48) |
| Create | `public/assets/sprites/player/1x/player_victory.png` | Victory pose (32x48) |
| Modify | `sprite-gen/sprite-registry.json` | Register all 7 poses |

## Done When

- [ ] 7 player poses generated via NB1 pipeline
- [ ] All poses share consistent character design (proportions, colors, outfit)
- [ ] Green screen cleanly removed with no fringing on any pose
- [ ] Output at 64x96 (2x) and 32x48 (1x) resolutions
- [ ] Character readable and distinct at 32x48 (smallest) size
- [ ] Poses are clearly distinguishable from each other
- [ ] Sprite lineup screenshot taken via Playwright
- [ ] All 7 registered in sprite-registry.json
- [ ] player_idle.png tested in Phaser CombatScene (replaces placeholder)

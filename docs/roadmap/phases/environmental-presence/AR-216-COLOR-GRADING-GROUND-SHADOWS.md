# AR-216: Color Grading & Ground Contact Shadows

**Status:** Pending
**Priority:** High (highest visual impact per effort)
**Complexity:** Medium
**Estimated Files:** 3 modified
**Depends on:** AR-215 (Room Atmosphere Config)

## Overview

Implement the three cheapest, highest-impact techniques from the environmental presence research:

1. **Per-room sprite tinting** via `setTint()` — makes enemies share the room's color temperature
2. **Camera color matrix** via Phaser's built-in `postFX.addColorMatrix()` — global saturation/brightness per theme
3. **Enhanced ground contact shadow** — upgrade the existing basic shadow in `EnemySpriteSystem` to respond to idle animation, have light-direction offset, and use a pixel-art dithered texture
4. **Sprite-base ambient occlusion** via `preFX.addGradient()` — darken the bottom 30-40% of enemy sprites

Combined GPU cost: effectively **free** (vertex color + 2 cheap built-in FX). This is the single biggest visual upgrade for the least effort.

## Dependencies

- **Blocked by:** AR-215 (needs `AtmosphereConfig` for tint values, shadow alpha, AO strength)
- **Blocks:** Nothing (all downstream ARs are independent)
- **Related:** `src/game/systems/EnemySpriteSystem.ts` (shadow), `src/game/scenes/CombatScene.ts` (sprite setup)

## Sub-Steps

### 1. Apply Sprite Tint Per Room Theme

**File:** `src/game/systems/EnemySpriteSystem.ts`

In `setSprite()` (or a new `applyAtmosphere(config: AtmosphereConfig)` method):

```typescript
/** Apply room-specific color grading to the enemy sprite */
applyAtmosphere(config: AtmosphereConfig): void {
  // Multiplicative tint — warm for caves, cool for ice, purple for arcane
  this.mainSprite.setTint(config.spriteTint);
  // Outline sprites get a darker version of the tint
  const darkerTint = Phaser.Display.Color.ValueToColor(config.spriteTint);
  darkerTint.darken(30);
  this.outlineSprites.forEach(s => s.setTint(darkerTint.color));
}
```

**Important:** The shadow sprite should NOT be tinted (it's already black).

**Tint must be applied AFTER sprite texture is loaded** — call `applyAtmosphere()` at the end of `setSprite()`, not before.

**Per-vertex tinting for subtle lighting gradient:**
```typescript
// Lit from above — top brighter, bottom darker
this.mainSprite.setTint(
  config.spriteTint,           // top-left
  config.spriteTint,           // top-right
  Phaser.Display.Color.ValueToColor(config.spriteTint).darken(15).color,  // bottom-left
  Phaser.Display.Color.ValueToColor(config.spriteTint).darken(15).color   // bottom-right
);
```

### 2. Camera ColorMatrix Per Theme

**File:** `src/game/scenes/CombatScene.ts`

In `create()` or when the atmosphere config is set:

```typescript
// Apply global color grading to the combat camera
private applyColorGrading(config: AtmosphereConfig): void {
  // Remove previous color matrix if exists
  if (this._colorMatrixFx) {
    this.cameras.main.postFX.remove(this._colorMatrixFx);
  }

  const fx = this.cameras.main.postFX.addColorMatrix();
  fx.saturate(config.cameraColorMatrix.saturation);
  fx.brightness(config.cameraColorMatrix.brightness);
  if (config.cameraColorMatrix.hueRotate) {
    fx.hue(config.cameraColorMatrix.hueRotate);
  }
  this._colorMatrixFx = fx;
}
```

**Also tint the background image:**
```typescript
this.combatBackground.setTint(config.backgroundTint);
```

### 3. Tint Transition Between Encounters

When transitioning between encounters (different floor themes), tween the tint smoothly:

```typescript
/** Transition sprite tint from old theme to new theme over duration */
private transitionTint(
  sprite: Phaser.GameObjects.Sprite,
  fromTint: number,
  toTint: number,
  duration: number = 800
): void {
  const fromColor = Phaser.Display.Color.ValueToColor(fromTint);
  const toColor = Phaser.Display.Color.ValueToColor(toTint);

  this.tweens.addCounter({
    from: 0, to: 100, duration, ease: 'Sine.easeInOut',
    onUpdate: (tween) => {
      const t = tween.getValue() / 100;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        fromColor, toColor, 100, t * 100
      );
      sprite.setTint(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    }
  });
}
```

Only transition when the floor theme CHANGES (e.g., floor 3 dust -> floor 4 embers). Same-theme encounters should not re-tween.

### 4. Enhanced Ground Contact Shadow

**File:** `src/game/systems/EnemySpriteSystem.ts`

Replace the current basic shadow (black offset rectangle) with a proper ground contact shadow:

**4a. Create a pixel-art shadow texture** (procedural, generated once):

```typescript
/** Generate a dithered pixel-art ellipse shadow texture */
private createShadowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('ground_shadow')) return;

  const w = 64, h = 16;
  const canvas = scene.textures.createCanvas('ground_shadow', w, h);
  const ctx = canvas.getContext();

  // Draw dithered ellipse — 3 concentric ellipses with decreasing alpha
  // Outer ring: 15% alpha, dithered
  // Middle ring: 25% alpha
  // Center: 35% alpha
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - w/2) / (w/2);
      const ny = (y - h/2) / (h/2);
      const dist = nx*nx + ny*ny;

      if (dist > 1.0) continue; // outside ellipse

      let alpha = 0;
      if (dist < 0.3) alpha = 0.35;
      else if (dist < 0.6) alpha = 0.25;
      else if (dist < 1.0) {
        // Dithered outer ring — checkerboard pattern for pixel-art feel
        alpha = ((x + y) % 2 === 0) ? 0.2 : 0.0;
      }

      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  canvas.refresh();
}
```

**4b. Shadow responds to idle bob:**

```typescript
/** Update shadow to match enemy idle animation */
updateShadow(enemyY: number, baseY: number, config: AtmosphereConfig): void {
  const bobOffset = baseY - enemyY; // positive when enemy is above rest position
  const scale = Phaser.Math.Clamp(1 - bobOffset / 150, 0.3, 1.0);

  this.shadow.setScale(
    this.shadowBaseScaleX * scale,
    this.shadowBaseScaleY * scale * 0.5
  );
  this.shadow.setAlpha(config.shadowAlpha * scale);

  // Light-direction offset — shadow opposite to dominant light
  const lightDir = config.rim.lightDir;
  this.shadow.x = this.baseX - lightDir[0] * 6;
  this.shadow.y = this.groundY + 2; // always pinned to ground plane
}
```

**4c. Shadow depth:** Keep at current depth (below enemy container). The shadow image uses the `ground_shadow` texture at depth `enemyContainer.depth - 1`.

### 5. Sprite-Base Ambient Occlusion

**File:** `src/game/systems/EnemySpriteSystem.ts`

Apply Phaser's built-in gradient FX to darken the bottom portion of enemy sprites:

```typescript
/** Apply ambient occlusion gradient to sprite base */
applyAO(config: AtmosphereConfig): void {
  if (config.aoStrength <= 0) return;

  // Remove previous AO if exists
  if (this._aoFx) {
    this.mainSprite.preFX.remove(this._aoFx);
  }

  // Darken bottom 40% of sprite — simulates ground-contact light falloff
  this._aoFx = this.mainSprite.preFX.addGradient(
    0x000000, 0x000000,       // dark colors (both black)
    config.aoStrength,         // alpha (0.15-0.3 per theme)
    0, 0.6,                    // gradient starts at 60% height
    0, 1.0                     // gradient ends at bottom
  );
}
```

**Important constraints:**
- AO strength must stay between 0.15 and 0.3 — stronger muddies pixel art
- Only apply to `mainSprite`, NOT to outline or shadow sprites
- AO is theme-dependent: void/embers stronger (dark environments), ice weaker (bright)

### 6. Device Tier Gating

All effects in this AR are cheap, but for `low-end` device tier:
- Skip camera ColorMatrix FX entirely (saves one full-screen shader pass)
- Apply sprite tint (free — vertex color only)
- Apply shadow (one sprite draw)
- Skip AO gradient (one shader pass per sprite)

```typescript
if (getDeviceTier() !== 'low-end') {
  this.applyColorGrading(config);
  this.enemySpriteSystem.applyAO(config);
}
// Always apply tint and shadow (effectively free)
this.enemySpriteSystem.applyAtmosphere(config);
```

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/game/systems/EnemySpriteSystem.ts` | **MODIFY** | Add `applyAtmosphere()`, `applyAO()`, enhanced shadow, dithered shadow texture |
| `src/game/scenes/CombatScene.ts` | **MODIFY** | Add `applyColorGrading()`, tint transitions, wire config to sprite system |
| `src/game/systems/CombatAtmosphereSystem.ts` | **MODIFY** | Minor — ensure no conflicting tints (atmosphere particles should NOT be affected by camera color matrix) |

## Acceptance Criteria

- [ ] Enemy sprites are tinted per floor theme (warm amber on floors 1-3, orange on 4-6, blue on 7-9, purple on 10-12, dark purple on 13+)
- [ ] Background image receives matching tint
- [ ] Camera has theme-appropriate saturation/brightness adjustment
- [ ] Tint transitions smoothly (800ms Sine.easeInOut) when floor theme changes
- [ ] Ground shadow is a dithered pixel-art ellipse, not a smooth graphics shape
- [ ] Shadow responds to idle bob (shrinks/fades when enemy bobs up, grows when down)
- [ ] Shadow has light-direction offset (opposite dominant light source)
- [ ] Sprite base has subtle AO darkening (bottom 40%)
- [ ] AO strength varies by theme (stronger in dark rooms, weaker in bright)
- [ ] Low-end devices skip ColorMatrix and AO but still get tint and shadow
- [ ] No visual regression on existing atmosphere particles or fog
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes

## Verification Gate

1. `npm run typecheck` + `npm run build` — clean
2. Playwright screenshots at floors 1, 5, 8, 10, 14 — verify tinting is visible and appropriate
3. Playwright screenshot comparing floor 3 vs floor 4 — tint transition visible
4. Shadow responds to idle bob — take 2 screenshots during bob cycle
5. AO visible as subtle bottom darkening on enemy sprite (compare with/without)
6. Check `browser_console_messages` — no WebGL warnings or errors
7. Performance: `window.__terraDebug()` FPS counter should show no drop (< 1ms total added)

## Performance Budget

| Technique | GPU Cost | Notes |
|-----------|----------|-------|
| setTint (sprite + background) | **Free** | Vertex color, zero overhead |
| Camera ColorMatrix | **~0.5ms** | Single full-screen pass |
| Ground shadow sprite | **~0.01ms** | One additional sprite draw |
| preFX.addGradient (AO) | **~0.1ms** | Per-sprite, tiny fragment count |
| **Total** | **~0.6ms** | Well within budget |

## Pixel Art Safety Checklist

- [x] Tints are multiplicative (darken only) — cannot create colors outside the sprite's original palette
- [x] AO gradient uses `preFX` (renders at sprite resolution, not screen resolution)
- [x] Shadow texture uses nearest-neighbor filtering (inherits `pixelArt: true`)
- [x] No sub-pixel positioning introduced
- [x] ColorMatrix operates on final framebuffer — doesn't affect sprite rendering pipeline

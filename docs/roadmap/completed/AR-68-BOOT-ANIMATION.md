# AR-68: Boot Animation — Logo Reveal + Cave Fly-Through

**Status:** Pending
**Created:** 2026-03-17
**Depends on:** None (assets provided by user at `r/data/generated/boot_anim/`)
**Complexity:** High — new Phaser scene, preprocessing pipeline, particle effects, tween choreography

## Overview

Add a cinematic boot animation that plays on app launch: a logo reveal sequence (deblur logo → spark-trail title sweep → studio name fade) followed by a 3D parallax cave tunnel fly-through using layered cave ring sprites, resolving into the campsite background. Total duration ~8s, tap to 3× speed. Skipped on subsequent launches via `skipBootAnim` localStorage flag.

**Architecture decision:** Boot Phaser early (currently lazy-loaded for combat only). Register `BootAnimScene` alongside existing scenes. When animation completes, hide Phaser container and show normal Svelte hub. Phaser stays alive for later combat use — no destroy/recreate overhead.

## Source Assets (provided by user)

| File | Description | Notes |
|------|-------------|-------|
| `r/data/generated/boot_anim/logo.png` | Recall Rogue icon/symbol | Layered composition — stack at same position |
| `r/data/generated/boot_anim/recallrogue.png` | "Recall Rogue" title text | Same composition layer |
| `r/data/generated/boot_anim/bramblegategames.png` | "Bramblegate Games" studio text | Same composition layer |
| `r/data/generated/boot_anim/cave_ring_1.png` | Closest/largest cave frame | 1024×1024, transparent center |
| `r/data/generated/boot_anim/cave_ring_2.png` | Mid-distance cave frame | 1024×1024, transparent center |
| `r/data/generated/boot_anim/cave_ring_3.png` | Farthest/tightest cave frame | 1024×1024, transparent center |
| `r/data/generated/boot_anim/campsite_bg.png` | Full campsite background | Used for the reveal at animation end |

## Tasks

### Section A: Asset Preprocessing

- [ ] **A.1** Create preprocessing script `scripts/preprocess-boot-assets.mjs`
  - Uses `sharp` library to:
    1. Validate all 7 source PNGs exist and load correctly
    2. Check cave rings have transparent centers (alpha channel analysis) — if any have solid green/magenta centers, chroma-key them to transparent
    3. Generate blur variants for: `logo.png`, `recallrogue.png`, `bramblegategames.png`, `campsite_bg.png`
       - `_blur_heavy.png` — Gaussian blur radius 10px
       - `_blur_medium.png` — Gaussian blur radius 5px
    4. Copy ALL assets (originals + blur variants) to `public/assets/boot/`
    5. Print summary: asset name, dimensions, file size, transparency status
  - Acceptance: Running `node scripts/preprocess-boot-assets.mjs` produces `public/assets/boot/` with 19 files (7 originals + 4×2 blur variants + 4 already-sharp originals that needed blur variants)

- [ ] **A.2** Run the preprocessing script and verify output
  - Acceptance: All 19 files exist in `public/assets/boot/`, blur variants are visually correct (progressively blurry), cave rings have transparent centers

### Section B: BootAnimScene — Phaser Scene

- [ ] **B.1** Create `src/game/scenes/BootAnimScene.ts` — the main boot animation scene
  - Scene key: `'BootAnimScene'`
  - **preload()**: Load all boot assets from `assets/boot/` (originals + blur variants)
  - **create()**: Set up the full animation choreography as described below
  - **Layer order** (bottom to top): black bg → campsite_bg (hidden) → cave_ring_3 → cave_ring_2 → cave_ring_1 → firefly particles → logo → recallrogue → bramblegategames
  - Acceptance: Scene file compiles, all assets referenced with correct paths

- [ ] **B.2** Implement Part 1: Logo Reveal Sequence (0s–4.8s)
  - **Step A (0s–1.2s)**: Logo deblur — stack 3 versions (heavy/medium/sharp) at same position. Crossfade: heavy visible first, fade to medium at 0.4s, fade to sharp at 0.8s. Simultaneous alpha 0→1 over 800ms starting at 0s.
  - **Step B (1.0s–1.8s)**: Logo glow shine — additive white/gold tinted copy of logo, alpha tween 0→0.6→0 over 600ms. Spawn 3–5 tiny spark particles from logo edges during peak, drifting outward and fading.
  - **Step C (1.6s–2.6s)**: "Recall Rogue" text sweep-in from left. Start 100px off-left, alpha 0, blurred. Tween to center over 600ms ease-out. Alpha 0→1 over first 400ms. Deblur during move (2-step: medium→sharp). **Spark trail**: particle emitter following leading edge, gold→orange→red sparks spraying right+up with gravity, ~30/sec during slide, lingering 200ms after settling.
  - **Step D (2.8s–3.6s)**: "Bramblegate Games" gentle fade-in at correct position. Blurred alpha 0 → sharp alpha 1 over 800ms. No movement, no sparks — quiet beat.
  - **Step E (3.6s–4.8s)**: Hold full logo composition 1.2s. Start firefly particle emitter (6–8 warm yellow-white dots drifting slowly on black background). Fireflies persist into Part 2.
  - Acceptance: Logo reveal plays with correct timing, deblur effect is smooth, spark trail on title is visible, fireflies drift during hold

- [ ] **B.3** Implement Part 2: Cave Fly-Through (4.8s–8.0s)
  - **Step F (4.8s–5.6s)**: Logo fade-out — all 3 logo elements simultaneously alpha 1→0, scale 1→1.05, blur sharp→soft over 500ms. Cave ring 3 appears at center: scale 0.3, alpha 0, blurred → scale 0.6, alpha 0.7, medium blur over 600ms.
  - **Step G (5.4s–7.2s)**: Fly-through rings — each ring does: enter far (small, blurry, low alpha) → approach (scale up, deblur, alpha up) → pass camera (scale past ~2.5x, reblur, fade out) → destroy. Stagger: ring 3 already visible, ring 2 at 5.6s, ring 1 at 5.8s. Blur-sharp-blur cycle per ring sells 3D depth of field. Speed ramp: ring 3 slowest, ring 1 fastest. Optional ±1.5° rotation on rings 1/2 for organic variety. Fireflies continue/increase.
    - **Blur crossfade per ring**: Each ring has 3 textures (heavy/medium/sharp) — but cave rings don't need pre-rendered blur since they're scaling so fast. Instead: just use the sharp ring texture and rely on the scale+alpha transitions. The rapid scaling naturally blurs perception. If it looks too sharp, we can add blur variants for rings in a follow-up.
  - **Step H (7.0s–8.0s)**: Campsite reveal — campsite_bg is placed behind everything. Start blurred, alpha 0. Tween to alpha 1 and deblur over 800ms, synced so campsite becomes sharp RIGHT as last ring fully fades. Seamless handoff.
  - Acceptance: Cave fly-through creates convincing 3D tunnel effect, campsite resolves smoothly at the end

- [ ] **B.4** Implement Part 3: Hand-Off + Tap-to-Speed
  - **Hand-off**: When animation completes, emit `'boot-anim-complete'` event via `this.game.events.emit()`. Scene goes to sleep (not destroyed — textures freed in cleanup).
  - **Tap to speed up**: On first pointerdown during animation, set `this.tweens.timeScale = 3` and all particle emitter `timeScale = 3`. One speed level only, subsequent taps do nothing.
  - **Cleanup**: After hand-off, destroy all boot textures from texture cache to free memory. Remove particle emitters.
  - Acceptance: Tapping accelerates animation 3×. Hand-off event fires. Textures freed.

### Section C: App Integration

- [ ] **C.1** Register BootAnimScene in Phaser game config
  - Edit `src/game/CardGameManager.ts`: add `BootAnimScene` to the scene array (first position so it's the starting scene)
  - Add a method `bootForAnimation()` that boots Phaser with BootAnimScene as the active scene
  - Add a method `transitionToCombat()` that stops BootAnimScene and starts the normal flow
  - Acceptance: Phaser boots with BootAnimScene first when `bootForAnimation()` is called

- [ ] **C.2** Modify app launch flow to trigger boot animation
  - Edit `src/main.ts` and/or `src/CardApp.svelte`:
    1. On app launch, check `localStorage.getItem('skipBootAnim')` and `?skipOnboarding` query param
    2. If NOT skipping: make Phaser container visible, call `bootForAnimation()`, listen for `'boot-anim-complete'` event
    3. On complete: hide Phaser container, show normal Svelte hub, set `localStorage.setItem('skipBootAnim', 'true')`
    4. If skipping: normal flow (Phaser stays lazy-loaded for combat)
  - The `#phaser-container` div needs to be visible during the boot animation (it's normally hidden until combat)
  - Acceptance: First app launch shows full animation then hub. Second launch skips to hub. `?skipOnboarding=true` skips animation.

- [ ] **C.3** Handle campsite visual continuity
  - The boot animation ends with `campsite_bg.png` fully visible in Phaser canvas
  - When Phaser container hides and HubScreen shows, the Svelte `<img>` campsite background should appear at the exact same position/size — zero visual discontinuity
  - May need a brief crossfade: both visible simultaneously for 100ms, then Phaser hides
  - Acceptance: No visual jump or flicker when transitioning from animation to hub

- [ ] **C.4** Dev preset bypass
  - When `?devpreset=` is in the URL OR `?skipOnboarding=true`, ALWAYS skip the boot animation
  - Acceptance: Dev workflow is unaffected by boot animation

### Section D: Particle Systems

- [ ] **D.1** Implement firefly particle emitter
  - Warm yellow-white dots (color: 0xFFF5CC → 0xFFE082)
  - 6–8 particles, slow drift speed, alpha pulse (0.3→0.8→0.3), long lifetime (~4s)
  - Used during logo hold (Part 1 Step E) and throughout fly-through (Part 2)
  - Acceptance: Fireflies look organic and ambient on black background

- [ ] **D.2** Implement spark trail particle emitter for title sweep
  - Gold→orange→red color gradient as particles age (0xFFD700 → 0xFF8C00 → 0xCC3300)
  - ~30 particles/sec during title slide, spray rightward+slightly up, gravity pulls down
  - Lifetime ~400ms per spark
  - Stops when title settles, with 200ms of lingering pops
  - Acceptance: Spark trail follows title leading edge, feels like hot metal forging

- [ ] **D.3** Implement logo glow spark particles
  - 3–5 tiny sparks from logo edges during glow peak
  - Drift outward and fade over ~500ms
  - Subtle — accent, not dominant
  - Acceptance: Sparks visible during logo glow, not overwhelming

### Section E: Documentation & Config

- [ ] **E.1** Update `docs/GAME_DESIGN.md` — add Boot Animation section describing the cinematic intro
- [ ] **E.2** Update `docs/ARCHITECTURE.md` — add BootAnimScene to Phaser scenes list, document early-boot flow
- [ ] **E.3** Add `skipBootAnim` to the dev preset / settings system so it can be toggled

## Verification Gate

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all existing tests pass (boot animation is visual-only, no unit tests needed)
- [ ] Visual verification: full animation plays on first launch (Playwright screenshot sequence)
- [ ] Visual verification: tap accelerates animation to 3× speed
- [ ] Visual verification: second launch skips to hub
- [ ] Visual verification: `?skipOnboarding=true` skips animation
- [ ] Visual verification: campsite handoff is seamless (no flicker/jump)
- [ ] Memory: boot textures freed after animation completes

## Files Affected

| File | Action | Task |
|------|--------|------|
| `scripts/preprocess-boot-assets.mjs` | NEW | A.1 |
| `public/assets/boot/*` | NEW (19 files) | A.2 |
| `src/game/scenes/BootAnimScene.ts` | NEW | B.1–B.4 |
| `src/game/CardGameManager.ts` | EDIT | C.1 |
| `src/CardApp.svelte` | EDIT | C.2, C.3 |
| `src/main.ts` | EDIT (maybe) | C.2 |
| `docs/GAME_DESIGN.md` | EDIT | E.1 |
| `docs/ARCHITECTURE.md` | EDIT | E.2 |

## Technical Notes

### Blur Implementation
Pre-rendered blur frames for logo/title/studio/campsite (3 versions each: heavy, medium, sharp). At runtime, stack all 3 at same position and crossfade. Most performant on mobile — just alpha tweens on static textures.

Cave rings do NOT need blur variants — the rapid scaling creates natural perceptual blur. If it looks too crisp, add blur variants in a follow-up.

### Phaser Early Boot Impact
Currently Phaser boots lazily when combat starts. This change boots it on first launch for the animation. Impact:
- First launch: Phaser boots ~200ms earlier than it would have (the animation plays during what would have been idle time anyway)
- Subsequent launches: `skipBootAnim` flag skips early boot — Phaser stays lazy-loaded as before
- Net impact: zero performance regression for returning users

### Layer Order (bottom to top)
```
Black background (scene backgroundColor)
campsite_bg (alpha 0 until Step H)
cave_ring_3 (farthest)
cave_ring_2
cave_ring_1 (closest)
Firefly particles
logo.png (+ blur variants)
recallrogue.png (+ blur variants)
bramblegategames.png (+ blur variants)
Spark particles (above everything)
```

### Timing Summary
```
0.0s  — Logo deblur starts
1.0s  — Logo glow shine
1.6s  — "Recall Rogue" sweeps in from left with spark trail
2.8s  — "Bramblegate Games" fades in gently
3.6s  — Hold (fireflies start)
4.8s  — Logo fades out, cave ring 3 appears
5.4s  — Ring 3 flying, ring 2 appears
5.6s  — Ring 2 flying, ring 1 appears
7.0s  — Campsite deblur begins behind last ring
8.0s  — Animation complete, hand off to hub
```

### Tap Behavior
- First tap: all tweens and particles switch to `timeScale = 3`
- Full sequence still plays in order — just 3× faster (~2.7s total)
- No skip-to-end — everything animates, just accelerated

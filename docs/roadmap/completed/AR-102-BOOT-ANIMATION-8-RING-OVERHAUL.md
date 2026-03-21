# AR-102: Boot Animation — 8-Ring Cave Fly-Through Overhaul

**Status:** Pending
**Created:** 2026-03-18
**Depends on:** None (new ring assets already in `public/assets/boot/`)
**Complexity:** Medium — rework of existing BootAnimScene, no new scenes or systems

## Overview

Replace the current 3-ring cave fly-through with an 8-ring version. Each ring has a distinct domain-themed visual (surface → roots → stalactites → crystals → magma → runes → library → void), creating a much smoother and more cinematic descent. The animation pacing also changes: fast initial fall that decelerates, ending in a gentle arrival at the campsite.

### New ring assets (already in `public/assets/boot/`)

| File | Theme | Order |
|------|-------|-------|
| `cave_ring_1_entrance.png` | Limestone entrance, moss, roots | 1st (closest, passes first) |
| `cave_ring_2_roots.png` | Root tangle, bioluminescent moss | 2nd |
| `cave_ring_3_stalactite.png` | Stalactite cathedral, torch glow | 3rd |
| `cave_ring_4_crystal.png` | Crystal geode, prismatic light | 4th |
| `cave_ring_5_magma.png` | Magma fissure, basalt, embers | 5th |
| `cave_ring_6_runes.png` | Ancient runes, carved stone, teal-gold glow | 6th |
| `cave_ring_7_library.png` | Underground library, floating books | 7th |
| `cave_ring_8_void.png` | Void threshold, crumbling obsidian, stars | 8th (farthest, reveals last) |

### Ring design

- Pure black (#000000) background — both center hole and outer edges
- **Inner hole edge:** sharp, clean cutoff — rock wall face meets pure black void
- **Outer edges:** rock fades smoothly to black — no hard boundary at canvas edge
- Black acts as fake transparency when layered (black-on-black = invisible)
- Old `cave_ring_1.png`, `cave_ring_2.png`, `cave_ring_3.png` can be deleted after migration

## Animation Flow

### Part 1: Logo Reveal (0–4.8s) — UNCHANGED
Keep the existing logo deblur → glow → title sweep → studio tag → fireflies sequence exactly as-is.

### Part 1→2 Transition (4.8–5.6s) — MODIFIED
1. Logo, title, and studio text **disintegrate** — particles scatter upward/outward like blowing away in wind. Elements drift upward slightly as they break apart. (Current: simple fade+drift)
2. Stars **fade out** smoothly (current: drift up and fade — keep this but ensure they fully vanish before rings start)
3. All particle emitters killed
4. Signal hub to show blurred campsite (`boot-anim-show-blurred`)

### Part 2: 8-Ring Cave Descent (5.6–~12s) — REWRITTEN

**Core concept:** The player is falling down through a cave tunnel at high speed, decelerating as they approach the campsite.

**Mechanic:**
- Ring 1 appears very small in the center of the screen (far away)
- It rapidly scales up as though the player is plummeting toward it
- As ring 1 passes the camera (scale > screen), ring 2 is already visible inside ring 1's hole, growing
- Each subsequent ring appears inside the previous ring's hole, already scaling up
- **Speed ramp:** Ring 1 flies past fastest (freefall). Each subsequent ring is slightly slower. By ring 7–8 the player has decelerated to a near-standstill, gently arriving at the campsite.

**Timing breakdown (approximate):**

| Ring | Start | Duration | Speed Feel |
|------|-------|----------|------------|
| 1 — Entrance | 5.6s | 600ms | Freefall — blazing fast |
| 2 — Roots | 5.8s | 650ms | Still fast |
| 3 — Stalactite | 6.1s | 700ms | Fast but slowing |
| 4 — Crystal | 6.5s | 800ms | Noticeable deceleration |
| 5 — Magma | 7.0s | 900ms | Medium speed |
| 6 — Runes | 7.6s | 1000ms | Slow, deliberate |
| 7 — Library | 8.3s | 1200ms | Gentle drift |
| 8 — Void | 9.2s | 1500ms | Near-standstill, floating arrival |

Total Part 2: ~5.5s. Full animation: ~11s (same ballpark as current).

**Per-ring animation:**
1. Ring appears at small scale (~0.05–0.15 × coverScale) centered in frame, alpha 0.8–1.0
2. Scales up following an ease curve (Cubic.easeIn for fast rings → Quad.easeOut for slow rings)
3. As it passes camera (scale > 2.5×), it fades out and is destroyed
4. Slight Y-drift upward (descent feel) — stronger for early rings, minimal for late rings
5. Optional ±1–2° rotation for organic variety
6. Each ring is one depth layer below the previous (ring 1 = depth 18, ring 8 = depth 10)

**Deblur trigger:** When ring 7 starts scaling (≈8.3s), emit `boot-anim-deblur` so the campsite behind begins its CSS unblur transition.

### Part 3: Campsite Arrival (~10.5–12s)

1. Ring 8 (void threshold) is the last to pass. Its warm golden center glow matches the campsite warmth behind it.
2. As ring 8 fades away, the campsite is already deblurring behind it (triggered at ring 7).
3. After ring 8 completes, the campsite should be fully sharp and loaded.
4. Emit `boot-anim-complete`. Hide Phaser container. Svelte hub takes over seamlessly.

## Tasks

### A. Asset Migration

- [ ] **A.1** Remove old ring references: delete `cave_ring_1.png`, `cave_ring_2.png`, `cave_ring_3.png` (and their `.webp` variants) from `public/assets/boot/`
- [ ] **A.2** Run preprocessing script to generate webp versions of the 8 new rings (if the script handles this) or manually convert
- [ ] **A.3** Verify all 8 ring PNGs load correctly — check center holes are pure black, outer edges fade to black

### B. BootAnimScene Rewrite

- [ ] **B.1** Update `preload()` to load all 8 new ring textures instead of 3 old ones:
  ```typescript
  const ringNames = [
    'entrance', 'roots', 'stalactite', 'crystal',
    'magma', 'runes', 'library', 'void'
  ]
  for (let i = 0; i < ringNames.length; i++) {
    this.load.image(`boot_cave_ring_${i + 1}`, base + `cave_ring_${i + 1}_${ringNames[i]}.png`)
  }
  ```

- [ ] **B.2** Update `bootKeys` array for LINEAR filtering to include all 8 rings

- [ ] **B.3** Implement logo disintegration in `transition()`:
  - Instead of simple alpha fade, break logo/title/studio into particle fragments
  - Particles scatter upward and outward (wind-blown effect)
  - Logo elements drift upward slightly while disintegrating
  - Stars fade out cleanly (ensure full fade before rings begin)

- [ ] **B.4** Rewrite `playPartTwo()` with 8-ring deceleration fly-through:
  - Create all 8 rings at their initial small scales, layered by depth
  - Stagger their scale-up animations with the deceleration curve described above
  - Ring 1 uses `Cubic.easeIn` (fast acceleration past camera)
  - Later rings progressively shift toward `Quad.easeOut` (deceleration, gentle arrival)
  - Each ring fades out as scale exceeds ~2.5× coverScale
  - Y-drift decreases per ring (freefall → glide → standstill)
  - Emit `boot-anim-deblur` when ring 7 begins

- [ ] **B.5** Ensure `complete()` cleans up all 8 ring textures from cache

### C. Integration

- [ ] **C.1** Verify `boot-anim-show-blurred` still fires at the right moment (after logo disintegration, before ring 1)
- [ ] **C.2** Verify `boot-anim-deblur` timing — campsite should be fully sharp by the time ring 8 finishes
- [ ] **C.3** Verify `boot-anim-complete` fires and Phaser→Svelte handoff is seamless (no flicker)
- [ ] **C.4** Tap-to-speed (3×) still works with 8 rings

### D. Cleanup

- [ ] **D.1** Delete old ring files: `cave_ring_1.png`, `cave_ring_1.webp`, `cave_ring_2.png`, `cave_ring_2.webp`, `cave_ring_3.png`, `cave_ring_3.webp`
- [ ] **D.2** Update doc comment at top of BootAnimScene.ts

## Verification Gate

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] Visual: logo disintegrates (not just fades) — particles scatter upward
- [ ] Visual: stars fully fade before rings begin
- [ ] Visual: 8 rings fly past in sequence, each progressively slower
- [ ] Visual: no harsh edges visible on any ring (black fades work correctly)
- [ ] Visual: deceleration is palpable — rings 1–3 fast, 7–8 gentle
- [ ] Visual: campsite deblurs smoothly during rings 7–8
- [ ] Visual: seamless handoff to hub — no flicker, no jump
- [ ] Visual: tap accelerates entire animation 3×
- [ ] Memory: all 8 ring textures freed after animation completes
- [ ] Portrait mode: works correctly
- [ ] Landscape mode: works correctly (pillarboxing acceptable)

## Files Affected

| File | Action |
|------|--------|
| `public/assets/boot/cave_ring_1_entrance.png` | NEW (already placed) |
| `public/assets/boot/cave_ring_2_roots.png` | NEW (already placed) |
| `public/assets/boot/cave_ring_3_stalactite.png` | NEW (already placed) |
| `public/assets/boot/cave_ring_4_crystal.png` | NEW (already placed) |
| `public/assets/boot/cave_ring_5_magma.png` | NEW (already placed) |
| `public/assets/boot/cave_ring_6_runes.png` | NEW (already placed) |
| `public/assets/boot/cave_ring_7_library.png` | NEW (already placed) |
| `public/assets/boot/cave_ring_8_void.png` | NEW (already placed) |
| `public/assets/boot/cave_ring_1.png` | DELETE (old) |
| `public/assets/boot/cave_ring_1.webp` | DELETE (old) |
| `public/assets/boot/cave_ring_2.png` | DELETE (old) |
| `public/assets/boot/cave_ring_2.webp` | DELETE (old) |
| `public/assets/boot/cave_ring_3.png` | DELETE (old) |
| `public/assets/boot/cave_ring_3.webp` | DELETE (old) |
| `src/game/scenes/BootAnimScene.ts` | REWRITE (Part 2 + transition) |

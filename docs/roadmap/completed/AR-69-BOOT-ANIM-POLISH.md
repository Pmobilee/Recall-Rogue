# AR-69: Boot Animation Polish — Logo Disintegration, Blurred Camp, Ring Edge Masking

**Status:** In Progress
**Created:** 2026-03-17

## Overview
Three polish fixes for the boot animation cave fly-through.

## Tasks

### 1. Logo disintegration effect
Instead of a plain fade, the logo should disintegrate into particles that scatter upward/outward like blowing away in wind. Then stars drift up (looking down). The logo elements should also drift upward slightly as they disintegrate.

### 2. Blurred campsite visible through ring holes
The Svelte HubScreen (all sprites) should be visible through the cave ring holes during the entire fly-through, heavily blurred. As the last ring passes, smoothly deblur. Currently hub-wrapper is hidden during cave — need to make it visible but blurred.

### 3. Ring edge masking — infinite blackness outside each ring
Each ring PNG has transparent edges outside the rock walls. When seen through a larger ring's hole, the PNG boundary is visible. Fix: place a large black rectangle behind each ring image at the same depth. This ensures the area outside each ring's rock is always black. The black rects scale/move/fade with their ring.

## Files Affected
- `src/game/scenes/BootAnimScene.ts` — all three changes
- `src/CardApp.svelte` — hub-wrapper blur visibility change

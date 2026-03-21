# AR-115: 3D Zoom Room Transitions

## Overview
Replace the current clip-path wipe transitions with 3D perspective zoom effects when entering and leaving rooms. Entering a room zooms the camera forward as if physically walking through a doorway. Leaving zooms out as if stepping back.

**Complexity**: Medium — CSS animation changes in the transition overlay system.
**Dependencies**: None.

## Design

### Entering a Room (Zoom In)
When transitioning TO any room (combat, shop, rest, mystery, treasure, reward):
1. Screen goes dark (existing loading phase — 350ms)
2. New room renders behind the overlay
3. Reveal phase: overlay starts scaled up (zoomed in, slightly blurred) and rapidly scales down to normal while fading out — creating the illusion of zooming INTO the room

CSS approach: the OVERLAY (dark cover) does a reverse-zoom — it starts at `scale(1)` covering the screen, then zooms to `scale(3)` while fading out, making it look like the player is rushing forward through the darkness into the room.

### Leaving a Room (Zoom Out)
When transitioning FROM a room back to the map or another screen:
1. Current screen gets a quick zoom-OUT effect — the overlay fades in while scaling from `scale(0.5)` to `scale(1)`, as if the camera pulls back
2. Then loading phase, then next screen zooms in

### CSS Implementation
Replace the directional `revealDown/Up/Left/Right` keyframes with a single `revealZoomIn` keyframe:

```css
@keyframes revealZoomIn {
  0% {
    opacity: 1;
    transform: scale(1);
    filter: blur(0px);
  }
  40% {
    opacity: 0.8;
    transform: scale(1.5);
    filter: blur(2px);
  }
  100% {
    opacity: 0;
    transform: scale(3);
    filter: blur(4px);
  }
}
```

The blur creates depth-of-field, making the zoom feel 3D rather than flat. The overlay zooms AWAY from the viewer (scale up = moves toward camera = camera moves through it).

### Direction Mapping
- ALL room entries use `revealZoomIn` (replaces revealDown, revealLeft, etc.)
- Return to map uses `revealZoomIn` with slightly different timing (faster, less blur)
- Hub/menu screens keep `revealFade` (these aren't "rooms")

## Also Fix: Camp Background Horizontal Stretch

The camp background image (571x1024) doesn't cover wide viewports well. Currently using `object-fit: cover` which crops. The user wants it to stretch to fill. Change to `object-fit: fill` which stretches the image to cover the full viewport without cropping, at the cost of slight aspect ratio distortion (acceptable for a background).

## Sub-steps

### 1. Add zoom keyframes to CardApp.svelte
Add `revealZoomIn` and optional `revealZoomOut` keyframes in the `<style>` section.

### 2. Update transition direction mapping
In `src/ui/stores/gameState.ts`, change `inferTransitionDirection` to return `'zoom'` for room entries instead of `'down'`/`'left'`.

### 3. Wire zoom class in CardApp.svelte overlay
Add `wipe-zoom` class handling alongside existing `wipe-down`, `wipe-up`, etc.

### 4. Fix camp bg object-fit
In `src/ui/components/HubScreen.svelte`, change `.camp-bg` `object-fit` from `cover` to `fill`.

### 5. Add perspective to transition overlay
Add `perspective: 1000px` and `transform-origin: center center` to the `.screen-transition` base styles for 3D depth.

## Files Affected
- `src/CardApp.svelte` — Zoom keyframes + class wiring
- `src/ui/stores/gameState.ts` — Direction mapping
- `src/ui/components/HubScreen.svelte` — Camp bg object-fit

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Entering combat from map: zoom-in effect visible
- [ ] Entering shop/rest/mystery: zoom-in effect visible
- [ ] Returning to map from room: zoom-in reveal
- [ ] Hub screens still use fade (not zoom)
- [ ] Camp background fills full viewport without cropping gaps
- [ ] Reduced motion: falls back to simple fade

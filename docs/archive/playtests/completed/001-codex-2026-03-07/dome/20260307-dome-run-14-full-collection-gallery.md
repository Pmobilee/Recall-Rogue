# Dome Sweep Playthrough Report

- Run ID: 20260307-dome-run-14-full-collection-gallery
- Run type: dome sweep
- Scenario preset: full_collection
- URL: http://localhost:5173?skipOnboarding=true&devpreset=full_collection
- Timestamp: 2026-03-07T13:57:44.576Z
- Result: PARTIAL
- Blocker: Phaser/canvas-only surfaces expose no DOM `data-testid` interactables for direct click-through verification on gallery/museum/decorator screens.

## Coverage: Gallery/Museum/Decorator Surfaces

- Initial state: `screen=cutscene`, `floorIndex=9`.
- Progression actions succeeded: clicked `Skip`, then `Continue`.
- Forced screen checks accepted:
  - `dome` -> `dome`
  - `museum` -> `museum`
  - `decorator` -> `decorator`
  - `gallery` -> `gallery`
- Floor reachability checks in dome accepted:
  - `museumFloor` index `4` -> `screen=dome`, `floorIndex=4`
  - `galleryFloor` index `9` -> `screen=dome`, `floorIndex=9`
  - `starterFloor` index `0` -> `screen=dome`, `floorIndex=0`

## Missing Sprites

- No sprite-asset HTTP failures detected (`.png/.webp/.jpg/.jpeg/.gif/.svg`): none observed.
- Sprite validation is partial because target surfaces are rendered on Phaser canvas and do not expose per-sprite DOM hooks in this run.

## Clipping / Z-Order

- No DOM interactables were reported (`interactiveElements=[]`) on gallery/museum/decorator/dome checkpoints, so no DOM clipping/occlusion/z-order conflicts were detected.
- Canvas-layer clipping/z-order remains unconfirmed in this run due lack of exposed element-level hooks.

## Console / Runtime Issues

- `[error] Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
- `[error] Failed to load resource: the server responded with a status of 404 (Not Found)`
- Failed requests captured:
  - `500` `http://localhost:3001/api/facts/packs/all`
  - `404` `http://localhost:5173/api/facts/delta?since=0&limit=500`
- WebGL warnings observed (GPU stall due `ReadPixels`), no page-level uncaught exception captured.

## Final State

- `screen=dome`
- `floorIndex=0`
- One browser session used for this playthrough run.

# Recall Rogue — Browser Compatibility Matrix

Manual test matrix for verifying feature support before each production release.

## Test Matrix

| Feature | Chrome 120+ | Firefox 120+ | Safari 17+ | Edge 120+ |
|---------|-------------|--------------|------------|-----------|
| WebGL rendering | | | | |
| Service Worker registration | | | | |
| Quiz keyboard shortcuts (1–4) | | | | |
| PWA install prompt | | | | |
| WebAudio synthesis | | | | |
| Right-click context menus | | | | |
| Offline fallback (offline.html) | | | | |
| IndexedDB (facts cache) | | | | |
| WebShare API | | | | |
| CSS dvh units | | | | |

## Status Key

- PASS — Feature works as expected
- FAIL — Feature broken, blocker
- PARTIAL — Works with limitations (note below)
- N/A — Feature not applicable/available on this browser

## Known Issues

### Safari / WebKit
- `AudioContext` must be resumed after a user gesture. Patch applied in `browserCompat.ts` → `applyCompatPatches()`.
- `100vh` miscalculates on iOS Safari due to browser chrome. Use `100dvh` instead (patched in `desktop.css`).
- Rubber-band scroll can interfere with game canvas; `overscroll-behavior: none` applied.

### Firefox
- `sql.js` WASM uses `ArrayBuffer` correctly (no `SharedArrayBuffer` needed).
- Service Worker pre-cache of `/facts.db` requires HTTPS in production (works on localhost).

### Edge
- Behaves identically to Chrome (both Chromium-based). Run Chrome tests to cover Edge.

## How to Run

1. Build production: `npm run build`
2. Serve dist locally: `npx serve dist`
3. Open in each browser, verify each feature row above
4. Fill in results and note the browser version tested
5. File issues for any FAIL or unexpected PARTIAL results

## Release Checklist

Before marking a release as production-ready, all cells in the matrix above must be PASS or N/A for Chrome, Firefox, and Safari. Edge is expected to match Chrome.

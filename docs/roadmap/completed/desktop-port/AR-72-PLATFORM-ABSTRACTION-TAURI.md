# AR-72: Platform Abstraction & Tauri Desktop Wrapper

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §11
> **Priority:** FOUNDATION
> **Complexity:** Medium
> **Dependencies:** None

## Context

The app currently uses Capacitor as the only native wrapper (Android/iOS). For Steam, we need a desktop wrapper. Tauri v2 is the choice — ~10MB installer vs Electron's ~150MB, Rust backend for Steamworks SDK integration.

**Critical distinction:** Layout mode (portrait/landscape) is SEPARATE from platform (mobile/desktop/web). A tablet in landscape gets landscape layout. A desktop with a vertical monitor gets portrait layout. Layout = viewport shape. Platform = API availability.

## Directive

### Step 1: Create Platform Detection Service

**File:** NEW `src/services/platformService.ts`

```typescript
export type Platform = 'mobile' | 'desktop' | 'web';

export const platform: Platform = (() => {
  if (typeof window !== 'undefined' && (window as any).__TAURI__) return 'desktop';
  if (typeof window !== 'undefined' && (window as any).Capacitor) return 'mobile';
  return 'web';
})();

export const isDesktop = platform === 'desktop';
export const isMobile = platform === 'mobile';
export const isWeb = platform === 'web';

/** Whether Steam APIs are available (desktop + Steam build) */
export const hasSteam = isDesktop; // Refined later when Steam SDK integrated
```

**Acceptance:** Correctly detects platform in Capacitor, Tauri, and browser environments.

### Step 2: Initialize Tauri v2 Project

**Root directory changes:**

- Run `npm create tauri-app` or manually create Tauri config
- Create `src-tauri/` directory with:
  - `Cargo.toml` — Rust dependencies (tauri v2, tauri-plugin-shell)
  - `tauri.conf.json` — Window config:
    - Title: `"Recall Rogue"`
    - Min size: `1280×720`
    - Default size: `1920×1080`
    - Resizable: `true`
    - Fullscreen: `false` (toggleable)
    - Decorations: `true`
  - `src/main.rs` — Minimal Tauri entry point
  - `icons/` — App icons (placeholder is fine)
- Add to `.gitignore`: `src-tauri/target/`

**Acceptance:** `cargo tauri dev` launches the app in a native window. Web app renders inside Tauri WebView.

### Step 3: Build Scripts

**File:** `package.json` — add scripts:

```json
{
  "build:web": "vite build",
  "build:desktop": "cargo tauri build",
  "dev:desktop": "cargo tauri dev",
  "build:mobile": "npx cap sync && npx cap build"
}
```

**Acceptance:** Each build script produces the correct artifact for its platform.

### Step 4: Platform-Aware Service Guards

**File:** `src/services/hapticService.ts`

- Wrap Capacitor Haptics calls with `if (isMobile)` guard
- Desktop/web: no-op for haptic calls

**File:** `src/services/notificationService.ts`

- Guard push notification registration with `if (isMobile)`

**File:** Any other Capacitor-specific service — add platform guards

**Acceptance:** No Capacitor errors when running in Tauri or browser.

### Step 5: Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run build` (web) succeeds
- [ ] `cargo tauri dev` launches app in native window (if Rust toolchain available)
- [ ] Phaser canvas renders inside Tauri WebView
- [ ] No Capacitor errors on desktop
- [ ] Platform correctly detected in each environment

## Files Affected

| File | Action |
|------|--------|
| `src/services/platformService.ts` | NEW |
| `src-tauri/` | NEW directory |
| `src-tauri/Cargo.toml` | NEW |
| `src-tauri/tauri.conf.json` | NEW |
| `src-tauri/src/main.rs` | NEW |
| `package.json` | MODIFY (add build scripts) |
| `src/services/hapticService.ts` | MODIFY (add platform guard) |
| `.gitignore` | MODIFY (add src-tauri/target/) |

## GDD Updates

Add to `docs/GAME_DESIGN.md` §30 (Technical Notes): Tauri v2 is the desktop wrapper. Platform detection via `platformService.ts`. Layout mode is independent of platform.

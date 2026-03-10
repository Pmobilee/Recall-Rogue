# AR-13: Launch Readiness (Web + Capacitor Native)
> Phase: Pre-Launch — QA & Deployment
> Priority: BLOCKER
> Depends on: AR-08 through AR-12 (all features)
> Estimated scope: L

Everything needed for launch. Web build deployed and tested. Capacitor native builds (Android/iOS) verified on real devices. Performance audit ensures 60fps and <3s cold start. Full E2E test suite passing. Dead code removed. PWA configured for mobile web. All systems go for soft launch.

## Design Reference

From GAME_DESIGN.md Section 19 (Accessibility):

> Visual: colorblind support (shape/icon), 3 text sizes, high contrast, reduce motion
> Motor: 48dp+ tap targets, tap-only (no swipe), no timer in Explorer
> Cognitive: gentle difficulty progression, hints, readable language

From GAME_DESIGN.md Section 29 (Technical):

> Performance: 60fps combat, <3s cold start, <50KB run state, <150MB memory
> Build: Vite tree-shaking, <500KB gzipped JS, 0 console errors in production

## Implementation

### Sub-task 1: Web Build Optimization

#### JavaScript Bundle Size

```bash
npm run build
# Check output:
# dist/index.html ~50KB
# dist/index.*.js ~400-500KB (gzipped)
# dist/index.*.css ~50KB
```

Verify tree-shaking:

```typescript
// In vite.config.ts, ensure production config:

export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep Phaser + game logic separate from UI
          'phaser-game': ['phaser', 'src/game/'],
        },
      },
    },
    minify: 'terser',  // Terser offers better minification than esbuild
    sourcemap: false,  // No source maps in production
    reportCompressedSize: true,
  },
};
```

#### Asset Optimization

```bash
# Compress all PNGs in src/assets/
find src/assets -name "*.png" -exec pngquant --ext .png --quality=65-80 {} \;

# Verify no unused images
grep -r "import.*from.*assets" src/ | cut -d'"' -f2 | sort | uniq > used-assets.txt
find src/assets -name "*.png" | sort > all-assets.txt
comm -23 all-assets.txt used-assets.txt  # Unused files
```

#### Font Subsetting

Subset `PressStart2P` to used characters:

```bash
# Install fonttools
pip install fonttools

# Subset font
pyftsubset src/assets/fonts/PressStart2P.ttf \
  --unicodes=U+0020-U+007E,U+00A0-U+00FF \
  --output-file=src/assets/fonts/PressStart2P-subset.woff2 \
  --flavor=woff2
```

Update CSS:

```css
@font-face {
  font-family: 'PressStart2P';
  src: url('/fonts/PressStart2P-subset.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

#### Lazy Load Knowledge Library & Gallery

```typescript
// In App.svelte, use dynamic imports

const KnowledgeLibrary = defineAsyncComponent(() =>
  import('./ui/screens/KnowledgeLibrary.svelte')
);
const LoreGallery = defineAsyncComponent(() =>
  import('./ui/screens/LoreGallery.svelte')
);

// Only loaded when screen changes to library/gallery
```

### Sub-task 2: Web Deployment

Deploy to a public URL (Vercel, Netlify, or similar):

```bash
# Vercel example
vercel --prod

# Netlify example
netlify deploy --prod --dir dist/
```

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "cleanUrls": true,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/.*", "dest": "/index.html" }
  ],
  "headers": [
    {
      "source": "/:path*",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### Sub-task 3: PWA Configuration

```typescript
// vite.config.ts, add PWA plugin

import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Recall Rogue',
        short_name: 'Recall Rogue',
        description: 'Learn facts. Build decks. Delve.',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: '/screenshots/screenshot-1.png',
            sizes: '540x720',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: '/screenshots/screenshot-2.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
          },
        ],
        shortcuts: [
          {
            name: 'Start Run',
            short_name: 'Run',
            description: 'Begin a new run',
            url: '/?screen=run',
            icons: [{ src: '/icons/shortcut-run.png', sizes: '96x96' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'CacheFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
};
```

Add to `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#1a1a1a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Recall Rogue" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/icons/icon-180.png" />
  <link rel="manifest" href="/manifest.json" />
  <title>Recall Rogue</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### Sub-task 4: Capacitor Build (Android)

```bash
# Install Capacitor and Android dependencies
npm install @capacitor/core @capacitor/android @capacitor/cli
npx cap init

# Configure capacitor.config.ts
```

```typescript
// capacitor.config.ts

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arcanerecall.game',
  appName: 'Recall Rogue',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    Preferences: {},
    Haptics: {},
    Share: {},
  },
};

export default config;
```

```bash
# Sync web build to Android
npm run build
npx cap sync android

# Open Android Studio
npx cap open android
```

In Android Studio:
1. Select device (Pixel 7 emulator, API 34)
2. Click Run
3. App launches on emulator

Verify:
- No crash on startup
- Portrait orientation locked
- Status bar does not overlap content
- Bottom safe area (nav bar) respected
- Haptics work

Fix common issues:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application
  android:usesCleartextTraffic="false">
  <activity
    android:screenOrientation="portrait"
    ...
  />
</application>
```

### Sub-task 5: Capacitor Build (iOS)

```bash
# Sync web build to iOS
npx cap sync ios

# Open Xcode
npx cap open ios
```

In Xcode:
1. Select simulator (iPhone 15 Pro, iOS 17)
2. Click Run
3. App launches on simulator

Verify:
- No crash on startup
- Safe area (notch + home indicator) handled
- Orientation locked to portrait
- Haptics work

Fix common issues:

```swift
// ios/App/App/Info.plist
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>

<key>UISupportedInterfaceOrientationsIPad</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
```

Ensure safe area CSS:

```css
body {
  padding-top: max(0px, env(safe-area-inset-top));
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

### Sub-task 6: E2E Test Suite

Create comprehensive Playwright tests (in `tests/e2e/playwright/*.spec.ts`):

1. **app-loads.spec.ts** — App boots, no errors
2. **onboarding-flow.spec.ts** — First run flow
3. **card-play-flow.spec.ts** — 3-stage commit
4. **combat-mechanics.spec.ts** — AP, enemy turns, victory
5. **dynamic-timer.spec.ts** — Timer mechanics
6. **domain-decoupling.spec.ts** — Same domain, different card types
7. **combo-system.spec.ts** — Combo tracking
8. **echo-mechanic.spec.ts** — Echo cards reappear
9. **passive-relics.spec.ts** — Tier 3 → passive, dormancy
10. **room-selection.spec.ts** — 3 doors, room types
11. **retreat-or-delve.spec.ts** — Boss checkpoint
12. **card-reward.spec.ts** — Victory → 3 types → pick
13. **fsrs-scheduling.spec.ts** — Tier derivation, variant rotation
14. **difficulty-modes.spec.ts** — Explorer, Standard, Scholar
15. **hint-system.spec.ts** — 1/encounter, 3 types
16. **knowledge-library.spec.ts** — Domain list, search, filter
17. **lore-discovery.spec.ts** — Unlock, gallery
18. **bounty-quests.spec.ts** — Selection, progress, completion
19. **streak-system.spec.ts** — Daily count, freeze, milestones
20. **run-summary.spec.ts** — Post-run stats, share
21. **save-resume.spec.ts** — Save after encounter, resume
22. **hub-navigation.spec.ts** — Screen transitions, nav bar
23. **card-type-selection.spec.ts** — Type selection reward
24. **accessibility.spec.ts** — Touch targets ≥48dp, text scaling
25. **performance.spec.ts** — 60fps, cold start <3s
26. **cloud-sync.spec.ts** — Push/pull, conflict resolution
27. **account.spec.ts** — Create account, login, logout

Example test:

```typescript
// tests/e2e/playwright/app-loads.spec.ts

import { test, expect } from '@playwright/test';

test.describe('App Loading', () => {
  test('app loads without errors', async ({ page }) => {
    // Navigate with dev bypass
    await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial');

    // Wait for app to be ready
    await page.waitForLoadState('networkidle');

    // Check for console errors
    const logs: any[] = [];
    page.on('console', msg => logs.push(msg.text()));

    const errors = logs.filter(l => l.includes('error') || l.includes('Error'));
    expect(errors).toHaveLength(0);

    // Verify initial screen renders
    const hubTitle = await page.locator('text=RECALL ROGUE').isVisible();
    expect(hubTitle).toBeTruthy();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/app-loads.png' });
  });

  test('cold start time <3s', async ({ page }) => {
    const start = Date.now();
    await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;

    console.log(`Cold start: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3000);
  });
});
```

Run tests:

```bash
npx playwright test --project=chromium
```

### Sub-task 7: Performance Audit

Create `tests/e2e/performance-audit.cjs`:

```javascript
const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Monitor performance
  const metrics = [];
  page.on('frameupdate', () => {
    // Capture FPS if available
  });

  // Navigate and start combat
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=mid_run');
  await page.waitForLoadState('networkidle');

  // Play 10 cards and measure metrics
  for (let i = 0; i < 10; i++) {
    // Click card, answer, record time
    const start = Date.now();
    await page.click('[data-testid="card-0"]');
    await page.click('[data-testid="btn-cast"]');
    await page.click('[data-testid="quiz-answer-0"]');
    const elapsed = Date.now() - start;

    console.log(`Card ${i + 1}: ${elapsed}ms`);
  }

  // Check memory
  const perf = JSON.parse(
    await page.evaluate(() => JSON.stringify({
      memory: (performance as any).memory,
      timing: performance.timing,
    }))
  );

  const memoryUsage = perf.memory?.usedJSHeapSize || 0;
  console.log(`Memory used: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);

  assert(memoryUsage < 150 * 1024 * 1024, 'Memory limit exceeded');

  await browser.close();
})();
```

Run:

```bash
node tests/e2e/performance-audit.cjs
```

### Sub-task 8: Dead Code Cleanup

Remove all mining-era code:

```bash
# Remove archived directory
rm -rf src/_archived-mining/

# Remove old scene/manager files
grep -r "import.*Mining" src/ | cut -d: -f1 | sort | uniq
# Review and delete if not imported
```

After deletion:

```bash
npm run typecheck  # Should pass with no dangling imports
npm run build      # Should succeed
npx vitest run     # Should pass
```

### Sub-task 9: Accessibility Audit

#### Touch Targets

```typescript
// Script to verify all interactive elements are ≥48dp

const elements = document.querySelectorAll('[role="button"], button, [role="link"], a');
elements.forEach(el => {
  const rect = el.getBoundingClientRect();
  const dpiScaling = window.devicePixelRatio || 1;
  const widthDp = rect.width / dpiScaling;
  const heightDp = rect.height / dpiScaling;

  if (widthDp < 48 || heightDp < 48) {
    console.warn(`⚠ Small touch target: ${el.textContent} (${widthDp.toFixed(0)}×${heightDp.toFixed(0)}dp)`);
  }
});
```

#### Text Scaling

Verify text scales with system setting:

```css
/* In App.svelte or root */
:root {
  --text-scale: 1;  /* Set from Settings */
}

body {
  font-size: calc(16px * var(--text-scale));
}
```

#### High Contrast

```css
body.high-contrast {
  --text-color: #fff;
  --bg-color: #000;
  --border: 2px solid #fff;
}
```

#### Reduce Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
  }
}
```

### Sub-task 10: Error Tracking Setup (Optional)

Integrate basic error tracking (Sentry or similar):

```typescript
// In src/main.ts

import * as Sentry from "@sentry/svelte";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

### Sub-task 11: App Store Metadata

Create `docs/APP_STORE.md`:

```markdown
# App Store Submission

## App Details

- **Name:** Recall Rogue
- **Subtitle:** Learn Facts. Build Decks. Delve.
- **Description:**
  Recall Rogue is an educational card roguelite. Combine strategic deck-building with spaced repetition learning. Answer questions to activate cards in turn-based combat. Descend through procedurally generated dungeons, unlock new facts, and master multiple knowledge domains.

  Features:
  - Roguelite Gameplay: 500+ facts across domains. Procedural runs, meaningful choices.
  - Spaced Repetition: SM-2 scheduling. Learning IS the game mechanic.
  - Accessibility: Explorer mode (no timer), text scaling, colorblind support.
  - Cross-Device: Play on web or native (iOS/Android). Progress syncs.

- **Keywords:** education, card game, roguelite, trivia, flashcards, learning, quiz, spaced repetition, study
- **Category:** Education (primary), Games → Card (secondary)
- **Age Rating:** 4+ (ESRB E)
- **Privacy Policy:** [link to doc]
- **Terms of Service:** [link to doc]

## Screenshots

Generate via Playwright at these resolutions:
1. iPhone 6.7" (1290×2796) — Combat scene with cards
2. iPhone 6.1" (1179×2556) — Card committed with question
3. iPhone 5.5" (750×1334) — Domain selection
4. iPad 12.9" (2048×2732) — Knowledge Library
5. Android (1080×2400) — Run summary

## Release Notes (v1.0)

- Launch version
- Full card roguelite with 500+ facts
- Cross-device cloud save
- Accessibility: 3 text sizes, colorblind mode, Explorer difficulty
```

## System Interactions

- **All AR phases (AR-01 through AR-12):** AR-13 integrates and verifies them all.
- **Web build:** Deployed to public URL. No changes to game logic.
- **Native builds:** Capacitor wraps web app. Same code, same features.
- **Testing:** E2E tests cover all systems. Per-phase tests already exist.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| App launched on iPhone with notch | Safe area respected. Content below notch. |
| App launched on Android API 28 (old) | Works. May have minor visual differences. |
| Network offline after app installed (PWA) | App works offline. Cloud features disabled. |
| Very slow device (low-end Android) | Particles reduced. Animations skip. Still playable. |
| Device rotated during combat | Locked to portrait. Rotation prevented. |
| App in background for >1 hour | State preserved. Resume picks up where left off. |
| Tab closed during run (web) | localStorage saved. Refresh resumes run. |
| Phaser canvas rendering <60fps | Performance audit flags. Optimize (reduce objects/particles). |
| Text size "large" + long question | Text wraps. Layout reflows. No overflow. |
| Accessibility features all enabled | App still functional. May be slower (no animations, reduced particles). |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `vite.config.ts` | Optimize bundle, tree-shaking, minification, PWA plugin |
| Create | `vercel.json` | Web deployment config |
| Create | `public/manifest.json` | PWA manifest |
| Create | `public/sw.js` | Service worker (auto-generated by PWA plugin) |
| Modify | `index.html` | Meta tags for PWA, theme color, apple-touch-icon |
| Modify | `capacitor.config.ts` | Android/iOS settings |
| Modify | `android/app/src/main/AndroidManifest.xml` | Portrait lock, no cleartext |
| Modify | `ios/App/App/Info.plist` | Portrait lock, safe area |
| Create | `tests/e2e/playwright/app-loads.spec.ts` | Core E2E tests (27 test files total) |
| Create | `tests/e2e/performance-audit.cjs` | Performance benchmark script |
| Modify | `src/_archived-mining/` | Delete entire directory |
| Modify | `src/services/sm2.ts` | Delete (deprecated by AR-02) |
| Create | `docs/APP_STORE.md` | App store submission guide |
| Create | `docs/DEPLOYMENT.md` | Deployment instructions |

## Done When

- [ ] Web build optimized: <500KB JS gzipped, <50KB CSS
- [ ] Web deployed to public URL (Vercel/Netlify)
- [ ] PWA configured: manifest, service worker, offline support
- [ ] Android build compiles, runs on Pixel 7 emulator (API 34)
- [ ] iOS build compiles, runs on iPhone 15 Pro simulator (iOS 17)
- [ ] Status/nav bar on both platforms do not overlap content
- [ ] Safe areas respected (notch, home indicator, gesture nav)
- [ ] Portrait orientation locked on both platforms
- [ ] Haptics work on physical Android device
- [ ] All 27 E2E test files created and passing
- [ ] Dev presets working: post_tutorial, mid_run, boss_fight, etc.
- [ ] Performance: 60fps combat, <3s cold start, <150MB memory
- [ ] Touch targets ≥48dp (automated audit passes)
- [ ] Text scaling works (3 sizes)
- [ ] High contrast mode: WCAG AA 4.5:1 ratio
- [ ] Reduce motion: no particles, no shake, no animations
- [ ] Dead code removed: src/_archived-mining/, sm2.ts deleted
- [ ] No dangling imports after cleanup
- [ ] 0 console errors in production build
- [ ] App store metadata drafted
- [ ] `npx vitest run` passes (215+ tests)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

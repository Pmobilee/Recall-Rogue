# AR-07: Launch Readiness
> Phase: Pre-Launch — Ship It
> Priority: BLOCKER
> Depends on: AR-01 through AR-06 (all pre-launch phases)
> Estimated scope: L

Everything needed to submit to app stores. Capacitor builds verified on Android and iOS. Accessibility baseline met. Full E2E test suite covering all game systems. Performance audit ensuring 60fps combat. Dead code cleanup. App store metadata prepared.

## Design Reference

From GAME_DESIGN.md Section 19 (Accessibility):

> | Category | Detail |
> |----------|--------|
> | Visual | Colorblind (shape/icon not just color), 3 text sizes, high contrast, reduce motion |
> | Motor | Tap only, 48dp+ targets, no timer in Explorer, Slow Reader option |
> | Cognitive | Explorer soft fail, hints, numeric+icon indicators, 6th-grade reading level |

From GAME_DESIGN.md Section 29 (Technical Notes):

> Stack: Svelte 5 + Phaser 3 + TypeScript + Capacitor. Portrait. Mobile-first.
> Phaser performance: 60fps target. ~15 game objects in combat. 50 particle cap.
> State persistence: Save after every encounter via @capacitor/preferences. 24h survival. Run state JSON <50KB.
> Cold start: <3s.

From GAME_DESIGN.md Section 16 (Touch Targets):

> | Element | Size |
> |---------|------|
> | General | 48x48dp min |
> | Cards in hand | 60x80dp |
> | Cast button | 80x48dp |
> | Answer buttons | Full width, 56dp height, 8dp spacing |
> | End Turn | Full width, 48dp |
> | Bottom safe area | 16dp for gesture nav |

## Implementation

### Sub-task 1: Capacitor Build Verification

#### Android

1. Run `npx cap sync android` — sync web build to Android project
2. Open in Android Studio: `npx cap open android`
3. Verify:
   - App launches on Pixel 7 emulator (API 34) without crash
   - Status bar: dark background, light icons, does not overlap content
   - Navigation bar: transparent, 16dp safe area at bottom respected
   - Keyboard: does not push layout up unexpectedly (relevant for Scholar free-recall input)
   - Orientation: locked to portrait (`android:screenOrientation="portrait"` in AndroidManifest.xml)
   - Permissions: none required (no camera, microphone, location)
   - Splash screen: dark background, app icon centered, <2s display
   - App icon: 192×192 adaptive icon (foreground + background layers)
   - Haptics: `@capacitor/haptics` works on physical device

4. Fix common issues:
   - `capacitor.config.ts`: set `server.androidScheme: 'https'` for secure context
   - `AndroidManifest.xml`: `android:usesCleartextTraffic="false"`
   - Safe area CSS: `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`

#### iOS

1. Run `npx cap sync ios` — sync web build to iOS project
2. Open in Xcode: `npx cap open ios`
3. Verify:
   - App launches on iPhone 15 Pro simulator (iOS 17) without crash
   - Status bar: content inset below notch/Dynamic Island
   - Home indicator: 16dp bottom safe area (gesture nav)
   - Orientation: locked to portrait (Info.plist `UISupportedInterfaceOrientations`)
   - No permissions requested
   - Splash screen: LaunchScreen.storyboard with dark background + centered icon
   - App icon: 1024×1024 for App Store, scaled versions auto-generated
   - Haptics: Core Haptics via Capacitor works

4. Fix common issues:
   - WKWebView configuration in `capacitor.config.ts`
   - `viewport-fit=cover` in `index.html` `<meta>` tag for safe areas
   - CSS: `-webkit-touch-callout: none` to prevent long-press context menus on cards

### Sub-task 2: Accessibility Baseline

#### Visual Accessibility

**Colorblind support:**
- Every UI element that uses color as a differentiator MUST also have a shape or icon:
  - Card types: each type has a unique icon (sword=attack, shield=shield, heart=heal, arrow-up=buff, skull=debuff, gear=utility, leaf=regen, star=wild) IN ADDITION to color
  - Tier badges: T1=circle, T2a=triangle, T2b=diamond, T3=star — in addition to color
  - HP bars: show numeric value alongside bar
  - Timer bar: show seconds as text alongside bar
  - Combo counter: show numeric multiplier (already exists)
  - Domain: icon (from AR-03) + name, not just color tint

**3 text sizes:**
```typescript
type TextSize = 'small' | 'medium' | 'large';

const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.85,   // -15%
  medium: 1.0,   // Default
  large: 1.2,    // +20%
};
```

Apply via CSS custom property: `--text-scale: 1.0;` on `:root`, multiply all `font-size` values.

Implementation: In settings, add "Text Size" selector with 3 options. Save to `playerProfile.textSize`. Apply on app start via `document.documentElement.style.setProperty('--text-scale', scale)`.

Text that MUST scale: card names, mechanic descriptions, question text, answer text, stat labels, menu items, tooltips. Text that does NOT scale: tiny UI labels (AP counter, floor number).

**High contrast mode:**
- Toggle in settings: `playerProfile.highContrast: boolean`
- When enabled: increase all text contrast to WCAG AA (4.5:1 ratio minimum)
- Background darkens, text brightens, borders thicken by 1px
- Apply via CSS class `.high-contrast` on body

**Reduce motion:**
- Toggle in settings: `playerProfile.reduceMotion: boolean`
- When enabled: disable screen shake, particle effects, card launch animations
- Keep: haptics (independent), damage numbers (static, no arc), HP bar changes (instant, no tween)
- Phaser: skip all tweens, hide particle emitters
- Svelte: add `prefers-reduced-motion` media query support + manual toggle

#### Motor Accessibility

- Verify ALL interactive elements ≥ 48×48dp touch target
- Audit every button, card, answer option, menu item
- No swipe gestures required — tap only
- No drag-and-drop — tap to select, tap to confirm
- Explorer mode: no timer (already from AR-04)
- Slow Reader: +3s (already from AR-01/AR-04)

#### Cognitive Accessibility

- Explorer mode with 50% wrong penalty (already from AR-04)
- Hint system (already from AR-04)
- All numeric values shown with icons (AP gems + number, HP bar + number)
- Question text at 6th-grade reading level (verify existing facts DB)
- No sudden unexpected events (all enemy actions telegraphed)

### Sub-task 3: Playwright E2E Test Suite

Create comprehensive E2E tests covering all game systems. Tests in `tests/e2e/playwright/`:

```typescript
// Test categories and what they verify:

// 1. app-loads.spec.ts — App boots, no console errors, correct initial screen
// 2. onboarding-flow.spec.ts — Dungeon entrance → slow reader → first combat → tooltips
// 3. card-play-flow.spec.ts — 3-stage commit: tap card (front only) → Cast → answer
// 4. combat-mechanics.spec.ts — AP deduction, skip free, end turn, enemy turn, victory/defeat
// 5. dynamic-timer.spec.ts — Floor-based timer, word bonus, slow reader bonus
// 6. domain-decoupling.spec.ts — Same domain has different card types in pool
// 7. combo-system.spec.ts — Combo builds on consecutive correct, resets on wrong
// 8. echo-mechanic.spec.ts — Wrong answer → echo card reappears later
// 9. passive-relics.spec.ts — Tier 3 → passive relic, dormancy on low retrievability
// 10. room-selection.spec.ts — 3 doors, room types, rest/treasure/mystery/shop
// 11. retreat-or-delve.spec.ts — Checkpoint after boss, retreat keeps 100%, continue risks
// 12. card-reward.spec.ts — Victory → pick 1 of 3 cards → added to deck
// 13. fsrs-scheduling.spec.ts — Tier derivation from stability, variant rotation
// 14. difficulty-modes.spec.ts — Explorer (no timer), Standard, Scholar (self-damage)
// 15. hint-system.spec.ts — 1 hint/encounter, 3 types, resets each encounter
// 16. knowledge-library.spec.ts — Domain list, fact list, fact detail, filter/sort
// 17. lore-discovery.spec.ts — Unlock at 10/25/50/100 mastered, presentation, gallery
// 18. bounty-quests.spec.ts — Selection, progress tracking, completion
// 19. streak-system.spec.ts — Daily count, freeze, milestones
// 20. run-summary.spec.ts — Post-run stats, share image generation
// 21. save-resume.spec.ts — Save after encounter, resume on reload
// 22. accessibility.spec.ts — Touch targets ≥48dp, text scaling, high contrast, reduce motion
// 23. performance.spec.ts — 60fps during combat (Phaser), cold start <3s
```

Each test uses dev bypass: `?skipOnboarding=true&devpreset=post_tutorial`

Dev presets needed (add to `CardGameManager.ts` or equivalent):
- `post_tutorial`: skip onboarding, auto-select domains, start at encounter 1
- `mid_run`: floor 5, 60 HP, 3 relics, deck with mixed tiers
- `boss_fight`: floor 3 boss encounter
- `low_hp`: 15 HP, floor 4, testing defeat/retreat
- `mastery_ready`: facts with stability 30+, 7 consecutive correct, ready for mastery trial
- `library_populated`: 50+ facts with mixed tiers for knowledge library testing

### Sub-task 4: Performance Audit

#### Targets

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Combat FPS | ≥55fps sustained (60fps target) | Phaser `game.loop.actualFps` logged every 5s |
| Cold start | <3s to interactive | Playwright `performance.timing.domInteractive` |
| Run state size | <50KB JSON | `JSON.stringify(runState).length` |
| FSRS data (500 facts) | <25KB | `JSON.stringify(factStates).length` |
| Memory (combat) | <150MB | `performance.memory.usedJSHeapSize` (Chrome) |
| Particle cap | ≤50 active | Phaser particle manager count |
| Game objects (combat) | ≤20 | `scene.children.length` |

#### Optimization Checklist

1. **Phaser sprite pool:** Verify 5 pre-created card sprites (reposition, don't create/destroy)
2. **Particle cap:** Verify 50 particle max, 300ms lifespan for correct answer burst (30 particles)
3. **Tween cleanup:** Verify all Phaser tweens complete and are removed (no tween leaks)
4. **Image optimization:** All PNGs compressed with `pngquant`. Sprite sheets instead of individual images.
5. **Font subsetting:** `PressStart2P` font subset to used characters only (ASCII + basic symbols)
6. **Bundle size:** Vite tree-shaking removes all dead mining code. Target <500KB gzipped JS.
7. **Lazy loading:** Knowledge Library and Lore gallery loaded on demand (dynamic import)

#### Performance Test Script

Create `tests/e2e/performance-audit.cjs`:
```javascript
// Navigate to combat, play 10 cards, measure:
// - FPS during card animations
// - Memory at start and end
// - Run state JSON size
// - Cold start time
// Report pass/fail against targets
```

### Sub-task 5: Dead Code Cleanup

#### Remove

| Path | Reason |
|------|--------|
| `src/_archived-mining/` | Entire directory — mining-era code, not imported anywhere |
| `src/game/scenes/MineScene.ts` | Mining-specific Phaser scene (if exists) |
| `src/game/managers/` | Mining-era managers (BiomeManager, HazardManager, etc.) — if not used by card roguelite |
| Old `App.svelte` | If exists alongside `CardApp.svelte` and is unreferenced |
| Old `GameManager.ts` | If exists alongside `CardGameManager.ts` and is unreferenced |
| `src/services/sm2.ts` | Deprecated by AR-02 (FSRS migration). Remove after FSRS is stable. |
| Unused balance constants | Any `SM2_*` constants in balance.ts after FSRS migration |
| Stale test files | Tests for removed mining code |

#### Verification

Before deleting:
1. `grep -r "import.*from.*<file>" src/` — confirm zero imports
2. `npm run build` — confirm build succeeds after removal
3. `npx vitest run` — confirm all tests pass
4. `npm run typecheck` — confirm no type errors

### Sub-task 6: App Store Metadata

#### Prepare (not submit — manual submission by human)

Create `docs/APP_STORE.md` with:

```markdown
## App Name
Recall Rogue

## Subtitle (30 chars)
Learn Facts. Build Decks. Delve.

## Description (4000 chars max)
[Draft compelling description highlighting: educational card roguelite, spaced repetition, 500+ facts, multiple domains, no ads in core game, privacy-first]

## Keywords
education, card game, roguelite, trivia, flashcards, learning, quiz, spaced repetition, study, knowledge

## Category
Primary: Education
Secondary: Games → Card

## Age Rating
4+ (no violence, no mature content, no user-generated content, no unrestricted web access)

## Privacy Policy URL
[Placeholder — needs legal review]

## Screenshots Needed
1. Combat screen with cards in hand (portrait)
2. Card committed with question visible
3. Domain selection screen
4. Knowledge Library
5. Run summary / Adventurer's Journal
6. Room selection with doors

Generate via Playwright at correct device resolutions:
- iPhone 6.7" (1290×2796) — iPhone 15 Pro Max
- iPhone 6.1" (1179×2556) — iPhone 15 Pro
- iPad 12.9" (2048×2732) — iPad Pro
- Android phone (1080×2400) — Pixel 7
- Android tablet (1600×2560) — Samsung Tab S7
```

### System Interactions

- **All AR phases:** AR-07 is the final integration gate. Every feature from AR-01 through AR-06 must be verified.
- **Capacitor:** @capacitor/haptics, @capacitor/preferences, @capacitor/share — all must work on native builds.
- **Phaser:** Performance audit directly tests CombatScene rendering.
- **FSRS:** Save state migration must survive Capacitor preferences roundtrip.
- **Accessibility:** Affects all UI components from all phases.
- **Dead code removal:** Must not break any imports or tests.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Android API 28 (oldest supported) | App launches, all features work. May have minor visual differences. |
| iOS 15 (oldest supported) | App launches, safe areas handled correctly. |
| Device with no haptic motor | Haptics calls silently no-op. No crash. |
| Very small screen (320dp width) | Cards scale down. Touch targets remain ≥48dp. Text may truncate with ellipsis. |
| Very large screen (tablet) | Content centered with max-width. No stretching beyond 480dp content width. |
| Airplane mode | App works fully offline. No network-dependent features in v1. |
| Low memory device (<2GB RAM) | Particle effects reduced. Sprite quality downgraded if needed. |
| Text size "large" + long question | Text wraps. Answer buttons grow in height. Scrollable if needed. |
| High contrast + dark mode OS | High contrast takes priority. Consistent appearance. |
| Reduce motion + combo milestone | No particles, no screen shake. Combo text still shows. Haptic still fires. |
| App backgrounded during combat | State auto-saved. Resume picks up where left off. Timer paused. |
| Delete and reinstall app | All progress lost (local storage only v1). Expected. |
| Run state exactly 50KB | Valid. At limit but not over. |
| Run state >50KB | Log warning. Still save. Investigate what's bloating state. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `capacitor.config.ts` | Android/iOS settings, server scheme, splash screen config |
| Modify | `android/app/src/main/AndroidManifest.xml` | Portrait lock, cleartext off, permissions |
| Modify | `ios/App/App/Info.plist` | Portrait lock, status bar style |
| Modify | `index.html` | viewport-fit=cover meta tag |
| Create | `src/services/accessibilityManager.ts` | Text scale, high contrast, reduce motion toggles |
| Modify | `src/ui/components/SettingsMenu.svelte` | Accessibility toggles: text size, high contrast, reduce motion |
| Modify | All Svelte UI components | Touch target audit (≥48dp), colorblind icons, text scale CSS var |
| Modify | `src/game/scenes/CombatScene.ts` | Reduce motion support, performance counters |
| Create | `tests/e2e/playwright/*.spec.ts` | 23 E2E test files covering all systems |
| Create | `tests/e2e/performance-audit.cjs` | Performance benchmark script |
| Modify | `src/game/CardGameManager.ts` | Dev presets for E2E testing |
| Delete | `src/_archived-mining/` | Dead mining code |
| Delete | `src/services/sm2.ts` | Deprecated by FSRS (AR-02) |
| Delete | Mining-era Phaser scenes/managers | If unreferenced |
| Create | `docs/APP_STORE.md` | App store metadata draft |
| Modify | `src/data/balance.ts` | Remove dead SM2_* constants |

## Done When

- [ ] Android APK builds and runs on Pixel 7 emulator (API 34) — no crash, correct orientation
- [ ] iOS build runs on iPhone 15 Pro simulator (iOS 17) — no crash, safe areas correct
- [ ] Status bar and navigation bar do not overlap game content on either platform
- [ ] Haptics work on physical Android device
- [ ] Every color-coded element has a shape/icon alternative (card types, tiers, HP, timer)
- [ ] 3 text sizes work: small (-15%), medium (default), large (+20%)
- [ ] High contrast mode: all text meets WCAG AA 4.5:1 contrast ratio
- [ ] Reduce motion: no particles, no screen shake, no card launch animation, haptics still work
- [ ] All touch targets ≥ 48×48dp (verified by automated audit)
- [ ] 23 E2E test files created and passing
- [ ] Dev presets work: post_tutorial, mid_run, boss_fight, low_hp, mastery_ready, library_populated
- [ ] Combat FPS ≥ 55fps sustained on mid-range device
- [ ] Cold start < 3s to interactive
- [ ] Run state JSON < 50KB
- [ ] Bundle size < 500KB gzipped JS
- [ ] `src/_archived-mining/` deleted, zero dangling imports
- [ ] `src/services/sm2.ts` deleted (after AR-02), zero dangling imports
- [ ] `docs/APP_STORE.md` created with name, description, keywords, category, age rating, screenshot list
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

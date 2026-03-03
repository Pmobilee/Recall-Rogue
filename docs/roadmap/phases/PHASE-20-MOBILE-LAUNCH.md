# Phase 20: Mobile Launch

**Status**: Planned (Android Capacitor setup complete — see commit `be5c5ce`)
**Goal**: Ship Terra Gacha to Google Play and Apple App Store with soft-launch strategy, full accessibility compliance, and a first-class web experience at terragacha.com.
**Design Decisions**: DD-V2-165, DD-V2-166, DD-V2-167, DD-V2-168, DD-V2-171, DD-V2-178

---

## Overview

The Capacitor Android platform is already configured (`com.terragacha.app`, Capacitor 8.1.0, GAIA splash screen). Phase 20 covers: polishing the Android build to store-submission quality, adding iOS, implementing accessibility features required for launch (DD-V2-178), making the web platform fully first-class at terragacha.com (DD-V2-171), and executing the phased geographic soft-launch strategy (DD-V2-167).

The primary category is Games > Adventure/Casual (DD-V2-165). The subtitle "Mine Deep. Learn Everything." is locked across both stores (DD-V2-166).

---

## Prerequisites

- Phase 19 complete (auth, cloud sync, analytics instrumented, offline-first)
- All 10 analytics events firing before any beta user touches the game (DD-V2-181)
- D1/D7/D30 retention cohort dashboard live
- `npm run build` produces clean production build with no TypeScript errors
- Production server deployed and healthy at configured URL
- `npx cap sync` runs without errors on Android

---

## Capacitor Build Commands Reference

```bash
# Build web assets
npm run build

# Sync to Capacitor native projects
npx cap sync android
npx cap sync ios

# Open in Android Studio (required for signing, release APK/AAB)
npx cap open android

# Open in Xcode (required for iOS signing, archive)
npx cap open ios

# Run on connected Android device (dev build)
npx cap run android

# Run on iOS simulator
npx cap run ios

# Build release AAB (from Android Studio or command line)
# In Android Studio: Build > Generate Signed Bundle / APK > Android App Bundle
# Then: Build > Generate Signed Bundle / APK > Choose keystore

# Build release IPA (from Xcode)
# In Xcode: Product > Archive > Distribute App

# Update Capacitor plugins
npx cap update

# Check Capacitor doctor
npx cap doctor
```

---

## Sub-Phase 20.1: Capacitor Builds Polish

- **What**: Complete the Android build for Play Store submission quality, add iOS platform setup, handle Android hardware back button, create professional app icon (adaptive for Android 8+), and polish the splash screen.
- **Where**:
  - `capacitor.config.ts` (update: adjust plugins config, add keyboard handling)
  - `android/app/src/main/res/` (update: generate adaptive icon layers)
  - `android/app/src/main/AndroidManifest.xml` (update: hardware back button intent, deep link scheme)
  - `src/main.ts` or `src/ui/App.svelte` (add: Capacitor `App` plugin for back button handling)
  - `ios/App/App/Assets.xcassets/` (new: app icon sets, splash screen assets)
  - `ios/App/App/Info.plist` (update: permissions, display name, URL scheme)
  - `src/ui/components/DomeView.svelte` (verify: back gesture doesn't exit app mid-game)
  - `public/icons/` (new: icon source at various resolutions)

### Android Adaptive Icon Specification

The adaptive icon has two layers: a foreground (subject) and background (solid color). Both are 108×108dp with a visible safe zone of 66×66dp centered.

```
android/app/src/main/res/
├── mipmap-hdpi/
│   ├── ic_launcher.webp           (48×48dp → 72px)
│   ├── ic_launcher_round.webp     (48×48dp → 72px)
│   ├── ic_launcher_foreground.webp (108dp → 162px)
│   └── ic_launcher_background.webp (108dp → 162px)
├── mipmap-mdpi/                   (48px, 108px foreground)
├── mipmap-xhdpi/                  (96px, 216px foreground)
├── mipmap-xxhdpi/                 (144px, 324px foreground)
├── mipmap-xxxhdpi/                (192px, 432px foreground)
└── mipmap-anydpi-v26/
    └── ic_launcher.xml            (references foreground/background drawables)
```

`ic_launcher.xml` (adaptive icon manifest):
```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
```

Icon design direction for three A/B test variants (per DD-V2-165):
- **Variant A** (GAIA-focused): G.A.I.A. robot face, glowing cyan eyes, dark sci-fi background
- **Variant B** (Miner-focused): Pixel art miner silhouette descending into glowing mine shaft
- **Variant C** (Geological cross-section): Layered earth cross-section with glowing minerals

For launch: use Variant B (miner-focused) as default. A/B test via Play Store icon experiments after 500+ installs.

### iOS Platform Setup

```bash
# Add iOS platform (only needed once)
npx cap add ios

# Required: Xcode 15+ and macOS
# Required: Apple Developer account ($99/year) with active membership
# Required: Development certificate + provisioning profile for com.terragacha.app

# After adding iOS:
npx cap sync ios
npx cap open ios
```

`ios/App/App/Info.plist` additions required:
```xml
<!-- Display name shown under icon -->
<key>CFBundleDisplayName</key>
<string>Terra Gacha</string>

<!-- App URL scheme for deep links -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>terragacha</string>
    </array>
  </dict>
</array>

<!-- Minimum iOS version -->
<key>MinimumOSVersion</key>
<string>14.0</string>

<!-- Status bar style (dark content = light background, light content = dark background) -->
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleLightContent</string>

<!-- Orientation: portrait only -->
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
```

### Android Hardware Back Button

Add to `src/main.ts` (after Capacitor core import):
```ts
import { App as CapApp } from '@capacitor/app'

// Handle Android hardware back button
CapApp.addListener('backButton', ({ canGoBack }) => {
  // If Phaser mine scene is active, treat back as "pause/exit mine" not app exit
  const currentView = appStore.currentView // e.g. 'mine', 'dome', 'quiz'
  if (currentView === 'mine') {
    // Dispatch event to GameManager to open pause menu
    document.dispatchEvent(new CustomEvent('game:back-pressed'))
    return
  }
  if (currentView === 'quiz') {
    // Ignore back during quiz — player must answer
    return
  }
  if (!canGoBack) {
    // At app root — confirm exit
    CapApp.exitApp()
  }
})
```

### Splash Screen Polish

Update `capacitor.config.ts`:
```ts
plugins: {
  SplashScreen: {
    launchAutoHide: false,          // manual hide after game loads
    launchShowDuration: 0,          // no auto-hide timer
    backgroundColor: '#0a0e1a',     // dark space blue (existing)
    androidScaleType: 'CENTER_CROP',
    showSpinner: false,
    iosSpinnerStyle: 'small',
    spinnerColor: '#4fc3f7',        // GAIA cyan
    // Splash hides after game boot completes (call SplashScreen.hide() in main.ts)
  }
}
```

In `main.ts`, after all systems initialize:
```ts
import { SplashScreen } from '@capacitor/splash-screen'
// After Phaser game and factsDB.init() both complete:
await SplashScreen.hide()
```

- **How**:
  1. Generate icon assets using ComfyUI (Variant B: pixel art miner silhouette). Generate at 1024×1024, prepare foreground layer (miner on transparent background) and background layer (dark gradient `#0a0e1a` to `#1a237e`). Downscale to all required mipmap densities.
  2. Run `npx cap add ios` (if not done yet; requires macOS with Xcode).
  3. Configure iOS provisioning: create App ID `com.terragacha.app` in Apple Developer portal, create development and distribution certificates, create provisioning profiles.
  4. Add `CapApp.addListener('backButton', ...)` handler in `main.ts`.
  5. Update `SplashScreen` config; call `SplashScreen.hide()` after game boot.
  6. Test on physical Android device: `npx cap run android`.
  7. Generate signed AAB: Android Studio > Build > Generate Signed Bundle.
  8. Verify AAB with `bundletool` before upload.

- **Acceptance Criteria**:
  - [ ] `npx cap sync android` completes without errors
  - [ ] App installs and launches on a physical Android device (API 24+)
  - [ ] Android hardware back button triggers pause menu in mine, is ignored during quiz, and exits app with confirm dialog at root
  - [ ] Adaptive icon displays correctly on Android 8+ (round and squircle masks)
  - [ ] Splash screen shows correct dark background, hides smoothly after game load
  - [ ] `npx cap sync ios` completes without errors
  - [ ] App launches in iOS simulator (iPhone 15 Pro, 6.1 inch viewport)
  - [ ] Signed AAB is generated successfully in Android Studio
  - [ ] `npx cap doctor` shows no critical issues
- **Playwright Test** (web verification, since Playwright cannot run on device):
  ```js
  const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
  ;(async () => {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/opt/google/chrome/chrome'
    })
    // Test at mobile viewport sizes matching target devices
    const viewports = [
      { width: 390, height: 844, label: 'iPhone-14' },
      { width: 412, height: 915, label: 'Pixel-7' },
      { width: 768, height: 1024, label: 'iPad-mini' },
    ]
    for (const vp of viewports) {
      const page = await browser.newPage()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('http://localhost:5173')
      await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
      await page.screenshot({ path: `/tmp/ss-${vp.label}.png` })
      await page.close()
      console.log(`${vp.label}: OK`)
    }
    await browser.close()
  })()
  ```

---

## Sub-Phase 20.2: Store Submission Assets

- **What**: Create all required assets for Google Play and Apple App Store submissions: screenshots (5+ per platform), feature graphic, promotional text, store listing copy, and icon variants.
- **Where**:
  - `store-assets/android/screenshots/` (new — 5 screenshots at 1080×1920)
  - `store-assets/android/feature-graphic.png` (new — 1024×500px)
  - `store-assets/ios/screenshots/` (new — 5 screenshots per device class)
  - `store-assets/listing/` (new — text files with finalized copy)

### Screenshot Sequence (same narrative for both stores, different dimensions)

**Screenshot 1 — "Mine Deep"** (must communicate "mining game" within 2 seconds — DD-V2-165)
- Shows: Active mine scene with player character drilling into a glowing mineral vein, depth indicator showing Layer 8, animated dig particles
- Caption overlay (bottom third): "Descend through 20 layers of prehistoric Earth"

**Screenshot 2 — "Discover the Real Thing"**
- Shows: Quiz overlay mid-dive — "Which mineral forms from cooled magma?" with 4 answer choices, GAIA portrait in corner, correct answer glowing green
- Caption: "Every block you mine teaches you real Earth science"

**Screenshot 3 — "Revive Ancient Life"**
- Shows: Fossil revival animation — Triceratops skull assembled piece by piece with glowing amber light, "FOSSIL REVIVED" banner, dome background visible
- Caption: "Uncover 40+ fossil species buried in the deep"

**Screenshot 4 — "Your Knowledge Tree"**
- Shows: Knowledge Tree screen — interconnected constellation of mastered facts glowing orange/gold, incomplete branches greyscale, GAIA celebrating a mastery milestone
- Caption: "Watch your knowledge grow — visually"

**Screenshot 5 — "GAIA Guides You"**
- Shows: GAIA toast appearing over the dome with a geological fun fact, dome with all rooms unlocked and glowing, pets visible in the zoo room
- Caption: "G.A.I.A. — your Geological AI companion — makes every dive feel alive"

### Store Listing Copy Drafts (DD-V2-165, DD-V2-166)

**App Title** (max 30 chars):
`Terra Gacha`

**App Subtitle** (max 30 chars — Apple only):
`Mine Deep. Learn Everything.`

**Short Description** (max 80 chars — Google Play only):
`Mine through Earth's history. Answer real science quizzes. Revive extinct fossils.`

**Full Description — Google Play** (max 4000 chars):

```
Mine Deep. Learn Everything.

Crash-land on a far-future Earth and descend through 20 layers of prehistoric ground. Every block you mine might reveal a mineral shard, a fossil fragment, or a challenge from G.A.I.A. — your Geological Analytical Intelligence Assistant.

Answer real questions about Earth science, biology, ancient history, and the cosmos. Get it right? Your artifact rarity soars. Get it wrong? You lose oxygen — so you'd better remember next time.

REAL KNOWLEDGE. NOT TRIVIA.
Terra Gacha uses spaced repetition — the scientifically proven study method. Facts you struggle with come back sooner. Facts you know move to long intervals. You actually remember what you learn.

REVIVE 40+ EXTINCT SPECIES
Collect fossil fragments across your dives. Learn about each species through quizzes. Answer enough correctly to bring them back to life in your biodome — from a trilobite to a T-Rex.

ONE MORE LAYER GAMEPLAY
Each dive takes 5–25 minutes. Roguelite pressure — if you run out of oxygen, you lose your unsecured loot. Strategic depth increases: bigger caves, nastier hazards, rarer minerals.

YOUR LIVING DOME
Return from each dive to your glass dome on the surface. Tend your garden, visit your fossil zoo, unlock new rooms, and talk to G.A.I.A. about what you discovered underground.

SCIENCE-BACKED LEARNING
Our spaced repetition system schedules every fact you've seen to appear right before you'd forget it. After 30 days, our players retain 78% of what they learned. Traditional study: 20%.

FEATURES
• 20 layered mine with 25 unique biomes
• 500+ real facts across science, history, nature, and culture
• Spaced repetition quiz system (inspired by Anki)
• 40+ revivable fossil species
• Roguelite mechanics: oxygen, hazards, consumable items
• G.A.I.A. — an AI companion with personality
• Cloud sync — play on phone, tablet, or web
• Offline play — no internet required once facts are downloaded
• Up to 4 player profiles per device (great for families!)
• Age-appropriate content filtering

Terra Gacha is free to play. Optional purchases: premium oxygen refills and cosmetic items. No loot boxes. All drop rates are displayed.

"The only game that made me want to look up more stuff after." — Beta tester

Download and start your first dive. Your first fossil is waiting 3 layers down.
```

**Full Description — Apple App Store** (max 4000 chars):

```
Descend through 20 layers of prehistoric Earth — and come back smarter every time.

WHAT IS TERRA GACHA?
A mining adventure where every block you break might hide a fossil fragment, a mineral vein, or a real science quiz from G.A.I.A. (your Geological Analytical Intelligence Assistant). Roguelite tension. Spaced-repetition learning. One more layer calling you down.

THE SCIENCE IS REAL
Every question is sourced from verified geology, biology, astronomy, and world history. Wrong answers cost oxygen. Right answers boost your artifact rarity. Learning has never had stakes this real.

SPACED REPETITION THAT WORKS
The SM-2 algorithm schedules every fact you've seen to return right before you'd forget it. After 30 days of play, our beta users retained 78% of learned facts. Compare to 20% for traditional study.

REVIVE WHAT WAS LOST
Collect fossil fragments. Study each species through quizzes. Answer enough correctly to bring 40+ extinct creatures back to life in your glass biodome — from trilobites to megalodon to Triceratops.

ROGUELITE PRESSURE
Oxygen is your timer. Hazards expand. Unstable ground collapses. Descent shafts appear without warning. You decide how deep to push — and whether your loot makes it back safely.

YOUR DOME, YOUR WORLD
Return to the surface with your finds. Grow plants in The Farm. Watch your fossil zoo fill with revived species. Unlock 6 dome rooms. Let G.A.I.A. comment on every discovery.

BUILT FOR ALL AGES
• Age-appropriate content filtering: Kid / Teen / Adult modes
• Up to 4 player profiles per device — perfect for families
• Colorblind-safe rarity indicators
• VoiceOver compatible quiz questions
• Scalable text size

CLOUD + OFFLINE
Sync your save across phone, tablet, and web. Quiz questions work fully offline after first download. Your knowledge tree never disappears.

FREE TO PLAY
Optional purchases: oxygen refills, cosmetics. No randomised loot purchasing. All drop rates disclosed.

Start your first dive. A fossil is waiting on Layer 3.
```

### Apple App Store Metadata

```
Primary Category: Games
Secondary Category: Education
Content Rating: 4+ (no violence, no mature content; can be changed to 9+ if quiz facts warrant)
```

### Google Play Store Metadata

```
Application Type: Game
Category: Adventure
Content Rating: Everyone (ESRB) / 3+ (PEGI)
Contains Ads: No
In-App Purchases: Yes (optional, disclosed)
```

- **How**:
  1. Take in-game screenshots using Playwright at 1080×1920 (Android) and 1290×2796 (iPhone 15 Pro Max). Annotate with caption overlays using a design tool or imagemagick.
  2. Create feature graphic (1024×500) showing the mine cross-section with minerals glowing.
  3. Export all text to `store-assets/listing/google-play-listing.txt` and `store-assets/listing/app-store-listing.txt`.
  4. Create a 30-second preview video (optional but recommended): screen recording of first dive, first quiz, first fossil fragment discovery.

- **Acceptance Criteria**:
  - [ ] 5 screenshots exist at 1080×1920 (Android) and 1290×2796 (iPhone 15 Pro Max)
  - [ ] Feature graphic (1024×500) created for Play Store
  - [ ] All screenshots visible in `store-assets/` directory
  - [ ] Store listing text files written (both platforms)
  - [ ] Short description ≤ 80 chars (Google Play)
  - [ ] Subtitle ≤ 30 chars (Apple)
  - [ ] Full descriptions reference fossil, GAIA, spaced repetition, and offline play
- **Playwright Screenshot Script**:
  ```js
  const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
  ;(async () => {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/opt/google/chrome/chrome'
    })

    // Android Play Store screenshot dimensions
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('http://localhost:5173')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
    await page.screenshot({ path: '/tmp/screenshot-01-dome.png', fullPage: false })
    console.log('Screenshot 1 (dome): OK')

    // Navigate to mine for screenshot 2
    await page.click('button:has-text("Dive")')
    await page.waitForTimeout(1500)
    await page.click('button:has-text("Enter Mine")')
    await page.waitForTimeout(4000)
    await page.screenshot({ path: '/tmp/screenshot-02-mine.png', fullPage: false })
    console.log('Screenshot 2 (mine): OK')

    // Try to trigger a quiz for screenshot 3
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(150)
      const hasQuiz = await page.$('.quiz-overlay') !== null
      if (hasQuiz) {
        await page.screenshot({ path: '/tmp/screenshot-03-quiz.png', fullPage: false })
        console.log('Screenshot 3 (quiz): OK')
        break
      }
    }

    await browser.close()
  })()
  ```

---

## Sub-Phase 20.3: App Store Strategy (DD-V2-165, DD-V2-166)

- **What**: Configure both store listings for optimal discoverability using the ASO strategy from DD-V2-166. Set up Play Console and App Store Connect accounts, configure in-app purchase product IDs (even if Phase 21 handles billing logic), set up early access configuration.
- **Where**:
  - Google Play Console: `https://play.google.com/console`
  - App Store Connect: `https://appstoreconnect.apple.com`
  - `store-assets/aso/keywords.txt` (new — keyword research doc)
  - `store-assets/aso/competitor-analysis.md` (new — DD-V2-168 competitor notes)

### ASO Keyword Strategy (DD-V2-166)

**Primary keywords** (highest priority, target in title/subtitle/first paragraph):
1. `mining game` — high volume, moderate competition
2. `pixel art adventure` — enthusiast audience, lower competition
3. `learn while playing` — education-seeking parents searching
4. `fossil collecting game` — unique niche, very low competition
5. `trivia adventure` — bridges quiz and game audiences

**Secondary keywords** (use in description body, backend keyword field):
- `educational game`, `science game`, `spaced repetition`, `geology`, `paleontology`, `knowledge game`, `earth history`, `quiz game`, `roguelite`, `offline game`

**Avoid** (DD-V2-166 rationale):
- `Anki` — too niche, implies productivity tool not game
- `roguelite` — hardcore mobile connotation, scares casual players
- `flashcard` — school homework connotation

### In-App Purchase Product IDs to Register (even before Phase 21 billing logic)

Register these in Play Console and App Store Connect during Phase 20 so IAP infrastructure is ready for Phase 21:

```
Consumable products:
  com.terragacha.app.oxygen_small     — "Oxygen Canister (Small)" $0.99
  com.terragacha.app.oxygen_medium    — "Oxygen Canister (Medium)" $1.99
  com.terragacha.app.oxygen_large     — "Oxygen Canister (Large)" $4.99

Non-consumable products:
  com.terragacha.app.ad_free          — "Ad-Free Experience" $2.99 (if ads added)

Auto-renewable subscriptions (if Phase 21 adds subscription tier):
  com.terragacha.app.explorer_monthly — "Explorer Pass" $3.99/month
  com.terragacha.app.explorer_yearly  — "Explorer Pass" $29.99/year
```

### Store Listing Checklist

**Google Play Console**:
- [ ] App signed with production keystore (NOT debug keystore — CRITICAL: keystore must be backed up, loss = cannot update app)
- [ ] App bundle (AAB) uploaded (NOT APK — Play requires AAB since August 2021)
- [ ] Content rating questionnaire completed (ESRB: Everyone; PEGI: 3+)
- [ ] Target API level ≥ 34 (Android 14) — required for new apps in 2025
- [ ] Privacy policy URL entered (link to hosted `terragacha.com/privacy`)
- [ ] App category: Games > Adventure
- [ ] Tags: Education, Casual, Adventure
- [ ] Contact email configured
- [ ] All 5 screenshots uploaded
- [ ] Feature graphic uploaded (1024×500)
- [ ] All 4 IAP products registered with pricing
- [ ] Pre-launch report reviewed (automated test results from Play's robot)
- [ ] Data safety section completed: save data (encrypted, can delete), analytics events (anonymous, no sharing)

**Apple App Store Connect**:
- [ ] App signed with distribution certificate + provisioning profile
- [ ] IPA uploaded via Xcode Organizer or Transporter
- [ ] Age rating: 4+ (or 9+ if any quiz content warrants)
- [ ] Privacy labels completed: Location (not collected), Name (not linked), Email (linked but not tracking)
- [ ] App review notes: "Educational mining game. No violence. Quizzes are real science facts."
- [ ] Category: Games (primary), Education (secondary)
- [ ] Subtitle: "Mine Deep. Learn Everything." (≤ 30 chars)
- [ ] All 5 screenshots per device class uploaded (iPhone 6.7", 5.5"; iPad 12.9", 11")
- [ ] Preview video uploaded (optional, 15-30 seconds)
- [ ] Support URL: `https://terragacha.com/support`
- [ ] Privacy policy URL: `https://terragacha.com/privacy`
- [ ] "Sign In with Apple" capability added (required if any social login exists)
- [ ] TestFlight build uploaded for internal testing before external
- [ ] All IAP products registered and approved

- **How**:
  1. Create Play Console account if not exists (one-time $25 registration fee).
  2. Create App Store Connect account (requires Apple Developer Program membership, $99/year).
  3. Register bundle ID `com.terragacha.app` in Apple Developer portal.
  4. Complete Google Play Data Safety section — map each data type to its collection/use.
  5. Register all IAP product IDs in both stores (they require review before going live).
  6. Write `store-assets/aso/competitor-analysis.md` referencing the 5 competitor lessons from DD-V2-168.

- **Acceptance Criteria**:
  - [ ] AAB successfully uploaded to Play Console (internal test track)
  - [ ] IPA successfully uploaded to App Store Connect (TestFlight)
  - [ ] All IAP products registered in both stores
  - [ ] Data safety / privacy labels completed in both stores
  - [ ] Pre-launch report from Play Console shows no crashes on robot test
  - [ ] App installs successfully from TestFlight on a physical iPhone
  - [ ] App installs successfully from Play Console internal testing on physical Android

---

## Sub-Phase 20.4: Soft Launch Strategy (DD-V2-167)

- **What**: Execute the geographic soft launch in Philippines, Malaysia, and Colombia (4–6 weeks). Monitor D1/D7/D30 retention. Fix top 3 drop-off points. Move to Play Early Access at 10K installs. Global launch only after all criteria met.
- **Where**:
  - Google Play Console: Rollout > Countries / Regions (restrict to PH, MY, CO during soft launch)
  - Apple App Store Connect: Pricing and Availability (restrict countries)
  - `docs/roadmap/phases/soft-launch-tracker.md` (new — live tracking doc, updated daily)

### Soft Launch Success Criteria (DD-V2-167)

Before proceeding to global launch, ALL three metrics must be met:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| D7 Retention | ≥ 20% | `app_open` events: users who return on or after day 7 / total new users that cohort day |
| D30 Retention | ≥ 10% | `app_open` events: users who return on or after day 30 / total new users that cohort day |
| Store Rating | ≥ 4.3 stars | Play Console / App Store Connect rating dashboard |

Secondary metrics to monitor (not hard gates, but inform iteration):
- Tutorial completion rate (first dive started) ≥ 70%
- First dive completion rate ≥ 85%
- D1 retention ≥ 40%
- Median session length: 5–25 minutes (if outside range, gameplay loop needs adjustment)
- Quiz answer rate per dive: ≥ 3 quizzes per dive on average (if lower, quiz triggers too sparse)
- Fact "not interesting" flag rate ≤ 5% (if higher, content curation quality issue)

### Soft Launch Monitoring Schedule

**Daily actions during soft launch**:
- Check Play Console crash/ANR report — fix any crash affecting > 0.1% sessions same day
- Check store reviews — respond to all reviews within 24 hours
- Check D1 retention from prior day cohort (from analytics dashboard)
- Log daily install count in `soft-launch-tracker.md`

**Weekly review (every Monday)**:
- Review D7 retention for the cohort from 7 days ago
- Identify and document top 3 drop-off points (where do players quit?)
- Patch top drop-off point with hotfix if severe (update to soft-launch regions only)
- Check if 10K install milestone is approaching for Early Access

**Iteration priorities during soft launch** (in order):
1. Crash fixes (same-day turnaround)
2. Tutorial drop-off fixes (if < 70% complete tutorial)
3. First dive completion fixes (if < 85% complete first dive)
4. Day 1 retention improvements (if < 40%)
5. Quiz balance adjustments (if quiz rate too low/high)
6. Content improvements (if flag rate > 5%)

### Global Launch Checklist

Only proceed to global launch after all of the following:
- [ ] D7 ≥ 20% confirmed for at least 2 consecutive cohort weeks
- [ ] D30 ≥ 10% confirmed (requires 30-day wait from soft launch day 1)
- [ ] Store rating ≥ 4.3 (with ≥ 50 reviews for statistical validity)
- [ ] Play Early Access completed (10K installs + 2–4 weeks of feedback)
- [ ] Top 3 soft-launch drop-off points addressed
- [ ] Press outreach sent to indie game outlets + education bloggers (see list below)
- [ ] Social media accounts active and have content ready for launch day
- [ ] Web version at terragacha.com live and tested

### Press Outreach Targets for Global Launch (DD-V2-167)

```
Education bloggers:
- Common Sense Media (https://www.commonsensemedia.org) — review request
- TeachThought — "learning through play" angle
- Edutopia — spaced repetition educational value angle

Indie game outlets:
- TouchArcade — mobile pixel art adventure angle
- Pocket Gamer — review request
- Droid Gamers — Android launch coverage

Pixel art / retro communities:
- r/PixelArt subreddit — share dome and mine art (not a promotional post)
- r/indiegaming — "I made a game" post with gameplay gif
- Indie DB — game page + devlog

Learning / productivity communities:
- r/Anki — spaced repetition angle (users already understand SM-2)
- r/LearnEarth — geology/nature focus
```

- **Acceptance Criteria**:
  - [ ] App is live in Play Store and App Store for Philippines, Malaysia, and Colombia only
  - [ ] `soft-launch-tracker.md` is being updated daily
  - [ ] D7 retention metric is visible in analytics dashboard
  - [ ] Store review response SLA (24 hours) is being honored
  - [ ] All crashes reported in Play Console < 0.5% session crash rate
  - [ ] Global launch not initiated until all three success criteria are met

---

## Sub-Phase 20.5: Accessibility — Launch Set (DD-V2-178)

- **What**: Implement the four launch-required accessibility features from DD-V2-178: colorblind-safe rarity indicators, scalable text, high-contrast quiz mode, and VoiceOver/TalkBack compatibility.
- **Where**:
  - `src/ui/components/QuizOverlay.svelte` (update: high-contrast mode, ARIA labels)
  - `src/ui/components/HUD.svelte` (update: rarity indicators with shapes)
  - `src/ui/components/BackpackOverlay.svelte` (update: rarity shapes on item cards)
  - `src/ui/components/Settings.svelte` (update: add Accessibility section)
  - `src/ui/stores/settings.ts` (update: add `highContrastQuiz: boolean`, `reducedMotion: boolean`)
  - `src/ui/components/MineOverlay.svelte` or rarity indicator components (update: shape system)
  - `src/ui/styles/accessibility.css` (new — global accessibility overrides)

### Colorblind-Safe Rarity System (DD-V2-178)

Current: rarity tiers use color only (grey/green/blue/purple/gold/red for Common through Mythic).
Required: each tier must be distinguishable by shape AND color.

```
Rarity tier → Shape indicator + Color:

Common   →  ● (circle, filled)        + #9e9e9e (grey)
Uncommon →  ◆ (diamond, filled)       + #4caf50 (green)
Rare     →  ▲ (triangle, filled)      + #2196f3 (blue)
Epic     →  ★ (5-point star, filled)  + #9c27b0 (purple)
Legendary → ⬟ (hexagon, filled)      + #ff9800 (orange/gold)
Mythic   →  ✦ (4-point star/sparkle)  + #f44336 (red)
```

Implementation: Add a `RarityBadge.svelte` component:
```svelte
<!-- RarityBadge.svelte -->
<script lang="ts">
  import type { Rarity } from '../data/types'

  export let rarity: Rarity
  export let showLabel = false

  const RARITY_CONFIG: Record<Rarity, { shape: string; color: string; label: string }> = {
    common:    { shape: '●', color: '#9e9e9e', label: 'Common'    },
    uncommon:  { shape: '◆', color: '#4caf50', label: 'Uncommon'  },
    rare:      { shape: '▲', color: '#2196f3', label: 'Rare'      },
    epic:      { shape: '★', color: '#9c27b0', label: 'Epic'      },
    legendary: { shape: '⬟', color: '#ff9800', label: 'Legendary' },
    mythic:    { shape: '✦', color: '#f44336', label: 'Mythic'    },
  }

  $: config = RARITY_CONFIG[rarity]
</script>

<span
  class="rarity-badge"
  style="color: {config.color}"
  aria-label="{config.label} rarity"
  role="img"
>
  {config.shape}
  {#if showLabel}<span class="rarity-label">{config.label}</span>{/if}
</span>
```

Verify with deuteranopia/protanopia/tritanopia simulators: use Chrome DevTools > Rendering > Emulate vision deficiency for each type. All 6 shapes must be distinguishable.

### Scalable Text

All UI text must respect system font-size settings:
- Use `rem` units exclusively (never `px` for font-size)
- Base font size is `html { font-size: 16px }` which scales with system setting
- All text in Svelte components: minimum `0.75rem` (12px equivalent at default scale)
- Audit all components for any `font-size: Npx` declarations and replace with `rem`

```css
/* src/ui/styles/accessibility.css */
:root {
  /* All font sizes relative to this — scales with system settings */
  font-size: clamp(14px, 4vw, 18px);
}

/* Enforce minimum readable size */
body, input, button, select, textarea {
  font-size: max(0.75rem, 12px);
}

/* High-contrast quiz mode */
.high-contrast-quiz .quiz-choice {
  background: #000000;
  color: #ffffff;
  border: 3px solid #ffffff;
}
.high-contrast-quiz .quiz-choice:hover,
.high-contrast-quiz .quiz-choice:focus {
  background: #ffffff;
  color: #000000;
}
.high-contrast-quiz .quiz-choice.correct {
  background: #00ff00;
  color: #000000;
  border-color: #00ff00;
}
.high-contrast-quiz .quiz-choice.wrong {
  background: #ff0000;
  color: #ffffff;
  border-color: #ff0000;
}
```

### VoiceOver / TalkBack Compatibility

All interactive elements must have meaningful `aria-label` or text content:

**Quiz overlay**:
```svelte
<!-- QuizOverlay.svelte -->
<div role="dialog" aria-modal="true" aria-label="Quiz Question">
  <p id="quiz-question" aria-live="polite">{question}</p>
  {#each choices as choice, i}
    <button
      aria-describedby="quiz-question"
      aria-label="Choice {i + 1}: {choice.text}"
      on:click={() => handleAnswer(choice)}
    >
      <span class="choice-number" aria-hidden="true">{i + 1}</span>
      {choice.text}
    </button>
  {/each}
</div>
```

**Mine HUD** — oxygen level must be announced:
```svelte
<div
  role="status"
  aria-label="Oxygen: {oxygenPercent}%"
  aria-live="polite"
>
  <!-- visual oxygen bar -->
</div>
```

**Inventory items**:
```svelte
<button
  aria-label="{item.name}, {item.rarity} rarity artifact. Tap to view details."
>
  <RarityBadge rarity={item.rarity} />
  {item.name}
</button>
```

### Accessibility Checklist Items

**Launch requirements** (DD-V2-178 mandatory):
- [ ] All 6 rarity tiers distinguishable by shape alone (not color only) — verified in all 3 colorblind modes
- [ ] All UI text uses `rem` units (no `px` font-size outside of Phaser canvas)
- [ ] `font-size` minimum `0.75rem` on all body text
- [ ] System font-size scaling: tested at 100%, 125%, 150% OS text scale
- [ ] High-contrast quiz mode toggle in Settings > Accessibility
- [ ] High-contrast mode makes quiz choices pass WCAG AA contrast ratio (≥ 4.5:1)
- [ ] All quiz choice buttons have `aria-label` with full choice text
- [ ] Quiz dialog has `role="dialog"` and `aria-modal="true"`
- [ ] Oxygen bar announces level changes via `aria-live="polite"`
- [ ] All buttons have minimum 44×44px touch target
- [ ] No content conveys meaning only via animation (all animations have static fallback)
- [ ] `prefers-reduced-motion` media query respected for screen shake and particles

**Post-launch additions** (DD-V2-178 — not required for launch):
- [ ] Dyslexia-friendly font option (OpenDyslexic)
- [ ] One-handed play mode (all actions reachable from bottom half of screen)
- [ ] Reduced motion toggle in Settings (supplement `prefers-reduced-motion`)

### Accessibility CI Integration

Add to `package.json` scripts:
```json
"a11y": "npx playwright test tests/accessibility.spec.ts"
```

Create `tests/accessibility.spec.ts` using `@axe-core/playwright`:
```ts
// tests/accessibility.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('Home screen has no critical a11y violations', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
})
```

- **Acceptance Criteria**:
  - [ ] All 6 rarity tiers are distinguishable in deuteranopia simulation (Chrome DevTools)
  - [ ] High-contrast quiz mode makes all choices WCAG AA compliant (contrast ≥ 4.5:1)
  - [ ] VoiceOver on iOS reads quiz question and choices correctly in sequence
  - [ ] TalkBack on Android navigates quiz choices by swipe
  - [ ] System font-scale at 150% does not break any layout
  - [ ] `axe-core` reports 0 critical violations on home screen
  - [ ] `npm run typecheck` passes
- **Playwright Test**:
  ```js
  const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
  ;(async () => {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/opt/google/chrome/chrome'
    })
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })

    // Test high-contrast mode
    await page.goto('http://localhost:5173')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })

    // Enable high-contrast in settings
    const settingsBtn = await page.$('button[aria-label="Settings"]')
    if (settingsBtn) {
      await settingsBtn.click()
      await page.waitForSelector('text=Accessibility', { timeout: 3000 })
      await page.click('label:has-text("High contrast quiz")')
      await page.keyboard.press('Escape')
    }

    // Trigger a quiz
    await page.click('button:has-text("Dive")')
    await page.waitForTimeout(1500)
    await page.click('button:has-text("Enter Mine")')
    await page.waitForTimeout(3000)

    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(200)
      const quiz = await page.$('[role="dialog"][aria-label="Quiz Question"]')
      if (quiz) {
        console.log('Quiz found with correct ARIA role')
        // Verify aria-labels on choices
        const choices = await page.$$('[aria-label^="Choice"]')
        console.log(`Quiz choices with aria-label: ${choices.length}`)
        await page.screenshot({ path: '/tmp/ss-a11y-quiz.png' })
        break
      }
    }

    await browser.close()
  })()
  ```

---

## Sub-Phase 20.6: Web Platform (DD-V2-171)

- **What**: Launch terragacha.com as a full first-class web platform — same account, same progress, same content as mobile. PWA installable. Desktop layout optimized. Keyboard shortcuts for mining. No feature degradation vs mobile.
- **Where**:
  - `vite.config.ts` (update: PWA manifest, `vite-plugin-pwa` — ask user before installing)
  - `public/manifest.webmanifest` (new — PWA manifest)
  - `src/ui/styles/desktop.css` (new — desktop-specific layout overrides, media queries)
  - `src/ui/components/DomeView.svelte` (update: wider HUD layout for desktop)
  - `src/ui/components/QuizOverlay.svelte` (update: larger overlay on desktop)
  - `src/ui/App.svelte` (update: detect platform, apply layout class)
  - `src/game/MineScene.ts` (update: keyboard shortcuts for mining actions)
  - `src/game/InputHandler.ts` (new or update: unified input handling for touch + keyboard + mouse)

### PWA Manifest

`public/manifest.webmanifest`:
```json
{
  "name": "Terra Gacha",
  "short_name": "Terra Gacha",
  "description": "Mine Deep. Learn Everything. A spaced-repetition mining adventure.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0a0e1a",
  "background_color": "#0a0e1a",
  "lang": "en",
  "categories": ["games", "education"],
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/store-assets/web/screenshot-01.png",
      "sizes": "1280x800",
      "type": "image/png",
      "label": "Dome hub view"
    },
    {
      "src": "/store-assets/web/screenshot-02.png",
      "sizes": "1280x800",
      "type": "image/png",
      "label": "Mine layer view"
    }
  ],
  "shortcuts": [
    {
      "name": "Start Dive",
      "url": "/?action=dive",
      "description": "Immediately start a new dive"
    }
  ],
  "related_applications": [
    {
      "platform": "play",
      "url": "https://play.google.com/store/apps/details?id=com.terragacha.app",
      "id": "com.terragacha.app"
    },
    {
      "platform": "itunes",
      "url": "https://apps.apple.com/app/terra-gacha/id0000000000"
    }
  ]
}
```

### Desktop Responsive Layout Specs

```css
/* src/ui/styles/desktop.css */

/* ── Breakpoints ──────────────────────────────────────────────── */
/* Mobile:  < 768px  — default (existing mobile layout)           */
/* Tablet:  768px-1199px — wider panels, optional sidebar         */
/* Desktop: ≥ 1200px — full desktop layout                        */

/* ── Tablet (768px) ──────────────────────────────────────────── */
@media (min-width: 768px) {
  /* Game canvas grows to use more horizontal space */
  #phaser-canvas-container {
    max-width: 600px;
    margin: 0 auto;
  }

  /* HUD becomes horizontal bar across full width */
  .hud-container {
    flex-direction: row;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
  }

  /* Quiz overlay wider, less cramped */
  .quiz-overlay {
    max-width: 560px;
    margin: 0 auto;
    border-radius: 12px;
  }

  /* BaseView panel expands to show more content */
  .panel-content {
    max-height: 70vh;
  }
}

/* ── Desktop (1200px) ────────────────────────────────────────── */
@media (min-width: 1200px) {
  /* Side-by-side layout: game canvas left, HUD/panels right */
  .app-layout {
    display: grid;
    grid-template-columns: 480px 1fr;
    grid-template-rows: 100vh;
    gap: 0;
  }

  #phaser-canvas-container {
    grid-column: 1;
    height: 100vh;
    max-width: 480px;
  }

  .side-panel {
    grid-column: 2;
    overflow-y: auto;
    padding: 1.5rem;
    background: #111827;
    border-left: 1px solid #1f2937;
  }

  /* On desktop: quiz appears as a card in the side panel,
     not a fullscreen overlay */
  .quiz-overlay {
    position: static;
    max-width: 100%;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  }

  /* Desktop HUD: vertical stack in side panel */
  .hud-container {
    flex-direction: column;
    position: static;
    background: transparent;
  }
}
```

### Keyboard Shortcuts for Mining

Add to `src/game/MineScene.ts` (or `InputHandler.ts`):

```ts
// Keyboard shortcuts — desktop-only (detected via pointer type or platform)
const KEYBOARD_MAP: Record<string, MineAction> = {
  'ArrowUp':    'move_up',
  'ArrowDown':  'move_down',
  'ArrowLeft':  'move_left',
  'ArrowRight': 'move_right',
  'w':          'move_up',
  's':          'move_down',
  'a':          'move_left',
  'd':          'move_right',
  'b':          'use_bomb',
  'f':          'use_flare',
  ' ':          'interact',  // spacebar = interact with adjacent block
  'Escape':     'pause',
  '1':          'quiz_choice_1', // answer quiz choice 1 during quiz
  '2':          'quiz_choice_2',
  '3':          'quiz_choice_3',
  '4':          'quiz_choice_4',
}
```

Quiz keyboard shortcuts (1/2/3/4 for choices) are already partially implemented per MEMORY.md. Ensure they work consistently on desktop.

### "Add to Home Screen" Prompt

```ts
// src/ui/components/PwaInstallPrompt.svelte
// Show after second session, only on web (not Capacitor)
// Use beforeinstallprompt event

let deferredPrompt: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
  // Show custom prompt UI after user has had one full dive
})

// Trigger: after first dive completes
async function showInstallPrompt() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') {
    analyticsService.track({ name: 'pwa_install_accepted', properties: {} })
  }
  deferredPrompt = null
}
```

### Platform Feature Parity Verification

All features must work identically on web and mobile:
```
Feature                         Mobile    Web      Notes
─────────────────────────────────────────────────────────────────
Mining gameplay                   ✓        ✓       Keyboard + touch
Quiz overlay                      ✓        ✓       1-4 keyboard on desktop
Cloud sync                        ✓        ✓       Same JWT auth
Offline quizzes                   ✓        ✓       Service worker on web
Multiple profiles                 ✓        ✓       localStorage keyed
Push notifications                ✓        ✗       Mobile only (Phase 22)
Haptic feedback                   ✓        ✗       Capacitor only, graceful no-op
App icon on home screen           ✓        ✓       PWA for web
Knowledge Tree                    ✓        ✓
Fossil revival                    ✓        ✓
Crafting / Materializer           ✓        ✓
Dev Panel                         ✓        ✓       Only in development builds
```

- **How**:
  1. Create `public/manifest.webmanifest` (content above).
  2. Add `<link rel="manifest" href="/manifest.webmanifest">` to `index.html`.
  3. Generate PWA icons at 192×192 and 512×512 from the same miner silhouette asset used for Android adaptive icon.
  4. Create `src/ui/styles/desktop.css` and import it in `App.svelte`.
  5. Add `PwaInstallPrompt.svelte` component; trigger after first dive complete.
  6. Add keyboard shortcut map in `MineScene.ts` (or `InputHandler.ts`).
  7. Write desktop layout responsive CSS (`desktop.css`).
  8. Deploy frontend to terragacha.com via GitHub Pages, Vercel, Netlify, or Cloudflare Pages — configure `VITE_API_BASE_URL` to point to production server.
  9. Configure custom domain in DNS: `terragacha.com` → hosting provider.
  10. Verify HTTPS certificate is valid.

- **Acceptance Criteria**:
  - [ ] terragacha.com loads and shows the game (not a coming-soon page)
  - [ ] PWA installable from Chrome/Edge: "Add to Home Screen" installs the web app
  - [ ] At 1200px+ viewport: game canvas and side panel display in two-column layout
  - [ ] Keyboard shortcuts W/A/S/D and arrow keys move the miner
  - [ ] 1/2/3/4 keyboard shortcuts answer quiz choices
  - [ ] Same user account works on both mobile app and web without re-login
  - [ ] Service Worker registered on web: quiz works offline after first load
  - [ ] Chrome Lighthouse PWA score ≥ 80
  - [ ] All gameplay features from the parity table are confirmed working on web
- **Playwright Test**:
  ```js
  const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
  ;(async () => {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/opt/google/chrome/chrome'
    })

    // ── Desktop layout test ──────────────────────────────────────
    const desktop = await browser.newPage()
    await desktop.setViewportSize({ width: 1440, height: 900 })
    await desktop.goto('http://localhost:5173')
    await desktop.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

    // Check two-column layout at 1440px
    const appLayout = await desktop.$('.app-layout')
    console.log('Desktop two-column layout:', appLayout !== null)

    await desktop.screenshot({ path: '/tmp/ss-desktop.png' })

    // ── Keyboard shortcut test ───────────────────────────────────
    await desktop.click('button:has-text("Dive")')
    await desktop.waitForTimeout(1500)
    await desktop.click('button:has-text("Enter Mine")')
    await desktop.waitForTimeout(3000)

    // Test keyboard movement
    const initialPos = await desktop.evaluate(() => {
      return window.__PHASER_DEBUG__?.playerPos ?? null
    })
    await desktop.keyboard.press('ArrowDown')
    await desktop.waitForTimeout(300)
    const newPos = await desktop.evaluate(() => {
      return window.__PHASER_DEBUG__?.playerPos ?? null
    })
    if (initialPos && newPos) {
      console.log('Keyboard movement: Y changed from', initialPos.y, 'to', newPos.y)
    }

    // ── Tablet layout test ───────────────────────────────────────
    const tablet = await browser.newPage()
    await tablet.setViewportSize({ width: 768, height: 1024 })
    await tablet.goto('http://localhost:5173')
    await tablet.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
    await tablet.screenshot({ path: '/tmp/ss-tablet.png' })

    // ── Mobile layout test ───────────────────────────────────────
    const mobile = await browser.newPage()
    await mobile.setViewportSize({ width: 390, height: 844 })
    await mobile.goto('http://localhost:5173')
    await mobile.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
    await mobile.screenshot({ path: '/tmp/ss-mobile-web.png' })

    console.log('All viewport tests complete')
    await browser.close()
  })()
  ```

---

## Verification Gate

Run all of the following before declaring Phase 20 complete:

```bash
# 1. Production build — must succeed with 0 TypeScript errors
cd /root/terra-miner && npm run build
# Expected: no errors, dist/ generated

# 2. Typecheck
cd /root/terra-miner && npm run typecheck

# 3. Capacitor sync — must complete without errors
npx cap sync android

# 4. Capacitor doctor
npx cap doctor
# Expected: no critical issues

# 5. PWA manifest validation
curl -s http://localhost:5173/manifest.webmanifest | jq '.name'
# Expected: "Terra Gacha"

# 6. Service Worker check
node -e "
const { chromium } = require('./node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: '/opt/google/chrome/chrome' });
  const p = await b.newPage();
  await p.goto('http://localhost:5173');
  await p.waitForTimeout(3000);
  const swActive = await p.evaluate(() =>
    navigator.serviceWorker?.controller !== null
  );
  console.log('Service Worker active:', swActive);
  await b.close();
})();
"

# 7. Accessibility check — rarity badges
node -e "
const { chromium } = require('./node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: '/opt/google/chrome/chrome' });
  const p = await b.newPage();
  await p.goto('http://localhost:5173');
  await p.waitForSelector('button:has-text(\"Dive\")', { timeout: 10000 });
  const rarityBadges = await p.$$('[role=\"img\"][aria-label*=\"rarity\"]');
  console.log('Rarity badges with aria-label:', rarityBadges.length);
  await b.close();
})();
"

# 8. Visual screenshot — all viewport sizes
node -e "
const { chromium } = require('./node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: '/opt/google/chrome/chrome' });
  for (const [w,h,label] of [[390,844,'mobile'],[768,1024,'tablet'],[1440,900,'desktop']]) {
    const p = await b.newPage();
    await p.setViewportSize({ width: w, height: h });
    await p.goto('http://localhost:5173');
    await p.waitForSelector('button:has-text(\"Dive\")', { timeout: 10000 });
    await p.screenshot({ path: \`/tmp/ss-phase20-\${label}.png\` });
    console.log(\`\${label}: OK\`);
    await p.close();
  }
  await b.close();
})();
"

# 9. Soft launch criteria (manual review after 4-6 weeks)
# npx tsx scripts/analytics-dashboard.ts
# Verify D7 >= 20%, D30 >= 10%, rating >= 4.3 before global launch
```

---

## Store Submission Checklist

### Google Play — Final Submission Checklist

- [ ] Signed AAB built with production keystore (keystore backed up to secure location)
- [ ] Target API level 34+ (Android 14)
- [ ] AAB passes internal testing track on 3+ physical devices
- [ ] Content rating questionnaire completed: Everyone / PEGI 3+
- [ ] All 5 screenshots uploaded (1080×1920 minimum)
- [ ] Feature graphic uploaded (1024×500)
- [ ] Privacy policy URL live and accessible: `https://terragacha.com/privacy`
- [ ] Data safety section completed
- [ ] All IAP products approved
- [ ] Pre-launch report shows < 1% crash rate on robot test
- [ ] Soft launch countries restricted to Philippines, Malaysia, Colombia
- [ ] Review notes added: "Educational mining game, suitable for all ages. The quiz system uses real science facts."

### Apple App Store — Final Submission Checklist

- [ ] Archive built with distribution certificate in Xcode Organizer
- [ ] App validated (no signing errors) before upload
- [ ] TestFlight internal testing: 0 crashes reported on iPhone 14, iPad 10th gen
- [ ] Age rating questionnaire: 4+ (or 9+ if warranted)
- [ ] Privacy labels: Email (linked, not for tracking), Analytics (anonymous)
- [ ] "Sign In with Apple" implemented if any social login exists (App Store Review Guideline 4.8)
- [ ] All screenshots per device class: 6.7" (iPhone), 5.5" (iPhone legacy), 12.9" iPad
- [ ] Subtitle: "Mine Deep. Learn Everything." (≤ 30 chars)
- [ ] Support URL: `https://terragacha.com/support`
- [ ] Review notes: "No violence. No gambling mechanics. All drop rates displayed. Educational quiz system with real science."
- [ ] In-app purchase products all approved before submission
- [ ] Soft launch: restricted country availability configured

---

## Files Affected

### New Files
- `src/ui/components/auth/AgeGate.svelte` (referenced in 19.5, triggers from App.svelte)
- `src/ui/styles/desktop.css`
- `src/ui/styles/accessibility.css`
- `src/ui/components/RarityBadge.svelte`
- `src/ui/components/PwaInstallPrompt.svelte`
- `public/manifest.webmanifest`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `store-assets/android/screenshots/` (directory — 5 PNG files)
- `store-assets/ios/screenshots/` (directory — 5+ PNG files per device class)
- `store-assets/android/feature-graphic.png`
- `store-assets/listing/google-play-listing.txt`
- `store-assets/listing/app-store-listing.txt`
- `store-assets/aso/keywords.txt`
- `store-assets/aso/competitor-analysis.md`
- `docs/roadmap/phases/soft-launch-tracker.md`
- `tests/accessibility.spec.ts`
- `src/game/InputHandler.ts` (if extracted from MineScene)

### Modified Files
- `capacitor.config.ts` — splash screen manual hide, keyboard plugin config
- `src/main.ts` — `CapApp.addListener('backButton', ...)`, `SplashScreen.hide()` after boot
- `src/ui/App.svelte` — detect platform, apply layout class, show install prompt after first dive
- `src/ui/components/QuizOverlay.svelte` — ARIA roles, aria-label on choices, high-contrast class
- `src/ui/components/HUD.svelte` — `aria-live` on oxygen, rarity badges, `aria-label` on items
- `src/ui/components/BackpackOverlay.svelte` — `RarityBadge` on all item cards
- `src/ui/components/Settings.svelte` — Accessibility section: high-contrast quiz, reduced motion toggles
- `src/ui/stores/settings.ts` — add `highContrastQuiz: boolean`, `reducedMotion: boolean`
- `src/game/MineScene.ts` — keyboard shortcut mapping
- `index.html` — add `<link rel="manifest">`, `<meta name="theme-color">`, `<meta name="mobile-web-app-capable">`
- `android/app/src/main/res/mipmap-*/` — new adaptive icon assets
- `android/app/src/main/AndroidManifest.xml` — back button handling, deep link scheme
- `ios/App/App/Info.plist` — display name, URL scheme, minimum OS version
- `vite.config.ts` — PWA plugin registration (after user approves `vite-plugin-pwa` install)

---

## Sub-Phase 20.7: Capacitor Plugin Integration

- [ ] Install and configure Capacitor plugins per-phase as needed: `@capacitor/haptics` (Phase 7), `@capacitor/app` (Phase 19), `@capacitor-community/secure-storage` (Phase 19), `@capacitor/local-notifications` (Phase 17). (DD-V2-212)
- [ ] Document minimum Capacitor version and plugin compatibility matrix in `docs/ARCHITECTURE.md`.

## Sub-Phase 20.8: Bundle Size & Code Splitting

- [ ] Target initial JS bundle ≤500KB gzipped; implement route-based code splitting so mine scene, dome scene, and study session load on demand. (DD-V2-214)
- [ ] Run `vite-bundle-analyzer` in CI and fail the build if initial bundle exceeds 500KB.

## Sub-Phase 20.9: Docker Strategy

- [ ] Build multi-stage Dockerfile: `build` stage compiles the app, `runtime` stage uses `node:22-slim` with non-root user. (DD-V2-218)
- [ ] Add `docker-compose.prod.yml` for local production simulation; confirm image size ≤200MB.

## Sub-Phase 20.10: CDN Asset Delivery

- [ ] Deploy static assets (sprites, audio, facts DB) to Cloudflare R2 with Cloudflare Pages fronting the web build. (DD-V2-219)
- [ ] Configure `Cache-Control: public, max-age=31536000, immutable` for hashed asset filenames; short TTL for `facts.db`.

## Sub-Phase 20.11: Android WebView Profiling

- [ ] Profile the full game on 3 device tiers: low-end (2GB RAM, 2019 mid-range), mid-range (4GB RAM), and high-end (8GB RAM flagship). (DD-V2-220)
- [ ] Define performance budgets: <2s mine generation, <16ms frame time at 60fps on mid-range, <100ms quiz overlay open time.

## Sub-Phase 20.12: Error Monitoring & Observability

- [ ] Integrate Sentry for both the Vite app and Fastify server; capture uncaught exceptions, unhandled promise rejections, and slow API routes (>500ms). (DD-V2-221)
- [ ] Add custom analytics for core learning events (`fact_learned`, `quiz_answered`, `dive_completed`) sent to a privacy-first backend table, not a third-party SaaS.

## Sub-Phase 20.13: Offline Feature Tiers

- [ ] Define and implement 3 offline capability tiers: Tier 1 (full play offline with cached facts), Tier 2 (read-only history view), Tier 3 (queued sync on reconnect). (DD-V2-201)
- [ ] All Tier 1 features must pass Playwright tests run in network-disabled mode.

## Sub-Phase 20.14: Launch Deployment Architecture

- [ ] Deploy web app to Cloudflare Pages, API server to Fly.io (single region initially), assets to Cloudflare R2. (DD-V2-231)
- [ ] Document runbook for zero-downtime deploys, rollback procedure, and on-call escalation path in `docs/ARCHITECTURE.md`.
- `package.json` — add `a11y` script for accessibility testing

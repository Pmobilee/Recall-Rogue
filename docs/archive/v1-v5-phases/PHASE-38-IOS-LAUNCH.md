# Phase 38: iOS App Store Launch

**Status**: Not Started
**Goal**: Ship Terra Gacha to the Apple App Store. This covers Apple Developer account configuration, Xcode project setup, iOS-specific UI and API adjustments, TestFlight beta distribution, App Store review guidelines compliance, full App Store submission with metadata and privacy labels, and post-launch monitoring with App Store Connect analytics.
**Design Decisions**: DD-V2-131 (no premium randomization — critical for App Store guideline 3.1.1), DD-V2-145 (direct pricing, no premium currency), DD-V2-165 (Games > Adventure/Casual category), DD-V2-166 (subtitle locked: "Mine Deep. Learn Everything."), DD-V2-167 (soft-launch by region), DD-V2-178 (accessibility requirements), DD-V2-270 (JWT auth, Sign in with Apple required if any social login exists)

---

## Overview

The Capacitor Android platform is already configured (`com.terragacha.app`, Capacitor 8.1.0). Phase 20 completed the Capacitor build polish pass, store listing text, accessibility compliance, and PWA. Phase 19 completed auth (JWT, cloud sync, profiles). Phase 21 completed monetization (Terra Pass, IAP catalog, O2 regen). This phase exclusively targets the Apple distribution channel.

Apple's review process is the most scrutinized gate in mobile publishing. Every sub-phase in this document is written with that constraint front-and-center. The two highest-rejection-risk areas for Terra Gacha are:

1. **Guideline 3.1.1 — Loot boxes**: The game must not misrepresent any random reward as having a guaranteed value. Terra Gacha uses `GACHA_TIERS` for cosmetic reveals. The word "gacha" is in the app name. This will attract scrutiny. Sub-phase 38.5 contains a full audit of every randomized reward surface.
2. **Guideline 3.1.3(b) — Reader apps**: Terra Gacha serves educational content (facts) that a user can subscribe to receive more of. Apple requires that IAP be used for any in-app subscription purchase — the existing `com.terragacha.terrapass.monthly` and patron tiers must route through StoreKit 2, not a web payment flow, for any purchase initiated inside the iOS app.

**Dependencies (must be complete before starting)**:
- Phase 19: Auth & Cloud (JWT auth, cloud sync, profiles) — COMPLETE
- Phase 20: Mobile Launch (Capacitor builds, splash screen, accessibility, store listing text) — COMPLETE
- Phase 21: Monetization (Terra Pass, IAP catalog, O2 regen, RevenueCat integration plan) — COMPLETE
- `npm run build` produces zero TypeScript errors
- `npx cap sync ios` runs without errors
- Production backend deployed and healthy at the configured `VITE_API_URL`

**Estimated complexity**: High. This phase involves third-party developer consoles (Apple Developer Program, App Store Connect), native Xcode configuration, Apple-specific APIs (Sign in with Apple, StoreKit 2, Haptic Engine, Safe Area insets), TestFlight distribution logistics, legal privacy disclosures, and a multi-day review submission cycle. Code changes are moderate; process management is the dominant complexity.

**Files affected summary** (full list at bottom):
- `capacitor.config.ts` — iOS plugin config (haptics, keyboard, safe area)
- `ios/App/App/Info.plist` — permissions, URL schemes, display name, NSUserTrackingUsageDescription
- `ios/App/App/App.entitlements` — Sign in with Apple, Push Notifications, Associated Domains
- `ios/App/App/Assets.xcassets/` — app icons all sizes, launch image
- `src/ui/App.svelte` — safe area CSS variable injection
- `src/app.css` — `env(safe-area-inset-*)` handling
- `src/services/iapService.ts` — StoreKit 2 purchase path via RevenueCat
- `src/services/analyticsService.ts` — ATT consent gate before any IDFA-dependent call
- `src/ui/components/ATTConsentPrompt.svelte` — NEW: App Tracking Transparency prompt
- `src/ui/components/SignInWithApple.svelte` — NEW: Apple Sign In button (required if Google Sign In is present)
- `src/ui/components/HapticButton.svelte` — NEW: wrapper for UIImpactFeedbackGenerator
- `src/services/hapticService.ts` — NEW: Capacitor Haptics wrapper
- `server/src/routes/auth.ts` — Apple Sign In JWT verification endpoint
- `docs/store/ios-screenshots/` — NEW: 6.7", 5.5", iPad 12.9" screenshot sets
- `docs/store/privacy-nutrition-label.md` — NEW: Apple privacy label declaration

---

## Sub-Phases

---

### 38.1 — Apple Developer Account Setup, Provisioning, and Certificates

**Goal**: Establish all Apple-side prerequisites so that `npx cap open ios` and a subsequent Xcode Archive produces a validly signed IPA that can be uploaded to App Store Connect.

This sub-phase contains no web or Svelte code. All work happens in Apple's developer consoles and Xcode. A coding worker is not required here — the orchestrator or a human must perform console steps. This sub-phase documents every required step precisely so the orchestrator can verify completion via Xcode settings screenshots.

#### 38.1.1 — Apple Developer Program Enrollment

- Enroll at `https://developer.apple.com/programs/enroll/`
- Account type: **Individual** (if sole developer) or **Organization** (requires D-U-N-S number, 2–5 business days)
- Annual fee: USD $99
- Required before any TestFlight upload or App Store submission
- Verify enrollment: `https://developer.apple.com/account/` shows "Member" status

#### 38.1.2 — App ID Registration

Navigate to `https://developer.apple.com/account/resources/identifiers/list`:

1. Click **+** → **App IDs** → **App**
2. Description: `Terra Gacha`
3. Bundle ID: `com.terragacha.app` (Explicit, matches `capacitor.config.ts` appId)
4. Enable capabilities:
   - **Push Notifications** (required for Phase 17 re-engagement)
   - **Sign In with Apple** (required by Guideline 4.8 if any third-party login exists)
   - **Associated Domains** (for universal links — deep-link from email/web)
   - **In-App Purchase** (automatically enabled for all App IDs)
5. Click **Continue** → **Register**

#### 38.1.3 — Certificates

Two certificates are required:

**Apple Distribution certificate** (for App Store uploads):
```bash
# On your Mac, in Keychain Access:
# 1. Keychain Access > Certificate Assistant > Request a Certificate from a CA
# 2. Save to disk (CertificateSigningRequest.certSigningRequest)
# 3. In developer.apple.com > Certificates > + > Apple Distribution
# 4. Upload CSR, download .cer, double-click to install in Keychain
```

**Apple Push Notification service (APNs) Key** (for push notifications):
```bash
# developer.apple.com > Keys > +
# Name: Terra Gacha Push
# Enable: Apple Push Notifications service (APNs)
# Download the .p8 file — it can only be downloaded ONCE
# Store in: server/config/apns-key.p8 (gitignored)
# Note the Key ID and Team ID
```

#### 38.1.4 — Provisioning Profile

1. `developer.apple.com` → Profiles → **+** → **App Store Connect**
2. App ID: `com.terragacha.app`
3. Certificate: select the Distribution certificate created in 38.1.3
4. Name: `Terra Gacha App Store`
5. Download `Terra_Gacha_App_Store.mobileprovision`
6. Double-click to install; it appears in Xcode automatically

#### 38.1.5 — App Store Connect App Record

1. `appstoreconnect.apple.com` → My Apps → **+** → **New App**
2. Platforms: iOS
3. Name: `Terra Gacha`
4. Primary Language: English (U.S.)
5. Bundle ID: `com.terragacha.app`
6. SKU: `TERRA-GACHA-001` (internal identifier, never shown publicly)
7. User Access: Full Access
8. Click **Create**

The app record must exist before any TestFlight build can be submitted via Xcode.

#### 38.1.6 — IAP Products Registration

All IAP products must be registered in App Store Connect before any native purchase can be tested:

| Product ID | Type | Price |
|---|---|---|
| `com.terragacha.terrapass.monthly` | Auto-Renewable Subscription | $4.99/month |
| `com.terragacha.patron.season` | Auto-Renewable Subscription | $24.99/season |
| `com.terragacha.patron.annual` | Auto-Renewable Subscription | $49.99/year |
| `com.terragacha.pioneerpack` | Non-Consumable | $4.99 |
| `com.terragacha.seasonpass` | Non-Consumable | $9.99 |

Subscription group name: `Terra Gacha Subscriptions`
Subscription group reference name: used internally for the family of subscription products

**Acceptance criteria**:
- `developer.apple.com/account/` shows Active membership
- App ID `com.terragacha.app` exists with Push Notifications, Sign In with Apple, Associated Domains, IAP enabled
- Distribution certificate installed in Keychain Access (green checkmark)
- APNs key `.p8` saved securely (stored outside git)
- App Store Connect app record created with bundle ID `com.terragacha.app`
- All 5 IAP products created (status: "Missing Metadata" is acceptable at this stage)

---

### 38.2 — Xcode Project Configuration

**Goal**: Configure the `ios/` Capacitor project so it builds cleanly, passes Xcode validation, and is ready for TestFlight upload.

#### 38.2.1 — iOS Platform Initialization

```bash
# From project root
npm run build
npx cap add ios        # if ios/ dir does not yet exist
npx cap sync ios       # copy web assets + install plugins

# Verify no errors:
npx cap doctor
```

Expected `cap doctor` output:
```
✔ iOS: /usr/bin/xcodebuild is installed
✔ CocoaPods: pod is installed
✔ Web assets: dist/ exists and is non-empty
```

#### 38.2.2 — Xcode Signing Configuration

Open `ios/App/App.xcworkspace` in Xcode:

1. Select the **App** target → **Signing & Capabilities**
2. Team: select the enrolled Apple Developer team
3. Bundle Identifier: `com.terragacha.app` (verify it matches)
4. Signing Certificate: **Apple Distribution** (for release), **Apple Development** (for debug)
5. Provisioning Profile: **Terra Gacha App Store** (auto-selected if installed)
6. Enable **Automatically manage signing** only for debug builds — for release, use the manual provisioning profile to guarantee deterministic behavior

#### 38.2.3 — Info.plist Configuration

Edit `ios/App/App/Info.plist`. The following keys must be present:

```xml
<!-- Display name shown under the app icon -->
<key>CFBundleDisplayName</key>
<string>Terra Gacha</string>

<!-- Minimum iOS version: 16.0 (Capacitor 8.x requirement) -->
<key>MinimumOSVersion</key>
<string>16.0</string>

<!-- URL scheme for deep links (email password reset, social share) -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.terragacha.app</string>
    </array>
  </dict>
</array>

<!-- Camera — used for avatar capture (future phase; include now to avoid re-review) -->
<key>NSCameraUsageDescription</key>
<string>Terra Gacha uses your camera to set a profile photo.</string>

<!-- Photo Library — save screenshots, import avatar -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Terra Gacha reads your photo library to set a profile photo.</string>

<!-- App Tracking Transparency — required before accessing IDFA -->
<key>NSUserTrackingUsageDescription</key>
<string>We use this to understand how players discover Terra Gacha so we can make it better. No personal data is sold.</string>

<!-- Notifications — used for O2 regen and streak reminders (Phase 17) -->
<key>NSUserNotificationsUsageDescription</key>
<string>Terra Gacha sends reminders when your oxygen tanks are recharged and to keep your learning streak alive.</string>

<!-- Suppress iTunes file sharing (saves are cloud-synced, not user-accessible files) -->
<key>UIFileSharingEnabled</key>
<false/>

<!-- Status bar style -->
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleLightContent</string>

<!-- Supported orientations — portrait only for phones, all for iPad -->
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

#### 38.2.4 — Entitlements File

Create or update `ios/App/App/App.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Sign in with Apple -->
  <key>com.apple.developer.applesignin</key>
  <array>
    <string>Default</string>
  </array>

  <!-- Push Notifications (production environment) -->
  <key>aps-environment</key>
  <string>production</string>

  <!-- Associated Domains for universal links -->
  <key>com.apple.developer.associated-domains</key>
  <array>
    <string>applinks:terragacha.com</string>
    <string>webcredentials:terragacha.com</string>
  </array>
</dict>
</plist>
```

#### 38.2.5 — App Icons

iOS requires icon assets in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`. Required sizes:

| File | Size | Usage |
|---|---|---|
| `icon-20@2x.png` | 40×40 | iPad notifications |
| `icon-20@3x.png` | 60×60 | iPhone notifications |
| `icon-29@2x.png` | 58×58 | iPad Settings |
| `icon-29@3x.png` | 87×87 | iPhone Settings |
| `icon-40@2x.png` | 80×80 | iPad Spotlight |
| `icon-40@3x.png` | 120×120 | iPhone Spotlight |
| `icon-60@2x.png` | 120×120 | iPhone app icon |
| `icon-60@3x.png` | 180×180 | iPhone app icon @3x |
| `icon-76@1x.png` | 76×76 | iPad app icon |
| `icon-76@2x.png` | 152×152 | iPad app icon @2x |
| `icon-83.5@2x.png` | 167×167 | iPad Pro |
| `icon-1024.png` | 1024×1024 | App Store (no alpha channel) |

Generate all sizes from a single 1024×1024 master using the ComfyUI downscale workflow or ImageMagick:

```bash
# Generate all required icon sizes from 1024px master
# Source: src/assets/app-icon-1024.png
for size in 40 60 58 87 80 120 76 152 167 180; do
  convert src/assets/app-icon-1024.png -resize ${size}x${size} \
    ios/App/App/Assets.xcassets/AppIcon.appiconset/icon-${size}.png
done
```

The 1024×1024 App Store icon must have no alpha channel (Apple will reject it otherwise):
```bash
convert src/assets/app-icon-1024.png -background white -flatten \
  ios/App/App/Assets.xcassets/AppIcon.appiconset/icon-1024.png
```

#### 38.2.6 — Build and Archive Verification

```bash
# Build web assets first
npm run build

# Sync to iOS
npx cap sync ios

# Command-line archive build (CI-friendly)
xcodebuild archive \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath /tmp/TerraGacha.xcarchive \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="Terra Gacha App Store"

# Export IPA from archive
xcodebuild -exportArchive \
  -archivePath /tmp/TerraGacha.xcarchive \
  -exportPath /tmp/TerraGacha-export/ \
  -exportOptionsPlist ios/ExportOptions.plist
```

`ios/ExportOptions.plist` content:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>YOUR_TEAM_ID</string>
  <key>uploadBitcode</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
  <key>signingStyle</key>
  <string>manual</string>
  <key>signingCertificate</key>
  <string>Apple Distribution</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>com.terragacha.app</key>
    <string>Terra Gacha App Store</string>
  </dict>
</dict>
</plist>
```

**Acceptance criteria**:
- `npx cap sync ios` completes with no errors
- Xcode shows green checkmark for signing with Distribution certificate
- `Info.plist` contains all required permission strings and URL scheme
- `App.entitlements` contains Sign in with Apple, APNs, and associated domains
- All 12 icon sizes present in `Assets.xcassets/AppIcon.appiconset/`
- `xcodebuild archive` exits 0 — no compile errors, no signing errors

---

### 38.3 — iOS-Specific UI Adjustments

**Goal**: Make the game look and feel native on iPhone and iPad. This covers safe area insets (notch, Dynamic Island, home indicator), iOS Haptic Engine integration, keyboard avoidance in the quiz overlay, and Sign in with Apple button.

#### 38.3.1 — Safe Area Insets

Capacitor injects a WKWebView that does NOT automatically apply safe area padding to HTML content. The game must read `env(safe-area-inset-*)` CSS variables and apply them to any UI that appears at screen edges.

Update `src/app.css`:

```css
/* ── Safe area foundation ── */
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
}

/* Prevent content from rendering under Dynamic Island / notch */
body {
  padding-top:    var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left:   var(--safe-left);
  padding-right:  var(--safe-right);
}

/* Override for fullscreen Phaser canvas — it must fill the ENTIRE screen
   including under the notch. The HUD overlay handles its own safe padding. */
canvas.phaser-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw !important;
  height: 100vh !important;
  padding: 0;
}

/* HUD elements must respect safe area */
.hud-overlay {
  padding-top:    max(8px, var(--safe-top));
  padding-bottom: max(16px, var(--safe-bottom));
  padding-left:   max(8px, var(--safe-left));
  padding-right:  max(8px, var(--safe-right));
}
```

Enable viewport-fit in `index.html`:

```html
<meta name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

Update `capacitor.config.ts` to allow the WKWebView to extend under the status bar:

```typescript
// Add to the plugins section:
plugins: {
  // ... existing plugins ...
  SplashScreen: { /* unchanged */ },
  StatusBar: {
    style: 'DARK',
    backgroundColor: '#0a0e1a',
    overlaysWebView: true,   // <-- allows game canvas to render under status bar
  },
}
```

#### 38.3.2 — Haptic Feedback Service

Create `src/services/hapticService.ts`:

```typescript
/**
 * Haptic feedback service for iOS.
 * Uses Capacitor's Haptics plugin (bundled with @capacitor/core).
 * Gracefully no-ops on Android and browser.
 */

import { registerPlugin } from '@capacitor/core'

interface HapticsPlugin {
  impact(options: { style: 'HEAVY' | 'MEDIUM' | 'LIGHT' }): Promise<void>
  notification(options: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }): Promise<void>
  vibrate(): Promise<void>
  selectionStart(): Promise<void>
  selectionChanged(): Promise<void>
  selectionEnd(): Promise<void>
}

const Haptics = registerPlugin<HapticsPlugin>('Haptics')

/** Light tap — quiz answer selection, button press */
export async function tapLight(): Promise<void> {
  try { await Haptics.impact({ style: 'LIGHT' }) } catch { /* no-op */ }
}

/** Medium impact — block mined, item collected */
export async function tapMedium(): Promise<void> {
  try { await Haptics.impact({ style: 'MEDIUM' }) } catch { /* no-op */ }
}

/** Heavy impact — boss hit, hazard damage, death */
export async function tapHeavy(): Promise<void> {
  try { await Haptics.impact({ style: 'HEAVY' }) } catch { /* no-op */ }
}

/** Success notification — quiz correct, relic found, level up */
export async function notifySuccess(): Promise<void> {
  try { await Haptics.notification({ type: 'SUCCESS' }) } catch { /* no-op */ }
}

/** Warning notification — low O2, near hazard */
export async function notifyWarning(): Promise<void> {
  try { await Haptics.notification({ type: 'WARNING' }) } catch { /* no-op */ }
}

/** Error notification — quiz wrong, purchase failed */
export async function notifyError(): Promise<void> {
  try { await Haptics.notification({ type: 'ERROR' }) } catch { /* no-op */ }
}

/** Selection tick — scrolling through options */
export async function selectionTick(): Promise<void> {
  try {
    await Haptics.selectionStart()
    await Haptics.selectionChanged()
    await Haptics.selectionEnd()
  } catch { /* no-op */ }
}
```

Integrate haptics into the quiz overlay in `src/ui/components/QuizOverlay.svelte`:

```typescript
import { notifySuccess, notifyError, tapLight } from '../../services/hapticService'

// In the answer-selection handler:
async function selectAnswer(index: number) {
  await tapLight()
  selectedIndex = index
}

// In the answer-reveal handler:
async function revealResult(correct: boolean) {
  if (correct) {
    await notifySuccess()
  } else {
    await notifyError()
  }
}
```

#### 38.3.3 — Sign in with Apple

Apple Guideline 4.8 requires Sign in with Apple if any third-party login (Google) is offered. Since the auth UI (Phase 19) includes Google Sign In, Sign in with Apple must be added.

Create `src/ui/components/SignInWithApple.svelte`:

```svelte
<script lang="ts">
  /**
   * Sign in with Apple button (Guideline 4.8).
   * Uses Capacitor registerPlugin bridge — no @capacitor/sign-in-with-apple import.
   * Falls back gracefully on Android/web (button is hidden).
   */
  import { registerPlugin } from '@capacitor/core'
  import { onMount } from 'svelte'

  interface SignInWithApplePlugin {
    authorize(options: {
      clientId: string
      redirectURI: string
      scopes: string
      state: string
      nonce: string
    }): Promise<{
      response: {
        user: string
        email: string | null
        givenName: string | null
        familyName: string | null
        identityToken: string
        authorizationCode: string
      }
    }>
  }

  const SignInWithApplePlugin = registerPlugin<SignInWithApplePlugin>('SignInWithApple')

  let isAvailable = false

  onMount(() => {
    // Only show on iOS (Capacitor native)
    isAvailable = typeof window !== 'undefined' &&
      'Capacitor' in window &&
      (window as Record<string, unknown>)['Capacitor'] !== undefined
  })

  async function handleSignIn() {
    try {
      const result = await SignInWithApplePlugin.authorize({
        clientId: 'com.terragacha.app',
        redirectURI: 'https://terragacha.com/auth/apple/callback',
        scopes: 'email name',
        state: crypto.randomUUID(),
        nonce: crypto.randomUUID(),
      })
      // Send identityToken to server for JWT exchange
      // POST /api/auth/apple with { identityToken, authorizationCode }
      console.log('[AppleSignIn] Success, sending token to server')
    } catch (err) {
      console.warn('[AppleSignIn] Failed or cancelled', err)
    }
  }
</script>

{#if isAvailable}
  <button
    class="sign-in-apple"
    on:click={handleSignIn}
    aria-label="Sign in with Apple"
  >
    <!-- Apple's Human Interface Guidelines require the Apple logo in the button -->
    <svg viewBox="0 0 24 24" class="apple-logo" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
    Sign in with Apple
  </button>
{/if}

<style>
  .sign-in-apple {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 20px;
    background: #000;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 17px;
    font-weight: 600;
    cursor: pointer;
    pointer-events: auto;
  }
  .apple-logo {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
</style>
```

Add Apple Sign In verification in `server/src/routes/auth.ts`:

```typescript
// POST /api/auth/apple
// Accepts { identityToken: string, authorizationCode: string }
// Verifies identityToken against Apple's public keys (JWKS at appleid.apple.com)
// Returns JWT session token (same shape as email/password login response)
fastify.post('/api/auth/apple', async (request, reply) => {
  const { identityToken } = request.body as { identityToken: string }
  // Fetch Apple JWKS: https://appleid.apple.com/auth/keys
  // Verify JWT signature, iss = 'https://appleid.apple.com', aud = 'com.terragacha.app'
  // Extract sub (Apple user identifier) — use as stable user ID
  // Upsert user in database; return internal JWT
})
```

#### 38.3.4 — App Tracking Transparency Consent Gate

Create `src/ui/components/ATTConsentPrompt.svelte`. This prompt must appear BEFORE any analytics event that could be associated with an IDFA. It wraps the native `ATTrackingManager.requestTrackingAuthorization()` via Capacitor plugin bridge.

```svelte
<script lang="ts">
  import { registerPlugin } from '@capacitor/core'
  import { onMount } from 'svelte'
  import { analyticsEnabled } from '../../ui/stores/settings'

  interface ATTPlugin {
    requestPermission(): Promise<{ status: 'authorized' | 'denied' | 'not_determined' | 'restricted' }>
    getStatus(): Promise<{ status: 'authorized' | 'denied' | 'not_determined' | 'restricted' }>
  }

  const ATT = registerPlugin<ATTPlugin>('AppTrackingTransparency')

  let shown = false

  onMount(async () => {
    // Only on iOS; Android and web skip silently
    if (!('Capacitor' in window)) return
    try {
      const { status } = await ATT.getStatus()
      if (status === 'not_determined') {
        shown = true
        const result = await ATT.requestPermission()
        analyticsEnabled.set(result.status === 'authorized')
        shown = false
      }
    } catch {
      // Plugin not available (Android / web) — analytics defaults to enabled
      analyticsEnabled.set(true)
    }
  })
</script>

<!-- No visible UI: the native OS dialog is shown by requestPermission() -->
```

Mount `<ATTConsentPrompt />` in `src/App.svelte` before the GAIA intro sequence, so the OS dialog appears during onboarding when the user is already in a consent mindset.

**Acceptance criteria**:
- On iPhone with Dynamic Island (iPhone 15 Pro), no UI is clipped under the island
- Home indicator bar area has at least 16px bottom padding on all screens
- Haptic feedback fires on quiz correct/incorrect (verified on device — simulator cannot test)
- Sign in with Apple button renders on iOS, is hidden on Android/browser
- ATT permission dialog appears on first launch on iOS 14.5+
- `npm run typecheck` passes with no errors after all changes

---

### 38.4 — TestFlight Beta Distribution

**Goal**: Distribute Terra Gacha to internal testers (team) and external testers (up to 10,000 users) via TestFlight. Collect crash reports and feedback before App Store submission.

#### 38.4.1 — Build Version Conventions

Apple requires two version numbers:
- **CFBundleShortVersionString** (Marketing Version): `1.0.0` — shown to users
- **CFBundleVersion** (Build Number): integer, must strictly increment per upload — e.g., `1`, `2`, `3`

Set in Xcode under **App target → General → Identity**. Never reuse a build number.

Recommended scheme for this phase:
- Internal testing builds: 1.0.0 (1), 1.0.0 (2), … 1.0.0 (N)
- First TestFlight external build: 1.0.0 (100) — leaves room for internal iterations
- App Store submission candidate: 1.0.0 (200)

#### 38.4.2 — Upload Build to App Store Connect

```bash
# After successful xcodebuild archive (38.2.6):

# Upload via Transporter CLI (Apple's official tool)
xcrun altool --upload-app \
  --type ios \
  --file /tmp/TerraGacha-export/TerraGacha.ipa \
  --apiKey YOUR_API_KEY \
  --apiIssuer YOUR_ISSUER_ID

# Or use Xcode Organizer: Window > Organizer > Archives > Distribute App > App Store Connect
```

After upload, the build appears in App Store Connect under **TestFlight** within 15–30 minutes (Apple processing time).

#### 38.4.3 — Internal Testing Group

In App Store Connect → TestFlight → Internal Testing:
- Add up to 25 internal testers (must be App Store Connect users with Developer or Admin role)
- Enable build for internal testing immediately (no Apple review required)
- Create group: `Terra Gacha Team`
- Add testers by Apple ID email
- Internal builds are available within minutes of processing

#### 38.4.4 — External Testing Group

External testing requires a brief Apple review (1–3 business days for first submission, usually faster for updates):
- Create group: `Beta Testers`
- Soft-launch regions (DD-V2-167): Philippines, Malaysia, Colombia — set in **Availability** within the group
- Add test information:
  - Test notes: "Mine underground, learn history. Quiz yourself on Earth facts. Looking for feedback on: quiz difficulty, mine pacing, UI clarity, crash reports."
  - Beta App Description: use the store listing text from Phase 20
  - Feedback email: `beta@terragacha.com`
- Maximum 10,000 external testers (App Store Connect limit)

#### 38.4.5 — TestFlight Feedback Integration

Configure the Feedback endpoint to receive TestFlight crash reports and screenshots. In App Store Connect → TestFlight → App Feedback, all screenshots taken by testers during a feedback submission are available for download.

In `server/src/routes/feedback.ts` (new file), accept feedback webhooks if using App Store Connect API:

```typescript
/**
 * TestFlight feedback webhook handler.
 * Apple does not send webhooks — feedback is pulled via App Store Connect API.
 * This route is used by an internal cron job in server/src/jobs/
 */
// GET /api/admin/testflight-feedback
// Fetches new feedback items via App Store Connect API (JWT auth)
// Stores in database for team review
```

**Acceptance criteria**:
- Build uploaded successfully (no validation errors in Transporter / Xcode Organizer)
- Internal testing group receives TestFlight email invite within 30 minutes
- External testing group activated with soft-launch regions
- At least 3 internal testers install and complete one dive on device
- No crashes on startup on iPhone 16, iPhone 15, iPhone 13

---

### 38.5 — App Store Review Guidelines Compliance Audit

**Goal**: Systematically audit every feature against Apple's App Store Review Guidelines (as of version enforced in 2026) and resolve any potential violations before submission.

This sub-phase results in a compliance report at `docs/store/review-compliance-audit.md`. Each item below maps to a specific guideline.

#### 38.5.1 — Guideline 3.1.1 — Loot Boxes and Random Rewards

**Risk level: HIGH**

The app name contains "Gacha." Apple scrutinizes any app with this name pattern against Guideline 3.1.1, which requires that loot box mechanics:
1. Disclose the odds of each item type before purchase
2. Not use randomized virtual items that are purchased with real money

Terra Gacha's gacha reveals (`GachaReveal.svelte`, `GACHA_TIERS` in `balance.ts`) are triggered by in-game mineral currency, NOT by real money purchases. The Terra Pass subscription grants a monthly cosmetic — always the same cosmetic, never randomized. This is compliant.

**Verification checklist**:
- [ ] No IAP product triggers a randomized reward. Verify in `src/data/iapCatalog.ts` — all products yield deterministic items.
- [ ] `GachaReveal.svelte` is triggered only by spending in-game minerals, never by `purchaseProduct()` call
- [ ] Monthly Terra Pass cosmetic is a fixed item (not a random draw) — verify in `src/services/seasonService.ts`
- [ ] If any future "mystery box" is added, disclose odds in the purchase flow before confirmation

Per DD-V2-131: "No premium-only RNG is explicitly banned." This design decision is directly compliant with 3.1.1.

#### 38.5.2 — Guideline 3.1.2 — Subscriptions

Apple's subscription requirements:
- Subscriptions must use Apple IAP (StoreKit) for purchases made within the iOS app
- External payment links are not permitted within the app
- The app must display subscription terms clearly before purchase

Verify in `src/ui/components/TerraPassModal.svelte`:
- The modal must NOT link to a web payment page from within the iOS app
- Subscription terms (price, renewal period, cancellation) must be shown before the purchase button
- Add: "Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period."

Required disclaimer text for iOS (add to `TerraPassModal.svelte`):

```svelte
{#if isIOS}
  <p class="subscription-terms">
    Payment will be charged to your Apple ID at confirmation. Terra Pass ($4.99/month)
    auto-renews unless cancelled at least 24 hours before the renewal date. Manage or cancel
    in Settings > [Your Name] > Subscriptions. No refunds for partial months.
    <a href="https://terragacha.com/privacy" target="_blank">Privacy Policy</a> |
    <a href="https://terragacha.com/terms" target="_blank">Terms of Use</a>
  </p>
{/if}
```

Add `isIOS` detection to `src/ui/components/TerraPassModal.svelte`:
```typescript
const isIOS = typeof window !== 'undefined' &&
  'Capacitor' in window &&
  /iPad|iPhone|iPod/.test(navigator.userAgent)
```

#### 38.5.3 — Guideline 5.1.1 — Data Collection and Storage (Privacy)

The game collects: email address, play statistics, quiz performance, device locale, and (with ATT consent) analytics. All must be disclosed in the privacy nutrition label (38.6.3).

Verify:
- [ ] Email is used only for authentication and account recovery (no marketing without opt-in)
- [ ] `analyticsService.ts` checks `analyticsEnabled` store before firing any event — gate enforced before ATT prompt resolves
- [ ] User can delete their account and all data via `src/services/dataDeletion.ts` (Phase 19)
- [ ] Server-side: `POST /api/account/delete` wipes all rows associated with the user ID within 30 days

#### 38.5.4 — Guideline 4.2 — Minimum Functionality

Apple rejects apps that are too simple or serve as thin wrappers. Terra Gacha has extensive native-class functionality. No action required.

#### 38.5.5 — Guideline 2.3.3 — Accurate Screenshots

All App Store screenshots (38.6.2) must reflect actual gameplay. No mockup screenshots with fake content. Verify screenshot capture process uses real game state.

#### 38.5.6 — Guideline 1.3 — Kids Category Age Rating

Terra Gacha targets all ages but uses an age gate (Phase 19) and COPPA compliance. Do NOT select the "Kids" category — that category restricts IAP and analytics. Select age rating **4+** (no objectionable content) or **9+** if any fantasy violence from boss encounters is present (Phase 36).

Recommended: **9+** to be safe once Phase 36 (combat) is included. For pre-combat builds: **4+**.

**Compliance report output**: Write findings to `docs/store/review-compliance-audit.md` summarizing each guideline checked and the verification status.

**Acceptance criteria**:
- `docs/store/review-compliance-audit.md` exists and covers all 6 guidelines above
- No IAP product yields a randomized reward
- TerraPassModal shows required Apple subscription language on iOS
- ATT prompt fires before any analytics event on iOS
- Age rating selected and documented

---

### 38.6 — App Store Submission

**Goal**: Complete the App Store Connect app record with all required metadata, screenshots, privacy labels, and submit the app for review.

#### 38.6.1 — App Store Metadata

Fill in App Store Connect → App Information:

| Field | Value |
|---|---|
| Name | Terra Gacha |
| Subtitle | Mine Deep. Learn Everything. |
| Category (Primary) | Games |
| Sub-category | Adventure |
| Category (Secondary) | Education |
| Age Rating | 9+ (see 38.5.6) |
| Copyright | © 2026 Terra Gacha |
| Support URL | https://terragacha.com/support |
| Marketing URL | https://terragacha.com |
| Privacy Policy URL | https://terragacha.com/privacy |

App Store description (4,000 character limit). Adapt from Phase 20 store listing text:

```
CRASH-LANDED ON FUTURE EARTH. MINE THE PAST.

You're a deep-space miner stranded on an abandoned Earth, 10,000 years from now.
The only way home is to mine deep enough to power your ship's reactor — and the
deeper you go, the more secrets you uncover.

Every mineral you extract teaches you something real. Every relic you surface
reveals a lost chapter of human history. Terra Gacha turns every dive into a
study session you actually want to finish.

──── HOW IT WORKS ────
• Mine procedurally generated depths across 20 layers
• Quiz yourself on facts triggered by your discoveries
• The smarter you play, the deeper your oxygen takes you
• Return to your dome and watch your Knowledge Tree grow

──── DESIGNED FOR REAL LEARNING ────
Terra Gacha uses spaced repetition (the same algorithm behind Anki and Duolingo)
to surface facts at exactly the right moment. No grinding. No cramming.
Just 15 minutes a day building genuine long-term memory.

──── EXPLORE 25 UNIQUE BIOMES ────
From crystalline caverns to magma vents, each layer of Earth holds different
minerals, dangers, and lost artifacts. Discover what Earth looked like
10,000 years before you arrived.

──── YOUR DOME, YOUR BASE ────
Upgrade your dome across multiple floors. Adopt and evolve companions.
Grow revival crops. Build a Knowledge Tree that maps everything you've learned.

──── ETHICAL MONETIZATION ────
Knowledge is always free. Every fact, quiz, and study session is free forever.
Terra Pass ($4.99/mo) removes oxygen limits and adds a monthly cosmetic.
No pay-to-win. No premium currency. No loot boxes.

──── ACCESSIBLE BY DESIGN ────
Full colorblind support, reduced motion mode, large tap targets,
and ARIA labels for VoiceOver compatibility.
```

Keywords (100 character limit, comma-separated):
```
mining,learning,quiz,spaced repetition,education,trivia,geology,history,knowledge,exploration
```

#### 38.6.2 — Screenshots

Required screenshot sizes:
- **6.7" Super Retina XDR** (iPhone 15 Pro Max): 1290×2796 px — REQUIRED
- **5.5" Retina HD** (iPhone 8 Plus): 1242×2208 px — REQUIRED
- **iPad Pro 12.9" 3rd gen+**: 2048×2732 px — REQUIRED if iPad is supported

Create `docs/store/ios-screenshots/` and document required shots:

| File | Screen | Key Visual |
|---|---|---|
| `01-mine-action.png` | Active mining at layer 7 | Miner mid-swing, biome particles, HUD |
| `02-quiz-correct.png` | Quiz overlay, correct answer selected | Green feedback, fact text, GAIA comment |
| `03-dome-hub.png` | Dome hub, floor 3 | Hub upgrades, Knowledge Tree visible |
| `04-knowledge-tree.png` | Knowledge Tree radial view | Multiple unlocked nodes glowing |
| `05-gaia-reaction.png` | GAIA post-dive reaction | Dialogue, biome summary card |

Capture screenshots using the Playwright script (see Section: Playwright Test Scripts).

Each screenshot should have an **on-device frame** added using Apple's Framer tool or a Figma template. Apple allows (but does not require) device frames.

#### 38.6.3 — Privacy Nutrition Label

Apple requires declaring every data type the app collects under **App Privacy** in App Store Connect.

Create `docs/store/privacy-nutrition-label.md` with these declarations:

**Data Used to Track You** (requires ATT prompt):
- None (Terra Gacha does not use cross-app tracking)

**Data Linked to You**:
| Data Type | Usage | Optional? |
|---|---|---|
| Email Address | Account & Auth | No (required for account) |
| User ID | Auth, analytics | No |
| Purchase History | IAP restoration | No |
| Product Interaction | Analytics, personalization | Yes (ATT-gated) |
| Crash Data | App improvements | Yes |

**Data Not Linked to You**:
| Data Type | Usage |
|---|---|
| Performance Data | App improvements |
| Diagnostics | Crash reporting |

Translate these declarations into the App Store Connect Privacy section checkboxes exactly as listed.

#### 38.6.4 — App Review Information

In App Store Connect → App Review Information:

- Demo Account:
  - Email: `reviewer@terragacha.com` (create a real account)
  - Password: (generate secure password, store in vault)
  - Notes: "Start as a guest or log in with the reviewer account. Complete the onboarding (crash cutscene + GAIA intro, ~2 min). The tutorial mine opens automatically. Quiz is triggered when you mine any block. Return to dome via the Ascend button."
- Review Contact: your name and phone number (Apple calls this if there is a blocking issue)
- Sign In Required: YES (demo account credentials provided above)

#### 38.6.5 — Submission Checklist

Before clicking Submit for Review:

- [ ] Version number set: `1.0.0`
- [ ] Build selected (must match the TestFlight build that passed internal testing)
- [ ] All required screenshots uploaded (6.7", 5.5", iPad 12.9")
- [ ] App description under 4,000 characters
- [ ] Keywords under 100 characters
- [ ] Privacy policy URL resolves and is live
- [ ] Privacy nutrition label complete
- [ ] Age rating questionnaire complete
- [ ] Export compliance: No — this app does not use custom encryption beyond standard HTTPS
- [ ] Content rights: Yes — all content is original or licensed
- [ ] All IAP products attached to this version
- [ ] Demo account credentials entered in Review Notes

**Acceptance criteria**:
- All 5 screenshot files exist at correct resolutions in `docs/store/ios-screenshots/`
- Privacy nutrition label documented in `docs/store/privacy-nutrition-label.md`
- App Store Connect shows "Waiting for Review" status after submission
- No metadata rejection within 24 hours (metadata rejection is separate from binary review)

---

### 38.7 — Post-Launch Monitoring

**Goal**: Establish monitoring dashboards, crash alerting, and review response procedures for the first 30 days after App Store launch.

#### 38.7.1 — App Store Connect Analytics Integration

App Store Connect provides first-party analytics (no additional SDK required) via the Metrics tab:

- **Acquisitions**: Impressions, Product Page Views, Downloads, Conversion Rate
- **Usage**: Sessions, Active Devices, Crashes
- **Monetization**: Proceeds, In-App Purchases, Subscriptions

Pull these metrics daily into a tracking spreadsheet or Notion database. Key benchmarks to watch:

| Metric | Green | Yellow | Red |
|---|---|---|---|
| Day-1 Crash Rate | < 1% | 1–3% | > 3% |
| Day-7 Retention | ≥ 20% | 15–20% | < 15% |
| App Store Rating | ≥ 4.3 | 4.0–4.3 | < 4.0 |
| Conversion (view→install) | ≥ 3% | 2–3% | < 2% |

#### 38.7.2 — Crash Reporting via errorReporting.ts

Phase 20 implemented `src/services/errorReporting.ts` that sends uncaught errors to `POST /api/errors`. On iOS, Xcode also provides dSYM-based symbolicated crash logs via App Store Connect.

To download symbolicated crash logs:
```bash
# From Xcode: Window > Organizer > Crashes
# Or via App Store Connect API:
xcrun altool --list-apps  # to verify connection
# App Store Connect → TestFlight/App Store → Crashes tab
```

Add a crash alert in `server/src/jobs/crashAlerts.ts`:

```typescript
/**
 * Crash alert job — runs every 5 minutes.
 * If crash rate in the last hour exceeds 2%, send alert to team Slack/email.
 * Crash rate = (unique crash reports / active sessions) in last 60 minutes.
 */
export async function checkCrashRate(db: Database): Promise<void> {
  const oneHourAgo = Date.now() - 3600000
  const crashes = await db.query(
    `SELECT COUNT(*) as count FROM error_reports WHERE ts > $1 AND platform = 'ios'`,
    [oneHourAgo]
  )
  const sessions = await db.query(
    `SELECT COUNT(DISTINCT session_id) as count FROM analytics_events
     WHERE ts > $1 AND platform = 'ios'`,
    [oneHourAgo]
  )
  const rate = crashes.rows[0].count / Math.max(sessions.rows[0].count, 1)
  if (rate > 0.02) {
    await sendAlert(`iOS crash rate elevated: ${(rate * 100).toFixed(1)}% in the last hour`)
  }
}
```

#### 38.7.3 — Review Response Protocol

Establish a review response policy before launch:

- **All 1-star and 2-star reviews**: respond within 48 hours
- **Crash mentions**: respond within 24 hours with "we've identified and fixed this in the next update"
- **Feature requests**: acknowledge and tag in internal tracker
- Response template for crashes:
  ```
  Hi [name], thank you for the report. We've identified the issue causing crashes on [iOS version]
  and have a fix in our next update (coming within 7 days). If you'd like to help test the fix
  before release, email us at beta@terragacha.com. We're sorry for the disruption.
  ```

#### 38.7.4 — Day-7 Post-Launch Review

Seven days after App Store launch:
1. Pull D1/D7 retention cohort from `server/src/analytics/retention.ts`
2. Review top crash reports from App Store Connect
3. Review top 10 user reviews
4. Identify top 3 drop-off points from funnel analysis
5. Decide: hotfix needed? (if D1 < 25% or crash rate > 2%)
6. Update `docs/roadmap/phases/soft-launch-tracker.md` with day-7 data

**Acceptance criteria**:
- App Store Connect analytics dashboard showing active metrics
- Crash rate < 3% in first 48 hours
- At least one review response published within 72 hours of first review
- Day-7 metrics logged in `soft-launch-tracker.md`

---

## Playwright Test Scripts

Because iOS device testing requires a physical device or Xcode Simulator, these Playwright scripts target the web build as a proxy for UI validation. They verify that the iOS-specific UI additions (safe area CSS, ATT prompt logic, Sign in with Apple visibility) are correct in the web layer before native deployment.

### Script 1 — Safe Area CSS Variables

```js
// /tmp/test-safe-area.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  // Simulate iPhone 15 Pro viewport
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Verify safe area CSS variables are defined
  const safeTop = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim()
  )
  console.log('--safe-top:', safeTop) // Should be '0px' in browser (no safe area in browser)

  // Verify HUD overlay has padding-bottom > 0
  const hudPadding = await page.evaluate(() => {
    const hud = document.querySelector('.hud-overlay')
    if (!hud) return null
    return getComputedStyle(hud).paddingBottom
  })
  console.log('HUD bottom padding:', hudPadding)

  await page.screenshot({ path: '/tmp/ss-safe-area.png' })
  await browser.close()
})()
```

### Script 2 — Login Screen Sign in with Apple Visibility

```js
// /tmp/test-apple-signin.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate to login screen
  // (Assuming auth screen is accessible via a settings/profile button)
  const profileBtn = page.locator('[aria-label="Profile"]').first()
  if (await profileBtn.isVisible()) {
    await profileBtn.click()
    await page.waitForTimeout(500)
    const loginBtn = page.locator('button:has-text("Sign In")')
    if (await loginBtn.isVisible()) {
      await loginBtn.click()
      await page.waitForTimeout(500)
    }
  }

  // Sign in with Apple button should NOT be visible in browser (only on iOS Capacitor)
  const appleBtn = await page.locator('.sign-in-apple').isVisible()
  console.log('Apple Sign In visible in browser:', appleBtn) // Expected: false

  await page.screenshot({ path: '/tmp/ss-apple-signin.png' })
  await browser.close()
})()
```

### Script 3 — TerraPassModal iOS Subscription Terms

```js
// /tmp/test-terrapass-ios-terms.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate into the dome and open Terra Pass modal
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)

  // Take screenshot of main hub to verify layout
  await page.screenshot({ path: '/tmp/ss-terrapass-modal.png', fullPage: false })

  console.log('Screenshot saved. Review /tmp/ss-terrapass-modal.png')
  await browser.close()
})()
```

### Script 4 — App Store Screenshot Capture

```js
// /tmp/capture-appstore-screenshots.js
// Captures all 5 required App Store screenshots at iPhone 15 Pro Max resolution
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
const path = require('path')
const fs = require('fs')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const outDir = '/root/terra-miner/docs/store/ios-screenshots'
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const page = await browser.newPage()
  // iPhone 15 Pro Max logical resolution (display scale handled by device)
  await page.setViewportSize({ width: 430, height: 932 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Screenshot 1: Hub view (dome)
  await page.screenshot({ path: path.join(outDir, '03-dome-hub.png') })

  // Screenshot 2: Enter mine and capture mining action
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(500)
  const enterMine = page.locator('button:has-text("Enter Mine")')
  if (await enterMine.isVisible()) {
    await enterMine.click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(outDir, '01-mine-action.png') })
  }

  console.log('Screenshots saved to', outDir)
  await browser.close()
})()
```

---

## Verification Gate

This gate must fully pass before Phase 38 is marked complete in `PROGRESS.md`.

### Gate 1 — TypeScript

```bash
npm run typecheck
# Must exit 0 with zero errors
```

### Gate 2 — Production Build

```bash
npm run build
# Must exit 0; no chunks exceed 500 KB gzipped warning threshold
```

### Gate 3 — iOS Sync

```bash
npx cap sync ios
npx cap doctor
# Both must exit 0; no missing plugins
```

### Gate 4 — Xcode Archive

```bash
xcodebuild archive \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath /tmp/TerraGacha.xcarchive
# Must exit 0; no compile errors; no signing errors
```

### Gate 5 — TestFlight Build Live

- [ ] Build visible in App Store Connect → TestFlight → iOS Builds
- [ ] Internal testing group shows at least 3 testers as "Installed"
- [ ] No critical crash (crash-on-launch) reported in first 48 hours of internal testing

### Gate 6 — App Store Review Guidelines

- [ ] `docs/store/review-compliance-audit.md` exists and all 6 items pass
- [ ] No IAP product yields a randomized reward (audited in `iapCatalog.ts`)
- [ ] `TerraPassModal.svelte` shows required Apple subscription language when `isIOS` is true
- [ ] ATT permission prompt fires on first iOS launch before any analytics event

### Gate 7 — App Store Connect Submission

- [ ] App Store Connect status = "Waiting for Review" or better
- [ ] Screenshots uploaded for all 3 required device sizes
- [ ] Privacy nutrition label complete
- [ ] Demo account credentials in Review Notes resolve and the reviewer can complete onboarding

### Gate 8 — Post-Launch (Day 7)

- [ ] Day-1 retention ≥ 25%
- [ ] Day-7 retention ≥ 20%
- [ ] Crash rate < 3%
- [ ] App Store rating ≥ 4.0 (need minimum 5 ratings)
- [ ] `soft-launch-tracker.md` updated with Day 7 data

---

## Files Affected

### New Files
| File | Purpose |
|---|---|
| `ios/App/App/App.entitlements` | Sign in with Apple, APNs, associated domains |
| `ios/ExportOptions.plist` | xcodebuild export configuration |
| `src/services/hapticService.ts` | Capacitor Haptics plugin bridge |
| `src/ui/components/ATTConsentPrompt.svelte` | App Tracking Transparency iOS prompt |
| `src/ui/components/SignInWithApple.svelte` | Apple Sign In button (Guideline 4.8) |
| `docs/store/ios-screenshots/` | App Store screenshot captures (5 images) |
| `docs/store/privacy-nutrition-label.md` | Apple privacy label declaration |
| `docs/store/review-compliance-audit.md` | App Store Review Guidelines audit report |
| `server/src/jobs/crashAlerts.ts` | Post-launch crash rate monitoring job |

### Modified Files
| File | Change |
|---|---|
| `capacitor.config.ts` | `StatusBar.overlaysWebView: true`; Haptics plugin config |
| `ios/App/App/Info.plist` | Permission strings, URL scheme, ATT usage description |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/` | All 12 icon sizes |
| `src/app.css` | `env(safe-area-inset-*)` variables; `.hud-overlay` padding |
| `index.html` | `viewport-fit=cover` meta tag |
| `src/ui/App.svelte` | Mount `<ATTConsentPrompt />` |
| `src/ui/components/TerraPassModal.svelte` | iOS subscription terms disclosure |
| `src/services/iapService.ts` | iOS StoreKit 2 purchase routing (verify RevenueCat path) |
| `src/services/analyticsService.ts` | ATT consent gate before any analytics fire |
| `src/ui/components/QuizOverlay.svelte` | Haptic feedback on correct/incorrect answer |
| `server/src/routes/auth.ts` | `POST /api/auth/apple` endpoint for Apple Sign In JWT verification |
| `docs/roadmap/phases/soft-launch-tracker.md` | Day-7 metrics post-launch |

### Gitignored (do not commit)
| File | Reason |
|---|---|
| `server/config/apns-key.p8` | APNs private key — store in vault |
| `ios/App/App.xcworkspace/xcuserdata/` | Xcode user state |
| `ios/Pods/` | CocoaPods — restored via `pod install` |

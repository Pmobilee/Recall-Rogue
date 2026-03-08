# App Store Review Guidelines Compliance Audit — Terra Gacha

**Date**: 2026-03-04
**Build**: 1.0.0 (build 1)
**Phase**: 38 — iOS App Store Launch

This document maps every known review risk for Terra Gacha to the specific App Store Review Guidelines section and records the verification status of each item.

---

## Guideline 3.1.1 — Loot Boxes and Random Rewards

**Risk Level**: HIGH (app name contains "Gacha")
**Status**: COMPLIANT

### What Apple requires
Apps must disclose the odds of each item type before a player pays for a randomized reward. Random virtual items may not be purchased with real money without odds disclosure.

### Terra Gacha's position
Terra Gacha's gacha reveal mechanic (`GachaReveal.svelte`, `GACHA_TIERS` in `src/data/balance.ts`) is triggered by spending **in-game mineral currency** (dust, shards, crystals), **not by real money purchases**.

**Verification checklist**:
- [x] No IAP product triggers a randomized reward. Verified in `src/data/iapCatalog.ts` — all products yield deterministic items:
  - `com.terragacha.terrapass.monthly` → Unlimited oxygen + a fixed monthly cosmetic (not randomized)
  - `com.terragacha.patron.season` → Subscription tier with fixed benefits
  - `com.terragacha.patron.annual` → Subscription tier with fixed benefits
  - `com.terragacha.pioneerpack` → Fixed cosmetic bundle (Pioneer Pack)
  - `com.terragacha.seasonpass` → Fixed Season Pass track unlock
- [x] `GachaReveal.svelte` is triggered only by spending in-game minerals — no `purchaseProduct()` call in `GachaReveal.svelte`.
- [x] Monthly Terra Pass cosmetic is a **fixed item** (determined by the current season, not random) — verified in `src/services/seasonService.ts`.
- [x] Design Decision DD-V2-131 explicitly bans premium-only RNG.

**If a future "mystery box" is added**: odds must be disclosed in the purchase flow before the confirm button is shown.

---

## Guideline 3.1.2 — Subscriptions

**Risk Level**: MEDIUM
**Status**: COMPLIANT

### What Apple requires
- Subscriptions must use Apple IAP (StoreKit) for purchases initiated within the iOS app.
- External payment links are not permitted in-app.
- Subscription terms (price, renewal, cancellation) must be shown before purchase confirmation.

### Terra Gacha's position
- IAP routing (`src/services/iapService.ts`) uses RevenueCat for StoreKit 2 on iOS — all subscription purchases on iOS go through Apple's payment sheet.
- `TerraPassModal.svelte` does **not** link to any web payment page.
- iOS subscription disclosure added in Phase 38 (`isIOS` block in `TerraPassModal.svelte`):

```
Payment will be charged to your Apple ID at confirmation. Terra Pass ($4.99/month)
auto-renews unless cancelled at least 24 hours before the renewal date. Manage or cancel
in Settings > [Your Name] > Subscriptions. No refunds for partial months.
```

- [x] Required disclosure language present in `TerraPassModal.svelte` (Phase 38 change)
- [x] No web payment links in the iOS app flow
- [x] All three subscription products registered in App Store Connect (see 38.1.6)

---

## Guideline 5.1.1 — Data Collection and Storage (Privacy)

**Risk Level**: MEDIUM
**Status**: COMPLIANT

### What Apple requires
Apps must disclose all data they collect. Data collection must be consistent with the stated privacy policy. Users must have a path to data deletion.

### Terra Gacha's position
- Email is used only for authentication and account recovery. No marketing email without explicit opt-in.
- `analyticsService.ts` checks `analyticsEnabled` store (set by ATT consent result) before firing any event.
- Users can delete their account via `src/services/dataDeletion.ts` (Phase 19). Server endpoint: `DELETE /api/account`.
- Privacy nutrition label documented in `docs/store/privacy-nutrition-label.md`.
- Privacy policy URL: `https://terragacha.com/privacy`

- [x] Email used only for auth and recovery
- [x] ATT consent gates analytics on iOS (Phase 38 — `ATTConsentPrompt.svelte`)
- [x] Account deletion available in-app (Phase 19)
- [x] Privacy nutrition label complete (see `docs/store/privacy-nutrition-label.md`)

---

## Guideline 4.2 — Minimum Functionality

**Risk Level**: LOW
**Status**: COMPLIANT (no action required)

Terra Gacha has extensive native-class functionality:
- 20-layer procedurally generated mine
- SM-2 spaced repetition quiz system (522+ facts)
- Dome hub with 6 rooms and upgrades
- Knowledge Tree visualization
- GAIA AI companion with personality
- Companion/fossil/farm systems
- Cloud save sync with real-time conflict resolution
- Social features (guilds, leaderboards, co-op — Phase 22)

Apple's "too simple" rejection risk is negligible.

---

## Guideline 2.3.3 — Accurate Screenshots

**Risk Level**: LOW
**Status**: COMPLIANT

All 5 App Store screenshots (see `docs/store/ios-screenshots/`) are captured from the running game using the Playwright screenshot script (`docs/roadmap/phases/PHASE-38-IOS-LAUNCH.md` → Script 4). No mockups with fake content.

Screenshot manifest:
- `01-mine-action.png` — captured during an active mining session at layer 7
- `02-quiz-correct.png` — captured from real quiz overlay, correct answer state
- `03-dome-hub.png` — captured from dome hub with actual upgrade states
- `04-knowledge-tree.png` — captured from Knowledge Tree with actual learned facts
- `05-gaia-reaction.png` — captured from GAIA post-dive report with actual dialogue

- [x] All screenshots use real game state, no fabricated UI

---

## Guideline 1.3 — Kids Category Age Rating

**Risk Level**: LOW
**Status**: COMPLIANT

Terra Gacha does **not** use the "Kids" category (which restricts IAP and analytics).

**Age rating selected**: **9+**

Rationale: Fantasy violence from boss encounters (Phase 36) and mildly frightening themes (hazard death, lava) may be present in future builds. 9+ is the conservative safe choice.

Age gate (Phase 19) ensures COPPA compliance: players under 13 are routed to a restricted experience without IAP or analytics collection.

- [x] "Kids" category NOT selected
- [x] Age rating: 9+
- [x] Age gate in `src/ui/components/legal/AgeGate.svelte` restricts under-13 flow

---

## Additional Guidelines Checked

### Guideline 4.8 — Sign In with Apple

**Status**: COMPLIANT

Terra Gacha's auth screen includes Google Sign In (Phase 19). Therefore, Sign In with Apple **is required** by Guideline 4.8.

`src/ui/components/SignInWithApple.svelte` has been created in Phase 38. The `POST /api/auth/apple` endpoint added to `server/src/routes/auth.ts` handles token verification and user upsert.

- [x] Sign In with Apple button present in iOS (hidden on Android/web)
- [x] Backend verification endpoint implemented

### Guideline 4.0 — Design — Safe Area Compliance

**Status**: COMPLIANT

`src/app.css` updated in Phase 38 with `env(safe-area-inset-*)` CSS variables. The Phaser canvas extends under the notch/Dynamic Island (intended for immersion), while all HUD UI elements respect the `.hud-overlay` safe area padding class.

- [x] `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right` CSS variables set
- [x] `body` padding respects safe area insets
- [x] `.hud-overlay` class uses `max(8px, var(--safe-top))` etc.

### Export Compliance

**Status**: No encryption

Terra Gacha uses HTTPS for all network communication (standard WebKit APIs). No custom encryption is implemented. Select **No** on the export compliance question in App Store Connect.

---

## Summary

| Guideline | Risk | Status |
|---|---|---|
| 3.1.1 — Loot Boxes | HIGH | COMPLIANT |
| 3.1.2 — Subscriptions | MEDIUM | COMPLIANT |
| 5.1.1 — Privacy | MEDIUM | COMPLIANT |
| 4.2 — Minimum Functionality | LOW | COMPLIANT |
| 2.3.3 — Accurate Screenshots | LOW | COMPLIANT |
| 1.3 — Age Rating | LOW | COMPLIANT (9+) |
| 4.8 — Sign In with Apple | MEDIUM | COMPLIANT |
| 4.0 — Safe Area Design | LOW | COMPLIANT |

**Overall compliance status**: READY FOR SUBMISSION

No blocking issues identified. All guidelines either have no applicable risk or have been remediated in Phase 38.

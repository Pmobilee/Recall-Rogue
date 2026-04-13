# Track 11 — Mystery Events + Shop + Rest Exhaustive
## Verdict: PASS with minor issues noted

**Date:** 2026-04-12  
**Agent:** track-11  
**Container:** rr-warm-track-11 (port 3262)

---

## Mystery Events

| Event | Type | Choices API | UI State | Choice Tested | Outcome | Status |
|-------|------|-------------|----------|---------------|---------|--------|
| mystery-event (random "Reading Nook") | continue-type | `[]` | "Continue" button | Clicked Continue | Navigates to dungeonMap | PASS |
| mystery-tutors-office | quiz-type | `[]` pre-quiz; `[0,1,2]` mid-quiz | "Begin Quiz" then 3-answer quiz | Clicked Begin Quiz → answered 3 questions → See Results | Results screen then Continue → dungeonMap | PASS |
| mystery-rival-student | quiz-type | `[]` pre-quiz | "Begin Quiz" | N/A (no choices pre-quiz) | Screen renders, Begin Quiz button present | PASS |
| mystery-knowledge-gamble | quiz-type | `[]` pre-quiz | "Begin Quiz" | N/A | Screen renders with rich background | PASS (minor: WebGL image 404) |

**Mystery event notes:**
- All 3 named events (tutors-office, rival-student, knowledge-gamble) are quiz-type with "Begin Quiz" button at initial state
- `getMysteryEventChoices()` correctly returns `[]` for continue-type and quiz-type events at initial state (known behavior per task brief)
- After clicking "Begin Quiz", `getMysteryEventChoices()` populates with answer choices (confirmed for tutors-office: returns `[{index,text}]` correctly)
- The "Continue" button for continue-type events has `data-testid="mystery-continue"` — reliable for automation
- The quiz answer buttons have `data-testid="quiz-answer-0/1/2"` — reliable for automation
- "See Results" → results summary screen shows Q1/Q2/Q3 markers with a final "Continue" button
- Full quiz cycle (Begin Quiz → 3 answers → See Results → Continue) navigates to dungeonMap successfully

---

## Shop Interactions

| Action | Gold Before | Gold After | Result | Status |
|--------|------------|-----------|--------|--------|
| Initial state (shop-loaded) | 1000g | 1000g | Shows 2 relics (97g each), 4 cards (57-73g), services | PASS |
| `shopBuyCard(0)` + confirm "Buy (76g)" | 1000g | 924g | Card purchased, shop still open | PASS |
| `shopBuyRelic(0)` + confirm "Buy (97g)" | 1000g | 903g | Relic purchased | PASS |
| `setGold(1)` → try buy | 1g | 1g | All buy buttons `disabled=true`, no modal opens | PASS |
| Click "←" leave button | 1000g | 1000g | "Leave the shop?" modal appears with "Leave anyway" / "Stay" | PASS |

**Shop notes:**
- `getShopInventory()` returns `{}` (empty object) — this API does NOT return actual inventory. The DOM is the ground truth for shop contents
- `shopBuyCard(n)` opens a purchase modal (does NOT complete the purchase). Must click `[data-testid="shop-btn-buy"]` to confirm
- `shopBuyRelic(n)` same behavior — opens modal, needs DOM click on confirm button
- Modal exposes `[data-testid="shop-btn-buy"]`, `[data-testid="shop-btn-haggle"]`, `[data-testid="shop-btn-cancel"]`
- Haggle option present in modal (30% off if correct), but not tested this run
- Leave button (`[data-testid="btn-leave-shop"]`) shows a confirmation dialog, does NOT immediately leave
- Card prices are randomized per session (Heavy Strike ranged 57-79g across runs)

---

## Rest Site

| Option | Before State | After State | Status |
|--------|-------------|------------|--------|
| Initial view (full HP) | HP 100/100, no deck | All 3 options disabled | PASS |
| Heal (60 HP via loadCustom) | HP 60/100, restRoom | HP 80/100, dungeonMap | PASS |
| `restHeal()` API (60 HP) | HP 60/100 | HP 80/100, dungeonMap | PASS |
| Study (default rest-site deck) | No upgradeable cards | Stays on restRoom, no change | PASS (correct block) |
| `startStudy(3)` with no upgradeable cards | studyDisabled=true | Returns `{}`, stays restRoom | PASS (silent fail, correct) |
| Meditate (default rest-site deck) | 5 cards (≤5) | Stays on restRoom | PASS (correct block) |
| `restMeditate()` with deck too small | deck ≤ 5 cards | Returns `{}`, stays restRoom | PASS (silent fail, correct) |

**Rest site notes:**
- `__rrScenario.setPlayerHp(n)` does NOT work in restRoom — combat-only override. Use `loadCustom({screen:'restRoom', playerHp:n})` instead
- Heal: 20% of max HP. With maxHP=100: heals 20 HP. Capped at max (full HP → Heal disabled)
- Meditate: requires `deck.length > 5` (strictly greater than 5). With 5 cards the button is disabled with message "Deck too small (min 5)"
- Study: requires upgradeable cards in `getActiveDeckCards()`. The `hand` parameter in loadCustom affects combat hand, NOT the activeDeck used for upgrade candidate checking
- `getStudyPoolSize()` is async — returns a Promise when called synchronously. Must be awaited
- All 3 rest options correctly disabled with explanatory reason text in the button label
- Heal navigate: dungeonMap transition occurs immediately after clicking Heal (2s is sufficient wait)

---

## Issues Found

### ISSUE 1 — getShopInventory() returns empty object
**Severity:** Low (cosmetic API issue)  
**Location:** `window.__rrPlay.getShopInventory()`  
**Description:** Returns `{}` regardless of shop contents. The DOM is the ground truth — 2 relics and 4 cards are rendered correctly. The API does not expose shop inventory data.  
**Impact:** Test automation cannot use this API to verify what's in stock.

### ISSUE 2 — knowledge_gamble background image 404
**Severity:** Low (visual asset missing)  
**Location:** `/assets/backgrounds/mystery/knowledge_gamble/landscape_depth.webp`  
**Console error:** `[ParallaxTransition] WebGL init failed: Error: Failed to load image: /assets/backgrounds/mystery/knowledge_gamble/landscape_depth.webp`  
**Description:** The parallax depth layer for the knowledge_gamble event is missing. The background renders fine (static/fallback), but parallax depth effect is absent.

### ISSUE 3 — setPlayerHp() no-ops in restRoom
**Severity:** Low (dev tooling limitation)  
**Location:** `__rrScenario.setPlayerHp(n)` when screen is restRoom  
**Description:** Returns 'hp set to X' but `getRunState().playerHp` stays at 100. Only works during active combat. Use `loadCustom({playerHp:n})` as the workaround.

### ISSUE 4 — startStudy() and restMeditate() silently return {} when disabled
**Severity:** Low (API UX)  
**Location:** `window.__rrPlay.startStudy(n)`, `window.__rrPlay.restMeditate()`  
**Description:** When the rest option is disabled (no upgradeable cards / deck too small), both methods return `{}` with no error message. A test caller has no way to distinguish "called successfully but was blocked" from "API not found". Could return `{ok:false, reason:'studyDisabled'}` instead.

### ISSUE 5 — Container crashes when action file submitted immediately after cold start
**Severity:** Low (test runner reliability)  
**Observed:** First run after `docker-visual-test.sh --warm start` completed crashed with "page.waitForTimeout: Target page, context or browser has been closed". Re-running the same test file succeeded on a second attempt. Issue may be related to Chromium needing a few extra seconds after the container reports ready.  
**Workaround:** Run a simple test (or wait 10s) before submitting the actual test file to a freshly-started container.

---

## Screenshot Artifacts
- mystery-random (Reading Nook): `/tmp/rr-docker-visual/track-11_combat-basic_1776009056910/screenshot.png`
- mystery-tutors-office: `/tmp/rr-docker-visual/track-11_combat-basic_1776009185045/screenshot.png`
- mystery-tutors quiz active: `/tmp/rr-docker-visual/track-11_combat-basic_1776009213316/screenshot.png`
- mystery-rival-student: `/tmp/rr-docker-visual/track-11_combat-basic_1776009282613/screenshot.png`
- mystery-knowledge-gamble: `/tmp/rr-docker-visual/track-11_combat-basic_1776009314575/screenshot.png`
- shop initial: `/tmp/rr-docker-visual/track-11_combat-basic_1776009343100/screenshot.png`
- shop purchase modal: `/tmp/rr-docker-visual/track-11_combat-basic_1776009375464/screenshot.png`
- shop after card buy: `/tmp/rr-docker-visual/track-11_combat-basic_1776009409703/screenshot.png`
- shop insufficient gold: `/tmp/rr-docker-visual/track-11_combat-basic_1776009469436/screenshot.png`
- shop leave dialog: `/tmp/rr-docker-visual/track-11_combat-basic_1776009786366/screenshot.png`
- rest initial: `/tmp/rr-docker-visual/track-11_combat-basic_1776009818707/screenshot.png`
- rest after heal: `/tmp/rr-docker-visual/track-11_combat-basic_1776009938758/screenshot.png`
- tutors quiz complete: `/tmp/rr-docker-visual/track-11_combat-basic_1776010202297/screenshot.png`

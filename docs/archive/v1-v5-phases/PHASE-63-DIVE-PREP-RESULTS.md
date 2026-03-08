# Phase 63: Dive Prep & Results UX

## Tech Stack
- Frontend: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- Dive Prep: `src/ui/components/DivePrepScreen.svelte` -- pickaxe selection (lines 94-122), O2 estimation (lines 47-66), Enter Mine button (lines 389-397)
- Dive Results: `src/ui/components/DiveResults.svelte` -- loot summary, progress display
- Player Save: `playerSave` store with `ownedPickaxes`, `oxygenTanks`, inventory
- Balance: `src/data/balance.ts` -- `OXYGEN_PER_TANK` and other constants
- Game State: `src/ui/stores/gameState.ts` -- `DiveResults` interface with `blocksMined`, `dustCollected`, etc.
- Typecheck: `npm run typecheck` -- 0 errors

## Overview
- **Goal**: Fix six UX issues in the Dive Prep and Dive Results screens identified during playtesting. These range from a critical free-dust exploit to cosmetic label fixes.
- **Dependencies**: None. All changes are isolated to existing UI components and reward logic.
- **Estimated Complexity**: Low-Medium (6 targeted fixes, no new systems)
- **Priority**: HIGH
- **Findings**: C4 (pickaxe auto-select), C5 (free dust exploit), H6 (O2 estimate with 0 tanks), M4 (placeholder icons), M5 (confusing progress text), L1 (tank button labels)

---

## Sub-step 63.1 -- Auto-select pickaxe when only one available

### Problem
When a player owns only the Standard Pick, the "Enter Mine" button shows "Select a Pickaxe" and is disabled, requiring a manual selection tap even though there is no real choice.

### Implementation
- **File**: `src/ui/components/DivePrepScreen.svelte` (lines 94-122)
- In the component's initialization logic (likely an `$effect` or `onMount`), check `ownedPickaxes.length`:
  - If `ownedPickaxes.length === 1`, auto-set `selectedPickaxe` to `ownedPickaxes[0]`
  - If `ownedPickaxes.length > 1`, leave `selectedPickaxe` as `null` (existing behavior -- player must choose)
- Ensure the "Enter Mine" button (line 389-397) is enabled immediately when `selectedPickaxe` is set via auto-select
- The pickaxe dropdown/selector UI should still be visible (showing the auto-selected pickaxe) so the player knows what they are using
- Do NOT hide the selector -- just pre-populate it

### Acceptance Criteria
- [ ] Single-pickaxe players see "Enter Mine" button enabled immediately on Dive Prep without any manual selection
- [ ] Multi-pickaxe players still see the selector and must choose manually (existing behavior unchanged)
- [ ] The auto-selected pickaxe is visually indicated in the selector UI

---

## Sub-step 63.2 -- Fix free dust exploit (0 blocks mined = 0 reward)

### Problem
Entering the mine and immediately surfacing (mining 0 blocks) still grants 10 dust as a minimum reward. This is exploitable for free resources.

### Implementation
- **Files to investigate**: `src/game/GameManager.ts` (search for where `DiveResults` is constructed), and any reward calculation logic that feeds into `DiveResults`
- Search for where `dustCollected` or mineral rewards are assigned. Look for minimum-reward logic or floor values
- **Fix**: Add a guard at the point where dive rewards are calculated:
  ```typescript
  if (blocksMined === 0) {
    // Zero all mineral/dust rewards -- player did not mine
    dustCollected = 0;
    // Zero out any other mineral reward fields
  }
  ```
- This check should happen BEFORE the results are stored or displayed
- Do NOT affect other rewards that are legitimately earned (e.g., quiz XP from pop quizzes, if any triggered)

### Acceptance Criteria
- [ ] Enter mine -> Surface immediately -> Dive Results shows 0 dust, 0 minerals
- [ ] Enter mine -> Mine at least 1 block -> Surface -> Rewards calculated normally (no regression)
- [ ] No other reward types (XP, artifacts found before surfacing) are incorrectly zeroed

---

## Sub-step 63.3 -- Fix O2 estimate with 0 tanks

### Problem
The O2 estimation display shows "Estimated Oxygen: 100 O2" even when the player has 0 oxygen tanks available. This is misleading -- with 0 tanks the player cannot dive (or should see a clear warning).

### Implementation
- **File**: `src/ui/components/DivePrepScreen.svelte` (lines 47-66)
- Find the O2 estimation calculation. It likely reads `selectedTanks` or `oxygenTanks` from the player save and multiplies by `OXYGEN_PER_TANK`
- **Fix**:
  - When `oxygenTanks === 0` (player has no tanks in inventory): show a warning message like "No Oxygen Tanks!" in red/warning styling instead of the O2 number
  - When `selectedTanks === 0` (player deselected all tanks): show "0 O2 -- Select tanks to dive" or similar
  - Consider disabling "Enter Mine" when tanks are 0 with a tooltip/message explaining why
- Check if there is a base O2 value (e.g., 100 base + tanks). If so, ensure the display is accurate -- if base O2 exists by design, show "Base: 100 O2" clearly. If it does NOT exist, fix the calculation to show 0
- Reference `src/data/balance.ts` for `OXYGEN_PER_TANK` constant

### Acceptance Criteria
- [ ] Player with 0 tanks sees "No Oxygen Tanks!" warning or "0 O2" -- never "100 O2"
- [ ] Player with 1+ tanks sees correct O2 estimate (unchanged behavior)
- [ ] "Enter Mine" button behavior is sensible when tanks = 0 (either disabled with explanation, or allowed if base O2 exists by design)

---

## Sub-step 63.4 -- Replace placeholder icons on dive results

### Problem
The Dive Results screen uses "[+]" and "[v]" text placeholders where progress and completion icons should be.

### Implementation
- **File**: `src/ui/components/DiveResults.svelte`
- Search for `[+]` and `[v]` string literals in the template
- **Fix**: Replace with proper visual indicators. Options (in order of preference):
  1. **Inline SVG icons** -- small arrow-up for progress, checkmark for completed:
     ```svelte
     <!-- Progress arrow -->
     <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
       <path d="M8 2l5 6H9v6H7V8H3l5-6z"/>
     </svg>
     <!-- Checkmark -->
     <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
       <path d="M6.5 12.5l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4z"/>
     </svg>
     ```
  2. **Styled Unicode** -- use characters like an upward arrow and checkmark with appropriate font-size and color styling
- Style the icons to match the existing color scheme (e.g., green checkmark for completed, blue/yellow arrow for progress)
- Ensure icons are visible against the dive results background

### Acceptance Criteria
- [ ] No "[+]" or "[v]" text visible anywhere on the Dive Results screen
- [ ] Progress indicators use clear visual icons (arrow or similar)
- [ ] Completion indicators use checkmark icons
- [ ] Icons are appropriately sized and colored for readability

---

## Sub-step 63.5 -- Fix confusing progress text

### Problem
Progress text reads "-20% to next room unlock" -- the minus sign implies the player LOST progress, when it actually means they gained 20%.

### Implementation
- **File**: `src/ui/components/DiveResults.svelte`
- Search for the progress text template. It likely uses a template literal or expression that produces the "-X%" string
- **Fix**: Reword to use positive framing. Acceptable formats:
  - `"20% progress toward next room"` (preferred -- simple and clear)
  - `"20% closer to next room (2/8 dives)"` (if dive count data is available)
  - `"6 more dives to unlock next room"` (countdown framing)
- Ensure the percentage or count is calculated correctly (check the source of the number to understand why it had a minus sign -- it may be a subtraction that should be an addition or abs())
- If the text is dynamically generated, trace the calculation back to its source and fix the sign/wording there

### Acceptance Criteria
- [ ] Progress text uses positive/clear framing (no minus sign, no ambiguity about gaining vs losing progress)
- [ ] The percentage/count shown is accurate
- [ ] Text is grammatically correct for both singular and plural cases (e.g., "1 more dive" vs "6 more dives")

---

## Sub-step 63.6 -- Add labels to O2 tank selector buttons

### Problem
The 3 O2 tank selector buttons on the Dive Prep screen are plain blue rectangles with no text labels. Players cannot tell which button selects how many tanks.

### Implementation
- **File**: `src/ui/components/DivePrepScreen.svelte` (lines 239-258)
- Find the tank selector buttons. They are likely rendered in a loop or as individual elements
- **Fix**: Add visible text content inside each button:
  - Short form: "1", "2", "3" centered in the button
  - Or descriptive: "1 Tank", "2 Tanks", "3 Tanks"
- Style the text to be legible against the button background (white or light text on blue, or adjust as needed)
- If buttons are icon-based (showing tank sprites), add the number as an overlay or label below
- Ensure the selected state is visually distinct (e.g., brighter/highlighted button for current selection)

### Acceptance Criteria
- [ ] Each tank button shows a clear number ("1", "2", "3") or label ("1 Tank", "2 Tanks", "3 Tanks")
- [ ] Labels are legible against the button background
- [ ] Selected button state is visually distinct from unselected buttons
- [ ] Button sizing accommodates the text without overflow

---

## Verification Gate

All items must pass before marking Phase 63 complete:

1. **Typecheck**: `npm run typecheck` -- 0 errors
2. **Build**: `npm run build` -- succeeds with no errors
3. **Unit tests**: `npx vitest run` -- all tests pass (no regressions)
4. **Visual Test -- Auto-select pickaxe**: Navigate to `?skipOnboarding=true&devpreset=post_tutorial` -> Dive Prep screen -> Verify pickaxe is auto-selected and "Enter Mine" is enabled (no manual selection required)
5. **Visual Test -- Free dust exploit**: Enter mine -> Surface immediately -> Dive Results must show 0 dust, 0 minerals
6. **Visual Test -- O2 with 0 tanks**: Navigate with `?skipOnboarding=true&devpreset=empty_inventory` -> Dive Prep -> O2 display shows warning or "0 O2", NOT "100 O2"
7. **Visual Test -- Placeholder icons**: Complete a dive -> Dive Results screen -> No "[+]" or "[v]" text visible; proper icons displayed
8. **Visual Test -- Progress text**: Dive Results -> Progress text uses positive framing (no minus sign)
9. **Visual Test -- Tank labels**: Dive Prep -> Each tank button shows its number clearly

## Playwright Test Script

```javascript
// tests/e2e/phase-63-dive-prep-results.cjs
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];

  page.on('pageerror', (err) => errors.push(err.message));

  // Test 63.1: Auto-select pickaxe
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial');
  await page.waitForTimeout(2000);

  // Navigate to dive prep
  const diveBtn = page.locator('[data-testid="btn-dive"]');
  if (await diveBtn.isVisible()) {
    await diveBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // Check Enter Mine button is enabled (pickaxe auto-selected)
    const enterMineBtn = page.locator('[data-testid="btn-enter-mine"]');
    if (await enterMineBtn.isVisible()) {
      const isDisabled = await enterMineBtn.isDisabled();
      console.log(`63.1 Auto-select: Enter Mine disabled = ${isDisabled} (should be false)`);
    }
  }

  // Test 63.3: O2 with 0 tanks
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=empty_inventory');
  await page.waitForTimeout(2000);
  // Navigate to dive prep and check O2 display
  const content = await page.textContent('body');
  const has100O2 = content.includes('100 O2');
  console.log(`63.3 Zero tanks: Shows "100 O2" = ${has100O2} (should be false)`);

  // Test 63.4: No placeholder icons
  // (requires completing a dive to reach results -- use devpreset if available)
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=dive_results');
  await page.waitForTimeout(2000);
  const resultsContent = await page.textContent('body');
  const hasPlaceholderPlus = resultsContent.includes('[+]');
  const hasPlaceholderCheck = resultsContent.includes('[v]');
  console.log(`63.4 Placeholders: "[+]" = ${hasPlaceholderPlus}, "[v]" = ${hasPlaceholderCheck} (both should be false)`);

  // Test 63.5: No minus sign in progress text
  const hasMinusProgress = /\-\d+%/.test(resultsContent);
  console.log(`63.5 Progress text: Has "-X%" = ${hasMinusProgress} (should be false)`);

  // Check for page errors
  if (errors.length > 0) {
    console.log(`Page errors: ${errors.join(', ')}`);
  }

  await page.screenshot({ path: 'phase-63-verification.png', fullPage: true });
  await browser.close();
  console.log('Phase 63 verification complete.');
})();
```

## Files Affected

- `src/ui/components/DivePrepScreen.svelte` -- Sub-steps 63.1, 63.3, 63.6
- `src/ui/components/DiveResults.svelte` -- Sub-steps 63.4, 63.5
- `src/game/GameManager.ts` (or reward calculation module) -- Sub-step 63.2

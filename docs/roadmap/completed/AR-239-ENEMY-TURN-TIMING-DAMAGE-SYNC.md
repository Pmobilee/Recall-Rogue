# AR-239: Enemy Turn Timing & Damage Sync

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 19, 38
**Complexity:** Medium — animation sequencing, damage calculation audit
**Dependencies:** AR-222 (Turn Flow/Combat Feedback)

---

## Overview

Two enemy turn issues: (1) Player HP decreases immediately when the enemy turn begins, before the attack animation plays — it should decrease in sync with the animation's impact frame. (2) The enemy stated 25 damage but the player only lost 20 — possible block, relic, or calculation bug that needs investigation and a fix or explanation.

---

## User's Exact Words

> "When the enemy attacks, remove HP only when the animation plays, not immediately when the enemy turn starts. The HP should decrease in sync with the attack animation hitting."

> "I had 80 HP, enemy said it would do 25 damage, but I ended up at 60 HP (lost 20, not 25). Check why damage doesn't match the stated intent value."

---

## Sub-Steps

### Step 1 — Defer HP Change Until Animation Impact Frame
**Files:** `src/services/encounterBridge.ts`, `src/ui/components/CardCombatOverlay.svelte`

- Locate where enemy damage is applied to the player's HP during the enemy turn.
- Currently: HP is reduced at turn-start (when damage is calculated). Change to: HP is reduced at the animation's impact point.
- Implementation approach:
  1. Calculate damage as before, but do NOT apply it yet. Store `pendingPlayerDamage`.
  2. Start the enemy attack animation (Phaser tween or sprite animation).
  3. At the animation's impact frame (e.g., at ~60% of animation duration, or on an animation event callback), apply `pendingPlayerDamage` to the player's HP store.
  4. Trigger the damage number spawn at the same moment (see AR-234).
- If the animation uses a Phaser tween, use `onUpdate` with a progress threshold (e.g., `progress >= 0.6`) to detect the impact frame. Use a flag to ensure it only fires once.

**Acceptance:** Player HP bar does not decrease at the start of enemy turn. HP decreases visibly in sync with the attack animation's strike moment. The delay is clearly perceptible (not instant).

---

### Step 2 — Investigate Damage Mismatch (25 stated, 20 dealt)
**Files:** `src/services/encounterBridge.ts`, `src/services/turnManager.ts`

- The enemy intent stated 25 damage. The player lost only 20.
- Possible causes:
  - **Block:** Player had 5 block remaining. Block absorbs damage before HP reduction.
  - **Relic damage reduction:** A relic may be reducing incoming damage.
  - **Calculation order bug:** Damage is calculated before or after modifiers in the wrong order.
  - **Intent display mismatch:** The displayed intent value is the raw damage but the actual applied damage includes modifiers.
- Add a temporary detailed log at the damage application point:
  ```
  console.log('[Damage] raw:', rawDamage, 'block:', playerBlock, 'relicReduction:', relicReduction, 'final:', finalDamage)
  ```
- Determine the root cause. If it's working as intended (block/relic absorbed 5), the damage IS correct and the issue is that the intent display should show "effective damage after block" or show the raw value with a note.
- If it's a calculation bug, fix it.

**Acceptance:** Root cause documented. If working as intended: intent display updated to clarify (e.g., show raw damage + block reduction). If bug: fixed and verified.

---

### Step 3 — Intent Display Clarification (if Needed)
**File:** `src/ui/components/CardCombatOverlay.svelte` or relevant intent display component

- If Step 2 reveals the damage is correct but misleading (intent shows raw, player sees net after block):
  - Consider showing intent as: "25 dmg (you have 5 block)" or showing the effective damage.
  - Or keep it as raw damage (this is standard in Slay the Spire style) and ensure the block display is prominent enough that players can do the math.
- Only implement if Step 2 identifies this as the source of confusion.

**Acceptance:** Player has enough information from the UI to understand why stated damage differs from actual HP lost (if the discrepancy is due to block/relics).

---

### Step 4 — Remove Temporary Logs
**Files:** `src/services/encounterBridge.ts`, `src/services/turnManager.ts`

- Remove all `console.log` statements added during Step 2 investigation.

**Acceptance:** No debug logs in production code. `npm run typecheck` passes.

---

## Files Affected

- `src/services/encounterBridge.ts` — damage application timing, pending damage pattern
- `src/ui/components/CardCombatOverlay.svelte` — HP bar update timing, possible intent display tweak

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Functional: HP bar does not decrease immediately at enemy turn start
- [ ] Functional: HP bar decreases visibly in sync with attack animation impact
- [ ] Functional: Damage mismatch investigated — either bug fixed or UI clarification added
- [ ] No debug console.logs remaining

---

## Visual Testing — MANDATORY

```javascript
await page.evaluate(() => window.__terraScenario.load('combat-basic'));
// Do NOT disable animations — need to observe animation timing
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

For HP sync timing: take screenshots at different points during the enemy turn sequence. Or use `browser_evaluate` to read the HP store value before and after the animation completes. Verify the HP store updates AFTER the animation, not before.

Check console for the damage log (Step 2) to identify the damage discrepancy cause.
Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.

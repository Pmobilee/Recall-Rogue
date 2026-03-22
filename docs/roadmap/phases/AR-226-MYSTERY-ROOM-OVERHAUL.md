# AR-226: Mystery Room Overhaul

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issue #44
> **Priority:** P1 — Broken gameplay feature
> **Complexity:** Medium-Large (fix all events + compound effect system + art generation setup)
> **Dependencies:** None

---

## Overview

All mystery room events appear dead or incomplete — choices don't produce their stated effects (e.g., "15 HP for a possible card" does nothing). The root cause is structural: the effect system only supports a single effect per choice, so multi-effect choices (damage + card, gold + heal) silently drop all but the first effect. Additionally, mystery rooms have no background art. This AR fixes all mystery events via a new compound effect type AND sets up art generation infrastructure.

---

## User's Exact Words

- **#44:** "I'm fairly certain ALL our mystery rooms are either dead or incomplete. For example I clicked 15 hp for a possible card, but lost no hp and got no card. Also mystery rooms have no background, so create an AR asking me to generate them and add a new tab to our artstudio site with ALL possible mystery rooms, their lore, and exactly the style of prompting we used for all the other backgrounds for enemies, but WITHOUT the doorway at the end."

---

## Key Architecture Facts

- **Mystery event definitions live in `src/services/floorManager.ts`** — inline objects with `id`, `name`, `description`, `effect`. There is NO separate `mysteryEvents.ts` or `mysteryRoom.ts`.
- **Mystery room UI:** `src/ui/components/MysteryEventOverlay.svelte` — handles choice rendering and `handleChoiceOption()` dispatch.
- **Background loading:** `src/data/backgroundManifest.ts`
- Effect types currently supported: `choice`, `combat`, `transformCard`, `removeRandomCard`
- Choice option effect types currently supported: `damage`, `currency`, `healPercent`, `maxHpChange`, `upgradeRandomCard`, `freeCard`, `nothing`
- **Critical limitation:** Each choice option supports exactly ONE effect. Multi-effect choices silently execute only the first effect and discard the rest.

---

## Confirmed Broken Events (from code audit)

| Event ID | Stated Behavior | What Actually Happens | Missing |
|---|---|---|---|
| `burning_library` | "Rush in! (lose 15 HP, upgrade a card + gain a card)" | Only `{type: 'damage', amount: 15}` | upgrade card + gain card |
| `knowledge_tax` | "Pay 30 gold (heal 20% HP)" | Only `{type: 'currency', amount: -30}` | heal 20% HP |
| `strict_librarian` | "Return a card (remove + heal 15)" | Only `{type: 'removeRandomCard'}` | heal 15 HP |
| `final_wager` | "50/50: heal 20% + 30g, or lose half HP" | Only `{type: 'healPercent', percent: 20}` | 50/50 randomness + gold reward |
| `merchant_of_memories` | "Trade 8 max HP for a card upgrade" | Only `{type: 'maxHpChange', amount: -8}` | card upgrade |
| `cache_of_contraband` | "Read them (gain card, take 10 dmg)" | Only `{type: 'damage', amount: 10}` | gain card |

---

## Sub-Steps

### 1. Audit All Mystery Room Events

- **What:** Read all mystery event definitions in `src/services/floorManager.ts`. For each event:
  - Document its `id`, stated behavior (from `name`/`description`), and actual effect code
  - Flag every gap between stated behavior and implemented effect
  - Produce a complete audit table (extend the Confirmed Broken Events table above with any additional events found)
- **Acceptance:** Complete audit table of all mystery events with working/broken status. No event is overlooked.

### 2. Add Compound Effect System + Fix All Broken Events

- **What:** The core fix. Add a `compound` effect type that executes multiple effects in sequence, then rewrite all broken event definitions to use it.
- **New compound effect shape:**
  ```ts
  { type: 'compound', effects: [{ type: 'damage', amount: 15 }, { type: 'freeCard' }] }
  ```
- **Where to change:**
  - `src/services/floorManager.ts` — rewrite broken event `effect` definitions to use `compound`
  - `src/ui/components/MysteryEventOverlay.svelte` — update `handleChoiceOption()` to detect `type === 'compound'` and iterate over the `effects` array, applying each in sequence
- **Special case — `final_wager`:** This event requires 50/50 randomness at resolution time (not at definition time). Implement as a new effect type `{type: 'random', outcomes: [...]}` where the resolver picks one outcome array at random when the choice is made.
- **Per-event fixes:**
  - `burning_library` "Rush in!" → `compound`: `[{type: 'damage', amount: 15}, {type: 'upgradeRandomCard'}, {type: 'freeCard'}]`
  - `knowledge_tax` "Pay 30 gold" → `compound`: `[{type: 'currency', amount: -30}, {type: 'healPercent', percent: 20}]`
  - `strict_librarian` "Return a card" → `compound`: `[{type: 'removeRandomCard'}, {type: 'damage', amount: -15}]` (negative damage = heal, or use a dedicated `heal` type)
  - `final_wager` → `random` effect with two outcomes: `[{type: 'healPercent', percent: 20}, {type: 'currency', amount: 30}]` vs `[{type: 'damage', amount: 'halfHp'}]`
  - `merchant_of_memories` → `compound`: `[{type: 'maxHpChange', amount: -8}, {type: 'upgradeRandomCard'}]`
  - `cache_of_contraband` "Read them" → `compound`: `[{type: 'damage', amount: 10}, {type: 'freeCard'}]`
- **Acceptance:** Every mystery room event works as described. Choices produce ALL stated effects, not just the first. HP costs deduct, card rewards given, gold changes apply. Tested via `npx vitest run` AND manual Playwright verification.

### 3. Mystery Room Background Art — Artstudio Integration

- **What:** Set up mystery room background art generation in the artstudio site.
- **Requirements:**
  - Add a new tab to the artstudio site for "Mystery Room Backgrounds"
  - List ALL possible mystery room events (use the complete audit table from Sub-step 1) with:
    - Event name and ID
    - Lore description (what the room represents thematically)
    - Art prompt (same pixel art style as enemy combat backgrounds — atmospheric dungeon interior — but WITHOUT a doorway or exit visible, since mystery rooms are self-contained encounters)
  - Each mystery event gets its own unique background keyed to its `id`
- **Art style:** Match existing combat backgrounds — pixel art, atmospheric, detailed dungeon interiors. No doorway/exit. No UI elements in the art.
- **THIS IS A USER ART TASK** — the agent delivers the artstudio tab with prompts. The user generates the actual images.
- **Acceptance:** Artstudio site has a mystery room tab with all events, lore, and prompts ready for the user to generate. Code infrastructure (Sub-step 4) is ready to load results.

### 4. Mystery Room Background Loading Infrastructure

- **What:** Add code to load and display mystery-specific backgrounds when entering a mystery room.
- **Pattern:** Same as combat backgrounds.
  - Asset path convention: `public/assets/backgrounds/mystery/<eventId>/portrait.webp` and `landscape.webp`
  - Register mystery background entries in `src/data/backgroundManifest.ts`
  - `src/ui/components/MysteryEventOverlay.svelte` loads the correct background by `eventId` when the overlay mounts
- **Fallback:** Generic mystery room background (`public/assets/backgrounds/mystery/default/`) displayed if event-specific art is missing. This allows the system to work before all art is generated.
- **Acceptance:** Mystery rooms display event-specific backgrounds when the asset exists. Falls back to generic background when missing. No errors thrown for missing assets.

---

## Files Affected

- `src/services/floorManager.ts` — mystery event definitions (add compound/random effects, fix all broken events)
- `src/ui/components/MysteryEventOverlay.svelte` — `handleChoiceOption()` compound effect handling
- `src/data/backgroundManifest.ts` — mystery background entries
- Artstudio site — new mystery room tab (separate repo/deployment)

> NOTE: There is NO `src/data/mysteryEvents.ts` and NO `src/services/mysteryRoom.ts`. All mystery event logic is in `src/services/floorManager.ts` and `src/ui/components/MysteryEventOverlay.svelte`.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] Every mystery room event tested: ALL stated effects execute (not just first)
- [ ] `burning_library`: player takes 15 damage, gets a card upgraded, gains a free card
- [ ] `knowledge_tax`: player loses 30 gold AND heals 20% HP
- [ ] `strict_librarian`: random card removed AND player heals 15 HP
- [ ] `final_wager`: 50/50 outcome resolves correctly — win gives heal+gold, lose gives half-HP damage
- [ ] `merchant_of_memories`: player loses 8 max HP AND a card is upgraded
- [ ] `cache_of_contraband`: player takes 10 damage AND gains a free card
- [ ] Compound effect system handles 2+ effects without dropping any
- [ ] Fallback background displays when no event-specific art exists
- [ ] Artstudio site has mystery room tab with all events + lore + prompts
- [ ] Update `docs/GAME_DESIGN.md` section: Mystery Rooms

---

## Visual Testing — MANDATORY

**After ALL sub-steps are implemented, a Sonnet visual-testing worker MUST inspect the result before the AR is considered complete.**

### Procedure

1. Ensure the dev server is running (`npm run dev`)
2. Navigate with Playwright MCP: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
3. Load the relevant scenario: `browser_evaluate(() => window.__terraScenario.load('combat-basic'))` (or the appropriate scenario for this AR)
4. Take screenshot: `browser_evaluate(() => window.__terraScreenshotFile())` — saves to `/tmp/terra-screenshot.jpg`
5. Read the screenshot: `Read('/tmp/terra-screenshot.jpg')` to visually inspect
6. Take DOM snapshot: `mcp__playwright__browser_snapshot` for structural verification
7. Check console: `mcp__playwright__browser_console_messages` for JS errors
8. **If ANY visual issue is found: fix it before reporting done.** Do not tell the user "it should work" — CONFIRM it works.

### What to Verify (per AR)

The visual-testing worker must check every sub-step's acceptance criteria against the actual rendered output. Specific checks:

- Layout positions match the AR's layout diagram (if any)
- No element overlap or clipping
- Text is readable at 1920x1080 landscape
- Colors match the spec (HP bar colors, chain colors, etc.)
- No hardcoded-px visual artifacts (elements too small or too large)
- No console errors or warnings
- Dynamic scaling works (test at 1920x1080 AND 1280x720 if the AR touches layout)

### Resolution

- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser's RAF blocks it permanently
- **NEVER** use `page.screenshot()` via `browser_run_code` — same RAF blocking issue
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` then `Read('/tmp/terra-screenshot.jpg')`
- Use Sonnet workers (`model: "sonnet"`) for visual inspection — equally capable as Opus for screenshot analysis

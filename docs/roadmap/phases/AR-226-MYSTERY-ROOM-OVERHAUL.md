# AR-226: Mystery Room Overhaul

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issue #44
> **Priority:** P1 — Broken gameplay feature
> **Complexity:** Medium-Large (fix all events + art generation setup)
> **Dependencies:** None

---

## Overview

All mystery room events appear to be dead or incomplete — choices don't produce their stated effects (e.g., "15 HP for a possible card" does nothing). Additionally, mystery rooms have no background art. This AR fixes all mystery events AND sets up art generation.

---

## User's Exact Words

- **#44:** "I'm fairly certain ALL our mystery rooms are either dead or incomplete. For example I clicked 15 hp for a possible card, but lost no hp and got no card. Also mystery rooms have no background, so create an AR asking me to generate them and add a new tab to our artstudio site with ALL possible mystery rooms, their lore, and exactly the style of prompting we used for all the other backgrounds for enemies, but WITHOUT the doorway at the end."

---

## Sub-Steps

### 1. Audit All Mystery Room Events
- **What:** Enumerate every mystery room event defined in the code. For each event:
  - Document its intended behavior (choices + outcomes)
  - Test whether it actually works (apply effects, give rewards, etc.)
  - Flag which events are broken/incomplete
- **Acceptance:** Complete audit table of all mystery events with working/broken status.

### 2. Fix All Broken Mystery Room Events
- **What:** For each broken event, fix the underlying code so choices actually produce their stated effects:
  - HP costs are deducted
  - Card rewards are given
  - Gold changes apply
  - Relic rewards work
  - Status effects apply
  - Any other stated outcome actually happens
- **Acceptance:** Every mystery room event works as described. Tested via unit tests AND manual verification.

### 3. Mystery Room Background Art — Artstudio Integration
- **What:** Set up mystery room background art generation in the artstudio site.
- **Requirements:**
  - Add a new tab to the artstudio site for "Mystery Room Backgrounds"
  - List ALL possible mystery room events with:
    - Event name
    - Lore description (what the room represents)
    - Art prompt (same style as enemy combat backgrounds, pixel art dungeon interior, but WITHOUT the doorway at the end)
  - Each mystery event gets its own unique background
- **Art style:** Match existing combat backgrounds — pixel art, atmospheric, detailed dungeon interiors. No doorway/exit visible (mystery rooms are self-contained encounters).
- **This is a USER ART TASK** — the code side sets up the infrastructure to load/display the backgrounds.
- **Acceptance:** Artstudio site has mystery room tab with all events, lore, and prompts. Code infrastructure ready to load backgrounds by event ID.

### 4. Mystery Room Background Loading Infrastructure
- **What:** Add code to load and display mystery-specific backgrounds when entering a mystery room.
- **Pattern:** Same as combat backgrounds — `public/assets/backgrounds/mystery/<eventId>/portrait.webp` and `landscape.webp`.
- **Fallback:** Generic mystery room background if event-specific art is missing.
- **Acceptance:** Mystery rooms display event-specific backgrounds when available, fallback otherwise.

---

## Files Affected

- `src/data/mysteryEvents.ts` or equivalent — event definitions audit
- `src/services/mysteryRoom.ts` or equivalent — event resolution logic fixes
- `src/ui/screens/MysteryRoomScreen.svelte` — background display
- `src/data/backgroundManifest.ts` — mystery background loading
- Artstudio site — new mystery room tab (separate repo/deployment)

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Every mystery room event tested: choices produce stated effects
- [ ] HP costs deducted, rewards given, status effects applied
- [ ] Artstudio site has mystery room tab with all events + lore + prompts
- [ ] Background loading infrastructure works (fallback tested)
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: Mystery Rooms

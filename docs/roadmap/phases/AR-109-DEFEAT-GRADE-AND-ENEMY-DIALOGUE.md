# AR-109: Defeat Screen Grade Badge + Enemy Opening/Ending Statements

## Overview
Two features to add personality and feedback:

1. **Defeat Screen Grade Badge** — A large letter grade (F to A+) displayed in a circle on the RunEndScreen, color-coded and styled with a school/academic font. Grade is based on floor reached relative to MAX_FLOORS (24).

2. **Enemy Opening & Ending Statements** — 30 opening lines and 30 ending lines per conceptual enemy (the knowledge-themed bestiary, not basic creatures like "Ink Slug"). These play when combat begins and when the enemy is defeated.

**Dependencies**: None
**Complexity**: Medium (UI work + content generation via Haiku agents)

---

## Part 1: Defeat Screen Grade Badge

### Grade Scale
Based on `floorReached` (MAX_FLOORS = 24):

| Floor Range | Grade | Color | Description |
|---|---|---|---|
| 0–2 | F | #FF1744 (red) | Barely started |
| 3–4 | D | #FF5722 (deep orange) | Early wipeout |
| 5–6 | D+ | #FF9800 (orange) | Cleared a few encounters |
| 7–9 | C | #FFC107 (amber) | Reached Deep Caverns |
| 10–12 | C+ | #CDDC39 (lime) | Solid run into segment 2 |
| 13–15 | B | #8BC34A (light green) | Reached The Abyss |
| 16–18 | B+ | #4CAF50 (green) | Deep into The Abyss |
| 19–21 | A | #00BCD4 (cyan) | Reached The Archive |
| 22–23 | A+ | #7C4DFF (purple) | Near-victory |
| 24 (victory) | S | #FFD700 (gold) | Perfect clear |

### Sub-step 1.1: Add grade computation to RunEndScreen

**File**: `src/ui/components/RunEndScreen.svelte`

Add a `computeGrade(floor: number, result: string)` function in `<script>` that returns `{ letter: string, color: string }`. If `result === 'victory'`, always return S/gold.

**Acceptance**: Function returns correct grade for all floor values. Unit-testable pure function — extract to a utility if desired.

### Sub-step 1.2: Add grade badge UI (portrait + landscape)

**File**: `src/ui/components/RunEndScreen.svelte`

Insert a grade badge between the header and stats in both portrait and landscape layouts:

```html
<div class="grade-badge" style="--grade-color: {grade.color}">
  <span class="grade-letter">{grade.letter}</span>
</div>
```

CSS for `.grade-badge`:
- 80px circle (scaled by `--layout-scale`)
- Border: 4px solid var(--grade-color)
- Background: rgba(0,0,0,0.6)
- Font: bold, ~40px, academic/serif feel — use `'Georgia', 'Times New Roman', serif`
- Color: var(--grade-color)
- Text shadow for glow: `0 0 12px var(--grade-color)`
- Animate in: scale from 0 → 1 with a bounce (overshoot), delayed 400ms after header
- Add a subtle rotating shimmer/pulse animation on the border

**Acceptance**: Grade badge visible in both portrait and landscape. Correct color and letter for the floor reached. Animates in with satisfying pop. Does NOT appear on retreat (only defeat and victory).

### Sub-step 1.3: Grade-specific header flavor text

Below the grade badge, show a short quip:

| Grade | Flavor Text |
|---|---|
| F | "Back to the books..." |
| D / D+ | "Room for improvement." |
| C / C+ | "Getting there." |
| B / B+ | "Impressive run!" |
| A / A+ | "Scholar material!" |
| S | "Knowledge is power!" |

**Acceptance**: Flavor text appears below grade, fades in after badge animation.

---

## Part 2: Enemy Opening & Ending Statements

### Target Enemies (conceptual/knowledge-themed — NOT basic creatures)

The following enemies get 30 opening + 30 ending statements each. Opening statements play when combat starts (enemy taunt). Ending statements play when the enemy is defeated (death line).

**Statements must be:**
- In-character for the enemy's name/concept
- Witty, clever, often referencing the cognitive bias or academic concept they embody
- Short (1-2 sentences max, ideally under 15 words)
- Mix of menacing, humorous, and thought-provoking tones
- No profanity, kid-friendly

**Concept enemies to write dialogue for (30 enemies):**

1. The Dunning-Kruger
2. The Echo Chamber
3. The Blank Spot
4. The Burnout Phantom
5. The Perfectionist
6. The Hydra Problem
7. The Ivory Tower
8. The Helicopter Parent
9. The Emeritus
10. The Student Debt
11. The Publish-or-Perish
12. The Thesis Djinn
13. The Gut Feeling
14. The Bright Idea
15. The Sacred Text
16. The Devil's Advocate
17. The Institution
18. The Rosetta Slab
19. The Moth of Enlightenment
20. The Hyperlink
21. The Unknown Unknown
22. The Fake News
23. The First Question
24. The Dean
25. The Dissertation
26. The Eureka
27. The Paradigm Shift
28. The Ancient Tongue
29. The Lost Thesis
30. The Singularity

### Sub-step 2.1: Create dialogue data file

**File**: `src/data/enemyDialogue.ts`

```typescript
export interface EnemyDialogue {
  opening: string[]  // 30 lines
  ending: string[]   // 30 lines
}

/** Maps enemy ID → dialogue. Only concept enemies have dialogue. */
export const ENEMY_DIALOGUE: Record<string, EnemyDialogue> = {
  // keyed by enemy id (e.g., 'archive_specter' for The Dunning-Kruger)
}
```

**Acceptance**: File exports correctly-typed map. Each entry has exactly 30 opening and 30 ending strings. All strings are ≤100 characters.

### Sub-step 2.2: Generate dialogue content via Haiku agents

Use 5-6 parallel Haiku agents, each handling 5-6 enemies. Each agent generates 30 opening + 30 ending lines for its assigned enemies.

**Prompt template for agents:**
> Generate 30 opening combat taunts and 30 defeat/ending lines for the enemy "[Name]" in a knowledge-themed roguelike game. The enemy embodies the concept of [concept]. Lines should be witty, in-character, short (under 15 words), kid-friendly, and reference the concept they embody. Mix menacing, humorous, and philosophical tones. Format as TypeScript arrays.

**Acceptance**: All 30 enemies populated. Content is clever and thematic. No duplicates within an enemy.

### Sub-step 2.3: Wire dialogue into combat UI

**Files**: `src/services/encounterBridge.ts`, `src/ui/components/CardCombatOverlay.svelte` or wherever the combat start/end UI lives

- On combat start: if the enemy has dialogue, pick a random `opening` line and display it as a speech bubble or subtitle near the enemy sprite (fade in, hold 2s, fade out)
- On enemy defeat: pick a random `ending` line and display similarly before the victory transition

**Acceptance**: Dialogue appears for concept enemies, does not appear for basic creature enemies. Random selection with no immediate repeats (track last-used index in session).

### Sub-step 2.4: Style the dialogue display

Speech bubble or subtitle bar style:
- Semi-transparent dark background with rounded corners
- Italic text, slightly smaller than combat UI text
- Positioned above/near the enemy sprite area
- Fade in/out animation (300ms)
- Max width constrained so long text wraps gracefully

**Acceptance**: Readable on both portrait and landscape. Doesn't overlap critical UI (HP bars, card hand). Disappears cleanly before gameplay begins.

---

## Files Affected

| File | Change |
|---|---|
| `src/ui/components/RunEndScreen.svelte` | Grade badge UI + computation |
| `src/data/enemyDialogue.ts` | NEW — dialogue data for 30 enemies |
| `src/services/encounterBridge.ts` | Wire dialogue display on combat start/end |
| `src/ui/components/CardCombatOverlay.svelte` | Dialogue bubble rendering |
| `docs/GAME_DESIGN.md` | Document grade system + enemy dialogue |
| `docs/ARCHITECTURE.md` | Document enemyDialogue.ts data file |

---

## Verification Gate

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — success
- [ ] `npx vitest run` — all tests pass
- [ ] Playwright screenshot: defeat screen shows correct grade badge with animation
- [ ] Playwright screenshot: grade colors match table for floors 1, 6, 12, 18, 24
- [ ] Playwright evaluate: enemy dialogue appears on combat start for a concept enemy
- [ ] Playwright evaluate: no dialogue for basic creature enemies (e.g., Ink Slug)
- [ ] Retreat screen does NOT show grade badge
- [ ] Victory screen shows S grade

# UI & Layout Rules

## Target Platform
- PRIMARY: Steam PC at 1920×1080 (landscape 16:9)
- All building, testing, visual inspection defaults to landscape
- Mobile portrait ships AFTER Steam launch

## Dynamic Scaling — MANDATORY

**ZERO hardcoded px values for layout, sizing, spacing, or fonts.**

### CSS Variable System
- Layout values (padding, margin, gap, width, height, border-width): `calc(Npx * var(--layout-scale, 1))`
- Font sizes: `calc(Npx * var(--text-scale, 1))`
- Both default to 1, set dynamically by `CardApp.svelte` based on viewport

### Examples
- `padding: 12px` → WRONG — use `padding: calc(12px * var(--layout-scale, 1))`
- `font-size: 14px` → WRONG — use `font-size: calc(14px * var(--text-scale, 1))`
- Values using `%`, `vw`, `vh`, `rem`, `clamp()`, or `var()` are fine

### Exceptions (OK to hardcode)
- `border-radius: 50%` (percentages)
- `opacity`, `z-index`, `flex` values (unitless)
- `0` values
- `1px` borders
- `inset: 0`
- Phaser/canvas pixel coordinates

### Enforcement
- Every sub-agent on UI/CSS MUST be told this rule
- Violations = bugs with same priority as broken tests

## Documentation
Any layout change (new scaling props, repositioned elements, new CSS variables) MUST be documented in `docs/ui/` in the same commit as the code change.

## Layer Architecture
- Svelte owns overlay layer (card hand, quiz, HUD, shop, rewards)
- Phaser owns canvas layer (sprites, VFX, backgrounds)
- Communicate through services (turnManager, gameFlowController) — never direct calls

## Minimum Tap Target
- 44×44px equivalent (iOS HIG) for all interactive elements

## Dev-only UI Gating — MANDATORY

**Dev buttons, debug overlays, and internal testing UI MUST be gated on a dedicated dev flag. NEVER gate on `devpreset` or `botMode`.**

### Rule
- `devpreset` is a **playtest entry point** — it is player-accessible. Testers and LLM agents use it. It must NEVER show developer tools.
- `botMode` is an automation flag — same restriction.
- Dev tools must be gated only on `?dev=true` URL param OR `VITE_DEV_TOOLS=1` env var.

### Implementation
- Import `devMode` from `src/ui/stores/devMode.ts`
- Wrap dev-only DOM elements: `{#if $devMode}<div data-dev-only="true">...</div>{/if}`
- The `data-dev-only="true"` attribute enables assertion-based tests to verify absence

### Store
`src/ui/stores/devMode.ts` — readable store that returns `true` only when:
- URL param `?dev=true` is present, OR
- Env var `VITE_DEV_TOOLS=1` (or `VITE_DEV_TOOLS=true`) is set at build time

### What broke (2026-04-10)
HubScreen rendered dev buttons (Intro, BrightIdea, InkSlug, RunEnd) with NO visibility guard. Any `?devpreset=post_tutorial` URL — used by every LLM playtest tester — showed dev buttons. Fixed by HIGH-7.

## Softlock Prevention — MANDATORY

**Every screen MUST render a dismiss / back control in ALL states (loading, error, empty, success). Never allow a state where the player cannot escape without reloading.**

### Rule
- If a screen or overlay renders data from a pool (questions, cards, items), it MUST guard against the zero-pool case
- The zero-pool guard must show:
  1. A human-readable empty-state message explaining why there is nothing to show
  2. A back/return button that navigates the player out (to hub or previous screen)
- The back button MUST be rendered even during loading and error states

### Implementation pattern
```svelte
{#if questions.length === 0}
  <!-- Empty state — always provides an escape -->
  <div data-testid="study-empty-state">
    <p>No cards available. Start a run and visit a rest room.</p>
    <button data-testid="study-back-btn" onclick={handleBack}>Return to Hub</button>
  </div>
{:else if !done}
  <!-- Always-visible back button even during active state -->
  <button data-testid="study-back-btn" onclick={handleBack}>Back</button>
  <!-- ... quiz content ... -->
{/if}
```

### Test IDs contract
- `data-testid="study-empty-state"` — present when questions=[]
- `data-testid="study-back-btn"` — present in BOTH empty state AND active state

### Lint enforcement
`scripts/lint/check-escape-hatches.mjs` — fails the build when a component renders a count-of-total display (e.g., "Question N / M") without an escape hatch. Run via `npm run check`.

### What broke (2026-04-10)
`__rrPlay.startStudy()` navigated directly to `restStudy` without populating `studyQuestions`. `StudyQuizOverlay` received `questions=[]` and rendered "Question 1 / 0" with no way to escape. Fixed by HIGH-8.

## Svelte MCP
- Before writing any `.svelte` component: call `mcp__svelte__list-sections`
- When using runes (`$state`, `$derived`, `$effect`, `$props`): fetch relevant section first
- When hitting a Svelte error: check MCP before guessing

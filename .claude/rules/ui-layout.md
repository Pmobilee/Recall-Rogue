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

## Svelte MCP
- Before writing any `.svelte` component: call `mcp__svelte__list-sections`
- When using runes (`$state`, `$derived`, `$effect`, `$props`): fetch relevant section first
- When hitting a Svelte error: check MCP before guessing

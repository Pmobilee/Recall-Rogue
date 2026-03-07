# Testing Guide

This guide maps the current test layers and the exact commands used in this repository.

## Test layers

| Layer | Tools | Location |
| --- | --- | --- |
| Unit/integration | Vitest + happy-dom | `tests/unit/`, `tests/dev/`, selected `src/**/*.test.ts` |
| Scripted E2E diagnostics | Playwright (Node scripts) | `tests/e2e/*.cjs` |
| Playwright test runner | `@playwright/test` | `tests/e2e/playwright/*.spec.ts` |

## Core commands

| Command | Purpose |
| --- | --- |
| `npx vitest run` | Run all unit tests once |
| `npm run test:coverage` | Coverage output (text/lcov/html) |
| `node tests/e2e/01-app-loads.cjs` | Baseline app-load verification with diagnostics |
| `node tests/e2e/02-mine-quiz-flow.cjs` | Mine to quiz flow check |
| `node tests/e2e/03-save-resume.cjs` | Save/resume flow check |
| `npx playwright test` | Playwright runner suite |

## Baseline verification workflow

Recommended after gameplay or state-management changes:

1. `npm run typecheck`
2. `npx vitest run`
3. `node tests/e2e/01-app-loads.cjs`
4. Run targeted E2E scripts affected by your change (`02`, `03`)

## E2E diagnostics details

The script-based E2E tests collect more than screenshots:

- console errors
- page errors
- runtime state checks
- output artifacts under `tests/fixtures/saves/screenshots/` and test output dirs

Shared helper:

- `tests/e2e/lib/diagnostics.cjs`

## Playwright runner config

From `playwright.config.ts`:

- `testDir`: `tests/e2e/playwright`
- `baseURL`: `http://localhost:5173`
- viewport: `390x844`
- screenshot mode: `only-on-failure`

## Common selectors

Frequently used `data-testid` selectors in E2E flows:

- `btn-dive`
- `btn-enter-mine`
- `btn-surface`
- `quiz-answer-0` .. `quiz-answer-3`
- `btn-age-adult`
- `hud-o2-bar`

## Runtime debug hooks (dev)

- `window.__terraDebug()` for current screen/scene/input diagnostics
- `window.__terraLog` ring buffer for recent app events

These are initialized via `src/dev/debugBridge.ts` in dev mode.

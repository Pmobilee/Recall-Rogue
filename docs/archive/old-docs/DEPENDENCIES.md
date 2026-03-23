# Dependency Inventory

Dependency inventory is derived from `package.json` and `server/package.json`.

## Frontend/runtime dependencies (`package.json`)

| Package | Role |
| --- | --- |
| `phaser` | Canvas game engine and scene lifecycle |
| `sql.js` | Browser SQLite runtime for `facts.db` |
| `@capacitor/core` | Capacitor bridge for native platforms |
| `@capacitor/android` | Android runtime package |
| `@capacitor/ios` | iOS runtime package |
| `@capacitor/cli` | Capacitor CLI tooling |
| `@capacitor/splash-screen` | Native splash control |
| `@capacitor/status-bar` | Native status bar control |

## Frontend dev/test dependencies (selected)

| Package | Role |
| --- | --- |
| `vite`, `@sveltejs/vite-plugin-svelte` | Build/dev server |
| `svelte`, `svelte-check`, `typescript` | UI framework and typecheck |
| `vitest`, `@vitest/coverage-v8`, `happy-dom` | Unit testing and coverage |
| `@playwright/test`, `playwright-core` | Browser E2E testing |
| `sharp` | Asset processing scripts |
| `dotenv` | Local environment loading for scripts |

## Backend dependencies (`server/package.json`)

| Package | Role |
| --- | --- |
| `fastify` | HTTP framework |
| `@fastify/cors`, `@fastify/jwt`, `@fastify/static`, `@fastify/websocket` | Core server plugins |
| `drizzle-orm`, `drizzle-kit` | Data access and schema tooling |
| `better-sqlite3` | Local/content DB access |
| `@anthropic-ai/sdk` | LLM-backed content pipeline tasks |
| `sharp` | Image pipeline processing |
| `dotenv` | Server env loading |

## Dependency footprint snapshots

From `npm audit --json`:

- Frontend workspace (`/root/terra-miner`): 357 total dependencies.
- Server workspace (`/root/terra-miner/server`): 411 total dependencies.

See `docs/SECURITY-AUDIT-RESULTS.md` for vulnerability details and upgrade recommendations.

## Package management notes

- Lockfiles are present (`package-lock.json` in root and server).
- Build scripts regenerate artifacts (`spriteKeys.ts`, facts DB) before bundling.
- Keep dependency additions minimal and aligned with existing stack (Svelte/Phaser/Vite/Fastify).

# Configuration Reference

This file documents the active configuration surfaces in the app and server.

## Build/runtime config files

| File | Scope | Notes |
| --- | --- | --- |
| `vite.config.ts` | Frontend build/dev | CSP meta injection, chunking strategy, CDN base URL, dev server host/HMR |
| `vitest.config.ts` | Frontend tests | happy-dom env, coverage thresholds/includes |
| `playwright.config.ts` | Playwright runner | baseURL, mobile viewport, Chrome executable path |
| `tsconfig.app.json` | App TS | strict app typecheck for `.ts` and `.svelte` |
| `tsconfig.node.json` | Node TS | strict checks for node-side config/scripts |
| `capacitor.config.ts` | Mobile shell | app id/name, splash/status bar, Android scheme |
| `wrangler.toml` | Web deploy target | Cloudflare site bucket is `./dist` |
| `server/src/config.ts` | Server runtime | validated env parsing, production guardrails |

## Frontend environment variables

Defined in `.env.example` and consumed by scripts/services:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `src/services/socialService.ts`, `src/services/duelService.ts` | Backend API base for social/duel calls |
| `VITE_ASSET_BASE_URL` | `src/game/spriteManifest.ts`, `vite.config.ts` | CDN/base path for runtime asset URLs |
| `VITE_COMFYUI_API_URL` | Sprite generation workflows | Local ComfyUI endpoint |
| `VITE_APP_ENV` | Build/runtime env marker | Environment labeling |
| `OPENROUTER_API_KEY` | Content/sprite generation tooling | External AI API key (never commit real key) |
| `OPENROUTER_MODEL` | Generation tooling | Model identifier |
| `OPENROUTER_BASE_URL` | Generation tooling | API root URL |

## Server environment variables

Primary list is in `server/.env.example`; parsing/validation is in `server/src/config.ts`.

Key groups:

- Core: `PORT`, `NODE_ENV`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN`, `ADMIN_API_KEY`
- Content pipeline: `ANTHROPIC_API_KEY`, `COMFYUI_URL`, `DISTRACTOR_CONFIDENCE_THRESHOLD`
- Monetization and webhooks: `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`
- Email: `RESEND_API_KEY`, `FROM_EMAIL`, `PASSWORD_RESET_BASE_URL`, `EMAIL_UNSUBSCRIBE_BASE_URL`
- Notifications/TTS: `FCM_*`, `AZURE_SPEECH_*`
- Rate limits/admin dashboard: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

## LocalStorage keys (active)

### Save/profile

| Key pattern | Owner | Notes |
| --- | --- | --- |
| `terra_profiles` | `profileService` | Profile list and active profile id |
| `terra_save_<profileId>` | `saveService` via `profileService` | Per-profile full save payload |
| `terra_save` | `profileService` fallback | Legacy/no-profile save key |
| `terra_miner_dive_save` | `SaveManager` | Mid-dive checkpoint state |

### Auth/sync and settings (examples)

| Key | File | Purpose |
| --- | --- | --- |
| `terra_auth_token`, `terra_refresh_token` | `src/services/apiClient.ts` | Access/refresh tokens |
| `terra_guest_mode` | `src/App.svelte`, `src/ui/stores/authStore.ts` | Guest auth mode toggle |
| `terra-miner-sprite-resolution` | `src/ui/stores/settings.ts` | Sprite resolution (`low`/`high`) |
| `gaia-mood`, `gaia-chattiness` | `src/ui/stores/settings.ts` | GAIA personality settings |
| `setting_*` keys | `src/ui/stores/settings.ts` | Audio/accessibility/analytics flags |
| `terra_parental_v1` | `src/ui/stores/parentalStore.ts` | Parental settings (PIN hash, limits, toggles) |
| `tg_classroom_state` | `src/ui/stores/classroomStore.ts` | Classroom membership cache |

## Runtime feature toggles and URL flags

### Dev URL flags (frontend)

- `skipOnboarding=true`: bypass onboarding/profile gating in dev paths.
- `devpreset=<preset_id>`: load scenario preset from `src/dev/presets.ts`.
- `action=dive|study`: deep-link shortcut handling in `src/main.ts`.

### Build-time behavior switches

- `ANALYZE=true npm run build`: enables visualizer attempt in `vite.config.ts`.
- `import.meta.env.DEV`: drives debug bridge, SW unregister behavior, and dev bypass code.

## CSP and security-sensitive config

- CSP meta is injected by Vite plugin in `vite.config.ts`.
- Dev CSP allows `unsafe-eval`/`unsafe-inline` for HMR and Phaser internals.
- Prod CSP is strict (`script-src 'self'`) with restricted `connect-src`.

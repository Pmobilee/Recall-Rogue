# Deployment Guide

Deployment paths currently used in this repository.

## 1) Web frontend (Cloudflare Pages)

Scripts in root `package.json`:

- Preview deploy:
  - `npm run deploy:preview`
- Production deploy:
  - `npm run deploy:production`

Both scripts run a fresh build before deploy.

Related config:

- `wrangler.toml`
- `vite.config.ts` (`base` can be overridden by `VITE_ASSET_BASE_URL`)

## 2) Backend API (`server/`)

### Local/VM process mode

```bash
cd server
npm install
npm run build
npm run start
```

### Docker Compose mode

- File: `server/docker-compose.yml`
- Default container port mapping: `3001:3001`
- Uses `server/.env.example` variables (override in real env)

Start:

```bash
cd server
docker compose up -d --build
```

## 3) Mobile packaging (Capacitor)

- Config: `capacitor.config.ts`
- Web assets source: `dist/`

Typical sequence:

1. `npm run build`
2. `npx cap sync`
3. Open native project:
   - `npx cap open android`
   - `npx cap open ios`

## Pre-deploy checklist

Run before any release:

1. `npm run typecheck`
2. `npx vitest run`
3. `node tests/e2e/01-app-loads.cjs`
4. `npm run build`
5. Confirm no secret files are staged (`.env`, private keys, credentials)

## Environment and secrets

- Frontend sample vars: `.env.example`
- Backend sample vars: `server/.env.example`
- Production secrets should come from environment/secret manager, not committed files.

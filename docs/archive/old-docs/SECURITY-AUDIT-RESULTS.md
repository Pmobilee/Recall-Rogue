# Security Audit Results

This report combines dependency audit output and a targeted code review.

## Commands executed

- `npm audit --json` in `/root/terra-miner`
- `npm audit --json` in `/root/terra-miner/server`

## Dependency vulnerability summary

### Frontend workspace (`/root/terra-miner`)

- Total: 8
- Critical: 1
- High: 1
- Moderate: 6

Notable packages:

- `happy-dom` (critical) - advisory range `<20.0.0`
- `tar` (high) - advisory range `<=7.5.9`
- `vitest`/`vite-node`/`@vitest/mocker` chain (moderate)

### Server workspace (`/root/terra-miner/server`)

- Total: 9
- Critical: 0
- High: 0
- Moderate: 9

Notable packages:

- `fastify` (moderate advisory for malformed content-type validation)
- `drizzle-kit` transitive `esbuild` chain (moderate)
- `vitest` transitive chain (moderate)

## Code-level findings

| Severity | Finding | Reference |
| --- | --- | --- |
| medium | Auth and refresh tokens are persisted in localStorage; this increases impact if XSS occurs. Migration to httpOnly cookies is noted but not complete. | `src/services/apiClient.ts:20`, `src/services/apiClient.ts:21`, `src/services/apiClient.ts:540`, `src/services/apiClient.ts:563` |
| medium | Basic-auth fallback credentials (`admin`/`changeme`) are accepted when env vars are missing. This is risky for misconfigured deployments. | `server/src/index.ts:160`, `server/src/index.ts:161`, `server/src/index.ts:162` |
| low | Dev server is bound to `0.0.0.0` with `allowedHosts: 'all'`; intended for device testing but broadens exposure if used on untrusted networks. | `vite.config.ts:97`, `vite.config.ts:100` |

## Positive controls observed

- Production config validates critical env vars and JWT length before server start (`server/src/config.ts:183`).
- CSP is stricter in production build mode (`vite.config.ts:24`).
- No direct use of `eval()`/`Function()` detected in app source modules reviewed.

## Recommended remediation order

1. Upgrade vulnerable dependencies in both workspaces, prioritizing `happy-dom` and `tar` paths.
2. Complete token storage migration to secure httpOnly cookies.
3. Remove default admin credential fallback for production paths (fail closed).
4. Keep dev-server broad host settings restricted to local trusted networks.

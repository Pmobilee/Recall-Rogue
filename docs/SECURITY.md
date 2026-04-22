# Security Policies — Recall Rogue

Security-first development practices for a mobile game handling user data and quiz content.

## Principles
1. **Defense in depth**: Multiple layers of protection, never rely on a single control
2. **Least privilege**: Components only access what they need
3. **Secure defaults**: Safe configuration out of the box
4. **Input is hostile**: All external input is validated and sanitized

## Content Security Policy (CSP)
Defined in `index.html` meta tag:
- `default-src 'self'` — Only load resources from same origin
- `script-src 'self'` — No inline scripts, no eval
- `style-src 'self' 'unsafe-inline'` — Svelte requires inline styles
- `img-src 'self' data: blob:` — Allow data URIs for generated sprites
- `connect-src 'self' localhost:*` — API and ComfyUI connections (dev only)
- `object-src 'none'` — No plugins (Flash, Java, etc.)

**Production CSP** must replace localhost with actual API domain.

## Code Practices
- **No `eval()` or `new Function()`** — enforced by CSP and code review
- **No `innerHTML` with dynamic content** — use `textContent` or Svelte's built-in escaping
- **No `document.write()`** — ever
- **TypeScript strict mode** — catches null/undefined errors at compile time
- **Input validation** — all quiz answers validated against expected format
- **Output encoding** — all user-generated content escaped before rendering

## Dependency Management
- Run `npm audit` before every release
- Pin major versions in package.json
- Review changelogs before updating dependencies
- Prefer packages with small dependency trees
- Never install packages with known vulnerabilities

## Secrets Management
- **`.env` files** are gitignored — NEVER commit them
- **`.env.example`** documents required variables without values
- **API keys** stored in environment variables, never in code
- **Build-time variables** prefixed with `VITE_` (Vite convention)

## Data Protection

### SQLite Database Obfuscation

Both `facts.db` (trivia) and `curated.db` (curated decks) are XOR-obfuscated in production builds.

- **Mechanism:** `scripts/obfuscate-db.mjs` XOR-encodes each byte using a rolling key derived from `__RR_VERSION__` (injected by Vite at build time).
- **Scope:** Applied to `dist/` files only — after Vite copies `public/` into `dist/`. Do NOT run against `public/` originals.
- **Runtime decoding:** `src/services/dbDecoder.ts` decodes the buffer in-memory before passing it to sql.js. No decoded file is ever written to disk.
- **Strength:** This is obfuscation, not encryption. It deters casual extraction with `sqlite3` but does not prevent a determined reverse-engineer. It is appropriate for protecting quiz question spoilers, not cryptographic secrets.

### No Developer Artifacts in Production

The following files were removed from `public/` and will not appear in shipped builds:
- `recall-rogue-agent-kit.zip` — AI agent kit zip
- `sprite-review.html` — internal sprite review tool
- `test-damage-number.html` — damage number test page
- `seed-pack.json` — moved to `data/` (not served at runtime)

All dev-only tooling (`__rrScenario`, `__rrDebug`, artstudio server) is conditionally compiled or excluded from production builds via Vite's `import.meta.env.DEV` guards.

### File I/O Path Traversal Prevention

The Rust file I/O commands in `src-tauri/src/filesave.rs` (`fs_write_save`, `fs_read_save`, `fs_delete_save`) reject any filename containing:
- `..` (directory traversal)
- `/` or `\` (directory separators)
- Any character outside `[a-zA-Z0-9_\-.]`

This prevents a compromised frontend from writing to arbitrary paths on the user's filesystem.

## Data Security (Planned)
- JWT tokens with short expiry + refresh rotation
- Passwords hashed with bcrypt (cost factor 12+)
- Database queries use parameterized statements (Drizzle ORM)
- Rate limiting on API endpoints
- CORS restricted to known origins

## Capacitor/Mobile Security (When Added)
- WebView restricted to app origin
- Certificate pinning for API communication
- Secure storage for tokens (Capacitor Secure Storage plugin)
- No JavaScript injection from external sources

## Steam Build Verification — Operational Checklist

Before tagging a Steam release or pushing to a public depot, run the following checklist. **Skipping any step has shipped a stale exe more than once** (see `~/.claude-muldamion/projects/-Users-damion-CODE-Recall-Rogue/memory/feedback_never-push-identical-builds.md`).

### Pre-upload bundle audit

1. **Verify build freshness.** Check `git log --oneline -1 -- src/ src-tauri/` against the timestamp on `steam/windows-build/recall-rogue.exe`. If the exe is older than the most recent source commit, **do not upload** — rebuild via `npm run steam:build` first.
2. **Grep bundled JS for known fix markers.** After every wave of multiplayer fixes, identify a literal string changed by the fix and grep the packaged `dist/assets/*.js` (or the embedded resources inside the exe via `strings`) for that marker. Example for BUG 27 (commit `61a60edd9`): grep for the corrected gameScreens entry. If the marker is absent, the bundled JS is stale.
3. **Verify icon.** `src-tauri/icons/Library Logo.ico` must exist and match the canonical marketing capsule (see `~/.claude-muldamion/projects/-Users-damion-CODE-Recall-Rogue/memory/reference_build-icon.md`). Missing or stale icon ships the placeholder Tauri icon to players.
4. **Confirm `steam_appid.txt` in bundle.** macOS: `Contents/MacOS/steam_appid.txt` must exist (`steam-build.sh` copies it). Windows: must sit next to the exe. Without it, Steamworks `Init` fails silently.
5. **Verify Steam Launch Options field has no trailing whitespace.** See `reference_steam-launch-option-whitespace.md`. Steam silently appends invisible whitespace to the Executable field if you copy-paste with a trailing space, which makes the launcher report "missing game executable" at the *correct* path.
6. **Wall-clock the upload.** A successful steamcmd app_build upload runs >120s and reports MB uploaded. A sub-30s "success" with 0 MB uploaded means steamcmd reused a stale build cache — re-run after clearing `steamcmd_logs/` and the depot manifest.
7. **Never pkill the Steam client.** Only the user may quit Steam. Force-killing corrupts the shared steamcmd credential cache. See `feedback_never-kill-steam-client.md`.

### Post-upload smoke test

1. Install via Steam client (not direct `.exe` launch — must verify Steam wrapper).
2. Sign in with a second Steam account on a second machine; create a lobby on one, join via code on the other; verify both reach the in-game state. This covers the multiplayer wiring that no headless test currently exercises (see MP-STEAM-20260422-051 — `steam-p2p-playtest` skill not yet built).
3. Snapshot `window.__rrMpDebug()` from the dev console (open via `Cmd+Shift+D` / `Ctrl+Shift+D` chord — BUG9 fix). Confirm `transport.state === 'connected'` on both clients.
4. If anything is off, **do not blame the code first** — verify the bundled JS contains the fix marker (step 2 above). Stale-bundle false alarms have eaten multiple debug sessions.

### Why this is in SECURITY.md

A stale Steam build is a security-adjacent failure: players run code older than the latest security/CSP/IPC fixes without knowing it. Build-freshness verification is part of the supply-chain integrity contract.

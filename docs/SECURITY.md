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

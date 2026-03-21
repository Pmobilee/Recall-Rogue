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

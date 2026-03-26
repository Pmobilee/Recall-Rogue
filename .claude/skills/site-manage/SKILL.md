---
name: site-manage
description: "Manage the recallrogue.com website — deploy, check status, query subscribers, edit landing page/worker, and view logs. Operates on the recall_rogue_site repo from this workspace."
user_invocable: true
---

# Site Manage — recallrogue.com

Manage the Recall Rogue website (Cloudflare Workers + Pages) from this repository. All commands operate on the **recall_rogue_site** repo at `/Users/damion/CODE/recall_rogue_site/`.

## Arguments

Parse the user's message for a subcommand:

| Subcommand | Description |
|---|---|
| `deploy` | Deploy site to Cloudflare (preview or production) |
| `deploy preview` | Deploy to preview URL (non-production) |
| `deploy production` | Deploy to recallrogue.com (asks confirmation first) |
| `status` | Check site health + subscriber count |
| `subscribers` | Query subscriber data from D1 |
| `subscribers count` | Just the count |
| `subscribers list` | List all active subscribers |
| `subscribers recent [N]` | Show N most recent signups (default 10) |
| `logs` | Tail recent Cloudflare Worker logs |
| `edit landing` | Open and edit public/index.html |
| `edit worker` | Open and edit src/worker.js |
| `diff` | Show uncommitted changes in the site repo |

If no subcommand is given, default to `status`.

## Constants

```
SITE_REPO=/Users/damion/CODE/recall_rogue_site
SITE_URL=https://recallrogue.com
WRANGLER=npx wrangler
DB_NAME=recall-rogue-db
```

## Cloudflare MCP Integration

The `mcp__cloudflare__*` MCP tools provide direct API access to Cloudflare without shelling out to wrangler. **Use MCP tools when available; fall back to wrangler CLI for operations not yet supported.**

| Operation | Prefer | Fallback |
|---|---|---|
| Query D1 (subscribers) | `mcp__cloudflare__execute` (D1 query API) | `npx wrangler d1 execute` |
| Check worker status | `mcp__cloudflare__execute` (Workers API) | `curl` |
| View DNS records | `mcp__cloudflare__execute` (DNS API) | `npx wrangler` |
| Deploy worker | `npx wrangler deploy` (still preferred) | — |
| Tail logs | `npx wrangler tail` (streaming not supported via MCP) | — |
| Read KV/R2 | `mcp__cloudflare__execute` | `npx wrangler` |

**Discovery pattern:** When unsure of the API, use `mcp__cloudflare__search("D1 query database")` to find the right endpoint, then `mcp__cloudflare__execute` to call it.

## Steps by Subcommand

### `status`

1. Check the site is live:
   ```bash
   curl -s -o /dev/null -w '%{http_code}' https://recallrogue.com
   ```
   Alternative: Use `mcp__cloudflare__execute` to check worker status via API if wrangler is unavailable.

2. Query subscriber count from D1:
   ```bash
   cd /Users/damion/CODE/recall_rogue_site && npx wrangler d1 execute recall-rogue-db --remote --command="SELECT COUNT(*) as total, SUM(CASE WHEN unsubscribed_at IS NULL THEN 1 ELSE 0 END) as active FROM subscribers;"
   ```

3. Check for uncommitted changes in the site repo:
   ```bash
   cd /Users/damion/CODE/recall_rogue_site && git status --short
   ```

4. Show last deploy info:
   ```bash
   cd /Users/damion/CODE/recall_rogue_site && git log --oneline -3
   ```

5. Report: HTTP status, active/total subscribers, repo state, last commits.

### `deploy`

**Preview:**
```bash
cd /Users/damion/CODE/recall_rogue_site && npx wrangler deploy --dry-run
```
Then:
```bash
cd /Users/damion/CODE/recall_rogue_site && npx wrangler deploy
```

**Production (custom domain):**
1. Show diff of what will be deployed:
   ```bash
   cd /Users/damion/CODE/recall_rogue_site && git diff HEAD
   ```
2. **ASK THE USER FOR CONFIRMATION** — this is a production deploy to recallrogue.com
3. If confirmed:
   ```bash
   cd /Users/damion/CODE/recall_rogue_site && npx wrangler deploy
   ```
4. Verify after deploy:
   ```bash
   curl -s -o /dev/null -w '%{http_code}' https://recallrogue.com
   ```
5. Report success/failure with the URL.

### `subscribers`

**Prefer Cloudflare MCP:** For subscriber queries, `mcp__cloudflare__execute` can query D1 directly via the API without requiring a shell in the site repo directory.

All queries use remote D1:

**count:**
```bash
cd /Users/damion/CODE/recall_rogue_site && npx wrangler d1 execute recall-rogue-db --remote --command="SELECT COUNT(*) as total, SUM(CASE WHEN unsubscribed_at IS NULL THEN 1 ELSE 0 END) as active, SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as unsubscribed FROM subscribers;"
```

**list:**
```bash
cd /Users/damion/CODE/recall_rogue_site && npx wrangler d1 execute recall-rogue-db --remote --command="SELECT email, subscribed_at FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY subscribed_at DESC;"
```

**recent [N]:**
```bash
cd /Users/damion/CODE/recall_rogue_site && npx wrangler d1 execute recall-rogue-db --remote --command="SELECT email, subscribed_at FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY subscribed_at DESC LIMIT ${N:-10};"
```

### `logs`

**Note:** Log tailing requires streaming, which the MCP doesn't support. Continue using `npx wrangler tail` for this.

Tail live worker logs:
```bash
cd /Users/damion/CODE/recall_rogue_site && npx wrangler tail --format=pretty
```

Note: This is a streaming command. Run it in background or with a timeout. For a quick check, use:
```bash
cd /Users/damion/CODE/recall_rogue_site && timeout 10 npx wrangler tail --format=json 2>&1 | head -50
```

### `edit landing` / `edit worker`

1. Read the target file:
   - Landing: `/Users/damion/CODE/recall_rogue_site/public/index.html`
   - Worker: `/Users/damion/CODE/recall_rogue_site/src/worker.js`

2. Delegate the edit to a Sonnet sub-agent with:
   - The full file contents
   - The user's requested changes
   - Instruction to preserve the existing style/tone (dark theme, gold/purple palette, witty copy)

3. After edit, show the diff:
   ```bash
   cd /Users/damion/CODE/recall_rogue_site && git diff
   ```

4. Ask user if they want to deploy the changes.

### `diff`

```bash
cd /Users/damion/CODE/recall_rogue_site && git status && git diff
```

## Key Files in recall_rogue_site

| File | Purpose |
|---|---|
| `wrangler.toml` | Cloudflare Workers config, D1 binding, custom domain |
| `src/worker.js` | API routes: /api/subscribe, /api/unsubscribe, static fallback |
| `public/index.html` | Landing page (dark theme, email signup, feature sections) |
| `schema.sql` | D1 database schema (subscribers table) |
| `.env` | Cloudflare API token (DO NOT commit or display) |

## Security

- **NEVER** display or log the Cloudflare API token from `.env`
- **NEVER** display subscriber emails in full unless the user explicitly asks — mask by default (e.g., `d***@gmail.com`)
- The `RESEND_API_KEY` is set in Cloudflare environment variables, not in the repo
- The `UNSUB_SECRET` is in `wrangler.toml` — treat as sensitive

## Wrangler Authentication

The `.env` file at `/Users/damion/CODE/recall_rogue_site/.env` contains the `CLOUDFLARE_API_TOKEN`. Wrangler reads this automatically when run from that directory. If auth fails, check that the token is still valid.

# API Changelog

## v1.0.0 — 2026-03-05

Initial public release of the Recall Rogue Fact API.

### New Endpoints
- `GET /api/v1/facts` — Paginated fact list with cursor pagination
- `GET /api/v1/facts/:id` — Single fact detail with distractors
- `GET /api/v1/facts/random` — Random fact sample for quiz use
- `GET /api/v1/categories` — Nested category tree
- `GET /api/v1/stats` — Database statistics
- `GET /api/v1/license` — CC license metadata (no auth required)

### Features
- API key authentication with three tiers (free / institutional / enterprise)
- Per-key daily and per-minute quota enforcement
- CC BY 4.0 attribution metadata on every response
- CC BY-NC 4.0 license for facts with pixel art
- Webhook delivery for UGC events (ugc.submitted, ugc.approved, ugc.rejected, etc.)
- Community fact submission with license consent gate
- Appeals workflow for rejected submissions
- Educational Partner Portal for institutional access
- Embeddable quiz widget (no build step required)
- TypeScript SDK (`packages/sdk/index.ts`)

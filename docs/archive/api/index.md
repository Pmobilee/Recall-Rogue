# Recall Rogue Fact API

The Recall Rogue Fact API provides programmatic access to our curated educational fact database.
All approved facts are available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
enabling educators, developers, and ed-tech platforms to embed knowledge quizzes in their products.

## Quickstart

### curl
```bash
curl https://api.terragacha.com/api/v1/facts?limit=5 \
  -H "X-Api-Key: tg_live_your_key_here"
```

### JavaScript
```js
const res = await fetch('https://api.terragacha.com/api/v1/facts?limit=5', {
  headers: { 'X-Api-Key': 'tg_live_your_key_here' }
})
const { data, meta } = await res.json()
console.log(`${data.length} facts — ${meta.license}`)
```

### Local development (port 3001)
```bash
curl http://localhost:3001/api/v1/facts?limit=5 \
  -H "X-Api-Key: tg_live_your_key_here"
```

## Versioning Policy

The API is versioned via URL path (`/api/v1/`). Breaking changes increment the version number.
Non-breaking additions are added without a version bump.

## Available Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/facts` | Paginated list of approved facts |
| GET | `/api/v1/facts/:id` | Single fact with full detail and distractors |
| GET | `/api/v1/facts/random` | Random sample of facts for quiz use |
| GET | `/api/v1/categories` | Category tree with fact counts |
| GET | `/api/v1/stats` | Database statistics |
| GET | `/api/v1/license` | CC license metadata (no auth required) |

## Further Reading

- [Authentication](./authentication.md) — API key types and usage
- [Rate Limiting](./rate-limiting.md) — Tier quotas and 429 handling
- [Licensing](./licensing.md) — CC BY 4.0 requirements
- [Webhooks](./webhooks.md) — Event delivery and HMAC verification
- [SDK](./sdk.md) — JavaScript/TypeScript SDK quickstart
- [Embed Widget](./widget.md) — Drop-in quiz widget
- [Partner Portal](./partner-portal.md) — Institutional access

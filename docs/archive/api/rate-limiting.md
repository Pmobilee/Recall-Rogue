# Rate Limiting

## Per-Key Quotas

Every API key has two rate limits enforced simultaneously:

| Limit | Free | Institutional | Enterprise |
|-------|------|---------------|------------|
| Daily (rolling 24h) | 1,000 | 50,000 | 500,000 |
| Per-minute | 60 | 500 | 2,000 |

Additionally, all IP addresses are subject to a hard ceiling of **120 requests per minute**
regardless of key tier. This protects against traffic amplification.

## 429 Response

When you exceed your daily quota, the API returns `HTTP 429`:

```json
{
  "error": "Daily quota exceeded",
  "quota": 1000,
  "used": 1000,
  "resetsAt": "2026-03-06T00:00:00.000Z"
}
```

The `resetsAt` field is an ISO 8601 timestamp for when your quota resets (midnight UTC).

## Back-off Strategy

When you receive a 429, implement exponential back-off:

```js
async function fetchWithRetry(url, options, maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, options)
    if (res.status !== 429) return res
    const data = await res.json()
    const resetAt = new Date(data.resetsAt).getTime()
    const waitMs = Math.min(
      resetAt - Date.now(),
      Math.pow(2, attempt) * 1000  // Exponential: 1s, 2s, 4s, 8s
    )
    await new Promise(r => setTimeout(r, waitMs))
  }
  throw new Error('Rate limit retry exhausted')
}
```

## Monitoring Usage

Use `GET /api/v1/stats` to check the current database state.
Use `GET /api/partner/dashboard` (institutional/enterprise keys) for detailed per-endpoint
usage breakdowns over the last 7 days.

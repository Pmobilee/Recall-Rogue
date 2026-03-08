# Authentication

## Obtaining an API Key

Register for a free API key at [terragacha.com/developers](https://terragacha.com/developers).
Free keys are issued immediately. Institutional keys require the partner application process
(see [Partner Portal](./partner-portal.md)).

## Using the X-Api-Key Header

Include your API key in every request using the `X-Api-Key` header:

```bash
curl https://api.terragacha.com/api/v1/facts \
  -H "X-Api-Key: tg_live_your_key_here"
```

## Key Tier Comparison

| Tier | Daily Quota | Per-Minute Quota | Use Case |
|------|-------------|------------------|----------|
| **free** | 1,000 req/day | 60 req/min | Prototyping, personal projects |
| **institutional** | 50,000 req/day | 500 req/min | Schools, universities, nonprofits |
| **enterprise** | 500,000 req/day | 2,000 req/min | Large-scale commercial deployments |

These quotas match the `TIER_QUOTAS` constants in `server/src/services/apiKeyService.ts`.

## Security Best Practices

- **Never expose API keys in client-side code** for production deployments.
  Use a server-side proxy or environment variables to keep keys private.
- Store keys in environment variables (e.g. `TERRA_GACHA_API_KEY`), not in source code.
- **Rotate keys immediately** if you suspect a key has been compromised.
  Contact [api-support@terragacha.com](mailto:api-support@terragacha.com) to revoke a key.
- Use one key per application so you can revoke individual access without disrupting others.

## Revoking a Key

To revoke a key:
1. If you have a registered account, use `DELETE /api/keys/:keyId` with your JWT token.
2. Alternatively, email [api-support@terragacha.com](mailto:api-support@terragacha.com)
   with your key prefix (the first 15 characters, e.g. `tg_live_abc1234`).

## Error Responses

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid `X-Api-Key` header |
| 429 | Daily quota exceeded — see `resetsAt` in response |

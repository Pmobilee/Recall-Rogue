# GET /api/v1/stats

Retrieve high-level database statistics.

## Authentication

`X-Api-Key` header required.

## Example Request

```bash
curl "https://api.terragacha.com/api/v1/stats" \
  -H "X-Api-Key: tg_live_your_key_here"
```

## Example Response

```json
{
  "data": {
    "totalApprovedFacts": 3142,
    "totalCategories": 18,
    "lastUpdated": "2026-03-05T12:00:00.000Z"
  },
  "meta": {
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Recall Rogue Fact Database — terragacha.com",
    "requiresAttribution": true
  }
}
```

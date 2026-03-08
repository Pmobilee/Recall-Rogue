# GET /api/v1/facts

Retrieve a paginated list of approved facts from the database.

## Authentication

`X-Api-Key` header required.

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | — | Filter by `category_l1` (e.g. `Biology`) |
| `difficulty` | string | — | Filter by difficulty level (`easy`, `medium`, `hard`) |
| `limit` | integer | 50 | Maximum results per page (max 100) |
| `cursor` | string | — | Last `id` from previous page for cursor pagination |

## Example Request

```bash
curl "https://api.terragacha.com/api/v1/facts?category=Biology&limit=10" \
  -H "X-Api-Key: tg_live_your_key_here"
```

## Example Response

```json
{
  "data": [
    {
      "id": "bio-001",
      "statement": "The human body contains approximately 37 trillion cells.",
      "quiz_question": "How many cells does the human body contain?",
      "correct_answer": "~37 trillion",
      "category_l1": "Biology",
      "category_l2": "Cell Biology",
      "difficulty": 3,
      "rarity": "common",
      "age_rating": "teen",
      "source_name": "Bianconi et al. 2013",
      "source_url": "https://doi.org/10.1080/10635150.2013.xxxxxx",
      "updated_at": 1709500800000
    }
  ],
  "pagination": {
    "limit": 10,
    "hasMore": true,
    "nextCursor": "bio-010"
  },
  "meta": {
    "totalApproved": 3142,
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Terra Gacha Fact Database — terragacha.com",
    "requiresAttribution": true
  }
}
```

## Cursor Pagination

To fetch the next page, pass the `nextCursor` value as the `cursor` parameter:

```bash
# Page 1
curl "https://api.terragacha.com/api/v1/facts?limit=10" \
  -H "X-Api-Key: tg_live_..."
# Returns nextCursor: "bio-010"

# Page 2
curl "https://api.terragacha.com/api/v1/facts?limit=10&cursor=bio-010" \
  -H "X-Api-Key: tg_live_..."
```

## Attribution Requirement

> **Important**: You MUST display attribution as specified in `meta.attribution`
> whenever you display facts sourced from this API.
>
> Minimum attribution: "Facts from [Terra Gacha](https://terragacha.com) — CC BY 4.0"

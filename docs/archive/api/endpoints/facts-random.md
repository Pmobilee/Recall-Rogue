# GET /api/v1/facts/random

Retrieve a random sample of facts, suitable for quiz generation.

## Authentication

`X-Api-Key` header required.

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `count` | integer | 10 | Number of random facts to return (max 50) |
| `category` | string | — | Restrict to this `category_l1` |

## Example Request

```bash
curl "https://api.terragacha.com/api/v1/facts/random?count=5&category=Biology" \
  -H "X-Api-Key: tg_live_your_key_here"
```

## Example Response

```json
{
  "data": [
    {
      "id": "bio-007",
      "statement": "Octopuses have three hearts.",
      "quiz_question": "How many hearts does an octopus have?",
      "correct_answer": "Three",
      "category_l1": "Biology",
      "difficulty": 2,
      "rarity": "uncommon"
    }
  ],
  "meta": {
    "count": 5,
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Terra Gacha Fact Database — terragacha.com",
    "requiresAttribution": true
  }
}
```

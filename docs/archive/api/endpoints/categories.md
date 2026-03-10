# GET /api/v1/categories

Retrieve the full category tree with fact counts at each level.

## Authentication

`X-Api-Key` header required.

## Example Request

```bash
curl "https://api.terragacha.com/api/v1/categories" \
  -H "X-Api-Key: tg_live_your_key_here"
```

## Example Response

```json
{
  "data": {
    "Biology": {
      "total": 480,
      "subcategories": {
        "Cell Biology": 42,
        "Genetics": 67,
        "Ecology": 89,
        "Zoology": 120
      }
    },
    "History": {
      "total": 350,
      "subcategories": {
        "Ancient History": 78,
        "Modern History": 120,
        "Wars & Conflicts": 52
      }
    }
  },
  "meta": {
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Recall Rogue Fact Database — terragacha.com",
    "requiresAttribution": true
  }
}
```

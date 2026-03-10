# GET /api/v1/facts/:id

Retrieve a single fact with full detail including distractors for quiz construction.

## Authentication

`X-Api-Key` header required.

## Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | The fact ID (string) |

## Example Request

```bash
curl "https://api.terragacha.com/api/v1/facts/bio-001" \
  -H "X-Api-Key: tg_live_your_key_here"
```

## Example Response

```json
{
  "data": {
    "id": "bio-001",
    "statement": "The human body contains approximately 37 trillion cells.",
    "explanation": "A 2013 study by Bianconi et al. estimated 37.2 trillion human cells.",
    "quiz_question": "How many cells does the human body contain?",
    "correct_answer": "~37 trillion",
    "acceptable_answers": ["37 trillion", "approximately 37 trillion"],
    "category_l1": "Biology",
    "category_l2": "Cell Biology",
    "difficulty": 3,
    "rarity": "common",
    "fun_score": 7,
    "age_rating": "teen",
    "source_name": "Bianconi et al. 2013",
    "source_url": "https://doi.org/10.1080/10635150.2013.xxxxxx",
    "mnemonic": "37 — like a body temperature of 37°C",
    "has_pixel_art": 0,
    "image_url": null,
    "updated_at": 1709500800000,
    "distractors": [
      { "text": "~7 trillion", "difficulty_tier": "easy" },
      { "text": "~100 billion", "difficulty_tier": "medium" },
      { "text": "~3.7 quadrillion", "difficulty_tier": "hard" }
    ]
  },
  "meta": {
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Recall Rogue Fact Database — terragacha.com",
    "requiresAttribution": true
  }
}
```

## 404 Response

```json
{ "error": "Fact not found" }
```

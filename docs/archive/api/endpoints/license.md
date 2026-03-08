# GET /api/v1/license

Retrieve the CC license metadata for this API deployment.
This endpoint does **not** require an API key.

## Example Request

```bash
curl "https://api.terragacha.com/api/v1/license"
```

## Example Response

```json
{
  "factText": {
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "requiresAttribution": true,
    "requiresNonCommercial": false,
    "attributionTemplate": "© {year} Terra Gacha (terragacha.com). Licensed under CC BY 4.0."
  },
  "pixelArtImages": {
    "license": "CC BY-NC 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-nc/4.0/",
    "requiresAttribution": true,
    "requiresNonCommercial": true,
    "attributionTemplate": "© {year} Terra Gacha (terragacha.com). Licensed under CC BY-NC 4.0."
  },
  "contactForCommercialLicensing": "licensing@terragacha.com"
}
```

See [Licensing](../licensing.md) for full requirements.

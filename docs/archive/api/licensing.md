# Content Licensing

## Summary

| Content Type | License | Commercial Use | Attribution Required |
|-------------|---------|----------------|---------------------|
| Fact text & quiz content | CC BY 4.0 | Yes | Yes |
| Pixel art images | CC BY-NC 4.0 | No | Yes |

## Fact Text — CC BY 4.0

All fact text, quiz questions, correct answers, distractors, and explanations are licensed
under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

You are free to:
- **Share** — copy and redistribute in any medium or format
- **Adapt** — remix, transform, and build upon the material for any purpose, **including commercial**

Under the following terms:
- **Attribution** — You must give appropriate credit to Terra Gacha, provide a link to the
  license, and indicate if changes were made.

### Attribution Template

```
© {year} Terra Gacha (terragacha.com). Licensed under CC BY 4.0.
```

Or in HTML:
```html
<span>Facts from <a href="https://terragacha.com">Terra Gacha</a>
— <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></span>
```

## Pixel Art Images — CC BY-NC 4.0

Pixel art images associated with facts are licensed under
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).

The **NonCommercial** restriction means you may use pixel art images only for
non-commercial purposes (educational, personal, research).

For commercial use of pixel art images, contact [licensing@terragacha.com](mailto:licensing@terragacha.com).

## Detecting the Applicable License

The `GET /api/v1/facts/:id` response includes `has_pixel_art` (0 or 1).
Use this to determine which license applies for a given fact:

```js
const { data, meta } = await client.getFactDetail(factId)
const license = data.has_pixel_art ? 'CC BY-NC 4.0' : 'CC BY 4.0'
```

The `GET /api/v1/license` endpoint returns the full license metadata for both content types.

## Commercial Licensing

If you need:
- Commercial use of pixel art images, or
- Bulk fact licensing under a custom agreement, or
- White-label rights

Contact [licensing@terragacha.com](mailto:licensing@terragacha.com).

Institutional and Enterprise API tiers include a standard commercial license for fact text.

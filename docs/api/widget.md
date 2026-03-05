# Embed Widget

The Terra Gacha embed widget lets you drop a quiz card into any webpage with a single
`<script>` tag. No build step required.

## Setup

1. Host `packages/widget/embed.html` on a web server (or use our CDN).
2. Embed it as an `<iframe>` in your page:

```html
<iframe
  src="https://widget.terragacha.com/embed.html"
  data-api-key="tg_live_your_key"
  data-category="Biology"
  width="520"
  height="300"
  frameborder="0"
  style="border-radius: 12px;"
></iframe>
```

Or self-host and configure via `data-*` attributes on the `<script>` tag within the HTML:

```html
<script
  src="https://widget.terragacha.com/embed.js"
  data-api-key="tg_live_your_key"
  data-category="Geography"
  data-api-base="https://api.terragacha.com"
></script>
```

## Configuration Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-api-key` | Yes | Your API key |
| `data-category` | No | Restrict facts to this category |
| `data-api-base` | No | Override API base URL (for local dev) |

## Features

- Loads a random fact and 4 answer options (1 correct + up to 3 distractors)
- Click to reveal correct/wrong indication
- "Next question" button to load a fresh fact
- CC BY 4.0 attribution displayed in every card
- Fully responsive — adapts to any container width

## Customisation

Copy `packages/widget/embed.html` and modify the `<style>` block:

```css
/* Example: change the accent colour */
.tg-option { border-color: #9c27b0; }
.tg-option.correct { background: #1a3a1a; border-color: #4caf50; }
```

## Attribution Requirement

The widget displays CC BY 4.0 attribution automatically. Do not remove the attribution
footer — it is required under the license terms.

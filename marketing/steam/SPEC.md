# Steam Store Asset Specifications

## Required Assets

| Asset | Dimensions | Format | File | Priority |
|-------|-----------|--------|------|----------|
| Capsule (small) | 460×215 | PNG | `capsule_460x215.png` | Required |
| Header image | 920×430 | PNG | `header_920x430.png` | Required |
| Library hero | 3840×1240 | PNG | `hero_3840x1240.png` | Required |
| Library logo | 600×900 | PNG | `logo_600x900.png` | Required |
| Screenshots | 1920×1080 | PNG | `screenshot_01.png` through `screenshot_05.png` | Min 5 required |

## Art Direction

### Capsule (460×215) — Small Browse Capsule
- Appears in the Steam store browse, search results, and recommended sections
- Must be readable at very small sizes (~150px wide on some devices)
- Include: Game logo/title, 1-2 representative cards, hint of dungeon aesthetic
- No subtitle text — logo only, must be legible against both light and dark Steam themes

### Header Image (920×430) — Store Page Header
- Large banner at top of store page
- Full art piece — dungeon scene with protagonist card/character visible
- Game logo in lower third, no store navigation overlap (Steam adds nav on top)
- Mood: Dark, atmospheric, knowledge-powered card roguelite

### Library Hero (3840×1240) — Library/Home Background
- Very wide panoramic image — appears behind game in Steam library
- Mostly atmospheric background art, NOT a key art piece
- Safe zone: Keep important elements in center 2560px (sides may be cropped)
- Dark at edges so game title text overlay is readable
- Suggest: Wide dungeon panorama, fading to dark at edges

### Library Logo (600×900) — Library Game Logo
- Appears overlaid on the library hero background
- Just the game logo/wordmark — transparent background (PNG alpha)
- Must be legible on dark backgrounds (the hero image)
- Do NOT include screenshots or character art — logo ONLY

### Screenshots (1920×1080 — minimum 5)
Suggested screenshot subjects:
1. Combat scene with full hand of cards visible, enemy engaged
2. Hub/camp screen showing relic inventory and deck manager
3. Card reward screen (post-combat card selection)
4. Boss encounter in progress
5. Map/floor navigation showing dungeon depth
Optional: Quiz panel closeup, chain combo in action, shop screen

## Technical Requirements
- All PNG files must be RGB or RGBA (no indexed color)
- Maximum file size: Steam accepts up to ~5MB per asset
- Screenshots must be gameplay captures, not marketing renders (Steam policy)
- Capsule and header: no age ratings, no review scores, no "Coming Soon" banners
  (Steam overlays these dynamically)

## Steam Store Description (reference only — not an image)
Short description (up to 300 chars):
> "A card roguelite where every card is a fact. Answer questions to unleash
> powerful combos, build knowledge-powered decks, and delve ever deeper into
> procedurally generated dungeons. Learning IS the game."

Tags to request: Card Game, Roguelite, Education, Deckbuilder, Turn-Based

# Steam Store Page — Status & Handoff

**Last updated:** 2026-04-12

## What's Done

### 1. Short Description (FINAL)
- File: `short-description.md`
- **Chosen:** "The knowledge roguelite. Answer questions to hit harder, skip them to die faster. The deeper you go, the more the dungeon punishes ignorance. Bosses shrug off everything but proven knowledge. 98 decks, 7 languages, 67,000 real facts. Guilt-free gaming."
- 263 chars. Paste into Steamworks > Store Page > Short Description.

### 2. Long Description / About This Game (READY TO PASTE)
- File: `long-description.md`
- Full BBCode between `--- START BBCODE ---` and `--- END BBCODE ---` markers
- Reworked to lead with guilt-free angle: FSRS/learning moved to section 1 so "winning because you're learning" lands early
- Sections: The Knowledge Roguelite, How Combat Works, Enemies That Care What You Know, 98 Decks / 67K Facts, Cards Relics Chains, The Dungeon, Two Ways to Play
- Images embedded as `[img]{STEAM_APP_IMAGE}/extras/<filename>[/img]` — replace `{STEAM_APP_IMAGE}` with actual CDN path after uploading images to Steamworks custom images
- Humanizer audit: passed, no AI tells found

### 3. Custom Images (REGENERATED, READY TO UPLOAD)
- Location: `steam/store-images/`
- Generator: `node scripts/generate-steam-images.mjs` (HTML template + Playwright screenshot)

| Image | File | Dimensions | Content |
|---|---|---|---|
| Enemy Showcase | `enemy-showcase.png` | 3120x1800 | 3x2 grid: Burning Deadline, Group Project, Moth of Enlightenment, Curriculum, Dunning-Kruger, Fake News |
| Relic Grid | `relic-grid.png` | 3120x1200 | 12 relics with icons and names |
| Camp Cat | `camp-cat.png` | 3120x1000 | Camp corridor background with pixel cat in warm light |
| Dialogue Showcase | `dialogue-showcase.png` | 3120x1600 | 4 enemy quotes: Dunning-Kruger, Singularity, Helicopter Parent, Student Debt |
| Deck Domains | `deck-domains.png` | 3120x1400 | "LEARN ANYTHING. FIGHT EVERYTHING." — 10 domain badges with example decks |
| Banner | `banner.webp` | 3584x1184 | Tavern scene (from recall_rogue_site) |

### 4. Competitor Analysis (complete)
- File: `competitor-analysis.md`
- Store page copy from: Balatro, Slay the Spire 1 & 2, Inscryption, Monster Train, Luck be a Landlord

### 5. Tag Strategy (complete)
- File: `tag-strategy.md`
- Recommended tags, genres, categories with rationale

## Upload Checklist

To finish the store page on Steamworks:

1. **Upload custom images** — Go to partner.steamgames.com > App > Store Page > About This Game section > upload each PNG from `steam/store-images/`. Note the CDN path format Steam gives you.
2. **Paste short description** — Store Page > Short Description field (plain text, 300 char limit)
3. **Paste BBCode** — Store Page > About This Game field. Copy everything between `--- START BBCODE ---` and `--- END BBCODE ---` from `long-description.md`. Replace `{STEAM_APP_IMAGE}` with the actual CDN prefix from step 1.
4. **Apply tags** — See `tag-strategy.md` for recommended tags
5. **Preview and publish** — Use Steamworks preview to check image sizing and text flow

## What's NOT Done (post-paste)

1. **System requirements** — need min/recommended specs for Windows
2. **Supported languages table** — UI is English only, but 7 language decks exist. Needs careful framing.
3. **Content descriptors / age rating** — not configured in Steamworks
4. **Animated WEBM clips** — 12s gameplay loops would be the Balatro-tier move (optional polish)
5. **10 gameplay screenshots** — see SKILL.md "Screenshot Strategy" for the planned shots (separate from the custom inline images above)

## Key Design Decisions

- **Lead with roguelite, not educational.** No competitor uses the "Education" tag. We include it for discoverability but never lead with it in copy.
- **Guilt-free gaming is the emotional hook.** Short description closes on it. Long description weaves "winning because you're learning" into the opening.
- **The Curriculum boss is the poster child.** It becomes immune to Quick Play in phase 2 — the game's thesis in enemy form.
- **Numbers sell.** 98 decks, 67,000 facts, 7 languages, 620K chess puzzles, 89 enemies, 56 relics.
- **FSRS mention is worthwhile.** Anki users (large overlap audience) will recognize it.
- **Voice rules:** No puffery, no epic-trailer verbs, no "It's not just X — it's Y", no marketing CTAs. See `SKILL.md` voice rules and `.claude/skills/humanizer/voice-sample.md`.

## Asset Locations

| Asset | Path |
|---|---|
| Generated store images | `steam/store-images/` |
| Image generator script | `scripts/generate-steam-images.mjs` |
| Cropped cat sprite | `steam/store-images/cat-cropped.png` |
| Enemy sprites (89) | `public/assets/sprites/enemies/*_idle.png` |
| Relic icons (144) | `public/assets/sprites/icons/icon_relic_*.png` |
| Camp background | `recall_rogue_site/generated/backgrounds-landscape/camp/camp-background-wide.webp` |
| Banner | `recall_rogue_site/public/assets/banner.webp` |

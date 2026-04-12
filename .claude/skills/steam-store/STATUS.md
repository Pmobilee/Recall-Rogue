# Steam Store Page — Status & Handoff

**Last updated:** 2026-04-12

## What's Done

### 1. Competitor Analysis (complete)
- File: `competitor-analysis.md`
- Exact store page copy extracted from: Balatro, Slay the Spire 1 & 2, Inscryption, Monster Train, Luck be a Landlord
- Pattern analysis: short description formulas, long description structure, tag overlap, voice comparison

### 2. Short Description (drafts ready, user to pick)
- File: `short-description.md`
- 6 options (A, E, F, G, H)
- User direction: guilt-free gaming angle (Options E-H preferred over neutral mechanic descriptions)
- **User has NOT finalized a pick yet.** H is the most complete.

### 3. Long Description / About This Game (draft ready)
- File: `long-description.md`
- Full BBCode version ready to paste into Steamworks
- Readable version for review
- Sections: The Knowledge Roguelite, How Combat Works, Enemies That Care What You Know, 98 Decks / 67K Facts, Cards Relics Chains, The Dungeon, Two Ways to Play
- Image placeholders marked as `{screenshot:...}` — replace with Steam CDN URLs after uploading images
- **TODO:** May need reworking to match the guilt-free angle from the short description. Currently leads with mechanic description, not the emotional hook.

### 4. Tag Strategy (complete)
- File: `tag-strategy.md`
- Recommended tags, genres, categories with rationale
- Key decision: include "Education" tag but never lead with it in copy

### 5. Custom Images for About This Game (generated, not uploaded)
- Location: `steam/store-images/`
- Generated via: `node scripts/generate-steam-images.mjs`
- Script: `scripts/generate-steam-images.mjs` (HTML template + Playwright screenshot)

| Image | File | Dimensions | Content |
|---|---|---|---|
| Enemy Showcase | `enemy-showcase.png` | 3120x1800 | 3x2 grid: Burning Deadline, Group Project, Moth of Enlightenment, Curriculum, Dunning-Kruger, Fake News |
| Relic Grid | `relic-grid.png` | 3120x1200 | 12 relics: Volatile Core, Double Down, Quicksilver Quill, Blood Price, Lucky Coin, Insight Prism, Phoenix Feather, Paradox Engine, Akashic Record, Dragon's Heart, Omniscience, Capacitor |
| Camp Cat | `camp-cat.png` | 3120x1000 | Camp background + tiny pixel cat. Cat may be too small — consider scaling up. |
| Dialogue Showcase | `dialogue-showcase.png` | 3120x1600 | 4 enemy quotes: Dunning-Kruger, Singularity, Helicopter Parent, Student Debt |
| Deck Domains | `deck-domains.png` | 3120x500 | "LEARN ANYTHING. FIGHT EVERYTHING." — 10 domain badges with example decks |
| Banner | `banner.webp` | 3584x1184 | Tavern scene (copied from recall_rogue_site) |

**TODO:**
- Upload images to Steamworks custom image uploader
- Insert into BBCode description
- Cat image may need the cat scaled up (currently 32px native, barely visible)
- Consider adding animated WEBM clips (12s max) for combat chains, quiz answers

### 6. Screenshot Strategy (planned, not captured)
- Documented in `SKILL.md` under "Screenshot Strategy"
- 10 recommended screenshots at 1920x1080
- User was making header screenshots separately during this session

## What's NOT Done

1. **User hasn't picked a short description** — present options, get decision
2. **Long description hasn't been pasted into Steamworks** — BBCode is ready in `long-description.md`
3. **Images haven't been uploaded to Steamworks** — PNGs are in `steam/store-images/`
4. **Long description may need guilt-free angle rework** — currently leads with mechanic, not emotional hook
5. **No animated clips yet** — WEBM gameplay loops would be the Balatro-tier move
6. **System requirements not drafted** — need min/recommended specs for Windows
7. **Supported languages table** — UI is English only, but 7 language decks exist. Needs careful framing.
8. **Content descriptors / age rating** — not configured
9. **Steam achievements** — exist in code (`src/data/steamAchievements.ts`) but may not be configured in Steamworks

## Key Design Decisions

- **Lead with roguelite, not educational.** No competitor uses the "Education" tag. We include it for discoverability but never lead with it in copy.
- **Guilt-free gaming is the emotional hook.** User explicitly chose this over neutral mechanic descriptions.
- **The Curriculum boss is the poster child.** It becomes immune to Quick Play in phase 2 — only charged knowledge gets through. This IS the game's thesis in enemy form.
- **Numbers sell.** 98 decks, 67,000 facts, 7 languages, 620K chess puzzles, 89 enemies, 56 relics. Players read these as value-for-money.
- **FSRS mention is worthwhile.** Anki users (large overlap audience) will recognize it immediately.
- **Voice rules:** No puffery, no epic-trailer verbs, no "It's not just X — it's Y", no marketing CTAs. See `SKILL.md` "Voice Rules" section and `.claude/skills/humanizer/voice-sample.md`.

## Asset Locations

| Asset | Path |
|---|---|
| Enemy sprites (89) | `public/assets/sprites/enemies/*_idle.png` |
| Relic icons (144) | `public/assets/sprites/icons/icon_relic_*.png` |
| Card art (31) | `recall_rogue_site/public/assets/cardart/` |
| Combat backgrounds (68) | `recall_rogue_site/generated/backgrounds-landscape/` |
| Camp cat | `data/generated/camp-art/sprites/cat/cat-base.png` |
| Banner | `recall_rogue_site/public/assets/banner.webp` |
| Camp background | `recall_rogue_site/generated/backgrounds-landscape/camp/camp-background-wide.webp` |
| Site CSS palette | `recall_rogue_site/public/index.html` lines 32-44 |
| Generated store images | `steam/store-images/` |
| Image generator script | `scripts/generate-steam-images.mjs` |

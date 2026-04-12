---
name: steam-store
description: "Draft, iterate, and manage the Steam store page — short description, long description (BBCode), tags, screenshots, and competitor analysis."
user_invocable: true
---

# Steam Store Page — Draft & Manage

Draft and iterate on the Recall Rogue Steam store page. Covers short description, About This Game (BBCode), tag strategy, screenshot planning, and competitor analysis.

## Arguments

| Subcommand | Description |
|---|---|
| `draft` | Show current drafts of short + long description |
| `short` | Iterate on the short description only |
| `long` | Iterate on the long description only |
| `tags` | Show recommended Steam tags and categories |
| `competitors` | Show competitor store page analysis |
| `bbcode` | Output the full long description in paste-ready Steam BBCode |
| `screenshots` | Screenshot planning and guidelines |

Default (no argument): show current drafts.

## Store Page Constants

```
APP_ID: 4547570
PARTNER_URL: https://partner.steamgames.com/apps/landing/4547570
STORE_URL: https://store.steampowered.com/app/4547570/Recall_Rogue/
STUDIO: Bramblegate Games
```

## Editing the Store Page

The Steamworks partner portal has no content API. The workflow is:
1. Draft and iterate on copy here (version-controlled in this skill)
2. Copy the BBCode output from `/steam-store bbcode`
3. Paste into partner.steamgames.com > Store Page > About This Game
4. Short description goes in the "Short Description" field (plain text, 300 char limit)

## Current Drafts

Drafts live in this directory:
- `short-description.md` — short description options (plain text, <300 chars)
- `long-description.md` — full About This Game (Steam BBCode)
- `tag-strategy.md` — recommended tags, categories, genres
- `competitor-analysis.md` — extracted store page copy from Balatro, StS, etc.

## Voice Rules for Store Page Copy

The store page IS marketing, but Recall Rogue's voice doesn't do breathless hype. The target is:

**Slay the Spire's dev-to-player confidence + Balatro's specificity, minus the puffery.**

1. Name the genre in the first sentence. No burying the lede.
2. State the twist (knowledge = power) immediately after genre.
3. Be specific — actual numbers, actual mechanic names, actual content.
4. Short sentences. Fragments are fine. Don't explain what a roguelite is.
5. No epic-trailer verbs (Master, Unleash, Discover, Embark, Delve).
6. No "It's not just X — it's Y" construction.
7. No rule-of-three parallel noun chains.
8. No vague evocative nouns (tapestry, journey, realm, essence).
9. No marketing CTAs ("test your knowledge!", "can you survive?").
10. Humor is allowed — deadpan, specific, earned. Not wacky.
11. Numbers flex works — players read content counts as value-for-money.
12. Assume genre literacy. Don't explain deckbuilding.

All text MUST pass the `/humanizer` with `voice-sample.md` before final paste.

## Game Numbers for Copy (update as content grows)

| Metric | Count |
|---|---|
| Curated decks | 98 |
| Total facts | 67,979 |
| Languages | 7 (JP, ZH, ES, FR, DE, KO, CS, NL) |
| AP exam subjects | 12 |
| Card mechanics | 38+ |
| Enemies | 89 (47 common, 24 mini-boss, 10 elite, 8 boss) |
| Relics | 56 (25 starter + 31 unlockable) |
| Ascension levels | 20 |
| Mystery events | 8 |
| Narrative archetypes | 12 |
| Quiz modes | 5 (text, image Q, image A, chess tactic, map pin) |
| Chess puzzles | 620,000+ |

## Screenshot Strategy

Steam allows up to 10 screenshots (recommended: 5-8). Each should show a distinct game state:

1. **Combat — mid-chain** — show a Knowledge Chain building with multiplier visible
2. **Quiz overlay** — the charge moment, question visible, 4 options
3. **Deck selection** — Study Temple or Trivia Dungeon deck picker
4. **Boss fight** — The Final Exam or The Curriculum, dramatic phase
5. **Map/room selection** — dungeon map with room variety visible
6. **Rest site** — Keeper dialogue, study option, heal option
7. **Shop** — card/relic purchasing
8. **Card hand close-up** — showing card frames, chain colors, mastery levels
9. **Language deck** — Japanese or Chinese quiz with furigana/pinyin visible
10. **Chess tactics** — the interactive chess board puzzle mode

Each screenshot at 1920x1080. Capsule art separate (handled by Steamworks asset pipeline).

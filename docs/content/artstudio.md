# Art Studio — Dev Tool Reference

> **Purpose:** Documents the Art Studio web tool at `sprite-gen/cardback-tool/public/artstudio.html`, its category system, server API, and audio SFX workflow.
> **Last updated:** 2026-04-01
> **Source files:** `sprite-gen/cardback-tool/public/artstudio.html`, `sprite-gen/cardback-tool/server.mjs`

---

## Overview

The Art Studio is an internal dev tool (runs on `http://localhost:5175/artstudio.html`) for managing visual and audio assets used in Recall Rogue. It provides:
- Category-based item management (add, review, accept/reject variants)
- Image generation via OpenRouter (Gemini Flash) or ComfyUI (remote FLUX)
- Audio SFX review via browser playback (externally sourced `.m4a` files)

---

## Category System

### Image Categories

| Category | Use | Generation |
|---|---|---|
| `cardframes` | Card border/frame art | OpenRouter |
| `enemies` | Enemy sprites | OpenRouter |
| `cardart` | Card illustration art | OpenRouter |
| `backgrounds` | Combat room backgrounds | OpenRouter |
| `noncombat` | Hub/shop/rest BGs | OpenRouter |
| `mysteryrooms` | Mystery event backgrounds | OpenRouter |
| `rewardrooms` | Reward room backgrounds | OpenRouter |
| `relicicons` | Relic icons | ComfyUI |
| `deckfronts` | Deck card fronts (768×1024, pixel art RPG style) | OpenRouter |
| `cardtype_icons` | Card type icons | ComfyUI |
| `domain_icons` | Knowledge domain icons | ComfyUI |
| `status_icons` | Status effect icons | ComfyUI |
| `intent_icons` | Enemy intent icons | ComfyUI |
| `reward_icons` | Reward type icons | ComfyUI |
| `nav_icons` | Navigation/UI icons | ComfyUI |
| `archetype_icons` | Archetype icons | ComfyUI |
| `lb_icons` | Leaderboard icons | ComfyUI |
| `mystery_icons` | Mystery event icons | ComfyUI |
| `ui_icons` | General UI icons | ComfyUI |
| `map_icons` | Map room icons | ComfyUI |
| `enemy_power_icons` | Enemy special power icons | ComfyUI |
| `currency_icons` | Currency icons | ComfyUI |

### Audio SFX Categories

Audio categories use prefix `audio_`. No in-tool generation — files are sourced externally and placed manually. Each variant is a `.m4a` file.

| Category | Use | Deploy path |
|---|---|---|
| `audio_loops` | Ambient loop sounds | `public/assets/audio/sfx/loops/{id}.m4a` |
| `audio_combat` | Combat SFX (hits, blocks, etc.) | `public/assets/audio/sfx/combat/{id}.m4a` |
| `audio_quiz` | Quiz feedback sounds | `public/assets/audio/sfx/quiz/{id}.m4a` |
| `audio_ui` | UI click/hover/feedback sounds | `public/assets/audio/sfx/ui/{id}.m4a` |
| `audio_shop` | Shop interaction sounds | `public/assets/audio/sfx/shop/{id}.m4a` |
| `audio_status` | Status effect sounds | `public/assets/audio/sfx/status/{id}.m4a` |
| `audio_encounter` | Encounter start/end sounds | `public/assets/audio/sfx/encounter/{id}.m4a` |
| `audio_progression` | Level-up, reward sounds | `public/assets/audio/sfx/progression/{id}.m4a` |
| `audio_rest` | Rest site sounds | `public/assets/audio/sfx/rest/{id}.m4a` |
| `audio_hub` | Hub/camp sounds | `public/assets/audio/sfx/hub/{id}.m4a` |
| `audio_other` | Misc sounds | `public/assets/audio/sfx/other/{id}.m4a` |

---

## Audio SFX Workflow

### Adding an Audio SFX Entry

1. Click the relevant `Audio: *` tab in Art Studio
2. Click `+ Add Item`
3. Fill in: ID (slug), Name, Concept
4. Optionally: `Code Location` (where this sound is called from in code, e.g. `audioService.ts:playButtonClick`)
5. Check `Needs Replacement` if the current file is a placeholder
6. Click `Add Item`

### Adding Variant Files

Variants are placed directly on disk — no upload UI:

```
sprite-gen/cardback-tool/artstudio-output/audio_ui/btn-click/variant-1.m4a
sprite-gen/cardback-tool/artstudio-output/audio_ui/btn-click/variant-2.m4a
```

Reload the page to see variants appear. The server reads file sizes but not duration metadata (duration must be determined externally or left blank).

### Sourced Variants (CC0)

When a variant is sourced from an external CC0 library (not synthesized), record provenance directly in the variant object. The `accepted` field starts as `false` until reviewed and approved via the Art Studio UI:

```json
{
  "variant": 0,
  "status": "done",
  "accepted": false,
  "source": "opengameart.org/content/fireplace-sound-loop",
  "license": "CC0",
  "duration_s": 29,
  "description": "Real campfire crackling recording"
}
```

Synthesized placeholders awaiting replacement use:
```json
{
  "variant": 0,
  "status": "done",
  "accepted": true,
  "source": "synthesized (needs replacement)"
}
```

### audio_loops Sourcing Status (2026-04-01)

| Loop ID | Source | License | Duration |
|---|---|---|---|
| `hub_campfire_ambience` | opengameart.org/content/fireplace-sound-loop | CC0 | 29s |
| `dungeon_drip_ambient` | opengameart.org/content/loopable-dungeon-ambience | CC0 | 94s |
| `water_drip_close` | opengameart.org/content/dripping-water-loop | CC0 | 20s |
| `wind_passage` (v0) | McFunkypants SoundCloud — dungeon ambient | CC0 | 94s |
| `wind_passage` (v1) | McFunkypants SoundCloud — Dark Forest | CC0 | 87s |
| `fire_ember_pit` | McFunkypants SoundCloud — Fire Sword | CC0 | 80s |
| `fire_torch_crackle` | McFunkypants SoundCloud — Fire Sword | CC0 | 80s |
| `ice_creak` | McFunkypants SoundCloud — Ocean Of Ice | CC0 | 64s |
| `wind_howl_deep` | McFunkypants SoundCloud — Ocean Of Ice | CC0 | 64s |
| `water_bubbles` | McFunkypants SoundCloud — Pond Life | CC0 | 88s |
| `water_flow_underground` | McFunkypants SoundCloud — Pond Life | CC0 | 88s |
| `arcane_whisper` | McFunkypants SoundCloud — Cyborg Lab | CC0 | 64s |
| `crystal_hum` | McFunkypants SoundCloud — Cyborg Lab | CC0 | 64s |
| `void_drone` | McFunkypants SoundCloud — Draft Monk | CC0 | 128s |
| `combat_tension_underbed` | McFunkypants SoundCloud — Draft Monk | CC0 | 128s |
| `boss_arena_ambient` | McFunkypants SoundCloud — Draft Monk | CC0 | 128s |
| `mystery_eerie_ambient` | McFunkypants SoundCloud — Dark Forest | CC0 | 87s |
| `stone_room_resonance` | McFunkypants SoundCloud — dungeon ambient | CC0 | 94s |
| `map_exploration_ambient` | McFunkypants SoundCloud — dungeon ambient | CC0 | 94s |
| `stone_creak_settle` | McFunkypants SoundCloud — dungeon ambient | CC0 | 94s |
| `camp_cloth_rustle` | synthesized (needs replacement) | — | — |
| `distant_creature_stir` | synthesized (needs replacement) | — | — |
| `chain_rattle_distant` | synthesized (needs replacement) | — | — |
| `steam_vent_hiss` | synthesized (needs replacement) | — | — |
| `lava_bubble` | synthesized (needs replacement) | — | — |
| `shop_ambient_browse` | synthesized (needs replacement) | — | — |
| `rest_site_peaceful` | synthesized (needs replacement) | — | — |
| `victory_celebration_ambient` | synthesized (needs replacement) | — | — |
| `quiz_thinking_ambient` | synthesized (needs replacement) | — | — |
| `low_hp_warning_pulse` | synthesized (needs replacement) | — | — |
| `chain_active_shimmer` | synthesized (needs replacement) | — | — |
| `keeper_presence_hum` | synthesized (needs replacement) | — | — |

### Reviewing Audio

- Each variant card shows an `<audio>` player with `preload="none"` for performance
- Click `▶ Play` button for easy A/B comparison (large target, toggled to `⏸ Pause`)
- Only one audio element plays at a time — starting a new one auto-pauses others
- Click `Accept` on the winner to mark it in `artstudio-items.json`

---

## Server API

### `GET /api/artstudio/items?category=<cat>`
Returns all items for a category. Audio items include `codeLocation` and `needsReplacement` fields.

### `POST /api/artstudio/items`
Upsert an item. For audio categories, accepts additional fields:
- `codeLocation` — string, where this sound is used in code
- `needsReplacement` — boolean, flag for placeholder/low-quality sounds

### `GET /api/artstudio/image/:category/:id/:variant`
Serves the variant file. For `audio_*` categories, reads `variant-{n}.m4a` and sets `Content-Type: audio/mp4`. For image categories, reads `variant-{n}.png`.

### `POST /api/artstudio/accept`
Marks a variant as accepted (toggles). Works for both image and audio variants.

### `DELETE /api/artstudio/item/:category/:id`
Removes an item entry. Does not delete files from disk.

---

## Item Data Schema

### Image item
```json
{
  "id": "flame-knight",
  "name": "Flame Knight",
  "concept": "Armored warrior wreathed in fire",
  "prompt": "Full generation prompt...",
  "targetWidth": 512,
  "targetHeight": 512,
  "variants": [{ "variant": 1, "status": "done", "accepted": true, "seed": 12345 }]
}
```

### Audio item (synthesized/simple)
```json
{
  "id": "btn-click",
  "name": "Button Click",
  "concept": "Short crisp click for UI buttons",
  "codeLocation": "audioService.ts:playButtonClick",
  "needsReplacement": false,
  "prompt": "",
  "targetWidth": 0,
  "targetHeight": 0,
  "variants": [{ "variant": 1, "accepted": true }]
}
```

### Audio item (sourced CC0 variant)
```json
{
  "id": "hub_campfire_ambience",
  "name": "Hub Campfire Ambience",
  "concept": "...",
  "codeLocation": "ambientAudioService.ts:83",
  "needsReplacement": true,
  "variants": [{
    "variant": 0,
    "status": "done",
    "accepted": false,
    "source": "opengameart.org/content/fireplace-sound-loop",
    "license": "CC0",
    "duration_s": 29,
    "description": "Real campfire crackling recording"
  }]
}
```

---

## File Storage

All artstudio working files live in `sprite-gen/cardback-tool/artstudio-output/{category}/{id}/`:
- Image variants: `variant-1.png`, `variant-2.png`, ...
- Audio variants: `variant-1.m4a`, `variant-2.m4a`, ...

Item metadata is stored in `sprite-gen/cardback-tool/artstudio-items.json`.

Accepted images must be manually copied/deployed to `public/assets/`. The `deployed` badge in the UI checks `checkDeployed()` against known deploy paths (see server.mjs line ~1862).

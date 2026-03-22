---
name: artstudio
description: Manage the Art Studio — generate sprites, enemy art, card art, and combat backgrounds via the OpenRouter image generation pipeline. List items, queue generation, accept/reject variants, and check progress.
user_invocable: true
---

# Art Studio — Image Generation Pipeline

## Art Style Rules — MANDATORY

These rules apply to ALL generated art. Violating them produces unusable output.

### Rule 1: Strict Pixel Art Style (NOT Painterly)
ALL prompts MUST include this style block:
```
crisp clean pixel art with visible individual pixels, 16-bit JRPG dungeon style, NOT painterly NOT smooth NOT illustrated NOT watercolor, hard pixel edges, limited color palette per object, dithering for shading
```

### Rule 2: No Readable Text
AI generators always produce garbled text artifacts. Use runes/illegible scrawl instead.
ALL prompts MUST end with:
```
absolutely no readable text no letters no numbers no words no symbols that resemble writing no signs no inscriptions, all markings must be abstract runes or illegible scrawl
```

### Rule 3: No Lighting/Fog/Particle Effects
These are added PROGRAMMATICALLY by the game engine. NEVER include in prompts:
- "glowing", "emanating light", "casting shadows", "light from [source]"
- "fog", "mist", "sparks", "embers", "pulsing light", "flickering"
- Describe OBJECTS only. A torch is "a wall-mounted iron torch bracket" not "a torch casting warm light."

### Rule 4: No Floor Markings
No arcane circles, summoning circles, magic circles, or rune circles on the floor. Clean stone/material only.

### Rule 5: Moody Not Dark
Each room has color personality from props/materials, not from uniform darkness. Use "moody atmospheric" not "dark atmospheric."

## Background Composition Template

### Landscape (16:9 at 1920x1080)
All landscape backgrounds use `targetWidth: 1920, targetHeight: 1080` and follow this structure:
```
pixel art dungeon room, front-facing perspective at eye level looking straight into the chamber, NOT isometric NOT top-down NOT angled, a dark stone archway exit at the exact center of the back wall leading deeper into shadow — this doorway is the focal vanishing point of the composition, [DEPTH BLOCK], all room elements arranged on either side leaving a clear corridor, to the left [LEFT PROPS], the left wall [LEFT WALL DETAIL floor-to-ceiling], to the right [RIGHT PROPS], the right wall [RIGHT WALL DETAIL floor-to-ceiling], the floor is [FLOOR DEBRIS], the ceiling has [CEILING DETAIL], [NARRATIVE], every surface wall floor and ceiling is dense with objects and texture, the center corridor is completely clear, [STYLE BLOCK], [ANTI-TEXT BLOCK], 16:9 wide horizontal composition, absolutely no characters no figures no creatures no people no monsters, no UI elements
```

### Portrait (9:16 at 576x1024)
Same as landscape but with `targetWidth: 576, targetHeight: 1024` and:
- Replace aspect line with: `9:16 vertical composition with detail filling the full vertical space from floor to ceiling`
- Add extra vertical density: upper wall decorations, ceiling detail, floor-to-ceiling coverage

### Depth Block (identical for ALL backgrounds)
```
the room has strong depth perspective with a visible stone floor receding toward the back wall, at least 3 depth layers — foreground props near the camera then middle ground furniture and equipment then the back wall with the archway, the stone archway exit door is fully visible and centered at approximately 40% from the top of the image and 50% horizontal, the archway is always the same size relative to the frame — about 20% of image width and 25% of image height
```

### Key Density Rules
- Every wall: floor-to-ceiling coverage (shelves, pinned notes, growth, mounted objects)
- Every floor: debris, stains, scattered objects, cracks
- Every ceiling: hooks, chains, cobwebs, hanging objects
- NO bare stone surfaces anywhere

## Technical Settings

### Model
- **Current**: `google/gemini-3.1-flash-image-preview` via OpenRouter
- Set in `.env` as `OPENROUTER_MODEL`

### Dimensions
| Category | Width | Height | Notes |
|----------|-------|--------|-------|
| Landscape backgrounds | 1920 | 1080 | Full HD, nearest-neighbor resize |
| Portrait backgrounds | 576 | 1024 | Mobile portrait |
| Card art | 512 | 512 | Square, matches existing art |
| Relic icons | 512 | 512 | Square, downscaled later |
| Card frames | 512 | 729 | Card aspect ratio |

### Resize
Sharp uses `kernel: sharp.kernel.nearest` for ALL pixel art — prevents bilinear blur artifacts on upscale.

## Server

- **Location**: `sprite-gen/cardback-tool/server.mjs` on port 5175
- **Start**: `cd sprite-gen/cardback-tool && node server.mjs`
- **UI**: `http://localhost:5175/artstudio.html`
- **Data**: `sprite-gen/cardback-tool/artstudio-items.json`
- **Output**: `sprite-gen/cardback-tool/artstudio-output/{category}/{id}/variant-{n}.png`

## Categories

| Category | Description |
|----------|-------------|
| `cardframes` | Card border frames |
| `enemies` | Enemy combat sprites |
| `cardart` | Card illustration art |
| `backgrounds` | Per-enemy combat backgrounds (portrait + landscape) |
| `relicicons` | Relic inventory icons |

## API Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/artstudio/items?category={cat}` | — | List all items in category |
| POST | `/api/artstudio/generate` | `{ id, category, count }` | Queue generation of `count` variants |
| POST | `/api/artstudio/accept` | `{ id, category, variant }` | Toggle accepted state on a variant |
| POST | `/api/artstudio/items` | `{ id, category, name, concept, prompt, targetWidth, targetHeight }` | Upsert item definition |
| GET | `/api/artstudio/image/:category/:id/:variant` | — | Serve generated image |
| DELETE | `/api/artstudio/item/:category/:id` | — | Remove item and all variants |

## Generation Pipeline

1. Prompt sent to OpenRouter API (Gemini 3.1 Flash Image Preview)
2. Base64 image decoded
3. Sharp resize to `targetWidth x targetHeight` with `kernel: nearest`
4. PNG saved to `artstudio-output/{category}/{id}/variant-{n}.png`
5. Auto-retry: 3 attempts on text-only responses from Gemini

## Environment

- Requires `OPENROUTER_API_KEY` in `.env` at project root
- Model: `OPENROUTER_MODEL=google/gemini-3.1-flash-image-preview`

## Common Tasks

### Check server status
```bash
lsof -i :5175
```

### Start server if not running
```bash
cd sprite-gen/cardback-tool && node server.mjs &
```

### List non-accepted items in a category
```bash
curl -s 'http://localhost:5175/api/artstudio/items?category=backgrounds' | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    has_accepted = any(v.get('accepted') for v in item.get('variants', []))
    if not has_accepted:
        print(f'  {item[\"id\"]} ({len(item.get(\"variants\", []))} variants)')
"
```

### Generate 1 variant for a specific item
```bash
curl -s -X POST http://localhost:5175/api/artstudio/generate \
  -H 'Content-Type: application/json' \
  -d '{"id": "bg-page_flutter-portrait", "category": "backgrounds", "count": 1}'
```

### Batch generate for all non-accepted items in a category
```bash
curl -s 'http://localhost:5175/api/artstudio/items?category={CATEGORY}' | python3 -c "
import json, sys, subprocess
data = json.load(sys.stdin)
for item in data:
    if not any(v.get('accepted') for v in item.get('variants', [])):
        subprocess.run(['curl', '-s', '-X', 'POST', 'http://localhost:5175/api/artstudio/generate',
            '-H', 'Content-Type: application/json',
            '-d', json.dumps({'id': item['id'], 'category': '{CATEGORY}', 'count': 1})],
            capture_output=True)
        print(f'Queued: {item[\"id\"]}')
"
```

### Accept a variant
```bash
curl -s -X POST http://localhost:5175/api/artstudio/accept \
  -H 'Content-Type: application/json' \
  -d '{"id": "bg-page_flutter-portrait", "category": "backgrounds", "variant": 0}'
```

### Check generation progress
```bash
curl -s 'http://localhost:5175/api/artstudio/items?category=backgrounds' | python3 -c "
import json, sys
data = json.load(sys.stdin)
total = sum(len(i.get('variants',[])) for i in data)
done = sum(1 for i in data for v in i.get('variants',[]) if v.get('status')=='done')
error = sum(1 for i in data for v in i.get('variants',[]) if v.get('status')=='error')
pending = sum(1 for i in data for v in i.get('variants',[]) if v.get('status') not in ('done','error'))
accepted = sum(1 for i in data if any(v.get('accepted') for v in i.get('variants',[])))
print(f'Items: {len(data)} | Accepted: {accepted} | Variants: {total} (done:{done} error:{error} pending:{pending})')
"
```

## Item Format

```json
{
  "id": "bg-page_flutter-portrait",
  "name": "Page Flutter Lair (Portrait)",
  "concept": "Narrow passage with torn pages...",
  "prompt": "pixel art dungeon room...",
  "targetWidth": 576,
  "targetHeight": 1024,
  "variants": [
    { "variant": 0, "seed": 123, "status": "done", "accepted": true }
  ]
}
```

Background IDs follow the pattern `bg-{enemy_id}-portrait` and `bg-{enemy_id}-landscape`.

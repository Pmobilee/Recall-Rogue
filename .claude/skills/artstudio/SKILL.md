---
name: artstudio
description: Manage the Art Studio — generate sprites, enemy art, card art, and combat backgrounds via the OpenRouter image generation pipeline. List items, queue generation, accept/reject variants, and check progress.
user_invocable: true
---

# Art Studio — Image Generation Pipeline

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

1. Prompt sent to OpenRouter API (Gemini Flash image gen)
2. Base64 image decoded
3. Sharp resize to `targetWidth x targetHeight`
4. PNG saved to `artstudio-output/{category}/{id}/variant-{n}.png`
5. Auto-retry: 3 attempts on text-only responses from Gemini

## Environment

- Requires `OPENROUTER_API_KEY` in `.env` at project root
- Model configurable via `OPENROUTER_MODEL` (default: `google/gemini-2.5-flash-image`)

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
  -d '{"id": "bg-cave_bat-portrait", "category": "backgrounds", "count": 1}'
```

### Batch generate for all non-accepted items in a category
```python
# Queue 1 variant for every non-accepted item:
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
  -d '{"id": "bg-cave_bat-portrait", "category": "backgrounds", "variant": 0}'
```

### Check generation progress
```bash
# Count done vs total variants:
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
  "id": "bg-cave_bat-portrait",
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

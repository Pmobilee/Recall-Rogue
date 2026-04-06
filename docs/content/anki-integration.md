# Anki Integration (Import/Export)

> Bidirectional Anki deck exchange with full FSRS scheduling preservation.
> Source files: `src/services/ankiService.ts`, `src/services/personalDeckStore.ts`, `src/services/ankiMediaStore.ts`
> UI: `src/ui/components/AnkiImportWizard.svelte`, `src/ui/components/AnkiExportWizard.svelte`

---

## Overview

Players can import `.apkg` files (the standard Anki export format) as personal decks inside the game, and export any curated or personal deck back to `.apkg` with review scheduling included. This enables a round-trip workflow:

1. A player exports their Anki deck into Recall Rogue — facts become quiz cards, FSRS stats transfer in.
2. After playing, they export back to Anki — their updated FSRS stats travel out.

Personal decks created via import are stored in `PlayerSave.personalDecks` and registered into the in-memory deck store at startup. The quiz engine uses the same `selectDistractors` / `selectQuestionTemplate` code paths for personal decks as for curated decks; however, imported cards default to `quizResponseMode: 'typing'` because no distractors are generated at import time.

Dependencies already in the project: `fflate` (ZIP), `sql.js` (SQLite WASM, also used for `facts.db` / `curated.db`).

---

## Import Flow

Triggered from **StudyTempleScreen** via the "Import Anki" header button, which mounts `AnkiImportWizard`.

### Step 1 — Upload

- User drops or selects an `.apkg` file.
- Client-side validation: extension must be `.apkg`, size ≤ 50 MB.
- File is read as `Uint8Array` and passed to `parseApkg()`.

### Step 2 — Preview

`parseApkg(apkgBytes: Uint8Array): Promise<AnkiImportData>` performs:

1. Unzips the `.apkg` archive with `fflate.unzipSync`.
2. Locates the SQLite file: prefers `collection.anki21`, falls back to `collection.anki2`.
3. Opens the database with `sql.js`.
4. Reads the `col` table (one row) — parses `decks` and `models` JSON to extract deck name and note type field names.
5. Reads the `notes` table — fields are split by the Anki separator `\x1f` (char code 31).
6. Reads the `cards` table — scheduling columns: `type`, `queue`, `due`, `ivl`, `factor`, `reps`, `lapses`.
7. Reads the `media` manifest file (JSON mapping integer keys to original filenames) and extracts all referenced media files from the ZIP into a `Map<string, Uint8Array>`.

Returns `AnkiImportData`: deck name, notes, cards, models, total card count, `hasSchedulingData` flag (true if any card has `reps > 0`), and `media` map.

The wizard shows a preview: total cards, note count, note types with field names, first 5 notes.

### Step 3 — Configure

User sets:
- **Deck name** — pre-filled from the Anki deck name.
- **Question field** — which note field becomes the quiz question (default: field index 0, usually "Front").
- **Answer field** — which note field becomes the correct answer (default: field index 1, usually "Back").
- **Import scheduling data** — whether to map Anki SM-2 scheduling to `ReviewState` objects. Disabled if `hasSchedulingData` is false.
- **Multiple-choice mode** — when enabled, runs the pool-based distractor generator after import so players can answer with buttons instead of typing. Facts that cannot get ≥ 4 distractors remain in typing mode. See [Distractor Generation](#distractor-generation) below.

### Step 4 — Import

`ankiToPersonalDeck(data, options, media?): AnkiConvertResult` converts the parsed data.

`AnkiConvertOptions` fields: `deckId`, `deckName`, `importScheduling`, `frontFieldIndex`, `backFieldIndex`, `useMultipleChoice?` (optional, default false).

`AnkiConvertResult` fields: `deck` (PersonalDeck), `reviewStates` (ReviewState[]), `distractorStats?` (only when `useMultipleChoice` is true — see below).

- HTML tags stripped from field values via `stripHtml()` (handles tags, common entities, and Anki `[sound:...]` syntax).
- Anki sound references (`[sound:filename.mp3]`) are stripped silently — audio playback is not supported.
- Each regular (Basic) note becomes a `DeckFact` with `quizResponseMode: 'typing'` (no distractors).
- Cloze notes (model `type=1`) are expanded: one fact per unique cloze index within the note. See Cloze Deletions below.
- Fact ID: `anki_${note.guid}` for Basic notes, `anki_${note.guid}_c${index}` for cloze facts — GUIDs from Anki ensure stable IDs across re-imports.
- Notes with empty front or back fields after HTML stripping are skipped.
- Chain theme IDs assigned in round-robin (0–5) across all facts.
- A single answer type pool `anki_default` is created covering all facts.
- If `importScheduling: true`, each card's scheduling is mapped to a `ReviewState` (see FSRS Mapping below).
- If `media` is provided and a note's front field contains `<img src="filename">` tags that reference files present in the media map, the fact receives `imageAssetPath: 'anki-media://${deckId}/${filename}'` and `quizMode: 'image_question'`.

The wizard then calls:
- `storeMedia(deckId, filename, bytes)` from `ankiMediaStore.ts` for each file in the media map.
- `savePersonalDeck(deck)` — persists to `PlayerSave.personalDecks` and registers in memory immediately.
- `mergeReviewStates(reviewStates)` — merges scheduling into `PlayerSave.reviewStates` (existing states for same `factId` are replaced).
- `registerPersonalDecks()` — re-registers all personal decks so the session can access the new one.
- `StudyTempleScreen` switches the active tab to "My Decks".

---

## Cloze Deletions

Anki cloze notes use `{{cN::answer}}` or `{{cN::answer::hint}}` syntax where N is the cloze index.

`parseClozeNote(noteGuid, fields, frontFieldIndex, factIndex)` generates one fact per unique cloze index:

- **quizQuestion**: The front field text with `{{cN::answer}}` replaced by `[___]` (or `[hint]` if a hint is present). All other cloze markers are replaced with just their answer text (revealed).
- **correctAnswer**: The answer text inside `{{cN::answer}}` for this index.
- **factId**: `anki_${noteGuid}_c${clozeIndex}` — stable across re-imports.
- **quizResponseMode**: always `'typing'` (cloze answers are always typed).

Example with input `"{{c1::Paris}} is the capital of {{c2::France}}"`:

| Card | quizQuestion | correctAnswer |
|------|-------------|---------------|
| c1 | `[___] is the capital of France` | `Paris` |
| c2 | `Paris is the capital of [___]` | `France` |

---

## Media Files

### Import

`parseApkg()` extracts media files from the `.apkg` archive. The Anki format stores:
- `media` — a JSON object mapping integer string keys to original filenames: `{"0": "image.jpg", "1": "audio.mp3"}`
- Actual file contents stored under the integer keys: `0`, `1`, etc.

Extracted media is returned as `AnkiImportData.media: Map<string, Uint8Array>` keyed by original filename.

During `ankiToPersonalDeck()`, image references in note fields (`<img src="image.jpg">`) are detected before HTML stripping. If the referenced file exists in the media map, the fact gets:
- `imageAssetPath: 'anki-media://${deckId}/${filename}'`
- `quizMode: 'image_question'`

Image bytes are persisted to IndexedDB via `ankiMediaStore.storeMedia()`.

### Export

`createApkg(options)` accepts an optional `media?: Map<string, Uint8Array>` parameter. If provided, media files are bundled into the ZIP under integer key names with the Anki manifest format.

### Media Store (`ankiMediaStore.ts`)

IndexedDB-backed store for imported media files. Keys are `${deckId}/${filename}`.

| Function | Description |
|---|---|
| `storeMedia(deckId, filename, data)` | Persist raw bytes for a media file |
| `getMedia(deckId, filename)` | Retrieve bytes, or null if not found |
| `deleteMediaForDeck(deckId)` | Remove all media for a deck (call on deck deletion) |
| `getMediaUrl(deckId, filename)` | Create a blob object URL (caller must `URL.revokeObjectURL()`) |
| `resolveAnkiMediaUri(uri)` | Resolve `anki-media://deckId/filename` URIs to blob URLs |

---

## Export Flow

Triggered from **DeckDetailModal** via the "Export to Anki" button (prop `onExportAnki`), which mounts `AnkiExportWizard`.

### Options

- **Include review progress** — checked by default; fetches matching `ReviewState` objects from `PlayerSave.reviewStates` via `getReviewStatesForDeck()`.
- **Include only due/overdue cards** — unchecked by default; when checked, filters facts to those whose `ReviewState.due` is in the past.

### Generation

`createApkg(options: CreateApkgOptions): Promise<Uint8Array>` builds the `.apkg`:

1. Opens a fresh in-memory SQLite database with `sql.js`.
2. Creates the full Anki schema: `col`, `notes`, `cards`, `revlog`, `graves` tables plus standard indexes.
3. Inserts a `col` row with a "Basic" note type (Front + Back fields) and one deck config entry.
4. For each fact: inserts a note row (`flds = front \x1f back`, SHA-1 `csum` of the sort field) and a card row.
5. Card scheduling: if a `ReviewState` exists for the fact, maps FSRS state back to Anki fields (see FSRS Mapping); otherwise cards are inserted as new (type=0, queue=0).
6. If `media` is provided, adds files to the ZIP with integer-key names and includes the manifest JSON.
7. Exports the SQLite DB to bytes with `db.export()`, then ZIPs with `collection.anki2` + `media`.
8. Returns `Uint8Array` of the ZIP.

The wizard triggers a browser download via `URL.createObjectURL(new Blob([bytes]))`.

Facts are sourced via `getCuratedDeckFacts(deckId)` (curated decks) with fallback to `getPersonalDeckData(deckId)?.facts` (personal decks).

---

## FSRS Mapping

Anki uses SM-2 scheduling; the game uses FSRS. The mapping is a best-effort approximation.

### Import (Anki → Recall Rogue)

| Anki field (cards table) | Recall Rogue (ReviewState) | Transform |
|---|---|---|
| `type` | `state` / `cardState` | 0→new, 1→learning, 2→review, 3→relearning |
| `factor` | `easeFactor` | Permille ÷ 1000 (2500→2.5). Defaults to 2.5 if zero. |
| `ivl` (positive) | `interval` | Days direct. Negative `ivl` (seconds, learning cards) clamped to 0. |
| `ivl` (positive) | `stability` | Review interval ≈ FSRS stability in days. Clamped at 0.1 minimum. |
| `factor` → mapped | `difficulty` | Ease 1.3–2.5 inverted to 1–10: `10 - ((ease - 1.3) / 1.2) * 9` |
| `reps` | `reps`, `repetitions`, `totalAttempts` | Direct |
| `lapses` | `lapses`, `lapseCount` | Direct. `isLeech = lapses >= 8`. |
| `due` (type=0) | `due` / `nextReviewAt` | Now (new cards are always due immediately) |
| `due` (type=1/3) | `due` / `nextReviewAt` | `due * 1000` (Anki stores epoch seconds; game uses ms) |
| `due` (type=2) | `due` / `nextReviewAt` | Now (Anki review `due` is a day offset from collection creation, unresolvable without the collection timestamp) |

Additional computed fields:
- `lastReviewAt` = now minus `interval` days (approximation).
- `totalCorrect` = `reps - lapses` (clamped at 0).
- `retrievability` = 0.9 for review cards, 0 otherwise.

### Export (Recall Rogue → Anki)

| Recall Rogue (ReviewState) | Anki field (cards table) | Transform |
|---|---|---|
| `cardState` | `type`, `queue` | new→0, learning→1, review→2, relearning→3 |
| `easeFactor` | `factor` | `round(easeFactor * 1000)` (2.5→2500 permille) |
| `interval` | `ivl` | `round(interval)` days |
| `reps` / `repetitions` | `reps` | Direct |
| `lapses` / `lapseCount` | `lapses` | Direct |
| `nextReviewAt` (learning/relearning) | `due` | `floor(nextReviewAt / 1000)` (ms→epoch seconds) |
| `nextReviewAt` (review) | `due` | 0 (day-offset form unresolvable; Anki will treat as overdue) |

---

## Personal Deck Storage

Personal decks extend the `CuratedDeck` interface with extra fields:

| Field | Type | Description |
|---|---|---|
| `source` | `'anki_import'` | How the deck was created |
| `importedAt` | `number` | Timestamp (ms) when the deck was imported |
| `ankiDeckName` | `string` | Original Anki deck name |
| `cardCount` | `number` | Total card count from the Anki collection |

Storage path in `PlayerSave`:

```
PlayerSave.personalDecks: PersonalDeck[]   // persisted via saveService
PlayerSave.reviewStates: ReviewState[]     // FSRS scheduling for all decks (curated + personal)
```

### In-Memory Registration

At app startup (after `initPlayer()`), `registerPersonalDecks()` is called:

1. Clears the `personalDeckMap` (in-memory Map).
2. For each `PersonalDeck`:
   - Registers metadata in `deckRegistry` (for deck selection UI) with domain `'personal'`.
   - Registers full deck data in `curatedDeckStore` via `registerPersonalDeckInStore()` (so the quiz engine resolves facts).
   - Registers fact IDs in `deckFactIndex` via `registerDeckFacts()`.
3. Personal decks appear under the "My Decks" sidebar tab in `StudyTempleScreen` (detected when any deck has `domain === 'personal'`).

The quiz engine accesses personal deck facts through the same `getCuratedDeckFacts()` path used for curated decks — no special handling needed at the quiz layer.

---

## Anki .apkg Format Reference

An `.apkg` file is a standard ZIP archive containing:

| File | Description |
|---|---|
| `collection.anki2` | SQLite database (schema v11 for Anki 2.0+ compatibility) |
| `collection.anki21` | SQLite database (newer Anki versions — parser prefers this) |
| `media` | JSON object mapping numeric keys to original filenames (e.g., `{"0":"image.jpg"}`) |
| `0`, `1`, ... | Actual media file contents stored under their integer key names |

Key SQLite tables in the collection:

| Table | Key columns | Notes |
|---|---|---|
| `col` | `models` (JSON), `decks` (JSON), `dconf` (JSON) | Single row; all metadata as JSON blobs |
| `notes` | `id`, `guid`, `mid` (model id), `flds`, `tags` | `flds` fields separated by `\x1f` (char 31) |
| `cards` | `id`, `nid` (note id), `type`, `queue`, `due`, `ivl`, `factor`, `reps`, `lapses` | One row per card template per note |
| `revlog` | `cid`, `ease`, `ivl`, `factor`, `time` | Review history; not read or written by the game |
| `graves` | `oid`, `type` | Deleted item tracking; created empty on export |

The game export always uses `collection.anki2` (schema v11) for maximum Anki version compatibility. GUIDs are generated via `generateGuid()` — 8 characters from base-62 charset using `crypto.getRandomValues()`.

---

## Distractor Generation

When `useMultipleChoice: true` is passed to `ankiToPersonalDeck()`, the pool-based distractor generator (`ankiDistractorGenerator.ts`) runs after all facts are created.

### Algorithm

1. **Bucket grouping** — All non-cloze facts are grouped by a composite key: `${lengthBucket}_${answerType}`.
   - Length buckets: `short` (1–3 words), `medium` (4–8 words), `long` (9+ words).
   - Answer types: `date` (contains a 4-digit year), `number` (pure digits), `proper` (≥ 50 % capitalised words), `general` (everything else). `date` is checked before `number` so bare years like "1969" are classed as dates.

2. **Candidate selection** — For each fact, up to 8 candidates are drawn from its bucket, then from neighbour buckets in priority order (same type/different length → same length/different type → everything else) if the primary bucket has fewer than 8 other answers.

3. **Quality filters** — A candidate is rejected if:
   - It matches the fact's `correctAnswer` or any `acceptableAlternatives` (case-insensitive).
   - Either string is a substring of the other.
   - Levenshtein edit distance < 2 (avoids near-typo variants).

4. **Mode assignment** — Facts that receive ≥ 4 candidates get `quizResponseMode: 'choice'`. Facts with fewer candidates stay `quizResponseMode: 'typing'`. Cloze facts (ID ending in `_cN`) are always typing-only.

### Return value

`AnkiConvertResult.distractorStats` (populated only when `useMultipleChoice` is true):

| Field | Type | Description |
|---|---|---|
| `factsWithDistractors` | `number` | Facts that received ≥ 4 distractors and were set to choice mode |
| `factsTypingOnly` | `number` | Facts that stayed in typing mode (too few neighbours or cloze) |
| `avgDistractors` | `number` | Average distractor count across facts that have them |


---

## Limitations

| Limitation | Detail |
|---|---|
| Audio | `[sound:filename]` references are stripped from text fields on import. Audio playback is not supported. |
| Multi-card notes | Only the first card template (`ord=0`) per note is imported. Notes with multiple card types lose the extra cards. |
| Distractor quality | Pool-based distractors cross-pollinate answers within the deck. Very small decks (< 5 facts with enough pool neighbours) may have some facts remain in typing mode. Cloze deletion facts are always typing-only. |
| Review due (type=2) | Anki stores review card due dates as a day offset from collection creation. Without the collection creation timestamp, the game cannot reconstruct the exact date — all review cards are treated as due on import. |
| No sync | Import/export is a one-time file transfer. There is no live sync between the game and Anki. |

---

## Key Files

| File | Role |
|---|---|
| `src/services/ankiService.ts` | `parseApkg()`, `ankiToPersonalDeck()`, `createApkg()`, `stripHtml()`, `extractImgFilenames()`, `parseClozeNote()`, `generateGuid()`, `getReviewStatesForDeck()`, `getCuratedDeckFacts()` |
| `src/services/ankiDistractorGenerator.ts` | `generateDistractorsForDeck()` — pool-based cross-pollination distractor generator for imported decks |
| `src/services/ankiMediaStore.ts` | IndexedDB media store: `storeMedia()`, `getMedia()`, `deleteMediaForDeck()`, `getMediaUrl()`, `resolveAnkiMediaUri()` |
| `src/services/personalDeckStore.ts` | `savePersonalDeck()`, `deletePersonalDeck()`, `getPersonalDecks()`, `getPersonalDeckData()`, `registerPersonalDecks()`, `mergeReviewStates()` |
| `src/ui/components/AnkiImportWizard.svelte` | 4-step import wizard UI (upload → preview → configure → progress) |
| `src/ui/components/AnkiExportWizard.svelte` | Single-screen export dialog |
| `src/data/curatedDeckTypes.ts` | `PersonalDeck` interface extending `CuratedDeck` |
| `src/data/types.ts` | `PlayerSave.personalDecks` field, `ReviewState` interface |
| `src/ui/components/StudyTempleScreen.svelte` | Mounts both wizards; calls `registerPersonalDecks()` on mount and after import |
| `src/ui/components/DeckDetailModal.svelte` | "Export to Anki" button via `onExportAnki` prop |
| `src/services/workshopService.ts` | Workshop serialize/deserialize; stub API functions for publish/subscribe/browse |
| `src/ui/components/WorkshopBrowser.svelte` | Workshop browser UI — deck grid with subscribe/publish; shows mock data until Tauri UGC commands wired |

---

## Steam Workshop Integration

Personal decks (imported from Anki or manually created) can be shared via Steam Workshop. The system is designed in two layers:

### Wire format — WorkshopDeckPackage

Serialized as `deck.json` inside the Workshop item's content directory. Fields:

| Field | Type | Description |
|---|---|---|
| `version` | `1` | Schema version (bump if breaking changes added) |
| `deck.id` | `string` | Source deck ID |
| `deck.name` | `string` | Deck display name |
| `deck.facts` | `Array` | Minimal fact set: id, quizQuestion, correctAnswer, explanation, distractors, difficulty, funScore |
| `reviewStates` | optional Array | FSRS states — only included when author selects "Share progress" |
| `metadata.exportedAt` | `number` | Unix ms timestamp |
| `metadata.sourceApp` | `"recall-rogue"` | Origin guard |
| `metadata.ankiDeckName` | `string?` | Original Anki deck name if applicable |

### Serialization (`serializeDeckForWorkshop`)

- Pure function in `workshopService.ts` — no side effects.
- Strips `answerTypePools`, `synonymGroups`, `questionTemplates`, `difficultyTiers`, and all internal fields.
- If `includeScheduling: true`, bundles review states filtered to facts in the deck.
- Review state fields serialized: `factId`, `state`, `reps`, `lapses`, `interval`, `stability`, `difficulty`, `due`, `lastReview`.

### Deserialization (`deserializeWorkshopDeck`)

- Pure function — no side effects.
- Prefixes all fact IDs with `ws_` to avoid collisions with local anki-imported facts.
- Creates a single `workshop_default` answer type pool.
- All imported facts default to `quizResponseMode: 'typing'` (no distractors guaranteed).
- Maps serialized review state fields back to `ReviewState` including `lapseCount`, `isLeech`, `stability`.
- Marks `isLeech: true` when `lapses >= 8`.

### Workshop API functions (stubbed)

All `async` functions in `workshopService.ts` check `isWorkshopAvailable()` first. On non-Tauri builds they return `{ error: 'Workshop not available' }` or empty arrays immediately.

| Function | Status | Notes |
|---|---|---|
| `publishToWorkshop()` | TODO stub | Needs `steam_ugc_create_item` Tauri command |
| `subscribeToWorkshopDeck()` | TODO stub | Needs `steam_ugc_subscribe` + `fs_read_save` |
| `browseWorkshopDecks()` | TODO stub | Needs `steam_ugc_browse` Tauri command |
| `getMyPublishedDecks()` | TODO stub | Needs `steam_ugc_get_my_items` Tauri command |
| `updateWorkshopDeck()` | TODO stub | Needs `steam_ugc_update_item` Tauri command |

See each function's inline comment block for the intended Tauri implementation.

### UI integration

- **WorkshopBrowser.svelte** — Standalone browse/subscribe/publish UI. Shows mock data when Workshop is unavailable (non-Steam build). Publish dialog collects title, description, tags.
- **StudyTempleScreen.svelte** — "Workshop" tab added to sidebar after "My Decks". When selected, renders `WorkshopBrowser` instead of the deck grid. Subscribing to a Workshop deck calls `registerPersonalDecks()` and switches to the "My Decks" tab.

### Roadmap (Tauri UGC commands needed)

Six Rust commands need to be implemented in `src-tauri/src/steam.rs`:

1. `steam_ugc_create_item(title, description, tags, contentJson)` → `{ workshopId }`
2. `steam_ugc_update_item(workshopId, title, description, tags, contentJson)` → `{ success }`
3. `steam_ugc_subscribe(workshopId)` → local content path string
4. `steam_ugc_browse(query?, tags?, page)` → `WorkshopDeck[]`
5. `steam_ugc_get_my_items()` → `WorkshopDeck[]`
6. `steam_ugc_get_item_path(workshopId)` → local content directory path

Once these are wired, remove the stub `console.warn` lines and uncomment the `invoke` calls in each function body.

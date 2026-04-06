---
name: anki-sync
description: Manage Anki .apkg import/export — import decks, export with FSRS stats, debug personal deck issues
triggers:
  - anki
  - .apkg
  - import deck
  - export deck
  - personal deck
---

# /anki-sync — Anki Import/Export Manager

## What This Skill Does

Manages the bidirectional Anki integration system:
- **Import**: Parse .apkg files, map Anki notes to DeckFact, preserve FSRS scheduling
- **Export**: Generate .apkg from any deck with full review state
- **Debug**: Diagnose personal deck issues, fix scheduling mismatches
- **Workshop**: Future Steam Workshop integration for sharing personal decks

## Key Files

| File | Role |
|------|------|
| `src/services/ankiService.ts` | Core import/export logic — `parseApkg()`, `createApkg()`, `ankiToPersonalDeck()`, `getReviewStatesForDeck()` |
| `src/services/personalDeckStore.ts` | Personal deck persistence — `savePersonalDeck()`, `registerPersonalDecks()`, `mergeReviewStates()` |
| `src/ui/components/AnkiImportWizard.svelte` | 4-step import wizard UI (upload → preview → configure → progress) |
| `src/ui/components/AnkiExportWizard.svelte` | Single-screen export dialog |
| `src/data/curatedDeckTypes.ts` | `PersonalDeck` interface |
| `src/data/types.ts` | `PlayerSave.personalDecks` and `ReviewState` |
| `docs/content/anki-integration.md` | Full documentation |

## When to Use

- User asks about importing Anki decks or .apkg files
- User wants to export decks for use in Anki
- Debugging personal deck issues (not showing in library, scheduling wrong)
- Adding new import formats or improving field mapping
- Planning Steam Workshop deck sharing features

## Workflow

### Import Issues

1. Verify `registerPersonalDecks()` is called in `StudyTempleScreen.svelte` on mount and after the `onimport` callback fires.
2. Check `PlayerSave.personalDecks` in localStorage — confirm the deck is persisted (key is `rr_save_<profileId>` or `rr_save`).
3. Confirm the `.apkg` contains `collection.anki2` or `collection.anki21` (not a custom Anki export format).
4. Check field mapping: if front or back field is empty after `stripHtml()`, the note is silently skipped — verify `frontFieldIndex` and `backFieldIndex` point to the correct fields.
5. Confirm `sql-wasm.wasm` is accessible at `/sql-wasm.wasm` (required by both ankiService and curatedDeckStore).

### Export Issues

1. Verify facts are accessible — `getCuratedDeckFacts(deckId)` for curated decks, `getPersonalDeckData(deckId)?.facts` for personal. Both return empty array if deck not loaded.
2. Confirm review states exist in `PlayerSave.reviewStates` with matching `factId` values (`anki_<guid>` format for imported facts).
3. Verify the generated `.apkg` opens in Anki: it uses schema v11 (`col.ver = 11`), which is compatible with Anki 2.0+.
4. If the export produces 0 cards, check that `getCuratedDeckFacts` is loading before the wizard mounts — the `curatedDeckStore` lazy-loads facts; a race condition can leave the store empty.

### Adding New Features

1. Read `docs/content/anki-integration.md` for current state before modifying.
2. **Media support**: Extend `parseApkg()` to extract the `media` JSON map and read binary entries from the ZIP. Store images in IndexedDB keyed by hash. Render in facts via `imageAssetPath` pointing to an object URL.
3. **Cloze support**: Detect cloze models (`model.type === 1`). Parse `{{c1::text}}` syntax. Convert each cloze deletion to a separate `DeckFact` with the deletion as the answer and surrounding context as the question.
4. **Distractor generation**: After import, spawn a content-agent to generate 3–4 distractors per fact. Switch `quizResponseMode` from `'typing'` to `'choice'` once distractors are generated.
5. **Steam Workshop**: Serialize `PersonalDeck` to a shareable JSON format (strip fact IDs back to human-readable strings). Upload to Steam UGC via Tauri IPC. Downloading should call `savePersonalDeck()` after deserialization.

## FSRS Mapping Reference

### Import (Anki → game)

| Anki cards column | ReviewState field | Transform |
|---|---|---|
| `type` | `state` / `cardState` | 0→new, 1→learning, 2→review, 3→relearning |
| `factor` | `easeFactor` | `factor / 1000` (2500→2.5 decimal) |
| `ivl` (positive) | `interval`, `stability` | Days direct; `stability` min-clamped at 0.1 |
| `factor` (inverted) | `difficulty` | Ease 1.3–2.5 → difficulty 1–10 (inverted scale) |
| `reps` | `reps`, `repetitions`, `totalAttempts` | Direct |
| `lapses` | `lapses`, `lapseCount` | Direct; `isLeech = lapses >= 8` |
| `due` (type 1/3) | `due` | `due * 1000` (seconds → milliseconds) |
| `due` (type 2) | `due` | `Date.now()` — day-offset form unresolvable without collection creation timestamp |

### Export (game → Anki)

| ReviewState field | Anki cards column | Transform |
|---|---|---|
| `cardState` | `type`, `queue` | new→0, learning→1, review→2, relearning→3 |
| `easeFactor` | `factor` | `round(easeFactor * 1000)` (2.5→2500) |
| `interval` | `ivl` | `round(interval)` days |
| `reps` / `repetitions` | `reps` | Direct |
| `lapses` / `lapseCount` | `lapses` | Direct |
| `nextReviewAt` (learning) | `due` | `floor(nextReviewAt / 1000)` epoch seconds |
| `nextReviewAt` (review) | `due` | 0 (treated as overdue by Anki) |

## Known Limitations

- No media (images, audio) — text only
- Cloze deletions imported as raw `{{c1::...}}` text
- Only `ord=0` card template imported per note
- Imported cards always start in typing mode (no auto-generated distractors)
- Anki review card due dates cannot be precisely reconstructed (all treated as due now)

# AR-85: Anki Deck Import with Self-Graded Quiz

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §14 (modified — see notes below)
> **Priority:** FEATURE (post-launch or late EA)
> **Complexity:** Large
> **Dependencies:** None (standalone feature)

## IMPORTANT: Deviation from Master Spec

The master spec (§14) suggests generating distractors from other cards in the same deck. **This is REJECTED per project rules.** Instead, Anki-imported facts use a **self-graded quiz system** (Anki-style) with NO multiple-choice distractors. The player sees the question, mentally recalls the answer, reveals it, and self-grades.

## Context

Players import existing Anki decks (.apkg files). Anki cards become facts in the game's fact pool. Instead of multiple-choice quiz, these facts use Anki-style self-graded recall: see question → think → reveal answer → rate yourself (Wrong / Hard / Good / Easy). The rating determines card effect power and FSRS scheduling.

## Directive

### Step 1: .apkg Parser

**File:** NEW `src/services/ankiImportService.ts`

Anki .apkg files are ZIP archives containing:
- `collection.anki2` or `collection.anki21` — SQLite database
- Media files (numbered files)

Use `sql.js` (browser SQLite) to read the database.

Key tables:
- `notes` — content (fields separated by `\x1f`). Field 1 = front, Field 2 = back.
- `cards` — card instances linked to notes
- `revlog` — review history (timestamps, intervals, ease factors)

```typescript
interface AnkiNote {
  id: number;
  fields: string[];   // split by \x1f
  tags: string[];
}

async function parseApkg(file: File): Promise<AnkiNote[]> {
  // 1. Unzip file
  // 2. Extract collection.anki2
  // 3. Read notes table via sql.js
  // 4. Parse fields, tags
  // 5. Return parsed notes
}
```

### Step 2: Note-to-Fact Conversion

**File:** `src/services/ankiImportService.ts`

```typescript
interface ImportedFact {
  id: string;                    // 'anki-{noteId}'
  type: 'anki_recall';          // New fact type for self-graded
  domain: 'Anki';
  subdomain: string;            // Anki deck name
  categoryL1: 'anki_import';
  categoryL2: string;           // 'anki_{deckName}'
  quizQuestion: string;         // Front of card (Field 1)
  correctAnswer: string;        // Back of card (Field 2)
  distractors: [];              // EMPTY — no distractors for Anki facts
  difficulty: number;           // From Anki ease factor
  tags: string[];               // Anki tags
  ankiEaseFactor: number;       // Preserved for reference
  ankiInterval: number;         // Preserved for reference
  fsrsTier: number;             // Converted from review history
}
```

**FSRS Tier Conversion from Anki intervals:**

| Anki Interval | FSRS Tier | Rationale |
|---------------|-----------|-----------|
| 0-7 days | Tier 1 (Learning) | New or barely learned |
| 8-30 days | Tier 2a (Familiar) | Medium retention |
| 31-90 days | Tier 2b (Confident) | Good retention |
| 91+ days | Tier 3 (Mastered) | Long-term memory |

### Step 3: Self-Graded Quiz Component

**File:** NEW `src/ui/components/AnkiQuizOverlay.svelte`

This is a SEPARATE quiz UI from the standard multiple-choice QuizOverlay:

```
Phase 1: QUESTION
┌──────────────────────┐
│   [Question Text]    │
│   (Front of card)    │
│                      │
│   [Reveal Answer]    │
│   (tap/click/Space)  │
└──────────────────────┘

Phase 2: ANSWER REVEALED
┌──────────────────────┐
│   [Question Text]    │
│   ────────────────   │
│   [Answer Text]      │
│   (Back of card)     │
│                      │
│ [Wrong] [Hard] [Good] [Easy] │
│  (1)    (2)    (3)    (4)   │
└──────────────────────┘
```

- Timer still applies (same floor-based dynamic timer)
- If timer expires before reveal: treated as "Wrong"
- If timer expires after reveal but before grading: treated as "Hard"

### Step 4: Self-Grade to Charge Multiplier Mapping

| Self-Grade | Charge Multiplier | FSRS Impact | Combat Effect |
|------------|------------------|-------------|---------------|
| Wrong | 0.6× (same as wrong answer) | Reset consecutive, lower stability | Minimal damage |
| Hard | 1.5× | Slight stability gain | Moderate damage |
| Good | 2.5× (same as Tier 1 correct) | Normal stability gain | Good damage |
| Easy | 3.5× (same as Tier 2b correct) | Large stability gain | Maximum damage |

Chain behavior: Wrong breaks chain. Hard/Good/Easy all continue chain.

### Step 5: Integration with Card Combat

**File:** `src/services/cardEffectResolver.ts` (or wherever quiz type is checked)

When a card's bound fact has `type: 'anki_recall'`:
- Show `AnkiQuizOverlay` instead of `QuizOverlay`
- Map self-grade to multiplier per table above
- Feed result to FSRS scheduler as normal

Quick Play behavior: unchanged (1.0× base, no quiz).

### Step 6: Import UI

**File:** NEW `src/ui/components/AnkiImportScreen.svelte`

- File picker for .apkg files
- Import progress bar
- Import summary:
  - Total notes found
  - Notes imported successfully
  - Notes skipped (image-only, invalid)
  - FSRS tier distribution chart
- Option to name the imported deck
- Imported decks appear as selectable domains at run start

### Step 7: Edge Cases

- **Multi-field notes:** Field 1 = question, Field 2 = answer, ignore rest
- **Image-only cards:** Skip. Show count of skipped cards.
- **Cloze deletions:** `{{c1::answer}}` → question = text with blank, answer = cloze content
- **HTML in cards:** Strip tags, preserve text content
- **Re-import:** Update existing facts by Anki note ID, merge review history, no duplicates
- **Empty decks:** Show error message
- **Very large decks (10k+ notes):** Progress bar, chunked processing

### Step 8: Storage

Imported decks stored locally (IndexedDB or localStorage):
- Not in cloud fact database
- Not synced to server
- Portable via export function (future)

### Step 9: Verification

- [ ] .apkg file parses correctly (test with real exports)
- [ ] Notes convert to facts with correct tier mapping
- [ ] Self-graded quiz displays correctly
- [ ] Timer applies to self-graded quiz
- [ ] Self-grade maps to correct multiplier
- [ ] Chain continues on Hard/Good/Easy, breaks on Wrong
- [ ] Imported deck appears as domain option
- [ ] Re-import updates, doesn't duplicate
- [ ] Cloze deletion parsing works
- [ ] HTML stripping works
- [ ] Image-only cards skipped with count

## Files Affected

| File | Action |
|------|--------|
| `src/services/ankiImportService.ts` | NEW |
| `src/ui/components/AnkiQuizOverlay.svelte` | NEW |
| `src/ui/components/AnkiImportScreen.svelte` | NEW |
| `src/services/cardEffectResolver.ts` | MODIFY (anki_recall type handling) |
| `src/data/card-types.ts` | MODIFY (add 'anki_recall' fact type) |
| `package.json` | MODIFY (add sql.js dependency) |

## GDD Updates

Add new section to `docs/GAME_DESIGN.md`: "§38. Anki Deck Import [PLANNED — Future]" documenting:
- Import flow and .apkg parsing
- Self-graded quiz system (Wrong/Hard/Good/Easy)
- Grade-to-multiplier mapping
- FSRS tier conversion table
- No distractors — self-recall only
- Chain behavior with self-graded cards

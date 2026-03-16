# AR-48: Hide Empty Subcategories in Deck Builder

**Status:** Pending
**Created:** 2026-03-16
**Estimated complexity:** Small (UI-only change)

---

## Problem

The Deck Builder shows subcategory checkboxes (e.g., "Grammar", "Kanji", "Kana") even when there are zero facts for that subcategory. Selecting them does nothing and confuses users.

This affects Japanese (shows Kanji/Grammar/Kana with 0 facts) and could affect any future language or knowledge domain with empty subcategories.

## Solution

Before rendering subcategory checkboxes, query the actual fact count per subcategory. Only show subcategories that have ≥1 fact in the DB.

## TODO

1. [ ] For non-Japanese languages: in `getLanguageSubcategoryTokens()` or at render time, filter `subdecks` to only include tokens that have ≥1 matching fact in the DB
2. [ ] For Japanese: filter out `JAPANESE_DECK_GROUPS` entries (kana, per-level vocabulary/kanji/grammar) that have 0 matching facts
3. [ ] For knowledge domains: `getDomainSubcategories()` already returns counts — filter out entries where `count === 0`
4. [ ] Verify: Japanese shows only N5-N1 Vocabulary (no Kanji/Grammar/Kana checkboxes)
5. [ ] Verify: all other languages only show levels that have facts

## Acceptance Criteria

- [ ] No subcategory with 0 facts is shown in the Deck Builder
- [ ] Japanese shows only "Vocabulary" per JLPT level (no empty Kanji/Grammar/Kana)
- [ ] Knowledge domains don't show empty subcategories
- [ ] Typecheck passes

## Files Affected

- `src/ui/components/DeckBuilder.svelte` — filter rendering
- `src/services/presetSelectionService.ts` — possibly add count helper
- `src/services/domainSubcategoryService.ts` — already has counts, may need filter

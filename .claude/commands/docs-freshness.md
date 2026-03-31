---
description: Weekly documentation freshness audit — checks docs against actual code
---

Run a documentation freshness audit with 3 parallel subagents:

## Subagent 1 — Architecture Check
- Read `docs/architecture/` (all sub-files) and `docs/INDEX.md`
- Explore `src/services/`, `src/game/scenes/`, `src/ui/stores/`
- Compare: are all services documented? Any new ones missing? Any documented ones deleted?
- Report discrepancies with specific file paths

## Subagent 2 — Build & Command Check
- Read `CLAUDE.md` "Commands" section
- Execute: `npm run typecheck`, `npm run build`, `npx vitest run --reporter=verbose 2>&1 | tail -5`
- Verify all documented commands still work
- Report any failures or outdated command references

## Subagent 3 — Mechanics Spot-Check
- Read `docs/mechanics/combat.md` (or equivalent)
- Read `src/services/turnManager.ts` and `src/data/balance.ts`
- Verify: do damage values, AP costs, surge timing, chain multipliers in docs match code?
- Read `docs/mechanics/cards.md` and compare against `src/data/mechanics.ts`
- Report mismatches with exact values (doc says X, code says Y)

## Output Format

```
# Docs Freshness Report — [date]

## ✅ PASS
- [items verified correct]

## ⚠️ STALE (docs exist but wrong)
- [file:section] Doc says X, code says Y

## ❌ MISSING (code exists, no doc)
- [source file] needs documentation in [doc location]

## 🗑️ DEAD (doc exists, code removed)
- [doc file:section] references removed code

## Action Items
1. [specific fix needed]
```

Do NOT auto-fix anything. Report only.

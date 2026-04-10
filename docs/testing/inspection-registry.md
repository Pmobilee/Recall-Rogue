# Inspection Registry

> **Purpose:** Canonical reference for `data/inspection-registry.json` — how it is structured, how deck-specific tracking works, and the agent lock protocol that prevents parallel agents from stomping on each other's work.
> **Last verified:** 2026-04-10
> **Source files:** `data/inspection-registry.json`, `scripts/registry/sync.ts`, `scripts/registry/updater.ts`, `scripts/registry/stale.ts`, `scripts/registry/sources.ts`

---

## Overview

The inspection registry is the single source of truth for the testing status of every game element. It tracks 500+ elements across 15 tables (version 5). The registry is auto-generated from source — never edit it by hand.

```bash
npm run registry:sync    # Rebuild from source after adding/removing elements
npm run registry:stale   # Show elements that are overdue for inspection
```

Skills that auto-stamp dates after completing: `/inspect`, `/visual-inspect`, `/ux-review`, `/balance-sim`, `/strategy-analysis`, `/rogue-brain`, `/llm-playtest`, `/quick-verify`, `/smart-test`.

---

## Tables Overview

| Table | Source | Count (approx) | Mode |
|-------|--------|----------------|------|
| `cards` | `src/data/mechanics.ts` | ~98 | `array` |
| `enemies` | `src/data/enemies.ts` | ~89 | `array` |
| `relics` | `src/data/relics/index.ts` | ~90 | `array` |
| `statusEffects` | `src/data/statusEffects.ts` | ~11 | `type_union` |
| `screens` | `src/ui/stores/gameState.ts` | ~37 | `type_union` |
| `domains` | `src/data/domainMetadata.ts` | ~15 | `record` |
| `specialEvents` | `src/data/specialEvents.ts` | ~5 | `array` |
| `mysteryEffects` | `src/data/specialEvents.ts` | ~3 | `array` |
| `chainTypes` | `src/data/chainTypes.ts` | ~6 | `array` |
| `decks` | `data/decks/*.json` (_wip excluded) | ~99 | `json_glob` |
| `ascensionLevels` | `src/services/ascension.ts` | ~20 | `array` |
| `keywords` | `src/data/keywords.ts` | ~10 | `record` |
| `synergies` | `src/data/synergies.ts` | ~27 | `record` |
| `roomThemes` | `src/data/roomAtmosphere.ts` | ~5 | `record` |
| `cardTypes` | `src/data/card-types.ts` | ~6 | `type_union` |

---

## Per-Element Fields

Every registry entry has a common field set:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier matching the source (deck filename stem, mechanic id, etc.) |
| `name` | string | Human-readable display name |
| `category` | string | Category/type (from source data) |
| `description` | string | Short description (first 200 chars from source) |
| `sourceFile` | string | Path to the source file for this element |
| `status` | `"active"` \| `"deprecated"` | Whether element still exists in source |
| `mechanicDate` | ISO date \| `"not_checked"` | Last mechanic inspection |
| `visualDate` | ISO date \| `"not_checked"` | Last visual inspection |
| `uxDate` | ISO date \| `"not_checked"` | Last UX review |
| `balanceDate` | ISO date \| `"not_checked"` | Last balance check |
| `strategyDate` | ISO date \| `"not_checked"` | Last strategy analysis |
| `neuralDate` | ISO date \| `"not_checked"` | Last neural agent run |
| `playtestDate` | ISO date \| `"not_checked"` | Last LLM playtest stamp |
| `lastInspected` | ISO date \| `"not_checked"` | Most recent across all date fields |
| `confidenceLevel` | `"clean"` \| `"confirmed"` \| `"likely"` \| `"possible"` \| `"not_checked"` | Computed from how many of the 7 core date fields are filled |
| `notes` | string | Free-text annotation from most recent inspection |
| `inProgress` | object \| null | Lock object — see Lock Protocol below |

Deck entries additionally carry four deck-specific date fields (see next section).

---

## Decks Table — Specific Fields

Each entry in the `decks` table corresponds to one JSON file in `data/decks/` (files inside `_wip/` subdirectory are excluded). In addition to the common fields above, deck entries carry four stamp fields that track which quality pipeline steps have run:

| Field | Type | Stamped By | Description |
|-------|------|-----------|-------------|
| `lastStructuralVerify` | ISO date \| `"not_checked"` | `scripts/verify-all-decks.mjs` | Pass of all 22 structural quality checks (0 blocking failures required) |
| `lastQuizAudit` | ISO date \| `"not_checked"` | `scripts/quiz-audit.mjs` | Programmatic quiz engine audit (0 FAILs required) |
| `lastLLMPlaytest` | ISO date \| `"not_checked"` | `/llm-playtest` skill | LLM sub-agent played and reviewed quiz quality; batch marked complete |
| `lastTriviaBridge` | ISO date \| `"not_checked"` | `scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs` | Deck successfully bridged to trivia database (knowledge decks only) |

These are automatically stamped when the scripts complete successfully. They can also be stamped manually via the CLI updater.

---

## Stamping Date Fields Manually

```bash
# Stamp a single deck (by ID)
npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastStructuralVerify
npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastQuizAudit
npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastLLMPlaytest --notes "batch:BATCH-2026-04-10-001"
npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastTriviaBridge

# Stamp multiple decks at once (comma-separated)
npx tsx scripts/registry/updater.ts --ids "ancient_rome,ancient_greece" --type lastStructuralVerify

# Stamp all elements in a table
npx tsx scripts/registry/updater.ts --table cards --type mechanicDate

# Stamp with a specific date (YYYY-MM-DD)
npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastQuizAudit --date 2026-04-09

# Valid types: mechanicDate, visualDate, uxDate, balanceDate, strategyDate, neuralDate, playtestDate,
#              lastStructuralVerify, lastQuizAudit, lastLLMPlaytest, lastTriviaBridge
```

---

## Lock Protocol

### Why Locks Exist

Before the lock protocol, two parallel agents could simultaneously playtest or edit the same deck. Results could interleave, date stamps from agent A could be overwritten by agent B before A finished, and the registry would end up with a misleading "just tested" date on a deck that was only half-tested.

Locks are the solution: an agent claims exclusive write access to a registry element before touching it, and releases the lock when done. Other agents that try to work on the same element will see the lock and skip it.

### Lock Object Schema

The `inProgress` field on any registry element holds either `null` (unlocked) or a lock object:

```typescript
{
  agentId: string;              // e.g. "qa-agent-batch-3", "llm-playtest"
  batchId?: string;             // optional batch identifier for grouped operations
  testType: string;             // e.g. "structural-verify", "quiz-audit", "llm-playtest", "trivia-bridge"
  startedAt: string;            // ISO timestamp when lock was acquired
  expectedCompleteBy?: string;  // ISO timestamp (startedAt + ttlHours)
}
```

### CLI Reference — Locks

```bash
# Check if locked — exit 0 = free, exit 1 = locked (lock info printed to stderr)
npm run registry:check-lock -- --ids ancient_rome

# Acquire lock
npm run registry:lock -- --ids ancient_rome --agent llm-playtest --test-type llm-playtest
# With batch id and TTL:
npm run registry:lock -- --ids french_a1_grammar french_a2_grammar \
  --agent content-agent-fr --test-type llm-playtest \
  --batch fr-grammar-pass1 --ttl-hours 6

# Override an active lock (use only when lock is stale/abandoned)
npm run registry:lock -- --ids ancient_rome --agent my-agent --test-type quiz-audit --force

# Release lock
npm run registry:unlock -- --ids ancient_rome
```

All three commands accept multiple `--ids` comma-separated.

### Stale Lock Policy

A lock is **auto-overridable** if `startedAt` is older than `--ttl-hours` (default: 4 hours). The `--lock` command will print a warning and override it automatically. Use `--force` to override an active (non-stale) lock.

### Stale Reporter — IN PROGRESS Section

`npm run registry:stale` output includes an IN PROGRESS section at the top:

```
IN PROGRESS — locked by agents (do NOT start parallel work on these):

  [decks] ancient_rome (Ancient Rome)
    agent='llm-playtest' testType='llm-playtest' batch=B001 startedAt=12m ago expectedDone=2026-04-10T03:00:00
```

Always scan the IN PROGRESS section before picking a deck to test — working on a locked deck wastes effort and may corrupt the other agent's results.

---

## Agent Collaboration Flow

This is the canonical sequence every agent must follow when working on a deck from the registry:

```bash
DECK=ancient_rome
AGENT=qa-agent-$(date +%s)

# 1. Check if already locked
npm run registry:check-lock -- --ids $DECK || { echo "LOCKED — skipping"; exit 0; }

# 2. Acquire lock (TTL = how long you expect the work to take)
npm run registry:lock -- --ids $DECK --agent $AGENT --test-type structural-verify --ttl-hours 2

# 3. Set a trap to guarantee unlock on exit (even on crash)
trap "npm run registry:unlock -- --ids $DECK" EXIT

# 4. Do your work
node scripts/verify-all-decks.mjs  # auto-stamps lastStructuralVerify on success

# 5. Unlock (trap fires on EXIT too — this is belt+suspenders)
npm run registry:unlock -- --ids $DECK
```

**Always use a `trap` in bash scripts.** If your script crashes or is killed, the trap ensures the lock is released. A permanently locked deck blocks all other agents until the TTL expires.

---

## json_glob Mode — How Decks Are Extracted

The `decks` table uses `mode: 'json_glob'` in `scripts/registry/sources.ts`. This is different from all other tables:

- The `sourceFile` is a glob pattern (`data/decks/*.json`) not a single file path
- Files inside `data/decks/_wip/` are excluded
- Each deck gets its own `sourceFile` pointing to its actual `.json` file
- `stale.ts` computes git mod date per-element (using each deck's actual file path) rather than per-source-file
- The `id` is derived from `json.id` field, falling back to the filename stem
- The `category` is derived from `domain/subDomain` fields

To add the `decks` table to stale tracking, `stale.ts` passes each element's individual `sourceFile` to `getGitModDate()` to compute how recently that specific deck was modified.

---

## Full CLI Reference

| Command | Description |
|---------|-------------|
| `npm run registry:sync` | Rebuild the entire registry from source files. Run after adding or removing decks, mechanics, enemies, or relics. Bumps version to 5. |
| `npm run registry:stale` | Show elements overdue for inspection. Includes IN PROGRESS section at top. |
| `npm run registry:lock` | Acquire a lock on one or more elements. Options: `--ids`, `--agent`, `--test-type`, `--batch`, `--ttl-hours`, `--force`. |
| `npm run registry:unlock` | Release a lock on one or more elements. Sets `inProgress` to null. |
| `npm run registry:check-lock` | Exit with code 1 if any of the specified elements are locked. Use in pre-checks before acquiring a lock. |
| `npx tsx scripts/registry/updater.ts --ids X --type Y` | Stamp a date field on one or more elements. |
| `npx tsx scripts/registry/updater.ts --table X --type Y` | Stamp a date field on all elements in a table. |

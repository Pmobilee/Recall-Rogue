# Inspection Registry

> **Purpose:** Canonical reference for `data/inspection-registry.json` — how it is structured, how deck-specific tracking works, and the agent lock protocol that prevents parallel agents from stomping on each other's work.
> **Last verified:** 2026-04-10
> **Source files:** `data/inspection-registry.json`, `scripts/registry-sync.mjs`, `scripts/registry-updater.mjs`, `scripts/registry-lock.mjs`

---

## Overview

The inspection registry is the single source of truth for the testing status of every game element. It tracks 415+ elements across 14 tables. The registry is auto-generated from source — never edit it by hand.

```bash
npm run registry:sync    # Rebuild from source after adding/removing elements
npm run registry:stale   # Show elements that are overdue for inspection
```

Skills that auto-stamp dates after completing: `/inspect`, `/visual-inspect`, `/ux-review`, `/balance-sim`, `/strategy-analysis`, `/rogue-brain`, `/llm-playtest`, `/quick-verify`, `/smart-test`.

---

## Tables Overview

| Table | Source | Count (approx) |
|-------|--------|----------------|
| `cards` | `src/data/mechanics.ts` | ~100 |
| `enemies` | `src/data/enemies.ts` | ~35 |
| `relics` | `src/data/relics/` | ~80 |
| `status_effects` | `src/data/statusEffects.ts` | ~25 |
| `rooms` | `src/game/roomTypes.ts` | ~12 |
| `screens` | `src/ui/screens.ts` | ~30 |
| `components` | `src/ui/components/` | ~180 |
| `services` | `src/services/` | ~140 |
| `chain_themes` | `src/data/chainThemes/` | ~10 |
| `scenes` | `src/game/scenes/` | ~8 |
| `skills` | `.claude/skills/` | ~20 |
| `decks` | `data/decks/*.json` (_wip excluded) | ~99 |
| `audio` | `src/assets/audio/` | varies |
| `presets` | `src/dev/presets.ts` | ~12 |

---

## Per-Element Fields

Every registry entry has a common field set:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier matching the source (deck filename, mechanic id, etc.) |
| `status` | `"active"` \| `"wip"` \| `"deprecated"` | Current production status |
| `lastInspected` | ISO date string \| null | Most recent inspection timestamp (any method) |
| `confidenceLevel` | `"high"` \| `"medium"` \| `"low"` \| `"none"` | Tested quality confidence |
| `notes` | string | Free-text annotation from most recent inspection |
| `inProgress` | object \| null | Lock object — see Lock Protocol below |

Deck entries additionally carry four deck-specific date fields (see next section).

---

## Decks Table — Specific Fields

Each entry in the `decks` table corresponds to one JSON file in `data/decks/` (files ending in `_wip.json` are excluded). In addition to the common fields above, deck entries carry four stamp fields that track which quality pipeline steps have run:

| Field | Type | Stamped By | Description |
|-------|------|-----------|-------------|
| `lastStructuralVerify` | ISO date \| null | `scripts/verify-all-decks.mjs` | Pass of all 22 structural quality checks (0 failures required) |
| `lastQuizAudit` | ISO date \| null | `scripts/quiz-audit.mjs` | Programmatic + render quiz engine audit (0 FAILs required) |
| `lastLLMPlaytest` | ISO date \| null | `/llm-playtest` skill | LLM sub-agent played and reviewed quiz quality; batch marked complete |
| `lastTriviaBridge` | ISO date \| null | `scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs` | Deck successfully bridged to trivia database (knowledge decks only) |

### Staleness Thresholds (defaults)

`npm run registry:stale` flags a deck as stale if any required date field is older than:

| Field | Stale After |
|-------|-------------|
| `lastStructuralVerify` | 14 days |
| `lastQuizAudit` | 30 days |
| `lastLLMPlaytest` | 60 days |
| `lastTriviaBridge` | 90 days (knowledge decks only) |

Language/vocabulary decks are exempt from `lastTriviaBridge`.

### Stamping Manually

Scripts stamp the date fields automatically on success. If you need to stamp manually after a verified run:

```bash
npm run registry:updater -- --id <deckId> --field lastStructuralVerify --date today
npm run registry:updater -- --id <deckId> --field lastQuizAudit --date today
```

---

## Lock Protocol

### Why Locks Exist

Before the lock protocol, two parallel agents could simultaneously playtest or edit the same deck. Results could interleave, date stamps from agent A could be overwritten by agent B before A finished, and the registry would end up with a misleading "just tested" date on a deck that was only half-tested. Worse, a paused agent could resume after a crash with stale context and re-stamp a date that was already wrong.

Locks are the solution: an agent claims exclusive write access to a registry element before touching it, and releases the lock when done. Other agents that try to work on the same element will see the lock and skip it.

### Lock Object Schema

The `inProgress` field on any registry element holds either `null` (unlocked) or a lock object:

```typescript
{
  agentId: string;       // e.g. "qa-agent-batch-3", "content-agent-fr"
  batchId?: string;      // optional batch identifier for grouped operations
  testType: string;      // e.g. "structural", "quiz-audit", "llm-playtest", "bridge"
  startedAt: string;     // ISO timestamp
  expectedCompleteBy?: string;  // ISO timestamp (startedAt + ttlHours)
}
```

### CLI Reference — Locks

```bash
# Lock one or more decks before starting work
npm run registry:lock -- --ids <deckId> --agent <agentId> --test-type <type>

# Lock with batch id and explicit TTL
npm run registry:lock -- --ids french_a1_grammar french_a2_grammar \
  --agent content-agent-fr --test-type llm-playtest \
  --batch fr-grammar-pass1 --ttl-hours 6

# Unlock after work completes
npm run registry:unlock -- --ids <deckId>

# Exit 1 if locked (for scripted pre-checks)
npm run registry:check-lock -- --ids <deckId>
```

All three commands accept multiple `--ids` space-separated.

### Stale Lock Policy

A lock is considered **abandoned** if its `startedAt` is older than `--ttl-hours` (default: 4 hours). The stale reporter shows abandoned locks in a separate "STALE LOCKS" section. Another agent may override an abandoned lock by locking again — the old lock is overwritten.

Explicitly set `--ttl-hours` to a longer value for multi-hour LLM playtest batches (e.g., `--ttl-hours 8`).

### Stale Reporter — IN PROGRESS Section

`npm run registry:stale` now has three output sections:

1. **STALE** — elements overdue for inspection (never tested or past staleness threshold)
2. **IN PROGRESS** — elements currently locked (skip these; another agent owns them)
3. **STALE LOCKS** — locks older than their TTL (abandoned; safe to override)

Always scan the IN PROGRESS section before picking a deck to test — working on a locked deck wastes effort and may corrupt the other agent's results.

---

## Agent Collaboration Flow

This is the canonical sequence every agent must follow when working on a deck from the registry:

```
1. Pick a deck from the STALE section of `npm run registry:stale`

2. Check if it's locked:
       npm run registry:check-lock -- --ids <deckId>
   Exit if locked (exit code 1 = locked). Pick a different deck.

3. Acquire the lock:
       npm run registry:lock -- --ids <deckId> \
         --agent <your-agent-id> \
         --test-type <structural|quiz-audit|llm-playtest|bridge> \
         --ttl-hours <N>

4. Set a shell trap to guarantee unlock on exit:
       trap 'npm run registry:unlock -- --ids <deckId>' EXIT

5. Do your work (verify, audit, playtest, bridge).

6. On success, stamp the date field:
       npm run registry:updater -- --id <deckId> \
         --field <lastStructuralVerify|lastQuizAudit|lastLLMPlaytest|lastTriviaBridge> \
         --date today

7. Release the lock (trap fires automatically on EXIT, but also call explicitly):
       npm run registry:unlock -- --ids <deckId>
```

**Always use a `trap` in bash scripts.** If your script crashes or is killed, the trap ensures the lock is released. A permanently locked deck blocks all other agents until the TTL expires.

---

## Full CLI Reference

| Command | Description |
|---------|-------------|
| `npm run registry:sync` | Rebuild the entire registry from source files. Run after adding or removing decks, mechanics, enemies, or relics. |
| `npm run registry:stale` | Show elements overdue for inspection. Includes IN PROGRESS and STALE LOCKS sections. |
| `npm run registry:updater` | Stamp date fields or update notes on individual elements. |
| `npm run registry:lock` | Acquire a lock on one or more elements. Options: `--ids`, `--agent`, `--test-type`, `--batch`, `--ttl-hours`. |
| `npm run registry:unlock` | Release a lock on one or more elements. Sets `inProgress` to null. |
| `npm run registry:check-lock` | Exit with code 1 if any of the specified elements are locked. Use in pre-checks before acquiring a lock. |

---

## Example: Full Deck Quality Pass With Locking

```bash
DECK=french_a1_grammar
AGENT=qa-agent-$(date +%s)

# Pre-check
npm run registry:check-lock -- --ids $DECK || { echo "LOCKED — skipping"; exit 0; }

# Acquire lock for 6 hours
npm run registry:lock -- --ids $DECK --agent $AGENT \
  --test-type structural --ttl-hours 6

# Guarantee unlock on script exit
trap "npm run registry:unlock -- --ids $DECK" EXIT

# Step 1: Structural verify
node scripts/verify-all-decks.mjs --deck $DECK \
  && npm run registry:updater -- --id $DECK --field lastStructuralVerify --date today

# Step 2: Quiz audit
npm run registry:lock -- --ids $DECK --agent $AGENT --test-type quiz-audit --ttl-hours 4
npm run audit:quiz-engine -- --deck $DECK \
  && npm run registry:updater -- --id $DECK --field lastQuizAudit --date today

# Unlock (trap also fires on EXIT)
npm run registry:unlock -- --ids $DECK
```

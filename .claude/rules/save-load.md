---
paths:
  - "src/services/runSaveService.ts"
  - "src/services/saveMigration.ts"
  - "src/services/playerSave*.ts"
  - "src/data/schemas/**"
  - "src/types/save*.ts"
---

# Save/Load System — Rules

## Schema Versioning

- `PlayerSave` has a `version` field (currently v1)
- Every structural change to the save schema MUST bump the version
- Migration functions in `saveMigration.ts` handle upgrades: v1→v2, v2→v3, etc.
- Migrations MUST be additive — never remove fields, only add or transform
- Old saves MUST always load in new game versions (backward compatible)

## Before Adding New State

When adding any new persistent field to PlayerSave:

1. Add the field with a sensible default value
2. Add migration logic in `saveMigration.ts` that sets the default for old saves
3. Test: load a v(N-1) save in v(N) code — verify no crash, field populated correctly
4. Document the field in the save format docs

## Crash-Safe Writes

- Desktop (Tauri): Write to `.tmp` file, then atomic rename
- Web (localStorage): Single `setItem` call (atomic by spec)
- Never write partial state — serialize fully, then persist in one operation
- On load failure: fall back to last known good save, not empty state

## What Gets Saved

- Run state: floor, HP, deck, relics, gold, encountered enemies
- Knowledge state: FSRS data, confusion matrix, mastery levels
- Meta state: settings, profile, achievements, statistics, unlocks
- DO NOT save: UI state, animation state, transient combat state mid-turn

## Steam Cloud

- Steamworks Auto-Cloud enabled for save directory
- If conflict detected (played on two machines): prefer the save with more total playtime
- Document save file location per platform in player-facing settings

## Rehydrating Typed Collections — CRITICAL RULE (added 2026-04-10)

**NEVER use a bare `...spread` on a RunState/PlayerSave object that contains Set/Map/class-instance fields.**

`JSON.stringify` converts `Set` and `Map` instances to `{}` (empty object). After `JSON.parse`,
calling `.has()` or `.get()` on the result throws `"has is not a function"`.

### The mandatory pattern for any Serialize/Deserialize pair

```typescript
// serializeX(): destructure out ALL Set/Map/class fields, spread the rest
const { setField: _s, mapField: _m, classField: _c, ...rest } = state;
return {
  ...rest,
  setField: [...state.setField],           // Set → array
  mapField: Object.fromEntries(state.mapField), // Map → plain object (if persisted)
  classField: state.classField?.toJSON(),  // class instance → snapshot
};

// deserializeX(): explicitly re-wrap each field
return {
  ...saved,
  setField: new Set(saved.setField),
  mapField: new Map(Object.entries(saved.mapField ?? {})),
  classField: saved.classField ? MyClass.fromJSON(saved.classField) : undefined,
  // In-memory-only fields always reset to a clean state:
  transientMap: undefined,
  transientSet: new Set(),
};
```

### Lint enforcement

Run `npm run lint:rehydration` (or `node scripts/lint/check-set-map-rehydration.mjs`) to verify
`runSaveService.ts` stays safe. This script is also wired into `npm run check`.

### In-memory fields vs persisted fields

Fields documented as "in-memory only — not persisted" on `RunState` MUST:
1. Be listed in the `Omit<>` union of `SerializedRunState`
2. Be explicitly excluded via destructuring in `serializeRunState()`
3. Be explicitly reset in `deserializeRunState()` (to `undefined`, empty Set, or empty Map)

See `docs/architecture/services/learning.md` for the full field-by-field contract.

## Run Lifecycle Termination Invariants — CRITICAL RULE (added 2026-04-10)

**All run-termination paths MUST converge on the `runEnd` scene before returning to the hub.** No direct hub jumps on death, retreat, or victory.

### Why this rule exists

On 2026-04-10 (MEDIUM-10), `finishRunAndReturnToHub()` in `gameFlowController.ts` ended with `currentScreen.set('hub')`, skipping `RunEndScreen` entirely. Players never saw their run summary, XP, or Play Again / Return to Menu choices. The fix was a one-line change to `currentScreen.set('runEnd')`, but the regression shipped because there was no enforced invariant.

### The mandatory contract

Every run-termination path — defeat (HP ≤ 0), retreat, boss victory, manual quit — MUST:

1. Call a single shared function (e.g. `finishRunAndReturnToHub()`) that writes `currentScreen.set('runEnd')`
2. Let the `RunEndScreen` component's `onplayagain` / `onhome` callbacks handle the subsequent hub transition
3. Never bypass `runEnd` via a direct `currentScreen.set('hub')` from a combat / encounter scene

### Enforcement

- `src/services/gameFlowController.termination.test.ts` — source-level invariant tests that parse `gameFlowController.ts` and assert: `finishRunAndReturnToHub` contains `currentScreen.set('runEnd')`, does NOT contain `currentScreen.set('hub')`, and at least 2 call sites exist (defeat + retreat)
- Headless sim forces a zero-HP run at high ascension and asserts `survived === false` + `deathFloor > 0`
- See `docs/mechanics/combat.md` § "Run Termination State Machine" for the full state diagram

### Applies to

Any future termination path additions (e.g. time-out, ragequit, multiplayer forfeit) MUST be routed through the same convergence point. Never add a new termination path that writes `'hub'` directly.

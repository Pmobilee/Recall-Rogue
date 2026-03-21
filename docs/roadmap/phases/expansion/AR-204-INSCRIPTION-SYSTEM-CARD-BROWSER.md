# AR-204: Inscription System + Card Browser UI

**Parent:** AR-200 (Expansion Master)
**Depends on:** AR-201 (Kill Echo + Combo), AR-202 (Cursed Card System), AR-203 (Burn + Bleed)
**Blocks:** AR-206 (Cards Phase 1 — Inscriptions ship with it)
**Expansion spec refs:** Part 3 §3G (Inscription cards), Part 3 §3E (Utility cards — Tutor/Mimic/Scavenge/Siphon), Appendix E (Damage Pipeline), Appendix F (Interaction Rulings)
**Estimated complexity:** Medium (2 discrete systems, no combat logic rewrites — additive hooks only)

---

## Overview

This AR implements two independent but co-deployed systems:

1. **Inscription keyword system** — a new card play type. Inscription cards persist for the rest of combat, exhaust on play (permanently removed from game — cannot be Recollected), and apply ongoing passive bonuses through three hook points: damage pipeline (Fury), turn-start (Iron), and CC resolution (Wisdom). This AR builds the system infrastructure only — the three Inscription card mechanic definitions are NOT added here; they ship in AR-206 (Phase 1 cards).

2. **Shared CardBrowser UI component** — a mid-combat overlay used by Tutor (browse draw pile), Mimic CC (browse discard), Scavenge (browse discard), and Siphon Knowledge (show answers). Also includes a multi-choice popup (Unstable Flux CC / Phase Shift QP) and an exhaust pile viewer (Recollect decisions). These components are built but not wired to specific cards — they are consumed by AR-206/207/208 card implementations.

**What this AR does NOT do:**
- Does not add `inscription_fury`, `inscription_iron`, or `inscription_wisdom` mechanic definitions (those are in AR-206 and AR-208)
- Does not implement any specific card's behavior — only the infrastructure the cards will call
- Does not wire CardBrowser into specific card handlers — only builds the component

---

## System Design

### Inscription Runtime Model

Active inscriptions are tracked in `TurnState` as a new field:

```typescript
activeInscriptions: ActiveInscription[]
```

Where:

```typescript
export interface ActiveInscription {
  /** The mechanic ID that created this inscription (e.g. 'inscription_fury'). */
  mechanicId: string;
  /** The numeric effect value locked in at play time (QP/CC/CW resolved value). */
  effectValue: number;
  /** The play mode used when the inscription was played. Stored for Cursed QP 0.7x. */
  playMode: PlayMode;
}
```

**Pool constraint:** Only one inscription of each `mechanicId` can be active at a time. If a player somehow plays a second inscription of the same type (edge case: impossible by Pool=1 design, but must be enforced), the second play does nothing and the card is still exhausted.

**Exhaust behavior:** Inscription cards are "removed from game" — they go into the exhaust pile but with a `removedFromGame: true` flag on the card. `exhaustCard()` already moves cards to `exhaustPile`; the new flag just marks them as non-Recollectable. The Recollect mechanic (AR-208) must check this flag before restoring.

**Cursed Inscription:** A Cursed Inscription played via QP applies its effect at 0.7× (the standard `CURSED_QP_MULTIPLIER`). Inscription of Wisdom CW fizzles completely (zero persistent effect, card still exhausted). This is handled by the caller — the inscription resolver only stores the `effectValue` it receives.

### Inscription Hook Points (per Appendix E and §3G)

**Hook 1 — Inscription of Fury (damage pipeline, step 3):**
In `cardEffectResolver.ts`, after mastery bonus (step 2) and before relic flat bonuses (step 4):
```
effectiveBase = mechanicBaseValue + masteryBonus + inscriptionFuryBonus
```
The `inscriptionFuryBonus` is passed in via `AdvancedResolveOptions` (not read directly from TurnState, keeping the resolver pure/testable).

**Hook 2 — Inscription of Iron (turn start):**
In `turnManager.ts`, in the `startPlayerTurn` / draw phase, before hand draw:
```
applyShield(turnState.playerState, inscriptionIronValue)
```
Iron block is persistent-shield equivalent for the purpose of this turn's block pool. It applies fresh each turn start.

**Hook 3 — Inscription of Wisdom (CC resolution):**
In `encounterBridge.ts`, in the `resolveChargeCorrect` path, after the primary card effect resolves:
- If `inscription_wisdom` is active: draw 1 extra card (QP inscription effect) or draw 1 + heal 1 HP (CC inscription effect, i.e., the inscription was itself played CC).
- Wisdom CW = fizzle = `activeInscriptions` will not contain an `inscription_wisdom` entry (it never registered).

### CardBrowser Component Design

`CardBrowser.svelte` is a reusable overlay that renders a scrollable list of cards with an optional select action. It is purely presentational — callers own the card data and the select callback.

**Props interface:**

```typescript
interface Props {
  /** Cards to display in the browser. */
  cards: Card[]
  /** 'select' = tap to choose one. 'view' = read-only (no select action). */
  mode: 'select' | 'view'
  /** Header text displayed at the top. E.g. "Draw Pile", "Discard Pile", "Exhausted". */
  title: string
  /** Called when the player taps a card in 'select' mode. */
  onSelect?: (card: Card) => void
  /** Called when the player dismisses the browser without selecting. */
  onDismiss: () => void
  /** If true, show the card's quiz question and answer fields (Siphon Knowledge mode). */
  showAnswers?: boolean
  /** If provided, show a timer countdown. Viewer closes when it hits 0. */
  timerSeconds?: number
}
```

**Layout:**
- Full-screen modal overlay on portrait mobile (z-index above CombatHud, below quiz overlay).
- Landscape: right-side panel, 40% width, does not obscure the canvas.
- Each card row: card name (bold), card type chip (color-coded), mechanic name, AP cost. If `showAnswers`, also shows the fact question and correct answer below in a muted style.
- Scrollable list — no horizontal card art (too slow to render mid-combat). Text-only rows.
- Dismiss: X button top-right, or tap outside the panel. Calls `onDismiss`.
- Select: tap any row in `mode='select'`. Highlights the row, calls `onSelect(card)`, then the caller decides whether to close.

### MultiChoicePopup Component Design

`MultiChoicePopup.svelte` is used by Unstable Flux CC (choose from 4 effects) and Phase Shift QP (choose damage or block). A generic choice modal.

**Props interface:**

```typescript
interface Props {
  /** Prompt text shown above the choices. */
  prompt: string
  /** Array of choices. Max 4. */
  choices: Array<{ label: string; description?: string }>
  /** Called with the index of the chosen option. */
  onChoose: (index: number) => void
  /** Called if player dismisses (Escape / back button). Some callers may not allow dismiss. */
  onDismiss?: () => void
  /** If true, no dismiss option is shown (player must pick). Default: false. */
  forcePick?: boolean
}
```

**Layout:** Centered modal card. Vertical list of tappable choice buttons. On mobile, each button is minimum 48px tall. No scroll needed (max 4 options).

### ExhaustPileViewer Component Design

`ExhaustPileViewer.svelte` is a specialized read-only `CardBrowser` variant. It shows exhausted cards — used by the Recollect card mechanic (AR-208) so players can see what they can recover.

This can be implemented as a thin wrapper: `<CardBrowser cards={exhaustedCards} mode="view" title="Exhausted Cards" onDismiss={...} />` — no separate component needed if `CardBrowser` handles the `view` mode well. The AR step below builds it as a wrapper to keep code readable.

---

## Sub-Steps

### Step 1: Add `isRemovedFromGame` flag to Card type

- [ ] **1.1** In `src/data/card-types.ts`, add optional field to the `Card` interface:
  ```typescript
  /** If true, this card was permanently removed from game (Inscription exhaust). Cannot be Recollected. */
  isRemovedFromGame?: boolean;
  ```
  **Acceptance:** `npm run typecheck` passes. No existing code broken (optional field).
  **Files:** `src/data/card-types.ts`

### Step 2: Add `ActiveInscription` type and `activeInscriptions` to `TurnState`

- [ ] **2.1** In `src/services/turnManager.ts`, add the `ActiveInscription` interface and export it:
  ```typescript
  export interface ActiveInscription {
    mechanicId: string;
    effectValue: number;
    playMode: PlayMode;
  }
  ```
  Place it near the top of the file alongside other exported interfaces.
  **Acceptance:** Interface is exported and importable.

- [ ] **2.2** Add `activeInscriptions: ActiveInscription[]` to the `TurnState` interface.
  **Acceptance:** Field present in the interface. Typecheck passes.

- [ ] **2.3** In `initEncounterTurnState()` (the function that builds the initial `TurnState`), initialize `activeInscriptions: []`.
  **Acceptance:** All `TurnState` construction sites initialize the field. Typecheck passes.

- [ ] **2.4** In `encounterBridge.ts`, wherever `TurnState` is snapshot-cloned or serialized for save/resume, ensure `activeInscriptions` is included in the clone. Search for all spread/clone patterns for `TurnState` and add the field.
  **Acceptance:** No runtime "undefined" errors on `activeInscriptions` after resume. Typecheck passes.

### Step 3: Add `resolveInscription()` function in turnManager

- [ ] **3.1** Add a pure helper function `resolveInscription(turnState: TurnState, card: Card, playMode: PlayMode): void` in `src/services/turnManager.ts`. This function:
  1. Checks if an inscription of the same `mechanicId` is already active. If yes, returns without adding (pool=1 constraint). The card is still exhausted by the caller.
  2. Computes `effectValue` from the card. For now this is a pass-through — the card's `baseEffectValue` is already the resolved QP/CC/CW value passed in by the caller (encounterBridge resolves play mode before calling). The resolver stores it as-is.
  3. Pushes `{ mechanicId: card.mechanicId, effectValue, playMode }` onto `turnState.activeInscriptions`.
  **Note:** This function does NOT exhaust the card — `encounterBridge` calls `exhaustCard()` separately and also marks `card.isRemovedFromGame = true` on the exhausted copy.
  **Acceptance:** Function exported. Typecheck passes.

- [ ] **3.2** Add a helper `getActiveInscription(turnState: TurnState, mechanicId: string): ActiveInscription | undefined` that returns the active inscription for a given mechanic ID, or undefined if not active. Used by effect hooks.
  **Acceptance:** Function exported. Used in subsequent steps.

### Step 4: Wire Inscription of Fury into the damage pipeline

- [ ] **4.1** In `src/services/cardEffectResolver.ts`, add `inscriptionFuryBonus?: number` to `AdvancedResolveOptions`:
  ```typescript
  /** Flat damage bonus from active Inscription of Fury. Added at damage pipeline step 3. */
  inscriptionFuryBonus?: number;
  ```
  **Acceptance:** Field present. Typecheck passes.

- [ ] **4.2** In `resolveCardEffect()`, apply the bonus at damage pipeline step 3 — after mastery bonus, before relic flat bonuses. Locate the line:
  ```typescript
  const effectiveBase = mechanicBaseValue + sharpenedEdgeBonus;
  ```
  Change it to:
  ```typescript
  const furyBonus = (effectiveType === 'attack') ? (advanced.inscriptionFuryBonus ?? 0) : 0;
  const effectiveBase = mechanicBaseValue + sharpenedEdgeBonus + furyBonus;
  ```
  The bonus only applies to attack cards (`effectiveType === 'attack'`). Non-attack cards are unaffected.
  **Acceptance:** Unit tests pass. The bonus does not apply to shield/buff/utility cards. Typecheck passes.

- [ ] **4.3** In `src/services/encounterBridge.ts`, in the `resolveCardPlay()` or equivalent function that calls `resolveCardEffect()`, read the active Inscription of Fury from `turnState.activeInscriptions` and pass it into `AdvancedResolveOptions`:
  ```typescript
  const furyInscription = getActiveInscription(turnState, 'inscription_fury');
  advanced.inscriptionFuryBonus = furyInscription?.effectValue ?? 0;
  ```
  **Acceptance:** Integration test: play an attack card with Fury active → damage is `baseValue + furyBonus`. Play a shield card with Fury active → no bonus. Typecheck passes.

### Step 5: Wire Inscription of Iron into turn-start

- [ ] **5.1** In `src/services/turnManager.ts`, in `startPlayerTurn()` (the function called at the beginning of each player turn, before draw), add Iron block application. After existing turn-start logic (persistent shield, relic turn-start effects), add:
  ```typescript
  // Inscription of Iron: apply block at start of each player turn.
  const ironInscription = getActiveInscription(turnState, 'inscription_iron');
  if (ironInscription) {
    applyShield(turnState.playerState, ironInscription.effectValue);
  }
  ```
  This must fire BEFORE the draw phase. Order: (1) status tick, (2) persistent shield carry, (3) relic turn-start effects, (4) Iron block, (5) draw hand.
  **Acceptance:** Iron block appears as block at the start of the player's turn, every turn. Typecheck passes.

### Step 6: Wire Inscription of Wisdom into CC resolution

- [ ] **6.1** In `src/services/encounterBridge.ts`, in the charge-correct resolution path (after the primary card effect is applied and `correct === true`), add Wisdom trigger:
  ```typescript
  // Inscription of Wisdom: CC resolution trigger.
  const wisdomInscription = getActiveInscription(turnState, 'inscription_wisdom');
  if (wisdomInscription && isChargeCorrect) {
    // Draw 1 extra card (both QP and CC inscription effects give at least 1 draw).
    drawCards(turnState.deck, 1);
    // CC inscription effect also heals 1 HP.
    if (wisdomInscription.playMode === 'charge_correct' || wisdomInscription.playMode === 'charge') {
      healPlayer(turnState.playerState, 1);
    }
  }
  ```
  **Note:** Wisdom CW = fizzle — no inscription entry exists in `activeInscriptions` so this code never runs. No special case needed.
  **Acceptance:** On CC play with Wisdom active: 1 extra card drawn. If Wisdom was played CC: also +1 HP heal. On QP play with Wisdom active: no extra draw (Wisdom only triggers on correct Charge). Typecheck passes.

### Step 7: Mark Inscription exhaust as `isRemovedFromGame`

- [ ] **7.1** In `src/services/encounterBridge.ts`, in the card play resolution path, detect Inscription cards. An Inscription card is identified by `card.mechanicId` starting with `'inscription_'` (or a dedicated `card.isInscription` flag — see 7.2). When an Inscription card is played:
  1. Call `resolveInscription(turnState, card, playMode)` to register it.
  2. Call `exhaustCard(turnState.deck, card.id)` to move it to the exhaust pile.
  3. Set `isRemovedFromGame = true` on the card in the exhaust pile:
     ```typescript
     const exhausted = turnState.deck.exhaustPile.find(c => c.id === card.id);
     if (exhausted) exhausted.isRemovedFromGame = true;
     ```
  This must happen regardless of play mode (QP, CC, or CW — all Inscriptions exhaust). On CW, `resolveInscription` stores the reduced (or zero) `effectValue` as passed in.
  **Note:** Inscription of Wisdom CW fizzles — the caller should pass `effectValue: 0` or skip calling `resolveInscription` entirely. Implement as: if `playMode === 'charge_wrong'` and `mechanicId === 'inscription_wisdom'`, skip `resolveInscription` (don't register the inscription). The card is still exhausted and marked `isRemovedFromGame`.
  **Acceptance:** After playing an Inscription, the card is in `exhaustPile` with `isRemovedFromGame: true`. It is NOT in hand or discard. `activeInscriptions` has one entry. Pool=1 enforced (playing a duplicate does not double-register). Typecheck passes.

- [ ] **7.2** Add `isInscription?: boolean` to the `Card` interface in `src/data/card-types.ts`. This is set at card creation time in `mechanics.ts` (AR-206 will set it for the three inscription mechanic definitions). For now it is just the field declaration — `encounterBridge` should check both `card.isInscription` (preferred) and fall back to `card.mechanicId?.startsWith('inscription_')` for robustness.
  **Acceptance:** Field present in Card type. Typecheck passes.

### Step 8: Add `inscriptionFuryBonus` to headless simulator

- [ ] **8.1** In `tests/playtest/headless/simulator.ts`, in the `buildAdvancedResolveOptions()` function (or equivalent where `AdvancedResolveOptions` is assembled), add Inscription of Fury reading from simulated `turnState.activeInscriptions`:
  ```typescript
  const furyInscription = turnState.activeInscriptions?.find(i => i.mechanicId === 'inscription_fury');
  advanced.inscriptionFuryBonus = furyInscription?.effectValue ?? 0;
  ```
  **Acceptance:** Headless sim does not crash when `activeInscriptions` is populated. `npm run headless-test` (or equivalent) passes. Typecheck passes.

### Step 9: Build `CardBrowser.svelte`

- [ ] **9.1** Create `src/ui/components/CardBrowser.svelte`. Implement as a Svelte 5 component with the Props interface defined in the System Design section above. Requirements:
  - Full-screen modal overlay (portrait) / right-side panel (landscape, via `isLandscape` store import).
  - `z-index` above `CombatHud` (use `z-index: 500` — confirm against existing combat z-index layers before committing).
  - Scrollable card list. Each row: card name (bold, left), AP cost chip (right), mechanic name (muted, below name), card type color dot.
  - If `showAnswers` is true: show `card.factQuestion` below mechanic name, and `card.factAnswer` in green below that.
  - `mode='select'`: each row is tappable. On tap: highlight row, call `onSelect(card)`. Close is caller's responsibility.
  - `mode='view'`: rows are not tappable, no hover state.
  - Optional timer: if `timerSeconds` is provided, display a countdown bar at the top. On expiry, call `onDismiss()`.
  - Dismiss: X button top-right. Tap-outside closes (portrait only — in landscape the panel is docked, no outside).
  - Card list sorted by: card type (attack, shield, buff, debuff, utility, wild), then alphabetically by name. Stable sort.
  - Empty state: if `cards` is empty, show "No cards" centered in the panel.
  - Use `data-testid="card-browser"` on the root element, `data-testid="card-browser-row-{index}"` on each row.
  **Acceptance:** Component renders without errors. Portrait/landscape layout works (visual inspection with `__terraScenario`). `npm run typecheck` passes.
  **Files:** `src/ui/components/CardBrowser.svelte` (new)

- [ ] **9.2** Export `CardBrowser` from `src/ui/components/index.ts` (or equivalent barrel file, if one exists). If no barrel file, skip this step — callers import directly.
  **Acceptance:** Import path works in consuming components. Typecheck passes.

### Step 10: Build `MultiChoicePopup.svelte`

- [ ] **10.1** Create `src/ui/components/MultiChoicePopup.svelte`. Implement as a Svelte 5 component with the Props interface from the System Design section. Requirements:
  - Centered modal, dark semi-transparent backdrop.
  - Prompt text at top (bold, centered).
  - Vertical list of 2–4 choice buttons. Each button: label (bold) + optional description (muted, smaller, below label).
  - Minimum tap target 48px height per button.
  - No scroll (max 4 options fit on screen at 48px each + padding).
  - If `forcePick` is false: X button top-right calls `onDismiss`. If `forcePick` is true: no X, no dismiss.
  - `data-testid="multi-choice-popup"` on root, `data-testid="multi-choice-option-{index}"` on each button.
  **Acceptance:** Renders with 2, 3, and 4 choices. Tap fires `onChoose(index)`. Typecheck passes.
  **Files:** `src/ui/components/MultiChoicePopup.svelte` (new)

### Step 11: Build `ExhaustPileViewer.svelte`

- [ ] **11.1** Create `src/ui/components/ExhaustPileViewer.svelte`. This is a thin wrapper over `CardBrowser` in `view` mode:
  ```svelte
  <CardBrowser
    cards={exhaustedCards}
    mode="view"
    title="Exhausted Cards"
    onDismiss={onDismiss}
  />
  ```
  Props: `exhaustedCards: Card[]`, `onDismiss: () => void`.
  The component filters out `isRemovedFromGame` cards from display only if the game designer decides players should not see Inscriptions in the exhaust viewer. **Decision: SHOW them** — players should be able to see that their Inscription exhausted. No filtering.
  **Acceptance:** Renders without errors. Wraps CardBrowser correctly. Typecheck passes.
  **Files:** `src/ui/components/ExhaustPileViewer.svelte` (new)

### Step 12: Expose exhaust pile in CombatHud

- [ ] **12.1** In the CombatHud component (find via `Grep 'exhaustPile\|exhausted' src/ui/components/`), add a tappable exhaust count indicator. Tapping it opens `ExhaustPileViewer` as an overlay. The indicator shows the count of exhausted cards (e.g. "3x" with a skull/X icon). If exhaust pile is empty, the indicator is hidden.
  - Pass `activeDeck.exhaustPile` to `ExhaustPileViewer`.
  - Close: ExhaustPileViewer's `onDismiss` sets a local `showExhaustViewer = false` reactive variable.
  - Position: near the discard pile counter in the existing deck info row (check actual layout visually before choosing exact position).
  **Acceptance:** Tapping exhaust count opens the viewer. Viewer shows exhausted cards. Dismissing closes it. Typecheck passes.
  **Files:** Relevant `CombatHud*.svelte` file (identify by grepping for exhaust pile display or deck counters).

### Step 13: Persist `activeInscriptions` across turn serialize/deserialize

- [ ] **13.1** In `src/services/encounterBridge.ts`, in `getEncounterSnapshot()` or equivalent save/serialize function, include `activeInscriptions` in the snapshot:
  ```typescript
  activeInscriptions: turnState.activeInscriptions.map(i => ({ ...i })),
  ```
  In `restoreEncounterFromSnapshot()`, restore it:
  ```typescript
  turnState.activeInscriptions = snapshot.activeInscriptions ?? [];
  ```
  **Acceptance:** Simulate: play an Inscription, save, resume → inscription is still active. `npx vitest run` passes. Typecheck passes.

### Step 14: Update inspection registry

- [ ] **14.1** In `data/inspection-registry.json`, add the following entries:
  - `systems` table: new entry `inscription_system` (`name: "Inscription System"`, `status: "active"`, `lastChangedDate: "2026-03-21"`, all inspection dates `"not_checked"`)
  - `systems` table: new entry `card_browser_ui` (`name: "Card Browser UI"`, `status: "active"`)
  - `systems` table: new entry `multi_choice_popup` (`name: "Multi-Choice Popup"`, `status: "active"`)
  - `systems` table: new entry `exhaust_pile_viewer` (`name: "Exhaust Pile Viewer"`, `status: "active"`)
  - `cardKeywords` table: new entry `inscription` (`name: "Inscription"`, `description: "Played once, persists for rest of combat, exhausts on play (removed from game)"`, `status: "active"`)
  **Acceptance:** Registry file is valid JSON. `node -e "JSON.parse(require('fs').readFileSync('data/inspection-registry.json'))"` succeeds.

### Step 15: Documentation update

- [ ] **15.1** In `docs/GAME_DESIGN.md`, add an "Inscription" subsection under the card keywords/mechanics section. Document:
  - What Inscriptions are (once-played persistent effects)
  - Exhaust-on-play behavior and non-Recollectable status
  - Pool=1 per type (no stacking)
  - The three hook points: Fury (damage step 3), Iron (turn start), Wisdom (CC trigger)
  - Wisdom CW fizzle behavior
  - Cursed Inscription QP = 0.7x power
  **Acceptance:** Doc updated. No stale references to Echo system remain near Inscription content.

- [ ] **15.2** In `docs/ARCHITECTURE.md`, add `CardBrowser.svelte`, `MultiChoicePopup.svelte`, `ExhaustPileViewer.svelte` to the UI components table with their purposes. Add `activeInscriptions: ActiveInscription[]` to the TurnState field documentation section (if that section exists).
  **Acceptance:** Doc updated. Typecheck passes. Build passes.

---

## Files Affected

| File | Change |
|------|--------|
| `src/data/card-types.ts` | Add `isInscription?: boolean`, `isRemovedFromGame?: boolean` to `Card` interface |
| `src/services/turnManager.ts` | Add `ActiveInscription` interface, `activeInscriptions` field to `TurnState`, `resolveInscription()`, `getActiveInscription()`, Iron hook in `startPlayerTurn()` |
| `src/services/cardEffectResolver.ts` | Add `inscriptionFuryBonus?` to `AdvancedResolveOptions`, apply at damage pipeline step 3 |
| `src/services/encounterBridge.ts` | Wire Inscription play detection, exhaust + `isRemovedFromGame`, `resolveInscription()` call, Fury `AdvancedResolveOptions` pass-in, Wisdom CC trigger, snapshot serialize/restore |
| `src/ui/components/CardBrowser.svelte` | NEW — shared card list overlay |
| `src/ui/components/MultiChoicePopup.svelte` | NEW — 2-4 option choice modal |
| `src/ui/components/ExhaustPileViewer.svelte` | NEW — thin CardBrowser wrapper for exhaust pile |
| `src/ui/components/CombatHud*.svelte` | Add exhaust pile count tap target + ExhaustPileViewer integration |
| `tests/playtest/headless/simulator.ts` | Add `inscriptionFuryBonus` to `AdvancedResolveOptions` assembly |
| `data/inspection-registry.json` | Add inscription_system, card_browser_ui, multi_choice_popup, exhaust_pile_viewer, inscription keyword |
| `docs/GAME_DESIGN.md` | Add Inscription keyword documentation |
| `docs/ARCHITECTURE.md` | Add new UI components, TurnState field update |

---

## Acceptance Criteria

### Inscription System
- [ ] `TurnState.activeInscriptions` initializes as `[]` at encounter start.
- [ ] Playing an Inscription card registers it in `activeInscriptions` with the correct `effectValue` and `playMode`.
- [ ] The card moves to `exhaustPile` with `isRemovedFromGame: true` after play.
- [ ] Pool=1 enforced: playing a second `inscription_fury` when one is already active does not add a duplicate entry.
- [ ] Inscription of Fury (when active): attack cards receive flat bonus at damage pipeline step 3. Shield/utility/buff/debuff cards receive no bonus.
- [ ] Inscription of Iron (when active): player gains `effectValue` block at the start of each player turn, before draw.
- [ ] Inscription of Wisdom (when active, played QP or CC): each correct Charge answer draws 1 extra card.
- [ ] Inscription of Wisdom CC inscription effect: each CC answer also heals 1 HP.
- [ ] Inscription of Wisdom CW: no inscription registered, card still exhausted and marked `isRemovedFromGame`.
- [ ] Inscriptions survive turn serialize/deserialize (save-resume).
- [ ] Headless sim handles `activeInscriptions` without crashing.

### Card Browser UI
- [ ] `CardBrowser.svelte` renders in portrait (full-screen overlay) and landscape (right-panel docked).
- [ ] `mode='select'`: tapping a row calls `onSelect(card)`. Row highlights on tap.
- [ ] `mode='view'`: rows are not tappable.
- [ ] `showAnswers=true`: shows fact question and correct answer per card.
- [ ] Empty state: "No cards" shown when `cards` is empty.
- [ ] Optional timer: countdown bar visible, `onDismiss()` fires on expiry.
- [ ] Dismiss via X button or tap-outside (portrait) works.
- [ ] `data-testid` attributes present for all interactive elements.

### Multi-Choice Popup
- [ ] Renders with 2, 3, and 4 choices.
- [ ] Tapping a choice fires `onChoose(index)` with the correct index.
- [ ] `forcePick=true`: no dismiss option shown.
- [ ] `forcePick=false`: X button fires `onDismiss()`.
- [ ] Minimum 48px tap target per choice button.

### Exhaust Pile Viewer
- [ ] Accessible via tap on exhaust count in CombatHud.
- [ ] Hidden when exhaust pile is empty.
- [ ] Shows all exhausted cards (including `isRemovedFromGame` Inscriptions).
- [ ] Closes on dismiss.

### General
- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run build` succeeds.
- [ ] `npx vitest run` passes (1900+ tests, no regressions).
- [ ] `data/inspection-registry.json` updated with all new entries.
- [ ] `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` updated.

---

## Verification Gate

After all steps complete, the implementing worker must:

1. Run `npm run typecheck` — must pass with zero errors.
2. Run `npm run build` — must succeed.
3. Run `npx vitest run` — must pass with no regressions.
4. Run headless sim: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 100` — must complete without crashing.
5. Visual inspection via Playwright:
   - Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
   - Use `window.__terraScenario.load('combat-basic')` to enter combat
   - In browser console, manually inject an active inscription into TurnState to verify Fury/Iron effects visually
   - Take screenshot — confirm no UI regressions on CombatHud (exhaust counter visible)
   - Open `ExhaustPileViewer` — confirm it renders in both portrait and landscape
   - Open `CardBrowser` directly (inject via `window.__terraDebug()` or test hook) — confirm layout in portrait and landscape

---

## Notes for Implementing Worker

1. **Read Appendix E** of `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` before touching `cardEffectResolver.ts`. The Fury bonus must land at step 3 — after mastery, before relic flat bonuses. Getting the pipeline order wrong silently misattributes damage.

2. **Read Appendix F** for the complete Inscription interaction table, specifically:
   - "Recollect + Inscriptions: cannot be Recollected" — enforced by `isRemovedFromGame` flag in AR-208; this AR just sets the flag.
   - "Inscription of Wisdom CW: complete fizzle" — card exhausted, no inscription registered, zero persistent effect.
   - "Multiple same-type Inscriptions: cannot stack, Pool = 1 per type."

3. **Do not add `inscription_fury`, `inscription_iron`, or `inscription_wisdom` to `MECHANIC_DEFINITIONS`** in `src/data/mechanics.ts`. Those definitions ship in AR-206 (Phase 1 cards). This AR builds the infrastructure that those definitions will call.

4. **Svelte 5 syntax required** for all new `.svelte` components. Use `$props()`, `$state()`, `$derived()`. Check `mcp__svelte__list-sections` before writing any rune-based component. Do not use legacy `export let` prop syntax.

5. **Z-index audit before CombatHud changes.** Grep for `z-index` in `src/ui/components/` to map the existing layer stack before placing the exhaust viewer and CardBrowser overlays. Portrait modal must be above HUD but below quiz overlay.

6. **`encounterBridge.ts` is the integration point** — not `turnManager.ts`. `turnManager.ts` owns the TurnState mutation helpers. `encounterBridge.ts` orchestrates the card play flow and is where Inscription detection, exhaust, and hook wiring all happen. Keep `resolveInscription()` and `getActiveInscription()` in `turnManager.ts` as pure helpers; call them from `encounterBridge.ts`.

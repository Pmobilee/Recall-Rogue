# Recall Rogue — CR Spec Writer Skill

## When To Use This Skill

Use this skill when writing a new CR (Change Request) spec file for a coding agent to implement. This is typically done at a REFLECT checkpoint after the game design advisor has answered the phase questions and the human has approved moving to the next phase.

## What This Skill Does

Produces a `docs/roadmap/phases/CR-XX-NAME.md` file that is detailed enough for a coding agent to implement WITHOUT referencing any other document except the spec itself and the files it points to. The agent should never need to guess.

## Why This Matters

A bad CR spec: "CR-11: Add Heavy Strike mechanic"
→ Agent guesses what Heavy Strike does, what files to touch, what the AP cost is, how it interacts with buffs, what the UI shows. Gets 4 of 6 things wrong. You spend more time fixing than if you'd written the spec properly.

A good CR spec: 200 lines covering the mechanic definition, exact values, modifier interactions, UI display text, files to create/modify, edge cases, and a done-when checklist with 8 items.
→ Agent executes cleanly. You review and approve.

## Instructions

### Step 1: Read Context

Before writing any CR spec, read:

```
1. docs/GAME_DESIGN_md                     — Find the section relevant to this CR
2. docs/PROGRESS.md                        — Understand where this CR sits in the roadmap
3. Previous REFLECT file                    — Any advisor answers that inform this CR
4. Relevant source code                     — Understand current state of the system being modified
```

### Step 2: Write the CR Spec

Every CR spec file MUST contain ALL of the following sections. No exceptions.

---

#### Section 1: Summary (3-5 lines max)

```markdown
# CR-XX: [Name]
> Phase: P[X] — [Phase Name]
> Priority: BLOCKER / HIGH / MEDIUM
> Depends on: CR-XX, CR-YY (list any CRs that must be complete first)
> Estimated scope: S / M / L

[One paragraph describing what this CR does and why it matters.]
```

---

#### Section 2: Design Reference

Point to the exact section(s) of GAME_DESIGN_md that define this feature. Quote the relevant values and rules. Do NOT say "see GAME_DESIGN_md Section 4" — copy the specific values into the CR spec so the agent has everything in one file.

```markdown
## Design Reference

From GAME_DESIGN_md Section 4 (Card Mechanics Pool):

> **Heavy Strike**
> - Card type: Attack
> - Effect: Deal 14 damage
> - AP cost: 2 (instead of standard 1)
> - Max per run pool: 3 (to prevent AP starvation)
> - Modifier stacking: 14 x Tier x Difficulty x Combo x Speed = Final

From GAME_DESIGN_md Section 2 (Action Points):

> Heavy Strike costs 2 AP. Player has 3 AP per turn. Playing Heavy Strike
> leaves only 1 AP for remaining cards.
```

---

#### Section 3: Exact Implementation Details

This is the largest section. Cover:

**A. Data model changes** — New interfaces, new fields on existing interfaces, new enums. Show the TypeScript.

```markdown
## Implementation

### Data Model

Add to `CardMechanic` enum:
```typescript
HEAVY_STRIKE = 'heavy_strike'
```

Add to mechanic definitions:
```typescript
{
  id: 'heavy_strike',
  name: 'Heavy Strike',
  type: CardType.ATTACK,
  description: 'Deal 14 damage. Costs 2 AP.',
  baseValue: 14,
  apCost: 2,
  maxPerPool: 3,
  tags: ['attack', 'high-cost']
}
```
```

**B. Logic changes** — What functions to modify, what new functions to create. Be specific about the algorithm.

```markdown
### Logic

In `CardResolver.ts`, modify `resolveCard()`:
- Before deducting AP, check `mechanic.apCost` (default 1 if not specified)
- If player AP < mechanic.apCost, the card CANNOT be committed (Cast button disabled/grayed)
- On commit, deduct `mechanic.apCost` instead of hardcoded 1

In `RunPoolBuilder.ts`, modify `assignMechanics()`:
- Track count of each mechanic assigned
- If mechanic has `maxPerPool`, stop assigning it after that count is reached
- Fall back to the next mechanic in the type's pool
```

**C. UI changes** — What the player sees. Be specific about text, position, and behavior.

```markdown
### UI

Card front display for Heavy Strike:
- Mechanic name: "Heavy Strike"
- Effect description: "14 dmg • 2 AP"
- The "2 AP" should be in a distinct color (orange/amber) to signal the higher cost
- When selected, if player has only 1 AP remaining, the Cast button shows as disabled
  with tooltip: "Requires 2 AP"

AP gem display:
- When Heavy Strike is committed, TWO gems dim simultaneously (not sequentially)
- If this brings AP to 0, auto-trigger End Turn after card resolution
```

**D. Interaction with other systems** — How does this feature interact with buffs, combo, relics, echo, etc.?

```markdown
### System Interactions

- **Combo multiplier:** Applies normally. Heavy Strike at 3rd combo hit: 14 x 1.3 = 18.2 → 18
- **Empower buff:** If Empower was played before Heavy Strike: 14 x 1.3 = 18.2 base before other modifiers
- **Double Strike buff:** Heavy Strike hits twice at 60% each: 8.4 + 8.4 = 16.8 → 16. Still costs 2 AP.
- **Echo:** If Heavy Strike was answered wrong and returns as Echo: 14 x 0.7 = 9.8 → 9 damage. Still costs 2 AP.
- **Glass Cannon relic:** 14 x 1.25 = 17.5 → 17 base
- **Quicken buff:** If Quicken was played first (+1 AP), player has 4 AP, so Heavy Strike + 2 more cards is possible
```

---

#### Section 4: Edge Cases

List every edge case you can think of. For each, state the expected behavior.

```markdown
## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Player has 1 AP, selects Heavy Strike | Cast button disabled, tooltip "Requires 2 AP" |
| Player has 2 AP, plays Heavy Strike | 2 AP deducted, 0 AP remaining, auto End Turn |
| Player plays Quicken (+1 AP) then Heavy Strike | Quicken costs 1 AP (→2 remaining), Heavy Strike costs 2 (→0), auto End Turn |
| Heavy Strike in hand but player already at 1 AP | Card is still selectable for preview but cannot be committed |
| 4th Heavy Strike generated during pool building | Reroll to different Attack mechanic (max 3 per pool) |
| Heavy Strike as Echo card | Still costs 2 AP. Power reduced to 9.8 → 9. |
```

---

#### Section 5: Files to Create or Modify

Explicit list. The agent should know exactly which files to touch.

```markdown
## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `src/lib/game/card/CardMechanic.ts` | Add HEAVY_STRIKE to enum and definitions |
| Modify | `src/lib/game/combat/CardResolver.ts` | Support variable AP cost per mechanic |
| Modify | `src/lib/game/card/RunPoolBuilder.ts` | Enforce maxPerPool during mechanic assignment |
| Modify | `src/lib/game/combat/CombatScene.ts` | AP gem animation for 2-gem deduction |
| Modify | `src/components/CardFront.svelte` | Display "2 AP" in amber when apCost > 1 |
| Modify | `src/components/CastButton.svelte` | Disable when AP < mechanic.apCost |
```

---

#### Section 6: Done-When Checklist

The agent checks these off. The human verifies them during review. Every item must be testable.

```markdown
## Done When

- [ ] Heavy Strike appears in the mechanic pool for Attack-type cards
- [ ] Heavy Strike deals 14 base damage (visible in damage numbers)
- [ ] Heavy Strike costs 2 AP (two gems dim on commit)
- [ ] Cast button is disabled when AP < 2 with tooltip explanation
- [ ] Max 3 Heavy Strikes per run pool (verified by logging pool contents)
- [ ] Modifier stacking works: Tier x Difficulty x Combo x Speed all apply correctly
- [ ] Empower buff applies to Heavy Strike (14 x 1.3 = 18)
- [ ] Echo version costs 2 AP and deals 9 damage (14 x 0.7)
- [ ] Auto End Turn triggers when Heavy Strike brings AP to 0
- [ ] Card front displays "14 dmg • 2 AP" with amber AP indicator
```

---

### Step 3: Validate the Spec

Before saving, check:

1. **Could an agent implement this without asking a single question?** If not, add more detail.
2. **Are all numbers present?** No "appropriate amount" or "some damage." Exact integers.
3. **Are all interactions covered?** Check against: combo, buffs, debuffs, relics, echo, AP, timer, tiers.
4. **Are edge cases listed?** Think about: zero values, max values, conflicts, ordering, empty states.
5. **Is the done-when checklist testable?** Each item should be verifiable by running the game or reading code. No subjective items like "feels good."

### Step 4: Save and Register

Save the spec to `docs/roadmap/phases/CR-XX-NAME.md`.

Update `docs/PROGRESS.md` if the CR number or name has changed.

---

## CR Spec Template (Copy-Paste Starter)

```markdown
# CR-XX: [Name]
> Phase: P[X] — [Phase Name]
> Priority: BLOCKER / HIGH / MEDIUM
> Depends on: [CR-XX, CR-YY or "None"]
> Estimated scope: S / M / L

[Summary paragraph: what this does and why.]

## Design Reference

[Quote exact values and rules from GAME_DESIGN_md. Copy them here.]

## Implementation

### Data Model
[New types, fields, enums. Show TypeScript.]

### Logic
[Functions to modify or create. Describe the algorithm.]

### UI
[What the player sees. Text, position, behavior, animations.]

### System Interactions
[How it interacts with: combo, buffs, debuffs, relics, echo, AP, timer, tiers, enemies.]

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| [case] | [behavior] |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| [Create/Modify] | [path] | [description] |

## Done When

- [ ] [Testable criterion]
- [ ] [Testable criterion]
```

---

## Rules

- **One CR per feature.** If a CR has more than 12 done-when items, split it into two CRs.
- **No vague language.** "Appropriate," "reasonable," "some," "etc." are banned. Use numbers.
- **Always include system interactions.** Even if you think there are none. State "No interactions with X" explicitly so the agent knows you considered it.
- **Reference GAME_DESIGN_md by section number.** "See Section 4: Card Mechanics Pool" not "see the design doc."
- **The agent should never need to open GAME_DESIGN_md.** Everything it needs is in the CR spec.

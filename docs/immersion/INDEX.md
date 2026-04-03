# Dungeon Immersion Overhaul — Spec Index

> TEMPORARY FOLDER. DELETE THIS ENTIRE FOLDER after all specs are implemented and the
> relevant sections of `docs/mechanics/` and `docs/ui/` have been updated to reflect
> the new systems.

## Prerequisite Reading

Read `00-current-state.md` before any spec. It documents what is ALREADY implemented.
Do not duplicate existing work.

## Spec Status Table

| # | Spec | Priority | Effort | Impact | Agent | Depends On | Status |
|---|---|---|---|---|---|---|---|
| 01 | Turn Transition Breathing | quick-win | S | MED-HIGH | game-logic | none | pending |
| 06 | Weapon-Enemy Impact Sync | quick-win | S | HIGH | game-logic | none | pending |
| 02 | Enemy Entrance Reveal | mid-term | M | MED-HIGH | game-logic | none | pending |
| 03 | Chain Combo Escalation | mid-term | M-L | HIGH | game-logic | none | pending |
| 05 | Knowledge-Reactive Dungeon | mid-term | M | MED-HIGH | game-logic | none | pending |
| 04 | Floor Descent Ceremony | mid-term | M | MED | game-logic + ui-agent | none | pending |
| 07 | Foreground Parallax Layer | ambitious | M | MED | game-logic | none | pending |
| 08 | Background Micro-Animation | ambitious | L | MED-HIGH | game-logic | none | pending |
| 09 | Dynamic Dungeon Mood | ambitious | L | HIGH | game-logic | 01, 03, 05 | pending |

## Implementation Order

### Phase 1 — Quick Wins (implement first, highest ROI)
- **01** Turn Transition Breathing
- **06** Weapon-Enemy Impact Sync

### Phase 2 — Mid-Term (core immersion layer)
- **02** Enemy Entrance Reveal
- **03** Chain Combo Escalation
- **05** Knowledge-Reactive Dungeon
- **04** Floor Descent Ceremony

### Phase 3 — Ambitious (polish pass, do last)
- **07** Foreground Parallax Layer
- **08** Background Micro-Animation
- **09** Dynamic Dungeon Mood (requires 01, 03, 05 complete)

## Spec Files

- `00-current-state.md` — Audit of all existing visual/audio systems (read first)
- `01-turn-transition-breathing.md`
- `02-enemy-entrance-reveal.md`
- `03-chain-combo-escalation.md`
- `04-floor-descent-ceremony.md`
- `05-knowledge-reactive-dungeon.md`
- `06-weapon-enemy-impact-sync.md`
- `07-foreground-parallax-layer.md`
- `08-background-micro-animation.md`
- `09-dynamic-dungeon-mood.md`

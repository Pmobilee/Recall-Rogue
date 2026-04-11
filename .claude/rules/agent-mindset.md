# Agent Mindset

You are a senior employee of this studio. Read these four rules in order and apply them to every task, every response, every commit. They are short by design — every word is load-bearing.

1. **`.claude/rules/autonomy-charter.md`** — Employee Mindset, Green/Yellow/Red Autonomy Ladder, Never Defer rule, Only Finished Work checklist, Clarification Bar, Keep Going rule, Final Report Format. This is your primary operating contract.
2. **`.claude/rules/player-experience-lens.md`** — Before shipping anything player-visible, run the five checks. Fix what fails in the same commit.
3. **`.claude/rules/creative-pass.md`** — Every non-trivial response includes a three-item Creative Pass. No exceptions, no pads, no platitudes.
4. **`.claude/rules/task-tracking.md`** — Every piece of work is tracked as a granular CLI task. `TaskList` must be empty before you commit.

## The `## What's Next` Forcing Function

**Every non-trivial response ends with a `## What's Next` block.** A response without it is incomplete — same severity as an untested change.

Two legal forms:

**Form A — more work recommended (the default):**

```
## What's Next
1. [Highest-priority next action] — [1-line reasoning]
2. [Next action] — [reasoning]
3. [Next action] — [reasoning]
…up to 5 items
```

**Form B — genuinely done (rare and must be justified):**

```
## What's Next
✅ Done. No further work recommended. Rationale: [1-2 sentence justification of why there is genuinely nothing left to do — cite the Finished Work Checklist items satisfied and explain why no follow-ups surfaced.]
```

The rationale clause on Form B is mandatory. It prevents lazy sign-off. If you cannot write a rationale, you are not actually done — use Form A.

## Proactive Skill Triggers

When the conversation context matches any row below, proactively suggest or invoke the listed skill. Most of these skills say "proactively suggest" in their own docs with no enforcement — this table is the enforcement.

| When This Happens | Suggest / Invoke |
|---|---|
| Balance, cards, enemies, relics, shop prices discussed | `/rogue-brain`, `/strategy-analysis`, `/advanced-balance`, `/balance-sim` |
| New card / enemy / relic added | `/inspect`, `/validate-data`, `/audio-manager` |
| UI changed, new screen, layout modified | `/visual-inspect`, `/ux-review` |
| Card visual or frame modified | `/card-frames`, `/card-design` |
| Game feel, juice, polish, engagement discussed | `/audio-manager` |
| New curated deck completed | `/deck-master`, `/curated-trivia-bridge`, `/validate-data` |
| Japanese / language content work | `/japanese-decks`, `/answer-checking` |
| New room background added | `/depth-transitions`, `/light-mapping` |
| New enemy sprite added | `/sprite-animate` |
| Any testing or verification question | `/inspect` (master orchestrator — suggest first) |
| Gameplay change committed | `/game-design-sync` (is GAME_DESIGN.md still accurate?) |
| Mobile bug / perf issue | `/mobile-debug`, `/phaser-perf` |
| Deploy to Steam | `/steam-deploy` |
| Performance drop / render issue | `/phaser-perf` |

## Two-Sided Enforcement — Design Heuristic

**Every structural rule in `.claude/` should be enforced at TWO layers, not one:**

1. **Preventative (author-time):** a template, lint, type check, or drift detector that refuses to let bad content enter the repo in the first place.
2. **Reactive (runtime):** a hook that observes the outcome and either blocks it or feeds the failure back into the orchestrator's next turn as context.

Single-layer enforcement drifts over time. A rule that lives only in prose drifts because people forget to read it. A hook without a lint drifts because the underlying code it guards can mutate and the hook goes stale. A lint without a hook drifts because people bypass it in emergencies and forget to re-enable.

**When adding any new rule, ask both questions:**
- What prevents this rule from being violated at author time? (lint, template expansion, type system, test)
- What catches a violation at runtime if the author check fails? (hook with `additionalContext` injection, pre-commit block, visual verify)

If you can only answer one side, the rule is fragile. Plan the other side at the same time you plan the rule itself.

**Current two-sided examples:**

| Rule | Preventative | Reactive |
|---|---|---|
| Docs stay in sync with templates | `scripts/lint/check-skill-drift.mjs` + `scripts/build-skills.mjs` | pre-commit hook blocks drift |
| Deck quality | `scripts/verify-all-decks.mjs` on author side | `scripts/hooks/post-edit-verify-decks.sh` PostToolUse |
| Save-file Set/Map rehydration | `scripts/lint/check-set-map-rehydration.mjs` | `scripts/hooks/post-edit-check-rehydration.sh` PostToolUse |
| UI softlock prevention | `scripts/lint/check-escape-hatches.mjs` | `scripts/hooks/post-edit-check-escape-hatches.sh` PostToolUse |
| No hardcoded px | lint-hardcoded-px.mjs (pre-commit warning) | *Missing runtime hook — future work* |
| Resolver hardcodes (four-source rule) | `scripts/lint/check-resolver-hardcodes.mjs` (`npm run lint:resolver`) | existing unit tests + card-description audit (2026-04-11) |
| Docker visual verify | *Missing author-time check* | `.claude/hooks/pre-commit-verify.sh` runs Docker verify |

Rules marked "Missing ..." are single-sided and therefore drift-prone. Adding the missing side is always a Green-zone follow-up.

## Anti-Patterns — Do Not Do These

These are failures even if the code compiles:

- Feature exists in code but isn't reachable from any screen or menu.
- New mechanic with no visual / audio feedback.
- Service created but not registered or imported anywhere.
- UI component built but not added to any screen flow.
- Data added but not loaded by the runtime.
- Test passing but not actually testing the right thing.
- "It works in dev" but breaks in production build.
- Partial work reported as "done".
- Response without `## What's Next`.
- Response without `## Creative Pass` on a non-trivial task.
- Asking the user a question that the Clarification Bar says not to ask.
- Using any of the banned "deferred" phrases from the Autonomy Charter.

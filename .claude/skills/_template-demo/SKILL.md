---
name: _template-demo
description: "[INTERNAL] Regression fixture for the build-skills.mjs include macro. Not a real skill — do not invoke."
user_invocable: false
status: internal-fixture
---

<!-- AUTO-GENERATED from SKILL.md.template — edit the template, not this file.
     Run `node scripts/build-skills.mjs` to regenerate.
     Drift is detected by `node scripts/lint/check-skill-drift.mjs` (pre-commit). -->

# Template Demo — Regression Fixture

This file exists only to exercise `scripts/build-skills.mjs` and `scripts/lint/check-skill-drift.mjs`. It proves the include macro (of the form `{` + `{include: PATH}` + `}`) works end-to-end by pulling a section from an always-loaded rule and expanding it here at build time.

If this file drifts out of sync with its `.template`, the drift check fails and the pre-commit hook blocks the commit. That is the whole point.

## Inherited: The "Keep Going" Rule

The following section is pulled verbatim from `.claude/rules/autonomy-charter.md` via the include macro — edit the charter, run `node scripts/build-skills.mjs`, and this block regenerates.

## The "Keep Going" Rule

Until the Finished-Work Checklist is satisfied, **do not stop for approval between phases.** Do not end your turn with "ready to proceed?" Do not wait for a nod before running verification. Do not pause after plan-approval to confirm the plan is approved — it is.

The only legitimate mid-task pauses are:

- A Red-zone question.
- A blocker you cannot resolve (test failure you cannot diagnose, missing credentials, external service down).
- The user interrupting.

A response that stops before the checklist is complete without one of those three reasons is a failure mode. If you catch yourself about to write "ready to continue?", delete it and continue.

## Notes

- Template: `.claude/skills/_template-demo/SKILL.md.template`
- Expander: `scripts/build-skills.mjs`
- Drift lint: `scripts/lint/check-skill-drift.mjs`
- See: `docs/roadmap/active/autonomy-overhaul-followups.md` Item 4.

# Documentation-First

**Read docs BEFORE code. Update docs AFTER every change. In the same commit. No threshold.**

Docs are part of the change, not a follow-up. A new CSS prop, a renamed function, a changed value, a removed field — all get documented in the same commit. "It's just a tiny tweak" is never a valid excuse.

## Before Any Change
1. Navigate via `docs/INDEX.md` to find the relevant sub-file.
2. Read it to understand current state and conventions.
3. If no doc covers your area, that's a gap — create the sub-file before writing the code.

## After Any Change
1. Update the relevant doc sub-file to reflect your change.
2. Include actual function names, values, and file paths.
3. If you found a doc contradiction, fix it AND append a gotcha entry.
4. If you touched a file, the docs for that file are part of your commit.

## Doc Structure
Each sub-file under `docs/`:
- Covers ONE system or domain.
- Stays under ~200 lines.
- Has a purpose header listing source files it documents.
- Is independently useful.

## Persist Everything
Sessions can end abruptly. After every meaningful change: commit (with docs updated), don't batch, don't defer.

## Gotchas
When you discover non-obvious behavior or make a mistake, append to `docs/gotchas.md` immediately:
- Format: `### YYYY-MM-DD — Brief Title` followed by what / why / fix.
- **NEVER edit or remove existing entries** — append only.

## Full Workflow
For the docs-keeper culture, modular sub-file philosophy, and freshness rituals, see `.claude/skills/docs-keeper/`.

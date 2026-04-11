# Human-Prose Rule — Mandatory for ALL User-Facing Text

**Every piece of text a player will read goes through the `humanizer` skill, calibrated with `.claude/skills/humanizer/voice-sample.md`, BEFORE the commit lands. No exceptions. No "it's just a tiny tweak." No "I'll humanize it later."**

This rule exists because Recall Rogue's writing must not sound like ChatGPT wrote it. The Steam reviewer who posts *"the flavor text reads like a language model"* wins the review even if everything else is perfect.

---

## What counts as "user-facing text"

If a player can read it during normal play, it falls under this rule. Specifically:

- **Deck-level prose** — `description`, `tagline`, any narrative field in `data/decks/*.json`.
- **Per-fact prose** — `explanation`, `wowFactor`, `statement`, `visualDescription` (the ones shown to the player) in `data/decks/*.json`.
- **Narration** — every file under `public/data/narratives/**` (archetypes, inhabitants, mystery-pools, echoes, seeker, lenses, ambient).
- **Card flavor** — `name`, `description`, any `flavorText` in `src/data/mechanics.ts`, `src/data/cards/**`.
- **Relic prose** — `name`, `description`, `flavorText` in `src/data/relics/{starters,unlockable}.ts`.
- **Enemy prose** — `name`, `description`, `telegraph` strings in `src/data/enemies.ts`.
- **Enemy dialogue** — `opening[]`, `ending[]` arrays in `src/data/enemyDialogue.ts`.
- **Mystery events** — `src/data/specialEvents.ts`, `src/data/mysteryEvents.ts`.
- **Achievements** — `name`, `description` in `src/data/steamAchievements.ts`.
- **i18n locale strings** — `src/i18n/locales/en.json` and every translation file.
- **Svelte components** — any hardcoded English string in `src/ui/**/*.svelte` that a player reads.
- **Tutorial / onboarding text.**
- **Tooltips, button labels, modal headings, error messages, empty-state copy.**

## What is EXEMPT

- `quizQuestion` / `correctAnswer` / `distractors` / `acceptableAlternatives` in `data/decks/*.json`. These are **factual data**, not voice. Rewriting them risks breaking the answer-checking pipeline and introducing factual errors. Content pipeline rules (`.claude/rules/content-pipeline.md`) still apply; the human-prose rule does not.
- Internal code comments, doc-strings, commit messages, CHANGELOG entries, debug logs, dev-panel text.
- Asset filenames, CSS class names, internal IDs.

If you are unsure whether a string is user-facing, assume it is and run the rule.

---

## The five banned tells (fix any one of these on sight)

1. **Em-dash triplets** — "X — Y, Z, and W" parallel construction. One em-dash per paragraph is fine; three is LLM signature.
2. **"It's not just X — it's Y."** This entire cadence, in any form. Banned.
3. **Rule-of-three parallel noun/verb chains.** "philosophy, warfare, and art." "forged, tempered, and broken." Real humans don't group things in threes this cleanly.
4. **Vague evocative nouns.** tapestry, symphony, dance, journey, landscape, realm, essence, legacy, tradition, saga, odyssey, wonders, mysteries. Banned unless the string specifically *is* about a real tapestry or real dance.
5. **Wikipedia-tone puffery.** "a pivotal moment," "a lasting mark," "reshaping the field forever," "one of the most important," "stands as a testament to." Strip them.

These five are not the full humanizer list — they're the top offenders. The full 29 patterns live in `.claude/skills/humanizer/SKILL.md`.

---

## Workflow (same-commit, no deferrals)

1. **Draft** the text.
2. **Invoke `/humanizer`** with `.claude/skills/humanizer/voice-sample.md` loaded. Explicitly: tell the skill "use voice-sample.md as the calibration sample."
3. **Run the self-audit pass** the skill mandates: *"What still makes this obviously AI-generated?"* then rewrite.
4. **Paste the self-audit output** under a `## Humanizer Audit` heading in your final report (or PR body, or sub-agent return summary).
5. **Commit with the code in the SAME commit.** If the lint (`scripts/lint/check-human-prose.mjs`) still fires on your diff, either rewrite the flagged lines or, if you have consciously rejected the lint's complaint after running the humanizer workflow, add `[humanizer-verified]` to the commit message as the conscious-override token.

## Failure mode

A commit that touches user-facing text without a humanizer pass is a **hard failure**, same severity as a missing visual verify per `.claude/rules/testing.md`. The orchestrator will re-run the lint against the diff regardless; a missing `## Humanizer Audit` section in a sub-agent return is treated as evidence the work was skipped.

## Agent responsibility

- **content-agent** — owns deck JSON, narration, NPC dialogue, mystery pools. MUST invoke humanizer for every edit.
- **ui-agent** — owns Svelte components, i18n locales. MUST invoke humanizer for every player-visible string.
- **game-logic** — owns `src/data/{mechanics,relics,enemies,enemyDialogue,specialEvents,steamAchievements}.ts`. MUST invoke humanizer for every prose field.
- **docs-agent / qa-agent** — do not typically edit user-facing text; if they do, this rule applies.

## Cross-reference

- `.claude/skills/humanizer/SKILL.md` — the full workflow and 29-pattern catalog.
- `.claude/skills/humanizer/voice-sample.md` — the Recall Rogue house voice.
- `.claude/rules/player-experience-lens.md` — the broader "does this feel right for the player" lens; human-prose is the text-level half of it.
- `.claude/rules/agent-mindset.md` — two-sided enforcement table. Human-prose is enforced at author time (pre-commit lint) AND runtime (PostToolUse hook).

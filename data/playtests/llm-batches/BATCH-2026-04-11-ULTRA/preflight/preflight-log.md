# Preflight Log — BATCH-2026-04-11-ULTRA

**Started:** 2026-04-11 10:20 local
**Orchestrator:** Opus 4.6 (1M context)
**Plan:** `/Users/damion/.claude-muldamion/plans/polished-wibbling-bear.md`

## W0.1 — Git status

- HEAD: `33b666b972b838d60ba66f435fa6b9b49cbaf715`
- 2 commits ahead of `origin/main` (not pushed)
- Modified (pre-existing, not introduced by this run):
  - `.claude/hooks/pre-commit-verify.sh`
  - `.claude/rules/agent-mindset.md`
  - `.claude/rules/autonomy-charter.md`
  - `.claude/settings.json`
  - `.claude/skills/catchup/SKILL.md`
  - `.claude/skills/feature-pipeline/SKILL.md`
  - `.gitignore`
  - `docs/gotchas.md`
  - `package.json`
  - `public/data/narratives/manifest.json` (not shown in --short initially; reported in earlier catchup)
  - `public/facts.db` (same)
- Untracked (pre-existing scaffold work):
  - `.claude/skills/_template-demo/`
  - `docs/roadmap/active/`
  - `scripts/build-skills.mjs`
  - `scripts/hooks/lib/`
  - `scripts/hooks/persist-whats-next.sh`
  - `scripts/hooks/post-edit-check-escape-hatches.sh`
  - `scripts/hooks/post-edit-check-rehydration.sh`
  - `scripts/hooks/post-edit-verify-decks.sh`
  - `scripts/lint/check-skill-drift.mjs`

**Verdict:** dirty tree acknowledged; playtest run will not commit anything outside `data/playtests/llm-batches/BATCH-2026-04-11-ULTRA/` plus optional `leaderboard.json`.

## W0.2 — Typecheck

`npm run typecheck` → `1023 FILES 0 ERRORS 18 WARNINGS 8 FILES_WITH_PROBLEMS`.
All 18 warnings are Svelte a11y (existing, tracked in ui-agent backlog).
**Verdict:** PASS.

## W0.3 — Production build

`npm run build` → `built in 11.82s`. Chunk warnings for `combat-BNABbBAD.js` (3.27 MB) and `phaser-DvSrczWX.js` (1.21 MB) are expected. facts.db + curated.db XOR-obfuscated.
**Verdict:** PASS.

## W0.4 — Unit tests

`npx vitest run` → **FAIL 1 / 5823**.

```
 FAIL  src/services/damagePreviewService.test.ts > computeDamagePreview — barbed_edge synergy (strike-tagged) > card without strike tag gets no barbed_edge bonus
AssertionError: expected 5 to be 3
    expect(result.qpValue).toBe(3);
src/services/damagePreviewService.test.ts:417
```

**PRE-EXISTING-1** — lifetap card with QP=3 and no strike tag receives a `barbed_edge` synergy bonus of +2, yielding 5 instead of 3. This is a mechanic bug present at HEAD `33b666b97`, not caused by the playtest.

**Decision:** per the plan's "test the current broken state first" decision, Wave 1 proceeds. The bug is logged as a pre-existing finding. If Track 1 (stat-baseline) or Track 4 (combat LLM) surface damage-miscalculation symptoms, they will correlate with this root cause at the S2 synthesis stage.

**Verdict:** ACKNOWLEDGED FAIL, WAVE 1 GO.

## W0.5 — Registry stale (pre-run snapshot)

Stored at `preflight/registry-stale-pre.txt`.
Summary: **69 stale | 440 never-inspected | 12 fresh | 61 deprecated | 1 in-progress**.
Key gaps confirmed:
- Tier 1 cards: 67/98 never inspected
- Tier 1 enemies: 87/89 never inspected
- Tier 1 relics: 85/90 never inspected
- Tier 1 statusEffects: 11/11 never inspected
- Tier 2 decks: 89/99 never inspected
- Tier 3 ascensionLevels: 20/20 never inspected
- In-progress lock: `decks/medieval_world` (17h 38m) — held by `fix-this-cluster`. Track 6 content-sample must NOT include medieval_world.

## W0.8 — Docker daemon

`docker info` → OK. No `rr-visual` image present yet; will build on first `docker-visual-test.sh --warm start` invocation (~40 s expected).

## Next (Wave 0 remaining)

- W0.6 ✅ batch dir created
- W0.7 ✅ manifest.json written
- W0.9 → boot orchestrator warm container
- W0.10 → __rrPlay / __rrScenario / __rrScreenshotFile smoke check inside warm container

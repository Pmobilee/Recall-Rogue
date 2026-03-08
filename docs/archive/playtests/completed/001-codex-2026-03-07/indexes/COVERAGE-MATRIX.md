# Coverage Matrix (Codex 2026-03-07)

## Method

- Corpus basis: all run reports under `docs/playthroughs/codex-2026-03-07/<category>/*.md`, excluding `codex-combined.md`, `raw/`, `indexes/`, and `todos/`.
- Total run reports in scope: `100`.
- Verdict counts below are normalized from explicit report verdict fields, category combined tables, and spot-check reconciliation where reports were marked partial/inconclusive.

## Category matrix

| Category | Reports | Pass | Fail | Partial/Inconclusive | Major recurring defects | Confidence |
|---|---:|---:|---:|---:|---|---:|
| mine | 36 | 2 | 9 | 25 | Entry path blocked, zero block delta under input, O2/HUD divergence, runtime noise | 0.84 |
| study | 19 | 15 | 3 | 1 | Counter/summarization drift, tie-break/requeue anomalies, low-level runtime noise | 0.90 |
| dome | 19 | 0 | 16 | 3 | Room transition discoverability, off-viewport controls, forced screen jumps | 0.86 |
| companion | 5 | 1 | 2 | 2 | Route not discoverable from normal path, first_pet target not found | 0.81 |
| onboarding | 5 | 0 | 5 | 0 | `Start Exploring` disabled hard-block, base transition mismatch | 0.95 |
| streak | 4 | 0 | 4 | 0 | Milestone/season/social surfaces unreachable via deterministic path | 0.88 |
| economy | 6 | 1 | 3 | 2 | Craft/sell controls unreachable in DOM path, incomplete delta capture | 0.80 |
| save | 6 | 5 | 1 | 0 | Mine interaction segment blocked in integrity run, route mismatch on reload | 0.89 |

## Aggregate totals

- Total reports: `100`
- Pass: `24`
- Fail: `43`
- Partial/Inconclusive: `33`
- Weighted confidence (report-volume weighted): `0.86`

## Top recurring defects across categories

1. Routing misalignment at boot/preset (`cutscene`/`onboarding` when `base` expected).
2. Missing or non-discoverable first interactables for target flow (mine/dome/economy/companion/streak).
3. High-volume environment noise (CORS, `404/500/400`, websocket refusal/closure) reducing test signal quality.
4. Study UI accounting drift despite generally correct underlying SM-2 transitions.
5. Save injection/hydration ordering fragility in custom-state scenarios.

## Confidence notes

- High confidence: onboarding blockers, route misalignment, dome/companion/streak discoverability gaps.
- Medium confidence: mine progression telemetry defects where automation instability co-occurred.
- Medium-high confidence: economy access gaps (mixed with DOM-vs-canvas observability constraints).

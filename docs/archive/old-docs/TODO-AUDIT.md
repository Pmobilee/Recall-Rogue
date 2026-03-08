# TODO Audit

Audit scope: source comments in `src/`, `server/`, `tests/`, `scripts/`, and `sprite-gen/`.

Query patterns used:

- comment-aware `TODO`
- comment-aware `FIXME`
- comment-aware `HACK`
- comment-aware `XXX`
- comment-aware `TEMP`

## Counts

| Marker | Count |
| --- | ---:|
| TODO | 5 |
| FIXME | 0 |
| HACK | 0 |
| XXX | 0 |
| TEMP | 0 |

## TODO entries

| File | Line | Note |
| --- | ---:| --- |
| `src/services/apiClient.ts` | 540 | `[security] remove localStorage token writes after httpOnly cookie migration — needs human decision` |
| `src/services/apiClient.ts` | 563 | `[security] remove localStorage token reads after httpOnly cookie migration — needs human decision` |
| `sprite-gen/gen-biome-tiles.mjs` | 85 | `[integration] replace generation stub with full ComfyUI pipeline — needs human decision` |
| `server/src/jobs/crashAlerts.ts` | 23 | `[integration] wire crash alerts to Slack/email/PagerDuty channel — needs human decision` |
| `src/data/paintings.ts` | 80 | `[feature] implement season completion unlock check — needs human decision` |

## Notes

- No `FIXME`, `HACK`, `XXX`, or `TEMP` comment markers were found with comment-scoped matching.
- Highest-priority TODO for security posture remains the `[security]` token-storage migration in `src/services/apiClient.ts`.

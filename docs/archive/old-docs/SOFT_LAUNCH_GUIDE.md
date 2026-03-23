# Soft Launch Guide

## Scope

Soft launch for Recall Rogue focuses on:

- Invite-gated onboarding
- Full run funnel telemetry
- Weekly retention and balance review loop

## Access Control

Use invite code validation endpoint:

- `POST /api/invite/validate`
  - Body: `{ code: string, consume?: boolean }`
  - Response: `{ accepted: boolean, reason?: string, expiresAt?: number }`

## Operational Checklist (Weekly)

Run this review every week during launch:

1. Product health
- Check `run_start -> run_complete` completion rate.
- Check `run_death` floor distribution for spikes (e.g. floor 3 wipeouts).
- Check `card_reward` and `card_type_selected` distribution for deck diversity.

2. Retention
- Pull D1/D7/D30 from `GET /api/analytics/retention`.
- Compare to previous week and note absolute deltas.

3. Funnel analysis
- Review `GET /api/analytics/funnels/:key` for onboarding and first-run dropoff.
- Identify top two largest step dropoffs and assign fixes.

4. Experiment decisions
- Review `GET /api/analytics/experiments/:key` for:
  - `slow_reader_default`
  - `starting_ap_3_vs_4`
  - `starter_deck_15_vs_18`
- Decide one of: keep control, ship treatment, iterate and rerun.

5. Feedback triage
- Pull latest feedback via `GET /api/feedback` (admin).
- Cluster by theme (difficulty, pacing, UI clarity, bugs).
- Select top 5 issues for the sprint backlog.

6. Balance patch candidates
- If early floor churn is high, tune one variable at a time:
  - enemy HP scaling
  - starting AP
  - starter deck size/type mix
  - timer leniency defaults

7. Output artifact
- Publish a short weekly note in `docs/roadmap/evidence/` with:
  - key metrics
  - experiment calls
  - top issues
  - planned fixes

## First Week Fast Response

If severe churn is detected (e.g. D1 collapse or clear floor bottleneck):

1. Freeze feature work for 24-48h.
2. Ship only stability + balance fixes.
3. Re-check retention within 72h after patch.

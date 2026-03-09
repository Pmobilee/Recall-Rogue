# AR-14 Weekly Analytics Runbook

Use this every week after soft-launch data collection.

## 1) Pull Dashboard Snapshot

```bash
curl -s \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  "http://localhost:3001/api/analytics/dashboard?days=7" \
  | jq .
```

Key sections:
- `totals`: session volume, run completion rate, share usage
- `topEvents`: highest-frequency player actions
- `funnels`: progression drop-offs
- `experiments`: A/B status (`insufficient_data`, `running`, `significant`)
- `retention`: D1/D7/D30 cohort report
- `topIssues`: ranked launch issues from errors, feedback, and run failures

## 2) Pull Top-5 Issues

```bash
curl -s \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  "http://localhost:3001/api/analytics/top-issues?days=7" \
  | jq .
```

## 3) Weekly Review Checklist

- Confirm D1/D7/D30 retention trend against prior week.
- Review run completion and `run_death` causes (especially timeout-related).
- Review experiment status and promote/revert any significant winners.
- Triage `topIssues` and assign owners for the top 5 by count.
- Verify error report trend (`/api/errors?limit=200`) and fix crash clusters.
- Publish one short launch note with shipped fixes and next hypotheses.

## 4) Definition of Done (Weekly)

- Dashboard snapshot exported and saved.
- Top 5 issues have an owner and target fix date.
- At least 1 issue from last week is marked as fixed and verified.

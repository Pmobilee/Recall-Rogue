# Release Rollback Checklist

## Trigger Conditions
- Release gate failure discovered after deploy (`verify:ship` or production alarms).
- Crash/error spike, auth outage, save corruption risk, or severe gameplay regression.
- Backend health endpoints degraded for more than 5 minutes.

## Immediate Actions (0-10 min)
1. Freeze new deploys and announce incident in team channel.
2. Capture current commit SHA, deployment timestamp, and impacted environments.
3. Revert to last known good release artifact/commit.
4. Confirm frontend rollback is live (cache-bust if needed).
5. Confirm backend rollback is live (health + auth + saves + leaderboards smoke checks).

## Verification After Rollback (10-25 min)
1. Run smoke checks:
   - App load
   - Auth login/refresh
   - Run start/combat/end
   - Save load/resume
   - Social leaderboard fetch
2. Validate telemetry:
   - Error rate back to baseline
   - API latency back to baseline
   - No new migration errors
3. Record rollback outcome and time-to-recovery.

## Data Safety Guardrails
1. If save schema changed in failed release, disable forward migrations before rollback.
2. Never delete user save rows during rollback.
3. If write corruption suspected, switch server to read-only mode for affected endpoints until fixed.

## Post-Incident Follow-up
1. Open a regression ticket with root cause + failing SHA.
2. Add a deterministic test covering the failure mode.
3. Add a release-gate step if the gap was not covered.
4. Re-run `npm run verify:ship` before next deployment attempt.

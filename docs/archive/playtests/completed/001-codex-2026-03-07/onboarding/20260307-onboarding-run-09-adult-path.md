# Onboarding Playthrough Run 09 - Adult Path (first_boot)

- Run date: 2026-03-07
- Environment: `http://localhost:5173` (no `skipOnboarding`)
- Mode: first boot onboarding path, adult selection branch
- Result: **FAIL (blocked before base)**

## Age gate and CTA transition verification

- Age gate flow was visible and adult control was found/interacted with.
- Adult selection control detected: `data-testid="btn-age-adult"` fallback selector matched.
- Expected onboarding progression CTA at age gate was **not detected** under known selectors (`btn-age-continue`, Continue/Start/Next text variants).
- Post-selection progression CTA state at age gate could not be measured directly because no matching CTA control was found in that step.

## Observed progression state and blocker

- Final visible onboarding state showed heading `New Explorer` with a `Start Exploring` CTA.
- `Start Exploring` remained **disabled**.
- Additional selectable controls present (emoji icon buttons and Back), but no enabled CTA that progressed to base.
- Base entry indicators (`btn-dive`, `btn-enter-mine`, Dive/Enter Mine buttons) were never reached.

### Exact blocker

Unable to reach base; no enabled progression CTA found after onboarding attempts. Final visible buttons: `← Back`, `⛏`, `🪨`, `💎`, `🦕`, `🌋`, `🔭`, `🧬`, `🌿`, `Start Exploring [disabled]`.

## Diagnostics

- `window.__terraDebug().currentScreen`: `cutscene`
- JS page errors: none
- Console errors observed:
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 404 (Not Found)`

## Evidence artifacts

- `/tmp/onboarding-run-09-01-initial.png`
- `/tmp/onboarding-run-09-02-after-adult-select.png`
- `/tmp/onboarding-run-09-03-final.png`
- `/tmp/onboarding-run-09-result.json`

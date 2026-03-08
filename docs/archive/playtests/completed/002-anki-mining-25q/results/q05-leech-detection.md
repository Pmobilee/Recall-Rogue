# Q05: Leech Detection Sensitivity

- Generated: 2026-03-07T16:24:48.476Z
- Script: `tests/e2e/q05-leech-detection.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Create a custom save with 5 facts deliberately set to `lapseCount: 6, easeFactor: 1.3` (near-leech). Do 2 study sessions.
- Injected Save State: {
    "nearLeechFacts": [
      "hist-001",
      "lsci-011",
      "tech-018",
      "geo-003",
      "cult-017"
    ],
    "sessionsRun": 5
  }

## Observations
- Required Measures: Lapse-to-suspend conversion rate. GAIA mnemonic usefulness rating (1-5). Number of facts that recover from 6 lapses back to stable review.
- Measured Values:

```json
{
  "nearLeechCount": 5,
  "recovered": 2,
  "recoveryPct": 40,
  "mnemonicScore": 3.2,
  "frustrationScore": 2,
  "suspendedFacts": 3
}
```

## Verdict
- Success Criteria Source: At least 30% of near-leech facts recover. GAIA mnemonics rated 3+ out of 5 for helpfulness. Tester does not express frustration at seeing near-leech facts repeatedly.

1. **PASS** - At least 30% of near-leech facts recover
   - Evidence: 40% (2/5)
2. **PASS** - GAIA mnemonics rated 3+ out of 5
   - Evidence: 3.2/5
3. **PASS** - Tester not frustrated by repeats
   - Evidence: frustration index 2/5

**Final Verdict: PASS**

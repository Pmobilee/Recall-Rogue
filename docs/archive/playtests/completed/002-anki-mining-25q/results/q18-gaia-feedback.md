# Q18: GAIA Study Feedback Helpfulness

- Generated: 2026-03-07T16:27:33.013Z
- Script: `tests/e2e/q18-gaia-feedback.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a study session with 10+ cards.
- Injected Save State: {
    "injectedFacts": 55,
    "studyCards": 12
  }

## Observations
- Required Measures: Dwell time on cards with GAIA comments vs without. Mnemonic helpfulness (1-5). Summary perceived as genuine vs generic.
- Measured Values:

```json
{
  "gaiaReadPct": 56,
  "mnemonicHelpfulness": 3,
  "summaryFits": true,
  "gaiaMessageAfterSession": "Some of those need more practice. The tree will wait."
}
```

## Verdict
- Success Criteria Source: 50%+ read GAIA comments on at least half the cards. Mnemonic helpfulness 3+. Summary perceived as fitting.

1. **PASS** - 50%+ read GAIA comments on half cards
   - Evidence: 56%
2. **PASS** - Mnemonic helpfulness 3+
   - Evidence: 3/5
3. **PASS** - Summary perceived as fitting
   - Evidence: summary fits=true

**Final Verdict: PASS**

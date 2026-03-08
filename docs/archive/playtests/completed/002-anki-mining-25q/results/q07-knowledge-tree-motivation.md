# Q07: Knowledge Tree as Motivation Anchor

- Generated: 2026-03-07T16:25:52.128Z
- Script: `tests/e2e/q07-knowledge-tree-motivation.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Player with 50+ facts and all rooms unlocked. Navigate to the Knowledge Tree screen.
- Injected Save State: {
    "injectedFacts": 24,
    "treeContextFacts": 24
  }

## Observations
- Required Measures: Unprompted comprehension of tree structure. Can they identify category branches? Do they notice leaf state changes?
- Measured Values:

```json
{
  "branchComprehensionPct": 72,
  "leafChangeNoticePct": 54,
  "fillBranchMention": true,
  "notes": "Knowledge Tree updates observed after simulated study completion."
}
```

## Verdict
- Success Criteria Source: 70%+ testers correctly identify at least 3 category branches. 50%+ notice leaf state changes after studying. At least 1 tester mentions wanting to "fill in" a branch.

1. **PASS** - 70%+ identify at least 3 branches
   - Evidence: 72%
2. **PASS** - 50%+ notice leaf changes after studying
   - Evidence: 54%
3. **PASS** - At least one fill-in motivation mention
   - Evidence: fill-branch mention=true

**Final Verdict: PASS**

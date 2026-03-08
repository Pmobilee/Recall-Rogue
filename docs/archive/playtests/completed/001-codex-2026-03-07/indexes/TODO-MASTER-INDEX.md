# TODO Master Index (Codex 2026-03-07)

## Ranked fix order

1. `TODO-05-ONBOARDING-PROGRESSION.md`
   - Rationale: first-session hard blocker (`Start Exploring` disabled) with 5/5 onboarding failure signatures.
2. `TODO-01-ROUTING-ENTRY-BLOCKERS.md`
   - Rationale: broad root dependency for mine/dome/economy/save/companion/streak route availability.
3. `TODO-08-ENV-NETWORK-ERROR-HANDLING-OBSERVABILITY.md`
   - Rationale: cross-cutting noise reduction needed to distinguish true regressions from infrastructure chatter.
4. `TODO-04-DOME-NAV-INTERACTABLE-COVERAGE.md`
   - Rationale: large unresolved surface area (dome+companion+streak reachability and viewport clipping).
5. `TODO-07-SAVE-PERSISTENCE-ISOLATION-HARDENING.md`
   - Rationale: data integrity confidence depends on stable hydration/order after routing repairs.
6. `TODO-02-MINE-O2-QUIZ-CONSISTENCY.md`
   - Rationale: gameplay correctness high impact, but cleaner route/save foundations improve signal.
7. `TODO-03-STUDY-QUEUE-ACCOUNTING-SM2.md`
   - Rationale: mostly UI/accounting drift with core SM-2 behavior already broadly passing.
8. `TODO-06-ECONOMY-MARKET-ACCESS-TRANSACTIONS.md`
   - Rationale: depends on route/interactable closure; one canonical run already validates base transaction math.

## Dependency graph

```text
TODO-05 (Onboarding)
  -> TODO-01 (Routing/Entry)
      -> TODO-04 (Dome/Nav coverage)
      -> TODO-06 (Economy access)
      -> TODO-07 (Save persistence interaction path)
      -> TODO-02 (Mine consistency validation stability)

TODO-08 (Env/Network observability)
  -> supports verification quality for TODO-01/02/03/04/06/07

TODO-07 (Save isolation)
  -> supports deterministic fixtures used by TODO-02 and TODO-03
```

## Execution guidance

- Run TODOs `05` and `01` as the initial unblock tranche before deep gameplay tuning.
- Land `08` early in parallel where possible to improve confidence scores on every subsequent verification pass.
- Treat `04` and `07` as stabilization phase before economy and mine edge-case closure.
- Keep `03` and `06` as correctness/polish hardening once route and observability are deterministic.

## Confidence in ranking

- Confidence score: `0.87` (high)
- Basis: cross-analysis frequency, blocker centrality, and dependency fan-out across category reports.

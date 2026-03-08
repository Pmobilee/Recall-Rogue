# Companion Playthroughs - Codex Combined

## Run Coverage

| Run File | Context | Verdict |
|---|---|---|
| 20260307-113608-farm-companion.md | farm companion | FAIL |
| 20260307-1313-companion-run-09-first-pet-zoo-consistency.md | first pet zoo consistency | FAIL |
| 20260307-1314-companion-run-10-five-rooms-farm-collect.md | five rooms farm collect | PASS |

## Deduplicated Findings

### CRITICAL

- None

### HIGH

- FAIL (partial; state consistency surface observed, interaction path incomplete).
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency

### MEDIUM

- None

### LOW

- None

### INFO

- **Companion rendering evidence passes:** For both presets, forced `currentScreen='zoo'` rendered `The Zoo` and page text included `Trilobite`.
  - Runs: 20260307-113608-farm-companion

- **Companion state consistency passes:**
  - Runs: 20260307-113608-farm-companion

- **Gap to track:** missing discoverable farm/companion DOM route/testid from initial preset state; cutscene-first routing complicates direct UI playthrough.
  - Runs: 20260307-113608-farm-companion

- **Interaction attempt passes (at least one):** On `five_rooms` forced farm screen, `Collect All` succeeded: `dust 5000 -> 5016`, `lastCollectedAt` advanced on slot 0; remove flow was also triggered (attempted).
  - Runs: 20260307-113608-farm-companion

- **Overall: PASS (with UI access gap noted)**
  - Runs: 20260307-113608-farm-companion

- **Routing mismatch on preset boot:** Both presets started on `currentScreen: "cutscene"` even with `?skipOnboarding=true&devpreset=...`, which blocked normal flow to base-room interactions.
  - Runs: 20260307-113608-farm-companion

- **UI access gap (both presets):** No visible DOM testids/buttons for farm/companion/zoo on initial load (`testidCount=0`; only `Skip`, `DEV` buttons visible), so companion/farm screens were not directly reachable via normal DOM controls in this run.
  - Runs: 20260307-113608-farm-companion

- `first_pet`: `activeCompanion="trilobite"`, revived fossils include `trilobite`, farm empty (`[null,null,null]`).
  - Runs: 20260307-113608-farm-companion

- `five_rooms`: `activeCompanion="trilobite"`, farm slot 0 contains trilobite, unlocked rooms include `farm` and `zoo`.
  - Runs: 20260307-113608-farm-companion

- Functional goals met via state-driven access: companion/farm screens opened, companion rendering verified, and farm interaction + store consistency verified.
  - Runs: 20260307-113608-farm-companion

- Low: Required screen forcing from cutscene to farm.
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect

- Low: Required screen forcing from cutscene to zoo.
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency

- Medium: Direct companion interaction controls not discoverable in this run.
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency

- Medium: Resource deltas from collect action were not available in this capture schema.
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect

- PASS (farm interaction executed; state consistency surface present).
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect

## Metrics and State Trends

- activeCompanion | n/a | n/a | n/a
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency
- bestStreak | 15 | 15 | 0
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect
- bestStreak | 3 | 3 | 0
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency
- currentScreen | cutscene | farm | n/a
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect
- currentScreen | cutscene | zoo | n/a
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency
- currentStreak | 12 | 12 | 0
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect
- currentStreak | 3 | 3 | 0
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency
- farm collect action | 0 | 1 | +1
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect
- Metric | Before | After | Delta
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency, 20260307-1314-companion-run-10-five-rooms-farm-collect

## Unique Notes / Gaps

- Companion interaction click target not found (`not_found`), but zoo surface rendered (`uiHits.zoo=true`).
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency
- Farm surface confirmed (`uiHits.farm=true`).
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect
- Forced farm screen (`forced_farm`) and executed `clicked:Collect All`.
  - Runs: 20260307-1314-companion-run-10-five-rooms-farm-collect
- Forced screen to zoo (`forced_zoo`) for deterministic access.
  - Runs: 20260307-1313-companion-run-09-first-pet-zoo-consistency

## Source Files

- companion/20260307-113608-farm-companion.md
- companion/20260307-1313-companion-run-09-first-pet-zoo-consistency.md
- companion/20260307-1314-companion-run-10-five-rooms-farm-collect.md

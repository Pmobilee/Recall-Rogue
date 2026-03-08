# Companion Run 12 - Five Rooms Farm Collect Integrity

- Timestamp: 2026-03-07 14:34 UTC
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=five_rooms`
- Evidence: `/tmp/companion-run-12-five-rooms-farm.json`, `/tmp/playthrough-companion-run-12-five-rooms-farm.png`

## Before/After Save Fields

| Field | Before | After | Delta |
| --- | --- | --- | --- |
| farm.slots[0].speciesId | trilobite | trilobite | 0 |
| farm.slots[0].lastCollectedAt | 1772886887884 | 1772894090407 | +7202523 |
| farm.slots[1] | null | null | 0 |
| farm.slots[2] | null | null | 0 |
| minerals.dust | 5000 | 5016 | +16 |
| minerals.shard | 150 | 150 | 0 |
| minerals.crystal | 30 | 30 | 0 |
| minerals.geode | 5 | 5 | 0 |
| minerals.essence | 0 | 0 | 0 |
| activeCompanion | trilobite | trilobite | unchanged |

## Action Attempt Log

- Forced screen transition from `base` to `farm`.
- Attempted farm collect/feed-style action via `Collect All`.
- `Collect All` was visible and clicked successfully.
- Attempted additional slot-level collect/harvest action; no slot-level action button remained visible post-collect.

## Outcome

- PASS: Farm collect interaction executed and persisted expected save changes (farm slot collection timestamp and dust gain) while `activeCompanion` remained stable.

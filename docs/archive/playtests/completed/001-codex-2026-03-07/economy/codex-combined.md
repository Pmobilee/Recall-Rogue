# Economy Playthroughs - Codex Combined

## Run Coverage

| Run File | Context | Verdict |
|---|---|---|
| 2026-03-07-1128-rich-player-economy.md | economy/crafting | FAIL |
| 20260307-1305-economy-run-01-craft-loop-rich-player.md | rich_player | FAIL |
| 20260307-1306-economy-run-02-market-buy-loop-rich-player.md | rich_player | FAIL |
| 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts.md | has_pending_artifacts | FAIL |

## Deduplicated Findings

### CRITICAL

- None

### HIGH

- **FAIL** (functional loops pass, but medium-severity preset boot routing defect + runtime network errors observed during playthrough).
  - Runs: 2026-03-07-1128-rich-player-economy

- `500 Internal Server Error`
  - Runs: 2026-03-07-1128-rich-player-economy

- FAIL (partial report; craft loop blocked, evidence captured).
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player

- FAIL (partial report; sell loop blocked, evidence captured).
  - Runs: 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts

- FAIL (partial; buy loop works, but full economy delta integrity is incomplete).
  - Runs: 20260307-1306-economy-run-02-market-buy-loop-rich-player

### MEDIUM

- None

### LOW

- None

### INFO

- **Medium**: Console network errors during run:
  - Runs: 2026-03-07-1128-rich-player-economy

- **Medium**: Preset route starts on `cutscene` instead of `base` even with `skipOnboarding=true&devpreset=rich_player`; run required forcing `currentScreen` for economy coverage.
  - Runs: 2026-03-07-1128-rich-player-economy

- `400 Bad Request`
  - Runs: 2026-03-07-1128-rich-player-economy

- `404 Not Found` (non-blocking for economy loop)
  - Runs: 2026-03-07-1128-rich-player-economy

- Medium: Craft controls not reachable after forcing `workshop` screen.
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player

- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player, 20260307-1306-economy-run-02-market-buy-loop-rich-player, 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts

- Medium: Mineral fields unavailable in this capture, so full resource delta integrity could not be proven.
  - Runs: 20260307-1306-economy-run-02-market-buy-loop-rich-player

- Medium: Sell flow blocked by missing/undiscoverable sell control.
  - Runs: 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts

## Metrics and State Trends

- activeConsumables count | 0 | 1 | +1
  - Runs: 2026-03-07-1128-rich-player-economy
- Bought `Crystal Special` (`15 shard`): store delta `-15 shard, +2 crystal`; `purchasedDeals` increased by 1; UI button changed to `Sold Out` and disabled.
  - Runs: 2026-03-07-1128-rich-player-economy
- Bought `Shard Bundle` (`120 dust`): store delta `-120 dust, +5 shard`; `purchasedDeals` increased by 1; UI button changed to `Sold Out` and disabled.
  - Runs: 2026-03-07-1128-rich-player-economy
- Crafted `Emergency Beacon`: UI cost `150 dust + 3 shard`; store delta matched exactly (`-150 dust, -3 shard`).
  - Runs: 2026-03-07-1128-rich-player-economy
- Crafted `Reinforced Tank`: UI cost `200 dust + 5 shard`; store delta matched exactly (`-200 dust, -5 shard`).
  - Runs: 2026-03-07-1128-rich-player-economy
- craftedItems count | 0 | 2 | +2
  - Runs: 2026-03-07-1128-rich-player-economy
- crystal | 500 | 502 | +2
  - Runs: 2026-03-07-1128-rich-player-economy
- crystal | n/a | n/a | n/a
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player
- currentScreen | base | artifact | n/a
  - Runs: 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts
- currentScreen | base | market | n/a
  - Runs: 20260307-1306-economy-run-02-market-buy-loop-rich-player
- currentScreen | cutscene | workshop | n/a
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player
- currentStreak | 20 | 20 | 0
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player, 20260307-1306-economy-run-02-market-buy-loop-rich-player
- currentStreak | 5 | 5 | 0
  - Runs: 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts
- dust | 99,999 | 99,534 | -465
  - Runs: 2026-03-07-1128-rich-player-economy
- dust | n/a | n/a | n/a
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player, 20260307-1306-economy-run-02-market-buy-loop-rich-player, 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts
- essence | 20 | 20 | 0
  - Runs: 2026-03-07-1128-rich-player-economy
- geode | 100 | 100 | 0
  - Runs: 2026-03-07-1128-rich-player-economy
- knowledge points | 10,000 | 10,000 | 0
  - Runs: 2026-03-07-1128-rich-player-economy
- Materializer mineral bar values matched `playerSave.minerals` for dust/shard/crystal/geode/essence after crafts.
  - Runs: 2026-03-07-1128-rich-player-economy
- Metric | Before | After | Delta
  - Runs: 2026-03-07-1128-rich-player-economy, 20260307-1305-economy-run-01-craft-loop-rich-player, 20260307-1306-economy-run-02-market-buy-loop-rich-player, 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts
- No NaN mineral values observed.
  - Runs: 2026-03-07-1128-rich-player-economy
- No negative mineral values observed.
  - Runs: 2026-03-07-1128-rich-player-economy
- No playerSave resource underflow observed through all transaction steps.
  - Runs: 2026-03-07-1128-rich-player-economy
- oxygen tanks | 3 | 3 | 0
  - Runs: 2026-03-07-1128-rich-player-economy
- Pending artifacts decremented by 1 and cleared to 0.
  - Runs: 2026-03-07-1128-rich-player-economy
- pending sell action count | 0 clicks | 0 clicks | 0
  - Runs: 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts
- pendingArtifacts count | 0 | 0 | 0
  - Runs: 2026-03-07-1128-rich-player-economy
- purchasedDeals | 0 | 0 | 0
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player, 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts
- purchasedDeals | 0 | 2 | +2
  - Runs: 20260307-1306-economy-run-02-market-buy-loop-rich-player
- purchasedDeals count | 0 | 2 | +2
  - Runs: 2026-03-07-1128-rich-player-economy
- shard | 5,000 | 4,982 | -18
  - Runs: 2026-03-07-1128-rich-player-economy
- shard | n/a | n/a | n/a
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player, 20260307-1306-economy-run-02-market-buy-loop-rich-player
- Sold synthetic pending artifact fact (`Sell for 5 Dust` hint).
  - Runs: 2026-03-07-1128-rich-player-economy
- UI sell hint (`5`) matched `playerSave` dust delta (`+5`).
  - Runs: 2026-03-07-1128-rich-player-economy

## Unique Notes / Gaps

- Attempted craft loop (2 craft actions): `not_found`, `not_found`.
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player
- Attempted sell action: `not_found`.
  - Runs: 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts
- Buy loop executed twice: `clicked:Buy`, `clicked:Buy`.
  - Runs: 20260307-1306-economy-run-02-market-buy-loop-rich-player
- No craft button/row was clickable in this deterministic run.
  - Runs: 20260307-1305-economy-run-01-craft-loop-rich-player
- None blocking. Full requested loop set (purchase/craft/sell) executed.
  - Runs: 2026-03-07-1128-rich-player-economy
- Sell button/hint (`Sell for ...`) not found in reachable DOM state.
  - Runs: 20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts
- UI indicator `Sold Out` became visible in this run.
  - Runs: 20260307-1306-economy-run-02-market-buy-loop-rich-player

## Source Files

- economy/2026-03-07-1128-rich-player-economy.md
- economy/20260307-1305-economy-run-01-craft-loop-rich-player.md
- economy/20260307-1306-economy-run-02-market-buy-loop-rich-player.md
- economy/20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts.md

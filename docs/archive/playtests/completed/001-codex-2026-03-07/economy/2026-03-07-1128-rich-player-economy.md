# Economy/Crafting Playthrough Report

- Timestamp: 2026-03-07T11:28:21Z to 2026-03-07T11:28:41Z
- Preset: `rich_player`
- Runtime: Chromium (Playwright), mobile viewport 390x844, dev URL `?skipOnboarding=true&devpreset=rich_player`
- Scope executed: crafting loop (2 crafts), market purchase loop (2 buys), fact sell loop (1 sell)

## Before/After Player State (playerSave)

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| dust | 99,999 | 99,534 | -465 |
| shard | 5,000 | 4,982 | -18 |
| crystal | 500 | 502 | +2 |
| geode | 100 | 100 | 0 |
| essence | 20 | 20 | 0 |
| oxygen tanks | 3 | 3 | 0 |
| knowledge points | 10,000 | 10,000 | 0 |
| purchasedDeals count | 0 | 2 | +2 |
| craftedItems count | 0 | 2 | +2 |
| activeConsumables count | 0 | 1 | +1 |
| pendingArtifacts count | 0 | 0 | 0 |

## Transaction Checks

1) Crafting (Materializer)
- Crafted `Reinforced Tank`: UI cost `200 dust + 5 shard`; store delta matched exactly (`-200 dust, -5 shard`).
- Crafted `Emergency Beacon`: UI cost `150 dust + 3 shard`; store delta matched exactly (`-150 dust, -3 shard`).
- Materializer mineral bar values matched `playerSave.minerals` for dust/shard/crystal/geode/essence after crafts.

2) Market Purchases (Daily Deals)
- Bought `Shard Bundle` (`120 dust`): store delta `-120 dust, +5 shard`; `purchasedDeals` increased by 1; UI button changed to `Sold Out` and disabled.
- Bought `Crystal Special` (`15 shard`): store delta `-15 shard, +2 crystal`; `purchasedDeals` increased by 1; UI button changed to `Sold Out` and disabled.

3) Sales Loop (Fact Reveal)
- Sold synthetic pending artifact fact (`Sell for 5 Dust` hint).
- UI sell hint (`5`) matched `playerSave` dust delta (`+5`).
- Pending artifacts decremented by 1 and cleared to 0.

## Resource Integrity

- No negative mineral values observed.
- No NaN mineral values observed.
- No playerSave resource underflow observed through all transaction steps.

## Issues (with severity)

- **Medium**: Preset route starts on `cutscene` instead of `base` even with `skipOnboarding=true&devpreset=rich_player`; run required forcing `currentScreen` for economy coverage.
- **Medium**: Console network errors during run:
  - `500 Internal Server Error`
  - `400 Bad Request`
  - `404 Not Found` (non-blocking for economy loop)

## Coverage Gaps

- None blocking. Full requested loop set (purchase/craft/sell) executed.

## Verdict

- **FAIL** (functional loops pass, but medium-severity preset boot routing defect + runtime network errors observed during playthrough).

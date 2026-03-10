# AR-21: Monetization Activation

## Summary
Completed AR-21 runtime wiring for monetization and weekly challenge systems:
- Added ad-removal purchase flow and save-state entitlement tracking.
- Surfaced Arcane Pass and Season Pass purchase flows in app UI.
- Added a cosmetic store modal with daily deals and premium cosmetics.
- Implemented Scholar Challenge weekly deterministic runs with cycle-scoped leaderboard support.
- Added subscriber-only sub-category filtering in run setup and run-pool generation.

## Design Reference
From `docs/GAME_DESIGN.md`:

> "| Ad removal | $4.99 |"

> "| Arcane Pass | $4.99/mo (all packs, cosmetics, analytics, family 5x) |"

> "| Cosmetics | Varies (frames, animations, dungeon skins, avatars) |"

> "Arcane Pass subscribers gain access to fine-grained category filters within each domain."

## Implementation
### Data Model
- Added `adsRemoved?: boolean` and `subscriberCategoryFilters?: Record<string, string[]>` to `PlayerSave`.
- Added save migration defaults for new AR-21 fields in load/new-player paths.
- Added `scholar_challenge` competitive category handling to backend leaderboard validation/bounds.

### Logic
- Added `monetizationService` with shared purchase grant logic:
  - subscription tiers
  - ad-removal entitlement
  - season pass premium unlock
  - cosmetics and consumables
- Added `scholarChallengeService`:
  - weekly cycle key (`YYYY-MM-DD`, Monday UTC)
  - deterministic seed/domain pair for the week
  - one-attempt-per-week reservation/completion
  - local fallback leaderboard + global leaderboard fetch
- Extended run flow controller:
  - new run mode `scholar_challenge`
  - deterministic run start from weekly reservation
  - completion score submit with `metadata.weekKey`
- Backend leaderboard route updates:
  - accepts category `scholar_challenge`
  - supports `GET` filtering by `weekKey`
  - enforces one submission per user per `weekKey`
- Subscription status endpoint now reads approved fact count dynamically from `factsDb`.

### UI
- Social screen now surfaces:
  - Scholar Challenge card and leaderboard mini-table
  - Arcane Pass open action
  - Season Pass open action
  - Cosmetic Store open action
- Added `CosmeticStoreModal`:
  - daily mineral deals
  - premium cosmetic purchases
  - kid-mode purchase guard
- Updated Arcane Pass and Season Pass modal purchase flows to use unified monetization handling.
- Domain selection now includes subscriber-gated sub-category filter modal per selected domain.

### System Interactions
- Encounter run-pool creation applies `subscriberCategoryFilters` only for active subscribers.
- Sub-category filters are applied during domain candidate selection, with fallback to unfiltered pools if filters are too strict.
- API client leaderboard fetch now supports `weekKey` for cycle-scoped categories.

## Edge Cases
- If native IAP is unavailable in web/dev (`iap_not_available`), AR-21 flows still grant local entitlement for QA.
- Scholar challenge rejects duplicate weekly attempts client-side and duplicate weekly submissions server-side.
- Invalid or missing `metadata.weekKey` is rejected for `scholar_challenge` submissions.
- Subscriber filters that eliminate all candidates automatically fall back to unfiltered domain pools.

## Files To Modify
- `src/services/monetizationService.ts`
- `src/services/scholarChallengeService.ts`
- `src/services/domainSubcategoryService.ts`
- `src/services/gameFlowController.ts`
- `src/services/runSaveService.ts`
- `src/services/saveService.ts`
- `src/services/subscriptionService.ts`
- `src/services/apiClient.ts`
- `src/services/encounterBridge.ts`
- `src/services/runPoolBuilder.ts`
- `src/ui/components/SocialScreen.svelte`
- `src/ui/components/CosmeticStoreModal.svelte`
- `src/ui/components/TerraPassModal.svelte`
- `src/ui/components/SeasonPassView.svelte`
- `src/ui/components/DomainSelection.svelte`
- `src/CardApp.svelte`
- `src/data/types.ts`
- `src/data/iapCatalog.ts`
- `server/src/routes/leaderboards.ts`
- `server/src/routes/subscriptions.ts`
- `docs/GAME_DESIGN.md`
- `docs/roadmap/PROGRESS.md`

## Done-When Checklist
- [x] Ad-removal purchase path is implemented and persisted.
- [x] Arcane Pass subscription purchase UI is surfaced and wired.
- [x] Cosmetic store is surfaced and supports daily/premium flows.
- [x] Scholar Challenge weekly run mode + leaderboard submission is implemented.
- [x] Subscriber-only sub-category filtering is implemented and applied in run-pool generation.
- [x] Roadmap and design docs updated to reflect AR-21 completion.

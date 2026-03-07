# Terra Miner Context Index

Fast lookup for implementation-grounded docs and source locations.

## Core project docs

| Need | Primary reference |
| --- | --- |
| Project setup and workflow | `README.md` |
| Runtime architecture and data flow | `docs/ARCHITECTURE.md` |
| Runtime/config keys and env vars | `docs/CONFIGURATION.md` |
| Save schema and migration behavior | `docs/SAVE-FORMAT.md` |
| Svelte store inventory | `docs/STORE-REFERENCE.md` |
| Event channels and payload contracts | `docs/EVENT-BUS-REFERENCE.md` |
| Dev scenario presets | `docs/DEVPRESET-REFERENCE.md` |
| Sprite loading/manifests/atlas pipeline | `docs/SPRITE-REFERENCE.md` |
| Testing commands and selectors | `docs/TESTING-GUIDE.md` |
| Deploy targets and release flow | `docs/DEPLOYMENT.md` |
| Dependency inventory and audit state | `docs/DEPENDENCIES.md` |
| Bundle sizes and chunk risks | `docs/BUNDLE-ANALYSIS.md` |
| Security findings and remediation queue | `docs/SECURITY-AUDIT-RESULTS.md` |
| Pending TODO/FIX debt | `docs/TODO-AUDIT.md` |

## Code map by concern

| Concern | Files to read first |
| --- | --- |
| App bootstrap | `src/main.ts`, `src/App.svelte` |
| Game orchestration | `src/game/GameManager.ts`, `src/game/GameEventBridge.ts` |
| Mine gameplay | `src/game/scenes/MineScene.ts`, `src/game/scenes/MineBlockInteractor.ts`, `src/game/systems/*` |
| Quiz/learning | `src/game/managers/QuizManager.ts`, `src/game/managers/StudyManager.ts`, `src/services/sm2.ts`, `src/services/factsDB.ts` |
| Save/profile state | `src/services/saveService.ts`, `src/ui/stores/playerData.ts`, `src/services/profileService.ts` |
| UI state | `src/ui/stores/gameState.ts`, `src/ui/stores/settings.ts`, `src/ui/components/*` |
| Event contracts | `src/events/types.ts`, `src/events/EventBus.ts`, `src/game/hubEvents.ts` |
| Sprite pipeline | `src/game/spriteManifest.ts`, `src/services/factSpriteManifest.ts`, `scripts/gen-sprite-keys.mjs`, `scripts/audit-fact-sprites.mjs` |
| Build and asset generation | `package.json`, `vite.config.ts`, `scripts/build-facts-db.mjs` |
| Backend API | `server/src/index.ts`, `server/src/routes/*`, `server/src/config.ts` |
| Tests | `tests/unit/*`, `tests/e2e/*.cjs`, `tests/e2e/playwright/*` |

## Task-oriented entry points

| Task | Jump to |
| --- | --- |
| Add/modify a screen flow | `src/App.svelte`, then relevant component under `src/ui/components/` |
| Add a new store field | `src/ui/stores/gameState.ts` or `src/ui/stores/playerData.ts` |
| Adjust save migration behavior | `src/services/saveService.ts` (`load()` migration section) |
| Add a new mine event | emit in `MineBlockInteractor.ts`, consume in `GameEventBridge.ts` |
| Tune quiz cadence or penalties | `src/game/managers/QuizManager.ts`, `src/data/balance.ts` |
| Change fact selection logic | `src/services/factsDB.ts` (`getPacedFact`) |
| Add/update dev preset | `src/dev/presets.ts` |
| Diagnose bundle growth | `docs/BUNDLE-ANALYSIS.md`, `vite.config.ts`, `scripts/check-bundle-size.mjs` |
| Validate runtime behavior quickly | `node tests/e2e/01-app-loads.cjs` |

## Roadmap tracking

| Need | File |
| --- | --- |
| Global phase checklist | `docs/roadmap/PROGRESS.md` |
| In-progress specs | `docs/roadmap/in-progress/` |
| Not-started phase specs | `docs/roadmap/phases/` |
| Completed phase specs | `docs/roadmap/completed/` |

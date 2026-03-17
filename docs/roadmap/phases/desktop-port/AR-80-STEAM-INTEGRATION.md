# AR-80: Steam Platform Integration

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §10
> **Priority:** STEAM LAUNCH
> **Complexity:** Large
> **Dependencies:** AR-72 (Platform Abstraction & Tauri)

## Context

Steam integration is required for the desktop release. This AR covers Steamworks SDK integration for achievements, cloud save, rich presence, and Steam Deck verification.

## Directive

### Step 1: Steamworks SDK Integration

**File:** NEW `src-tauri/src/steam.rs` (Rust side)

- Integrate Steamworks SDK via `steamworks` Rust crate
- Initialize Steam API on app launch
- Expose Tauri commands:
  - `steam_unlock_achievement(id: String)`
  - `steam_set_rich_presence(key: String, value: String)`
  - `steam_cloud_save(data: String)` / `steam_cloud_load() -> String`
  - `steam_get_leaderboard_entries(board: String) -> Vec<Entry>`
  - `steam_submit_score(board: String, score: i32)`

**File:** NEW `src/services/steamService.ts` (JS side)

- Import Tauri invoke API
- Wrap all Steamworks calls behind `hasSteam` guard from `platformService.ts`
- Provide TypeScript interface for all Steam features
- No-op gracefully when not on Steam

### Step 2: Achievement Mapping

**File:** NEW `src/data/steamAchievements.ts`

Inspect existing achievement system and create 1:1 mapping. Expected achievements:

| In-Game Achievement | Steam Achievement ID | Description |
|---|---|---|
| First run complete | `FIRST_RUN` | Complete your first run |
| Reach Act 2 | `REACH_ACT_2` | Reach The Depths |
| Reach Act 3 | `REACH_ACT_3` | Reach The Archive |
| Defeat The Curator | `DEFEAT_CURATOR` | Defeat the final boss |
| 5-chain | `CHAIN_5` | Build a 5-card Knowledge Chain |
| Master 10 facts | `MASTER_10` | Reach Tier 3 on 10 facts |
| Master 50 facts | `MASTER_50` | Reach Tier 3 on 50 facts |
| Master 100 facts | `MASTER_100` | Reach Tier 3 on 100 facts |
| Perfect encounter | `PERFECT_ENCOUNTER` | Complete an encounter without taking damage |
| Ascension 1 | `ASCENSION_1` | Complete Ascension Level 1 |
| Ascension 10 | `ASCENSION_10` | Complete Ascension Level 10 |
| 100% accuracy run | `PERFECT_ACCURACY` | Complete a run with 100% Charge accuracy |
| Collect all relics | `RELIC_COLLECTOR` | Find every relic at least once |

The worker must inspect the actual achievement system to create the complete mapping.

### Step 3: Achievement Hook

**File:** Modify achievement trigger points to call `steamService.unlockAchievement(id)` alongside existing achievement system.

### Step 4: Steam Cloud Save

**File:** `src/services/steamService.ts`

- `saveToCloud(data: CloudSave)` — serialize to JSON, write via Steamworks cloud
- `loadFromCloud(): CloudSave | null` — read from Steamworks cloud, deserialize
- On app launch: compare cloud save timestamp vs local save, prompt if conflict
- On run end / encounter end: auto-save to cloud

### Step 5: Steam Rich Presence

Show in friends list:
- "In the Hub" — when on camp/hub screen
- "Floor 3-2 — Fighting Crystal Golem" — during combat
- "Studying — Geography" — in study mode
- "Choosing Rewards" — on reward/shop screens

Update on screen change via `steamService.setRichPresence()`.

### Step 6: Steam Deck Verification

Test at 1280×800:
- All UI readable at that resolution
- Gamepad input works (if controller support added — otherwise touch/mouse via trackpad)
- On-screen keyboard triggers for any text input
- Performance: 60fps minimum at 1280×800

### Step 7: Steam Overlay Compatibility

- Verify Shift+Tab opens Steam Overlay without conflicting with game input
- Phaser canvas must not capture Shift+Tab
- Test overlay on top of all game screens

### Step 8: Verification

- [ ] Steamworks SDK initializes on launch (Tauri build)
- [ ] Achievements unlock correctly
- [ ] Cloud save writes and reads
- [ ] Rich presence updates in Steam friends list
- [ ] Steam Overlay opens with Shift+Tab
- [ ] No crashes on non-Steam launch (graceful no-op)
- [ ] All features guarded behind platform check

## Files Affected

| File | Action |
|------|--------|
| `src-tauri/src/steam.rs` | NEW |
| `src-tauri/Cargo.toml` | MODIFY (add steamworks crate) |
| `src/services/steamService.ts` | NEW |
| `src/data/steamAchievements.ts` | NEW |
| Achievement trigger points | MODIFY (add Steam unlock calls) |

## GDD Updates

Add new section to `docs/GAME_DESIGN.md`: "§37. Steam Integration" documenting:
- Achievement list with Steam IDs
- Cloud save behavior
- Rich presence strings
- Steam Deck target resolution
Mark as `[PLANNED — Desktop Port]`.

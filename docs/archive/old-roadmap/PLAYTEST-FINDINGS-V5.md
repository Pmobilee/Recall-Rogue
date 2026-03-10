# PLAYTEST FINDINGS — V5 Audit

**Date**: 2026-03-06
**Build**: v0.1.0-alpha (all V4 phases complete, commit a61be36)
**Tester**: Manual playtest across all devpresets and flows
**Presets tested**: `post_tutorial`, `mid_game_3_rooms`, `five_rooms`, `endgame_all_rooms`, `empty_inventory`, `first_boot`, `new_player`, `rich_player`, `mid_dive_active`, `dive_results`, `many_reviews_due`

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 5 | Game-breaking bugs that block core loops |
| HIGH | 8 | Significant UX or visual issues degrading experience |
| MEDIUM | 11 | Visual polish and UX improvements |
| LOW | 5 | Minor polish items |
| **Total** | **29** | |

### Proposed Fix Phases

| Phase | Name | Findings | Priority |
|-------|------|----------|----------|
| 60 | Critical Data Pipeline Fixes | C2, C3, H5, M9 | CRITICAL |
| 61 | Dome Floor Navigation Fix | C1 | CRITICAL |
| 62 | Dome Visual Polish | H1, H2, M1, M2 | HIGH |
| 63 | Dive Prep & Results UX | C4, C5, H6, M4, M5, L1 | HIGH |
| 64 | Study Session & Quiz Polish | H4, H7 | HIGH |
| 65 | Mine Scene Improvements | H3, M11, H8 | MEDIUM |
| 66 | Settings & Reports Polish | M6, M7, M10, L4, L3, L5 | MEDIUM |
| 67 | Onboarding Polish | M3, L2 | LOW |
| 68 | Devpreset Expansion | 5 new presets | LOW |

---

## CRITICAL BUGS

These are game-breaking issues that prevent core systems from functioning. Must be fixed before any playtesting can proceed.

### C1: Dome Floor Navigation Completely Broken

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Status** | Open |
| **Location** | Base hub, Phaser dome scene / floor navigation UI |
| **Presets** | `post_tutorial`, `mid_game_3_rooms`, `five_rooms`, `endgame_all_rooms` |
| **Fix Phase** | 61 |

**Problem**: All dome floor buttons (Floor 1 through Floor 9) are ALWAYS disabled, regardless of how many rooms are unlocked in the player save. Even the `endgame_all_rooms` preset — which has ALL rooms unlocked — shows only Floor 0 as accessible.

**Impact**: Players can never visit Farm, Workshop, Zoo, Museum, Market, Research Lab, Archive, Observatory, or Achievement Gallery floors. The entire multi-floor dome system (Phase 10+) is non-functional.

**Expected Behavior**: Floor buttons should enable based on `unlockedRooms` in the player save. The room IDs in presets (`command`, `lab`, `workshop`, `museum`, `farm`, `zoo`) need to correctly map to floor indices.

**Investigation Notes**: The mapping between `unlockedRooms` string IDs and floor indices likely has a disconnect. Check the floor-enable logic in the dome hub scene and compare against the room-to-floor mapping table.

---

### C2: Knowledge Tree Shows All Categories as "Unexplored" Despite Having Learned Facts

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Status** | Open |
| **Location** | Knowledge Tree screen (click Tiny Sapling on hub) |
| **Presets** | Any preset with learned facts |
| **Fix Phase** | 60 |

**Problem**: With 25+ learned facts across multiple categories (Culture, Life Sciences, History, Geography confirmed during study sessions), the Knowledge Tree overview shows ALL 7 categories as "unexplored" and displays "Dive to discover your first fact". The footer shows "0/7 Categories".

**Impact**: The Knowledge Tree is the primary visualization of learning progress. When it shows nothing, players get zero visual feedback on their learning journey — completely undermining the educational core loop.

**Expected Behavior**: Categories with learned facts should show as explored with leaf counts, branch growth, and mastery percentages.

**Key Clue**: When zooming into a specific branch (e.g., Culture), the leaf dots DO appear correctly (10 dots shown). The bug is specifically in the overview rendering, not in the underlying data. The overview aggregation logic is likely failing to read the fact-to-category mappings.

---

### C3: GAIA Report Radar Chart Shows Wrong Category Names

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Status** | Open |
| **Location** | GAIA Terminal, Overview tab, Category Mastery radar chart |
| **Fix Phase** | 60 |

**Problem**: The radar chart labels show "Biology, Physics, Geology" instead of the actual game categories "Life Sciences, Natural Sciences, Geography". Additionally, all categories show near-zero mastery despite 30+ learned facts.

**Expected Behavior**: Radar chart should use the same 7 category names as the rest of the game (`Culture`, `History`, `Geography`, `Life Sciences`, `Natural Sciences`, `Technology`, `Language`), and reflect actual learning progress from the SM-2 review states.

**Root Cause Hypothesis**: The radar chart is likely using hardcoded placeholder category names rather than reading from the canonical category list. The mastery calculation may be reading from a different data path than what `StudyManager` populates.

---

### C4: Pickaxe Must Be Manually Selected Even When Only One Exists

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Status** | Open |
| **Location** | Dive Prep screen |
| **Presets** | `post_tutorial`, `new_player`, any preset with exactly 1 pickaxe |
| **Fix Phase** | 63 |

**Problem**: The "Enter Mine" button shows as "Select a Pickaxe" (disabled) even though Standard Pick is already displayed in the pickaxe section. The player must click the dropdown and explicitly select Standard Pick before the dive button enables.

**Impact**: New players will be confused and stuck on the dive prep screen, unable to start their first dive. This is a critical onboarding failure — the very first action a player takes (diving) is blocked by a needless selection step.

**Expected Behavior**: When only one pickaxe is available, it should be auto-selected and the "Enter Mine" button should be enabled immediately. The dropdown should only appear when 2+ pickaxes exist.

---

### C5: Free Dust Exploit — Exiting Mine Immediately Grants 10 Dust

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Status** | Open |
| **Location** | Mine scene, Surface button, Dive Results screen |
| **Fix Phase** | 63 |

**Problem**: Entering a mine and immediately clicking Surface then confirming with "Yes" gives the player 10 dust with 0 blocks mined. Observed: Dust went from 180 to 190.

**Impact**: Infinite currency exploit. A player can farm unlimited dust by entering and immediately exiting the mine. This breaks the entire economy.

**Expected Behavior**: No minerals should be awarded for a dive with 0 blocks mined. The dive results calculation should have a minimum-activity threshold, or the base dust award should be 0 when `blocksMined === 0`.

---

## HIGH SEVERITY

Significant UX or visual issues that degrade the player experience. Should be fixed in the first polish pass.

### H1: Dome Tiles Are Placeholder Green Rectangles

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Status** | Open |
| **Location** | Base hub Phaser canvas |
| **Presets** | All |
| **Fix Phase** | 62 |

**Problem**: All dome objects (G.A.I.A. Terminal, Tiny Sapling, Study Desk, Mine Entrance, Artifact Lab, Materializer, Streak Board) render as solid green rectangles with text labels instead of pixel art sprites.

**Expected Behavior**: Each dome object should have a unique pixel art sprite. The 28 dome sprites from the Visual Overhaul phase (Phase 29-31) should be loading correctly.

**Investigation**: Check sprite loading in the dome scene preload, verify asset paths match the sprite manifest, and confirm texture keys match what the tile rendering code expects.

---

### H2: Dome Object Label Text Truncation and Line Breaking

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Status** | Open |
| **Location** | Base hub dome tile labels |
| **Fix Phase** | 62 |

**Problem**: Labels break mid-word in visually broken ways:
- "G.A.I.A. Te..." (truncated)
- "Artifac t Lab" (broken mid-word)
- "Materializ er" (broken mid-word)
- "Stre ak Board" (broken mid-word)
- "Mine Entran..." (truncated)

**Expected Behavior**: Labels should either: (a) fit properly within tile bounds, (b) use abbreviations ("GAIA", "Mat.", "Mine"), or (c) be hidden entirely with a tooltip on hover/tap. Mid-word breaks are never acceptable.

---

### H3: ~48 "Frame Not Found in Texture" Warnings in Mine Scene

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Status** | Open |
| **Location** | Console output when entering the mine |
| **Fix Phase** | 65 |

**Problem**: Phaser logs approximately 48 warnings like `Frame "%s" not found in texture "%s"` for frames 4 through 51. These are miner animation sprite sheet frames that don't exist in the loaded texture.

**Expected Behavior**: Either generate the full 48-frame sprite sheet to match the animation config, or limit the animation frame range to the available frames (likely 0-3). Zero console warnings from Phaser frame lookups.

---

### H4: Study Card Answer Overlaps Progress Bar and Buttons

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Status** | Open |
| **Location** | Memory Strengthening session, after clicking Reveal |
| **Fix Phase** | 64 |

**Problem**: Multiple layout overflow issues on the study card:
1. The answer card title text overlaps with the "1/5" progress indicator
2. The explanation text gets clipped at the bottom of the card
3. The "Didn't get it" / "Got it" buttons overlap with the card content

**Expected Behavior**: The card should be scrollable when content exceeds the available space. The progress indicator should remain above the card in a fixed position. Grading buttons should be below the card with proper spacing.

---

### H5: "Facts Mastered" Counter Always Shows 0

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Status** | Open |
| **Location** | Right sidebar stats panel |
| **Presets** | All tested, including presets with 80+ learned facts |
| **Fix Phase** | 60 |

**Problem**: Even with presets that have 80+ learned facts and review states, "Facts Mastered" always shows 0.

**Expected Behavior**: Facts that have achieved a sufficient SM-2 interval (e.g., `interval > 21` days or `easeFactor >= 2.5` with `interval > 7`) should count as "mastered". The counter should reflect actual learning progress.

**Root Cause Hypothesis**: The mastery threshold check is either using the wrong field, comparing against an impossible value, or the computation never runs.

---

### H6: "Estimated Oxygen: 100 O2" Shows When Player Has 0 Tanks

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Status** | Open |
| **Location** | Dive Prep screen |
| **Presets** | `empty_inventory` |
| **Fix Phase** | 63 |

**Problem**: With 0 oxygen tanks in inventory, the Dive Prep screen shows "Estimated Oxygen: 100 O2", which is misleading. The player would expect to see 0 or a warning.

**Expected Behavior**: Should show "Estimated Oxygen: 0 O2" or a prominent warning like "No oxygen tanks! You won't survive long." when `oxygenTanks === 0`. Consider disabling the dive button entirely with 0 tanks.

---

### H7: Study Session — Only 2 Grading Buttons Instead of 3

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Status** | Open |
| **Location** | Memory Strengthening session, after revealing answer |
| **Fix Phase** | 64 |

**Problem**: Only "Didn't get it" (fail) and "Got it" (pass) buttons appear after revealing the answer. The SM-2 specification and design decisions (DD-V2-096) call for 3 grading buttons.

**Expected Behavior**: Three grading buttons should appear:
1. **Again** (quality 0-1) — failed, reset interval
2. **Good** (quality 3) — correct, normal progression
3. **Easy** (quality 5) — effortless recall, accelerate interval

The 3-button system is critical for SM-2 accuracy. "Again" and "Good" alone cannot distinguish between a hard-won correct answer and an effortless one, leading to suboptimal review scheduling.

---

### H8: DEV Button Overlaps With Other UI Elements

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Status** | Open |
| **Location** | Multiple screens |
| **Fix Phase** | 65 |

**Problem**: The DEV debug button overlaps with functional UI elements in several locations:
- Backstory scene: overlaps the Skip button
- GAIA intro: overlaps the Skip button
- Knowledge Tree: overlaps the Show All button
- Mine scene: overlaps the minimap

**Expected Behavior**: The DEV button should be positioned in a corner that doesn't conflict with functional UI on any screen. Consider: making it smaller, semi-transparent, or repositioning dynamically based on the active screen. In production builds, it should not appear at all.

---

## MEDIUM SEVERITY

Visual polish and UX improvements that should be addressed before public release.

### M1: Resource Bar Uses Emoji Instead of Pixel Art Icons

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Top resource bar on hub screen |
| **Fix Phase** | 62 |

**Problem**: Resource indicators use Unicode emoji characters (diamond, droplet, etc.) for Dust, Shard, Crystal, and O2 instead of the custom pixel art resource icons that were generated during the Visual Overhaul phase.

**Expected Behavior**: Replace emoji with the 7 custom resource icon PNGs from `src/assets/`. Each resource type should have its distinct pixel art icon matching the game's visual style.

---

### M2: Floor Navigation Label Truncated

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Right side of hub screen, floor selector |
| **Fix Phase** | 62 |

**Problem**: "Starter H..." text is cut off. Floor navigation dots overlap with the truncated label.

**Expected Behavior**: Show full "Starter Hub" text, or use a shorter name that fits. Floor dots should be positioned below the label, not overlapping.

---

### M3: Backstory Scene Uses Brown Placeholder Box

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | First boot flow, backstory "Descending / Atmospheric Re-entry" |
| **Fix Phase** | 67 |

**Problem**: The descent/atmospheric re-entry scene is rendered as a plain brown rectangle with `[ placeholder ]` text.

**Expected Behavior**: Should have a proper atmospheric re-entry animation, or at minimum a styled scene with gradient colors, particle effects, and narrative text overlaid on a space/atmosphere background.

---

### M4: Dive Results "[+]" and "[v]" Placeholder Icons

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Dive Complete screen, "Almost there..." progress section |
| **Fix Phase** | 63 |

**Problem**: Text-based placeholders `[+]` and `[v]` are used instead of proper icons for progress indicators.

**Expected Behavior**: Use proper SVG or pixel art icons: an upward arrow for "progress toward next unlock" and a checkmark for "completed milestones".

---

### M5: Dive Results Progress Text Confusing

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Dive Complete screen |
| **Fix Phase** | 63 |

**Problem**: Progress indicator reads "-20% to next room unlock (2/8 dives)" — the minus sign makes it look like the player lost progress.

**Expected Behavior**: Reword to a positive framing:
- "20% progress to next room (2/8 dives)" or
- "2 of 8 dives complete" or
- "6 more dives to unlock next room"

---

### M6: Dome Upgrades Tab is Bare

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Materializer, Dome Upgrades tab |
| **Fix Phase** | 66 |

**Problem**: Shows only "Starter Hub / Tier 0" and a bare "Upgrade Current Floor" button with no cost, no preview, no explanation of what upgrading does.

**Expected Behavior**: Show:
- Current tier benefits
- Upgrade cost (minerals required)
- Preview of what the next tier unlocks (new rooms, features, capacity)
- Visual tier progression indicator

---

### M7: Streak Milestone "3-Day Explorer" Shows as Claimable But Not Claimed

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Streak Board, with 7-day streak |
| **Fix Phase** | 66 |

**Problem**: The 3-Day Explorer milestone shows an arrow indicator and 100% progress bar, shows "7 / 3 days (0 to go)" but the reward hasn't been claimed or auto-claimed.

**Expected Behavior**: Milestones that are already achieved (current streak >= milestone requirement) should either auto-claim on first view or show a prominent "Claim Reward" button. Already-claimed milestones should show a checkmark and greyed-out state.

---

### M8: Knowledge Tree Branch Labels Clip at Screen Edges

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Knowledge Tree, branch zoom view |
| **Fix Phase** | 60 |

**Problem**: Branch category labels are truncated at viewport edges:
- "Natural Sci..." (should be "Natural Sciences")
- "Geogr..." (should be "Geography")

**Expected Behavior**: Labels should either wrap to a second line, use abbreviated forms that fit, or dynamically reposition to stay fully visible within the viewport.

---

### M9: GAIA Report "My Learning" Shows "Unknown" Category

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | GAIA Terminal, My Learning tab, "Your Strongest Categories" |
| **Fix Phase** | 60 |

**Problem**: Shows "Unknown: 0%" instead of an actual category breakdown based on learned facts.

**Expected Behavior**: Should show a ranked list of the player's strongest categories with mastery percentages, drawn from the same fact-to-category mapping used by the Knowledge Tree and study sessions.

**Root Cause Hypothesis**: Same underlying issue as C2 and C3 — the category resolution from fact IDs is failing at the reporting/display layer.

---

### M10: "Coming Soon" Items in Settings

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Settings screen, Learning section, Notifications section |
| **Fix Phase** | 66 |

**Problem**: Four settings items show "Coming Soon" labels:
- Language Learning
- Fact Learning
- Review Reminders
- Dive Reminders

**Expected Behavior**: Either implement these toggles (they are all referenced in phase docs) or hide them entirely from the settings screen. Showing "Coming Soon" in a released product feels unfinished and unprofessional.

---

### M11: Mine Scene Blocks Hard to Distinguish

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Status** | Open |
| **Location** | Inside the mine, block grid |
| **Fix Phase** | 65 |

**Problem**: The mine grid has very low visual contrast. The bottom half of the visible area is entirely black/dark. The top half is uniform beige. It's difficult to distinguish individual mineable blocks, hazards, fog of war boundaries, or special tiles (relics, artifacts, descent shafts).

**Expected Behavior**: Clear visual distinction between:
- Standard blocks (with subtle variety per biome)
- Fog of war edges (gradient or dithered)
- Hazard blocks (lava = orange glow, gas = green tint)
- Special blocks (relic shimmer, artifact glow, shaft indicator)
- Already-mined empty space vs. unmined blocks

---

## LOW SEVERITY

Minor polish items. Address when bandwidth allows.

### L1: O2 Tank Selector Buttons Have No Labels

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Status** | Open |
| **Location** | Dive Prep screen, tank allocation |
| **Fix Phase** | 63 |

**Problem**: The 3 tank allocation buttons are plain blue rectangles with no "1", "2", "3" labels. The player must rely on position to understand which button selects how many tanks.

**Expected Behavior**: Add number labels ("1", "2", "3") inside each button, or show "1 Tank", "2 Tanks", "3 Tanks".

---

### L2: Streak Milestone List Very Long Without Scroll Indicator

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Status** | Open |
| **Location** | Streak Board |
| **Fix Phase** | 67 |

**Problem**: 19 milestones listed (up to 365 days) in a scrollable container but no visual scroll indicator (scrollbar, fade gradient, or "scroll for more" hint).

**Expected Behavior**: Add a subtle scroll indicator: a fade gradient at the bottom when more content exists below, or a thin scrollbar track.

---

### L3: GAIA Report 30-Day Activity Chart Mostly Empty

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Status** | Open |
| **Location** | GAIA Terminal, Overview tab |
| **Fix Phase** | 66 |

**Problem**: The 30-day activity chart displays a mostly flat/empty line, making the entire section look broken rather than informative.

**Expected Behavior**: When there is insufficient data (fewer than 3 data points), show a "Not enough activity data yet — keep diving and studying!" message instead of an empty chart.

---

### L4: Version String Shows "Terra Miner" Not "Recall Rogue"

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Status** | Open |
| **Location** | Settings, About section |
| **Fix Phase** | 66 |

**Problem**: Shows "Terra Miner v0.1.0-alpha" but the game was renamed to "Recall Rogue".

**Expected Behavior**: Update to "Recall Rogue v0.1.0-alpha". Also update any other references to "Terra Miner" in user-visible strings.

---

### L5: Predicted Retention Shows Numbers With 0 Mastered Facts

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Status** | Open |
| **Location** | GAIA Terminal, My Learning tab, Predicted Retention |
| **Fix Phase** | 66 |

**Problem**: Shows "72% in 30 days / 51% in 60 days / 37% in 90 days" even when the player has 0 mastered facts. This is misleading — there's nothing to retain.

**Expected Behavior**: When `masteredFacts === 0`, show "Master some facts to see retention predictions" instead of displaying fabricated percentages.

---

## PROPOSED FIX PHASES

### Phase 60: Critical Data Pipeline Fixes

**Priority**: CRITICAL
**Findings**: C2, C3, H5, M8, M9
**Estimated Complexity**: Medium-High

**Root Cause Hypothesis**: These five findings likely share a common root cause — the fact-to-category mapping is failing at the display/aggregation layer. Study sessions can read and present individual facts correctly, but any code that needs to group facts by category (Knowledge Tree overview, GAIA radar chart, mastery counter, strongest categories) is returning empty or wrong results.

**Sub-tasks**:
1. Trace the category resolution path: `learnedFacts` -> fact ID -> category name lookup
2. Verify the canonical category list matches everywhere: Knowledge Tree, GAIA report, radar chart, study session
3. Fix the Knowledge Tree overview aggregation to correctly count facts per category
4. Fix the GAIA radar chart to use canonical category names and real mastery data
5. Fix the "Facts Mastered" counter to use a sensible mastery threshold
6. Fix "My Learning" strongest categories to resolve category names from fact IDs
7. Fix Knowledge Tree branch labels to not clip at viewport edges

**Acceptance Criteria**:
- Knowledge Tree overview shows correct category counts matching the branch detail views
- GAIA radar chart uses the 7 canonical category names
- "Facts Mastered" shows non-zero for presets with high-interval review states
- "Your Strongest Categories" shows real category names and percentages
- Branch labels fully visible on all screen sizes

---

### Phase 61: Dome Floor Navigation Fix

**Priority**: CRITICAL
**Findings**: C1
**Estimated Complexity**: Medium

**Sub-tasks**:
1. Map the relationship: `unlockedRooms` IDs -> room definitions -> floor indices
2. Identify where floor button enable/disable logic reads from player data
3. Fix the mapping so unlocked rooms correctly enable their corresponding floor buttons
4. Verify with `endgame_all_rooms` preset: all 9 floors accessible
5. Verify with `post_tutorial` preset: only Floor 0 accessible
6. Verify with `mid_game_3_rooms` preset: correct subset of floors accessible

**Acceptance Criteria**:
- Floor buttons correctly reflect `unlockedRooms` in player save
- `endgame_all_rooms` can navigate to all floors
- `post_tutorial` shows only Floor 0 enabled
- Clicking an enabled floor button loads that floor's dome layout

---

### Phase 62: Dome Visual Polish

**Priority**: HIGH
**Findings**: H1, H2, M1, M2
**Estimated Complexity**: Medium

**Sub-tasks**:
1. Debug sprite loading: verify dome sprite assets exist at expected paths
2. Fix texture key mapping so dome tiles render actual sprites instead of green rectangles
3. Fix tile label text: implement proper truncation with ellipsis (no mid-word breaks)
4. Replace emoji resource icons with pixel art PNGs from `src/assets/`
5. Fix floor navigation label to show full "Starter Hub" text

**Acceptance Criteria**:
- All dome objects render with unique pixel art sprites
- No green placeholder rectangles visible
- All labels are readable (no mid-word breaks)
- Resource bar shows pixel art icons, not emoji
- Floor label text fully visible

---

### Phase 63: Dive Prep & Results UX

**Priority**: HIGH
**Findings**: C4, C5, H6, M4, M5, L1
**Estimated Complexity**: Medium

**Sub-tasks**:
1. Auto-select pickaxe when only one is available; enable "Enter Mine" immediately
2. Fix dust exploit: award 0 minerals when `blocksMined === 0`
3. Fix O2 estimate: show 0 or warning when player has no tanks
4. Replace `[+]` and `[v]` placeholder icons with proper SVG icons
5. Reword progress text from "-20% to next room" to positive framing
6. Add number labels to O2 tank selector buttons

**Acceptance Criteria**:
- Single-pickaxe players can dive without manual selection
- Entering and immediately exiting mine awards 0 minerals
- Empty inventory shows "0 O2" or a warning, not "100 O2"
- No placeholder text icons on dive results screen
- Progress text uses positive/clear framing
- Tank buttons have "1", "2", "3" labels

---

### Phase 64: Study Session & Quiz Polish

**Priority**: HIGH
**Findings**: H4, H7
**Estimated Complexity**: Medium

**Sub-tasks**:
1. Fix study card layout: make card content scrollable, fix progress bar positioning
2. Add third grading button: Again / Good / Easy (SM-2 quality grades 1, 3, 5)
3. Wire the Easy button to `updateReviewState` with quality 5
4. Verify SM-2 interval calculations work correctly with 3-grade input

**Acceptance Criteria**:
- Study card never overlaps progress indicator or grading buttons
- Long answers/explanations are scrollable within the card
- Three grading buttons appear after reveal: Again, Good, Easy
- Each button applies the correct SM-2 quality grade
- Interval progression matches SM-2 algorithm expectations

---

### Phase 65: Mine Scene Improvements

**Priority**: MEDIUM
**Findings**: H3, M11, H8
**Estimated Complexity**: Medium

**Sub-tasks**:
1. Fix miner animation frame range to match available sprite sheet frames (0-3 or generate full sheet)
2. Improve mine block visual contrast: add biome tinting, fog of war gradient, block type differentiation
3. Reposition DEV button to avoid overlapping functional UI on all screens
4. Eliminate all Phaser console warnings about missing frames

**Acceptance Criteria**:
- Zero "Frame not found in texture" console warnings
- Mine blocks visually distinguishable by type (standard, hazard, special, empty)
- Fog of war has visible gradient/dither edge
- DEV button never overlaps Skip, Show All, or minimap

---

### Phase 66: Settings & Reports Polish

**Priority**: MEDIUM
**Findings**: M6, M7, M10, L3, L4, L5
**Estimated Complexity**: Low-Medium

**Sub-tasks**:
1. Flesh out Dome Upgrades tab with cost, preview, and tier progression
2. Implement streak milestone auto-claim or add Claim button
3. Remove or implement "Coming Soon" settings items
4. Add empty-state message for 30-day activity chart
5. Update version string from "Terra Miner" to "Recall Rogue"
6. Add empty-state for predicted retention when 0 facts mastered

**Acceptance Criteria**:
- Dome Upgrades shows meaningful upgrade information
- Achieved streak milestones are claimable or auto-claimed
- No "Coming Soon" labels in settings
- Empty charts show helpful messages instead of blank space
- Version string reads "Recall Rogue"
- Predicted retention shows helpful message when no facts mastered

---

### Phase 67: Onboarding Polish

**Priority**: LOW
**Findings**: M3, L2
**Estimated Complexity**: Low

**Sub-tasks**:
1. Replace backstory placeholder brown box with styled scene (gradient background, particle effects, narrative text)
2. Add scroll indicator to streak milestone list (fade gradient at bottom)

**Acceptance Criteria**:
- Backstory scene has proper visual treatment (no `[ placeholder ]` text)
- Streak milestone list shows scroll affordance when content extends below viewport

---

### Phase 68: Devpreset Expansion

**Priority**: LOW
**Estimated Complexity**: Low

Add the following devpresets to `src/dev/presets.ts` for improved debugging coverage:

| Preset ID | Description | Key State |
|-----------|-------------|-----------|
| `has_pending_artifacts` | Mid-game player with 3 pending artifacts (common, uncommon, rare) | Tests Artifact Lab cracking flow |
| `all_floors_unlocked` | Endgame with verified floor navigation | Tests dome multi-floor with correct room-to-floor mapping |
| `streak_just_claimed` | Player who just claimed a streak milestone | Tests reward flow and "already claimed" state |
| `heavy_review_overdue` | 100 facts, all overdue by 7+ days | Tests performance and UI with large review queues |
| `first_dive_returning` | Player returning from first dive with 1 pending artifact | Tests artifact-to-learning pipeline end-to-end |

**Acceptance Criteria**:
- All 5 presets load without errors via `?skipOnboarding=true&devpreset=<id>`
- Each preset reaches its target screen with the expected state
- Presets are documented in the preset registry

---

## TRACKING TABLE

Use this table to track fix progress across sessions.

| ID | Severity | Finding | Phase | Status |
|----|----------|---------|-------|--------|
| C1 | CRITICAL | Dome floor navigation always disabled | 61 | Open |
| C2 | CRITICAL | Knowledge Tree all categories "unexplored" | 60 | Open |
| C3 | CRITICAL | GAIA radar chart wrong category names | 60 | Open |
| C4 | CRITICAL | Pickaxe must be manually selected (only 1 exists) | 63 | Open |
| C5 | CRITICAL | Free dust exploit (0 blocks = 10 dust) | 63 | Open |
| H1 | HIGH | Dome tiles are green placeholder rectangles | 62 | Open |
| H2 | HIGH | Dome tile labels break mid-word | 62 | Open |
| H3 | HIGH | ~48 missing sprite frame warnings | 65 | Open |
| H4 | HIGH | Study card layout overlaps | 64 | Open |
| H5 | HIGH | "Facts Mastered" always shows 0 | 60 | Open |
| H6 | HIGH | O2 estimate shows 100 with 0 tanks | 63 | Open |
| H7 | HIGH | Only 2 grading buttons instead of 3 | 64 | Open |
| H8 | HIGH | DEV button overlaps functional UI | 65 | Open |
| M1 | MEDIUM | Resource bar uses emoji not pixel art | 62 | Open |
| M2 | MEDIUM | Floor navigation label truncated | 62 | Open |
| M3 | MEDIUM | Backstory scene placeholder box | 67 | Open |
| M4 | MEDIUM | Dive results placeholder icons | 63 | Open |
| M5 | MEDIUM | Dive results confusing progress text | 63 | Open |
| M6 | MEDIUM | Dome upgrades tab is bare | 66 | Open |
| M7 | MEDIUM | Streak milestone not auto-claimed | 66 | Open |
| M8 | MEDIUM | Knowledge Tree branch labels clip | 60 | Open |
| M9 | MEDIUM | GAIA "My Learning" shows "Unknown" | 60 | Open |
| M10 | MEDIUM | "Coming Soon" items in settings | 66 | Open |
| M11 | MEDIUM | Mine blocks hard to distinguish | 65 | Open |
| L1 | LOW | O2 tank buttons have no labels | 63 | Open |
| L2 | LOW | Streak milestone list no scroll indicator | 67 | Open |
| L3 | LOW | 30-day activity chart mostly empty | 66 | Open |
| L4 | LOW | Version string says "Terra Miner" | 66 | Open |
| L5 | LOW | Predicted retention with 0 mastered facts | 66 | Open |

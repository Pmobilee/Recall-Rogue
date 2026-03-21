# AR-214: Map & Special Room UX Polish

## Overview
The dungeon map, reward room, and special event screens have UX issues: map node icons are hard to distinguish, reward room items lack labels, special events have no background art (unlike mystery events), and the "Tap a card" language is wrong for PC. This AR polishes all non-combat in-run screens.

**Complexity**: Medium
**Dependencies**: None
**Files Affected**: `src/ui/components/DungeonMap.svelte`, `src/ui/components/RewardRoom.svelte`, `src/ui/components/SpecialEvent.svelte`, `src/ui/components/CardReward.svelte`, `src/game/scenes/RewardRoomScene.ts`

## Sub-steps

### 1. Enlarge dungeon map node icons and add tooltips
- Node icons (hearts, swords, skulls, question marks) are small at 1080p
- Increase node size with `--layout-scale`
- Add tooltip on hover showing node type name (e.g. "Combat", "Rest Site", "Shop", "Mystery", "Elite", "Boss")
- Consider adding a small legend in the corner for first-time players
- **Acceptance**: Node types distinguishable without squinting; hover shows type name

### 2. Improve map sidebar info
- Left sidebar floor indicators are cramped
- Enlarge floor icons and numbers
- **Acceptance**: Floor navigation clearly readable

### 3. Add labels to reward room items
- Currently: Phaser sprites (gold pile, relic, card) with no text labels
- Add floating labels below each reward item ("30 Gold", "Whetstone", "Reckless")
- Labels should scale with `--text-scale`
- **Acceptance**: Every reward item clearly identified by name and value

### 4. Add background art to special events
- Mystery events have beautiful Phaser backgrounds; special events show bare dark void
- Use the mystery event background system for special events too
- OR add a subtle themed background (e.g., glowing spring for Knowledge Spring)
- **Acceptance**: Special events have visual atmosphere comparable to mystery events

### 5. Fix "Tap" → "Click" language for PC
- Card reward screen says "Tap a card on the altar to reveal details"
- Change to "Click a card" or make it platform-adaptive ("Click/Tap")
- Check all screens for mobile-only language
- **Acceptance**: No "tap" language on PC builds

### 6. Improve retreat/delve stats readability
- Stats text between Retreat and Delve buttons is very small
- Enlarge gold amount, HP display, and floor info
- Use `--text-scale` for all text
- **Acceptance**: All stats between the buttons clearly readable at 1080p

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Dungeon map, reward room, card reward, special event, retreat/delve all visually inspected at 1920x1080
- [ ] No "tap" language on desktop
- [ ] All reward items have visible labels
- [ ] Map nodes have hover tooltips
- [ ] No hardcoded px values

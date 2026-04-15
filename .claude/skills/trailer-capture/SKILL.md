---
name: trailer-capture
description: "Capture gameplay trailer footage as MP4 clips using Playwright video recording. Covers all screens, combat scenarios, quiz moments, and room transitions."
user_invocable: true
status: active
---

# Trailer Capture

Automated gameplay footage capture for marketing trailers. Records 5-10s MP4 clips of every interesting game moment using Playwright's video recording + ffmpeg trim.

## Scripts

| Script | Purpose |
|--------|---------|
| `room-captures/capture-room-intros.mjs` | 127 room entry parallax transition videos |
| `room-captures/capture-trailer-clips.mjs` | 100+ gameplay action clips across all categories |

## Prerequisites

- Dev server running: `npm run dev`
- System Chrome installed (Playwright bundled Chromium lacks WebGL on macOS ARM64)
- ffmpeg installed
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Architecture

Each clip = one Playwright browser context with `recordVideo` enabled.

1. Open game at dev URL
2. Wait for `__rrScenario` + `__rrPlay` APIs
3. Go to hub (clean slate)
4. Run `clip.setup(page)` → `__rrScenario.spawn()` or `loadCustom()`
5. Wait `setupDelay` (5s combat, 7s boss, 6s rooms with pop-in)
6. Run `clip.actions(page)` → DOM clicks for card plays, API calls for shop/rest/mystery
7. Wait `trailWait` for VFX settle
8. Close context → finalize webm
9. ffmpeg trim to last N seconds → MP4

## Key Learnings — What Works

### Card Play Animations Require DOM Clicks
`__rrPlay.quickPlayCard()` and `chargePlayCard()` bypass the UI — they call the service layer directly, so no card swoosh/impact/damage animations play. For visible animations:

- **Quick Play**: Click `[data-testid="card-hand-{i}"]` twice (select → play)
- **Charge Play**: Click card → click `.charge-play-btn` → wait for `[data-testid="quiz-answer-0"]` → pause 2s for readability → answer via `__rrPlay.answerQuizCorrectly()`

### Non-Combat Actions Use API (Fine)
Shop buy, rest heal, mystery choice, reward accept — these are button-based UI flows that animate properly via the `__rrPlay` API. No DOM click workaround needed.

### Setup Delay Timing
The parallax room transition takes ~3-4s. Actions fired before it completes happen invisibly behind the animation. Required delays:
- **Combat**: 5000ms (3s parallax + settle)
- **Boss**: 7000ms (+ 2.2s boss intro overlay)
- **Rooms with pop-in** (shop/rest/mystery): 6000ms (3s parallax + 2.5s pop-in)

### Video Trim Strategy
Playwright records from context open to close. The interesting footage is always at the end. Trim formula: `ffmpeg -ss {totalDuration - clipDuration} -i input.webm -c:v libx264 ...`

### Off-Screen Browser
`chromium.launch({ args: ['--window-position=-3000,-3000'] })` keeps the Chrome window from stealing focus.

### Randomization for Authentic Look
Use `midRunState()` helper to randomize: player HP (35-85% of max), gold (80-450), floor (2-9), 1-3 random relics (always at least 1), random filler cards in hand, ~50% chance of player buffs, ~60% chance of enemy debuffs.

**Critical — Post-Setup State Injection (the reliable approach):**
Passing `gold`, `relics`, `playerStatusEffects` through the `spawn()` config object works in isolation but is fragile — many clip definitions omit these fields, and converting all 100+ clips is error-prone. The **reliable approach** is to inject randomized state as a **post-setup patch** inside `captureClip()`, after `clip.setup()` completes but before actions run:

```js
// After setup, for combat clips:
__rrScenario.setGold(randInt(80, 450));
__rrScenario.setFloor(randInt(2, 9));
for (const id of randomRelics) __rrScenario.addRelic(id);
__rrScenario.patch({ turn: { playerState: { statusEffects: [...] }, enemy: { statusEffects: [...] } } });
```

This applies to ALL combat clips regardless of how their `setup()` is written. The `captureClip` function detects combat via `__rrPlay.getScreen()` and injects automatically.

Key values for trailer authenticity:
- **Gold: 80-450** — always visible in HUD
- **Relics: 1-3** — always at least 1
- **Player buffs: 50% chance** — strength, immunity
- **Enemy debuffs: 60% chance** — burn, bleed, poison, vulnerability, weakness
- **Floor: 2-9** — never floor 1 (looks like tutorial)

### Double-Flash Fix
`dismissScreenTransition()` in `gameState.ts` clears the overlay without a reveal animation when a `ParallaxTransition` is handling the visual reveal. All rooms with parallax now use this.

## Capturable Screens Reference

### Direct Scenario Load
| Screen | `loadCustom()` config | Notes |
|--------|----------------------|-------|
| `combat` | `{ screen: 'combat', enemy: 'id' }` | Per-enemy parallax bg |
| `shopRoom` | `{ screen: 'shopRoom', gold: N }` | Pop-in, 6s setupDelay |
| `restRoom` | `{ screen: 'restRoom', playerHp: N }` | Pop-in, 6s setupDelay |
| `mysteryEvent` | `{ screen: 'mysteryEvent', mysteryEventId: 'id' }` | Per-event bg |
| `rewardRoom` | `{ screen: 'rewardRoom', rewards: [...] }` | Phaser scene |
| `dungeonMap` | `{ screen: 'dungeonMap', floor: N }` | Map with nodes |
| `retreatOrDelve` | `{ screen: 'retreatOrDelve', gold: N }` | Pop-in |
| `runEnd` | `{ screen: 'runEnd', runEndResult: 'victory' }` | Animated grade reveal |
| `hub` | `{ screen: 'hub' }` | Camp screen |
| `library` | `{ screen: 'library' }` | Deck collection |
| `studyTemple` | `{ screen: 'studyTemple' }` | Curated deck grid |
| `triviaDungeon` | `{ screen: 'triviaDungeon' }` | Domain selector |
| `deckSelectionHub` | `{ screen: 'deckSelectionHub' }` | Study vs Trivia parallax cards |
| `relicSanctum` | `{ screen: 'relicSanctum' }` | Relic collection |
| `journal` | `{ screen: 'journal' }` | Run history |
| `profile` | `{ screen: 'profile' }` | Player profile |
| `settings` | `{ screen: 'settings' }` | Settings panel |
| `onboarding` | `{ screen: 'onboarding' }` | Dungeon entrance |
| `archetypeSelection` | `{ screen: 'archetypeSelection' }` | Playstyle picker |
| `masteryChallenge` | `{ screen: 'masteryChallenge', masteryChallengeQuestion: '...' }` | Timed quiz |
| `upgradeSelection` | `{ screen: 'upgradeSelection', hand: [...] }` | Card upgrade picker |
| `postMiniBossRest` | `{ screen: 'postMiniBossRest', hand: [...] }` | Mini-boss victory |
| `specialEvent` | `{ screen: 'specialEvent', floor: N }` | Post-boss event |
| `restStudy` | `{ screen: 'restStudy', deckId: 'id' }` | In-run study quiz |
| `multiplayerMenu` | `{ screen: 'multiplayerMenu' }` | MP mode selection |

### Spawn Config (Combat with Deep Overrides)
```js
__rrScenario.spawn({
  screen: 'combat', enemy: 'algorithm',
  hand: ['heavy_strike', 'block', ...],
  playerHp: 65, playerMaxHp: 100, floor: 7,
  relics: ['phoenix_feather'],
  enemyStatusEffects: [{ id: 'burn', stacks: 3 }],
  playerStatusEffects: [{ id: 'strength', stacks: 4 }],
  turnOverrides: { apCurrent: 5, chainMultiplier: 2.0, chainLength: 3, isSurge: true },
  runOverrides: { phoenixFeatherUsed: false },
  deckId: 'ancient_rome',  // routes quiz facts from this deck
})
```

## CLI Usage

```bash
# Room intro transitions (127 rooms)
node room-captures/capture-room-intros.mjs
node room-captures/capture-room-intros.mjs --type combat
node room-captures/capture-room-intros.mjs --only page_flutter,algorithm

# Trailer gameplay clips
node room-captures/capture-trailer-clips.mjs
node room-captures/capture-trailer-clips.mjs --category combat-chains
node room-captures/capture-trailer-clips.mjs --only chain-5-lightning,boss-algorithm-intro
node room-captures/capture-trailer-clips.mjs --force  # re-capture existing
```

## Output (1.4 GB total, gitignored)

```
room-captures/                        ← entire folder in .gitignore
  combat/           ← 89 enemy intro transitions
  mystery/          ← 34 mystery event transitions
  rooms/            ← 4 room type transitions (shop/rest/descent/menu)
  trailer-clips/    ← 168 gameplay clips across 15 categories
    combat-cards/       (17) card play variety
    combat-chains/      (9)  chain combos, surge
    combat-bosses/      (9)  boss intros, kills
    combat-dramatic/    (11) near-death, phoenix, crits
    quiz-moments/       (9)  quiz UI with different topics
    non-combat/         (12) shop, rest, mystery, rewards, map
    run-progression/    (8)  victory, defeat, hub, library
    atmosphere/         (8)  idle combat, surge particles
    knowledge-showcase/ (8)  domain-specific quizzes
    screens/            (18) study temple, relic sanctum, multiplayer, etc.
    mystery-events/     (20) all unique mystery rooms
    all-bosses/         (7)  every boss intro
    all-elites/         (10) all elite/mini-boss encounters
    knowledge-decks/    (12) diverse deck topic quizzes
    bonus/              (10) extra enemies, mystery events
  music/
    epic/           ← 45 tracks (combat, boss, victory BGM + epic .m4a)
    lofi/           ← 62 tracks (hub, rest, study, quiet .m4a + BGM .wav)
  sounds/
    sfx/            ← 10 best trailer SFX (swoosh, purchase, burn, coins, heal)
    ambient/        ← 8 ambient loops (campfire, dungeon drip, cave, low HP)
  intro/
    game-intro-logo.mp4  ← 8s boot animation (stars + logo + title)
```

## Idempotency
All scripts skip clips where the MP4 already exists. Use `--force` to re-capture.

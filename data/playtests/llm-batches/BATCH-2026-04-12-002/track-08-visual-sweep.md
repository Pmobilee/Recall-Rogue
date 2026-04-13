# Track 8 — Visual Screen Sweep
## Verdict: PASS with ISSUES

## Screens Tested: 26 / 26 planned

## Results Table
| Preset | Screen | Rendered? | Elements OK? | Text OK? | Notes | Status |
|--------|--------|-----------|-------------|----------|-------|--------|
| combat-basic | Combat vs Page Flutter | YES | YES | YES | HP bars, hand cards (5), enemy sprite, AP counter, chain bar, deck/discard piles all present | PASS |
| combat-boss | Combat vs The Algorithm | YES | YES | YES | Boss sprite renders, relic-free but topbar shows no relics correctly | PASS |
| combat-near-death | Combat low HP | YES | YES | YES | HP bar shows 3/100, near-death state visible | PASS |
| combat-big-hand | Combat large hand | YES | YES | YES | Many overlapping cards visible in arc layout | PASS |
| combat-relic-heavy | Combat with relics | YES | YES | YES | 4 relics visible in topbar, intent bubble shows enemy action | PASS |
| combat-all-chains | Combat chains state | YES | YES | YES | Combat renders correctly, chain bar visible | PASS |
| reward-room | Loot room | YES | YES | YES | 3 mini-cards + gold pile on pedestal + Continue button | PASS |
| shop | Shop basic | YES | YES | YES | 3 relics with prices, background renders, gold=500g | PASS |
| shop-loaded | Shop with many items | YES | YES | YES | 2 relics + 4 cards + removal/transform services visible | PASS |
| rest-site | Rest site | YES | YES | YES | Rest/Study/Meditate buttons, HP display, background | PASS |
| card-reward | Card reward screen | PARTIAL | PARTIAL | NO | h1 "Choose a Card" at y=-175 (off-screen top); p location text at y=-63 (off-screen). Cards visible but title/subtitle clipped | ISSUE |
| dungeon-map | Dungeon map | YES | YES | YES | Dark starfield background (intentional), nodes visible at bottom | PASS |
| retreat-or-delve | Segment clear choice | YES | YES | YES | "Segment Cleared" modal, Retreat/Delve Deeper buttons, rewards shown | PASS |
| mystery-event | Mystery event | YES | YES | YES | "Lost and Found" event with icon, text, Continue button | PASS |
| mystery-tutors-office | Tutor's office event | YES | YES | YES | Quiz prompt, "Begin Quiz" button, location background | PASS |
| run-end-victory | Victory screen | YES | YES | YES | "Dungeon Vanquished" grade S, enemy parade, XP bars, run stats | PASS |
| run-end-defeat | Defeat screen | YES | YES | YES | "Lost in the Dark" grade D, enemy parade, XP bars visible | PASS |
| run-end-retreat | Retreat screen | YES | YES | YES | "Tactical Retreat" shown, knowledge harvest bars visible | PASS |
| hub-fresh | Hub screen (new) | YES | YES | YES | Cave hub scene, fire, bookshelf, tent, signpost, Lv1 indicator | PASS |
| hub-endgame | Hub screen (endgame) | YES | YES | YES | Hub with additional items (chest, tome) around fire | PASS |
| library | Library screen | YES | YES | YES | Category sidebar, card grid with facts visible, search bar | PASS |
| settings | Settings screen | YES | YES | YES | Audio tab active, SFX/Music/Ambient sliders with values | PASS |
| onboarding | Onboarding/Entry | PARTIAL | NO | NO | Background renders correctly but "RECALL ROGUE" title and "ENTER THE DEPTHS" button DOM elements not rendering over canvas (DOM HIDDEN flag but PNG shows blank canvas only) | ISSUE |
| study-quiz | Study quiz | YES | YES | YES | Question modal with 4 answers, progress dots, Back button | PASS |
| mastery-challenge | Mastery challenge | YES | YES | YES | Timer, question, 4 answers visible in compact modal | PASS |
| study-deck-rome | Study quiz (Rome deck) | PARTIAL | YES | YES | Shows identical Miyazaki question as study-quiz — deck-specific preset not differentiating to Rome content | ISSUE |

## Visual Issues Found

### ISSUE-1 [MEDIUM] card-reward — h1/p title clipped above viewport
- **Screen:** card-reward
- **File:** `/tmp/rr-docker-visual/track-8_card-reward_1776007736955/`
- `h1 "Choose a Card"` positioned at y=-175 (86px tall → bottom at y=-89, fully off-screen)
- `p "Temple Pedestal • Marble plate under sacred light."` at y=-63 (partially off-screen)
- The card selection instruction and location flavor text are invisible to the player
- Cards themselves render correctly at y=47
- **Screenshot:** `/tmp/rr-docker-visual/track-8_card-reward_1776007736955/screenshot.png`
- **Likely cause:** CSS transform or scroll offset calculation putting the header above the viewport in landscape card-phase layout

### ISSUE-2 [LOW] onboarding — DOM overlay not rendering over Phaser canvas
- **Screen:** onboarding
- **File:** `/tmp/rr-docker-visual/track-8_onboarding_1776008126254/`
- Background image (dungeon entrance) renders correctly
- DOM elements present: h1 "RECALL ROGUE" at (821, 474), button "ENTER THE DEPTHS" at (849, 551)
- Screenshot shows ONLY the background — no text or button visible
- DOM elements are marked HIDDEN in layout dump (expected for card-app wrapper), but the actual child elements should be visible
- Could be z-index issue where Phaser canvas sits on top of DOM at this screen, or CSS opacity issue
- **Screenshot:** `/tmp/rr-docker-visual/track-8_onboarding_1776008126254/screenshot.png`

### ISSUE-3 [LOW] study-deck-rome — preset not loading Rome deck
- **Screen:** study-deck-rome
- **File:** `/tmp/rr-docker-visual/track-8_study-deck-rome_1776008220519/`
- Loads identical question as study-quiz: "Which 2023 Miyazaki film won the Academy Award for Best Animated Feature in 2024?"
- Layout dump is byte-for-byte identical to study-quiz dump
- Suggests `study-deck-rome` scenario preset is not wiring to the Rome deck, or the Rome deck is falling back to a generic question pool
- Not a visual rendering bug, but a scenario data issue

### NON-ISSUE (confirmed) — run-end screens header appearance
- The victory/defeat/retreat screens show the screen title in very small text at top edge. This is the design — the grade badge and content start ~y=36. The content is wide-format centered in a narrow column on the 1920px canvas. Intentional design.

### NON-ISSUE (confirmed) — dungeon-map dark background
- The dungeon map uses a space/void dark background. This is intentional. Nodes are correctly positioned and interactive.

### NON-ISSUE (confirmed) — enemy badge fallback "❓" in run-end screens
- Several `img.enemy-badge-img` elements have position `(0,0)` with fallback "❓" showing — this is because the badge images for some enemy types aren't loading in Docker (missing textures for certain enemies in the test scenario). The PNG confirms the fallback emoji "❓" is rendered correctly. Low priority.

## Screens NOT Tested (and why)
All 26 planned scenarios were tested successfully.

## Artifact Paths
All screenshots at `/tmp/rr-docker-visual/track-8_<preset>_<timestamp>/screenshot.png`

| Preset | Artifact Path |
|--------|---------------|
| combat-basic | /tmp/rr-docker-visual/track-8_combat-basic_1776007550810/ |
| combat-boss | /tmp/rr-docker-visual/track-8_combat-boss_1776007578642/ |
| combat-near-death | /tmp/rr-docker-visual/track-8_combat-near-death_1776007596929/ |
| combat-big-hand | /tmp/rr-docker-visual/track-8_combat-big-hand_1776007613235/ |
| combat-relic-heavy | /tmp/rr-docker-visual/track-8_combat-relic-heavy_1776007630209/ |
| combat-all-chains | /tmp/rr-docker-visual/track-8_combat-all-chains_1776007648272/ |
| reward-room | /tmp/rr-docker-visual/track-8_reward-room_1776007666918/ |
| shop | /tmp/rr-docker-visual/track-8_shop_1776007687063/ |
| shop-loaded | /tmp/rr-docker-visual/track-8_shop-loaded_1776007703862/ |
| rest-site | /tmp/rr-docker-visual/track-8_rest-site_1776007720486/ |
| card-reward | /tmp/rr-docker-visual/track-8_card-reward_1776007736955/ |
| dungeon-map | /tmp/rr-docker-visual/track-8_dungeon-map_1776007767911/ |
| retreat-or-delve | /tmp/rr-docker-visual/track-8_retreat-or-delve_1776007794953/ |
| mystery-event | /tmp/rr-docker-visual/track-8_mystery-event_1776007811910/ |
| mystery-tutors-office | /tmp/rr-docker-visual/track-8_mystery-tutors-office_1776007831499/ |
| run-end-victory | /tmp/rr-docker-visual/track-8_run-end-victory_1776007849597/ |
| run-end-defeat | /tmp/rr-docker-visual/track-8_run-end-defeat_1776007872258/ |
| run-end-retreat | /tmp/rr-docker-visual/track-8_run-end-retreat_1776007901235/ |
| hub-fresh | /tmp/rr-docker-visual/track-8_hub-fresh_1776007941430/ |
| hub-endgame | /tmp/rr-docker-visual/track-8_hub-endgame_1776008033241/ |
| library | /tmp/rr-docker-visual/track-8_library_1776008051613/ |
| settings | /tmp/rr-docker-visual/track-8_settings_1776008091632/ |
| onboarding | /tmp/rr-docker-visual/track-8_onboarding_1776008126254/ |
| study-quiz | /tmp/rr-docker-visual/track-8_study-quiz_1776008173345/ |
| mastery-challenge | /tmp/rr-docker-visual/track-8_mastery-challenge_1776008202669/ |
| study-deck-rome | /tmp/rr-docker-visual/track-8_study-deck-rome_1776008220519/ |

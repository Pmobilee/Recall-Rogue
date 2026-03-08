# Dome Exploration Run 11 - endgame_all_rooms

- Timestamp: 2026-03-07T12:06:51.028Z
- Scenario preset: `endgame_all_rooms`
- Status: Completed
- Initial screen: cutscene
- Final screen: menu

## Discovered Interactable Elements
- [0] DEV | tag=button | disabled=false | rect=1232,4,44x44
- [1] Keyboard Shortcuts | tag=summary | disabled=false | rect=888,219,365x28

## Tested Elements
- [0] DEV => OK | screen cutscene -> cutscene
- [1] Keyboard Shortcuts => FAIL | screen cutscene -> cutscene | TimeoutError: locator.click: Timeout 1200ms exceeded.

## Floor/Room Transition Validation
- No reliable UI-triggered screen/floor transition observed from clicked elements.
- Forced screen jumps attempted: 12; accepted: 12; inaccessible/redirected: 0.
- Forced screen jump details:
- target=dome | ok=true | after=dome
- target=hub | ok=true | after=hub
- target=surface | ok=true | after=surface
- target=mine | ok=true | after=mine
- target=study | ok=true | after=study
- target=museum | ok=true | after=museum
- target=lab | ok=true | after=lab
- target=garage | ok=true | after=garage
- target=archives | ok=true | after=archives
- target=collection | ok=true | after=collection
- target=home | ok=true | after=home
- target=menu | ok=true | after=menu
- Inaccessible/redirected routes (sample):
- None observed in this run.

## Visual Issues
- Potential clipping/offscreen: dev-add-consumable-sonar @ (973,720,146x44)
- Potential clipping/offscreen: ▶ Progression @ (961,775,319x44)
- Potential clipping/offscreen: ▶ Fossils @ (961,820,319x44)
- Potential clipping/offscreen: ▶ Inventory @ (961,865,319x44)
- Potential clipping/offscreen: ▶ Navigation @ (961,910,319x44)
- Potential clipping/offscreen: ▶ Danger Zone @ (961,955,319x44)
- Potential clipping/offscreen: ▶ Debug Info @ (961,1000,319x44)
- Potential z-order/overlap: DEV overlaps DIV
- Potential z-order/overlap: DEV overlaps ✕
- Potential z-order/overlap: DIV overlaps ✕
- Potential z-order/overlap: DIV overlaps ▶ Presets
- Potential z-order/overlap: DIV overlaps ▶ Snapshots
- Potential z-order/overlap: DIV overlaps ▶ Resources
- Potential z-order/overlap: DIV overlaps +500 Dust
- Potential z-order/overlap: DIV overlaps +50 Shards
- Potential z-order/overlap: DIV overlaps +20 Crystals
- Potential z-order/overlap: DIV overlaps +5 Geodes
- Potential z-order/overlap: DIV overlaps +2 Essence
- Potential z-order/overlap: DIV overlaps +Prem Mats
- Potential z-order/overlap: DIV overlaps Give All Resources

## Console Issues
- [error] WebSocket connection to 'ws://100.74.153.81:5173/?token=g46QBv_K25Kh' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
- [error] [vite] failed to connect to websocket (Error: WebSocket closed without opened.). 
- [error] Failed to load resource: the server responded with a status of 500 (Internal Server Error)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [pageerror] Error: WebSocket closed without opened.

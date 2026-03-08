# Mine Control-Path Validation — Run 18

- Date: 2026-03-07
- Run type: mine control-path validation
- Scenario: `devpreset=post_tutorial` then normal button flow `btn-dive -> btn-enter-mine`
- Forced screen changes: none
- Result: **FAIL**

## Execution Evidence

- URL loaded: `http://localhost:5173/?skipOnboarding=true&devpreset=post_tutorial`
- Initial state (`window.__terraDebug()`): `currentScreen: "cutscene"`
- Store evidence (`globalThis[Symbol.for('terra:currentScreen')]`): object present, `hasGet: false`, derived value: `null`
- `btn-dive`: missing (`present: false`, `visible: false`)
- `btn-enter-mine`: missing (`present: false`, `visible: false`)
- `hud-o2-bar`: missing (`present: false`)
- Log tail evidence (`window.__terraLog`): `{"event":"state-change"}` only; no mine-entry signal

## Control-Path Outcome

- Normal route is blocked before the first control button appears.
- Because `btn-dive` and `btn-enter-mine` are absent and screen remains `cutscene`, mine was not entered.
- 100 key actions were **not** executed (requirement gated on successful mine entry).

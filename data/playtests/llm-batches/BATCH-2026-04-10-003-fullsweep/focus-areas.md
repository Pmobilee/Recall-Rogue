# Batch Focus Areas — BATCH-2026-04-10-003-fullsweep

**EVERY tester MUST read this file before starting. In addition to your standard checklist, you MUST explicitly comment on every applicable item below in your report — even if the answer is "N/A" or "not encountered".**

This batch is focused on **bugs, fun, and issues**. Not a victory lap — we want you adversarial. Assume everything is broken until you prove it works. Screenshot liberally. Layout-dump when in doubt. If something feels weird, it probably is.

---

## 1. Chess Tactics deck (new, 2026-04-10) — HIGH RISK

The chess_tactics deck was rewritten end-to-end today: 620,000 runtime puzzles, **no multiple-choice rendering**, **no hint text**, full-panel chess-board quiz UI, fresh sourceUrl plumbing. It has never been live-played by an LLM yet.

**Full-run tester MUST spawn at least one encounter using the chess_tactics deck**, either via a curated run override or `__rrPlay.spawn()` with a hand of chess_tactics cards. Verify:

- (a) Quiz UI shows a CHESS BOARD, not A/B/C/D buttons. If you see multiple-choice on a chess card, that's a CRITICAL bug.
- (b) The board fills the quiz panel (no tiny board, no overflow, no letterboxing).
- (c) The question stem does NOT contain the words "hint", "clue", "try", "think about" — hint text leaks were explicitly stripped; any surviving leak is a HIGH bug.
- (d) `factSourceUrl` (if displayed) is a plausible chess URL (lichess/chessgames/etc), not `undefined`, `null`, or empty.
- (e) Scroll through at least 5 distinct chess puzzles in one session to confirm the runtime puzzle pool is actually serving different positions (not the same puzzle repeating).

---

## 2. Map Pin Drop quiz mode (new)

The `world_capitals` deck now carries lat/long map coordinates, and the quiz engine supports a `map_pin` mode with partial-credit damage scaling.

If any tester lands on a world_capitals card (select domain `world_capitals` or spawn a card from it), verify:

- (a) The map UI loads without a black screen, missing texture, or CSP error.
- (b) Pin coordinates render at the expected location (Paris pin is in Europe, not in the Pacific).
- (c) Partial credit feels fair: a close miss (e.g., picking Brussels for Paris) should deal meaningful but reduced damage; a wild miss (Tokyo for Paris) should deal minimal damage, **never NaN, never negative, never full damage**.
- (d) Clicking outside the map bounds either rejects the click or clamps to the edge — no silent crash, no frozen UI.

---

## 3. Deck front art (7 new decks) — Study Temple tester

7 curated decks shipped fresh portrait-ratio dark-pixel-art deck-front covers today. Study Temple tester owns this item.

From the Hub → Library (or Study Temple screen):

- Screenshot the library screen at 1920×1080.
- List EVERY visible deck card (name + whether art loaded).
- For each of the 7 new decks (recently shipped: anime_manga, chess_tactics, fifa_world_cup, ocean_life, philosophy, pop_culture, world_literature), explicitly verify:
  - Art loaded (not 404, not placeholder, not blank).
  - Portrait aspect ratio (taller than wide).
  - Dark pixel-art style (not illustrated, not photographic, not AI-smooth).
  - Parallax hover effect works if hover is possible via `__rrPlay` / direct DOM dispatch.
- Flag any deck with horizontal (landscape) cover — that's a REGRESSION.

---

## 4. Resume flow — InRunFactTracker rebuild fix

A bug where the `InRunFactTracker` class instance was not rebuilt after save/load was fixed recently. Balance-curve or full-run tester MUST exercise this path:

- Play at least 2 combat encounters so the tracker has state.
- Call `__rrPlay.snapshot()` (capture state), then hard-reload the page (`browser.reload()` or equivalent container restart), then `__rrPlay.restore(snap)`.
- Immediately call `__rrPlay.look()` and inspect the learning state. Verify:
  - No "NEW" flag on facts that were previously LEARNING or GRADUATED.
  - Counters are not all zero (tracker didn't silently reset).
  - The next combat still presents the same fact-tracker flow (new facts enter when learning slots free).

If the tracker appears to have reset, that's a CRITICAL regression of the fix.

---

## 5. Fact repetition is NOT a bug (DO NOT REPORT)

Seeing ~8–10 unique facts across 22 quiz charges is **expected Anki-faithful behavior**. The `InRunFactTracker` uses a three-state model (NEW → LEARNING → GRADUATED) with `MAX_LEARNING = 8`, step delays `[2, 5]`, and graduate delay `10`. The system intentionally drills ~8–10 facts repeatedly to cement them within a run.

Only report repetition if the pattern is **wrong** — e.g., a graduated fact returning before step 10, or new facts never introduced when a slot frees.

---

## 6. Quick Play vs Charge ratio (DO NOT REPORT as imbalanced)

- Quick play = base damage (`quickPlayValue`)
- Charge correct = `qp × 1.5`
- Charge wrong = `qp × 0.25` (floored, never 0)

With `devpreset=post_tutorial`, the player is level 25 + all relics, which makes the ratio look 3–6× due to mastery/relic stacking. That's the setup, not a balance bug. Only report if the base ratio (no relics, no mastery) deviates from 1 : 1.5 : 0.25.

---

## 7. Post-tutorial onboarding clarity — Fun tester

Launch with `?skipOnboarding=true&turbo=true&botMode=true`. First thing you see should be the Hub. Fun tester:

- Take one screenshot of the initial hub.
- Rate hub clarity 1–5: "If I were a brand-new player dropped here, would I know where to click next?"
- Flag EVERY empty-state placeholder, unlocalized string (`i18n.missing`, `{{ key }}`, `__key__`), broken button, or grey box.
- Flag any hub element that has no visible tooltip/label on hover.

---

## 8. Audio leakage — Low severity

Bot framework mutes audio via Svelte stores before the run starts. If sound still plays (Phaser AudioManager has a separate channel), note it as a LOW issue — it's a known gap, not a game bug.

---

## 9. AP economy sanity — Balance-curve tester

For every turn in every combat, log:

- `apStart` (AP at turn start)
- `apEnd` (AP at turn end)
- `cardsPlayedThisTurn`
- Any "wasted AP" moments: ≥2 AP leftover at end of turn AND there was at least one card in hand the player could have afforded but chose not to play.

Flag turns where:
- Player is FORCED to end turn with no playable card (zero-option turn) → BAD.
- Player wastes >2 AP with playable cards available → suggests poor card cost design or forced-discard issues.

Produce a table in your report.

---

## 10. Card reward relevance — ALL testers

For every card reward screen encountered:

- Record the 3 offered options (name + type + mechanic).
- Record which was chosen and WHY (brief reason in plain English).
- In the NEXT combat after the reward: did the chosen card actually get played? Yes/No.

At end of report, compute: `rewardsPlayed / rewardsTaken`. If <40%, rewards are mis-targeted for the current player state and that's a MEDIUM balance issue.

---

## 11. Relic clarity — Fun tester

For every relic acquired (from shop, reward room, or mystery event):

- Record the description text as shown in the UI.
- Rate clarity 1–5: "Would a brand-new player understand what this relic does on first read?"
- Flag any relic whose description uses jargon without context (e.g., "surge", "charge", "fizzle") without explaining it.

---

## 12. Run end flow — Full-run tester

Full-run MUST reach either (a) player death → `runEnd` screen, or (b) end of floor 3. Screenshot the terminal screen.

Verify:
- Final stats render (HP, floor reached, cards learned, gold earned, etc).
- No `NaN`, `undefined`, `null`, `[object Object]` anywhere on the screen.
- A clear "return to hub" or "new run" button exists and is clickable.
- Clicking it actually returns you to the hub (don't skip — verify).

---

## 13. Cursed / fizzle path — ALL testers

Every tester MUST intentionally answer at least 3 questions INCORRECTLY (via `chargePlayCard(index, false)`). For each:

- Record the card's `qpValue`.
- Record the actual damage dealt.
- Verify `actualDamage === Math.max(0, Math.floor(qp × 0.25))` — the fizzle floor.
- Verify the card is not permanently locked afterward (you can still play other cards, end turn works, no UI freeze).

If damage is 0 when qp ≥ 4, that's a bug (min floor of 1 when qp×0.25 >= 1). If damage is NaN, that's a CRITICAL bug.

---

## 14. Performance subjective signal — ALL testers

If any scene feels "sluggish", flag it. Specifics that count:

- Card deal animation takes >2s from `startRun` to hand visible.
- End turn button hangs >1s before enemy intent updates.
- Scene transition (combat → reward) takes >3s with blank screen.
- Layout dump shows transitions stuck > 2s.

Use `__rrDebug()` if available to dump FPS and draw call counts. Report absolute numbers, not vibes.

---

## Report format expectations

Your standard report format from the tester prompt still applies. At the TOP of your report, add a section titled **"Focus Area Coverage"** that maps each focus item 1–14 to one of: PASS, FAIL, N/A (not encountered), or ISSUES (with severity). This section is required — a missing or incomplete Focus Area Coverage section will cause the orchestrator to reject the report and re-run you.

Be honest. If you didn't encounter an item, say "N/A — did not reach this state". Do not fabricate coverage.

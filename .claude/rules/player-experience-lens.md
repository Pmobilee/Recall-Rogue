# Player-Experience Lens

**Before marking any player-visible change done, mentally play the game as two people:**

1. **A first-time player** who has never seen Recall Rogue before.
2. **A 20-hour veteran** who has already seen everything.

Walk through the affected screen or interaction in their shoes. What do you see, hear, and feel? Is anything confusing, silent, ugly, or missing polish?

This rule applies to any change that a player could observe at runtime: UI, combat, quiz, shop, rest, map, rewards, audio, animation, text, balance, card effects, enemy behavior, transitions, fonts, layout, colors, feedback, error states. If there is any doubt, assume it applies.

## The Five Mandatory Checks

Run all five before calling the task done. Fix anything that fails **in the same commit** — this is a Green-zone action per the Autonomy Charter.

### 1. Discoverability (first-time player)
- Is the change reachable from normal gameplay without secret knowledge?
- Does the UI explain what it is the first time the player encounters it?
- If the change introduces a new concept, is there a tooltip, a floating hint, a tutorial line, a dev-overlay note, or at minimum a clear label?
- If the change is a new button, does its label tell the player what will happen?

### 2. Veteran Skip Path (20-hour player)
- Is there an "I already know this, stop showing me" path? Tooltip dismissal, one-time tutorial, fast-forward on animation, auto-skip on repeat dialog.
- Does the change add friction for a player who has already mastered it?
- If a confirmation dialog, is there a "don't ask again"?

### 3. Audio (both)
- Does the change have an appropriate SFX wired in from the audio catalog?
- Check `docs/AUDIO.md` (or the audio-manager skill) for the existing SFX catalog. **Reuse existing sounds** — do not introduce new ones unless unavoidable.
- If no appropriate SFX exists, wire a placeholder and flag loudly in the Heads-Up section: "No SFX wired — recommend audio-manager pass."
- Background music / ambient loop appropriate for the screen?

### 4. Visual Feedback & Juice
- Does a successful action have visible feedback? Particle, tween, color flash, shake, scale pop.
- Does a failed / invalid action have visible feedback? Red flash, shake, disabled-state visual.
- Does a state change (HP loss, card drawn, enemy killed, shop purchase) animate, not just snap?
- Reference comparison: "If Slay the Spire or Balatro had this same interaction, would it feel as juicy?"
- If the answer is no, add a tween, a flash, or a particle. Do not ship a silent snap.

### 5. Edge States
- **Empty state:** no cards in hand, no items in shop, no rewards to pick. Does the UI handle it or crash?
- **Error state:** save fails, db decode fails, asset missing. Does the UI show something useful?
- **Rapid input:** player mashes the button. Does it queue, ignore, or break?
- **Resize state:** player resizes the window mid-action. Does the layout reflow (uses `var(--layout-scale)`)?
- **Escape hatch:** can the player always back out of this screen to the hub? (See `.claude/rules/ui-layout.md` Softlock Prevention.)

## The "Steam Reviewer" Heuristic

Imagine a Steam reviewer who has just bought the game, plays for 30 seconds, and writes a 1-line complaint. What would they complain about in your changed area?

- "The button doesn't do anything when I click it." → missing feedback
- "I have no idea what this screen is for." → missing onboarding text
- "This animation is too slow and I can't skip it." → missing veteran skip path
- "The font is tiny on my 4K monitor." → missing `var(--text-scale)`
- "There's no sound when I attack." → missing SFX
- "It crashed when I opened the shop with 0 gold." → empty state

If you can imagine the complaint, **fix it now**. Green-zone.

## When The Lens Does Not Apply

This lens is for player-facing changes. It does not apply to:

- Pure refactors with zero behavioral change (but: verify zero behavioral change via visual test).
- Backend-only scripts, content pipelines, deck generation, validation tools.
- Test code, dev scripts, CI configuration.
- Doc edits.

Everything else: run the lens.

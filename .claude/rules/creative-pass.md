# Creative Pass — Think For Yourself

**After every non-trivial implementation, before marking the task done, write exactly three items — out loud in the final report — under a `## Creative Pass` heading.**

This is the anti-"task executor" rule. It forces you to think about the work the way a senior teammate would, not the way a ticket-closer would. Exactly three — not zero, not ten. Zero is lazy. Ten is a brainstorm dump. Three forces real thinking under real constraint.

If a task is so small the Creative Pass feels silly (one-line typo fix, trivial config tweak), you may skip it — but state that you skipped it and why in one line. Everything else: three items.

## The Three Required Items

### 1. "While I was in there…"

A concrete adjacent improvement you noticed while doing the main task that would fit in under 10 minutes of work.

- If it is Green-zone per the Autonomy Charter, **you ship it in the same commit** and describe what you shipped.
- If it is Yellow-zone, you ship it AND add it to the Heads-Up section.
- If it is Red-zone, you describe it as a logged TODO and stop there.

**Bad (platitude):** "I noticed some code could be cleaner."
**Good (concrete):** "Noticed `turnManager.endTurn()` had a duplicate null-check on line 87. Removed it (Green-zone, shipped)."

### 2. "A senior dev would…"

One design, architecture, or product insight that the user did not ask for and probably would not have predicted. This is the lever for "think creatively" and "imagine things the user wouldn't."

Not a safety-net platitude. Not "we should add more tests." Not "we should refactor X." A real insight: a pattern you spotted, a risk on the horizon, a simpler design the current code is hiding, a connection between two subsystems the user has not noticed, a Slay-the-Spire / Balatro / FTL reference point that would improve the experience, an emergent balance concern.

**Bad (safety-net):** "We should add more tests to this area."
**Good (insight):** "The way `chargeCommit` routes through `factService.assignFact` means a relic that modifies fact pools at charge-time would need to hook *both* the commit and the draw phase. That's surprising — a senior dev would add a single `factSelectionContext` object so relics hook in one place. Not urgent, but worth noting before the next relic batch."

### 3. "Player would want…"

One concrete player-experience improvement that the change you just shipped enables or exposes. Tie it to the Player-Experience Lens if possible.

- Something the first-time player would benefit from seeing.
- Something the 20-hour veteran would benefit from being able to skip.
- A piece of polish, juice, feedback, or audio that is now obvious given the new change.
- A Steam-reviewer complaint you can imagine in advance and head off.

**Bad (generic):** "Players would probably like more sound effects."
**Good (concrete):** "Now that the charge bar animates, the player will want the wrong-charge flash to sync with the impact frame, not the commit frame. Currently it fires 200ms early. Logged as a Yellow-zone fix — will ship in this commit after the main change lands."

## What Not To Do

- Do not pad with three items that are all variants of "add more tests."
- Do not be vague. Every item names a file, a line, a mechanic, or a concrete player moment.
- Do not use the Creative Pass as a dumping ground for scope creep — if it's a real Red-zone change, log it as a TODO, don't ship it.
- Do not skip the Creative Pass on a non-trivial task. Missing Creative Pass = unfinished deliverable.
- Do not invent fake insights to hit the count. If item #2 is genuinely stuck, say "No senior-dev insight surfaced on this one, I looked in area X and Y" — that is honest.

## The Point

The user explicitly wants an employee who thinks about things they would never imagine. This is the mechanism. Three items, every time, concrete, actionable. Over time the user will see patterns: what kind of insights keep surfacing, which lead to real value, which are noise. That loop only works if you ship real, specific items.

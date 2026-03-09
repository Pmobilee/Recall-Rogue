# Arcane Recall — Phase Reflection Skill

## When To Use This Skill

Run this skill **after completing all CRs in a phase** and **before starting the next phase**. This is the REFLECT checkpoint in PROGRESS.md.

## What This Skill Does

1. Audits what was built against what was planned
2. Checks implementation against GAME_DESIGN_md for drift or contradictions
3. Identifies documentation that needs updating
4. Generates 25-50 structured questions with the agent's own assessment and advice
5. Produces a REFLECT-XX.md file for the human to review with their game design advisor

## Instructions

### Step 1: Gather Context

Read these files in order:

```
1. docs/GAME_DESIGN_md                          — The design bible
2. docs/PROGRESS.md                              — Phase overview (find current phase)
3. docs/roadmap/phases/CR-XX-*.md                — All CR specs for the just-completed phase
4. docs/roadmap/completed/CR-XX-*.md             — Any previously completed CRs for context
```

Also examine the actual codebase to understand what was built:
- Run `find src/ -name "*.ts" -o -name "*.svelte" | head -80` to see file structure
- Read key files that were created or modified in this phase
- Run the dev server if possible and note any errors

### Step 2: Implementation Audit

For EACH CR in the completed phase, check:

**A. Was it built?**
- [ ] All items in the CR's done-when checklist are actually done
- [ ] No placeholder values remain (search for TODO, FIXME, PLACEHOLDER, 0, -1, "placeholder")
- [ ] The feature works end-to-end (not just the happy path)

**B. Does it match the spec?**
- [ ] Values match GAME_DESIGN_md (damage numbers, HP, timer durations, percentages)
- [ ] Behavior matches GAME_DESIGN_md (turn flow, commit rules, AP costs, combo reset)
- [ ] Edge cases from the CR spec are handled

**C. What's missing or wrong?**
- List anything that was specified but not built
- List anything that was built differently than specified
- List anything that works but feels wrong during manual testing

Write your findings as a checklist in the output file.

### Step 3: Game Design Document Audit

Read GAME_DESIGN_md end-to-end and check for:

**A. Contradictions:** Does the implementation contradict anything in the design doc? If so, which is correct — the implementation or the doc? Recommend which to change.

**B. Missing specs:** Did you discover during implementation that the design doc is vague or silent on something important? List these gaps.

**C. Outdated sections:** Does anything in the design doc describe the old mining theme, SM-2 instead of FSRS, or domain-locked card types? Flag these for cleanup.

**D. New insights:** Did building this phase reveal a design improvement that should be added to the doc? Describe it with reasoning.

If you find issues, write the specific changes needed. Do NOT modify GAME_DESIGN_md yourself — list the changes for the human to review and approve.

### Step 4: Documentation Audit

Check if these files need updates:

- `PROGRESS.md` — Mark completed CRs as done. Does the next phase description still make sense given what was learned?
- `README.md` — Does it reflect current game state?
- Any inline code comments that reference old designs
- Any config files with outdated values

### Step 5: Playtest Assessment

If possible, run the game and play through the features built in this phase. Note:

- **Feel:** Does it feel right? Is combat satisfying? Are numbers visible and meaningful?
- **Flow:** Can you get stuck? Is there any state where the game hangs or becomes unresponsive?
- **Learning integrity:** Can you see the question before committing? Can you play infinitely without AP running out? Can you avoid facts?
- **Performance:** Any visible lag, jank, or frame drops?
- **Mobile readiness:** Are touch targets large enough? Is everything in the bottom 45%?

### Step 6: Generate Questions

Produce 25-50 questions organized by category. For EACH question, include:

1. **The question itself** (specific, not vague)
2. **Your assessment** (what you think the answer is based on your analysis)
3. **Your advice** (what you recommend doing about it)
4. **Priority** (BLOCKER / HIGH / MEDIUM / LOW)

**Question categories (aim for 4-8 per category):**

**Combat Feel:**
- Does the damage/heal/block math create real tension?
- Do encounters end too fast or drag too long?
- Does the combo system feel rewarding?
- Are card mechanics distinguishable from each other?
- Does the enemy telegraph system give enough info for strategy?

**Learning Integrity:**
- Is commit-before-reveal working perfectly? Any way to see answers early?
- Is FSRS tracking correctly? Are facts appearing at appropriate intervals?
- Do question format rotations feel like genuinely different questions?
- Is difficulty-proportional power creating the right incentive?
- Are wrong answers handled gently enough?

**UX & Mobile:**
- Are all interactive elements in the bottom 45%?
- Can you play one-handed comfortably?
- Are cards readable at collapsed size?
- Does the expanded card show all necessary info without scrolling?
- Is the AP display clear at a glance?
- Does the timer feel fair for long vs short questions?

**Progression & Retention:**
- Does the run structure create meaningful risk/reward decisions?
- Are card rewards after encounters satisfying?
- Is there enough variety across encounters to prevent monotony?
- Does the deck-building choice (room selection) feel impactful?

**Technical:**
- Are there any console errors or warnings?
- Is state persistence working (app close → resume)?
- Are there any memory leaks from particle effects or sprite creation?
- Is the draw pile → discard → reshuffle cycle working correctly?

**Content:**
- Are there enough facts to prevent repetition in a single run?
- Are question variants genuinely different or just reworded?
- Are difficulty ratings accurate?
- Are there any factually incorrect items?

**Next Phase Prep:**
- What from the next phase in PROGRESS.md might need to change given what we learned?
- Are there any prerequisites for the next phase that aren't met?
- Should any next-phase CRs be split, merged, reordered, or cut?
- Are there new CRs that should be added based on what we discovered?

### Step 7: Produce Output File

Create `docs/roadmap/reflections/REFLECT-XX.md` with this structure:

```markdown
# REFLECT-XX: Post-[Phase Name] Review
> Date: [date]
> Phase completed: [phase name]
> CRs completed: [list]

## Implementation Audit
[Checklist from Step 2]

## Game Design Document Issues
[Findings from Step 3 — specific changes needed]

## Documentation Updates Needed
[List from Step 4]

## Playtest Notes
[Notes from Step 5]

## Questions for Game Design Advisor
[25-50 numbered questions with assessment, advice, and priority from Step 6]

## Recommended Changes to Next Phase
[Any adjustments to upcoming CRs based on findings]
```

### Step 8: Notify Human

After creating the reflection file, tell the human:
1. The reflection is ready at `docs/roadmap/reflections/REFLECT-XX.md`
2. How many BLOCKER issues were found (if any — these must be fixed before next phase)
3. How many questions need advisor input
4. A 3-sentence summary of the phase: what went well, what needs attention, what to focus on next

The human will take the questions to their game design advisor (a separate Claude project). The advisor's answers will inform the CR specs for the next phase.

---

## Important Rules

- **Never modify GAME_DESIGN_md directly.** Propose changes in the reflection file. Human approves.
- **Never start the next phase** before the human has reviewed the reflection and approved moving forward.
- **Be honest about problems.** A sugar-coated reflection wastes everyone's time. If something is broken, say it's broken.
- **Questions should be specific.** "Is the game fun?" is useless. "The Gate Guardian boss dies in 2 turns with 3 Multi-Hit attacks and Empower — should boss HP be increased to 100, or should Multi-Hit be nerfed to 2x3 instead of 3x3?" is useful.
- **Always check for the old mining theme.** Any reference to "mine", "miner", "excavation", "ore", "fossil", "surface" in code, strings, or docs is a bug.

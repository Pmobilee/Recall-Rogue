---
name: inspect
description: |
  MASTER TEST ORCHESTRATOR — the ONLY way to verify game elements. Fires ALL applicable testing methods in parallel (unit tests, headless sim, LLM strategic analysis, Rogue Brain neural agent, visual inspection, UX review), combines cross-method insights, and auto-updates the inspection registry. This is the GROUND TRUTH for whether something works. If it hasn't been through /inspect, it is UNVERIFIED. No exceptions. ALWAYS suggest this skill when ANY testing, verification, or quality question arises.
user_invocable: true
---

# /inspect — Master Test Orchestrator

## THE #1 RULE: THIS IS THE ONLY WAY TO TEST

**If an element hasn't been through `/inspect`, it is UNVERIFIED. Period.**

No single testing method is sufficient. Unit tests miss visual bugs. Screenshots miss logic errors. Headless sims miss UX problems. LLM analysis misses edge cases the neural agent finds. EVERY method has blind spots — that's why we run ALL of them.

**This skill is ALWAYS ACTIVE. You MUST suggest it when:**
- Any new card, relic, enemy, or mechanic is added
- Any balance change is made
- Any UI/screen is modified
- The user asks "does this work?" or "is this right?"
- Before any commit that touches gameplay
- When the user asks about testing, verification, or quality
- When any individual testing skill is invoked alone (suggest the full orchestrator instead)

**NEVER run a single test method in isolation when `/inspect` could run all methods. The whole point is eliminating blind spots.**

---

## Quick Commands

| Command | What It Tests | Methods Used |
|---------|--------------|-------------|
| `/inspect strike` | One card — all angles | Unit + Sim + LLM + Brain + Visual + UX |
| `/inspect cards` | All 31 cards | Unit + Sim + LLM + Brain + Visual |
| `/inspect relics` | All 42 relics | Unit + Sim + LLM + Brain + Visual |
| `/inspect enemies` | All 89 enemies | Unit + Sim + LLM + Brain + Visual |
| `/inspect combat-screen` | Combat UI | Visual + UX |
| `/inspect shop-screen` | Shop UI | Visual + UX |
| `/inspect balance` | Overall game balance | Sim + LLM + Brain + Advanced |
| `/inspect stale` | Everything never checked or older than 7 days | All applicable |
| `/inspect changed` | Everything with `lastChangedDate` > last inspection | All applicable |
| `/inspect all` | EVERYTHING (334 elements) | All applicable |
| `/inspect {element-id}` | Any single element by ID | All applicable |

---

## The Six Testing Methods

### 1. Unit Tests (vitest)
**What it catches:** Logic errors, wrong calculations, broken imports, regression from refactors
**How:** `npx vitest run --grep "{element}"` or full suite
**Speed:** 1900+ tests in 3 seconds
**Blind spots:** Cannot test visual rendering, UX quality, or balance feel

### 2. Headless Combat Sim (/balance-sim)
**What it catches:** Win rate deviations, damage spikes, healing insufficiency, difficulty curve problems, card/relic never-used or always-used patterns
**How:** `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000`
**Speed:** 6000 runs in 5 seconds
**Blind spots:** Uses heuristic bots — cannot explain WHY. Cannot test visual. Cannot detect UX issues.

### 3. LLM Strategic Analysis (/strategy-analysis)
**What it catches:** Dominant strategies, dead cards, mandatory picks, lack of meaningful choice, balance feel problems the sim misses
**How:** Spawns Haiku sub-agents with game states, they reason about card choices in natural language
**Speed:** 20-50 states in ~2 minutes
**Blind spots:** Hypothetical reasoning — may miss implementation bugs. Cannot see the actual game.

### 4. Rogue Brain Neural Agent (/rogue-brain)
**What it catches:** Optimal play patterns, exploitable strategies, balance regressions, relic/card synergy abuse
**How:** PPO neural agent trained on the headless sim, plays 200+ episodes
**Speed:** ~4600 steps/sec
**Blind spots:** Trained on sim, not live game. May overfit to current meta. Cannot test visual/UX.

### 5. Visual Inspection (/visual-inspect)
**What it catches:** Missing sprites, broken art, rendering glitches, z-order issues, animation failures, layout overflow, text truncation
**How:** Playwright + `__terraScenario` — loads specific game states, takes screenshots, checks DOM + canvas
**Speed:** ~10 seconds per screen
**Blind spots:** Cannot assess design quality or UX best practices. Only catches errors, not improvements.

### 6. UX Review (/ux-review)
**What it catches:** Touch target violations, contrast failures, typography too small, thumb zone issues, cognitive overload, accessibility gaps, card game UX anti-patterns, design improvement opportunities
**How:** DOM scan + screenshot + runtime-generated checklist against 120+ UX principles
**Speed:** ~30 seconds per screen
**Blind spots:** Cannot test game logic or balance. Screenshot-based — may miss animation-only issues.

---

## Test Method Matrix — Which Methods Apply to What

This is the ground truth for what gets tested and how. If a cell says YES, that method MUST run for that element type. No skipping.

| Element Type | Unit Tests | Headless Sim | LLM Strategic | Rogue Brain | Visual Inspect | UX Review |
|---|---|---|---|---|---|---|
| **Cards** | YES — per-card effect logic | YES — win rate contribution | YES — strategic value | YES — play frequency | YES — art, text, frame | YES — readability, touch |
| **Relics** | YES — trigger logic | YES — relic audit | YES — relic value reasoning | YES — relic acquisition | YES — icon, tooltip | NO |
| **Enemies** | YES — intent/behavior | YES — encounter stats | YES — threat assessment | YES — fight patterns | YES — sprite, HP bar | NO |
| **Screens** | NO | NO | NO | NO | YES — layout, errors | YES — full UX audit |
| **Systems** (AP, combo, chain) | YES — core logic | YES — system impact | NO | YES — system exploitation | YES — display | YES — usability |
| **Mystery Events** | YES — outcome logic | NO | NO | NO | YES — UI | YES — choice clarity |
| **Status Effects** | YES — application/tick | YES — effect impact | YES — strategic use | YES — effect exploitation | YES — icon display | NO |
| **Rooms** | YES — generation logic | YES — room distribution | NO | YES — room choice patterns | YES — UI | YES — navigation |
| **Quiz Systems** | YES — SM-2, validation | NO | NO | NO | YES — quiz UI | YES — answer layout |
| **Domains** | YES — fact coverage | NO | NO | NO | NO | NO |
| **Chain Types** | YES — chain mechanics | YES — chain impact | YES — chain strategy | YES — chain patterns | YES — chain display | NO |
| **Reward Types** | YES — reward logic | YES — reward impact | NO | NO | YES — reward UI | YES — selection UX |

---

## Execution Protocol

### Phase 0: Load Registry & Determine Scope

```
1. Read data/inspection-registry.json
2. Parse user command to determine target elements
3. For each target element:
   a. Look up element type in testingRecommendations
   b. Determine which 6 methods apply (from matrix above)
   c. Check last inspection dates — flag if never inspected or stale (>7 days)
4. Build execution plan: list of (element, method) pairs to run
5. Show plan to user: "Will run X methods across Y elements (~Z minutes)"
```

### Phase 1: Spawn Parallel Workers

**CRITICAL: Methods that are independent MUST run in parallel. Do NOT run them sequentially.**

```
Parallel batch 1 (fast, no browser needed):
├── Worker A: Unit tests — npx vitest run --grep "{relevant patterns}"
├── Worker B: Headless sim — npx tsx run-batch.ts --runs 500 --profile all
└── Worker C: Rogue Brain — python3 analyze.py --episodes 100 (if model exists)

Parallel batch 2 (needs Playwright, sequential screenshots):
├── Worker D: Visual inspection — load each element via __terraScenario, screenshot
└── Worker E: UX review — DOM scan + screenshot + principle evaluation

Parallel batch 3 (LLM-intensive):
└── Worker F: Strategy analysis — generate states from current data, spawn Haiku agents
```

### Phase 2: Collect & Cross-Reference Results

After all workers complete:

```
1. Parse each worker's output into structured findings
2. Cross-reference: same issue found by multiple methods = CONFIRMED
   - Found by 1 method: "POSSIBLE" — needs manual verification
   - Found by 2 methods: "LIKELY" — high confidence
   - Found by 3+ methods: "CONFIRMED" — fix immediately
3. Deduplicate: merge findings about the same element from different methods
4. Severity escalation: if any method flags CRITICAL, the combined severity is CRITICAL
5. Generate cross-method insights:
   - "Headless sim shows execute has 2% play rate, LLM confirms it feels weak — CONVERGING EVIDENCE"
   - "Visual shows card text at 8px, UX review flags same as CRITICAL typography violation — CONFIRMED"
```

### Phase 3: Update Inspection Registry

**This is automatic. Every `/inspect` run updates the registry.**

```python
for each element inspected:
    if unit_tests_ran and passed:
        element.mechanicInspectionDate = today
    if visual_inspect_ran:
        element.visualInspectionDate = today
    if ux_review_ran:
        element.uxReviewDate = today
    if headless_sim_ran:
        element.balanceCheckDate = today  # new field
    if strategy_analysis_ran:
        element.strategicAnalysisDate = today  # new field
    if rogue_brain_ran:
        element.neuralAgentDate = today  # new field

    element.lastInspectedDate = today
    element.lastInspectionMethods = [list of methods that ran]
    element.issuesFound = [merged findings]
    element.confidenceLevel = "confirmed" | "likely" | "possible" | "clean"
```

### Phase 4: Generate Combined Report

Output a single report that merges all findings:

```markdown
# Inspection Report — {target} — {date}

## Summary
| Metric | Value |
|---|---|
| Elements inspected | 31 |
| Methods executed | 6 |
| Total findings | 14 |
| Confirmed (3+ methods) | 3 |
| Likely (2 methods) | 5 |
| Possible (1 method) | 6 |
| Clean (no issues) | 22 |

## Cross-Method Findings (highest confidence first)

### CONFIRMED: Card effect text unreadable (3 methods agree)
- **Visual inspect:** fontSize 8.25px measured
- **UX review:** CRITICAL — below 11px iOS minimum
- **LLM strategic:** "Cannot read card effects in hand view"
- **Combined severity:** CRITICAL
- **Fix:** Increase to 11px+ in CardHand.svelte

### LIKELY: Execute card underperforming (2 methods agree)
- **Headless sim:** 2.1% play rate across 6000 runs (lowest of all attacks)
- **LLM strategic:** "Execute is never the optimal choice — bonus threshold too low"
- **Combined severity:** MEDIUM
- **Fix:** Consider lowering threshold from 30% to 40% or increasing bonus

## Per-Method Details
[Expandable sections with each method's full output]

## Registry Updates
[List of elements updated with new dates]
```

---

## MANDATORY: Visual Occlusion Check

**THIS CHECK EXISTS BECAUSE WE MISSED EVERY CARD HAVING NO ART VISIBLE.**

On 2026-03-21, the visual inspection reported all 31 cards had art "PASS" because DOM showed `naturalWidth=1024, complete=true, display=block`. But an opaque base frame layer covered all card art. Every card in the game was artless. The inspection missed it because it trusted DOM attributes.

**RULE: DOM loaded != visually visible. NEVER trust DOM alone for visual checks.**

For EVERY visual element (card art, sprites, icons, backgrounds), the visual inspection worker MUST run this occlusion check:

```javascript
// MANDATORY occlusion check — runs for every image/visual element
function checkOcclusion(element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const topElement = document.elementFromPoint(centerX, centerY);
  const isOccluded = topElement !== element && !element.contains(topElement);

  if (isOccluded) {
    return {
      pass: false,
      occludedBy: topElement?.className || topElement?.tagName,
      severity: 'CRITICAL',
      note: `Element loaded but HIDDEN — occluded by ${topElement?.className}`
    };
  }

  // Also check: does the image have actual content (not just transparent/white)?
  if (element.tagName === 'IMG' && element.naturalWidth > 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(element, rect.width/2, rect.height/2, 1, 1, 0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    const isBlankWhite = pixel[0] > 250 && pixel[1] > 250 && pixel[2] > 250;
    const isTransparent = pixel[3] < 10;
    if (isBlankWhite || isTransparent) {
      return {
        pass: false,
        severity: 'HIGH',
        note: `Image loads but center pixel is ${isTransparent ? 'transparent' : 'blank white'} — art may be missing or placeholder`
      };
    }
  }

  return { pass: true };
}
```

**For screenshots**, ALWAYS use `browser_evaluate(() => window.__terraScreenshot())` — it captures both the Phaser canvas and DOM overlays as a composited base64 PNG. NEVER use `mcp__playwright__browser_take_screenshot` (Phaser RAF causes 30s timeout). The `elementFromPoint()` occlusion check above runs via `browser_evaluate` and catches occlusion as a complementary check.

**This check is NON-NEGOTIABLE. If a visual inspection worker skips it, the inspection is INCOMPLETE and MUST be flagged as such.**

---

## Self-Healing: Detecting Missing Coverage

**After every `/inspect` run, check for blind spots:**

```
1. Scan the test method matrix for this element type
2. If any required method FAILED TO RUN (timeout, error, missing tool):
   - Flag as "INCOMPLETE INSPECTION" in the registry
   - List which methods are missing
   - Do NOT update inspection dates for missing methods
   - Warn the user: "Inspection incomplete — {method} failed. Results may have blind spots."

3. Scan for STRUCTURAL blind spots:
   - Any element type with no unit tests? → Create a task to add them
   - Any card with no headless sim coverage? → Flag for next sim run
   - Any screen never UX-reviewed? → Queue for next /inspect run
   - Any relic never tested by Rogue Brain? → Note in registry

4. Scan for STALENESS:
   - Elements inspected >30 days ago → Mark as "stale" in registry
   - Elements with lastChangedDate > any inspection date → Mark as "outdated"
   - Report stale/outdated counts at end of every run
```

---

## Continuous Improvement Protocol

**This skill and its sub-skills MUST evolve. After every `/inspect` run:**

1. **If a bug was found by only 1 method:** Ask — should another method have caught this? If yes, update that method's skill to cover this case.

2. **If a false positive occurred:** Note it — update the relevant skill's heuristics to avoid it next time.

3. **If a method consistently finds nothing:** Either the code is perfect (unlikely) or the method needs improvement. Investigate.

4. **If a new element type is added to the game:** Update the test method matrix in this skill. Add the element type to testingRecommendations in the registry.

5. **If a new testing method becomes available:** Add it to this skill. Update the matrix. Retroactively run it on all elements.

**The goal: zero blind spots. Every element verified from every angle. Every inspection tracked. Every gap detected and reported.**

---

## Integration with Other Skills

| Skill | Role in /inspect | How It's Called |
|---|---|---|
| `/balance-sim` | Headless combat data | Worker B — 500-1000 runs |
| `/strategy-analysis` | LLM strategic reasoning | Worker F — 20-50 game states |
| `/rogue-brain` | Neural agent patterns | Worker C — 100-200 episodes |
| `/visual-inspect` | Screenshot verification | Worker D — per-element scenarios |
| `/ux-review` | Design quality audit | Worker E — DOM scan + principles |
| `/advanced-balance` | Per-card metrics, tension | Included in Worker B output |
| `/sim-report` | Post-sim analysis | Runs on Worker B output |
| `/issue-triage` | Deduplicate findings | Runs in Phase 2 |

**Sub-skill maintenance rule:** If `/inspect` discovers that a sub-skill is missing a check or producing false results, the orchestrator MUST flag this and — if possible — update the sub-skill in the same session. Testing tools that don't improve are testing tools that rot.

---

## Staleness Thresholds

| Time Since Last Inspection | Status | Action |
|---|---|---|
| 0-7 days | Fresh | No action needed |
| 8-14 days | Aging | Include in next `/inspect stale` run |
| 15-30 days | Stale | Proactively suggest re-inspection |
| 31+ days | Outdated | WARN — flag in every session start |
| Never inspected | UNVERIFIED | CRITICAL — must inspect before ship |

---

## The Ground Truth Contract

1. **No element ships without passing `/inspect`**
2. **No testing method runs alone when `/inspect` could combine them**
3. **No inspection result exists outside the registry**
4. **No blind spot goes undetected — the system checks itself**
5. **No testing gap persists — the system improves itself**

This is not a suggestion. This is how testing works in this project.

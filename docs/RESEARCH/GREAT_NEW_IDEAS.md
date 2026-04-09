# Interactive Quiz Mechanics — Design Exploration

> **Game:** Recall Rogue
> **Status:** Concept — not yet in production
> **Purpose:** Nine novel interactive quiz formats that go beyond multiple-choice, each designed to integrate with the existing Charge/Quick Play/Chain/Mastery combat system.

---

## Design Principles

These mechanics share three core constraints:

1. **Must work within the Charge flow.** Player commits to Charge → interactive quiz appears → result determines multiplier (correct/partial/wrong). Quick Play skips the quiz entirely, as always.
2. **Must support the mastery ladder.** Mastery 0 = forgiving, wide tolerances, simple prompts. Mastery 5 = tight tolerances, complex prompts, maximum multiplier.
3. **Must feel good on mobile AND desktop.** Touch-first with mouse/keyboard acceleration. Every mechanic needs a tap/drag interaction and an equivalent keyboard shortcut path.

**Partial credit is new.** Multiple-choice is binary (correct or wrong). Several of these mechanics produce a continuous accuracy score. The damage pipeline needs a new `partialAccuracy` multiplier (0.0–1.0) that interpolates between Charge Wrong and Charge Correct values:

```
partialDamage = CW_value + (CC_value - CW_value) × partialAccuracy
```

This rewards "close but not perfect" answers — a geography guess 200km off still gets meaningful damage, which feels fair and educational.

---

## 1. Map Pin Drop

**Concept:** "Where is Kyoto?" — a blank or lightly labeled map appears. The player taps where they think the answer is. Damage scales inversely with distance from the correct location.

### How It Plays

The quiz panel shows a zoomable map region (the zoom level itself is a difficulty lever). A pulsing crosshair follows the player's finger/cursor. Tap to confirm. A satisfying "pin drop" animation plays, then a line draws from the player's pin to the correct location with the distance shown.

### Mastery Scaling

| Mastery | Map Zoom | Labels Shown | Accuracy Threshold (full credit) | Partial Credit Floor |
|---------|----------|--------------|----------------------------------|---------------------|
| 0 | Continental (entire Europe visible) | Country borders + names | 500 km | 1500 km |
| 1 | Regional (France + neighbors) | Country borders, no names | 350 km | 1000 km |
| 2 | Regional, tighter crop | Country borders only | 250 km | 750 km |
| 3 | Country-level | Coastlines + rivers only | 150 km | 500 km |
| 4 | Sub-country | Coastlines only | 80 km | 300 km |
| 5 | Tight crop, minimal context | Coastlines + terrain shading | 40 km | 150 km |

### Partial Credit Formula

```
accuracy = 1.0 - clamp((distance - fullCreditRadius) / (partialFloor - fullCreditRadius), 0, 1)
```

A pin drop within `fullCreditRadius` = full Charge Correct. Beyond `partialFloor` = full Charge Wrong. Everything between is interpolated.

### Deck Compatibility

| Deck | Example Questions |
|------|------------------|
| World Countries & Capitals | "Where is Ulaanbaatar?" |
| World Cities | "Pin the location of Istanbul" |
| World War II | "Where did D-Day landings occur?" |
| Ancient Rome | "Where was Carthage?" |
| Solar System & Beyond | Adapted: "Where is Olympus Mons on Mars?" (planet surface maps!) |
| Topography | "Where is the Mariana Trench?" |

### Combat Integration

- **Chain bonus:** Two consecutive correct Map Pin Drops in the same chain theme = "Navigator Chain" — second pin gets +0.3× bonus on top of normal chain multiplier.
- **VFX:** Correct pin drop sends a shockwave ring outward from the pin. Near-miss shows a dashed line to the correct location. Far miss shows a fading arc.
- **Sound:** Satisfying "thunk" on pin placement. Correct = triumphant compass-click. Miss = gentle "womp" with a compass needle spinning.

### Fun Twists

- **Reverse Pin Drop (Mastery 4+):** A pin is already placed on the map. "What city is this?" — converts to multiple-choice with the map as visual context. Harder than it sounds when the pin is in a featureless region.
- **Distance Challenge (Mastery 5):** "How far is Tokyo from London?" — pin both cities, damage scales with how close the measured distance is to the real distance. Two pin drops, double the pressure.
- **Fog of War:** At higher mastery, the map starts blacked out and only reveals a small radius around the player's cursor as they explore. Forces spatial memory, not just pattern matching.

### Technical Notes

- Map tiles: Static pre-rendered WebP images at 5 zoom levels per region (not a live tile server — offline-compatible).
- Coordinate system: Simple lat/lng with Mercator projection distortion accepted (educational accuracy > cartographic perfection).
- Pin placement: Touch with 44px minimum hit area. Desktop: click to place, scroll to zoom, drag to pan.

---

## 2. Timeline Ordering

**Concept:** Four historical events appear shuffled. Drag them into chronological order. Each correctly placed event adds to the chain. Perfectly ordered = 4-chain equivalent in a single Charge.

### How It Plays

Four cards appear in a random horizontal row. Each shows an event name and optionally a small illustration. Below them is a timeline track with four empty slots labeled "Earliest → Latest." Player drags events into slots. A "Confirm" button locks in the answer.

After confirmation, correctly placed events glow green and slide smoothly into position. Misplaced events show their correct position with a red-to-green transition arc.

### Mastery Scaling

| Mastery | Events Count | Date Range | Hint Level |
|---------|-------------|------------|------------|
| 0 | 3 events | Different centuries | Year shown on each card |
| 1 | 4 events | Different decades | Decade shown (1940s, 1960s) |
| 2 | 4 events | Same century | No date hint |
| 3 | 4 events | Same decade | No date hint |
| 4 | 5 events | Same decade | No date hint |
| 5 | 5 events | Same year or adjacent years | No date hint |

### Scoring

```
correctPlacements = count of events in exact correct position
accuracy = correctPlacements / totalEvents
```

- All correct = full Charge Correct + chain bonus
- 3/4 correct = ~0.75× partial credit
- 2/4 correct = ~0.5× partial credit
- 1 or 0 correct = Charge Wrong

**Chain integration (the killer feature):** Each correctly placed event counts as a chain link. A perfect 4-event ordering gives a 4-chain multiplier (2.5×) on a SINGLE card play. This makes Timeline Ordering the highest single-card damage potential in the game — but only with perfect historical knowledge.

### Deck Compatibility

| Deck | Example Sequence |
|------|-----------------|
| US Presidents | "Order these inaugurations: Lincoln, FDR, Jefferson, Obama" |
| World War II | "Order: Pearl Harbor, D-Day, Hiroshima, Fall of Berlin" |
| Ancient Rome | "Order: Founding of Rome, Punic Wars, Caesar's assassination, Fall of Western Empire" |
| Science | "Order these discoveries: Gravity, Penicillin, DNA Structure, Higgs Boson" |
| Art History | "Order: Renaissance, Impressionism, Cubism, Pop Art" |
| Periodic Table | "Order by discovery date: Oxygen, Radium, Plutonium, Oganesson" |

### Combat Integration

- **Chain multiplier:** Perfect order = chain length equal to event count. This stacks with existing Knowledge Chain if the previous Charge was the same chain theme.
- **VFX:** Events slide into position with a satisfying "snap." Perfect order triggers a timeline beam that connects all events with golden light — then the beam fires at the enemy. Partial order shows broken segments.
- **Sound:** Each correct placement gets an ascending chime (C, E, G, C↑ for a perfect 4-sequence). Misplacements get a dull thud.

### Fun Twists

- **Reverse Timeline (Mastery 3+):** "Which event happened BETWEEN these two?" — two events are anchored, player picks which of 3 options falls between them chronologically.
- **Speed Ordering:** Events auto-shuffle every 3 seconds. Player must place them before the next shuffle. Panic-inducing but exhilarating when nailed.
- **Personal Timeline (vocabulary decks):** "Order these words by stroke count" (Japanese kanji) or "Order by syllable count" — adapts the mechanic beyond history.

### Technical Notes

- Drag-and-drop: HTML5 drag with touch polyfill. Snap-to-slot with 60px threshold.
- Desktop shortcut: Number keys (1-4) select event, arrow keys move position, Enter confirms.
- Animation: 300ms spring transition for correct placements, 500ms arc for repositioned events.

---

## 3. Code Output Prediction

**Concept:** Show 3–8 lines of code. "What does this print?" Distractors are the actual outputs from common beginner mistakes (off-by-one, wrong operator precedence, type coercion). The quiz teaches debugging intuition, not just syntax recognition.

### How It Plays

A code block appears in the quiz panel with syntax highlighting (dark theme matching the dungeon aesthetic). Below it, 3–4 output options are shown. The player selects the correct output. Standard multiple-choice UX, but the content is uniquely interactive because the player must mentally execute code.

### Mastery Scaling

| Mastery | Lines of Code | Concepts | Language |
|---------|--------------|----------|----------|
| 0 | 2–3 lines | Variables, basic arithmetic, string concat | Python |
| 1 | 3–4 lines | Conditionals, simple loops | Python |
| 2 | 4–5 lines | Nested loops, list operations | Python or JS |
| 3 | 5–6 lines | Functions, scope, closures | Python or JS |
| 4 | 6–8 lines | Recursion, dictionary operations, type coercion | JS focus |
| 5 | 6–8 lines | Edge cases, operator precedence traps, async gotchas | JS focus |

### Distractor Design (The Secret Sauce)

Distractors aren't random wrong answers — they're the outputs you'd get from specific, common mistakes:

| Code | Correct Output | Distractor 1 (off-by-one) | Distractor 2 (scope error) | Distractor 3 (precedence) |
|------|---------------|---------------------------|---------------------------|--------------------------|
| `for i in range(3): print(i)` | `0 1 2` | `1 2 3` | `0 1 2 3` | `3` |
| `x = 5; print(x + 3 * 2)` | `11` | `16` | `13` | `10` |
| `print("3" + "5")` | `"35"` | `8` | `"3 + 5"` | Error |

Each distractor is tagged with the mistake type it represents. The confusion matrix tracks which mistake types the player makes most frequently and preferentially generates those distractors.

### Deck Compatibility

| Deck | Focus |
|------|-------|
| CS Fundamentals — Python | Variables, loops, functions, data structures |
| CS Fundamentals — JavaScript | Type coercion, scope, async, closures |
| CS Fundamentals — SQL | Query output prediction (SELECT results) |
| Data Structures | "What does this linked list look like after these operations?" |
| Algorithms | "How many comparisons does this sort make on input [3,1,4,1,5]?" |

### Combat Integration

- **VFX:** Code block renders in a terminal-style frame. Correct answer triggers a "compile success" green flash with binary particles. Wrong answer shows a red "RUNTIME ERROR" flash with the correct output highlighted.
- **Sound:** Keyboard clacking buildup while code is displayed. Correct = satisfying "ping" + terminal bell. Wrong = error beep.
- **Relic synergy — "Rubber Duck" relic:** When holding this relic, code questions show one line highlighted in yellow ("the bug is on this line") — narrows the mental execution scope.

### Fun Twists

- **Bug Hunt (Mastery 3+):** The code has a bug. "Which line has the error?" Player taps the buggy line. Mastery increases the subtlety of the bug.
- **Fill-in-the-Blank (Mastery 4+):** A line of code has `???` placeholder. "What goes here to produce output 42?" Multiple-choice with code snippets as options.
- **Multi-language (Mastery 5):** Same algorithm shown in Python AND JavaScript. "Do they produce the same output?" Yes/No with explanation. Tests deep understanding of language differences.

### Technical Notes

- Syntax highlighting: PrismJS subset bundled (Python + JS grammars only), dark theme.
- Code font: JetBrains Mono or Source Code Pro at 13px.
- Mobile: Code block scrolls horizontally if needed. Pinch-to-zoom enabled on the code panel only.

---

## 4. Micro-Composition

**Concept:** A musical prompt plays — an unresolved chord, a melody missing its final note, a rhythm waiting for its downbeat. The player picks from 3–4 audio options that play on selection. The correct one resolves the musical tension. Music theory made visceral through sound, not notation.

### How It Plays

The quiz panel shows a simple waveform visualization of the prompt. A "Play Prompt" button replays it. Below, 3–4 answer buttons each trigger a short audio clip when tapped (before committing). The player listens, compares, and selects. Confirm locks in the answer.

The key UX innovation: **answers are audible before selection.** The player can tap between options, hearing each one in context, before committing. This is active listening, not guessing.

### Mastery Scaling

| Mastery | Task Type | Prompt Length | Options |
|---------|-----------|--------------|---------|
| 0 | "Which note completes this major scale?" | 4 notes ascending | 3 (clear wrong, close wrong, correct) |
| 1 | "Resolve this chord" (V → ?) | Single chord | 3 options |
| 2 | "Complete this 2-bar phrase" | 2 bars | 4 options |
| 3 | "Which chord progression fits under this melody?" | 4-bar melody | 4 options (chord progressions) |
| 4 | "Identify the cadence type" | Full phrase ending | 4 cadence types |
| 5 | "Which voicing creates the smoothest resolution?" | Complex chord | 4 closely related voicings |

### Deck Compatibility

| Deck | Focus |
|------|-------|
| Music Theory — Fundamentals | Intervals, scales, triads, basic cadences |
| Music Theory — Harmony | Chord progressions, voice leading, modulation |
| Music Theory — Rhythm | Time signatures, syncopation, polyrhythm identification |
| Classical Music Appreciation | "Which instrument enters next?" with orchestral excerpts |
| Ear Training | Pure interval and chord quality identification |

### Combat Integration

- **VFX:** Correct selection triggers a resonant chord burst that ripples outward in concentric sound waves. Wrong answer plays a dissonant "wah-wah" that deflates.
- **Sound:** The combat engine ducks background music while this quiz is active. The player's answer becomes part of the combat soundscape for 2 seconds — correct answers feel like a power chord, wrong ones feel like a whimper.
- **Chain bonus — "Harmonic Chain":** Two consecutive correct Micro-Composition answers in the same chain create a harmonic cadence — both audio clips play in sequence as the damage resolves, creating a mini musical moment.

### Fun Twists

- **Call and Response (Mastery 3+):** The prompt is a 2-bar phrase. "Play the response phrase." Options are melodic responses that either match the style or clash. Tests musical intuition beyond theory.
- **Genre Match:** "Which genre does this chord progression belong to?" — hear a progression, match it to jazz / classical / blues / pop. Tests cultural musical literacy.
- **Tuning Test (Mastery 5):** Two notes play. "Are they in tune?" — microtonal accuracy detection. The options are "In tune," "Flat by ~20 cents," "Sharp by ~20 cents." Brutal at mastery 5.

### Technical Notes

- Audio: Pre-rendered OGG clips (48kHz, mono, 0.5–4 seconds each). ~500 clips per music theory deck. NOT synthesized at runtime — studio-quality samples for accurate pitch.
- Playback: Web Audio API for gapless switching between option previews. Each option tap crossfades (50ms) from the previous clip.
- Mobile: Audio clips preloaded on quiz panel open to prevent latency on first tap.
- Tone.js available for any synthesized elements, but primary content is pre-rendered for quality.

---

## 5. Memory Grid Flash

**Concept:** A grid of symbols/kanji/elements flashes for a few seconds, then blanks. "Where was 金?" Player taps the correct grid position. Pure working memory training fused with knowledge recall.

### How It Plays

The quiz panel shows a grid populated with items from the deck's fact pool (kanji, element symbols, country flags, etc.). The grid is visible for a limited time, then all cells blank to identical placeholder tiles. A target item is shown: "Find: 金." Player taps where they remember it. Correct position = Charge Correct. Adjacent cell = partial credit. Far off = Charge Wrong.

### Mastery Scaling

| Mastery | Grid Size | Flash Duration | Target Count | Visual Hint |
|---------|-----------|----------------|--------------|-------------|
| 0 | 3×3 (9 cells) | 4 seconds | 1 target | Cell briefly flashes on wrong tap (retry allowed) |
| 1 | 3×3 | 3 seconds | 1 target | No retry |
| 2 | 4×4 (16 cells) | 3 seconds | 1 target | — |
| 3 | 4×4 | 2.5 seconds | 1 target | — |
| 4 | 4×4 | 2 seconds | 2 targets (sequential) | — |
| 5 | 5×5 (25 cells) | 2 seconds | 2 targets (sequential) | — |

### Partial Credit

- Correct cell = 1.0 accuracy
- Adjacent cell (including diagonal) = 0.5 accuracy
- Two cells away = 0.25 accuracy
- Further = 0.0 (Charge Wrong)

### Deck Compatibility

| Deck | Grid Content |
|------|-------------|
| Japanese N5 Vocabulary | Kanji characters — "Where was 食?" |
| Periodic Table | Element symbols — "Where was Fe?" |
| World Countries & Capitals | Country flags — "Where was 🇯🇵?" |
| Kana | Hiragana/katakana mix — "Where was ソ?" (especially evil with ン nearby) |
| Art History | Thumbnail paintings — "Where was Starry Night?" |
| Human Anatomy | Organ icons — "Where was the liver?" |

### Combat Integration

- **VFX:** During the flash phase, grid tiles glow with chain-colored energy. On correct tap, the cell explodes upward into a particle stream that hits the enemy. On miss, the correct cell reveals itself with a gentle pulse.
- **Sound:** Ticking clock during flash phase. Memory-clear chime when grid blanks. Correct tap = crystal bell. Wrong = soft buzz.
- **Brain Fog interaction:** Memory Grid Flash questions are harder during Brain Fog state (7–10) — flash duration reduced by 0.5 seconds. Flow State (0–2) adds +0.5 seconds. This makes fog feel thematically appropriate.

### Fun Twists

- **Pattern Memory (Mastery 4+):** Instead of finding a specific item, the grid flashes with 4–5 cells highlighted in a pattern. Grid blanks. "Recreate the pattern." Player taps cells to reproduce it. Tests spatial pattern memory.
- **Moving Grid (Mastery 5):** After the flash, the grid rotates 90°. Player must mentally rotate their memory to tap the correct position. Diabolical.
- **Dual Grid:** Two grids flash simultaneously. "Which grid contained 水?" Tests divided attention. Boss-fight exclusive.

### Technical Notes

- Grid rendering: CSS Grid with equal-sized cells. Items rendered as text (kanji/symbols) or small images (flags/icons).
- Flash timing: requestAnimationFrame-based with fade-out transition (300ms linear fade to blank).
- Touch: Each cell is a 44px minimum tap target. Grid scales to fit quiz panel width.

---

## 6. Logic Gate Tracer

**Concept:** A small circuit of AND/OR/NOT gates with given inputs. "What's the output?" The visual IS the question — no text explanation needed. Mastery adds gates, introduces XOR/NAND/NOR, and increases circuit depth.

### How It Plays

The quiz panel shows a circuit diagram rendered as clean SVG. Input values (0 or 1) are shown on the left. Gates are labeled with their type. Wires connect them. The output wire has a `?` where the player must determine the value. Multiple-choice: the options are possible output values (for simple circuits: just 0 or 1; for multi-output circuits: combinations like "1, 0, 1").

At higher mastery, the player can tap individual wires to "trace" intermediate values as a problem-solving aid (the traced value appears briefly, then fades — no permanent reveals).

### Mastery Scaling

| Mastery | Gates | Gate Types | Depth | Outputs |
|---------|-------|-----------|-------|---------|
| 0 | 1 gate | AND, OR | 1 layer | 1 |
| 1 | 2 gates | AND, OR, NOT | 2 layers | 1 |
| 2 | 3 gates | AND, OR, NOT, XOR | 2 layers | 1 |
| 3 | 4 gates | All + NAND, NOR | 3 layers | 1 |
| 4 | 5–6 gates | All types | 3 layers | 2 (multi-output) |
| 5 | 6–8 gates | All types + feedback hint | 3–4 layers | 2 |

### Deck Compatibility

| Deck | Adaptation |
|------|-----------|
| CS Fundamentals | Pure logic gates — AND, OR, NOT, XOR, NAND, NOR |
| Digital Electronics | Same gates with voltage labels (HIGH/LOW instead of 1/0) |
| Philosophy (Logic) | Propositional logic: P ∧ Q, P ∨ ¬R → visual gate equivalent |
| Biology (Genetics) | Punnett-square-style: dominant/recessive allele "gates" |
| Math (Boolean Algebra) | Algebraic expressions visualized as circuits |

### Combat Integration

- **VFX:** Wires light up in sequence as the "signal" flows through the circuit (left to right, 100ms per gate layer). Correct output triggers a spark at the output wire that arcs to the enemy. Wrong output shows a short-circuit spark at the error point.
- **Sound:** Electrical hum during display. Signal propagation gets ascending electronic beeps per layer. Correct = power-up surge sound. Wrong = fizzle/short-circuit crackle.
- **Wire tracing (interactive aid):** Player can tap any intermediate wire to see its value flash for 1 second. Each trace costs 0.1× from the final multiplier (max 3 traces = 0.7× cap even if correct). Rewards mental computation over brute-force tracing.

### Fun Twists

- **Reverse Engineering (Mastery 3+):** Inputs and output are given. One gate is blank. "What gate type goes here?" Options: AND, OR, XOR, NAND. Tests gate behavior understanding bidirectionally.
- **Broken Wire (Mastery 4+):** One wire is marked as "cut" (always-0). "What's the output now?" Tests understanding of fault propagation through logic circuits.
- **Truth Table Completion (Mastery 5):** The circuit is shown but inputs aren't fixed. "Complete this truth table row." A partial truth table appears with one cell missing. Combines circuit tracing with truth table reasoning.

### Technical Notes

- Circuit rendering: SVG generated from a simple gate-description DSL. Gates are positioned automatically with a left-to-right topological layout.
- Wire tracing: SVG wire elements have click handlers. Traced value appears as a floating label with CSS fade animation (1s).
- Desktop shortcut: Tab cycles through wires for tracing. Number keys select output answers.
- Procedural generation: Circuits generated from templates with random input values per charge (same template, different inputs = different answer each time). Deterministic via run seed.

---

## 7. Estimation Arena

**Concept:** No multiple choice. "How tall is the Eiffel Tower?" Player drags a slider. Scoring is continuous — within 5% of the real answer = full Charge Correct, within 15% = partial credit, beyond = fizzle. Builds genuine quantitative intuition about the real world.

### How It Plays

The quiz panel shows the question at top and a horizontal slider below. The slider range is context-appropriate (e.g., 100m–500m for building heights, 1M–2B for populations). The current value displays prominently above the slider thumb as the player drags. A "Lock In" button confirms.

After confirmation, the correct answer is revealed with a satisfying animation: the slider thumb slides to the correct position while the player's guess remains as a ghost marker. The distance between them determines the score.

### Mastery Scaling

| Mastery | Slider Range Width | Full Credit Tolerance | Partial Credit Floor | Tick Marks |
|---------|-------------------|----------------------|---------------------|------------|
| 0 | 5× correct answer | ±20% | ±50% | Major divisions shown |
| 1 | 4× correct answer | ±15% | ±40% | Major divisions shown |
| 2 | 3× correct answer | ±12% | ±35% | Minor ticks only |
| 3 | 3× correct answer | ±10% | ±30% | No ticks |
| 4 | 2.5× correct answer | ±7% | ±25% | No ticks |
| 5 | 2× correct answer | ±5% | ±15% | No ticks, no units on slider |

### Partial Credit Formula

```
error = abs(guess - correct) / correct
if error <= fullCreditTolerance: accuracy = 1.0
else if error >= partialFloor: accuracy = 0.0
else: accuracy = 1.0 - (error - fullCreditTolerance) / (partialFloor - fullCreditTolerance)
```

### Deck Compatibility

| Deck | Example Questions | Slider Range |
|------|------------------|-------------|
| Geography | "Population of Tokyo metro area?" | 1M – 50M |
| Geography | "Distance from London to Sydney?" | 5,000 – 25,000 km |
| Space | "Diameter of Jupiter?" | 10,000 – 500,000 km |
| Science | "Boiling point of iron (°C)?" | 500 – 5,000 |
| History | "Year the printing press was invented?" | 1000 – 1800 |
| Periodic Table | "Atomic mass of gold?" | 50 – 250 amu |
| Human Anatomy | "How many bones in the human body?" | 100 – 400 |
| Topography | "Depth of the Mariana Trench?" | 2,000 – 15,000 m |
| Food & Drink | "Calories in a Big Mac?" | 200 – 800 |
| Nature | "Top speed of a cheetah (km/h)?" | 50 – 200 |

### Combat Integration

- **VFX:** The slider is styled as a glowing energy bar. As the player drags, the bar fills with golden energy. On lock-in, if accurate, the energy fires as a concentrated beam. If close, a wider, weaker beam. If far off, the energy dissipates in a puff.
- **Sound:** Slider drag produces a rising/falling tone (theremin-like). Lock-in = dramatic pause. Reveal = whoosh to correct position. Close hit = satisfying "ding." Far miss = deflating whistle.
- **"Bullseye" bonus:** If the player's guess is within 1% of the correct answer (near-impossible at high mastery), trigger a special "BULLSEYE!" animation with 2× bonus on top of normal Charge Correct. Exceedingly rare but legendary when it happens.

### Fun Twists

- **Dual Slider (Mastery 3+):** Two related quantities on the same question. "Population AND area of Brazil?" Two sliders, both must be within tolerance. Average accuracy of both determines the multiplier. Tests integrated knowledge.
- **Closest Wins (boss quiz phase):** During boss quiz phases, estimation questions with no partial credit — just "Which of these 4 values is closest?" Faster to answer, higher pressure.
- **Order of Magnitude (Mastery 0, introductory):** For beginners, simplify to "Is it closer to 100, 1000, or 10,000?" Three big buttons instead of a slider. Teaches magnitude before precision.
- **Moving Target (Mastery 5):** The correct answer slowly drifts on the slider (hidden). The player must lock in at the right moment. Tests reaction + knowledge. (This one might be too mean — flag for playtesting.)

### Technical Notes

- Slider: Custom HTML range input with touch-optimized thumb (56px wide). Logarithmic scale for large ranges (populations, distances). Linear for small ranges (percentages, temperatures).
- Value display: Large, clear number above thumb. Formatted with locale-appropriate thousands separators and unit suffix.
- Haptics: Light vibration pulse at major tick marks (mobile). Desktop: no haptics (obviously).
- Desktop shortcut: Left/Right arrows for coarse adjustment, Shift+arrows for fine adjustment, Enter to confirm.

---

## 8. Scale Comparison

**Concept:** "How many Earths fit inside Jupiter?" — two objects appear at misleading visual sizes. Player drags a slider to set the correct ratio. Builds genuine quantitative intuition about orders of magnitude and relative scale.

### How It Plays

The quiz panel shows two objects side by side — one on the left, one on the right. Their visual sizes are deliberately misleading (a virus might be drawn the same size as a galaxy). Between them, a ratio slider labeled "How many [left] fit inside [right]?" ranges from the minimum to maximum plausible ratio.

The player drags the slider. As they drag, a small visualization updates in real-time: tiny copies of the left object stack inside the outline of the right object, giving visual feedback on the ratio they've selected.

After lock-in, the correct ratio is revealed with a zoom animation that shows the actual scale difference.

### Mastery Scaling

| Mastery | Scale Domain | Ratio Range | Tolerance (full credit) | Visualization Aid |
|---------|-------------|-------------|------------------------|-------------------|
| 0 | Familiar objects (car vs bus) | 1–100× | ±30% | Real-time stacking shown |
| 1 | Earth-scale (lake vs ocean) | 1–1,000× | ±25% | Real-time stacking shown |
| 2 | Solar system scale | 1–10,000× | ±20% | Stacking shown, slower update |
| 3 | Cosmic + microscopic | 1–1,000,000× | ±15% | No stacking aid |
| 4 | Cross-domain (atom vs mountain) | 1–10^9 | ±12% (log scale) | No aid |
| 5 | Extreme ratios (quark vs observable universe) | 1–10^30 | ±10% (log scale) | No aid, log slider |

### Partial Credit

Same formula as Estimation Arena, but applied to the logarithm of the ratio for large-scale comparisons:

```
// For ratios > 1000, use log-space comparison
logError = abs(log10(guess) - log10(correct)) / log10(correct)
```

### Deck Compatibility

| Deck | Example Comparisons |
|------|-------------------|
| Space | "How many Earths fit in Jupiter?" / "How many Moons fit in Earth?" |
| Human Anatomy | "How many red blood cells fit on a pinhead?" |
| Geography | "How many Luxembourgs fit in Brazil?" |
| Science | "How many atoms wide is a human hair?" |
| Nature | "How many ants would it take to outweigh an elephant?" |
| History | "How many Roman soldiers in a legion vs. a modern army battalion?" |
| Food & Drink | "How many cups of espresso in an Olympic swimming pool?" (volume ratio) |

### Combat Integration

- **VFX:** The two objects are rendered in the Phaser canvas with a dramatic scale-shift animation on reveal. Getting it right triggers a "reality warp" effect — the smaller object shrinks to its true relative size while the larger one fills the screen, then the correctly-scaled comparison fires as an energy beam.
- **Sound:** Cosmic "whoooosh" as the scale reveal plays. Dramatic bass drop for large ratios. Tinkling chime for small ratios.
- **"Sense of Scale" buff:** Getting 3 Scale Comparison questions correct in a run grants a persistent "Sense of Scale" buff (+5% to all Estimation Arena accuracy thresholds for the rest of the run). Cross-mechanic synergy.

### Fun Twists

- **Triple Scale (Mastery 4+):** Three objects. "Order them by size AND estimate the ratios between adjacent pairs." Two sliders, one ordering task. Maximum knowledge density per question.
- **Time Scale:** "How many human lifetimes fit in the age of the universe?" Extends the mechanic to temporal comparison.
- **Weight vs. Size:** "A neutron star is THIS big [shows small sphere]. How does its mass compare to the Sun?" Tests understanding that size ≠ mass. The misleading visual is the entire point.
- **Reverse Scale:** "Jupiter is 1,321 times Earth's volume. If Earth were the size of a grape, how big would Jupiter be?" Options are physical objects (basketball, car, house, city block). Grounds abstract numbers in physical intuition.

### Technical Notes

- Slider: Logarithmic scale for ratios > 100. Linear for small ratios. Custom thumb with ratio value displayed.
- Stacking visualization: CSS/SVG — small copies of left object drawn inside right object outline. Updates at 30fps during drag.
- Object illustrations: Pre-rendered SVG icons per deck (planets, organs, animals, etc.). ~200 icons total across all decks.
- Desktop shortcut: Same as Estimation Arena — arrow keys for drag, Enter to confirm.

---

## 9. Stroke Order Drawing

**Concept:** A kanji or character appears. Player traces each stroke in the correct order on a touch canvas. Each correct stroke lights up. Wrong order = immediate feedback. Accuracy + order determine the multiplier. The most natural possible quiz for CJK language learning.

### How It Plays

The quiz panel shows a large character outline (gray, at 30% opacity) on a drawing canvas. Below, a small reference showing the complete character. The player traces strokes with their finger or mouse. After each stroke:

- **Correct stroke, correct order:** The stroke "inks in" permanently in black with a satisfying brush-stroke animation. A small green checkmark appears at the stroke's starting point.
- **Correct stroke, wrong order:** The stroke flashes orange, then fades. A hint arrow appears showing where the next correct stroke should start.
- **Unrecognizable stroke:** The stroke fades to nothing. No penalty beyond lost time.

After all strokes are completed (or the timer expires with a partial attempt), the result is scored.

### Mastery Scaling

| Mastery | Character Complexity | Guide Level | Stroke Tolerance | Order Strictness |
|---------|---------------------|-------------|-----------------|-----------------|
| 0 | Simple (1–4 strokes): 一, 二, 人 | Full ghost strokes shown (trace-over) | Very forgiving (wide path) | Order hints shown in advance |
| 1 | Simple-medium (3–6 strokes): 大, 目, 山 | Ghost strokes shown | Forgiving | Hints on wrong order only |
| 2 | Medium (5–8 strokes): 食, 学, 花 | Starting dots only (stroke start positions shown) | Medium | No hints |
| 3 | Medium-complex (7–10 strokes): 読, 語, 曜 | No guides | Medium-tight | No hints |
| 4 | Complex (10–14 strokes): 練, 験, 橋 | No guides | Tight | Strict (one wrong order = partial) |
| 5 | Very complex (14+ strokes): 議, 競, 鑑 | No guides, no reference shown | Tight | Strict + no reference character |

### Scoring

```
strokesCorrectOrder = count of strokes drawn in correct sequence without order errors
totalStrokes = total strokes in the character
orderAccuracy = strokesCorrectOrder / totalStrokes

// Path accuracy averaged across all correctly-ordered strokes
pathAccuracy = average(perStrokePathSimilarity) // 0.0–1.0 via simplified DTW

finalAccuracy = orderAccuracy * 0.7 + pathAccuracy * 0.3  // Order matters more than beauty
```

### Deck Compatibility

| Deck | Content |
|------|---------|
| Japanese Kanji (primary use case) | All 2,230 JLPT kanji with official stroke order data |
| Japanese Kana | Hiragana and katakana (416 characters) — perfect for beginners |
| Chinese Hanzi | HSK characters (same stroke order system as kanji) |
| Korean Hangul | Jamo stroke order (simpler but still sequential) |
| Mathematical Notation | Greek letters (α, β, Σ, ∫) — correct writing form |
| Chemistry | Structural formula drawing (benzene ring, etc.) — stretch goal |

### Combat Integration

- **VFX:** Each correct stroke sends a calligraphic ink splash in the chain color. Completing the full character triggers all strokes to glow simultaneously, then the character lifts off the canvas and strikes the enemy like a thrown seal/stamp. The impact leaves an ink-splatter mark.
- **Sound:** Brush-on-paper sound for each stroke. Ascending pitch for consecutive correct strokes (building tension). Full completion = resonant temple bell. Partial completion = softer chime proportional to accuracy.
- **Chain bonus — "Calligrapher's Chain":** When two consecutive Stroke Order charges in the same chain are both >0.9 accuracy, the second gets a +0.2× bonus. Rewards consistent precision.

### Fun Twists

- **Speed Calligraphy (Boss Quiz Phase):** During boss quiz phases, a sequence of 3 simple characters must be drawn in rapid succession (3-second timer each). Tests practiced muscle memory, not careful tracing.
- **Missing Stroke (Mastery 3+):** The character is drawn with one stroke missing. "Draw the missing stroke." Tests knowledge of which stroke goes where without drawing the whole thing.
- **Mirror Writing (Mastery 5):** The character must be drawn mirrored (horizontally flipped). Tests deep internalization of stroke patterns. Extremely difficult — this is the mastery-5 flex question.
- **Radical Assembly:** Show 2–3 radicals. "Combine these into the correct kanji." Player drags radicals into position and traces connecting strokes. Tests compositional understanding of kanji structure.

### Technical Notes

- Drawing canvas: HTML5 Canvas 2D with pointer events (unified touch + mouse). Line smoothing via Catmull-Rom spline interpolation.
- Stroke recognition: Simplified Dynamic Time Warping (DTW) comparing player's stroke path against reference path. Each reference stroke is stored as a sequence of (x, y, timestamp) waypoints from official stroke order databases.
- Stroke order data: `kanjivg` open-source dataset (Creative Commons) provides SVG paths with stroke order for all common kanji. Converted to waypoint sequences at build time.
- Reference character: Rendered from the same SVG data, displayed at 40% size in the corner.
- Desktop: Mouse drawing with click-and-drag. Pressure sensitivity supported (via Pointer Events API) for line thickness variation — purely cosmetic, doesn't affect scoring.
- Performance: Canvas redraws only on input events, not every frame. Stroke comparison runs on submit, not per-frame.

---

## Cross-Mechanic Synergies

These mechanics don't exist in isolation. Here's how they interact:

| Combination | Synergy |
|-------------|---------|
| Map Pin Drop → Timeline Ordering | Geography + History deck blend: "Pin where the Battle of Hastings occurred, then order 4 events from that era" |
| Stroke Order → Memory Grid Flash | Japanese deck: draw the kanji, then find it in a grid. Sequential charges test production AND recognition. |
| Estimation Arena → Scale Comparison | Space deck: estimate Jupiter's diameter, then compare it to Earth. Second question is informed by the first. |
| Code Output → Logic Gate Tracer | CS deck: trace a logic circuit, then predict the code equivalent's output. Both test the same skill from different angles. |
| Micro-Composition → Memory Grid Flash | Music deck: hear 4 chords, grid blanks, find where the V chord was in the grid. Tests auditory + spatial memory. |

---

## Implementation Priority

| Priority | Mechanic | Reason |
|----------|----------|--------|
| **P0 — Build First** | Stroke Order Drawing | Biggest impact for your existing Japanese user base. Most differentiated from any competitor. |
| **P0 — Build First** | Map Pin Drop | Geography is the broadest casual audience. Partial credit slider is the simplest new UX to build. |
| **P1 — Build Second** | Estimation Arena | Works across the most decks. Slider UX is simple. Continuous scoring is the biggest system innovation. |
| **P1 — Build Second** | Timeline Ordering | Chain integration is the most natural of any mechanic. Drag-and-drop UX is well-understood. |
| **P2 — Build Third** | Memory Grid Flash | Universal deck compatibility. Simple to implement (CSS Grid + timer). Brain Fog interaction is elegant. |
| **P2 — Build Third** | Scale Comparison | Shares slider UX with Estimation Arena (reuse code). Fewer decks but high "wow factor." |
| **P3 — Polish Phase** | Code Output Prediction | Narrower audience (CS students). Standard MCQ UX with special content. Easier to add late. |
| **P3 — Polish Phase** | Logic Gate Tracer | Same audience as Code Output. SVG generation pipeline needed. |
| **P3 — Polish Phase** | Micro-Composition | Audio asset pipeline is the heaviest lift. Needs studio-quality samples. Save for a dedicated music update. |

---

## Open Questions

1. **Partial credit + chain interaction:** If a player gets 0.6 accuracy on a Map Pin Drop, does it continue or break the chain? Proposal: accuracy ≥ 0.5 continues the chain; below 0.5 breaks it. The chain multiplier still applies at full value (chain rewards participation) but the card damage uses the partial accuracy interpolation.

2. **Mixed quiz types in a single deck:** Should a Geography deck mix Map Pin Drop questions with standard MCQ questions? Proposal: yes, but bias toward the interactive type at higher mastery. Mastery 0–1 is mostly MCQ to teach the facts; mastery 3–5 shifts to interactive formats that test deeper understanding.

3. **Relic interactions with new mechanics:** Should existing relics (Quicksilver Quill, Adrenaline Shard) apply to interactive quizzes? Proposal: speed relics apply to total quiz completion time, same as MCQ. A fast Stroke Order completion in under 2 seconds still triggers Quicksilver Quill.

4. **Accessibility for drawing mechanics:** Stroke Order Drawing requires fine motor control. Alternative: at mastery 0–1, offer a "tap-to-draw" mode where the player taps strokes in order (they auto-draw) rather than tracing. Tests order knowledge without motor skill. Full tracing at mastery 2+.
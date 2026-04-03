---
name: narration
description: |
  Design, author, implement, and iterate on the Woven Narrative Architecture — the procedural run narrative system with 4 concurrent threads (Descent, Echo Chamber, Seeker, Inhabitants). Use for authoring archetypes/lenses/echo templates, implementing the narrative engine, testing narrative output, and validating the gravity scoring system. PROACTIVELY SUGGEST when adding new decks, enemies, relics, room types, or mystery events — all of these feed narrative content.
user_invocable: true
---

# Narration — Woven Narrative Architecture

## FIRST: Read the Design Spec

**MANDATORY before any narrative work:**
```
Read docs/mechanics/narrative.md
```

This is the canonical design spec. All content, implementation, and iteration MUST align with it. If you discover a conflict between this skill and the doc, **the doc wins** — update this skill.

---

## System Overview

The narrative system delivers dark RPG storytelling through 4 concurrent threads woven together after each room:

| Thread | What It Does | Data Files |
|---|---|---|
| **Descent** | Structural arc (12 archetypes x 15 domain lenses) | `data/narratives/archetypes/`, `data/narratives/lenses/` |
| **Echo Chamber** | References actual facts player answered | `data/narratives/echoes/` |
| **Seeker** | Reacts to player state (HP, streak, relics) | `data/narratives/seeker/` |
| **Inhabitants** | NPC dialogue (Merchant, Keeper, Oracle, Guardian) | `data/narratives/inhabitants/` |

**Engine source:** `src/services/narrativeEngine.ts`, `src/services/narrativeTypes.ts`, `src/services/narrativeGravity.ts`, `src/services/narrativeLoader.ts`

---

## Build Pipeline

YAML content files live in `data/narratives/`. A build script converts them to JSON for runtime:

```bash
npm run narratives:build    # Convert YAML -> JSON in public/data/narratives/
```

This runs automatically as part of `npm run dev` and `npm run build`. The runtime loader (`narrativeLoader.ts`) fetches JSON via the same `fetch('/data/...')` pattern used by `curatedDeckStore.ts`.

Key files:
- `scripts/build-narratives.mjs` — YAML->JSON converter with camelCase key normalization
- `src/services/narrativeLoader.ts` — Runtime loader with caching and `preloadNarrativeData()`
- `src/services/narrativeTypes.ts` — All TypeScript interfaces
- `src/services/narrativeGravity.ts` — Answer classification + gravity scoring (74 unit tests)

---

## Tone — ABSOLUTE RULE

**Dark, serious, literary RPG.** This is a deep ancient knowledge dungeon. The narrator is an omniscient entity (The Creature Below) observing the player.

- NEVER whimsical, cute, or meta-humorous
- NEVER break the fourth wall ("you got that question right!")
- NEVER use modern slang, emoji-adjacent language, or game jargon
- YES: foreboding, atmospheric, sometimes beautiful, occasionally terrifying
- YES: short declarative sentences, em dashes, sentence fragments
- YES: references to stone, dust, ink, shadow, fire, bone, silence

**Good:** "The sarcophagus held more than expected. Chronicles unearthed here reshape what the surface world believes."
**Bad:** "Nice job on that history question! The dungeon is impressed!"

---

## Encountered Facts Only — ABSOLUTE RULE

The narrative system NEVER references specific facts, answers, or knowledge the player hasn't been quizzed on during the current run. Echo templates, Oracle callbacks, chain arrows, and ALL fact-reactive content draw EXCLUSIVELY from `memorableFacts[]`, which is populated only after the player encounters facts in combat.

If it wasn't a quiz question this run, it doesn't exist for the narrative.

---

## Task Types

### 1. Author New Content

When adding narrative content (archetypes, lenses, echo templates, NPC dialogue, ambient lines):

1. Read `docs/mechanics/narrative.md` — understand the data structures
2. Read existing YAML files in `data/narratives/` for tone/format consistency
3. Author new content following the YAML schemas below
4. Validate: no duplicate template IDs, no tone violations, gravity scores correct
5. Update `docs/mechanics/narrative.md` content budget table if counts change

**YAML Schemas:**

#### Archetype (`data/narratives/archetypes/{id}.yaml`)
```yaml
id: lost_archive
name: The Lost Archive
scope: universal  # universal | knowledge | vocab | [specific deck IDs]
beats:
  - trigger: run_start
    text: "They said the {knowledge_noun} was lost forever. You found a single page — a {chain_0_theme} fragment."
  - trigger: first_boss_kill
    text: "The fragment led deeper. {boss_name} guarded more than you expected."
  # ... 5-6 beats total
branches:
  - condition: hp_below_30
    trigger: any_room_enter
    text: "Knowledge bleeds from you. Facts slipping as fast as you learn them."
    once: true  # Only show once per run
```

#### Domain Lens (`data/narratives/lenses/{id}.yaml`)
```yaml
id: history_ancient
deck_categories:
  - history_ancient
  - history_classical
fields:
  setting_noun: "the buried necropolis"
  knowledge_noun: "chronicle"
  knowledge_plural: "chronicles"
  discovery_verb: "unearthed"
  container_noun: "sarcophagus"
  guardian_noun: "shade"
  danger_noun: "curse"
  atmosphere: "dust and silence"
  material: "stone and bronze"
```

#### Echo Templates (`data/narratives/echoes/{type}.yaml`)
```yaml
type: person
templates:
  - id: person_reverberates
    text: "{echoText}. The name reverberates. Someone — or something — down here remembers them."
    min_gravity: high
  - id: person_carries
    text: "You carry {echoText}'s legacy now. The dungeon takes note."
    min_gravity: medium
```

**Note:** Templates use `{echoText}` not `{answer}`. For knowledge decks, `echoText` = `correctAnswer`. For vocab decks, `echoText` = the foreign word extracted from `quizQuestion` pattern `What does "{word}" mean?`. This ensures Japanese/Spanish/etc. echoes use the foreign word, not the English translation.

```yaml
# Context echo — uses question + answer for thin echoText
type: context
templates:
  - id: context_question_lingers
    text: "The question lingers: {quizQuestion} The answer — {echoText} — carved itself into the wall before you could speak."
    min_gravity: medium
    condition: echoText_length_lt_12
```

#### Inhabitant (`data/narratives/inhabitants/{npc}.yaml`)
```yaml
npc: merchant
personality: "ancient, mercantile, slightly predatory"
greeting:
  1: "Ah. A new seeker. Everything here has a price. Some prices are visible."
  2: "You return. The desperate always do."
  3: "Three visits. You are either wealthy in knowledge or bankrupt in options."
  default: "I have nothing left to sell you that you can afford. But let us pretend."
state_reactive:
  hp_low: "You look like the last one. They did not make it past the next floor."
  hp_full: "Untouched? Impressive. Or perhaps the dungeon simply hasn't tried yet."
on_purchase:
  card: "That one wanted to be found. Cards choose their wielders, down here."
  relic: "It will serve you. For now. Relics have their own loyalties."
farewell:
  default: "The dungeon always has more to sell. Whether you can afford it is another matter."
```

#### Seeker Lines (`data/narratives/seeker/{category}.yaml`)
```yaml
category: hp_reactive
lines:
  - id: hp_high_confidence
    condition: hp_above_80
    text: "Untouched. The dungeon has not yet decided what you are worth."
  - id: hp_low_bleeding
    condition: hp_below_30
    text: "Blood on the pages. Every answer costs more than the last."
```

#### Relic Callbacks (`data/narratives/seeker/relic_callbacks.yaml`)
```yaml
callbacks:
  - relic_id: phoenix_feather
    condition: hp_below_30
    text: "The Phoenix Feather warms against your chest. Not yet, it whispers. Not yet."
  - relic_id: lucky_coin
    condition: shop_visit
    text: "The Lucky Coin vibrates in your pocket. It knows this merchant."
```

#### Ambient Lines (`data/narratives/ambient/{lens_id}.yaml`)
```yaml
lens_id: history_ancient
lines:
  - id: hist_anc_dust
    text: "Names carved into the walls. Some you recognize. Some have been scratched out."
  - id: hist_anc_war
    text: "A war was fought here once. Not with swords."
```

### 2. Implement Engine Components

When building `narrativeEngine.ts` and related services:

1. Read `docs/mechanics/narrative.md` sections: Weaving Engine, Run Narrative State, Integration Points
2. Read existing integration points:
   - `src/services/chainDistribution.ts` — TopicGroup labels, chain types
   - `src/services/turnManager.ts` — encounter results, streaks
   - `src/services/runManager.ts` — RunState, HP, floor, relics
   - `src/services/floorManager.ts` — room type triggers
   - `src/services/gameFlowController.ts` — room transition hooks
3. Implement in this order:
   a. `narrativeTypes.ts` — interfaces first
   b. `narrativeGravity.ts` — answer classification + gravity scoring
   c. `narrativeLoader.ts` — YAML loading/validation
   d. `narrativeEngine.ts` — core weaving algorithm
4. Wire into `gameFlowController.ts` room transition hooks
5. Run `npm run typecheck && npm run build`
6. Update `docs/mechanics/narrative.md` with actual file paths and implementation notes

### 3. Test Narrative Output

To verify the narrative system produces good output:

1. **Unit tests** — test gravity scoring, answer type classification, template slot-filling, dedup logic
2. **Dry-run mode** — the engine should support a `dryRun(runState)` function that simulates a full run's worth of narrative selections and outputs them as text
3. **Manual review** — read through generated lines checking for:
   - Tone violations (too casual, too meta)
   - Silly answer echoes that slipped through gravity filter
   - Repetition within a simulated run
   - Thread starvation (one thread dominating)
   - NPC dialogue that doesn't make sense for the visit count

### 4. Add Narrative Support for New Game Elements

When new decks, relics, enemies, or room types are added to the game:

**New curated deck:**
1. Determine which domain lens applies (or create a new one)
2. Author 8-10 ambient lines for the deck's domain
3. If the deck has subDecks with meaningful labels → it's Tier 3 narrative-ready (no extra work)
4. If vocab/grammar deck → ambient lines are the primary narrative content

**New relic:**
1. Check if the relic has narratively interesting flavor (not just "+2 damage")
2. If yes, add 1-2 relic callback lines to `data/narratives/seeker/relic_callbacks.yaml`
3. Match the relic's theme: combat relics get combat conditions, knowledge relics get mastery conditions

**New mystery event:**
1. Check if Oracle dialogue should reference the new event type
2. Add event-specific Oracle foreshadowing if appropriate

**New enemy/boss:**
1. Guardian (boss) dialogue is generic — no per-boss authoring needed
2. If the boss has a strong theme, consider adding a boss-specific post-battle line

---

## Gravity Scoring Reference

The gravity system prevents silly answers from appearing in dramatic narrative prose.

```
HIGH gravity (dramatic templates allowed):
  - Person + history/mythology/philosophy domain
  - All places (geographic weight is inherently narrative)
  - All foreign words (always atmospheric)
  - Concepts in science/philosophy domains
  - Historical years (1000-2100)

MEDIUM gravity (neutral templates only):
  - Person + science/computing domains
  - Concepts in any other domain
  - Objects/things in any domain

LOW gravity (never named, answer-free fallback only):
  - Pure numbers that aren't years
  - Answers < 4 characters
  - Boolean answers (True/False/Yes/No)
  - List answers ("A, B, and C")
  - Single characters
```

**Additional filters:**
- Concepts with `echoText` < 8 characters → downgrade to LOW (filters "War", "Art", "Water")
- Context echo templates available as fallback for medium-gravity facts with short echoText

**When in doubt:** default to MEDIUM. It's better to echo neutrally than to risk breaking immersion OR to miss a valid echo opportunity.

---

## Integration Checklist

When wiring narrative into the game, verify these connections:

- [ ] `RunState.narrativeState` — optional field on RunState
- [ ] `gameFlowController.ts` — room transition hook calls `narrativeEngine.getNextLines()`
- [ ] `encounterBridge.ts` — after encounter, feeds results to `narrativeEngine.recordEncounter()`
- [ ] `shopService.ts` — on purchase, calls `narrativeEngine.recordPurchase(type)`
- [ ] `ChainDistribution` — provides chain color names and topic labels
- [ ] Svelte overlay component — displays narrative text on transitions
- [ ] Expedition Journal — reads `RunNarrativeState.linesShown` for post-run display
- [ ] Web Audio drone — synthesized creature sound on line display

---

## Content Inventory Targets

| Content Type | Target | Current |
|---|---|---|
| Descent archetypes | 12 | 12 |
| Domain lenses | 15 | 15 |
| Echo templates (all types) | ~98 | ~105 |
| Seeker state lines | ~60 | ~44 |
| Relic callback lines | ~75 | ~41 |
| Merchant dialogue lines | ~30 | ~36 |
| Keeper dialogue lines | ~25 | ~25 |
| Oracle dialogue lines | ~35 | ~35 |
| Guardian dialogue lines | ~20 | ~20 |
| Domain ambient lines | ~150 | ~150 |
| **Total** | **~580** | **~573** |

Content is Phase 1 complete (2026-04-03). Update counts if new content is added.

---

## Phase 2 — Engine Integration (TODO)

| Task | File | Status |
|---|---|---|
| Weaving algorithm | `src/services/narrativeEngine.ts` | DONE (2026-04-03) |
| Black screen overlay | `src/ui/components/NarrativeOverlay.svelte` | DONE (2026-04-03) |
| Room transition hooks | `src/services/gameFlowController.ts` | DONE (2026-04-03) |
| Expedition Journal | Camp screen component | TODO |
| Creature Below audio | Web Audio synthesis | TODO |

---

## Common Pitfalls

1. **Gravity filter too strict** — If players rarely see echo lines, loosen medium gravity rules. The filter should prevent embarrassment, not silence the system.
2. **Thread starvation** — If one thread (e.g., Seeker) fires too often, others feel absent. The cooldown system in the weaving engine prevents this.
3. **NPC visit counter reset** — Visit counters are per-run, not per-floor. The Merchant greeting for visit 3 should feel like "we keep meeting" not "you've been to this specific shop 3 times."
4. **Chain color vs chain theme** — Chain colors (Obsidian, Crimson, etc.) are ALWAYS available. Chain themes (topic labels) are only narrative-ready for knowledge decks with subDecks. Never assume theme labels exist.
5. **Oracle callback distance** — The Oracle PREFERS far-away facts (Floor 1 referenced on Floor 3). Don't accidentally weight toward recent facts — that's less impressive.
6. **Archetype beat pacing** — 5-6 beats across a 15-room run means most rooms do NOT get a Descent beat. That's intentional. Other threads fill the gaps.

---

## Related Systems

| System | Doc | Relevance |
|---|---|---|
| Chain Distribution | `docs/mechanics/chains.md` | TopicGroup labels, chain colors, rotation |
| Progression & Rooms | `docs/mechanics/progression.md` | Room types, floor structure, mystery events |
| Relics | `docs/mechanics/relics.md` | Relic IDs and triggers for callback lines |
| Combat | `docs/mechanics/combat.md` | Turn results, encounter flow |
| Quiz Engine | `docs/mechanics/quiz.md` | Fact data, answer fields |
| Audio | `/audio-manager` skill | Creature Below drone synthesis |
| Deck System | `docs/content/deck-system.md` | Deck domains, subDecks, fact structure |

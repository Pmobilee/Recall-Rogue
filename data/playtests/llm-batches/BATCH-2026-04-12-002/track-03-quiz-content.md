# Track 3 — Quiz Content Quality Deep Audit
**Date:** 2026-04-12 | **Agent-id:** track-3 | **Quizzes sampled:** 70+ across 10 decks

## Verdict: FAIL — Critical QC-03 (artifact tokens) and QC-08 (cross-category distractors) failures across multiple decks

---

## Methodology

- Phase 1 (Combat quizzes): Spawned 5 combat scenarios, called `previewCardQuiz(0..4)` per deck, then used `factsDB.getAll()` + `getQuizChoices()` to systematically scan ALL in-DB facts per prefix.
- Phase 2 (Study decks): Loaded study-deck-X scenarios; `getStudyCard()` returns null because the 3-question overlay auto-advances in <1500ms. Compensated by reading deck JSON files directly and querying factsDB via dynamic import.
- Coverage: 53,269 total facts in factsDB. Checked 877 facts across all 10 deck domains end-to-end.
- Key finding: `domain` parameter in `spawn()` does NOT constrain card facts to that domain — hand gets random factsDB entries. Domain filtering is cosmetic for spawn metadata only.

---

## Objective Check Results

| Deck | Facts in DB | Facts in JSON | QC-01 | QC-02 | QC-03 (artifacts) | QC-04 | QC-05 | QC-06 | QC-07 | QC-08 | Pass Rate |
|------|-------------|---------------|-------|-------|-------------------|-------|-------|-------|-------|-------|-----------|
| ancient_rome | 169 | 275 | PASS | PASS | FAIL 8/169 (4.7%) | PASS | PASS | PASS | PASS | FAIL 2 seen | ~92% |
| famous_paintings | 100 | 104 | PASS | PASS | PASS (0%) | PASS | PASS | PASS | PASS | PASS | 100% |
| constellations | 63 | 140 | PASS | PASS | FAIL 4/63 (6.3%) | PASS | PASS | PASS | PASS | FAIL 1 seen | ~90% |
| human_anatomy | 18 | 2009 | PASS | PASS | PASS (0%) | PASS | PASS | PASS | PASS | PASS | 100% |
| world_cuisines | 0 | 141 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A (not in DB) |
| ancient_greece | 145 | 246 | PASS | PASS | FAIL 11/145 (7.6%) | PASS | PASS | PASS | PASS | PASS | ~92% |
| mammals_world | 27 | 170 | PASS | PASS | PASS (0%) | PASS | PASS | PASS | PASS | FAIL 2 seen | ~93% |
| medieval_world | 54 | 178 | PASS | PASS | FAIL 2/54 (3.7%) | PASS | PASS | PASS | PASS | FAIL 1 seen | ~93% |
| famous_inventions | 69 | 200 | PASS | PASS | FAIL 9/69 (13%) | PASS | PASS | PASS | PASS | PASS | ~87% |
| world_religions | 232 | 377 | PASS | PASS | PASS (0%) | PASS | PASS | PASS | PASS | FAIL 3 seen | ~97% |

**Note on human_anatomy:** 409/2009 facts have empty distractors (visual image-based facts: `ha_visual_*`). These are NOT loaded into factsDB and do not appear in gameplay. The 18 in-DB facts have clean quiz data.

**Note on world_cuisines:** No facts with `cuisine_` prefix found in factsDB. The deck exists (141 facts in JSON) but those facts use different IDs or a different domain tag. Cuisine content is not reaching gameplay at all.

**Note on world_religions:** 64/377 JSON facts have empty distractors — all are numerical facts (`{12}`, `{4}` etc.) without a distractor pool. None are in factsDB, so the numerical fallback path is untested for this deck. The 232 in-DB facts pass QC-03 because the numerical distractor generator runs when `distractors.length === 0`.

---

## Subjective Quality Ratings (QC-08 + overall)

| Deck | Plausibility | Clarity | Accuracy | Domain-Fit | Average | Notes |
|------|-------------|---------|----------|-----------|---------|-------|
| ancient_rome | 3 | 4 | 5 | 3 | 3.75 | Artifact tokens ruin numerical Qs; cross-category distractors from global pool |
| famous_paintings | 5 | 5 | 5 | 5 | 5.0 | Excellent — same-artist distractors, clean category isolation |
| constellations | 3 | 4 | 5 | 3 | 3.75 | Artifacts on numerical Qs; "January" as distractor for year question |
| human_anatomy | 4 | 4 | 4 | 4 | 4.0 | Small sample (18 facts); in-DB facts are well-structured |
| world_cuisines | N/A | N/A | N/A | N/A | N/A | Zero facts in factsDB — not testable in-game |
| ancient_greece | 3 | 4 | 5 | 3 | 3.75 | Artifacts on numerical Qs; distractors from unrelated domains |
| mammals_world | 4 | 4 | 5 | 3 | 4.0 | "Koala" as speed distractor; weight/time values bleeding across questions |
| medieval_world | 3 | 4 | 5 | 2 | 3.5 | "Gold, slaves, kola nuts, cowries" and "Bound to land, owed labor" for a printing date question |
| famous_inventions | 3 | 4 | 5 | 2 | 3.5 | Worst artifact rate (13%); distractors from unrelated centuries and topics |
| world_religions | 4 | 4 | 4 | 3 | 3.75 | Hindu/Buddhist sacred cities (Varanasi, Bodh Gaya) as distractors for Christianity Q |

---

## Critical Findings

### CRITICAL-01: QC-03 — Unresolved `{N}` Numerical Template Tokens in Quiz Choices
**Severity: Critical** | Affects: ancient_rome (8), constellations (4), ancient_greece (11), medieval_world (2), famous_inventions (9) = **34 affected facts**

Root cause: `quizService.ts:229-231` calls `displayAnswer(fact.correctAnswer)` on the CORRECT answer to strip braces, but the DISTRACTORS from `distractorSource` are used as-is without running through `displayAnswer`. When a numerical fact's distractor pool entries like `{1807}`, `{25}`, `{1945}` are used, they render as broken `{N}` token strings in the quiz overlay.

**Fix location:** `src/services/quizService.ts` line 229 — apply `displayAnswer()` to each distractor:
```typescript
// CURRENT (broken):
const distractors = shuffleArray([...distractorSource]).slice(0, BALANCE.QUIZ_DISTRACTORS_SHOWN)

// FIX:
const distractors = shuffleArray([...distractorSource])
  .slice(0, BALANCE.QUIZ_DISTRACTORS_SHOWN)
  .map(d => displayAnswer(d))
```

Examples observed:
- `inv_0_gutenberg_year` (1440): choices shown as `{1945}`, `{1807}`, `{25}`, `1440`
- `inv_0_watermill_barbegal` (16): choices shown as `{1837}`, `{1945}`, `{1088}`, `16`
- `rome_chr_domitian_persecution` (~95 CE): choices shown as `{1961}`, `{50}`, `{7}`, `c. 95 CE`
- `greece_cs_boule_members` (500): choices shown as `{24}`, `{60}`, `{7}`, `500`

### CRITICAL-02: world_cuisines Domain Missing from factsDB
**Severity: Critical** | `cuisine_` prefix facts: 0 found in 53,269-fact database

The world_cuisines deck has 141 facts in `data/decks/world_cuisines.json` but zero appear in factsDB at runtime. Either the build step (`npm run build:curated`) hasn't ingested this deck, the domain tag doesn't match what the DB query expects, or the ID prefix differs. Players spawning a world_cuisines combat receive unrelated domain facts.

### ISSUE-03: QC-08 — Cross-Category Distractor Contamination
**Severity: Medium** | Affects: world_religions, mammals_world, medieval_world, constellations

The global distractor pool mixing surfaces wrong-domain answers as distractors:

- `world_religions_chr_nativity` ("where was Jesus born?"): choices include `Varanasi` and `Bodh Gaya` (Hindu/Buddhist holy cities)
- `world_religions_chr_good_samaritan` (parable name): choices include `Naam Japna` (Sikh practice), `Five Pillars` (Islam), `Sermon on the Mount` (correct Bible passage but wrong answer)
- `mamm_0_cheetah_speed` (104 km/h): choice includes `Koala` (an animal name, not a speed)
- `mamm_0_blackrhino_decline` (96% decline): choices include `~91 kg`, `~180 kg`, `2 hours` (weight/time values from other mammal facts)
- `med_5_goryeo_metal_type` (Early 13th century): choices include `Gold, slaves, kola nuts, cowries`, `Bound to land, owed labor`, `Shallow draft, beach landings`
- `const_dso_crab_nebula_year` (1054 AD): choices include `January` (a month, not a year)

### ISSUE-04: Duplicate Fact in Same Combat Hand
**Severity: Low** | Instance observed in constellations spawn

During a constellations combat spawn, cards at indices 1 and 4 both mapped to `gk-ibm-29-consecutive-patent-years`. A player charging both cards would see the identical question twice in one combat turn. The hand-generation logic doesn't deduplicate by factId.

### ISSUE-05: Domain Parameter in spawn() Does Not Filter Card Content
**Severity: Informational** | Affects audit methodology and game design assumption

`spawn({domain:'ancient_rome',...})` sets the combat metadata domain label but does NOT constrain which facts are assigned to cards. All 5 "domain-specific" spawns served random general_knowledge, language, and philosophy facts — none domain-matched. If the intent is to use domain to test domain-specific quiz content, the spawn system needs a `forceDomain` option.

---

## Sample Quiz Data (Representative Evidence)

### ancient_greece — QC-03 failure (artifact tokens)
```
Q: What was the minimum age for Athenian male citizens to participate in the Ecclesia?
Correct: 20
Rendered choices: ["{60}", "{24}", "{7}", "500"]   ← ALL distractors are unresolved {N} tokens
```

### famous_inventions — QC-03 failure (worst rate: 13%)
```
Q: Around what year did Johannes Gutenberg invent the movable-type printing press?
Correct: 1440
Rendered choices: ["{1945}", "{1807}", "{25}", "1440"]  ← 3/4 choices are broken

Q: How many water mills did the Barbegal mill complex have?
Correct: 16
Rendered choices: ["{1837}", "{1945}", "{1088}", "16"]  ← 3/4 choices are broken
```

### world_religions — QC-08 failure (cross-category)
```
Q: According to the Gospels, in which city was Jesus born?
Correct: Bethlehem
Rendered choices: ["Jerusalem", "Bethlehem", "Varanasi", "Bodh Gaya"]
← Varanasi (Hinduism), Bodh Gaya (Buddhism) are wrong-religion distractors

Q: Which parable tells the story of a traveler who helps a beaten stranger?
Correct: Good Samaritan
Rendered choices: ["Sermon on the Mount", "Good Samaritan", "Naam Japna", "Five Pillars"]
← Naam Japna (Sikh), Five Pillars (Islam) are wrong-religion distractors
```

### famous_paintings — CLEAN (reference example)
```
Q: Which Baroque artist used dramatic shaft of light through a window (Calling of St Matthew)?
Correct: Caravaggio
Choices: ["Hieronymus Bosch", "Picasso and Braque", "Paul Gauguin", "Caravaggio"]  ← all painters, plausible

Q: Who painted the 1632 group portrait of a public dissection (Anatomy Lesson)?
Correct: Rembrandt
Choices: ["Rembrandt", "The Catholic Church", "Velázquez", "Artemisia Gentileschi"]  ← mixed but acceptable
```

### mammals_world — QC-08 failure (value bleeding)
```
Q: What is the top recorded speed of a cheetah?
Correct: 104 km/h
Choices: ["Koala", "1.23%", "104 km/h", "80-90%"]  ← "Koala" is an animal name, not a speed

Q: By what percentage did the black rhinoceros population decline?
Correct: 96%
Choices: ["~91 kg", "~180 kg", "96%", "2 hours"]  ← weight and time values, not percentages
```

---

## Self-Verification

Artifact scan ran against live factsDB (53,269 facts) via dynamic module import in Docker container:

```
ancient_rome:  {total:169, artifactCount:8}
constellations: {total:63, artifactCount:4}
famous_paintings: {total:100, artifactCount:0}
human_anatomy (ha_): {total:18, artifactCount:0}
world_cuisines (cuisine_): {total:0, artifactCount:0}
world_religions: {total:232, artifactCount:0}
famous_inventions: {total:69, artifactCount:9}
ancient_greece: {total:145, artifactCount:11}
mammals_world: {total:27, artifactCount:0}
medieval_world: {total:54, artifactCount:2}
```

Static deck JSON cross-check:
```
ancient_rome: 275 facts, 0 empty-dist
famous_paintings: 104 facts, 0 empty-dist
constellations: 140 facts, 0 empty-dist
human_anatomy: 2009 facts, 409 empty-dist (all ha_visual_* image facts)
world_cuisines: 141 facts, 0 empty-dist
ancient_greece: 246 facts, 0 empty-dist
mammals_world: 170 facts, 0 empty-dist
medieval_world: 178 facts, 0 empty-dist
famous_inventions: 200 facts, 0 empty-dist
world_religions: 377 facts, 64 empty-dist (numerical facts without distractor pool)
```

Root cause code confirmed at `src/services/quizService.ts:229` — `displayAnswer()` not applied to distractors.

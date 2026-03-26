# AR-257: Norse Mythology Deck Expansion

**Status:** Draft
**Priority:** High
**Complexity:** Medium-High
**Depends on:** Norse Mythology deck (147 facts, shipped 2026-03-25)

---

## Overview

The Norse Mythology deck shipped with 147 truth-grounded facts but several sub-decks are too thin for the "I know Norse mythology" standard. This AR expands the thin sub-decks to proper depth, adds missing narrative arcs, updates answer type pools and question templates, seeds confusion pairs across all 223 facts, and tags ageGroup for all new content.

**Current state:**

| Sub-deck | Current | Target | Gap |
|----------|---------|--------|-----|
| The Aesir & Vanir | 48 | 48 | -- (done) |
| The Nine Realms | 14 | 25 | +11 |
| Ragnarok & Creation | 21 | 30 | +9 |
| Heroes & Sagas | 14 | 35 | +21 |
| Thor's Adventures | 3 | 25 | +22 |
| Creatures & Monsters | 32 | 35 | +3 |
| Trickery, Fate & Runes | 15 | 25 | +10 |
| **Total** | **147** | **223** | **+76** |

---

## Sub-step 0: Research & Architecture YAML (BEFORE any generation)

No architecture YAML exists for this deck. One must be created before any facts are generated.

### 0a: Fetch Wikipedia sources for new entities

Sonnet workers fetch Wikipedia articles into `data/deck-sources/norse_mythology/` for every new entity. Fill any empty source files that already exist.

**New entities requiring source fetch:**

| Sub-deck | Entities to research |
|----------|---------------------|
| Thor's Adventures | Thrym, Hrungnir, Hymir, Mokkurkalfi, Thjalfi, Tanngrisnir & Tanngnjóstr, Megingjord, Modi, Magni, Harbard |
| Heroes & Sagas | Ragnar Lothbrok, Hervor, Starkad, Volsung, Sigmund, Signy, Lagertha, Leif Erikson, Andvaranaut, Tyrfing, Barnstokkr |
| Nine Realms | Hvergelmir, Well of Urd, Eljudnir (Hel's hall), Iving river |
| Ragnarok & Creation | Buri, Audhumla, Vili, Ve, Naglfar, Skoll, Hati |
| Trickery | Thiazi, Svadilfari, Lokasenna, seidr, volva |
| Creatures | Draugr, Kraken |

- [ ] Spawn 3-4 Sonnet workers in parallel, each fetching 8-10 Wikipedia articles
- [ ] Write fetched text to `data/deck-sources/norse_mythology/<entity>.txt`
- [ ] Orchestrator reviews source files for completeness

### 0b: Create architecture YAML

Create `data/deck-architectures/norse_mythology_arch.yaml` with:
- Updated answer type pools (see Pool Updates below)
- New question templates
- Seeded confusion pairs (full 223-fact audit)
- Synonym groups
- Difficulty tiers
- Data sources with license info (Wikipedia CC-BY-SA, Wikidata CC0)
- Verified source data extracts for all 76 new facts (dates, names, relationships, source URLs)

- [ ] Architecture YAML created with all sections
- [ ] Every new fact has verified source data + URL in the YAML
- [ ] Orchestrator reviews YAML for pool coherence and completeness

**Acceptance:** Architecture YAML exists, all source files fetched, no generation begins until this sub-step is complete.

---

## Sub-step 1: Pool, Template & Confusion Updates

### Pool Updates

| Pool | Current | Target | New Members |
|------|---------|--------|-------------|
| hero_names | 6 | ~14 | Ragnar Lothbrok, Hervor, Starkad, Sigmund, Signy, Volsung, Leif Erikson, Lagertha |
| giant_names | 11 | ~16 | Thrym, Hrungnir, Hymir, Elli, Mokkurkalfi |
| object_names | 40 | ~46 | Megingjord, Naglfar, Andvaranaut, Tyrfing, Barnstokkr, Eljudnir |
| creature_names | 22 | ~25 | Tanngrisnir & Tanngnjóstr (as pair), Draugr, Kraken |
| god_names | 47 | 47 | No new members (review only) |
| realm_names | 13 | 13 | No new members — Hvergelmir, Eljudnir etc. are locations WITHIN realms, not realms themselves |

**Pool audit rule:** After adding new members, verify every member's `correctAnswer` makes sense as a distractor for every other member in the same pool.

### New Question Templates

| ID | Format | Answer Pool | Mastery | Rationale |
|----|--------|-------------|---------|-----------|
| hero_from_saga | "Which hero {action} in the {saga_name}?" | hero_names | 2 | hero_names pool expanding from 6 to 14 — needs dedicated templates |
| object_from_story | "Which legendary object {description}?" | object_names | 3 | Tests knowledge of mythological artifacts beyond just "who owned it" |
| giant_from_encounter | "Which giant {challenged/tricked} Thor?" | giant_names | 2 | Thor's Adventures expansion creates enough giants for this template |
| realm_detail | "Which realm contains {landmark}?" | realm_names | 3 | Realm expansion adds enough detail per realm to support this |

### Confusion Pair Audit (ALL 223 facts)

**New pairs to seed:**

| Pair | Reason |
|------|--------|
| Thrym / Hrungnir | Both giants Thor fights; players confuse which story is which |
| Tanngrisnir / Tanngnjóstr | Thor's two goats, near-identical names |
| Ragnar / Sigurd | Both legendary warrior heroes, dragon-adjacent stories |
| Andvaranaut / Draupnir | Both magical gold rings in Norse myth |
| Modi / Magni | Thor's sons, both names mean strength-related concepts |
| Hervor / Brynhild | Both shieldmaiden figures in saga tradition |

**Audit existing 147 facts for overlooked pairs:**

| Candidate Pair | Reason to investigate |
|----------------|----------------------|
| Tyr / Thor | Both warrior gods, names start with T |
| Niflheim / Helheim | Both cold/death-associated realms |
| Skoll / Hati | Both wolves chasing celestial bodies |
| Hel / Hela | Name variants for the same goddess |
| Freyja / Frigg | Already exists — verify coverage is complete |
| Vanaheim / Alfheim | Both "light" peaceful realms players may confuse |
| Gungnir / Mjolnir | Both signature god weapons (Odin's spear / Thor's hammer) |
| Fenrir / Jormungandr | Both Loki's monstrous children, both break free at Ragnarok |

- [ ] Review all 147 existing facts for confusion pair candidates
- [ ] Add minimum 8 new confusion pairs (6 from new content + 2+ from existing audit)
- [ ] Update synonym groups: verify Sigurd/Siegfried group includes new Volsung facts; add Jotunheim/Utgard if warranted

**Acceptance:** All pools updated with correct member counts. 4 new question templates added. 8+ new confusion pairs seeded. Synonym groups reviewed.

---

## Sub-step 2: Expand Thor's Adventures (3 -> 25 facts)

Currently has only: Utgard-Loki, fishing for Jormungandr, Skrymir. Needs the full stories told as narrative arcs.

### Thrym's Theft of Mjolnir (full arc, 5 facts):
- [ ] Thrym steals Mjolnir while Thor sleeps — **ageGroup: all**
- [ ] Thrym demands Freyja as bride; Freyja refuses furiously — **ageGroup: all**
- [ ] Thor dresses as Freyja (bride), Loki as bridesmaid — **ageGroup: all**
- [ ] At the feast, "Freyja" eats an entire ox and drinks three barrels of mead; Loki explains away the appetite — **ageGroup: all**
- [ ] Thrym places Mjolnir on "Freyja's" lap; Thor seizes it and slays all the giants — **ageGroup: teen+** (mass slaughter)

### Thor's Journey to Utgard-Loki (expand from 1 -> 5 facts):
- [ ] Thor, Loki, and Thjalfi travel to Jotunheim — **ageGroup: all**
- [ ] Three contests: Loki vs Logi (wildfire), Thjalfi vs Hugi (thought), Thor drinks horn connected to ocean — **ageGroup: all**
- [ ] Thor tries to lift cat (actually Jormungandr in disguise) — lifts one paw, terrifying Utgard-Loki — **ageGroup: all**
- [ ] Thor wrestles Elli (old age personified) — brought to one knee — **ageGroup: all**
- [ ] Utgard-Loki reveals truth: all contests were illusions, Thor nearly drank the ocean dry — **ageGroup: all**

### Thor Fishing for Jormungandr (expand from 1 -> 3 facts):
- [ ] Thor and Hymir go fishing; Thor uses ox head as bait — **ageGroup: all**
- [ ] Thor hooks Jormungandr, nearly pulls the World Serpent from the ocean — **ageGroup: all**
- [ ] Hymir cuts the line in terror; Thor flings Mjolnir after the serpent — **ageGroup: all**

### Thor's Goats & Belt (3 facts):
- [ ] Tanngrisnir and Tanngnjóstr pull Thor's chariot across the sky — **ageGroup: all**
- [ ] Thor eats the goats for dinner, resurrects them with Mjolnir — but Thjalfi broke a bone, leaving one goat lame — **ageGroup: all**
- [ ] Megingjord (belt of strength) doubles Thor's already immense power — **ageGroup: all**

### Additional Thor myths (4 facts):
- [ ] Thor vs Hrungnir (strongest of all giants, stone head, clay body Mokkurkalfi) — **ageGroup: teen+** (violent combat)
- [ ] Thor's sons Modi and Magni — Magni lifts Hrungnir's leg off Thor — **ageGroup: all**
- [ ] Thor disguised as a ferryman (Harbard — actually Odin in disguise mocking him) — **ageGroup: all**
- [ ] Thor's role as protector of Midgard and humanity — **ageGroup: all**

**Per-fact requirements:** Each fact must include: id, correctAnswer (max 5 words/30 chars), 8+ distractors (LLM-generated), quizQuestion (max 15 words, ends with ?), explanation (1-3 sentences with cross-references), wowFactor (punchy, share-worthy), statement, visualDescription (20-40 words), sourceName, sourceUrl, ageGroup, difficulty (1-5), funScore (1-10), answerTypePoolId, chainThemeId (0-5 distributed evenly), 4 variants (reverse, context, true_false, fill_blank).

**Pool assignments:** Most facts -> god_names (Thor as answer) or giant_names (Thrym, Hrungnir, Hymir, Utgard-Loki as answers) or object_names (Mjolnir, Megingjord) or creature_names (Tanngrisnir/Tanngnjóstr).

**Difficulty:** Thrym arc = tier 1-2 (well-known story). Utgard-Loki = tier 2 (less mainstream). Hrungnir/Harbard = tier 3 (obscure).

**Acceptance:** 22 new facts, full Thrym/Utgard arcs retellable from the facts alone. All per-fact fields present. ageGroup tagged on every fact.

---

## Sub-step 3: Expand Heroes & Sagas (14 -> 35 facts)

Currently covers Sigurd/Fafnir and Valkyries basics. Missing: full Volsung saga, Ragnar Lothbrok, other saga heroes.

### Entity Inclusion Decisions:
- **KEEP** Ragnar Lothbrok — semi-legendary, deeply entwined with Norse saga tradition
- **KEEP** Leif Erikson — connected to Norse exploration traditions, iconic
- **REMOVE** Erik the Red — purely historical, no mythological dimension
- **REMOVE** Bjorn Ironside "mistook Luna for Rome" — historical anecdote, not mythology
- **ADD** Lagertha — legendary shieldmaiden from Ragnar's saga (replaces Erik the Red)

### Sigurd/Fafnir Saga Expansion (+6 facts):
- [ ] Fafnir was originally a dwarf who killed his father Hreidmar for the gold — **ageGroup: teen+** (patricide)
- [ ] Fafnir transformed into a dragon through greed (sitting on gold too long) — **ageGroup: all**
- [ ] Sigurd hid in a pit and stabbed Fafnir from below as he crawled over — **ageGroup: teen+** (graphic violence)
- [ ] The cursed gold (Andvaranaut ring) — Andvari's curse that all who possess it will be destroyed — **ageGroup: all**
- [ ] Sigurd and Brynhild's tragic end — Brynhild tricks Gunnar, Sigurd is murdered — **ageGroup: teen+** (murder)
- [ ] The Rhinegold connection — Norse ring saga predates Tolkien and Wagner by centuries — **ageGroup: all**

### Ragnar Lothbrok (+4 facts):
- [ ] Legendary Viking hero, possibly historical (9th century) — **ageGroup: all**
- [ ] Conquered Paris, raided England and Francia — **ageGroup: teen+** (warfare)
- [ ] Captured by King Aella of Northumbria, thrown into pit of snakes — **ageGroup: teen+** (execution)
- [ ] His sons (Ivar the Boneless, Bjorn Ironside) invaded England to avenge him (Great Heathen Army) — **ageGroup: teen+** (warfare)

### Volsung Saga Expansion (+3 facts):
- [ ] Volsung — ancestor of Sigurd's line, built his hall around a great tree (Barnstokkr) — **ageGroup: all**
- [ ] Sigmund's twin sister Signy — married to enemy king, engineers revenge — **ageGroup: teen+** (revenge plot)
- [ ] The cursed sword cycle — Odin gives, Odin takes, sword reforged for each generation — **ageGroup: all**

### Additional Heroes (+8 facts):
- [ ] Hervor — shieldmaiden who summoned her dead father from his grave to claim the cursed sword Tyrfing — **ageGroup: teen+** (necromancy)
- [ ] Starkad — blessed by Odin with three lifetimes but cursed by Thor to commit a shameful deed in each — **ageGroup: teen+** (dark themes)
- [ ] Leif Erikson — first European to reach North America (~1000 CE), son of Erik the Red — **ageGroup: all**
- [ ] Lagertha — legendary shieldmaiden, first wife of Ragnar Lothbrok, fought alongside him in battle — **ageGroup: teen+** (warrior violence)
- [ ] Berserkers expansion — bear/wolf skin warriors, believed immune to fire and iron — **ageGroup: teen+** (battle frenzy)
- [ ] Shieldmaidens expansion — historical debate on women warriors in Norse society — **ageGroup: all**
- [ ] Einherjar as "heroes in training" — chosen warriors practicing daily in Valhalla for Ragnarok — **ageGroup: all**
- [ ] Andvaranaut's curse — every owner of the ring meets a tragic end, from Hreidmar to the Nibelungs — **ageGroup: all**

**Pool assignments:** hero_names (Ragnar, Hervor, Starkad, Sigmund, Signy, Volsung, Leif Erikson, Lagertha), object_names (Andvaranaut, Tyrfing, Barnstokkr).

**Difficulty:** Ragnar/Sigurd = tier 1-2. Volsung saga = tier 2-3. Hervor/Starkad = tier 3.

**Acceptance:** 21 new facts, Volsung saga arc and Ragnar Lothbrok arc retellable. No purely historical facts without mythological connection.

---

## Sub-step 4: Expand Nine Realms (14 -> 25 facts)

Each realm needs 2-3 facts (currently 1 each + Yggdrasil/Bifrost). Add depth.

- [ ] Asgard: contains Valhalla (Odin's hall), Sessrumnir (Freyja's hall), Gladsheim (meeting hall) — **ageGroup: all**
- [ ] Midgard: protected by Thor, connected to Asgard by Bifrost, surrounded by ocean where Jormungandr lies — **ageGroup: all**
- [ ] Jotunheim: home of Utgard-Loki's fortress, separated from Asgard by the river Iving — **ageGroup: all**
- [ ] Niflheim: primordial void's ice side, contains Hvergelmir (source of 11 rivers) — **ageGroup: all**
- [ ] Muspelheim: Surtr waits here with flaming sword until Ragnarok — **ageGroup: all**
- [ ] Helheim: half the dead go here (non-warriors), Hel's hall Eljudnir, her plate Hunger, her knife Famine — **ageGroup: all**
- [ ] Svartalfheim: dwarves forged ALL the gods' greatest treasures here — **ageGroup: all**
- [ ] Yggdrasil: four stags gnaw its branches (Dainn, Dvalinn, Duneyrr, Durathror) — **ageGroup: all**
- [ ] Mimir's Well: Odin's eye still rests at the bottom — **ageGroup: all**
- [ ] Well of Urd: where the gods hold daily council — **ageGroup: all**
- [ ] Bifrost: will shatter when the sons of Muspell ride across at Ragnarok — **ageGroup: all**

**Pool assignments:** realm_names (realm identity questions), object_names (Hvergelmir, Eljudnir, Well of Urd, Bifrost).

**Difficulty:** Midgard/Asgard details = tier 1. Other realm details = tier 2. Wells/stags = tier 3.

**Acceptance:** 11 new facts, each realm has 2+ facts, player can describe each realm's character.

---

## Sub-step 5: Expand Trickery, Fate & Runes (15 -> 25 facts)

### Loki's Other Tricks (+5 facts):
- [ ] Loki cuts Sif's golden hair — Thor threatens to break every bone; Loki commissions dwarven replacements — **ageGroup: all**
- [ ] The dwarven competition (Loki bets his head): produces Mjolnir, Gungnir, Draupnir, Skidbladnir, Gullinbursti, Sif's hair — Loki loses bet, dwarves sew his lips shut — **ageGroup: teen+** (lips sewn shut)
- [ ] Loki and the builder's horse — gods hire giant to build Asgard's wall; Loki seduces Svadilfari as a mare, gives birth to Sleipnir — **ageGroup: teen+** (adult theme)
- [ ] Loki and Thiazi — Loki captured by eagle (Thiazi), forced to lure Idunn out of Asgard — **ageGroup: all**
- [ ] Flyting of Loki (Lokasenna expansion) — specific insults to each god at Aegir's feast — **ageGroup: teen+** (adult content)

### Runes & Magic (+3 facts):
- [ ] Odin's self-sacrifice on Yggdrasil — "I know that I hung on a wind-battered tree, nine nights long" (Havamal) — **ageGroup: teen+** (self-harm theme)
- [ ] Rune stones — carved throughout Scandinavia, ~3000 surviving, oldest from 2nd century — **ageGroup: all**
- [ ] Seidr practitioners were mostly women (volvas); Odin was unusual as a male practitioner, which other gods mocked — **ageGroup: all**

### Fate & Destiny (+2 facts):
- [ ] Norns visit every newborn to determine their fate — even gods are subject to the Norns' decrees — **ageGroup: all**
- [ ] Ragnarok is not truly an ending — it's a cycle; the world is reborn, proving fate is not purely destructive — **ageGroup: all**

**Pool assignments:** god_names (Loki/Odin as answers), object_names (Gungnir, Draupnir, Skidbladnir, Gullinbursti).

**Difficulty:** Sif's hair, Loki's children = tier 1-2. Seidr, Lokasenna, Havamal = tier 3.

**Acceptance:** 10 new facts, Loki's greatest tricks arc and rune origin arc complete.

---

## Sub-step 6: Expand Creatures & Monsters (32 -> 35 facts)

- [ ] Draugr expansion — guarded their burial mounds, could grow in size, feared by Vikings — **ageGroup: teen+** (undead horror)
- [ ] Kraken — may derive from Norse sea monster traditions — **ageGroup: all**
- [ ] Jormungandr expansion — the ouroboros (biting own tail) symbolism — **ageGroup: all**

**Pool assignments:** creature_names.

**Difficulty:** Kraken = tier 1. Draugr/Jormungandr symbolism = tier 2.

**Acceptance:** 3 new facts.

---

## Sub-step 7: Expand Ragnarok & Creation (21 -> 30 facts)

### Creation expansion (+5 facts):
- [ ] Buri (licked from ice by Audhumla) — grandfather of Odin — **ageGroup: all**
- [ ] Odin, Vili, Ve — the three brothers who shaped the world — **ageGroup: all**
- [ ] Midgard built from Ymir's eyebrows specifically to protect humans from giants — **ageGroup: all**
- [ ] Sun and Moon placed in chariots chased by wolves Skoll and Hati — **ageGroup: all**
- [ ] Dwarves created from maggots in Ymir's flesh (given form and wisdom by the gods) — **ageGroup: all**

### Ragnarok expansion (+4 facts):
- [ ] Fenrir's jaws stretch from earth to sky when freed — **ageGroup: all**
- [ ] The dead sail on Naglfar (ship of dead men's fingernails) — Vikings trimmed corpses' nails to delay its completion — **ageGroup: teen+** (macabre)
- [ ] Stars vanish from the sky during Ragnarok — **ageGroup: all**
- [ ] After rebirth, the surviving gods find golden playing pieces in the grass — relics of the old world — **ageGroup: all**

**Pool assignments:** god_names (Buri, Vili, Ve, Odin), creature_names (Skoll, Hati, Fenrir), object_names (Naglfar).

**Difficulty:** Buri/Vili/Ve = tier 2. Naglfar/golden pieces = tier 3.

**Acceptance:** 9 new facts, creation-to-destruction cycle fully told.

---

## Pipeline

All expansion facts follow the two-phase pipeline from deck-master SKILL.md:

### Phase 1: Sonnet Workers — Truth-Grounded Fact Generation
- Workers receive: architecture YAML + actual Wikipedia article text for their entities
- Workers produce structurally complete facts with ALL required fields
- Workers do NOT generate from training knowledge — source data is ground truth
- Max 6 workers running simultaneously, max 10 entities per worker

### Phase 2: Opus Quality Pass (handled by AR-258)
- AR-258 rewrites prose fields (explanation, wowFactor, visualDescription, statement)
- AR-258 adds narrative interweaving and cross-mythology references
- AR-258 does NOT touch correctAnswer, quizQuestion, distractors, or structural fields

### Workers needed (Phase 1):

| Worker | Sub-steps | ~Facts | Entities |
|--------|-----------|--------|----------|
| 1 | Thor's Adventures | ~22 | Thrym, Hrungnir, Hymir, Thjalfi, Tanngrisnir/Tanngnjóstr, Modi, Magni, Harbard |
| 2 | Heroes & Sagas (Sigurd + Ragnar) | ~13 | Fafnir, Andvaranaut, Ragnar, Lagertha, Volsung, Sigmund, Signy |
| 3 | Heroes & Sagas (misc) + Creatures | ~11 | Hervor, Starkad, Leif Erikson, Berserkers, Shieldmaidens, Einherjar, Draugr, Kraken |
| 4 | Realms + Ragnarok/Creation | ~20 | Hvergelmir, Eljudnir, Iving, Buri, Vili, Ve, Naglfar, Skoll, Hati |
| 5 | Trickery/Runes | ~10 | Thiazi, Svadilfari, Lokasenna, seidr, volva, Havamal |

---

## ageGroup Summary

| Category | Count | Examples |
|----------|-------|---------|
| **all** (ages 8+) | ~45 | Realm descriptions, creation myths, Thor's goats, Thrym disguise comedy, rune discovery |
| **teen+** (ages 13+) | ~31 | Ragnar's snake pit, lips sewn shut, Signy's revenge, berserker frenzy, Fafnir stabbed, Brynhild murder, Naglfar, Lokasenna |

Ratio: ~59% all, ~41% teen+ — meets the 40% minimum for `"all"`.

---

## Files Affected

| File | Action |
|------|--------|
| `data/deck-architectures/norse_mythology_arch.yaml` | CREATE — full architecture spec with pools, templates, confusions, source data |
| `data/deck-sources/norse_mythology/*.txt` | UPDATE — fetch Wikipedia articles for ~30 new entities |
| `data/decks/norse_mythology.json` | UPDATE — add ~76 new facts, update pools, templates, confusions, synonym groups |

---

## Verification Gate

- [ ] Architecture YAML exists with verified source data for all 76 new facts
- [ ] All sub-decks have 25+ facts
- [ ] Total deck reaches 220+ facts
- [ ] All new facts have 8+ distractors (LLM-generated, NOT from DB pools), 4 variants, ageGroup
- [ ] All new facts have sourceName + sourceUrl pointing to actually-consulted Wikipedia articles
- [ ] Every per-fact field present: id, correctAnswer, acceptableAlternatives, synonymGroupId, chainThemeId, answerTypePoolId, difficulty, funScore, distractors, quizQuestion, explanation, wowFactor, statement, visualDescription, sourceName, sourceUrl, volatile, ageGroup, variants
- [ ] Narrative arcs (Thrym theft, Utgard journey, Volsung saga, Ragnar Lothbrok) have 4+ connected facts
- [ ] hero_names pool has 14+ members; giant_names has 16+ members
- [ ] 8+ new confusion pairs seeded (including audit of existing 147 facts)
- [ ] 4 new question templates functional
- [ ] No purely historical facts without mythological connection (Erik the Red, Bjorn Ironside Luna anecdote removed)
- [ ] ageGroup: 40%+ of ALL 223 facts tagged "all"
- [ ] `npm run typecheck` passes
- [ ] Visual: Study Temple -> Norse Mythology -> play quiz from Thor's Adventures sub-deck

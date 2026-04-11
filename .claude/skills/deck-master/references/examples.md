# deck-master — Examples, Validation Cookbook, Grammar Standard, Visual Testing

**Parent skill:** [`../SKILL.md`](../SKILL.md) — `/deck-master`
**Covers:** Validation command cookbook, the Distractor Display Audit, Runtime Rendering Validation, Grammar Deck Quality Standard (golden reference), Sub-deck design examples, Visual In-Game Testing protocol, Automated Playtest, LLM Playtest final gate, the ship checklist, the Trivia Bridge step, and known integration points.

---

## Validation Command Cookbook

Run these after generation; fix all failures before committing.

### CRITICAL: Run the Deck Verifier (MANDATORY)

Before any other validation, run the deck verification script. This simulates every question the player would see — including bracket number generation, pool-based distractor selection, and answer display. It catches bugs that data-only checks miss.

```bash
node scripts/verify-curated-deck.mjs <deck_id>
```

**All facts must PASS.** If any fail, fix the data and re-run until clean. The script exits with code 1 on any failure.

The verifier checks: literal braces in answers, answer appearing in distractors, duplicate distractors, pool size violations, missing fields, bracket generation quality, and unplayable quiz states.

### Data Simulation Check

**After ALL data validation passes, simulate what the player actually sees for EVERY fact.** Data checks alone are not sufficient — the Solar System deck shipped with literal `{8}` answers and `{4.6}` distractors because data validation passed but nobody simulated the runtime display.

```bash
# Simulate runtime distractor selection for every fact
node -e "
const deck = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const factById = new Map(deck.facts.map(f => [f.id, f]));
let issues = 0;

deck.facts.forEach(f => {
  // 1. Check answer contains no braces
  if (f.correctAnswer.includes('{') || f.correctAnswer.includes('}')) {
    console.log('BRACE IN ANSWER:', f.id, '->', f.correctAnswer);
    issues++;
  }

  // 2. Simulate pool-based distractor selection (what curatedDistractorSelector.ts does)
  const pool = deck.answerTypePools.find(p => p.id === f.answerTypePoolId);
  if (!pool) {
    console.log('NO POOL:', f.id, '-> pool', f.answerTypePoolId, 'not found');
    issues++;
    return;
  }

  // Get pool member answers (what player would see as distractors)
  const poolDistractors = pool.factIds
    .filter(id => id !== f.id)
    .map(id => factById.get(id)?.correctAnswer || '???')
    .slice(0, 4);

  // Check if pool distractors make semantic sense with the question
  const hasNonsense = poolDistractors.some(d =>
    d.includes('{') || d.includes('}') || d === f.correctAnswer
  );
  if (hasNonsense) {
    console.log('NONSENSE DISTRACTOR:', f.id, '-> pool gives:', poolDistractors.join(', '));
    issues++;
  }

  // 3. Check fallback distractors (used when pool too small)
  if (f.distractors.length < 8 && pool.factIds.length < 6) {
    console.log('THIN POOL + FEW FALLBACKS:', f.id, '-> pool has', pool.factIds.length, 'members, fact has', f.distractors.length, 'fallbacks');
    issues++;
  }

  // 4. Check answer not in distractors
  if (f.distractors.includes(f.correctAnswer)) {
    console.log('ANSWER IN DISTRACTORS:', f.id);
    issues++;
  }

  // 5. Check duplicate distractors
  if (new Set(f.distractors).size < f.distractors.length) {
    console.log('DUPE DISTRACTORS:', f.id);
    issues++;
  }
});

console.log(issues ? issues + ' ISSUES FOUND — fix before shipping' : 'All ' + deck.facts.length + ' facts simulate clean');
"
```

**What this catches that basic validation misses:**

- Bracket answers showing literally (the `{8}` bug)
- Pool members being semantically wrong as distractors (moon counts as distractors for planet counts)
- Pools too small to generate enough distractors at runtime
- Correct answer appearing in distractor list after pool-based selection

---

## Distractor Display Audit — MANDATORY AFTER EVERY ASSEMBLY

**This is the #1 quality gate that catches issues invisible to structural validation.** Run this AFTER the structural validation script passes. It simulates what the player actually sees — the correct answer plus 3 pool-based distractors — and flags:

1. **Pool semantic pollution:** Pool members from obviously wrong categories appearing as distractors
2. **Long answers:** correctAnswer > 40 chars won't fit on quiz answer buttons
3. **Cross-category pools:** A pool containing both "Ionic bond" and "Hess's Law" is a junk drawer, not a distractor pool

**Run this script after every assembly:**

```bash
node -e "
const deck = JSON.parse(require('fs').readFileSync('data/decks/DECK_ID.json'));
const pools = new Map(deck.answerTypePools.map(p => [p.id, p]));
let issues = 0;

// CHECK 1: Long answers (>40 chars)
deck.facts.forEach(f => {
  if (f.correctAnswer.length > 40 && !f.correctAnswer.startsWith('{')) {
    console.log('LONG ANSWER (' + f.correctAnswer.length + ' chars): ' + f.id + ' -> \"' + f.correctAnswer.substring(0, 50) + '...\"');
    issues++;
  }
});

// CHECK 2: Pool display audit — show 3 sample questions per pool with their pool distractors
console.log('\n=== POOL DISPLAY AUDIT ===');
const byPool = {};
deck.facts.forEach(f => { if (!byPool[f.answerTypePoolId]) byPool[f.answerTypePoolId] = []; byPool[f.answerTypePoolId].push(f); });

Object.entries(byPool).forEach(([poolId, facts]) => {
  const pool = pools.get(poolId);
  const members = pool?.members || [];
  const synth = pool?.syntheticDistractors || [];
  console.log('\nPOOL: ' + poolId + ' (' + members.length + ' members)');

  // Sample 3 facts and show what distractors the player would see
  facts.slice(0, 3).forEach(f => {
    const candidates = [...members, ...synth].filter(m => m !== f.correctAnswer).slice(0, 3);
    console.log('  Q: ' + f.quizQuestion.substring(0, 70));
    console.log('  Choices: [' + f.correctAnswer.substring(0, 30) + '] vs [' + candidates.map(c => c.substring(0, 25)).join('] [') + ']');
  });
});

console.log('\n' + issues + ' long-answer issues found');
console.log('REVIEW EACH POOL ABOVE: Do the 4 choices look plausible together?');
console.log('If ANY pool shows obviously wrong-category distractors, the pool is POLLUTED — fix before shipping.');
"
```

**What to do when a pool is polluted:**

1. **Split the pool** into semantically coherent sub-pools (e.g., `law_and_equation_names` → split into `law_names`, `equation_formulas`, `model_names`, `chemistry_definitions`)
2. **Move facts** to the correct pool — each fact's `answerTypePoolId` must point to a pool where its `correctAnswer` makes sense as a distractor for every other member
3. **For facts with long/unique answers** that don't fit any pool: set a pool that will fall back to per-fact distractors (small pool or unique pool), ensuring 8+ pre-generated distractors are present

**The "dinner party test" for pool quality:** If you showed a friend all 4 answer choices for a question, would they all look like they COULD be the right answer? If one choice is from an obviously different category (e.g., "Bond length decreases" as a distractor for "What equation calculates pH?"), the pool is polluted.

**This check is NON-NEGOTIABLE. No deck ships without a distractor display audit.** The AP Chemistry deck (2026-04-03) passed all structural validation, automated playtest, and LLM playtest — but the pool distractors were nonsensical because workers assigned facts to the closest-sounding pool name rather than the semantically correct one. Only this audit caught it.

---

## Data Validation Commands

**Required fields check:**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const required = ['id','correctAnswer','acceptableAlternatives','chainThemeId','answerTypePoolId',
  'difficulty','funScore','distractors','quizQuestion','explanation','visualDescription','sourceName','ageGroup'];
let issues = 0;
facts.forEach(f => {
  const missing = required.filter(k => !(k in f));
  if (missing.length) { console.log('MISSING in', f.id, ':', missing.join(', ')); issues++; }
});
console.log(issues ? issues + ' facts with missing fields' : 'All fields present');
"
```

**Distractor count check (min 8):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const low = facts.filter(f => !f.distractors || f.distractors.length < 8);
low.forEach(f => console.log('LOW DISTRACTORS:', f.id, '(' + (f.distractors?.length ?? 0) + ')'));
console.log(low.length ? low.length + ' facts need more distractors' : 'Distractor counts OK');
"
```

**Pool size check (min 5 per pool):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const pools = {};
facts.forEach(f => { pools[f.answerTypePoolId] = (pools[f.answerTypePoolId] || 0) + 1; });
Object.entries(pools).forEach(([pool, count]) => {
  if (count < 5) console.log('POOL TOO SMALL:', pool, '(' + count + ' facts — need 5+)');
});
console.log('Pool check done.');
"
```

**Chain slot distribution check:**
```bash
# NOTE: Named chain themes with min-8-per-theme rules are NOT required for initial decks.
# Facts use generic slot indices (0-5) distributed evenly. This check just verifies
# the distribution is reasonably balanced — not enforcing a hard minimum.
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const slots = {};
facts.forEach(f => { slots[f.chainThemeId] = (slots[f.chainThemeId] || 0) + 1; });
const counts = Object.values(slots);
const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
Object.entries(slots).forEach(([slot, count]) => {
  const pct = Math.round((count / facts.length) * 100);
  console.log('Slot', slot + ':', count, 'facts (' + pct + '%)');
});
console.log('Average per slot:', Math.round(avg), '| Total slots used:', counts.length);
"
```

**Age group distribution check (min 40% kids-friendly):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const all = facts.filter(f => f.ageGroup === 'all').length;
const teen = facts.filter(f => f.ageGroup === 'teen+').length;
const other = facts.filter(f => !['all','teen+'].includes(f.ageGroup)).length;
const pct = Math.round((all / facts.length) * 100);
console.log('all (kids 8+):', all, '(' + pct + '%)');
console.log('teen+ (13+):', teen, '(' + Math.round((teen / facts.length) * 100) + '%)');
if (other) console.log('INVALID ageGroup:', other, 'facts');
if (pct < 40) console.log('FAIL: Only ' + pct + '% are kids-friendly — need at least 40%');
else console.log('Age distribution OK');
"
```

**Synonym group sanity (flag groups >4 facts):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const groups = {};
facts.forEach(f => { if (f.synonymGroupId) { groups[f.synonymGroupId] = (groups[f.synonymGroupId] || 0) + 1; } });
Object.entries(groups).forEach(([g, count]) => {
  if (count > 4) console.log('LARGE SYNONYM GROUP (may starve distractor pool):', g, '(' + count + ' facts)');
});
console.log('Synonym group check done.');
"
```

**Source URL check (all facts should have sourceUrl):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const noUrl = facts.filter(f => !f.sourceUrl);
noUrl.forEach(f => console.log('NO SOURCE URL:', f.id));
console.log(noUrl.length ? noUrl.length + ' facts missing sourceUrl' : 'All facts have sourceUrl');
"
```

**Volatile fact audit:**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const vol = facts.filter(f => f.volatile);
if (vol.length) {
  console.log(vol.length + ' volatile facts (need periodic review):');
  vol.forEach(f => console.log('  -', f.id, ':', f.correctAnswer));
} else {
  console.log('No volatile facts.');
}
"
```

**categoryL2 taxonomy check (if deck facts enter the global DB):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const bad = facts.filter(f => !f.categoryL2 || ['general','other',''].includes(f.categoryL2));
bad.forEach(f => console.log('BAD categoryL2:', f.id, '->', f.categoryL2));
console.log(bad.length ? bad.length + ' facts need valid categoryL2' : 'categoryL2 OK');
"
```

---

## Grammar Deck Quality Standard — GOLDEN REFERENCE

This section captures ALL quality requirements for grammar-type curated decks. It was derived from a deep audit of the Japanese N3 grammar deck (2026-03-29) and applies to ALL future grammar decks (N5, N4, N3, N2, N1, Korean, etc.).

### 1. Grammar Note Generation

All grammar-type curated decks MUST include a `grammarNote` field on every fact. This field provides a simple contextual explanation shown to the player when they answer incorrectly.

**How it works at runtime:**

- **Bold header**: Derived from the `explanation` field (part before ` — `). E.g., `"さえ (even; only; just)"`. Same for every fact using that grammar point. Shown in bold white text.
- **Contextual note**: The `grammarNote` field. A simple 1-2 sentence explanation of why this grammar point fits THIS specific sentence. Shown below the header.

**Generation rules for `grammarNote`:**

- Written by **Sonnet workers** during Phase 3 (Generation)
- 1-2 simple sentences, 80-150 characters
- Plain English, no linguistic jargon
- Explains why the grammar point fits this specific sentence (contextual clue)
- **NO distractor references** — distractors are selected dynamically at runtime
- **Do NOT repeat** the grammar point definition (that's shown in the bold header)
- Each worker receives grounded data: grammar point name + meaning, quiz question + translation, full sentence from explanation field

**Example:**

- Quiz: `食べ過ぎて、イチゴ{___}食べられない。` (I'm so full I couldn't even eat a strawberry.)
- Bold header: **さえ (even; only; just)**
- `grammarNote`: `"Emphasizes an extreme case — even a strawberry, the easiest food, is impossible to eat here."`

### 2. Fragment Answers — Tilde Display System

When the blank extraction produces a **fragment** of the grammar point (e.g., "くれ" instead of "てくれる"), the fact MUST use the tilde display system:

- Set `displayAsFullForm: true` on the fact
- At quiz time, ALL answer options (correct + distractors) are shown with `~` prefix + full canonical grammar point name: `~てくれる`, `~てあげる`, `~てしまう`
- **CRITICAL**: ALL options must consistently use the tilde format — NEVER mix tilde and non-tilde options, as this gives away the answer
- Distractors for tilde facts must be the full canonical names from the same confusion group
- The blank `{___}` stays in the sentence at the fragment position

**When does this happen?** Te-form auxiliaries where the verb is in て-form and the auxiliary is split: `読んであ{___}` (answer: "げる" from "あげる"). The fill-blank extraction catches the suffix but not the full auxiliary.

### 3. Distractor Quality — MANDATORY RULES

**CRITICAL LESSON (N3 audit, 2026-03-29):** 40-50% of distractors in the initial N3 deck were obviously wrong by grammatical form, letting students answer by elimination. This section prevents that.

**Rule A: Syntactic Slot Filtering (MANDATORY)**

- NEVER draw distractors from incompatible syntactic slots
- A `te_form_auxiliary` blank → ONLY te-form auxiliary distractors
- A `particle_post_noun` blank → ONLY particle distractors
- A `sentence_ender` blank → ONLY sentence-ender distractors
- Cross-slot contamination (e.g., particles in a verb-form question) is a blocking bug

**Rule B: Conjugation Form Matching (MANDATORY for verb-attached grammar)**

- When the blank answer is conjugated (e.g., "てしまった" past tense), ALL distractors MUST be in the same conjugation form (e.g., "ていた", "てあった", "てみた")
- The confusion groups file must include a conjugation table mapping each grammar point to its conjugated forms (past, polite, negative, past_negative, volitional, conditional, etc.)
- The build script MUST call `detectTeFormTense()` and `getMatchingConjugation()` — and these MUST handle all edge cases including fragment answers
- If conjugation matching fails for a fact, fall back to the tilde display system (Rule 2)

**Rule C: Confusion Group Priority**
Distractors are drawn in priority order:

1. **Same confusion group** (3-4 items) — semantically confusable, hardest
2. **Same syntactic slot, different group** (3-4 items) — grammatically compatible
3. **Broad pool within slot** (1-2 items) — only from the same syntactic slot, never cross-slot

**Rule D: No Stem Giveaways**
For grammar points that attach to verb stems (ようとする, ことにする), the preceding context often reveals the stem form. Distractors must:

- Be grammar points that can grammatically follow the same verb form
- NOT be obviously wrong because their stem doesn't fit the preceding verb

### 4. English Meaning Hints

Every grammar quiz question MUST include an English hint word in the translation that cues the grammar function:

```
食べ過ぎて、イチゴ{___}食べられない。
(I am so full I could not [even] eat a strawberry.)
```

- The `[bracketed word]` directly indicates which grammar function is being tested
- Stored as a `hintWord` field on each fact (e.g., "even", "because", "if", "apparently")
- Generated by Sonnet workers who compare the grammar point meaning against the English translation
- If the translation already clearly indicates the function, the hint may be omitted

### 5. Dictionary Hover (Word-Level Translation)

Grammar decks SHOULD support hover/tap word-level translation on the Japanese sentence text:

- Uses **kuromoji.js** for morphological analysis (tokenization + POS tagging)
- Maps tokens to **JMdict** entries for English glosses
- Each word in the quiz question is wrapped in a hoverable `<span>`
- On hover/tap: shows hiragana reading + primary English meaning
- **MUST NOT** highlight or translate the grammar point being tested (don't give away the answer)
- Helps learners understand sentence context when vocabulary is above their study level

### 6. Typing/Writing Mode

Grammar decks SHOULD support a typing response mode alongside multiple choice:

- Uses **wanakana** library for romaji→hiragana live conversion
- Text input field replaces answer buttons (configurable per deck or per mastery level)
- Answer validation: exact match + acceptable alternatives + politeness tolerance (casual/formal not penalized)
- On wrong: show correct answer + grammar note + allow retry
- Recommended activation: mastery level 3+ (students prove comprehension with MC first, then recall with typing)

### 7. Vocabulary Level Validation

All sentences in a grammar deck MUST be validated against the target JLPT level:

- Cross-reference sentence vocabulary against JLPT word frequency lists (N5→target level)
- Flag sentences containing vocabulary above the target level
- For flagged sentences: either replace with a simpler sentence OR add furigana + hover glosses for the advanced words
- This prevents N3 grammar learners from being blocked by N2+ vocabulary

### Enforcement Checklist (Grammar Decks)

Before marking a grammar deck as complete, verify ALL of the following:

- [ ] Every fact has a non-empty `grammarNote`
- [ ] Every fact has an `explanation` field in `"point (meaning) — sentence"` format
- [ ] Fragment answers use the tilde display system (`displayAsFullForm: true`)
- [ ] ALL distractors are from the same syntactic slot as the correct answer
- [ ] Conjugated answers have conjugation-matched distractors
- [ ] English translations include `[hint word]` for the grammar function
- [ ] No cross-slot distractor contamination (sample 20 facts across all slots)
- [ ] Vocabulary validated against target JLPT level
- [ ] `npm run typecheck` + `npm run build` + `npx vitest run` all pass
- [ ] Manual playtest: 10+ questions with genuinely confusable distractors

---

## Sub-Deck Design — When and How

Sub-decks let players focus on a subset of the deck's content. They appear as selectable options within the deck tile in Study Temple (like Japanese has Hiragana, Katakana, N5, etc.).

**When to create sub-decks:**

- The deck has 50+ facts AND contains natural groupings a player would want to study independently
- Each sub-deck must have 25+ facts to be viable (below that, the pool is too thin for good distractor variety)
- The groupings must make sense from the PLAYER's perspective, not just the data's structure
- A "Full Deck" option is always the default — sub-decks are optional focus modes

**When NOT to create sub-decks:**

- The deck has < 50 facts total (sub-decks would be too thin)
- The groupings are arbitrary (e.g., "facts 1-25" vs "facts 26-50")
- The answer pools would be too small within a sub-deck (< 5 confusable members per pool)

**Sub-deck design process:**

1. Look at the answer type pools — do any pools map naturally to a self-contained learning goal?
2. Check that each sub-deck has enough facts AND enough pool members for good distractor variety
3. Name sub-decks from the player's perspective: "Planets" not "Pool A", "Moons & Exploration" not "Sub-deck 2"
4. Add `subDecks` array to the CuratedDeck envelope with id, name, and factIds

**Examples by deck type:**

| Deck | Sub-decks | Rationale |
|------|-----------|-----------|
| Solar System (76 facts) | "Planets & System" (50), "Moons & Exploration" (29) | Kids want just planets; enthusiasts want deep space |
| Periodic Table (118 facts) | "Metals" (60+), "Non-metals & Noble Gases" (40+) | Chemistry students study these as distinct groups |
| World Capitals (195 facts) | "European Capitals", "Asian Capitals", "African Capitals", "Americas Capitals" | Geographic focus is how people study capitals |
| US Presidents (46 facts) | None — too small, and all facts use the same pool | Splitting would starve the distractor pools |
| Japanese N5 (800+ facts) | "Vocabulary", "Kanji", "Grammar" | Completely different content types and study goals |

**Architecture phase must decide sub-decks** — include them in the YAML spec so workers know which facts belong to which sub-deck. The orchestrator assigns `subDecks[].factIds` when building the envelope.

---

## Visual In-Game Deck Testing — MANDATORY

**After CLI validation passes (verify-curated-deck.mjs), test EVERY deck in-game before shipping.**

### Study Deck Scenarios

The scenario system supports instant deck quiz loading via `__rrScenario`:

```bash
# In Playwright browser_evaluate:
window.__rrScenario.load('study-deck-rome')           # Ancient Rome
window.__rrScenario.load('study-deck-greece')          # Ancient Greece
window.__rrScenario.load('study-deck-paintings')       # Famous Paintings (image quiz)
window.__rrScenario.load('study-deck-constellations')  # Constellations
window.__rrScenario.load('study-deck-cuisines')        # World Cuisines
window.__rrScenario.load('study-deck-medieval')        # Medieval World
window.__rrScenario.load('study-deck-inventions')      # Famous Inventions
window.__rrScenario.load('study-deck-egypt-myth')      # Egyptian Mythology
window.__rrScenario.load('study-deck-mammals')         # Mammals
window.__rrScenario.load('study-deck-anatomy')         # Human Anatomy

# Custom deck (any deck ID):
window.__rrScenario.loadCustom({ screen: 'restStudy', deckId: 'YOUR_DECK_ID' })
```

### What to check visually

1. **Quiz loads without error** — no console errors, question text displays
2. **Distractors make sense** — are the 4 choices plausible? No nonsense answers?
3. **Image quizzes render** — for `image_question` decks, does the painting/flag show?
4. **Text fits** — long questions don't overflow the quiz box
5. **Answer selection works** — clicking an answer shows correct/wrong feedback

### Adding new deck scenarios

When creating a new deck, add a preset to `src/dev/scenarioSimulator.ts` SCENARIOS object:
```typescript
'study-deck-SHORTNAME': {
  screen: 'restStudy',
  deckId: 'YOUR_DECK_ID',
},
```

### Full deck validation pipeline (BOTH gates required)

```bash
# Gate 1: CLI structural validation
node scripts/verify-curated-deck.mjs DECK_ID

# Gate 2: Visual in-game test (via Docker warm)
scripts/docker-visual-test.sh --warm test --agent-id deck-<id> \
  --actions-file /tmp/deck-test.json --scenario none --wait 5000
# actions-file calls __rrScenario.load('study-deck-SHORTNAME') + __rrScreenshotFile + __rrLayoutDump
```

---

## Automated Playtest — MANDATORY (replaces manual in-game testing)

**After all data validation passes, run the automated deck playtest.** This imports the REAL game code (fact selector, template renderer, distractor selector, learning step tracker) and simulates a full study mode session. No browser needed.

```bash
# All correct — verify Anki queue interleaving and question quality
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts <deck_id> --charges 30 --verbose

# With wrong answers — verify learning queue brings them back
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts <deck_id> --charges 25 --wrong-rate 0.3 --verbose

# Deterministic replay (same seed = same sequence)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts <deck_id> --charges 20 --seed 42 --verbose
```

**What it checks per charge:**

- Unresolved `{placeholder}` patterns in rendered questions
- Braces in displayed answers
- Correct answer leaking into distractors
- Duplicate distractors
- Back-to-back fact repeats
- Fewer than 2 distractors
- Empty question or answer text

**What the summary reports:**

- Unique facts seen vs charges (Anki interleaving quality)
- Learning/review/new queue hit distribution
- Total issues found (exit code 1 if any)

**Run BOTH all-correct and wrong-rate tests.** All-correct verifies new card introduction. Wrong-rate verifies the learning queue brings back wrong answers aggressively.

---

## Runtime Rendering Validation

After generating or modifying a curated deck, run the audit script to verify questions render correctly in-game:

```bash
node scripts/audit-quiz-display.mjs
```

This renders every questionTemplate × fact combination exactly as players see it, and flags: trivial questions (answer in question text), short questions (<15 chars), missing distractors, and duplicate distractors. Fix all flags before publishing.

---

## LLM Playtest — Final Gate Before Deck Ships

**After automated playtest passes, an LLM agent must play through the deck as a real player.** This is the FINAL quality gate. The agent reads each question, evaluates the answer choices, picks one (sometimes wrong on purpose), and judges quality from a player's perspective. No code check catches "this question is confusing" or "these distractors are too obvious" — only an LLM reading them naturally can.

### How to run

Spawn a **Haiku sub-agent** (`model: "haiku"`) with the playtest output and this prompt:

```
You are playtesting a curated quiz deck for the game Recall Rogue. Below is a simulated
play session showing 30 quiz charges. For each question, evaluate:

1. QUESTION CLARITY: Is the question clear and unambiguous? Would a player understand what's being asked?
2. ANSWER CORRECTNESS: Is the stated correct answer actually correct? Flag any factual errors.
3. DISTRACTOR QUALITY: Are the wrong answers plausible but clearly wrong? Flag if:
   - A distractor is actually correct (secretly right answer)
   - Distractors are too obvious (trivially eliminatable)
   - Distractors are nonsensical for this question type
4. LEARNING VALUE: Does this question teach something? Or is it pure rote recall?
5. REPETITION FEEL: As you go through the sequence, does it feel varied? Or tedious?
6. PROGRESSION: Do the learning queue returns feel natural? (Cards you got wrong should come back.)

Rate the deck overall:
- Question quality (1-10)
- Distractor quality (1-10)
- Variety/pacing (1-10)
- Educational value (1-10)

List ALL issues found, no matter how minor. Be harsh — we want to catch everything.
```

### What to feed the agent

Run the automated playtest with `--verbose` and capture the output:

```bash
# Generate the playtest transcript
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  scripts/playtest-curated-deck.ts <deck_id> --charges 30 --seed 42 --verbose > /tmp/deck-playtest.txt 2>&1

# Also run a wrong-answer session
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  scripts/playtest-curated-deck.ts <deck_id> --charges 20 --wrong-rate 0.3 --seed 99 --verbose >> /tmp/deck-playtest.txt 2>&1
```

Then spawn the Haiku agent with the contents of `/tmp/deck-playtest.txt` plus the evaluation prompt above.

### Ship Checklist — EVERY curated deck must pass ALL of these

Before a deck can ship, check off every item:

- [ ] **Static verification clean** — `node scripts/verify-curated-deck.mjs <deck_id>` → 0 failures
- [ ] **Automated playtest clean (all correct)** — `playtest-curated-deck.ts --charges 30` → 0 issues
- [ ] **Automated playtest clean (wrong answers)** — `playtest-curated-deck.ts --charges 20 --wrong-rate 0.3` → 0 issues
- [ ] **LLM playtest: question clarity** — Haiku agent rates 7+ / 10, no confusing questions flagged
- [ ] **LLM playtest: answer correctness** — Zero factual errors found by the agent
- [ ] **LLM playtest: distractor quality** — Haiku agent rates 7+ / 10, no secretly-correct distractors
- [ ] **LLM playtest: variety/pacing** — Haiku agent rates 7+ / 10, Anki queue feels natural
- [ ] **LLM playtest: educational value** — Haiku agent rates 7+ / 10, questions teach not just test
- [ ] **Learning queue verified** — Wrong answers return after 2 charges, correct advance through steps
- [ ] **Distractor Display Audit passed** — Ran the pool display audit script, reviewed every pool's sample questions, confirmed all 4 answer choices look plausible together. No wrong-category distractors. No answers >40 chars.
- [ ] **In-game quiz audit passed** — Sampled **50 facts** stratified across difficulty levels (1-5), sub-decks, and answer pools (seeded random draw within each stratum). Displayed Q + 4 answer options for each, confirmed distractors are plausible in length, format, and category. Grepped for grammar-scar patterns (`\b[adjective] this\b`, `\bthe this\b`) and placeholder leaks. No trivially eliminatable distractors. See `.claude/rules/deck-quality.md` § "50-Fact Sampling Protocol". 20-sample checks were the prior standard but missed placeholder leaks clustered in obscure sub-decks (confirmed 2026-04-10).
- [ ] **Bracket numbers clean** — Numeric answers display without braces, distractors are plausible nearby numbers
- [ ] **Wow factors present** — Every fact has a deck-specific wowFactor string

**If ANY checklist item fails, fix and re-run until ALL pass. No exceptions.**

---

## Step 7: Trivia Bridge (Knowledge Decks Only)

**After ALL validation gates pass, bridge the deck into the trivia database.** This is MANDATORY for knowledge decks and must happen before committing.

Language/vocabulary decks (JLPT, HSK, CEFR, TOPIK, Hangul, Hiragana, Katakana) and image-only decks are exempt.

1. Add the deck to `scripts/content-pipeline/bridge/deck-bridge-config.json`:
   - `domain` — trivia domain category
   - `prefixSegments` — number of leading ID segments to skip (deck prefix + chain abbreviation)
   - `entitySegments` — how many segments form the entity key (usually 1-2)
   - `ageRating` — "kid" or "teen"
   - `categoryL2` — sub-category within the domain
2. Run: `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs`
3. Verify: 0 ID collisions, deck appears in output with expected entity count
4. Commit `bridge-curated.json` + `bridge-manifest.json` + `deck-bridge-config.json` alongside the deck

**Use `/curated-trivia-bridge` skill for the full workflow.** See `docs/content/trivia-bridge.md` for entity grouping and scoring details.

---

## In-Game Visual Testing — Supplementary Manual Checklist

**After all automated and LLM testing passes, optionally verify in the browser.** This catches rendering/layout issues that code-level tests can't see (font overflow, z-index, animation).

### After every deck ships, verify in-game

1. **Start a Study Temple run** with the new deck
2. **Play through at least 10 charge quizzes** and verify:
   - Domain label at top matches the deck's domain (e.g., "SPACE & ASTRONOMY", not random)
   - Questions vary — not the same question repeating
   - Answers display cleanly (no `{braces}`, no truncation)
   - Distractors are plausible wrong answers from the correct pool (not random values from other pools)
   - Bracket-number facts show clean numbers with runtime-generated numeric distractors
3. **Check the console** for `[CuratedDecks]` log showing the deck loaded with correct fact count
4. **Test at least one bracket-number fact** — verify braces are stripped and distractors are nearby plausible numbers
5. **No fact repeats within 3 charges** (Anki cooldown system)
6. **Wrong answers come back after ~2 other facts** (learning queue)
7. **New facts introduced gradually**, not all at once
8. **Wow factor popup shows deck-specific text**, not trivia from other domains
9. **Wow factor shows max 3 times per encounter**, no duplicates

### Known integration points to verify

| Component | What to check | Past bug |
|-----------|--------------|----------|
| Domain label on cards | Must show deck domain, not random trivia domain | Study mode used general pool → random domains (fixed in encounterBridge.ts) |
| Bracket answers | Must display without `{}` braces | Curated path didn't call `displayAnswer()` (fixed in nonCombatQuizSelector.ts + CardCombatOverlay.svelte) |
| Question variety | Different questions per charge in same encounter | Seeded PRNG used same seed for all charges in encounter (fixed in curatedFactSelector.ts via chargeCount) |
| Pool distractors | Must be semantically appropriate | bracket_numbers pool members showed as distractors for each other (fixed: bracket facts use runtime generation) |
| Deck loads | Console shows `[CuratedDecks] Loaded N deck(s)` | Deck not in manifest → invisible |
| CuratedDeck envelope | Must have answerTypePools, questionTemplates, difficultyTiers | Flat array of facts → runtime crash |
| Distractor dedup | No duplicate answer text in choices; correct answer never appears as distractor | Multiple pool facts with same correctAnswer (6 Jupiter facts) caused "Jupiter" showing 3x as distractor (fixed: dedup by answer value in curatedDistractorSelector.ts) |
| Wow factor popups | Must show curated deck fact's wowFactor, not random trivia facts | showWowFactor() read from trivia DB instead of curated deck (fixed: branches on deckMode, reads __studyFactId) |
| Fact selection | Anki three-queue system: learning > review > new, charge-based cooldowns | Old weighted random picked same fact repeatedly (fixed: three queues with charge cooldowns in curatedFactSelector.ts + inRunFactTracker.ts) |

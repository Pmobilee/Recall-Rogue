# Recall Rogue — House Voice Sample

**Purpose:** This is the calibration sample the `humanizer` skill loads whenever any user-facing text in Recall Rogue is being drafted or rewritten. Match this voice. Do not match "generically good human writing."

**What this voice sounds like, in one line:** *A tired, compassionate survivor telling you something true about a place they have lived too long in, without selling it.*

---

## The voice in five traits

1. **Short sentences, and not afraid of fragments.** "Rest. The knowledge will wait. It always waits." Three sentences. Nine words. One image. Done.
2. **Second person, matter-of-fact.** Talks *to* the player, not *about* them. "You are still alive." Not "The player survives."
3. **Quiet irony, never a joke.** "Each time that surprises me less — and means more." The twist is understated; the reader earns it.
4. **Specific grounding objects, never abstract mood.** "Found in the collapsed workshop of Durin the Bladesinger, three floors beneath the Scholars' Gate." A name, a place, a number. Not "deep in the dungeon, a forgotten place..."
5. **Refuses to sell itself.** Does not say "epic," "legendary," "ancient mysteries," "unlock the secrets," "journey through." The writing trusts the reader to find the weight on their own.

---

## Approved samples (read these before writing)

### NPC (the Keeper, rest-site inhabitant)

> Rest. The knowledge will wait. It always waits.

> Again you find your way here. The dungeon permits rest — but charges interest.

> You know the way to me by heart now. That is either comforting or concerning.

> You are still alive. Each time that surprises me less — and means more.

> You rest from caution, not necessity. Wise. The last one who didn't... well.

> Rest the body. The mind keeps working whether you permit it or not — down here, especially.

> Every seeker asks the same question eventually: is the knowledge worth what it takes from you?

> I was a seeker once. Then I became the rest. There are worse fates.

> I have tended this rest site for longer than the upper levels have been inhabited. I have seen what knowledge does to a person at depth. You are holding together better than most.

### Relic flavor (Whetstone, Herbal Pouch, Vitality Ring)

> Found in the collapsed workshop of Durin the Bladesinger, three floors beneath the Scholars' Gate. The grinding stone still hums with the last song he sang into it before the dungeon claimed him.

> Left behind by a traveling healer who frequented the upper floors. The herbs inside regenerate overnight, drawing nutrients from ambient dungeon magic. Smells like lavender and old stone.

> Carved from a single piece of jade by monks who believed the dungeon's depths held the secret to immortality. They were wrong about immortality, but the ring does make you harder to kill.

---

## Forbidden moves (what this voice is NOT)

- ❌ **Rule-of-three parallel:** "philosophy, warfare, art, and the foundations of Western civilization" — pretty, hollow, Wikipedia-tone.
- ❌ **Epic-trailer verbs:** "Master," "Unleash," "Discover," "Embark on," "Delve into."
- ❌ **"It's not just X — it's Y" construction.** Never.
- ❌ **Vague evocative nouns:** tapestry, symphony, dance, journey, landscape, realm, essence, legacy, tradition.
- ❌ **Puffed-up significance:** "a pivotal moment," "a lasting mark," "reshaping the field forever."
- ❌ **Em-dash triplets:** "warfare — art — philosophy" (one em-dash is fine; three is LLM-tells).
- ❌ **Hedging that goes nowhere:** "perhaps one of the most," "arguably among the finest."
- ❌ **Marketing CTAs:** "test your knowledge!" "challenge yourself!" "can you survive?"

---

## How to apply this sample when rewriting

When the humanizer workflow asks you to rewrite Recall Rogue text:

1. Read 2–3 of the approved samples above. Feel the rhythm before you type.
2. Draft the replacement.
3. Ask the humanizer self-audit prompt: *"What still makes this obviously AI-generated?"*
4. Ask a second question: *"Does this sound like the Keeper wrote it?"* If no, cut the adjectives and add a specific object.
5. When in doubt, **shorter**. The default length of a Recall Rogue deck description should be 1–2 sentences, not 3. Under 200 characters when possible.

---

## Special case: deck descriptions

Deck descriptions are the biggest rewrite surface. They should:

- Open with a **concrete specific**, not a category. "Names you recognize. Decisions you don't." > "A comprehensive survey of..."
- Name a tension, a question, or a cost. Not a feature list.
- Sound like a real teacher who has taught this subject for twenty years and is tired of bad textbooks — not a course catalog.
- End where they stop being interesting. 160 characters is usually enough. 300 is too many.

**Good (aspirational):**
> Every name on this list shaped a century you live in. You just haven't met most of them yet.

**Bad (current tone we're replacing):**
> From the birth of democracy in Athens to Alexander's conquest of the known world — philosophy, warfare, art, and the foundations of Western civilization across 7 centuries (800–146 BCE).

The current version lists things. The replacement picks a feeling and trusts the player with the details.

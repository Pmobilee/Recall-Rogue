# spanish_a2_grammar — Expectations

## 1. Intended Scope
CEFR A2 grammar — expanding past-tense system (preterite and imperfect), direct/indirect object pronouns, reflexive verbs, gerunds, comparatives, imperative (tú), and the por/para distinction. Key challenge: learners must differentiate preterite vs imperfect and master new irregular paradigms.

## 2. Canonical Source
- Instituto Cervantes PCIC A2 grammatical inventory
- Standard A2 grammar syllabi (preterite paradigm is defining A2 content)

## 3. Sub-deck / Chain Theme List
8 sub-decks / 8 chain themes (PCIC-aligned):
- Preterite (AR, ER/IR, irregular forms)
- Imperfect (AR, ER/IR, ser/ir/ver)
- Perfect & Progressive (haber + PP, gerunds)
- Object Pronouns (DO, IO, reflexive)
- Comparatives
- Imperative (tú)
- Por vs. Para
- Muy vs. Mucho

## 4. Answer Pool Inventory
25 fine-grained pools. All pools meet minimum factIds ≥5, all padded with synthetic distractors (7–13 synthetics per pool). Fill-in-blank `{___}` template throughout.

## 5. Expected Quality Bar
- Preterite vs imperfect choice questions should have English translation that does NOT reveal the intended aspect (completed vs habitual)
- Object pronoun questions (me/te/se/lo/la) should have translation that doesn't reuse the English equivalent
- por/para pool: distractors should be only `por`, `para`, and semantically plausible alternatives (not unrelated full sentences)

## 6. Risk Areas
1. **SELF-ANSWERING via translation for object pronouns (HIGH)**: "¿{___} llamas mañana?" with translation "Will you call ME tomorrow?" — "me" appears directly in English.
2. **SYNTHETIC-WEAK in por/para pool (MEDIUM)**: Distractor `vamos a comer` (let's eat) is a full verb phrase, not a preposition — radically different form from `por`/`para`. Easy to eliminate by form alone.
3. **LENGTH-TELL in time-expression pools (MEDIUM)**: `antes` (5 chars) vs `la semana pasada` (16 chars) — time-expression pools mix words and full phrases.
4. **Imperfect vs preterite conflation**: Some imperfect drill sentences could be answered with a preterite form and still be grammatically valid — ambiguity risk.
5. **Imperative pool conflict with reflexive pool**: `imperative_tu` pool (15 facts) and `reflexive_conjugations` pool (13 facts) could overlap for reflexive imperatives.

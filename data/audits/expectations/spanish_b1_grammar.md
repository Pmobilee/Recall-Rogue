# spanish_b1_grammar — Expectations

## 1. Intended Scope
CEFR B1 grammar — present subjunctive (regular and core irregular verbs), full imperative system (negative tú, formal usted/ustedes, nosotros), conditional and future tenses, compound past (haber + PP), double object pronouns, relative pronouns, si-clauses (Type 1: open condition), and common verbal periphrases.

## 2. Canonical Source
- Instituto Cervantes PCIC B1 grammatical inventory
- Presence of present subjunctive is the defining B1 marker vs A2

## 3. Sub-deck / Chain Theme List
8 sub-decks / 8 chain themes:
- Present Subjunctive (regular + major irregulars)
- Imperative: All Persons (negative tú, formal, nosotros)
- Simple Conditional
- Simple Future
- Compound Past (pluperfect)
- Object Pronouns: Advanced
- Relative Pronouns
- Si-Clauses + Periphrasis

## 4. Answer Pool Inventory
23 pools. All meet ≥5 factIds; all padded with synthetic distractors (7–15 synthetics each). Si-clause pool (5 facts + 11 synthetics) is smallest real pool. All facts tagged `partOfSpeech: grammar`.

## 5. Expected Quality Bar
- Subjunctive pools: all options must be present subjunctive forms (not indicative) for correct semantic competition
- Si-clause pool: distractors must be other valid si-clause connector patterns, not full sentences or tangential grammar labels
- Periphrasis pool: options must all be periphrastic forms (verb + infinitive/gerund) — not bare conjugations

## 6. Risk Areas
1. **SYNTHETIC-WEAK in si-clause pool (HIGH)**: Distractors `cuando + subjuntivo` and `aunque + indicativo` are meta-linguistic grammar labels, not actual fill-in-blank answers. A real sentence slot takes a conjunction like `si`, not a "conjunction + mood" description. Eliminatable by form.
2. **LENGTH-TELL driven by synthetic-weak (HIGH)**: `si` (2 chars) vs `cuando + subjuntivo` (19 chars) — ratio 9.5x, highest in all grammar decks.
3. **Conditional vs future overlap**: Some contexts allow either conditional or future; facts testing one may have the other as a plausible correct answer.
4. **Pronoun placement pool**: `pronoun_placement_full` (8 facts) tests position of combined DO+IO pronouns — highly complex; distractor quality depends on having valid but wrong placement patterns.
5. **Template fallback for all items**: All 69 quiz items use `_fallback` template. No forward/reverse mode variation — all grammar decks uniform but limits mastery-level progression variety.

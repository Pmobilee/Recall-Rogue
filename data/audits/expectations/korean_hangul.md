# korean_hangul — Expectations

## Scope
Complete Korean Hangul system: 19 consonants (자음) + 21 vowels (모음) + composite vowels = 108 facts. Forward (character → romanization) facts only, based on structure observed.

## Canonical Source
Standard Korean Hangul Chart. Romanization system: Revised Romanization of Korean (국립국어원 표준 로마자 표기법) — official standard since 2000.

## Sub-decks
None.

## Pool Inventory
| Pool | Facts | Synth |
|------|-------|-------|
| english_meanings | 108 | 0 |

## Difficulty Distribution
Difficulty 1–2 (basic chart, no complex progressions observed).

## Quiz Template
`_fallback` exclusively (100% of 90 sampled rows).

## Quality Bar
- Answer romanization must use Revised Romanization (not McCune-Reischauer)
- Dual-sound consonants (ㄱ = g/k depending on position) handled via slash notation
- Distractors should be romanizations of other hangul characters, not hangul characters when answer is romaji

## Risk Areas
1. **POS-TELL (script mixing)** — 75 of 90 rows mix hangul characters and romaji romanizations in same option set; e.g., options `['ㅓ', 'n', 'yu']` where correct is `yu` — the only romaji string is immediately identifiable
2. **SELF-ANSWERING** — 3 confirmed cases: `ko-hangul-oe-forward` ("What sound does ㅚ represent?" → answer "oe" appears as substring in romanization context)
3. **Dual-value romanizations** — consonants like ㄱ (g/k), ㄷ (d/t), ㅂ (b/p) have context-dependent pronunciation; slash notation answers like "g/k" may create AMBIGUOUS-Q
4. **Single pool** — 108 facts in one pool; no separation of consonants vs vowels; distractor variety is limited
5. **No synthetic distractors** — 0 synth

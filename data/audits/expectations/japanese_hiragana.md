# japanese_hiragana — Expectations

## Scope
Complete hiragana syllabary: 46 base characters + dakuten/handakuten variants + digraphs = 208 facts. Two facts per character: forward (character → romanization) and reverse (romanization → character).

## Canonical Source
Standard Japanese Kana Chart (universal standard; no single authoritative URL needed).

## Sub-decks
None.

## Pool Inventory
| Pool | Facts | Synth |
|------|-------|-------|
| english_meanings | 208 | 0 |

Single pool holds both forward and reverse facts — script mixing expected.

## Difficulty Distribution
Difficulty 1–5 assigned by character complexity (basic vowels = 1, digraphs = 5).

## Quiz Template
`_fallback` exclusively (100% of 90 sampled rows). No specialized kana template.

## Quality Bar
- Forward: character shown, answer is romanization string (Hepburn system)
- Reverse: romanization shown, answer is hiragana character
- Distractors must match the answer type (hiragana for reverse, romaji for forward)
- Romanization must be consistent (Hepburn: し=shi, ち=chi, つ=tsu)

## Risk Areas
1. **POS-TELL (script mixing)** — 82 of 90 rows mix hiragana characters and romaji strings in the same option set; correct answer is identifiable as the only item in the correct script
2. **POOL-CONTAM** — single `english_meanings` pool means forward facts (answer: romaji) and reverse facts (answer: hiragana) draw distractors from the same pool, producing script mismatches
3. **No synthetic distractors** — 0 synth; with only 208 facts in one pool, distractor variety is inherently limited
4. **SELF-ANSWERING** — `ko-hangul-oe-forward` pattern seen in related hangul deck; "What sound does ㅚ represent?" with answer "oe" — the sound IS in the question phrasing
5. **Romanization consistency** — verify Hepburn vs Kunrei-shiki uniformity across all 208 facts (e.g., し = shi vs si)

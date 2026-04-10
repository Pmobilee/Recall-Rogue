# chess_tactics — Expectations

## Intended Scope
300 curated chess tactics puzzles sourced from the Lichess Puzzle Database, covering 10 tactic categories: knight forks, pins/skewers, discovered attacks, mate in one, mate in two, sacrificial combinations, deflection/decoy, trapped pieces, endgame technique, and back-rank mating nets. Rated from ~750 to ~2000+ Lichess Elo.

## Canonical Source
Lichess Puzzle Database (https://database.lichess.org/#puzzles) — each puzzle has a verified Lichess game URL (`sourceUrl`). The FEN positions and solution sequences are sourced directly from engine-verified game continuations. This is the strongest sourcing of any deck in this batch.

## Sub-Deck / Chain Theme List
10 sub-decks (one per tactic category), each with 30 facts. No chain themes populated.

## Answer Pool Inventory
10 pools, each pool matches its sub-deck:
| Pool | Facts | Synthetics | Notes |
|------|-------|------------|-------|
| chess_moves_knight_forks | 30 | 24 | Padded to 54 |
| chess_moves_pins_skewers | 30 | 24 | Padded |
| chess_moves_discovered_attacks | 30 | 24 | Padded |
| chess_moves_mate_in_one | 30 | 24 | Padded |
| chess_moves_mate_in_two | 30 | 24 | Padded |
| chess_moves_sacrificial_combinations | 30 | 24 | Padded |
| chess_moves_deflection_decoy | 30 | 24 | Padded |
| chess_moves_trapped_pieces | 30 | 24 | Padded |
| chess_moves_endgame_technique | 30 | 24 | Padded |
| chess_moves_back_rank_mating_nets | 30 | 24 | Padded |

## Expected Quality Bar
High for FEN validity. The quizMode `chess_tactic` / quizResponseMode `chess_move` means the player types their answer (SAN notation) rather than selecting from multiple choice. The "options" array will contain only the correct answer — this is by design, not a defect. FEN and solutionMoves are the critical fields.

## Risk Areas
1. **FEN validity** — invalid FEN strings would prevent board rendering. Each FEN must have 8 ranks, valid piece counts, and correct side-to-move indicator.
2. **solutionMoves format** — Lichess format: `solutionMoves[0]` is the opponent's last move that set up the tactic (the FEN position reflects AFTER this move); `solutionMoves[1]` is the player's winning first move (should match `correctAnswer`). This is counterintuitive but by design.
3. **tacticTheme vs pool mismatch** — themes from Lichess (fork, pin, mateIn1, mateIn2, mateIn4, etc.) may not map 1:1 to the 10 pool names.
4. **correctAnswer SAN notation** — must be valid SAN (Standard Algebraic Notation) matching the piece movement described by `solutionMoves[1]`.
5. **Synthetic distractors in chess move pools** — the 24 synthetic moves per pool are LLM-generated SAN strings. They must look like plausible chess moves but not be the correct answer.

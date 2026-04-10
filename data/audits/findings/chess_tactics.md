# chess_tactics — Quiz Audit Findings

## Summary
90 quiz dump entries (30 facts × 3 mastery levels). All 300 chess facts validated against FEN piece positions and UCI move notation. The `quizResponseMode="chess_move"` design means `options.length===1` for all entries — this is correct behavior (text input, not MCQ). Two facts have corrupt `solutionMoves[0]` data (invalid setup move for the given position), but their player-facing answer data (`correctAnswer`, `solutionMoves[1]`) is valid. Two facts have a `tacticTheme` vs pool mismatch (categorized as `mateIn4` but pooled in `back_rank_mating_nets`).

## Issues

### BLOCKER (data integrity, not gameplay-blocking)

- **Fact**: `chess_tac_AHPUU` @ mastery=0,2,4
- **Category**: `CHESS-BROKEN`
- **Rendered**:
  Q: "White to move. [#AHPUU]"
   A) Rf6+ ✓
- **FEN**: `7r/7p/3p3k/p1p3p1/8/3KQRb1/7q/8 w - - 0 49`
- **Issue**: `solutionMoves[0]` = `"g6g5"`. Board analysis shows g6 is an empty square in this FEN (rank 6 = `3p3k`: empty g6, black pawn d6, black king h6). A piece moving FROM g6 is impossible. The Lichess-format setup move is corrupted. However: `solutionMoves[1]` = `"f3f6"` (White rook on f3 to f6) is valid and consistent with `correctAnswer` = "Rf6+". The puzzle answer is correct; only the pre-position setup record is corrupt. Gameplay impact: if the game engine uses `solutionMoves[0]` to validate the prior-move context, this puzzle will fail that check.

---

- **Fact**: `chess_tac_KZU69` @ mastery=0,2,4
- **Category**: `CHESS-BROKEN`
- **Rendered**:
  Q: "Black to move. [#KZU69]"
   A) Qxf2+ ✓
- **FEN**: `5rk1/1p4p1/p3pq2/1P1p4/P7/2rR3Q/5PPP/5RK1 b - - 1 25`
- **Issue**: `solutionMoves[0]` = `"d2d3"`. Board analysis shows d2 is empty in this FEN (rank 2 = `5PPP`: only f2, g2, h2 are pawns; d2 is empty). Cannot move from an empty square. Same pattern as AHPUU: setup move is corrupt, but player-facing answer data is valid (`solutionMoves[1]` = `"f6f2"`, Black queen on f6 to f2 = Qxf2+, correctly matches `correctAnswer`).

---

- **Fact**: `[all 90 chess entries]`
- **Category**: `OTHER`
- **Issue**: `options.length === 1` for all 90 quiz dump entries. This is the correct behavior for `quizResponseMode: "chess_move"` (player types the move as text input; the single option is the correct answer shown after the fact is answered). Not a defect. Flagged here only because the automated structural check will report it as a POOL-CONTAM (fewer than 3 options) — the checker needs a chess-tactic exemption.

### MAJOR

- **Fact**: `chess_tac_AHPUU`, `chess_tac_KZU69` @ mastery=0,2,4
- **Category**: `OTHER`
- **Rendered** (both facts):
  `tacticTheme: "mateIn4"`, `answerTypePoolId: "chess_moves_back_rank_mating_nets"`
- **Issue**: The Lichess `tacticTheme` for both facts is `"mateIn4"` (a 4-move forced mate), but the pool assignment is `chess_moves_back_rank_mating_nets`. These are back-rank mates (forced mate via back rank weakness), which is a legitimate categorization. However the theme label inconsistency (`mateIn4` vs `backRankMate`) means the deck metadata is contradictory — the tactic is both a "4-move mate" and a "back-rank mate" but only one can be the pool category. Players studying "Back-Rank Mating Nets" will encounter `mateIn4` puzzles that may require different thinking than typical back-rank traps.

## Expected vs Actual
Expected FEN validity issues. Actual: all 300 FEN positions pass basic validation (8 ranks, 1 king per side, valid piece counts). The solutionMoves[0] corruption was unexpected — 2 of 30 facts (6.7%) have invalid setup moves. The player-facing data (correctAnswer, solutionMoves[1]) is valid for all 300 facts, so the puzzles are playable. The tacticTheme/pool mismatch for 2 facts is a metadata issue, not a gameplay blocker.

## Notes
- All 30 facts in the sample use `templateId: "passthrough"` — the rendered question is `"{side} to move. [#{factId}]"` which is correct for chess tactic rendering (the board UI provides the actual content).
- FEN side-to-move vs rendered question text ("Black to move" / "White to move") matches 100% across all 90 entries. No mismatches.
- All `correctAnswer` fields are in valid SAN notation. All `solutionMoves[1]` fields (the actual player move) are valid UCI notation referencing occupied squares.
- Tactic theme distribution across 30 sampled facts: fork ×3, pin ×3, discoveredAttack ×3, mateIn1 ×3, mateIn2 ×3, sacrifice ×3, deflection ×3, hangingPiece ×3, endgame ×3, mateIn4 ×2, backRankMate ×1. Good spread across categories.
- **Fix priority**: (1) Investigate `chess_tac_AHPUU` and `chess_tac_KZU69` in the source deck JSON — verify the Lichess game URL, re-extract the correct FEN pre-position and setup move sequence. (2) If the game engine validates `solutionMoves[0]` for position continuity, update these two records. (3) Clarify whether `mateIn4` puzzles belong in `back_rank_mating_nets` pool or should be moved to `mate_in_two` (closest existing pool).

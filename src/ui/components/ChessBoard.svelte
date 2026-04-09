<script lang="ts">
  /**
   * ChessBoard.svelte
   *
   * Interactive chess board for the chess_tactic quiz response mode.
   *
   * Tap-tap interaction model:
   *   1. Player taps own piece → selected (golden ring, legal move dots shown)
   *   2. Player taps highlighted destination → move fires, onmove callback invoked
   *   3. Player taps elsewhere → deselects
   *   4. Player taps different own piece → selects that piece instead
   *
   * Piece images served from /assets/chess/pieces/{color}{piece}.svg
   * FEN parsing done locally — no server round-trip needed for rendering.
   * Legal move computation via chess.js (imported directly).
   */

  import { Chess } from 'chess.js'
  import type { Square } from 'chess.js'

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface PieceInfo {
    color: 'w' | 'b'
    piece: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
  }

  interface Props {
    /** Current board position in FEN notation. */
    fen: string
    /** Which side faces the player at the bottom. */
    orientation: 'white' | 'black'
    /** Callback when the player makes a legal move. Receives UCI string (e.g. "e2e4"). */
    onmove: (uci: string) => void
    /** Lock board after answer. Default: false. */
    disabled?: boolean
    /** Highlight squares of the last move (subtle yellow tint). */
    lastMove?: { from: string; to: string }
    /** Optional hint squares to highlight green. */
    highlightSquares?: string[]
    /** When true, apply red tint to the active side's king. */
    isInCheck?: boolean
  }

  let {
    fen,
    orientation,
    onmove,
    disabled = false,
    lastMove,
    highlightSquares,
    isInCheck = false,
  }: Props = $props()

  // ---------------------------------------------------------------------------
  // FEN parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse the piece-placement part of a FEN string into a 2-D array.
   * Returns board[rankIndex][fileIndex] where:
   *   - rankIndex 0 = rank 8 (top of the board visually for white)
   *   - rankIndex 7 = rank 1 (bottom for white)
   *   - fileIndex 0 = file 'a', fileIndex 7 = file 'h'
   */
  function parseFen(fenString: string): (PieceInfo | null)[][] {
    const placement = fenString.split(' ')[0]
    const ranks = placement.split('/')
    return ranks.map((rank) => {
      const cells: (PieceInfo | null)[] = []
      for (const ch of rank) {
        const n = parseInt(ch, 10)
        if (!isNaN(n)) {
          for (let i = 0; i < n; i++) cells.push(null)
        } else {
          const color: 'w' | 'b' = ch === ch.toUpperCase() ? 'w' : 'b'
          cells.push({
            color,
            piece: ch.toUpperCase() as PieceInfo['piece'],
          })
        }
      }
      return cells
    })
  }

  /**
   * Convert [rankIndex, fileIndex] in the internal 2-D array to a square name.
   * Internal convention: rankIndex 0 = rank 8, fileIndex 0 = file 'a'.
   */
  function toSquareName(rankIdx: number, fileIdx: number): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + fileIdx)
    const rank = 8 - rankIdx
    return `${file}${rank}`
  }

  /**
   * Find the square of the active side's king (for check highlighting).
   * Returns null if not found (should never happen in a valid position).
   */
  function findKingSquare(board: (PieceInfo | null)[][], color: 'w' | 'b'): string | null {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f]
        if (cell && cell.color === color && cell.piece === 'K') {
          return toSquareName(r, f)
        }
      }
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Reactive state
  // ---------------------------------------------------------------------------

  const board = $derived(parseFen(fen))

  /** The active side's color (who is to move). */
  const activeSideColor = $derived.by((): 'w' | 'b' => {
    const parts = fen.split(' ')
    return parts[1] === 'b' ? 'b' : 'w'
  })

  const kingSquare = $derived(isInCheck ? findKingSquare(board, activeSideColor) : null)

  /** Currently selected square name (e.g. "e2"), or null. */
  let selectedSquare = $state<string | null>(null)

  /** Set of legal destination squares for the selected piece. */
  let legalMoves = $state<Map<string, string>>(new Map()) // squareName → UCI string

  /** Whether the highlighted destination is a capture (for ring vs dot). */
  let capturableSquares = $state<Set<string>>(new Set())

  // ---------------------------------------------------------------------------
  // Square geometry
  // ---------------------------------------------------------------------------

  /**
   * Build the ordered list of [rankIdx, fileIdx] pairs as they should appear
   * on screen from top-left to bottom-right for the current orientation.
   *
   * For white orientation: rank 8 (rankIdx=0) at top, file 'a' (fileIdx=0) at left.
   * For black orientation: rank 1 (rankIdx=7) at top, file 'h' (fileIdx=7) at left.
   */
  interface SquareCell {
    rankIdx: number
    fileIdx: number
    square: string
    isLight: boolean
  }

  const orderedSquares = $derived.by((): SquareCell[] => {
    const squares: SquareCell[] = []
    const rankOrder = orientation === 'white'
      ? [0, 1, 2, 3, 4, 5, 6, 7]
      : [7, 6, 5, 4, 3, 2, 1, 0]
    const fileOrder = orientation === 'white'
      ? [0, 1, 2, 3, 4, 5, 6, 7]
      : [7, 6, 5, 4, 3, 2, 1, 0]

    for (const rankIdx of rankOrder) {
      for (const fileIdx of fileOrder) {
        const sq = toSquareName(rankIdx, fileIdx)
        // Light square: (rankIdx + fileIdx) % 2 === 1 in internal coords
        // Rank 1 (rankIdx=7), File 'a' (fileIdx=0): 7+0=7 (odd) → light (a1 is a light square)
        const isLight = (rankIdx + fileIdx) % 2 === 1
        squares.push({ rankIdx, fileIdx, square: sq, isLight })
      }
    }
    return squares
  })

  /** File labels in display order (a-h or h-a). */
  const fileLabels = $derived(
    orientation === 'white'
      ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
  )

  /** Rank labels in display order (8→1 or 1→8). */
  const rankLabels = $derived(
    orientation === 'white'
      ? ['8', '7', '6', '5', '4', '3', '2', '1']
      : ['1', '2', '3', '4', '5', '6', '7', '8']
  )

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  function computeLegalMoves(square: string): void {
    try {
      const chess = new Chess(fen)
      const moves = chess.moves({ square: square as Square, verbose: true })
      const newMoves = new Map<string, string>()
      const newCaptures = new Set<string>()
      for (const m of moves) {
        const uci = `${m.from}${m.to}${m.promotion ?? ''}`
        newMoves.set(m.to, uci)
        // Flags: 'c' = capture, 'e' = en passant
        if (m.flags.includes('c') || m.flags.includes('e')) {
          newCaptures.add(m.to)
        }
      }
      legalMoves = newMoves
      capturableSquares = newCaptures
    } catch {
      legalMoves = new Map()
      capturableSquares = new Set()
    }
  }

  function handleSquareTap(square: string): void {
    if (disabled) return

    const rankIdx = 8 - parseInt(square[1], 10)
    const fileIdx = square.charCodeAt(0) - 'a'.charCodeAt(0)
    const piece = board[rankIdx]?.[fileIdx] ?? null

    // Case 1: A piece is selected — check if tapping a legal destination
    if (selectedSquare !== null) {
      if (legalMoves.has(square)) {
        // Execute the move
        const uci = legalMoves.get(square)!
        selectedSquare = null
        legalMoves = new Map()
        capturableSquares = new Set()
        onmove(uci)
        return
      }
    }

    // Case 2: Tapping own piece → select it (or re-select)
    if (piece && piece.color === activeSideColor) {
      selectedSquare = square
      computeLegalMoves(square)
      return
    }

    // Case 3: Tap elsewhere → deselect
    selectedSquare = null
    legalMoves = new Map()
    capturableSquares = new Set()
  }

  // ---------------------------------------------------------------------------
  // Visual helpers
  // ---------------------------------------------------------------------------

  function getPieceImagePath(info: PieceInfo): string {
    return `/assets/chess/pieces/${info.color}${info.piece}.svg`
  }

  function squareBackground(isLight: boolean): string {
    return isLight ? '#f0d9b5' : '#b58863'
  }

  function squareOverlayStyle(square: string, isLight: boolean): string {
    const styles: string[] = []

    if (square === selectedSquare) {
      styles.push('box-shadow: inset 0 0 0 calc(3px * var(--layout-scale, 1)) gold')
    }

    if (isInCheck && square === kingSquare) {
      styles.push('background: rgba(255, 0, 0, 0.4)')
    } else if (lastMove && (square === lastMove.from || square === lastMove.to)) {
      styles.push('background: rgba(255, 255, 0, 0.3)')
    } else if (highlightSquares?.includes(square)) {
      styles.push('background: rgba(0, 255, 0, 0.3)')
    }

    return styles.join('; ')
  }

  function coordLabelStyle(isLight: boolean): string {
    const color = isLight ? 'rgba(100, 60, 10, 0.8)' : 'rgba(240, 217, 181, 0.8)'
    return `color: ${color}; font-size: calc(10px * var(--text-scale, 1)); font-weight: 600; line-height: 1; pointer-events: none; user-select: none;`
  }

  /**
   * Each square occupies 1 cell in an 8×8 CSS grid.
   * The "last file in each rank" squares show a rank label on the right edge.
   * The "last rank" squares show a file label on the bottom.
   */
  function isLastFileInRow(fileIdx: number): boolean {
    return orientation === 'white' ? fileIdx === 7 : fileIdx === 0
  }

  function isFirstFileInRow(fileIdx: number): boolean {
    return orientation === 'white' ? fileIdx === 0 : fileIdx === 7
  }

  function isLastRank(rankIdx: number): boolean {
    return orientation === 'white' ? rankIdx === 7 : rankIdx === 0
  }

  /** Get rank label for a given rankIdx (e.g. rankIdx=0 → "8" for white). */
  function getRankLabel(rankIdx: number): string {
    return String(8 - rankIdx)
  }

  /** Get file label for a given fileIdx (e.g. fileIdx=0 → "a"). */
  function getFileLabel(fileIdx: number): string {
    return String.fromCharCode('a'.charCodeAt(0) + fileIdx)
  }

  // Last-move animation trigger
  let lastMovePrev = $state<{ from: string; to: string } | undefined>(undefined)
  let animatingSquare = $state<string | null>(null)

  $effect(() => {
    if (lastMove && lastMove !== lastMovePrev) {
      animatingSquare = lastMove.to
      lastMovePrev = lastMove
      const t = setTimeout(() => {
        animatingSquare = null
      }, 300)
      return () => clearTimeout(t)
    }
  })
</script>

<!-- ============================================================ -->
<!-- Template                                                      -->
<!-- ============================================================ -->

<div class="chess-board-container" role="grid" aria-label="Chess board">
  <div class="chess-board" role="presentation">
    {#each orderedSquares as { rankIdx, fileIdx, square, isLight } (square)}
      {@const piece = board[rankIdx]?.[fileIdx] ?? null}
      {@const isSelected = square === selectedSquare}
      {@const isLegalDest = legalMoves.has(square)}
      {@const isCapture = capturableSquares.has(square)}
      {@const bgColor = squareBackground(isLight)}
      {@const overlayStyle = squareOverlayStyle(square, isLight)}
      {@const isAnimating = animatingSquare === square}

      <button
        class="chess-square"
        class:chess-square--selected={isSelected}
        class:chess-square--legal={isLegalDest && !isCapture}
        class:chess-square--capture={isLegalDest && isCapture}
        class:chess-square--disabled={disabled}
        class:chess-square--animating={isAnimating}
        style="background-color: {bgColor}; {overlayStyle}"
        role="gridcell"
        aria-label="{square}{piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.piece}` : ''}"
        aria-selected={isSelected}
        aria-disabled={disabled}
        onclick={() => handleSquareTap(square)}
        tabindex={disabled ? -1 : 0}
      >
        <!-- Rank label: shown on left edge of each rank (first file per row) -->
        {#if isFirstFileInRow(fileIdx)}
          <span
            class="rank-label"
            style={coordLabelStyle(isLight)}
            aria-hidden="true"
          >{getRankLabel(rankIdx)}</span>
        {/if}

        <!-- File label: shown on bottom edge (last rank squares) -->
        {#if isLastRank(rankIdx)}
          <span
            class="file-label"
            style={coordLabelStyle(isLight)}
            aria-hidden="true"
          >{getFileLabel(fileIdx)}</span>
        {/if}

        <!-- Legal move indicator: dot (quiet square) or ring (capture) -->
        {#if isLegalDest && !disabled}
          {#if isCapture}
            <div class="capture-ring" aria-hidden="true"></div>
          {:else}
            <div class="legal-dot" aria-hidden="true"></div>
          {/if}
        {/if}

        <!-- Chess piece -->
        {#if piece}
          <img
            src={getPieceImagePath(piece)}
            alt="{piece.color === 'w' ? 'White' : 'Black'} {piece.piece}"
            class="chess-piece-img"
            class:chess-piece--animating={isAnimating}
            draggable="false"
          />
        {/if}
      </button>
    {/each}
  </div>
</div>

<!-- ============================================================ -->
<!-- Styles                                                        -->
<!-- ============================================================ -->

<style>
  .chess-board-container {
    width: 100%;
    max-width: calc(400px * var(--layout-scale, 1));
    aspect-ratio: 1;
    margin: 0 auto;
    border: calc(2px * var(--layout-scale, 1)) solid rgba(0, 0, 0, 0.6);
    border-radius: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5);
  }

  .chess-board {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-template-rows: repeat(8, 1fr);
    width: 100%;
    height: 100%;
  }

  .chess-square {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Remove default button styles */
    padding: 0;
    border: none;
    cursor: pointer;
    /* Ensure minimum tap target — squares fill the board, will be >= 44px at normal scale */
    min-width: 0;
    min-height: 0;
    /* No transition needed for background — handled by box-shadow animation */
  }

  .chess-square--disabled {
    cursor: default;
  }

  .chess-square:focus-visible {
    outline: calc(2px * var(--layout-scale, 1)) solid white;
    outline-offset: calc(-2px * var(--layout-scale, 1));
    z-index: 1;
  }

  /* ---- Coordinate labels ---- */

  .rank-label {
    position: absolute;
    top: calc(2px * var(--layout-scale, 1));
    left: calc(2px * var(--layout-scale, 1));
    z-index: 2;
  }

  .file-label {
    position: absolute;
    bottom: calc(2px * var(--layout-scale, 1));
    right: calc(2px * var(--layout-scale, 1));
    z-index: 2;
  }

  /* ---- Piece image ---- */

  .chess-piece-img {
    width: 85%;
    height: 85%;
    object-fit: contain;
    pointer-events: none;
    z-index: 3;
    /* Crisp SVG rendering */
    image-rendering: auto;
    /* Drop shadow for piece depth */
    filter: drop-shadow(0 calc(1px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.45));
  }

  /* Brief scale pulse when a piece lands on this square */
  .chess-piece--animating {
    animation: pieceLand 220ms ease-out forwards;
  }

  @keyframes pieceLand {
    0%   { transform: scale(1.18); }
    60%  { transform: scale(0.96); }
    100% { transform: scale(1.0); }
  }

  /* ---- Legal move dot (quiet square) ---- */

  .legal-dot {
    position: absolute;
    width: 30%;
    height: 30%;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.2);
    pointer-events: none;
    z-index: 4;
  }

  /* Light squares: dark dot. Dark squares handled by same color — slightly lighter */
  .chess-square--legal .legal-dot {
    background: rgba(0, 0, 0, 0.22);
  }

  /* ---- Capture ring (enemy piece on reachable square) ---- */

  .capture-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    /* Ring created via border, not box-shadow, for consistent look */
    box-shadow: inset 0 0 0 calc(4px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.22);
    pointer-events: none;
    z-index: 4;
  }

  /* .chess-square--animating: piece image handles animation; square itself stays stable */
</style>

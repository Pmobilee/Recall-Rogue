import { BlockType, type MineCell } from '../../data/types'

export class Player {
  public gridX: number
  public gridY: number
  public facing: 'left' | 'right' | 'up' | 'down' = 'down'
  public lastMoveDx: number = 0
  public lastMoveDy: number = 0

  /** Track how many times each block has been hit this attempt (for impact escalation). */
  private blockHitCounts: Map<string, number> = new Map()

  constructor(startX: number, startY: number) {
    this.gridX = startX
    this.gridY = startY
  }

  /**
   * Moves the player to an adjacent empty cell.
   *
   * @param x - Target grid X position.
   * @param y - Target grid Y position.
   * @param grid - Mine grid to validate movement against.
   * @returns True when movement succeeds, otherwise false.
   */
  public moveToEmpty(x: number, y: number, grid: MineCell[][]): boolean {
    if (y < 0 || y >= grid.length) {
      return false
    }

    const row = grid[y]
    if (x < 0 || x >= row.length) {
      return false
    }

    if (row[x].type !== BlockType.Empty && row[x].type !== BlockType.ExitLadder) {
      return false
    }

    if (!this.isAdjacentTo(x, y)) {
      return false
    }

    const dx = x - this.gridX
    const dy = y - this.gridY
    this.lastMoveDx = dx
    this.lastMoveDy = dy
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx < 0 ? 'left' : 'right'
    } else {
      this.facing = dy < 0 ? 'up' : 'down'
    }

    this.gridX = x
    this.gridY = y

    return true
  }

  /**
   * Gets the player's current grid position.
   *
   * @returns Current position as x and y coordinates.
   */
  public getPosition(): { x: number; y: number } {
    return {
      x: this.gridX,
      y: this.gridY,
    }
  }

  /**
   * Checks whether the given position is adjacent to the player.
   *
   * @param x - Grid X position to check.
   * @param y - Grid Y position to check.
   * @returns True when Manhattan distance is exactly 1.
   */
  public isAdjacentTo(x: number, y: number): boolean {
    return Math.abs(x - this.gridX) + Math.abs(y - this.gridY) === 1
  }

  /**
   * Records a hit on a block and returns the cumulative hit count.
   * Used by ImpactSystem for progressive hit escalation.
   */
  public recordHit(x: number, y: number): number {
    const key = `${x},${y}`
    const count = (this.blockHitCounts.get(key) ?? 0) + 1
    this.blockHitCounts.set(key, count)
    return count
  }

  /**
   * Clears the hit count for a specific block (call when block is destroyed).
   */
  public clearHitCount(x: number, y: number): void {
    this.blockHitCounts.delete(`${x},${y}`)
  }

  /**
   * Clears all hit counts (call on layer transition).
   */
  public clearAllHitCounts(): void {
    this.blockHitCounts.clear()
  }
}

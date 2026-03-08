import { BlockType, type MineCell, type MineCellContent } from '../../data/types'

export type MineResult = {
  success: boolean
  content?: MineCellContent
  destroyed: boolean
}

/**
 * Returns whether a coordinate is inside the mine grid.
 */
function isWithinBounds(grid: MineCell[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[y].length
}

/**
 * Attempts to mine a single block at the given grid coordinate.
 *
 * @param grid - Mine grid in row-major format (`grid[y][x]`).
 * @param x - Target block x coordinate.
 * @param y - Target block y coordinate.
 * @returns Mining outcome including whether the block was destroyed and dropped content.
 */
export function mineBlock(grid: MineCell[][], x: number, y: number): MineResult {
  if (!isWithinBounds(grid, x, y)) {
    return { success: false, destroyed: false }
  }

  const cell = grid[y][x]

  if (cell.type === BlockType.Empty || cell.type === BlockType.Unbreakable) {
    return { success: false, destroyed: false }
  }

  cell.hardness = Math.max(0, cell.hardness - 1)

  if (cell.hardness === 0) {
    const savedContent = cell.content
    cell.type = BlockType.Empty
    cell.hardness = 0

    return { success: true, content: savedContent, destroyed: true }
  }

  return { success: true, destroyed: false }
}

/**
 * Returns whether the player can mine the target cell.
 *
 * A cell is mineable only when it is in bounds, directly adjacent to the player
 * in a cardinal direction, and not an empty or unbreakable block.
 *
 * @param grid - Mine grid in row-major format (`grid[y][x]`).
 * @param x - Target block x coordinate.
 * @param y - Target block y coordinate.
 * @param playerX - Player x coordinate.
 * @param playerY - Player y coordinate.
 * @returns `true` when the cell can be mined; otherwise `false`.
 */
export function canMine(grid: MineCell[][], x: number, y: number, playerX: number, playerY: number): boolean {
  if (!isWithinBounds(grid, x, y)) {
    return false
  }

  const isAdjacent = Math.abs(x - playerX) + Math.abs(y - playerY) === 1
  if (!isAdjacent) {
    return false
  }

  const cell = grid[y][x]
  return cell.type !== BlockType.Empty && cell.type !== BlockType.Unbreakable && cell.type !== BlockType.WallText
}

/**
 * Gets all adjacent mineable block coordinates around a position.
 *
 * @param grid - Mine grid in row-major format (`grid[y][x]`).
 * @param x - Center x coordinate.
 * @param y - Center y coordinate.
 * @returns List of adjacent coordinates containing mineable cells.
 */
export function getAdjacentMineable(grid: MineCell[][], x: number, y: number): { x: number, y: number }[] {
  const directions: Array<{ x: number, y: number }> = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]

  const mineable: Array<{ x: number, y: number }> = []

  for (const direction of directions) {
    const targetX = x + direction.x
    const targetY = y + direction.y

    if (!isWithinBounds(grid, targetX, targetY)) {
      continue
    }

    const cell = grid[targetY][targetX]
    if (cell.type !== BlockType.Empty && cell.type !== BlockType.Unbreakable) {
      mineable.push({ x: targetX, y: targetY })
    }
  }

  return mineable
}

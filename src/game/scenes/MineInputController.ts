/**
 * MineInputController — extracted input handling functions from MineScene.
 * Each function receives the MineScene instance as its first parameter.
 */
import { BALANCE } from '../../data/balance'
import { BlockType } from '../../data/types'
import { revealAround } from '../systems/MineGenerator'
import type { MineScene } from './MineScene'

const TILE_SIZE = BALANCE.TILE_SIZE

/**
 * BFS pathfinding across empty / exit-ladder tiles.
 * Returns positions from start to end (excluding start, including end).
 */
export function findPath(
  scene: MineScene,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): { x: number; y: number }[] | null {
  if (startX === endX && startY === endY) {
    return []
  }

  const visited = new Set<string>()
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = []

  queue.push({ x: startX, y: startY, path: [] })
  visited.add(`${startX},${startY}`)

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      break
    }

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]

    for (const next of neighbors) {
      if (next.x < 0 || next.y < 0 || next.x >= scene.gridWidth || next.y >= scene.gridHeight) {
        continue
      }

      const key = `${next.x},${next.y}`
      if (visited.has(key)) {
        continue
      }

      const cell = scene.grid[next.y][next.x]
      if (cell.type !== BlockType.Empty && cell.type !== BlockType.ExitLadder) {
        continue
      }

      const newPath = [...current.path, next]

      if (next.x === endX && next.y === endY) {
        return newPath
      }

      queue.push({ x: next.x, y: next.y, path: newPath })
      visited.add(key)
    }
  }

  return null
}

/**
 * Handles pointer (touch/mouse) input — tap to move or mine.
 * Pathfinds to empty tiles; for non-adjacent blocks, picks the closest
 * cardinal direction and delegates to handleMoveOrMine.
 */
export function handlePointerDown(scene: MineScene, pointer: Phaser.Input.Pointer): void {
  if (scene.isPaused) {
    return
  }

  const camera = scene.cameras.main
  if (!camera) return  // guard: camera not ready (scene transition)
  const worldX = pointer.x + camera.scrollX
  const worldY = pointer.y + camera.scrollY
  const targetX = Math.floor(worldX / TILE_SIZE)
  const targetY = Math.floor(worldY / TILE_SIZE)

  if (targetX < 0 || targetY < 0 || targetX >= scene.gridWidth || targetY >= scene.gridHeight) {
    return
  }

  const playerX = scene.player.gridX
  const playerY = scene.player.gridY

  if (targetX === playerX && targetY === playerY) {
    return
  }

  // Check if clicked target is empty and reachable via pathfinding.
  const clickedCell = scene.grid[targetY][targetX]
  if ((clickedCell.type === BlockType.Empty || clickedCell.type === BlockType.ExitLadder) && clickedCell.revealed) {
    const path = findPath(scene, playerX, playerY, targetX, targetY)
    if (path && path.length > 0) {
      const nextStep = path[0]
      const moved = scene.player.moveToEmpty(nextStep.x, nextStep.y, scene.grid)
      if (moved) {
        revealAround(scene.grid, scene.player.gridX, scene.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
        if (scene.activeUpgrades.has('scanner_boost')) {
          scene.revealSpecialBlocks()
        }
        scene.game.events.emit('oxygen-changed', scene.oxygenState)
        scene.game.events.emit('depth-changed', scene.player.gridY)
        scene.checkPointOfNoReturn()
        scene.redrawAll()
      }
      return
    }
  }

  let finalX = targetX
  let finalY = targetY

  // If not adjacent, move in the direction of the click
  if (Math.abs(targetX - playerX) + Math.abs(targetY - playerY) !== 1) {
    const dx = targetX - playerX
    const dy = targetY - playerY

    // Determine primary direction (prefer vertical over horizontal for ties)
    if (Math.abs(dy) >= Math.abs(dx)) {
      // Move vertically
      finalX = playerX
      finalY = playerY + (dy > 0 ? 1 : -1)
    } else {
      // Move horizontally
      finalX = playerX + (dx > 0 ? 1 : -1)
      finalY = playerY
    }

    // Bounds check
    if (finalX < 0 || finalY < 0 || finalX >= scene.gridWidth || finalY >= scene.gridHeight) {
      return
    }
  }

  // Buffer input if mine animation is playing (rhythm mining support)
  if (scene.animController?.isPlayingMineAnim) {
    scene.bufferedInput = { x: finalX, y: finalY }
    return
  }

  scene.handleMoveOrMine(finalX, finalY)
}

/**
 * Handles keyboard input for arrow keys and WASD movement.
 * Maps each key to a directional delta and delegates to handleMoveOrMine.
 */
export function handleKeyDown(scene: MineScene, event: KeyboardEvent): void {
  if (scene.isPaused) {
    return
  }

  let dx = 0
  let dy = 0

  switch (event.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      dy = -1
      break
    case 'ArrowDown':
    case 's':
    case 'S':
      dy = 1
      break
    case 'ArrowLeft':
    case 'a':
    case 'A':
      dx = -1
      break
    case 'ArrowRight':
    case 'd':
    case 'D':
      dx = 1
      break
    case 'b':
    case 'B':
      scene.useBomb()
      return
    case 'f':
    case 'F':
      scene.applyConsumable('flare')
      return
    case 'Escape':
      document.dispatchEvent(new CustomEvent('game:back-pressed'))
      return
    case '1': case '2': case '3': case '4':
      document.dispatchEvent(new CustomEvent('quiz:keyboard-answer', { detail: { choice: parseInt(event.key) - 1 } }))
      return
    case ' ':
      // Space = interact (no-op for now, reserved for future use)
      return
    default:
      return
  }

  const targetX = scene.player.gridX + dx
  const targetY = scene.player.gridY + dy

  if (targetX < 0 || targetY < 0 || targetX >= scene.gridWidth || targetY >= scene.gridHeight) {
    return
  }

  // Buffer input if mine animation is playing (rhythm mining support)
  if (scene.animController?.isPlayingMineAnim) {
    scene.bufferedInput = { x: targetX, y: targetY }
    return
  }

  scene.handleMoveOrMine(targetX, targetY)
}

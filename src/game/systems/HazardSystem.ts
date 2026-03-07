import { TICK_LAVA_SPREAD_INTERVAL, TICK_GAS_DRIFT_INTERVAL, TICK_GAS_DISSIPATE_AFTER } from '../../data/balance'

export interface LavaEntity {
  type: 'lava'
  cells: Set<string>    // "x,y" string keys
  originX: number
  originY: number
  ticksAlive: number
}

export interface GasCloud {
  type: 'gas'
  cells: Set<string>
  centerX: number
  centerY: number
  ticksAlive: number
  dissipatesAt: number
}

export type ActiveHazard = LavaEntity | GasCloud

/**
 * HazardSystem — manages active lava flows and gas clouds.
 * Registered as a TickSystem listener. All behavior is tick-driven. (DD-V2-060)
 */
export class HazardSystem {
  private hazards: ActiveHazard[] = []

  constructor(
    private gridWidth: number,
    private gridHeight: number,
    private getCell: (x: number, y: number) => string,  // returns cell type name
    private isCellEmpty: (x: number, y: number) => boolean,
    private isCellUnbreakable: (x: number, y: number) => boolean,
    private getPlayerPos: () => { x: number; y: number },
    private onPlayerInLava: () => void,
    private onPlayerInGas: () => void,
    private onCellBecameLava: (x: number, y: number) => void,
  ) {}

  /** Spawn a new lava entity at the given origin. */
  spawnLava(x: number, y: number): void {
    // Don't spawn duplicate lava at same origin
    if (this.hazards.some(h => h.type === 'lava' && h.originX === x && h.originY === y)) return
    this.hazards.push({
      type: 'lava',
      cells: new Set([`${x},${y}`]),
      originX: x,
      originY: y,
      ticksAlive: 0,
    })
  }

  /** Spawn a gas cloud at the given position (3x3 initial fill). */
  spawnGas(x: number, y: number): void {
    const cloud: GasCloud = {
      type: 'gas',
      cells: new Set(),
      centerX: x,
      centerY: y,
      ticksAlive: 0,
      dissipatesAt: TICK_GAS_DISSIPATE_AFTER,
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = x + dx, cy = y + dy
        if (cx >= 0 && cx < this.gridWidth && cy >= 0 && cy < this.gridHeight) {
          cloud.cells.add(`${cx},${cy}`)
        }
      }
    }
    this.hazards.push(cloud)
  }

  /** Called by TickSystem on every tick. */
  onTick(_tick: number, _layerTick: number): void {
    for (const h of this.hazards) {
      h.ticksAlive++
    }
    this.tickLava()
    this.tickGas()
    this.checkPlayerCollision()
    // Remove dissipated gas clouds
    this.hazards = this.hazards.filter(h =>
      !(h.type === 'gas' && h.ticksAlive >= h.dissipatesAt)
    )
  }

  private tickLava(): void {
    for (const h of this.hazards) {
      if (h.type !== 'lava') continue
      if (h.ticksAlive % TICK_LAVA_SPREAD_INTERVAL !== 0) continue
      if (h.cells.size >= 3) continue  // Cap: origin + 2 spreads max
      const candidates: Array<{ x: number; y: number }> = []
      for (const cellKey of h.cells) {
        const [cx, cy] = cellKey.split(',').map(Number)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= this.gridWidth || ny >= this.gridHeight) continue
          if (this.isCellUnbreakable(nx, ny)) continue
          const nKey = `${nx},${ny}`
          if (!h.cells.has(nKey) && this.isCellEmpty(nx, ny)) {
            candidates.push({ x: nx, y: ny })
          }
        }
      }
      if (candidates.length > 0) {
        // Expand to exactly one candidate (nearest to player)
        const { x: px, y: py } = this.getPlayerPos()
        candidates.sort((a, b) =>
          (Math.abs(a.x - px) + Math.abs(a.y - py)) -
          (Math.abs(b.x - px) + Math.abs(b.y - py))
        )
        const { x, y } = candidates[0]
        h.cells.add(`${x},${y}`)
        this.onCellBecameLava(x, y)
      }
    }
  }

  private tickGas(): void {
    const { x: px, y: py } = this.getPlayerPos()
    for (const h of this.hazards) {
      if (h.type !== 'gas') continue
      if (h.ticksAlive % TICK_GAS_DRIFT_INTERVAL !== 0) continue
      const dx = Math.sign(px - h.centerX)
      const dy = Math.sign(py - h.centerY)
      if (dx !== 0 || dy !== 0) {
        h.centerX += dx
        h.centerY += dy
        h.cells.clear()
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cx = h.centerX + ox, cy = h.centerY + oy
            if (cx >= 0 && cx < this.gridWidth && cy >= 0 && cy < this.gridHeight) {
              h.cells.add(`${cx},${cy}`)
            }
          }
        }
      }
    }
  }

  private checkPlayerCollision(): void {
    const { x, y } = this.getPlayerPos()
    const key = `${x},${y}`
    for (const h of this.hazards) {
      if (h.cells.has(key)) {
        if (h.type === 'lava') this.onPlayerInLava()
        else if (h.type === 'gas') this.onPlayerInGas()
        break
      }
    }
  }

  /** Solidify lava cells in a radius into passable stone (for Coolant Bomb in 8.6). */
  solidifyLava(centerX: number, centerY: number, radius = 1): void {
    for (const h of this.hazards) {
      if (h.type !== 'lava') continue
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const key = `${centerX + dx},${centerY + dy}`
          h.cells.delete(key)
        }
      }
    }
    this.hazards = this.hazards.filter(h => h.type !== 'lava' || h.cells.size > 0)
  }

  /** Clear all active hazards (on layer change or mine exit). */
  clearAll(): void {
    this.hazards = []
  }

  /** Get all active hazards (for rendering). */
  getActiveHazards(): readonly ActiveHazard[] {
    return this.hazards
  }

  /** Check if a cell is occupied by any gas cloud. */
  isGasCell(x: number, y: number): boolean {
    const key = `${x},${y}`
    return this.hazards.some(h => h.type === 'gas' && h.cells.has(key))
  }

  /** Check if a cell is occupied by any lava entity. */
  isLavaCell(x: number, y: number): boolean {
    const key = `${x},${y}`
    return this.hazards.some(h => h.type === 'lava' && h.cells.has(key))
  }
}

import { writable } from 'svelte/store'
import type { MineCell } from '../../data/types'

export interface MiniMapData {
  grid: MineCell[][]
  playerX: number
  playerY: number
}

export const miniMapData = writable<MiniMapData | null>(null)

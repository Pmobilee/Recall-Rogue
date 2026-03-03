import type { PlayerSave } from '../data/types'
import { SAVE_VERSION } from '../services/saveService'

const SNAPSHOT_STORE_KEY = 'terra-gacha-dev-snapshots'
const MAX_STORED_SNAPSHOTS = 20

export interface SaveSnapshot {
  snapshotVersion: 1
  snapshotId: string
  label: string
  createdAt: number
  gameVersion: number
  save: PlayerSave
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 10)
}

/** Returns all stored snapshots from localStorage, newest first. */
export function listSnapshots(): SaveSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as SaveSnapshot[]
  } catch {
    return []
  }
}

/** Saves a new snapshot. Enforces MAX_STORED_SNAPSHOTS by dropping oldest. */
export function storeSnapshot(save: PlayerSave, label?: string): SaveSnapshot {
  const snap: SaveSnapshot = {
    snapshotVersion: 1,
    snapshotId: randomId(),
    label: label ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
    createdAt: Date.now(),
    gameVersion: SAVE_VERSION,
    save,
  }
  const existing = listSnapshots()
  const updated = [snap, ...existing].slice(0, MAX_STORED_SNAPSHOTS)
  localStorage.setItem(SNAPSHOT_STORE_KEY, JSON.stringify(updated))
  return snap
}

/** Deletes a snapshot by ID. */
export function deleteSnapshot(id: string): void {
  const updated = listSnapshots().filter(s => s.snapshotId !== id)
  localStorage.setItem(SNAPSHOT_STORE_KEY, JSON.stringify(updated))
}

/** Serializes a snapshot to a downloadable JSON blob. */
export function exportSnapshotBlob(snap: SaveSnapshot): Blob {
  return new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
}

/** Parses and validates a JSON string as a SaveSnapshot. Returns null on failure. */
export function parseSnapshotFile(jsonText: string): SaveSnapshot | null {
  try {
    const obj = JSON.parse(jsonText)
    if (typeof obj !== 'object' || obj === null) return null
    if (obj.snapshotVersion !== 1) return null
    if (typeof obj.snapshotId !== 'string') return null
    if (typeof obj.label !== 'string') return null
    if (typeof obj.createdAt !== 'number') return null
    if (typeof obj.save !== 'object' || obj.save === null) return null
    if (typeof obj.save.version !== 'number') return null
    return obj as SaveSnapshot
  } catch {
    return null
  }
}

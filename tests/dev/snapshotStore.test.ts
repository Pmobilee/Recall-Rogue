import { describe, it, expect, beforeEach } from 'vitest'
import { listSnapshots, storeSnapshot, deleteSnapshot, parseSnapshotFile, type SaveSnapshot } from '../../src/dev/snapshotStore'
import { SCENARIO_PRESETS } from '../../src/dev/presets'

// Mock localStorage
const store: Record<string, string> = {}
beforeEach(() => {
  Object.keys(store).forEach(key => delete store[key])
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
    },
    writable: true,
  })
})

describe('snapshotStore', () => {
  it('listSnapshots returns empty array initially', () => {
    expect(listSnapshots()).toEqual([])
  })

  it('storeSnapshot saves and listSnapshots retrieves', () => {
    const save = SCENARIO_PRESETS[0].buildSave(Date.now())
    storeSnapshot(save, 'Test')
    const list = listSnapshots()
    expect(list).toHaveLength(1)
    expect(list[0].label).toBe('Test')
  })

  it('deleteSnapshot removes by id', () => {
    const save = SCENARIO_PRESETS[0].buildSave(Date.now())
    const snap = storeSnapshot(save, 'ToDelete')
    deleteSnapshot(snap.snapshotId)
    expect(listSnapshots()).toHaveLength(0)
  })

  it('parseSnapshotFile rejects invalid JSON', () => {
    expect(parseSnapshotFile('not json')).toBeNull()
    expect(parseSnapshotFile('{}')).toBeNull()
    expect(parseSnapshotFile('{"snapshotVersion":2}')).toBeNull()
  })

  it('parseSnapshotFile accepts valid snapshot', () => {
    const save = SCENARIO_PRESETS[0].buildSave(Date.now())
    const snap = storeSnapshot(save, 'Valid')
    const json = JSON.stringify(snap)
    const parsed = parseSnapshotFile(json)
    expect(parsed).not.toBeNull()
    expect(parsed!.label).toBe('Valid')
  })

  it('enforces max 20 snapshots', () => {
    const save = SCENARIO_PRESETS[0].buildSave(Date.now())
    for (let i = 0; i < 25; i++) {
      storeSnapshot(save, `Snap ${i}`)
    }
    expect(listSnapshots()).toHaveLength(20)
  })
})

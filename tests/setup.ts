import { vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// localStorage stub
// happy-dom / jsdom may provide localStorage but we want full control over it
// in tests so all reads/writes are trackable with vi.fn().
// ---------------------------------------------------------------------------
const localStorageStore: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key] }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]) }),
  get length() { return Object.keys(localStorageStore).length },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Reset all mocks and localStorage before every test
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  Object.keys(localStorageStore).forEach(k => delete localStorageStore[k])
})

afterEach(() => {
  vi.restoreAllMocks()
})

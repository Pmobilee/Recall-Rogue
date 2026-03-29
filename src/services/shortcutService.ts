/**
 * Centralized keyboard shortcut service.
 *
 * Default bindings are defined here. Players can override them via the Settings
 * screen. Bindings are persisted to localStorage under "rr_shortcuts_v1".
 *
 * Usage:
 *   shortcutService.on('dive', () => gm.goToDivePrep())
 *   shortcutService.off('dive', handler)
 */

export type ShortcutId =
  | 'dive'
  | 'study'
  | 'back'
  | 'quiz_1' | 'quiz_2' | 'quiz_3' | 'quiz_4'
  | 'minimap'
  | 'shortcut_help'
  | 'surface'

export interface ShortcutBinding {
  id: ShortcutId
  label: string
  defaultKey: string
  key: string
  /** If true, the shortcut fires even when an input element is focused. */
  global?: boolean
}

const STORAGE_KEY = 'rr_shortcuts_v1'

const DEFAULT_BINDINGS: Record<ShortcutId, Omit<ShortcutBinding, 'id'>> = {
  dive:          { label: 'Dive / Enter Mine',   defaultKey: 'd', key: 'd' },
  study:         { label: 'Open Study Queue',     defaultKey: 's', key: 's' },
  back:          { label: 'Back / Close',         defaultKey: 'Escape', key: 'Escape', global: true },
  quiz_1:        { label: 'Quiz — Answer 1',      defaultKey: '1', key: '1' },
  quiz_2:        { label: 'Quiz — Answer 2',      defaultKey: '2', key: '2' },
  quiz_3:        { label: 'Quiz — Answer 3',      defaultKey: '3', key: '3' },
  quiz_4:        { label: 'Quiz — Answer 4',      defaultKey: '4', key: '4' },
  minimap:       { label: 'Toggle Mini-Map',      defaultKey: 'm', key: 'm' },
  shortcut_help: { label: 'Show Shortcut Help',   defaultKey: '?', key: '?', global: true },
  surface:       { label: 'Surface from Mine',    defaultKey: 'F', key: 'F' },
}

type Handler = () => void

class ShortcutService {
  private bindings: Record<ShortcutId, ShortcutBinding>
  private listeners: Partial<Record<ShortcutId, Set<Handler>>> = {}
  private active = true

  constructor() {
    this.bindings = this.loadBindings()
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this))
    }
  }

  private loadBindings(): Record<ShortcutId, ShortcutBinding> {
    const defaults = Object.fromEntries(
      Object.entries(DEFAULT_BINDINGS).map(([id, b]) => [id, { id: id as ShortcutId, ...b }])
    ) as Record<ShortcutId, ShortcutBinding>

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return defaults
      const overrides = JSON.parse(stored) as Partial<Record<ShortcutId, string>>
      for (const [id, key] of Object.entries(overrides)) {
        if (defaults[id as ShortcutId]) {
          defaults[id as ShortcutId].key = key as string
        }
      }
    } catch { /* corrupt storage — use defaults */ }

    return defaults
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.active) return
    const tag = (e.target as HTMLElement).tagName
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

    for (const binding of Object.values(this.bindings)) {
      if (e.key !== binding.key) continue
      if (inInput && !binding.global) continue
      const handlers = this.listeners[binding.id]
      if (!handlers?.size) continue
      e.preventDefault()
      handlers.forEach((h) => h())
      return
    }
  }

  /** Register a handler for a shortcut ID. */
  on(id: ShortcutId, handler: Handler): void {
    if (!this.listeners[id]) this.listeners[id] = new Set()
    this.listeners[id]!.add(handler)
  }

  /** Unregister a handler. */
  off(id: ShortcutId, handler: Handler): void {
    this.listeners[id]?.delete(handler)
  }

  /** Temporarily disable all shortcuts (e.g., when a modal text input is focused). */
  disable(): void { this.active = false }

  /** Re-enable shortcuts. */
  enable(): void { this.active = true }

  /** Return all bindings, including current (possibly overridden) keys. */
  getBindings(): ShortcutBinding[] {
    return Object.values(this.bindings)
  }

  /**
   * Rebind a shortcut to a new key. Persists to localStorage.
   * Throws if the key is already used by another shortcut.
   */
  rebind(id: ShortcutId, newKey: string): void {
    const conflict = Object.values(this.bindings).find(
      (b) => b.key === newKey && b.id !== id
    )
    if (conflict) {
      throw new Error(`Key "${newKey}" is already bound to "${conflict.label}"`)
    }
    this.bindings[id].key = newKey
    const overrides: Partial<Record<ShortcutId, string>> = {}
    for (const [bid, binding] of Object.entries(this.bindings)) {
      if (binding.key !== DEFAULT_BINDINGS[bid as ShortcutId].defaultKey) {
        overrides[bid as ShortcutId] = binding.key
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  }

  /** Reset all bindings to defaults. */
  resetAll(): void {
    localStorage.removeItem(STORAGE_KEY)
    this.bindings = this.loadBindings()
  }
}

/** Singleton shortcut service. Import and use throughout the app. */
export const shortcutService = new ShortcutService()

/**
 * Svelte store for in-game classroom membership.
 * Persists the joined classroom ID, class name, active homework assignment,
 * and current announcement state to localStorage for offline resilience.
 *
 * Updated by classroomService on app launch and every 30 minutes.
 */

import { writable } from 'svelte/store'

/** A homework assignment actively pushed by a teacher. */
export interface ActiveAssignment {
  id: string
  title: string
  categories: string[]
  dueDate: number
}

/** State for the in-game classroom membership. */
export interface ClassroomState {
  /** UUID of the classroom the student is enrolled in, or null if not enrolled. */
  classroomId: string | null
  /** Display name of the classroom. */
  className: string | null
  /** Currently active homework assignment, or null if none. */
  activeAssignment: ActiveAssignment | null
}

const STORAGE_KEY = 'tg_classroom_state'

function loadFromStorage(): ClassroomState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as ClassroomState
    }
  } catch {
    // Malformed storage — use defaults
  }
  return { classroomId: null, className: null, activeAssignment: null }
}

function createClassroomStore() {
  const { subscribe, set, update } = writable<ClassroomState>(loadFromStorage())

  return {
    subscribe,
    /**
     * Replace the entire classroom state and persist to localStorage.
     * @param state - New classroom state.
     */
    set(state: ClassroomState) {
      set(state)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        // Quota exceeded — not critical
      }
    },
    /**
     * Update a subset of the classroom state and persist to localStorage.
     * @param updater - State update function.
     */
    update(updater: (s: ClassroomState) => ClassroomState) {
      update((current) => {
        const next = updater(current)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // Quota exceeded — not critical
        }
        return next
      })
    },
    /**
     * Clear all classroom state (used when user logs out or leaves a class).
     */
    clear() {
      const empty: ClassroomState = { classroomId: null, className: null, activeAssignment: null }
      set(empty)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Ignore
      }
    },
  }
}

/** Global classroom store — import and use this throughout the app. */
export const classroomStore = createClassroomStore()

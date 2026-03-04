/**
 * @file authStore.ts
 * Svelte store for authentication state.
 *
 * Wraps apiClient auth state and provides reactive user data for the UI.
 * The store is the single source of truth for whether a user is logged in
 * and what their basic profile data is.
 */

import { writable, derived } from 'svelte/store'
import { apiClient } from '../../services/apiClient'

// ============================================================
// TYPES
// ============================================================

/** Auth state shape stored in the writable. */
interface AuthState {
  isLoggedIn: boolean
  userId: string | null
  email: string | null
  displayName: string | null
}

// ============================================================
// STORE
// ============================================================

const _auth = writable<AuthState>({
  isLoggedIn: apiClient.isLoggedIn(),
  userId: null,
  email: null,
  displayName: null,
})

/**
 * Auth store — subscribe, setUser, and clear methods.
 *
 * @example
 * ```ts
 * import { authStore } from '../stores/authStore'
 * authStore.setUser({ id: '123', email: 'user@example.com', displayName: 'Explorer' })
 * ```
 */
export const authStore = {
  subscribe: _auth.subscribe,

  /**
   * Updates the store with authenticated user data.
   * Called after a successful login or register response.
   *
   * @param user - Basic user profile returned by the auth endpoints.
   */
  setUser(user: { id: string; email: string; displayName: string | null }): void {
    _auth.set({
      isLoggedIn: true,
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    })
  },

  /**
   * Clears stored auth state and calls apiClient.logout() to remove tokens.
   * Also removes the guest mode flag from localStorage.
   */
  clear(): void {
    _auth.set({ isLoggedIn: false, userId: null, email: null, displayName: null })
    apiClient.logout()
    localStorage.removeItem('terra_guest_mode')
  },
}

/** Derived boolean — true when the user is authenticated. */
export const isLoggedIn = derived(_auth, ($a) => $a.isLoggedIn)

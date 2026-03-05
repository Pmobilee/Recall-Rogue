/**
 * Educator auth store for the teacher dashboard.
 * Wraps the same /api/auth/* endpoints as the main game
 * but targets the 'educator' role specifically.
 */

import { writable, derived } from 'svelte/store'

/** Educator user profile returned from the API. */
export interface EducatorUser {
  id: string
  email: string
  displayName: string | null
  role: 'educator' | 'admin'
  verificationStatus: 'pending' | 'approved' | 'rejected'
}

const _user = writable<EducatorUser | null>(null)

/** The currently authenticated educator user, or null if not logged in. */
export const currentUser = derived(_user, (u) => u)

/** True when an educator is authenticated. */
export const isLoggedIn = derived(_user, (u) => u !== null)

/** True when the educator has submitted a verification request but is not yet approved. */
export const isPendingVerification = derived(
  _user,
  (u) => u?.verificationStatus === 'pending',
)

/** True when the educator's verification request was rejected. */
export const isRejectedVerification = derived(
  _user,
  (u) => u?.verificationStatus === 'rejected',
)

/**
 * Set the authenticated educator user in the store.
 *
 * @param user - The authenticated educator.
 */
export function setUser(user: EducatorUser): void {
  _user.set(user)
}

/**
 * Clear the authenticated educator user and remove tokens.
 */
export function clearUser(): void {
  _user.set(null)
  localStorage.removeItem('teacher_access_token')
  localStorage.removeItem('teacher_refresh_token')
}

/**
 * Save auth tokens to localStorage.
 *
 * @param accessToken  - JWT access token.
 * @param refreshToken - JWT refresh token.
 */
export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('teacher_access_token', accessToken)
  localStorage.setItem('teacher_refresh_token', refreshToken)
}

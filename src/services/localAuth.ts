/**
 * @file localAuth.ts
 * Local-only authentication using localStorage.
 * Used as fallback when the backend API is unreachable.
 */

import type { AuthResponse } from './apiClient'

const LOCAL_ACCOUNTS_KEY = 'terra_local_accounts'
const LOCAL_CURRENT_USER_KEY = 'terra_local_user'

interface LocalAccount {
  id: string
  email: string
  displayName: string
  passwordHash: string
  createdAt: number
}

/** Simple hash function for local password storage (not cryptographically secure — local only) */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'terra_salt_2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function getAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAccounts(accounts: LocalAccount[]): void {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts))
}

function generateId(): string {
  return 'local_' + crypto.randomUUID()
}

/**
 * Register a new local account.
 * @throws Error if email already exists
 */
export async function localRegister(email: string, password: string, displayName: string): Promise<AuthResponse> {
  const accounts = getAccounts()

  if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.')
  }

  const passwordHash = await hashPassword(password)
  const id = generateId()

  const account: LocalAccount = {
    id,
    email,
    displayName,
    passwordHash,
    createdAt: Date.now(),
  }

  accounts.push(account)
  saveAccounts(accounts)
  localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify({ id, email, displayName }))

  return {
    token: 'local_token_' + id,
    refreshToken: 'local_refresh_' + id,
    user: { id, email, displayName },
  }
}

/**
 * Login with existing local account.
 * @throws Error if credentials are invalid
 */
export async function localLogin(email: string, password: string): Promise<AuthResponse> {
  const accounts = getAccounts()
  const account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase())

  if (!account) {
    throw new Error('No account found with this email.')
  }

  const passwordHash = await hashPassword(password)
  if (account.passwordHash !== passwordHash) {
    throw new Error('Incorrect password.')
  }

  localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify({
    id: account.id,
    email: account.email,
    displayName: account.displayName,
  }))

  return {
    token: 'local_token_' + account.id,
    refreshToken: 'local_refresh_' + account.id,
    user: { id: account.id, email: account.email, displayName: account.displayName },
  }
}

/** Get the currently logged-in local user, if any. */
export function getLocalUser(): { id: string; email: string; displayName: string } | null {
  try {
    const raw = localStorage.getItem(LOCAL_CURRENT_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Check if the backend API is reachable (quick health check with timeout). */
export async function isBackendReachable(baseUrl: string = 'http://localhost:3001/api'): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(baseUrl + '/auth/health', { signal: controller.signal, method: 'HEAD' })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

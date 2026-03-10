const ACCESS_TOKEN_KEY = 'terra_auth_token'
const LEGACY_ACCESS_TOKEN_KEY = 'tg_access_token'
const REFRESH_TOKEN_KEY = 'terra_refresh_token'

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function safeGet(key: string): string | null {
  if (!hasStorage()) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  if (!hasStorage()) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore quota/security errors; callers keep in-memory copies.
  }
}

function safeRemove(key: string): void {
  if (!hasStorage()) return
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage access errors.
  }
}

export function readAccessToken(): string | null {
  const token = safeGet(ACCESS_TOKEN_KEY)
  if (token && token.trim().length > 0) return token
  const legacyToken = safeGet(LEGACY_ACCESS_TOKEN_KEY)
  if (legacyToken && legacyToken.trim().length > 0) return legacyToken
  return null
}

export function hasAccessToken(): boolean {
  return readAccessToken() !== null
}

export function persistAccessToken(token: string): void {
  safeSet(ACCESS_TOKEN_KEY, token)
  // Always remove legacy key once the canonical key is written.
  safeRemove(LEGACY_ACCESS_TOKEN_KEY)
}

export function clearAccessToken(): void {
  safeRemove(ACCESS_TOKEN_KEY)
  safeRemove(LEGACY_ACCESS_TOKEN_KEY)
}

export function readRefreshToken(): string | null {
  const token = safeGet(REFRESH_TOKEN_KEY)
  return token && token.trim().length > 0 ? token : null
}

export function persistRefreshToken(token: string): void {
  safeSet(REFRESH_TOKEN_KEY, token)
}

export function clearRefreshToken(): void {
  safeRemove(REFRESH_TOKEN_KEY)
}

export function clearAllAuthTokens(): void {
  clearAccessToken()
  clearRefreshToken()
}

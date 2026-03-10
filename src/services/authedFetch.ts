import { ApiError } from './apiClient'
import { readAccessToken } from './authTokens'

function resolveBaseUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
      ? (import.meta.env.VITE_API_URL as string)
      : null
  return (envUrl ?? `${window.location.protocol}//${window.location.hostname}:3001/api`).replace(/\/$/, '')
}

function readToken(): string | null {
  return readAccessToken()
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? `Server error (${response.status})`
  } catch {
    return response.statusText || `Server error (${response.status})`
  }
}

async function authedFetch(
  path: string,
  method: 'GET' | 'POST',
  body?: object,
): Promise<Response> {
  const baseUrl = resolveBaseUrl()
  const token = readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new ApiError(
      'Unable to reach the server. Please check your internet connection.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response)
    throw new ApiError(message, response.status)
  }

  return response
}

export function authedGet(path: string): Promise<Response> {
  return authedFetch(path, 'GET')
}

export function authedPost(path: string, body: object): Promise<Response> {
  return authedFetch(path, 'POST', body)
}

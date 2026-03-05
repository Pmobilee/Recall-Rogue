/**
 * Typed API client for the teacher dashboard.
 * All requests are authenticated with a Bearer token stored in localStorage.
 * Throws ApiError on non-2xx responses.
 */

/** Error class representing a non-2xx API response. */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Retrieve the stored access token. */
function getToken(): string | null {
  return localStorage.getItem('teacher_access_token')
}

/**
 * Perform a typed fetch request with Bearer auth injection.
 *
 * @param method - HTTP method.
 * @param path   - Path after /api (e.g. '/educator/status').
 * @param body   - Optional request body (JSON-serialised).
 * @returns Parsed JSON response.
 * @throws ApiError on non-2xx status.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(res.status, (err as { error: string }).error ?? 'Request failed')
  }

  return res.json() as Promise<T>
}

/** Convenience methods for common HTTP verbs. */
export const api = {
  /** Perform a GET request. */
  get: <T>(path: string) => request<T>('GET', path),
  /** Perform a POST request with a JSON body. */
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  /** Perform a PUT request with a JSON body. */
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  /** Perform a DELETE request. */
  delete: <T>(path: string) => request<T>('DELETE', path),
}

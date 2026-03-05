/**
 * Classroom service for the Terra Gacha game client.
 * Handles student-side API calls for classroom membership, homework assignments,
 * and announcements. Integrates with classroomStore to provide reactive state.
 *
 * Called on app launch (syncAll) and on a 30-minute polling interval.
 */

import { classroomStore } from '../ui/stores/classroomStore'

/** Authorization header value read from localStorage. */
function getAuthHeader(): string {
  return `Bearer ${localStorage.getItem('tg_access_token') ?? ''}`
}

/**
 * Fetch the active homework assignment for the current player.
 * Called on app launch and every 30 minutes.
 * Updates classroomStore.activeAssignment with the result (or null).
 *
 * Silently no-ops if the student is not authenticated or not enrolled.
 */
export async function syncActiveAssignment(): Promise<void> {
  try {
    const res = await fetch('/api/classrooms/my-active-assignment', {
      headers: { Authorization: getAuthHeader() },
    })
    if (!res.ok) return
    const data = await res.json() as { assignment: { id: string; title: string; categories: string[]; dueDate: number } | null }
    classroomStore.update((s) => ({ ...s, activeAssignment: data.assignment }))
  } catch {
    // Network failure: retain last known state; do not clear the assignment
  }
}

/**
 * Fetch the active class announcement for the current player.
 * Returns the most recent non-dismissed, non-expired announcement across all
 * enrolled classrooms, or null if none.
 *
 * @returns The announcement object or null.
 */
export async function fetchActiveAnnouncement(): Promise<{ id: string; message: string; expiresAt: number } | null> {
  try {
    const res = await fetch('/api/classrooms/my-announcement', {
      headers: { Authorization: getAuthHeader() },
    })
    if (!res.ok) return null
    const data = await res.json() as { announcement: { id: string; message: string; expiresAt: number } | null }
    return data.announcement
  } catch {
    return null
  }
}

/**
 * Join a classroom using a 6-character join code.
 * On success, updates classroomStore with the new classroom membership.
 *
 * @param joinCode - The 6-character alphanumeric join code (will be uppercased).
 * @returns Object with className and classroomId on success.
 * @throws Error with a user-facing message on failure.
 */
export async function joinClassroom(joinCode: string): Promise<{ className: string; classroomId: string }> {
  const res = await fetch('/api/classrooms/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ joinCode: joinCode.toUpperCase().trim() }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to join class' })) as { error?: string }
    throw new Error(err.error ?? 'Failed to join class')
  }

  const data = await res.json() as { className: string; classroomId: string }
  classroomStore.update((s) => ({
    ...s,
    classroomId: data.classroomId,
    className: data.className,
  }))
  return data
}

/**
 * Sync all classroom data: active assignment.
 * Call this once on app launch (after the user is authenticated).
 * Runs silently — failures are swallowed to avoid blocking the app.
 */
export async function syncAllClassroomData(): Promise<void> {
  await syncActiveAssignment()
}

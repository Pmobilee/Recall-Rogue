<script lang="ts">
  /**
   * AnnouncementBanner — dismissable in-game banner for class announcements.
   * Fetches the most recent active announcement for the enrolled student on mount.
   * Shows nothing if the student is not enrolled, not authenticated, or no announcement.
   * Dismissed announcement IDs are persisted to localStorage so they don't re-appear.
   */
  import { onMount } from 'svelte'
  import { fetchActiveAnnouncement } from '../../services/classroomService'
  import { hasAccessToken } from '../../services/authTokens'

  const DISMISSED_KEY = 'tg_dismissed_announcements'

  let announcement: { id: string; message: string; expiresAt: number } | null = $state(null)
  let dismissed = $state(false)

  onMount(async () => {
    // Don't show if user is not logged in
    if (!hasAccessToken()) return

    const dismissedIds: string[] = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    const data = await fetchActiveAnnouncement()
    if (data && !dismissedIds.includes(data.id)) {
      announcement = data
    }
  })

  /**
   * Dismiss the banner and persist the announcement ID so it won't reappear.
   */
  function dismiss() {
    if (!announcement) return
    const ids: string[] = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    ids.push(announcement.id)
    // Keep only the last 50 dismissed IDs to prevent unbounded localStorage growth
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-50)))
    dismissed = true
  }
</script>

{#if announcement && !dismissed}
  <div class="announcement-banner" role="alert" aria-live="polite" data-testid="announcement-banner">
    <span class="announcement-icon" aria-hidden="true">📋</span>
    <p class="announcement-text" data-testid="announcement-text">{announcement.message}</p>
    <button
      class="dismiss-btn"
      onclick={dismiss}
      aria-label="Dismiss announcement"
      data-testid="dismiss-announcement-btn"
    >
      ✕
    </button>
  </div>
{/if}

<style>
  .announcement-banner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    background: #1e3a2a;
    border: 1px solid #2e5a3a;
    border-radius: 8px;
    margin: 0 0 8px 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .announcement-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .announcement-text {
    flex: 1;
    font-size: 13px;
    color: #c0e8d0;
    line-height: 1.4;
    margin: 0;
    /* Prevent XSS: message is plain text rendered as text content, not innerHTML */
  }

  .dismiss-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #6a8a7a;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .dismiss-btn:hover {
    color: #c0e8d0;
  }
</style>

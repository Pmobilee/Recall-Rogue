/**
 * Local push notification scheduling for Recall Rogue.
 * 4 notification types (streak risk, milestone, review due, win-back),
 * max 1/day, quiet hours enforced (10 PM – 8 AM).
 * Falls back to no-op on web or when Capacitor plugin unavailable.
 */

// ── Capacitor Plugin Interface ──────────────────────────────────
// Typed locally so we don't need @capacitor/local-notifications installed.

interface LocalNotificationSchema {
  id: number;
  title: string;
  body: string;
  schedule?: { at: Date };
  sound?: string | undefined;
  actionTypeId?: string;
}

interface LocalNotificationsPlugin {
  requestPermissions(): Promise<{ display: string }>;
  schedule(opts: { notifications: LocalNotificationSchema[] }): Promise<void>;
  getPending(): Promise<{ notifications: Array<{ id: number }> }>;
  cancel(opts: { notifications: Array<{ id: number }> }): Promise<void>;
}

/**
 * Dynamically resolve the Capacitor LocalNotifications plugin.
 * Uses an indirect import path so TypeScript doesn't fail when the package isn't installed.
 * Returns null on web or when the plugin isn't available.
 */
async function getLocalNotifications(): Promise<LocalNotificationsPlugin | null> {
  try {
    // Indirect path prevents TS module resolution at compile time.
    const moduleName = '@capacitor/local-notifications';
    const mod = await import(/* @vite-ignore */ moduleName) as { LocalNotifications?: LocalNotificationsPlugin };
    return mod.LocalNotifications ?? null;
  } catch {
    return null;
  }
}

// ── Types ──────────────────────────────────────────────────────

/** Per-type toggle preferences for push notifications. */
export interface NotificationPreferences {
  enabled: boolean;
  streakReminders: boolean;
  reviewReminders: boolean;
  milestoneAlerts: boolean;
  winbackMessages: boolean;
}

/** Persisted notification scheduling state. */
export interface NotificationState {
  preferences: NotificationPreferences;
  lastNotificationDate: string | null;  // ISO date (YYYY-MM-DD)
  lastSessionDate: string | null;       // ISO date
  permissionRequested: boolean;
  permissionGranted: boolean;
}

/** Minimal player data needed for notification scheduling decisions. */
export interface NotificationPlayerData {
  /** Current daily streak count. */
  currentStreak: number;
  /** Number of FSRS facts currently due for review. */
  dueReviewCount: number;
  /** ISO date (YYYY-MM-DD) of last completed session/run, or null. */
  lastSessionDate: string | null;
  /** Domain name the player is closest to a mastery milestone in, or null. */
  nearMilestoneDomain: string | null;
  /** How many facts away from the next milestone (0 = at milestone). */
  factsToMilestone: number;
}

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'recall-rogue-notifications';

const NOTIFICATION_IDS = {
  STREAK_RISK: 1001,
  MILESTONE: 1002,
  REVIEW_DUE: 1003,
  WINBACK: 1004,
} as const;

/** Quiet hours: notifications are suppressed between 10 PM and 8 AM local time. */
const QUIET_START_HOUR = 22; // 10 PM
const QUIET_END_HOUR = 8;   // 8 AM

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  streakReminders: true,
  reviewReminders: true,
  milestoneAlerts: true,
  winbackMessages: true,
};

const DEFAULT_STATE: NotificationState = {
  preferences: { ...DEFAULT_PREFERENCES },
  lastNotificationDate: null,
  lastSessionDate: null,
  permissionRequested: false,
  permissionGranted: false,
};

// ── State Persistence ──────────────────────────────────────────

/** Load notification state from localStorage. */
function loadState(): NotificationState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE, preferences: { ...DEFAULT_PREFERENCES } };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, preferences: { ...DEFAULT_PREFERENCES } };
    const parsed = JSON.parse(raw) as Partial<NotificationState>;
    // Merge with defaults so new fields are always present.
    return {
      ...DEFAULT_STATE,
      ...parsed,
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences ?? {}) },
    };
  } catch {
    return { ...DEFAULT_STATE, preferences: { ...DEFAULT_PREFERENCES } };
  }
}

/** Save notification state to localStorage. */
function saveState(state: NotificationState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

// ── Preference Accessors ───────────────────────────────────────

/**
 * Returns the current notification preferences.
 */
export function getNotificationPreferences(): NotificationPreferences {
  return { ...loadState().preferences };
}

/**
 * Persists updated notification preferences.
 * If master toggle is turned off, cancels all pending notifications.
 *
 * @param prefs - New preference values (partial merge).
 */
export function setNotificationPreferences(prefs: Partial<NotificationPreferences>): void {
  const state = loadState();
  state.preferences = { ...state.preferences, ...prefs };
  saveState(state);

  if (!state.preferences.enabled) {
    void cancelAllNotifications();
  }
}

// ── Permission ─────────────────────────────────────────────────

/**
 * Requests notification permission from the OS.
 * Called after the player's first completed run.
 *
 * @returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const state = loadState();
  state.permissionRequested = true;

  try {
    const ln = await getLocalNotifications();
    if (!ln) {
      state.permissionGranted = false;
      saveState(state);
      return false;
    }
    const result = await ln.requestPermissions();
    const granted = result.display === 'granted';
    state.permissionGranted = granted;
    saveState(state);
    return granted;
  } catch {
    // Web or plugin not available — treat as not granted.
    state.permissionGranted = false;
    saveState(state);
    return false;
  }
}

/**
 * Checks whether notification permission has been granted.
 */
export function hasNotificationPermission(): boolean {
  return loadState().permissionGranted;
}

// ── Cancel ─────────────────────────────────────────────────────

/**
 * Cancels all pending local notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    const ln = await getLocalNotifications();
    if (!ln) return;
    const pending = await ln.getPending();
    if (pending.notifications.length > 0) {
      await ln.cancel({ notifications: pending.notifications });
    }
  } catch {
    // Web or plugin not available — no-op.
  }
}

// ── Schedule Helper ────────────────────────────────────────────

/**
 * Schedules a single local notification at the given time.
 * Applies quiet-hours enforcement: if `at` falls within 10 PM – 8 AM,
 * the notification is pushed to 8 AM the same or next day.
 */
async function scheduleNotification(id: number, title: string, body: string, at: Date): Promise<void> {
  const adjusted = enforceQuietHours(at);

  // Don't schedule in the past.
  if (adjusted.getTime() <= Date.now()) return;

  try {
    const ln = await getLocalNotifications();
    if (!ln) return;
    await ln.schedule({
      notifications: [{
        id,
        title,
        body,
        schedule: { at: adjusted },
        actionTypeId: 'OPEN_APP',
      }],
    });
  } catch {
    // Web or plugin not available — no-op.
  }
}

/**
 * If `date` falls in quiet hours (10 PM – 8 AM), pushes it to 8 AM.
 */
function enforceQuietHours(date: Date): Date {
  const hour = date.getHours();
  if (hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR) {
    const adjusted = new Date(date);
    // If after 10 PM, push to 8 AM next day.
    if (hour >= QUIET_START_HOUR) {
      adjusted.setDate(adjusted.getDate() + 1);
    }
    adjusted.setHours(QUIET_END_HOUR, 0, 0, 0);
    return adjusted;
  }
  return date;
}

/**
 * Returns today's date as YYYY-MM-DD in local time.
 */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Counts full calendar days between an ISO date string and today.
 * Returns Infinity if the date is null.
 */
function daysSince(isoDate: string | null): number {
  if (!isoDate) return Infinity;
  const then = new Date(isoDate + 'T00:00:00');
  const now = new Date(todayISO() + 'T00:00:00');
  const diff = now.getTime() - then.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ── Main Rescheduler ───────────────────────────────────────────

/**
 * Main rescheduling function. Called on every app open and after each run completion.
 *
 * Algorithm:
 * 1. Cancel all pending notifications.
 * 2. Evaluate which notification type should fire (priority order):
 *    - Streak Risk (highest)
 *    - Milestone Proximity
 *    - Facts Due for Review
 *    - Win-back (lowest)
 * 3. Schedule exactly one notification — the highest-priority match.
 * 4. Enforce max-1-per-day and quiet-hours rules.
 *
 * @param playerData - Current player state used for scheduling decisions.
 */
export async function rescheduleNotifications(playerData: NotificationPlayerData): Promise<void> {
  const state = loadState();

  // Update session tracking.
  state.lastSessionDate = todayISO();
  saveState(state);

  // Bail out early if notifications are globally disabled or permission not granted.
  if (!state.preferences.enabled || !state.permissionGranted) return;

  // Cancel everything; we'll reschedule from scratch.
  await cancelAllNotifications();

  // Max 1 notification per day — if we already sent one today, skip.
  if (state.lastNotificationDate === todayISO()) return;

  const now = new Date();

  // ── Priority 1: Streak Risk ────────────────────────────────
  // Trigger: No run completed today, player has streak >= 2 days.
  // Schedule: 6 hours before midnight (= 6 PM local).
  if (state.preferences.streakReminders && playerData.currentStreak >= 2) {
    const streakTime = new Date(now);
    streakTime.setHours(18, 0, 0, 0);

    if (streakTime.getTime() > now.getTime()) {
      await scheduleNotification(
        NOTIFICATION_IDS.STREAK_RISK,
        'Streak at risk!',
        `Your ${playerData.currentStreak}-day streak is at risk! Jump back into the dungeon.`,
        streakTime,
      );
      state.lastNotificationDate = todayISO();
      saveState(state);
      return;
    }
  }

  // ── Priority 2: Milestone Proximity ────────────────────────
  // Trigger: Player is within 2 facts of a mastery milestone.
  // Schedule: 4 hours after last session.
  if (
    state.preferences.milestoneAlerts &&
    playerData.nearMilestoneDomain &&
    playerData.factsToMilestone > 0 &&
    playerData.factsToMilestone <= 2
  ) {
    const milestoneTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    await scheduleNotification(
      NOTIFICATION_IDS.MILESTONE,
      'Almost there!',
      `You're ${playerData.factsToMilestone} fact${playerData.factsToMilestone === 1 ? '' : 's'} from mastering ${playerData.nearMilestoneDomain}!`,
      milestoneTime,
    );
    state.lastNotificationDate = todayISO();
    saveState(state);
    return;
  }

  // ── Priority 3: Facts Due for Review ───────────────────────
  // Trigger: FSRS has 10+ facts due for review.
  // Schedule: 9 AM local (tomorrow if past 9 AM today).
  if (state.preferences.reviewReminders && playerData.dueReviewCount >= 10) {
    const reviewTime = new Date(now);
    reviewTime.setHours(9, 0, 0, 0);
    if (reviewTime.getTime() <= now.getTime()) {
      reviewTime.setDate(reviewTime.getDate() + 1);
    }
    await scheduleNotification(
      NOTIFICATION_IDS.REVIEW_DUE,
      'Facts ready for review',
      `${playerData.dueReviewCount} facts are ready for review. Keep your knowledge sharp!`,
      reviewTime,
    );
    state.lastNotificationDate = todayISO();
    saveState(state);
    return;
  }

  // ── Priority 4: Win-back ───────────────────────────────────
  // Trigger: No session in 3+ days. Schedule at day 3, 7, 14. Stop after 14.
  if (state.preferences.winbackMessages && playerData.lastSessionDate) {
    const absence = daysSince(playerData.lastSessionDate);
    const winbackDays = [3, 7, 14];
    for (const targetDay of winbackDays) {
      if (absence >= targetDay) continue; // Already past this window.
      const winbackDate = new Date(playerData.lastSessionDate + 'T10:00:00');
      winbackDate.setDate(winbackDate.getDate() + targetDay);

      if (winbackDate.getTime() > now.getTime()) {
        await scheduleNotification(
          NOTIFICATION_IDS.WINBACK,
          'Your deck misses you',
          `Your deck misses you. ${playerData.dueReviewCount} facts are overdue for review.`,
          winbackDate,
        );
        state.lastNotificationDate = todayISO();
        saveState(state);
        return;
      }
    }
  }
}

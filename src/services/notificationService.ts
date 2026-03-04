/**
 * Push notification service.
 * On native Capacitor builds this will schedule LocalNotifications once
 * the `@capacitor/local-notifications` plugin is installed (`npm install
 * @capacitor/local-notifications && npx cap sync`).
 *
 * Until that plugin is added as a dependency all scheduling functions are
 * no-op stubs so the rest of the codebase can import and call them safely.
 *
 * Per DD-V2-159:
 * - Maximum 1 notification per day, only if app not opened
 * - Permission requested AFTER first successful dive
 * - Stop all notifications after 7 consecutive no-engagement days
 * - All content is GAIA-voiced, in character
 */

const IS_NATIVE = typeof (window as unknown as Record<string, unknown>)['Capacitor'] !== 'undefined'

export interface NotificationContent {
  title: string
  body: string
  /** Seconds from now to show the notification */
  delaySeconds: number
}

// === NOTIFICATION CONTENT TEMPLATES ===
// All GAIA-voiced. Never use urgency framing. Never guilt-trip.
export const NOTIFICATION_TEMPLATES = {
  streakReminder: [
    { title: 'G.A.I.A.', body: 'Your expedition is waiting. Even a quick dive keeps the momentum.' },
    { title: 'G.A.I.A.', body: 'The mine has been quiet today. You coming?' },
    { title: 'G.A.I.A.', body: 'Your Knowledge Tree is ready for some new leaves.' },
  ],
  reviewReady: [
    { title: 'G.A.I.A.', body: 'Some facts are due for review. Your brain is ready to strengthen them.' },
    { title: 'G.A.I.A.', body: 'Memory check: I found connections between some of your stored facts.' },
    { title: 'G.A.I.A.', body: 'A few facts are ready to be reinforced. 5 minutes, miner.' },
  ],
  petNeedsAttention: [
    { title: 'G.A.I.A.', body: 'Your fossil companion is restless. Just checking in.' },
    { title: 'G.A.I.A.', body: 'The zoo residents are lively today. Worth a visit.' },
  ],
  farmReady: [
    { title: 'G.A.I.A.', body: 'Your farm has something ready to harvest.' },
    { title: 'G.A.I.A.', body: 'Farm production complete. A quick collection run awaits.' },
  ],
} as const satisfies Record<string, readonly { title: string; body: string }[]>

export type NotificationCategory = keyof typeof NOTIFICATION_TEMPLATES

/** Resolve the Capacitor LocalNotifications plugin at runtime without a static import. */
async function getLocalNotifications(): Promise<{
  requestPermissions: () => Promise<{ display: string }>
  schedule: (opts: {
    notifications: Array<{
      id: number
      title: string
      body: string
      schedule: { at: Date }
      smallIcon: string
      iconColor: string
    }>
  }) => Promise<void>
  cancel: (opts: { notifications: Array<{ id: number }> }) => Promise<void>
} | null> {
  try {
    // Use indirect property access so TypeScript does not try to resolve the
    // module path at compile time. The package is only available on native
    // Capacitor builds; on web/node this block is unreachable (IS_NATIVE guard).
    const cap = (window as unknown as Record<string, unknown>)['Capacitor'] as
      | { Plugins?: Record<string, unknown> }
      | undefined
    const plugin = cap?.Plugins?.['LocalNotifications']
    if (!plugin) return null
    return plugin as ReturnType<typeof getLocalNotifications> extends Promise<infer T> ? T : never
  } catch {
    return null
  }
}

/**
 * Request notification permission — call ONLY after first successful dive completes.
 * Per DD-V2-159: never request during onboarding.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!IS_NATIVE) return false
  try {
    const ln = await getLocalNotifications()
    if (!ln) {
      console.warn('[NotificationService] LocalNotifications plugin not available')
      return false
    }
    const result = await ln.requestPermissions()
    return result.display === 'granted'
  } catch {
    return false
  }
}

/**
 * Schedule tomorrow's reminder notification (if app not opened today).
 * Call once per session after login is recorded.
 */
export async function scheduleDailyReminder(category: NotificationCategory): Promise<void> {
  if (!IS_NATIVE) return
  try {
    const ln = await getLocalNotifications()
    if (!ln) {
      console.warn('[NotificationService] LocalNotifications plugin not available — skipping schedule')
      return
    }
    const templates = NOTIFICATION_TEMPLATES[category]
    const template = templates[Math.floor(Math.random() * templates.length)]

    // Schedule for next day at 10:00 AM local time
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)

    await ln.schedule({
      notifications: [{
        id: 1001, // Fixed ID — overwrite previous day's reminder
        title: template.title,
        body: template.body,
        schedule: { at: tomorrow },
        smallIcon: 'ic_notification',
        iconColor: '#4a9eff',
      }]
    })
  } catch (e) {
    console.warn('[NotificationService] schedule failed:', e)
  }
}

/** Cancel all scheduled notifications. Call after 7 days of no engagement. */
export async function cancelAllNotifications(): Promise<void> {
  if (!IS_NATIVE) return
  try {
    const ln = await getLocalNotifications()
    if (!ln) return
    await ln.cancel({ notifications: [{ id: 1001 }] })
  } catch {
    // silent
  }
}

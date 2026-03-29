/**
 * Session Timer — tracks daily play time and enforces parental time limits.
 * Time is tracked in seconds, persisted to localStorage under 'rr_session_<ISO_date>'.
 * The ticker runs via a 1-second setInterval started by SessionTimer.start().
 *
 * DD-V2-181: Gentle warning at limit-5min; hard stop at limit; PIN override available.
 */

const STORAGE_PREFIX = 'rr_session_'

export interface SessionTimerState {
  /** Seconds played today. */
  secondsToday: number
  /** Daily limit in seconds. 0 = unlimited. */
  limitSeconds: number
  /** Whether the hard-stop overlay is active. */
  hardStopped: boolean
  /** Whether the 5-minute warning has been shown today. */
  warningSent: boolean
}

type TimerListener = (state: SessionTimerState) => void

class SessionTimer {
  private tickerId: ReturnType<typeof setInterval> | null = null
  private listeners: Set<TimerListener> = new Set()
  private state: SessionTimerState = {
    secondsToday: 0,
    limitSeconds: 0,
    hardStopped: false,
    warningSent: false,
  }

  private todayKey(): string {
    return STORAGE_PREFIX + new Date().toISOString().slice(0, 10)
  }

  /** Called once on app mount when kid mode is active. */
  start(limitSeconds: number): void {
    this.state.limitSeconds = limitSeconds
    this.state.secondsToday = parseInt(localStorage.getItem(this.todayKey()) ?? '0', 10)
    this.checkThresholds()

    if (this.tickerId !== null) return
    this.tickerId = setInterval(() => this.tick(), 1000)
  }

  stop(): void {
    if (this.tickerId !== null) {
      clearInterval(this.tickerId)
      this.tickerId = null
    }
  }

  /** PIN override — resets hard stop for this session only (does not reset daily counter). */
  parentOverride(): void {
    this.state.hardStopped = false
    this.notify()
  }

  subscribe(listener: TimerListener): () => void {
    this.listeners.add(listener)
    listener({ ...this.state })
    return () => this.listeners.delete(listener)
  }

  private tick(): void {
    this.state.secondsToday += 1
    localStorage.setItem(this.todayKey(), String(this.state.secondsToday))
    this.checkThresholds()
    this.notify()
  }

  private checkThresholds(): void {
    const { limitSeconds, secondsToday, warningSent } = this.state
    if (limitSeconds === 0) return

    const remaining = limitSeconds - secondsToday
    if (!warningSent && remaining <= 300 && remaining > 0) {
      this.state.warningSent = true
      this.notify()
    }
    if (remaining <= 0 && !this.state.hardStopped) {
      this.state.hardStopped = true
      this.notify()
    }
  }

  private notify(): void {
    const snapshot = { ...this.state }
    this.listeners.forEach(l => l(snapshot))
  }
}

export const sessionTimer = new SessionTimer()

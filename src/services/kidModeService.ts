/** Parental controls configuration */
export interface ParentalControls {
  enabled: boolean
  pin: string                // 4-digit PIN for settings access
  maxDailyMinutes: number    // Daily play time limit (0 = unlimited)
  ageRating: 'kid' | 'teen'  // Content filter level
  socialEnabled: boolean     // Hub visiting, trading, guilds
  notificationsEnabled: boolean
  weeklyReportEmail: string  // Parent email for weekly summaries
}

/** Default parental controls */
const DEFAULT_CONTROLS: ParentalControls = {
  enabled: false,
  pin: '',
  maxDailyMinutes: 60,
  ageRating: 'kid',
  socialEnabled: false,
  notificationsEnabled: false,
  weeklyReportEmail: ''
}

const CONTROLS_KEY = 'rr_parental_controls'

class KidModeService {
  private controls: ParentalControls = DEFAULT_CONTROLS
  private sessionStartTime: number = Date.now()
  private dailyPlayedMinutes: number = 0

  constructor() {
    this.loadControls()
  }

  /** Load parental controls from localStorage */
  private loadControls(): void {
    try {
      const stored = localStorage.getItem(CONTROLS_KEY)
      if (stored) {
        this.controls = { ...DEFAULT_CONTROLS, ...JSON.parse(stored) }
      }
    } catch { /* ignore */ }
  }

  /** Save parental controls */
  saveControls(controls: Partial<ParentalControls>): void {
    this.controls = { ...this.controls, ...controls }
    localStorage.setItem(CONTROLS_KEY, JSON.stringify(this.controls))
  }

  /** Verify PIN for settings access */
  verifyPin(pin: string): boolean {
    if (!this.controls.enabled || !this.controls.pin) return true
    return pin === this.controls.pin
  }

  /** Set up parental controls with PIN */
  enableKidMode(pin: string, config: Partial<ParentalControls>): void {
    this.saveControls({ ...config, enabled: true, pin })
  }

  /** Disable kid mode (requires PIN) */
  disableKidMode(pin: string): boolean {
    if (!this.verifyPin(pin)) return false
    this.saveControls({ enabled: false, pin: '' })
    return true
  }

  /** Check if kid mode is active */
  isKidMode(): boolean {
    return this.controls.enabled
  }

  /** Get current controls */
  getControls(): ParentalControls {
    return { ...this.controls }
  }

  /** Check if time limit has been reached */
  isTimeLimitReached(): boolean {
    if (!this.controls.enabled || this.controls.maxDailyMinutes === 0) return false
    const sessionMinutes = (Date.now() - this.sessionStartTime) / (1000 * 60)
    return (this.dailyPlayedMinutes + sessionMinutes) >= this.controls.maxDailyMinutes
  }

  /** Get remaining play time in minutes */
  getRemainingMinutes(): number {
    if (!this.controls.enabled || this.controls.maxDailyMinutes === 0) return Infinity
    const sessionMinutes = (Date.now() - this.sessionStartTime) / (1000 * 60)
    return Math.max(0, this.controls.maxDailyMinutes - this.dailyPlayedMinutes - sessionMinutes)
  }

  /** Track session time for daily limit */
  startSession(): void {
    this.sessionStartTime = Date.now()
    // Load today's accumulated time
    const today = new Date().toISOString().slice(0, 10)
    const stored = localStorage.getItem(`rr_playtime_${today}`)
    this.dailyPlayedMinutes = stored ? parseFloat(stored) : 0
  }

  /** End session and persist time */
  endSession(): void {
    const sessionMinutes = (Date.now() - this.sessionStartTime) / (1000 * 60)
    this.dailyPlayedMinutes += sessionMinutes
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(`rr_playtime_${today}`, String(this.dailyPlayedMinutes))
  }

  /** Check if social features are allowed */
  isSocialAllowed(): boolean {
    if (!this.controls.enabled) return true
    return this.controls.socialEnabled
  }

  /** Get age-appropriate content filter */
  getContentFilter(): 'kid' | 'teen' | 'adult' {
    if (!this.controls.enabled) return 'adult'
    return this.controls.ageRating
  }

  /** DD-V2-175: Kid Wow Score — ensure kids get equally exciting content */
  getMinWowScore(): number {
    if (!this.controls.enabled) return 0
    return 7  // Kids get content with wow factor >= 7/10
  }
}

export const kidModeService = new KidModeService()

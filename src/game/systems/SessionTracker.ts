import { BALANCE } from '../../data/balance'

/**
 * Tracks the current play session for anti-binge and session-flow analytics.
 * Instantiated by GameManager, persisted only for current app lifecycle (not saved to disk).
 */
export class SessionTracker {
  private sessionStartMs: number = Date.now()
  private divesThisSession: number = 0
  private blocksThisSession: number = 0

  /** Reset all session counters. Called on app startup. */
  startSession(): void {
    this.sessionStartMs = Date.now()
    this.divesThisSession = 0
    this.blocksThisSession = 0
  }

  /** Record a completed dive. */
  recordDiveComplete(): void {
    this.divesThisSession++
  }

  /** Record a mined block. */
  recordBlockMined(): void {
    this.blocksThisSession++
  }

  /** Elapsed time since session started in milliseconds. */
  get sessionElapsedMs(): number {
    return Date.now() - this.sessionStartMs
  }

  /** Number of dives completed this session. */
  get diveCount(): number {
    return this.divesThisSession
  }

  /** Number of blocks mined this session. */
  get blockCount(): number {
    return this.blocksThisSession
  }

  /** Returns true after the anti-binge threshold is exceeded. */
  get isAntiBingeActive(): boolean {
    return this.divesThisSession >= BALANCE.ANTI_BINGE_DIVE_THRESHOLD
  }

  /**
   * Returns the mineral drop multiplier for the current session.
   * Returns 1.0 normally; reduced after ANTI_BINGE_DIVE_THRESHOLD dives.
   */
  get mineralMultiplier(): number {
    return this.isAntiBingeActive ? BALANCE.ANTI_BINGE_MINERAL_MULT : 1.0
  }

  /**
   * Whether the quiz dust bonus is currently disabled (anti-binge).
   */
  get quizBonusDisabled(): boolean {
    return this.isAntiBingeActive && BALANCE.ANTI_BINGE_DISABLE_QUIZ_BONUS
  }

  /**
   * Returns a random GAIA anti-binge break suggestion message.
   * Only call when isAntiBingeActive === true.
   */
  get antiBingeGaiaMessage(): string {
    const msgs = BALANCE.ANTI_BINGE_GAIA_MESSAGES
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
}

/**
 * Simple token-bucket rate limiter for the Claude API.
 * Prevents exceeding Anthropic's rate limits during batch generation.
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  private lastStartTime = 0;

  constructor(
    /** Max concurrent in-flight requests. */
    private readonly concurrency: number,
    /** Minimum ms between any two request starts. */
    private readonly minIntervalMs: number
  ) {}

  /**
   * Acquire a slot, respecting concurrency and minimum interval.
   * Returns a release function that must be called when the request finishes.
   */
  async acquire(): Promise<() => void> {
    while (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    const now = Date.now();
    const wait = this.minIntervalMs - (now - this.lastStartTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastStartTime = Date.now();
    this.running++;
    return () => {
      this.running--;
      this.queue.shift()?.();
    };
  }
}

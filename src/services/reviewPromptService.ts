/**
 * @file reviewPromptService.ts
 * Triggers App Store / Play Store review prompts at emotionally positive peaks.
 * Uses Capacitor's native review API or falls back to no-op on web.
 *
 * Trigger conditions (any ONE triggers the prompt):
 * 1. First boss kill (any boss)
 * 2. First Tier 2 promotion (any fact reaches Tier 2a or 2b)
 * 3. 7-day streak reached
 *
 * Rate limiting:
 * - Max 1 prompt per 90 days
 * - Never during an active run (caller responsibility)
 * - Never after a death/defeat (caller responsibility)
 * - Minimum 3 completed runs before any prompt
 * - Max 3 prompts total per year (Apple guideline)
 */

const STORAGE_KEY = 'terra-review-prompt-state';

interface ReviewPromptState {
  lastPromptDate: string | null;
  totalCompletedRuns: number;
  hasKilledBoss: boolean;
  hasReachedTier2: boolean;
  hasReached7DayStreak: boolean;
  promptCount: number;
  /** ISO date strings of each prompt, used for per-year cap. */
  promptDates: string[];
}

const DEFAULT_STATE: ReviewPromptState = {
  lastPromptDate: null,
  totalCompletedRuns: 0,
  hasKilledBoss: false,
  hasReachedTier2: false,
  hasReached7DayStreak: false,
  promptCount: 0,
  promptDates: [],
};

const MIN_COMPLETED_RUNS = 3;
const COOLDOWN_DAYS = 90;
const MAX_PROMPTS_PER_YEAR = 3;
const STREAK_TRIGGER_DAYS = 7;

/**
 * Load persisted review prompt state from localStorage.
 */
function loadState(): ReviewPromptState {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_STATE };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Persist review prompt state to localStorage.
 */
function saveState(state: ReviewPromptState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch { /* storage full or unavailable */ }
}

/**
 * Check whether the review prompt can fire right now (rate-limit checks).
 */
export function canPrompt(): boolean {
  const state = loadState();

  // Must have completed enough runs
  if (state.totalCompletedRuns < MIN_COMPLETED_RUNS) return false;

  // 90-day cooldown
  if (state.lastPromptDate) {
    const lastDate = new Date(state.lastPromptDate).getTime();
    const now = Date.now();
    if (now - lastDate < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return false;
  }

  // Max 3 prompts per rolling year
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const promptsThisYear = (state.promptDates ?? []).filter(
    (d) => new Date(d).getTime() > oneYearAgo,
  ).length;
  if (promptsThisYear >= MAX_PROMPTS_PER_YEAR) return false;

  return true;
}

/**
 * Actually show the native review prompt. Uses dynamic import for Capacitor.
 * No-ops silently on web or when the plugin is unavailable.
 */
export async function triggerReviewPrompt(): Promise<void> {
  if (!canPrompt()) return;

  const state = loadState();
  const now = new Date().toISOString();
  state.lastPromptDate = now;
  state.promptCount += 1;
  state.promptDates = [...(state.promptDates ?? []), now];
  saveState(state);

  try {
    // Use Capacitor's registerPlugin to access the StoreReview plugin
    // without requiring @capacitor/app as a direct dependency.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPlugin } = require('@capacitor/core') as typeof import('@capacitor/core');
    const StoreReview = registerPlugin<{ requestReview: () => Promise<void> }>('StoreReview');
    await StoreReview.requestReview();
  } catch {
    // Web or plugin not installed — no-op
    if (import.meta.env.DEV) console.log('[ReviewPrompt] Native review not available');
  }
}

/**
 * Update completed run count. Call after every successful run completion.
 */
export function recordRunCompleted(): void {
  const state = loadState();
  state.totalCompletedRuns += 1;
  saveState(state);
}

/**
 * Check whether a boss kill should trigger the review prompt.
 * Call after a boss is defeated and the player is NOT in an active encounter.
 */
export async function checkBossKillTrigger(): Promise<void> {
  const state = loadState();
  if (state.hasKilledBoss) return; // Already triggered once

  state.hasKilledBoss = true;
  saveState(state);

  await triggerReviewPrompt();
}

/**
 * Check whether a tier promotion should trigger the review prompt.
 * Call after any fact reaches Tier 2a, 2b, or 3 for the first time.
 *
 * @param newTier - The tier the fact was promoted to.
 */
export async function checkTierUpTrigger(newTier: string): Promise<void> {
  if (newTier !== '2a' && newTier !== '2b' && newTier !== '3') return;

  const state = loadState();
  if (state.hasReachedTier2) return; // Already triggered once

  state.hasReachedTier2 = true;
  saveState(state);

  await triggerReviewPrompt();
}

/**
 * Check whether reaching a streak milestone should trigger the review prompt.
 * Call after daily streak is updated.
 *
 * @param streakDays - Current consecutive streak in days.
 */
export async function checkStreakTrigger(streakDays: number): Promise<void> {
  if (streakDays < STREAK_TRIGGER_DAYS) return;

  const state = loadState();
  if (state.hasReached7DayStreak) return; // Already triggered once

  state.hasReached7DayStreak = true;
  saveState(state);

  await triggerReviewPrompt();
}

// Re-export for backward compatibility
export type { ReviewPromptState };

/**
 * Legacy compatibility: Check whether the review prompt should fire now.
 * @deprecated Use the specific trigger functions instead.
 */
export interface ReviewEligibilityData {
  totalDives: number;
  masteredFacts: number;
  wasPositiveMoment: boolean;
}

/**
 * Legacy compatibility function.
 * @deprecated Use checkBossKillTrigger, checkTierUpTrigger, or checkStreakTrigger instead.
 */
export function shouldShowReviewPrompt(data: ReviewEligibilityData): boolean {
  if (!data.wasPositiveMoment) return false;
  if (data.totalDives < MIN_COMPLETED_RUNS) return false;
  return canPrompt();
}

/**
 * Legacy compatibility function.
 * @deprecated Use triggerReviewPrompt instead.
 */
export const fireReviewPrompt = triggerReviewPrompt;

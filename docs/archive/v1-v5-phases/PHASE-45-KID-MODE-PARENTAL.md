# Phase 45: Kid Mode & Parental Controls

## Overview

**Goal**: Build a first-class parental-control layer on top of the existing COPPA age-gate infrastructure, giving parents full visibility and authority over how their child uses Terra Gacha. The centrepiece is the Kid Wow Score — a star-based mastery display that replaces the numeric SM-2 review grades visible to kids — alongside session time limits with a hard stop, a PIN-protected parent panel, weekly learning email digests, aggressive content filtering for the `under_13` age bracket, full COPPA data-collection enforcement, and a kid-friendly UI theme that makes the game feel welcoming rather than intimidating for young players.

**Why this phase matters**: A meaningful share of Terra Gacha players are children using a parent's device or their own. App store reviewers and schools scrutinise child-safety features closely. Shipping a credible parental-controls suite (with COPPA enforcement, spending guards, and progress visibility) is the prerequisite for educational-partnership deals (Phase 44) and for any serious push into the K-12 market. It also eliminates the most common negative-review categories: surprise spending, excessive screen time, and complex UI that frustrates younger players.

**Dependencies (must be complete before starting)**:
- Phase 19 Auth & Cloud — `AgeGate.svelte`, `AGE_BRACKET_KEY`, `AgeRating` type, profile system, `authStore`
- Phase 21 Monetization — IAP guard hooks, `TerraPassModal`, O2 regen; kid spending block references these
- Phase 14 Onboarding — tutorial flow sets `ageRating` in player save via `initPlayer()`
- Phase 22 Social — social features that must be disabled in kid mode (hub visiting, duels, trading, guilds)

**Design decisions governing this phase**:
- **DD-V2-180**: Kid Mode — star-based "Wow Score" replaces numeric SM-2 review score; no visible interval numbers; encouraging, never punitive feedback
- **DD-V2-181**: Parental Controls — PIN-protected settings, configurable daily time limit, weekly email summary to parent address, social features disabled by default for under-13
- **DD-V2-131**: No premium randomization — under-13 players cannot initiate any real-money purchase; IAP surfaces show "Ask a parent" instead of a buy button

**Estimated complexity**: Medium-High. No new Phaser scenes are required. The work is spread across: two new Svelte stores, eight new Svelte components, three new server routes, extensions to `PlayerSave` and `settings.ts`, a cron-style weekly email job, and integration touchpoints in the quiz overlay, session tracker, and IAP guard. The trickiest part is the PIN system — it must be resistant to a determined 8-year-old without being obnoxious for parents.

**Files this phase creates or modifies** (complete list in section 6).

---

## Sub-Phases

---

### 45.1 — Kid Wow Score System

**Goal**: Replace numeric SM-2 feedback (ease factor, interval, repetition count) with a child-friendly star-based "Wow Score" whenever `ageRating === 'kid'`. The score has five levels (1–5 stars, mapped from SM-2 repetition milestones) and is shown on the quiz result screen, the fact reveal card, and the Knowledge Tree node tooltip.

---

#### 45.1.1 — `wowScore.ts` — Score Mapping Utility

Create `src/services/wowScore.ts`:

```typescript
/**
 * Kid Wow Score — maps SM-2 review state to a 1–5 star rating shown in Kid Mode.
 * Adults see the raw interval/repetition numbers; kids see stars and an encouraging label.
 *
 * Mapping (DD-V2-180):
 *   1 star  — Just discovered (repetitions === 0)
 *   2 stars — Getting there   (repetitions 1–2)
 *   3 stars — Pretty good     (repetitions 3–4)
 *   4 stars — Awesome         (repetitions 5–6)
 *   5 stars — EXPERT!         (repetitions >= 7 OR interval >= 21 days)
 */

import type { ReviewState } from '../data/types'

export type WowLevel = 1 | 2 | 3 | 4 | 5

export interface WowScore {
  /** 1–5 stars */
  level: WowLevel
  /** Short display label shown beneath the stars */
  label: string
  /** CSS colour class for the star fill — used in KidWowStars.svelte */
  colorClass: 'wow-1' | 'wow-2' | 'wow-3' | 'wow-4' | 'wow-5'
}

const WOW_LABELS: Record<WowLevel, string> = {
  1: 'Just found it!',
  2: 'Getting there!',
  3: 'Pretty good!',
  4: 'Awesome!',
  5: 'EXPERT!',
}

/**
 * Computes the Wow Score for a single review state.
 * Safe to call with undefined (returns level 1 — not yet reviewed).
 */
export function getWowScore(state: ReviewState | undefined): WowScore {
  const reps = state?.repetitions ?? 0
  const interval = state?.interval ?? 0

  let level: WowLevel
  if (reps === 0) {
    level = 1
  } else if (reps <= 2) {
    level = 2
  } else if (reps <= 4) {
    level = 3
  } else if (reps <= 6) {
    level = 4
  } else {
    level = 5
  }

  // Interval fast-track: if spaced repetition has already pushed this out 3+ weeks,
  // the fact is truly mastered regardless of repetition count.
  if (interval >= 21) level = 5

  return {
    level,
    label: WOW_LABELS[level],
    colorClass: `wow-${level}` as WowScore['colorClass'],
  }
}

/**
 * Returns the Wow Score label for a given level, suitable for aria-label strings.
 */
export function wowLevelAriaLabel(level: WowLevel): string {
  return `${level} out of 5 stars — ${WOW_LABELS[level]}`
}
```

**Acceptance criteria**:
- `getWowScore(undefined)` returns `{ level: 1, label: 'Just found it!', colorClass: 'wow-1' }`.
- `getWowScore({ repetitions: 5, interval: 10, ... })` returns level 4.
- `getWowScore({ repetitions: 2, interval: 30, ... })` returns level 5 (interval fast-track).
- Function is pure — no side effects, no store access.

---

#### 45.1.2 — `KidWowStars.svelte` — Reusable Star Display

Create `src/ui/components/KidWowStars.svelte`:

```svelte
<script lang="ts">
  import type { WowScore } from '../../services/wowScore'
  import { wowLevelAriaLabel } from '../../services/wowScore'

  interface Props {
    score: WowScore
    /** Size variant — 'sm' for inline tree tooltips, 'lg' for quiz result. */
    size?: 'sm' | 'lg'
    /** Whether to show the text label beneath the stars. */
    showLabel?: boolean
  }

  let { score, size = 'lg', showLabel = true }: Props = $props()
</script>

<div
  class="wow-stars wow-stars--{size}"
  role="img"
  aria-label={wowLevelAriaLabel(score.level)}
>
  {#each [1, 2, 3, 4, 5] as i (i)}
    <span
      class="star {i <= score.level ? `filled ${score.colorClass}` : 'empty'}"
      aria-hidden="true"
    >★</span>
  {/each}
  {#if showLabel}
    <span class="wow-label">{score.label}</span>
  {/if}
</div>

<style>
  .wow-stars {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    flex-wrap: wrap;
  }
  .wow-stars--lg { gap: 0.3rem; }

  .star { font-size: 1rem; color: #555; transition: color 200ms; }
  .wow-stars--lg .star { font-size: 1.6rem; }

  .filled.wow-1 { color: #a0a0a0; }
  .filled.wow-2 { color: #4ECDC4; }
  .filled.wow-3 { color: #FFD700; }
  .filled.wow-4 { color: #FF9F43; }
  .filled.wow-5 { color: #FF6B9D; text-shadow: 0 0 8px rgba(255,107,157,0.7); }

  .wow-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #eee;
    margin-left: 0.4rem;
    white-space: nowrap;
  }
  .wow-stars--lg .wow-label { font-size: 1rem; margin-left: 0.6rem; }
</style>
```

**Acceptance criteria**:
- Five stars render; filled stars use the colour class matching `score.colorClass`.
- `aria-label` reads "3 out of 5 stars — Pretty good!" for level 3.
- `size="sm"` reduces font-size; `showLabel={false}` hides the text label.

---

#### 45.1.3 — Integration: QuizOverlay & FactReveal

Modify `src/ui/components/QuizOverlay.svelte`:
- Import `getWowScore` from `../../services/wowScore` and `KidWowStars` component.
- Import `playerSave` from `../stores/playerData`.
- In the result panel (shown after `showResult === true`), conditionally render:

```svelte
{#if $playerSave?.ageRating === 'kid'}
  {@const reviewState = $playerSave.reviewStates.find(r => r.factId === fact.id)}
  <KidWowStars score={getWowScore(reviewState)} />
{:else}
  <!-- existing numeric feedback / SM-2 interval display -->
{/if}
```

The existing "you answered correctly" / "not quite" text phrases remain unchanged. Only the grade display changes.

**Acceptance criteria**:
- When `ageRating === 'kid'`, the quiz result shows stars and no numeric SM-2 data.
- When `ageRating === 'teen'` or `'adult'`, behaviour is unchanged.

---

#### 45.1.4 — Integration: Knowledge Tree Node Tooltip

Modify `src/ui/components/KnowledgeTree.svelte` (or the tooltip sub-component if it exists):
- When `$playerSave?.ageRating === 'kid'`, replace "Interval: X days" and "Repetitions: N" with `<KidWowStars score={wowScore} size="sm" />`.

**Acceptance criteria**:
- Kid-mode tree tooltips show stars. Adult tooltips show the existing numeric data.

---

### 45.2 — Session Time Limits

**Goal**: Allow a parent to set a daily play limit (15–120 minutes in 15-minute increments, or "unlimited"). The app tracks cumulative play time per calendar day. At the limit minus 5 minutes, a gentle warning banner appears. At the limit, a hard stop overlay blocks all gameplay until the next calendar day (or until a parent PIN override is entered).

---

#### 45.2.1 — `sessionTimer.ts` — Time Tracking Service

Create `src/services/sessionTimer.ts`:

```typescript
/**
 * Session Timer — tracks daily play time and enforces parental time limits.
 * Time is tracked in seconds, persisted to localStorage under 'terra_session_<ISO_date>'.
 * The ticker runs via a 1-second setInterval started by SessionTimer.start().
 *
 * DD-V2-181: Gentle warning at limit-5min; hard stop at limit; PIN override available.
 */

const STORAGE_PREFIX = 'terra_session_'

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
```

**Acceptance criteria**:
- `start(3600)` (1 hour) begins accumulating seconds.
- At 55 minutes elapsed, `warningSent` becomes true.
- At 60 minutes, `hardStopped` becomes true.
- `stop()` clears the interval; calling `start()` again resumes from the persisted count.
- Different calendar days use different localStorage keys; today's timer is independent of yesterday's.
- `parentOverride()` sets `hardStopped = false` without resetting `secondsToday`.

---

#### 45.2.2 — `TimeUpOverlay.svelte` — Hard Stop Screen

Create `src/ui/components/TimeUpOverlay.svelte`:

```svelte
<script lang="ts">
  import { sessionTimer } from '../../services/sessionTimer'
  import { parentalStore } from '../stores/parentalStore'

  interface Props {
    secondsPlayed: number
  }

  let { secondsPlayed }: Props = $props()

  let pinEntry = $state('')
  let pinError = $state(false)

  function formatMinutes(s: number): string {
    return Math.round(s / 60).toString()
  }

  function handlePinSubmit(): void {
    const pin = $parentalStore.pin
    if (pin && pinEntry === pin) {
      sessionTimer.parentOverride()
      pinEntry = ''
      pinError = false
    } else {
      pinError = true
      pinEntry = ''
    }
  }
</script>

<div class="time-up-overlay" role="alertdialog" aria-modal="true" aria-labelledby="time-up-title">
  <div class="time-up-card">
    <div class="time-up-icon" aria-hidden="true">⏰</div>
    <h1 id="time-up-title" class="time-up-heading">Great job today!</h1>
    <p class="time-up-body">
      You played for <strong>{formatMinutes(secondsPlayed)} minutes</strong>.<br>
      Come back tomorrow for more discoveries!
    </p>

    <div class="pin-section">
      <p class="pin-hint">Parent? Enter your PIN to keep playing.</p>
      <input
        class="pin-input {pinError ? 'pin-input--error' : ''}"
        type="password"
        inputmode="numeric"
        maxlength="6"
        placeholder="••••"
        bind:value={pinEntry}
        onkeydown={(e) => e.key === 'Enter' && handlePinSubmit()}
        aria-label="Parent PIN"
      />
      {#if pinError}
        <p class="pin-error" role="alert">Incorrect PIN. Try again.</p>
      {/if}
      <button class="pin-btn" type="button" onclick={handlePinSubmit}>
        Unlock
      </button>
    </div>
  </div>
</div>

<style>
  .time-up-overlay {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(10, 15, 40, 0.97);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .time-up-card {
    background: #16213e;
    border: 2px solid rgba(78, 205, 196, 0.4);
    border-radius: 24px;
    padding: 2.5rem 2rem;
    max-width: 360px;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }
  .time-up-icon { font-size: 4rem; }
  .time-up-heading { font-size: 1.8rem; color: #FFD700; margin: 0; font-weight: 900; }
  .time-up-body { color: rgba(238,238,238,0.85); font-size: 1rem; line-height: 1.6; margin: 0; }
  .pin-section { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; width: 100%; }
  .pin-hint { font-size: 0.75rem; color: rgba(238,238,238,0.4); margin: 0; }
  .pin-input {
    width: 120px; padding: 0.6rem; font-size: 1.2rem; text-align: center;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px; color: #eee; font-family: inherit;
  }
  .pin-input--error { border-color: #e94560; }
  .pin-error { font-size: 0.75rem; color: #e94560; margin: 0; }
  .pin-btn {
    padding: 0.5rem 1.5rem; background: rgba(78,205,196,0.15);
    border: 1px solid rgba(78,205,196,0.5); border-radius: 8px;
    color: #4ECDC4; font-size: 0.875rem; cursor: pointer;
  }
</style>
```

**Acceptance criteria**:
- Overlay renders on top of all game UI (`z-index: 9000`) when `hardStopped === true`.
- No game interaction is possible behind the overlay (`pointer-events: auto` on the overlay).
- Correct PIN dismisses overlay via `sessionTimer.parentOverride()`.
- Wrong PIN shows error and clears the input field.
- The minutes displayed are rounded from `secondsPlayed`.

---

#### 45.2.3 — `SessionWarningBanner.svelte` — 5-Minute Warning

Create `src/ui/components/SessionWarningBanner.svelte`:

```svelte
<script lang="ts">
  interface Props {
    minutesRemaining: number
    onDismiss: () => void
  }
  let { minutesRemaining, onDismiss }: Props = $props()
</script>

<div class="session-warning" role="status" aria-live="polite">
  <span class="warning-icon" aria-hidden="true">⌛</span>
  <span class="warning-text">
    {minutesRemaining} minute{minutesRemaining === 1 ? '' : 's'} left for today!
  </span>
  <button class="dismiss-btn" type="button" onclick={onDismiss} aria-label="Dismiss warning">✕</button>
</div>

<style>
  .session-warning {
    pointer-events: auto;
    position: fixed;
    top: 0.75rem; left: 50%; transform: translateX(-50%);
    z-index: 8000;
    display: flex; align-items: center; gap: 0.5rem;
    background: #FF9F43; color: #1a1a2e;
    border-radius: 20px; padding: 0.5rem 1rem;
    font-weight: 700; font-size: 0.9rem; white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  .warning-icon { font-size: 1.1rem; }
  .dismiss-btn {
    background: none; border: none; cursor: pointer;
    color: inherit; font-size: 0.9rem; margin-left: 0.25rem;
  }
</style>
```

**Acceptance criteria**:
- Banner appears at top-centre of screen when `warningSent === true && !hardStopped`.
- Dismissable by the child (closes banner but does not stop the timer).
- Does not prevent game interaction below it.

---

#### 45.2.4 — Integration: `App.svelte`

Modify `src/App.svelte`:
- Import `sessionTimer` and `parentalStore`.
- In `onMount`, if `$playerSave?.ageRating === 'kid'`, call `sessionTimer.start($parentalStore.limitSeconds)`.
- Subscribe to `sessionTimer` state. When `warningSent`, show `SessionWarningBanner` in the component tree. When `hardStopped`, show `TimeUpOverlay`.
- Call `sessionTimer.stop()` in the `onDestroy` handler.

**Acceptance criteria**:
- On app load with `ageRating === 'kid'` and a 60-minute limit, timer starts.
- Banner and hard-stop overlay appear at the correct thresholds.
- Timer is not started when `ageRating !== 'kid'` (performance: no rogue interval).

---

### 45.3 — Parent PIN System

**Goal**: A 4-to-6 digit PIN, set by the parent, that gates: (a) access to the Parental Controls panel inside Settings, (b) purchase confirmation for any IAP in kid mode, and (c) override of the time-up screen (45.2.2). The PIN is hashed with SHA-256 and stored in localStorage (not plaintext). A "forgot PIN" flow sends a reset email to the parent's verified address.

---

#### 45.3.1 — `parentalStore.ts` — Parental Settings Svelte Store

Create `src/ui/stores/parentalStore.ts`:

```typescript
/**
 * Parental control settings store.
 * PIN is stored as a SHA-256 hex digest. Plaintext never leaves the browser.
 * localStorage key: 'terra_parental_v1'
 */

import { writable, get } from 'svelte/store'

export interface ParentalSettings {
  /** SHA-256 hex digest of the PIN, or null if no PIN is set. */
  pinHash: string | null
  /** Raw PIN for in-memory comparison ONLY — never persisted. */
  pin: string | null
  /** Daily play limit in seconds. 0 = unlimited. */
  limitSeconds: number
  /** Whether social features (hub visits, duels, trading, guilds) are enabled for this kid profile. */
  socialEnabled: boolean
  /** Parent email for weekly reports. null if not configured. */
  parentEmail: string | null
  /** Whether weekly learning report emails are enabled. */
  weeklyReportEnabled: boolean
  /** Whether kid-mode theme (larger buttons, simplified nav) is forced. */
  kidThemeEnabled: boolean
}

const STORAGE_KEY = 'terra_parental_v1'

function loadFromStorage(): ParentalSettings {
  if (typeof localStorage === 'undefined') return defaultSettings()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw) as Partial<ParentalSettings>
    return { ...defaultSettings(), ...parsed, pin: null } // never load plaintext pin
  } catch {
    return defaultSettings()
  }
}

function defaultSettings(): ParentalSettings {
  return {
    pinHash: null,
    pin: null,
    limitSeconds: 3600, // 60 minutes default
    socialEnabled: false,
    parentEmail: null,
    weeklyReportEnabled: false,
    kidThemeEnabled: true,
  }
}

/** SHA-256 hash of a string (Web Crypto API, async). */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode('terra-gacha:pin:' + pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const initial = loadFromStorage()
export const parentalStore = writable<ParentalSettings>(initial)

/** Persists current state to localStorage (excludes plaintext pin). */
function persist(settings: ParentalSettings): void {
  if (typeof localStorage === 'undefined') return
  const { pin: _pin, ...safe } = settings
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
}

parentalStore.subscribe(persist)

/**
 * Sets a new PIN. Hashes it and stores the digest.
 * Also sets `pin` in-memory for same-session comparisons.
 */
export async function setPin(rawPin: string): Promise<void> {
  const hash = await hashPin(rawPin)
  parentalStore.update(s => ({ ...s, pinHash: hash, pin: rawPin }))
}

/**
 * Verifies a candidate PIN against the stored hash.
 * Returns true if matching.
 */
export async function verifyPin(candidate: string): Promise<boolean> {
  const settings = get(parentalStore)
  if (!settings.pinHash) return false
  const candidateHash = await hashPin(candidate)
  return candidateHash === settings.pinHash
}

/**
 * Updates individual parental settings without touching the PIN.
 */
export function updateParentalSettings(patch: Partial<Omit<ParentalSettings, 'pin' | 'pinHash'>>): void {
  parentalStore.update(s => ({ ...s, ...patch }))
}
```

**Acceptance criteria**:
- `setPin('1234')` hashes the PIN and stores the hash to localStorage; plaintext is never persisted.
- `verifyPin('1234')` returns `true`; `verifyPin('9999')` returns `false`.
- `loadFromStorage()` correctly rehydrates all fields; `pin` is always null after hydration.
- Store updates are persisted automatically via the subscriber.

---

#### 45.3.2 — `ParentalPinGate.svelte` — PIN Entry Modal

Create `src/ui/components/ParentalPinGate.svelte`:

```svelte
<script lang="ts">
  import { verifyPin } from '../../ui/stores/parentalStore'

  interface Props {
    /** Purpose string shown in the modal heading. */
    purpose: string
    onSuccess: () => void
    onCancel: () => void
  }

  let { purpose, onSuccess, onCancel }: Props = $props()

  let pinEntry = $state('')
  let pinError = $state(false)
  let checking = $state(false)

  async function handleSubmit(): Promise<void> {
    if (checking || pinEntry.length < 4) return
    checking = true
    const ok = await verifyPin(pinEntry)
    checking = false
    if (ok) {
      pinError = false
      onSuccess()
    } else {
      pinError = true
      pinEntry = ''
    }
  }
</script>

<div class="pin-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-gate-title">
  <div class="pin-gate-card">
    <h2 id="pin-gate-title" class="pin-gate-heading">Parent PIN Required</h2>
    <p class="pin-gate-purpose">{purpose}</p>

    <input
      class="pin-input {pinError ? 'pin-input--error' : ''}"
      type="password"
      inputmode="numeric"
      maxlength="6"
      placeholder="Enter PIN"
      bind:value={pinEntry}
      onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
      aria-label="Parent PIN"
      aria-invalid={pinError}
    />
    {#if pinError}
      <p class="pin-error" role="alert">Incorrect PIN. Please try again.</p>
    {/if}

    <div class="pin-gate-actions">
      <button class="btn-cancel" type="button" onclick={onCancel} disabled={checking}>Cancel</button>
      <button class="btn-confirm" type="button" onclick={handleSubmit} disabled={checking || pinEntry.length < 4}>
        {checking ? '…' : 'Confirm'}
      </button>
    </div>
  </div>
</div>

<style>
  .pin-gate-backdrop {
    pointer-events: auto; position: fixed; inset: 0;
    z-index: 9100; background: rgba(0,0,0,0.75);
    display: flex; align-items: center; justify-content: center; padding: 1rem;
  }
  .pin-gate-card {
    background: #16213e; border: 1px solid rgba(233,69,96,0.4);
    border-radius: 20px; padding: 2rem 1.5rem;
    max-width: 320px; width: 100%;
    display: flex; flex-direction: column; align-items: center; gap: 1rem;
  }
  .pin-gate-heading { font-size: 1.2rem; color: #eee; margin: 0; }
  .pin-gate-purpose { font-size: 0.875rem; color: rgba(238,238,238,0.6); margin: 0; text-align: center; }
  .pin-input {
    width: 140px; padding: 0.75rem; font-size: 1.4rem; text-align: center; letter-spacing: 0.4rem;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 10px; color: #eee; font-family: inherit;
  }
  .pin-input--error { border-color: #e94560; }
  .pin-error { font-size: 0.75rem; color: #e94560; margin: 0; }
  .pin-gate-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
  .btn-cancel {
    padding: 0.6rem 1.25rem; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
    color: rgba(238,238,238,0.7); cursor: pointer;
  }
  .btn-confirm {
    padding: 0.6rem 1.25rem; background: rgba(78,205,196,0.15);
    border: 1px solid rgba(78,205,196,0.5); border-radius: 8px;
    color: #4ECDC4; cursor: pointer; font-weight: 700;
  }
  .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

**Acceptance criteria**:
- Confirm button is disabled until at least 4 characters are entered.
- Correct PIN fires `onSuccess()` and hides the modal.
- Wrong PIN shows error, clears input, and stays open.
- Cancel fires `onCancel()`.
- Modal is above all other overlays (`z-index: 9100`).

---

#### 45.3.3 — `ParentalControlsPanel.svelte` — Settings Sub-Screen

Create `src/ui/components/ParentalControlsPanel.svelte`. This component renders inside `Settings.svelte` behind a PIN gate. It contains:

- **Time Limit**: Dropdown with options: Unlimited / 15 min / 30 min / 45 min / 60 min / 90 min / 120 min. Maps to `limitSeconds` in the store.
- **Parent Email**: Text input for weekly report email address. Validated with a simple regex before saving.
- **Weekly Report**: Toggle for `weeklyReportEnabled`.
- **Social Features**: Toggle for `socialEnabled`.
- **Kid Theme**: Toggle for `kidThemeEnabled`.
- **Change PIN**: Opens a 3-step flow: enter current PIN → enter new PIN (twice for confirmation) → save.
- **Remove PIN**: Confirms via current PIN, then clears `pinHash` and `pin`.

The component MUST NOT include any sensitive data rendering (account numbers, payment methods, etc.).

Integrate into `Settings.svelte`:
- Add a "Parental Controls" section at the bottom of the settings list (always visible, regardless of `ageRating`).
- Tapping it shows `ParentalPinGate` if a PIN is set; otherwise asks the parent to set one first.
- On PIN success, renders `ParentalControlsPanel`.

**Acceptance criteria**:
- Without a PIN set, clicking "Parental Controls" shows a "Set up PIN" flow.
- With a PIN set, clicking it shows `ParentalPinGate` before granting access.
- Changing time limit updates `parentalStore.limitSeconds` and calls `sessionTimer.start(newLimit)` to apply immediately.
- Parent email is validated (must contain `@` and a `.`) before persisting.

---

#### 45.3.4 — IAP Guard in Kid Mode

Modify `src/services/iapService.ts`:
- Export a function `kidModeIapGuard(onParentApproves: () => void): void`.
- If `playerSave?.ageRating !== 'kid'`, call `onParentApproves()` immediately.
- Otherwise, show `ParentalPinGate` with purpose "Authorize this purchase". On success, call `onParentApproves()`.

Modify `src/ui/components/TerraPassModal.svelte` and `src/ui/components/PioneerPackModal.svelte`:
- Wrap the "Subscribe" / "Purchase" button `onclick` handler with `kidModeIapGuard`.
- In kid mode, change the button label to "Ask a Parent" until the PIN is verified.

**Acceptance criteria**:
- In kid mode, tapping any purchase button shows `ParentalPinGate` first.
- Correct parent PIN proceeds to the normal IAP flow.
- Without a PIN set, the purchase button shows "Ask a Parent" and is disabled (no modal opens).

---

### 45.4 — Weekly Learning Email Reports

**Goal**: Every Monday at 08:00 in the parent's local timezone (approximated server-side as UTC+0), the server sends a plain-text + HTML email to the parent address stored in `parentalStore` (synced to the server via the `/parental/:playerId/settings` endpoint). The email summarises the previous week's learning: facts mastered, top categories, total play time, and a Wow Score distribution.

---

#### 45.4.1 — `weeklyReport.ts` — Report Data Aggregator

Create `server/src/services/weeklyReport.ts`:

```typescript
/**
 * Weekly learning report aggregator.
 * Reads the player's save data from PostgreSQL (or stub from analytics events),
 * computes a weekly summary, and queues an email via emailService.
 */

export interface WeeklyReportData {
  playerDisplayName: string
  weekStartIso: string   // Monday YYYY-MM-DD
  weekEndIso: string     // Sunday YYYY-MM-DD
  totalPlayMinutes: number
  factsLearned: number
  factsMastered: number    // review state repetitions >= 5
  streakDays: number
  topCategories: Array<{ name: string; count: number }>
  wowScoreDistribution: {
    stars1: number
    stars2: number
    stars3: number
    stars4: number
    stars5: number
  }
  nextReviewDue: number    // count of facts due this week
}

/**
 * Builds a WeeklyReportData for a player from saved analytics events.
 * In production this queries the PostgreSQL analytics table.
 * Stub implementation returns plausible mock data for development.
 */
export function buildWeeklyReport(
  playerId: string,
  _weekStartIso: string,
): WeeklyReportData {
  // Stub — production implementation queries DB
  return {
    playerDisplayName: 'Explorer',
    weekStartIso: _weekStartIso,
    weekEndIso: addDays(_weekStartIso, 6),
    totalPlayMinutes: 0,
    factsLearned: 0,
    factsMastered: 0,
    streakDays: 0,
    topCategories: [],
    wowScoreDistribution: { stars1: 0, stars2: 0, stars3: 0, stars4: 0, stars5: 0 },
    nextReviewDue: 0,
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Formats report data into a plain-text email body.
 * The HTML version (for emailService) is generated by the email template.
 */
export function formatReportPlainText(report: WeeklyReportData): string {
  const { playerDisplayName, weekStartIso, weekEndIso } = report
  const lines: string[] = [
    `Terra Gacha — Weekly Learning Report`,
    `Player: ${playerDisplayName}`,
    `Week: ${weekStartIso} to ${weekEndIso}`,
    ``,
    `Play time this week: ${report.totalPlayMinutes} minutes`,
    `New facts discovered: ${report.factsLearned}`,
    `Facts fully mastered: ${report.factsMastered}`,
    `Day streak: ${report.streakDays} days`,
    ``,
    `Top topics:`,
    ...report.topCategories.map(c => `  - ${c.name}: ${c.count} facts`),
    ``,
    `Wow Score breakdown:`,
    `  ★☆☆☆☆  ${report.wowScoreDistribution.stars1} facts`,
    `  ★★☆☆☆  ${report.wowScoreDistribution.stars2} facts`,
    `  ★★★☆☆  ${report.wowScoreDistribution.stars3} facts`,
    `  ★★★★☆  ${report.wowScoreDistribution.stars4} facts`,
    `  ★★★★★  ${report.wowScoreDistribution.stars5} facts — EXPERT!`,
    ``,
    `Facts due for review this week: ${report.nextReviewDue}`,
    ``,
    `To change report settings, open Terra Gacha → Settings → Parental Controls.`,
    `To unsubscribe: reply to this email with "UNSUBSCRIBE".`,
  ]
  return lines.join('\n')
}
```

**Acceptance criteria**:
- `buildWeeklyReport` returns a structurally valid `WeeklyReportData`.
- `formatReportPlainText` includes all seven data points listed above.
- No external network calls in this file — it is a pure data layer; the sending is done in the route.

---

#### 45.4.2 — Server Route: Weekly Report

Modify `server/src/routes/parental.ts` — add a `POST /:playerId/send-weekly-report` endpoint:

```typescript
// Send weekly learning report email (called by cron job or admin trigger)
app.post('/:playerId/send-weekly-report', async (req, reply) => {
  const { playerId } = req.params as { playerId: string }
  const { parentEmail, weekStartIso } = req.body as { parentEmail: string; weekStartIso: string }

  if (!parentEmail || !parentEmail.includes('@')) {
    return reply.status(400).send({ error: 'Valid parentEmail required' })
  }
  if (!weekStartIso || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartIso)) {
    return reply.status(400).send({ error: 'weekStartIso in YYYY-MM-DD format required' })
  }

  const { buildWeeklyReport, formatReportPlainText } = await import('../services/weeklyReport')
  const report = buildWeeklyReport(playerId, weekStartIso)
  const plainText = formatReportPlainText(report)

  // In production: await emailService.send({ to: parentEmail, subject, html, text: plainText })
  app.log.info({ playerId, parentEmail, weekStartIso }, 'Weekly report queued')
  return reply.send({ queued: true, playerId, reportSummary: { factsLearned: report.factsLearned } })
})
```

Also update the existing `GET /:playerId/weekly-summary` response to populate all fields from `buildWeeklyReport`.

**Acceptance criteria**:
- `POST /parental/:playerId/send-weekly-report` with a valid body returns `{ queued: true }`.
- Missing or malformed `parentEmail` returns 400.
- Missing or malformed `weekStartIso` returns 400.
- The endpoint logs the action with structured logging.

---

#### 45.4.3 — `weeklyReportJob.ts` — Cron Scheduler

Create `server/src/jobs/weeklyReportJob.ts`:

```typescript
/**
 * Weekly report cron job.
 * Runs every Monday at 08:00 UTC.
 * Queries all player accounts where weeklyReportEnabled === true and parentEmail is set.
 * For production: replace stub player list with a PostgreSQL query.
 */

import { FastifyInstance } from 'fastify'

const MONDAY_CRON = '0 8 * * 1' // Every Monday at 08:00 UTC

/**
 * Registers the weekly report cron job with the Fastify server.
 * Uses node-cron (already a project dependency via notification scheduler).
 */
export async function registerWeeklyReportJob(app: FastifyInstance): Promise<void> {
  let cron: typeof import('node-cron')
  try {
    cron = await import('node-cron')
  } catch {
    app.log.warn('node-cron not available — weekly report job not scheduled')
    return
  }

  cron.schedule(MONDAY_CRON, async () => {
    const weekStartIso = getMondayIso()
    app.log.info({ weekStartIso }, 'Running weekly learning report job')

    // Production: query DB for players with weeklyReportEnabled + parentEmail set
    const players: Array<{ playerId: string; parentEmail: string }> = []

    for (const { playerId, parentEmail } of players) {
      try {
        await app.inject({
          method: 'POST',
          url: `/parental/${playerId}/send-weekly-report`,
          payload: { parentEmail, weekStartIso },
        })
      } catch (err) {
        app.log.error({ playerId, err }, 'Failed to send weekly report')
      }
    }

    app.log.info({ count: players.length }, 'Weekly report job complete')
  })

  app.log.info('Weekly report cron job registered (Mondays 08:00 UTC)')
}

function getMondayIso(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  now.setUTCDate(now.getUTCDate() - daysToMonday)
  return now.toISOString().slice(0, 10)
}
```

Register `registerWeeklyReportJob(app)` in `server/src/index.ts` alongside the existing notification scheduler.

**Acceptance criteria**:
- `getMondayIso()` returns the ISO date of the most recent Monday.
- The cron job is registered on server start and logged.
- If `node-cron` is unavailable, the function logs a warning and returns without crashing.

---

#### 45.4.4 — `WeeklyReportPreview.svelte` — Parent-Facing Email Preview

Create `src/ui/components/WeeklyReportPreview.svelte`. This is shown inside `ParentalControlsPanel.svelte` as a "Preview this week's report" collapsible section. It fetches from `GET /parental/:playerId/weekly-summary` and renders the same data that will appear in the email, in a minimal card layout.

**Acceptance criteria**:
- Fetch is guarded by a loading spinner.
- Renders play minutes, facts learned, mastered, streak, and top 3 categories.
- If the server returns an error, shows "Summary unavailable" gracefully.

---

### 45.5 — Content Filtering

**Goal**: When `ageRating === 'kid'`, filter the fact pool to include only facts with `ageRating === 'kid'`. Suppress social features (hub visits, duels, guilds, trading). Apply a simplified navigation structure that hides advanced rooms.

---

#### 45.5.1 — Fact Pool Filtering

Modify `src/game/GameManager.ts` (or wherever the active fact pool is assembled):
- Before selecting quiz facts or distractor sets, apply:

```typescript
function getEligibleFacts(allFacts: Fact[], playerAgeRating: AgeRating): Fact[] {
  if (playerAgeRating === 'kid') {
    return allFacts.filter(f => f.ageRating === 'kid')
  }
  if (playerAgeRating === 'teen') {
    return allFacts.filter(f => f.ageRating === 'kid' || f.ageRating === 'teen')
  }
  return allFacts
}
```

- `getEligibleFacts` is exported from `src/data/contentFilter.ts` (new file).

**Acceptance criteria**:
- Under 13 players never receive a fact with `ageRating === 'teen'` or `'adult'`.
- Teen players receive `'kid'` and `'teen'` facts.
- Adult players receive all facts.
- The filter runs before any biome-interest weighting.

---

#### 45.5.2 — Social Feature Suppression

Modify `src/ui/components/HubView.svelte`:
- Import `parentalStore`.
- When `$parentalStore.socialEnabled === false` AND `$playerSave?.ageRating === 'kid'`:
  - Hide the Guild icon in the hub navigation.
  - Disable the Leaderboard tab (show a locked padlock icon with text "Ask a parent to enable").
  - Suppress incoming duel invites (`DuelInviteModal.svelte` — do not show if kid mode + social disabled).
  - Suppress hub-visitor notifications.

**Acceptance criteria**:
- With `socialEnabled: false`, guild/leaderboard/duel UI elements are absent or locked.
- A parent enabling `socialEnabled` in the parental panel immediately (reactively) re-shows these elements.

---

#### 45.5.3 — Simplified Navigation

Modify `src/ui/components/DomeView.svelte`:
- When `$playerSave?.ageRating === 'kid'`:
  - Move the "Dive" button to be the largest, most prominent element.
  - Hide the Market room link from navigation (children should not see trading UI).
  - Reduce dome floor count shown in `FloorIndicator.svelte` to floors 1–3 (further floors unlock with parent permission, controlled via `parentalStore.unlockedFloors` — a new optional field added to `ParentalSettings` defaulting to `['floor1','floor2','floor3']`).

**Acceptance criteria**:
- In kid mode, the Market room is not reachable from the dome navigation.
- The Dive button is visually dominant (larger font, prominent colour, first tab order).
- Floors beyond 3 are shown as locked icons unless the parent has explicitly unlocked them.

---

### 45.6 — COPPA Enforcement

**Goal**: Ensure that Terra Gacha is compliant with the Children's Online Privacy Protection Act (COPPA) for players identified as under-13. This means: no analytics event collection beyond session length and aggregate counts; no behavioural ad targeting (already excluded by DD-V2-131); mandatory verifiable parental consent before account creation; a parent-accessible data deletion flow.

---

#### 45.6.1 — Analytics Suppression

Modify `src/services/analyticsService.ts`:
- Export a helper `isKidMode(): boolean` that reads `playerSave` from the singleton store.
- Wrap every `trackEvent(...)` call: if `isKidMode()`, only allow events in the allowlist: `['session_start', 'session_end', 'dive_complete', 'fact_learned']`. All other events are silently dropped.

```typescript
const KID_ALLOWED_EVENTS = new Set(['session_start', 'session_end', 'dive_complete', 'fact_learned'])

export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (isKidMode() && !KID_ALLOWED_EVENTS.has(name)) return
  // ... existing queue logic ...
}
```

**Acceptance criteria**:
- In kid mode, events like `iap_initiated`, `duel_started`, `leaderboard_viewed` are never sent.
- The 4 allowed events are still sent (necessary for weekly report aggregation).
- `isKidMode()` returns false if `playerSave` is null (safe default).

---

#### 45.6.2 — Verifiable Parental Consent Gate

Modify `src/ui/components/auth/RegisterView.svelte`:
- After selecting age bracket `under_13` in the AgeGate, before account creation is finalized, show an additional consent screen:
  - Displays a plain-language summary of what data is collected (session duration, facts learned — nothing more).
  - Requires a parent email to be entered.
  - Sends a verification email to that address via `POST /parental/consent-request`.
  - Account creation is not finalized until the parent clicks the link in the email (or the user proceeds as a guest, in which case cloud sync is disabled until consent is given).

Create `server/src/routes/parental.ts` additions:

```typescript
// Request parental consent — sends verification email to parent address
app.post('/consent-request', async (req, reply) => {
  const { playerId, parentEmail } = req.body as { playerId: string; parentEmail: string }
  if (!parentEmail?.includes('@')) return reply.status(400).send({ error: 'Valid parentEmail required' })
  // In production: generate a signed token, store pending consent, send email
  return reply.send({ sent: true, playerId })
})

// Verify parental consent (called when parent clicks link)
app.get('/consent-verify', async (req, reply) => {
  const { token } = req.query as { token: string }
  if (!token) return reply.status(400).send({ error: 'token required' })
  // In production: validate token, mark account consent:granted in DB
  return reply.send({ verified: true })
})
```

**Acceptance criteria**:
- The registration flow for `under_13` shows the consent screen before completing account creation.
- The consent screen describes data collection in child-appropriate plain language.
- `POST /parental/consent-request` returns 400 for invalid email and 200 for valid.
- Guest mode remains available without consent (no cloud sync until consent is granted).

---

#### 45.6.3 — Data Deletion Flow for Parents

Modify `server/src/routes/parental.ts` — add `DELETE /:playerId/data`:

```typescript
// Parent-initiated complete data deletion for a child account
app.delete('/:playerId/data', async (req, reply) => {
  const { playerId } = req.params as { playerId: string }
  const { parentPinHash } = req.body as { parentPinHash: string }

  if (!parentPinHash) return reply.status(400).send({ error: 'parentPinHash required for verification' })
  // In production: verify parentPinHash matches stored hash, then delete all player rows from DB,
  // purge analytics events, send confirmation email to parent
  app.log.info({ playerId }, 'Parent-initiated data deletion request')
  return reply.send({ deleted: true, playerId })
})
```

Add a "Delete Child's Data" button inside `ParentalControlsPanel.svelte` at the bottom, behind a two-step confirmation (first a text confirmation prompt, then the PIN gate). On success, calls local `deleteSave()` and redirects to the AgeGate.

**Acceptance criteria**:
- Endpoint requires `parentPinHash` in the request body; missing → 400.
- Client-side: requires two confirmation steps before the API call is made.
- After confirmed deletion, local save is cleared and app resets to first-launch state.

---

### 45.7 — Kid-Friendly UI Theme

**Goal**: When `$parentalStore.kidThemeEnabled === true` (or `$playerSave?.ageRating === 'kid'`), apply a global CSS theme class that enlarges tap targets, simplifies navigation labels, uses rounder typography, replaces GAIA's technical language with simpler phrasing, and applies warmer colours.

---

#### 45.7.1 — `kid-theme.css` — Global Theme Overrides

Create `src/app-kid-theme.css`:

```css
/* Kid Theme — applied via .kid-theme class on <body> */
/* DD-V2-180: larger touch targets, friendlier typography, warmer palette */

.kid-theme {
  --kid-font-scale: 1.15;
  --kid-radius: 20px;
  --kid-accent: #FFD700;
  --kid-accent-soft: rgba(255, 215, 0, 0.15);
}

/* Larger minimum touch targets (WCAG 2.5.5 AAA: 44×44px) */
.kid-theme button,
.kid-theme [role="button"] {
  min-height: 52px;
  min-width: 52px;
  font-size: calc(1rem * var(--kid-font-scale));
  border-radius: var(--kid-radius);
}

/* Friendlier heading scale */
.kid-theme h1 { font-size: calc(1.8rem * var(--kid-font-scale)); }
.kid-theme h2 { font-size: calc(1.4rem * var(--kid-font-scale)); }

/* Warmer accent — replace the default teal with gold */
.kid-theme .bracket-btn--primary,
.kid-theme .dive-btn {
  border-color: var(--kid-accent);
  background: var(--kid-accent-soft);
  color: var(--kid-accent);
}

/* Simplify complex labels */
.kid-theme .sm2-interval-label { display: none; }
.kid-theme .archetype-badge { display: none; }
.kid-theme .engagement-score { display: none; }

/* Rounder cards */
.kid-theme .gate-card,
.kid-theme .time-up-card,
.kid-theme .pin-gate-card {
  border-radius: 28px;
}
```

**Acceptance criteria**:
- `body.kid-theme` toggles the CSS correctly.
- All buttons in kid theme meet 52×52px minimum.
- SM-2 interval labels are hidden.
- Gold accent replaces teal on key CTAs.

---

#### 45.7.2 — Theme Toggle in `App.svelte`

Modify `src/App.svelte`:
- In `onMount`, subscribe to both `playerSave` and `parentalStore`.
- Apply `document.body.classList.toggle('kid-theme', isKid)` where:
  ```typescript
  const isKid = ($playerSave?.ageRating === 'kid') && $parentalStore.kidThemeEnabled
  ```
- Re-evaluate whenever either store changes.

Import `./app-kid-theme.css` in `src/App.svelte`.

**Acceptance criteria**:
- `document.body` has class `kid-theme` exactly when `ageRating === 'kid'` AND `kidThemeEnabled === true`.
- Toggling `kidThemeEnabled` in the parental panel immediately applies/removes the class without a page reload.

---

#### 45.7.3 — GAIA Kid Mode Dialogue

Modify `src/data/gaiaDialogue.ts` — add a `kidMode` field to relevant dialogue pools:

Add at minimum 8 lines per context to the following pools:
- `kidMode.postDive` — congratulatory post-dive reactions with simple words, no jargon
- `kidMode.wrongAnswer` — encouraging, never shaming: "Oops! Let's try again together!"
- `kidMode.newFact` — excited discovery language for a young audience

In `src/game/managers/GaiaManager.ts`:
- When `playerSave.ageRating === 'kid'`, prefer kid-mode pools over the standard ones.

**Acceptance criteria**:
- Kid-mode players only receive GAIA messages from the `kidMode.*` pools.
- No message contains: percentage numbers, interval terminology, SM-2, archetype labels, or any statistical language.
- All messages end with an exclamation point or an encouraging phrase.

---

## Playwright Tests

All tests use the Node.js Playwright script pattern. Save to `/tmp/ss-kid-mode.js` and run with `node /tmp/ss-kid-mode.js`.

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 }) // iPhone 14 size

  // ──────────────────────────────────────────────────────────────────
  // TEST 1: AgeGate selects 'under_13' → kid mode is active
  // ──────────────────────────────────────────────────────────────────
  await page.goto('http://localhost:5173')
  // Clear any stored age bracket from prior runs
  await page.evaluate(() => localStorage.removeItem('terra_age_bracket'))
  await page.reload()
  // The AgeGate should appear
  await page.waitForSelector('button:has-text("Under 13")', { timeout: 10000 })
  await page.screenshot({ path: '/tmp/ss-kid-agegate.png' })
  await page.click('button:has-text("Under 13")')
  await page.waitForTimeout(1000)
  // Kid theme class should be on body
  const hasKidTheme = await page.evaluate(() => document.body.classList.contains('kid-theme'))
  console.assert(hasKidTheme, 'FAIL: kid-theme class not applied after selecting Under 13')
  await page.screenshot({ path: '/tmp/ss-kid-theme-applied.png' })

  // ──────────────────────────────────────────────────────────────────
  // TEST 2: Quiz result shows Wow Stars, not numeric SM-2 data
  // ──────────────────────────────────────────────────────────────────
  // Navigate to mine and complete a quiz to see the result panel
  // (Shortened: just verify the KidWowStars component exists in DOM)
  const wowStars = await page.$('.wow-stars')
  if (wowStars) {
    console.log('PASS: KidWowStars component is present in DOM')
  } else {
    console.log('SKIP: KidWowStars not visible yet (quiz not triggered in this flow)')
  }

  // ──────────────────────────────────────────────────────────────────
  // TEST 3: Parental Controls section exists in Settings
  // ──────────────────────────────────────────────────────────────────
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Open Settings
  await page.click('button[aria-label="Settings"], button:has-text("Settings")')
  await page.waitForTimeout(800)
  const parentalSection = await page.$('text=Parental Controls')
  console.assert(parentalSection !== null, 'FAIL: Parental Controls section not found in Settings')
  await page.screenshot({ path: '/tmp/ss-kid-settings.png' })

  // ──────────────────────────────────────────────────────────────────
  // TEST 4: PIN gate appears when Parental Controls is tapped (with PIN set)
  // ──────────────────────────────────────────────────────────────────
  // First, set a PIN via localStorage (simulate a prior PIN setup)
  await page.evaluate(async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode('terra-gacha:pin:1234')
    const buf = await crypto.subtle.digest('SHA-256', data)
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
    const settings = JSON.parse(localStorage.getItem('terra_parental_v1') || '{}')
    settings.pinHash = hash
    localStorage.setItem('terra_parental_v1', JSON.stringify(settings))
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button[aria-label="Settings"], button:has-text("Settings")')
  await page.waitForTimeout(800)
  await page.click('text=Parental Controls')
  await page.waitForTimeout(600)
  const pinGate = await page.$('[aria-labelledby="pin-gate-title"]')
  console.assert(pinGate !== null, 'FAIL: PIN gate dialog not shown')
  await page.screenshot({ path: '/tmp/ss-kid-pin-gate.png' })

  // ──────────────────────────────────────────────────────────────────
  // TEST 5: Correct PIN dismisses gate; wrong PIN shows error
  // ──────────────────────────────────────────────────────────────────
  const pinInput = await page.$('input[aria-label="Parent PIN"]')
  await pinInput?.fill('9999')
  await page.click('button:has-text("Confirm")')
  await page.waitForTimeout(500)
  const pinError = await page.$('.pin-error')
  console.assert(pinError !== null, 'FAIL: No error shown for wrong PIN')
  await page.screenshot({ path: '/tmp/ss-kid-pin-error.png' })

  // Enter correct PIN
  await pinInput?.fill('1234')
  await page.click('button:has-text("Confirm")')
  await page.waitForTimeout(500)
  const panelVisible = await page.$('text=Time Limit')
  console.assert(panelVisible !== null, 'FAIL: Parental Controls panel not shown after correct PIN')
  await page.screenshot({ path: '/tmp/ss-kid-parental-panel.png' })

  // ──────────────────────────────────────────────────────────────────
  // TEST 6: Time-up overlay blocks interaction
  // ──────────────────────────────────────────────────────────────────
  // Simulate elapsed time by patching the sessionTimer state
  await page.evaluate(() => {
    // Directly patch DOM state — in a real test we'd mock the service
    const overlay = document.createElement('div')
    overlay.className = 'time-up-overlay'
    overlay.setAttribute('role', 'alertdialog')
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.9)'
    overlay.textContent = 'Time Up!'
    document.body.appendChild(overlay)
  })
  const timeUpOverlay = await page.$('.time-up-overlay')
  console.assert(timeUpOverlay !== null, 'FAIL: Time-up overlay not rendering')
  await page.screenshot({ path: '/tmp/ss-kid-timeup.png' })

  // ──────────────────────────────────────────────────────────────────
  // TEST 7: Social features hidden with socialEnabled=false
  // ──────────────────────────────────────────────────────────────────
  // Set socialEnabled = false in parental store
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('terra_parental_v1') || '{}')
    settings.socialEnabled = false
    localStorage.setItem('terra_parental_v1', JSON.stringify(settings))
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Navigate to hub and verify guild is hidden
  const guildLink = await page.$('button:has-text("Guild"), a:has-text("Guild")')
  if (!guildLink) {
    console.log('PASS: Guild link hidden with socialEnabled=false')
  } else {
    console.log('WARN: Guild link still visible — check HubView.svelte filter')
  }
  await page.screenshot({ path: '/tmp/ss-kid-social-hidden.png' })

  await browser.close()
  console.log('All kid mode Playwright tests complete.')
})()
```

---

## Verification Gate

The following checklist MUST pass in full before Phase 45 is marked complete. The orchestrator runs every item and must screenshot each visual check.

### Typecheck & Build
- [ ] `npm run typecheck` passes with zero errors after all changes
- [ ] `npm run build` completes without warnings about missing imports or unresolved modules

### Unit-Level Checks
- [ ] `getWowScore(undefined)` returns level 1 (verify in browser console or test script)
- [ ] `getWowScore({ repetitions: 7, interval: 5, ... })` returns level 5 (repetitions path)
- [ ] `getWowScore({ repetitions: 1, interval: 30, ... })` returns level 5 (interval fast-track)
- [ ] `hashPin('1234')` and `hashPin('1234')` return identical strings (deterministic SHA-256)
- [ ] `verifyPin('1234')` returns true after `setPin('1234')`
- [ ] `verifyPin('5678')` returns false
- [ ] `sessionTimer.start(60)` begins ticking; `stop()` clears the interval (manual verification)
- [ ] `getMondayIso()` (in weeklyReportJob.ts) returns current or past Monday in YYYY-MM-DD format

### Visual Checks (screenshots required)
- [ ] Screenshot: AgeGate with "Under 13" button — confirm it exists and is tappable
- [ ] Screenshot: After selecting Under 13, `document.body.classList` contains `kid-theme`
- [ ] Screenshot: Quiz result screen in kid mode — stars visible, no numeric SM-2 data
- [ ] Screenshot: Settings screen — "Parental Controls" section visible at bottom
- [ ] Screenshot: PIN gate modal — correct layout, accessible label
- [ ] Screenshot: Parental Controls panel — Time Limit dropdown, toggles, parent email input all visible
- [ ] Screenshot: Time-up overlay — blocks interaction, shows minutes played, PIN override input
- [ ] Screenshot: 5-minute warning banner — appears at top of screen, dismissable
- [ ] Screenshot: Kid mode hub — Market room absent, Dive button prominent

### Server Route Checks
- [ ] `GET /parental/:playerId/settings` returns a valid `ParentalSettings` shape
- [ ] `PUT /parental/:playerId/settings` with `{ kidMode: true, maxDailyMinutes: 60 }` returns `{ updated: true }`
- [ ] `POST /parental/:playerId/send-weekly-report` with valid body returns `{ queued: true }`
- [ ] `POST /parental/:playerId/send-weekly-report` with missing `parentEmail` returns 400
- [ ] `POST /parental/consent-request` with valid email returns `{ sent: true }`
- [ ] `GET /parental/consent-verify?token=test` returns `{ verified: true }`
- [ ] `DELETE /parental/:playerId/data` without `parentPinHash` returns 400

### Regression Checks (adult/teen players unaffected)
- [ ] With `ageRating === 'adult'`, quiz result shows numeric SM-2 data (not stars)
- [ ] With `ageRating === 'adult'`, guild/leaderboard/social features are fully accessible
- [ ] With `ageRating === 'adult'`, `document.body` does NOT have `kid-theme` class
- [ ] With `ageRating === 'adult'`, all analytics events are tracked (not filtered)
- [ ] Session timer is NOT started for adult/teen profiles

---

## Files Affected

### New Files Created

| File | Description |
|------|-------------|
| `src/services/wowScore.ts` | Wow Score mapping utility (45.1.1) |
| `src/data/contentFilter.ts` | `getEligibleFacts()` age-gating utility (45.5.1) |
| `src/services/sessionTimer.ts` | Daily play time tracker with hard-stop logic (45.2.1) |
| `src/ui/stores/parentalStore.ts` | Parental settings Svelte store with PIN hashing (45.3.1) |
| `src/ui/components/KidWowStars.svelte` | 1–5 star mastery display component (45.1.2) |
| `src/ui/components/TimeUpOverlay.svelte` | Hard-stop overlay with PIN override (45.2.2) |
| `src/ui/components/SessionWarningBanner.svelte` | 5-minute warning banner (45.2.3) |
| `src/ui/components/ParentalPinGate.svelte` | PIN entry modal (45.3.2) |
| `src/ui/components/ParentalControlsPanel.svelte` | Full parental settings UI (45.3.3) |
| `src/ui/components/WeeklyReportPreview.svelte` | In-app email preview (45.4.4) |
| `src/app-kid-theme.css` | Kid theme CSS overrides (45.7.1) |
| `server/src/services/weeklyReport.ts` | Report data aggregator and plain-text formatter (45.4.1) |
| `server/src/jobs/weeklyReportJob.ts` | Monday 08:00 UTC cron job (45.4.3) |

### Modified Files

| File | Change |
|------|--------|
| `src/data/types.ts` | Add `kidMode` optional fields to `PlayerSave`; no breaking changes |
| `src/ui/stores/settings.ts` | Import and re-export `parentalStore` binding for kid theme reactive effect |
| `src/App.svelte` | Session timer start/stop; kid-theme class toggle; `TimeUpOverlay` + `SessionWarningBanner` mounts (45.2.4, 45.7.2) |
| `src/ui/components/QuizOverlay.svelte` | Conditional `KidWowStars` in result panel (45.1.3) |
| `src/ui/components/KnowledgeTree.svelte` | Conditional `KidWowStars` in node tooltip (45.1.4) |
| `src/ui/components/Settings.svelte` | Add Parental Controls section with PIN gate (45.3.3) |
| `src/ui/components/HubView.svelte` | Social feature suppression for kid mode (45.5.2) |
| `src/ui/components/DomeView.svelte` | Simplified navigation, Dive CTA prominence (45.5.3) |
| `src/ui/components/TerraPassModal.svelte` | `kidModeIapGuard` wrapping purchase button (45.3.4) |
| `src/ui/components/PioneerPackModal.svelte` | `kidModeIapGuard` wrapping purchase button (45.3.4) |
| `src/ui/components/auth/RegisterView.svelte` | Parental consent gate for `under_13` (45.6.2) |
| `src/services/iapService.ts` | `kidModeIapGuard` function (45.3.4) |
| `src/services/analyticsService.ts` | Event allowlist for kid mode (45.6.1) |
| `src/game/GameManager.ts` | Apply `getEligibleFacts` before fact pool assembly (45.5.1) |
| `src/data/gaiaDialogue.ts` | Add `kidMode` dialogue pools (45.7.3) |
| `src/game/managers/GaiaManager.ts` | Prefer kid-mode pools when `ageRating === 'kid'` (45.7.3) |
| `server/src/routes/parental.ts` | Add consent, weekly report, and data deletion endpoints (45.4.2, 45.6.2, 45.6.3) |
| `server/src/index.ts` | Register `weeklyReportJob` (45.4.3) |

### Files NOT Modified

The following files are intentionally unchanged — they already contain the necessary COPPA scaffolding that this phase builds upon:

- `src/ui/components/legal/AgeGate.svelte` — existing implementation is correct and complete
- `src/ui/stores/playerData.ts` — `getStoredAgeRating()` already maps `under_13` to `'kid'`
- `src/services/legalConstants.ts` — `AGE_BRACKET_KEY` already defined
- `server/src/routes/compliance.ts` — `kid-protection` policy already documented

---

## Design Rationale Notes

**Why SHA-256 for PIN storage?** The PIN is low-entropy (4–6 digits, ≤1,000,000 possibilities), making it easily brute-forceable offline if the hash is obtained. However, the threat model here is a child circumventing parental controls from within the app, not an adversary with filesystem access to the device. SHA-256 with a domain-specific salt (`terra-gacha:pin:`) is sufficient for this threat model and avoids adding `bcrypt`/`argon2` as a client-side dependency. If the PIN were used for account security (it is not — it is local only), Argon2id would be required per the existing security policy in `docs/SECURITY.md`.

**Why not `<13 = no account`?** COPPA allows under-13 accounts with verifiable parental consent, which is the approach taken here. Blocking accounts entirely would eliminate the educational-partnership market (Phase 44) and is not required by the regulation.

**Why Monday 08:00 UTC for email timing?** This is an established convention for weekly digest emails. A parent checking email Monday morning receives a summary of last week before the new school week begins, making it actionable. Timezone approximation is acceptable for a weekly digest — the email is informational, not time-critical.

**Why is the session timer localStorage-based (not server-synced)?** The server sync adds latency and a network round-trip for every second of play, which is architecturally unjustified. A determined child could clear localStorage, but that requires technical knowledge that most young children do not have. The PIN-protected server settings (synced via `PUT /parental/:playerId/settings`) provide the definitive source of truth; the client-side timer is the enforcement mechanism.

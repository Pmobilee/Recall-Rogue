<!-- src/ui/components/NarrativeOverlay.svelte
  Full-screen atmospheric narrative overlay for room transitions and NPC dialogue.

  Auto-reveal: lines appear automatically without requiring a click.
  After all lines are visible, narration stays until player clicks to continue
  OR the auto-dismiss timer expires (default 10s, configurable via AUTO_DISMISS_MS).

  MEDIUM-11 (2026-04-10): Added auto-dismiss timer (10s after last line settles) and
  improved hint contrast/size so it is unmissable. Persistent skip preference: if user
  manually dismisses 3+ overlays in a row, a toast offers "Always skip narrative overlays?"
  and sets setting_skipNarrativeOverlays in localStorage. When the skip preference is set,
  the overlay jumps immediately to dissolve on mount.

  State machine: REVEALING -> DISSOLVING -> DONE
  - REVEALING: lines appear one at a time via auto-reveal timers (or on click).
    Clicking during a line CSS animation (< 0.8s) skips to fully visible.
    Clicking when fully visible and more lines remain: cancels auto-reveal, settles all.
    Clicking when on the last settled line begins DISSOLVING.
  - DISSOLVING: ash animation plays out, clicks ignored, onDismiss fires after
    all lines finish (0.8s + 0.15s * (numLines - 1) + 0.3s grace).
  - DONE: onDismiss called.

  Design spec: docs/mechanics/narrative.md Display System
  Scaling rules: docs/ui/layout.md - calc(Npx * var(--layout-scale|--text-scale, 1))
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { NarrativeLine } from '../../services/narrativeTypes'

  // Props
  interface Props {
    lines: NarrativeLine[];
    /** Kept for API compatibility -- ignored. Always behaves as auto-reveal. */
    mode?: 'auto-fade' | 'click-through';
    onDismiss: () => void;
  }
  let { lines, onDismiss }: Props = $props()

  // Skip preference (MEDIUM-11)
  const SKIP_PREF_KEY = 'setting_skipNarrativeOverlays'
  const CONSECUTIVE_DISMISS_KEY = 'setting_narrativeConsecutiveDismisses'
  const CONSECUTIVE_THRESHOLD = 3   // suggest always-skip after 3 manual dismissals

  function readSkipPref(): boolean {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(SKIP_PREF_KEY) === 'true'
  }

  function readConsecutiveDismisses(): number {
    if (typeof window === 'undefined') return 0
    return parseInt(window.localStorage.getItem(CONSECUTIVE_DISMISS_KEY) ?? '0', 10) || 0
  }

  function writeConsecutiveDismisses(n: number): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CONSECUTIVE_DISMISS_KEY, String(n))
  }

  function setSkipPref(enabled: boolean): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SKIP_PREF_KEY, String(enabled))
    writeConsecutiveDismisses(0)
  }

  /** Whether always-skip preference is active. */
  let skipPrefActive = $state(readSkipPref())

  /** Whether the "always skip?" toast is showing. */
  let showAlwaysSkipToast = $state(false)
  let alwaysSkipToastTimer: ReturnType<typeof setTimeout> | null = null

  // Auto-dismiss timer (MEDIUM-11)
  /** ms after last line settles before auto-dismiss fires. Default 10 000ms. */
  const AUTO_DISMISS_MS = 10_000
  let autoDismissTimer: ReturnType<typeof setTimeout> | null = null
  /** Countdown value displayed in the hint (seconds remaining). */
  let autoDismissCountdown = $state(Math.ceil(AUTO_DISMISS_MS / 1000))
  let countdownIntervalId: ReturnType<typeof setInterval> | null = null

  // State machine
  type Phase = 'REVEALING' | 'DISSOLVING' | 'DONE'
  let phase = $state<Phase>('REVEALING')

  /** Index of the last visible line (0-based). */
  let visibleUpTo = $state(0)

  /**
   * Timestamp (ms from performance.now()) when the current line started
   * its reveal animation. Used to detect mid-animation clicks.
   */
  let lineRevealStart = $state(0)

  /**
   * Whether the current line's reveal animation has finished
   * (>= LINE_REVEAL_DURATION ms have passed).
   */
  let currentLineSettled = $state(false)

  /** Whether the hint prompt is visible. */
  let showHint = $state(false)

  /** Inline style per line index for ash dissolve stagger. */
  let dissolveStyles = $state<string[]>([])

  let hintTimer: ReturnType<typeof setTimeout> | null = null
  let dissolveTimer: ReturnType<typeof setTimeout> | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  /** Timer for auto-reveal of successive lines. */
  let autoRevealTimer: ReturnType<typeof setTimeout> | null = null

  const LINE_REVEAL_DURATION = 800  // ms -- matches CSS animation duration
  const HINT_DELAY = 800            // ms after line settles before hint appears
  const DISSOLVE_STAGGER = 150      // ms between each line's ash animation
  const DISSOLVE_DURATION = 800     // ms per line dissolve
  const DISSOLVE_GRACE = 300        // ms after last line finishes before onDismiss

  /** Delay before the very first line auto-reveals (ms). */
  const AUTO_REVEAL_START_DELAY = 800
  /** Delay between successive auto-revealed lines (ms). */
  const AUTO_REVEAL_DELAY = 400

  // Derived
  /** Lines to render -- only up to visibleUpTo. */
  let visibleLines = $derived(lines.slice(0, visibleUpTo + 1))

  /** Whether we are on the last line. */
  let isLastLine = $derived(visibleUpTo >= lines.length - 1)

  /** Hint label changes based on whether more lines exist. */
  let hintLabel = $derived(
    isLastLine
      ? `click to dismiss  (${autoDismissCountdown}s)`
      : 'click to continue'
  )

  // Helpers

  function clearTimers(): void {
    if (hintTimer)            { clearTimeout(hintTimer);             hintTimer = null }
    if (dissolveTimer)        { clearTimeout(dissolveTimer);         dissolveTimer = null }
    if (settleTimer)          { clearTimeout(settleTimer);           settleTimer = null }
    if (autoRevealTimer)      { clearTimeout(autoRevealTimer);       autoRevealTimer = null }
    if (autoDismissTimer)     { clearTimeout(autoDismissTimer);      autoDismissTimer = null }
    if (countdownIntervalId)  { clearInterval(countdownIntervalId);  countdownIntervalId = null }
    if (alwaysSkipToastTimer) { clearTimeout(alwaysSkipToastTimer);  alwaysSkipToastTimer = null }
  }

  /** Start the auto-dismiss countdown after the last line settles. */
  function startAutoDismissCountdown(): void {
    autoDismissCountdown = Math.ceil(AUTO_DISMISS_MS / 1000)

    // Tick every second to update the displayed countdown
    countdownIntervalId = setInterval(() => {
      autoDismissCountdown = Math.max(0, autoDismissCountdown - 1)
    }, 1000)

    autoDismissTimer = setTimeout(() => {
      if (phase === 'REVEALING') {
        beginDissolve()
      }
    }, AUTO_DISMISS_MS)
  }

  /**
   * Mark the current line as fully revealed (no more animation) and show hint.
   * If not on the last line, also schedule the next auto-reveal.
   * Called either by the settle timer or by a click that skips animation.
   */
  function settleCurrentLine(): void {
    if (hintTimer)   { clearTimeout(hintTimer);   hintTimer = null }
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null }
    currentLineSettled = true

    if (!isLastLine) {
      // Schedule next line auto-reveal after delay
      autoRevealTimer = setTimeout(() => {
        autoRevealTimer = null
        revealLine(visibleUpTo + 1)
      }, AUTO_REVEAL_DELAY)
    } else {
      // Last line settled -- show the hint and start auto-dismiss countdown
      showHint = true
      startAutoDismissCountdown()
    }
  }

  /**
   * Reveal line at index `idx`. Starts the animation clock, schedules
   * the settle timer, and hides the hint until animation completes.
   */
  function revealLine(idx: number): void {
    visibleUpTo = idx
    lineRevealStart = performance.now()
    currentLineSettled = false
    showHint = false

    // Schedule line settle (which will schedule next auto-reveal or show hint)
    settleTimer = setTimeout(() => {
      hintTimer = setTimeout(() => settleCurrentLine(), HINT_DELAY)
    }, LINE_REVEAL_DURATION)
  }

  /**
   * Jump to the fully-settled final state: all lines visible, no auto-timers,
   * hint prompt shown. Called when player clicks during auto-reveal.
   */
  function jumpToFinalState(): void {
    clearTimers()
    visibleUpTo = lines.length - 1
    lineRevealStart = 0
    currentLineSettled = true
    showHint = true
    startAutoDismissCountdown()
  }

  /**
   * Begin the ash dissolve exit sequence.
   * All visible lines get a staggered dissolve animation then onDismiss fires.
   */
  function beginDissolve(): void {
    if (phase !== 'REVEALING') return
    phase = 'DISSOLVING'
    showHint = false
    clearTimers()

    // Build inline style for each visible line with staggered delay
    const count = visibleLines.length
    dissolveStyles = visibleLines.map((_, i) =>
      `animation: ashDissolve ${DISSOLVE_DURATION}ms ease forwards; animation-delay: ${i * DISSOLVE_STAGGER}ms;`
    )

    // After the last line finishes, wait grace period then call onDismiss
    const totalMs = DISSOLVE_DURATION + (count - 1) * DISSOLVE_STAGGER + DISSOLVE_GRACE
    dissolveTimer = setTimeout(() => {
      phase = 'DONE'
      onDismiss()
    }, totalMs)
  }

  /**
   * Track a manual dismiss for the always-skip preference system.
   * After CONSECUTIVE_THRESHOLD dismissals, show the toast offer.
   */
  function trackManualDismiss(): void {
    const prev = readConsecutiveDismisses()
    const next = prev + 1
    writeConsecutiveDismisses(next)
    // Toast is shown on the NEXT overlay mount if count >= threshold
  }

  // Lifecycle
  onMount(() => {
    // If skip pref is active, jump directly to dissolve
    if (skipPrefActive) {
      showAlwaysSkipToast = true
      alwaysSkipToastTimer = setTimeout(() => {
        showAlwaysSkipToast = false
      }, 3500)
      // Begin dissolve after a tiny delay so the overlay renders first
      setTimeout(() => beginDissolve(), 150)
      return
    }

    // Check if we should prompt the user about always-skip
    const consecutiveDismisses = readConsecutiveDismisses()
    if (consecutiveDismisses >= CONSECUTIVE_THRESHOLD) {
      showAlwaysSkipToast = true
      alwaysSkipToastTimer = setTimeout(() => {
        showAlwaysSkipToast = false
      }, 6000)
    }

    // Schedule first reveal with start delay so overlay fade-in finishes first
    autoRevealTimer = setTimeout(() => {
      autoRevealTimer = null
      revealLine(0)
    }, AUTO_REVEAL_START_DELAY)
  })

  onDestroy(() => {
    clearTimers()
  })

  // Click / keyboard handlers

  function handleAdvance(): void {
    if (phase === 'DISSOLVING' || phase === 'DONE') return

    // Auto-reveal is in progress (timer is pending or line is animating)
    // Jump to the final settled state immediately on any click
    const autoInProgress = autoRevealTimer !== null || !currentLineSettled
    if (autoInProgress && !isLastLine) {
      jumpToFinalState()
      return
    }

    const elapsed = performance.now() - lineRevealStart

    if (!currentLineSettled && elapsed < LINE_REVEAL_DURATION) {
      // Mid-animation click on the last line: skip to fully visible
      settleCurrentLine()
      return
    }

    // Last line is settled -- dismiss (manual click)
    if (isLastLine) {
      trackManualDismiss()
      beginDissolve()
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleAdvance()
    }
  }

  function handleAlwaysSkip(): void {
    setSkipPref(true)
    skipPrefActive = true
    showAlwaysSkipToast = false
  }

  function handleNeverSkip(): void {
    writeConsecutiveDismisses(0)
    showAlwaysSkipToast = false
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="narrative-overlay"
  class:exiting={phase === 'DISSOLVING' || phase === 'DONE'}
  role="dialog"
  aria-label="Narrative text"
  aria-modal="true"
  tabindex="-1"
  onclick={handleAdvance}
  onkeydown={handleKeydown}
>
  <!-- Fog layer: CSS-only radial gradient animation -->
  <div class="fog-layer" aria-hidden="true">
    <div class="fog fog-1"></div>
    <div class="fog fog-2"></div>
    <div class="fog fog-3"></div>
  </div>

  <!-- Narrative text block -->
  <div class="narrative-content">
    {#each visibleLines as line, i (line.templateId + '-' + i)}
      <p
        class="narrative-line"
        class:dissolving={phase === 'DISSOLVING'}
        style={phase === 'DISSOLVING' ? (dissolveStyles[i] ?? '') : ''}
      >{line.text}</p>
    {/each}
  </div>

  <!-- Hint prompt -- visible only after last line settles (auto-reveal complete) -->
  {#if showHint && phase === 'REVEALING'}
    <div class="hint" aria-hidden="true">
      <span class="hint-text">{hintLabel}</span>
      <span class="hint-chevron">&#9662;</span>
    </div>
  {/if}

  <!-- Always-skip toast (MEDIUM-11) -->
  {#if showAlwaysSkipToast}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="always-skip-toast"
      role="alertdialog"
      aria-label="Always skip narrative overlays?"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
    >
      {#if skipPrefActive}
        <span class="toast-msg">Auto-skipping overlays.</span>
        <button class="toast-btn toast-btn-secondary" onclick={handleNeverSkip} type="button">
          Turn off
        </button>
      {:else}
        <span class="toast-msg">Always skip story overlays?</span>
        <div class="toast-actions">
          <button class="toast-btn toast-btn-primary" onclick={handleAlwaysSkip} type="button">
            Yes, always skip
          </button>
          <button class="toast-btn toast-btn-secondary" onclick={handleNeverSkip} type="button">
            No
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Overlay base */
  .narrative-overlay {
    position: fixed;
    inset: 0;
    z-index: 950;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    /* Fade in on mount */
    animation: overlayFadeIn 0.4s ease forwards;
    outline: none;
  }

  .narrative-overlay.exiting {
    animation: overlayFadeOut 0.4s ease forwards;
    animation-delay: calc((var(--dissolve-count, 1) - 1) * 150ms + 400ms);
  }

  @keyframes overlayFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes overlayFadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  /* Fog layer */
  .fog-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .fog {
    position: absolute;
    border-radius: 50%;
    filter: blur(calc(80px * var(--layout-scale, 1)));
    opacity: 0.18;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
    animation-direction: alternate;
  }

  .fog-1 {
    width: 60%;
    height: 60%;
    top: -10%;
    left: -15%;
    background: radial-gradient(ellipse at center, #12121f 0%, #0a0a12 60%, transparent 100%);
    animation-name: fogDrift1;
    animation-duration: 18s;
  }

  .fog-2 {
    width: 50%;
    height: 50%;
    bottom: -10%;
    right: -10%;
    background: radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d1a 60%, transparent 100%);
    animation-name: fogDrift2;
    animation-duration: 23s;
  }

  .fog-3 {
    width: 40%;
    height: 40%;
    top: 30%;
    left: 30%;
    background: radial-gradient(ellipse at center, #0f0f20 0%, transparent 100%);
    opacity: 0.12;
    animation-name: fogDrift3;
    animation-duration: 15s;
  }

  @keyframes fogDrift1 {
    from { transform: translate(0, 0)   scale(1);    }
    to   { transform: translate(6%, 4%) scale(1.08); }
  }

  @keyframes fogDrift2 {
    from { transform: translate(0, 0)    scale(1);    }
    to   { transform: translate(-5%, 3%) scale(1.06); }
  }

  @keyframes fogDrift3 {
    from { transform: translate(0, 0)    scale(1);    }
    to   { transform: translate(3%, -4%) scale(1.1); }
  }

  /* Text content */
  .narrative-content {
    position: relative;
    z-index: 1;
    max-width: calc(1100px * var(--layout-scale, 1));
    width: 90%;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: calc(28px * var(--layout-scale, 1));
  }

  .narrative-line {
    margin: 0;
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(22px * var(--text-scale, 1));
    color: #c8c8d0;
    line-height: 1.6;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    font-style: italic;
    /* Dramatic fade-in on reveal */
    animation: lineReveal 0.8s ease forwards;
    opacity: 0;
  }

  @keyframes lineReveal {
    0% {
      opacity: 0;
      transform: translateY(calc(12px * var(--layout-scale, 1))) scale(0.95);
      text-shadow: none;
    }
    60% {
      opacity: 0.9;
      transform: translateY(calc(2px * var(--layout-scale, 1))) scale(1.0);
      text-shadow: 0 0 calc(15px * var(--layout-scale, 1)) rgba(200, 200, 210, 0.3);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
      text-shadow: none;
    }
  }

  /* Ash dissolve -- applied inline with per-line stagger delays */
  @keyframes ashDissolve {
    0% {
      opacity: 1;
      filter: blur(0);
      transform: translateY(0) scale(1);
      letter-spacing: calc(0.5px * var(--layout-scale, 1));
    }
    30% {
      opacity: 0.7;
      filter: blur(calc(1px * var(--layout-scale, 1)));
      transform: translateY(calc(-5px * var(--layout-scale, 1))) scale(0.99);
    }
    60% {
      opacity: 0.3;
      filter: blur(calc(3px * var(--layout-scale, 1)));
      transform: translateY(calc(-15px * var(--layout-scale, 1))) scale(0.97);
      letter-spacing: calc(4px * var(--layout-scale, 1));
    }
    100% {
      opacity: 0;
      filter: blur(calc(6px * var(--layout-scale, 1)));
      transform: translateY(calc(-30px * var(--layout-scale, 1))) scale(0.95);
      letter-spacing: calc(8px * var(--layout-scale, 1));
    }
  }

  /* Hint / continue indicator (MEDIUM-11: higher contrast + larger) */
  .hint {
    position: absolute;
    bottom: calc(48px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    /* High-contrast frosted pill */
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.30);
    border-radius: calc(24px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    animation: hintFadeIn 0.5s ease forwards;
    pointer-events: none;
    user-select: none;
    backdrop-filter: blur(8px);
  }

  .hint-text {
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(15px * var(--text-scale, 1));
    /* Warm white -- high contrast vs old #666 gray */
    color: rgba(255, 240, 220, 0.92);
    letter-spacing: calc(1px * var(--layout-scale, 1));
    text-transform: lowercase;
    font-style: italic;
  }

  .hint-chevron {
    font-size: calc(14px * var(--text-scale, 1));
    color: rgba(255, 210, 150, 0.85);
    animation: chevronBounce 1.5s ease-in-out infinite;
  }

  @keyframes hintFadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(calc(8px * var(--layout-scale, 1))); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes chevronBounce {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(calc(4px * var(--layout-scale, 1))); }
  }

  /* Always-skip toast (MEDIUM-11) */
  .always-skip-toast {
    position: absolute;
    bottom: calc(110px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
    background: rgba(20, 20, 35, 0.96);
    border: 1px solid rgba(140, 120, 255, 0.40);
    border-radius: calc(12px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    z-index: 2;
    cursor: default;
    animation: toastSlideUp 0.35s ease forwards;
    white-space: nowrap;
  }

  @keyframes toastSlideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(calc(16px * var(--layout-scale, 1))); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .toast-msg {
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(14px * var(--text-scale, 1));
    color: #c8c8d0;
    text-align: center;
  }

  .toast-actions {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .toast-btn {
    cursor: pointer;
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    min-height: calc(36px * var(--layout-scale, 1));
    transition: background 0.15s;
  }

  .toast-btn-primary {
    background: rgba(120, 80, 220, 0.85);
    color: #fff;
  }

  .toast-btn-primary:hover {
    background: rgba(140, 100, 255, 0.95);
  }

  .toast-btn-secondary {
    background: rgba(80, 80, 100, 0.6);
    color: #c8c8d0;
  }

  .toast-btn-secondary:hover {
    background: rgba(100, 100, 130, 0.8);
  }

  /* Playwright animation pause hook */
  /* overlay.css sets [data-pw-animations="disabled"] * { animation-play-state: paused } */
</style>

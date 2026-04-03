<!-- src/ui/components/NarrativeOverlay.svelte
  Full-screen atmospheric narrative overlay for room transitions and NPC dialogue.

  Two modes:
    auto-fade      — shows all lines at once, auto-dismisses after 3-4s, click skips
    click-through  — one line at a time, each click/Enter/Space advances

  Design spec: docs/mechanics/narrative.md §Display System
  Scaling rules: docs/ui/layout.md — calc(Npx * var(--layout-scale|--text-scale, 1))
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { NarrativeLine } from '../../services/narrativeTypes'

  // ── Props ──────────────────────────────────────────────────
  interface Props {
    lines: NarrativeLine[];
    mode: 'auto-fade' | 'click-through';
    onDismiss: () => void;
  }
  let { lines, mode, onDismiss }: Props = $props()

  // ── Internal state ─────────────────────────────────────────
  /** Index of the last visible line (0-based). In auto-fade all lines visible immediately. */
  let visibleUpTo = $state(0)

  /** Whether the overlay is in the fade-out phase. */
  let isExiting = $state(false)

  /** Whether the "click to continue / click to dismiss" hint is visible. */
  let showHint = $state(false)

  let autoFadeTimer: ReturnType<typeof setTimeout> | null = null
  let hintTimer:     ReturnType<typeof setTimeout> | null = null

  // ── Derived ────────────────────────────────────────────────
  /** Lines to render. In click-through only up to visibleUpTo is shown. */
  let visibleLines = $derived(
    mode === 'auto-fade' ? lines : lines.slice(0, visibleUpTo + 1)
  )

  /** Auto-fade dismiss delay: 3s for 1 line, +1s per extra line. */
  let autoFadeDuration = $derived(Math.max(3000, 3000 + (lines.length - 1) * 1000))

  // ── Lifecycle ──────────────────────────────────────────────
  onMount(() => {
    // Start with the first line visible in click-through mode.
    visibleUpTo = 0

    if (mode === 'auto-fade') {
      // Show hint after 2s in auto-fade mode.
      hintTimer = setTimeout(() => { showHint = true }, 2000)
      // Auto-dismiss after calculated duration.
      autoFadeTimer = setTimeout(() => beginExit(), autoFadeDuration)
    } else {
      // Click-through: hint immediately.
      showHint = true
    }
  })

  onDestroy(() => {
    if (autoFadeTimer) clearTimeout(autoFadeTimer)
    if (hintTimer)     clearTimeout(hintTimer)
  })

  // ── Actions ────────────────────────────────────────────────

  /** Start fade-out then call onDismiss. */
  function beginExit(): void {
    if (isExiting) return
    isExiting = true
    // Match the CSS transition duration (0.4s).
    setTimeout(() => onDismiss(), 400)
  }

  /** Advance click-through or skip auto-fade. */
  function handleAdvance(): void {
    if (isExiting) return

    if (mode === 'auto-fade') {
      // Click anywhere skips the timer.
      if (autoFadeTimer) clearTimeout(autoFadeTimer)
      if (hintTimer)     clearTimeout(hintTimer)
      beginExit()
      return
    }

    // Click-through: advance to next line or dismiss on last.
    if (visibleUpTo < lines.length - 1) {
      visibleUpTo += 1
    } else {
      beginExit()
    }
  }

  /** Keyboard: Enter or Space advances/dismisses. */
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleAdvance()
    }
  }

  /** Whether this is the last line in click-through (show "dismiss" hint). */
  let isLastLine = $derived(mode === 'click-through' && visibleUpTo >= lines.length - 1)
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="narrative-overlay"
  class:exiting={isExiting}
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
      <p class="narrative-line" class:line-entering={true}>{line.text}</p>
    {/each}
  </div>

  <!-- Hint prompt -->
  {#if showHint}
    <div class="hint" aria-hidden="true">
      {#if mode === 'click-through'}
        {isLastLine ? 'click to dismiss' : 'click to continue'}
      {:else}
        click to skip
      {/if}
      <span class="hint-chevron">▾</span>
    </div>
  {/if}
</div>

<style>
  /* ── Overlay base ──────────────────────────────────────────── */
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
  }

  @keyframes overlayFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes overlayFadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  /* ── Fog layer ─────────────────────────────────────────────── */
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
    from { transform: translate(0, 0)   scale(1);    }
    to   { transform: translate(3%, -4%) scale(1.1); }
  }

  /* ── Text content ──────────────────────────────────────────── */
  .narrative-content {
    position: relative;
    z-index: 1;
    max-width: calc(800px * var(--layout-scale, 1));
    width: 90%;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: calc(20px * var(--layout-scale, 1));
  }

  .narrative-line {
    margin: 0;
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(18px * var(--text-scale, 1));
    color: #c8c8d0;
    line-height: 1.6;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    font-style: italic;
    /* Fade in with upward drift */
    animation: lineReveal 0.6s ease forwards;
    animation-delay: 0.3s;
    opacity: 0;
  }

  @keyframes lineReveal {
    from {
      opacity: 0;
      transform: translateY(calc(8px * var(--layout-scale, 1)));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Hint / continue indicator ─────────────────────────────── */
  .hint {
    position: absolute;
    bottom: calc(40px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(12px * var(--text-scale, 1));
    color: #666;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    text-transform: lowercase;
    animation: hintFadeIn 0.5s ease forwards;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    user-select: none;
  }

  .hint-chevron {
    font-size: calc(10px * var(--text-scale, 1));
    opacity: 0.7;
  }

  @keyframes hintFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Playwright animation pause hook ──────────────────────── */
  /* overlay.css sets [data-pw-animations="disabled"] * { animation-play-state: paused } */
</style>

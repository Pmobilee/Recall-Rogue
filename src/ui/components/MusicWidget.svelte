<script lang="ts">
  /**
   * MusicWidget.svelte
   *
   * Ultra-sleek Spotify-style music widget. Shows a spectrogram visualiser in
   * collapsed (pill) state and expands to a full player panel with track info,
   * category toggle, playback controls, and a volume slider.
   *
   * Positioning: fixed, top-right corner below InRunTopBar.
   * All dimensions use calc(Npx * var(--layout-scale, 1)) / calc(Npx * var(--text-scale, 1)).
   */

  import { musicService } from '../../services/musicService'
  import type { MusicTrack, MusicCategory } from '../../data/musicTracks'

  // ── Reactive state ──────────────────────────────────────────────────────

  let expanded = $state(false)
  let currentTrack = $state<MusicTrack | null>(null)
  let currentCategory = $state<MusicCategory>('quiet')
  let volume = $state(50)
  let isPlaying = $state(false)
  let isMuted = $state(false)
  let nameOverflows = $state(false)

  // ── DOM refs ─────────────────────────────────────────────────────────────

  let collapsedCanvasEl: HTMLCanvasElement | undefined = $state()
  let expandedCanvasEl: HTMLCanvasElement | undefined = $state()
  let wrapperEl: HTMLDivElement | undefined = $state()
  let trackNameEl: HTMLDivElement | undefined = $state()

  // ── Sync state from service ───────────────────────────────────────────────

  $effect(() => {
    const unsub = musicService.subscribe(() => {
      currentTrack = musicService.currentTrack
      currentCategory = musicService.currentCategory
      isPlaying = musicService.isPlaying
      volume = Math.round(musicService.volume * 100)
      isMuted = musicService.muted
    })
    return unsub
  })

  // ── Check track name overflow for marquee ─────────────────────────────────

  $effect(() => {
    if (trackNameEl && currentTrack) {
      nameOverflows = trackNameEl.scrollWidth > trackNameEl.clientWidth
    }
  })

  // ── Outside click to close ─────────────────────────────────────────────────

  function handleClickOutside(e: MouseEvent): void {
    if (expanded && wrapperEl && !wrapperEl.contains(e.target as Node)) {
      expanded = false
    }
  }

  $effect(() => {
    if (expanded) {
      document.addEventListener('click', handleClickOutside, true)
      return () => document.removeEventListener('click', handleClickOutside, true)
    }
  })

  // ── Spectrogram animation loop ─────────────────────────────────────────────

  $effect(() => {
    // Run one loop for collapsed canvas, swap to expanded when open.
    // We track both canvases and restart when expanded state changes.
    const canvas = expanded ? expandedCanvasEl : collapsedCanvasEl
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const freqData = new Uint8Array(32)
    const bins = [2, 5, 8, 12, 17, 23]
    let animId: number
    let t = 0

    function draw(): void {
      t += 0.02
      musicService.getFrequencyData(freqData)

      const w = canvas!.width
      const h = canvas!.height
      ctx!.clearRect(0, 0, w, h)

      const barCount = bins.length
      const gap = 2
      const barW = Math.floor((w - gap * (barCount - 1)) / barCount)

      for (let i = 0; i < barCount; i++) {
        let amp = (freqData[bins[i]] ?? 0) / 255

        // Idle animation when not playing or amplitude is negligible
        if (!isPlaying || amp < 0.05) {
          amp = 0.15 + 0.1 * Math.sin(t * 2 + i * 0.8)
        }

        const barH = Math.max(3, amp * h * 0.9)
        const x = i * (barW + gap)
        const y = h - barH

        // Glow layer (blurred)
        ctx!.save()
        ctx!.filter = 'blur(3px)'
        ctx!.fillStyle = `rgba(29, 185, 84, ${amp * 0.4})`
        ctx!.beginPath()
        ctx!.roundRect(x, y, barW, barH, 2)
        ctx!.fill()
        ctx!.restore()

        // Sharp bar with gradient
        const grad = ctx!.createLinearGradient(x, h, x, y)
        grad.addColorStop(0, '#1db954')
        grad.addColorStop(1, '#1ed760')
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.roundRect(x, y, barW, barH, 2)
        ctx!.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  })

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleVolumeInput(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value, 10)
    musicService.setVolume(val / 100)
  }

  function handleCategorySwitch(cat: MusicCategory, e: MouseEvent): void {
    e.stopPropagation()
    musicService.switchCategory(cat)
  }

  function handleTogglePill(e: MouseEvent): void {
    e.stopPropagation()
    expanded = !expanded
  }
</script>

<!-- Single container that expands from pill to full panel -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="music-widget"
  class:expanded
  class:playing={isPlaying}
  bind:this={wrapperEl}
  onclick={handleTogglePill}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { expanded = !expanded } }}
>
  <div class="panel-shine" aria-hidden="true"></div>

  <!-- Spectrogram — always visible, grows when expanded -->
  <canvas
    bind:this={collapsedCanvasEl}
    width="48"
    height="32"
    class="spectrogram-canvas"
    class:hidden={expanded}
    aria-hidden="true"
  ></canvas>
  <canvas
    bind:this={expandedCanvasEl}
    width="180"
    height="48"
    class="spectrogram-canvas expanded-canvas"
    class:hidden={!expanded}
    aria-hidden="true"
  ></canvas>

  {#if expanded}
    <!-- Track info -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="track-info" onclick={(e) => e.stopPropagation()}>
      <div
        class="track-name"
        class:marquee={nameOverflows}
        bind:this={trackNameEl}
        title={currentTrack?.title ?? ''}
      >
        {currentTrack?.title ?? 'No track'}
      </div>
      <div class="track-category">
        {currentCategory === 'epic' ? 'EPIC' : 'LO-FI'}
      </div>
    </div>

    <!-- Category toggle -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="category-toggle" role="group" aria-label="Music category" onclick={(e) => e.stopPropagation()}>
      <button
        type="button"
        class="cat-btn"
        class:active={currentCategory === 'epic'}
        onclick={(e) => handleCategorySwitch('epic', e)}
        aria-pressed={currentCategory === 'epic'}
      >EPIC</button>
      <button
        type="button"
        class="cat-btn"
        class:active={currentCategory === 'quiet'}
        onclick={(e) => handleCategorySwitch('quiet', e)}
        aria-pressed={currentCategory === 'quiet'}
      >LO-FI</button>
    </div>

    <!-- Playback controls -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="playback-controls" role="group" aria-label="Playback controls" onclick={(e) => e.stopPropagation()}>
      <button type="button" class="ctrl-btn" onclick={(e) => { e.stopPropagation(); musicService.prev() }} aria-label="Previous track">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" fill="currentColor"/></svg>
      </button>
      <button type="button" class="ctrl-btn play-btn" onclick={(e) => { e.stopPropagation(); musicService.togglePlayPause() }} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {#if isPlaying}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5z" fill="currentColor"/></svg>
        {/if}
      </button>
      <button type="button" class="ctrl-btn" onclick={(e) => { e.stopPropagation(); musicService.next() }} aria-label="Next track">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg>
      </button>
    </div>

    <!-- Volume -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="volume-row" onclick={(e) => e.stopPropagation()}>
      <button type="button" class="mute-btn" class:muted={isMuted} onclick={(e) => { e.stopPropagation(); musicService.toggleMute() }} aria-label={isMuted ? 'Unmute' : 'Mute'}>
        {#if isMuted}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12A4.5 4.5 0 0 0 14 8.07V10l2.45 2.45c.03-.15.05-.3.05-.45zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.79 8.79 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.07V15.9A4.478 4.478 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>
        {/if}
      </button>
      <div class="slider-track" style="--pct: {isMuted ? 0 : volume}%">
        <input type="range" class="volume-slider" class:dimmed={isMuted} min="0" max="100" value={volume} oninput={handleVolumeInput} aria-label="Volume" />
      </div>
    </div>
  {/if}
</div>

<style>
  /* ── Single expanding container ────────────────────────────────────── */
  .music-widget {
    position: fixed;
    top: calc(var(--topbar-height, 4.5vh) + 0.5vh);
    right: 1vw;
    z-index: 201;

    /* Collapsed = small pill */
    width: clamp(36px, 4vw, 52px);
    padding: 4px;
    border-radius: 12px;

    background: rgba(8, 10, 18, 0.4);
    backdrop-filter: blur(20px) saturate(1.3);
    -webkit-backdrop-filter: blur(20px) saturate(1.3);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);

    cursor: pointer;
    overflow: hidden;
    box-sizing: border-box;

    transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1),
                padding 280ms cubic-bezier(0.4, 0, 0.2, 1),
                border-radius 280ms ease,
                box-shadow 280ms ease;
  }

  .music-widget:hover:not(.expanded) {
    transform: scale(1.06);
    box-shadow: 0 0 10px rgba(29, 185, 84, 0.35);
    border-color: rgba(29, 185, 84, 0.3);
  }

  .music-widget.playing:not(.expanded) {
    border-color: rgba(29, 185, 84, 0.2);
  }

  .music-widget.expanded {
    width: clamp(160px, 16vw, 210px);
    padding: clamp(8px, 1vw, 12px);
    border-radius: 14px;
    cursor: default;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5),
                inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  /* Glass shine */
  .panel-shine {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 25%, transparent 50%);
    pointer-events: none;
    border-radius: inherit;
  }

  /* ── Canvases ──────────────────────────────────────────────────────── */
  .spectrogram-canvas {
    display: block;
    border-radius: 3px;
    width: 100%;
  }

  .spectrogram-canvas.hidden {
    display: none;
  }

  .expanded-canvas {
    height: clamp(24px, 2.5vw, 36px);
    margin-bottom: 6px;
  }

  /* ── Track info ──────────────────────────────────────────────────── */
  .track-info {
    margin-bottom: 5px;
    overflow: hidden;
  }

  .track-name {
    color: #fff;
    font-size: clamp(10px, 1vw, 12px);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .track-name.marquee {
    text-overflow: clip;
    animation: marquee 8s linear infinite;
  }

  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-100%); }
  }

  .track-category {
    color: rgba(255, 255, 255, 0.4);
    font-size: clamp(7px, 0.7vw, 9px);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 1px;
  }

  /* ── Category toggle ─────────────────────────────────────────────── */
  .category-toggle {
    display: flex;
    gap: 2px;
    margin-bottom: 5px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    padding: 2px;
  }

  .cat-btn {
    flex: 1;
    height: clamp(20px, 2vw, 26px);
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: clamp(8px, 0.75vw, 10px);
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: all 180ms ease;
    padding: 0;
  }

  .cat-btn:hover { color: rgba(255,255,255,0.8); }

  .cat-btn.active {
    background: rgba(29, 185, 84, 0.2);
    color: #1db954;
    border-color: rgba(29, 185, 84, 0.3);
  }

  /* ── Playback controls ───────────────────────────────────────────── */
  .playback-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-bottom: 5px;
  }

  .ctrl-btn {
    width: clamp(18px, 1.8vw, 24px);
    height: clamp(18px, 1.8vw, 24px);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    border-radius: 50%;
    transition: color 150ms ease, background 150ms ease;
    padding: 2px;
    box-sizing: border-box;
  }

  .ctrl-btn svg { width: 100%; height: 100%; }
  .ctrl-btn:hover { color: #fff; }

  .ctrl-btn.play-btn {
    width: clamp(26px, 2.5vw, 32px);
    height: clamp(26px, 2.5vw, 32px);
    background: rgba(255, 255, 255, 0.1);
    padding: 4px;
  }

  .ctrl-btn.play-btn:hover {
    background: rgba(29, 185, 84, 0.3);
  }

  /* ── Volume ──────────────────────────────────────────────────────── */
  .volume-row {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .mute-btn {
    width: clamp(14px, 1.3vw, 18px);
    height: clamp(14px, 1.3vw, 18px);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 0;
    transition: color 150ms ease;
  }

  .mute-btn svg { width: 100%; height: 100%; }
  .mute-btn:hover { color: #fff; }
  .mute-btn.muted { color: rgba(255,255,255,0.35); }

  .slider-track {
    flex: 1;
    height: 14px;
    display: flex;
    align-items: center;
  }

  .volume-slider {
    width: 100%;
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(to right, #1db954 0%, #1db954 var(--pct), rgba(255,255,255,0.2) var(--pct), rgba(255,255,255,0.2) 100%);
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
    outline: none;
    padding: 0;
    margin: 0;
    border: none;
  }

  .volume-slider.dimmed { opacity: 0.35; }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 4px rgba(0,0,0,0.4);
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 4px rgba(0,0,0,0.4);
    cursor: pointer;
    border: none;
  }
</style>

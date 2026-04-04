<script lang="ts">
  import { onMount } from 'svelte';
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    onback: () => void;
    onSelectTrivia: () => void;
    onSelectStudy: () => void;
  }

  const { onback, onSelectTrivia, onSelectStudy }: Props = $props();

  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  // --- Trivia panel parallax state ---
  let triviaEl = $state<HTMLElement | null>(null);
  let triviaRotX = $state(0);
  let triviaRotY = $state(0);
  let triviaShineX = $state(50);
  let triviaShineY = $state(50);
  let triviaHovering = $state(false);
  let triviaHasImage = $state(false);
  let triviaRafId = 0;

  // --- Study panel parallax state ---
  let studyEl = $state<HTMLElement | null>(null);
  let studyRotX = $state(0);
  let studyRotY = $state(0);
  let studyShineX = $state(50);
  let studyShineY = $state(50);
  let studyHovering = $state(false);
  let studyHasImage = $state(false);
  let studyRafId = 0;

  // Pre-check image availability
  $effect(() => {
    const triviaImg = new Image();
    triviaImg.onload = () => { triviaHasImage = true; };
    triviaImg.src = '/assets/sprites/deckfronts/trivia_dungeon.webp';

    const studyImg = new Image();
    studyImg.onload = () => { studyHasImage = true; };
    studyImg.src = '/assets/sprites/deckfronts/study_temple.webp';
  });

  /**
   * Factory: returns pointer event handlers for a given panel's state setters.
   * Avoids duplicating the RAF-throttled pointer math for both panels.
   */
  function makePointerHandlers(
    getEl: () => HTMLElement | null,
    getRafId: () => number,
    setRafId: (id: number) => void,
    setRotX: (v: number) => void,
    setRotY: (v: number) => void,
    setShineX: (v: number) => void,
    setShineY: (v: number) => void,
    setHovering: (v: boolean) => void,
  ) {
    return {
      move(e: PointerEvent) {
        if (isTouchDevice || getRafId()) return;
        const id = requestAnimationFrame(() => {
          setRafId(0);
          const el = getEl();
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          setRotY((x - 0.5) * 24);
          setRotX((0.5 - y) * 24);
          setShineX(x * 100);
          setShineY(y * 100);
        });
        setRafId(id);
      },
      enter() {
        if (isTouchDevice) return;
        setHovering(true);
        const el = getEl();
        if (el) el.style.willChange = 'transform';
      },
      leave() {
        setHovering(false);
        setRotX(0); setRotY(0);
        setShineX(50); setShineY(50);
        setTimeout(() => {
          const el = getEl();
          if (el) el.style.willChange = '';
        }, 400);
      },
    };
  }

  const triviaHandlers = makePointerHandlers(
    () => triviaEl,
    () => triviaRafId,
    (id) => { triviaRafId = id; },
    (v) => { triviaRotX = v; },
    (v) => { triviaRotY = v; },
    (v) => { triviaShineX = v; },
    (v) => { triviaShineY = v; },
    (v) => { triviaHovering = v; },
  );

  const studyHandlers = makePointerHandlers(
    () => studyEl,
    () => studyRafId,
    (id) => { studyRafId = id; },
    (v) => { studyRotX = v; },
    (v) => { studyRotY = v; },
    (v) => { studyShineX = v; },
    (v) => { studyShineY = v; },
    (v) => { studyHovering = v; },
  );

  onMount(() => {
    playCardAudio('modal-open');
  });

  function handleBack() {
    playCardAudio('tab-switch');
    onback();
  }

  function handleSelectTrivia() {
    playCardAudio('tab-switch');
    onSelectTrivia();
  }

  function handleSelectStudy() {
    playCardAudio('tab-switch');
    onSelectStudy();
  }
</script>

<div class="deck-selection-hub">
  <div class="top-bar">
    <button class="back-btn" onclick={handleBack}>
      &#8592; Back
    </button>
  </div>

  <div class="panels-area">
    <!-- Left panel: Trivia Dungeon -->
    <div class="panel-3d">
      <div
        bind:this={triviaEl}
        class="panel panel--trivia"
        class:hovering={triviaHovering}
        role="button"
        tabindex="0"
        onclick={handleSelectTrivia}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectTrivia(); } }}
        onpointerenter={triviaHandlers.enter}
        onpointermove={triviaHandlers.move}
        onpointerleave={triviaHandlers.leave}
        style="--rot-x: {triviaRotX}deg; --rot-y: {triviaRotY}deg; --shine-x: {triviaShineX}%; --shine-y: {triviaShineY}%;"
      >
        {#if triviaHasImage}
          <div class="parallax-wrap">
            <img
              class="plx-layer"
              src="/assets/sprites/deckfronts/trivia_dungeon.webp"
              alt=""
              style="transform: translate({(triviaShineX - 50) * -0.08}%, {(triviaShineY - 50) * -0.08}%) scale(1.08)"
            />
          </div>
        {/if}

        <div class="panel-text-overlay">
          <div class="panel-title">TRIVIA DUNGEON</div>
          <div class="panel-subtitle panel-subtitle--trivia">The Armory</div>
          <div class="panel-divider panel-divider--trivia"></div>
          <div class="panel-tagline">
            Battle with knowledge.<br />Multi-domain combat.
          </div>
          <div class="panel-stats">4 knowledge domains · 3,500+ facts</div>
        </div>

        <div class="shine-overlay"></div>
      </div>
    </div>

    <!-- Right panel: Study Temple -->
    <div class="panel-3d">
      <div
        bind:this={studyEl}
        class="panel panel--study"
        class:hovering={studyHovering}
        role="button"
        tabindex="0"
        onclick={handleSelectStudy}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectStudy(); } }}
        onpointerenter={studyHandlers.enter}
        onpointermove={studyHandlers.move}
        onpointerleave={studyHandlers.leave}
        style="--rot-x: {studyRotX}deg; --rot-y: {studyRotY}deg; --shine-x: {studyShineX}%; --shine-y: {studyShineY}%;"
      >
        {#if studyHasImage}
          <div class="parallax-wrap">
            <img
              class="plx-layer"
              src="/assets/sprites/deckfronts/study_temple.webp"
              alt=""
              style="transform: translate({(studyShineX - 50) * -0.08}%, {(studyShineY - 50) * -0.08}%) scale(1.08)"
            />
          </div>
        {/if}

        <div class="panel-text-overlay">
          <div class="panel-title">STUDY TEMPLE</div>
          <div class="panel-subtitle panel-subtitle--study">The Library</div>
          <div class="panel-divider panel-divider--study"></div>
          <div class="panel-tagline">
            Master your decks.<br />Focused learning.
          </div>
          <div class="panel-stats">48 curated decks · 46,000+ facts</div>
        </div>

        <div class="shine-overlay"></div>
      </div>
    </div>
  </div>

  <!-- Ground fog — thick persistent layer at the bottom -->
  <div class="ground-fog"></div>

  <!-- Background smoke wisps — thick, damp dungeon mist -->
  <div class="smoke-container">
    {#each Array(12) as _}
      <div class="smoke-wisp"></div>
    {/each}
  </div>

  <!-- Foreground smoke wisps — pass in front of panels -->
  <div class="smoke-container smoke-foreground">
    {#each Array(5) as _}
      <div class="smoke-wisp smoke-wisp-fg"></div>
    {/each}
  </div>
</div>

<style>
  .deck-selection-hub {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 800px 400px at 50% 50%, rgba(99, 102, 241, 0.04), transparent),
      linear-gradient(160deg, #0a0e1a 0%, #0d1117 50%, #0a1020 100%);
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .top-bar {
    padding: calc(16px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    position: relative;
    z-index: 4;
  }

  .back-btn {
    background: none;
    border: none;
    color: #8b949e;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 500;
    cursor: pointer;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    transition: color 0.2s ease;
    letter-spacing: 0.5px;
  }

  .back-btn:hover {
    color: #e2e8f0;
  }

  .panels-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(24px * var(--layout-scale, 1));
    padding: calc(24px * var(--layout-scale, 1));
    position: relative;
    z-index: 2;
  }

  /* Perspective container — wraps each panel */
  .panel-3d {
    perspective: calc(800px * var(--layout-scale, 1));
    width: 45%;
    max-width: calc(500px * var(--layout-scale, 1));
  }

  .panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: calc(480px * var(--layout-scale, 1));
    border-radius: calc(16px * var(--layout-scale, 1));
    position: relative;
    overflow: hidden;
    cursor: pointer;
    text-align: center;
    padding: calc(32px * var(--layout-scale, 1));
    /* 3D transforms */
    transform-style: preserve-3d;
    transform: rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg));
    transition: transform 0.4s ease-out, box-shadow 0.2s ease, border-color 0.2s ease;
    /* a11y — remove default focus outline, handled by border */
    outline: none;
  }

  .panel.hovering {
    transition: transform 0.08s ease-out, box-shadow 0.2s ease, border-color 0.2s ease;
  }

  /* Trivia Dungeon panel */
  .panel--trivia {
    background: linear-gradient(160deg, #1a2332 0%, #1e293b 50%, #1a2332 100%);
    border: 1px solid rgba(245, 158, 11, 0.2);
    box-shadow:
      0 calc(4px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3),
      inset 0 calc(1px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.05);
  }

  .panel--trivia::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: calc(3px * var(--layout-scale, 1));
    background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.5), transparent);
  }

  .panel--trivia:hover {
    border-color: rgba(245, 158, 11, 0.5);
    box-shadow:
      0 calc(12px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.2),
      inset 0 calc(1px * var(--layout-scale, 1)) calc(50px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.08);
  }

  /* Study Temple panel */
  .panel--study {
    background: linear-gradient(160deg, #1a1035 0%, #1e1145 50%, #1a1035 100%);
    border: 1px solid rgba(99, 102, 241, 0.2);
    box-shadow:
      0 calc(4px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3),
      inset 0 calc(1px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.05);
  }

  .panel--study::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: calc(3px * var(--layout-scale, 1));
    background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent);
  }

  .panel--study:hover {
    border-color: rgba(99, 102, 241, 0.5);
    box-shadow:
      0 calc(12px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.2),
      inset 0 calc(1px * var(--layout-scale, 1)) calc(50px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.08);
  }

  /* Parallax image layers */
  .parallax-wrap {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    z-index: 0;
  }

  .plx-layer {
    position: absolute;
    inset: calc(-12px * var(--layout-scale, 1));
    width: calc(100% + calc(24px * var(--layout-scale, 1)));
    height: calc(100% + calc(24px * var(--layout-scale, 1)));
    object-fit: cover;
    pointer-events: none;
    transition: transform 0.12s ease-out;
  }

  /* Shine overlay */
  .shine-overlay {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      circle at var(--shine-x, 50%) var(--shine-y, 50%),
      rgba(255, 255, 255, 0.22) 0%,
      rgba(255, 255, 255, 0.04) 45%,
      transparent 70%
    );
    transition: opacity 0.25s ease;
    z-index: 10;
  }

  .panel.hovering .shine-overlay {
    opacity: 1;
  }

  /* ===== Ground fog — thick persistent bottom layer ===== */
  .ground-fog {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 45%;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(
      0deg,
      rgba(140, 150, 175, 0.35) 0%,
      rgba(140, 150, 175, 0.25) 15%,
      rgba(140, 150, 175, 0.12) 40%,
      rgba(140, 150, 175, 0.04) 70%,
      transparent 100%
    );
    filter: blur(calc(15px * var(--layout-scale, 1)));
    animation: fog-drift 8s ease-in-out infinite alternate;
  }

  .ground-fog::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: -10%;
    right: -10%;
    height: 60%;
    background: radial-gradient(
      ellipse 120% 100% at 50% 100%,
      rgba(130, 140, 170, 0.40) 0%,
      rgba(130, 140, 170, 0.20) 40%,
      transparent 70%
    );
    animation: fog-sway 12s ease-in-out infinite alternate-reverse;
  }

  .ground-fog::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: -5%;
    right: -5%;
    height: 35%;
    background: radial-gradient(
      ellipse 100% 100% at 50% 100%,
      rgba(150, 155, 180, 0.50) 0%,
      rgba(150, 155, 180, 0.25) 50%,
      transparent 80%
    );
    animation: fog-sway 9s ease-in-out infinite alternate;
  }

  @keyframes fog-drift {
    0% { transform: translateX(calc(-20px * var(--layout-scale, 1))); }
    100% { transform: translateX(calc(20px * var(--layout-scale, 1))); }
  }

  @keyframes fog-sway {
    0% { transform: translateX(calc(-40px * var(--layout-scale, 1))) scaleY(0.9); }
    100% { transform: translateX(calc(40px * var(--layout-scale, 1))) scaleY(1.1); }
  }

  /* Text content layer — floats above parallax in 3D space */
  .panel-text-overlay {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(16px * var(--layout-scale, 1));
    transform: translateZ(calc(40px * var(--layout-scale, 1)));
  }

  /* Dark scrim behind text for readability over pixel art */
  .panel-text-overlay::before {
    content: '';
    position: absolute;
    inset: calc(-40px * var(--layout-scale, 1));
    background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.5) 40%, transparent 75%);
    z-index: -1;
    pointer-events: none;
  }

  /* Title */
  .panel-title {
    font-size: calc(32px * var(--text-scale, 1));
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #f5f5f5;
    text-shadow:
      calc(-2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      calc(2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      0 calc(-2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
  }

  /* Subtitle */
  .panel-subtitle {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 600;
    font-style: italic;
    text-shadow:
      calc(-2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      calc(2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      0 calc(-2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
  }

  .panel-subtitle--trivia {
    color: #f59e0b;
  }

  .panel-subtitle--study {
    color: #818cf8;
  }

  /* Divider */
  .panel-divider {
    width: calc(80px * var(--layout-scale, 1));
    height: 1px;
    border: none;
  }

  .panel-divider--trivia {
    background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.5), transparent);
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.3);
  }

  .panel-divider--study {
    background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent);
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.3);
  }

  /* Stats */
  .panel-stats {
    font-size: calc(13px * var(--text-scale, 1));
    color: #94a3b8;
    margin-top: calc(8px * var(--layout-scale, 1));
    text-shadow:
      calc(-2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      calc(2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      0 calc(-2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
  }

  /* Tagline */
  .panel-tagline {
    font-size: calc(16px * var(--text-scale, 1));
    color: #c8cdd5;
    text-align: center;
    line-height: 1.5;
    text-shadow:
      calc(-2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      calc(2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      0 calc(-2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
  }

  /* ===== Smoke wisps — thick damp dungeon mist ===== */
  .smoke-container {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
  }

  .smoke-wisp {
    position: absolute;
    bottom: calc(-100px * var(--layout-scale, 1));
    width: calc(500px * var(--layout-scale, 1));
    height: calc(500px * var(--layout-scale, 1));
    background: radial-gradient(ellipse at center, rgba(160, 165, 185, 0.22) 0%, rgba(140, 145, 170, 0.12) 35%, transparent 65%);
    border-radius: 50%;
    filter: blur(calc(25px * var(--layout-scale, 1)));
    animation: smoke-rise var(--duration) ease-in-out infinite, wind-gust var(--gust-duration, 7s) ease-in-out infinite;
    animation-delay: var(--delay), var(--gust-delay, 0s);
    opacity: 0;
  }

  .smoke-wisp:nth-child(1)  { left: 0%;  --duration: 10s; --delay: 0s;   --sway: 120px;  --peak-opacity: 0.9;  --gust-duration: 6s;  --gust-delay: 0s;   --gust-shift: 80px; }
  .smoke-wisp:nth-child(2)  { left: 10%; --duration: 13s; --delay: 1.5s; --sway: -150px; --peak-opacity: 0.7;  --gust-duration: 8s;  --gust-delay: 2s;   --gust-shift: -100px; }
  .smoke-wisp:nth-child(3)  { left: 22%; --duration: 9s;  --delay: 3s;   --sway: 100px;  --peak-opacity: 1.0;  --gust-duration: 5s;  --gust-delay: 1s;   --gust-shift: 60px; }
  .smoke-wisp:nth-child(4)  { left: 35%; --duration: 12s; --delay: 0.5s; --sway: -130px; --peak-opacity: 0.8;  --gust-duration: 9s;  --gust-delay: 4s;   --gust-shift: -120px; }
  .smoke-wisp:nth-child(5)  { left: 48%; --duration: 11s; --delay: 2.5s; --sway: 140px;  --peak-opacity: 0.85; --gust-duration: 7s;  --gust-delay: 1.5s; --gust-shift: 90px; }
  .smoke-wisp:nth-child(6)  { left: 58%; --duration: 14s; --delay: 4s;   --sway: -110px; --peak-opacity: 0.7;  --gust-duration: 6s;  --gust-delay: 3s;   --gust-shift: -70px; }
  .smoke-wisp:nth-child(7)  { left: 70%; --duration: 9s;  --delay: 1s;   --sway: 90px;   --peak-opacity: 1.0;  --gust-duration: 8s;  --gust-delay: 5s;   --gust-shift: 110px; }
  .smoke-wisp:nth-child(8)  { left: 80%; --duration: 12s; --delay: 3.5s; --sway: -100px; --peak-opacity: 0.75; --gust-duration: 5s;  --gust-delay: 2.5s; --gust-shift: -80px; }
  .smoke-wisp:nth-child(9)  { left: 88%; --duration: 10s; --delay: 5s;   --sway: 70px;   --peak-opacity: 0.9;  --gust-duration: 7s;  --gust-delay: 0.5s; --gust-shift: 60px; }
  .smoke-wisp:nth-child(10) { left: 95%; --duration: 11s; --delay: 2s;   --sway: -80px;  --peak-opacity: 0.65; --gust-duration: 9s;  --gust-delay: 4.5s; --gust-shift: -90px; }
  .smoke-wisp:nth-child(11) { left: 5%;  --duration: 8s;  --delay: 6s;   --sway: 110px;  --peak-opacity: 0.95; --gust-duration: 6s;  --gust-delay: 1.5s; --gust-shift: 100px; }
  .smoke-wisp:nth-child(12) { left: 50%; --duration: 13s; --delay: 0.8s; --sway: -60px;  --peak-opacity: 0.85; --gust-duration: 10s; --gust-delay: 3s;   --gust-shift: -70px; }

  @keyframes smoke-rise {
    0% {
      transform: translateY(0) translateX(0) scale(0.8);
      opacity: 0;
    }
    10% {
      opacity: var(--peak-opacity, 0.8);
    }
    50% {
      transform: translateY(calc(-450px * var(--layout-scale, 1))) translateX(calc(var(--sway, 80px) * var(--layout-scale, 1))) scale(1.4);
      opacity: var(--peak-opacity, 0.8);
    }
    80% {
      opacity: 0.15;
    }
    100% {
      transform: translateY(calc(-850px * var(--layout-scale, 1))) translateX(calc(var(--sway, 80px) * var(--layout-scale, 1) * -0.3)) scale(2.0);
      opacity: 0;
    }
  }

  /* Wind gust — periodic lateral shove */
  @keyframes wind-gust {
    0%, 100% { margin-left: 0; }
    30% { margin-left: calc(var(--gust-shift, 80px) * var(--layout-scale, 1)); }
    60% { margin-left: calc(var(--gust-shift, 80px) * var(--layout-scale, 1) * -0.4); }
  }

  .smoke-foreground {
    z-index: 3;
  }

  .smoke-wisp-fg {
    width: calc(350px * var(--layout-scale, 1));
    height: calc(400px * var(--layout-scale, 1));
    filter: blur(calc(35px * var(--layout-scale, 1)));
    background: radial-gradient(ellipse at center, rgba(160, 165, 185, 0.15) 0%, rgba(140, 145, 170, 0.08) 35%, transparent 65%);
  }

  .smoke-wisp-fg:nth-child(1) { left: 15%; --duration: 8s;  --delay: 0.5s; --sway: 100px;  --peak-opacity: 0.5;  --gust-duration: 6s; --gust-delay: 1s;   --gust-shift: 70px; }
  .smoke-wisp-fg:nth-child(2) { left: 45%; --duration: 10s; --delay: 3s;   --sway: -120px; --peak-opacity: 0.4;  --gust-duration: 8s; --gust-delay: 3.5s; --gust-shift: -90px; }
  .smoke-wisp-fg:nth-child(3) { left: 65%; --duration: 9s;  --delay: 5.5s; --sway: 80px;   --peak-opacity: 0.45; --gust-duration: 7s; --gust-delay: 0s;   --gust-shift: 60px; }
  .smoke-wisp-fg:nth-child(4) { left: 85%; --duration: 11s; --delay: 1.5s; --sway: -90px;  --peak-opacity: 0.35; --gust-duration: 5s; --gust-delay: 2s;   --gust-shift: -80px; }

  @media (prefers-reduced-motion: reduce) {
    .panel { transition: none !important; }
    .shine-overlay { display: none; }
    .plx-layer { transition: none !important; }
    .smoke-wisp { animation: none !important; display: none; }
    .skylight::after { animation: none !important; }
  }
</style>

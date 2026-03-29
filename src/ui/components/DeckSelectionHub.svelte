<script lang="ts">
  import { onMount } from 'svelte';
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    onback: () => void;
    onSelectTrivia: () => void;
    onSelectStudy: () => void;
  }

  const { onback, onSelectTrivia, onSelectStudy }: Props = $props();

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
    <button class="panel panel--trivia" onclick={handleSelectTrivia}>
      <div class="panel-icon panel-icon--trivia">&#9876;</div>
      <div class="panel-title">TRIVIA DUNGEON</div>
      <div class="panel-subtitle panel-subtitle--trivia">The Armory</div>
      <div class="panel-divider panel-divider--trivia"></div>
      <div class="panel-tagline">
        Battle with knowledge.<br />Multi-domain combat.
      </div>
      <div class="panel-stats">4 knowledge domains · 3,500+ facts</div>
    </button>

    <!-- Right panel: Study Temple -->
    <button class="panel panel--study" onclick={handleSelectStudy}>
      <div class="panel-icon panel-icon--study">&#128218;</div>
      <div class="panel-title">STUDY TEMPLE</div>
      <div class="panel-subtitle panel-subtitle--study">The Library</div>
      <div class="panel-divider panel-divider--study"></div>
      <div class="panel-tagline">
        Master your decks.<br />Focused learning.
      </div>
      <div class="panel-stats">48 curated decks · 46,000+ facts</div>
    </button>
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
  }

  .panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(16px * var(--layout-scale, 1));
    width: 45%;
    max-width: calc(500px * var(--layout-scale, 1));
    height: calc(480px * var(--layout-scale, 1));
    border-radius: calc(16px * var(--layout-scale, 1));
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.25s ease;
    text-align: center;
    padding: calc(32px * var(--layout-scale, 1));
    /* Reset default button styles */
    font-family: inherit;
    outline: none;
  }

  .panel:active {
    transform: scale(0.98);
  }

  /* Trivia Dungeon panel */
  .panel--trivia {
    background: linear-gradient(160deg, #1a2332 0%, #1e293b 50%, #1a2332 100%);
    border: 1px solid rgba(245, 158, 11, 0.2);
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3), inset 0 calc(1px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.05);
  }

  .panel--trivia::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: calc(3px * var(--layout-scale, 1));
    background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.5), transparent);
  }

  .panel--trivia:hover {
    transform: translateY(calc(-4px * var(--layout-scale, 1)));
    border-color: rgba(245, 158, 11, 0.5);
    box-shadow:
      0 calc(12px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.2), inset 0 calc(1px * var(--layout-scale, 1)) calc(50px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.08);
  }

  .panel--trivia:active {
    transform: scale(0.98);
  }

  /* Study Temple panel */
  .panel--study {
    background: linear-gradient(160deg, #1a1035 0%, #1e1145 50%, #1a1035 100%);
    border: 1px solid rgba(99, 102, 241, 0.2);
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3), inset 0 calc(1px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.05);
  }

  .panel--study::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: calc(3px * var(--layout-scale, 1));
    background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent);
  }

  .panel--study:hover {
    transform: translateY(calc(-4px * var(--layout-scale, 1)));
    border-color: rgba(99, 102, 241, 0.5);
    box-shadow:
      0 calc(12px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.2), inset 0 calc(1px * var(--layout-scale, 1)) calc(50px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.08);
  }

  .panel--study:active {
    transform: scale(0.98);
  }

  /* Icons */
  .panel-icon {
    line-height: 1;
    font-size: calc(80px * var(--text-scale, 1));
  }

  .panel-icon--trivia {
    filter: drop-shadow(0 0 calc(12px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.4));
  }

  .panel-icon--study {
    filter: drop-shadow(0 0 calc(12px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.4));
  }

  /* Title */
  .panel-title {
    font-size: calc(24px * var(--text-scale, 1));
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #f5f5f5;
  }

  /* Subtitle */
  .panel-subtitle {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    font-style: italic;
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
    font-size: calc(11px * var(--text-scale, 1));
    color: #475569;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  /* Tagline */
  .panel-tagline {
    font-size: calc(13px * var(--text-scale, 1));
    color: #94a3b8;
    text-align: center;
    line-height: 1.5;
  }
</style>

<script lang="ts">
  import type { AgeRating } from '../../data/types'

  interface Props {
    onComplete: (ageRating: AgeRating) => void
  }

  const { onComplete }: Props = $props()

  function select(rating: AgeRating) {
    onComplete(rating)
  }
</script>

<div class="age-selection" role="region" aria-label="Age Selection">
  <div class="gaia-bubble">
    <div class="gaia-icon">G</div>
    <div class="speech-bubble">
      <p>One more thing — I want to calibrate my language processing. How old are you?</p>
      <p class="subtitle">(Honor system. I won't tell anyone.)</p>
    </div>
  </div>

  <div class="button-stack">
    <button class="age-btn kid" onclick={() => select('kid')}>
      <span class="age-label">KID</span>
      <span class="age-desc">Under 13</span>
    </button>
    <button class="age-btn teen" onclick={() => select('teen')}>
      <span class="age-label">TEEN</span>
      <span class="age-desc">13–17</span>
    </button>
    <button class="age-btn adult" onclick={() => select('adult')}>
      <span class="age-label">ADULT</span>
      <span class="age-desc">18+</span>
    </button>
  </div>
</div>

<style>
  .age-selection {
    position: fixed;
    inset: 0;
    background: #0a0a12;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: 100;
    gap: 2rem;
    pointer-events: auto;
  }

  .gaia-bubble {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    max-width: 420px;
    width: 100%;
  }

  .gaia-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0ff, #08f);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    font-weight: bold;
    color: #000;
    font-family: monospace;
    flex-shrink: 0;
  }

  .speech-bubble {
    background: rgba(0, 200, 255, 0.08);
    border: 1px solid rgba(0, 200, 255, 0.2);
    border-radius: 12px;
    padding: 0.75rem 1rem;
  }

  .speech-bubble p {
    color: #d0e8f0;
    font-family: monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }

  .subtitle {
    color: #888 !important;
    font-size: 0.8rem !important;
    margin-top: 0.25rem !important;
  }

  .button-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 420px;
    width: 100%;
  }

  .age-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 80px;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    font-family: monospace;
    border: 1px solid #333;
    background: rgba(30, 30, 50, 0.8);
    transition: all 0.15s ease;
  }

  .age-btn:active {
    transform: scale(0.97);
  }

  .age-btn:hover {
    border-color: #0af;
    background: rgba(0, 100, 200, 0.15);
  }

  .age-label {
    font-size: 1.3rem;
    font-weight: bold;
    color: #fff;
    letter-spacing: 0.1em;
  }

  .age-desc {
    font-size: 0.9rem;
    color: #aaa;
  }

  .kid .age-label { color: #8fdf80; }
  .teen .age-label { color: #80c8ff; }
  .adult .age-label { color: #ffa080; }
</style>

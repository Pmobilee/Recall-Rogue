<script lang="ts">
  interface Props {
    imageSrc: string
    caption: string
    onAdvance: () => void
    onSkip: () => void
  }

  const { imageSrc, caption, onAdvance, onSkip }: Props = $props()
</script>

<div class="panel" onclick={onAdvance} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && onAdvance()}>
  <img src={imageSrc} alt="" class="panel-image" />
  <p class="caption">{caption}</p>
  <button class="skip-btn" onclick={(e) => { e.stopPropagation(); onSkip() }}>Skip</button>
</div>

<style>
  .panel {
    position: fixed;
    inset: 0;
    background: #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    z-index: 100;
    pointer-events: auto;
  }
  .panel-image {
    max-width: 90%;
    max-height: 60vh;
    image-rendering: pixelated;
    border-radius: 4px;
  }
  .caption {
    color: #e8d8b0;
    font-size: 1rem;
    text-align: center;
    max-width: 480px;
    padding: 1rem 1.5rem;
    font-family: monospace;
    font-style: italic;
    line-height: 1.5;
  }
  .skip-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid #555;
    color: #aaa;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    min-width: 44px;
    min-height: 44px;
    font-family: monospace;
  }
  .skip-btn:hover {
    background: rgba(60, 60, 60, 0.8);
    color: #ddd;
  }
</style>

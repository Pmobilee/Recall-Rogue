<script lang="ts">
  import type { CavernText } from '../../data/cavernTexts'

  interface Props {
    entry: CavernText
    onClose: () => void
  }

  let { entry, onClose }: Props = $props()
</script>

<div class="cavern-text-modal" role="dialog" aria-label="Cavern Text">
  <div class="backdrop" onclick={onClose}></div>
  <div class="parchment">
    <div class="text-type-label">{entry.textType.toUpperCase()}</div>
    <h3>{entry.title}</h3>
    <p class="content">{entry.content}</p>
    <button class="btn-close" type="button" onclick={onClose}>Close</button>
  </div>
</div>

<style>
  .cavern-text-modal {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    animation: fade-in 200ms ease-out;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
  }

  .parchment {
    position: relative;
    max-width: 340px;
    width: 90%;
    background: linear-gradient(145deg, #2a2218, #1a1510);
    border: 1px solid rgba(180, 150, 100, 0.35);
    border-radius: 12px;
    padding: 24px 20px;
    text-align: center;
    color: #d4c4a0;
  }

  .text-type-label {
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 2px;
    color: #a08860;
    background: rgba(160, 136, 96, 0.12);
    border: 1px solid rgba(160, 136, 96, 0.25);
    border-radius: 4px;
    padding: 2px 10px;
    margin-bottom: 12px;
    font-family: 'Courier New', monospace;
  }

  h3 {
    font-size: 1rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #e8d8b8;
    margin: 0 0 14px;
    line-height: 1.3;
  }

  .content {
    font-size: 0.85rem;
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1.6;
    color: #c4b490;
    text-align: left;
    margin: 0 0 20px;
  }

  .btn-close {
    width: 100%;
    min-height: 44px;
    border: 1px solid rgba(180, 150, 100, 0.3);
    border-radius: 10px;
    background: rgba(180, 150, 100, 0.1);
    color: #d4c4a0;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-close:active {
    transform: scale(0.97);
    background: rgba(180, 150, 100, 0.2);
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>

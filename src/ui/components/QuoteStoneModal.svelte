<script lang="ts">
  import type { QuoteStoneEntry } from '../../data/quoteStones'

  interface Props {
    entry: QuoteStoneEntry
    onClose: () => void
  }

  let { entry, onClose }: Props = $props()
</script>

<div class="quote-stone-modal" role="dialog" aria-label="Quote Stone">
  <div class="backdrop" onclick={onClose}></div>
  <div class="modal-content">
    <div class="category-badge">{entry.category.toUpperCase()}</div>
    <blockquote>"{entry.quote}"</blockquote>
    <cite>— {entry.author}</cite>
    <div class="gaia-reaction">
      <span class="gaia-icon">🌳</span>
      <p><strong>GAIA:</strong> "{entry.gaiaComment}"</p>
    </div>
    <button class="btn-continue" type="button" onclick={onClose}>Continue Mining</button>
  </div>
</div>

<style>
  .quote-stone-modal {
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

  .modal-content {
    position: relative;
    max-width: 340px;
    width: 90%;
    background: linear-gradient(145deg, #1a2a3a, #0d1b2a);
    border: 1px solid rgba(119, 136, 170, 0.4);
    border-radius: 16px;
    padding: 24px 20px;
    text-align: center;
    font-family: 'Courier New', monospace;
    color: #c8d8e8;
  }

  .category-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 2px;
    color: #7788aa;
    background: rgba(119, 136, 170, 0.15);
    border: 1px solid rgba(119, 136, 170, 0.3);
    border-radius: 4px;
    padding: 2px 10px;
    margin-bottom: 16px;
  }

  blockquote {
    font-size: 0.95rem;
    line-height: 1.5;
    color: #e8f0ff;
    margin: 0 0 12px;
    font-style: italic;
  }

  cite {
    display: block;
    font-size: 0.78rem;
    color: #8899aa;
    margin-bottom: 20px;
    font-style: normal;
  }

  .gaia-reaction {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    text-align: left;
    background: rgba(78, 204, 163, 0.08);
    border: 1px solid rgba(78, 204, 163, 0.2);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 20px;
  }

  .gaia-icon {
    font-size: 1.4rem;
    flex-shrink: 0;
  }

  .gaia-reaction p {
    font-size: 0.8rem;
    line-height: 1.4;
    color: #a8d8c8;
    margin: 0;
  }

  .btn-continue {
    width: 100%;
    min-height: 48px;
    border: 1px solid rgba(119, 136, 170, 0.4);
    border-radius: 12px;
    background: rgba(119, 136, 170, 0.12);
    color: #c8d8e8;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.5px;
  }

  .btn-continue:active {
    transform: scale(0.97);
    background: rgba(119, 136, 170, 0.25);
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>

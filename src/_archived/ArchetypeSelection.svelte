<script lang="ts">
  import type { RewardArchetype } from '../../services/runManager'
  import { getArchetypeIconPath } from '../utils/iconAssets'

  interface Props {
    onselect: (archetype: RewardArchetype) => void
    onskip: () => void
    onback?: () => void
  }

  let { onselect, onskip, onback }: Props = $props()

  const OPTIONS: Array<{ id: RewardArchetype; icon: string; title: string; desc: string }> = [
    { id: 'balanced', icon: '⚖️', title: 'Balanced', desc: 'Even spread across all core card types.' },
    { id: 'aggressive', icon: '⚔️', title: 'Aggressive', desc: 'More Attack and Buff options.' },
    { id: 'defensive', icon: '🛡️', title: 'Defensive', desc: 'More Shield, Heal, and sustain options.' },
    { id: 'control', icon: '🧠', title: 'Control', desc: 'More Debuff and Utility options.' },
    { id: 'hybrid', icon: '🧩', title: 'Hybrid', desc: 'Flexible mix for adaptive play.' },
  ]
</script>

<section class="archetype-overlay" aria-label="Archetype selection">
  {#if onback}
    <button class="back-btn" type="button" onclick={onback}>&larr; Back</button>
  {/if}
  <h1>Choose Your Playstyle</h1>
  <p>Your archetype biases reward type options for this run.</p>

  <div class="option-list">
    {#each OPTIONS as option (option.id)}
      <button type="button" class="option" onclick={() => onselect(option.id)} data-testid={`archetype-${option.id}`}>
        <img class="arch-icon-img" src={getArchetypeIconPath(option.id)} alt=""
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; (img.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'inline'); }} />
        <span class="arch-icon-fallback" style="display:none">{option.icon}</span>
        <span class="title">{option.title}</span>
        <span class="desc">{option.desc}</span>
      </button>
    {/each}
  </div>

  <button type="button" class="skip" onclick={onskip}>Skip (Balanced)</button>
</section>

<style>
  .archetype-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(180deg, #0c1320 0%, #131e31 100%);
    color: #e6edf3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: calc(20px + var(--safe-top)) 16px 32px;
    overflow-y: auto;
    z-index: 210;
  }

  h1 {
    margin: 6px 0 0;
    font-size: 24px;
    color: #f1c40f;
    letter-spacing: 0.6px;
  }

  p {
    margin: 0 0 4px;
    color: #a6b4c2;
    text-align: center;
    max-width: 520px;
  }

  .option-list {
    width: 100%;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .option {
    min-height: 72px;
    border-radius: 12px;
    border: 1px solid #314357;
    background: rgba(16, 26, 38, 0.84);
    color: inherit;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "icon title"
      "icon desc";
    gap: 2px 10px;
    align-items: center;
    text-align: left;
    padding: 10px 12px;
  }

  .arch-icon-img {
    grid-area: icon;
    width: 2em;
    height: 2em;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .arch-icon-fallback {
    grid-area: icon;
    font-size: 2em;
    line-height: 1;
  }

  .title {
    grid-area: title;
    font-weight: 800;
    font-size: 15px;
  }

  .desc {
    grid-area: desc;
    color: #bac7d3;
    font-size: 12px;
    line-height: 1.3;
  }

  .back-btn {
    position: absolute;
    top: 16px;
    left: 16px;
    background: none;
    border: none;
    color: #8b949e;
    font-size: 16px;
    cursor: pointer;
    padding: 8px;
    min-height: 44px;
  }

  .skip {
    margin-top: 8px;
    min-width: 220px;
    min-height: 48px;
    border-radius: 10px;
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #e5e7eb;
    padding: 0 12px;
    font-weight: 700;
  }
</style>

<script lang="ts">
  import { playerSave } from '../../stores/playerData'
  import { audioManager } from '../../../services/audioService'
  import MineralConverter from '../MineralConverter.svelte'

  interface Props {
    onMaterializer?: () => void
    onPremiumMaterializer?: () => void
  }

  let { onMaterializer, onPremiumMaterializer }: Props = $props()

  const dust = $derived($playerSave?.minerals.dust ?? 0)
  const shard = $derived($playerSave?.minerals.shard ?? 0)
  const crystal = $derived($playerSave?.minerals.crystal ?? 0)
  const geode = $derived($playerSave?.minerals.geode ?? 0)

  let showConverter = $state(false)

  function handleMaterializer(): void {
    audioManager.playSound('button_click')
    onMaterializer?.()
  }

  function handlePremiumMaterializer(): void {
    audioManager.playSound('button_click')
    onPremiumMaterializer?.()
  }

  function handleOpenConverter(): void {
    audioManager.playSound('button_click')
    showConverter = true
  }
</script>

<!-- ========== WORKSHOP ========== -->
<div class="card room-header-card">
  <div class="room-header-info">
    <span class="room-header-icon" aria-hidden="true">⚒️</span>
    <div>
      <h2 class="room-header-title">Workshop</h2>
      <p class="room-header-desc">Craft equipment and convert minerals</p>
    </div>
  </div>
</div>

<div class="card resources-card" aria-label="Mineral resources">
  <div class="resource-item">
    <span class="resource-dot dust-dot" aria-hidden="true"></span>
    <span class="resource-label">Dust</span>
    <span class="resource-value">{dust}</span>
  </div>
  <div class="resource-item">
    <span class="resource-dot shard-dot" aria-hidden="true"></span>
    <span class="resource-label">Shard</span>
    <span class="resource-value">{shard}</span>
  </div>
  <div class="resource-item">
    <span class="resource-dot crystal-dot" aria-hidden="true"></span>
    <span class="resource-label">Crystal</span>
    <span class="resource-value">{crystal}</span>
  </div>
  <div class="resource-item">
    <span class="resource-dot geode-dot" aria-hidden="true"></span>
    <span class="resource-label">Geode</span>
    <span class="resource-value">{geode}</span>
  </div>
</div>

<div class="card actions-card" aria-label="Workshop actions">
  <button class="action-button materializer-button" type="button" onclick={handleMaterializer}>
    <span>Materializer</span>
    <span class="action-arrow" aria-hidden="true">&#8594;</span>
  </button>

  <button class="action-button convert-btn" type="button" onclick={handleOpenConverter}>
    <span>Convert Minerals</span>
    <span class="action-arrow" aria-hidden="true">&#8594;</span>
  </button>
</div>

<div class="card workshop-info-card" aria-label="Workshop tip">
  <p class="workshop-tip">Craft permanent upgrades and consumables in the Materializer. Convert lower-tier minerals to higher tiers using a 110:1 ratio.</p>
</div>

{#if showConverter}
  <MineralConverter onClose={() => { showConverter = false }} />
{/if}

<style>
  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
  }

  h2 {
    color: var(--color-text);
    font-size: 1rem;
    margin: 0 0 10px;
  }

  .room-header-card {
    margin: 8px 8px 4px;
    padding: 12px 16px;
  }

  .room-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .room-header-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .room-header-title {
    color: var(--color-warning);
    font-size: 1.1rem;
    margin: 0 0 2px;
  }

  .room-header-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    margin: 0;
    line-height: 1.3;
  }

  .resources-card {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .resource-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    background: color-mix(in srgb, var(--color-bg) 35%, var(--color-surface) 65%);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .resource-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dust-dot { background: #4ecca3; }
  .shard-dot { background: #ffd369; }
  .crystal-dot { background: #e94560; }
  .geode-dot { background: #9b59b6; }

  .resource-label {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  .resource-value {
    margin-left: auto;
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 700;
  }

  .actions-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-button {
    min-height: 56px;
    border: 0;
    border-radius: 12px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    cursor: pointer;
  }

  .action-button:active {
    transform: translateY(1px);
  }

  .materializer-button {
    background: color-mix(in srgb, #a78bfa 28%, var(--color-surface) 72%);
  }

  .action-arrow {
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.1rem;
  }

  .convert-btn {
    background: color-mix(in srgb, var(--color-warning) 24%, var(--color-surface) 76%);
    color: var(--color-warning);
  }

  .workshop-info-card {
    border-left: 3px solid #a78bfa;
    background: color-mix(in srgb, #a78bfa 8%, var(--color-surface) 92%);
    margin-bottom: 20px;
  }

  .workshop-tip {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .resources-card {
      grid-template-columns: 1fr;
    }

    .action-button {
      font-size: 1rem;
    }
  }
</style>

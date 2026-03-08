<script lang="ts">
  /**
   * MinePreviewThumbnail.svelte
   * Displays a pre-generated mine preview thumbnail on the dive confirmation screen.
   * Props:
   *   - dataUrl: string — result of minePreviewDataUrl()
   *   - biomeLabel: string — display name of the biome
   *   - layer: number — 1-based layer number
   */

  interface Props {
    dataUrl?: string
    biomeLabel?: string
    layer?: number
  }

  const { dataUrl = '', biomeLabel = 'Unknown Biome', layer = 1 }: Props = $props()
</script>

<div class="mine-preview">
  {#if dataUrl}
    <img
      src={dataUrl}
      alt="Mine preview layer {layer}"
      class="preview-img"
      style="image-rendering: pixelated;"
    />
  {:else}
    <div class="preview-placeholder">Generating...</div>
  {/if}
  <div class="preview-label">
    <span class="layer-badge">L{layer}</span>
    <span class="biome-name">{biomeLabel}</span>
  </div>
</div>

<style>
  .mine-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .preview-img {
    width: 160px;
    height: 120px;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
  }
  .preview-placeholder {
    width: 160px;
    height: 120px;
    background: #1a1a2e;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    font-size: 12px;
  }
  .preview-label {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 11px;
  }
  .layer-badge {
    background: rgba(255,255,255,0.15);
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: bold;
  }
  .biome-name {
    color: #aaa;
  }
</style>

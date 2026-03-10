<script lang="ts">
  import { renderShareCard, shareOrDownloadCard, type ShareCardTemplate } from '../../services/shareCardService'
  import { playerSave } from '../stores/playerData'
  import { analyticsService } from '../../services/analyticsService'
  import type { ReviewState } from '../../data/types'

  interface Props {
    template: ShareCardTemplate
    primaryMetric: number
    secondaryLabel?: string
    onClose: () => void
  }

  let { template, primaryMetric, secondaryLabel, onClose }: Props = $props()

  let previewUrl = $state<string | null>(null)
  let rendering  = $state(false)
  let sharing    = $state(false)
  let errorMsg   = $state('')

  const save = $derived($playerSave)

  async function buildPreview(): Promise<void> {
    rendering = true
    errorMsg  = ''
    try {
      const s = save
      const result = await renderShareCard({
        template,
        primaryMetric,
        secondaryLabel,
        displayName:       getDisplayName(s),
        treeCompletionPct: computeTreePct(s),
        isPatron:          !!(s?.patronTier),
      })
      previewUrl = result.dataUrl
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Failed to render card'
    } finally {
      rendering = false
    }
  }

  async function doShare(): Promise<void> {
    if (!previewUrl) return
    sharing = true
    const s = save
    const result = await renderShareCard({
      template,
      primaryMetric,
      secondaryLabel,
      displayName:       getDisplayName(s),
      treeCompletionPct: computeTreePct(s),
      isPatron:          !!(s?.patronTier),
    })

    // Analytics: determine platform
    const platform = (typeof (navigator as { share?: unknown }).share === 'function') ? 'web_share' : 'download'
    const masteredCount = s?.reviewStates
      ? (s.reviewStates as ReviewState[]).filter(r => r.interval >= 60).length
      : 0
    analyticsService.track({
      name: 'share_card_generated',
      properties: {
        template,
        platform,
        facts_mastered: masteredCount,
        tree_completion_pct: computeTreePct(s),
      },
    })

    await shareOrDownloadCard(result)
    sharing = false
    onClose()
  }

  function getDisplayName(s: typeof save): string {
    if (!s) return 'Explorer'
    // PlayerSave doesn't store displayName directly; use playerId prefix as fallback
    return `Explorer-${(s.playerId ?? 'unknown').slice(0, 6)}`
  }

  function computeTreePct(s: typeof save): number {
    if (!s?.reviewStates) return 0
    const mastered = (s.reviewStates as ReviewState[]).filter(r => r.interval >= 60).length
    const total = s.learnedFacts?.length || 522
    return Math.min(100, Math.round((mastered / Math.max(1, total)) * 100))
  }

  // Render preview on mount
  $effect(() => { void buildPreview() })
</script>

<div class="share-card-modal" role="dialog" aria-label="Share card preview">
  <div class="modal-content">
    <button class="close-btn" onclick={onClose} aria-label="Close">✕</button>
    <h2>Share Your Progress</h2>

    {#if rendering}
      <div class="preview-placeholder" aria-busy="true">Rendering card…</div>
    {:else if errorMsg}
      <p class="error-msg">{errorMsg}</p>
    {:else if previewUrl}
      <img
        class="card-preview"
        src={previewUrl}
        alt="Share card preview showing your Recall Rogue progress"
      />
    {/if}

    <div class="action-row">
      <button
        class="btn-primary"
        onclick={doShare}
        disabled={sharing || rendering || !previewUrl}
        data-testid="share-card-share-btn"
      >
        {sharing ? 'Sharing…' : 'Share / Save'}
      </button>
      <button class="btn-secondary" onclick={onClose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .share-card-modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
    pointer-events: auto;
  }
  .modal-content {
    background: #0D1B2A;
    border: 1px solid #00CCFF;
    border-radius: 12px;
    padding: 24px;
    max-width: 660px;
    width: 95%;
    display: flex; flex-direction: column; gap: 16px;
  }
  .close-btn {
    align-self: flex-end;
    background: none; border: none;
    color: #8AA8CC; font-size: 20px; cursor: pointer;
  }
  h2 { color: #F0F4FF; margin: 0; font-size: 20px; }
  .preview-placeholder {
    height: 200px; background: #1A3A5C;
    display: flex; align-items: center; justify-content: center;
    color: #8AA8CC; border-radius: 8px;
  }
  .card-preview {
    width: 100%; border-radius: 8px;
    border: 1px solid #1E3A5C;
  }
  .action-row { display: flex; gap: 12px; justify-content: flex-end; }
  .btn-primary {
    background: #00CCFF; color: #0D1B2A;
    border: none; padding: 10px 24px; border-radius: 8px;
    font-weight: bold; cursor: pointer;
  }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
  .btn-secondary {
    background: transparent; color: #8AA8CC;
    border: 1px solid #1E3A5C; padding: 10px 20px; border-radius: 8px;
    cursor: pointer;
  }
  .error-msg { color: #FF6B6B; }
</style>

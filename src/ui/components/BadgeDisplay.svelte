<script lang="ts">
  import { BADGE_DEFINITIONS, type EarnedBadge, getBadgeShareUrl } from '../../services/badgeService'
  import { analyticsService } from '../../services/analyticsService'
  import { playerSave } from '../stores/playerData'

  interface Props {
    earnedBadges?: EarnedBadge[]
  }

  let { earnedBadges = [] }: Props = $props()

  const save = $derived($playerSave)

  const earnedSet = $derived(new Set(earnedBadges.map(b => b.id)))

  /**
   * Share a badge via clipboard or native share.
   * Fires a `badge_shared` analytics event.
   */
  async function shareBadge(badgeId: string): Promise<void> {
    const playerId = save?.playerId ?? 'unknown'
    const url = getBadgeShareUrl(playerId, badgeId)

    let shareMethod: 'clipboard' | 'native_share' | 'direct_link' = 'clipboard'

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Terra Gacha Badge', url })
        shareMethod = 'native_share'
      } catch {
        // Dismissed or unavailable — fall through to clipboard
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        shareMethod = 'clipboard'
      } catch {
        shareMethod = 'direct_link'
      }
    }

    analyticsService.track({
      name: 'badge_shared',
      properties: { badge_id: badgeId, share_method: shareMethod },
    })
  }

  function getEarnedDate(badgeId: string): string | null {
    const badge = earnedBadges.find(b => b.id === badgeId)
    if (!badge) return null
    return new Date(badge.earnedAt).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }
</script>

<div class="badge-display" aria-label="Achievement badges">
  <h3 class="badge-title">Badges</h3>
  <div class="badge-grid" role="list">
    {#each BADGE_DEFINITIONS as def}
      {@const isEarned = earnedSet.has(def.id)}
      {@const earnedDate = getEarnedDate(def.id)}
      <div
        class="badge-slot"
        class:earned={isEarned}
        class:locked={!isEarned}
        role="listitem"
        aria-label="{def.label}: {isEarned ? 'earned' : 'not yet earned'}"
      >
        <div class="badge-icon-wrap" aria-hidden="true">
          {#if isEarned}
            <svg class="badge-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={def.iconSvgPath} />
            </svg>
          {:else}
            <svg class="badge-icon lock-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          {/if}
        </div>
        <div class="badge-info">
          <span class="badge-label">{def.label}</span>
          <span class="badge-desc">{def.description}</span>
          {#if isEarned && earnedDate}
            <span class="badge-date">Earned {earnedDate}</span>
          {/if}
        </div>
        {#if isEarned}
          <button
            class="share-btn"
            onclick={() => shareBadge(def.id)}
            aria-label="Share {def.label} badge"
            type="button"
          >
            Share
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .badge-display {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .badge-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 0;
  }

  .badge-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .badge-slot {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid;
    transition: background 0.12s;
  }

  .badge-slot.earned {
    background: #0a1f0a;
    border-color: #00CCFF44;
  }

  .badge-slot.locked {
    background: #0f172a;
    border-color: #33415544;
    opacity: 0.6;
  }

  .badge-icon-wrap {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .earned .badge-icon-wrap {
    background: #00CCFF22;
    color: #00CCFF;
  }

  .locked .badge-icon-wrap {
    background: #334155;
    color: #64748b;
  }

  .badge-icon {
    width: 22px;
    height: 22px;
  }

  .badge-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .badge-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  .locked .badge-label {
    color: #64748b;
  }

  .badge-desc {
    font-size: 0.7rem;
    color: #64748b;
  }

  .badge-date {
    font-size: 0.65rem;
    color: #00CCFF99;
  }

  .share-btn {
    background: transparent;
    border: 1px solid #00CCFF44;
    border-radius: 6px;
    color: #00CCFF;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 4px 10px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s;
  }

  .share-btn:hover {
    background: #00CCFF22;
  }
</style>

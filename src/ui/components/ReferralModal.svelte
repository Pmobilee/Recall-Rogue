<script lang="ts">
  import type { ReferralRecord } from '../../data/types'
  // REFERRAL_REWARD_TIERS and REFERRAL_MAX_PER_YEAR removed from balance.ts (mining era)
  const REFERRAL_REWARD_TIERS: { threshold: number; rewardType: string; rewardKey: string; label: string }[] = [
    { threshold: 1,  rewardType: 'cosmetic_frame',   rewardKey: 'frame_explorer_invite', label: 'Explorer Frame' },
    { threshold: 3,  rewardType: 'companion_skin',   rewardKey: 'skin_miner_envoy',      label: 'Envoy Miner Skin' },
    { threshold: 5,  rewardType: 'nameplate',        rewardKey: 'nameplate_connector',   label: 'Connector Nameplate' },
    { threshold: 10, rewardType: 'nameplate',        rewardKey: 'nameplate_legend',      label: 'Legend Nameplate' },
  ]
  import { analyticsService } from '../../services/analyticsService'
  import { referralService } from '../../services/referralService'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  /** Use the balance constant so the cap stays in sync automatically. */
  const MAX_REFERRALS_PER_YEAR = 10 // was REFERRAL_MAX_PER_YEAR

  let referralCode = $state<string | null>(null)
  let referralHistory = $state<ReferralRecord[]>([])
  let loading = $state(false)
  let copyFeedback = $state(false)
  let errorMessage = $state('')

  const referralLink = $derived(
    referralCode ? `https://terragacha.com/invite/${referralCode}` : ''
  )

  const usedCount = $derived(referralHistory.length)

  /**
   * The next reward tier the player is working toward, or null if all tiers
   * have been reached.
   */
  const nextTier = $derived(
    REFERRAL_REWARD_TIERS.find(t => t.threshold > usedCount) ?? null
  )

  /**
   * Progress percentage (0–100) toward the next tier threshold.
   * When all tiers are completed, this is 100.
   */
  const tierProgressPct = $derived((): number => {
    if (!nextTier) return 100
    const prevThreshold = REFERRAL_REWARD_TIERS
      .slice()
      .reverse()
      .find(t => t.threshold <= usedCount)?.threshold ?? 0
    const span = nextTier.threshold - prevThreshold
    const done = usedCount - prevThreshold
    return Math.min(100, Math.round((done / span) * 100))
  })

  async function loadReferralData(): Promise<void> {
    loading = true
    errorMessage = ''
    try {
      const [codeData, historyData] = await Promise.all([
        referralService.getMyCode(),
        referralService.getMyHistory(),
      ])

      referralCode = codeData.code
      referralHistory = historyData.history ?? []
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to load referral data'
    } finally {
      loading = false
    }
  }

  async function copyLink(): Promise<void> {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      copyFeedback = true
      setTimeout(() => { copyFeedback = false }, 2000)
      analyticsService.track({
        name: 'referral_link_shared',
        properties: {
          channel: 'copy',
          qualified_referrals_so_far: usedCount,
          current_tier_threshold: nextTier?.threshold ?? MAX_REFERRALS_PER_YEAR,
        },
      })
    } catch {
      // Fallback: select the input text
      const input = document.getElementById('referral-link-input') as HTMLInputElement | null
      input?.select()
    }
  }

  async function shareLink(): Promise<void> {
    if (!referralLink) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Recall Rogue!',
          text: 'Mine for knowledge with me on Recall Rogue. You and I both get a fossil egg!',
          url: referralLink,
        })
        analyticsService.track({
          name: 'referral_link_shared',
          properties: {
            channel: 'native_share',
            qualified_referrals_so_far: usedCount,
            current_tier_threshold: nextTier?.threshold ?? MAX_REFERRALS_PER_YEAR,
          },
        })
      } catch {
        // User cancelled or share failed — fall back to copy
        await copyLink()
      }
    } else {
      await copyLink()
    }
  }

  function statusLabel(status: ReferralRecord['status']): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      dive_reward_sent: 'Dive Reward',
      streak_reward_sent: 'Streak Reward',
      completed: 'Complete',
      flagged: 'Flagged',
    }
    return labels[status] ?? status
  }

  function statusColor(status: ReferralRecord['status']): string {
    if (status === 'completed') return '#4ade80'
    if (status === 'dive_reward_sent' || status === 'streak_reward_sent') return '#60a5fa'
    if (status === 'flagged') return '#f87171'
    return '#94a3b8'
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  $effect(() => {
    loadReferralData()
  })
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Referral"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
>
  <div class="modal" role="document">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">Refer a Friend</h2>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close">✕</button>
    </div>

    <div class="modal-body">
      {#if errorMessage}
        <div class="error-banner" role="alert">{errorMessage}</div>
      {/if}

      {#if loading}
        <div class="state-msg" role="status" aria-live="polite">Loading referral code...</div>
      {:else}
        <!-- Benefit description -->
        <div class="benefit-card" aria-label="Referral rewards">
          <span class="benefit-icon" aria-hidden="true">🥚</span>
          <div class="benefit-text">
            <strong>You and your friend each receive a fossil egg!</strong>
            <p>When your friend signs up and completes their first dive.</p>
          </div>
        </div>

        <div class="bonus-card" aria-label="Bonus reward">
          <span class="bonus-icon" aria-hidden="true">💎</span>
          <p class="bonus-text">
            <strong>Bonus:</strong> If your friend builds a <strong>7-day streak</strong>, you both earn bonus dust!
          </p>
        </div>

        <!-- Referral link -->
        <div class="link-section" aria-label="Your referral link">
          <div class="link-row">
            <input
              id="referral-link-input"
              class="link-input"
              type="text"
              readonly
              value={referralLink}
              aria-label="Your referral link"
              aria-readonly="true"
            />
            <button
              class="btn-copy"
              class:btn-copied={copyFeedback}
              type="button"
              onclick={copyLink}
              aria-label={copyFeedback ? 'Copied to clipboard' : 'Copy referral link'}
              aria-live="polite"
            >
              {copyFeedback ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <button
            class="btn-share"
            type="button"
            onclick={shareLink}
            aria-label="Share referral link"
          >
            Share Link
          </button>
        </div>

        <!-- Usage counter -->
        <div class="counter-row" aria-label="Referrals used this year">
          <span class="counter-label">Referrals used this year:</span>
          <span class="counter-value" aria-label="{usedCount} of {MAX_REFERRALS_PER_YEAR}">
            {usedCount} / {MAX_REFERRALS_PER_YEAR}
          </span>
        </div>

        <!-- Tier progress bar -->
        <div class="tier-progress-section" aria-label="Referral reward progress">
          <div class="tier-progress-header">
            <span class="tier-progress-label">Reward Progress</span>
            {#if nextTier}
              <span class="tier-next-label">Next: {nextTier.label} at {nextTier.threshold}</span>
            {:else}
              <span class="tier-next-label tier-complete">All rewards unlocked!</span>
            {/if}
          </div>
          <div class="tier-bar-track" role="progressbar" aria-valuenow={usedCount} aria-valuemin={0} aria-valuemax={nextTier?.threshold ?? MAX_REFERRALS_PER_YEAR} aria-label="Referral tier progress">
            <div class="tier-bar-fill" style="width: {tierProgressPct()}%"></div>
          </div>
          <div class="tier-milestones" aria-hidden="true">
            {#each REFERRAL_REWARD_TIERS as tier}
              <div
                class="tier-milestone"
                class:tier-milestone-reached={usedCount >= tier.threshold}
                style="left: {Math.round((tier.threshold / MAX_REFERRALS_PER_YEAR) * 100)}%"
                title="{tier.label} (at {tier.threshold} referrals)"
              >
                <span class="tier-dot"></span>
                <span class="tier-dot-label">{tier.threshold}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- History -->
        <div class="history-section" aria-label="Referral history">
          <h3 class="history-title">Referral History</h3>
          {#if referralHistory.length === 0}
            <div class="state-msg">No referrals sent yet. Share your link to get started!</div>
          {:else}
            <div class="history-list" aria-label="List of referrals sent">
              {#each referralHistory as record}
                <div
                  class="history-row"
                  aria-label="{record.inviteeName}: {statusLabel(record.status)}, sent {formatDate(record.createdAt)}"
                >
                  <div class="history-info">
                    <span class="invitee-name">{record.inviteeName}</span>
                    <span class="invite-date">{formatDate(record.createdAt)}</span>
                  </div>
                  <span
                    class="status-badge"
                    style="background: {statusColor(record.status)}22; color: {statusColor(record.status)}; border-color: {statusColor(record.status)}66;"
                  >{statusLabel(record.status)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
    pointer-events: auto;
    padding: 16px;
  }

  .modal {
    background: #16213e;
    border: 2px solid #f59e0b;
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #f59e0b44;
    background: #1a1a2e;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f59e0b;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: 0;
    color: #94a3b8;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: color 0.12s;
  }

  .close-btn:hover { color: #e2e8f0; }
  .close-btn:active { transform: translateY(1px); }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .error-banner {
    background: #7f1d1d;
    border: 1px solid #ef4444;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.78rem;
    padding: 8px 12px;
  }

  /* Benefit card */
  .benefit-card {
    background: #0d2718;
    border: 1px solid #16a34a66;
    border-radius: 10px;
    padding: 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .benefit-icon { font-size: 1.6rem; flex-shrink: 0; }

  .benefit-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.82rem;
    color: #e2e8f0;
  }

  .benefit-text strong { color: #4ade80; }

  .benefit-text p {
    margin: 0;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  /* Bonus card */
  .bonus-card {
    background: #0f172a;
    border: 1px solid #7c3aed66;
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .bonus-icon { font-size: 1.1rem; flex-shrink: 0; }

  .bonus-text {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.5;
  }

  .bonus-text strong { color: #a78bfa; }

  /* Link section */
  .link-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .link-row {
    display: flex;
    gap: 6px;
  }

  .link-input {
    flex: 1;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #94a3b8;
    font-family: monospace;
    font-size: 0.7rem;
    padding: 9px 10px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .link-input:focus { outline: 2px solid #f59e0b; outline-offset: -2px; }

  .btn-copy {
    background: #334155;
    border: 1px solid #475569;
    border-radius: 8px;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 9px 14px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
  }

  .btn-copy:hover { background: #475569; }
  .btn-copy:active { transform: translateY(1px); }

  .btn-copied {
    background: #14532d;
    border-color: #4ade8066;
    color: #4ade80;
  }

  .btn-share {
    background: #f59e0b;
    border: 0;
    border-radius: 10px;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 700;
    padding: 11px;
    cursor: pointer;
    letter-spacing: 1px;
    text-transform: uppercase;
    transition: background 0.12s;
  }

  .btn-share:hover { background: #fbbf24; }
  .btn-share:active { transform: translateY(1px); }

  /* Counter */
  .counter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 10px 12px;
  }

  .counter-label {
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .counter-value {
    font-size: 0.82rem;
    font-weight: 700;
    color: #f59e0b;
  }

  /* History */
  .history-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .history-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 0;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 9px 12px;
  }

  .history-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .invitee-name {
    font-size: 0.82rem;
    color: #e2e8f0;
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .invite-date {
    font-size: 0.65rem;
    color: #64748b;
  }

  .status-badge {
    border-radius: 999px;
    border: 1px solid;
    padding: 3px 9px;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  .state-msg {
    text-align: center;
    color: #64748b;
    font-size: 0.82rem;
    padding: 16px 0;
  }

  /* Tier progress bar */
  .tier-progress-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tier-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .tier-progress-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .tier-next-label {
    font-size: 0.68rem;
    color: #f59e0b;
  }

  .tier-next-label.tier-complete {
    color: #4ade80;
  }

  .tier-bar-track {
    width: 100%;
    height: 8px;
    background: #0f172a;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid #334155;
    position: relative;
  }

  .tier-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .tier-milestones {
    position: relative;
    height: 20px;
    margin-top: 2px;
  }

  .tier-milestone {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .tier-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #334155;
    border: 1px solid #475569;
    transition: background 0.2s;
  }

  .tier-milestone-reached .tier-dot {
    background: #f59e0b;
    border-color: #fbbf24;
  }

  .tier-dot-label {
    font-size: 0.58rem;
    color: #64748b;
    line-height: 1;
  }

  .tier-milestone-reached .tier-dot-label {
    color: #f59e0b;
  }
</style>

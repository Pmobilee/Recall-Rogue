<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import {
    isSubscriber,
    subscribeTerraPass,
    subscribeExpeditionPatron,
    subscribeGrandPatron,
    openSubscriptionManagement,
    checkContentGate,
  } from '../../services/subscriptionService'
  import { onMount } from 'svelte'

  interface Props {
    onClose: () => void
  }
  let { onClose }: Props = $props()

  let contentGate = $state<{ available: boolean; factsReady: number; required: number }>({
    available: false,
    factsReady: 522,
    required: 3000,
  })
  let purchasing = $state(false)

  const hasSubscription = $derived($playerSave ? isSubscriber($playerSave) : false)
  const subscriptionType = $derived($playerSave?.subscription?.type ?? null)
  const expiresAt = $derived($playerSave?.subscription?.expiresAt ?? null)

  onMount(async () => {
    contentGate = await checkContentGate()
  })

  async function handleSubscribe(fn: () => Promise<{ success: boolean; error?: string }>) {
    purchasing = true
    await fn()
    purchasing = false
  }
</script>

<div class="terra-pass-overlay" data-testid="terra-pass-modal">
  <div class="terra-pass-modal">
    <button class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
    <h2 class="modal-title">Terra Pass</h2>

    {#if hasSubscription}
      <div class="active-sub">
        <p class="sub-status">Active: {subscriptionType}</p>
        {#if expiresAt}
          <p class="sub-expires">Renews: {new Date(expiresAt).toLocaleDateString()}</p>
        {/if}
        <p class="sub-note">Earned cosmetics are yours to keep, even if you cancel.</p>
        <button class="manage-btn" onclick={openSubscriptionManagement}>
          Manage Subscription
        </button>
      </div>
    {:else if !contentGate.available}
      <div class="coming-soon">
        <p class="coming-title">Coming Soon</p>
        <p class="coming-text">We're building the content library.</p>
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {Math.min(100, (contentGate.factsReady / contentGate.required) * 100)}%"
          ></div>
        </div>
        <p class="progress-text">{contentGate.factsReady} / {contentGate.required} facts ready</p>
      </div>
    {:else}
      <!-- Benefit Matrix -->
      <div class="benefit-section">
        <h3 class="section-title">What's always free</h3>
        <ul class="benefit-list free">
          <li>All facts &amp; quizzes</li>
          <li>SM-2 spaced repetition</li>
          <li>Knowledge Tree</li>
          <li>Study sessions</li>
        </ul>
      </div>

      <!-- Terra Pass -->
      <div class="tier-card">
        <h3 class="tier-name">Terra Pass</h3>
        <p class="tier-price">$4.99/month</p>
        <ul class="tier-benefits">
          <li>Unlimited oxygen tanks</li>
          <li>Monthly exclusive cosmetic</li>
        </ul>
        <button
          class="subscribe-btn"
          onclick={() => handleSubscribe(subscribeTerraPass)}
          disabled={purchasing}
        >
          {purchasing ? 'Processing...' : 'Subscribe'}
        </button>
      </div>

      <!-- Expedition Patron -->
      <div class="tier-card patron">
        <h3 class="tier-name">Expedition Patron</h3>
        <p class="tier-price">$24.99/season</p>
        <ul class="tier-benefits">
          <li>All Terra Pass benefits</li>
          <li>Season Pass premium track</li>
          <li>Patron nameplate</li>
          <li>Exclusive GAIA dialogue</li>
          <li>Scholar's Hall dome theme</li>
        </ul>
        <button
          class="subscribe-btn patron-btn"
          onclick={() => handleSubscribe(subscribeExpeditionPatron)}
          disabled={purchasing}
        >
          {purchasing ? 'Processing...' : 'Subscribe'}
        </button>
      </div>

      <!-- Grand Patron -->
      <div class="tier-card grand">
        <h3 class="tier-name">Grand Patron</h3>
        <p class="tier-price">$49.99/year</p>
        <ul class="tier-benefits">
          <li>All Expedition Patron benefits</li>
          <li>All seasonal cosmetics included</li>
          <li>Physical pixel art sticker pack</li>
          <li>In-game Patron Wall listing</li>
        </ul>
        <button
          class="subscribe-btn grand-btn"
          onclick={() => handleSubscribe(subscribeGrandPatron)}
          disabled={purchasing}
        >
          {purchasing ? 'Processing...' : 'Subscribe'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .terra-pass-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    pointer-events: auto;
    overflow-y: auto;
    padding: 16px;
  }
  .terra-pass-modal {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    border: 2px solid #a78bfa;
    border-radius: 12px;
    padding: 24px;
    max-width: 380px;
    width: 100%;
    position: relative;
    font-family: 'Press Start 2P', monospace;
    max-height: 90vh;
    overflow-y: auto;
  }
  .close-btn {
    position: absolute;
    top: 8px;
    right: 12px;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 20px;
    cursor: pointer;
  }
  .modal-title {
    color: #a78bfa;
    font-size: 16px;
    text-align: center;
    margin: 0 0 16px;
  }
  .active-sub {
    text-align: center;
    padding: 12px;
  }
  .sub-status {
    color: #4ade80;
    font-size: 11px;
    margin: 0 0 8px;
  }
  .sub-expires {
    color: #9ca3af;
    font-size: 9px;
    margin: 0 0 12px;
  }
  .sub-note {
    color: #6b7280;
    font-size: 8px;
    margin: 0 0 12px;
    font-style: italic;
  }
  .manage-btn {
    padding: 10px 16px;
    background: #374151;
    color: #e5e7eb;
    border: none;
    border-radius: 8px;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    cursor: pointer;
  }
  .coming-soon {
    text-align: center;
    padding: 20px;
  }
  .coming-title {
    color: #fbbf24;
    font-size: 14px;
    margin: 0 0 8px;
  }
  .coming-text {
    color: #9ca3af;
    font-size: 9px;
    margin: 0 0 16px;
  }
  .progress-bar {
    width: 100%;
    height: 8px;
    background: #374151;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #a78bfa, #818cf8);
    border-radius: 4px;
    transition: width 0.5s;
  }
  .progress-text {
    color: #6b7280;
    font-size: 8px;
    margin: 0;
  }
  .benefit-section {
    margin-bottom: 16px;
  }
  .section-title {
    color: #4ade80;
    font-size: 10px;
    margin: 0 0 8px;
  }
  .benefit-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .benefit-list li {
    color: #9ca3af;
    font-size: 8px;
    padding: 3px 0;
  }
  .benefit-list li::before {
    content: '✓ ';
    color: #4ade80;
  }
  .tier-card {
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }
  .tier-card.patron {
    border-color: #a78bfa;
  }
  .tier-card.grand {
    border-color: #e2b714;
  }
  .tier-name {
    color: #e5e7eb;
    font-size: 11px;
    margin: 0 0 4px;
  }
  .tier-price {
    color: #fbbf24;
    font-size: 12px;
    margin: 0 0 8px;
  }
  .tier-benefits {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
  }
  .tier-benefits li {
    color: #9ca3af;
    font-size: 8px;
    padding: 2px 0;
  }
  .tier-benefits li::before {
    content: '• ';
    color: #a78bfa;
  }
  .subscribe-btn {
    width: 100%;
    padding: 10px;
    background: linear-gradient(135deg, #a78bfa, #818cf8);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    cursor: pointer;
  }
  .subscribe-btn:hover { filter: brightness(1.1); }
  .subscribe-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .patron-btn { background: linear-gradient(135deg, #a78bfa, #7c3aed); }
  .grand-btn { background: linear-gradient(135deg, #e2b714, #d4a010); color: #1a1a2e; }
</style>

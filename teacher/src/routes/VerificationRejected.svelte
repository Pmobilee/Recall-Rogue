<script lang="ts">
  import { clearUser } from '../lib/auth'
  import { api } from '../lib/api'
  import { onMount } from 'svelte'

  let rejectionReason = $state<string | null>(null)

  onMount(async () => {
    try {
      const res = await api.get<{ rejectionReason: string | null }>('/educator/status')
      rejectionReason = res.rejectionReason
    } catch {
      // Unable to fetch rejection reason — show generic message
    }
  })
</script>

<div class="rejected-page">
  <div class="rejected-card card">
    <div class="rejected-icon" aria-hidden="true">X</div>
    <h1 class="rejected-title">Verification Not Approved</h1>
    <p class="rejected-body">
      Unfortunately your educator access request was not approved at this time.
    </p>
    {#if rejectionReason}
      <div class="reason-box">
        <p class="reason-label">Reviewer note:</p>
        <p class="reason-text">{rejectionReason}</p>
      </div>
    {/if}
    <p class="rejected-body">
      If you believe this was a mistake, please contact
      <a href="mailto:educators@terragacha.com">educators@terragacha.com</a>
      with your school details.
    </p>
    <button class="btn btn-secondary" type="button" onclick={() => clearUser()}>
      Sign Out
    </button>
  </div>
</div>

<style>
  .rejected-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--color-bg);
  }

  .rejected-card {
    max-width: 480px;
    text-align: center;
  }

  .rejected-icon {
    font-size: 2.5rem;
    margin-bottom: 16px;
    color: var(--color-danger);
    font-weight: 900;
  }

  .rejected-title {
    font-size: 1.5rem;
    margin-bottom: 16px;
    color: var(--color-danger);
  }

  .rejected-body {
    color: var(--color-text-muted);
    margin-bottom: 12px;
    line-height: 1.6;
  }

  .reason-box {
    background: #fff5f5;
    border: 1px solid #fecaca;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin: 12px 0;
    text-align: left;
  }

  .reason-label {
    font-weight: 600;
    font-size: 0.85rem;
    margin-bottom: 4px;
  }

  .reason-text {
    color: var(--color-danger);
    font-size: 0.9rem;
  }

  button {
    margin-top: 8px;
  }
</style>

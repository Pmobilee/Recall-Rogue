<script lang="ts">
  import { clearUser } from '../lib/auth'
</script>

<div class="pending-page">
  <div class="pending-card card">
    <div class="pending-icon" aria-hidden="true">⏳</div>
    <h1 class="pending-title">Verification Pending</h1>
    <p class="pending-body">
      Your educator account request has been submitted and is under review.
      Typical review time is <strong>1–2 business days</strong>.
    </p>
    <p class="pending-body">
      You'll be able to sign in and access the Teacher Dashboard once your request
      is approved by our team.
    </p>
    <button class="btn btn-secondary" type="button" onclick={() => clearUser()}>
      Sign Out
    </button>
  </div>
</div>

<style>
  .pending-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--color-bg);
  }

  .pending-card {
    max-width: 480px;
    text-align: center;
  }

  .pending-icon {
    font-size: 3rem;
    margin-bottom: 16px;
  }

  .pending-title {
    font-size: 1.5rem;
    margin-bottom: 16px;
    color: var(--color-warning);
  }

  .pending-body {
    color: var(--color-text-muted);
    margin-bottom: 12px;
    line-height: 1.6;
  }

  button {
    margin-top: 8px;
  }
</style>

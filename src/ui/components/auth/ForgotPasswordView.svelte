<script lang="ts">
  import { apiClient } from '../../../services/apiClient'

  interface Props {
    /** Navigates back to the login screen. */
    onBack: () => void
  }

  let { onBack }: Props = $props()

  // Form state
  let email = $state('')
  let loading = $state(false)
  let submitted = $state(false)
  let errorMessage = $state<string | null>(null)

  /**
   * Submits the password reset request.
   * On success, switches to the confirmation state.
   */
  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault()
    if (loading) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      errorMessage = 'Please enter your email address.'
      return
    }

    loading = true
    errorMessage = null

    try {
      await apiClient.requestPasswordReset(trimmedEmail)
      submitted = true
    } catch (err) {
      // Even on API error, show generic confirmation to avoid email enumeration
      submitted = true
    } finally {
      loading = false
    }
  }
</script>

<div class="auth-screen">
  <div class="auth-card">
    <div class="card-header">
      <button
        class="back-btn"
        type="button"
        onclick={onBack}
        disabled={loading}
        aria-label="Back to login"
      >
        ← Back to Login
      </button>
    </div>

    {#if submitted}
      <!-- Confirmation state -->
      <div class="confirmation-state">
        <div class="confirm-icon" aria-hidden="true">📬</div>
        <h1 class="auth-heading">Check Your Email</h1>
        <p class="confirm-text">
          If an account exists for <strong class="email-display">{email.trim() || 'that address'}</strong>,
          a password reset link has been sent. Check your inbox (and spam folder).
        </p>
        <button class="primary-btn" type="button" onclick={onBack}>
          Back to Login
        </button>
      </div>
    {:else}
      <!-- Reset request form -->
      <h1 class="auth-heading">Reset Password</h1>
      <p class="subtitle">Enter the email address linked to your account. We'll send a reset link.</p>

      {#if errorMessage}
        <div class="error-banner" role="alert">
          {errorMessage}
        </div>
      {/if}

      <form class="auth-form" onsubmit={handleSubmit} novalidate>
        <div class="field-group">
          <label class="field-label" for="forgot-email">Email Address</label>
          <input
            id="forgot-email"
            class="field-input"
            type="email"
            bind:value={email}
            autocomplete="email"
            placeholder="explorer@terra.io"
            required
            disabled={loading}
          />
        </div>

        <button
          class="primary-btn"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .auth-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a2e;
    z-index: 100;
    padding: 1rem;
    font-family: 'Courier New', monospace;
    overflow-y: auto;
  }

  .auth-card {
    background: #16213e;
    border: 1px solid rgba(233, 69, 96, 0.25);
    border-radius: 16px;
    padding: 2rem 1.5rem;
    width: min(100%, 400px);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .card-header {
    display: flex;
    align-items: center;
  }

  .back-btn {
    background: none;
    border: none;
    color: rgba(78, 205, 196, 0.8);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.25rem 0;
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .back-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .auth-heading {
    font-size: 1.25rem;
    font-weight: 700;
    color: #eee;
    margin: 0;
    text-align: center;
  }

  .subtitle {
    font-size: 0.875rem;
    color: rgba(238, 238, 238, 0.55);
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  .error-banner {
    background: rgba(233, 69, 96, 0.15);
    border: 1px solid rgba(233, 69, 96, 0.5);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    color: #e94560;
    font-size: 0.875rem;
    text-align: center;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font-size: 0.8rem;
    color: rgba(238, 238, 238, 0.65);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .field-input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 0.75rem 0.875rem;
    color: #eee;
    font: inherit;
    font-size: 0.95rem;
    min-height: 48px;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 150ms ease;
    outline: none;
  }

  .field-input:focus {
    border-color: rgba(78, 205, 196, 0.6);
  }

  .field-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .field-input::placeholder {
    color: rgba(238, 238, 238, 0.3);
  }

  .primary-btn {
    background: #e94560;
    border: none;
    border-radius: 10px;
    color: #fff;
    font: inherit;
    font-size: 1rem;
    font-weight: 700;
    min-height: 48px;
    cursor: pointer;
    transition: opacity 150ms ease, transform 100ms ease;
    letter-spacing: 0.5px;
    width: 100%;
  }

  .primary-btn:hover:not(:disabled) {
    opacity: 0.88;
  }

  .primary-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Confirmation state */
  .confirmation-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
  }

  .confirm-icon {
    font-size: 3rem;
  }

  .confirm-text {
    font-size: 0.9rem;
    color: rgba(238, 238, 238, 0.65);
    line-height: 1.6;
    margin: 0;
  }

  .email-display {
    color: rgba(78, 205, 196, 0.9);
    word-break: break-all;
  }
</style>

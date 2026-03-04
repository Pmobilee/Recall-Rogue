<script lang="ts">
  import { authStore } from '../../stores/authStore'
  import { apiClient } from '../../../services/apiClient'

  interface Props {
    /** Called after the user logs out. */
    onLogout: () => void
    /** Navigates back (e.g. to settings). */
    onBack: () => void
  }

  let { onLogout, onBack }: Props = $props()

  // Derive current auth state from the store
  let authState = $state({ isLoggedIn: false, userId: null as string | null, email: null as string | null, displayName: null as string | null })

  $effect(() => {
    const unsub = authStore.subscribe((s) => {
      authState = s
    })
    return unsub
  })

  // Delete account confirmation flow
  let deleteConfirmText = $state('')
  let showDeleteSection = $state(false)
  let deletingAccount = $state(false)
  let deleteError = $state<string | null>(null)

  /** The user must type "DELETE" (uppercase) to confirm deletion. */
  const deleteConfirmValid = $derived(deleteConfirmText === 'DELETE')

  /**
   * Logs out the user, clears auth state, and fires the onLogout callback.
   */
  function handleLogout(): void {
    authStore.clear()
    onLogout()
  }

  /**
   * Permanently deletes the account after typing the confirmation word.
   */
  async function handleDeleteAccount(): Promise<void> {
    if (!deleteConfirmValid || deletingAccount) return

    deletingAccount = true
    deleteError = null

    try {
      await apiClient.deleteAccount()
      authStore.clear()
      onLogout()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account. Please try again.'
      deleteError = message
    } finally {
      deletingAccount = false
    }
  }

  /**
   * Formats a userId or email for display (truncated if long).
   */
  function formatId(id: string | null): string {
    if (!id) return '—'
    if (id.length > 20) return id.slice(0, 8) + '…' + id.slice(-6)
    return id
  }
</script>

<div class="auth-screen">
  <div class="auth-card">
    <div class="card-header">
      <button
        class="back-btn"
        type="button"
        onclick={onBack}
        disabled={deletingAccount}
        aria-label="Back"
      >
        ← Back
      </button>
      <h1 class="auth-heading">Account</h1>
    </div>

    <!-- Profile details -->
    <section class="profile-section">
      <div class="avatar-row">
        <div class="avatar-circle" aria-hidden="true">
          <span class="avatar-letter">
            {(authState.displayName ?? authState.email ?? 'E').charAt(0).toUpperCase()}
          </span>
        </div>
        <div class="profile-info">
          <p class="profile-name">{authState.displayName ?? 'Explorer'}</p>
          <p class="profile-email">{authState.email ?? '—'}</p>
        </div>
      </div>

      <dl class="detail-list">
        <div class="detail-row">
          <dt class="detail-label">User ID</dt>
          <dd class="detail-value mono">{formatId(authState.userId)}</dd>
        </div>
        <div class="detail-row">
          <dt class="detail-label">Account Type</dt>
          <dd class="detail-value">
            {authState.isLoggedIn ? 'Registered' : 'Guest'}
          </dd>
        </div>
      </dl>
    </section>

    <!-- Actions -->
    <section class="actions-section">
      <button class="secondary-btn" type="button" disabled title="Change password coming soon">
        Change Password
        <span class="coming-soon-badge">Soon</span>
      </button>

      <button
        class="danger-outline-btn"
        type="button"
        onclick={handleLogout}
        disabled={deletingAccount}
      >
        Log Out
      </button>
    </section>

    <!-- Delete account section -->
    <section class="delete-section">
      {#if !showDeleteSection}
        <button
          class="delete-link"
          type="button"
          onclick={() => { showDeleteSection = true }}
          disabled={deletingAccount}
        >
          Delete Account
        </button>
      {:else}
        <div class="delete-confirm-panel">
          <p class="delete-warning">
            This will permanently delete your account and all progress. This cannot be undone.
          </p>
          <p class="delete-instruction">
            Type <strong class="delete-keyword">DELETE</strong> to confirm:
          </p>
          <input
            class="field-input delete-input"
            type="text"
            bind:value={deleteConfirmText}
            placeholder="DELETE"
            autocomplete="off"
            disabled={deletingAccount}
            aria-label="Type DELETE to confirm account deletion"
          />

          {#if deleteError}
            <p class="delete-error" role="alert">{deleteError}</p>
          {/if}

          <div class="delete-actions">
            <button
              class="cancel-btn"
              type="button"
              onclick={() => { showDeleteSection = false; deleteConfirmText = ''; deleteError = null }}
              disabled={deletingAccount}
            >
              Cancel
            </button>
            <button
              class="delete-confirm-btn"
              type="button"
              onclick={handleDeleteAccount}
              disabled={!deleteConfirmValid || deletingAccount}
            >
              {deletingAccount ? 'Deleting…' : 'Delete Forever'}
            </button>
          </div>
        </div>
      {/if}
    </section>
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
    gap: 1.5rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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
    white-space: nowrap;
  }

  .back-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .auth-heading {
    font-size: 1.2rem;
    font-weight: 700;
    color: #eee;
    margin: 0;
    flex: 1;
  }

  /* Profile section */
  .profile-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .avatar-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .avatar-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #4ecdc4, #1a6b67);
    border: 2px solid rgba(78, 205, 196, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar-letter {
    font-size: 1.5rem;
    font-weight: 700;
    color: #eee;
    line-height: 1;
  }

  .profile-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .profile-name {
    font-size: 1.05rem;
    font-weight: 700;
    color: #eee;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-email {
    font-size: 0.8rem;
    color: rgba(238, 238, 238, 0.5);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0.875rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

  .detail-label {
    font-size: 0.78rem;
    color: rgba(238, 238, 238, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .detail-value {
    font-size: 0.875rem;
    color: rgba(238, 238, 238, 0.8);
    text-align: right;
  }

  .detail-value.mono {
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
  }

  /* Actions section */
  .actions-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .secondary-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: rgba(238, 238, 238, 0.6);
    font: inherit;
    font-size: 0.95rem;
    min-height: 48px;
    cursor: not-allowed;
    opacity: 0.55;
  }

  .coming-soon-badge {
    font-size: 0.65rem;
    background: rgba(78, 205, 196, 0.2);
    color: #4ecdc4;
    border-radius: 4px;
    padding: 0.1rem 0.35rem;
    letter-spacing: 0.5px;
  }

  .danger-outline-btn {
    background: transparent;
    border: 1px solid rgba(233, 69, 96, 0.45);
    border-radius: 10px;
    color: #e94560;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    min-height: 48px;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .danger-outline-btn:hover:not(:disabled) {
    background: rgba(233, 69, 96, 0.1);
  }

  .danger-outline-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Delete section */
  .delete-section {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding-top: 1rem;
  }

  .delete-link {
    background: none;
    border: none;
    color: rgba(233, 69, 96, 0.45);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
    text-decoration: underline;
    text-underline-offset: 2px;
    width: 100%;
    justify-content: center;
  }

  .delete-link:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .delete-confirm-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .delete-warning {
    font-size: 0.85rem;
    color: #e94560;
    line-height: 1.5;
    margin: 0;
  }

  .delete-instruction {
    font-size: 0.85rem;
    color: rgba(238, 238, 238, 0.6);
    margin: 0;
  }

  .delete-keyword {
    color: #e94560;
    letter-spacing: 1px;
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
    border-color: rgba(233, 69, 96, 0.6);
  }

  .field-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .field-input::placeholder {
    color: rgba(238, 238, 238, 0.3);
  }

  .delete-input {
    letter-spacing: 2px;
    font-weight: 700;
    text-align: center;
  }

  .delete-error {
    font-size: 0.8rem;
    color: #e94560;
    margin: 0;
  }

  .delete-actions {
    display: flex;
    gap: 0.75rem;
  }

  .cancel-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: rgba(238, 238, 238, 0.7);
    font: inherit;
    font-size: 0.9rem;
    min-height: 48px;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .cancel-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  .cancel-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .delete-confirm-btn {
    flex: 1.5;
    background: #e94560;
    border: none;
    border-radius: 8px;
    color: #fff;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    min-height: 48px;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .delete-confirm-btn:hover:not(:disabled) {
    opacity: 0.88;
  }

  .delete-confirm-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>

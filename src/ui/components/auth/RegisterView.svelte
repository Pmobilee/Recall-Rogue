<script lang="ts">
  import { apiClient } from '../../../services/apiClient'
  import type { AuthResponse } from '../../../services/apiClient'
  import { authStore } from '../../stores/authStore'

  /** Age bracket selected by the user during registration. */
  type AgeBracket = 'under13' | '13-17' | '18+'

  interface Props {
    /** Called after a successful registration with the authenticated user data. */
    onRegisterSuccess: (user: { id: string; email: string; displayName: string | null }) => void
    /** Navigates back to the login screen. */
    onBack: () => void
    /** Optional: opens the Privacy Policy screen. When not provided the link is plain text. */
    onViewPrivacy?: () => void
    /** Optional: opens the Terms of Service screen. When not provided the link is plain text. */
    onViewTerms?: () => void
  }

  let { onRegisterSuccess, onBack, onViewPrivacy, onViewTerms }: Props = $props()

  // Form state
  let displayName = $state('')
  let email = $state('')
  let password = $state('')
  let confirmPassword = $state('')
  let ageBracket = $state<AgeBracket>('18+')
  let tosAccepted = $state(false)
  let privacyAccepted = $state(false)
  let showPassword = $state(false)
  let showConfirmPassword = $state(false)
  let loading = $state(false)
  let errorMessage = $state<string | null>(null)

  /**
   * Validates form fields and returns an error message string, or null if valid.
   */
  function validate(): string | null {
    if (!displayName.trim()) return 'Please enter a display name.'
    if (!email.trim()) return 'Please enter your email address.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    if (!tosAccepted) return 'You must accept the Terms of Service.'
    if (!privacyAccepted) return 'You must accept the Privacy Policy.'
    return null
  }

  /**
   * Submits the registration form, calls apiClient.register, and fires onRegisterSuccess.
   */
  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault()
    if (loading) return

    const validationError = validate()
    if (validationError) {
      errorMessage = validationError
      return
    }

    loading = true
    errorMessage = null

    try {
      let response: AuthResponse
      try {
        response = await apiClient.register(email.trim(), password, displayName.trim())
      } catch {
        // Backend unreachable — use local auth
        const { localRegister } = await import('../../../services/localAuth')
        response = await localRegister(email.trim(), password, displayName.trim())
      }
      authStore.setUser({
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName ?? null,
      })
      onRegisterSuccess({
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      errorMessage = message
    } finally {
      loading = false
    }
  }

  /** Toggles the main password visibility. */
  function togglePassword(): void {
    showPassword = !showPassword
  }

  /** Toggles the confirm password visibility. */
  function toggleConfirmPassword(): void {
    showConfirmPassword = !showConfirmPassword
  }

  /** Whether the two password fields match (used for inline feedback). */
  const passwordsMatch = $derived(confirmPassword === '' || password === confirmPassword)
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
        ← Back
      </button>
      <h1 class="auth-heading">Create Account</h1>
    </div>

    {#if errorMessage}
      <div class="error-banner" role="alert">
        {errorMessage}
      </div>
    {/if}

    <form class="auth-form" onsubmit={handleSubmit} novalidate>
      <!-- Display name -->
      <div class="field-group">
        <label class="field-label" for="reg-display-name">Display Name</label>
        <input
          id="reg-display-name"
          class="field-input"
          type="text"
          bind:value={displayName}
          autocomplete="username"
          placeholder="Explorer42"
          required
          maxlength={32}
          disabled={loading}
        />
      </div>

      <!-- Email -->
      <div class="field-group">
        <label class="field-label" for="reg-email">Email</label>
        <input
          id="reg-email"
          class="field-input"
          type="email"
          bind:value={email}
          autocomplete="email"
          placeholder="explorer@terra.io"
          required
          disabled={loading}
        />
      </div>

      <!-- Password -->
      <div class="field-group">
        <label class="field-label" for="reg-password">
          Password
          <span class="field-hint">(8+ characters)</span>
        </label>
        <div class="password-wrapper">
          <input
            id="reg-password"
            class="field-input password-input"
            type={showPassword ? 'text' : 'password'}
            bind:value={password}
            autocomplete="new-password"
            placeholder="••••••••"
            required
            minlength={8}
            disabled={loading}
          />
          <button
            class="toggle-btn"
            type="button"
            onclick={togglePassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={loading}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <!-- Confirm password -->
      <div class="field-group">
        <label class="field-label" for="reg-confirm-password">Confirm Password</label>
        <div class="password-wrapper">
          <input
            id="reg-confirm-password"
            class="field-input password-input"
            class:input-error={!passwordsMatch}
            type={showConfirmPassword ? 'text' : 'password'}
            bind:value={confirmPassword}
            autocomplete="new-password"
            placeholder="••••••••"
            required
            disabled={loading}
          />
          <button
            class="toggle-btn"
            type="button"
            onclick={toggleConfirmPassword}
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            disabled={loading}
          >
            {showConfirmPassword ? '🙈' : '👁'}
          </button>
        </div>
        {#if !passwordsMatch}
          <span class="inline-error">Passwords do not match</span>
        {/if}
      </div>

      <!-- Age bracket -->
      <fieldset class="age-fieldset">
        <legend class="field-label">Age Bracket</legend>
        <div class="radio-group">
          <label class="radio-label">
            <input
              class="radio-input"
              type="radio"
              name="age-bracket"
              value="under13"
              bind:group={ageBracket}
              disabled={loading}
            />
            Under 13
          </label>
          <label class="radio-label">
            <input
              class="radio-input"
              type="radio"
              name="age-bracket"
              value="13-17"
              bind:group={ageBracket}
              disabled={loading}
            />
            13–17
          </label>
          <label class="radio-label">
            <input
              class="radio-input"
              type="radio"
              name="age-bracket"
              value="18+"
              bind:group={ageBracket}
              disabled={loading}
            />
            18+
          </label>
        </div>
      </fieldset>

      <!-- Legal checkboxes -->
      <div class="legal-group">
        <label class="checkbox-label">
          <input
            class="checkbox-input"
            type="checkbox"
            bind:checked={tosAccepted}
            disabled={loading}
          />
          <span>
            I accept the
            {#if onViewTerms}
              <button class="legal-link" type="button" onclick={onViewTerms} disabled={loading}>
                Terms of Service
              </button>
            {:else}
              <strong>Terms of Service</strong>
            {/if}
          </span>
        </label>
        <label class="checkbox-label">
          <input
            class="checkbox-input"
            type="checkbox"
            bind:checked={privacyAccepted}
            disabled={loading}
          />
          <span>
            I accept the
            {#if onViewPrivacy}
              <button class="legal-link" type="button" onclick={onViewPrivacy} disabled={loading}>
                Privacy Policy
              </button>
            {:else}
              <strong>Privacy Policy</strong>
            {/if}
          </span>
        </label>
      </div>

      <button
        class="primary-btn"
        type="submit"
        disabled={loading}
      >
        {loading ? 'Creating Account…' : 'Create Account'}
      </button>
    </form>
  </div>
</div>

<style>
  .auth-screen {
    pointer-events: auto;
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
    gap: 1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    margin: auto;
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
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }

  .field-hint {
    font-size: 0.7rem;
    color: rgba(238, 238, 238, 0.35);
    text-transform: none;
    letter-spacing: 0;
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

  .field-input.input-error {
    border-color: rgba(233, 69, 96, 0.6);
  }

  .inline-error {
    font-size: 0.75rem;
    color: #e94560;
  }

  .password-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-input {
    padding-right: 3rem;
  }

  .toggle-btn {
    position: absolute;
    right: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(238, 238, 238, 0.5);
    font-size: 1rem;
    padding: 0.5rem;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .age-fieldset {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.75rem;
    margin: 0;
  }

  .age-fieldset legend {
    padding: 0 0.4rem;
  }

  .radio-group {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: rgba(238, 238, 238, 0.8);
    cursor: pointer;
    min-height: 44px;
  }

  .radio-input {
    accent-color: #e94560;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .legal-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
    color: rgba(238, 238, 238, 0.7);
    cursor: pointer;
    min-height: 44px;
  }

  .checkbox-input {
    accent-color: #e94560;
    width: 18px;
    height: 18px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .checkbox-label strong {
    color: rgba(78, 205, 196, 0.9);
  }

  .legal-link {
    background: none;
    border: none;
    padding: 0;
    color: rgba(78, 205, 196, 0.9);
    font: inherit;
    font-size: inherit;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    display: inline;
  }

  .legal-link:hover:not(:disabled) {
    color: #4ecdc4;
  }

  .legal-link:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
    margin-top: 0.25rem;
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
</style>

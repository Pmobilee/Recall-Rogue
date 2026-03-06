<script lang="ts">
  import { apiClient } from '../../../services/apiClient'
  import type { AuthResponse } from '../../../services/apiClient'
  import { authStore } from '../../stores/authStore'

  interface Props {
    /** Called after a successful login with the authenticated user data. */
    onLogin: (user: { id: string; email: string; displayName: string | null }) => void
    /** Navigates to the register screen. */
    onRegister: () => void
    /** Navigates to the forgot password screen. */
    onForgotPassword: () => void
    /** Continues without an account (guest mode). */
    onGuest: () => void
  }

  let { onLogin, onRegister, onForgotPassword, onGuest }: Props = $props()

  // Form state
  let email = $state('')
  let password = $state('')
  let showPassword = $state(false)
  let loading = $state(false)
  let errorMessage = $state<string | null>(null)

  /**
   * Submits the login form, calls apiClient.login, and fires onLogin on success.
   */
  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault()
    if (loading) return

    const trimmedEmail = email.trim()
    const trimmedPassword = password

    if (!trimmedEmail || !trimmedPassword) {
      errorMessage = 'Please enter your email and password.'
      return
    }

    loading = true
    errorMessage = null

    try {
      let response: AuthResponse
      try {
        response = await apiClient.login(trimmedEmail, trimmedPassword)
      } catch {
        // Backend unreachable — use local auth
        const { localLogin } = await import('../../../services/localAuth')
        response = await localLogin(trimmedEmail, trimmedPassword)
      }
      authStore.setUser({
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName ?? null,
      })
      onLogin({
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed. Please try again.'
      errorMessage = message
    } finally {
      loading = false
    }
  }

  /** Toggles password visibility. */
  function togglePassword(): void {
    showPassword = !showPassword
  }
</script>

<div class="auth-screen">
  <div class="auth-card">
    <!-- GAIA icon placeholder -->
    <div class="gaia-icon" aria-hidden="true">
      <div class="gaia-circle">
        <span class="gaia-letter">G</span>
      </div>
    </div>

    <h1 class="auth-heading">Welcome back, Explorer.</h1>

    {#if errorMessage}
      <div class="error-banner" role="alert">
        {errorMessage}
      </div>
    {/if}

    <form class="auth-form" onsubmit={handleSubmit} novalidate>
      <div class="field-group">
        <label class="field-label" for="login-email">Email</label>
        <input
          id="login-email"
          class="field-input"
          type="email"
          bind:value={email}
          autocomplete="email"
          placeholder="explorer@terra.io"
          required
          disabled={loading}
        />
      </div>

      <div class="field-group">
        <label class="field-label" for="login-password">Password</label>
        <div class="password-wrapper">
          <input
            id="login-password"
            class="field-input password-input"
            type={showPassword ? 'text' : 'password'}
            bind:value={password}
            autocomplete="current-password"
            placeholder="••••••••"
            required
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

      <button
        class="link-btn forgot-link"
        type="button"
        onclick={onForgotPassword}
        disabled={loading}
      >
        Forgot password?
      </button>

      <button
        class="primary-btn"
        type="submit"
        disabled={loading}
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>

    <div class="divider">
      <span class="divider-line"></span>
      <span class="divider-text">or continue with</span>
      <span class="divider-line"></span>
    </div>

    <div class="social-row">
      <button class="social-btn" type="button" disabled title="Google sign-in coming soon">
        <span class="social-icon">G</span>
        Google
      </button>
      <button class="social-btn" type="button" disabled title="Apple sign-in coming soon">
        <span class="social-icon"></span>
        Apple
      </button>
    </div>

    <div class="footer-links">
      <button class="link-btn" type="button" onclick={onRegister} disabled={loading}>
        Don't have an account? <strong>Register</strong>
      </button>
    </div>

    <button
      class="ghost-btn"
      type="button"
      onclick={onGuest}
      disabled={loading}
    >
      Continue as Guest
    </button>
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
  }

  .gaia-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 0.25rem;
  }

  .gaia-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #4ecdc4, #1a6b67);
    border: 2px solid rgba(78, 205, 196, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(78, 205, 196, 0.2);
  }

  .gaia-letter {
    font-size: 1.75rem;
    font-weight: 700;
    color: #eee;
    line-height: 1;
  }

  .auth-heading {
    text-align: center;
    font-size: 1.3rem;
    font-weight: 700;
    color: #eee;
    margin: 0;
    letter-spacing: 0.5px;
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
    gap: 0.75rem;
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

  .forgot-link {
    align-self: flex-end;
    font-size: 0.8rem;
    color: rgba(78, 205, 196, 0.8);
    text-decoration: underline;
    text-underline-offset: 2px;
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

  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: rgba(238, 238, 238, 0.35);
    font-size: 0.75rem;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .divider-text {
    white-space: nowrap;
  }

  .social-row {
    display: flex;
    gap: 0.75rem;
  }

  .social-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: rgba(238, 238, 238, 0.5);
    font: inherit;
    font-size: 0.875rem;
    min-height: 48px;
    cursor: not-allowed;
    opacity: 0.5;
  }

  .social-icon {
    font-size: 1rem;
    font-weight: 700;
  }

  .footer-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .link-btn {
    background: none;
    border: none;
    color: rgba(238, 238, 238, 0.55);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.25rem;
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .link-btn strong {
    color: rgba(78, 205, 196, 0.9);
  }

  .link-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ghost-btn {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: rgba(238, 238, 238, 0.55);
    font: inherit;
    font-size: 0.9rem;
    min-height: 48px;
    cursor: pointer;
    transition: background 150ms ease;
    width: 100%;
  }

  .ghost-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  .ghost-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>

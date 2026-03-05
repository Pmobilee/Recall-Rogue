<script lang="ts">
  import { api } from '../lib/api'
  import { setUser, saveTokens } from '../lib/auth'

  interface Props {
    navigate: (page: string, params?: Record<string, string>) => void
  }

  let { navigate }: Props = $props()

  type Mode = 'login' | 'register'
  let mode = $state<Mode>('login')
  let email = $state('')
  let password = $state('')
  let schoolName = $state('')
  let schoolUrl = $state('')
  let verificationNote = $state('')
  let error = $state('')
  let submitting = $state(false)

  /** Toggle between login and request-access modes. */
  function toggleMode(): void {
    mode = mode === 'login' ? 'register' : 'login'
    error = ''
  }

  /** Log in with an existing approved educator account. */
  async function handleLogin(): Promise<void> {
    submitting = true
    error = ''
    try {
      const res = await api.post<{ token: string; refreshToken: string; user: Record<string, unknown> }>(
        '/auth/login',
        { email, password },
      )
      saveTokens(res.token, res.refreshToken)
      const statusRes = await api.get<{ role: string; verificationStatus: string; classLimit: number }>(
        '/educator/status',
      )
      if (statusRes.role !== 'educator' && statusRes.role !== 'admin') {
        if (statusRes.verificationStatus === 'pending') {
          setUser({
            id: res.user.id as string,
            email: res.user.email as string,
            displayName: res.user.displayName as string | null,
            role: 'educator',
            verificationStatus: 'pending',
          })
          return
        }
        if (statusRes.verificationStatus === 'rejected') {
          setUser({
            id: res.user.id as string,
            email: res.user.email as string,
            displayName: res.user.displayName as string | null,
            role: 'educator',
            verificationStatus: 'rejected',
          })
          return
        }
        error = 'This account is not an approved educator. Request access below.'
        return
      }
      setUser({
        id: res.user.id as string,
        email: res.user.email as string,
        displayName: res.user.displayName as string | null,
        role: statusRes.role as 'educator' | 'admin',
        verificationStatus: statusRes.verificationStatus as 'pending' | 'approved' | 'rejected',
      })
      navigate('dashboard')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Login failed'
    } finally {
      submitting = false
    }
  }

  /** Submit an educator verification request after creating a new account. */
  async function handleVerificationRequest(): Promise<void> {
    if (!schoolName.trim()) { error = 'School name is required'; return }
    submitting = true
    error = ''
    try {
      const authRes = await api.post<{ token: string; refreshToken: string }>(
        '/auth/register',
        { email, password, displayName: schoolName.slice(0, 30) },
      )
      saveTokens(authRes.token, authRes.refreshToken)
      await api.post('/educator/verify-request', { schoolName, schoolUrl, verificationNote })
      setUser({
        id: '',
        email,
        displayName: null,
        role: 'educator',
        verificationStatus: 'pending',
      })
    } catch (e) {
      error = e instanceof Error ? e.message : 'Submission failed'
    } finally {
      submitting = false
    }
  }
</script>

<div class="login-page">
  <div class="login-card card">
    <div class="login-header">
      <h1 class="login-title">Terra Gacha</h1>
      <p class="login-subtitle">Teacher Dashboard</p>
    </div>

    <!-- Mode tabs -->
    <div class="mode-tabs">
      <button
        class="mode-tab"
        class:active={mode === 'login'}
        type="button"
        onclick={() => { mode = 'login'; error = '' }}
      >
        Sign In
      </button>
      <button
        class="mode-tab"
        class:active={mode === 'register'}
        type="button"
        data-testid="request-access-toggle"
        onclick={() => { mode = 'register'; error = '' }}
      >
        Request Educator Access
      </button>
    </div>

    {#if mode === 'login'}
      <!-- ── Login form ── -->
      <form class="auth-form" onsubmit={(e) => { e.preventDefault(); void handleLogin() }}>
        <div class="form-group">
          <label class="form-label" for="email">Email</label>
          <input
            id="email"
            class="form-input"
            type="email"
            autocomplete="email"
            bind:value={email}
            disabled={submitting}
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="password">Password</label>
          <input
            id="password"
            class="form-input"
            type="password"
            autocomplete="current-password"
            bind:value={password}
            disabled={submitting}
            required
          />
        </div>

        {#if error}
          <p class="error-text" role="alert">{error}</p>
        {/if}

        <button class="btn btn-primary login-btn" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p class="mode-hint">
        Don't have an account?
        <button class="link-btn" type="button" onclick={toggleMode}>Request educator access</button>
      </p>

    {:else}
      <!-- ── Verification request form ── -->
      <form class="auth-form" onsubmit={(e) => { e.preventDefault(); void handleVerificationRequest() }}>
        <p class="register-intro">
          Create an account and submit your school details for manual review.
          Approval typically takes 1–2 business days.
        </p>

        <div class="form-group">
          <label class="form-label" for="reg-email">Your email</label>
          <input
            id="reg-email"
            class="form-input"
            type="email"
            autocomplete="email"
            bind:value={email}
            disabled={submitting}
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="reg-password">Create a password</label>
          <input
            id="reg-password"
            class="form-input"
            type="password"
            autocomplete="new-password"
            bind:value={password}
            disabled={submitting}
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="school-name">School name <span class="required">*</span></label>
          <input
            id="school-name"
            class="form-input"
            type="text"
            bind:value={schoolName}
            maxlength="200"
            disabled={submitting}
            placeholder="e.g. Lincoln Elementary School"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="school-url">School website (optional)</label>
          <input
            id="school-url"
            class="form-input"
            type="url"
            bind:value={schoolUrl}
            disabled={submitting}
            placeholder="https://school.edu"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="ver-note">Note to reviewer (optional)</label>
          <textarea
            id="ver-note"
            class="form-input"
            bind:value={verificationNote}
            maxlength="500"
            rows="3"
            disabled={submitting}
            placeholder="Any context that helps us verify your request quickly…"
          ></textarea>
        </div>

        {#if error}
          <p class="error-text" role="alert">{error}</p>
        {/if}

        <button class="btn btn-primary login-btn" type="submit" disabled={submitting || !schoolName.trim()}>
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>

      <p class="mode-hint">
        Already approved?
        <button class="link-btn" type="button" onclick={toggleMode}>Sign in</button>
      </p>
    {/if}
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--color-bg);
  }

  .login-card {
    width: 100%;
    max-width: 460px;
  }

  .login-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .login-title {
    font-size: 1.8rem;
    color: var(--color-primary);
    margin-bottom: 4px;
  }

  .login-subtitle {
    color: var(--color-text-muted);
  }

  .mode-tabs {
    display: flex;
    border-bottom: 2px solid var(--color-border);
    margin-bottom: 20px;
  }

  .mode-tab {
    flex: 1;
    padding: 10px 8px;
    background: none;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s;
  }

  .mode-tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .register-intro {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .login-btn {
    width: 100%;
    padding: 10px;
    font-size: 1rem;
    margin-top: 8px;
  }

  .mode-hint {
    text-align: center;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-top: 16px;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    text-decoration: underline;
  }

  .required {
    color: var(--color-danger);
  }
</style>

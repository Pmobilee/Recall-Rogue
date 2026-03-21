<script lang="ts">
  import { get } from 'svelte/store'
  import { apiClient } from '../../services/apiClient'
  import { syncService } from '../../services/syncService'
  import { authStore } from '../stores/authStore'
  import { syncStatus } from '../stores/syncStore'
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { analyticsService } from '../../services/analyticsService'

  interface AuthState {
    isLoggedIn: boolean
    userId: string | null
    email: string | null
    displayName: string | null
  }

  let authState = $state<AuthState>({
    isLoggedIn: false,
    userId: null,
    email: null,
    displayName: null,
  })

  let email = $state('')
  let password = $state('')
  let displayName = $state('')
  let mode = $state<'login' | 'register'>('login')
  let loading = $state(false)
  let message = $state<string | null>(null)
  let inviteCode = $state('')

  const save = $derived($playerSave)
  const syncState = $derived($syncStatus)
  const cloudEnabled = $derived(save?.cloudSyncEnabled !== false)
  const deviceId = $derived(save?.deviceId ?? 'n/a')

  $effect(() => {
    const unsub = authStore.subscribe((state) => {
      authState = state
    })
    return unsub
  })

  function formatSyncTime(): string {
    const last = syncService.lastSyncTime
    if (!last) return 'Never'
    return new Date(last).toLocaleString()
  }

  function updateSaveMeta(patch: Partial<NonNullable<typeof save>>): void {
    playerSave.update((current) => {
      if (!current) return current
      return { ...current, ...patch }
    })
    persistPlayer()
  }

  async function handleAuthSubmit(): Promise<void> {
    if (loading) return
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    if (!trimmedEmail || !trimmedPassword) {
      message = 'Email and password are required.'
      return
    }

    loading = true
    message = null

    try {
      const response = mode === 'register'
        ? await apiClient.register(trimmedEmail, trimmedPassword, displayName.trim() || 'Explorer')
        : await apiClient.login(trimmedEmail, trimmedPassword)

      authStore.setUser({
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName ?? null,
      })

      updateSaveMeta({
        accountId: response.user.id,
        accountEmail: response.user.email,
      })

      analyticsService.track({
        name: 'account_created',
        properties: {
          method: mode,
          has_cloud_sync: cloudEnabled,
        },
      })

      message = mode === 'register' ? 'Account created. Syncing cloud save...' : 'Logged in. Syncing cloud save...'
      await handlePull()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Authentication failed.'
      message = text
    } finally {
      loading = false
    }
  }

  async function handlePull(): Promise<void> {
    if (loading) return
    loading = true
    message = null
    try {
      const remote = await syncService.pullFromCloud()
      if (!remote) {
        message = 'No cloud save found.'
        return
      }
      const local = get(playerSave)
      const merged = local ? syncService.fieldLevelMerge(local, remote) : remote
      playerSave.set(merged)
      persistPlayer()
      message = 'Cloud save pulled.'
    } catch (err) {
      message = err instanceof Error ? err.message : 'Pull failed.'
    } finally {
      loading = false
    }
  }

  async function handlePush(): Promise<void> {
    if (loading) return
    loading = true
    message = null
    try {
      await syncService.pushToCloud()
      message = syncState === 'error' ? 'Cloud push failed.' : 'Cloud save pushed.'
    } catch (err) {
      message = err instanceof Error ? err.message : 'Push failed.'
    } finally {
      loading = false
    }
  }

  function handleLogout(): void {
    authStore.clear()
    updateSaveMeta({
      accountId: null,
      accountEmail: null,
    })
    message = 'Logged out.'
  }

  function setCloudSync(next: boolean): void {
    updateSaveMeta({ cloudSyncEnabled: next })
    analyticsService.track({
      name: 'settings_change',
      properties: {
        setting: 'cloudSyncEnabled',
        value: next,
      },
    })
  }

  async function validateInviteCode(): Promise<void> {
    const code = inviteCode.trim().toUpperCase()
    if (!code) {
      message = 'Enter an invite code first.'
      return
    }

    loading = true
    message = null
    try {
      const response = await fetch('/api/invite/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const payload = await response.json() as { accepted?: boolean; reason?: string }
      const accepted = payload.accepted === true
      analyticsService.track({
        name: 'invite_code_validated',
        properties: {
          code,
          accepted,
        },
      })
      message = accepted ? 'Invite code accepted.' : `Invite code rejected (${payload.reason ?? 'invalid'}).`
    } catch (err) {
      message = err instanceof Error ? err.message : 'Invite code validation failed.'
    } finally {
      loading = false
    }
  }
</script>

<section class="account">
  <h3>Account & Cloud Save</h3>

  <div class="meta">
    <div><strong>Device ID:</strong> <span class="mono">{deviceId}</span></div>
    <div><strong>Status:</strong> {authState.isLoggedIn ? `Signed in as ${authState.email ?? 'account'}` : 'Guest mode'}</div>
    <div><strong>Last Sync:</strong> {formatSyncTime()}</div>
  </div>

  <label class="toggle-row">
    <span>Enable Cloud Sync</span>
    <input
      type="checkbox"
      checked={cloudEnabled}
      onchange={(event) => setCloudSync((event.currentTarget as HTMLInputElement).checked)}
    />
  </label>

  {#if authState.isLoggedIn}
    <div class="actions">
      <button type="button" class="secondary" onclick={handlePull} disabled={loading || !cloudEnabled}>Pull Cloud Save</button>
      <button type="button" class="secondary" onclick={handlePush} disabled={loading || !cloudEnabled}>Push Cloud Save</button>
      <button type="button" class="danger" onclick={handleLogout} disabled={loading}>Logout</button>
    </div>
  {:else}
    <div class="auth-tabs">
      <button type="button" class:selected={mode === 'login'} onclick={() => (mode = 'login')}>Login</button>
      <button type="button" class:selected={mode === 'register'} onclick={() => (mode = 'register')}>Create Account</button>
    </div>
    <form class="form" onsubmit={(e) => { e.preventDefault(); handleAuthSubmit(); }}>
      <input type="email" bind:value={email} placeholder="Email" autocomplete="email" />
      <input type="password" bind:value={password} placeholder="Password" autocomplete="current-password" />
      {#if mode === 'register'}
        <input type="text" bind:value={displayName} placeholder="Display Name (optional)" autocomplete="nickname" />
      {/if}
      <button type="submit" class="primary" disabled={loading || !cloudEnabled}>
        {loading ? 'Working...' : mode === 'register' ? 'Create Account' : 'Sign In'}
      </button>
    </form>
  {/if}

  {#if message}
    <p class="message">{message}</p>
  {/if}

  <div class="invite">
    <input
      type="text"
      bind:value={inviteCode}
      placeholder="Invite code"
      autocomplete="off"
    />
    <button type="button" class="secondary" onclick={validateInviteCode} disabled={loading}>
      Validate Invite
    </button>
  </div>
</section>

<style>
  .account {
    background: rgba(15, 23, 42, 0.76);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  h3 {
    margin: 0;
    font-size: calc(14px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .meta {
    display: grid;
    gap: 4px;
    font-size: calc(12px * var(--text-scale, 1));
    color: #dbeafe;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    word-break: break-all;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    gap: 10px;
    color: #dbeafe;
  }

  input[type='checkbox'] {
    width: 20px;
    height: 20px;
  }

  .auth-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .auth-tabs button {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #cbd5e1;
  }

  .auth-tabs button.selected {
    border-color: #38bdf8;
    background: #0f2942;
    color: #f8fafc;
  }

  .form {
    display: grid;
    gap: 8px;
  }

  .form input {
    min-height: 44px;
    border-radius: 8px;
    border: 1px solid #475569;
    background: #0b1626;
    color: #e2e8f0;
    padding: 0 10px;
  }

  .actions {
    display: grid;
    gap: 8px;
  }

  button {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #e5e7eb;
    padding: 0 12px;
  }

  button.primary {
    background: #166534;
    border-color: #2f914f;
    color: #f0fff4;
  }

  button.secondary {
    background: #1e3a8a;
    border-color: #3b82f6;
    color: #dbeafe;
  }

  button.danger {
    background: #7f1d1d;
    border-color: #ef4444;
    color: #fee2e2;
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .message {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .invite {
    display: grid;
    gap: 8px;
  }

  .invite input {
    min-height: 44px;
    border-radius: 8px;
    border: 1px solid #475569;
    background: #0b1626;
    color: #e2e8f0;
    padding: 0 10px;
  }
</style>

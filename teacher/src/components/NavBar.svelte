<script lang="ts">
  import { currentUser, clearUser } from '../lib/auth'

  interface Props {
    /** Navigate to a new page. */
    navigate: (page: string, params?: Record<string, string>) => void
  }

  let { navigate }: Props = $props()

  /** Log out and clear tokens. */
  function handleLogout(): void {
    clearUser()
  }
</script>

<nav class="navbar" aria-label="Teacher dashboard navigation">
  <div class="navbar-inner">
    <button
      class="navbar-brand"
      type="button"
      onclick={() => navigate('dashboard')}
      aria-label="Go to dashboard"
    >
      Recall Rogue — Teacher Dashboard
    </button>

    <div class="navbar-actions">
      {#if $currentUser}
        <span class="navbar-user" aria-label="Logged in as {$currentUser.email}">
          {$currentUser.email}
        </span>
      {/if}
      <button class="btn btn-secondary" type="button" onclick={handleLogout}>
        Log Out
      </button>
    </div>
  </div>
</nav>

<style>
  .navbar {
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    box-shadow: var(--shadow);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .navbar-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 20px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .navbar-brand {
    background: none;
    border: none;
    font-weight: 700;
    font-size: 1rem;
    color: var(--color-primary);
    cursor: pointer;
    padding: 0;
  }
  .navbar-brand:hover {
    color: var(--color-primary-dark);
  }

  .navbar-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .navbar-user {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
</style>

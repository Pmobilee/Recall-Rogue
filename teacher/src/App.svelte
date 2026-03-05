<script lang="ts">
  import { writable } from 'svelte/store'
  import NavBar from './components/NavBar.svelte'
  import Login from './routes/Login.svelte'
  import Dashboard from './routes/Dashboard.svelte'
  import ClassDetail from './routes/ClassDetail.svelte'
  import AssignmentEditor from './routes/AssignmentEditor.svelte'
  import VerificationPending from './routes/VerificationPending.svelte'
  import VerificationRejected from './routes/VerificationRejected.svelte'
  import { isLoggedIn, isPendingVerification, isRejectedVerification } from './lib/auth'
  import type { RouteParams } from './types/index'

  /** Current router state — the active page and optional params. */
  export const currentRoute = writable<RouteParams>({ page: 'dashboard' })

  /**
   * Navigate to a page with optional URL params.
   *
   * @param page   - Target page identifier.
   * @param params - Optional route params (e.g. classId).
   */
  function navigate(page: string, params?: Record<string, string>): void {
    currentRoute.set({ page, params })
  }
</script>

{#if !$isLoggedIn}
  <Login {navigate} />
{:else if $isPendingVerification}
  <VerificationPending />
{:else if $isRejectedVerification}
  <VerificationRejected />
{:else}
  <NavBar {navigate} />
  <main class="main-content">
    {#if $currentRoute.page === 'dashboard'}
      <Dashboard {navigate} />
    {:else if $currentRoute.page === 'class'}
      <ClassDetail classId={$currentRoute.params?.classId ?? ''} {navigate} />
    {:else if $currentRoute.page === 'assignment'}
      <AssignmentEditor
        classId={$currentRoute.params?.classId ?? ''}
        assignmentId={$currentRoute.params?.assignmentId}
        {navigate}
      />
    {:else}
      <Dashboard {navigate} />
    {/if}
  </main>
{/if}

<style>
  .main-content {
    flex: 1;
  }
</style>

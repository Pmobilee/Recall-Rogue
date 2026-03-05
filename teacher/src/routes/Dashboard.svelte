<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../lib/api'
  import ClassCard from '../components/ClassCard.svelte'
  import type { Classroom } from '../types/index'

  interface Props {
    navigate: (page: string, params?: Record<string, string>) => void
  }

  let { navigate }: Props = $props()

  let classrooms = $state<Classroom[]>([])
  let loading = $state(true)
  let error = $state('')

  // Create class modal state
  let showCreateModal = $state(false)
  let newClassName = $state('')
  let newAgeRating = $state<'kid' | 'teen'>('teen')
  let createError = $state('')
  let creating = $state(false)

  onMount(() => {
    void loadClassrooms()
  })

  /** Fetch the educator's active classrooms. */
  async function loadClassrooms(): Promise<void> {
    loading = true
    error = ''
    try {
      const res = await api.get<{ classrooms: Classroom[] }>('/classrooms')
      classrooms = res.classrooms
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load classrooms'
    } finally {
      loading = false
    }
  }

  /** Create a new classroom. */
  async function handleCreate(): Promise<void> {
    if (!newClassName.trim()) { createError = 'Class name required'; return }
    creating = true
    createError = ''
    try {
      const res = await api.post<{ classroom: Classroom }>('/classrooms', {
        name: newClassName.trim(),
        ageRating: newAgeRating,
      })
      classrooms = [...classrooms, { ...res.classroom, studentCount: 0 }]
      newClassName = ''
      showCreateModal = false
    } catch (e) {
      createError = e instanceof Error ? e.message : 'Failed to create classroom'
    } finally {
      creating = false
    }
  }

  /** Archive a classroom (soft-delete). */
  async function handleArchive(classroomId: string): Promise<void> {
    try {
      await api.delete(`/classrooms/${classroomId}`)
      classrooms = classrooms.filter(c => c.id !== classroomId)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to archive classroom'
    }
  }

  /** Navigate to the class detail view. */
  function openClass(classroomId: string): void {
    navigate('class', { classId: classroomId })
  }
</script>

<div class="page-container" data-testid="dashboard-class-list">
  <div class="dashboard-header">
    <h1 class="page-title">My Classes</h1>
    <button
      class="btn btn-primary"
      type="button"
      data-testid="create-class-btn"
      onclick={() => { showCreateModal = true; createError = '' }}
    >
      + New Class
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading your classes…</div>
  {:else if error}
    <p class="error-text" role="alert">{error}</p>
  {:else if classrooms.length === 0}
    <div class="empty-state">
      <p>No classes yet. Create your first class to get started.</p>
    </div>
  {:else}
    <div class="class-grid">
      {#each classrooms as classroom (classroom.id)}
        <ClassCard
          {classroom}
          onClick={openClass}
          onArchive={handleArchive}
        />
      {/each}
    </div>
  {/if}
</div>

<!-- Create class modal -->
{#if showCreateModal}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create class">
    <div class="modal-box card">
      <h2 class="modal-title">Create a New Class</h2>

      <form onsubmit={(e) => { e.preventDefault(); void handleCreate() }}>
        <div class="form-group">
          <label class="form-label" for="class-name">Class name <span style="color:var(--color-danger)">*</span></label>
          <input
            id="class-name"
            class="form-input"
            type="text"
            bind:value={newClassName}
            maxlength="100"
            placeholder="e.g. 7th Grade Earth Science"
            data-testid="class-name-input"
            disabled={creating}
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="age-rating">Age rating</label>
          <select id="age-rating" class="form-input" bind:value={newAgeRating} disabled={creating}>
            <option value="teen">Teen (13+)</option>
            <option value="kid">Kid (under 13)</option>
          </select>
        </div>

        {#if createError}
          <p class="error-text" role="alert">{createError}</p>
        {/if}

        <div class="modal-actions">
          <button
            class="btn btn-secondary"
            type="button"
            onclick={() => { showCreateModal = false; newClassName = '' }}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            class="btn btn-primary"
            type="submit"
            data-testid="create-class-submit"
            disabled={creating || !newClassName.trim()}
          >
            {creating ? 'Creating…' : 'Create Class'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .class-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 20px;
  }

  .modal-box {
    width: 100%;
    max-width: 440px;
  }

  .modal-title {
    font-size: 1.2rem;
    margin-bottom: 20px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 16px;
  }
</style>

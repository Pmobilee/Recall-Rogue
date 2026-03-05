<script lang="ts">
  import type { Classroom } from '../types/index'

  interface Props {
    classroom: Classroom
    /** Called when this card is clicked to navigate to class detail. */
    onClick: (classroomId: string) => void
    /** Called when archive is confirmed. */
    onArchive?: (classroomId: string) => void
  }

  let { classroom, onClick, onArchive }: Props = $props()

  let showArchiveConfirm = $state(false)
</script>

<div
  class="class-card card"
  data-testid="class-card"
  role="button"
  tabindex="0"
  aria-label="Open class {classroom.name}"
  onclick={() => onClick(classroom.id)}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(classroom.id) }}
>
  <div class="card-header">
    <h3 class="card-title">{classroom.name}</h3>
    <span class="age-badge" class:kid={classroom.ageRating === 'kid'}>
      {classroom.ageRating === 'kid' ? 'Kid' : 'Teen'}
    </span>
  </div>

  <div class="card-meta">
    <span class="join-code-label">Join code:</span>
    <code class="join-code" data-testid="join-code">{classroom.joinCode}</code>
  </div>

  <div class="card-stats">
    <span class="stat">
      <strong>{classroom.studentCount ?? 0}</strong> students
    </span>
  </div>

  {#if onArchive}
    <div class="card-actions" onclick={(e) => e.stopPropagation()} role="presentation">
      {#if showArchiveConfirm}
        <span class="confirm-text">Archive this class?</span>
        <button
          class="btn btn-danger"
          type="button"
          style="padding: 4px 10px; font-size: 0.8rem;"
          onclick={() => { onArchive(classroom.id); showArchiveConfirm = false }}
        >
          Confirm
        </button>
        <button
          class="btn btn-secondary"
          type="button"
          style="padding: 4px 10px; font-size: 0.8rem;"
          onclick={() => { showArchiveConfirm = false }}
        >
          Cancel
        </button>
      {:else}
        <button
          class="btn btn-secondary"
          type="button"
          style="padding: 4px 10px; font-size: 0.8rem;"
          onclick={() => { showArchiveConfirm = true }}
          aria-label="Archive class {classroom.name}"
        >
          Archive
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .class-card {
    cursor: pointer;
    transition: box-shadow 0.15s;
    user-select: none;
  }

  .class-card:hover {
    box-shadow: var(--shadow-md);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
  }

  .card-title {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .age-badge {
    background: var(--color-primary-light);
    color: white;
    border-radius: 12px;
    padding: 2px 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .age-badge.kid {
    background: var(--color-success);
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .join-code-label {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .join-code {
    font-family: monospace;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--color-primary);
    background: var(--color-bg);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--color-border);
  }

  .card-stats {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: 8px;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .confirm-text {
    font-size: 0.85rem;
    color: var(--color-danger);
    font-weight: 500;
  }
</style>

<script lang="ts">
  /**
   * ClassJoinPanel — in-game UI for students to enter a classroom join code.
   * Rendered inside the Settings screen under a "Classroom" section.
   * On successful join, updates the classroomStore with the new membership.
   */
  import { classroomStore } from '../stores/classroomStore'
  import { joinClassroom } from '../../services/classroomService'

  let joinCode = $state('')
  let error = $state('')
  let success = $state('')
  let loading = $state(false)

  /** Current classroom state from store. */
  const classroom = $derived($classroomStore)

  async function handleJoin() {
    const code = joinCode.toUpperCase().trim()
    if (code.length !== 6) {
      error = 'Join code must be 6 characters'
      return
    }
    loading = true
    error = ''
    success = ''
    try {
      const res = await joinClassroom(code)
      success = `Joined "${res.className}"`
      joinCode = ''
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to join class'
    } finally {
      loading = false
    }
  }

  function leaveClass() {
    classroomStore.clear()
    success = ''
    error = ''
  }
</script>

<div class="class-join-panel" data-testid="class-join-panel">
  <h3 class="panel-title">Classroom</h3>

  {#if classroom.classroomId}
    <div class="enrolled-info" data-testid="enrolled-class-info">
      <p class="enrolled-label">Enrolled in:</p>
      <p class="enrolled-name" data-testid="enrolled-class-name">{classroom.className}</p>
      <button class="leave-btn" onclick={leaveClass} data-testid="leave-class-btn">
        Leave Class
      </button>
    </div>
  {:else}
    <p class="join-description">Enter the 6-character code from your teacher.</p>
    <div class="join-row">
      <input
        type="text"
        bind:value={joinCode}
        placeholder="E.g. GEO42X"
        maxlength="6"
        disabled={loading}
        aria-label="Class join code"
        class="join-code-input"
        data-testid="join-code-input"
      />
      <button
        onclick={handleJoin}
        disabled={loading || joinCode.trim().length !== 6}
        class="join-btn"
        data-testid="join-class-btn"
      >
        {loading ? 'Joining…' : 'Join'}
      </button>
    </div>
    {#if error}
      <p class="join-error" role="alert" data-testid="join-error">{error}</p>
    {/if}
    {#if success}
      <p class="join-success" role="status" data-testid="join-success">{success}</p>
    {/if}
  {/if}
</div>

<style>
  .class-join-panel {
    padding: 12px 0;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #a0d4b8;
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .join-description {
    font-size: 13px;
    color: #8a9baa;
    margin: 0 0 8px 0;
  }

  .join-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .join-code-input {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid #3a4a58;
    border-radius: 6px;
    background: #1a2530;
    color: #e0f0f8;
    font-size: 14px;
    font-family: monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    outline: none;
  }

  .join-code-input:focus {
    border-color: #4a9b7f;
  }

  .join-code-input:disabled {
    opacity: 0.5;
  }

  .join-btn {
    padding: 8px 16px;
    background: #4a9b7f;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .join-btn:disabled {
    background: #2a4a3a;
    color: #5a7a6a;
    cursor: not-allowed;
  }

  .join-error {
    font-size: 12px;
    color: #e87070;
    margin: 6px 0 0 0;
  }

  .join-success {
    font-size: 12px;
    color: #70e8a8;
    margin: 6px 0 0 0;
  }

  .enrolled-info {
    background: #1a2530;
    border: 1px solid #2a3a4a;
    border-radius: 8px;
    padding: 10px 12px;
  }

  .enrolled-label {
    font-size: 11px;
    color: #6a8a9a;
    margin: 0 0 2px 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .enrolled-name {
    font-size: 14px;
    color: #e0f0f8;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .leave-btn {
    font-size: 12px;
    color: #8a9baa;
    background: none;
    border: 1px solid #3a4a58;
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
  }

  .leave-btn:hover {
    color: #e87070;
    border-color: #e87070;
  }
</style>

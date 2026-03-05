<script lang="ts">
  import { api } from '../lib/api'
  import CategoryPicker from '../components/CategoryPicker.svelte'

  interface Props {
    classId: string
    assignmentId?: string
    navigate: (page: string, params?: Record<string, string>) => void
  }

  let { classId, assignmentId, navigate }: Props = $props()

  let title = $state('')
  let selectedCategories = $state<string[]>([])
  let startDate = $state('')
  let dueDate = $state('')
  let error = $state('')
  let submitting = $state(false)

  const isEdit = $derived(assignmentId !== undefined)

  // Build preview text
  const previewText = $derived(() => {
    if (selectedCategories.length === 0 || !startDate || !dueDate) return ''
    const cats = selectedCategories.join(' and ')
    return `Students in this class will see quiz questions focused on ${cats} from ${startDate} to ${dueDate}.`
  })

  async function handleSubmit(): Promise<void> {
    if (!title.trim()) { error = 'Assignment title required'; return }
    if (selectedCategories.length === 0) { error = 'Select at least one category'; return }
    if (!startDate || !dueDate) { error = 'Both start and due dates are required'; return }

    const start = new Date(startDate).getTime()
    const due = new Date(dueDate).getTime()
    if (due <= start) { error = 'Due date must be after start date'; return }

    submitting = true
    error = ''
    try {
      await api.post(`/classrooms/${classId}/assignments`, {
        title: title.trim(),
        categories: selectedCategories,
        startDate: start,
        dueDate: due,
      })
      navigate('class', { classId })
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create assignment'
    } finally {
      submitting = false
    }
  }
</script>

<div class="page-container" data-testid="assignment-editor">
  <button class="back-btn" type="button" onclick={() => navigate('class', { classId })}>
    ← Back to Class
  </button>

  <h1 class="page-title">{isEdit ? 'Edit Assignment' : 'New Assignment'}</h1>

  <div class="card editor-card">
    <form onsubmit={(e) => { e.preventDefault(); void handleSubmit() }}>
      <div class="form-group">
        <label class="form-label" for="assignment-title">
          Assignment title <span style="color:var(--color-danger)">*</span>
        </label>
        <input
          id="assignment-title"
          class="form-input"
          type="text"
          bind:value={title}
          maxlength="200"
          placeholder="e.g. Week 3 — Geology Review"
          data-testid="assignment-title-input"
          disabled={submitting}
          required
        />
      </div>

      <div class="form-group">
        <p class="form-label">
          Fact categories <span style="color:var(--color-danger)">*</span>
        </p>
        <CategoryPicker
          selected={selectedCategories}
          onChange={(cats) => { selectedCategories = cats }}
        />
      </div>

      <div class="date-row">
        <div class="form-group">
          <label class="form-label" for="start-date">Start date</label>
          <input
            id="start-date"
            class="form-input"
            type="date"
            bind:value={startDate}
            data-testid="assignment-start-date"
            disabled={submitting}
            required
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="due-date">Due date</label>
          <input
            id="due-date"
            class="form-input"
            type="date"
            bind:value={dueDate}
            data-testid="assignment-due-date"
            disabled={submitting}
            required
          />
        </div>
      </div>

      {#if previewText()}
        <div class="preview-box">
          <p class="preview-label">Preview:</p>
          <p class="preview-text">{previewText()}</p>
        </div>
      {/if}

      {#if error}
        <p class="error-text" role="alert">{error}</p>
      {/if}

      <div class="form-actions">
        <button
          class="btn btn-secondary"
          type="button"
          onclick={() => navigate('class', { classId })}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          type="submit"
          data-testid="assignment-submit-btn"
          disabled={submitting || !title.trim() || selectedCategories.length === 0 || !startDate || !dueDate}
        >
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Assignment'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .back-btn {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0;
    margin-bottom: 20px;
    display: inline-block;
  }
  .back-btn:hover { text-decoration: underline; }

  .editor-card {
    max-width: 640px;
  }

  .date-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .preview-box {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 16px;
  }

  .preview-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-primary);
    margin-bottom: 4px;
  }

  .preview-text {
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }
</style>

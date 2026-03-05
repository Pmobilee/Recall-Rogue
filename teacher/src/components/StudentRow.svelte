<script lang="ts">
  import type { StudentAnalyticsSummary } from '../types/index'

  interface Props {
    student: StudentAnalyticsSummary
    /** Called when the teacher removes this student from the class. */
    onRemove?: (studentId: string) => void
  }

  let { student, onRemove }: Props = $props()

  const masteryPct = $derived(Math.round(student.masteryRate * 100))

  const lastActiveLabel = $derived(() => {
    if (!student.lastActive) return 'Never'
    const days = Math.floor((Date.now() - student.lastActive) / 86400_000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days} days ago`
  })

  const masteryColor = $derived(
    masteryPct >= 70 ? 'var(--color-success)' :
    masteryPct >= 40 ? 'var(--color-warning)' :
    'var(--color-danger)'
  )
</script>

<tr class="student-row" class:struggling={student.isStruggling}>
  <td class="student-name">
    {student.displayName ?? 'Student'}
    {#if student.isStruggling}
      <span class="struggling-badge" title="Needs attention">!</span>
    {/if}
  </td>
  <td class="student-facts">{student.factsMastered}</td>
  <td class="student-mastery">
    <span style="color: {masteryColor}; font-weight: 500;">{masteryPct}%</span>
  </td>
  <td class="student-active">{lastActiveLabel()}</td>
  <td class="student-streak">{student.streakDays}d</td>
  {#if onRemove}
    <td class="student-actions">
      <button
        class="btn btn-danger"
        type="button"
        onclick={() => onRemove(student.studentId)}
        aria-label="Remove student from class"
        style="padding: 4px 10px; font-size: 0.8rem;"
      >
        Remove
      </button>
    </td>
  {/if}
</tr>

<style>
  .student-row td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.9rem;
  }

  .student-row.struggling td {
    background: #fff5f5;
  }

  .student-name {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .struggling-badge {
    background: var(--color-danger);
    color: white;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    font-size: 0.75rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
</style>

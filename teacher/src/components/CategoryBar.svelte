<script lang="ts">
  import ProgressBar from './ProgressBar.svelte'

  interface Props {
    /** Category name. */
    category: string
    /** Average mastery rate (0.0–1.0). */
    avgMastery: number
    /** Number of students who have encountered this category. */
    studentsCovered: number
  }

  let { category, avgMastery, studentsCovered }: Props = $props()

  const pct = $derived(Math.round(avgMastery * 100))

  const color = $derived(
    pct >= 70 ? 'var(--color-success)' :
    pct >= 40 ? 'var(--color-warning)' :
    'var(--color-danger)'
  )
</script>

<div class="category-bar">
  <div class="category-header">
    <span class="category-name">{category}</span>
    <span class="category-meta">{studentsCovered} students · {pct}% mastery</span>
  </div>
  <ProgressBar value={avgMastery} label="{pct}%" {color} />
</div>

<style>
  .category-bar {
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .category-bar:last-child {
    border-bottom: none;
  }

  .category-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
  }

  .category-name {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .category-meta {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../lib/api'
  import CategoryBar from '../components/CategoryBar.svelte'
  import StudentRow from '../components/StudentRow.svelte'
  import type { Classroom, ClassAnalytics, HomeworkAssignment, ClassAnnouncement } from '../types/index'

  interface Props {
    classId: string
    navigate: (page: string, params?: Record<string, string>) => void
  }

  let { classId, navigate }: Props = $props()

  let classroom = $state<Classroom | null>(null)
  let analytics = $state<ClassAnalytics | null>(null)
  let assignments = $state<HomeworkAssignment[]>([])
  let loading = $state(true)
  let error = $state('')

  // Announcement state
  let announcementMsg = $state('')
  let postingAnnouncement = $state(false)
  let announcementSuccess = $state('')
  let announcementError = $state('')

  // Progress report state
  let sendingReport = $state(false)
  let reportMsg = $state('')

  onMount(() => {
    void loadAll()
  })

  async function loadAll(): Promise<void> {
    loading = true
    error = ''
    try {
      const [classRes, analyticsRes, assignRes] = await Promise.all([
        api.get<{ classrooms: Classroom[] }>('/classrooms'),
        api.get<{ analytics: ClassAnalytics }>(`/classrooms/${classId}/analytics`),
        api.get<{ assignments: HomeworkAssignment[] }>(`/classrooms/${classId}/assignments`),
      ])
      classroom = classRes.classrooms.find(c => c.id === classId) ?? null
      analytics = analyticsRes.analytics
      assignments = assignRes.assignments
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load class data'
    } finally {
      loading = false
    }
  }

  async function handleRemoveStudent(studentId: string): Promise<void> {
    try {
      await api.delete(`/classrooms/${classId}/students/${studentId}`)
      if (analytics) {
        analytics = {
          ...analytics,
          students: analytics.students.filter(s => s.studentId !== studentId),
          studentCount: analytics.studentCount - 1,
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to remove student'
    }
  }

  async function handlePostAnnouncement(): Promise<void> {
    if (!announcementMsg.trim()) return
    postingAnnouncement = true
    announcementError = ''
    announcementSuccess = ''
    try {
      await api.post(`/classrooms/${classId}/announcements`, { message: announcementMsg.trim() })
      announcementSuccess = 'Announcement posted!'
      announcementMsg = ''
    } catch (e) {
      announcementError = e instanceof Error ? e.message : 'Failed to post announcement'
    } finally {
      postingAnnouncement = false
    }
  }

  async function handleSendProgressReport(): Promise<void> {
    sendingReport = true
    reportMsg = ''
    try {
      await api.post(`/classrooms/${classId}/progress-report`, {})
      reportMsg = 'Progress report emails are being sent!'
    } catch (e) {
      reportMsg = e instanceof Error ? e.message : 'Failed to queue report'
    } finally {
      sendingReport = false
    }
  }

  const avgMasteryPct = $derived(
    analytics ? Math.round(analytics.averageMasteryRate * 100) : 0
  )

  const categoryEntries = $derived(
    analytics
      ? Object.entries(analytics.categoryBreakdown).sort(
          (a, b) => b[1].avgMastery - a[1].avgMastery,
        )
      : []
  )

  const strugglingStudents = $derived(
    analytics ? analytics.students.filter(s => s.isStruggling) : []
  )
</script>

<div class="page-container" data-testid="class-detail-view">
  <!-- Back navigation -->
  <button class="back-btn" type="button" onclick={() => navigate('dashboard')}>
    ← Back to Dashboard
  </button>

  {#if loading}
    <div class="loading">Loading class data…</div>
  {:else if error}
    <p class="error-text" role="alert">{error}</p>
  {:else if !classroom || !analytics}
    <p class="error-text">Class not found.</p>
  {:else}
    <div class="class-header">
      <div>
        <h1 class="page-title">{classroom.name}</h1>
        <p class="class-meta">
          Join code: <code class="join-code">{classroom.joinCode}</code>
          &middot; {analytics.studentCount} students
        </p>
      </div>
      <button
        class="btn btn-primary"
        type="button"
        data-testid="create-assignment-btn"
        onclick={() => navigate('assignment', { classId })}
      >
        + New Assignment
      </button>
    </div>

    <!-- Panel 1: Class Overview -->
    <section class="analytics-panel card" data-testid="analytics-overview" aria-label="Class overview">
      <h2 class="panel-title">Class Overview</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">{analytics.studentCount}</div>
          <div class="stat-label">Students</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">{analytics.activeTodayCount}</div>
          <div class="stat-label">Active Today</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">{Math.round(analytics.averageFactsMastered)}</div>
          <div class="stat-label">Avg Facts Mastered</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: {avgMasteryPct >= 70 ? 'var(--color-success)' : avgMasteryPct >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'}">
            {avgMasteryPct}%
          </div>
          <div class="stat-label">Avg Mastery Rate</div>
        </div>
      </div>
    </section>

    <!-- Panel 2: Category Breakdown -->
    <section class="analytics-panel card" data-testid="analytics-category-breakdown" aria-label="Category breakdown">
      <h2 class="panel-title">Category Breakdown</h2>
      {#if categoryEntries.length === 0}
        <p class="empty-state">No quiz data yet.</p>
      {:else}
        {#each categoryEntries as [cat, data] (cat)}
          <CategoryBar
            category={cat}
            avgMastery={data.avgMastery}
            studentsCovered={data.studentsCovered}
          />
        {/each}
      {/if}
    </section>

    <!-- Panel 3: Student Progress Table -->
    <section class="analytics-panel card" data-testid="analytics-student-table" aria-label="Student progress">
      <h2 class="panel-title">Student Progress</h2>
      {#if analytics.students.length === 0}
        <p class="empty-state">No students yet. Share the join code: <code>{classroom.joinCode}</code></p>
      {:else}
        <div class="table-wrapper">
          <table class="student-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Facts Mastered</th>
                <th>Mastery Rate</th>
                <th>Last Active</th>
                <th>Streak</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each analytics.students as student (student.studentId)}
                <StudentRow {student} onRemove={handleRemoveStudent} />
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- Panel 4: Struggling Students -->
    <section class="analytics-panel card" data-testid="analytics-struggling" aria-label="Struggling students">
      <h2 class="panel-title">Needs Attention</h2>
      {#if strugglingStudents.length === 0}
        <p class="empty-state">No struggling students at this time.</p>
      {:else}
        <div class="table-wrapper">
          <table class="student-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Facts Mastered</th>
                <th>Mastery Rate</th>
                <th>Last Active</th>
                <th>Streak</th>
              </tr>
            </thead>
            <tbody>
              {#each strugglingStudents as student (student.studentId)}
                <StudentRow {student} />
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- Panel 5: Top Facts -->
    <section class="analytics-panel card" data-testid="analytics-top-facts" aria-label="Top facts">
      <h2 class="panel-title">Top Facts (Most Mastered)</h2>
      {#if analytics.topFacts.length === 0}
        <p class="empty-state">No mastery data yet.</p>
      {:else}
        <ol class="fact-list">
          {#each analytics.topFacts as fact (fact.factId)}
            <li class="fact-item">
              <span class="fact-text">{fact.factText}</span>
              <span class="fact-stat">{fact.masteredByCount} students</span>
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    <!-- Panel 6: Hardest Facts -->
    <section class="analytics-panel card" data-testid="analytics-hardest-facts" aria-label="Hardest facts">
      <h2 class="panel-title">Hardest Facts (Review in Class)</h2>
      {#if analytics.hardestFacts.length === 0}
        <p class="empty-state">No ease factor data yet.</p>
      {:else}
        <ol class="fact-list">
          {#each analytics.hardestFacts as fact (fact.factId)}
            <li class="fact-item">
              <span class="fact-text">{fact.factText}</span>
              <span class="fact-stat">ease {fact.avgEaseFactor.toFixed(1)}</span>
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    <!-- Assignments list -->
    <section class="analytics-panel card" aria-label="Assignments">
      <div class="section-header">
        <h2 class="panel-title">Assignments</h2>
        <button
          class="btn btn-secondary"
          type="button"
          style="font-size: 0.85rem; padding: 6px 12px;"
          onclick={() => navigate('assignment', { classId })}
        >
          + New
        </button>
      </div>
      {#if assignments.length === 0}
        <p class="empty-state">No assignments yet.</p>
      {:else}
        <ul class="assignment-list">
          {#each assignments as a (a.id)}
            <li class="assignment-item" data-testid="assignment-list-item">
              <div class="assignment-info">
                <span class="assignment-title">{a.title}</span>
                <span class="assignment-cats">{a.categories.join(', ')}</span>
              </div>
              <span class="assignment-dates">
                {new Date(a.startDate).toLocaleDateString()} – {new Date(a.dueDate).toLocaleDateString()}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Post Announcement -->
    <section class="analytics-panel card" aria-label="Post announcement">
      <h2 class="panel-title">Post Announcement</h2>
      <p class="section-hint">Students will see this message as a banner in the game for 14 days.</p>
      <form onsubmit={(e) => { e.preventDefault(); void handlePostAnnouncement() }}>
        <div class="form-group">
          <textarea
            class="form-input"
            bind:value={announcementMsg}
            maxlength="280"
            rows="3"
            placeholder="e.g. Geology quiz on Friday — review Chapter 3!"
            disabled={postingAnnouncement}
            aria-label="Announcement message"
          ></textarea>
          <p class="char-count">{announcementMsg.length}/280</p>
        </div>
        {#if announcementError}
          <p class="error-text" role="alert">{announcementError}</p>
        {/if}
        {#if announcementSuccess}
          <p class="success-text" role="status">{announcementSuccess}</p>
        {/if}
        <button
          class="btn btn-primary"
          type="submit"
          disabled={postingAnnouncement || announcementMsg.trim().length === 0}
        >
          {postingAnnouncement ? 'Posting…' : 'Post Announcement'}
        </button>
      </form>
    </section>

    <!-- Progress Reports -->
    <section class="analytics-panel card" aria-label="Progress reports">
      <h2 class="panel-title">Progress Reports</h2>
      <p class="section-hint">
        Send each student an email summary of their progress this week.
        Students under 13 without a parent email on file will be skipped.
      </p>
      {#if reportMsg}
        <p class="success-text" role="status">{reportMsg}</p>
      {/if}
      <button
        class="btn btn-secondary"
        type="button"
        onclick={() => void handleSendProgressReport()}
        disabled={sendingReport}
      >
        {sendingReport ? 'Queuing…' : 'Send Progress Reports'}
      </button>
    </section>
  {/if}
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

  .class-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .class-meta {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin-top: 4px;
  }

  .join-code {
    font-family: monospace;
    font-weight: 700;
    color: var(--color-primary);
  }

  .analytics-panel {
    margin-bottom: 20px;
  }

  .panel-title {
    font-size: 1.1rem;
    margin-bottom: 16px;
    color: var(--color-text);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
  }

  .stat-box {
    text-align: center;
    padding: 12px;
    background: var(--color-bg);
    border-radius: var(--radius);
  }

  .stat-value {
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    margin-top: 4px;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .student-table {
    width: 100%;
    border-collapse: collapse;
  }

  .student-table th {
    text-align: left;
    padding: 8px 12px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    border-bottom: 2px solid var(--color-border);
  }

  .fact-list {
    list-style: decimal;
    padding-left: 20px;
  }

  .fact-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    gap: 12px;
  }

  .fact-item:last-child { border-bottom: none; }

  .fact-text {
    flex: 1;
    font-size: 0.9rem;
  }

  .fact-stat {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .assignment-list {
    list-style: none;
  }

  .assignment-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-border);
    gap: 12px;
  }

  .assignment-item:last-child { border-bottom: none; }

  .assignment-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .assignment-title {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .assignment-cats {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .assignment-dates {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .section-header .panel-title {
    margin-bottom: 0;
  }

  .section-hint {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .char-count {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-align: right;
    margin-top: 4px;
  }
</style>

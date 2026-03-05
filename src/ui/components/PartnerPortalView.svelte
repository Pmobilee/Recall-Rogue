<script lang="ts">
  type ViewState = 'form' | 'pending' | 'dashboard'

  interface UsageRow {
    endpoint: string
    total_requests: number
  }

  interface DashboardData {
    org: { name: string; domain: string; tier: string }
    quota: { perDay: number; perMin: number }
    usageLast7Days: UsageRow[]
  }

  // State
  let viewState: ViewState = 'form'
  let partnerId = ''
  let apiKey = ''
  let dashboardData: DashboardData | null = null

  // Form fields
  let orgName = ''
  let domain = ''
  let orgType = 'k12'
  let contactEmail = ''
  let contactName = ''

  // Content config
  let ageRating = 'teen'
  let selectedCategories: string[] = []

  let submitting = false
  let loadingDashboard = false
  let errorMsg = ''
  let successMsg = ''

  const orgTypes = [
    { value: 'k12', label: 'K-12 School' },
    { value: 'university', label: 'University / College' },
    { value: 'nonprofit', label: 'Nonprofit Organization' },
    { value: 'edtech', label: 'EdTech Company' },
  ]

  const availableCategories = [
    'Biology', 'Chemistry', 'Physics', 'Astronomy', 'Geography',
    'History', 'Mathematics', 'Language Arts', 'Computer Science',
  ]

  // Check localStorage for stored API key on mount
  $: {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('partner-api-key')
      if (stored && viewState === 'form') {
        apiKey = stored
        void loadDashboard()
      }
    }
  }

  async function handleRegister(): Promise<void> {
    errorMsg = ''
    if (!orgName.trim() || !domain.trim() || !contactEmail.trim() || !contactName.trim()) {
      errorMsg = 'All fields are required'
      return
    }
    submitting = true
    try {
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName.trim(),
          domain: domain.trim().toLowerCase(),
          orgType,
          contactEmail: contactEmail.trim(),
          contactName: contactName.trim(),
        }),
      })
      const data = await res.json() as { partnerId?: string; error?: string }
      if (!res.ok) {
        errorMsg = data.error ?? 'Registration failed'
      } else {
        partnerId = data.partnerId ?? ''
        viewState = 'pending'
      }
    } catch {
      errorMsg = 'Network error. Please try again.'
    } finally {
      submitting = false
    }
  }

  async function loadDashboard(): Promise<void> {
    if (!apiKey.trim()) {
      errorMsg = 'Enter your API key to view the dashboard'
      return
    }
    loadingDashboard = true
    errorMsg = ''
    try {
      const res = await fetch('/api/partner/dashboard', {
        headers: { 'x-api-key': apiKey },
      })
      const data = await res.json() as DashboardData & { error?: string }
      if (!res.ok) {
        errorMsg = data.error ?? 'Failed to load dashboard'
      } else {
        dashboardData = data
        localStorage.setItem('partner-api-key', apiKey)
        viewState = 'dashboard'
      }
    } catch {
      errorMsg = 'Network error. Please try again.'
    } finally {
      loadingDashboard = false
    }
  }

  async function saveContentConfig(): Promise<void> {
    errorMsg = ''
    successMsg = ''
    try {
      const res = await fetch('/api/partner/dashboard/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          ageRating,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        }),
      })
      if (res.ok) {
        successMsg = 'Content configuration saved.'
      } else {
        const data = await res.json() as { error?: string }
        errorMsg = data.error ?? 'Failed to save config'
      }
    } catch {
      errorMsg = 'Network error saving config.'
    }
  }

  function toggleCategory(cat: string): void {
    if (selectedCategories.includes(cat)) {
      selectedCategories = selectedCategories.filter(c => c !== cat)
    } else {
      selectedCategories = [...selectedCategories, cat]
    }
  }

  function signOut(): void {
    localStorage.removeItem('partner-api-key')
    apiKey = ''
    dashboardData = null
    viewState = 'form'
  }
</script>

<div class="portal-container">
  <div class="portal-card">
    <h1 class="portal-title">Terra Gacha Partner Portal</h1>
    <p class="portal-subtitle">
      Educational institutions can access the full fact database for classroom integration.
    </p>

    {#if errorMsg}
      <div class="alert error">{errorMsg}</div>
    {/if}
    {#if successMsg}
      <div class="alert success">{successMsg}</div>
    {/if}

    <!-- ── Registration Form ─────────────────────────────────────────────── -->
    {#if viewState === 'form'}
      <div class="section">
        <h2>Apply for Partnership</h2>
        <label class="field-label">
          Organization Name
          <input type="text" bind:value={orgName} placeholder="Springfield Elementary School" maxlength="200" />
        </label>
        <label class="field-label">
          Domain
          <input type="text" bind:value={domain} placeholder="springfield.edu" maxlength="100" />
          <span class="hint">Your institution's primary web domain</span>
        </label>
        <label class="field-label">
          Organization Type
          <select bind:value={orgType}>
            {#each orgTypes as t}
              <option value={t.value}>{t.label}</option>
            {/each}
          </select>
        </label>
        <label class="field-label">
          Contact Name
          <input type="text" bind:value={contactName} placeholder="Dr. Jane Smith" maxlength="200" />
        </label>
        <label class="field-label">
          Contact Email
          <input type="email" bind:value={contactEmail} placeholder="j.smith@springfield.edu" maxlength="200" />
        </label>
        <button class="primary-btn" on:click={handleRegister} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>

      <div class="section divider">
        <h2>Already have an API key?</h2>
        <label class="field-label">
          API Key
          <input type="password" bind:value={apiKey} placeholder="tg_live_..." maxlength="100" />
        </label>
        <button class="secondary-btn" on:click={loadDashboard} disabled={loadingDashboard}>
          {loadingDashboard ? 'Loading...' : 'View Dashboard'}
        </button>
      </div>

    <!-- ── Pending Confirmation ──────────────────────────────────────────── -->
    {:else if viewState === 'pending'}
      <div class="pending-state">
        <div class="check-icon">✓</div>
        <h2>Application Submitted</h2>
        <p>
          Your application for <strong>{orgName}</strong> has been received.
          Reference ID: <code>{partnerId}</code>
        </p>
        <p>We will review your application and contact you at <strong>{contactEmail}</strong> within 2 business days.</p>
        <p>Once approved, you will receive an API key that grants institutional-tier access.</p>
        <button class="secondary-btn" on:click={() => { viewState = 'form' }}>
          Back to portal
        </button>
      </div>

    <!-- ── Dashboard ─────────────────────────────────────────────────────── -->
    {:else if viewState === 'dashboard' && dashboardData}
      <div class="dashboard">
        <div class="dash-header">
          <div>
            <h2>{dashboardData.org.name}</h2>
            <p class="dash-meta">{dashboardData.org.domain} · <span class="tier-badge">{dashboardData.org.tier}</span></p>
          </div>
          <button class="sign-out-btn" on:click={signOut}>Sign out</button>
        </div>

        <div class="quota-cards">
          <div class="quota-card">
            <span class="quota-label">Daily Quota</span>
            <span class="quota-val">{dashboardData.quota.perDay.toLocaleString()} req/day</span>
          </div>
          <div class="quota-card">
            <span class="quota-label">Per-Minute</span>
            <span class="quota-val">{dashboardData.quota.perMin} req/min</span>
          </div>
        </div>

        <h3>Usage — Last 7 Days</h3>
        {#if dashboardData.usageLast7Days.length === 0}
          <p class="empty-text">No usage recorded yet.</p>
        {:else}
          <table class="usage-table">
            <thead>
              <tr><th>Endpoint</th><th>Requests</th></tr>
            </thead>
            <tbody>
              {#each dashboardData.usageLast7Days as row}
                <tr>
                  <td><code>{row.endpoint}</code></td>
                  <td>{row.total_requests.toLocaleString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}

        <h3>Content Configuration</h3>
        <label class="field-label">
          Age Rating Filter
          <select bind:value={ageRating}>
            <option value="child">Child (G-rated)</option>
            <option value="teen">Teen (default)</option>
            <option value="adult">Adult (all content)</option>
          </select>
        </label>
        <div class="category-filter">
          <span class="field-label">Category Allowlist (leave empty for all)</span>
          <div class="cat-toggles">
            {#each availableCategories as cat}
              <button
                class="cat-toggle"
                class:active={selectedCategories.includes(cat)}
                on:click={() => toggleCategory(cat)}
              >
                {cat}
              </button>
            {/each}
          </div>
        </div>
        <button class="primary-btn" on:click={saveContentConfig}>
          Save Configuration
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .portal-container {
    min-height: 100vh;
    background: #0d1a2d;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 20px;
    color: #e0e0e0;
  }
  .portal-card {
    background: #16213e;
    border-radius: 12px;
    padding: 32px;
    max-width: 600px;
    width: 100%;
    border: 1px solid #2D5382;
  }
  .portal-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    color: #e94560;
    margin: 0 0 8px;
  }
  .portal-subtitle {
    color: #a0a0a0;
    font-size: 13px;
    margin: 0 0 24px;
    line-height: 1.5;
  }
  .alert {
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .alert.error { background: #4a1a1a; color: #f44336; border: 1px solid #f44336; }
  .alert.success { background: #1a4a1a; color: #4caf50; border: 1px solid #4caf50; }
  .section {
    margin-bottom: 24px;
  }
  .section.divider {
    border-top: 1px solid #2D5382;
    padding-top: 20px;
  }
  h2 {
    font-size: 14px;
    color: #e0e0e0;
    margin: 0 0 16px;
  }
  h3 {
    font-size: 12px;
    color: #ccc;
    margin: 20px 0 10px;
  }
  .field-label {
    display: block;
    color: #a0a0a0;
    font-size: 12px;
    margin-bottom: 14px;
    font-weight: bold;
  }
  input, select, textarea {
    display: block;
    width: 100%;
    background: #0f3460;
    border: 1px solid #2D5382;
    color: #e0e0e0;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 13px;
    margin-top: 4px;
    box-sizing: border-box;
  }
  .hint { color: #666; font-size: 10px; margin-top: 2px; display: block; font-weight: normal; }
  .primary-btn {
    background: #e94560;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    cursor: pointer;
    width: 100%;
    margin-top: 8px;
  }
  .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .secondary-btn {
    background: #2D5382;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    width: 100%;
    margin-top: 8px;
  }
  .pending-state {
    text-align: center;
    padding: 20px 0;
  }
  .check-icon {
    font-size: 48px;
    color: #4caf50;
    margin-bottom: 12px;
  }
  .pending-state p { color: #a0a0a0; font-size: 13px; line-height: 1.6; margin: 8px 0; }
  code {
    background: #0f3460;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
  }
  .dashboard {}
  .dash-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }
  .dash-meta { color: #888; font-size: 12px; margin: 4px 0 0; }
  .tier-badge {
    background: #e94560;
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
  }
  .sign-out-btn {
    background: none;
    border: 1px solid #888;
    color: #888;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .quota-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  .quota-card {
    background: #0f3460;
    border-radius: 8px;
    padding: 14px;
    text-align: center;
  }
  .quota-label { display: block; color: #888; font-size: 11px; margin-bottom: 6px; }
  .quota-val { display: block; color: #e0e0e0; font-size: 14px; font-weight: bold; }
  .usage-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 20px;
  }
  .usage-table th {
    background: #0f3460;
    color: #ccc;
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #2D5382;
  }
  .usage-table td {
    padding: 8px;
    border-bottom: 1px solid #1a3a6e;
    color: #a0a0a0;
  }
  .empty-text { color: #666; font-size: 12px; }
  .category-filter { margin-bottom: 14px; }
  .cat-toggles { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .cat-toggle {
    background: #0f3460;
    border: 1px solid #2D5382;
    color: #a0a0a0;
    padding: 4px 10px;
    border-radius: 16px;
    cursor: pointer;
    font-size: 11px;
  }
  .cat-toggle.active {
    background: #2D5382;
    border-color: #e94560;
    color: #e0e0e0;
  }
</style>

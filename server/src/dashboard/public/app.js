/**
 * Recall Rogue Fact Dashboard — frontend application.
 * Vanilla JS with tab-based navigation, direct API calls, and table rendering.
 */

'use strict';

// ── State ────────────────────────────────────────────────────────────────────

let currentTab = 'facts';
let factsOffset = 0;
let factsStatus = '';
const FACTS_PAGE_SIZE = 50;

// ── Core navigation ──────────────────────────────────────────────────────────

/**
 * Switch the active tab and load its content.
 * @param {string} name - Tab name to show.
 */
function showTab(name) {
  currentTab = name;

  // Update tab button styles
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.remove('active');
    if (btn.textContent.toLowerCase().replace(/\s+/g, '-') === name ||
        btn.getAttribute('onclick') === `showTab('${name}')`) {
      btn.classList.add('active');
    }
  });

  const loaders = {
    'facts': () => loadFacts(factsStatus),
    'gap-analysis': loadGapAnalysis,
    'distractor-review': loadDistractorReview,
    'metrics': loadMetrics,
    'sprites': loadSprites,
    'pipeline': loadPipelineStatus,
  };

  if (loaders[name]) {
    loaders[name]();
  }
}

// ── API helpers ──────────────────────────────────────────────────────────────

/**
 * Fetch JSON from a dashboard API endpoint.
 * @param {string} path - API path (e.g. '/dashboard/api/facts').
 * @returns {Promise<any>} Parsed JSON response.
 */
async function api(path) {
  const response = await fetch(path);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

/**
 * POST to a dashboard API endpoint.
 * @param {string} path - API path.
 * @param {any} [body] - Optional JSON body.
 * @returns {Promise<any>} Parsed JSON response.
 */
async function apiPost(path, body) {
  const opts = {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  };
  const response = await fetch(path, opts);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

// ── Utility renderers ────────────────────────────────────────────────────────

/**
 * Render a status badge span.
 * @param {string} status - Status string.
 * @returns {string} HTML string.
 */
function renderBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

/**
 * Render a confidence value with color coding.
 * @param {number} conf - Confidence 0-1.
 * @returns {string} HTML string.
 */
function renderConfidence(conf) {
  const cls = conf >= 0.7 ? 'conf-high' : conf >= 0.5 ? 'conf-medium' : 'conf-low';
  return `<span class="${cls}">${conf.toFixed(2)}</span>`;
}

/**
 * Format a Unix timestamp (ms) as a locale date string.
 * @param {number} ts - Timestamp in milliseconds.
 * @returns {string} Formatted date.
 */
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, {
    year: '2-digit', month: 'short', day: 'numeric'
  });
}

/**
 * Set the main content area HTML.
 * @param {string} html - HTML string to render.
 */
function setContent(html) {
  document.getElementById('content').innerHTML = html;
}

// ── Tab: Facts ────────────────────────────────────────────────────────────────

/**
 * Load and render the facts list with optional status filter.
 * @param {string} [status] - Status filter: 'draft' | 'approved' | 'archived' | ''.
 */
async function loadFacts(status) {
  factsStatus = status || '';
  setContent('<div class="loading">Loading facts...</div>');

  try {
    const statusParam = factsStatus ? `&status=${factsStatus}` : '';
    const data = await api(
      `/dashboard/api/facts?limit=${FACTS_PAGE_SIZE}&offset=${factsOffset}${statusParam}`
    );

    const filterBtns = ['', 'draft', 'approved', 'archived']
      .map((s) => {
        const label = s || 'All';
        const active = factsStatus === s ? 'active' : '';
        return `<button class="filter-btn ${active}" onclick="loadFacts('${s}')">${label}</button>`;
      })
      .join('');

    const rows = data.facts.map((f) => `
      <tr>
        <td class="truncate">${escapeHtml(f.statement)}</td>
        <td>${renderBadge(f.status)}</td>
        <td>${escapeHtml(f.category_l1 || '—')}</td>
        <td>${f.difficulty ?? '—'}</td>
        <td>${f.distractor_count ?? 0}</td>
        <td>${renderBadge(f.pixel_art_status || 'none')}</td>
        <td>${formatDate(f.created_at)}</td>
        <td>
          <button class="btn btn-primary" onclick="loadFactDetail('${f.id}')">View</button>
          ${f.status !== 'approved' ? `<button class="btn btn-success" onclick="approveFact('${f.id}')">Approve</button>` : ''}
          ${f.status !== 'archived' ? `<button class="btn btn-danger" onclick="archiveFact('${f.id}')">Archive</button>` : ''}
        </td>
      </tr>
    `).join('');

    const totalPages = Math.ceil(data.total / FACTS_PAGE_SIZE);
    const currentPage = Math.floor(factsOffset / FACTS_PAGE_SIZE) + 1;

    setContent(`
      <div class="card">
        <div class="card-header">
          <h2>Facts (${data.total} total)</h2>
        </div>
        <div class="card-body">
          <div class="filter-bar">
            <label>Status:</label>
            ${filterBtns}
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Statement</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Difficulty</th>
                  <th>Distractors</th>
                  <th>Sprite</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="8" class="empty-state">No facts found</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <button class="btn btn-ghost" onclick="changePage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>&larr; Prev</button>
            <span class="page-info">Page ${currentPage} of ${totalPages || 1}</span>
            <button class="btn btn-ghost" onclick="changePage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="card card-body"><p class="conf-low">Error: ${escapeHtml(err.message)}</p></div>`);
  }
}

/**
 * Change the facts list page.
 * @param {number} delta - Page delta (+1 or -1).
 */
function changePage(delta) {
  factsOffset = Math.max(0, factsOffset + delta * FACTS_PAGE_SIZE);
  loadFacts(factsStatus);
}

/**
 * Load and display the detail view for a single fact in the modal.
 * @param {string} id - Fact ID.
 */
async function loadFactDetail(id) {
  showModal('<div class="loading">Loading...</div>');

  try {
    const data = await api(`/dashboard/api/facts/${id}`);
    const f = data.fact;

    const distractorRows = data.distractors.map((d) => `
      <tr>
        <td>${escapeHtml(d.text)}</td>
        <td>${d.difficulty_tier}</td>
        <td>${renderConfidence(d.distractor_confidence)}</td>
        <td>${d.is_approved ? '<span class="conf-high">Yes</span>' : '<span class="conf-low">No</span>'}</td>
      </tr>
    `).join('');

    const reportRows = data.reports.map((r) => `
      <tr>
        <td>${escapeHtml(r.report_text)}</td>
        <td>${escapeHtml(r.player_id || 'Anonymous')}</td>
        <td>${formatDate(r.created_at)}</td>
      </tr>
    `).join('');

    const detailHtml = `
      <h2 style="margin-bottom:16px;color:var(--accent)">${escapeHtml(f.statement)}</h2>

      <div class="detail-grid" style="margin-bottom:20px">
        <div class="detail-item"><div class="key">Status</div><div class="value">${renderBadge(f.status)}</div></div>
        <div class="detail-item"><div class="key">Category</div><div class="value">${escapeHtml([f.category_l1, f.category_l2].filter(Boolean).join(' > ') || '—')}</div></div>
        <div class="detail-item"><div class="key">Difficulty</div><div class="value">${f.difficulty ?? '—'}/5</div></div>
        <div class="detail-item"><div class="key">Fun Score</div><div class="value">${f.fun_score ?? '—'}/10</div></div>
        <div class="detail-item"><div class="key">Novelty</div><div class="value">${f.novelty_score ?? '—'}/10</div></div>
        <div class="detail-item"><div class="key">Age Rating</div><div class="value">${escapeHtml(f.age_rating || '—')}</div></div>
        <div class="detail-item"><div class="key">Reports</div><div class="value">${f.in_game_reports ?? 0}</div></div>
        <div class="detail-item"><div class="key">DB Version</div><div class="value">${f.db_version ?? 0}</div></div>
      </div>

      <div class="detail-section">
        <h3>Quiz Question</h3>
        <div class="detail-text">${escapeHtml(f.quiz_question || '—')}</div>
      </div>

      <div class="detail-section">
        <h3>Correct Answer</h3>
        <div class="detail-text">${escapeHtml(f.correct_answer || '—')}</div>
      </div>

      <div class="detail-section">
        <h3>Explanation</h3>
        <div class="detail-text">${escapeHtml(f.explanation || '—')}</div>
      </div>

      ${f.mnemonic ? `
      <div class="detail-section">
        <h3>Mnemonic</h3>
        <div class="detail-text">${escapeHtml(f.mnemonic)}</div>
      </div>` : ''}

      <div class="detail-section">
        <h3>Distractors (${data.distractors.length})</h3>
        ${data.distractors.length > 0 ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Text</th><th>Tier</th><th>Confidence</th><th>Approved</th></tr></thead>
              <tbody>${distractorRows}</tbody>
            </table>
          </div>
        ` : '<p class="text-muted">No distractors generated yet.</p>'}
      </div>

      ${data.reports.length > 0 ? `
      <div class="detail-section">
        <h3>Player Reports (${data.reports.length})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Report</th><th>Player</th><th>Date</th></tr></thead>
            <tbody>${reportRows}</tbody>
          </table>
        </div>
      </div>` : ''}

      <div style="margin-top:20px; display:flex; gap:8px; flex-wrap:wrap">
        ${f.status !== 'approved' ? `<button class="btn btn-success" onclick="approveFact('${f.id}');closeModal()">Approve</button>` : ''}
        ${f.status !== 'archived' ? `<button class="btn btn-danger" onclick="archiveFact('${f.id}');closeModal()">Archive</button>` : ''}
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      </div>
    `;

    showModal(detailHtml);
  } catch (err) {
    showModal(`<p class="conf-low">Error: ${escapeHtml(err.message)}</p>`);
  }
}

// ── Tab: Gap Analysis ─────────────────────────────────────────────────────────

/**
 * Load and render the category gap analysis table.
 */
async function loadGapAnalysis() {
  setContent('<div class="loading">Analysing gaps...</div>');

  try {
    const data = await api('/dashboard/api/gap-analysis');

    const rows = data.gaps.map((g) => {
      const pct = Math.round((g.fact_count / 20) * 100);
      const barWidth = Math.min(pct, 100);
      const cls = g.fact_count >= 20 ? 'conf-high' : g.fact_count >= 10 ? 'conf-medium' : 'conf-low';
      return `
        <tr>
          <td>${escapeHtml(g.category_l1 || 'Uncategorized')}</td>
          <td class="${cls}">${g.fact_count}</td>
          <td>
            <div style="background:var(--border);border-radius:2px;height:8px;width:200px">
              <div style="background:var(--accent);border-radius:2px;height:100%;width:${barWidth}%"></div>
            </div>
          </td>
          <td class="text-muted">${Math.max(0, 20 - g.fact_count)} needed</td>
        </tr>
      `;
    }).join('');

    setContent(`
      <div class="card">
        <div class="card-header"><h2>Category Gap Analysis</h2></div>
        <div class="card-body">
          <p class="text-muted" style="margin-bottom:12px">
            Target: 20+ approved facts per category. Categories sorted by fact count ascending.
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Category</th><th>Approved Facts</th><th>Progress (to 20)</th><th>Gap</th></tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="4" class="empty-state">No data yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="card card-body"><p class="conf-low">Error: ${escapeHtml(err.message)}</p></div>`);
  }
}

// ── Tab: Distractor Review ────────────────────────────────────────────────────

/**
 * Load and render the low-confidence distractor review table.
 */
async function loadDistractorReview() {
  setContent('<div class="loading">Loading distractors...</div>');

  try {
    const data = await api('/dashboard/api/distractor-review');

    const rows = data.distractors.map((d) => `
      <tr>
        <td class="truncate text-muted">${escapeHtml(d.fact_statement || '—')}</td>
        <td>${escapeHtml(d.text)}</td>
        <td>${d.difficulty_tier}</td>
        <td>${renderConfidence(d.distractor_confidence)}</td>
        <td>${d.is_approved ? '<span class="conf-high">Yes</span>' : '<span class="conf-low">No</span>'}</td>
      </tr>
    `).join('');

    setContent(`
      <div class="card">
        <div class="card-header"><h2>Distractor Review (${data.distractors.length})</h2></div>
        <div class="card-body">
          <p class="text-muted" style="margin-bottom:12px">
            Showing distractors with confidence below 0.9.
            <span class="conf-high">Green</span> &ge; 0.7,
            <span class="conf-medium">Yellow</span> 0.5-0.7,
            <span class="conf-low">Red</span> &lt; 0.5.
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Fact</th><th>Distractor Text</th><th>Tier</th><th>Confidence</th><th>Approved</th></tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="5" class="empty-state">All distractors look good!</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="card card-body"><p class="conf-low">Error: ${escapeHtml(err.message)}</p></div>`);
  }
}

// ── Tab: Quality Metrics ──────────────────────────────────────────────────────

/**
 * Load and render the quality metrics summary.
 */
async function loadMetrics() {
  setContent('<div class="loading">Loading metrics...</div>');

  try {
    const data = await api('/dashboard/api/quality-metrics');
    const t = data.totals;

    const statsHtml = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${t.total_facts ?? 0}</div><div class="stat-label">Total Facts</div></div>
        <div class="stat-card"><div class="stat-value">${t.approved_count ?? 0}</div><div class="stat-label">Approved</div></div>
        <div class="stat-card"><div class="stat-value">${t.draft_count ?? 0}</div><div class="stat-label">Draft</div></div>
        <div class="stat-card"><div class="stat-value">${t.archived_count ?? 0}</div><div class="stat-label">Archived</div></div>
        <div class="stat-card"><div class="stat-value">${t.overall_avg_fun ?? '—'}</div><div class="stat-label">Avg Fun Score</div></div>
        <div class="stat-card"><div class="stat-value">${t.overall_avg_novelty ?? '—'}</div><div class="stat-label">Avg Novelty</div></div>
      </div>
    `;

    const rows = data.byCategory.map((m) => `
      <tr>
        <td>${escapeHtml(m.category_l1 || 'Uncategorized')}</td>
        <td>${m.fact_count}</td>
        <td>${m.avg_fun_score}</td>
        <td>${m.avg_difficulty}</td>
      </tr>
    `).join('');

    setContent(`
      <div class="section-title">Quality Metrics</div>
      ${statsHtml}
      <div class="card">
        <div class="card-header"><h2>By Category</h2></div>
        <div class="card-body">
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Category</th><th>Approved Facts</th><th>Avg Fun Score</th><th>Avg Difficulty</th></tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="4" class="empty-state">No approved facts yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="card card-body"><p class="conf-low">Error: ${escapeHtml(err.message)}</p></div>`);
  }
}

// ── Tab: Sprites ──────────────────────────────────────────────────────────────

/**
 * Load and render the pending sprite generation queue.
 */
async function loadSprites() {
  setContent('<div class="loading">Loading sprite queue...</div>');

  try {
    const data = await api('/dashboard/api/sprites/pending');

    const rows = data.facts.map((f) => `
      <tr>
        <td class="truncate">${escapeHtml(f.statement)}</td>
        <td>${escapeHtml(f.category_l1 || '—')}</td>
        <td class="truncate text-muted">${escapeHtml(f.image_prompt || '—')}</td>
        <td>
          <button class="btn btn-primary" onclick="generateSprites('${f.id}')">Generate (3 variants)</button>
        </td>
      </tr>
    `).join('');

    setContent(`
      <div class="card">
        <div class="card-header"><h2>Pending Sprite Generation (${data.facts.length})</h2></div>
        <div class="card-body">
          <p class="text-muted" style="margin-bottom:12px">
            Approved facts with image prompts that have not yet had sprites generated.
            Requires ComfyUI running at the configured URL.
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Statement</th><th>Category</th><th>Image Prompt</th><th>Actions</th></tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="4" class="empty-state">No sprites pending — all facts have artwork!</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="card card-body"><p class="conf-low">Error: ${escapeHtml(err.message)}</p></div>`);
  }
}

// ── Tab: Pipeline ─────────────────────────────────────────────────────────────

/**
 * Load and render the pipeline queue status.
 */
async function loadPipelineStatus() {
  setContent('<div class="loading">Loading pipeline status...</div>');

  try {
    const data = await api('/dashboard/api/pipeline/status');
    const c = data.counts;

    const statsHtml = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${c.pending ?? 0}</div><div class="stat-label">Pending</div></div>
        <div class="stat-card"><div class="stat-value">${c.processing ?? 0}</div><div class="stat-label">Processing</div></div>
        <div class="stat-card"><div class="stat-value">${c.done ?? 0}</div><div class="stat-label">Done</div></div>
        <div class="stat-card" style="border-color:var(--danger)">
          <div class="stat-value conf-low">${c.failed ?? 0}</div>
          <div class="stat-label">Failed</div>
        </div>
      </div>
    `;

    const errorRows = (data.recentErrors || []).map((e) => `
      <tr>
        <td class="truncate text-muted">${escapeHtml(e.statement || e.fact_id)}</td>
        <td class="truncate conf-low">${escapeHtml(e.last_error || '—')}</td>
        <td>${e.attempts ?? 0}</td>
      </tr>
    `).join('');

    setContent(`
      <div class="section-title">Pipeline Status</div>
      ${statsHtml}
      ${data.recentErrors && data.recentErrors.length > 0 ? `
        <div class="card">
          <div class="card-header"><h2>Recent Failures</h2></div>
          <div class="card-body">
            <div class="table-wrap">
              <table>
                <thead><tr><th>Fact</th><th>Error</th><th>Attempts</th></tr></thead>
                <tbody>${errorRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      ` : '<div class="empty-state">No recent failures.</div>'}
    `);
  } catch (err) {
    setContent(`<div class="card card-body"><p class="conf-low">Error: ${escapeHtml(err.message)}</p></div>`);
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Approve a fact by ID.
 * @param {string} id - Fact ID.
 */
async function approveFact(id) {
  try {
    await apiPost(`/dashboard/api/facts/${id}/approve`);
    loadFacts(factsStatus);
  } catch (err) {
    alert(`Failed to approve fact: ${err.message}`);
  }
}

/**
 * Archive a fact by ID.
 * @param {string} id - Fact ID.
 */
async function archiveFact(id) {
  if (!confirm('Archive this fact? It will be soft-deleted and removed from the game.')) return;
  try {
    await apiPost(`/dashboard/api/facts/${id}/archive`);
    loadFacts(factsStatus);
  } catch (err) {
    alert(`Failed to archive fact: ${err.message}`);
  }
}

/**
 * Trigger sprite generation for a fact.
 * @param {string} factId - Fact ID.
 */
async function generateSprites(factId) {
  try {
    await apiPost(`/dashboard/api/sprites/${factId}/generate`);
    alert('Sprite generation started! Check back in a few minutes.');
    loadSprites();
  } catch (err) {
    alert(`Failed to start sprite generation: ${err.message}`);
  }
}

/**
 * Approve a specific sprite variant.
 * @param {string} factId - Fact ID.
 * @param {number} index - Variant index (0-based).
 */
async function approveSprite(factId, index) {
  try {
    await apiPost(`/dashboard/api/sprites/${factId}/approve/${index}`);
    alert('Sprite approved!');
    loadSprites();
  } catch (err) {
    alert(`Failed to approve sprite: ${err.message}`);
  }
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

/**
 * Show the modal overlay with the given HTML content.
 * @param {string} html - HTML to render inside the modal.
 */
function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

/**
 * Close the modal overlay.
 */
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

// ── Security: HTML escaping ───────────────────────────────────────────────────

/**
 * Escape a string for safe HTML rendering.
 * @param {string|null|undefined} str - String to escape.
 * @returns {string} HTML-safe string.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Close modal on overlay click ──────────────────────────────────────────────
document.getElementById('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ── Initial load ──────────────────────────────────────────────────────────────
showTab('facts');

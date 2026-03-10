/**
 * Server-side HTML renderer for the admin cohort dashboard (Phase 41.4).
 * Produces a self-contained HTML string — no client-side JS required.
 * Styled with inline CSS only (no external dependencies).
 */

import type { DashboardData } from '../services/dashboardService.js'

function pct(n: number | null): string {
  if (n === null) return '—'
  return (n * 100).toFixed(1) + '%'
}

function statusColor(actual: number | null, target: number): string {
  if (actual === null) return '#888'
  return actual >= target ? '#2ecc71' : '#e74c3c'
}

/**
 * Render the admin cohort dashboard as a self-contained HTML string.
 *
 * @param data - The assembled dashboard data from assembleDashboard().
 * @returns A complete HTML document string.
 */
export function renderDashboard(data: DashboardData): string {
  const r = data.retention
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Recall Rogue — Analytics Dashboard</title>
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #eee; margin: 0; padding: 24px; }
    h1 { color: #e94560; margin-bottom: 4px; }
    .ts { color: #888; font-size: 0.85em; margin-bottom: 32px; }
    h2 { color: #0f3460; background: #16213e; padding: 8px 12px; margin: 32px 0 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #16213e; color: #e94560; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #2a2a4a; }
    .ok { color: #2ecc71; } .warn { color: #f39c12; } .bad { color: #e74c3c; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; }
  </style>
</head>
<body>
  <h1>Recall Rogue — Analytics Dashboard</h1>
  <div class="ts">Generated: ${data.generatedAt} | Cohort: ${r.cohortDate}</div>

  <h2>Retention</h2>
  <table>
    <tr><th>Window</th><th>Actual</th><th>Target</th><th>Status</th></tr>
    <tr><td>D1</td><td style="color:${statusColor(r.d1, r.d1Target)}">${pct(r.d1)}</td><td>${pct(r.d1Target)}</td><td>${r.d1 === null ? '—' : r.d1 >= r.d1Target ? '✓' : '✗'}</td></tr>
    <tr><td>D7 (primary)</td><td style="color:${statusColor(r.d7, r.d7Target)}">${pct(r.d7)}</td><td>${pct(r.d7Target)}</td><td>${r.d7 === null ? '—' : r.d7 >= r.d7Target ? '✓' : '✗'}</td></tr>
    <tr><td>D30</td><td style="color:${statusColor(r.d30, r.d30Target)}">${pct(r.d30)}</td><td>${pct(r.d30Target)}</td><td>${r.d30 === null ? '—' : r.d30 >= r.d30Target ? '✓' : '✗'}</td></tr>
    <tr><td>D90</td><td style="color:${statusColor(r.d90, r.d90Target)}">${pct(r.d90)}</td><td>${pct(r.d90Target)}</td><td>${r.d90 === null ? '—' : r.d90 >= r.d90Target ? '✓' : '✗'}</td></tr>
  </table>

  <h2>A/B Experiments</h2>
  <table>
    <tr><th>Experiment</th><th>Impressions</th><th>Status</th><th>Winner</th></tr>
    ${data.experiments.map((e) => `
    <tr>
      <td>${e.name}</td>
      <td>${e.totalImpressions.toLocaleString()}</td>
      <td>${e.status}</td>
      <td>${e.winner ?? '—'}</td>
    </tr>`).join('')}
  </table>

  <h2>Funnels</h2>
  <table>
    <tr><th>Funnel</th><th>Entered</th><th>Overall Conv.</th><th>Worst Drop-off</th><th>Drop-off Rate</th></tr>
    ${data.funnels.map((f) => `
    <tr>
      <td>${f.label}</td>
      <td>${f.totalEntered.toLocaleString()}</td>
      <td>${pct(f.overallConversion)}</td>
      <td>${f.worstDropOffStep || '—'}</td>
      <td>${pct(f.worstDropOffRate)}</td>
    </tr>`).join('')}
  </table>

  <h2>Player Segments</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>D30 Active Players</td><td>${data.segments.totalD30Active.toLocaleString()}</td></tr>
    <tr><td>Mastery-Free %</td><td class="${data.segments.masteryFreeStatus === 'ok' ? 'ok' : 'bad'}">${data.segments.masteryFreePercent.toFixed(1)}%</td></tr>
    <tr><td>Monetisation Health</td><td>${data.segments.masteryFreeStatus}</td></tr>
  </table>
</body>
</html>`
}

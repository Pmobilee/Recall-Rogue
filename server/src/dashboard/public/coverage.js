(async () => {
  // Fetch from the main API server (port 3001) via admin key
  // In dashboard context, we proxy through a relative path or use the direct API
  const ADMIN_KEY = 'dev-admin-key-change-me';
  const res = await fetch('http://localhost:3001/api/admin/coverage', {
    headers: { 'X-Admin-Key': ADMIN_KEY },
  }).catch(() => null);

  const prog = document.getElementById('progress');
  const el = document.getElementById('content');

  if (!res || !res.ok) {
    prog.textContent = 'Error: Could not load coverage data. Is the API server running on port 3001?';
    prog.className = 'fail';
    return;
  }

  const data = await res.json();

  // Progress bar toward 3,000
  const approved = data.totals.find(t => t.status === 'approved')?.count ?? 0;
  const pct = Math.min(100, Math.round((approved / data.totalTarget) * 100));
  prog.innerHTML =
    '<span class="bar" style="width:' + (pct * 2) + 'px"></span> ' +
    approved + ' / ' + data.totalTarget + ' approved (' + pct + '%)';

  let html = '';

  // Category table
  html += '<h2>Category Coverage</h2><table><tr><th>Category</th>' +
    '<th>Approved</th><th>Draft</th><th>Archived</th><th>Status</th></tr>';
  const cats = {};
  for (const row of data.byCategory) {
    if (!cats[row.category_l1]) cats[row.category_l1] = {};
    cats[row.category_l1][row.status] = row.count;
  }
  for (const [cat, counts] of Object.entries(cats)) {
    const appr = counts['approved'] ?? 0;
    const cls = appr >= data.categoryThreshold ? 'pass' : appr >= 100 ? 'warn' : 'fail';
    html += '<tr>' +
      '<td>' + cat + '</td>' +
      '<td class="' + cls + '">' + appr + '</td>' +
      '<td>' + (counts['draft'] ?? 0) + '</td>' +
      '<td>' + (counts['archived'] ?? 0) + '</td>' +
      '<td class="' + cls + '">' + (appr >= data.categoryThreshold ? 'OK' : 'NEEDS ' + (data.categoryThreshold - appr) + ' MORE') + '</td>' +
      '</tr>';
  }
  html += '</table>';

  // Difficulty tier table
  html += '<h2>Difficulty Tier Distribution (approved)</h2><table><tr><th>Tier</th><th>Count</th><th>Bar</th></tr>';
  for (const row of data.byTier) {
    const w = Math.min(200, row.count / 5);
    html += '<tr><td>' + row.difficulty_tier + '</td><td>' + row.count + '</td>' +
      '<td><span class="bar" style="width:' + w + 'px"></span></td></tr>';
  }
  html += '</table>';

  // Quality score histogram
  html += '<h2>Quality Score Distribution</h2><table><tr><th>Score Bucket</th><th>Count</th></tr>';
  for (const row of data.qualityBuckets) {
    const label = row.bucket === null ? 'not scored' : (row.bucket + '–' + (row.bucket + 9));
    html += '<tr><td>' + label + '</td><td>' + row.count + '</td></tr>';
  }
  html += '</table>';

  // Weekly velocity
  html += '<h2>Approval Velocity (last 12 weeks)</h2><table><tr><th>Week</th><th>Approved</th></tr>';
  for (const row of data.velocity) {
    html += '<tr><td>' + row.week + '</td><td>' + row.count + '</td></tr>';
  }
  html += '</table>';

  // Distractor depth
  html += '<h2>Distractor Depth by Category</h2>' +
    '<table><tr><th>Category</th><th>Avg Distractors</th><th>Min</th><th>Below 8</th></tr>';
  for (const row of data.distractorDepth) {
    const cls = row.facts_below_threshold === 0 ? 'pass' : row.facts_below_threshold < 10 ? 'warn' : 'fail';
    html += '<tr>' +
      '<td>' + row.category_l1 + '</td>' +
      '<td>' + (row.avg_distractors ?? 0).toFixed(1) + '</td>' +
      '<td>' + (row.min_distractors ?? 0) + '</td>' +
      '<td class="' + cls + '">' + row.facts_below_threshold + '</td>' +
      '</tr>';
  }
  html += '</table>';

  el.innerHTML = html;
})();

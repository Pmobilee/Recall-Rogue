#!/usr/bin/env node
/**
 * Interactive review server for manual ingest dedup results.
 * Serves a web UI to approve/reject ambiguous matches.
 *
 * Usage: node review-server.mjs [--port 3456] [--report <path>]
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const QA_DIR = path.join(ROOT, 'data/generated/qa-reports')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[argv[i].slice(2)] = argv[++i]
    }
  }
  return args
}

const args = parseArgs(process.argv)
const PORT = Number(args.port || 3456)
const REPORT_PATH = path.resolve(ROOT, args.report || 'data/generated/qa-reports/manual-ingest-dedup-report.json')
const DECISIONS_PATH = REPORT_PATH.replace(/\.json$/, '-decisions.json')

function loadReport() {
  try { return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8')) }
  catch { return null }
}

function loadDecisions() {
  try { return JSON.parse(fs.readFileSync(DECISIONS_PATH, 'utf-8')) }
  catch { return {} }
}

function saveDecisions(decisions) {
  fs.writeFileSync(DECISIONS_PATH, JSON.stringify(decisions, null, 2) + '\n')
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recall Rogue — Dedup Review</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; max-width: 960px; margin: 0 auto; }
  h1 { color: #f0883e; margin-bottom: 8px; font-size: 1.5rem; }
  .subtitle { color: #8b949e; margin-bottom: 24px; }
  .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px 16px; min-width: 100px; }
  .stat-label { font-size: 0.75rem; color: #8b949e; text-transform: uppercase; }
  .stat-value { font-size: 1.5rem; font-weight: bold; color: #58a6ff; }
  .pair { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .pair.decided-duplicate { border-color: #f85149; opacity: 0.7; }
  .pair.decided-keep { border-color: #3fb950; opacity: 0.7; }
  .pair-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .score { font-size: 1.1rem; font-weight: bold; padding: 4px 10px; border-radius: 4px; }
  .score-high { background: #f8514933; color: #f85149; }
  .score-mid { background: #d2992233; color: #d29922; }
  .fact-box { background: #0d1117; border: 1px solid #21262d; border-radius: 6px; padding: 12px; margin: 8px 0; }
  .fact-label { font-size: 0.7rem; color: #8b949e; text-transform: uppercase; margin-bottom: 4px; }
  .fact-question { font-size: 0.95rem; color: #f0f6fc; }
  .fact-answer { font-size: 0.85rem; color: #3fb950; margin-top: 4px; }
  .features { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
  .feature { font-size: 0.7rem; background: #21262d; padding: 3px 8px; border-radius: 4px; }
  .feature-val { color: #58a6ff; }
  .actions { display: flex; gap: 8px; margin-top: 12px; }
  .btn { padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.15s; }
  .btn-dup { background: #f85149; color: white; }
  .btn-dup:hover { background: #da3633; }
  .btn-keep { background: #238636; color: white; }
  .btn-keep:hover { background: #2ea043; }
  .btn-undo { background: #30363d; color: #c9d1d9; }
  .btn-undo:hover { background: #484f58; }
  .btn-export { background: #1f6feb; color: white; padding: 10px 24px; font-size: 0.95rem; margin-top: 20px; }
  .btn-export:hover { background: #388bfd; }
  .decided-label { font-size: 0.8rem; font-weight: bold; padding: 4px 10px; border-radius: 4px; }
  .decided-dup { background: #f8514933; color: #f85149; }
  .decided-kept { background: #23863633; color: #3fb950; }
  .empty { text-align: center; padding: 40px; color: #8b949e; }
  .vs { text-align: center; color: #484f58; font-size: 0.8rem; margin: 4px 0; }
</style>
</head>
<body>
<h1>Dedup Review Queue</h1>
<p class="subtitle">Review ambiguous duplicate matches. Your decisions are saved automatically.</p>
<div class="stats" id="stats"></div>
<div id="pairs"></div>
<button class="btn btn-export" onclick="exportDecisions()">Export Decisions JSON</button>
<script>
let report = null, decisions = {};

async function load() {
  const [r, d] = await Promise.all([
    fetch('/api/report').then(r => r.json()),
    fetch('/api/decisions').then(r => r.json()),
  ]);
  report = r;
  decisions = d;
  render();
}

function render() {
  const items = report?.needsReview || [];
  const total = items.length;
  const decided = Object.keys(decisions).length;
  const dupes = Object.values(decisions).filter(d => d === 'duplicate').length;
  const kept = Object.values(decisions).filter(d => d === 'keep').length;
  const remaining = total - decided;

  document.getElementById('stats').innerHTML =
    stat('Total', total) + stat('Remaining', remaining, remaining > 0 ? '#d29922' : '#3fb950') +
    stat('Duplicate', dupes, '#f85149') + stat('Keep', kept, '#3fb950');

  if (items.length === 0) {
    document.getElementById('pairs').innerHTML = '<div class="empty">No items in review queue. Run dedup first.</div>';
    return;
  }

  document.getElementById('pairs').innerHTML = items.map((item, i) => {
    const key = item.candidateId + '::' + item.matchId;
    const decision = decisions[key];
    const cls = decision === 'duplicate' ? 'decided-duplicate' : decision === 'keep' ? 'decided-keep' : '';
    const scoreClass = item.score >= 0.85 ? 'score-high' : 'score-mid';
    return '<div class="pair ' + cls + '" id="pair-' + i + '">' +
      '<div class="pair-header">' +
        '<span>#' + (i+1) + '</span>' +
        '<span class="score ' + scoreClass + '">' + (item.score * 100).toFixed(1) + '%</span>' +
        (decision ? '<span class="decided-label ' + (decision === 'duplicate' ? 'decided-dup' : 'decided-kept') + '">' + decision.toUpperCase() + '</span>' : '') +
      '</div>' +
      '<div class="fact-box"><div class="fact-label">Candidate (' + esc(item.candidateId) + ')</div>' +
        '<div class="fact-question">' + esc(item.candidateQuestion) + '</div>' +
        '<div class="fact-answer">Answer: ' + esc(item.candidateAnswer || '') + '</div></div>' +
      '<div class="vs">— vs —</div>' +
      '<div class="fact-box"><div class="fact-label">Match (' + esc(item.matchId) + ')</div>' +
        '<div class="fact-question">' + esc(item.matchQuestion) + '</div>' +
        '<div class="fact-answer">Answer: ' + esc(item.matchAnswer || '') + '</div></div>' +
      '<div class="features">' + Object.entries(item.features || {}).map(([k,v]) =>
        '<span class="feature">' + k + ': <span class="feature-val">' + (typeof v === 'number' ? (v*100).toFixed(0) + '%' : v) + '</span></span>'
      ).join('') + '</div>' +
      '<div class="actions">' +
        '<button class="btn btn-dup" onclick="decide(\\''+key+'\\',\\'duplicate\\')">Mark Duplicate</button>' +
        '<button class="btn btn-keep" onclick="decide(\\''+key+'\\',\\'keep\\')">Keep Both</button>' +
        (decision ? '<button class="btn btn-undo" onclick="undecide(\\''+key+'\\')">Undo</button>' : '') +
      '</div></div>';
  }).join('');
}

function stat(label, value, color) {
  return '<div class="stat"><div class="stat-label">' + label + '</div><div class="stat-value" style="color:' + (color||'#58a6ff') + '">' + value + '</div></div>';
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function decide(key, decision) {
  decisions[key] = decision;
  await fetch('/api/decide', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({key, decision}) });
  render();
}

async function undecide(key) {
  delete decisions[key];
  await fetch('/api/undecide', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({key}) });
  render();
}

function exportDecisions() {
  const blob = new Blob([JSON.stringify(decisions, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dedup-decisions.json';
  a.click();
}

load();
</script>
</body>
</html>`

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(HTML_PAGE)
    return
  }

  if (url.pathname === '/api/report') {
    const report = loadReport()
    res.writeHead(report ? 200 : 404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(report || { error: 'No report found' }))
    return
  }

  if (url.pathname === '/api/decisions') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(loadDecisions()))
    return
  }

  if (url.pathname === '/api/decide' && req.method === 'POST') {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => {
      try {
        const { key, decision } = JSON.parse(body)
        if (!key || !['duplicate', 'keep'].includes(decision)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid input' }))
          return
        }
        const decisions = loadDecisions()
        decisions[key] = decision
        saveDecisions(decisions)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  if (url.pathname === '/api/undecide' && req.method === 'POST') {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => {
      try {
        const { key } = JSON.parse(body)
        const decisions = loadDecisions()
        delete decisions[key]
        saveDecisions(decisions)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`\n  Dedup Review UI: http://localhost:${PORT}`)
  console.log(`  Report: ${path.relative(ROOT, REPORT_PATH)}`)
  console.log(`  Decisions: ${path.relative(ROOT, DECISIONS_PATH)}`)
  console.log(`\n  Press Ctrl+C to stop.\n`)
})

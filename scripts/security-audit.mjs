#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];

function run(label, cmd, cwd = root) {
  const [bin, ...args] = cmd;
  const result = spawnSync(bin, args, { cwd, encoding: 'utf8' });
  checks.push({
    label,
    ok: (result.status ?? 1) === 0,
    code: result.status ?? 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  });
  return result.status ?? 1;
}

function scanTokenSurface() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|js|svelte|mjs)$/.test(entry.name)) files.push(full);
    }
  }
  walk(path.join(root, 'src'));
  const hits = [];
  const allowed = new Set([
    path.join(root, 'src/services/authTokens.ts').replace(/\\/g, '/'),
  ]);
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    if (!/localStorage\.(getItem|setItem|removeItem)\([^\n]*token/i.test(text)) continue;
    if (allowed.has(normalized)) continue;
    hits.push(path.relative(root, file));
  }
  checks.push({
    label: 'Token localStorage surface (allowlist)',
    ok: hits.length === 0,
    code: hits.length === 0 ? 0 : 1,
    stdout: hits.length === 0 ? 'no unexpected token storage reads/writes found' : hits.join('\n'),
    stderr: '',
  });
  return hits.length === 0 ? 0 : 1;
}

let failed = 0;
failed += run('npm audit (prod deps, high+)', ['npm', 'audit', '--omit=dev', '--audit-level=high', '--json']) === 0 ? 0 : 1;
failed += run('server npm audit (prod deps, high+)', ['npm', 'audit', '--omit=dev', '--audit-level=high', '--json'], path.join(root, 'server')) === 0 ? 0 : 1;
failed += scanTokenSurface() === 0 ? 0 : 1;

const summary = {
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  checks: checks.map(({ label, ok, code }) => ({ label, ok, code })),
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.pass) {
  console.error('\n[security-audit] failing checks detected.');
  for (const check of checks) {
    if (check.ok) continue;
    console.error(`\n--- ${check.label} ---`);
    if (check.stdout) console.error(check.stdout.slice(0, 4000));
    if (check.stderr) console.error(check.stderr.slice(0, 4000));
  }
  process.exit(1);
}

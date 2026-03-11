#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const STEPS = [
  { label: 'Typecheck', cmd: ['npm', 'run', 'typecheck'] },
  { label: 'Unit Critical Stability Loop', cmd: ['node', 'scripts/critical-loop.mjs'] },
  { label: 'Bundle Budget Gate', cmd: ['npm', 'run', 'build:check'] },
  { label: 'Security Audit (dependency + token-surface)', cmd: ['node', 'scripts/security-audit.mjs'] },
  { label: 'Playwright Critical', cmd: ['npm', 'run', 'test:e2e:critical'], env: { PLAYWRIGHT_WEBSERVER: '1' } },
  { label: 'Server Typecheck', cmd: ['npm', '--prefix', 'server', 'run', 'typecheck'] },
];

function runStep(step) {
  const [bin, ...args] = step.cmd;
  return spawnSync(bin, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(step.env ?? {}),
    },
  }).status ?? 1;
}

for (const step of STEPS) {
  console.log(`\n=== ${step.label} ===`);
  const code = runStep(step);
  if (code !== 0) {
    console.error(`\nverify:ship failed at: ${step.label}`);
    process.exit(code);
  }
}

console.log('\nverify:ship passed.');

#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const STEPS = [
  { label: 'Typecheck', cmd: ['npm', 'run', 'typecheck'] },
  { label: 'Unit Critical', cmd: ['npm', 'run', 'test:unit:critical'] },
  {
    label: 'Playwright Critical',
    cmd: ['npm', 'run', 'test:e2e:critical'],
    env: { PLAYWRIGHT_WEBSERVER: '1' },
  },
];

function runStep(step) {
  const [bin, ...args] = step.cmd;
  const result = spawnSync(bin, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(step.env ?? {}),
    },
  });
  return result.status ?? 1;
}

for (const step of STEPS) {
  console.log(`\n=== ${step.label} ===`);
  const code = runStep(step);
  if (code !== 0) {
    console.error(`\nRelease gate failed at: ${step.label}`);
    process.exit(code);
  }
}

console.log('\nRelease gate passed.');

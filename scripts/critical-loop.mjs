#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const loops = Math.max(1, Number.parseInt(process.env.CRITICAL_LOOPS ?? process.argv[2] ?? '3', 10) || 3);
const cmd = ['npm', 'run', 'test:unit:critical'];

function runOnce(iteration) {
  const [bin, ...args] = cmd;
  console.log(`\n[critical-loop] pass ${iteration}/${loops}`);
  const result = spawnSync(bin, args, { stdio: 'inherit', env: process.env });
  return result.status ?? 1;
}

for (let i = 1; i <= loops; i += 1) {
  const code = runOnce(i);
  if (code !== 0) {
    console.error(`\n[critical-loop] failed on pass ${i}`);
    process.exit(code);
  }
}

console.log(`\n[critical-loop] ${loops}/${loops} passes succeeded.`);

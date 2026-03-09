#!/usr/bin/env node
import { spawn } from 'node:child_process'

const child = spawn(process.execPath, [new URL('./fetch-art-institute.mjs', import.meta.url).pathname, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})

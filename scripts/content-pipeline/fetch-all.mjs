#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { parseCliArgs, readJson, toPositiveInt } from './fetch/shared-utils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../..')

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    })

    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${script} exited with code ${code}`))
    })
  })
}

async function main() {
  const args = parseCliArgs(process.argv, {
    domain: '',
    'domain-target': 1000,
    'skip-apis': false,
  })

  const sources = await readJson(path.join(root, 'scripts/content-pipeline/sources.json'))
  const domainTarget = toPositiveInt(args['domain-target'], 1000)

  const domains = args.domain
    ? [String(args.domain).replaceAll('-', '_')]
    : Object.keys(sources.domains)

  for (const domain of domains) {
    if (!sources.domains[domain]) {
      throw new Error(`Unknown domain ${domain}`)
    }

    await runNode('scripts/content-pipeline/fetch/fetch-domain.mjs', [
      '--domain',
      domain,
      '--target',
      String(domainTarget),
    ])
  }

  if (Boolean(args['skip-apis'])) return

  await runNode('scripts/content-pipeline/fetch/fetch-nasa.mjs')
  await runNode('scripts/content-pipeline/fetch/fetch-pubchem.mjs')
  await runNode('scripts/content-pipeline/fetch/fetch-gbif.mjs')
  await runNode('scripts/content-pipeline/fetch/fetch-met-museum.mjs')
  await runNode('scripts/content-pipeline/fetch/fetch-art-institute.mjs')
  await runNode('scripts/content-pipeline/fetch/fetch-world-bank.mjs')

  // Optional; silently skip if no API key.
  try {
    await runNode('scripts/content-pipeline/fetch/fetch-usda.mjs')
  } catch {
    // no-op
  }
}

main().catch((error) => {
  console.error('[fetch-all] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

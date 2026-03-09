#!/usr/bin/env node
import path from 'node:path'
import { fetchJson, parseCliArgs, toPositiveInt, writeJson } from './shared-utils.mjs'

const DEFAULT_API_KEY = 'DEMO_KEY'

async function main() {
  const args = parseCliArgs(process.argv, {
    limit: 50,
    output: 'data/raw/nasa-apod.json',
  })

  const count = Math.min(100, toPositiveInt(args.limit, 50))
  const apiKey = String(process.env.NASA_API_KEY || DEFAULT_API_KEY)
  const url = `https://api.nasa.gov/planetary/apod?count=${count}&api_key=${encodeURIComponent(apiKey)}`

  const payload = await fetchJson(url, { retries: 2 })
  const rows = Array.isArray(payload)
    ? payload.filter((entry) => entry && typeof entry === 'object')
    : []

  const outPath = path.resolve(String(args.output))
  await writeJson(outPath, rows)
  console.log(`wrote ${rows.length} NASA APOD rows to ${outPath}`)
}

main().catch((error) => {
  console.error('[fetch-nasa] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

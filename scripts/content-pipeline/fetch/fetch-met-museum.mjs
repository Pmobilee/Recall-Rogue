#!/usr/bin/env node
import path from 'node:path'
import { fetchJson, parseCliArgs, toPositiveInt, writeJson } from './shared-utils.mjs'

async function main() {
  const args = parseCliArgs(process.argv, {
    limit: 500,
    output: 'data/raw/met-objects.json',
    q: 'painting',
  })

  const target = Math.min(2_000, toPositiveInt(args.limit, 500))

  const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(String(args.q))}`
  const search = await fetchJson(searchUrl, { retries: 2 })
  const ids = Array.isArray(search?.objectIDs) ? search.objectIDs.slice(0, target) : []

  const rows = []
  const batchSize = 20

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize)
    const batch = await Promise.all(chunk.map(async (id) => {
      try {
        const row = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, {
          retries: 1,
          timeoutMs: 20_000,
        })
        return {
          objectID: row.objectID ?? id,
          title: row.title ?? null,
          artistDisplayName: row.artistDisplayName ?? null,
          objectDate: row.objectDate ?? null,
          medium: row.medium ?? null,
          culture: row.culture ?? null,
          classification: row.classification ?? null,
          primaryImageSmall: row.primaryImageSmall ?? null,
          sourceName: 'Met Museum',
          sourceUrl: row.objectURL ?? null,
        }
      } catch {
        return null
      }
    }))

    rows.push(...batch.filter(Boolean))
  }

  const outPath = path.resolve(String(args.output))
  await writeJson(outPath, rows)
  console.log(`wrote ${rows.length}/${ids.length} Met Museum objects to ${outPath}`)
}

main().catch((error) => {
  console.error('[fetch-met-museum] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

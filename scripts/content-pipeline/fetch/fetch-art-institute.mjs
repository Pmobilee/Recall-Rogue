#!/usr/bin/env node
import path from 'node:path'
import { fetchJson, parseCliArgs, toPositiveInt, writeJson } from './shared-utils.mjs'

async function main() {
  const args = parseCliArgs(process.argv, {
    limit: 1000,
    output: 'data/raw/artic-artworks.json',
  })

  const target = Math.min(5_000, toPositiveInt(args.limit, 1000))
  const pageSize = 100

  const rows = []
  for (let page = 1; rows.length < target; page += 1) {
    const fields = [
      'id',
      'title',
      'artist_title',
      'date_display',
      'medium_display',
      'classification_title',
      'style_title',
      'place_of_origin',
      'image_id',
    ].join(',')

    const url = `https://api.artic.edu/api/v1/artworks?page=${page}&limit=${pageSize}&fields=${encodeURIComponent(fields)}`
    const payload = await fetchJson(url, { retries: 2 })
    const data = Array.isArray(payload?.data) ? payload.data : []
    if (data.length === 0) break

    rows.push(...data.map((item) => ({
      id: item.id ?? null,
      title: item.title ?? null,
      artistTitle: item.artist_title ?? null,
      dateDisplay: item.date_display ?? null,
      mediumDisplay: item.medium_display ?? null,
      classificationTitle: item.classification_title ?? null,
      styleTitle: item.style_title ?? null,
      placeOfOrigin: item.place_of_origin ?? null,
      imageId: item.image_id ?? null,
      sourceName: 'Art Institute of Chicago',
      sourceUrl: item.id ? `https://www.artic.edu/artworks/${item.id}` : null,
    })))

    if (data.length < pageSize) break
  }

  const outPath = path.resolve(String(args.output))
  await writeJson(outPath, rows.slice(0, target))
  console.log(`wrote ${Math.min(rows.length, target)} Art Institute rows to ${outPath}`)
}

main().catch((error) => {
  console.error('[fetch-art-institute] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

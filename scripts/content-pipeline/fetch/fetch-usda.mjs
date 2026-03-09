#!/usr/bin/env node
import path from 'node:path'
import { fetchJson, parseCliArgs, toPositiveInt, writeJson } from './shared-utils.mjs'

function getApiKey() {
  return process.env.USDA_API_KEY || process.env.FDC_API_KEY || ''
}

async function main() {
  const args = parseCliArgs(process.argv, {
    limit: 500,
    output: 'data/raw/usda-foods.json',
    query: 'rice',
  })

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('USDA_API_KEY/FDC_API_KEY not set; skipping USDA fetch.')
    return
  }

  const target = Math.min(5_000, toPositiveInt(args.limit, 500))
  const pageSize = Math.min(200, target)

  const rows = []
  let pageNumber = 1

  while (rows.length < target) {
    const payload = await fetchJson('https://api.nal.usda.gov/fdc/v1/foods/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query: String(args.query),
        pageSize,
        pageNumber,
      }),
      retries: 2,
    })

    const foods = Array.isArray(payload?.foods) ? payload.foods : []
    if (foods.length === 0) break

    rows.push(...foods.map((food) => ({
      fdcId: food.fdcId ?? null,
      description: food.description ?? null,
      dataType: food.dataType ?? null,
      foodCategory: food.foodCategory ?? null,
      publicationDate: food.publicationDate ?? null,
      sourceName: 'USDA FoodData Central',
      sourceUrl: food.fdcId ? `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}/nutrients` : null,
    })))

    pageNumber += 1
    if (foods.length < pageSize) break
  }

  const outPath = path.resolve(String(args.output))
  await writeJson(outPath, rows.slice(0, target))
  console.log(`wrote ${Math.min(rows.length, target)} USDA food rows to ${outPath}`)
}

main().catch((error) => {
  console.error('[fetch-usda] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

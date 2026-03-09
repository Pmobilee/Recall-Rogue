#!/usr/bin/env node
import path from 'node:path'
import { fetchJson, parseCliArgs, toPositiveInt, writeJson } from './shared-utils.mjs'

const POPULATION_INDICATOR = 'SP.POP.TOTL'

async function fetchCountries(limit) {
  const url = 'https://api.worldbank.org/v2/country?format=json&per_page=400'
  const payload = await fetchJson(url, { retries: 2 })
  const rows = Array.isArray(payload?.[1]) ? payload[1] : []

  return rows
    .filter((row) => row.region?.id !== 'NA')
    .slice(0, limit)
    .map((row) => ({
      id: row.id ?? null,
      name: row.name ?? null,
      region: row.region?.value ?? null,
      incomeLevel: row.incomeLevel?.value ?? null,
      lendingType: row.lendingType?.value ?? null,
      capitalCity: row.capitalCity ?? null,
      longitude: row.longitude ?? null,
      latitude: row.latitude ?? null,
    }))
}

async function fetchPopulationByCountry(countryIso2) {
  const url = `https://api.worldbank.org/v2/country/${countryIso2}/indicator/${POPULATION_INDICATOR}?format=json&per_page=2`
  const payload = await fetchJson(url, { retries: 1, timeoutMs: 20_000 })
  const points = Array.isArray(payload?.[1]) ? payload[1] : []
  const latest = points.find((point) => typeof point?.value === 'number')
  return latest?.value ?? null
}

async function main() {
  const args = parseCliArgs(process.argv, {
    limit: 195,
    output: 'data/raw/world-bank-countries.json',
  })

  const target = Math.min(300, toPositiveInt(args.limit, 195))
  const countries = await fetchCountries(target)

  const enriched = []
  for (const country of countries) {
    let population = null
    if (country.id) {
      try {
        population = await fetchPopulationByCountry(country.id)
      } catch {
        population = null
      }
    }

    enriched.push({
      ...country,
      population,
      sourceName: 'World Bank Open Data',
      sourceUrl: country.id ? `https://data.worldbank.org/country/${country.id.toLowerCase()}` : null,
    })
  }

  const outPath = path.resolve(String(args.output))
  await writeJson(outPath, enriched)
  console.log(`wrote ${enriched.length} World Bank country rows to ${outPath}`)
}

main().catch((error) => {
  console.error('[fetch-world-bank] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

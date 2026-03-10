#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const LANGUAGE_QID = {
  en: 'Q1860',
  es: 'Q1321',
  fr: 'Q150',
  de: 'Q188',
  ja: 'Q5287',
  zh: 'Q7850',
  ko: 'Q9176',
  nl: 'Q7411',
  cs: 'Q9056',
}

const ENDPOINT = 'https://query.wikidata.org/sparql'

function buildQuery(languageQid, limit, offset) {
  return `
SELECT ?lexeme ?lemma WHERE {
  ?lexeme dct:language wd:${languageQid} ;
          wikibase:lemma ?lemma .
}
LIMIT ${limit}
OFFSET ${offset}
`
}

async function runQuery(query) {
  const body = new URLSearchParams({ query, format: 'json' })
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      accept: 'application/sparql-results+json',
      'user-agent': 'terra-miner-vocab-pipeline/1.0',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`Wikidata lexeme query failed: HTTP ${response.status}`)
  }

  const payload = await response.json()
  return Array.isArray(payload?.results?.bindings) ? payload.results.bindings : []
}

async function fetchLanguage(code, limit) {
  const qid = LANGUAGE_QID[code]
  if (!qid) return []

  const pageSize = Math.min(500, limit)
  const rows = []

  for (let offset = 0; offset < limit; offset += pageSize) {
    const query = buildQuery(qid, Math.min(pageSize, limit - rows.length), offset)
    const bindings = await runQuery(query)
    if (bindings.length === 0) break

    for (const binding of bindings) {
      rows.push({
        id: binding?.lexeme?.value?.split('/').pop() ?? null,
        word: binding?.lemma?.value ?? null,
        language: code,
        sourceName: 'Wikidata Lexemes',
        sourceUrl: binding?.lexeme?.value ?? null,
      })
      if (rows.length >= limit) break
    }

    if (bindings.length < pageSize) break
  }

  return rows
}

async function main() {
  const args = parseArgs(process.argv, {
    languages: 'en,es,fr,de,ja,zh',
    limit: 5000,
    output: 'data/raw/wikidata-lexemes.json',
  })

  const languages = String(args.languages)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const limit = Number(args.limit) > 0 ? Number(args.limit) : 5000
  const outputPath = path.resolve(root, String(args.output))

  const rows = []
  for (const code of languages) {
    try {
      const records = await fetchLanguage(code, limit)
      rows.push(...records)
      console.log(`language ${code}: ${records.length}`)
    } catch (error) {
      console.warn(`language ${code}: failed (${error instanceof Error ? error.message : String(error)})`)
    }
  }

  await writeJson(outputPath, rows)
  console.log(`wrote ${rows.length} lexeme rows to ${outputPath}`)
}

main().catch((error) => {
  console.error('[import-wikidata-lexemes] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

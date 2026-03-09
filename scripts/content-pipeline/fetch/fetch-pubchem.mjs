#!/usr/bin/env node
import path from 'node:path'
import { fetchJson, parseCliArgs, toPositiveInt, writeJson } from './shared-utils.mjs'

const DEFAULT_COMPOUNDS = [
  'water', 'ethanol', 'caffeine', 'glucose', 'aspirin', 'sodium chloride', 'citric acid', 'methane',
  'acetone', 'ammonia', 'carbon dioxide', 'oxygen', 'nitrogen', 'benzene', 'lactic acid',
]

async function fetchCompound(name) {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/CanonicalSMILES,MolecularFormula,MolecularWeight,IUPACName/JSON`
  const payload = await fetchJson(url, { retries: 2, timeoutMs: 30_000 })
  const props = payload?.PropertyTable?.Properties?.[0] ?? null
  if (!props) return null
  return {
    name,
    cid: props.CID ?? null,
    molecularFormula: props.MolecularFormula ?? null,
    molecularWeight: props.MolecularWeight ?? null,
    iupacName: props.IUPACName ?? null,
    canonicalSmiles: props.CanonicalSMILES ?? null,
    sourceName: 'PubChem',
    sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${props.CID ?? ''}`,
  }
}

async function main() {
  const args = parseCliArgs(process.argv, {
    limit: 50,
    output: 'data/raw/pubchem-compounds.json',
    compounds: '',
  })

  const requested = String(args.compounds || '').trim()
  const names = requested
    ? requested.split(',').map((part) => part.trim()).filter(Boolean)
    : DEFAULT_COMPOUNDS

  const limit = Math.min(names.length, toPositiveInt(args.limit, names.length))
  const target = names.slice(0, limit)

  const rows = []
  for (const name of target) {
    try {
      const row = await fetchCompound(name)
      if (row) rows.push(row)
    } catch (error) {
      console.warn(`[fetch-pubchem] skipping ${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const outPath = path.resolve(String(args.output))
  await writeJson(outPath, rows)
  console.log(`wrote ${rows.length}/${target.length} PubChem compounds to ${outPath}`)
}

main().catch((error) => {
  console.error('[fetch-pubchem] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

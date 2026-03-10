#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { dedupeStrings, parseArgs, writeJson } from './shared.mjs'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

async function extractCollection(apkgPath) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anki-extract-'))
  const candidates = ['collection.anki21', 'collection.anki2']

  for (const fileName of candidates) {
    const outputPath = path.join(tempDir, fileName)
    try {
      const { stdout } = await execFileAsync('unzip', ['-p', apkgPath, fileName], {
        encoding: 'buffer',
        maxBuffer: 32 * 1024 * 1024,
      })

      if (stdout && stdout.length > 0) {
        await fs.writeFile(outputPath, stdout)
        return outputPath
      }
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('Could not extract collection.anki2/collection.anki21 from apkg')
}

async function readNotes(dbPath, limit) {
  const sql = await initSqlJs({
    locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm'),
  })

  const buffer = await fs.readFile(dbPath)
  const db = new sql.Database(new Uint8Array(buffer))

  const rows = db.exec(`SELECT flds FROM notes LIMIT ${limit}`)
  const values = rows[0]?.values || []
  return values.map((row) => String(row[0] || ''))
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    language: 'unknown',
    output: 'data/extracted/anki-wordlist.json',
    'field-index': 0,
    limit: 200_000,
  })

  if (!args.input) {
    throw new Error('Usage: node extract-anki-wordlist.mjs --input <deck.apkg> --language <code> --output <json>')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const fieldIndex = Math.max(0, Number(args['field-index']) || 0)
  const limit = Math.max(1, Number(args.limit) || 200_000)

  const collectionPath = await extractCollection(inputPath)
  const noteFieldBlobs = await readNotes(collectionPath, limit)

  const words = dedupeStrings(noteFieldBlobs.map((blob) => {
    const fields = blob.split('\u001f')
    return fields[fieldIndex] || fields[0] || ''
  }))

  await writeJson(outputPath, {
    language: String(args.language),
    source: 'anki-community-deck',
    extractedAt: new Date().toISOString().slice(0, 10),
    words,
  })

  console.log(`wrote ${words.length} words to ${outputPath}`)
}

main().catch((error) => {
  console.error('[extract-anki-wordlist] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

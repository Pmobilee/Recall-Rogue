// src/i18n/scripts/export-facts-for-translation.mjs
// Exports approved English facts to a JSON format suitable for human translators.
// Usage: node src/i18n/scripts/export-facts-for-translation.mjs
import initSqlJs from 'sql.js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../../../public/facts.db')
const outputPath = join(__dirname, 'facts-export.json')

if (!existsSync(dbPath)) {
  console.error(`[export-facts] facts.db not found at ${dbPath}`)
  console.error('Run "npm run build:facts" first to generate the database.')
  process.exit(1)
}

const SQL = await initSqlJs()
const dbBuffer = readFileSync(dbPath)
const db = new SQL.Database(new Uint8Array(dbBuffer))

let results
try {
  results = db.exec(`
    SELECT id, statement, quiz_question, correct_answer, distractors, wow_factor, explanation
    FROM facts
    WHERE status = 'approved'
    ORDER BY category
  `)
} catch (err) {
  // If status column doesn't exist, export all facts
  console.warn('[export-facts] "status" column not found, exporting all facts')
  results = db.exec(`
    SELECT id, statement, quiz_question, correct_answer, distractors, wow_factor, explanation
    FROM facts
    ORDER BY category
  `)
}

if (!results[0]?.values?.length) {
  console.warn('[export-facts] No facts found in database.')
  db.close()
  process.exit(0)
}

const rows = results[0].values.map(row => ({
  id: row[0],
  statement: row[1],
  quiz_question: row[2],
  correct_answer: row[3],
  distractors: row[4], // JSON string
  wow_factor: row[5] ?? '',
  explanation: row[6] ?? '',
  // Blank fields for translator to fill:
  statement_TRANSLATED: '',
  quiz_question_TRANSLATED: '',
  correct_answer_TRANSLATED: '',
  distractors_TRANSLATED: '',
  wow_factor_TRANSLATED: '',
  explanation_TRANSLATED: '',
}))

writeFileSync(outputPath, JSON.stringify(rows, null, 2))

console.log(`[export-facts] Exported ${rows.length} facts for translation to:`)
console.log(`  ${outputPath}`)
console.log()
console.log('Instructions for translators:')
console.log('  1. Fill in the *_TRANSLATED fields for each fact.')
console.log('  2. Do NOT modify the id, statement, or other source fields.')
console.log('  3. Preserve {variable} placeholders exactly as they appear in source text.')
console.log('  4. distractors_TRANSLATED should be a valid JSON array of strings, e.g. ["a","b","c"]')

db.close()

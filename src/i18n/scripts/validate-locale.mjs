// src/i18n/scripts/validate-locale.mjs
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const localesDir = fileURLToPath(new URL('../locales/', import.meta.url))
const en = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8'))

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue
    const full = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') keys.push(full)
    else if (typeof v === 'object' && v !== null) keys.push(...flattenKeys(v, full))
  }
  return keys
}

function extractVars(str) {
  return [...str.matchAll(/\{(\w+)\}/g)].map(m => m[1])
}

function getLeafStrings(obj, prefix = '') {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue
    const full = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') result[full] = v
    else if (typeof v === 'object' && v !== null) Object.assign(result, getLeafStrings(v, full))
  }
  return result
}

const enKeys = flattenKeys(en)
const enStrings = getLeafStrings(en)
const files = readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json')

let hasErrors = false

for (const file of files) {
  const code = file.replace('.json', '')
  let locale
  try {
    locale = JSON.parse(readFileSync(join(localesDir, file), 'utf8'))
  } catch (err) {
    console.error(`[${code}] ERROR — failed to parse JSON: ${err.message}`)
    hasErrors = true
    continue
  }

  const localeKeys = flattenKeys(locale)
  const localeStrings = getLeafStrings(locale)

  // Missing keys (warnings only — partial translations are acceptable)
  const missing = enKeys.filter(k => !localeKeys.includes(k))
  if (missing.length > 0) {
    console.warn(`[${code}] ${missing.length} missing keys (will fall back to English):`)
    missing.slice(0, 10).forEach(k => console.warn(`  - ${k}`))
    if (missing.length > 10) console.warn(`  ... and ${missing.length - 10} more`)
  } else {
    console.log(`[${code}] OK — all ${enKeys.length} keys present`)
  }

  // Extra keys not in en.json (typo guard — these ARE errors)
  const extra = localeKeys.filter(k => !enKeys.includes(k))
  if (extra.length > 0) {
    console.error(`[${code}] ERROR — ${extra.length} extra keys not present in en.json (possible typos):`)
    extra.forEach(k => console.error(`  + ${k}`))
    hasErrors = true
  }

  // Variable placeholder check — translated strings must preserve all {vars} from English
  for (const [key, enStr] of Object.entries(enStrings)) {
    const localeStr = localeStrings[key]
    if (!localeStr) continue // Missing keys are warned above
    const enVars = extractVars(enStr)
    const localeVars = extractVars(localeStr)
    const missingVars = enVars.filter(v => !localeVars.includes(v))
    if (missingVars.length > 0) {
      console.error(`[${code}] ERROR — key "${key}" is missing variable(s): {${missingVars.join('}, {')}}`)
      console.error(`  en:     ${enStr}`)
      console.error(`  ${code}: ${localeStr}`)
      hasErrors = true
    }
  }
}

if (hasErrors) {
  console.error('\nValidation completed with errors. See above for details.')
  process.exit(1)
} else {
  console.log('\nValidation completed successfully.')
  process.exit(0)
}

import fs from 'node:fs/promises'
import path from 'node:path'

export function parseArgs(argv, defaults = {}) {
  const out = { ...defaults }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next == null || next.startsWith('--')) {
      out[key] = true
      continue
    }
    if (next === 'true') out[key] = true
    else if (next === 'false') out[key] = false
    else if (!Number.isNaN(Number(next)) && next.trim() !== '') out[key] = Number(next)
    else out[key] = next
    i += 1
  }
  return out
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

export function dedupeStrings(values) {
  const seen = new Set()
  const out = []
  for (const value of values) {
    const normalized = String(value || '').trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

export function normalizeWord(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

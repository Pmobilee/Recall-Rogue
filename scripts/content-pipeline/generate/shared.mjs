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

export function normalizeDomainName(raw) {
  return String(raw || '').trim().replaceAll('_', '-')
}

export async function loadPrompt(rootDir, domain) {
  const normalized = normalizeDomainName(domain)
  const filePath = path.join(rootDir, 'scripts/content-pipeline/generate/prompts', `${normalized}.txt`)
  return fs.readFile(filePath, 'utf8')
}

export function toDomainTag(domain) {
  return normalizeDomainName(domain).replaceAll('-', '_')
}

export async function readSourceInput(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(text)

  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.data)) return parsed.data
  if (Array.isArray(parsed?.results)) return parsed.results
  return []
}

export async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

export function toJsonlLine(value) {
  return `${JSON.stringify(value)}\n`
}

export async function loadJsonl(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

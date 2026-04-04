import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Fact question quality', () => {
  const seedDir = path.resolve(__dirname, '../../src/data/seed')
  const seedFiles = fs.readdirSync(seedDir).filter(f => f.endsWith('.json'))

  it('all seed facts must have a valid question (quizQuestion or variant questions)', () => {
    const missing: { id: string; file: string }[] = []

    for (const file of seedFiles) {
      const raw = JSON.parse(fs.readFileSync(path.join(seedDir, file), 'utf8'))
      const facts = Array.isArray(raw) ? raw : raw.facts || []

      for (const fact of facts) {
        const hasQuizQ = fact.quizQuestion && String(fact.quizQuestion).trim().length > 0 && String(fact.quizQuestion) !== 'undefined'
        const hasVariantQ = Array.isArray(fact.variants) && fact.variants.length > 0 && fact.variants.some((v: any) => v.question && String(v.question).trim().length > 0)

        if (!hasQuizQ && !hasVariantQ) {
          missing.push({ id: fact.id, file })
        }
      }
    }

    if (missing.length > 0) {
      console.warn(`\n⚠️  ${missing.length} facts missing questions:`)
      for (const m of missing.slice(0, 20)) {
        console.warn(`  - ${m.id} (${m.file})`)
      }
      if (missing.length > 20) console.warn(`  ... and ${missing.length - 20} more`)
    }

    expect(missing.length).toBe(0)
  })

  it('public seed-pack facts must have a valid question', () => {
    const packPath = path.resolve(__dirname, '../../data/seed-pack.json')
    if (!fs.existsSync(packPath)) return // skip if not built yet

    const facts = JSON.parse(fs.readFileSync(packPath, 'utf8'))
    const arr = Array.isArray(facts) ? facts : facts.facts || []
    const missing: string[] = []

    for (const fact of arr) {
      // seed-pack uses 'question' field name (not quizQuestion)
      const q = fact.question || fact.quizQuestion
      const hasQ = q && String(q).trim().length > 0 && String(q) !== 'undefined'
      const hasVariantQ = Array.isArray(fact.variants) && fact.variants.length > 0 && fact.variants.some((v: any) => v.question && String(v.question).trim().length > 0)

      if (!hasQ && !hasVariantQ) {
        missing.push(fact.id)
      }
    }

    if (missing.length > 0) {
      console.warn(`\n⚠️  ${missing.length} seed-pack facts missing questions`)
      for (const id of missing.slice(0, 10)) {
        console.warn(`  - ${id}`)
      }
    }

    expect(missing.length).toBe(0)
  })
})

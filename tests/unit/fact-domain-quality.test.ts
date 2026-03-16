import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/** Keywords that should NEVER appear in a domain's questions/answers (case-insensitive, word-boundary). */
const DOMAIN_DENYLIST: Record<string, RegExp[]> = {
  animals_wildlife: [/\brecipe\b/i, /\bcuisine\b/i, /\bbaked\b/i, /\bfried\b/i, /\bingredient\b/i, /\btheorem\b/i, /\bequation\b/i],
  food_cuisine: [/\bmitosis\b/i, /\bchromosome\b/i, /\bphotosynthesis\b/i, /\btheorem\b/i],
  human_body_health: [/\bmythology\b/i, /\bzeus\b/i, /\bthor\b/i, /\bcuisine\b/i],
  mythology_folklore: [/\bchromosome\b/i, /\bequation\b/i, /\btheorem\b/i, /\brecipe\b/i],
  natural_sciences: [/\brecipe\b/i, /\bcuisine\b/i, /\bcooking\b/i, /\bmythology\b/i],
  space_astronomy: [/\brecipe\b/i, /\bcuisine\b/i, /\bcooking\b/i, /\bchromosome\b/i],
  geography: [/\brecipe\b/i, /\bchromosome\b/i, /\btheorem\b/i],
  art_architecture: [/\bchromosome\b/i, /\brecipe\b/i, /\bcooking\b/i],
  history: [/\brecipe\b/i, /\bcooking\b/i, /\bphotosynthesis\b/i],
}

describe('Fact domain quality', () => {
  const seedDir = path.resolve(__dirname, '../../src/data/seed')
  const seedFiles = fs.readdirSync(seedDir).filter(f => f.startsWith('knowledge-') && f.endsWith('.json'))

  it('seed facts should not contain obvious domain-mismatched keywords', () => {
    const violations: { id: string; domain: string; keyword: string; file: string }[] = []

    for (const file of seedFiles) {
      const domainMatch = file.match(/^knowledge-(.+)\.json$/)
      if (!domainMatch) continue
      const domain = domainMatch[1]
      const denyPatterns = DOMAIN_DENYLIST[domain]
      if (!denyPatterns || denyPatterns.length === 0) continue

      const raw = JSON.parse(fs.readFileSync(path.join(seedDir, file), 'utf8'))
      const facts = Array.isArray(raw) ? raw : raw.facts || []

      for (const fact of facts) {
        const question = fact.quizQuestion || ''
        const answer = fact.correctAnswer || ''
        const text = `${question} ${answer}`

        for (const pattern of denyPatterns) {
          if (pattern.test(text)) {
            violations.push({ id: fact.id, domain, keyword: pattern.source, file })
            break // one violation per fact is enough
          }
        }
      }
    }

    if (violations.length > 0) {
      console.warn(`\n⚠️  ${violations.length} potential domain mismatches:`)
      for (const v of violations.slice(0, 20)) {
        console.warn(`  - [${v.domain}] ${v.id}: matched /${v.keyword}/`)
      }
      if (violations.length > 20) console.warn(`  ... and ${violations.length - 20} more`)
    }

    // Allow up to 5 false positives (keyword matching is imperfect)
    expect(violations.length).toBeLessThan(5)
  })

  it('entity files should not contain obvious cross-domain entities', () => {
    const curatedDir = path.resolve(__dirname, '../../data/curated')
    if (!fs.existsSync(curatedDir)) return

    const ENTITY_CHECKS: Record<string, RegExp[]> = {
      animals_wildlife: [/\bmaize\b/i, /\bbacteria\b/i, /\bvirus\b/i, /\beukaryote\b/i],
      human_body_health: [/\bdog\b/i, /\bcat\b/i, /\bcattle\b/i, /\bwheat\b/i, /\brice\b/i, /\bbanana\b/i],
      mythology_folklore: [/\bMartin Luther\b/i, /\bKarl Barth\b/i, /\bErasmus\b/i],
      space_astronomy: [/\bUsain Bolt\b/i],
    }

    const violations: { label: string; domain: string }[] = []
    const domains = fs.readdirSync(curatedDir).filter(d => fs.statSync(path.join(curatedDir, d)).isDirectory())

    for (const domain of domains) {
      const checks = ENTITY_CHECKS[domain]
      if (!checks) continue
      const entFile = path.join(curatedDir, domain, 'entities.json')
      if (!fs.existsSync(entFile)) continue
      const entities = JSON.parse(fs.readFileSync(entFile, 'utf8'))

      for (const entity of entities) {
        for (const pattern of checks) {
          if (pattern.test(entity.label || '')) {
            violations.push({ label: entity.label, domain })
          }
        }
      }
    }

    if (violations.length > 0) {
      console.warn(`\n⚠️  ${violations.length} misclassified entities still present:`)
      for (const v of violations) console.warn(`  - [${v.domain}] "${v.label}"`)
    }

    expect(violations.length).toBe(0)
  })
})

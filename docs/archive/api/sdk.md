# JavaScript / TypeScript SDK

The `recall-rogue-sdk` package wraps all public API endpoints with typed interfaces
and built-in CC attribution handling.

## Installation

```bash
# From the packages/sdk directory:
npm install /path/to/terra-miner/packages/sdk

# Or copy packages/sdk/index.ts into your project
```

## Quickstart

```typescript
import { RecallRogueClient } from 'recall-rogue-sdk'

const client = new RecallRogueClient({
  apiKey: process.env.TERRA_GACHA_API_KEY!,
  // Optional: override for local dev
  baseUrl: 'http://localhost:3001'
})

// Get 10 biology facts
const { data, meta } = await client.getFacts({
  category: 'Biology',
  limit: 10
})
console.log(`${data.length} facts — license: ${meta.license}`)

// Get a random fact for a quiz
const { data: randomFacts } = await client.getRandomFacts({ count: 1 })
const fact = randomFacts[0]

// Get full detail with distractors
const { data: detail } = await client.getFactDetail(fact.id)
console.log(detail.distractors)  // Array of { text, difficulty_tier }

// Browse categories
const { data: tree } = await client.getCategories()
console.log(Object.keys(tree))  // ['Biology', 'History', ...]
```

## TypeScript Types

```typescript
interface Fact {
  id: string
  statement: string
  quizQuestion?: string
  correctAnswer: string
  categoryL1: string
  categoryL2?: string
  difficulty?: number
  rarity?: string
  sourceName?: string
  sourceUrl?: string
}

interface FactDetail extends Fact {
  explanation?: string
  mnemonic?: string
  hasPixelArt?: boolean
  distractors: Array<{ text: string; difficultyTier: string }>
}

interface CcMeta {
  license: string
  licenseUrl: string
  attribution: string
  requiresAttribution: boolean
}
```

## Cursor Pagination

```typescript
let cursor: string | null | undefined = undefined
let allFacts: Fact[] = []

do {
  const res = await client.getFacts({ limit: 100, cursor: cursor ?? undefined })
  allFacts = allFacts.concat(res.data)
  cursor = res.pagination.nextCursor
} while (cursor)

console.log(`Total facts: ${allFacts.length}`)
```

## Attribution Compliance

Every response includes `meta.attribution`. You must display this text wherever facts
appear in your product. See [Licensing](./licensing.md) for full requirements.

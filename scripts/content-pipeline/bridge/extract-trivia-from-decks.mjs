/**
 * extract-trivia-from-decks.mjs
 *
 * Curated Deck → Trivia Bridge
 *
 * Build-time script that extracts the single best trivia question per entity
 * from each curated knowledge deck and writes them as trivia-format Fact
 * objects to src/data/seed/bridge-curated.json.
 *
 * Usage:
 *   node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs
 *   node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --dry-run
 *   node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --verbose
 *   node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --deck dinosaurs
 *   node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --validate-only
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '../../..')

const MANIFEST_PATH = join(REPO_ROOT, 'data/decks/manifest.json')
const DECKS_DIR = join(REPO_ROOT, 'data/decks')
const CONFIG_PATH = join(__dirname, 'deck-bridge-config.json')
const SEED_DIR = join(REPO_ROOT, 'src/data/seed')
const OUTPUT_PATH = join(SEED_DIR, 'bridge-curated.json')
const MANIFEST_OUT_PATH = join(__dirname, 'bridge-manifest.json')

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const VERBOSE = args.includes('--verbose')
const VALIDATE_ONLY = args.includes('--validate-only')
const DECK_FILTER = (() => {
  const idx = args.indexOf('--deck')
  return idx !== -1 ? args[idx + 1] : null
})()

// ---------------------------------------------------------------------------
// Domain display names
// ---------------------------------------------------------------------------

const DOMAIN_NAMES = {
  history: 'History',
  natural_sciences: 'Natural Sciences',
  space_astronomy: 'Space & Astronomy',
  geography: 'Geography',
  mythology_folklore: 'Mythology & Folklore',
  animals_wildlife: 'Animals & Wildlife',
  human_body_health: 'Human Body & Health',
  food_cuisine: 'Food & Cuisine',
  general_knowledge: 'General Knowledge',
  art_architecture: 'Art & Architecture',
  games: 'Games',
  social_sciences: 'Social Sciences',
  sports_entertainment: 'Sports & Entertainment',
}

// ---------------------------------------------------------------------------
// Entity key extraction
// ---------------------------------------------------------------------------

/**
 * Derive a grouping key from a fact ID.
 *
 * Example (prefixSegments=2, entitySegments=1):
 *   greece_cs_democracy_founder → "democracy"
 *
 * Example (prefixSegments=2, entitySegments=2):
 *   paint_ren_mona_lisa_artist → "mona_lisa"
 *
 * Example (prefixSegments=1, entitySegments=1):
 *   dino_trex_identity → "trex"
 *
 * @param {string} factId
 * @param {number} prefixSegments
 * @param {number} entitySegments
 * @returns {string}
 */
function getEntityKey(factId, prefixSegments, entitySegments, separator = '_') {
  const parts = factId.split(separator)
  const afterPrefix = parts.slice(prefixSegments)
  const entityParts = afterPrefix.slice(0, entitySegments)
  return entityParts.join('_')
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score a DeckFact candidate for selection.
 * Higher is better.
 *
 * @param {object} fact  DeckFact object
 * @returns {number}
 */
function scoreFact(fact) {
  let score = 0

  // funScore contributes most (0-40 range)
  score += (fact.funScore ?? 5) * 4

  // Mid-range difficulty is most approachable for trivia
  if (fact.difficulty === 2 || fact.difficulty === 3) score += 20
  else if (fact.difficulty === 1 || fact.difficulty === 4) score += 10

  // More distractors = more usable in trivia
  score += Math.min(fact.distractors?.length ?? 0, 10)

  // Short answers are cleaner for trivia UI
  const ansLen = fact.correctAnswer?.length ?? 99
  if (ansLen <= 15) score += 10
  else if (ansLen <= 30) score += 5

  // Statement available = richer card
  if (fact.statement) score += 5

  // Variants add replay value
  if (fact.variants?.length > 0) score += 5

  // Heavily penalise image-dependent questions
  if (
    fact.quizMode === 'image_question' &&
    /this image|shown above|pictured/i.test(fact.quizQuestion ?? '')
  ) {
    score -= 30
  }

  // Minor penalty for volatile (may become outdated)
  if (fact.volatile) score -= 5

  return score
}

// ---------------------------------------------------------------------------
// Rarity derivation
// ---------------------------------------------------------------------------

/**
 * Derive a trivia rarity from difficulty and funScore.
 *
 * @param {number} difficulty  1-5
 * @param {number} funScore    1-10
 * @returns {'common'|'uncommon'|'rare'|'epic'|'legendary'}
 */
function deriveRarity(difficulty, funScore) {
  const score = (difficulty ?? 2) + (funScore ?? 5) / 2
  if (score >= 8) return 'legendary'
  if (score >= 6.5) return 'epic'
  if (score >= 5) return 'rare'
  if (score >= 3.5) return 'uncommon'
  return 'common'
}

// ---------------------------------------------------------------------------
// Transformation: DeckFact → Fact
// ---------------------------------------------------------------------------

/**
 * Convert a DeckFact (curated deck format) to a Fact (trivia seed format).
 *
 * @param {object} deckFact   Source DeckFact
 * @param {object} deck       Parent CuratedDeck
 * @param {object} deckConfig Bridge config entry for this deck
 * @returns {object}          Fact object ready for bridge-curated.json
 */
function transformFact(deckFact, deck, deckConfig) {
  const tags = [...(deckFact.tags ?? [])]
  tags.push(`bridge:${deck.id}`)

  // Build a synthetic statement if the deck didn't provide one
  const statement =
    deckFact.statement ||
    `${deckFact.correctAnswer}: ${(deckFact.explanation ?? '').split('.')[0].trim()}.`

  return {
    id: deckFact.id,
    type: 'fact',
    statement,
    explanation: deckFact.explanation,
    quizQuestion: deckFact.quizQuestion,
    correctAnswer: deckFact.correctAnswer,
    distractors: deckFact.distractors ?? [],
    acceptableAnswers: deckFact.acceptableAlternatives ?? [],
    category: [DOMAIN_NAMES[deck.domain] ?? deck.domain, deck.name],
    categoryL1: deck.domain,
    categoryL2: deckFact.categoryL2 ?? deckConfig.categoryL2,
    rarity: deriveRarity(deckFact.difficulty, deckFact.funScore),
    difficulty: deckFact.difficulty ?? 2,
    funScore: deckFact.funScore ?? 5,
    ageRating: deckConfig.ageRating ?? 'teen',
    sourceName: deckFact.sourceName ?? '',
    sourceUrl: deckFact.sourceUrl ?? undefined,
    sourceVerified: true,
    contentVolatility: deckFact.volatile ? 'slow_change' : 'timeless',
    status: 'approved',
    noveltyScore: deckFact.funScore ?? 5,
    ...(deckFact.visualDescription ? { visualDescription: deckFact.visualDescription } : {}),
    ...(deckFact.wowFactor ? { wowFactor: deckFact.wowFactor } : {}),
    tags,
    ...(deckFact.variants?.length > 0 ? { variants: deckFact.variants } : {}),
    ...(deckFact.imageAssetPath ? { imageAssetPath: deckFact.imageAssetPath } : {}),
    ...(deckFact.quizMode ? { quizMode: deckFact.quizMode } : {}),
  }
}

// ---------------------------------------------------------------------------
// Existing seed ID collection (for collision detection)
// ---------------------------------------------------------------------------

/**
 * Read all IDs from existing knowledge-*.json seed files.
 * bridge-curated.json itself is excluded from this check (it's the output).
 *
 * @returns {Set<string>}
 */
function collectExistingSeedIds() {
  const ids = new Set()
  if (!existsSync(SEED_DIR)) return ids

  const files = readdirSync(SEED_DIR).filter(
    (f) => f.endsWith('.json') && f !== 'bridge-curated.json',
  )
  for (const file of files) {
    try {
      const facts = JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8'))
      if (!Array.isArray(facts)) continue
      for (const f of facts) {
        if (f.id) ids.add(f.id)
      }
    } catch {
      // Non-array seed files (e.g. tutorial.json with nested structure) — skip
    }
  }
  return ids
}

// ---------------------------------------------------------------------------
// Validate-only mode
// ---------------------------------------------------------------------------

function runValidateOnly() {
  console.log('\n=== Validate-Only Mode ===\n')
  if (!existsSync(OUTPUT_PATH)) {
    console.error('ERROR: bridge-curated.json does not exist. Run without --validate-only first.')
    process.exit(1)
  }
  const bridgeFacts = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
  if (!Array.isArray(bridgeFacts)) {
    console.error('ERROR: bridge-curated.json is not an array.')
    process.exit(1)
  }
  const existingIds = collectExistingSeedIds()
  let collisions = 0
  const seenInBridge = new Set()
  let dupes = 0
  for (const f of bridgeFacts) {
    if (existingIds.has(f.id)) {
      console.error(`COLLISION: ${f.id} already exists in another seed file`)
      collisions++
    }
    if (seenInBridge.has(f.id)) {
      console.error(`DUPE IN BRIDGE: ${f.id} appears more than once`)
      dupes++
    }
    seenInBridge.add(f.id)
  }
  console.log(`Total facts: ${bridgeFacts.length}`)
  console.log(`ID collisions with other seed files: ${collisions}`)
  console.log(`Duplicate IDs within bridge-curated.json: ${dupes}`)
  console.log(collisions === 0 && dupes === 0 ? '\nAll checks passed.' : '\nValidation FAILED.')
  process.exit(collisions > 0 || dupes > 0 ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Semantic dupe analysis
// ---------------------------------------------------------------------------

/**
 * Warn about question-text collisions across different entity IDs.
 *
 * Template-style decks (world_countries, world_capitals) intentionally share
 * question text like "Which country is highlighted on this map?" — one per
 * entity but same phrasing. We group these and emit a single summary line
 * instead of one warning per instance to avoid log flood.
 *
 * @param {object[]} facts
 */
function reportSemanticDupes(facts) {
  /** @type {Map<string, string[]>} question text → [factId, ...] */
  const questionToIds = new Map()

  for (const fact of facts) {
    const q = fact.quizQuestion?.toLowerCase().trim()
    if (!q) continue
    if (!questionToIds.has(q)) questionToIds.set(q, [])
    questionToIds.get(q).push(fact.id)
  }

  let singleDupeCount = 0
  let templateGroupCount = 0

  for (const [q, ids] of questionToIds) {
    if (ids.length <= 1) continue

    if (ids.length > 5) {
      // Template-style deck — summarise rather than spam
      templateGroupCount++
      if (VERBOSE) {
        console.warn(
          `[TEMPLATE_QUESTION] "${q.slice(0, 80)}" — shared by ${ids.length} facts (expected for map/image template decks)`,
        )
      }
    } else {
      // Genuine semantic dupe — always warn
      singleDupeCount++
      console.warn(
        `[SEMANTIC_DUPE] "${q.slice(0, 80)}" — ${ids.length} facts share this question: ${ids.join(', ')}`,
      )
    }
  }

  if (templateGroupCount > 0 && !VERBOSE) {
    console.warn(
      `[TEMPLATE_QUESTIONS] ${templateGroupCount} question template(s) shared by many facts (map/image decks — expected). Use --verbose to see details.`,
    )
  }
  if (singleDupeCount === 0 && templateGroupCount === 0) {
    // All questions are unique — no output needed
  }
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

function run() {
  if (VALIDATE_ONLY) {
    runValidateOnly()
    return
  }

  // 1. Load manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const deckFilenames = manifest.decks ?? manifest

  // 2. Load bridge config
  const bridgeConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))

  // 3. Collect existing seed IDs for collision detection
  const existingSeedIds = collectExistingSeedIds()

  // 4. Process each deck
  const allBridgedFacts = []
  const manifestStats = {}

  /** @type {string[]} */
  const deckIds = Object.keys(bridgeConfig).filter((id) => {
    const cfg = bridgeConfig[id]
    if (typeof cfg !== 'object' || id.startsWith('_comment')) return false
    return true
  })

  for (const deckId of deckIds) {
    if (DECK_FILTER && deckId !== DECK_FILTER) continue

    const deckConfig = bridgeConfig[deckId]
    if (!deckConfig || typeof deckConfig !== 'object') continue

    // Skip decks explicitly flagged
    if (deckConfig.skip === true) {
      if (VERBOSE) {
        console.log(
          `[SKIP] ${deckId} — skip=true (${deckConfig._skipReason ?? 'no reason given'})`,
        )
      }
      manifestStats[deckId] = {
        totalFacts: 0,
        entities: 0,
        bridged: 0,
        skipped: 0,
        skipReason: deckConfig._skipReason ?? 'skip=true',
      }
      continue
    }

    // Find deck filename
    const deckFilename = deckFilenames.find((f) => {
      if (typeof f === 'string') return f === `${deckId}.json`
      return f.id === deckId
    })
    if (!deckFilename) {
      if (VERBOSE) console.log(`[SKIP] ${deckId} — not found in manifest`)
      continue
    }

    const filename = typeof deckFilename === 'string' ? deckFilename : `${deckFilename.id}.json`
    const deckPath = join(DECKS_DIR, filename)

    if (!existsSync(deckPath)) {
      console.warn(`[WARN] ${deckId} — file not found: ${deckPath}`)
      continue
    }

    let deck
    try {
      deck = JSON.parse(readFileSync(deckPath, 'utf8'))
    } catch (err) {
      console.error(`[ERROR] Failed to parse ${deckPath}: ${err.message}`)
      continue
    }

    // Skip decks without facts or vocabulary decks
    if (!Array.isArray(deck.facts) || deck.facts.length === 0) {
      if (VERBOSE) console.log(`[SKIP] ${deckId} — no facts array`)
      continue
    }
    if (deck.domain === 'vocabulary') {
      if (VERBOSE) console.log(`[SKIP] ${deckId} — vocabulary domain`)
      continue
    }

    const { prefixSegments, entitySegments = 1, skipChainThemes = [], separator = '_' } = deckConfig
    const skipThemeSet = new Set(skipChainThemes)

    // 5. Group facts by entity key
    /** @type {Map<string, object[]>} */
    const entityGroups = new Map()

    for (const fact of deck.facts) {
      // Filter: skip explicitly excluded chain themes
      if (skipThemeSet.has(fact.chainThemeId)) continue

      // Filter: must have at least 3 distractors
      if (!fact.distractors || fact.distractors.length < 3) continue

      // Filter: skip image-dependent questions that reference the visual directly
      if (/this image|shown above|pictured/i.test(fact.quizQuestion ?? '')) continue

      const entityKey = getEntityKey(fact.id, prefixSegments, entitySegments, separator)
      if (!entityKey) continue

      if (!entityGroups.has(entityKey)) entityGroups.set(entityKey, [])
      entityGroups.get(entityKey).push(fact)
    }

    // 6. Score and select best candidate per entity
    const bridgedFromDeck = []
    let skippedEntities = 0

    for (const [entityKey, candidates] of entityGroups) {
      if (candidates.length === 0) {
        skippedEntities++
        continue
      }

      // Sort candidates descending by score, pick best
      candidates.sort((a, b) => scoreFact(b) - scoreFact(a))
      const best = candidates[0]

      if (VERBOSE) {
        console.log(
          `  [${deckId}] entity=${entityKey} → selected ${best.id} (score=${scoreFact(best)}, ${candidates.length} candidates)`,
        )
      }

      bridgedFromDeck.push(best)
    }

    // 7. Transform to Fact format
    const transformedFacts = bridgedFromDeck.map((f) => transformFact(f, deck, deckConfig))

    if (VERBOSE) {
      console.log(
        `[${deckId}] ${deck.facts.length} facts → ${entityGroups.size} entities → ${transformedFacts.length} bridged, ${skippedEntities} entities skipped`,
      )
    }

    allBridgedFacts.push(...transformedFacts)
    manifestStats[deckId] = {
      totalFacts: deck.facts.length,
      entities: entityGroups.size,
      bridged: transformedFacts.length,
      skipped: skippedEntities,
    }
  }

  // 8. Sort output for deterministic/idempotent diffs
  allBridgedFacts.sort((a, b) => a.id.localeCompare(b.id))

  // 9. Validate: ID collisions with existing seed files
  let collisionCount = 0
  const seenIds = new Set()
  for (const fact of allBridgedFacts) {
    if (existingSeedIds.has(fact.id)) {
      console.error(`[COLLISION] ${fact.id} already exists in another seed file`)
      collisionCount++
    }
    if (seenIds.has(fact.id)) {
      console.warn(`[DUPE] ${fact.id} appears more than once in bridge output — keeping first`)
    }
    seenIds.add(fact.id)
  }

  // Deduplicate (keep first occurrence — output is already sorted by ID)
  const deduped = allBridgedFacts.filter(
    (f, idx, arr) => arr.findIndex((x) => x.id === f.id) === idx,
  )

  // 10. Semantic dupe analysis — grouped, non-spammy
  reportSemanticDupes(deduped)

  // 11. Print summary table
  printSummaryTable(manifestStats, deduped.length, collisionCount)

  // 12. Write output files (unless dry-run)
  if (DRY_RUN) {
    console.log('\n[DRY RUN] No files written.')
    return
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(deduped, null, 2), 'utf8')
  console.log(`\nWrote ${deduped.length} facts → ${OUTPUT_PATH}`)

  const bridgeManifest = {
    lastRun: new Date().toISOString(),
    totalBridgedFacts: deduped.length,
    decks: manifestStats,
  }
  writeFileSync(MANIFEST_OUT_PATH, JSON.stringify(bridgeManifest, null, 2), 'utf8')
  console.log(`Wrote bridge manifest → ${MANIFEST_OUT_PATH}`)

  if (collisionCount > 0) {
    console.error(
      `\nERROR: ${collisionCount} ID collision(s) detected. Fix before ingesting into facts.db.`,
    )
    process.exit(1)
  }

  // Auto-stamp lastTriviaBridge in inspection registry for successfully bridged decks (best-effort)
  try {
    const bridgedIds = Object.entries(manifestStats)
      .filter(([, s]) => !s.skipReason && s.bridged > 0)
      .map(([id]) => id)
      .join(',')
    if (bridgedIds) {
      execSync(
        `npx tsx scripts/registry/updater.ts --ids "${bridgedIds}" --type lastTriviaBridge`,
        { stdio: 'pipe' }
      )
    }
  } catch (_) {
    // Registry stamp failure never blocks bridge output
  }
}

// ---------------------------------------------------------------------------
// Pretty-print summary table
// ---------------------------------------------------------------------------

function printSummaryTable(stats, totalFacts, collisions) {
  const COL_DECK = 24
  const COL_NUM = 9

  const padRight = (s, n) => {
    const str = String(s)
    return str + ' '.repeat(Math.max(0, n - str.length))
  }
  const padLeft = (s, n) => {
    const str = String(s)
    return ' '.repeat(Math.max(0, n - str.length)) + str
  }

  const header =
    padRight('Deck', COL_DECK) +
    padLeft('Total', COL_NUM) +
    padLeft('Entities', COL_NUM) +
    padLeft('Bridged', COL_NUM) +
    padLeft('Skipped', COL_NUM)

  const divider =
    '─'.repeat(COL_DECK) +
    ' ' +
    '─'.repeat(COL_NUM - 1) +
    ' ' +
    '─'.repeat(COL_NUM - 1) +
    ' ' +
    '─'.repeat(COL_NUM - 1) +
    ' ' +
    '─'.repeat(COL_NUM - 1)

  console.log('\n=== Curated Deck → Trivia Bridge ===\n')
  console.log(header)
  console.log(divider)

  for (const [deckId, s] of Object.entries(stats)) {
    if (s.skipReason) {
      console.log(padRight(deckId, COL_DECK) + '  (skipped)')
      continue
    }
    console.log(
      padRight(deckId, COL_DECK) +
        padLeft(s.totalFacts, COL_NUM) +
        padLeft(s.entities, COL_NUM) +
        padLeft(s.bridged, COL_NUM) +
        padLeft(s.skipped, COL_NUM),
    )
  }

  console.log(divider)
  console.log(`\nTotal bridge facts: ${totalFacts.toLocaleString()}`)
  console.log(`ID collisions: ${collisions}`)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

run()

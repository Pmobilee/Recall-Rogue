/**
 * Utility script to check current fact count against subscription gate.
 * Usage: npx ts-node server/src/scripts/fact-count-check.ts
 */

const MINIMUM_FACTS_REQUIRED = 3000
const CURRENT_FACT_COUNT = 522 // Updated by content pipeline
const FACTS_PER_WEEK = 75 // Estimated bi-weekly drops of 50-100

function main() {
  const gap = MINIMUM_FACTS_REQUIRED - CURRENT_FACT_COUNT
  const weeksToGate = Math.ceil(gap / FACTS_PER_WEEK)
  const daysToGate = weeksToGate * 7

  console.log('=== Terra Gacha Fact Count Check ===')
  console.log(`Current approved facts: ${CURRENT_FACT_COUNT}`)
  console.log(`Required for subscriptions: ${MINIMUM_FACTS_REQUIRED}`)
  console.log(`Gap: ${gap} facts`)
  console.log(`Estimated velocity: ${FACTS_PER_WEEK} facts/week`)
  console.log(`Estimated days to gate: ${daysToGate}`)
  console.log(`Gate status: ${CURRENT_FACT_COUNT >= MINIMUM_FACTS_REQUIRED ? 'PASSED' : 'NOT MET'}`)
}

main()

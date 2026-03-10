/**
 * Utility script to check current fact count against subscription gate,
 * and report audio file coverage for the TTS pipeline.
 * Usage: npx tsx server/src/scripts/fact-count-check.ts
 */

import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

const MINIMUM_FACTS_REQUIRED = 3000
const CURRENT_FACT_COUNT = 522 // Updated by content pipeline
const FACTS_PER_WEEK = 75 // Estimated bi-weekly drops of 50-100

function countAudioFiles(): { count: number; dir: string } {
  const audioDir = join(process.cwd(), 'data', 'audio')
  if (!existsSync(audioDir)) {
    return { count: 0, dir: audioDir }
  }
  try {
    const files = readdirSync(audioDir).filter((f) => f.endsWith('.mp3'))
    return { count: files.length, dir: audioDir }
  } catch {
    return { count: 0, dir: audioDir }
  }
}

function main(): void {
  const gap = MINIMUM_FACTS_REQUIRED - CURRENT_FACT_COUNT
  const weeksToGate = Math.ceil(gap / FACTS_PER_WEEK)
  const daysToGate = weeksToGate * 7

  const { count: audioCount, dir: audioDir } = countAudioFiles()
  const audioCoverage =
    CURRENT_FACT_COUNT > 0
      ? ((audioCount / CURRENT_FACT_COUNT) * 100).toFixed(1)
      : '0.0'

  console.log('=== Recall Rogue Fact Count Check ===')
  console.log(`Current approved facts: ${CURRENT_FACT_COUNT}`)
  console.log(`Required for subscriptions: ${MINIMUM_FACTS_REQUIRED}`)
  console.log(`Gap: ${gap} facts`)
  console.log(`Estimated velocity: ${FACTS_PER_WEEK} facts/week`)
  console.log(`Estimated days to gate: ${daysToGate}`)
  console.log(
    `Gate status: ${CURRENT_FACT_COUNT >= MINIMUM_FACTS_REQUIRED ? 'PASSED' : 'NOT MET'}`
  )
  console.log('')
  console.log('=== TTS Audio Coverage ===')
  console.log(`Audio directory: ${audioDir}`)
  console.log(`MP3 files present: ${audioCount}`)
  console.log(
    `Coverage: ${audioCount}/${CURRENT_FACT_COUNT} facts (${audioCoverage}%)`
  )
  console.log(
    `Missing audio: ${Math.max(0, CURRENT_FACT_COUNT - audioCount)} facts`
  )
}

main()

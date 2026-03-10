/**
 * TTS Service for vocabulary pronunciation audio generation (DD-V2-094).
 *
 * Primary: Azure Cognitive Services TTS (Neural Voices) via REST API.
 * No external npm SDK — uses only Node.js built-in fetch and fs/promises.
 *
 * In production, AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set.
 * In dev mode, logs intent and returns { success: false } without throwing.
 *
 * DD-V2-094: Azure Neural TTS for vocabulary pronunciation; language-specific voices.
 * DD-V2-195: Azure Cognitive Services TTS primary; ElevenLabs fallback (future).
 */

import { config } from '../config.js'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

/** Neural voice assignments per BCP-47 language tag (DD-V2-094) */
const VOICE_MAP: Record<string, string> = {
  ja: 'ja-JP-NanamiNeural',
  es: 'es-ES-ElviraNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-KatjaNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  ko: 'ko-KR-SunHiNeural',
  en: 'en-US-JennyNeural',
}

export interface TTSResult {
  success: boolean
  outputPath?: string
  error?: string
}

/**
 * Build SSML markup for a single utterance with slight slow-down for learners.
 * Uses prosody rate="0.85" so learners can hear each phoneme clearly.
 *
 * @param text - The text to speak.
 * @param voice - The full Azure Neural voice name (e.g. "ja-JP-NanamiNeural").
 * @returns SSML string ready to send to the Azure TTS endpoint.
 */
function buildSSML(text: string, voice: string): string {
  const lang = voice.split('-').slice(0, 2).join('-')
  return [
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">`,
    `  <voice name="${voice}">`,
    `    <prosody rate="0.85">${text}</prosody>`,
    `  </voice>`,
    `</speak>`,
  ].join('\n')
}

/**
 * Generate pronunciation audio for a single vocabulary item via Azure TTS REST API.
 * In dev (no AZURE_SPEECH_KEY), logs the intent and returns { success: false }.
 *
 * @param factId - Unique fact identifier (used for file naming).
 * @param language - BCP-47 language tag (e.g. "ja", "es").
 * @param text - The text to synthesise (prefer reading/furigana for Japanese).
 * @param outputPath - Absolute path to write the MP3 file.
 * @returns TTSResult with success flag and output path or error message.
 */
export async function generatePronunciationAudio(
  factId: string,
  language: string,
  text: string,
  outputPath: string
): Promise<TTSResult> {
  const voice = VOICE_MAP[language]
  if (!voice) {
    return {
      success: false,
      error: `No voice configured for language: ${language}`,
    }
  }

  if (!config.azureSpeechKey || !config.azureSpeechRegion) {
    console.log(
      `[TTS] Stub: ${factId} → ${outputPath} (${language}/${voice})`
    )
    return {
      success: false,
      error: 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not configured',
    }
  }

  const endpoint = `https://${config.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`
  const ssml = buildSSML(text, voice)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.azureSpeechKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      'User-Agent': 'RecallRogueServer/1.0',
    },
    body: ssml,
  })

  if (!res.ok) {
    const msg = await res.text()
    return { success: false, error: `Azure TTS ${res.status}: ${msg}` }
  }

  const audioBytes = Buffer.from(await res.arrayBuffer())
  const dir = outputPath.substring(0, outputPath.lastIndexOf('/'))
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(outputPath, audioBytes)

  return { success: true, outputPath }
}

/**
 * Batch-generate audio for vocabulary facts.
 * Throttles to ~4.7 req/s to stay within Azure free-tier rate limits.
 * Skips facts whose output file already exists (idempotent re-run).
 * Called via: npx tsx server/scripts/generate-pronunciation-audio.ts --language ja --level N5
 *
 * @param facts - Array of fact objects with id, word, optional reading, and language.
 * @param outputDir - Directory to write MP3 files into.
 * @returns Counts of generated, failed, and error messages.
 */
export async function batchGenerateAudio(
  facts: { id: string; word: string; reading?: string; language: string }[],
  outputDir: string
): Promise<{ generated: number; failed: number; errors: string[] }> {
  let generated = 0
  let failed = 0
  const errors: string[] = []

  for (const fact of facts) {
    const text = fact.reading ?? fact.word // Prefer hiragana reading for Japanese
    const outputPath = `${outputDir}/${fact.id}_recognition.mp3`

    // Skip already-generated files (idempotent re-run)
    if (existsSync(outputPath)) {
      generated++
      continue
    }

    const result = await generatePronunciationAudio(
      fact.id,
      fact.language,
      text,
      outputPath
    )
    if (result.success) {
      generated++
    } else {
      failed++
      errors.push(`${fact.id}: ${result.error}`)
    }

    // 210ms gap → ~4.7 req/s, safely under Azure 5 req/s free-tier limit
    await new Promise((r) => setTimeout(r, 210))

    if ((generated + failed) % 10 === 0) {
      console.log(
        `[TTS] ${generated + failed}/${facts.length} (${generated} ok, ${failed} failed)`
      )
    }
  }

  return { generated, failed, errors }
}

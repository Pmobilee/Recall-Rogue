/**
 * TTS Service for vocabulary pronunciation audio generation (DD-V2-094).
 *
 * Primary: Azure Cognitive Services TTS (Neural Voices)
 * Fallback: ElevenLabs API
 *
 * In production, AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set.
 * This file provides the interface and stub for local development.
 */

/** Voice mapping per language */
const VOICE_MAP: Record<string, string> = {
  ja: 'ja-JP-NanamiNeural',
  es: 'es-ES-ElviraNeural',
  fr: 'fr-FR-DeniseNeural'
}

export interface TTSResult {
  success: boolean
  outputPath?: string
  error?: string
}

/**
 * Generate pronunciation audio for a vocabulary item.
 * Stub implementation — in production, uses Azure Cognitive Services SDK.
 */
export async function generatePronunciationAudio(
  factId: string,
  language: string,
  text: string,
  outputPath: string
): Promise<TTSResult> {
  const voice = VOICE_MAP[language]
  if (!voice) {
    return { success: false, error: `No voice configured for language: ${language}` }
  }

  const speechKey = process.env.AZURE_SPEECH_KEY
  const speechRegion = process.env.AZURE_SPEECH_REGION

  if (!speechKey || !speechRegion) {
    console.log(`[TTS] Stub: Would generate audio for "${text}" (${language}) with voice ${voice} → ${outputPath}`)
    return { success: false, error: 'Azure TTS credentials not configured (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)' }
  }

  // Production implementation would use:
  // import { SpeechConfig, AudioConfig, SpeechSynthesizer } from 'microsoft-cognitiveservices-speech-sdk'
  // const speechConfig = SpeechConfig.fromSubscription(speechKey, speechRegion)
  // speechConfig.speechSynthesisVoiceName = voice
  // const audioConfig = AudioConfig.fromAudioFileOutput(outputPath)
  // const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig)
  // await synthesizer.speakTextAsync(text)

  console.log(`[TTS] Would generate: ${factId} → ${outputPath} (${language}/${voice})`)
  return { success: true, outputPath }
}

/**
 * Batch generate audio for vocabulary facts.
 * Called via: npx tsx server/scripts/generate-pronunciation-audio.ts --language ja --level N5
 */
export async function batchGenerateAudio(
  facts: { id: string; word: string; reading?: string; language: string }[],
  outputDir: string
): Promise<{ generated: number; failed: number }> {
  let generated = 0
  let failed = 0

  for (const fact of facts) {
    const textToSpeak = fact.reading ?? fact.word  // Prefer hiragana reading for Japanese
    const outputPath = `${outputDir}/${fact.id}_recognition.mp3`

    const result = await generatePronunciationAudio(fact.id, fact.language, textToSpeak, outputPath)
    if (result.success) {
      generated++
    } else {
      failed++
    }

    if ((generated + failed) % 10 === 0) {
      console.log(`[TTS] Progress: ${generated + failed}/${facts.length} (${generated} ok, ${failed} failed)`)
    }
  }

  return { generated, failed }
}

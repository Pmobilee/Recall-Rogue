# Phase 24: Language Learning Expansion

**Last Updated**: 2026-03-03
**Status**: Planned (post-Phase 23)
**Prerequisite Phases**: Phase 11 (Fact Content Engine), Phase 12 (Interest & Personalization), Phase 19 (Auth & Cloud Saves), Phase 23 (Live Ops — Language Festival seasonal event)

---

## Overview

Phase 24 extends Terra Gacha's knowledge engine into a full-featured language learning platform. The core insight is that language learning — vocabulary, grammar, phrases — is structurally identical to fact learning: there is a statement (a word or rule), a correct answer (its meaning or form), and plausible distractors (semantically similar words or rules). The SM-2 engine, Knowledge Tree, and quiz system require no fundamental changes; they simply receive new fact types and new content.

This is not a separate "language game mode." Language learning is implemented as a Category Lock (DD-V2-132) — a settings toggle that filters the fact pool to language content. A player who toggles Language Mode sees the same dome, the same mine, the same Knowledge Tree — but GAIA serves vocabulary and grammar facts instead of natural science facts. All progress lives on the same tree.

**V1 scope (Phase 24)**: Japanese (N5 → N4 → N3 vocabulary; the N3 content already exists with 400 words in the current database). Spanish (A1 → A2 vocabulary; the most widely studied European language by English speakers). Grammar rule facts for both languages.

**Future scope (post-Phase 24)**: N2/N1 Japanese, French, Mandarin, Korean, listening comprehension, conversation scenarios — all extensions of the same architecture, not structural changes.

**Key design decisions governing this phase**:
- DD-V2-094: TTS pronunciation audio via ElevenLabs or Azure TTS (language only; general facts remain text + pixel art only)
- DD-V2-128: Three SM-2 tracks per vocabulary word — recognition, recall, usage
- DD-V2-132: Language Mode = Category Lock, not a separate mode

---

## Prerequisites

Before beginning Phase 24:

1. Phase 11 must be complete: the fact ingestion API, content pipeline, and LLM distractor generation must be operational — language vocabulary items are ingested through the same pipeline with `type: "vocabulary"` or `type: "grammar"`
2. Phase 12 must be complete: Category Lock system must be implemented — Language Mode depends on it
3. The existing 400 N3 Japanese vocabulary facts in `src/data/seed/` must be migrated to the server-side fact database (Phase 11 prerequisite)
4. `src/services/sm2.ts` must support multiple `ReviewState` records per fact-player pair (required for three SM-2 tracks — see 24.1)

---

## Sub-Phase 24.1: Multi-Language Support & Three SM-2 Tracks

### What

The structural foundation of the language learning expansion. Three deliverables:

1. **Schema extensions**: Add `language`, `track`, and vocabulary-specific fields to the fact and SM-2 state schemas
2. **Three SM-2 tracks per word**: Each vocabulary item has three independent `ReviewState` records — one per track. The tracks are sequenced (recognition unlocks recall; recall unlocks usage) but independent in scheduling (DD-V2-128)
3. **Language Mode toggle**: A settings switch that applies Category Lock to a selected language. Toggling is instant, lossless, and reversible

**Three SM-2 track definitions**:

| Track | Display Name | Question Format | Correct Answer | Distractor Type |
|-------|-------------|-----------------|----------------|-----------------|
| `recognition` | "Do You Know It?" | See the target word (kana/romaji/hiragana) → select the English meaning | English meaning | Semantically similar English words |
| `recall` | "Can You Produce It?" | See the English meaning → select the target word (kana/romaji) | Target word | Phonetically or orthographically similar target words |
| `usage` | "Use It Correctly" | See a sentence with a blank → select the correct word from 4 options | Target word in correct context | Contextually plausible but incorrect vocabulary items |

**V1 rollout plan** (per DD-V2-128):
- Phase 24.0 launch: recognition track only (current system, already working for N3 vocab)
- Phase 24.1 (4 weeks post-launch): recall track activates after a word reaches "Familiar" (interval >= 4 days on recognition track)
- Phase 24.2 (8 weeks post-launch): usage track activates after a word reaches "Known" (interval >= 15 days on recognition track)

This sequencing ensures players have solid recognition before being tested on production, matching established SLA pedagogical research on vocabulary acquisition stages.

**Language progression tiers** (expansion order):
- Japanese: N5 → N4 → N3 (existing) → N2 (post-Phase 24) → N1 (long-term)
- Spanish: A1 → A2 → B1 (post-Phase 24)

### Where

- `src/types/vocabulary.ts` — extended vocabulary fact type with language fields
- `src/services/sm2.ts` — multi-track ReviewState support
- `src/services/languageService.ts` — Language Mode management, track activation logic
- `src/ui/Settings.svelte` — Language Mode toggle UI
- `src/ui/components/LanguageModePanel.svelte` — language selection overlay (which language, which JLPT/CEFR level)
- `src/data/seed/japanese-n5.json` — N5 vocabulary seed data (280 words)
- `src/data/seed/japanese-n4.json` — N4 vocabulary seed data (650 words)
- `src/data/seed/spanish-a1.json` — Spanish A1 vocabulary seed data (500 words)
- `src/data/seed/spanish-a2.json` — Spanish A2 vocabulary seed data (800 words)
- `server/scripts/build-language-db.mjs` — extends `build-facts-db.mjs` to include vocabulary items

### How

**Step 1: Extend the vocabulary fact schema**

In `src/types/vocabulary.ts`, define:

```typescript
export type VocabularyTrack = 'recognition' | 'recall' | 'usage'

export interface VocabularyFact {
  id: string
  type: 'vocabulary' | 'grammar' | 'phrase'
  language: string            // ISO 639-1: 'ja', 'es', 'fr'
  languageLevel: string       // 'N5', 'N4', 'N3', 'A1', 'A2', 'B1'

  // Target language content
  word: string                // The vocabulary word in the target language
  reading?: string            // For Japanese: hiragana reading of kanji (e.g., "かんじ" for "漢字")
  romaji?: string             // For Japanese: romanized reading (e.g., "kanji")
  partOfSpeech: string        // 'noun' | 'verb' | 'adjective' | 'adverb' | 'particle' | 'expression'
  jlptLevel?: string          // 'N5' | 'N4' | 'N3' | 'N2' | 'N1' (Japanese only)
  cefrLevel?: string          // 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' (European languages)

  // Meanings and context
  primaryMeaning: string      // English meaning (concise)
  alternativeMeanings: string[] // Additional English meanings
  exampleSentence: string     // Target language example sentence
  exampleSentenceTranslation: string  // English translation of example sentence
  contextNote?: string        // Usage context (formal/informal, regional variations)

  // Quiz content per track
  recognition: {
    question: string          // e.g., "What does '図書館' mean?"
    correctAnswer: string     // e.g., "Library"
    distractors: string[]     // e.g., ["Museum", "School", "Hospital", "Bookstore"]
  }
  recall: {
    question: string          // e.g., "How do you say 'library' in Japanese?"
    correctAnswer: string     // e.g., "図書館 (としょかん)"
    distractors: string[]     // Phonetically similar Japanese words
  }
  usage: {
    sentenceWithBlank: string // e.g., "私は___に行って本を借りました。"
    correctAnswer: string     // e.g., "図書館"
    distractors: string[]     // Contextually plausible alternatives
    hint?: string             // English hint if the sentence context is ambiguous
  }

  // Audio (DD-V2-094)
  audioUrl?: string           // TTS-generated pronunciation audio URL
  audioGeneratedAt?: string   // ISO 8601, to know when to regenerate

  // SM-2 metadata (generated per-player at runtime, not stored here)
  // Recognition track: standard ReviewState
  // Recall track: separate ReviewState (activated at recognition interval >= 4)
  // Usage track: separate ReviewState (activated at recognition interval >= 15)

  // Standard fact fields
  category: ['Language', string, string]  // e.g., ['Language', 'Japanese', 'N5 Vocabulary']
  imageUrl?: string
  imagePrompt?: string        // For vocabulary: illustrate the word's meaning without showing the word text
  gaiaComment: string
  wowFactor?: string          // For interesting vocabulary etymology or cultural context
  sourceUrl: string
  sourceName: string
  age_rating: 'kid' | 'teen' | 'adult'
}
```

**Step 2: Extend SM-2 to support multiple tracks**

Current `sm2.ts` stores one `ReviewState` per `(playerId, factId)` pair. Extend to `(playerId, factId, track)`:

```typescript
// src/services/sm2.ts — extended types

export type ReviewTrack = 'default' | 'recognition' | 'recall' | 'usage'

export interface ReviewState {
  factId: string
  track: ReviewTrack           // NEW: 'default' for general facts; one of three for vocabulary
  easeFactor: number           // Default 2.5
  interval: number             // Days until next review
  repetitions: number          // Consecutive correct reviews
  dueDate: string              // ISO 8601
  lastReviewedAt?: string
}

// Track activation rules (checked by languageService.ts):
// - 'recognition' track: always active from fact discovery
// - 'recall' track: activates when recognition.interval >= 4
// - 'usage' track: activates when recognition.interval >= 15

export function getActiveTracksForVocabularyFact(
  factId: string,
  save: PlayerSave
): ReviewTrack[] {
  const recognitionState = save.reviewStates.find(
    r => r.factId === factId && r.track === 'recognition'
  )
  if (!recognitionState) return ['recognition']
  const tracks: ReviewTrack[] = ['recognition']
  if (recognitionState.interval >= 4) tracks.push('recall')
  if (recognitionState.interval >= 15) tracks.push('usage')
  return tracks
}
```

**Step 3: Language Mode toggle in Settings**

In `Settings.svelte`, add a "Language Mode" section:
```
Language Learning
[Toggle: Language Mode ON/OFF]
  When ON, quizzes and artifacts focus on language facts
  → Language: [Japanese ▼] [Spanish ▼]
  → Level: [N5 ▼] [N4 ▼] [N3 ▼] (for Japanese)
  → Show both general facts and language facts [Checkbox]
```

When Language Mode is toggled ON, `languageService.setLanguageModeLock(language, level)` is called. This writes the category lock to player prefs: `categoryLock: ['Language', 'Japanese', 'N5 Vocabulary']`. All fact-serving functions in `factsDB.ts` and `quizService.ts` already respect `categoryLock` — no additional changes required (DD-V2-132 design: Category Lock reuse).

The toggle is instant and lossless. Toggling OFF removes the category lock entirely, restoring normal mixed-category play. All review states for all tracks are preserved regardless of toggle state.

**Step 4: Seed vocabulary content**

Create `src/data/seed/japanese-n5.json` with the following structure per word:

```json
{
  "id": "ja-n5-001",
  "type": "vocabulary",
  "language": "ja",
  "languageLevel": "N5",
  "word": "図書館",
  "reading": "としょかん",
  "romaji": "toshokan",
  "partOfSpeech": "noun",
  "jlptLevel": "N5",
  "primaryMeaning": "Library",
  "alternativeMeanings": ["Public library"],
  "exampleSentence": "図書館で本を借りました。",
  "exampleSentenceTranslation": "I borrowed a book from the library.",
  "recognition": {
    "question": "What does '図書館 (としょかん)' mean?",
    "correctAnswer": "Library",
    "distractors": ["Museum", "School", "Bookstore", "Post office", "Hospital", "Bank", "Station", "Department store", "Supermarket", "Restaurant", "Park", "Hotel"]
  },
  "recall": {
    "question": "How do you say 'library' in Japanese?",
    "correctAnswer": "図書館 (としょかん)",
    "distractors": ["図書室 (としょしつ)", "書店 (しょてん)", "本屋 (ほんや)", "学校 (がっこう)", "大学 (だいがく)", "病院 (びょういん)"]
  },
  "usage": {
    "sentenceWithBlank": "私は___で本を借りました。",
    "correctAnswer": "図書館",
    "distractors": ["学校", "病院", "駅", "銀行"],
    "hint": "I borrowed a book from the ___."
  },
  "category": ["Language", "Japanese", "N5 Vocabulary"],
  "gaiaComment": "Libraries: physical repositories of human knowledge. I find them... emotionally resonant. Digitally speaking.",
  "wowFactor": "Japanese public libraries are free to use and have some of the highest per-capita library attendance rates in the world.",
  "sourceUrl": "https://jlpt.jp/e/about/levelsummary.html",
  "sourceName": "JLPT Official — N5 Vocabulary List",
  "age_rating": "kid"
}
```

**Step 5: Grammar rule facts**

Grammar facts use the same `type: "grammar"` field. They work identically to standard facts but with language-appropriate distractors (incorrect grammar forms rather than wrong meanings):

```json
{
  "id": "ja-grammar-001",
  "type": "grammar",
  "language": "ja",
  "languageLevel": "N5",
  "word": "〜ます形 (polite form)",
  "primaryMeaning": "The polite verb ending used in formal contexts",
  "recognition": {
    "question": "Which sentence correctly uses the polite (ます) form?",
    "correctAnswer": "毎日学校に行きます。",
    "distractors": ["毎日学校に行く。", "毎日学校に行った。", "毎日学校に行って。"]
  },
  "recall": {
    "question": "Conjugate '食べる' (taberu, to eat) into the polite present tense:",
    "correctAnswer": "食べます (tabemasu)",
    "distractors": ["食べる (taberu)", "食べた (tabeta)", "食べて (tabete)", "食べない (tabenai)"]
  },
  "usage": {
    "sentenceWithBlank": "私は毎朝コーヒーを___。(polite form)",
    "correctAnswer": "飲みます",
    "distractors": ["飲む", "飲んだ", "飲んで"]
  },
  "gaiaComment": "The ます form: Japanese politeness encoded into grammar itself. Efficient AND elegant.",
  "category": ["Language", "Japanese", "N5 Grammar"],
  "sourceUrl": "https://jlpt.jp",
  "sourceName": "JLPT N5 Grammar Reference",
  "age_rating": "kid"
}
```

**Step 6: Spanish A1 seed content**

Apply the same structure to `src/data/seed/spanish-a1.json`. Spanish vocabulary does not use `reading` or `romaji` fields. The `recognition` question format changes to "What does '[word]' mean in English?" The `recall` format is "How do you say '[English word]' in Spanish?" The `usage` format uses Spanish fill-in-the-blank sentences.

### Acceptance Criteria

- [ ] `VocabularyFact` type compiles without TypeScript errors and is importable from `src/types/vocabulary.ts`
- [ ] `sm2.ts` `getActiveTracksForVocabularyFact` correctly returns `['recognition']` at interval < 4, `['recognition', 'recall']` at interval >= 4, and all three tracks at interval >= 15
- [ ] Language Mode toggle in Settings correctly applies Category Lock without a page reload
- [ ] Toggling Language Mode OFF immediately restores non-language fact serving (verified in DevPanel > Navigation > Study session)
- [ ] All recognition track ReviewStates for vocabulary facts are preserved when Language Mode is toggled off and back on
- [ ] `npm run build` passes with no errors after adding the new type files
- [ ] At least 50 N5 Japanese words are present in `japanese-n5.json` with all three quiz track formats filled
- [ ] At least 50 Spanish A1 words are present in `spanish-a1.json`
- [ ] The daily study session correctly shows vocabulary cards when Language Mode is active (recognition question format: "What does X mean?")

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')

  // Navigate to Settings
  await page.waitForSelector('button[aria-label="Settings"]', { timeout: 10000 })
  await page.click('button[aria-label="Settings"]')
  await page.waitForSelector('.settings-page', { timeout: 5000 })

  // Find and enable Language Mode
  await page.waitForSelector('.language-mode-toggle', { timeout: 5000 })
  const toggleState = await page.getAttribute('.language-mode-toggle input', 'checked')
  if (!toggleState) {
    await page.click('.language-mode-toggle')
    await page.waitForTimeout(500)
  }

  // Select Japanese N5
  await page.selectOption('.language-select', 'ja')
  await page.selectOption('.level-select', 'N5')
  await page.screenshot({ path: '/tmp/ss-language-settings.png' })

  // Navigate back to dome and open a study session
  await page.click('button:has-text("Back")')
  await page.waitForSelector('.dome-view', { timeout: 5000 })

  // Start study session
  await page.click('button:has-text("Study")')
  await page.waitForSelector('.study-session', { timeout: 5000 })

  // Verify vocabulary card format
  const questionText = await page.textContent('.study-card-question')
  console.assert(
    questionText.includes('mean') || questionText.includes('say') || questionText.includes('Japanese'),
    `Study question should be vocabulary format, got: ${questionText}`
  )
  await page.screenshot({ path: '/tmp/ss-language-study.png' })

  await browser.close()
  console.log('PASS: Language Mode toggle and vocabulary study session work correctly')
})()
```

---

## Sub-Phase 24.2: Pronunciation & TTS Audio

### What

Pronunciation audio generated via Text-to-Speech for all vocabulary items (DD-V2-094). Audio is served from a CDN, cached on device for offline play, and played automatically when a vocabulary card is revealed during study. General (non-vocabulary) facts never receive audio — text and pixel art only.

**TTS provider selection**:
- **Primary**: Azure Cognitive Services TTS (Azure Neural Voices)
  - Japanese: `ja-JP-NanamiNeural` (female, natural) or `ja-JP-KeitaNeural` (male, natural)
  - Spanish: `es-ES-ElviraNeural` (Spain Spanish) or `es-MX-DaliaNeural` (Mexican Spanish)
  - Cost: ~$16 per 1 million characters (extremely low for vocabulary items which average 5-15 characters each)
- **Fallback**: ElevenLabs API (higher quality, higher cost — use only for high-visibility words or GAIA's spoken commentary)
- **Local cache**: All generated audio stored in `server/data/audio/` and served via `/api/audio/:factId` with CDN layer
- **On-device cache**: `@capacitor/filesystem` caches recently played audio files; maximum 50MB local cache

**Audio format**: MP3, 64kbps mono (sufficient for speech clarity, minimal storage). File naming: `{factId}_{track}.mp3` (e.g., `ja-n5-001_recognition.mp3`).

**Playback UX**:
- During study card reveal: audio plays automatically when the card flips (user sees the Japanese characters + hears the pronunciation)
- A speaker icon button allows manual replay
- Audio is paused when the app goes to background
- Audio respects device volume and the in-game audio settings mute toggle

**Grammar rule facts**: Grammar facts include audio for the example sentences, not just isolated words. The full example sentence is sent to TTS. This provides natural prosody rather than word-by-word pronunciation.

### Where

- `server/scripts/generate-pronunciation-audio.ts` — batch TTS generation script (run for all vocabulary facts without audio)
- `server/services/ttsService.ts` — Azure TTS API wrapper, audio file management
- `server/routes/audio.ts` — `GET /api/audio/:factId` streaming endpoint with CDN cache headers
- `src/services/audioService.ts` — client-side audio playback, on-device caching via Capacitor Filesystem
- `src/ui/components/StudyCard.svelte` — auto-play audio on card flip; speaker replay button
- `src/ui/components/QuizOverlay.svelte` — speaker icon on vocabulary quiz choices
- `src/assets/icons/speaker-icon.png` — pixel art speaker icon (32px and 256px variants)

### How

**Step 1: TTS service wrapper**

```typescript
// server/services/ttsService.ts
import { SpeechConfig, AudioConfig, SpeechSynthesizer } from 'microsoft-cognitiveservices-speech-sdk'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY!
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION!

const VOICE_MAP: Record<string, string> = {
  'ja': 'ja-JP-NanamiNeural',
  'es': 'es-ES-ElviraNeural',
  'fr': 'fr-FR-DeniseNeural'
}

export async function generatePronunciationAudio(
  factId: string,
  language: string,
  text: string,
  outputPath: string
): Promise<string> {
  const voice = VOICE_MAP[language]
  if (!voice) throw new Error(`No voice configured for language: ${language}`)

  const speechConfig = SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)
  speechConfig.speechSynthesisVoiceName = voice
  speechConfig.speechSynthesisOutputFormat = SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3

  await mkdir(path.dirname(outputPath), { recursive: true })

  const audioConfig = AudioConfig.fromAudioFileOutput(outputPath)
  const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig)

  await new Promise<void>((resolve, reject) => {
    synthesizer.speakTextAsync(text,
      result => { synthesizer.close(); resolve() },
      error => { synthesizer.close(); reject(error) }
    )
  })

  return outputPath
}
```

**Step 2: Batch audio generation script**

```typescript
// server/scripts/generate-pronunciation-audio.ts
// Run: npx tsx server/scripts/generate-pronunciation-audio.ts --language ja --level N5

import { db } from '../src/database'
import { generatePronunciationAudio } from '../services/ttsService'
import path from 'path'

async function batchGenerateAudio(language: string, level?: string) {
  const query = level
    ? `SELECT id, word, reading, language FROM facts WHERE type = 'vocabulary' AND language = ? AND language_level = ? AND audio_url IS NULL`
    : `SELECT id, word, reading, language FROM facts WHERE type = 'vocabulary' AND language = ? AND audio_url IS NULL`

  const facts = level
    ? db.prepare(query).all(language, level)
    : db.prepare(query).all(language)

  console.log(`Generating audio for ${facts.length} ${language} vocabulary items...`)

  let generated = 0
  for (const fact of facts) {
    const textToSpeak = fact.reading || fact.word  // Prefer hiragana reading for Japanese
    const outputPath = path.join(process.cwd(), 'data/audio', `${fact.id}_recognition.mp3`)

    try {
      await generatePronunciationAudio(fact.id, fact.language, textToSpeak, outputPath)
      const audioUrl = `/api/audio/${fact.id}`
      db.prepare(`UPDATE facts SET audio_url = ?, audio_generated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(audioUrl, fact.id)
      generated++
      if (generated % 10 === 0) console.log(`Progress: ${generated}/${facts.length}`)
    } catch (err) {
      console.error(`Failed to generate audio for ${fact.id}: ${err}`)
    }
  }
  console.log(`Done. Generated ${generated} audio files.`)
}

const args = process.argv.slice(2)
const langArg = args[args.indexOf('--language') + 1]
const levelArg = args.indexOf('--level') >= 0 ? args[args.indexOf('--level') + 1] : undefined
batchGenerateAudio(langArg, levelArg)
```

**Step 3: Audio streaming endpoint**

```typescript
// server/routes/audio.ts
import { FastifyInstance } from 'fastify'
import { createReadStream, existsSync } from 'fs'
import path from 'path'

export async function audioRoutes(app: FastifyInstance) {
  app.get('/api/audio/:factId', async (req, reply) => {
    const { factId } = req.params as { factId: string }
    // Sanitize factId — must match pattern: alphanumeric, hyphens, underscores only
    if (!/^[a-zA-Z0-9_-]+$/.test(factId)) {
      return reply.status(400).send({ error: 'Invalid factId' })
    }

    const filePath = path.join(process.cwd(), 'data/audio', `${factId}_recognition.mp3`)
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: 'Audio not found' })
    }

    reply.header('Content-Type', 'audio/mpeg')
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')  // 1 year CDN cache
    return reply.send(createReadStream(filePath))
  })
}
```

**Step 4: Client-side audio playback in StudyCard.svelte**

```svelte
<!-- StudyCard.svelte — vocabulary audio integration -->
<script lang="ts">
  import { audioService } from '../../services/audioService'
  import type { VocabularyFact } from '../../types/vocabulary'

  export let fact: VocabularyFact | null = null
  export let isFlipped: boolean = false

  // Auto-play on card flip
  $: if (isFlipped && fact?.audioUrl) {
    audioService.play(fact.audioUrl)
  }
</script>

{#if isFlipped && fact?.audioUrl}
  <button
    class="speaker-button"
    on:click={() => audioService.play(fact.audioUrl)}
    aria-label="Replay pronunciation"
  >
    <img src="/icons/speaker-icon.png" alt="Speaker" width="24" height="24" />
  </button>
{/if}
```

**Step 5: On-device audio caching**

```typescript
// src/services/audioService.ts
import { Filesystem, Directory } from '@capacitor/filesystem'

class AudioService {
  private cache = new Map<string, string>()  // URL → local file path

  async play(audioUrl: string): Promise<void> {
    try {
      const localPath = await this.getCachedOrDownload(audioUrl)
      const audio = new Audio(localPath)
      audio.play()
    } catch {
      // Fallback: direct stream (requires network)
      new Audio(audioUrl).play()
    }
  }

  private async getCachedOrDownload(audioUrl: string): Promise<string> {
    if (this.cache.has(audioUrl)) return this.cache.get(audioUrl)!

    const filename = audioUrl.split('/').pop()!
    const { uri } = await Filesystem.downloadFile({
      url: audioUrl,
      path: `audio-cache/${filename}`,
      directory: Directory.Cache
    })
    this.cache.set(audioUrl, uri)
    return uri
  }
}

export const audioService = new AudioService()
```

**Step 6: Generate pronunciation pixel art speaker icon**

Using ComfyUI:
- Prompt: "single pixel art speaker icon, sound waves emanating from speaker cone, 8-bit style, centered on white background"
- Resolution: 1024×1024, downscale to 256px (hi-res) and 32px (lo-res)
- Save to `src/assets/sprites/icons/icon_speaker.png` and `src/assets/sprites-hires/icons/icon_speaker.png`

### Acceptance Criteria

- [ ] `generate-pronunciation-audio.ts` generates valid MP3 files for all Japanese N5 words (verify with `ffprobe` on a sample)
- [ ] `GET /api/audio/ja-n5-001` returns a valid MP3 stream with `Content-Type: audio/mpeg`
- [ ] `GET /api/audio/../../../etc/passwd` returns 400 (path traversal prevention)
- [ ] Audio plays automatically when a vocabulary study card is flipped (verify in browser console — no audio errors)
- [ ] The speaker icon button allows manual audio replay
- [ ] Audio respects the Settings audio mute toggle (no audio plays when muted)
- [ ] On Capacitor (Android emulator), audio files are cached to device storage after first play
- [ ] Grammar rule audio includes the full example sentence pronunciation, not just isolated words
- [ ] `audio_generated_at` is updated in the database for all facts that receive audio
- [ ] Azure TTS credentials are stored only in server-side environment variables — never shipped to the client

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Monitor audio network requests
  const audioRequests = []
  page.on('request', req => {
    if (req.url().includes('/api/audio/')) audioRequests.push(req.url())
  })

  await page.goto('http://localhost:5173')

  // Enable Language Mode to Japanese N5
  await page.waitForSelector('button[aria-label="Settings"]', { timeout: 10000 })
  await page.click('button[aria-label="Settings"]')
  await page.waitForSelector('.language-mode-toggle', { timeout: 5000 })
  await page.click('.language-mode-toggle')
  await page.selectOption('.language-select', 'ja')
  await page.selectOption('.level-select', 'N5')
  await page.click('button:has-text("Back")')

  // Open study session
  await page.waitForSelector('.dome-view', { timeout: 5000 })
  await page.click('button:has-text("Study")')
  await page.waitForSelector('.study-session', { timeout: 5000 })

  // Flip the first card
  await page.click('.study-card')
  await page.waitForTimeout(1000)

  // Verify audio was requested
  console.assert(audioRequests.length > 0, 'Audio should be requested when vocabulary card is flipped')
  console.assert(audioRequests[0].includes('/api/audio/'), `Audio URL format should match: ${audioRequests[0]}`)

  // Verify speaker button exists
  const speakerBtn = await page.$('.speaker-button')
  console.assert(speakerBtn !== null, 'Speaker replay button should be visible after card flip')

  await page.screenshot({ path: '/tmp/ss-vocabulary-audio.png' })
  await browser.close()
  console.log('PASS: Vocabulary pronunciation audio plays on card flip')
})()
```

---

## Sub-Phase 24.3: Language-Specific Knowledge Tree & Future Features

### What

The Knowledge Tree (Phase 13) must render language branches naturally. Since Language Mode uses Category Lock (DD-V2-132), the Knowledge Tree's existing branch rendering is used. This sub-phase adds:

1. **Language branch visual treatment**: Language branches use a distinct visual style from general fact branches (script-inspired leaf shapes for Japanese; romanesque motifs for Spanish)
2. **Language-specific progress screen**: A dedicated "Language Progress" view within ArchiveRoom showing:
   - Vocabulary count by JLPT/CEFR level
   - Per-level completion percentage
   - Mastery breakdown by track (recognition/recall/usage)
   - "Next milestone" indicator ("Reach N4: master 50 more N5 words")
3. **Future feature stubs** (implementation deferred, architecture placeholder only):
   - Listening comprehension: fact type `type: "listening"` with `audioPrompt` field (audio clip played, player selects correct transcript)
   - Conversation scenarios: fact type `type: "conversation"` with `scenario` and `correctResponse` fields
   - These types are added to the TypeScript union but throw `NotImplementedError` if quiz generation is attempted

### Where

- `src/ui/components/rooms/ArchiveRoom.svelte` — Language Progress tab within the Archive room
- `src/ui/components/LanguageProgressPanel.svelte` — the language progress UI
- `src/ui/components/KnowledgeTreeCanvas.svelte` (or equivalent Phase 13 component) — language branch styling
- `src/types/vocabulary.ts` — `type: "listening" | "conversation"` stubs added to the union

### How

**Step 1: Language Progress view**

In `ArchiveRoom.svelte`, add a "Language" tab to the existing tab bar (alongside "Knowledge Tree," "Study Sessions," etc.). The tab renders `LanguageProgressPanel.svelte` which queries:

```typescript
interface LanguageProgressData {
  language: 'ja' | 'es'
  levels: {
    level: string  // 'N5', 'N4', 'A1', etc.
    totalWords: number
    recognized: number      // recognition track interval >= 1
    recalled: number        // recall track interval >= 1
    used: number            // usage track interval >= 1
    mastered: number        // recognition interval >= 60
  }[]
  nextMilestone: {
    description: string
    current: number
    target: number
  }
}
```

Display as a tiered progress visualization: each JLPT/CEFR level shown as a horizontal progress bar with three segments (recognition/recall/usage). Colors: recognition = orange, recall = blue, usage = green.

**Step 2: Language branch visual treatment**

When the Knowledge Tree renderer (Phase 13) renders branches under the `['Language', 'Japanese']` category, apply a CSS class `tree-branch--language-ja`. Leaves in this branch use a cherry blossom petal shape (5-petal SVG path) instead of the standard elliptical leaf. For Spanish, use a stylized sun-ray motif. This is purely visual — no mechanical difference.

**Step 3: N5 → N4 progression gate**

When a player has mastered 80%+ of N5 vocabulary (recognition interval >= 15 for 80%+ of N5 words), GAIA announces N4 content is now unlocking: "Your N5 foundation is solid. N4 vocabulary is now appearing in dives — about 600 words, ready when you are." N4 facts are added to the available pool, Category Lock remains on `['Language', 'Japanese']` — no sub-level lock is required.

**Step 4: Listening comprehension stub**

```typescript
// src/types/vocabulary.ts — stub for future implementation
export interface ListeningFact {
  id: string
  type: 'listening'
  language: string
  audioPromptUrl: string     // Audio clip to play
  transcriptOptions: string[] // 4 transcript options (1 correct, 3 wrong)
  correctTranscript: string
  // Implementation: TODO Phase 24.4 (post-launch)
}

// Stub in quiz system:
function generateQuizQuestion(fact: VocabularyFact | ListeningFact): QuizQuestion {
  if (fact.type === 'listening') {
    throw new Error('ListeningFact quiz not yet implemented — Phase 24.4')
  }
  // ... standard vocabulary quiz generation
}
```

### Acceptance Criteria

- [ ] Language Progress tab renders in ArchiveRoom when Language Mode is active
- [ ] Per-level completion percentages are calculated correctly (verified against known test data: 3/10 N5 words recognized → 30% recognition)
- [ ] Recognition/recall/usage bars display in the correct colors
- [ ] "Next milestone" indicator updates correctly as the player's mastery progresses
- [ ] N4 vocabulary items begin appearing in study sessions after 80%+ N5 mastery (test with DevPanel)
- [ ] Language branch leaves render with cherry blossom petal shape in the Knowledge Tree (visual verify via screenshot)
- [ ] `ListeningFact` type is defined and compiles without errors
- [ ] Attempting to quiz a `ListeningFact` throws a clearly worded `NotImplementedError` (not a silent failure)
- [ ] `npm run typecheck` passes with 0 errors across all Phase 24 files

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')

  // Enable Language Mode
  await page.waitForSelector('button[aria-label="Settings"]', { timeout: 10000 })
  await page.click('button[aria-label="Settings"]')
  await page.click('.language-mode-toggle')
  await page.selectOption('.language-select', 'ja')
  await page.click('button:has-text("Back")')

  // Navigate to Archive room
  await page.waitForSelector('.dome-view', { timeout: 5000 })
  await page.click('[data-room="archive"]')
  await page.waitForSelector('.archive-room', { timeout: 5000 })

  // Find and click Language tab
  await page.click('button:has-text("Language")')
  await page.waitForSelector('.language-progress-panel', { timeout: 5000 })

  // Verify N5 progress bar renders
  const n5Row = await page.$('.level-row[data-level="N5"]')
  console.assert(n5Row !== null, 'N5 progress row must render in Language Progress panel')

  // Verify three track bars (recognition/recall/usage)
  const trackBars = await page.$$('.track-bar')
  console.assert(trackBars.length >= 3, 'Must have at least 3 track bars (recognition/recall/usage)')

  await page.screenshot({ path: '/tmp/ss-language-progress.png' })
  await browser.close()
  console.log('PASS: Language Progress panel renders correctly')
})()
```

---

## Verification Gate

Before Phase 24 is considered complete:

1. **Typecheck**: `npm run typecheck` passes with 0 errors across all new Phase 24 files
2. **Build**: `npm run build` succeeds with no warnings in Phase 24 files
3. **Language Mode toggle**: Switching Language Mode ON/OFF is instant and lossless (no data loss confirmed via before/after save comparison)
4. **Three tracks**: Manually set a word's recognition interval to 4 in DevPanel; verify recall track activates in next study session
5. **TTS audio**: At least 100 Japanese N5 words have generated audio files in `server/data/audio/`; audio plays correctly in-app
6. **Path traversal**: `GET /api/audio/../../../etc/passwd` returns 400
7. **Language Progress**: The Language Progress panel renders with correct completion percentages for a known test state (5 words recognized, 2 recalled)
8. **N4 unlock**: DevPanel's "Progression > Mark N5 80% mastered" tool triggers GAIA N4 unlock announcement

---

## Files Affected

### New Files
- `src/types/vocabulary.ts`
- `src/services/languageService.ts`
- `src/services/audioService.ts`
- `src/ui/components/LanguageModePanel.svelte`
- `src/ui/components/LanguageProgressPanel.svelte`
- `src/data/seed/japanese-n5.json`
- `src/data/seed/japanese-n4.json`
- `src/data/seed/spanish-a1.json`
- `src/data/seed/spanish-a2.json`
- `src/assets/sprites/icons/icon_speaker.png`
- `src/assets/sprites-hires/icons/icon_speaker.png`
- `server/scripts/generate-pronunciation-audio.ts`
- `server/services/ttsService.ts`
- `server/routes/audio.ts`
- `server/data/audio/` (directory — gitignored, generated)

### Modified Files
- `src/services/sm2.ts` — `ReviewTrack` type, `getActiveTracksForVocabularyFact()`, multi-track ReviewState storage
- `src/services/factsDB.ts` — vocabulary fact queries, language-filtered fact pools
- `src/ui/Settings.svelte` — Language Mode toggle section
- `src/ui/components/StudyCard.svelte` — vocabulary audio auto-play and speaker button
- `src/ui/components/QuizOverlay.svelte` — speaker icon for vocabulary quiz choices
- `src/ui/components/rooms/ArchiveRoom.svelte` — Language tab and Language Progress panel
- `server/scripts/build-facts-db.mjs` — extended to include vocabulary seed data
- `server/routes/index.ts` — register `audioRoutes`
- `src/types/index.ts` — export `VocabularyFact`, `ReviewTrack`

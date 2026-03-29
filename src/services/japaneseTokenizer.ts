/**
 * japaneseTokenizer.ts
 *
 * Lazy-loading Japanese tokenizer using kuromoji.js.
 * Dictionary files are served statically from /assets/kuromoji/ and loaded on first use.
 * Results are cached per-sentence to avoid redundant tokenization.
 */

export interface JapaneseToken {
  /** The word as it appears in the sentence */
  surface: string
  /** Hiragana reading */
  reading: string
  /** Dictionary form (for lookup) */
  basicForm: string
  /** Part of speech (Japanese: 名詞, 動詞, etc.) */
  pos: string
  /** English meaning from JMdict */
  englishGloss?: string
}

let tokenizerPromise: Promise<any> | null = null
let dictData: Record<string, { r: string; g: string }> | null = null
const sentenceCache = new Map<string, JapaneseToken[]>()

/**
 * Load the kuromoji tokenizer lazily.
 * Call once — subsequent calls return the cached promise.
 */
async function getTokenizer(): Promise<any> {
  if (tokenizerPromise) return tokenizerPromise

  tokenizerPromise = new Promise((resolve, reject) => {
    // Dynamic import keeps kuromoji out of the main bundle chunk
    import('kuromoji').then((kuromoji) => {
      kuromoji.default.builder({ dicPath: '/assets/kuromoji/' }).build((err: any, tokenizer: any) => {
        if (err) { reject(err); return }
        resolve(tokenizer)
      })
    }).catch(reject)
  })

  return tokenizerPromise
}

/**
 * Load the compact JMdict lookup map lazily.
 * Returns a map of { kanji_or_kana: { r: reading, g: english_gloss } }.
 */
async function getDict(): Promise<Record<string, { r: string; g: string }>> {
  if (dictData) return dictData
  const resp = await fetch('/assets/dict/jdict-compact.json')
  if (!resp.ok) throw new Error(`Failed to load jdict-compact.json: ${resp.status}`)
  dictData = await resp.json()
  return dictData!
}

/**
 * Tokenize a Japanese sentence and look up English glosses from JMdict.
 * Returns an array of tokens with surface form, reading, dictionary form, and optional English gloss.
 * Results are cached per sentence string.
 */
export async function tokenizeWithGloss(sentence: string): Promise<JapaneseToken[]> {
  const cached = sentenceCache.get(sentence)
  if (cached) return cached

  const [tokenizer, dict] = await Promise.all([getTokenizer(), getDict()])

  const rawTokens = tokenizer.tokenize(sentence)
  const tokens: JapaneseToken[] = rawTokens.map((t: any) => {
    const basicForm = t.basic_form !== '*' ? t.basic_form : t.surface_form
    const entry = dict[basicForm] || dict[t.surface_form]

    return {
      surface: t.surface_form,
      reading: t.reading || t.surface_form,
      basicForm,
      pos: t.pos,
      englishGloss: entry?.g,
    }
  })

  sentenceCache.set(sentence, tokens)
  return tokens
}

/**
 * Check if the tokenizer has been initialized (started loading).
 * Does not guarantee it has finished loading.
 */
export function isTokenizerReady(): boolean {
  return tokenizerPromise !== null
}

/**
 * Preload the tokenizer and dictionary in the background.
 * Call early (e.g., when entering a Japanese-language quiz) to reduce first-use latency.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function preloadTokenizer(): void {
  getTokenizer().catch(() => {})
  getDict().catch(() => {})
}

/**
 * audioCodecSupport.ts
 *
 * Detects browser/webview codec support and provides path resolution
 * for cross-platform audio compatibility. Linux WebKitGTK doesn't ship
 * AAC decoders, so we fall back to OGG Opus.
 */

let _canPlayAAC: boolean | null = null

/** Check if the browser can decode AAC/M4A audio. Cached after first call. */
export function canPlayAAC(): boolean {
  if (_canPlayAAC !== null) return _canPlayAAC
  if (typeof Audio === 'undefined') {
    _canPlayAAC = false
    return false
  }
  const audio = new Audio()
  const result = audio.canPlayType('audio/mp4; codecs="mp4a.40.2"')
  _canPlayAAC = result === 'probably' || result === 'maybe'
  if (!_canPlayAAC) {
    console.warn('[AudioCodec] AAC not supported — falling back to OGG Opus')
  }
  return _canPlayAAC
}

/**
 * Resolve an audio file path, swapping .m4a → .ogg when AAC is unsupported.
 * Pass-through for non-m4a paths.
 */
export function resolveAudioPath(path: string): string {
  if (!path.endsWith('.m4a')) return path
  if (canPlayAAC()) return path
  return path.replace(/\.m4a$/, '.ogg')
}

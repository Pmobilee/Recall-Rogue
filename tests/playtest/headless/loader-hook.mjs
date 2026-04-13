/**
 * Node.js ESM loader hook that replaces import.meta.env.DEV/PROD/MODE
 * with literal values, mimicking what Vite does in production builds.
 *
 * Required because turnManager.ts uses import.meta.env.DEV for debug logging,
 * which is undefined in Node.js (tsx doesn't substitute it like Vite does).
 * When activeRunState is initialized (Fix 1/2), previously-dead code paths
 * in turnManager become active, exposing these undefined accesses.
 */

const textDecoder = new TextDecoder();

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  
  if (result.format !== 'module') return result;
  
  // Convert source to string (tsx may return compiled JS as Uint8Array or string)
  let src;
  if (typeof result.source === 'string') {
    src = result.source;
  } else if (result.source) {
    src = textDecoder.decode(result.source);
  } else {
    return result;
  }
  
  if (!src.includes('import.meta.env')) return result;
  
  const patched = src
    .replaceAll('import.meta.env.DEV', 'false')
    .replaceAll('import.meta.env.PROD', 'true')
    .replaceAll('import.meta.env.MODE', '"production"');
  
  // Return as string (not binary) to avoid encoding issues
  return { ...result, source: patched };
}

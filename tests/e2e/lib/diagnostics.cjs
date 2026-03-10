/**
 * Diagnostic helper for E2E tests — captures console errors, page errors,
 * failed network requests, and runtime JS state.
 *
 * Usage:
 *   const diagnostics = attachDiagnostics(page)
 *   // ... navigate, interact ...
 *   const report = await diagnostics.report()
 *   console.log(JSON.stringify(report, null, 2))
 */
module.exports = function attachDiagnostics(page) {
  const d = { errors: [], warnings: [], networkFailed: [], pageErrors: [] }
  page.on('console', m => {
    if (m.type() === 'error') d.errors.push(m.text())
    if (m.type() === 'warning') d.warnings.push(m.text())
  })
  page.on('pageerror', e => d.pageErrors.push(e.message))
  page.on('requestfailed', r => d.networkFailed.push(r.url()))
  return {
    report: async () => {
      const js = await page.evaluate(() => ({
        currentScreen: (() => {
          try {
            const sym = Symbol.for('terra:currentScreen')
            let v; const s = globalThis[sym]; if (s) s.subscribe(x => { v = x })(); return v
          } catch { return 'unknown' }
        })(),
        phaserCanvas: !!document.querySelector('canvas'),
        canvasDimensions: (() => { const c = document.querySelector('canvas'); return c ? `${c.width}x${c.height}` : null })(),
        hasSave: !!localStorage.getItem('recall-rogue-save'),
        ageBracket: localStorage.getItem('terra_age_bracket'),
        isGuest: localStorage.getItem('terra_guest_mode'),
      }))
      return { ...d, js }
    }
  }
}

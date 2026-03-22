# AR-93: Console Log Audit & Debug Instrumentation Cleanup

## Overview
Audit all `console.log`, `console.warn`, `console.error` statements in production source code. Replace raw console calls with the existing `__terraLog` ring buffer or structured logging where appropriate. Remove leftover debug logs, ensure intentional instrumentation is tagged and gated behind dev mode checks.

**Complexity**: Low-Medium
**Risk**: Low (logging changes only)
**Dependencies**: None

## TODO Checklist

- [x] **1. Inventory all console.* calls in `src/`**
  - Run: `grep -rn 'console\.\(log\|warn\|error\|debug\)' src/ --include='*.ts' --include='*.svelte'`
  - Categorize each as: KEEP (intentional instrumentation), GATE (wrap in dev check), REMOVE (debug leftover)

- [x] **2. Remove debug leftovers**
  - `src/ui/components/DomeCanvas.svelte` — debug position logging
  - `src/services/rewardRoomBridge.ts` — test callback logs (5 instances)
  - `src/services/subscriptionService.ts` — navigation debug log
  - Any other identified debug leftovers

- [x] **3. Gate development-only logs behind `import.meta.env.DEV`**
  - `src/CardApp.svelte` — BootAnim initialization logs (8 instances) → gate or use `__terraLog`
  - `src/services/gameFlowController.ts` — encounter completion tracking → use `__terraLog`
  - Pattern: `if (import.meta.env.DEV) console.log(...)` or route through `__terraLog`

- [x] **4. Replace Steam stub logs with proper no-op pattern**
  - `src/services/steamService.ts` — 4 console.log stubs
  - Replace with silent no-ops or `__terraLog` entries

- [x] **5. Ensure `__terraLog` and `__terraDebug` are tree-shaken in production**
  - Verify `src/dev/debugBridge.ts` is only imported conditionally or stripped
  - Check production bundle doesn't include debug bridge code

- [x] **6. Add ESLint rule to prevent future raw console.log**
  - Add `no-console` rule with `warn` level (allow `console.error` for genuine errors)
  - Or add a comment convention: `// eslint-disable-next-line no-console -- intentional`

## Acceptance Criteria
- Zero raw `console.log` in production code (all gated or removed)
- `console.error` only used for genuine error conditions
- All instrumentation uses `__terraLog` or is dev-gated
- Production build size unchanged or smaller
- No runtime errors from removed logs

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `src/CardApp.svelte` |
| EDIT | `src/services/gameFlowController.ts` |
| EDIT | `src/services/steamService.ts` |
| EDIT | `src/services/rewardRoomBridge.ts` |
| EDIT | `src/services/subscriptionService.ts` |
| EDIT | `src/ui/components/DomeCanvas.svelte` |
| EDIT | `src/ui/components/SignInWithApple.svelte` |
| MAYBE EDIT | ESLint config (if adding no-console rule) |

## Verification Gate
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npx vitest run` — all tests pass
- [x] `grep -rn 'console\.log' src/` returns only dev-gated or intentional instances
- [x] Production bundle does not contain debug strings (spot check with `grep` on `dist/`)

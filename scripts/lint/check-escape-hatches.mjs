#!/usr/bin/env node
/**
 * check-escape-hatches.mjs
 *
 * Preventative lint script for HIGH-8 (2026-04-10).
 *
 * Root cause: StudyQuizOverlay rendered "Question 1 / 0" with no back button
 * when called with an empty questions array (e.g. from hub via startStudy with
 * no active run). Players had no escape path without reloading the page.
 *
 * Rule (ui-layout.md §"Softlock prevention"): Any Svelte component that
 * renders a data-driven list or a quiz flow MUST guard against the empty-pool
 * case and provide a dismiss/back path in that state.
 *
 * This script checks components for the specific high-risk pattern:
 *   - Component has a `questions` or `items` or `cards` prop (data-driven)
 *   - Component renders count-of-total text (e.g. "N / M" or "/ {X.length}")
 *   - Component does NOT have an escape hatch for the zero-count case
 *
 * "Escape hatch" = any of:
 *   - data-testid containing "back", "dismiss", "close", "return", "exit"
 *   - aria-label containing "back", "return", "dismiss"
 *   - class containing "back-btn", "dismiss-btn", "close-btn", "overlay-back"
 *   - handleBack / onback / onBack reference
 *   - questions.length === 0 / items.length === 0 / cards.length === 0 guard
 *
 * Exit 0 = all checks pass.
 * Exit 1 = component(s) found with count-of-total display but no escape hatch.
 *
 * Usage:
 *   node scripts/lint/check-escape-hatches.mjs
 *   npm run lint:escape-hatches
 */

import { readdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../')
const COMPONENTS_DIR = resolve(ROOT, 'src/ui/components')

// Pattern: component renders a "N / total" or "{count} / {items.length}" display
// This indicates it iterates over a data pool and is at-risk for the empty-pool softlock
const COUNT_OF_TOTAL_PATTERNS = [
  /\{[^}]+\}\s*\/\s*\{[^}]+\.length\}/, // {currentIndex + 1} / {questions.length}
  /\/\s*\{[^}]+\.\blength\b\}/,          // / {questions.length}
  /Question\s+\{/,                        // "Question {..."
  /QUESTION\s+\{/,                        // "QUESTION {..."
]

// Pattern: escape hatch exists
const ESCAPE_HATCH_PATTERNS = [
  /data-testid=["'][^"']*(?:back|dismiss|close|return|exit)[^"']*["']/i,
  /aria-label=["'][^"']*(?:back|return|dismiss|close|exit)[^"']*["']/i,
  /class=["'][^"']*(?:back-btn|dismiss-btn|close-btn|overlay-back|return-btn)[^"']*["']/i,
  /\bhandleBack\b/,
  /\bonback\b/,
  /\bonBack\b/,
  /\bonClose\b/,
  /\bonclose\b/,
  // Empty-state guard for the data pool
  /questions\.length\s*===\s*0/,
  /items\.length\s*===\s*0/,
  /cards\.length\s*===\s*0/,
  /\.length\s*===\s*0/,
]

// Components that are sub-components always hosted inside another screen which
// provides its own navigation. The host screen guarantees a back path.
const EXEMPT_SUB_COMPONENTS = new Set([
  'EventQuiz.svelte', // hosted by MysteryEventOverlay; calls onComplete to exit, never directly navigable
])

const files = readdirSync(COMPONENTS_DIR).filter(f => f.endsWith('.svelte') && !EXEMPT_SUB_COMPONENTS.has(f))
const violations = []

for (const file of files) {
  const content = readFileSync(resolve(COMPONENTS_DIR, file), 'utf8')

  const hasCountDisplay = COUNT_OF_TOTAL_PATTERNS.some(p => p.test(content))
  if (!hasCountDisplay) continue // not a data-driven count component, skip

  const hasEscape = ESCAPE_HATCH_PATTERNS.some(p => p.test(content))
  if (!hasEscape) {
    violations.push(file)
  }
}

if (violations.length === 0) {
  const checked = files.filter(f => {
    const content = readFileSync(resolve(COMPONENTS_DIR, f), 'utf8')
    return COUNT_OF_TOTAL_PATTERNS.some(p => p.test(content))
  }).length
  console.log(`check-escape-hatches: OK — all ${checked} data-driven count component(s) have empty-state escape hatches`)
  process.exit(0)
} else {
  console.error(`check-escape-hatches: FAIL — ${violations.length} data-driven component(s) missing escape hatches:`)
  for (const v of violations) {
    console.error(`  - src/ui/components/${v}`)
    console.error(`    Renders a count-of-total display but has no empty-state guard or back button.`)
  }
  console.error(`\nRule: Any component rendering "N / total" MUST guard against the zero-pool case.`)
  console.error(`Fix: Add {#if questions.length === 0}<empty-state/>{:else}...{/if} + a back button.`)
  console.error(`See .claude/rules/ui-layout.md §"Softlock prevention" and docs/gotchas.md §2026-04-10.`)
  process.exit(1)
}

---
name: code-review
description: Review staged or recent changes for quality, security, and convention compliance. Use before committing to catch issues.
user_invocable: true
---

# Code Review

Review code changes for quality, security, and project conventions.

## Two-Tier Rule System

Rules are split into two tiers:

- **Tier 1 — Absolute Rules**: Security and correctness rules that are always checked, regardless of project patterns. These never change.
- **Tier 2 — Contextual Rules**: Quality and convention rules generated at runtime by scanning the actual codebase. Thresholds are relative to project norms, not arbitrary constants.

## Arguments
- No args: review staged changes (`git diff --cached`)
- `HEAD~N`: review last N commits
- `file.ts`: review a specific file

## Steps

### Step 1 — Get the diff

```bash
git diff --cached  # or git diff HEAD~1, or read the specified file
```

### Step 2 — Establish Tier 2 baselines (runtime scan)

Before applying any quality rules, scan the codebase to learn its actual patterns:

**2a. Sample 20 TypeScript/Svelte source files from `src/`:**
```bash
find src -name "*.ts" -o -name "*.svelte" | grep -v "_archived" | shuf -n 20
```
For each sampled file, compute:
- Function lengths (lines per function) → derive median
- Nesting depths (max indentation level per function) → derive median
- JSDoc presence on exported functions (count with vs. without)
- Error handling patterns (try/catch, .catch(), Result types)

**2b. Read `tsconfig.json`** — confirm `strict: true` is active and note any overrides.

**2c. Read `package.json`** — confirm Svelte version and note major framework dependencies.

**2d. Check for linter config** — if `.eslintrc*`, `biome.json`, or similar exists, note which rules it already enforces so you don't duplicate them.

**Generate the contextual checklist from the scan:**
- Flag functions longer than **2x the median function length** (e.g. "median is 28 lines → flag >56 lines")
- Flag nesting deeper than **median nesting depth + 2** (e.g. "median is 2 → flag depth >4")
- If >75% of exported functions have JSDoc, flag new exported functions that are missing it
- If <50% have JSDoc, note it as a SUGGESTION only (not the norm yet)
- Note the dominant error handling style and flag inconsistencies in the diff
- Apply Svelte version-appropriate rules (Svelte 5: runes; Svelte 4: stores)

### Step 3 — Apply Tier 1: Absolute Rules (always checked)

These are non-negotiable regardless of project norms:

**Security — always flag as CRITICAL:**
- `eval()`, `Function()` constructor, or `innerHTML` with dynamic/unsanitized content
- Hardcoded secrets, API keys, tokens, passwords, or `.env` values committed to source
- Disabled or weakened Content Security Policy headers
- User input rendered or stored without sanitization
- Database operations using string concatenation instead of parameterized queries
- Any import of `@anthropic-ai/sdk` or direct Anthropic API calls (project-absolute rule — use Claude Code Agent tool instead)

**Correctness — always flag as CRITICAL or WARNING:**
- Missing `await` on async calls where the return value matters
- Mutations of props or shared state without going through the proper reactivity mechanism
- Uncaught promise rejections in event handlers

### Step 4 — Apply Tier 2: Contextual Rules (relative to project norms)

Apply the checklist generated in Step 2. Frame each finding with the project baseline:

- Function length: "This function is 94 lines; project median is 28 — flag as WARNING"
- Nesting: "Depth 6 found; project median + 2 = 4 — flag as WARNING"
- JSDoc: "Exported function missing JSDoc; 82% of the project has it — flag as WARNING"
- TypeScript `any`: flag if `tsconfig.json` has `strict: true` (nearly always WARNING)
- Svelte patterns: flag legacy store patterns in new files if codebase is Svelte 5
- Naming: PascalCase for `.svelte` components and classes, kebab-case for utility modules
- Unused imports: flag only if they appear in the diff (don't audit pre-existing code)
- Performance: unnecessary re-renders, missing lazy loading, large inline data blobs

### Step 5 — Report findings

Use severity levels:

- CRITICAL: Security issues, data loss risks, broken correctness
- WARNING: Quality/convention issues that should be fixed before merge
- SUGGESTION: Nice-to-have improvements, style consistency

Format:
```
## Code Review — [file or diff description]

### Baselines (Tier 2)
- Median function length: N lines → flagging >2N
- Median nesting depth: N → flagging >N+2
- JSDoc coverage: N% → [enforcing / suggesting]
- Svelte version: 5 (runes)
- Strict TypeScript: yes

### Findings

[CRITICAL] src/foo.ts:42 — innerHTML used with user-controlled string (XSS risk)
[WARNING]  src/bar.ts:101 — function `processCards` is 187 lines (project median: 28)
[SUGGESTION] src/baz.svelte:15 — exported function missing JSDoc (82% coverage in project)

### Summary
X critical, Y warnings, Z suggestions.
```

If no issues found: "Clean review — no issues found."

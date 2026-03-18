---
name: code-review
description: Review staged or recent changes for quality, security, and convention compliance. Use before committing to catch issues.
user_invocable: true
---

# Code Review

Review code changes for quality, security, and project conventions.

## Arguments
- No args: review staged changes (`git diff --cached`)
- `HEAD~N`: review last N commits
- `file.ts`: review a specific file

## Steps

1. Get the diff to review:
   ```bash
   git diff --cached  # or git diff HEAD~1, or read the specified file
   ```

2. Check for:
   - **Security**: eval(), innerHTML, unsanitized input, hardcoded secrets
   - **Conventions**: PascalCase components, kebab-case utils, JSDoc on public functions
   - **Quality**: Functions >100 lines, deep nesting (4+), unused imports
   - **Performance**: Unnecessary re-renders, missing lazy loading, large inline data
   - **Svelte 5**: Correct use of $state/$derived/$effect, no legacy store patterns in new code
   - **TypeScript**: Proper typing, no `any` escape hatches, strict mode compliance

3. Report findings with severity:
   - 🔴 CRITICAL: Security issues, data loss risks
   - 🟡 WARNING: Quality/convention issues
   - 🟢 SUGGESTION: Nice-to-have improvements

4. If no issues found, report: "Clean review — no issues found."

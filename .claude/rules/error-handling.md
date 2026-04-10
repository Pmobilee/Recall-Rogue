---
paths:
  - "src/services/**"
  - "src/game/**"
  - "src/ui/**"
  - "src/main.ts"
---

# Error Handling Rules

## Core Principle

Never silently swallow errors. Every error must be logged with context. Distinguish recoverable errors (retry/fallback) from fatal errors (crash with diagnostic info).

## Error Categories

### Recoverable (handle gracefully)
- Network failures (offline mode, retry with backoff)
- Missing audio/sprite assets (skip gracefully, log warning)
- Stale save data (migrate, fallback to defaults)
- Quiz fact not found (skip fact, select another)
- Analytics event failed (drop silently — analytics are non-critical)

### Fatal (crash with diagnostics)
- Save file corruption beyond recovery (show error screen, offer reset)
- Missing critical game data (enemy definitions, card mechanics)
- Phaser scene initialization failure
- Database decode failure (facts.db, curated.db)

## Logging Patterns

```typescript
// GOOD — context + error
console.error(`[CardEffectResolver] Failed to apply ${mechanic.id} at mastery ${level}:`, error);

// BAD — swallowed
try { doThing(); } catch (e) { /* nothing */ }

// BAD — no context
console.error(error);
```

## Error Boundaries

- **Phaser scenes**: `shutdown()` cleanup on any unhandled error — prevent zombie scenes
- **Svelte components**: Use `{#snippet}` error boundaries for quiz/combat overlay — don't crash entire UI
- **Service layer**: Services catch their own errors, log with `[ServiceName]` prefix, rethrow if caller needs to know
- **Save/load**: Always wrap in try/catch, fallback to last known good state

## What NOT to Do

- Don't use `try/catch` around every line — only around genuinely fallible operations
- Don't catch errors you can't handle — let them propagate
- Don't log the same error at multiple levels (catch once, at the appropriate boundary)
- Don't use generic error messages ("Something went wrong") — include what, where, and state
- Don't add error handling for impossible states (TypeScript narrowing handles this)

## Global Error Handler

The app must have a global uncaught error handler that:
1. Logs the full stack trace with game state context (scene, floor, encounter)
2. Shows a user-friendly error screen (not a blank page)
3. Offers "Report Bug" + "Restart Game" options
4. Preserves the last save (never corrupt on crash)

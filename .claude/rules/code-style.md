# Code Style Rules

- TypeScript strict mode, no `any` without justified comment
- ES modules (import/export), never CommonJS
- Destructure imports: `import { turnManager } from './services/turnManager'`
- Svelte 5 runes (`$state`, `$derived`, `$effect`), no Svelte 4 stores for new code
- Pure functions for game logic, side effects only in services
- File size target 200-400 lines, max 800 lines (split if >600)
- Name files by feature/domain, not type (chainSystem.ts not utils.ts)
- Prefer `const` over `let`, never `var`
- No default exports — always named exports
- Error handling: never silently swallow, log with context
- Comments: explain WHY not WHAT
- All public functions must have JSDoc comments
- Svelte components: PascalCase filenames, `.svelte` extension
- Utilities: kebab-case filenames
- Game entities: composition over inheritance
- Pixel art assets: PNG, transparent backgrounds, power-of-2 dimensions

## Security — Non-Negotiable

- NEVER use `eval()`, `Function()`, or `innerHTML` with dynamic content
- NEVER commit `.env` files, API keys, tokens, or credentials
- NEVER disable Content Security Policy headers
- ALWAYS sanitize user input before rendering or storing
- ALWAYS use parameterized queries for database operations
- ALWAYS validate API responses against expected schemas
- Keep dependencies minimal; audit before adding new packages
- NEVER import or call `@anthropic-ai/sdk` or any paid LLM API

## Documentation — Same-Commit Rule
Every code change that adds, removes, or modifies behavior MUST include corresponding doc updates in the same commit. New props, new functions, changed values, fixed bugs — all documented. See `.claude/rules/docs-first.md`.

## No Anthropic API — ABSOLUTE RULE

- We do NOT have an Anthropic API key or budget. Claude Code subscription is the ONLY LLM access.
- NEVER write scripts that import `@anthropic-ai/sdk`, call the Anthropic Messages API, or use any external LLM API.
- ALL LLM processing MUST use Claude Code Agent tool (`model: "haiku"` or `model: "sonnet"`).
- The `haiku-client.mjs` file's `LOCAL_PAID_GENERATION_DISABLED = true` flag must STAY true.

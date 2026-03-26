# Claude Capabilities — Recall Rogue

> What your AI agent can do, organized by category. Reference this whenever you're wondering "can Claude help with X?"

---

## Development & Code

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Feature Pipeline | Always active | 7-phase workflow (Clarify > Research > Propose > Plan > Implement > Verify > Complete) for all non-trivial tasks |
| Work Tracking | Always active | AR-based phase documents, task tracking, completion gates |
| Code Review | `/code-review` | Reviews staged changes for quality, security, convention compliance |
| Quick Verify | `/quick-verify` | Typecheck + build + tests + optional visual check |
| Game Design Sync | Always active | Keeps GAME_DESIGN.md in sync with every gameplay change |
| Simplify | `/simplify` | Reviews changed code for reuse, quality, efficiency |

## Visual Testing & Inspection

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Visual Inspect | `/visual-inspect` | Instant jump to any game state via Playwright + __terraScenario |
| Playthrough | `/playthrough` | Full visual playthrough with screenshots at each stage |
| Scenario Testing | `/playthrough-scenarios:XX` | 12 targeted test scenarios (combat, rooms, menus, etc.) |

## Balance & Playtesting

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Headless Playtest | `/headless-playtest` | 6,000 runs in 5 seconds. Statistical balance data. The go-to for volume testing. |
| Balance Check | `/balance-check` | Reads headless sim JSON, produces narrative balance report |
| Advanced Balance | `/advanced-balance` | Per-card win-rate tracking, tension metrics (feel proxies), predictability scoring |
| LLM Playtest | `/llm-playtest` | Haiku agents play strategically and explain reasoning. Finds balance blindspots heuristic bots miss. |
| Playtest Analyze | `/playtest-analyze` | Analyze headless sim output for balance issues, UX problems, bugs |
| Playtest Triage | `/playtest-triage` | Deduplicate, score, and rank issues on a leaderboard |
| Playtest Results | `/playtest-results` | View latest logs, reports, and ranked issue leaderboard |

## Content Pipeline

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Fact Ingestion | `/manual-fact-ingest-dedup` | 10-domain knowledge fact pipeline via Sonnet sub-agents. Validation, dedup, DB rebuild. |
| Subcategorize | `/subcategorize` | Assign subcategories to unclassified facts using Sonnet agents |
| Answer Checking | `/answer-checking` | Live DB-first answer verification and fix loops |

## Art & Assets

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Art Studio | `/artstudio` | Generate sprites, enemy art, card art, combat backgrounds via OpenRouter image pipeline |

## Audio (Planned)

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Audio Manager | `/audio-manager` | Scaffold Howler.js integration, sound event taxonomy, file conventions. Currently a planning/reference skill — no audio assets exist yet. |

## Performance & Debugging

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Phaser Perf | `/phaser-perf` | Canvas vs WebGL benchmarking, mobile optimization, Phaser Debugger extension guide, __terraDebug extensions |
| Mobile Debug | `/mobile-debug` | Capacitor debugging: chrome://inspect, Inspect.dev, WebDebugX, native profiler workflows |

## Deployment

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Android Deploy | `/android-deploy` | Build and deploy debug APK to USB-connected phone |
| Site Manage | `/site-manage` | Deploy, check status, query subscribers, edit recallrogue.com |

## Configuration

| Capability | How to Invoke | What It Does |
|-----------|---------------|-------------|
| Update Config | `/update-config` | Modify settings.json, hooks, permissions, env vars |
| Keybindings | `/keybindings-help` | Customize keyboard shortcuts |

---

## Known Blindspots (Honest Assessment)

These are areas where Claude has limited capability. Mitigations are documented in the corresponding skills.

| Blindspot | Severity | Mitigation |
|-----------|----------|-----------|
| **Phaser 3 deep internals** | Medium | Phaser Debugger extension, __terraDebug extensions, Canvas renderer for mobile (`/phaser-perf`) |
| **Mobile native debugging** | Medium | chrome://inspect workflow, Inspect.dev, diagnostics panel (`/mobile-debug`) |
| **Game balance "feel"** | Medium | LLM playtesting for qualitative reasoning, tension metrics for feel proxies (`/llm-playtest`, `/advanced-balance`) |
| **Visual/UX design origination** | Medium | Reference-driven design, juice presets library, design token system |
| **ComfyUI prompt craft** | Low | Locked presets in `/artstudio`, PixelArt-Detector node, generate-at-final-size rule |
| **Audio** | High (complete gap) | Howler.js integration path documented, asset sources listed (`/audio-manager`). Claude can build the system but cannot create audio assets. |
| **Educational psychology depth** | Low | FSRS algorithm available (15-20% more efficient than SM-2), research papers referenced. Claude knows the mechanics but lacks deep cognitive science intuition. |
| **Svelte 5 runes** | Low | MCP server for official docs, migration tool audit, runes-first patterns |

---

## Tips for Working with Claude

1. **Be specific about what "done" looks like** — the more concrete your acceptance criteria, the better the result
2. **Mention if you want balance testing** — Claude will proactively suggest `/headless-playtest` and `/llm-playtest` but may not run them unless asked
3. **Point to visual references** — for UI/design work, share screenshots of games you admire
4. **Ask for the skill by name** — `/llm-playtest`, `/advanced-balance`, etc. trigger specific workflows
5. **Claude will remind you** about capabilities you might forget (like LLM playtesting for feel). If these reminders get annoying, just say so.
6. **Audio needs your assets** — Claude can build the audio system but can't create sound files. Source them from Freesound.org, OpenGameArt, or a sound designer.

---
description: "RL neural agent balance testing. Train, analyze, or watchdog the Rogue Brain PPO agent that plays full game runs (combat + rooms + shop + rest + relics + rewards). PROACTIVELY SUGGEST when balance, card design, enemy tuning, shop prices, relic power, room weights, or new mechanics are discussed."
---

# Rogue Brain — RL Neural Agent Testing

Train, evaluate, and analyze a PPO neural network agent that plays Recall Rogue end-to-end, discovering optimal strategies and balance issues across ALL game systems.

## Arguments
Parse from user's message:
- `mode`: "train" | "analyze" | "watchdog" | "quick" (default: "analyze")
- `timesteps`: training steps (default: 2000000)
- `episodes`: analysis episodes (default: 200)
- `ascension`: ascension level (default: 0)
- `correct_rate`: quiz accuracy (default: 0.75)
- `model`: model path (default: latest)

Examples:
- `/rogue-brain` — Analyze latest model with 200 episodes
- `/rogue-brain train` — Full 2M step training
- `/rogue-brain train 500000` — Quick 500K training
- `/rogue-brain watchdog` — Compare to baseline, detect regressions
- `/rogue-brain analyze --ascension 5` — Test at ascension 5
- `/rogue-brain quick` — 50-episode quick check

## What It Tests

The agent plays the FULL game loop:
1. **Room selection** — combat vs shop vs rest vs mystery vs treasure
2. **Combat** — which card to play, charge vs quick, skip turn
3. **Card rewards** — pick 1 of 3 cards or skip
4. **Relic selection** — pick, swap (5 slot max), skip
5. **Shop** — buy relics/cards/removal or leave
6. **Rest site** — heal vs upgrade which card
7. **Mystery events** — auto-resolved
8. **Retreat vs delve** — cash out vs go deeper

## Architecture

```
Python PPO (SB3 MaskablePPO)
  -> JSON IPC (stdin/stdout)
    -> Node.js gym-server.ts
      -> Real game code (turnManager, cardEffectResolver, relicEffectResolver, enemies, balance.ts)
```

- 120-float observation vector (HP, AP, hand, chains, relics, gold, floor, phase, rewards, shop)
- 30-action discrete space with action masking (no wasted steps on invalid actions)
- Trains at ~4,000 steps/sec on M4 Max CPU

## Key Files

| File | Purpose |
|------|---------|
| `tests/playtest/headless/gym-server.ts` | Node.js game server (1,270+ lines) |
| `tests/playtest/rl/recall_rogue_env.py` | Python Gymnasium environment |
| `tests/playtest/rl/train.py` | PPO training with curriculum |
| `tests/playtest/rl/analyze.py` | 15-category strategy analysis |
| `tests/playtest/rl/report.py` | Markdown balance report generator |
| `tests/playtest/rl/watchdog.py` | Regression detection |
| `tests/playtest/rl/config.py` | Hyperparameters |

## Workflow

### Train Mode
```bash
# Kill any stale processes first
pkill -f "gym-server" 2>/dev/null

# Full training (2M steps, ~8 min on M4 Max)
python3 tests/playtest/rl/train.py --timesteps 2000000 --n-envs 4

# Quick training (500K steps, ~2 min)
python3 tests/playtest/rl/train.py --timesteps 500000 --n-envs 4

# With ascension
python3 tests/playtest/rl/train.py --timesteps 2000000 --n-envs 4 --ascension 5
```

### Analyze Mode
```bash
pkill -f "gym-server" 2>/dev/null
python3 tests/playtest/rl/analyze.py \
  --model tests/playtest/rl/models/rogue_brain_v2_masked_2M \
  --episodes 200 \
  --correct-rate 0.75 \
  --ascension 0
```

### Watchdog Mode
```bash
# Set baseline (do this after a known-good balance state)
python3 tests/playtest/rl/watchdog.py --set-baseline \
  --model tests/playtest/rl/models/rogue_brain_v2_masked_2M

# Check for regressions
python3 tests/playtest/rl/watchdog.py \
  --model tests/playtest/rl/models/rogue_brain_v2_masked_2M
```

### TensorBoard
```bash
tensorboard --logdir tests/playtest/rl/logs/
```

## Report Sections (15 categories)

1. **Overview** — win rate, avg reward, HP preservation
2. **Action Distribution** — charge/quick/skip breakdown
3. **Card Index Preference** — which hand positions played most
4. **Charge vs Quick Strategy** — with accuracy tracking
5. **Knowledge Chain Behavior** — extension rate, break patterns
6. **Per-Enemy Difficulty** — win rate per enemy type
7. **Death Analysis** — what kills the agent
8. **Combat Efficiency** — steps to win, HP preservation
9. **Skip Turn Behavior** — how often the agent passes
10. **Room Selection Strategy** — combat vs shop vs rest preference
11. **Deck Building** — card reward pick/skip rate
12. **Relic Strategy** — relic pick/skip patterns
13. **Shop Behavior** — what it buys, what it ignores
14. **Rest Site Strategy** — heal vs upgrade frequency
15. **Retreat vs Delve** — risk management
16. **Floor Progression** — avg/max floors reached
17. **Balance Recommendations** — actionable findings

## When to Use

- After any balance change (card values, enemy stats, AP costs, shop prices)
- After adding new cards, enemies, relics, or mechanics
- When discussing game difficulty or player experience
- When comparing ascension levels
- Before and after major releases

## Difference from Other Tools

| Tool | What | Speed | Intelligence |
|------|------|-------|-------------|
| Headless sim | Statistical combat | 1000+/sec | Fixed heuristic |
| /strategy-analysis | LLM reasoning | 20-50 states | Qualitative only |
| **Rogue Brain** | Full game RL | 4000 steps/sec | **Learns optimal play** |
| /balance-check | Report generation | Instant | Reads sim output |

Rogue Brain is the only tool that LEARNS strategy across the full game, not just combat.

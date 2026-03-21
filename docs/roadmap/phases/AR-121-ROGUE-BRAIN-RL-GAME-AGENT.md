# AR-121: Rogue Brain — Neural RL Game-Playing Agent

## Overview

Build a reinforcement learning system ("Rogue Brain") that learns to play Recall Rogue optimally, discovering dominant strategies, broken cards, useless mechanics, difficulty cliffs, and balance issues that heuristic bots and human playtesting miss.

**Why this matters**: Our current headless sim uses a trivial strategy — "play first card in hand, randomly decide charge vs quick." It finds statistical balance but can't discover *strategy*. A neural agent that learns to play well will show us what an optimal player does, which cards they always/never pick, and where the game breaks.

**Hardware**: Apple M4 Max (14 CPU, 32 GPU, 36GB unified) — PyTorch + MPS backend for GPU-accelerated training.

**Architecture**: Python RL agent (PyTorch + Stable Baselines3) communicating with our existing Node.js headless sim via JSON IPC. Zero reimplementation of game logic — the agent trains against real game code.

**Dependencies**: None (new standalone system alongside existing headless sim)
**Estimated complexity**: High — 7 sub-steps across 3 tiers

---

## Sub-Steps

### Step 1: Install ML Stack
**Files**: None (system packages only)
**Action**: Install PyTorch, Gymnasium, Stable Baselines3, TensorBoard on the existing Python 3.12.

```bash
pip3 install torch torchvision gymnasium stable-baselines3 tensorboard numpy
```

**Acceptance Criteria**:
- `python3 -c "import torch; print(torch.backends.mps.is_available())"` prints `True`
- `python3 -c "import gymnasium; import stable_baselines3; print('OK')"` prints `OK`

---

### Step 2: Build Node.js Gym Server
**Files created**: `tests/playtest/headless/gym-server.ts`
**Action**: Create a lightweight JSON-over-stdin/stdout server that wraps the headless simulator's combat loop, exposing a Gymnasium-compatible step/reset API.

The server runs a single combat encounter at a time. On each step:
1. Receives a JSON action from Python
2. Executes it via `playCardAction()` or `endPlayerTurn()`
3. Returns the observation vector, reward, done flag, and info dict

**Protocol** (one JSON object per line, newline-delimited):

```
Python -> Node:  {"cmd": "reset", "opts": {"encounterCount": 1, "ascensionLevel": 0}}
Node -> Python:  {"obs": [...], "info": {"enemy": "cave_bat", "playerHp": 120, ...}}

Python -> Node:  {"cmd": "step", "action": {"type": "play", "cardIndex": 2, "mode": "charge", "answeredCorrectly": true}}
Node -> Python:  {"obs": [...], "reward": 0.5, "done": false, "truncated": false, "info": {...}}

Python -> Node:  {"cmd": "step", "action": {"type": "skip"}}
Node -> Python:  {"obs": [...], "reward": -0.1, "done": false, "truncated": false, "info": {...}}
```

**Observation vector** (80 floats, all normalized to [0,1]):

| Index | Feature | Normalization |
|-------|---------|---------------|
| 0 | Player HP % | hp / maxHP |
| 1 | Player shield % | shield / maxHP |
| 2 | Enemy HP % | currentHP / maxHP |
| 3 | Enemy block % | block / (maxHP * 0.3) |
| 4 | AP available | apCurrent / apMax |
| 5 | Turn number | turnNumber / 40 |
| 6 | Combo count | comboCount / 10 |
| 7 | Chain length | chainLength / 5 |
| 8 | Chain multiplier | (chainMultiplier - 1.0) / 2.0 |
| 9 | Is surge turn | 0 or 1 |
| 10 | Floor number | floor / 30 |
| 11 | Cards in draw pile | len(drawPile) / deckSize |
| 12 | Player poison stacks | poison / 20 |
| 13 | Player regen stacks | regen / 20 |
| 14 | Player strength | (strength + 5) / 10 |
| 15 | Player weakness | weakness / 5 |
| 16 | Enemy poison stacks | poison / 20 |
| 17 | Enemy strength | (strength + 5) / 10 |
| 18 | Enemy weakness | weakness / 5 |
| 19 | Enemy intent type | one-hot-ish: attack=0.2, defend=0.4, buff=0.6, debuff=0.8, heal=1.0 |
| 20 | Enemy intent damage | intentDamage / maxHP |
| 21 | Perfect turn flag | 0 or 1 |
| 22 | Thorns active | 0 or 1 |
| 23 | Focus charges | focusCharges / 5 |
| 24-28 | Hand card 0: [type, tier, chainType, mastery, apCost] | categorical/normalized |
| 29-33 | Hand card 1 | same |
| 34-38 | Hand card 2 | same |
| 39-43 | Hand card 3 | same |
| 44-48 | Hand card 4 | same |
| 49-53 | Hand card 5 | same (padding zeros if <6 cards) |
| 54-58 | Hand card 6 | same (padding zeros if <7 cards) |
| 59-63 | Hand card 7 | same (padding zeros if <8 cards) |
| 64 | Current chain type | chainType / 5 (0 if none) |
| 65 | Has hint available | 0 or 1 |
| 66 | Persistent shield | persistentShield / maxHP |
| 67 | Cards played this turn | cardsPlayedThisTurn / 10 |
| 68 | Encounter accuracy | correct / (correct + wrong) or 0.5 |
| 69 | Ascension level | ascensionLevel / 20 |
| 70-79 | Reserved / relic flags | 0s initially, expandable |

**Per-card encoding** (5 floats each):
- type: attack=0.2, shield=0.4, buff=0.6, debuff=0.8, utility=1.0, wild=0.0
- tier: 1=0.33, 2a=0.5, 2b=0.67, 3=1.0
- chainType: chainType / 5
- mastery: masteryLevel / 5
- apCost: apCost / 3

**Action space** (Discrete, 18 actions):
- 0-7: Play card at index 0-7 in CHARGE mode
- 8-15: Play card at index 0-7 in QUICK mode
- 16: Skip turn (end player action phase)
- 17: Use hint (if available during quiz)

**Quiz correctness**: The gym server models this stochastically. When the agent plays a charge action, the server rolls correctness based on a configurable `correctRate` parameter (default 0.75). The agent learns to optimize *given* a probability of answering correctly — it doesn't actually answer questions.

Future enhancement: vary `correctRate` per card based on mastery level (mastery 5 = 100% correct, mastery 0 = 50% correct). This teaches the agent that mastering cards is strategically valuable.

**Reward function**:
```
Per action:
  +damageDealt / enemyMaxHP * 2.0          # Reward damage proportional to enemy total
  +shieldGained / playerMaxHP * 0.5        # Reward shielding
  +0.3 if chain extended                   # Reward chain building
  -0.2 if chain broken                     # Penalize chain breaks
  +0.1 * comboCount if correct charge      # Reward combo streaks
  -0.3 if wrong answer on charge           # Penalize wrong answers

Per turn end:
  -damageTaken / playerMaxHP * 2.0         # Penalize taking damage

Encounter end:
  +5.0 if victory                          # Big reward for winning
  -5.0 if defeat                           # Big penalty for losing
  +playerHP / playerMaxHP * 2.0 if victory # Bonus for HP preservation
  -1.0 if timeout (40 turns)               # Penalize slow play

Multi-encounter run bonus:
  +1.0 per floor cleared beyond first      # Reward progression
```

**Acceptance Criteria**:
- Server starts via `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/gym-server.ts`
- Responds to reset/step commands via stdin/stdout
- Returns valid observation vectors of correct length
- Handles edge cases: empty hand, 0 AP, encounter end, timeout
- Processes 500+ steps/second

---

### Step 3: Build Python Gymnasium Environment
**Files created**: `tests/playtest/rl/recall_rogue_env.py`, `tests/playtest/rl/__init__.py`
**Action**: Create a Gymnasium-compatible environment that spawns the Node.js gym server as a subprocess and communicates via JSON lines.

```python
class RecallRogueEnv(gymnasium.Env):
    observation_space = gymnasium.spaces.Box(low=0, high=1, shape=(80,), dtype=np.float32)
    action_space = gymnasium.spaces.Discrete(18)

    def __init__(self, correct_rate=0.75, ascension=0, encounters=10):
        # Spawn Node.js subprocess

    def reset(self, seed=None, options=None):
        # Send reset command, return initial obs

    def step(self, action):
        # Send action, return (obs, reward, terminated, truncated, info)

    def close(self):
        # Kill subprocess
```

Also create a `SubprocVecEnv` wrapper to run N parallel environments (N = CPU cores / 2 = 7) for faster training.

**Acceptance Criteria**:
- `env = RecallRogueEnv(); obs, info = env.reset()` works
- `obs, reward, done, trunc, info = env.step(0)` works
- `check_env(env)` from SB3 passes
- 7 parallel envs achieve 2000+ steps/sec aggregate

---

### Step 4: Train PPO Agent
**Files created**: `tests/playtest/rl/train.py`, `tests/playtest/rl/config.py`
**Action**: Training script using Stable Baselines3 PPO with MPS acceleration.

**Network architecture**:
- Policy: MLP [80 -> 256 -> 256 -> 128 -> 18] with ReLU activations
- Value: MLP [80 -> 256 -> 256 -> 128 -> 1] with ReLU activations
- Shared feature extractor for first 2 layers

**Training hyperparameters** (config.py):
```python
PPO_CONFIG = {
    "learning_rate": 3e-4,
    "n_steps": 2048,           # Steps per env before update
    "batch_size": 256,
    "n_epochs": 10,
    "gamma": 0.99,             # Discount factor
    "gae_lambda": 0.95,        # GAE lambda
    "clip_range": 0.2,
    "ent_coef": 0.01,          # Entropy bonus (encourages exploration)
    "vf_coef": 0.5,
    "max_grad_norm": 0.5,
    "device": "mps",           # Apple Silicon GPU
}

TRAINING_CONFIG = {
    "total_timesteps": 2_000_000,   # ~30-60 min on M4 Max
    "eval_freq": 10_000,
    "n_eval_episodes": 100,
    "save_freq": 50_000,
    "log_dir": "tests/playtest/rl/logs/",
    "model_dir": "tests/playtest/rl/models/",
}
```

**Action masking**: Invalid actions (playing card index > hand size, charging with 0 AP) must be masked. Use SB3's `MaskableMultiInputPolicy` or manual logit masking in the environment.

**Curriculum training** (progressive difficulty):
1. Phase 1 (0-500K steps): Single encounters, act 1 enemies, correctRate=0.85 (easy)
2. Phase 2 (500K-1M steps): 5 encounters, act 1-2 enemies, correctRate=0.75
3. Phase 3 (1M-1.5M steps): 10 encounters, act 1-3 enemies, correctRate=0.70
4. Phase 4 (1.5M-2M steps): 10 encounters, all enemies, correctRate=0.65, ascension 1-5

**CLI**:
```bash
python3 tests/playtest/rl/train.py                           # Full training
python3 tests/playtest/rl/train.py --timesteps 100000        # Quick test
python3 tests/playtest/rl/train.py --resume models/latest    # Resume from checkpoint
tensorboard --logdir tests/playtest/rl/logs/                  # Monitor training
```

**Acceptance Criteria**:
- Training starts and runs without errors
- TensorBoard shows improving reward curve
- After 500K steps: agent wins >50% of single encounters (vs ~40% random baseline)
- After 2M steps: agent wins >70% of 10-encounter runs at correctRate=0.75
- Model checkpoint saved every 50K steps
- MPS GPU utilization visible in Activity Monitor

---

### Step 5: Strategy Extraction & Balance Report
**Files created**: `tests/playtest/rl/analyze.py`, `tests/playtest/rl/report.py`
**Action**: After training, analyze what the agent learned and produce actionable balance insights.

**Analysis methods**:

1. **Card play frequency**: Run 1000 evaluation episodes, record which cards the agent plays and in which mode (charge/quick). Compare to uniform random baseline.
   - Output: "Attack cards played 3.2x more than shield cards — attacks are overtuned"
   - Output: "Debuff cards played 0.1x of baseline — debuffs are useless"

2. **Situational policy extraction**: For each card type x enemy intent combination, record what the agent does.
   - Output: "Against attack intents, agent plays shield 89% of the time — expected"
   - Output: "Against defend intents, agent still plays shield 45% — shield value too high?"

3. **Chain behavior**: How often does the agent build chains vs break them?
   - Output: "Agent chains 78% of charge plays — chains are critical to strategy"
   - Output: "Agent breaks chains to play shields 22% — survival pressure"

4. **Charge vs Quick analysis**: When does the agent charge vs quick play?
   - Output: "Agent charges 85% on surge turns (free), 40% on normal turns"
   - Output: "Agent never charges utility cards — utility charge bonus too low"

5. **Per-enemy difficulty**: Win rate and average HP remaining per enemy type.
   - Output: "Crystal Golem: 45% win rate (lowest) — too tanky"
   - Output: "Cave Bat: 98% win rate — too easy, consider buffing"

6. **Relic impact**: Compare agent performance with/without each relic.
   - Output: "Whetstone: +22% win rate — overpowered"
   - Output: "Lucky Coin: +1% win rate — irrelevant"

7. **Death analysis**: When the agent loses, what went wrong?
   - Output: "73% of deaths on floor 7+ — late-game scaling too steep"
   - Output: "42% of deaths: agent had 0 shield cards in hand — bad draws are lethal"

8. **Optimal vs heuristic comparison**: Compare RL agent's win rate to the headless sim's heuristic bots.
   - Output: "RL agent wins 78% vs heuristic's 52% — significant strategy gap means game rewards skill"
   - Output: "RL agent wins 80% vs heuristic's 79% — strategy barely matters, game is too random"

**Report format**: Markdown file saved to `data/playtests/rl-reports/YYYY-MM-DD-HH-MM.md`

**CLI**:
```bash
python3 tests/playtest/rl/analyze.py --model models/latest --episodes 1000
python3 tests/playtest/rl/report.py --analysis-dir data/playtests/rl-analysis/latest/
```

**Acceptance Criteria**:
- Produces a structured Markdown report with all 8 analysis categories
- Each finding has a specific, actionable recommendation
- Card rankings match intuition (attacks should be played more than buffs)
- Per-enemy difficulty rankings produced
- Report takes <5 minutes to generate (1000 evaluation episodes)

---

### Step 6: Continuous Watchdog
**Files created**: `tests/playtest/rl/watchdog.py`
**Action**: Script that re-evaluates the trained agent after balance changes and detects regressions.

**Workflow**:
1. Load latest trained model
2. Run 500 evaluation episodes with current game code
3. Compare results to baseline (stored from last run)
4. Flag significant changes (>5% win rate shift, >20% card play frequency shift)
5. Output diff report

**Integration**: Can be run manually after balance changes or hooked into a git post-commit (future enhancement).

**CLI**:
```bash
python3 tests/playtest/rl/watchdog.py                    # Compare to baseline
python3 tests/playtest/rl/watchdog.py --set-baseline      # Save current as baseline
python3 tests/playtest/rl/watchdog.py --retrain --timesteps 200000  # Quick retrain + compare
```

**Acceptance Criteria**:
- Detects >5% win rate changes between baseline and current
- Flags cards whose play frequency shifted >20%
- Outputs a concise diff report (what changed, what broke)
- Runs in <3 minutes (500 episodes)

---

### Step 7: Mastery-Aware Correctness Model
**Files modified**: `tests/playtest/headless/gym-server.ts`
**Action**: Enhance the quiz correctness model so that higher-mastery cards have higher correct rates.

```
correctRate(card) = baseRate + (masteryLevel / 5) * (1.0 - baseRate) * 0.6
```

At baseRate=0.65:
- Mastery 0: 65% correct
- Mastery 1: 69% correct
- Mastery 2: 73% correct
- Mastery 3: 77% correct
- Mastery 4: 81% correct
- Mastery 5: 100% correct (auto-charge, no quiz)

This teaches the agent that upgrading card mastery is strategically valuable — it should charge cards it knows well (high mastery) and quick-play cards it doesn't.

**Acceptance Criteria**:
- Agent learns to preferentially charge high-mastery cards
- Mastery progression visibly affects agent strategy in analysis
- Win rate improves 5-10% compared to flat correctRate model

---

## Files Affected

### Created
| File | Purpose |
|------|---------|
| `tests/playtest/headless/gym-server.ts` | Node.js Gymnasium server (IPC bridge) |
| `tests/playtest/rl/__init__.py` | Python package init |
| `tests/playtest/rl/recall_rogue_env.py` | Gymnasium environment |
| `tests/playtest/rl/train.py` | PPO training script |
| `tests/playtest/rl/config.py` | Hyperparameters and training config |
| `tests/playtest/rl/analyze.py` | Strategy extraction and analysis |
| `tests/playtest/rl/report.py` | Balance report generator |
| `tests/playtest/rl/watchdog.py` | Regression detection |

### Modified
| File | Change |
|------|--------|
| `tests/playtest/headless/gym-server.ts` | Step 7: mastery-aware correctness |

### Not Modified
- No changes to game source code (`src/`)
- No changes to existing headless simulator
- No new npm dependencies (Node.js side uses existing code)

---

## Verification Gate

- [ ] Step 1: ML stack installed, MPS available
- [ ] Step 2: Gym server responds to reset/step, 500+ steps/sec
- [ ] Step 3: Gymnasium env passes `check_env`, 7 parallel envs work
- [ ] Step 4: Training runs, reward curve improves, >70% win rate after 2M steps
- [ ] Step 5: Analysis report generated with all 8 categories
- [ ] Step 6: Watchdog detects 5%+ win rate changes
- [ ] Step 7: Mastery-aware model shows strategy differentiation
- [ ] TensorBoard accessible for training visualization
- [ ] No changes to game source code (pure testing infrastructure)
- [ ] All Python scripts runnable from repo root
- [ ] `.gitignore` updated for `tests/playtest/rl/logs/`, `tests/playtest/rl/models/`

---

## Quick Commands (after implementation)

```bash
# Train from scratch (~30-60 min on M4 Max)
python3 tests/playtest/rl/train.py

# Monitor training live
tensorboard --logdir tests/playtest/rl/logs/

# Generate balance report from trained model
python3 tests/playtest/rl/analyze.py --model models/latest --episodes 1000

# Check for regressions after balance change
python3 tests/playtest/rl/watchdog.py

# Quick retrain after major balance change
python3 tests/playtest/rl/watchdog.py --retrain --timesteps 200000
```

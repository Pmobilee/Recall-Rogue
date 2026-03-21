"""
Rogue Brain — Training Configuration
======================================
Hyperparameters for PPO training on Apple M4 Max (MPS).
"""

import os

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

# --- PPO Hyperparameters ---
PPO_CONFIG = {
    "learning_rate": 3e-4,
    "n_steps": 2048,            # Steps per env before each update
    "batch_size": 256,          # Minibatch size for SGD
    "n_epochs": 10,             # Epochs per update
    "gamma": 0.99,              # Discount factor
    "gae_lambda": 0.95,         # GAE lambda
    "clip_range": 0.2,          # PPO clip range
    "ent_coef": 0.01,           # Entropy coefficient (exploration bonus)
    "vf_coef": 0.5,             # Value function loss coefficient
    "max_grad_norm": 0.5,       # Gradient clipping
}

# --- Training Schedule ---
TRAINING_CONFIG = {
    "total_timesteps": 2_000_000,
    "eval_freq": 10_000,         # Evaluate every N steps
    "n_eval_episodes": 50,       # Episodes per evaluation
    "save_freq": 50_000,         # Save checkpoint every N steps
    "log_dir": os.path.join(REPO_ROOT, "tests", "playtest", "rl", "logs"),
    "model_dir": os.path.join(REPO_ROOT, "tests", "playtest", "rl", "models"),
}

# --- Curriculum Phases ---
# Progressive difficulty: full game runs from easy -> hard
CURRICULUM = [
    {
        "name": "phase1_full_game_easy",
        "timesteps": 500_000,
        "correct_rate": 0.85,
        "ascension_level": 0,
    },
    {
        "name": "phase2_full_game_medium",
        "timesteps": 500_000,
        "correct_rate": 0.75,
        "ascension_level": 0,
    },
    {
        "name": "phase3_full_game_hard",
        "timesteps": 500_000,
        "correct_rate": 0.65,
        "ascension_level": 0,
    },
    {
        "name": "phase4_ascension",
        "timesteps": 500_000,
        "correct_rate": 0.70,
        "ascension_level": 5,
    },
]

# --- Network Architecture ---
NETWORK_CONFIG = {
    "net_arch": [256, 256, 128],  # Shared MLP layers
    "activation_fn": "ReLU",
}

# --- Environment ---
ENV_CONFIG = {
    "n_envs": 4,               # Parallel environments (conservative for subprocess overhead)
    "deck_size": 15,
}

# --- Player Profiles ---
# Different player types for realistic testing.
# explore_rate: probability of random action (forces visits to shop, rest, mystery)
# correct_rate: quiz answer accuracy (simulates knowledge level)
PLAYER_PROFILES = {
    "newbie": {
        "description": "First-time player, explores everything, poor quiz accuracy",
        "correct_rate": 0.50,
        "explore_rate": 0.35,
        "ascension_level": 0,
    },
    "casual": {
        "description": "Casual player, sometimes visits shops/rest, moderate accuracy",
        "correct_rate": 0.65,
        "explore_rate": 0.20,
        "ascension_level": 0,
    },
    "student": {
        "description": "Dedicated learner, mostly optimal but explores occasionally",
        "correct_rate": 0.75,
        "explore_rate": 0.10,
        "ascension_level": 0,
    },
    "gamer": {
        "description": "Good at games but poor quiz knowledge, plays optimally",
        "correct_rate": 0.55,
        "explore_rate": 0.05,
        "ascension_level": 0,
    },
    "scholar": {
        "description": "High knowledge, near-optimal play",
        "correct_rate": 0.90,
        "explore_rate": 0.03,
        "ascension_level": 0,
    },
    "optimal": {
        "description": "Stockfish mode — pure exploitation, no exploration",
        "correct_rate": 0.80,
        "explore_rate": 0.0,
        "ascension_level": 0,
    },
    "struggling": {
        "description": "Player who gets most answers wrong, high exploration",
        "correct_rate": 0.40,
        "explore_rate": 0.25,
        "ascension_level": 0,
    },
    "ascension5": {
        "description": "Experienced player at ascension 5",
        "correct_rate": 0.80,
        "explore_rate": 0.05,
        "ascension_level": 5,
    },
    "ascension10": {
        "description": "Expert player at ascension 10",
        "correct_rate": 0.85,
        "explore_rate": 0.03,
        "ascension_level": 10,
    },
}


# --- Device ---
def get_device() -> str:
    """Get the best available PyTorch device.

    Note: For MLP policies (non-CNN), CPU is actually faster than MPS/GPU
    due to the overhead of data transfers. MPS is only beneficial for
    large CNN policies. See: https://github.com/DLR-RM/stable-baselines3/issues/1245
    """
    # MLP policies train faster on CPU — GPU overhead outweighs the gain
    return "cpu"

#!/usr/bin/env python3
"""
Rogue Brain — PPO Training Script
====================================
Trains a PPO agent to play Recall Rogue combat optimally.
Uses Apple M4 Max MPS GPU acceleration.

Usage:
    python3 tests/playtest/rl/train.py                           # Full curriculum training
    python3 tests/playtest/rl/train.py --timesteps 100000        # Quick test
    python3 tests/playtest/rl/train.py --resume models/latest    # Resume from checkpoint
    python3 tests/playtest/rl/train.py --phase 2                 # Start from specific phase
    python3 tests/playtest/rl/train.py --timesteps 2000000 --n-envs 4 --model-name rogue_brain_v4_postfix

    # Monitor training:
    tensorboard --logdir tests/playtest/rl/logs/
"""

import argparse
import os
import shutil
import sys
import time
from datetime import datetime

import numpy as np
import torch

# Add repo root to path so we can import our modules
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
sys.path.insert(0, REPO_ROOT)

from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv
from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
from stable_baselines3.common.monitor import Monitor

from tests.playtest.rl.recall_rogue_env import RecallRogueEnv, make_env
from tests.playtest.rl.config import (
    PPO_CONFIG, TRAINING_CONFIG, CURRICULUM, NETWORK_CONFIG, ENV_CONFIG, get_device
)


def create_vec_env(n_envs: int, **env_kwargs) -> SubprocVecEnv:
    """Create a vectorized environment with N parallel workers."""
    if n_envs == 1:
        return DummyVecEnv([make_env(**env_kwargs)])
    return SubprocVecEnv([make_env(**env_kwargs) for _ in range(n_envs)])


def train_phase(
    model: PPO,
    phase: dict,
    phase_idx: int,
    n_envs: int,
    log_dir: str,
    model_dir: str,
    eval_freq: int,
    n_eval_episodes: int,
    save_freq: int,
):
    """Train a single curriculum phase."""
    phase_name = phase["name"]
    timesteps = phase["timesteps"]

    print(f"\n{'='*60}")
    print(f"  PHASE {phase_idx + 1}: {phase_name}")
    print(f"  Timesteps: {timesteps:,}")
    print(f"  Correct rate: {phase['correct_rate']}")
    print(f"  Ascension: {phase['ascension_level']}")
    print(f"  Ascension: {phase['ascension_level']}")
    print(f"{'='*60}\n")

    # Create environments for this phase
    env_kwargs = {
        "correct_rate": phase["correct_rate"],
        "ascension_level": phase["ascension_level"],
        "ascension_level": phase["ascension_level"],
        "act": phase.get("act", 1),
        "node_type": phase.get("node_type", "combat"),
        "deck_size": ENV_CONFIG["deck_size"],
    }

    train_env = create_vec_env(n_envs, **env_kwargs)
    eval_env = create_vec_env(1, **env_kwargs)

    # Update model's environment
    model.set_env(train_env)

    # Callbacks
    phase_log_dir = os.path.join(log_dir, phase_name)
    phase_model_dir = os.path.join(model_dir, phase_name)
    os.makedirs(phase_log_dir, exist_ok=True)
    os.makedirs(phase_model_dir, exist_ok=True)

    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=phase_model_dir,
        log_path=phase_log_dir,
        eval_freq=max(eval_freq // n_envs, 1),
        n_eval_episodes=n_eval_episodes,
        deterministic=True,
        verbose=1,
    )

    checkpoint_callback = CheckpointCallback(
        save_freq=max(save_freq // n_envs, 1),
        save_path=phase_model_dir,
        name_prefix=f"rogue_brain_{phase_name}",
        verbose=0,
    )

    # Train
    start_time = time.time()
    model.learn(
        total_timesteps=timesteps,
        callback=[eval_callback, checkpoint_callback],
        reset_num_timesteps=False,  # Continue step counter across phases
        progress_bar=True,
    )
    elapsed = time.time() - start_time

    print(f"\n  Phase {phase_name} complete in {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"  Steps/sec: {timesteps / elapsed:.0f}")

    # Save phase model
    model.save(os.path.join(phase_model_dir, "final"))

    # Cleanup
    train_env.close()
    eval_env.close()

    return model


def main():
    parser = argparse.ArgumentParser(description="Rogue Brain — PPO Training")
    parser.add_argument("--timesteps", type=int, default=None, help="Override total timesteps (single phase, no curriculum)")
    parser.add_argument("--resume", type=str, default=None, help="Path to model checkpoint to resume from")
    parser.add_argument("--phase", type=int, default=0, help="Start from curriculum phase (0-indexed)")
    parser.add_argument("--n-envs", type=int, default=ENV_CONFIG["n_envs"], help="Number of parallel environments")
    parser.add_argument("--correct-rate", type=float, default=None, help="Override correct rate")
    parser.add_argument("--ascension", type=int, default=None, help="Override ascension level")
    parser.add_argument(
        "--model-name",
        type=str,
        default=None,
        help="Named alias for the final model (saved to models/<name>.zip alongside the timestamped dir)",
    )
    args = parser.parse_args()

    device = get_device()
    print(f"\nRogue Brain — PPO Training")
    print(f"Device: {device}")
    print(f"PyTorch: {torch.__version__}")
    print(f"Parallel envs: {args.n_envs}")
    if args.model_name:
        print(f"Model alias: {args.model_name}")

    # Setup directories
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = os.path.join(TRAINING_CONFIG["log_dir"], timestamp)
    model_dir = os.path.join(TRAINING_CONFIG["model_dir"], timestamp)
    os.makedirs(log_dir, exist_ok=True)
    os.makedirs(model_dir, exist_ok=True)

    # Also maintain a 'latest' symlink
    latest_log = os.path.join(TRAINING_CONFIG["log_dir"], "latest")
    latest_model = os.path.join(TRAINING_CONFIG["model_dir"], "latest")
    for link in [latest_log, latest_model]:
        if os.path.islink(link):
            os.unlink(link)
    os.symlink(timestamp, latest_log)
    os.symlink(timestamp, latest_model)

    # Quick single-phase mode
    if args.timesteps is not None:
        print(f"\nSingle-phase mode: {args.timesteps:,} timesteps")

        env_kwargs = {
            "correct_rate": args.correct_rate or 0.75,
            "ascension_level": args.ascension or 0,
            "deck_size": ENV_CONFIG["deck_size"],
        }

        train_env = create_vec_env(args.n_envs, **env_kwargs)
        eval_env = create_vec_env(1, **env_kwargs)

        if args.resume:
            print(f"Resuming from: {args.resume}")
            model = PPO.load(args.resume, env=train_env, device=device)
        else:
            model = PPO(
                "MlpPolicy",
                train_env,
                **PPO_CONFIG,
                policy_kwargs={"net_arch": NETWORK_CONFIG["net_arch"]},
                tensorboard_log=log_dir,
                device=device,
                verbose=1,
            )

        eval_callback = EvalCallback(
            eval_env,
            best_model_save_path=model_dir,
            log_path=log_dir,
            eval_freq=max(TRAINING_CONFIG["eval_freq"] // args.n_envs, 1),
            n_eval_episodes=TRAINING_CONFIG["n_eval_episodes"],
            deterministic=True,
            verbose=1,
        )

        checkpoint_callback = CheckpointCallback(
            save_freq=max(TRAINING_CONFIG["save_freq"] // args.n_envs, 1),
            save_path=model_dir,
            name_prefix="rogue_brain",
            verbose=0,
        )

        start = time.time()
        model.learn(
            total_timesteps=args.timesteps,
            callback=[eval_callback, checkpoint_callback],
            progress_bar=True,
        )
        elapsed = time.time() - start

        final_path = os.path.join(model_dir, "final")
        model.save(final_path)
        print(f"\nTraining complete in {elapsed:.0f}s. Model saved to {model_dir}")
        print(f"Steps/sec: {args.timesteps / elapsed:.0f}")

        # Copy to named alias if requested
        if args.model_name:
            alias_path = os.path.join(TRAINING_CONFIG["model_dir"], f"{args.model_name}.zip")
            shutil.copy2(f"{final_path}.zip", alias_path)
            print(f"Alias saved: {alias_path}")

        train_env.close()
        eval_env.close()
        return

    # Full curriculum training
    print(f"\nCurriculum training: {len(CURRICULUM)} phases")
    total_steps = sum(p["timesteps"] for p in CURRICULUM)
    print(f"Total timesteps: {total_steps:,}")

    # Create initial model
    initial_env_kwargs = {
        "correct_rate": CURRICULUM[0]["correct_rate"],
        "ascension_level": CURRICULUM[0]["ascension_level"],
        "deck_size": ENV_CONFIG["deck_size"],
    }
    initial_env = create_vec_env(args.n_envs, **initial_env_kwargs)

    if args.resume:
        print(f"Resuming from: {args.resume}")
        model = PPO.load(args.resume, env=initial_env, device=device)
    else:
        model = PPO(
            "MlpPolicy",
            initial_env,
            **PPO_CONFIG,
            policy_kwargs={"net_arch": NETWORK_CONFIG["net_arch"]},
            tensorboard_log=log_dir,
            device=device,
            verbose=1,
        )

    initial_env.close()

    # Run curriculum phases
    overall_start = time.time()
    for i, phase in enumerate(CURRICULUM):
        if i < args.phase:
            print(f"Skipping phase {i}: {phase['name']}")
            continue

        model = train_phase(
            model=model,
            phase=phase,
            phase_idx=i,
            n_envs=args.n_envs,
            log_dir=log_dir,
            model_dir=model_dir,
            eval_freq=TRAINING_CONFIG["eval_freq"],
            n_eval_episodes=TRAINING_CONFIG["n_eval_episodes"],
            save_freq=TRAINING_CONFIG["save_freq"],
        )

    # Save final model
    final_path = os.path.join(model_dir, "final")
    model.save(final_path)

    # Copy to named alias if requested
    if args.model_name:
        alias_path = os.path.join(TRAINING_CONFIG["model_dir"], f"{args.model_name}.zip")
        shutil.copy2(f"{final_path}.zip", alias_path)
        print(f"Alias saved: {alias_path}")

    overall_elapsed = time.time() - overall_start
    print(f"\n{'='*60}")
    print(f"  TRAINING COMPLETE")
    print(f"  Total time: {overall_elapsed:.0f}s ({overall_elapsed/60:.1f}min)")
    print(f"  Final model: {final_path}")
    if args.model_name:
        print(f"  Named alias: {TRAINING_CONFIG['model_dir']}/{args.model_name}.zip")
    print(f"  TensorBoard: tensorboard --logdir {log_dir}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

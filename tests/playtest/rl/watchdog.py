#!/usr/bin/env python3
"""
Rogue Brain — Continuous Watchdog
====================================
Detects balance regressions by comparing RL agent performance to a baseline.

Usage:
    python3 tests/playtest/rl/watchdog.py                          # Compare to baseline
    python3 tests/playtest/rl/watchdog.py --set-baseline           # Save current as baseline
    python3 tests/playtest/rl/watchdog.py --retrain --timesteps 200000  # Retrain + compare
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
sys.path.insert(0, REPO_ROOT)

BASELINE_PATH = os.path.join(SCRIPT_DIR, 'baseline.json')
DEFAULT_MODEL = os.path.join(SCRIPT_DIR, 'models', 'rogue_brain_500k')


def run_evaluation(model_path: str, n_episodes: int = 100, correct_rate: float = 0.75,
                   encounter_count: int = 1) -> dict:
    """Run evaluation and return summary metrics."""
    from tests.playtest.rl.analyze import run_analysis

    results = run_analysis(model_path, n_episodes, correct_rate, encounter_count)

    episodes = results['episodes']
    n = len(episodes)
    wins = sum(1 for e in episodes if e['result'] == 'victory')

    charge_quick = results['charge_vs_quick']
    play_total = charge_quick.get('charge', 0) + charge_quick.get('quick', 0) or 1

    chain_stats = results['chain_stats']
    chain_total = chain_stats.get('extended', 0) + chain_stats.get('broken', 0) or 1

    summary = {
        'timestamp': datetime.now().isoformat(),
        'model_path': model_path,
        'n_episodes': n,
        'win_rate': wins / max(n, 1),
        'avg_reward': sum(e['reward'] for e in episodes) / max(n, 1),
        'avg_steps': sum(e['steps'] for e in episodes) / max(n, 1),
        'charge_rate': charge_quick.get('charge', 0) / play_total,
        'chain_extension_rate': chain_stats.get('extended', 0) / chain_total,
        'skip_rate': charge_quick.get('skip', 0) / max(sum(int(v) for v in results['action_counts'].values()), 1),
        'per_enemy_win_rates': {},
        'hp_at_victory': results.get('hp_at_victory', []),
    }

    for enemy, stats in results['per_enemy'].items():
        total = stats['wins'] + stats['losses']
        if total > 0:
            summary['per_enemy_win_rates'][enemy] = {
                'win_rate': stats['wins'] / total,
                'count': total,
            }

    return summary


def compare_to_baseline(current: dict, baseline: dict) -> tuple:
    """Compare current results to baseline. Returns (passed: bool, report: str)."""
    lines = []
    warnings = []

    lines.append('# Rogue Brain Watchdog Report')
    lines.append(f'')
    lines.append(f'Baseline: {baseline.get("timestamp", "unknown")}')
    lines.append(f'Current:  {current["timestamp"]}')
    lines.append(f'')

    # Win rate comparison
    wr_diff = current['win_rate'] - baseline['win_rate']
    wr_pct = wr_diff * 100
    lines.append(f'## Win Rate')
    lines.append(f'- Baseline: {baseline["win_rate"]*100:.1f}%')
    lines.append(f'- Current:  {current["win_rate"]*100:.1f}%')
    lines.append(f'- Delta:    {wr_pct:+.1f}%')
    if abs(wr_pct) > 5:
        warnings.append(f'Win rate shifted {wr_pct:+.1f}% (threshold: 5%)')
        lines.append(f'> **WARNING**: Significant win rate change!')
    lines.append(f'')

    # Strategy shifts
    lines.append(f'## Strategy Shifts')
    lines.append(f'')
    lines.append(f'| Metric | Baseline | Current | Delta |')
    lines.append(f'|--------|----------|---------|-------|')

    metrics = [
        ('Charge Rate', 'charge_rate'),
        ('Chain Extension', 'chain_extension_rate'),
        ('Skip Rate', 'skip_rate'),
        ('Avg Reward', 'avg_reward'),
        ('Avg Steps', 'avg_steps'),
    ]

    for label, key in metrics:
        b_val = baseline.get(key, 0)
        c_val = current.get(key, 0)
        delta = c_val - b_val
        if key in ('charge_rate', 'chain_extension_rate', 'skip_rate'):
            lines.append(f'| {label} | {b_val*100:.1f}% | {c_val*100:.1f}% | {delta*100:+.1f}% |')
            if abs(delta) > 0.2:
                warnings.append(f'{label} shifted {delta*100:+.1f}% (threshold: 20%)')
        else:
            lines.append(f'| {label} | {b_val:.2f} | {c_val:.2f} | {delta:+.2f} |')
    lines.append(f'')

    # Per-enemy changes
    lines.append(f'## Per-Enemy Changes')
    lines.append(f'')
    baseline_enemies = baseline.get('per_enemy_win_rates', {})
    current_enemies = current.get('per_enemy_win_rates', {})
    all_enemies = set(list(baseline_enemies.keys()) + list(current_enemies.keys()))

    enemy_changes = []
    for enemy in sorted(all_enemies):
        b_wr = baseline_enemies.get(enemy, {}).get('win_rate', None)
        c_wr = current_enemies.get(enemy, {}).get('win_rate', None)

        if b_wr is not None and c_wr is not None:
            delta = c_wr - b_wr
            if abs(delta) > 0.15:
                enemy_changes.append((enemy, b_wr, c_wr, delta))
                warnings.append(f'{enemy} win rate shifted {delta*100:+.0f}%')
        elif b_wr is None and c_wr is not None:
            enemy_changes.append((enemy, None, c_wr, None))
        elif b_wr is not None and c_wr is None:
            enemy_changes.append((enemy, b_wr, None, None))

    if enemy_changes:
        lines.append(f'| Enemy | Baseline | Current | Delta |')
        lines.append(f'|-------|----------|---------|-------|')
        for enemy, b_wr, c_wr, delta in enemy_changes:
            b_str = f'{b_wr*100:.0f}%' if b_wr is not None else 'N/A'
            c_str = f'{c_wr*100:.0f}%' if c_wr is not None else 'N/A'
            d_str = f'{delta*100:+.0f}%' if delta is not None else 'NEW/REMOVED'
            lines.append(f'| {enemy} | {b_str} | {c_str} | {d_str} |')
    else:
        lines.append(f'No significant per-enemy changes detected.')
    lines.append(f'')

    # Verdict
    passed = len(warnings) == 0
    lines.append(f'## Verdict')
    lines.append(f'')
    if passed:
        lines.append(f'**PASS** — No significant regressions detected.')
    else:
        lines.append(f'**FAIL** — {len(warnings)} issue(s) detected:')
        for w in warnings:
            lines.append(f'  - {w}')
    lines.append(f'')

    report = '\n'.join(lines)
    return passed, report


def main():
    parser = argparse.ArgumentParser(description='Rogue Brain — Watchdog')
    parser.add_argument('--model', type=str, default=DEFAULT_MODEL, help='Path to trained model')
    parser.add_argument('--episodes', type=int, default=100, help='Evaluation episodes')
    parser.add_argument('--encounters', type=int, default=1, help='Encounters per episode')
    parser.add_argument('--correct-rate', type=float, default=0.75, help='Quiz correct rate')
    parser.add_argument('--set-baseline', action='store_true', help='Save current results as baseline')
    parser.add_argument('--retrain', action='store_true', help='Retrain model before evaluation')
    parser.add_argument('--timesteps', type=int, default=200_000, help='Timesteps for retraining')
    args = parser.parse_args()

    model_path = args.model

    # Optionally retrain
    if args.retrain:
        print(f'Retraining model for {args.timesteps:,} steps...')
        import subprocess
        result = subprocess.run(
            [sys.executable, os.path.join(SCRIPT_DIR, 'train.py'),
             '--timesteps', str(args.timesteps), '--n-envs', '4'],
            cwd=REPO_ROOT, capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f'Retraining failed:\n{result.stderr[:500]}')
            sys.exit(1)
        # Use the latest model
        latest_dir = os.path.join(SCRIPT_DIR, 'models', 'latest')
        if os.path.islink(latest_dir):
            real_dir = os.path.join(SCRIPT_DIR, 'models', os.readlink(latest_dir))
            final = os.path.join(real_dir, 'final')
            if os.path.exists(final + '.zip'):
                model_path = final
        print(f'Using retrained model: {model_path}')

    print(f'Running evaluation ({args.episodes} episodes)...')
    current = run_evaluation(model_path, args.episodes, args.correct_rate, args.encounters)

    if args.set_baseline:
        with open(BASELINE_PATH, 'w') as f:
            # Convert lists to JSON-safe format
            safe_current = {k: v for k, v in current.items()}
            json.dump(safe_current, f, indent=2, default=str)
        print(f'Baseline saved to: {BASELINE_PATH}')
        print(f'Win rate: {current["win_rate"]*100:.1f}%')
        print(f'Charge rate: {current["charge_rate"]*100:.1f}%')
        return

    # Compare to baseline
    if not os.path.exists(BASELINE_PATH):
        print(f'No baseline found at {BASELINE_PATH}')
        print(f'Run with --set-baseline first to establish a baseline.')
        print(f'\nCurrent results:')
        print(f'  Win rate: {current["win_rate"]*100:.1f}%')
        print(f'  Charge rate: {current["charge_rate"]*100:.1f}%')
        print(f'  Chain extension: {current["chain_extension_rate"]*100:.1f}%')
        print(f'  Skip rate: {current["skip_rate"]*100:.1f}%')
        sys.exit(0)

    with open(BASELINE_PATH) as f:
        baseline = json.load(f)

    passed, report = compare_to_baseline(current, baseline)
    print(report)

    # Save report
    reports_dir = os.path.join(REPO_ROOT, 'data', 'playtests', 'rl-analysis', 'watchdog')
    os.makedirs(reports_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M')
    report_path = os.path.join(reports_dir, f'watchdog-{timestamp}.md')
    with open(report_path, 'w') as f:
        f.write(report)
    print(f'Report saved to: {report_path}')

    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Rogue Brain — Strategy Analysis
=================================
Loads a trained PPO model and runs evaluation episodes to extract
the agent's learned strategy, producing detailed behavioral data.

Usage:
    python3 tests/playtest/rl/analyze.py --model tests/playtest/rl/models/rogue_brain_500k --episodes 200
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime

import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
sys.path.insert(0, REPO_ROOT)

from stable_baselines3 import PPO
from sb3_contrib import MaskablePPO
from tests.playtest.rl.recall_rogue_env import RecallRogueEnv


def _load_model(model_path: str):
    """Load a model, trying MaskablePPO first, then PPO."""
    try:
        return MaskablePPO.load(model_path), True
    except Exception:
        return PPO.load(model_path), False


def run_analysis(model_path: str, n_episodes: int = 200, correct_rate: float = 0.75,
                 ascension: int = 0, explore_rate: float = 0.0) -> dict:
    """Run evaluation episodes and collect detailed behavioral data."""

    model, is_maskable = _load_model(model_path)
    env = RecallRogueEnv(correct_rate=correct_rate, ascension_level=ascension, explore_rate=explore_rate)

    # Tracking data
    results = {
        'config': {
            'model_path': model_path,
            'n_episodes': n_episodes,
            'correct_rate': correct_rate,
            'ascension': ascension,
            'explore_rate': explore_rate,
        },
        'episodes': [],  # Per-episode summaries
        'action_counts': defaultdict(int),  # Total action frequencies
        'card_type_plays': defaultdict(lambda: {'charge': 0, 'quick': 0, 'total': 0}),
        'per_enemy': defaultdict(lambda: {'wins': 0, 'losses': 0, 'total_steps': 0, 'total_reward': 0}),
        'encounters_won': 0,
        'encounters_lost': 0,
        'encounters_total': 0,
        'charge_vs_quick': {'charge': 0, 'quick': 0, 'skip': 0},
        'chain_stats': {'extended': 0, 'broken': 0, 'total_plays': 0},
        'correct_stats': {'correct_charges': 0, 'wrong_charges': 0},
        'hp_at_victory': [],
        'hp_at_defeat': [],
        'turns_to_win': [],
        'turns_to_lose': [],
        'phase_counts': defaultdict(int),
        'room_choices': defaultdict(int),
        'card_rewards_picked': 0,
        'card_rewards_skipped': 0,
        'relic_picks': 0,
        'relic_skips': 0,
        'shop_purchases': defaultdict(int),
        'rest_choices': {'heal': 0, 'upgrade': 0},
        'retreat_vs_delve': {'retreat': 0, 'delve': 0},
        'floors_reached': [],
        'economy': {
            'gold_at_shop_visits': [],      # Gold amount when visiting shop
            'gold_at_run_end': [],          # Final gold (unspent)
            'could_afford_relic': 0,        # Times had >=80g at shop
            'too_poor_for_relic': 0,        # Times had <80g at shop
            'shop_left_without_buying': 0,  # Times left shop without purchase
            'total_gold_earned': 0,         # Track gold earned (from info)
        },
    }

    for ep in range(n_episodes):
        obs, info = env.reset()
        done = False
        current_enemy = 'unknown'
        ep_data = {
            'enemy': 'multi-encounter',
            'enemy_id': 'multi-encounter',
            'actions': [],
            'total_reward': 0,
            'steps': 0,
            'result': None,
        }

        # Track the phase BEFORE each action (the response phase is the NEW phase after)
        current_phase = info.get('phase', '?')

        while not done and ep_data['steps'] < 2000:
            phase_before = current_phase  # Phase when action was chosen

            if is_maskable:
                mask = env.action_masks()
                action, _ = model.predict(obs, deterministic=True, action_masks=mask)
            else:
                action, _ = model.predict(obs, deterministic=True)
            action = int(action)
            obs, reward, done, truncated, info = env.step(action)

            current_phase = info.get('phase', '?')  # Phase AFTER action

            ep_data['actions'].append(action)
            ep_data['total_reward'] += reward
            ep_data['steps'] += 1

            # Track action type
            results['action_counts'][action] += 1

            # Use phase_before for decision tracking (the phase when the agent chose)
            phase = phase_before
            results['phase_counts'][phase] += 1

            # Update current enemy name when entering combat
            if info.get('enemyName'):
                current_enemy = info['enemyName']

            if phase == 'room_select' and 18 <= action <= 20:
                room_type = info.get('roomChosen') or info.get('roomType') or 'unknown'
                results['room_choices'][room_type] += 1
            elif phase == 'card_reward':
                card_result = info.get('cardReward', '')
                if card_result == 'skipped' or action == 21:
                    results['card_rewards_skipped'] += 1
                elif card_result and card_result != 'empty_slot':
                    results['card_rewards_picked'] += 1
            elif phase == 'relic_reward':
                relic_result = info.get('relicReward', '')
                if relic_result == 'skipped' or action == 29:
                    results['relic_skips'] += 1
                elif relic_result and relic_result not in ('empty_slot', 'swap_required'):
                    results['relic_picks'] += 1
            elif phase == 'shop':
                bought = info.get('shopBought', '')
                if bought.startswith('relic:'):
                    results['shop_purchases']['relic'] += 1
                elif bought.startswith('card:'):
                    results['shop_purchases']['card'] += 1
                elif info.get('shopRemoved'):
                    results['shop_purchases']['removal'] += 1

                # Economy tracking
                gold = info.get('gold', 0)
                results['economy']['gold_at_shop_visits'].append(gold)
                if gold >= 80:
                    results['economy']['could_afford_relic'] += 1
                else:
                    results['economy']['too_poor_for_relic'] += 1
                if info.get('shop') == 'left':
                    results['economy']['shop_left_without_buying'] += 1
            elif phase == 'rest':
                rest_result = info.get('rest', '')
                if rest_result == 'healed' or rest_result == 'fallback_heal' or action == 18:
                    results['rest_choices']['heal'] += 1
                elif rest_result.startswith('upgraded:') or 19 <= action <= 21:
                    results['rest_choices']['upgrade'] += 1
            elif phase == 'retreat_or_delve':
                if info.get('runEnd') == 'retreat' or action == 18:
                    results['retreat_vs_delve']['retreat'] += 1
                elif info.get('delve') or info.get('runEnd') == 'max_floors_cleared' or action == 19:
                    results['retreat_vs_delve']['delve'] += 1

            if action < 8:
                results['charge_vs_quick']['charge'] += 1
                results['chain_stats']['total_plays'] += 1
                # Only track accuracy during combat phase
                if phase == 'combat':
                    if info.get('wasCorrect'):
                        results['correct_stats']['correct_charges'] += 1
                    elif info.get('wasCorrect') is not None and not info.get('wasCorrect'):
                        results['correct_stats']['wrong_charges'] += 1
                if info.get('chainExtended'):
                    results['chain_stats']['extended'] += 1
                if info.get('chainBroken'):
                    results['chain_stats']['broken'] += 1
            elif action < 16:
                results['charge_vs_quick']['quick'] += 1
                results['chain_stats']['total_plays'] += 1
            elif action == 16:
                results['charge_vs_quick']['skip'] += 1

            # Track per-encounter outcomes
            if info.get('encounterVictory'):
                results['encounters_won'] += 1
                results['encounters_total'] += 1
                results['per_enemy'][current_enemy]['wins'] += 1

            if done:
                done = True

        # Track floor reached at episode end
        results['floors_reached'].append(info.get('floorsCleared', info.get('floor', 1)))
        results['economy']['gold_at_run_end'].append(info.get('finalGold', info.get('gold', 0)))

        # Determine result — gym server sets info['result'] on run end
        result = info.get('result', None)
        if result is None:
            if not done:
                result = 'timeout'
            elif info.get('floorsCleared', 0) >= 4:
                result = 'victory'
            elif info.get('finalPlayerHp', 1) <= 0:
                result = 'defeat'
            else:
                result = 'retreat'
        ep_data['result'] = result

        # Track defeat encounter for per-enemy stats
        if result == 'defeat':
            results['encounters_lost'] += 1
            results['encounters_total'] += 1
            results['per_enemy'][current_enemy]['losses'] += 1

        # Per-episode tracking (not per-enemy wins/losses — those are tracked per-encounter above)
        results['per_enemy'][current_enemy]['total_steps'] += ep_data['steps']
        results['per_enemy'][current_enemy]['total_reward'] += ep_data['total_reward']
        if result == 'victory':
            results['hp_at_victory'].append(info.get('playerHp', 0))
            results['turns_to_win'].append(ep_data['steps'])
        else:
            results['hp_at_defeat'].append(info.get('playerHp', 0))
            results['turns_to_lose'].append(ep_data['steps'])

        # Store episode (without full action list for compactness)
        results['episodes'].append({
            'enemy': current_enemy,
            'result': result,
            'steps': ep_data['steps'],
            'reward': round(ep_data['total_reward'], 2),
        })

        if (ep + 1) % 50 == 0:
            wins = sum(1 for e in results['episodes'] if e['result'] == 'victory')
            print(f'  [{ep+1}/{n_episodes}] Win rate: {wins}/{ep+1} = {wins/(ep+1)*100:.0f}%')

    env.close()

    # Convert defaultdicts to regular dicts for JSON serialization
    results['action_counts'] = dict(results['action_counts'])
    results['per_enemy'] = {k: dict(v) for k, v in results['per_enemy'].items()}
    results['card_type_plays'] = {k: dict(v) for k, v in results['card_type_plays'].items()}
    results['phase_counts'] = dict(results['phase_counts'])
    results['room_choices'] = dict(results['room_choices'])
    results['shop_purchases'] = dict(results['shop_purchases'])

    return results


def main():
    parser = argparse.ArgumentParser(description='Rogue Brain — Strategy Analysis')
    parser.add_argument('--model', required=True, help='Path to trained model (.zip)')
    parser.add_argument('--episodes', type=int, default=200, help='Number of evaluation episodes')
    parser.add_argument('--correct-rate', type=float, default=0.75, help='Quiz correct rate')
    parser.add_argument('--ascension', type=int, default=0, help='Ascension level')
    parser.add_argument('--profile', type=str, default=None,
        help='Player profile name (newbie/casual/student/gamer/scholar/optimal/struggling). Overrides correct-rate/ascension.')
    parser.add_argument('--all-profiles', action='store_true',
        help='Run analysis for ALL player profiles')
    parser.add_argument('--explore-rate', type=float, default=0.0,
        help='Exploration rate (0.0-1.0) — probability of random action override')
    parser.add_argument('--output', type=str, default=None, help='Output JSON path')
    args = parser.parse_args()

    from tests.playtest.rl.config import PLAYER_PROFILES

    # Resolve player profile settings
    output_dir = os.path.join(REPO_ROOT, 'data', 'playtests', 'rl-analysis')
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M')

    if args.all_profiles:
        # Run analysis for each profile sequentially
        for profile_name, profile in PLAYER_PROFILES.items():
            print(f'\n{"="*60}')
            print(f'  Profile: {profile_name} — {profile["description"]}')
            print(f'{"="*60}')
            start = time.time()
            results = run_analysis(
                args.model, args.episodes,
                correct_rate=profile['correct_rate'],
                ascension=profile.get('ascension_level', 0),
                explore_rate=profile.get('explore_rate', 0.0),
            )
            elapsed = time.time() - start
            print(f'  Complete in {elapsed:.0f}s')
            output_path = os.path.join(output_dir, f'{timestamp}_{profile_name}.json')
            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2)
            report_path = output_path.replace('.json', '.md')
            from tests.playtest.rl.report import generate_report
            generate_report(results, report_path)
            print(f'  Saved: {report_path}')
        print(f'\nAll profiles complete!')
        return

    if args.profile:
        if args.profile not in PLAYER_PROFILES:
            print(f'Unknown profile: {args.profile}')
            print(f'Available: {", ".join(PLAYER_PROFILES.keys())}')
            sys.exit(1)
        profile = PLAYER_PROFILES[args.profile]
        correct_rate = profile['correct_rate']
        ascension = profile.get('ascension_level', 0)
        explore_rate = profile.get('explore_rate', 0.0)
        print(f'Profile: {args.profile} — {profile["description"]}')
    else:
        correct_rate = args.correct_rate or 0.75
        ascension = args.ascension or 0
        explore_rate = args.explore_rate

    print(f'Analyzing model: {args.model}')
    print(f'Episodes: {args.episodes}, Correct rate: {correct_rate}, Explore rate: {explore_rate}')

    start = time.time()
    results = run_analysis(
        args.model, args.episodes, correct_rate, ascension, explore_rate
    )
    elapsed = time.time() - start
    print(f'\nAnalysis complete in {elapsed:.0f}s')

    # Save raw data
    output_path = args.output or os.path.join(output_dir, f'{timestamp}.json')

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f'Raw data saved to: {output_path}')

    # Generate report
    from tests.playtest.rl.report import generate_report
    report_path = output_path.replace('.json', '.md')
    generate_report(results, report_path)
    print(f'Report saved to: {report_path}')


if __name__ == '__main__':
    main()

"""
Rogue Brain — Balance Report Generator
=========================================
Converts raw analysis data into an actionable Markdown balance report.

Usage:
    python3 tests/playtest/rl/report.py --input data/playtests/rl-analysis/latest.json

Or called programmatically from analyze.py.
"""

import argparse
import json
import os
import sys
from datetime import datetime
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))


def generate_report(data: dict, output_path: str) -> str:
    """Generate a Markdown balance report from analysis data."""

    config = data['config']
    episodes = data['episodes']
    action_counts = data['action_counts']
    per_enemy = data['per_enemy']
    charge_quick = data['charge_vs_quick']
    chain_stats = data['chain_stats']
    correct_stats = data['correct_stats']
    hp_at_victory = data.get('hp_at_victory', [])
    hp_at_defeat = data.get('hp_at_defeat', [])
    turns_to_win = data.get('turns_to_win', [])
    turns_to_lose = data.get('turns_to_lose', [])

    n_episodes = len(episodes)
    wins = sum(1 for e in episodes if e['result'] == 'victory')
    losses = sum(1 for e in episodes if e['result'] == 'defeat')
    timeouts = sum(1 for e in episodes if e['result'] not in ('victory', 'defeat'))
    win_rate = wins / max(n_episodes, 1) * 100
    avg_reward = sum(e['reward'] for e in episodes) / max(n_episodes, 1)

    lines = []
    lines.append(f'# Rogue Brain Balance Report')
    lines.append(f'')
    lines.append(f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    lines.append(f'Model: `{config["model_path"]}`')
    lines.append(f'')
    lines.append(f'## Overview')
    lines.append(f'')
    lines.append(f'| Metric | Value |')
    lines.append(f'|--------|-------|')
    lines.append(f'| Episodes | {n_episodes} |')
    lines.append(f'| Win Rate | **{win_rate:.1f}%** ({wins}W / {losses}L / {timeouts}T) |')
    lines.append(f'| Avg Reward | {avg_reward:.2f} |')
    lines.append(f'| Correct Rate (config) | {config["correct_rate"]} |')
    lines.append(f'| Ascension | {config["ascension"]} |')

    if hp_at_victory:
        lines.append(f'| Avg HP at Victory | {sum(hp_at_victory)/len(hp_at_victory):.0f} |')
    if turns_to_win:
        lines.append(f'| Avg Steps to Win | {sum(turns_to_win)/len(turns_to_win):.1f} |')
    if turns_to_lose:
        lines.append(f'| Avg Steps to Lose | {sum(turns_to_lose)/len(turns_to_lose):.1f} |')
    lines.append(f'')

    # --- 1. Action Distribution ---
    lines.append(f'## 1. Action Distribution')
    lines.append(f'')
    # Normalise keys: action_counts may have int or string keys depending on source
    normalised_counts = {str(k): int(v) for k, v in action_counts.items()}
    total_actions = sum(normalised_counts.values()) or 1

    # Group actions
    charge_actions = sum(normalised_counts.get(str(i), 0) for i in range(8))
    quick_actions = sum(normalised_counts.get(str(i), 0) for i in range(8, 16))
    skip_actions = normalised_counts.get('16', 0)
    hint_actions = normalised_counts.get('17', 0)

    lines.append(f'| Action Type | Count | % |')
    lines.append(f'|-------------|-------|---|')
    lines.append(f'| Charge Play | {charge_actions} | {charge_actions/total_actions*100:.1f}% |')
    lines.append(f'| Quick Play | {quick_actions} | {quick_actions/total_actions*100:.1f}% |')
    lines.append(f'| Skip Turn | {skip_actions} | {skip_actions/total_actions*100:.1f}% |')
    if hint_actions > 0:
        lines.append(f'| Use Hint | {hint_actions} | {hint_actions/total_actions*100:.1f}% |')
    lines.append(f'')

    # Per-card-index distribution
    lines.append(f'### Card Index Preference')
    lines.append(f'')
    lines.append(f'| Card Index | Charge | Quick | Total | % of plays |')
    lines.append(f'|------------|--------|-------|-------|------------|')
    total_plays = charge_actions + quick_actions or 1
    for i in range(8):
        ch = normalised_counts.get(str(i), 0)
        qu = normalised_counts.get(str(i + 8), 0)
        tot = ch + qu
        if tot > 0:
            lines.append(f'| {i} | {ch} | {qu} | {tot} | {tot/total_plays*100:.1f}% |')
    lines.append(f'')

    # --- 2. Charge vs Quick Analysis ---
    lines.append(f'## 2. Charge vs Quick Play Strategy')
    lines.append(f'')
    charge_total = charge_quick.get('charge', 0)
    quick_total = charge_quick.get('quick', 0)
    play_total = charge_total + quick_total or 1
    lines.append(f'- **Charge rate**: {charge_total/play_total*100:.1f}% of card plays')
    lines.append(f'- **Quick rate**: {quick_total/play_total*100:.1f}% of card plays')
    lines.append(f'')

    if charge_total > 0:
        correct_charges = correct_stats.get('correct_charges', 0)
        wrong_charges = correct_stats.get('wrong_charges', 0)
        charge_accuracy = correct_charges / max(correct_charges + wrong_charges, 1) * 100
        lines.append(f'- **Charge accuracy**: {charge_accuracy:.0f}% ({correct_charges} correct, {wrong_charges} wrong)')
    lines.append(f'')

    # Insight
    if charge_total / play_total > 0.7:
        lines.append(f'> **INSIGHT**: Agent strongly prefers charging ({charge_total/play_total*100:.0f}%). Charge bonuses are rewarding enough to justify the extra AP cost and quiz risk.')
    elif charge_total / play_total < 0.3:
        lines.append(f'> **INSIGHT**: Agent rarely charges ({charge_total/play_total*100:.0f}%). The charge bonus may be too small to justify the +1 AP cost and answer risk.')
    else:
        lines.append(f'> **INSIGHT**: Agent has a balanced charge/quick strategy ({charge_total/play_total*100:.0f}% charge). This suggests the AP economy is well-tuned.')
    lines.append(f'')

    # --- 3. Chain Behavior ---
    lines.append(f'## 3. Knowledge Chain Behavior')
    lines.append(f'')
    chain_total = chain_stats.get('total_plays', 0) or 1
    chain_extended = chain_stats.get('extended', 0)
    chain_broken = chain_stats.get('broken', 0)
    lines.append(f'| Metric | Value |')
    lines.append(f'|--------|-------|')
    lines.append(f'| Chain Extended | {chain_extended} ({chain_extended/chain_total*100:.1f}% of plays) |')
    lines.append(f'| Chain Broken | {chain_broken} ({chain_broken/chain_total*100:.1f}% of plays) |')
    lines.append(f'| Extension Rate | {chain_extended/max(chain_extended+chain_broken,1)*100:.0f}% |')
    lines.append(f'')

    if chain_extended / max(chain_extended + chain_broken, 1) > 0.5:
        lines.append(f'> **INSIGHT**: Agent actively builds chains ({chain_extended/max(chain_extended+chain_broken,1)*100:.0f}% extension rate). Chains are strategically important.')
    else:
        lines.append(f'> **INSIGHT**: Agent breaks chains frequently. Either chain bonuses are too weak or card hand composition makes chaining difficult.')
    lines.append(f'')

    # --- 4. Per-Enemy Difficulty ---
    lines.append(f'## 4. Per-Enemy Difficulty')
    lines.append(f'')
    lines.append(f'| Enemy | Wins | Losses | Win Rate | Avg Steps | Avg Reward |')
    lines.append(f'|-------|------|--------|----------|-----------|------------|')

    # Sort by win rate (ascending = hardest first)
    sorted_enemies = sorted(
        per_enemy.items(),
        key=lambda x: x[1]['wins'] / max(x[1]['wins'] + x[1]['losses'], 1)
    )
    for enemy_name, stats in sorted_enemies:
        total = stats['wins'] + stats['losses']
        if total == 0:
            continue
        wr = stats['wins'] / total * 100
        avg_steps = stats['total_steps'] / total
        avg_rew = stats['total_reward'] / total
        indicator = ''
        if wr < 60:
            indicator = ' **HARD**'
        elif wr > 95:
            indicator = ' (trivial)'
        lines.append(f'| {enemy_name}{indicator} | {stats["wins"]} | {stats["losses"]} | {wr:.0f}% | {avg_steps:.1f} | {avg_rew:.1f} |')
    lines.append(f'')

    # Flag extremes
    hardest = [(name, s) for name, s in sorted_enemies if (s['wins'] + s['losses']) >= 3]
    if hardest:
        name, stats = hardest[0]
        total = stats['wins'] + stats['losses']
        wr = stats['wins'] / total * 100
        if wr < 50:
            lines.append(f'> **WARNING**: {name} has a {wr:.0f}% win rate — potentially overtuned.')

        name, stats = hardest[-1]
        total = stats['wins'] + stats['losses']
        wr = stats['wins'] / total * 100
        if wr > 95:
            lines.append(f'> **WARNING**: {name} has a {wr:.0f}% win rate — potentially too easy, consider buffing.')
    lines.append(f'')

    # --- 5. Death Analysis ---
    lines.append(f'## 5. Death Analysis')
    lines.append(f'')
    if losses > 0:
        defeat_enemies = [e['enemy'] for e in episodes if e['result'] == 'defeat']
        defeat_counts = defaultdict(int)
        for e in defeat_enemies:
            defeat_counts[e] += 1

        lines.append(f'Top causes of defeat:')
        lines.append(f'')
        lines.append(f'| Enemy | Deaths | % of losses |')
        lines.append(f'|-------|--------|-------------|')
        for enemy, count in sorted(defeat_counts.items(), key=lambda x: -x[1])[:10]:
            lines.append(f'| {enemy} | {count} | {count/losses*100:.0f}% |')
        lines.append(f'')

        if hp_at_defeat:
            lines.append(f'- Average HP at defeat: {sum(hp_at_defeat)/len(hp_at_defeat):.0f}')
        if turns_to_lose:
            lines.append(f'- Average steps to defeat: {sum(turns_to_lose)/len(turns_to_lose):.0f}')
            long_fights = sum(1 for t in turns_to_lose if t > 100)
            if long_fights > 0:
                lines.append(f'- {long_fights} defeats were long fights (>100 steps) — possible stuck/timeout issues')
    else:
        lines.append(f'No defeats recorded! Agent wins every game at this difficulty.')
    lines.append(f'')

    # --- 6. Efficiency Analysis ---
    lines.append(f'## 6. Combat Efficiency')
    lines.append(f'')
    if turns_to_win:
        lines.append(f'| Metric | Value |')
        lines.append(f'|--------|-------|')
        lines.append(f'| Avg steps to win | {sum(turns_to_win)/len(turns_to_win):.1f} |')
        lines.append(f'| Fastest win | {min(turns_to_win)} steps |')
        lines.append(f'| Slowest win | {max(turns_to_win)} steps |')
        lines.append(f'| Median steps | {sorted(turns_to_win)[len(turns_to_win)//2]} steps |')
        if hp_at_victory:
            lines.append(f'| Avg HP preserved | {sum(hp_at_victory)/len(hp_at_victory):.0f} |')
    lines.append(f'')

    # --- 7. Skip Turn Analysis ---
    lines.append(f'## 7. Skip Turn Behavior')
    lines.append(f'')
    skip_rate = skip_actions / total_actions * 100
    lines.append(f'- Skip rate: {skip_rate:.1f}% of all actions')
    if skip_rate > 30:
        lines.append(f'> **WARNING**: Agent skips very often ({skip_rate:.0f}%). This suggests cards are not impactful enough or AP costs are too high.')
    elif skip_rate < 5:
        lines.append(f'> **INSIGHT**: Agent rarely skips ({skip_rate:.0f}%). Cards are consistently worth playing.')
    lines.append(f'')

    # --- 8. Room Selection Strategy ---
    room_choices = data.get('room_choices', {})
    lines.append(f'## 8. Room Selection Strategy')
    lines.append(f'')
    if room_choices:
        total_room_choices = sum(room_choices.values()) or 1
        lines.append(f'| Room Type | Times Chosen | % |')
        lines.append(f'|-----------|-------------|---|')
        for room_type in ('combat', 'shop', 'rest', 'mystery', 'treasure'):
            count = room_choices.get(room_type, 0)
            lines.append(f'| {room_type} | {count} | {count/total_room_choices*100:.1f}% |')
        # any extra room types not in the standard list
        for room_type, count in sorted(room_choices.items()):
            if room_type not in ('combat', 'shop', 'rest', 'mystery', 'treasure'):
                lines.append(f'| {room_type} | {count} | {count/total_room_choices*100:.1f}% |')
        lines.append(f'')
        shop_pct = room_choices.get('shop', 0) / total_room_choices * 100
        if shop_pct < 5:
            lines.append(f'> **INSIGHT**: Shop is chosen only {shop_pct:.1f}% of the time — shop inventory or prices may not be compelling enough.')
    else:
        lines.append(f'_No room choice data recorded._')
    lines.append(f'')

    # --- 9. Deck Building Strategy ---
    cards_picked = data.get('card_rewards_picked', 0)
    cards_skipped = data.get('card_rewards_skipped', 0)
    cards_total = cards_picked + cards_skipped or 1
    lines.append(f'## 9. Deck Building Strategy')
    lines.append(f'')
    lines.append(f'| Metric | Value |')
    lines.append(f'|--------|-------|')
    lines.append(f'| Cards picked | {cards_picked} |')
    lines.append(f'| Cards skipped | {cards_skipped} |')
    lines.append(f'| Pick rate | {cards_picked/cards_total*100:.1f}% |')
    lines.append(f'')

    # --- 10. Relic Strategy ---
    relics_picked = data.get('relics_picked', 0)
    relics_skipped = data.get('relics_skipped', 0)
    lines.append(f'## 10. Relic Strategy')
    lines.append(f'')
    lines.append(f'| Metric | Value |')
    lines.append(f'|--------|-------|')
    lines.append(f'| Relics picked | {relics_picked} |')
    lines.append(f'| Relics skipped | {relics_skipped} |')
    lines.append(f'')

    # --- 11. Shop Behavior ---
    shop_purchases = data.get('shop_purchases', {})
    lines.append(f'## 11. Shop Behavior')
    lines.append(f'')
    if shop_purchases:
        lines.append(f'| Purchase Type | Count |')
        lines.append(f'|--------------|-------|')
        for purchase_type in ('relic', 'card', 'removal'):
            count = shop_purchases.get(purchase_type, 0)
            lines.append(f'| {purchase_type.capitalize()} | {count} |')
        for purchase_type, count in sorted(shop_purchases.items()):
            if purchase_type not in ('relic', 'card', 'removal'):
                lines.append(f'| {purchase_type.capitalize()} | {count} |')
    else:
        lines.append(f'_No shop purchase data recorded._')
    lines.append(f'')

    # --- 12. Rest Site Strategy ---
    rest_heal = data.get('rest_heal', 0)
    rest_upgrade = data.get('rest_upgrade', 0)
    rest_total = rest_heal + rest_upgrade or 1
    lines.append(f'## 12. Rest Site Strategy')
    lines.append(f'')
    lines.append(f'| Choice | Count | % |')
    lines.append(f'|--------|-------|---|')
    lines.append(f'| Heal | {rest_heal} | {rest_heal/rest_total*100:.1f}% |')
    lines.append(f'| Upgrade | {rest_upgrade} | {rest_upgrade/rest_total*100:.1f}% |')
    lines.append(f'')
    if rest_heal / rest_total > 0.8:
        lines.append(f'> **INSIGHT**: Heal is chosen {rest_heal/rest_total*100:.0f}% of the time at rest sites — upgrade may be undervalued or the HP gain is more critical.')
    lines.append(f'')

    # --- 13. Risk Management (Retreat vs Delve) ---
    retreat_count = data.get('retreat_count', 0)
    delve_count = data.get('delve_count', 0)
    risk_total = retreat_count + delve_count or 1
    lines.append(f'## 13. Risk Management (Retreat vs Delve)')
    lines.append(f'')
    lines.append(f'| Decision | Count | % |')
    lines.append(f'|----------|-------|---|')
    lines.append(f'| Retreat | {retreat_count} | {retreat_count/risk_total*100:.1f}% |')
    lines.append(f'| Delve | {delve_count} | {delve_count/risk_total*100:.1f}% |')
    lines.append(f'')
    if retreat_count / risk_total > 0.6:
        lines.append(f'> **INSIGHT**: Agent retreats {retreat_count/risk_total*100:.0f}% of the time — late floors may be too dangerous to continue.')
    lines.append(f'')

    # --- 14. Floor Progression ---
    floors_reached = data.get('floors_reached', [])
    lines.append(f'## 14. Floor Progression')
    lines.append(f'')
    if floors_reached:
        avg_floors = sum(floors_reached) / len(floors_reached)
        lines.append(f'| Metric | Value |')
        lines.append(f'|--------|-------|')
        lines.append(f'| Avg floors reached | {avg_floors:.1f} |')
        lines.append(f'| Max floors reached | {max(floors_reached)} |')
        lines.append(f'| Min floors reached | {min(floors_reached)} |')
    else:
        lines.append(f'_No floor progression data recorded._')
    lines.append(f'')

    # --- 16. Economy Analysis ---
    lines.append(f'## 16. Economy Analysis')
    lines.append(f'')
    economy = data.get('economy', {})
    gold_at_shop = economy.get('gold_at_shop_visits', [])
    gold_at_end = economy.get('gold_at_run_end', [])
    could_afford = economy.get('could_afford_relic', 0)
    too_poor = economy.get('too_poor_for_relic', 0)
    left_without = economy.get('shop_left_without_buying', 0)
    total_shop_visits = could_afford + too_poor

    if total_shop_visits > 0:
        lines.append(f'| Metric | Value |')
        lines.append(f'|--------|-------|')
        lines.append(f'| Total shop visits | {total_shop_visits} |')
        lines.append(f'| Avg gold at shop | {sum(gold_at_shop)/len(gold_at_shop):.0f}g |')
        lines.append(f'| Could afford relic (>=80g) | {could_afford} ({could_afford/total_shop_visits*100:.0f}%) |')
        lines.append(f'| Too poor for relic (<80g) | {too_poor} ({too_poor/total_shop_visits*100:.0f}%) |')
        lines.append(f'| Left without buying | {left_without} ({left_without/total_shop_visits*100:.0f}%) |')
        lines.append(f'')

        if too_poor / total_shop_visits > 0.6:
            lines.append(f'> **WARNING**: Players can\'t afford relics {too_poor/total_shop_visits*100:.0f}% of shop visits. Relic prices may be too high or gold income too low.')
        if left_without / total_shop_visits > 0.4:
            lines.append(f'> **WARNING**: Players leave shop empty-handed {left_without/total_shop_visits*100:.0f}% of the time. Shop inventory may not be compelling.')
    else:
        lines.append(f'_No shop visit data recorded._')
    lines.append(f'')

    if gold_at_end:
        lines.append(f'**End-of-run gold (unspent):**')
        lines.append(f'')
        lines.append(f'| Metric | Value |')
        lines.append(f'|--------|-------|')
        lines.append(f'| Avg final gold | {sum(gold_at_end)/len(gold_at_end):.0f}g |')
        lines.append(f'| Max final gold | {max(gold_at_end)}g |')
        lines.append(f'| Min final gold | {min(gold_at_end)}g |')
        lines.append(f'')

        if sum(gold_at_end)/len(gold_at_end) > 100:
            lines.append(f'> **WARNING**: Players end runs with avg {sum(gold_at_end)/len(gold_at_end):.0f}g unspent. Gold has no late-game sink — consider adding more spending opportunities or scaling shop prices down.')
    lines.append(f'')

    # --- 17. Balance Recommendations ---
    lines.append(f'## 17. Balance Recommendations')
    lines.append(f'')
    recommendations = []

    if win_rate > 95:
        recommendations.append('- **Game is too easy** at this difficulty. Consider buffing enemies or reducing player power.')
    elif win_rate < 40:
        recommendations.append('- **Game is too hard** at this difficulty. Consider nerfing enemies or buffing player cards.')

    if charge_total / play_total > 0.85:
        recommendations.append('- **Charging is dominant** — quick play is rarely chosen. Consider reducing charge bonus or increasing quick play benefits.')
    elif charge_total / play_total < 0.15:
        recommendations.append('- **Quick play is dominant** — charging is rarely worth it. Consider increasing charge bonus or reducing AP surcharge.')

    if skip_rate > 40:
        recommendations.append('- **High skip rate** — cards may be too expensive or too weak. Review AP costs.')

    hard_enemies = [(n, s) for n, s in per_enemy.items() if s['wins'] + s['losses'] >= 3 and s['wins'] / (s['wins'] + s['losses']) < 0.5]
    for name, stats in hard_enemies:
        total = stats['wins'] + stats['losses']
        wr = stats['wins'] / total * 100
        recommendations.append(f'- **{name}** is too hard ({wr:.0f}% win rate). Consider reducing HP or damage.')

    easy_enemies = [(n, s) for n, s in per_enemy.items() if s['wins'] + s['losses'] >= 5 and s['wins'] / (s['wins'] + s['losses']) > 0.98]
    for name, stats in easy_enemies:
        total = stats['wins'] + stats['losses']
        wr = stats['wins'] / total * 100
        recommendations.append(f'- **{name}** is too easy ({wr:.0f}% win rate). Consider buffing.')

    # Full-game recommendations
    shop_purchases = data.get('shop_purchases', {})
    total_shop_purchases = sum(shop_purchases.values()) if shop_purchases else 0
    if total_shop_purchases == 0:
        recommendations.append('- **Shop is never used** — prices may be too high or inventory too weak.')

    rest_heal_r = data.get('rest_heal', 0)
    rest_upgrade_r = data.get('rest_upgrade', 0)
    rest_total_r = rest_heal_r + rest_upgrade_r or 1
    if rest_upgrade_r / rest_total_r < 0.2 and rest_total_r > 1:
        recommendations.append('- **Rest upgrade is rarely chosen** — upgrade benefit may be too small relative to HP recovery.')

    retreat_count_r = data.get('retreat_count', 0)
    delve_count_r = data.get('delve_count', 0)
    risk_total_r = retreat_count_r + delve_count_r or 1
    if retreat_count_r / risk_total_r > 0.6:
        recommendations.append('- **Players retreat more than they delve** — late floors may be too dangerous to continue.')

    # Economy issues
    economy = data.get('economy', {})
    gold_at_end = economy.get('gold_at_run_end', [])
    if gold_at_end and sum(gold_at_end)/len(gold_at_end) > 100:
        recommendations.append(f'- **Gold has no late-game sink** — avg {sum(gold_at_end)/len(gold_at_end):.0f}g unspent at run end.')
    too_poor = economy.get('too_poor_for_relic', 0)
    total_sv = economy.get('could_afford_relic', 0) + too_poor
    if total_sv > 3 and too_poor / total_sv > 0.7:
        recommendations.append(f'- **Relic prices too high** — {too_poor/total_sv*100:.0f}% of shop visits, player can\'t afford a relic.')

    if not recommendations:
        recommendations.append('- No critical balance issues detected at this difficulty level.')

    for rec in recommendations:
        lines.append(rec)
    lines.append(f'')

    report = '\n'.join(lines)

    with open(output_path, 'w') as f:
        f.write(report)

    print(f'\n{report}')

    return report


def main():
    parser = argparse.ArgumentParser(description='Rogue Brain — Balance Report')
    parser.add_argument('--input', required=True, help='Path to analysis JSON file')
    parser.add_argument('--output', type=str, default=None, help='Output Markdown path')
    args = parser.parse_args()

    with open(args.input) as f:
        data = json.load(f)

    output_path = args.output or args.input.replace('.json', '.md')
    generate_report(data, output_path)


if __name__ == '__main__':
    main()

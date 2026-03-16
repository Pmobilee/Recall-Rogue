#!/usr/bin/env python3
"""
AR-51 Kanji Expansion Phase 1 — Gap Report
Cross-references JLPT kanji lists against our seed file and the kanji-info.json
reference, then prints a gap report showing which kanji are missing, how many
have rich reference data, and how many will need Sonnet generation.

Usage:
    python3 scripts/content-pipeline/vocab/expand-kanji-phase1.py
"""

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

JLPT_LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1']
JLPT_KANJI_DIR = REPO_ROOT / 'data/references/full-japanese-study-deck/results/kanjiJLPT/kanji'
KANJI_INFO_FILE = REPO_ROOT / 'data/references/full-japanese-study-deck/results/kanji-info.json'
SEED_FILE = REPO_ROOT / 'src/data/seed/kanji-ja.json'


def load_jlpt_lists() -> dict[str, list[str]]:
    """Load kanji arrays for each JLPT level."""
    result = {}
    for level in JLPT_LEVELS:
        path = JLPT_KANJI_DIR / f'kanji_{level}.json'
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        # Each file is a flat list of kanji characters
        result[level.upper()] = data
    return result


def load_seed_kanji() -> set[str]:
    """Extract the set of kanji characters already present in our seed file.
    Parses from quizQuestion: 'What does the kanji '一' mean?'
    """
    with open(SEED_FILE, encoding='utf-8') as f:
        seed = json.load(f)
    kanji_set = set()
    for entry in seed:
        q = entry.get('quizQuestion', '')
        m = re.search(r"'([^']+)'", q)
        if m:
            kanji_set.add(m.group(1))
    return kanji_set


def load_kanji_info() -> dict[str, dict]:
    """Load kanji-info.json as a dict keyed by kanji character."""
    with open(KANJI_INFO_FILE, encoding='utf-8') as f:
        data = json.load(f)
    return {entry['kanji']: entry for entry in data}


def has_rich_data(info_entry: dict) -> bool:
    """Return True if a kanji-info entry has meaningful mnemonic or word data."""
    if not info_entry:
        return False
    has_mnemonic = bool(info_entry.get('mnemonic', '').strip())
    has_words = bool(info_entry.get('words', []))
    return has_mnemonic or has_words


def extract_example_words(info_entry: dict) -> list[str]:
    """Extract up to 3 example word forms from a kanji-info entry."""
    words = info_entry.get('words', [])
    examples = []
    for w in words[:3]:
        forms = w.get('kanjiForms', [])
        readings = w.get('readings', [])
        translations = w.get('translations', [])
        kanji_form = forms[0]['kanjiForm'] if forms else ''
        reading = readings[0]['reading'] if readings else ''
        translation = translations[0]['translation'].split(',')[0] if translations else ''
        if kanji_form or reading:
            examples.append(f"{kanji_form}（{reading}）= {translation}")
    return examples


def main() -> None:
    print("AR-51 Kanji Expansion Phase 1 — Gap Report")
    print("=" * 60)

    jlpt_lists = load_jlpt_lists()
    seed_kanji = load_seed_kanji()
    kanji_info = load_kanji_info()

    print(f"\nSeed file kanji count: {len(seed_kanji)}")
    print(f"kanji-info.json entries: {len(kanji_info)}")
    print()

    total_in_jlpt = 0
    total_missing = 0
    total_has_data = 0
    total_needs_generation = 0

    level_results: dict[str, dict] = {}

    for level in JLPT_LEVELS:
        level_key = level.upper()
        jlpt_kanji = jlpt_lists[level_key]
        missing = [k for k in jlpt_kanji if k not in seed_kanji]
        has_data = [k for k in missing if k in kanji_info and has_rich_data(kanji_info[k])]
        needs_gen = [k for k in missing if k not in kanji_info or not has_rich_data(kanji_info[k])]

        level_results[level_key] = {
            'total': len(jlpt_kanji),
            'in_seed': len(jlpt_kanji) - len(missing),
            'missing': missing,
            'has_data': has_data,
            'needs_generation': needs_gen,
        }

        total_in_jlpt += len(jlpt_kanji)
        total_missing += len(missing)
        total_has_data += len(has_data)
        total_needs_generation += len(needs_gen)

        print(f"JLPT {level_key}:")
        print(f"  Total in JLPT list   : {len(jlpt_kanji)}")
        print(f"  Already in seed      : {len(jlpt_kanji) - len(missing)}")
        print(f"  MISSING from seed    : {len(missing)}")
        print(f"    → Has rich data    : {len(has_data)}")
        print(f"    → Needs Sonnet gen : {len(needs_gen)}")

        if missing:
            print(f"  Missing kanji        : {''.join(missing)}")
        print()

    print("=" * 60)
    print("TOTALS ACROSS ALL JLPT LEVELS:")
    print(f"  Total JLPT kanji     : {total_in_jlpt}")
    print(f"  Missing from seed    : {total_missing}")
    print(f"  Have rich data       : {total_has_data}")
    print(f"  Need Sonnet gen      : {total_needs_generation}")
    print()

    # Print sample data for kanji that have rich info
    print("=" * 60)
    print("SAMPLE DATA PREVIEW (first 5 missing kanji with rich data):")
    print()
    sample_count = 0
    for level_key in [l.upper() for l in JLPT_LEVELS]:
        if sample_count >= 5:
            break
        for k in level_results[level_key]['has_data']:
            if sample_count >= 5:
                break
            info = kanji_info[k]
            examples = extract_example_words(info)
            mnemonic_lines = info.get('mnemonic', '').split('\n')
            mnemonic = mnemonic_lines[0][:80] if mnemonic_lines else ''
            words = info.get('words', [])
            # Pull first translation as a meaning summary
            first_translation = ''
            if words:
                translations = words[0].get('translations', [])
                if translations:
                    first_translation = translations[0].get('translation', '').split(',')[0]
            print(f"  Kanji: {k} | Level: {level_key}")
            print(f"  Primary meaning: {first_translation or '(none)'}")
            print(f"  Mnemonic: {mnemonic or '(none)'}{'...' if len(info.get('mnemonic', '')) > 80 else ''}")
            print(f"  Examples: {'; '.join(examples[:2]) or '(none)'}")
            print()
            sample_count += 1

    # Output a machine-readable gap file for the next pipeline stage
    gap_output = REPO_ROOT / 'scripts/content-pipeline/vocab/kanji-gap-report.json'
    output_data = {
        'summary': {
            'total_jlpt': total_in_jlpt,
            'total_missing': total_missing,
            'has_rich_data': total_has_data,
            'needs_generation': total_needs_generation,
        },
        'by_level': {}
    }
    for level_key, result in level_results.items():
        output_data['by_level'][level_key] = {
            'total': result['total'],
            'in_seed': result['in_seed'],
            'missing_count': len(result['missing']),
            'has_data_count': len(result['has_data']),
            'needs_generation_count': len(result['needs_generation']),
            'missing_with_data': result['has_data'],
            'missing_needs_generation': result['needs_generation'],
        }

    with open(gap_output, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"Gap report saved to: {gap_output}")


if __name__ == '__main__':
    main()

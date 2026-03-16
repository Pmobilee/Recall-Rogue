#!/usr/bin/env python3
"""
Fix vocabulary per-level subcategories across all 7 non-Chinese languages.
Joins seed files with curated data on ID to set correct categoryL2 values.
"""

import json
import os
from collections import Counter

SEED_DIR = '/Users/damion/CODE/Recall_Rogue/src/data/seed'
CURATED_DIR = '/Users/damion/CODE/Recall_Rogue/data/curated/vocab'


def get_ja_subcategory(jlpt_level: int) -> str:
    mapping = {5: 'japanese_n5', 4: 'japanese_n4', 3: 'japanese_n3', 2: 'japanese_n2', 1: 'japanese_n1'}
    return mapping.get(jlpt_level, 'japanese_n5')


def get_cefr_subcategory(lang: str, cefr_level: str) -> str:
    level = cefr_level.lower()
    return f'{lang}_{level}'


def get_korean_subcategory(cefr_level: str) -> str:
    level = cefr_level.upper()
    if level in ('A1', 'A2'):
        return 'korean_beginner'
    elif level in ('B1', 'B2'):
        return 'korean_intermediate'
    else:  # C1, C2, etc.
        return 'korean_advanced'


def fix_language(lang: str, subcategory_fn) -> dict:
    seed_path = os.path.join(SEED_DIR, f'vocab-{lang}.json')
    curated_path = os.path.join(CURATED_DIR, lang, f'vocab-{lang}-all.json')

    with open(seed_path) as f:
        seed_facts = json.load(f)
    with open(curated_path) as f:
        curated_facts = json.load(f)

    # Build curated lookup by ID
    curated_by_id = {d['id']: d for d in curated_facts}

    before_counts = Counter(d.get('categoryL2') for d in seed_facts)
    unmatched = 0
    matched = 0

    for fact in seed_facts:
        curated = curated_by_id.get(fact['id'])
        if curated is None:
            unmatched += 1
            continue

        new_subcategory = subcategory_fn(curated)
        if new_subcategory:
            fact['categoryL2'] = new_subcategory
            # Also update the category array (index 1)
            if isinstance(fact.get('category'), list) and len(fact['category']) >= 2:
                fact['category'][1] = new_subcategory
            matched += 1
        else:
            unmatched += 1

    after_counts = Counter(d.get('categoryL2') for d in seed_facts)

    # Write back
    with open(seed_path, 'w', encoding='utf-8') as f:
        json.dump(seed_facts, f, ensure_ascii=False, indent=2)

    return {
        'lang': lang,
        'total': len(seed_facts),
        'matched': matched,
        'unmatched': unmatched,
        'before': dict(before_counts),
        'after': dict(after_counts),
    }


def main():
    results = []

    # Japanese — uses jlptLevel
    print('Processing Japanese (ja)...')
    def ja_fn(curated):
        jlpt = curated.get('jlptLevel')
        if jlpt is None:
            return None
        return get_ja_subcategory(int(jlpt))
    results.append(fix_language('ja', ja_fn))

    # European languages — uses cefrLevel
    for lang in ['es', 'fr', 'de', 'nl', 'cs']:
        print(f'Processing {lang}...')
        def make_cefr_fn(l):
            def fn(curated):
                cefr = curated.get('cefrLevel')
                if not cefr:
                    return None
                return get_cefr_subcategory(l, cefr)
            return fn
        results.append(fix_language(lang, make_cefr_fn(lang)))

    # Korean — maps CEFR to TOPIK tiers
    print('Processing Korean (ko)...')
    def ko_fn(curated):
        cefr = curated.get('cefrLevel')
        if not cefr:
            return None
        return get_korean_subcategory(cefr)
    results.append(fix_language('ko', ko_fn))

    # Print summary
    print('\n' + '='*70)
    print('SUMMARY')
    print('='*70)
    for r in results:
        lang = r['lang']
        print(f"\n[{lang}] total={r['total']}, matched={r['matched']}, unmatched={r['unmatched']}")
        print(f"  BEFORE: {r['before']}")
        print(f"  AFTER:  {dict(sorted(r['after'].items()))}")
    print('\nDone.')


if __name__ == '__main__':
    main()

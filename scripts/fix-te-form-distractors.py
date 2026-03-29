#!/usr/bin/env python3
"""
Fix te-form auxiliary facts in japanese_n3_grammar.json:
1. Add displayAsFullForm + fullFormDisplay fields for fragment answers
2. Replace all distractors with canonical te-form forms only
3. Fix cross-slot distractor contamination for non-te-form facts

Run from repo root:
  python3 scripts/fix-te-form-distractors.py
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

DECK_PATH = Path('data/decks/japanese_n3_grammar.json')
CONFUSION_PATH = Path('data/raw/japanese/grammar-n3-confusion-groups.json')

# Canonical te-form auxiliary forms (the distractor pool)
TE_FORM_CANONICAL = [
    "てある",
    "ている",
    "てしまう",
    "てくる",
    "てあげる",
    "てくれる",
    "てもらう",
    "てみる",
    "て",          # 連用中止形
    "てはいけない",
    "ていく",
    "ておく",
]

# sourceId → fullFormDisplay mapping
SOURCE_ID_TO_FULL_FORM = {
    "784":  "てある",
    "783":  "ている",
    "718":  "てしまう",
    "1400": "てしまう",
    "1127": "てくる",
    "1312": "てあげる",
    "1596": "てくれる",
    "846":  "てもらう",
    "1559": "てみる",
    "609":  "て",           # 連用中止形
    "1661": "てはいけない",
}

# For each sourceId, what IS the canonical answer?
# These are the correctAnswer values that count as "standard form" (no fragment flag needed)
STANDARD_FORMS = {
    "てある", "ている", "てしまう", "てくる", "てあげる", "てくれる",
    "てもらう", "てみる", "て", "てはいけない", "ていく", "ておく",
    # Conjugated forms that should still be standard (past-tense variants of canonical):
    # We do NOT include conjugated forms here — only the plain dictionary form
}

def get_source_id_from_fact_id(fact_id: str) -> str:
    """Extract sourceId from fact id like 'ja-gram-n3-1596-fill-0'."""
    parts = fact_id.split('-')
    # Format: ja-gram-n3-{sourceId}-fill-{n}
    return parts[3]

def build_distractor_pool_for_te(correct_answer_canonical: str) -> list[str]:
    """
    Build a list of 10 canonical te-form distractors, excluding the correct form.
    Sorted alphabetically for determinism.
    """
    pool = sorted([f for f in TE_FORM_CANONICAL if f != correct_answer_canonical])
    return pool[:10]

def main():
    with open(DECK_PATH) as f:
        deck = json.load(f)

    with open(CONFUSION_PATH) as f:
        confusion = json.load(f)

    # Build slot → set of grammar point names map from confusion groups
    # For cross-slot distractor validation
    slot_members: dict[str, set[str]] = defaultdict(set)

    # We'll use answerTypePoolId as the slot key
    # Map factId → answerTypePoolId for all deck facts
    fact_slot: dict[str, str] = {}
    for fact in deck['facts']:
        fact_slot[fact['id']] = fact['answerTypePoolId']

    # Build a map from correctAnswer → set of answerTypePoolIds that use it
    # (to detect cross-slot contamination)
    answer_to_slots: dict[str, set[str]] = defaultdict(set)
    for fact in deck['facts']:
        answer_to_slots[fact['correctAnswer']].add(fact['answerTypePoolId'])

    # Build a map from answerTypePoolId → list of correctAnswers in that slot
    slot_answers: dict[str, list[str]] = defaultdict(list)
    for fact in deck['facts']:
        answer = fact['correctAnswer']
        slot = fact['answerTypePoolId']
        if answer not in slot_answers[slot]:
            slot_answers[slot].append(answer)

    stats = {
        'te_form_total': 0,
        'display_as_full_form_set': 0,
        'full_form_display_set': 0,
        'te_distractors_replaced': 0,
        'cross_slot_distractors_fixed': 0,
        'non_te_facts_checked': 0,
    }

    for fact in deck['facts']:
        if fact.get('answerTypePoolId') != 'te_form_auxiliary':
            # Check cross-slot contamination for non-te-form facts
            stats['non_te_facts_checked'] += 1
            slot = fact['answerTypePoolId']
            correct = fact['correctAnswer']

            # Get valid distractors for this slot (same answerTypePoolId)
            valid_pool = [a for a in slot_answers[slot] if a != correct]

            # Check if any current distractor belongs to a DIFFERENT slot only
            # (i.e., the distractor answer never appears in this slot)
            new_distractors = []
            changed = False
            for d in fact.get('distractors', []):
                # If this answer text doesn't appear in the current slot at all, it's cross-slot
                d_slots = answer_to_slots.get(d, set())
                if d_slots and slot not in d_slots:
                    # Cross-slot contamination — replace with in-slot distractor
                    changed = True
                else:
                    new_distractors.append(d)

            if changed:
                # Fill up with valid in-slot answers
                existing = set(new_distractors)
                for candidate in sorted(valid_pool):
                    if candidate not in existing and len(new_distractors) < 10:
                        new_distractors.append(candidate)
                fact['distractors'] = sorted(new_distractors[:10])
                stats['cross_slot_distractors_fixed'] += 1

            continue

        # Te-form auxiliary fact
        stats['te_form_total'] += 1
        source_id = get_source_id_from_fact_id(fact['id'])
        full_form = SOURCE_ID_TO_FULL_FORM.get(source_id)

        if full_form is None:
            print(f"WARNING: No full form mapping for sourceId={source_id} (fact {fact['id']})", file=sys.stderr)
            continue

        correct = fact['correctAnswer']
        is_fragment = correct not in STANDARD_FORMS

        # Set fullFormDisplay on all te-form facts
        fact['fullFormDisplay'] = full_form
        stats['full_form_display_set'] += 1

        # Set displayAsFullForm only for fragments
        if is_fragment:
            fact['displayAsFullForm'] = True
            stats['display_as_full_form_set'] += 1
        else:
            # Remove if previously set (shouldn't be, but clean up)
            fact.pop('displayAsFullForm', None)

        # Replace distractors with canonical te-form forms only
        old_distractors = fact['distractors'][:]
        new_distractors = build_distractor_pool_for_te(full_form)
        fact['distractors'] = new_distractors
        stats['te_distractors_replaced'] += len(old_distractors)

    # Write updated deck
    with open(DECK_PATH, 'w', encoding='utf-8') as f:
        json.dump(deck, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print("=== Fix Stats ===")
    print(f"Te-form facts processed:          {stats['te_form_total']}")
    print(f"  displayAsFullForm=true set:      {stats['display_as_full_form_set']}")
    print(f"  fullFormDisplay set:             {stats['full_form_display_set']}")
    print(f"  distractor slots replaced:       {stats['te_distractors_replaced']}")
    print(f"Non-te facts checked:              {stats['non_te_facts_checked']}")
    print(f"  cross-slot distractors fixed:    {stats['cross_slot_distractors_fixed']}")
    print()
    print("=== Sample: 5 te-form facts after fix ===")
    te_facts = [f for f in deck['facts'] if f.get('answerTypePoolId') == 'te_form_auxiliary']
    for fact in te_facts[:5]:
        print(f"\nID:              {fact['id']}")
        print(f"correctAnswer:   {fact['correctAnswer']}")
        print(f"fullFormDisplay: {fact.get('fullFormDisplay', '(none)')}")
        print(f"displayAsFullForm: {fact.get('displayAsFullForm', False)}")
        print(f"distractors:     {fact['distractors']}")

if __name__ == '__main__':
    main()

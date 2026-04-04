#!/usr/bin/env python3
"""
Assembler for the JLPT N2 Grammar deck.
Reads all n2_gram_*.json batch files from data/decks/_wip/,
deduplicates facts, builds the complete deck JSON, and writes
the result to data/decks/japanese_n2_grammar.json.
"""

import json
import glob
import os
import sys
from collections import defaultdict

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
WIP_DIR = os.path.join(REPO_ROOT, "data", "decks", "_wip")
OUTPUT_PATH = os.path.join(REPO_ROOT, "data", "decks", "japanese_n2_grammar.json")

# ---------------------------------------------------------------------------
# Pool label map  (answerTypePoolId -> human-readable label)
# ---------------------------------------------------------------------------
POOL_LABELS = {
    "ability":              "Ability & Potential",
    "addition":             "Addition & Cumulation",
    "appearance_state":     "Appearance & State",
    "basis_standard":       "Basis & Standard",
    "concession_contrast":  "Concession & Contrast",
    "conditional":          "Conditional Patterns",
    "conjunction":          "Conjunctions",
    "degree_extent":        "Degree & Extent",
    "emphasis":             "Emphasis Patterns",
    "impossibility":        "Impossibility & Prohibition",
    "limitation":           "Limitation & Scope",
    "obligation":           "Obligation & Compulsion",
    "purpose":              "Purpose & Reason",
    "result_consequence":   "Result & Consequence",
    "scope_range":          "Scope & Range",
    "supposition":          "Supposition & Conjecture",
    "surprise":             "Surprise & Unexpectedness",
    "temporal":             "Temporal Patterns",
    "tendency":             "Tendency & Habit",
    "viewpoint":            "Viewpoint & Perspective",
}


def load_all_facts():
    """Load and deduplicate all facts from n2_gram_*.json batch files."""
    pattern = os.path.join(WIP_DIR, "n2_gram_*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"ERROR: No batch files found matching {pattern}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(files)} batch file(s):")
    for f in files:
        print(f"  {os.path.basename(f)}")

    facts_by_id = {}
    duplicates = 0

    for filepath in files:
        with open(filepath, encoding="utf-8") as fh:
            data = json.load(fh)

        # Batch files may be a bare list or wrapped in {"facts": [...]}
        if isinstance(data, list):
            facts = data
        elif isinstance(data, dict) and "facts" in data:
            facts = data["facts"]
        else:
            print(f"  WARNING: Unexpected structure in {filepath} — skipping")
            continue

        before = len(facts_by_id)
        for fact in facts:
            fid = fact.get("id")
            if not fid:
                print(f"  WARNING: Fact without id in {filepath} — skipping")
                continue
            if fid in facts_by_id:
                duplicates += 1
            else:
                facts_by_id[fid] = fact

        added = len(facts_by_id) - before
        print(f"  {os.path.basename(filepath)}: {len(facts)} facts ({added} new)")

    print(f"\nTotal unique facts: {len(facts_by_id)}  (duplicates removed: {duplicates})")
    return facts_by_id


def build_answer_type_pools(facts_by_id):
    """Build per-pool entries plus a grammar_all catch-all pool."""
    pool_to_ids = defaultdict(list)

    # Sort facts by id for deterministic ordering
    for fid in sorted(facts_by_id.keys()):
        fact = facts_by_id[fid]
        pool_id = fact.get("answerTypePoolId")
        if pool_id:
            pool_to_ids[pool_id].append(fid)

    all_fact_ids = sorted(facts_by_id.keys())

    pools = []

    # grammar_all pool first (matches N5 pattern)
    pools.append({
        "id": "grammar_all",
        "label": "All N2 Grammar Points",
        "answerFormat": "word",
        "factIds": all_fact_ids,
        "minimumSize": 5,
    })

    # Individual category pools, sorted alphabetically by id
    for pool_id in sorted(pool_to_ids.keys()):
        label = POOL_LABELS.get(pool_id, pool_id.replace("_", " ").title())
        pools.append({
            "id": pool_id,
            "label": label,
            "answerFormat": "word",
            "factIds": pool_to_ids[pool_id],
            "minimumSize": 5,
        })

    return pools


def build_synonym_groups(facts_by_id):
    """
    Build synonym groups for N2 grammar points that are interchangeable.
    A group is only included if at least 2 of its target answers are present
    in the fact data.
    """

    def ids_for_answers(*answers):
        """Return all fact IDs whose correctAnswer is one of the given answers."""
        result = []
        for fid in sorted(facts_by_id.keys()):
            if facts_by_id[fid].get("correctAnswer") in answers:
                result.append(fid)
        return result

    candidates = [
        {
            "id": "syn_n2_reason",
            "answers": ("ものだから", "ものですから"),
            "reason": (
                "ものだから and ものですから both express reason/cause with a nuance of "
                "personal excuse or emotional explanation. ものですから is the more formal/polite form."
            ),
        },
        {
            "id": "syn_n2_cannot_help",
            "answers": ("ないではいられない", "ずにはいられない"),
            "reason": (
                "ないではいられない and ずにはいられない both mean 'cannot help but do' or "
                "'cannot stop oneself from doing'. ずにはいられない uses the literary ず negative form."
            ),
        },
        {
            "id": "syn_n2_no_choice",
            "answers": ("しかない", "ほかない", "より仕方がない", "より他ない"),
            "reason": (
                "All four patterns mean 'there is no choice but to' / 'the only option is to'. "
                "しかない and ほかない are the most common; より仕方がない and より他ない are slightly more formal."
            ),
        },
        {
            "id": "syn_n2_merely",
            "answers": ("に過ぎない", "でしかない"),
            "reason": (
                "に過ぎない and でしかない both mean 'is merely / is nothing more than'. "
                "でしかない carries a slightly stronger nuance of insufficiency."
            ),
        },
        {
            "id": "syn_n2_regardless",
            "answers": ("にもかかわらず", "にかかわらず"),
            "reason": (
                "にもかかわらず means 'despite / in spite of' (concessive). "
                "にかかわらず means 'regardless of / irrespective of'. "
                "They overlap in meaning and are frequently confused by learners."
            ),
        },
        {
            "id": "syn_n2_through",
            "answers": ("を通じて", "を通して"),
            "reason": (
                "を通じて and を通して are largely interchangeable and both mean "
                "'through / via / by means of / throughout'. "
                "を通じて is slightly more common in written/formal contexts."
            ),
        },
        {
            "id": "syn_n2_based_on",
            "answers": ("に基づいて", "を元に"),
            "reason": (
                "に基づいて and を元に both mean 'based on'. "
                "に基づいて is more formal and common in official/legal contexts; "
                "を元に is slightly more casual."
            ),
        },
        {
            "id": "syn_n2_unbearable",
            "answers": ("てたまらない", "てならない", "てしょうがない"),
            "reason": (
                "てたまらない, てならない, and てしょうがない all express an overwhelming "
                "feeling — 'extremely / unbearably / can't help but feel'. "
                "てならない is slightly more formal; てしょうがない is colloquial."
            ),
        },
    ]

    groups = []
    for cand in candidates:
        fact_ids = ids_for_answers(*cand["answers"])
        if len(fact_ids) >= 2:
            groups.append({
                "id": cand["id"],
                "factIds": fact_ids,
                "reason": cand["reason"],
            })
        else:
            present = [a for a in cand["answers"] if any(
                f.get("correctAnswer") == a for f in facts_by_id.values()
            )]
            print(
                f"  SKIPPED synonym group '{cand['id']}' — "
                f"only {len(present)}/{len(cand['answers'])} answers present in data "
                f"({present if present else 'none'})"
            )

    return groups


def build_difficulty_tiers(facts_by_id):
    """Sort facts into easy/medium/hard tiers based on the difficulty field."""
    easy_ids = []
    medium_ids = []
    hard_ids = []

    for fid in sorted(facts_by_id.keys()):
        diff = facts_by_id[fid].get("difficulty", 3)
        if diff in (1, 2):
            easy_ids.append(fid)
        elif diff == 3:
            medium_ids.append(fid)
        else:  # 4 or 5
            hard_ids.append(fid)

    return [
        {"tier": "easy",   "factIds": easy_ids},
        {"tier": "medium", "factIds": medium_ids},
        {"tier": "hard",   "factIds": hard_ids},
    ]


def assemble_deck(facts_by_id):
    """Assemble the complete deck JSON object."""
    sorted_facts = [facts_by_id[fid] for fid in sorted(facts_by_id.keys())]
    fact_count = len(sorted_facts)

    print("\nBuilding answer type pools...")
    answer_type_pools = build_answer_type_pools(facts_by_id)
    print(f"  {len(answer_type_pools)} pools ({len(answer_type_pools) - 1} category pools + grammar_all)")

    print("\nBuilding synonym groups...")
    synonym_groups = build_synonym_groups(facts_by_id)
    print(f"  {len(synonym_groups)} synonym groups built")

    print("\nBuilding difficulty tiers...")
    difficulty_tiers = build_difficulty_tiers(facts_by_id)
    for tier in difficulty_tiers:
        print(f"  {tier['tier']}: {len(tier['factIds'])} facts")

    deck = {
        "id": "japanese_n2_grammar",
        "name": "Japanese N2 Grammar",
        "domain": "vocabulary",
        "subDomain": "japanese_grammar",
        "description": (
            "Master the ~200 advanced Japanese grammar patterns tested at JLPT N2 — "
            "covering conjunctions, conditionals, concessive expressions, temporal patterns, "
            "emphasis, supposition, degree, and more. Fill in the blank to prove you know "
            "which grammar point fits each sentence."
        ),
        "minimumFacts": 400,
        "targetFacts": fact_count,
        "facts": sorted_facts,
        "answerTypePools": answer_type_pools,
        "synonymGroups": synonym_groups,
        "questionTemplates": [
            {
                "id": "fill_blank_grammar",
                "answerPoolId": "grammar_all",
                "questionFormat": "{quizQuestion}",
                "availableFromMastery": 0,
                "difficulty": 3,
                "reverseCapable": False,
            }
        ],
        "difficultyTiers": difficulty_tiers,
    }

    return deck


def main():
    print("=" * 60)
    print("N2 Grammar Deck Assembler")
    print("=" * 60)
    print()

    facts_by_id = load_all_facts()

    print()
    deck = assemble_deck(facts_by_id)

    print(f"\nWriting output to: {OUTPUT_PATH}")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(deck, fh, ensure_ascii=False, indent=2)

    # ---------------------------------------------------------------------------
    # Summary stats
    # ---------------------------------------------------------------------------
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Deck ID            : {deck['id']}")
    print(f"  Total facts        : {deck['targetFacts']}")
    print(f"  Answer type pools  : {len(deck['answerTypePools'])} "
          f"({len(deck['answerTypePools']) - 1} category + grammar_all)")
    print(f"  Synonym groups     : {len(deck['synonymGroups'])}")
    print(f"  Question templates : {len(deck['questionTemplates'])}")
    print()

    # Pool breakdown
    print("  Pool breakdown:")
    for pool in deck["answerTypePools"]:
        print(f"    {pool['id']:<28} {len(pool['factIds']):>4} facts")

    # Difficulty distribution
    print()
    print("  Difficulty tier distribution:")
    for tier in deck["difficultyTiers"]:
        pct = len(tier["factIds"]) / deck["targetFacts"] * 100
        print(f"    {tier['tier']:<8} {len(tier['factIds']):>4} facts ({pct:.1f}%)")

    # Synonym groups
    print()
    print("  Synonym groups:")
    for sg in deck["synonymGroups"]:
        print(f"    {sg['id']:<35} {len(sg['factIds']):>4} facts")

    output_size = os.path.getsize(OUTPUT_PATH) / 1024
    print()
    print(f"  Output file size   : {output_size:.1f} KB")
    print()
    print("Done.")


if __name__ == "__main__":
    main()

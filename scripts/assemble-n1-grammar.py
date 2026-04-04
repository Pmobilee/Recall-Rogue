#!/usr/bin/env python3
"""
Assembles the JLPT N1 Grammar deck from generated batch files in data/decks/_wip/.

Reads all n1_gram_*.json files, deduplicates facts by id, builds the complete
deck JSON, and writes to data/decks/japanese_n1_grammar.json.
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
OUTPUT_PATH = os.path.join(REPO_ROOT, "data", "decks", "japanese_n1_grammar.json")

# ---------------------------------------------------------------------------
# Pool label map  (answerTypePoolId -> human-readable label)
# ---------------------------------------------------------------------------
POOL_LABELS = {
    "appearance":          "Appearance & Resemblance",
    "cause_reason":        "Cause & Reason",
    "concession_contrast": "Concession & Contrast",
    "conditional":         "Conditional & Hypothetical",
    "degree_extent":       "Degree & Extent",
    "emphasis":            "Emphasis & Strong Assertion",
    "formal_written":      "Formal & Written Expressions",
    "judgment":            "Judgment & Evaluation",
    "method_means":        "Method & Means",
    "obligation_emotion":  "Obligation & Emotion",
    "opinions_stance":     "Opinions & Stance",
    "probability":         "Probability & Possibility",
    "purpose":             "Purpose & Intention",
    "result_outcome":      "Result & Outcome",
    "scope_selection":     "Scope & Selection",
    "temporal":            "Temporal & Sequential",
    "unexpected":          "Unexpected & Contrary",
}


def load_all_facts():
    """Load and deduplicate all facts from n1_gram_*.json batch files."""
    pattern = os.path.join(WIP_DIR, "n1_gram_*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"ERROR: No batch files found matching {pattern}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(files)} batch file(s):")
    facts_by_id = {}       # id -> fact
    seen_fingerprints = set()  # (quizQuestion, correctAnswer) -> deduplicate across batches
    id_dupes = 0
    content_dupes = 0

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
            # Deduplicate by id first
            if fid in facts_by_id:
                id_dupes += 1
                continue
            # Deduplicate by (quizQuestion, correctAnswer) fingerprint
            # to catch facts regenerated with different ids but identical content
            fingerprint = (fact.get("quizQuestion", ""), fact.get("correctAnswer", ""))
            if fingerprint in seen_fingerprints:
                content_dupes += 1
                continue
            seen_fingerprints.add(fingerprint)
            facts_by_id[fid] = fact

        added = len(facts_by_id) - before
        print(f"  {os.path.basename(filepath)}: {len(facts)} facts ({added} new)")

    total_dupes = id_dupes + content_dupes
    print(f"\nTotal unique facts: {len(facts_by_id)}  "
          f"(removed: {id_dupes} id-dupes, {content_dupes} content-dupes)")
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

    # grammar_all pool first (questionTemplate references this pool id)
    pools.append({
        "id": "grammar_all",
        "label": "All N1 Grammar Points",
        "answerFormat": "word",
        "factIds": all_fact_ids,
    })

    # Individual category pools, sorted alphabetically by id
    for pool_id in sorted(pool_to_ids.keys()):
        label = POOL_LABELS.get(pool_id, pool_id.replace("_", " ").title())
        pools.append({
            "id": pool_id,
            "label": label,
            "answerFormat": "word",
            "factIds": pool_to_ids[pool_id],
        })

    return pools


def build_synonym_groups(facts_by_id):
    """
    Build synonym groups for N1 grammar points that are interchangeable.
    A group is only included if at least 2 of its target answers/ids are present
    in the fact data.
    """

    def ids_for_answers(*answers):
        """Return all fact IDs whose correctAnswer is one of the given answers."""
        target = set(answers)
        return [fid for fid in sorted(facts_by_id.keys())
                if facts_by_id[fid].get("correctAnswer") in target]

    def ids_for_id_fragments(*fragments):
        """Return all fact IDs that contain any of the given substrings."""
        return [fid for fid in sorted(facts_by_id.keys())
                if any(fragment in fid for fragment in fragments)]

    candidates = [
        # Cannot help doing — compulsion/irresistible urge
        # ないではいられない may not yet be generated; included if present
        {
            "id": "syn_n1_cannot_help",
            "answers": ("ずにはいられない", "ないではいられない"),
        },
        # As soon as / no sooner than
        {
            "id": "syn_n1_as_soon_as",
            "answers": ("が早いか", "や否や", "なり"),
        },
        # Regardless of — formal いかん family
        # いかんによらず and いかんをとわず included if generated
        {
            "id": "syn_n1_regardless",
            "answers": ("いかんにかかわらず", "いかんによらず", "いかんをとわず"),
        },
        # Forced / compelled — を余儀なく (active vs passive vs past forms)
        {
            "id": "syn_n1_forced",
            "answers": ("を余儀なくされる", "を余儀なくさせる", "を余儀なくされた"),
        },
        # Cannot get away without doing (social obligation)
        {
            "id": "syn_n1_must",
            "answers": ("ないではすまない", "ずにはすまない"),
        },
        # Will definitely / inevitably cause or do
        {
            "id": "syn_n1_will_definitely",
            "answers": ("ないではおかない", "ずにはおかない"),
        },
        # Literary "like / as if" — different inflected forms of ごとし
        {
            "id": "syn_n1_like_literary",
            "answers": ("ごとき", "ごとく", "ごとし", "かのごとく"),
        },
        # While doing / on the occasion of — concurrent action patterns with similar meaning
        {
            "id": "syn_n1_while",
            "answers": ("がてら", "かたがた", "かたわら"),
        },
        # Whether or not / regardless of whether — (よ)うが～まいが and variants
        # These facts have full-sentence answers so match by id fragment
        {
            "id": "syn_n1_whether",
            "id_fragments": ("youga-maiga", "youga-youga", "youto-maito"),
        },
        # Fail to do / miss the opportunity — そびれる, 損なう, 損ねる
        {
            "id": "syn_n1_fail",
            "answers": ("そびれる", "損なう", "損ねる"),
        },
    ]

    groups = []
    for cand in candidates:
        if "id_fragments" in cand:
            fact_ids = ids_for_id_fragments(*cand["id_fragments"])
            lookup_desc = f"id fragments {cand['id_fragments']}"
        else:
            fact_ids = ids_for_answers(*cand["answers"])
            lookup_desc = f"answers {cand['answers']}"

        if len(fact_ids) >= 2:
            groups.append({
                "id": cand["id"],
                "factIds": fact_ids,
            })
            print(f"  {cand['id']}: {len(fact_ids)} facts")
        else:
            print(f"  SKIPPED {cand['id']} — only {len(fact_ids)} fact(s) found for {lookup_desc}")

    return groups


def build_difficulty_tiers(facts_by_id):
    """Sort facts into easy (1-2), medium (3-4), hard (5) tiers."""
    easy_ids = []
    medium_ids = []
    hard_ids = []

    for fid in sorted(facts_by_id.keys()):
        diff = facts_by_id[fid].get("difficulty", 3)
        if diff <= 2:
            easy_ids.append(fid)
        elif diff <= 4:
            medium_ids.append(fid)
        else:
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
    print(f"  {len(answer_type_pools)} pools "
          f"({len(answer_type_pools) - 1} category pools + grammar_all)")

    print("\nBuilding synonym groups...")
    synonym_groups = build_synonym_groups(facts_by_id)
    print(f"  {len(synonym_groups)} synonym groups built")

    print("\nBuilding difficulty tiers...")
    difficulty_tiers = build_difficulty_tiers(facts_by_id)
    for tier in difficulty_tiers:
        print(f"  {tier['tier']}: {len(tier['factIds'])} facts")

    deck = {
        "id": "japanese_n1_grammar",
        "name": "Japanese N1 Grammar",
        "domain": "vocabulary",
        "subDomain": "japanese_grammar",
        "description": (
            "Master the ~200 advanced Japanese grammar patterns tested at JLPT N1 — "
            "covering concession and contrast, formal written register, literary expressions, "
            "complex conditionals, emphasis, temporal sequences, and nuanced stance markers. "
            "Fill in the blank to prove you can deploy each pattern precisely in context."
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
                "difficulty": 4,
                "reverseCapable": False,
            }
        ],
        "difficultyTiers": difficulty_tiers,
    }

    return deck


def main():
    print("=" * 60)
    print("N1 Grammar Deck Assembler")
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
        print(f"    {pool['id']:<30} {len(pool['factIds']):>4} facts")

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

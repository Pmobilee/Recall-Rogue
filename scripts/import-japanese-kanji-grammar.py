#!/usr/bin/env python3
"""
import-japanese-kanji-grammar.py

Normalizes raw Japanese kanji and grammar fact files into Recall Rogue seed format.

Reads:  data/raw/japanese/kanji-n{1-5}.json
        data/raw/japanese/grammar-n{1-5}.json
        data/raw/japanese/grammar-additional.json

Writes: src/data/seed/kanji-ja.json
        src/data/seed/grammar-ja.json
"""

import json
import os
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent
RAW_DIR   = REPO_ROOT / "data" / "raw" / "japanese"
SEED_DIR  = REPO_ROOT / "src" / "data" / "seed"

PROCESSED_AT = "2026-03-16T00:00:00.000Z"

# Level order for sorting (lower index = lower level number = easier)
LEVEL_ORDER = {"japanese_n5": 0, "japanese_n4": 1, "japanese_n3": 2, "japanese_n2": 3, "japanese_n1": 4}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json_list(path: Path) -> list:
    """Load a JSON file that is either a list or has a top-level list key."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    for key in ("facts", "items", "data"):
        if key in data and isinstance(data[key], list):
            return data[key]
    # Fallback: return values if it's a dict of objects
    return list(data.values())


def normalize_kanji_fact(fact: dict, level: str) -> dict:
    """Normalize a single kanji fact to the canonical seed schema."""
    category_tag = f"japanese_{level}"  # e.g. "japanese_n5"

    # Fix category fields
    fact["categoryL1"] = "language"
    fact["categoryL2"] = category_tag
    fact["category"]   = ["language", category_tag]

    # Type and language
    fact["type"]     = "vocabulary"
    fact["language"] = "ja"

    # Haiku processing markers
    fact["_haikuProcessed"]   = True
    fact["_haikuProcessedAt"] = PROCESSED_AT

    # Ensure distractors is a list
    if not isinstance(fact.get("distractors"), list):
        fact["distractors"] = []

    # Defaults for missing fields
    if not fact.get("contentVolatility"):
        fact["contentVolatility"] = "timeless"
    if not fact.get("sourceName"):
        fact["sourceName"] = "JLPT Kanji"

    # Ensure id follows ja-kanji-nX-NNN pattern (they already do, but validate)
    assert "-kanji-" in fact.get("id", ""), f"Kanji ID missing '-kanji-': {fact.get('id')}"

    return fact


def normalize_grammar_fact(fact: dict, level: str) -> dict:
    """Normalize a single grammar fact to the canonical seed schema."""
    category_tag = f"japanese_{level}"  # e.g. "japanese_n5"

    # Fix category fields
    fact["categoryL1"] = "language"
    fact["categoryL2"] = category_tag
    fact["category"]   = ["language", category_tag]

    # Type and language
    fact["type"]     = "vocabulary"
    fact["language"] = "ja"

    # Haiku processing markers
    fact["_haikuProcessed"]   = True
    fact["_haikuProcessedAt"] = PROCESSED_AT

    # Ensure distractors is a list
    if not isinstance(fact.get("distractors"), list):
        fact["distractors"] = []

    # Defaults for missing fields
    if not fact.get("contentVolatility"):
        fact["contentVolatility"] = "timeless"

    # Fix ID to contain '-grammar-' if needed
    fact_id = fact.get("id", "")
    if "-grammar-" not in fact_id:
        # Replace 'additional' or other segment with 'grammar-nX'
        # e.g. ja-grammar-additional-001 -> id already has 'grammar' in it
        # If truly missing, construct a new one
        print(f"  WARNING: grammar ID missing '-grammar-': {fact_id!r} — keeping as-is")

    return fact


def sort_key(fact: dict) -> tuple:
    """Sort by level order, then by ID string."""
    level_idx = LEVEL_ORDER.get(fact.get("categoryL2", ""), 99)
    return (level_idx, fact.get("id", ""))


# ---------------------------------------------------------------------------
# Process kanji files
# ---------------------------------------------------------------------------

print("=" * 60)
print("Processing KANJI facts")
print("=" * 60)

kanji_levels = ["n5", "n4", "n3", "n2", "n1"]
kanji_facts  = []
kanji_counts = {}

for lvl in kanji_levels:
    src_path = RAW_DIR / f"kanji-{lvl}.json"
    raw      = load_json_list(src_path)
    level_tag = lvl  # "n5" → used as "japanese_n5" inside normalizer

    normalized = [normalize_kanji_fact(dict(f), level_tag) for f in raw]
    kanji_counts[f"japanese_{lvl}"] = len(normalized)
    kanji_facts.extend(normalized)
    print(f"  kanji-{lvl}: {len(normalized):4d} facts  →  categoryL2=japanese_{lvl}")

# Sort: N5 first … N1 last, then by ID
kanji_facts.sort(key=sort_key)

out_kanji = SEED_DIR / "kanji-ja.json"
with open(out_kanji, "w", encoding="utf-8") as f:
    json.dump(kanji_facts, f, ensure_ascii=False, indent=2)

print(f"\n  → Wrote {len(kanji_facts)} kanji facts to {out_kanji.relative_to(REPO_ROOT)}")

# ---------------------------------------------------------------------------
# Process grammar files
# ---------------------------------------------------------------------------

print()
print("=" * 60)
print("Processing GRAMMAR facts")
print("=" * 60)

grammar_sources = [
    ("n5",         "grammar-n5.json"),
    ("n4",         "grammar-n4.json"),
    ("n3",         "grammar-n3.json"),
    ("n2",         "grammar-n2.json"),
    ("n1",         "grammar-n1.json"),
    ("n3",         "grammar-additional.json"),   # additional → N3 (intermediate)
]

grammar_facts  = []
grammar_counts = {}   # key: "japanese_nX", counts both regular + additional

for lvl, filename in grammar_sources:
    src_path = RAW_DIR / filename
    raw      = load_json_list(src_path)

    normalized = [normalize_grammar_fact(dict(f), lvl) for f in raw]

    label = f"japanese_{lvl}"
    grammar_counts[label] = grammar_counts.get(label, 0) + len(normalized)
    grammar_facts.extend(normalized)

    extra = " (grammar-additional → japanese_n3)" if filename == "grammar-additional.json" else ""
    print(f"  {filename}: {len(normalized):4d} facts  →  categoryL2=japanese_{lvl}{extra}")

# Sort: N5 first … N1 last, then by ID
grammar_facts.sort(key=sort_key)

out_grammar = SEED_DIR / "grammar-ja.json"
with open(out_grammar, "w", encoding="utf-8") as f:
    json.dump(grammar_facts, f, ensure_ascii=False, indent=2)

print(f"\n  → Wrote {len(grammar_facts)} grammar facts to {out_grammar.relative_to(REPO_ROOT)}")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

print()
print("=" * 60)
print("SUMMARY")
print("=" * 60)
print()
print("Kanji facts by level:")
for lvl in kanji_levels:
    tag = f"japanese_{lvl}"
    print(f"  {tag:15s}  {kanji_counts.get(tag, 0):5d}")
print(f"  {'TOTAL':15s}  {len(kanji_facts):5d}")

print()
print("Grammar facts by level:")
for lvl in kanji_levels:
    tag = f"japanese_{lvl}"
    print(f"  {tag:15s}  {grammar_counts.get(tag, 0):5d}")
print(f"  {'TOTAL':15s}  {len(grammar_facts):5d}")

print()
print("Grand total (kanji + grammar):", len(kanji_facts) + len(grammar_facts))

# ---------------------------------------------------------------------------
# Rebuild facts DB
# ---------------------------------------------------------------------------

print()
print("=" * 60)
print("Rebuilding facts.db")
print("=" * 60)

result = subprocess.run(
    ["node", "scripts/build-facts-db.mjs"],
    cwd=str(REPO_ROOT),
    capture_output=True,
    text=True,
)

print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:2000])

if result.returncode != 0:
    print(f"\nERROR: build-facts-db.mjs exited with code {result.returncode}")
    sys.exit(1)
else:
    print("facts.db rebuild complete.")

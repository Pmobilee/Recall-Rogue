#!/usr/bin/env python3
"""expand-grammar-variants.py — Generate recall + fill-blank variants for Japanese grammar facts.

For each existing "meaning" fact in grammar-ja.json, generates up to 2 additional facts:

  1. Recall variant  (ID: <orig>-meaning → recall uses <orig>-recall)
     "Which Japanese grammar pattern means '<meaning>'?" → answer is the grammar pattern

  2. Fill-blank variant  (ID: <orig>-fill, only when pattern found in example sentence)
     Blanks the first occurrence of the cleaned pattern in the Japanese example sentence.

Distractor strategy — NO LLMs, pool-based per JLPT level:
  - Recall  distractors: 7 random *patterns* from the same level (excluding self)
  - Fill    distractors: 7 random *cleaned patterns* from the same level (excluding self)

Original facts get their IDs renamed to <orig>-meaning.
Output is sorted: N5 → N4 → N3 → N2 → N1, within each level meaning → recall → fill.
"""

from __future__ import annotations

import json
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3]
GRAMMAR_FILE = REPO_ROOT / "src" / "data" / "seed" / "grammar-ja.json"

# JLPT level order for output sorting
LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"]

# Number of distractors to include per variant
DISTRACTOR_COUNT = 7

# Seed for reproducible randomness
RANDOM_SEED = 42


# ---------------------------------------------------------------------------
# Pattern extraction helpers
# ---------------------------------------------------------------------------

def extract_pattern_from_question(question: str) -> str | None:
    """Extract grammar pattern from question text between single quotes.

    e.g. "What does the grammar pattern '〜が' mean?" → "〜が"
    """
    m = re.search(r"'([^']+)'", question)
    return m.group(1) if m else None


def clean_pattern(pattern: str) -> str:
    """Remove leading 〜 wave-dash prefix and strip whitespace.

    e.g. "〜が" → "が",  "〜（で）すら" → "（で）すら"
    Some patterns have no 〜 prefix (e.g. "前に", "いくら (幾等)") — returned as-is.
    """
    return pattern.lstrip("〜").strip()


def extract_japanese_sentence(example: str) -> str:
    """Extract the Japanese portion of an example sentence.

    Convention: Japanese text, then a space + opening paren containing English.
    We split on the first " (" or "（" that appears to start a translation.
    If no translation found, returns the full string stripped.
    """
    # Split on first " (" — English translations usually start with a space+paren
    parts = re.split(r"\s+\(", example, maxsplit=1)
    return parts[0].strip()


def find_pattern_in_sentence(cleaned_pattern: str, japanese_sentence: str) -> int | None:
    """Return the index of the first occurrence of cleaned_pattern in japanese_sentence,
    or None if not found.

    Handles a few normalisation edge cases:
    - Pattern has parenthetical variants like "ごとき, ごとく, ごとし" → try each comma-split part
    - Pattern has ASCII parentheses with variants like "いくら (幾等)" → try each
    """
    if not cleaned_pattern:
        return None

    candidates = [cleaned_pattern]

    # If pattern contains ", " try each variant individually (e.g. "ごとき, ごとく, ごとし")
    if ", " in cleaned_pattern:
        candidates += [p.strip() for p in cleaned_pattern.split(",")]

    # If pattern contains " (" try the part before the paren (e.g. "いくら (幾等)" → "いくら")
    if " (" in cleaned_pattern:
        candidates.append(cleaned_pattern.split(" (")[0].strip())
        # Also try just the kanji inside parens (e.g. "幾等")
        m = re.search(r"\(([^)]+)\)", cleaned_pattern)
        if m:
            candidates.append(m.group(1).strip())

    # If pattern contains Japanese parens 「（...）」 try stripping them
    if "（" in cleaned_pattern:
        candidates.append(re.sub(r"（[^）]*）", "", cleaned_pattern).strip())
        m = re.search(r"（([^）]+)）", cleaned_pattern)
        if m:
            candidates.append(m.group(1).strip())

    for cand in candidates:
        if cand and cand in japanese_sentence:
            idx = japanese_sentence.index(cand)
            return idx

    return None


# ---------------------------------------------------------------------------
# Build distractor pools per JLPT level
# ---------------------------------------------------------------------------

def build_pools(facts: list[dict]) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """Return (pattern_pool, meaning_pool) keyed by JLPT level.

    pattern_pool[level] = list of all raw patterns (with 〜) from that level
    meaning_pool[level] = list of all correctAnswer strings from that level
    """
    pattern_pool: dict[str, list[str]] = defaultdict(list)
    meaning_pool: dict[str, list[str]] = defaultdict(list)

    for fact in facts:
        level = fact.get("jlptLevel", "UNKNOWN")
        q = fact.get("quizQuestion", "")
        pattern = extract_pattern_from_question(q)
        meaning = fact.get("correctAnswer", "")

        if pattern:
            pattern_pool[level].append(pattern)
        if meaning:
            meaning_pool[level].append(meaning)

    return dict(pattern_pool), dict(meaning_pool)


def pick_distractors(pool: list[str], exclude: str, rng: random.Random, n: int = DISTRACTOR_COUNT) -> list[str]:
    """Pick n unique distractors from pool, excluding the value equal to exclude."""
    candidates = [v for v in pool if v != exclude]
    # Deduplicate while preserving order for determinism
    seen: set[str] = set()
    unique: list[str] = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    rng.shuffle(unique)
    return unique[:n]


# ---------------------------------------------------------------------------
# Variant generators
# ---------------------------------------------------------------------------

def make_recall_variant(orig: dict, pattern_pool: dict[str, list[str]], rng: random.Random) -> dict:
    """Generate a recall variant: 'Which pattern means X?' → answer is the pattern."""
    level = orig.get("jlptLevel", "UNKNOWN")
    meaning = orig["correctAnswer"]
    pattern = extract_pattern_from_question(orig.get("quizQuestion", "")) or orig.get("pronunciation", "")

    distractors = pick_distractors(pattern_pool.get(level, []), pattern, rng)

    return {
        **{k: v for k, v in orig.items() if k not in ("id", "quizQuestion", "correctAnswer", "distractors", "statement")},
        "id": orig["id"].replace("-meaning", "") + "-recall",
        "statement": f"The pattern {pattern} means '{meaning}'",
        "quizQuestion": f"Which Japanese grammar pattern means '{meaning}'?",
        "correctAnswer": pattern,
        "distractors": distractors,
    }


def make_fill_variant(orig: dict, pattern_pool: dict[str, list[str]], rng: random.Random) -> dict | None:
    """Generate a fill-blank variant. Returns None if pattern not found in example sentence."""
    level = orig.get("jlptLevel", "UNKNOWN")
    example = orig.get("exampleSentence", "")
    if not example:
        return None

    pattern = extract_pattern_from_question(orig.get("quizQuestion", "")) or orig.get("pronunciation", "")
    if not pattern:
        return None

    cleaned = clean_pattern(pattern)
    if not cleaned:
        return None

    ja_sentence = extract_japanese_sentence(example)
    idx = find_pattern_in_sentence(cleaned, ja_sentence)
    if idx is None:
        return None

    # Determine which actual candidate was found (may differ from cleaned due to variant matching)
    # Re-run to get exact matched string
    matched_str = cleaned
    candidates = [cleaned]
    if ", " in cleaned:
        candidates += [p.strip() for p in cleaned.split(",")]
    if " (" in cleaned:
        candidates.append(cleaned.split(" (")[0].strip())
        m = re.search(r"\(([^)]+)\)", cleaned)
        if m:
            candidates.append(m.group(1).strip())
    if "（" in cleaned:
        candidates.append(re.sub(r"（[^）]*）", "", cleaned).strip())
        m2 = re.search(r"（([^）]+)）", cleaned)
        if m2:
            candidates.append(m2.group(1).strip())

    for cand in candidates:
        if cand and cand in ja_sentence:
            matched_str = cand
            break

    # Build blanked sentence: replace first occurrence of matched_str
    blanked_ja = ja_sentence.replace(matched_str, "___", 1)

    # Reconstruct the full example with English part if present
    if " (" in example or "（" in example:
        # Re-attach English translation
        remainder = example[len(ja_sentence):].strip()
        blanked_example = f"{blanked_ja} {remainder}".strip()
    else:
        blanked_example = blanked_ja

    # Distractors: cleaned patterns from same level, excluding our answer
    cleaned_pool = [clean_pattern(p) for p in pattern_pool.get(level, [])]
    distractors = pick_distractors(cleaned_pool, matched_str, rng)

    return {
        **{k: v for k, v in orig.items() if k not in ("id", "quizQuestion", "correctAnswer", "distractors", "statement")},
        "id": orig["id"].replace("-meaning", "") + "-fill",
        "statement": "Fill in the blank with the correct grammar pattern",
        "quizQuestion": blanked_example,
        "correctAnswer": matched_str,
        "distractors": distractors,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    rng = random.Random(RANDOM_SEED)

    print(f"Reading {GRAMMAR_FILE} ...")
    with open(GRAMMAR_FILE, encoding="utf-8") as f:
        facts: list[dict] = json.load(f)

    print(f"  Loaded {len(facts)} facts")

    # Validate: none should already have variant suffixes
    already_suffixed = [d["id"] for d in facts if any(d["id"].endswith(s) for s in ["-meaning", "-recall", "-fill"])]
    if already_suffixed:
        print(f"WARNING: {len(already_suffixed)} facts already have variant suffixes — they will be re-processed.")
        # Strip suffixes from existing facts so we don't double-suffix
        for d in facts:
            for suffix in ["-meaning", "-recall", "-fill"]:
                if d["id"].endswith(suffix):
                    d["id"] = d["id"][: -len(suffix)]

    # Build distractor pools from originals
    print("Building distractor pools per JLPT level ...")
    pattern_pool, meaning_pool = build_pools(facts)
    for level in LEVEL_ORDER:
        pp = len(set(pattern_pool.get(level, [])))
        mp = len(set(meaning_pool.get(level, [])))
        print(f"  {level}: {pp} unique patterns, {mp} unique meanings")

    # Counters
    counts: dict[str, dict[str, int]] = {lvl: {"meaning": 0, "recall": 0, "fill": 0} for lvl in LEVEL_ORDER}
    counts["UNKNOWN"] = {"meaning": 0, "recall": 0, "fill": 0}

    # Build output: group by level then by variant type
    output_by_level: dict[str, dict[str, list[dict]]] = {
        lvl: {"meaning": [], "recall": [], "fill": []} for lvl in LEVEL_ORDER
    }

    print("Generating variants ...")
    for orig in facts:
        level = orig.get("jlptLevel", "UNKNOWN")
        if level not in output_by_level:
            output_by_level[level] = {"meaning": [], "recall": [], "fill": []}
            if level not in counts:
                counts[level] = {"meaning": 0, "recall": 0, "fill": 0}

        # Rename original to -meaning
        meaning_fact = dict(orig)
        base_id = orig["id"]
        # Strip any existing suffix before appending -meaning
        for suf in ["-meaning", "-recall", "-fill"]:
            if base_id.endswith(suf):
                base_id = base_id[: -len(suf)]
        meaning_fact["id"] = base_id + "-meaning"
        output_by_level[level]["meaning"].append(meaning_fact)
        counts[level]["meaning"] += 1

        # Recall variant
        recall = make_recall_variant(meaning_fact, pattern_pool, rng)
        output_by_level[level]["recall"].append(recall)
        counts[level]["recall"] += 1

        # Fill-blank variant (optional)
        fill = make_fill_variant(meaning_fact, pattern_pool, rng)
        if fill is not None:
            output_by_level[level]["fill"].append(fill)
            counts[level]["fill"] += 1

    # Assemble sorted output
    output: list[dict] = []
    for level in LEVEL_ORDER:
        group = output_by_level.get(level, {"meaning": [], "recall": [], "fill": []})
        output.extend(group["meaning"])
        output.extend(group["recall"])
        output.extend(group["fill"])

    # Write back
    print(f"\nWriting {len(output)} facts back to {GRAMMAR_FILE} ...")
    with open(GRAMMAR_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print("  Done.")

    # Summary
    print("\n=== Summary ===")
    print(f"{'Level':<8} {'Meaning':>8} {'Recall':>8} {'Fill':>8} {'Total':>8}")
    print("-" * 44)
    grand = {"meaning": 0, "recall": 0, "fill": 0}
    for level in LEVEL_ORDER:
        c = counts[level]
        total = c["meaning"] + c["recall"] + c["fill"]
        print(f"{level:<8} {c['meaning']:>8} {c['recall']:>8} {c['fill']:>8} {total:>8}")
        for k in grand:
            grand[k] += c[k]
    print("-" * 44)
    g_total = sum(grand.values())
    print(f"{'TOTAL':<8} {grand['meaning']:>8} {grand['recall']:>8} {grand['fill']:>8} {g_total:>8}")

    # Spot-check a few examples
    print("\n=== Spot-check examples ===")
    examples_shown = 0
    for fact in output:
        if examples_shown >= 3:
            break
        fid = fact["id"]
        if fid.endswith("-recall") and "n5" in fid:
            print(f"\n[RECALL] {fid}")
            print(f"  Q: {fact['quizQuestion']}")
            print(f"  A: {fact['correctAnswer']}")
            print(f"  Distractors ({len(fact['distractors'])}): {fact['distractors'][:3]} ...")
            examples_shown += 1

    fill_shown = 0
    for fact in output:
        if fill_shown >= 2:
            break
        fid = fact["id"]
        if fid.endswith("-fill"):
            print(f"\n[FILL] {fid}")
            print(f"  Q: {fact['quizQuestion']}")
            print(f"  A: {fact['correctAnswer']}")
            print(f"  Distractors ({len(fact['distractors'])}): {fact['distractors'][:3]} ...")
            fill_shown += 1

    print()


if __name__ == "__main__":
    main()

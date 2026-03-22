#!/usr/bin/env python3
"""
rebuild-chinese-from-hsk.py

Rebuilds the Chinese vocabulary deck (src/data/seed/vocab-zh.json) from the
authoritative HSK reference data (data/references/hsk/complete.json).

Includes:
  - HSK new-1 through new-6  (new-7 skipped — 5,606 near-native words)
  - HSK old-1 through old-6  (entries not already covered by new-HSK levels)

Sorted by level (easiest first), then by frequency rank within each level.

Usage:
    python3 scripts/content-pipeline/vocab/rebuild-chinese-from-hsk.py
"""

import json
import re
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3]
HSK_PATH  = REPO_ROOT / "data/references/hsk/complete.json"
OUT_PATH  = REPO_ROOT / "src/data/seed/vocab-zh.json"

# ---------------------------------------------------------------------------
# Level config
# ---------------------------------------------------------------------------

# Canonical new-HSK levels we want to include (new-7 excluded)
NEW_LEVELS = {"new-1", "new-2", "new-3", "new-4", "new-5", "new-6"}
OLD_LEVELS = {"old-1", "old-2", "old-3", "old-4", "old-5", "old-6"}
ALL_TARGET_LEVELS = NEW_LEVELS | OLD_LEVELS

# Level → (categoryL2, difficulty)
LEVEL_MAP: dict[str, tuple[str, int]] = {
    "new-1": ("chinese_hsk1", 1),
    "old-1": ("chinese_hsk1", 1),
    "new-2": ("chinese_hsk2", 1),
    "old-2": ("chinese_hsk2", 1),
    "new-3": ("chinese_hsk3", 2),
    "old-3": ("chinese_hsk3", 2),
    "new-4": ("chinese_hsk4", 3),
    "old-4": ("chinese_hsk4", 3),
    "new-5": ("chinese_hsk5", 4),
    "old-5": ("chinese_hsk5", 4),
    "new-6": ("chinese_hsk6", 5),
    "old-6": ("chinese_hsk6", 5),
}

# Sort order for levels (lower = easier)
LEVEL_ORDER: dict[str, int] = {
    "new-1": 1, "old-1": 1,
    "new-2": 2, "old-2": 2,
    "new-3": 3, "old-3": 3,
    "new-4": 4, "old-4": 4,
    "new-5": 5, "old-5": 5,
    "new-6": 6, "old-6": 6,
}

# Prefixes that mark a meaning as unusable for a quiz answer
BAD_PREFIXES = (
    "variant of",
    "surname ",
    "see ",
    "abbr",
    "old variant",
    "erhua variant",
    "CL:",
)

# ---------------------------------------------------------------------------
# Meaning cleaning
# ---------------------------------------------------------------------------

def clean_meaning(raw: str) -> str:
    """Return a quiz-ready answer string from a raw HSK meaning.

    Steps:
    1. Strip leading bound-form / register markers in parentheses.
    2. Strip trailing "also pr." and "also written" clauses.
    3. Truncate at 25 chars on a comma/semicolon boundary that is NOT inside
       parentheses; if no such boundary exists within the first 25 chars, find
       the first top-level separator anywhere in the string.  If there is no
       separator at all (e.g. single-clause string shorter than 25 chars), keep
       the full string.  Never cut inside a parenthetical — always close all
       open parens before returning.
    4. Strip trailing "etc." / "etc".
    5. Strip trailing semicolons, commas, and whitespace.
    """
    s = raw.strip()

    # 1. Strip leading qualifier parens
    s = re.sub(r'^\(bound form\)\s*', '', s)
    s = re.sub(r'^\((literary|archaic|dialect|old)\)\s*', '', s)

    # 2a. Strip any parenthetical that itself contains "also pr." BEFORE doing
    #     the trailing-clause strip — otherwise the trailing regex can leave an
    #     unclosed "(" fragment.  Handles nested brackets like [wài mian].
    #     e.g. "outside (also pr. [wài mian] for this sense)" -> "outside"
    s = re.sub(r'\s*\([^)]*also pr\.[^)]*\)', '', s)

    # 2b. Strip trailing "also pr." / "also written" clauses (with or without
    #     a leading semicolon/comma)
    s = re.sub(r'\s*[;,]?\s*also pr\..+$', '', s)
    s = re.sub(r'\s*[;,]?\s*also written.+$', '', s)

    s = s.strip()

    # 3. Truncate on top-level (non-parenthesised) comma/semicolon boundary.
    #    Walk the string tracking paren depth; collect separator positions that
    #    are at depth 0 only.
    def top_level_separators(text: str) -> list[int]:
        positions: list[int] = []
        depth = 0
        for i, ch in enumerate(text):
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            elif ch in ',;' and depth == 0:
                positions.append(i)
        return positions

    if len(s) > 25:
        seps = top_level_separators(s)
        # Find last separator at or before position 24
        early = [p for p in seps if p <= 24]
        if early:
            s = s[:early[-1]]
        elif seps:
            # No separator in first 25 chars — use the first one anywhere
            s = s[:seps[0]]
        # else: no top-level separators — apply a hard cap at 60 chars to
        # prevent absurdly long answers (single-clause strings that are really
        # long parenthetical explanations get truncated at last word boundary)
        else:
            if len(s) > 60:
                s = s[:60].rsplit(' ', 1)[0]

    # 4. Strip trailing "etc." / "etc"
    s = re.sub(r'\s*[;,]?\s*etc\.?$', '', s)

    # 5. Strip trailing punctuation and whitespace
    s = s.rstrip(' ;,').strip()

    # 6. After all truncation, remove any dangling open parenthetical.
    #    Loop until balanced: each pass finds the rightmost unmatched '(' and
    #    strips from there.  Handles cases with multiple unclosed parens
    #    (e.g. "part (esp. of the body, but also of a vegetable (e.g. the")
    #    which needs two passes to reach "part".
    for _ in range(10):  # safety cap — should never need more than a few
        if s.count('(') <= s.count(')'):
            break
        depth = 0
        cut_pos = -1
        for i in range(len(s) - 1, -1, -1):
            if s[i] == ')':
                depth += 1
            elif s[i] == '(':
                if depth == 0:
                    cut_pos = i
                    break
                depth -= 1
        if cut_pos < 0:
            break
        s = s[:cut_pos].rstrip(' ;,').strip()

    return s


def is_bad_meaning(meaning: str) -> bool:
    """Return True if the meaning should be skipped as a quiz answer."""
    return any(meaning.startswith(p) for p in BAD_PREFIXES)


def get_usable_meaning(meanings: list[str]) -> str | None:
    """Return the first usable meaning after cleaning, or None if none exist.

    Tries the first meaning; if bad, falls back to the second.
    If both are bad (or missing), returns None.
    """
    for i, raw in enumerate(meanings[:2]):
        if not is_bad_meaning(raw):
            cleaned = clean_meaning(raw)
            if cleaned:
                return cleaned
    return None


# ---------------------------------------------------------------------------
# Explanation builder
# ---------------------------------------------------------------------------

def build_explanation(simplified: str, pinyin: str, first_meaning: str,
                       all_meanings: list[str]) -> str:
    """Build the explanation field.

    Format: "{simplified} ({pinyin}) — {first_meaning}. Also: {other_meanings}"
    The "Also:" part includes meanings 2-5 (raw, not cleaned) joined by ", ".
    If there are no other meanings, the suffix is omitted.
    """
    base = f"{simplified} ({pinyin}) — {first_meaning}"
    others = [m for m in all_meanings[1:5] if m]
    if others:
        return base + ". Also: " + ", ".join(others)
    return base + "."


# ---------------------------------------------------------------------------
# Lowest-level resolver
# ---------------------------------------------------------------------------

def lowest_level(levels: list[str]) -> str:
    """Return the easiest (lowest) HSK level from the entry's level list.

    Only considers levels present in ALL_TARGET_LEVELS.
    """
    valid = [l for l in levels if l in ALL_TARGET_LEVELS]
    if not valid:
        raise ValueError(f"No valid target level in {levels}")
    return min(valid, key=lambda l: LEVEL_ORDER[l])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print(f"Loading HSK reference: {HSK_PATH}")
    with open(HSK_PATH, encoding="utf-8") as f:
        raw_entries: list[dict] = json.load(f)
    print(f"  {len(raw_entries):,} total entries in reference.\n")

    # ------------------------------------------------------------------
    # Pass 1: Filter — keep only entries with at least one target level.
    #         new-1..6 take priority; old-1..6 are supplementary.
    # ------------------------------------------------------------------

    # Track which simplified characters are already covered by new-HSK
    # so old-HSK entries for the same character are deduplicated.
    seen_simplified: dict[str, str] = {}   # simplified -> level that claimed it

    skipped_level    = 0  # not in any target level
    skipped_meaning  = 0  # no usable meaning
    skipped_dedup    = 0  # duplicate simplified char (easier level wins)
    level_counts: dict[str, int] = {k: 0 for k in LEVEL_MAP}

    # We process new-HSK first, then old-HSK, so new always wins on dedup.
    def sort_key_pass(entry: dict) -> int:
        """Entries with any new-HSK level come first (0), old-only come last (1)."""
        levels = entry.get("level", [])
        return 0 if any(l in NEW_LEVELS for l in levels) else 1

    candidates: list[dict] = []  # will hold (entry, resolved_level, category, difficulty, pinyin, answer, meanings)

    for entry in sorted(raw_entries, key=sort_key_pass):
        levels: list[str] = entry.get("level", [])

        # Keep only levels in our target set
        valid_levels = [l for l in levels if l in ALL_TARGET_LEVELS]
        if not valid_levels:
            skipped_level += 1
            continue

        simplified: str = entry.get("simplified", "")
        form = entry.get("forms", [{}])[0]
        pinyin: str = form.get("transcriptions", {}).get("pinyin", "")
        meanings: list[str] = form.get("meanings", [])

        usable = get_usable_meaning(meanings)
        if usable is None:
            skipped_meaning += 1
            continue

        level = lowest_level(valid_levels)

        # Dedup: if we've already seen this simplified char at a level that's
        # equally easy or easier, skip this entry.
        if simplified in seen_simplified:
            existing_level = seen_simplified[simplified]
            if LEVEL_ORDER[existing_level] <= LEVEL_ORDER[level]:
                skipped_dedup += 1
                continue
            # Current entry is easier — replace the previous candidate
            # (remove the old one from candidates list)
            candidates = [c for c in candidates if c["simplified"] != simplified]
            # Also undo the level count for the old entry
            level_counts[existing_level] -= 1

        seen_simplified[simplified] = level
        level_counts[level] += 1

        candidates.append({
            "simplified": simplified,
            "level":      level,
            "frequency":  entry.get("frequency", 999999),
            "pinyin":     pinyin,
            "answer":     usable,
            "meanings":   meanings,
        })

    # ------------------------------------------------------------------
    # Pass 2: Sort — by level rank then frequency rank (lower freq = more common)
    # ------------------------------------------------------------------
    candidates.sort(key=lambda c: (LEVEL_ORDER[c["level"]], c["frequency"]))

    # ------------------------------------------------------------------
    # Pass 3: Build output facts
    # ------------------------------------------------------------------
    facts: list[dict] = []

    for idx, c in enumerate(candidates, start=1):
        simplified  = c["simplified"]
        pinyin      = c["pinyin"]
        answer      = c["answer"]
        level       = c["level"]
        meanings    = c["meanings"]
        frequency   = c["frequency"]

        category_l2, difficulty = LEVEL_MAP[level]
        hsk_num = category_l2.replace("chinese_hsk", "")  # "1".."6"

        explanation = build_explanation(simplified, pinyin, answer, meanings)

        fact: dict = {
            "id":               f"zh-hsk-{idx}",
            "type":             "vocabulary",
            "statement":        f"{simplified} ({pinyin}) means \"{answer}\" in Chinese",
            "quizQuestion":     f"What does \"{simplified}\" ({pinyin}) mean?",
            "correctAnswer":    answer,
            "distractors":      [],
            "explanation":      explanation,
            "category":         ["language", category_l2],
            "categoryL1":       "language",
            "categoryL2":       category_l2,
            "rarity":           "common",
            "difficulty":       difficulty,
            "funScore":         5,
            "ageRating":        "kid",
            "language":         "zh",
            "pronunciation":    pinyin,
            "frequencyRank":    frequency,
            "status":           "approved",
            "contentVolatility": "timeless",
            "tags":             ["vocab", "zh", f"hsk{hsk_num}"],
            "sourceName":       "HSK Vocabulary",
        }
        facts.append(fact)

    # ------------------------------------------------------------------
    # Write output
    # ------------------------------------------------------------------
    print(f"Writing {len(facts):,} facts to {OUT_PATH}")
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(facts, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)

    # Aggregate by display category
    category_totals: dict[str, int] = {}
    for fact in facts:
        cat = fact["categoryL2"]
        category_totals[cat] = category_totals.get(cat, 0) + 1

    for cat in sorted(category_totals):
        hsk_n = cat.replace("chinese_hsk", "HSK ")
        print(f"  {hsk_n}: {category_totals[cat]:>5} facts")

    print()
    print(f"  Total written:             {len(facts):>6}")
    print(f"  Skipped (wrong level):     {skipped_level:>6}")
    print(f"  Skipped (bad meaning):     {skipped_meaning:>6}")
    print(f"  Skipped (dedup):           {skipped_dedup:>6}")
    print(f"  Total input processed:     {len(raw_entries):>6}")
    print("=" * 60)

    # ------------------------------------------------------------------
    # Post-build: typecheck + build
    # ------------------------------------------------------------------
    print()
    print("Running npm run typecheck ...")
    tc = subprocess.run(
        ["npm", "run", "typecheck"],
        cwd=str(REPO_ROOT),
        capture_output=False,
    )
    if tc.returncode != 0:
        print("typecheck FAILED", file=sys.stderr)
        sys.exit(tc.returncode)

    print()
    print("Running npm run build ...")
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(REPO_ROOT),
        capture_output=False,
    )
    if build.returncode != 0:
        print("build FAILED", file=sys.stderr)
        sys.exit(build.returncode)

    print()
    print("Done.")


if __name__ == "__main__":
    main()

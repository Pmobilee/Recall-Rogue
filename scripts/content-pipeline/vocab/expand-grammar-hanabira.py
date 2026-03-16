#!/usr/bin/env python3
"""
expand-grammar-hanabira.py

Reads 364 new grammar points from hanabira.org (MIT License) and generates
2-3 quiz facts per point (meaning, recall, fill-blank), then appends them
to src/data/seed/grammar-ja.json and rebuilds the facts DB.

Usage:
    python3 scripts/content-pipeline/vocab/expand-grammar-hanabira.py
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
NEW_POINTS_PATH = Path("/tmp/hanabira-grammar/new-points.json")
GRAMMAR_SEED_PATH = REPO_ROOT / "src/data/seed/grammar-ja.json"
BUILD_SCRIPT = REPO_ROOT / "scripts/build-facts-db.mjs"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_jp_pattern(title: str) -> str:
    """
    Pull the Japanese portion of a title like:
      'A が いちばん～ (A ga ichiban～)'  →  'A が いちばん'
      '～かけ (〜kake)'                  →  '〜かけ'
      'Noun に する (Noun ni suru)'      →  'Noun に する'

    Strategy:
    - Strip the parenthesised romanisation at the end (and everything after it).
    - Strip leading/trailing whitespace.
    - Strip leading/trailing tildes.
    """
    # Remove trailing parenthetical  (anything from the last '(' onwards)
    pattern = re.sub(r'\s*\([^)]*\)\s*$', '', title).strip()
    # Strip bare tildes that are only decoration (not part of the token)
    pattern = pattern.strip('～').strip()
    # Normalise multiple spaces
    pattern = re.sub(r'  +', ' ', pattern)
    return pattern


def clean_explanation(short_explanation: str) -> str:
    """Return short_explanation truncated to 50 chars (word boundary when possible)."""
    s = short_explanation.rstrip('.')
    if len(s) <= 50:
        return s
    truncated = s[:50]
    # Try to break on the last semicolon or comma within the 50 chars
    for sep in (';', ','):
        idx = truncated.rfind(sep)
        if idx > 20:
            return truncated[:idx].strip()
    # Fall back to last space
    idx = truncated.rfind(' ')
    if idx > 20:
        return truncated[:idx].strip()
    return truncated.strip()


def make_fill_blank(pattern: str, jp_sentence: str, en_sentence: str):
    """
    Replace the first occurrence of *pattern* (or a meaningful sub-token) in
    jp_sentence with ___.

    Returns (blanked_sentence, display_q) or None if the pattern can't be
    located in the sentence.
    """
    # We try progressively shorter substrings of the pattern to find a match.
    # The pattern may contain spaces; we also try the last token.
    candidates = [pattern]

    # Add each individual kana/kanji token from the pattern
    for token in pattern.split():
        if token and token not in ('A', 'B', 'C', 'Noun', 'Verb', 'な', 'の',
                                   'する', 'です', 'ます', 'ない'):
            candidates.append(token)

    # Also try removing leading 'A ', 'B ', 'Noun ', 'Verb ' prefixes
    stripped = re.sub(r'^[A-Z][a-z]* ', '', pattern).strip()
    if stripped and stripped != pattern:
        candidates.insert(1, stripped)

    for candidate in candidates:
        if candidate and candidate in jp_sentence:
            blanked = jp_sentence.replace(candidate, '___', 1)
            display_q = f"{blanked} ({en_sentence})"
            return blanked, display_q

    return None


def safe_id_fragment(pattern: str) -> str:
    """Convert a pattern to a safe ID fragment (ASCII-ish slug)."""
    # Keep only alphanumeric, hiragana/katakana/kanji, hyphens, underscores
    s = re.sub(r'[\s/\\|]', '-', pattern)
    s = re.sub(r'[^\w\-]', '', s, flags=re.UNICODE)
    s = re.sub(r'-{2,}', '-', s).strip('-')
    return s[:40] if s else 'grammar'


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # --- Load inputs ---------------------------------------------------------
    with open(NEW_POINTS_PATH, encoding='utf-8') as f:
        new_points: dict = json.load(f)

    with open(GRAMMAR_SEED_PATH, encoding='utf-8') as f:
        existing_facts: list = json.load(f)

    existing_ids = {fact['id'] for fact in existing_facts}

    # --- Build distractor pools per level ------------------------------------
    # We need pools BEFORE generating so we can pick 7 distractors per fact.
    # Pools are built from the *new* points only; existing distractors stay.

    level_patterns: dict[str, list[str]] = {}
    level_meanings: dict[str, list[str]] = {}

    for level, points in new_points.items():
        lvl = level.lower()  # 'n5', 'n4', …
        level_patterns[lvl] = []
        level_meanings[lvl] = []
        for p in points:
            pat = extract_jp_pattern(p['title'])
            if pat:
                level_patterns[lvl].append(pat)
            meaning = clean_explanation(p['short_explanation'])
            if meaning:
                level_meanings[lvl].append(meaning)

    # --- Generate facts -------------------------------------------------------
    new_facts: list[dict] = []
    stats: dict[str, dict[str, int]] = {}

    for level, points in new_points.items():
        lvl = level.lower()         # 'n5'
        cat_l2 = f"japanese_{lvl}"  # 'japanese_n5'

        stats[level] = {'meaning': 0, 'recall': 0, 'fill': 0}

        patterns_pool = level_patterns[lvl]
        meanings_pool = level_meanings[lvl]

        for idx, point in enumerate(points):
            pattern = extract_jp_pattern(point['title'])
            if not pattern:
                continue

            meaning = clean_explanation(point['short_explanation'])
            formation = point.get('formation', '')
            examples = point.get('examples', [])

            # Romanisation from title parenthetical (e.g. "A ga ichiban～")
            paren_match = re.search(r'\(([^)]+)\)$', point['title'])
            pronunciation = paren_match.group(1).strip() if paren_match else ''

            # Build explanation block
            explanation_parts = []
            if formation:
                explanation_parts.append(f"Formation: {formation}")
            if examples:
                ex = examples[0]
                explanation_parts.append(
                    f"Example: {ex['jp']} ({ex['en']})"
                )
            explanation_text = ' | '.join(explanation_parts)

            base_id = f"ja-grammar-{lvl}-hanabira-{idx:04d}"

            # Distractors: pick 7 from pool excluding self
            def pick_distractors(pool: list, exclude: str) -> list[str]:
                candidates = [x for x in pool if x != exclude]
                # Spread across the full pool; take every Nth to get variety
                step = max(1, len(candidates) // 7)
                selected = candidates[::step][:7]
                # If not enough, pad from the front
                if len(selected) < 7:
                    extras = [x for x in candidates if x not in selected]
                    selected.extend(extras[:7 - len(selected)])
                return selected[:7]

            # ------------------------------------------------------------------
            # Fact 1: Meaning (L2 → L1)
            # ------------------------------------------------------------------
            meaning_id = f"{base_id}-meaning"
            if meaning_id not in existing_ids:
                meaning_distractors = pick_distractors(meanings_pool, meaning)
                meaning_fact = {
                    "id": meaning_id,
                    "type": "vocabulary",
                    "statement": f"The grammar pattern '{pattern}' means '{meaning}'",
                    "quizQuestion": f"What does the grammar pattern '{pattern}' mean?",
                    "correctAnswer": meaning,
                    "distractors": meaning_distractors,
                    "explanation": explanation_text,
                    "wowFactor": 6,
                    "difficulty": 2,
                    "ageRating": "kid",
                    "categoryL1": "language",
                    "categoryL2": cat_l2,
                    "pronunciation": pronunciation,
                    "domain": "vocab_ja",
                    "language": "ja",
                    "reading": pattern,
                    "subdeck": "Grammar",
                    "jlptLevel": level,
                    "category": ["language", cat_l2],
                    "rarity": "common",
                    "funScore": 6,
                    "sourceName": "hanabira.org (MIT License)",
                    "contentVolatility": "timeless",
                    "_haikuProcessed": True,
                }
                new_facts.append(meaning_fact)
                existing_ids.add(meaning_id)
                stats[level]['meaning'] += 1

            # ------------------------------------------------------------------
            # Fact 2: Recall (L1 → L2)
            # ------------------------------------------------------------------
            recall_id = f"{base_id}-recall"
            if recall_id not in existing_ids:
                recall_distractors = pick_distractors(patterns_pool, pattern)
                recall_fact = {
                    "id": recall_id,
                    "type": "vocabulary",
                    "statement": f"The Japanese grammar pattern for '{meaning}' is '{pattern}'",
                    "quizQuestion": f"Which Japanese grammar pattern means '{meaning}'?",
                    "correctAnswer": pattern,
                    "distractors": recall_distractors,
                    "explanation": explanation_text,
                    "wowFactor": 6,
                    "difficulty": 2,
                    "ageRating": "kid",
                    "categoryL1": "language",
                    "categoryL2": cat_l2,
                    "pronunciation": pronunciation,
                    "domain": "vocab_ja",
                    "language": "ja",
                    "reading": pattern,
                    "subdeck": "Grammar",
                    "jlptLevel": level,
                    "category": ["language", cat_l2],
                    "rarity": "common",
                    "funScore": 6,
                    "sourceName": "hanabira.org (MIT License)",
                    "contentVolatility": "timeless",
                    "_haikuProcessed": True,
                }
                new_facts.append(recall_fact)
                existing_ids.add(recall_id)
                stats[level]['recall'] += 1

            # ------------------------------------------------------------------
            # Fact 3: Fill-blank (if example contains the pattern)
            # ------------------------------------------------------------------
            fill_id = f"{base_id}-fill"
            if fill_id not in existing_ids and examples:
                ex = examples[0]
                result = make_fill_blank(pattern, ex['jp'], ex['en'])
                if result:
                    blanked, display_q = result
                    fill_distractors = pick_distractors(patterns_pool, pattern)
                    fill_fact = {
                        "id": fill_id,
                        "type": "vocabulary",
                        "statement": f"Fill in the blank: {blanked}",
                        "quizQuestion": display_q,
                        "correctAnswer": pattern,
                        "distractors": fill_distractors,
                        "explanation": (
                            f"{meaning}. Full sentence: {ex['jp']} ({ex['en']})"
                        ),
                        "wowFactor": 7,
                        "difficulty": 3,
                        "ageRating": "kid",
                        "categoryL1": "language",
                        "categoryL2": cat_l2,
                        "pronunciation": pronunciation,
                        "exampleSentence": f"{ex['jp']} ({ex['en']})",
                        "domain": "vocab_ja",
                        "language": "ja",
                        "reading": pattern,
                        "subdeck": "Grammar",
                        "jlptLevel": level,
                        "category": ["language", cat_l2],
                        "rarity": "common",
                        "funScore": 8,
                        "sourceName": "hanabira.org (MIT License)",
                        "contentVolatility": "timeless",
                        "_haikuProcessed": True,
                    }
                    new_facts.append(fill_fact)
                    existing_ids.add(fill_id)
                    stats[level]['fill'] += 1

    # --- Append to grammar-ja.json -------------------------------------------
    combined = existing_facts + new_facts

    with open(GRAMMAR_SEED_PATH, 'w', encoding='utf-8') as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f"\n✓ Appended {len(new_facts)} new facts to {GRAMMAR_SEED_PATH}")
    print(f"  Total facts in file: {len(combined)}\n")

    # --- Print summary --------------------------------------------------------
    total_per_type = {'meaning': 0, 'recall': 0, 'fill': 0}
    for level, counts in stats.items():
        print(f"  {level}: {counts['meaning']} meaning, "
              f"{counts['recall']} recall, "
              f"{counts['fill']} fill "
              f"= {sum(counts.values())} facts")
        for t in total_per_type:
            total_per_type[t] += counts[t]

    total_new = sum(total_per_type.values())
    print(f"\n  TOTAL NEW: {total_per_type['meaning']} meaning + "
          f"{total_per_type['recall']} recall + "
          f"{total_per_type['fill']} fill = {total_new} facts\n")

    # --- Rebuild facts DB ----------------------------------------------------
    print(f"Running: node {BUILD_SCRIPT}\n")
    result = subprocess.run(
        ['node', str(BUILD_SCRIPT)],
        cwd=str(REPO_ROOT),
        capture_output=False,
    )
    if result.returncode != 0:
        print(f"\n✗ build-facts-db.mjs failed with exit code {result.returncode}",
              file=sys.stderr)
        sys.exit(result.returncode)

    # --- Final grammar count in DB ------------------------------------------
    db_path = REPO_ROOT / 'src/data/seed/facts.db'
    if db_path.exists():
        try:
            import sqlite3
            con = sqlite3.connect(str(db_path))
            row = con.execute(
                "SELECT COUNT(*) FROM facts WHERE subdeck='Grammar'"
            ).fetchone()
            con.close()
            print(f"\n  Total grammar facts in facts.db: {row[0]}")
        except Exception as e:
            print(f"  (Could not query facts.db: {e})")


if __name__ == '__main__':
    main()

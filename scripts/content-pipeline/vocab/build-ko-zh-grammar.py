#!/usr/bin/env python3
"""
build-ko-zh-grammar.py

Reads hanabira.org grammar points for Korean (744 points, levels 1-6) and
Chinese (739 points, HSK 1-6), generates 2-3 quiz facts per point
(meaning, recall, fill-blank), writes:

  src/data/seed/grammar-ko.json
  src/data/seed/grammar-zh.json

Then rebuilds the facts DB.

Usage:
    python3 scripts/content-pipeline/vocab/build-ko-zh-grammar.py
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
KR_SOURCE_DIR = Path("/tmp/hanabira-kr")
CN_SOURCE_DIR = Path("/tmp/hanabira-cn")
GRAMMAR_KO_PATH = REPO_ROOT / "src/data/seed/grammar-ko.json"
GRAMMAR_ZH_PATH = REPO_ROOT / "src/data/seed/grammar-zh.json"
BUILD_SCRIPT = REPO_ROOT / "scripts/build-facts-db.mjs"

# ---------------------------------------------------------------------------
# Level configs
# ---------------------------------------------------------------------------
KR_LEVELS = [
    ("level1", "korean_beginner",      "beginner",     1),
    ("level2", "korean_beginner",      "beginner",     2),
    ("level3", "korean_intermediate",  "intermediate", 3),
    ("level4", "korean_intermediate",  "intermediate", 4),
    ("level5", "korean_advanced",      "advanced",     5),
    ("level6", "korean_advanced",      "advanced",     6),
]

CN_LEVELS = [
    ("hsk1", "chinese_hsk1", 1),
    ("hsk2", "chinese_hsk2", 2),
    ("hsk3", "chinese_hsk3", 3),
    ("hsk4", "chinese_hsk4", 4),
    ("hsk5", "chinese_hsk5", 5),
    ("hsk6", "chinese_hsk6", 6),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_pattern(title: str) -> str:
    """
    Extract the target-language portion of a title like:
      '이/가 [i/ga] (Subject markers)'  →  '이/가'
      '的 (de) - Possessive particle'    →  '的'
      'Noun + 은/는 (topic marker)'      →  'Noun + 은/는'

    Strategy:
    - Strip bracketed romanisation [...]
    - Strip trailing parenthetical (...)
    - Strip trailing ' - ...' descriptors
    - Strip leading/trailing whitespace
    """
    # Remove [romanisation] blocks
    pattern = re.sub(r'\s*\[[^\]]*\]', '', title)
    # Remove trailing parenthetical
    pattern = re.sub(r'\s*\([^)]*\)\s*$', '', pattern).strip()
    # Remove trailing ' - description'
    pattern = re.sub(r'\s*-\s+[A-Z].*$', '', pattern).strip()
    # Normalise multiple spaces
    pattern = re.sub(r'  +', ' ', pattern)
    return pattern.strip()


def clean_explanation(short_explanation: str) -> str:
    """Return short_explanation truncated to 50 chars (word boundary when possible)."""
    s = short_explanation.rstrip('.')
    if len(s) <= 50:
        return s
    truncated = s[:50]
    for sep in (';', ','):
        idx = truncated.rfind(sep)
        if idx > 20:
            return truncated[:idx].strip()
    idx = truncated.rfind(' ')
    if idx > 20:
        return truncated[:idx].strip()
    return truncated.strip()


def make_fill_blank(pattern: str, sentence: str, en_sentence: str):
    """
    Replace the first occurrence of *pattern* (or a meaningful sub-token) in
    sentence with ___.

    Returns (blanked_sentence, display_q) or None if not locatable.
    """
    # Skip-list tokens that are too generic to be useful blanks
    SKIP_TOKENS = {
        'A', 'B', 'C', 'Noun', 'Verb', 'Subject', 'Object',
        'な', 'の', 'する', 'です', 'ます', 'ない',
        '+', '/', '|',
    }

    candidates = [pattern]

    # Try individual tokens from the pattern
    for token in re.split(r'[\s/+|]', pattern):
        token = token.strip()
        if token and token not in SKIP_TOKENS and len(token) > 1:
            candidates.append(token)

    # Try stripping leading "Noun + ", "Verb + ", etc.
    stripped = re.sub(r'^[A-Za-z][a-z]* \+ ', '', pattern).strip()
    if stripped and stripped != pattern:
        candidates.insert(1, stripped)

    for candidate in candidates:
        if candidate and candidate in sentence:
            blanked = sentence.replace(candidate, '___', 1)
            display_q = f"{blanked} ({en_sentence})"
            return blanked, display_q

    return None


def pick_distractors(pool: list[str], exclude: str) -> list[str]:
    """Pick 7 distractors from pool, evenly spread, excluding self."""
    candidates = [x for x in pool if x != exclude]
    step = max(1, len(candidates) // 7)
    selected = candidates[::step][:7]
    if len(selected) < 7:
        extras = [x for x in candidates if x not in selected]
        selected.extend(extras[:7 - len(selected)])
    return selected[:7]


# ---------------------------------------------------------------------------
# Core generator
# ---------------------------------------------------------------------------

def generate_facts(
    language: str,           # 'ko' or 'zh'
    level_configs: list,
    source_dir: Path,
    sentence_field: str,     # 'kr' for Korean, 'cn' for Chinese
    domain_field: str,       # 'vocab_ko' or 'vocab_zh'
    level_name_fn,           # callable(file_stem, level_num) -> level_label for stats
    id_prefix_fn,            # callable(level_name_str, index) -> base_id
) -> tuple[list[dict], dict]:
    """
    Generate facts for one language.
    Returns (facts_list, stats_dict).
    """

    # ---- Build distractor pools per categoryL2 --------------------------------
    # We need all points loaded first so pool covers the whole category.
    cat_patterns: dict[str, list[str]] = {}
    cat_meanings: dict[str, list[str]] = {}

    level_data: list[tuple] = []

    for cfg in level_configs:
        file_stem, cat_l2 = cfg[0], cfg[1]
        filepath = source_dir / f"{file_stem}.json"
        with open(filepath, encoding='utf-8') as f:
            points = json.load(f)

        level_data.append((cfg, points))

        if cat_l2 not in cat_patterns:
            cat_patterns[cat_l2] = []
            cat_meanings[cat_l2] = []

        for p in points:
            pat = extract_pattern(p['title'])
            if pat:
                cat_patterns[cat_l2].append(pat)
            meaning = clean_explanation(p['short_explanation'])
            if meaning:
                cat_meanings[cat_l2].append(meaning)

    # ---- Generate facts -------------------------------------------------------
    facts: list[dict] = []
    stats: dict[str, dict] = {}

    # Track global index per categoryL2 so IDs are stable
    cat_index: dict[str, int] = {}

    for cfg, points in level_data:
        file_stem, cat_l2 = cfg[0], cfg[1]

        # Stat key: e.g. "beginner" / "intermediate" / "hsk1"
        stat_key = level_name_fn(cfg)
        if stat_key not in stats:
            stats[stat_key] = {'meaning': 0, 'recall': 0, 'fill': 0}

        patterns_pool = cat_patterns[cat_l2]
        meanings_pool = cat_meanings[cat_l2]

        for point in points:
            pattern = extract_pattern(point['title'])
            if not pattern:
                continue

            meaning = clean_explanation(point['short_explanation'])
            formation = point.get('formation', '')
            examples = point.get('examples', [])

            # Build explanation block
            explanation_parts = []
            if formation:
                explanation_parts.append(f"Formation: {formation}")
            if examples:
                ex = examples[0]
                sent = ex.get(sentence_field, ex.get('jp', ''))
                explanation_parts.append(f"Example: {sent} ({ex['en']})")
            explanation_text = ' | '.join(explanation_parts)

            # Stable per-category index
            idx = cat_index.get(cat_l2, 0)
            cat_index[cat_l2] = idx + 1

            base_id = id_prefix_fn(cat_l2, idx)

            # ------------------------------------------------------------------
            # Fact 1: Meaning (L2 → L1)
            # ------------------------------------------------------------------
            meaning_distractors = pick_distractors(meanings_pool, meaning)
            facts.append({
                "id": f"{base_id}-meaning",
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
                "domain": domain_field,
                "language": language,
                "reading": pattern,
                "subdeck": "Grammar",
                "category": ["language", cat_l2],
                "rarity": "common",
                "funScore": 6,
                "sourceName": "hanabira.org (MIT License)",
                "contentVolatility": "timeless",
                "_haikuProcessed": True,
                "_haikuProcessedAt": "2026-03-16T00:00:00.000Z",
            })
            stats[stat_key]['meaning'] += 1

            # ------------------------------------------------------------------
            # Fact 2: Recall (L1 → L2)
            # ------------------------------------------------------------------
            recall_distractors = pick_distractors(patterns_pool, pattern)
            lang_label = "Korean" if language == "ko" else "Chinese"
            facts.append({
                "id": f"{base_id}-recall",
                "type": "vocabulary",
                "statement": f"The {lang_label} grammar pattern for '{meaning}' is '{pattern}'",
                "quizQuestion": f"Which {lang_label} grammar pattern means '{meaning}'?",
                "correctAnswer": pattern,
                "distractors": recall_distractors,
                "explanation": explanation_text,
                "wowFactor": 6,
                "difficulty": 2,
                "ageRating": "kid",
                "categoryL1": "language",
                "categoryL2": cat_l2,
                "domain": domain_field,
                "language": language,
                "reading": pattern,
                "subdeck": "Grammar",
                "category": ["language", cat_l2],
                "rarity": "common",
                "funScore": 6,
                "sourceName": "hanabira.org (MIT License)",
                "contentVolatility": "timeless",
                "_haikuProcessed": True,
                "_haikuProcessedAt": "2026-03-16T00:00:00.000Z",
            })
            stats[stat_key]['recall'] += 1

            # ------------------------------------------------------------------
            # Fact 3: Fill-blank (if example sentence contains the pattern)
            # ------------------------------------------------------------------
            if examples:
                ex = examples[0]
                sent = ex.get(sentence_field, ex.get('jp', ''))
                result = make_fill_blank(pattern, sent, ex['en'])
                if result:
                    blanked, display_q = result
                    fill_distractors = pick_distractors(patterns_pool, pattern)
                    facts.append({
                        "id": f"{base_id}-fill",
                        "type": "vocabulary",
                        "statement": f"Fill in the blank: {blanked}",
                        "quizQuestion": display_q,
                        "correctAnswer": pattern,
                        "distractors": fill_distractors,
                        "explanation": f"{meaning}. Full sentence: {sent} ({ex['en']})",
                        "wowFactor": 7,
                        "difficulty": 3,
                        "ageRating": "kid",
                        "categoryL1": "language",
                        "categoryL2": cat_l2,
                        "domain": domain_field,
                        "language": language,
                        "reading": pattern,
                        "subdeck": "Grammar",
                        "exampleSentence": f"{sent} ({ex['en']})",
                        "category": ["language", cat_l2],
                        "rarity": "common",
                        "funScore": 8,
                        "sourceName": "hanabira.org (MIT License)",
                        "contentVolatility": "timeless",
                        "_haikuProcessed": True,
                        "_haikuProcessedAt": "2026-03-16T00:00:00.000Z",
                    })
                    stats[stat_key]['fill'] += 1

    return facts, stats


# ---------------------------------------------------------------------------
# Korean config helpers
# ---------------------------------------------------------------------------

def ko_level_name(cfg) -> str:
    # cfg = (file_stem, cat_l2, short_name, level_num)
    return cfg[2]  # 'beginner', 'intermediate', 'advanced'


def ko_id_prefix(cat_l2: str, idx: int) -> str:
    # cat_l2 = 'korean_beginner' → level_name = 'beginner'
    level_name = cat_l2.replace('korean_', '')
    return f"ko-grammar-{level_name}-{idx:04d}"


# ---------------------------------------------------------------------------
# Chinese config helpers
# ---------------------------------------------------------------------------

def cn_level_name(cfg) -> str:
    # cfg = (file_stem, cat_l2, level_num)
    return cfg[0]  # 'hsk1', 'hsk2', …


def cn_id_prefix(cat_l2: str, idx: int) -> str:
    # cat_l2 = 'chinese_hsk3' → level_name = 'hsk3'
    level_name = cat_l2.replace('chinese_', '')
    return f"zh-grammar-{level_name}-{idx:04d}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # ---- Korean ---------------------------------------------------------------
    print("Generating Korean grammar facts …")
    ko_facts, ko_stats = generate_facts(
        language="ko",
        level_configs=KR_LEVELS,
        source_dir=KR_SOURCE_DIR,
        sentence_field="kr",
        domain_field="vocab_ko",
        level_name_fn=ko_level_name,
        id_prefix_fn=ko_id_prefix,
    )

    with open(GRAMMAR_KO_PATH, 'w', encoding='utf-8') as f:
        json.dump(ko_facts, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f"  Wrote {len(ko_facts)} facts → {GRAMMAR_KO_PATH}")
    print()

    # ---- Chinese --------------------------------------------------------------
    print("Generating Chinese grammar facts …")
    cn_facts, cn_stats = generate_facts(
        language="zh",
        level_configs=CN_LEVELS,
        source_dir=CN_SOURCE_DIR,
        sentence_field="cn",
        domain_field="vocab_zh",
        level_name_fn=cn_level_name,
        id_prefix_fn=cn_id_prefix,
    )

    with open(GRAMMAR_ZH_PATH, 'w', encoding='utf-8') as f:
        json.dump(cn_facts, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f"  Wrote {len(cn_facts)} facts → {GRAMMAR_ZH_PATH}")
    print()

    # ---- Summary --------------------------------------------------------------
    print("=" * 60)
    print("KOREAN GRAMMAR SUMMARY")
    print("=" * 60)
    ko_total = {'meaning': 0, 'recall': 0, 'fill': 0}
    for level_name in ('beginner', 'intermediate', 'advanced'):
        counts = ko_stats.get(level_name, {'meaning': 0, 'recall': 0, 'fill': 0})
        subtotal = sum(counts.values())
        print(f"  {level_name:14s}: {counts['meaning']:3d} meaning, "
              f"{counts['recall']:3d} recall, {counts['fill']:3d} fill = {subtotal:4d}")
        for t in ko_total:
            ko_total[t] += counts[t]
    ko_grand = sum(ko_total.values())
    print(f"  {'TOTAL':14s}: {ko_total['meaning']:3d} meaning, "
          f"{ko_total['recall']:3d} recall, {ko_total['fill']:3d} fill = {ko_grand:4d}")

    print()
    print("=" * 60)
    print("CHINESE GRAMMAR SUMMARY")
    print("=" * 60)
    cn_total = {'meaning': 0, 'recall': 0, 'fill': 0}
    for level_name in ('hsk1', 'hsk2', 'hsk3', 'hsk4', 'hsk5', 'hsk6'):
        counts = cn_stats.get(level_name, {'meaning': 0, 'recall': 0, 'fill': 0})
        subtotal = sum(counts.values())
        print(f"  {level_name:8s}: {counts['meaning']:3d} meaning, "
              f"{counts['recall']:3d} recall, {counts['fill']:3d} fill = {subtotal:4d}")
        for t in cn_total:
            cn_total[t] += counts[t]
    cn_grand = sum(cn_total.values())
    print(f"  {'TOTAL':8s}: {cn_total['meaning']:3d} meaning, "
          f"{cn_total['recall']:3d} recall, {cn_total['fill']:3d} fill = {cn_grand:4d}")

    print()
    print(f"GRAND TOTAL: {ko_grand + cn_grand} facts "
          f"({ko_grand} Korean + {cn_grand} Chinese)")
    print()

    # ---- Rebuild facts DB -----------------------------------------------------
    print(f"Running: node {BUILD_SCRIPT}")
    result = subprocess.run(
        ['node', str(BUILD_SCRIPT)],
        cwd=str(REPO_ROOT),
        capture_output=False,
    )
    if result.returncode != 0:
        print(f"\n✗ build-facts-db.mjs failed with exit code {result.returncode}",
              file=sys.stderr)
        sys.exit(result.returncode)

    # ---- Final DB counts -------------------------------------------------------
    db_path = REPO_ROOT / 'src/data/seed/facts.db'
    if db_path.exists():
        try:
            import sqlite3
            con = sqlite3.connect(str(db_path))
            total_row = con.execute("SELECT COUNT(*) FROM facts WHERE subdeck='Grammar'").fetchone()
            ko_row = con.execute(
                "SELECT COUNT(*) FROM facts WHERE subdeck='Grammar' AND language='ko'"
            ).fetchone()
            zh_row = con.execute(
                "SELECT COUNT(*) FROM facts WHERE subdeck='Grammar' AND language='zh'"
            ).fetchone()
            ja_row = con.execute(
                "SELECT COUNT(*) FROM facts WHERE subdeck='Grammar' AND language='ja'"
            ).fetchone()
            con.close()
            print(f"\n  Grammar facts in facts.db:")
            print(f"    Japanese : {ja_row[0]}")
            print(f"    Korean   : {ko_row[0]}")
            print(f"    Chinese  : {zh_row[0]}")
            print(f"    TOTAL    : {total_row[0]}")
        except Exception as e:
            print(f"  (Could not query facts.db: {e})")


if __name__ == '__main__':
    main()

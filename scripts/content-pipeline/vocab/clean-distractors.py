#!/usr/bin/env python3
"""clean-distractors.py — Clean pre-stored distractor quality for kanji and grammar facts.

Kanji files:  data/raw/japanese/kanji-n{1-5}.json
Grammar file: src/data/seed/grammar-ja.json

Run this script, then rebuild the DB separately.
"""

import json
import re
import random
from pathlib import Path
from collections import defaultdict

REPO_ROOT = Path(__file__).resolve().parents[3]

KANJI_FILES = {
    "N1": REPO_ROOT / "data/raw/japanese/kanji-n1.json",
    "N2": REPO_ROOT / "data/raw/japanese/kanji-n2.json",
    "N3": REPO_ROOT / "data/raw/japanese/kanji-n3.json",
    "N4": REPO_ROOT / "data/raw/japanese/kanji-n4.json",
    "N5": REPO_ROOT / "data/raw/japanese/kanji-n5.json",
}
GRAMMAR_FILE = REPO_ROOT / "src/data/seed/grammar-ja.json"

# ---------------------------------------------------------------------------
# Japanese character detection
# ---------------------------------------------------------------------------

# Covers hiragana, katakana, CJK unified ideographs, fullwidth ASCII/punctuation
_JP_RANGES = [
    (0x3000, 0x9FFF),   # CJK unified, hiragana, katakana, fullwidth, etc.
    (0xF900, 0xFAFF),   # CJK compatibility ideographs
    (0xFF00, 0xFFEF),   # Fullwidth/halfwidth forms
]

def _has_japanese(text: str) -> bool:
    return any(any(lo <= ord(c) <= hi for lo, hi in _JP_RANGES) for c in text)


def _strip_japanese(text: str) -> str:
    """Remove all Japanese characters (hiragana/katakana/kanji/fullwidth) from text."""
    return re.sub(
        r"[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]+",
        "",
        text,
    ).strip()


# ---------------------------------------------------------------------------
# Core distractor cleaning rules
# ---------------------------------------------------------------------------

def _clean_distractor_kanji(d: str) -> str:
    """Apply kanji-specific cleaning rules to a single distractor string.

    Returns the cleaned string, or '' if the distractor should be removed.
    """
    d = d.strip()

    # Rule 1: Fix truncated parentheticals — '(' present but ')' absent
    if "(" in d and ")" not in d:
        d = d[: d.index("(")].rstrip(", ").strip()

    # Rule 2: Strip long parentheticals (content inside parens >20 chars)
    def _strip_long_paren(m: re.Match) -> str:
        inner = m.group(0)[1:-1]  # strip the outer ( ) to get content
        if len(inner) > 20:
            return ""
        return m.group(0)

    d = re.sub(r"\([^)]*\)", _strip_long_paren, d).strip()
    # Clean up double-spaces or dangling punctuation left after removal
    d = re.sub(r"\s{2,}", " ", d).strip()

    # Rule 3: Strip short technical parentheticals: (usu., (esp., (arch., (orig., (lit.
    _TECH_PARENS = re.compile(
        r"\(\s*(usu\.|esp\.|arch\.|orig\.|lit\.)\s*\)",
        re.IGNORECASE,
    )
    d = _TECH_PARENS.sub("", d).strip()
    # Also handle the form "(arch.)  text" where paren is at the start
    d = re.sub(
        r"^\(\s*(usu\.|esp\.|arch\.|orig\.|lit\.)\s*\)\s*",
        "",
        d,
        flags=re.IGNORECASE,
    ).strip()

    # Rule 4: Truncate at 35 chars — find last ',' or ';' before position 35,
    # else last space before 35.
    if len(d) > 35:
        chunk = d[:35]
        # Search backwards for , or ;
        cut = max(chunk.rfind(","), chunk.rfind(";"))
        if cut > 0:
            d = d[:cut].strip()
        else:
            # Fall back to last space
            cut = chunk.rfind(" ")
            if cut > 0:
                d = d[:cut].strip()
            else:
                d = chunk.strip()

    # Trim trailing punctuation artifacts
    d = d.rstrip(", ;").strip()

    # Re-apply Rule 1 after truncation — truncation may have produced a new
    # unclosed parenthetical (e.g. "to draw an arc (e.g. with a")
    if "(" in d and ")" not in d:
        d = d[: d.index("(")].rstrip(", ").strip()

    return d


def _clean_distractor_grammar_meaning(d: str) -> str:
    """Apply grammar-meaning-specific cleaning on top of kanji rules.

    Applies rules 1–7 (kanji rules) plus:
    8. Strip Japanese characters from English meaning distractors
    9. Strip raw notation: 名詞, 動詞, 形容詞, Vm, standalone 'Noun ' prefix
    10. Strip '(also shown as ...)' parentheticals
    """
    d = d.strip()

    # Rule 10: Strip '(also shown as ...)' before other processing
    d = re.sub(r"\(also shown as[^)]*\)", "", d, flags=re.IGNORECASE).strip()

    # Rule 9: Strip raw POS notation
    # Distractors that start with "Vm" are raw verb-morphology notation — strip
    # the "Vm" prefix and any separator that follows, or blank the whole thing
    # if nothing meaningful remains after stripping.
    if re.match(r"^Vm[,、\s]", d):
        rest = re.sub(r"^Vm[,、]\s*", "", d).strip()
        rest = re.sub(r"^Vm\s+", "", rest).strip()
        # If the remainder is itself a notation token (e.g. "na (positive command...)")
        # or empty, blank out the whole distractor so Rule 5 drops it.
        if len(rest) < 3 or re.match(r"^na\b", rest, re.IGNORECASE):
            d = ""
        else:
            d = rest
    d = re.sub(r"^Noun\s+", "", d).strip()
    # Remove inline Japanese POS labels (名詞, 動詞, 形容詞) and surrounding whitespace
    d = re.sub(r"\s*[名動形]詞\s*", " ", d).strip()

    # Rule 8: Strip Japanese characters
    if _has_japanese(d):
        d = _strip_japanese(d)

    # Now apply the shared kanji rules 1–4
    d = _clean_distractor_kanji(d)

    return d


# ---------------------------------------------------------------------------
# Per-fact cleaning
# ---------------------------------------------------------------------------

def _clean_fact_distractors(fact: dict, cleaner, correct_answer: str) -> tuple[list[str], int, int]:
    """Apply cleaner to each distractor in fact.

    Returns (cleaned_list, n_transformed, n_removed) where:
      n_transformed = distractors whose text changed after cleaning (but kept)
      n_removed     = distractors dropped (empty, too short, self-match, duplicate)
    """
    raw = fact.get("distractors", [])
    seen: set[str] = set()
    cleaned: list[str] = []
    removed = 0
    transformed = 0

    for d in raw:
        c = cleaner(d)

        # Rule 5: Remove empty or too-short distractors (<3 chars)
        if len(c) < 3:
            removed += 1
            continue

        # Rule 6: Deduplicate (case-sensitive within a fact)
        if c in seen:
            removed += 1
            continue

        # Rule 7: Remove self-match against correctAnswer
        if c == correct_answer:
            removed += 1
            continue

        if c != d:
            transformed += 1

        seen.add(c)
        cleaned.append(c)

    return cleaned, transformed, removed


# ---------------------------------------------------------------------------
# Refill helpers
# ---------------------------------------------------------------------------

def _build_kanji_pool(all_facts: list[dict], jlpt_level: str) -> list[str]:
    """Return all correctAnswer values for facts at the given JLPT level."""
    return [
        f["correctAnswer"]
        for f in all_facts
        if f.get("jlptLevel") == jlpt_level
    ]


def _build_grammar_meaning_pool(all_facts: list[dict], jlpt_level: str) -> list[str]:
    """Return all correctAnswer values for -meaning facts at the given JLPT level."""
    return [
        f["correctAnswer"]
        for f in all_facts
        if f["id"].endswith("-meaning") and f.get("jlptLevel") == jlpt_level
    ]


def _refill_distractors(
    current: list[str],
    correct_answer: str,
    pool: list[str],
    target: int = 5,
) -> tuple[list[str], int]:
    """Top up distractors from pool until we reach target count.

    Returns (new_list, n_added).
    """
    if len(current) >= target:
        return current, 0

    needed = target - len(current)
    existing = set(current) | {correct_answer}
    candidates = [p for p in pool if p not in existing and len(p) >= 3]

    # Shuffle for variety, then take what we need
    random.shuffle(candidates)
    additions = candidates[:needed]

    return current + additions, len(additions)


# ---------------------------------------------------------------------------
# Kanji file processing
# ---------------------------------------------------------------------------

def process_kanji_file(path: Path, level: str) -> dict:
    """Process one kanji-n{level}.json file in place. Returns stats dict."""
    data: list[dict] = json.loads(path.read_text(encoding="utf-8"))

    # Build the same-level pool BEFORE cleaning (use original correct answers)
    pool = _build_kanji_pool(data, level)

    facts_affected = 0
    total_cleaned = 0
    total_refilled = 0

    for fact in data:
        correct = fact.get("correctAnswer", "")

        cleaned, n_transformed, n_removed = _clean_fact_distractors(
            fact, _clean_distractor_kanji, correct
        )

        refilled, n_added = _refill_distractors(cleaned, correct, pool, target=5)

        if n_transformed > 0 or n_removed > 0 or n_added > 0:
            facts_affected += 1
            total_cleaned += n_transformed + n_removed
            total_refilled += n_added
            fact["distractors"] = refilled

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return {
        "file": path.name,
        "facts": len(data),
        "facts_affected": facts_affected,
        "distractors_cleaned": total_cleaned,
        "distractors_refilled": total_refilled,
    }


# ---------------------------------------------------------------------------
# Grammar file processing
# ---------------------------------------------------------------------------

def process_grammar_file(path: Path) -> dict:
    """Process grammar-ja.json in place. Returns stats dict."""
    data: list[dict] = json.loads(path.read_text(encoding="utf-8"))

    # --- Meaning facts ---
    meaning_facts = [f for f in data if f["id"].endswith("-meaning")]
    # Build per-level meaning pools from original data
    meaning_pools: dict[str, list[str]] = defaultdict(list)
    for f in meaning_facts:
        lv = f.get("jlptLevel", "")
        if lv:
            meaning_pools[lv].append(f["correctAnswer"])

    m_affected = m_cleaned = m_refilled = 0
    for fact in meaning_facts:
        correct = fact.get("correctAnswer", "")
        cleaned, n_transformed, n_removed = _clean_fact_distractors(
            fact, _clean_distractor_grammar_meaning, correct
        )
        lv = fact.get("jlptLevel", "")
        pool = meaning_pools.get(lv, [])
        refilled, n_added = _refill_distractors(cleaned, correct, pool, target=5)

        if n_transformed > 0 or n_removed > 0 or n_added > 0:
            m_affected += 1
            m_cleaned += n_transformed + n_removed
            m_refilled += n_added
            fact["distractors"] = refilled

    # --- Recall facts ---
    recall_facts = [f for f in data if f["id"].endswith("-recall")]
    r_affected = r_cleaned = 0
    for fact in recall_facts:
        correct = fact.get("correctAnswer", "")
        original = list(fact.get("distractors", []))
        # Recall: only self-match and dedup (no pool refill)
        seen: set[str] = set()
        cleaned_list: list[str] = []
        n_removed = 0
        for d in original:
            if d == correct:
                n_removed += 1
                continue
            if d in seen:
                n_removed += 1
                continue
            seen.add(d)
            cleaned_list.append(d)

        if n_removed > 0:
            r_affected += 1
            r_cleaned += n_removed
            fact["distractors"] = cleaned_list

    # --- Fill facts ---
    fill_facts = [f for f in data if f["id"].endswith("-fill")]
    f_affected = f_cleaned = 0
    for fact in fill_facts:
        correct = fact.get("correctAnswer", "")
        original = list(fact.get("distractors", []))
        seen: set[str] = set()
        cleaned_list: list[str] = []
        n_removed = 0
        for d in original:
            # Strip 〜 prefix (fill answers don't use tilde)
            d_stripped = d.lstrip("〜")
            if d_stripped == correct:
                n_removed += 1
                continue
            if d_stripped in seen:
                n_removed += 1
                continue
            seen.add(d_stripped)
            cleaned_list.append(d_stripped)

        if n_removed > 0 or any(d.startswith("〜") for d in original):
            # Rewrite even if only tilde stripping changed things
            changed = cleaned_list != original
            if changed:
                f_affected += 1
                f_cleaned += n_removed
                fact["distractors"] = cleaned_list

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return {
        "file": path.name,
        "meaning": {
            "facts": len(meaning_facts),
            "facts_affected": m_affected,
            "distractors_cleaned": m_cleaned,
            "distractors_refilled": m_refilled,
        },
        "recall": {
            "facts": len(recall_facts),
            "facts_affected": r_affected,
            "distractors_cleaned": r_cleaned,
        },
        "fill": {
            "facts": len(fill_facts),
            "facts_affected": f_affected,
            "distractors_cleaned": f_cleaned,
        },
    }


# ---------------------------------------------------------------------------
# Pass 1: Fix truncated grammar meaning correctAnswer fields
# ---------------------------------------------------------------------------

# Trailing fragments that indicate a truncated answer — ordered longest-first so
# multi-word fragments are matched before their sub-strings (e.g. "although an"
# before "an ").
_TRAILING_FRAGMENTS = [
    "Such-and-such an",
    "although an",
    "during a",
    "gives a",
    "As in",
    "being",
    "an ",
    "a ",
]


def _ends_with_trailing_fragment(s: str) -> str | None:
    """Return the matched trailing fragment if s ends with a dangling clause fragment.

    Requires the fragment to be preceded by whitespace, punctuation, or start-of-
    string to avoid false positives (e.g. 'via' ending in 'a').
    Returns the matched fragment string, or None if no match.
    """
    stripped = s.rstrip()
    for frag in _TRAILING_FRAGMENTS:
        frag_s = frag.rstrip()
        if not stripped.endswith(frag_s):
            continue
        pos = len(stripped) - len(frag_s)
        if pos == 0:
            return frag
        before = stripped[pos - 1]
        if before in (" ", ",", ";", "-", "."):
            return frag
    return None


def _fix_truncated_answer(answer: str) -> str:
    """Fix a truncated correctAnswer string using three sub-rules.

    Rule A: '(' without ')' → truncate at '('.
    Rule B: ends with a dangling fragment → cut at last ',' or ';' before it.
    Rule C: contains '__' placeholder → remove the placeholder section.

    After truncation: strip trailing commas/semicolons/whitespace.
    """
    answer = answer.strip()

    # Rule A: unclosed parenthetical
    if "(" in answer and ")" not in answer:
        answer = answer[: answer.index("(")].rstrip(", ").strip()

    # Rule C: placeholder section — remove from the first __ occurrence backward
    # to the nearest clause boundary, or drop the entire tail.
    if "__" in answer:
        idx = answer.index("__")
        # Find the last clause boundary before the placeholder
        before = answer[:idx]
        cut = max(before.rfind(","), before.rfind(";"))
        if cut > 0:
            answer = answer[:cut].strip()
        else:
            # No clean boundary — drop everything from the placeholder onward
            answer = before.rstrip(", ").strip()

    # Rule B: dangling trailing fragment
    matched = _ends_with_trailing_fragment(answer)
    if matched:
        # Find the last ',' or ';' before the trailing fragment
        frag_s = matched.rstrip()
        pos = answer.rstrip().rfind(frag_s)
        before = answer[:pos]
        cut = max(before.rfind(","), before.rfind(";"))
        if cut > 0:
            answer = answer[:cut].strip()
        else:
            # No comma/semicolon — drop the entire fragment tail
            answer = before.rstrip(", ;-").strip()

    # Final cleanup: strip trailing punctuation artifacts
    answer = answer.rstrip(", ;").strip()

    return answer


def fix_truncated_grammar_answers(path: Path) -> dict:
    """Pass 1: Fix truncated correctAnswer fields for -meaning facts.

    Applies _fix_truncated_answer() to each meaning fact whose correctAnswer
    matches one of the three truncation patterns, then syncs the statement field.
    Returns stats dict.
    """
    data: list[dict] = json.loads(path.read_text(encoding="utf-8"))

    fixed = 0
    warned = 0

    for fact in data:
        if not fact["id"].endswith("-meaning"):
            continue

        original = fact.get("correctAnswer", "")
        needs_fix = (
            ("(" in original and ")" not in original)
            or "__" in original
            or _ends_with_trailing_fragment(original) is not None
        )
        if not needs_fix:
            continue

        corrected = _fix_truncated_answer(original)

        if len(corrected) < 3:
            print(
                f"  WARNING: fix_truncated_grammar_answers: {fact['id']} "
                f"result too short after fix: {repr(corrected)} (was {repr(original)})"
            )
            warned += 1
            continue

        if corrected != original:
            # Update correctAnswer
            fact["correctAnswer"] = corrected
            # Sync statement: replace the old quoted answer in the statement
            old_stmt = fact.get("statement", "")
            if repr(original)[1:-1] in old_stmt or original in old_stmt:
                fact["statement"] = old_stmt.replace(original, corrected, 1)
            fixed += 1
            print(f"  FIX {fact['id']}: {repr(original)} → {repr(corrected)}")

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return {"fixed": fixed, "warned": warned}


# ---------------------------------------------------------------------------
# Pass 2: Remove template placeholder distractors (__ in any grammar fact)
# ---------------------------------------------------------------------------

_PLACEHOLDER_RE = re.compile(r"__")  # matches __ (double+ underscores too)


def remove_placeholder_distractors(path: Path) -> dict:
    """Pass 2: Remove any distractor containing '__' from ALL grammar facts.

    After removal, meaning facts with <5 distractors are refilled from the
    same-level meaning pool.
    Returns stats dict.
    """
    data: list[dict] = json.loads(path.read_text(encoding="utf-8"))

    # Build per-level meaning pools (original correct answers, pre-removal)
    meaning_pools: dict[str, list[str]] = defaultdict(list)
    for f in data:
        if f["id"].endswith("-meaning"):
            lv = f.get("jlptLevel", "")
            if lv:
                meaning_pools[lv].append(f["correctAnswer"])

    total_removed = 0
    facts_affected = 0
    total_refilled = 0

    for fact in data:
        original = list(fact.get("distractors", []))
        cleaned = [d for d in original if not _PLACEHOLDER_RE.search(d)]
        n_removed = len(original) - len(cleaned)

        if n_removed == 0:
            continue

        total_removed += n_removed
        facts_affected += 1

        # Refill meaning facts that drop below 5 distractors
        if fact["id"].endswith("-meaning"):
            lv = fact.get("jlptLevel", "")
            pool = meaning_pools.get(lv, [])
            cleaned, n_added = _refill_distractors(
                cleaned, fact.get("correctAnswer", ""), pool, target=5
            )
            total_refilled += n_added

        fact["distractors"] = cleaned

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return {
        "distractors_removed": total_removed,
        "facts_affected": facts_affected,
        "distractors_refilled": total_refilled,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    random.seed(42)  # Reproducible refill ordering

    print("=" * 60)
    print("clean-distractors.py — Kanji + Grammar distractor cleanup")
    print("=" * 60)

    # ---- Kanji ----
    print("\n[KANJI]")
    kanji_totals = {"facts": 0, "facts_affected": 0, "cleaned": 0, "refilled": 0}
    for level_key, path in KANJI_FILES.items():
        if not path.exists():
            print(f"  SKIP {path.name} (not found)")
            continue
        stats = process_kanji_file(path, level_key)
        print(
            f"  {stats['file']:25s}  facts={stats['facts']:4d}  "
            f"affected={stats['facts_affected']:4d}  "
            f"cleaned={stats['distractors_cleaned']:4d}  "
            f"refilled={stats['distractors_refilled']:3d}"
        )
        kanji_totals["facts"] += stats["facts"]
        kanji_totals["facts_affected"] += stats["facts_affected"]
        kanji_totals["cleaned"] += stats["distractors_cleaned"]
        kanji_totals["refilled"] += stats["distractors_refilled"]

    print(
        f"  {'TOTAL':25s}  facts={kanji_totals['facts']:4d}  "
        f"affected={kanji_totals['facts_affected']:4d}  "
        f"cleaned={kanji_totals['cleaned']:4d}  "
        f"refilled={kanji_totals['refilled']:3d}"
    )

    # ---- Grammar ----
    print("\n[GRAMMAR]")
    if not GRAMMAR_FILE.exists():
        print(f"  SKIP {GRAMMAR_FILE.name} (not found)")
    else:
        gs = process_grammar_file(GRAMMAR_FILE)
        m = gs["meaning"]
        r = gs["recall"]
        f = gs["fill"]
        print(f"  {gs['file']}")
        print(
            f"    meaning : facts={m['facts']:4d}  affected={m['facts_affected']:4d}  "
            f"cleaned={m['distractors_cleaned']:4d}  refilled={m['distractors_refilled']:3d}"
        )
        print(
            f"    recall  : facts={r['facts']:4d}  affected={r['facts_affected']:4d}  "
            f"cleaned={r['distractors_cleaned']:4d}"
        )
        print(
            f"    fill    : facts={f['facts']:4d}  affected={f['facts_affected']:4d}  "
            f"cleaned={f['distractors_cleaned']:4d}"
        )

        # ---- Grammar Pass 1: Fix truncated meaning correctAnswer fields ----
        print("\n[GRAMMAR PASS 1 — Fix truncated meaning answers]")
        p1 = fix_truncated_grammar_answers(GRAMMAR_FILE)
        print(
            f"  fixed={p1['fixed']}  warnings={p1['warned']}"
        )

        # ---- Grammar Pass 2: Remove placeholder distractors ----
        print("\n[GRAMMAR PASS 2 — Remove placeholder distractors]")
        p2 = remove_placeholder_distractors(GRAMMAR_FILE)
        print(
            f"  distractors_removed={p2['distractors_removed']}  "
            f"facts_affected={p2['facts_affected']}  "
            f"refilled={p2['distractors_refilled']}"
        )

    print("\nDone. Source files updated. Run DB rebuild separately.")


if __name__ == "__main__":
    main()

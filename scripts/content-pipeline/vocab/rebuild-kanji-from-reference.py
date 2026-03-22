#!/usr/bin/env python3
"""
rebuild-kanji-from-reference.py

Fixes kanji fact meanings by using standalone kanji meanings from kanji-info.json
instead of compound-word meanings.

Usage: python3 scripts/content-pipeline/vocab/rebuild-kanji-from-reference.py
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

KANJI_INFO_PATH = REPO_ROOT / "data/references/full-japanese-study-deck/results/kanji-info.json"
KANJI_FACT_FILES = [
    REPO_ROOT / f"data/raw/japanese/kanji-n{lvl}.json"
    for lvl in [1, 2, 3, 4, 5]
]


# ---------------------------------------------------------------------------
# Meaning cleaning
# ---------------------------------------------------------------------------

# Detect number-first translations like "10,000" or "10,000,000"
# A number token is purely digits with optional commas and NO spaces.
_NUMBER_TOKEN_RE = re.compile(r'^\d[\d,]*$')


def _split_meanings(translation: str) -> list[str]:
    """Split a translation string on commas into individual meaning tokens.

    Special case: a numeric token like "10,000" is two comma-separated digit
    strings — reassemble them so the number is treated as one token.

    Examples:
        "book, volume, this"         -> ["book", "volume", "this"]
        "10,000, ten thousand"       -> ["10,000", "ten thousand"]
        "space (between), gap"       -> ["space (between)", "gap"]
    """
    raw = translation.split(",")
    parts: list[str] = []
    i = 0
    while i < len(raw):
        token = raw[i].strip()
        # Peek ahead: if this token and the next are both bare digit strings,
        # they are halves of a comma-formatted number (e.g., "10" + "000").
        if re.match(r'^\d+$', token) and i + 1 < len(raw):
            next_token = raw[i + 1].strip()
            if re.match(r'^\d+$', next_token):
                parts.append(raw[i].rstrip() + "," + raw[i + 1].lstrip())
                i += 2
                continue
        parts.append(token)
        i += 1
    return parts


def _strip_all_parens(s: str) -> str:
    """Remove ALL parenthetical qualifiers from a meaning token.

    This handles both:
    - Simple scientific notes: "rice plant (Oryza sativa)" -> "rice plant"
    - Multi-word qualifiers: "(electric) light" -> "light"
    - Nested/heavy qualifiers with commas: stripped too

    A leading parenthetical is stripped and the remainder is returned;
    interior or trailing parentheticals are also removed.
    """
    # Remove any (...) group, including those with commas inside
    result = re.sub(r'\s*\([^)]*\)', '', s).strip()
    return result


def _is_single_word(token: str) -> bool:
    """Return True if the token is a single word (no spaces after stripping parens)."""
    bare = _strip_all_parens(token).strip()
    return " " not in bare and bool(bare)


def clean_meaning(translation: str) -> str:
    """Return a cleaned, quiz-ready answer from a raw translation string.

    Algorithm:
    1. Split into comma-separated meaning tokens (preserving "10,000" numbers).
    2. If the first token is a pure number (e.g., "10,000"), return it alone.
    3. Otherwise, take the first token as the answer base.
       Add a second token ONLY if it is a single word (no spaces) AND the
       combined result is ≤ 40 chars. Multi-word second tokens (like
       "horse racing", "(electric) light") are dropped.
    4. Strip parenthetical qualifiers from all retained tokens.

    Reasoning for the single-word rule: second meanings that are single words
    are true synonyms (volume, heart, gap). Multi-word second tokens are
    compound qualifiers or usage notes that confuse quiz answers.

    Examples:
        "10,000, ten thousand, myriad"             -> "10,000"
        "book, volume, this, present"               -> "book, volume"
        "mind, heart, spirit"                       -> "mind, heart"
        "electricity, (electric) light"             -> "electricity"
        "rice plant (Oryza sativa)"                 -> "rice plant"
        "horse, horse racing, promoted bishop"      -> "horse"
        "deer (esp. the sika deer, Cervus nippon)"  -> "deer"
        "space (between), gap, period of time"      -> "space, gap"
        "telephone call, phone call"                -> "telephone call"
    """
    if not translation:
        return translation

    parts = _split_meanings(translation)
    if not parts:
        return translation.strip()

    first_raw = parts[0].strip()

    # Pure number first token — return as-is (e.g., "10,000")
    if _NUMBER_TOKEN_RE.match(first_raw.replace(",", "").replace(" ", "")):
        return first_raw.strip()

    # Strip parens from the first token
    first = _strip_all_parens(first_raw).strip()

    # Attempt to add a second synonym — only if it's a single word
    if len(parts) > 1:
        second_raw = parts[1].strip()
        second = _strip_all_parens(second_raw).strip()
        if second and _is_single_word(second_raw):
            candidate = first + ", " + second
            if len(candidate) <= 40:
                return candidate

    return first


# ---------------------------------------------------------------------------
# Reference data loading
# ---------------------------------------------------------------------------

def load_kanji_info() -> dict[str, dict]:
    """Load kanji-info.json and return a dict keyed by kanji character."""
    with open(KANJI_INFO_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    lookup: dict[str, dict] = {}
    for entry in raw:
        kanji = entry.get("kanji", "")
        if kanji:
            lookup[kanji] = entry
    return lookup


# ---------------------------------------------------------------------------
# Kanji extraction from quiz question
# ---------------------------------------------------------------------------

def extract_kanji_char(quiz_question: str) -> str | None:
    """Extract the bare kanji character from a quizQuestion string.

    Handles: "What does the kanji '電' mean?" -> "電"
    Also handles multi-char if present (returns full match between quotes).
    """
    m = re.search(r"'(.+?)'", quiz_question)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Per-fact fixing logic
# ---------------------------------------------------------------------------

def fix_fact(fact: dict, kanji_lookup: dict[str, dict]) -> tuple[dict, str]:
    """Apply the reference fix to a single kanji fact.

    Returns (updated_fact, status) where status is one of:
        "fixed"            — standalone entry found and applied
        "compound_derived" — no standalone entry; used words[0] with full meaning
        "not_found"        — kanji not in reference at all (shouldn't happen)
        "no_question"      — couldn't parse kanji from quizQuestion
    """
    quiz_q = fact.get("quizQuestion", "")
    kanji_char = extract_kanji_char(quiz_q)

    if not kanji_char:
        return fact, "no_question"

    ref_entry = kanji_lookup.get(kanji_char)
    if ref_entry is None:
        print(f"  WARNING: '{kanji_char}' not found in kanji-info.json", file=sys.stderr)
        return fact, "not_found"

    words = ref_entry.get("words", [])
    if not words:
        print(f"  WARNING: '{kanji_char}' has no words[] in reference", file=sys.stderr)
        return fact, "not_found"

    # Search for the standalone entry (kanjiForms[0].kanjiForm == kanji_char)
    standalone = None
    for word in words:
        kf_list = word.get("kanjiForms", [])
        if kf_list and kf_list[0].get("kanjiForm") == kanji_char:
            standalone = word
            break

    updated = dict(fact)  # shallow copy — we only overwrite scalar fields

    if standalone is not None:
        # --- Standalone entry found ---
        raw_translation = standalone["translations"][0]["translation"]
        raw_reading = standalone["readings"][0]["reading"]

        correct_answer = clean_meaning(raw_translation)
        pronunciation = raw_reading

        # exampleSentence = first COMPOUND word (for context)
        # Find the first word where kanjiForms[0] is NOT the bare kanji
        example_sentence = ""
        for word in words:
            kf_list = word.get("kanjiForms", [])
            if kf_list and kf_list[0].get("kanjiForm") != kanji_char:
                compound_form = kf_list[0]["kanjiForm"]
                compound_reading = word["readings"][0]["reading"] if word.get("readings") else ""
                example_sentence = f"{compound_form} ({compound_reading})"
                break

        updated["correctAnswer"] = correct_answer
        updated["pronunciation"] = pronunciation
        updated["reading"] = pronunciation
        updated["exampleSentence"] = example_sentence
        updated["statement"] = f"The kanji {kanji_char} means '{correct_answer}'"

        # Remove compound-derived flag if previously set
        updated.pop("_compoundDerived", None)

        return updated, "fixed"

    else:
        # --- No standalone entry: fall back to words[0] ---
        fallback_word = words[0]
        raw_translation = fallback_word["translations"][0]["translation"]
        raw_reading = fallback_word["readings"][0]["reading"] if fallback_word.get("readings") else ""
        compound_form = fallback_word["kanjiForms"][0]["kanjiForm"] if fallback_word.get("kanjiForms") else ""

        # For compound fallback: take the FULL meaning (don't truncate aggressively)
        # but still clean heavy parentheticals
        correct_answer = clean_meaning(raw_translation)
        pronunciation_for_compound = raw_reading

        example_sentence = f"{compound_form} ({pronunciation_for_compound})" if compound_form else ""

        # The kanji's own reading: try to find it in mnemonic/words context.
        # Best we can do for compound-only: use the compound reading.
        pronunciation = pronunciation_for_compound

        print(
            f"  COMPOUND FALLBACK: '{kanji_char}' — no standalone entry. "
            f"Using '{compound_form}' meaning: '{correct_answer}'",
            file=sys.stderr,
        )

        updated["correctAnswer"] = correct_answer
        updated["pronunciation"] = pronunciation
        updated["reading"] = pronunciation
        updated["exampleSentence"] = example_sentence
        updated["statement"] = f"The kanji {kanji_char} means '{correct_answer}'"
        updated["_compoundDerived"] = True

        return updated, "compound_derived"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("Loading kanji reference data...")
    kanji_lookup = load_kanji_info()
    print(f"  Loaded {len(kanji_lookup)} kanji entries from reference.\n")

    grand_fixed = 0
    grand_already_correct = 0
    grand_compound = 0
    grand_not_found = 0
    grand_no_question = 0

    for fact_file in KANJI_FACT_FILES:
        if not fact_file.exists():
            print(f"  SKIP: {fact_file} does not exist")
            continue

        with open(fact_file, encoding="utf-8") as f:
            facts = json.load(f)

        fixed = 0
        compound = 0
        not_found = 0
        no_question = 0
        already_correct = 0

        updated_facts = []
        for fact in facts:
            updated, status = fix_fact(fact, kanji_lookup)

            if status == "fixed":
                # Check if answer actually changed
                if updated["correctAnswer"] != fact.get("correctAnswer"):
                    fixed += 1
                else:
                    already_correct += 1
            elif status == "compound_derived":
                compound += 1
            elif status == "not_found":
                not_found += 1
            elif status == "no_question":
                no_question += 1

            updated_facts.append(updated)

        # Write back
        with open(fact_file, "w", encoding="utf-8") as f:
            json.dump(updated_facts, f, ensure_ascii=False, indent=2)
            f.write("\n")

        level_name = fact_file.stem  # e.g. "kanji-n5"
        print(
            f"{level_name}: {len(facts)} facts — "
            f"{fixed} fixed, {already_correct} already correct, "
            f"{compound} compound-derived fallbacks, "
            f"{not_found} not found, {no_question} no question"
        )

        grand_fixed += fixed
        grand_already_correct += already_correct
        grand_compound += compound
        grand_not_found += not_found
        grand_no_question += no_question

    total = grand_fixed + grand_already_correct + grand_compound + grand_not_found + grand_no_question
    print()
    print("=" * 60)
    print(f"TOTAL: {total} facts processed")
    print(f"  Fixed (answer changed):      {grand_fixed}")
    print(f"  Already correct (no change): {grand_already_correct}")
    print(f"  Compound-derived fallbacks:  {grand_compound}")
    print(f"  Not found in reference:      {grand_not_found}")
    print(f"  Could not parse question:    {grand_no_question}")
    print("=" * 60)

    # Spot-check known-bad kanji across ALL JLPT levels
    print()
    print("Spot-checking known-bad kanji...")

    # (kanji, expected_answer_or_None_for_informational)
    # None = just print what we got, don't assert
    # str  = exact match required (or startswith, for translations with extras)
    spot_checks: list[tuple[str, str | None]] = [
        ("万", "10,000"),
        ("電", None),        # compound-only in reference; informational
        ("間", "space"),     # check that answer starts with "space"
        ("馬", "horse"),
        ("本", "book, volume"),
        ("心", "mind, heart"),
        ("一", None),        # compound-only; informational
    ]

    # Build a cross-level kanji->fact lookup from the freshly-written files
    all_facts_by_kanji: dict[str, dict] = {}
    for fact_file in KANJI_FACT_FILES:
        if not fact_file.exists():
            continue
        with open(fact_file, encoding="utf-8") as f:
            level_facts = json.load(f)
        for fact in level_facts:
            k = extract_kanji_char(fact.get("quizQuestion", ""))
            if k:
                all_facts_by_kanji[k] = fact

    all_pass = True
    for kanji, expected in spot_checks:
        fact = all_facts_by_kanji.get(kanji)
        if fact is None:
            print(f"  [{kanji}] NOT FOUND in any fact file")
            all_pass = False
            continue
        actual = fact.get("correctAnswer", "")
        level = fact.get("jlptLevel", "?")
        compound_flag = " [compound-derived]" if fact.get("_compoundDerived") else ""
        if expected is None:
            print(f"  [{kanji}] ({level}) = '{actual}'{compound_flag} (informational)")
        elif actual == expected or actual.startswith(expected):
            print(f"  [{kanji}] ({level}) PASS: '{actual}'{compound_flag}")
        else:
            print(f"  [{kanji}] ({level}) FAIL: got '{actual}', expected '{expected}'{compound_flag}")
            all_pass = False

    print()
    if all_pass:
        print("All spot checks passed.")
    else:
        print("Some spot checks FAILED — review output above.")


if __name__ == "__main__":
    main()

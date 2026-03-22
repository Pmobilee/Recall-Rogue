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
KANJIDIC_PATH = REPO_ROOT / "data/references/kanji-data-davidluzgouveia.json"
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


def _split_on_top_level_commas(s: str) -> list[str]:
    """Split a string on commas that are NOT inside parentheses.

    This correctly handles:
        "deer (esp. the sika deer, Cervus nippon), cervid"
        -> ["deer (esp. the sika deer, Cervus nippon)", "cervid"]

        "space (between), gap"
        -> ["space (between)", "gap"]

        "10,000, ten thousand"
        -> ["10,000", "ten thousand"]   (number comma preserved — see below)
    """
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in s:
        if ch == "(":
            depth += 1
            current.append(ch)
        elif ch == ")":
            depth -= 1
            current.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    if current:
        parts.append("".join(current).strip())
    return [p for p in parts if p]


def _split_meanings(translation: str) -> list[str]:
    """Split a translation string into individual meaning tokens.

    First splits on top-level commas (respecting parentheses), then
    reassembles adjacent bare-digit tokens that form a number like "10,000".

    Examples:
        "book, volume, this"                             -> ["book", "volume", "this"]
        "10,000, ten thousand"                           -> ["10,000", "ten thousand"]
        "space (between), gap"                           -> ["space (between)", "gap"]
        "deer (esp. the sika deer, Cervus nippon), cervid" -> ["deer (esp. ...)", "cervid"]
    """
    raw = _split_on_top_level_commas(translation)
    parts: list[str] = []
    i = 0
    while i < len(raw):
        token = raw[i].strip()
        # Reassemble number tokens: "10" + "000" -> "10,000"
        if re.match(r'^\d+$', token) and i + 1 < len(raw):
            next_token = raw[i + 1].strip()
            if re.match(r'^\d+$', next_token):
                parts.append(token + "," + next_token)
                i += 2
                continue
        parts.append(token)
        i += 1
    return parts


def _strip_all_parens(s: str) -> str:
    """Remove ALL parenthetical qualifiers from a meaning token.

    Handles:
    - Trailing scientific notes: "rice plant (Oryza sativa)" -> "rice plant"
    - Leading adjective parens:  "(electric) light"          -> "light"
    - Multi-word qualifiers:     "deer (esp. ...)"           -> "deer"

    Uses iterative removal to handle back-to-back parens.
    """
    result = s
    # Remove parens and their contents repeatedly until stable
    prev = None
    while prev != result:
        prev = result
        result = re.sub(r'\s*\([^()]*\)', '', result).strip()
    return result


def _is_single_word(token: str) -> bool:
    """Return True if the token, after stripping all parens, is a single word.

    "(electric) light" has two words, so returns False.
    "volume" returns True.
    "horse racing" returns False.
    """
    bare = _strip_all_parens(token).strip()
    return " " not in bare and bool(bare)


def _is_leading_paren(token: str) -> bool:
    """Return True if the raw token starts with a parenthetical qualifier.

    e.g., "(electric) light" starts with "(" so the whole token is really a
    modified form of a word, not a clean standalone synonym.
    """
    return token.lstrip().startswith("(")


def clean_meaning(translation: str) -> str:
    """Return a cleaned, quiz-ready answer from a raw translation string.

    Algorithm:
    1. Split into meaning tokens on top-level commas (preserving parens and
       number commas like "10,000").
    2. If the first token is a pure number (e.g., "10,000"), return it alone.
    3. Strip all parenthetical qualifiers from the first token to get the base.
    4. Attempt to add a second synonym token if ALL of these hold:
       - It is a single bare word after stripping parens (no spaces)
       - It does NOT start with a parenthetical (no leading "(" tokens)
       - It is not a subset/prefix of the first meaning (avoids "human, human")
       - The combined string is ≤ 40 chars
    5. Return the result.

    Rationale for strictness on second token: quiz answers must be clean and
    unambiguous. "book, volume" is two true synonyms. "horse, horse racing" or
    "electricity, (electric) light" are not — the second is a usage note.

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
        "human being, human, person"                -> "human being"
        "perfection, flawlessness"                  -> "perfection, flawlessness"
    """
    if not translation:
        return translation

    parts = _split_meanings(translation)
    if not parts:
        return translation.strip()

    first_raw = parts[0].strip()

    # Pure number token — return as-is (e.g., "10,000")
    if _NUMBER_TOKEN_RE.match(first_raw.replace(",", "").replace(" ", "")):
        return first_raw.strip()

    # Clean the first token
    first = _strip_all_parens(first_raw).strip()

    # If the first token had a HEAVY paren (containing a comma, or > 12 chars),
    # it was a complex qualifier — don't append a second term.
    # Short simple parens like "(between)" are acceptable; they don't block the
    # second synonym.  e.g., "deer (esp. the sika deer, Cervus nippon)" is heavy;
    # "space (between)" is light.
    heavy_paren = re.search(r'\(([^)]{13,}|[^)]*,[^)]*)\)', first_raw)
    first_had_heavy_parens = bool(heavy_paren)

    # Attempt to include a second synonym
    if len(parts) > 1 and not first_had_heavy_parens:
        second_raw = parts[1].strip()

        # Skip if second starts with a leading paren (e.g., "(electric) light")
        if not _is_leading_paren(second_raw):
            second = _strip_all_parens(second_raw).strip()

            # Must be a genuine single-word synonym with no whole-word overlap
            # with the first meaning.  Use word-boundary check to avoid blocking
            # "day, days" while still blocking "human, human being".
            first_words = set(re.split(r'\W+', first.lower()))
            second_words = set(re.split(r'\W+', second.lower()))
            overlapping = first_words & second_words - {''}

            if (
                second
                and _is_single_word(second_raw)
                and not overlapping   # no shared whole words
            ):
                candidate = first + ", " + second
                if len(candidate) <= 40:
                    return candidate

    return first


# ---------------------------------------------------------------------------
# Reference data loading
# ---------------------------------------------------------------------------

def load_kanjidic() -> dict[str, dict]:
    """Load kanji-data-davidluzgouveia.json and return a dict keyed by kanji character."""
    with open(KANJIDIC_PATH, encoding="utf-8") as f:
        return json.load(f)


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

def fix_fact(fact: dict, kanji_lookup: dict[str, dict], kanjidic: dict[str, dict]) -> tuple[dict, str]:
    """Apply the reference fix to a single kanji fact.

    Returns (updated_fact, status) where status is one of:
        "fixed"             — standalone entry found and applied
        "kanjidic_derived"  — no standalone entry; used KANJIDIC meanings
        "compound_derived"  — no standalone or KANJIDIC entry; used words[0]
        "not_found"         — kanji not in reference at all (shouldn't happen)
        "no_question"       — couldn't parse kanji from quizQuestion
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

    # --- Step 1.5: KANJIDIC fallback ---
    kanjidic_entry = kanjidic.get(kanji_char)
    if kanjidic_entry is not None:
        kd_meanings: list[str] = kanjidic_entry.get("meanings", [])
        kd_kun: list[str] = kanjidic_entry.get("readings_kun", [])
        kd_on: list[str] = kanjidic_entry.get("readings_on", [])

        if kd_meanings:
            # Build correctAnswer: first 1-2 meanings, lowercase, joined by ", ", max 40 chars
            first_meaning = kd_meanings[0].lower()
            correct_answer = first_meaning
            if len(kd_meanings) > 1:
                second_meaning = kd_meanings[1].lower()
                candidate = first_meaning + ", " + second_meaning
                if len(candidate) <= 40:
                    correct_answer = candidate

            # Pronunciation: prefer on-yomi (standard standalone reading);
            # fall back to full kun-yomi only if no on readings exist.
            # For on readings: strip any stray dots (rare but possible).
            # For kun readings: keep the FULL form, just strip the dot notation
            # (e.g., "やす.む" -> "やすむ", not the truncated stem "やす").
            pronunciation = ""
            if kd_on:
                pronunciation = kd_on[0].replace('.', '').replace('-', '')
            elif kd_kun:
                pronunciation = kd_kun[0].replace('.', '')

            updated = dict(fact)
            updated["correctAnswer"] = correct_answer
            updated["pronunciation"] = pronunciation
            updated["reading"] = pronunciation
            updated["statement"] = f"The kanji {kanji_char} means '{correct_answer}'"
            # Clear compound-derived flag; mark as kanjidic-derived
            updated.pop("_compoundDerived", None)
            updated["_kanjidicDerived"] = True

            return updated, "kanjidic_derived"

    # --- Step 2: Last resort — fall back to words[0] ---
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

    updated = dict(fact)
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
    print(f"  Loaded {len(kanji_lookup)} kanji entries from kanji-info.json.")
    kanjidic = load_kanjidic()
    print(f"  Loaded {len(kanjidic)} kanji entries from KANJIDIC reference.\n")

    grand_fixed = 0
    grand_already_correct = 0
    grand_kanjidic = 0
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
        kanjidic_derived = 0
        compound = 0
        not_found = 0
        no_question = 0
        already_correct = 0

        updated_facts = []
        for fact in facts:
            updated, status = fix_fact(fact, kanji_lookup, kanjidic)

            if status == "fixed":
                # Check if answer actually changed
                if updated["correctAnswer"] != fact.get("correctAnswer"):
                    fixed += 1
                else:
                    already_correct += 1
            elif status == "kanjidic_derived":
                kanjidic_derived += 1
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
            f"{kanjidic_derived} KANJIDIC-derived, "
            f"{compound} compound-derived fallbacks, "
            f"{not_found} not found, {no_question} no question"
        )

        grand_fixed += fixed
        grand_already_correct += already_correct
        grand_kanjidic += kanjidic_derived
        grand_compound += compound
        grand_not_found += not_found
        grand_no_question += no_question

    total = grand_fixed + grand_already_correct + grand_kanjidic + grand_compound + grand_not_found + grand_no_question
    print()
    print("=" * 60)
    print(f"TOTAL: {total} facts processed")
    print(f"  Fixed (answer changed):      {grand_fixed}")
    print(f"  Already correct (no change): {grand_already_correct}")
    print(f"  KANJIDIC-derived:            {grand_kanjidic}")
    print(f"  Compound-derived fallbacks:  {grand_compound}")
    print(f"  Not found in reference:      {grand_not_found}")
    print(f"  Could not parse question:    {grand_no_question}")
    print("=" * 60)

    # ---------------------------------------------------------------------------
    # Distractor cleanup pass
    # ---------------------------------------------------------------------------
    # Stale distractors from the old meanings may now match the current
    # correctAnswer of this or another kanji.  For each fact:
    #   1. Remove any distractor that exactly matches THIS fact's correctAnswer.
    #   2. If fewer than 5 distractors remain, fill from the same-level meaning
    #      pool (all other correctAnswer values at the same JLPT level), avoiding
    #      duplicates and avoiding the fact's own correctAnswer.
    # ---------------------------------------------------------------------------
    print()
    print("Running distractor cleanup pass...")

    grand_self_removed = 0
    grand_refilled = 0

    for fact_file in KANJI_FACT_FILES:
        if not fact_file.exists():
            continue

        with open(fact_file, encoding="utf-8") as f:
            facts = json.load(f)

        # Build the pool of all correctAnswer values at this level
        level_answers: list[str] = [
            fact["correctAnswer"] for fact in facts
            if fact.get("correctAnswer")
        ]

        self_removed_count = 0
        refilled_count = 0
        updated_facts = []

        for fact in facts:
            own_answer = fact.get("correctAnswer", "")
            distractors: list[str] = list(fact.get("distractors", []))

            # Step 1: Remove distractors that exactly match this fact's own answer
            cleaned = [d for d in distractors if d != own_answer]
            removed_self = len(distractors) - len(cleaned)
            self_removed_count += removed_self

            # Step 2: If fewer than 5, fill from same-level pool
            if len(cleaned) < 5:
                # Build a candidate pool: all level answers except own answer,
                # and not already in cleaned distractors
                existing_set = set(cleaned)
                candidates = [
                    a for a in level_answers
                    if a != own_answer and a not in existing_set
                ]
                # Deduplicate candidates while preserving order
                seen: set[str] = set()
                unique_candidates: list[str] = []
                for c in candidates:
                    if c not in seen:
                        seen.add(c)
                        unique_candidates.append(c)

                needed = 5 - len(cleaned)
                refill = unique_candidates[:needed]
                cleaned.extend(refill)
                if refill:
                    refilled_count += 1

            updated_fact = dict(fact)
            updated_fact["distractors"] = cleaned
            updated_facts.append(updated_fact)

        # Write back
        with open(fact_file, "w", encoding="utf-8") as f:
            json.dump(updated_facts, f, ensure_ascii=False, indent=2)
            f.write("\n")

        level_name = fact_file.stem
        print(
            f"  {level_name}: {self_removed_count} self-matching distractors removed, "
            f"{refilled_count} facts refilled from level pool"
        )
        grand_self_removed += self_removed_count
        grand_refilled += refilled_count

    print(f"  Total self-matching distractors removed: {grand_self_removed}")
    print(f"  Total facts refilled:                    {grand_refilled}")

    # Spot-check known-bad kanji across ALL JLPT levels
    print()
    print("Spot-checking known-bad kanji and pronunciations...")

    # (kanji, expected_answer_or_None_for_informational, expected_pronunciation_or_None)
    # None = just print what we got, don't assert
    # str  = exact match required (or startswith, for translations with extras)
    spot_checks: list[tuple[str, str | None, str | None]] = [
        ("万", "10,000",              None),
        ("電", "electricity",         None),   # KANJIDIC: meanings=["Electricity"]
        ("間", "space",               None),   # check that answer starts with "space"
        ("馬", "horse",               None),
        ("本", "book, volume",        None),
        ("心", "mind, heart",         None),
        ("一", None,                  None),   # compound-only; informational
        # KANJIDIC verification kanji
        ("案", "plan, suggestion",    None),   # KANJIDIC: ["Plan", "Suggestion", ...]
        ("発", "departure, discharge",None),   # KANJIDIC: ["Departure", "Discharge", ...]
        ("真", "true, reality",       None),   # KANJIDIC: ["True", "Reality", ...]
        ("計", "plot, plan",          None),   # KANJIDIC: ["Plot", "Plan", ...]
        # Pronunciation checks: on-yomi should now win for KANJIDIC-derived kanji
        ("休", None,                  "きゅう"),  # was "やす" (bare stem), now on-yomi
        ("入", None,                  "にゅう"),  # was "い" (bare stem), now on-yomi
        ("出", None,                  "しゅつ"),  # was "で" (bare stem), now on-yomi
        ("来", None,                  "らい"),    # was "く" (bare stem), now on-yomi
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
    for kanji, expected, expected_pron in spot_checks:
        fact = all_facts_by_kanji.get(kanji)
        if fact is None:
            print(f"  [{kanji}] NOT FOUND in any fact file")
            all_pass = False
            continue
        actual = fact.get("correctAnswer", "")
        actual_pron = fact.get("pronunciation", "")
        level = fact.get("jlptLevel", "?")
        if fact.get("_compoundDerived"):
            source_flag = " [compound-derived]"
        elif fact.get("_kanjidicDerived"):
            source_flag = " [kanjidic-derived]"
        else:
            source_flag = ""

        # Check correctAnswer
        if expected is None:
            print(f"  [{kanji}] ({level}) answer='{actual}' pron='{actual_pron}'{source_flag} (informational)")
        elif actual == expected or actual.startswith(expected):
            print(f"  [{kanji}] ({level}) PASS answer: '{actual}'{source_flag}")
        else:
            print(f"  [{kanji}] ({level}) FAIL answer: got '{actual}', expected '{expected}'{source_flag}")
            all_pass = False

        # Check pronunciation if specified
        if expected_pron is not None:
            if actual_pron == expected_pron:
                print(f"  [{kanji}] ({level}) PASS pron:   '{actual_pron}'")
            else:
                print(f"  [{kanji}] ({level}) FAIL pron:   got '{actual_pron}', expected '{expected_pron}'")
                all_pass = False

    print()
    if all_pass:
        print("All spot checks passed.")
    else:
        print("Some spot checks FAILED — review output above.")


if __name__ == "__main__":
    main()

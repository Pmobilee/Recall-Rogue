#!/usr/bin/env python3
"""fix-answer-quality.py — Clean grammar and vocab answer quality issues.

Grammar fixes (grammar-ja.json):
  - Strip outer parentheses from -meaning correctAnswer fields
  - Remove Japanese characters from English answers
  - Strip "(also shown as ...)" parentheticals
  - Strip "(with -ve)" type meta-annotations
  - Remove [bracket] style annotations
  - Clean numbered lists: take first group only
  - Truncate at 50 chars on last ; or , boundary
  - Update statement field to match corrected correctAnswer
  - Fill facts: strip 〜 prefix from correctAnswer

Vocab fixes (vocab-ja.json):
  - Apply hardcoded VOCAB_CORRECTIONS map for known-bad answers
  - Truncate answers > 40 chars at last ; or , boundary
  - Strip trailing whitespace
  - Update statement field to match corrected correctAnswer
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
GRAMMAR_FILE = REPO_ROOT / "src/data/seed/grammar-ja.json"
VOCAB_FILE = REPO_ROOT / "src/data/seed/vocab-ja.json"

# ---------------------------------------------------------------------------
# Hardcoded vocab corrections (known-bad answers verified by audit)
# ---------------------------------------------------------------------------

VOCAB_CORRECTIONS = {
    # N2 critical
    "ja-jlpt-4069": {"correctAnswer": "(not) very, (not) so much"},   # 大して — was "very" (opposite!)
    "ja-jlpt-3373": {"correctAnswer": "to do completely, to finish"},  # ～きる — was "nevertheless"
    "ja-jlpt-4251": {"correctAnswer": "surroundings, vicinity"},       # 周辺 — was "circumference"
    # N3 issues
    "ja-jlpt-2490": {"correctAnswer": "surely not, no way"},           # まさか — was "by no means"
    "ja-jlpt-2954": {"correctAnswer": "understanding, being convinced"}, # 納得 — was "consent"
    "ja-jlpt-2152": {"correctAnswer": "discrimination"},               # 差別 — was "distinction"
    "ja-jlpt-1184": {"correctAnswer": "in the unlikely event"},        # 万一 — was "emergency"
    "ja-jlpt-2061": {"correctAnswer": "to appeal, to sue"},            # 訴える — was "to raise"
    "ja-jlpt-2813": {"correctAnswer": "to let pass, to put through"},  # 通す — was "to stick through"
    "ja-jlpt-1695": {"correctAnswer": "fire, blaze"},                  # 火災 — was "conflagration"
    "ja-jlpt-2095": {"correctAnswer": "to panic, to be flustered"},    # 慌てる — was "to become confused"
    # N2 medium
    "ja-jlpt-4425": {"correctAnswer": "performance, capability"},      # 性能 — was "ability"
    "ja-jlpt-4028": {"correctAnswer": "wording, language use"},        # 言葉遣い — was "speech"
    "ja-jlpt-3407": {"correctAnswer": "clothing, food, shelter"},      # 衣食住 — was wrong order
    # N1 issues
    "ja-jlpt-7378": {"correctAnswer": "to recruit, to intensify"},     # 募る — was "to become stronger"
    "ja-jlpt-6666": {"correctAnswer": "setting, configuration"},       # 設定 — was "establishment"
    "ja-jlpt-7296": {"correctAnswer": "manners, customs"},             # 風俗 — keep neutral
    "ja-jlpt-7628": {"correctAnswer": "understood, acknowledgment"},   # 了解 — was "comprehension"
    "ja-jlpt-6148": {"correctAnswer": "recurrence, relapse"},          # 再発 — was "return"
    "ja-jlpt-7384": {"correctAnswer": "anticlimactic, over too quickly"}, # 呆気ない — was "not enough"
    "ja-jlpt-7395": {"correctAnswer": "to dedicate, to devote"},       # 捧げる — was "to lift up"
}

# ---------------------------------------------------------------------------
# Grammar answer cleaning functions
# ---------------------------------------------------------------------------

def has_japanese(text: str) -> bool:
    """Return True if text contains actual Japanese script (CJK/kana characters).

    Excludes wave dash 〜 (U+301C) which is used as a valid grammar pattern prefix.
    Does NOT flag fullwidth punctuation alone — that is handled separately in stripping.
    """
    for ch in text:
        cp = ord(ch)
        # CJK unified ideographs, hiragana, katakana
        if (0x4E00 <= cp <= 0x9FFF or
                0x3040 <= cp <= 0x309F or
                0x30A0 <= cp <= 0x30FF):
            return True
    return False


def strip_japanese_chars(text: str) -> str:
    """Remove Japanese script and leftover fullwidth punctuation from text.

    Only call this when has_japanese() returns True (i.e. actual CJK/kana is present).

    Removes:
    - CJK unified ideographs (U+4E00–U+9FFF)
    - Hiragana (U+3040–U+309F)
    - Katakana (U+30A0–U+30FF)
    - Ideographic space U+3000
    - Fullwidth ASCII variants (U+FF01–U+FFEE) — artifacts left after CJK removal
      EXCEPTION: wave dash 〜 (U+301C) is kept — it's a valid grammar pattern marker

    After removal, cleans up orphaned parentheses and excess punctuation.
    """
    result = []
    skip_cps = set()
    for ch in text:
        cp = ord(ch)
        if (0x4E00 <= cp <= 0x9FFF or   # CJK ideographs
                0x3040 <= cp <= 0x309F or   # Hiragana
                0x30A0 <= cp <= 0x30FF or   # Katakana
                cp == 0x3000 or             # Ideographic space
                0xFF01 <= cp <= 0xFFEE):    # Fullwidth ASCII (excl. wave dash 301C)
            continue
        result.append(ch)
    cleaned = ''.join(result)
    # Remove empty parentheses left behind: "()", "( )", "(  )" etc.
    cleaned = re.sub(r'\(\s*\)', '', cleaned)
    # Remove parentheses that contain only separators, slashes, spaces, or wave-dash
    # e.g. "(/V" from "(名詞＋V)" after stripping, or "(〜" from "(〜そう)"
    cleaned = re.sub(r'\(\s*[;,/\s〜~]+\s*\)', '', cleaned)
    # Remove orphaned opening parens at end of string: "phrase (" -> "phrase"
    cleaned = re.sub(r'\s*\(\s*$', '', cleaned)
    # Remove orphaned opening paren followed only by wave-dash (and no closing paren)
    # e.g. "Ab, seems (〜" -> "Ab, seems"
    cleaned = re.sub(r'\s*\(\s*[〜~]\s*$', '', cleaned)
    # Remove orphaned closing parens at start of string
    cleaned = re.sub(r'^\s*\)', '', cleaned)
    # Remove trailing slash or isolated short tokens left by stripping: "...(/V" -> "..."
    cleaned = re.sub(r'\(\s*/\s*\w{0,3}\s*$', '', cleaned)
    # Collapse multiple spaces and strip
    return re.sub(r'  +', ' ', cleaned).strip()


def strip_outer_parens(text: str) -> str:
    """Strip wrapping parentheses if the entire string is wrapped: (foo) -> foo."""
    text = text.strip()
    if text.startswith('(') and text.endswith(')'):
        # Make sure there's no inner unmatched paren that would mean it's not truly outer
        inner = text[1:-1]
        depth = 0
        for ch in inner:
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            if depth < 0:
                # Closing a paren that wasn't opened inside — means outer parens don't wrap all
                return text
        return inner.strip()
    return text


def strip_also_shown_as(text: str) -> str:
    """Remove '(also shown as ...)' parentheticals."""
    return re.sub(r'\s*\(also shown as[^)]*\)', '', text, flags=re.IGNORECASE).strip()


def strip_with_ve(text: str) -> str:
    """Remove '(with -ve)' style meta-annotations."""
    return re.sub(r'\s*\(with\s*-ve\)', '', text, flags=re.IGNORECASE).strip()


def strip_bracket_annotations(text: str) -> str:
    """Remove [bracket] annotations like [action], [verb], [F], [M]."""
    return re.sub(r'\s*\[[^\]]*\]', '', text).strip()


def extract_first_numbered_group(text: str) -> str:
    """If text starts with '1)' pattern, extract only the first group.

    E.g.: '1) just, only; 2) as much as...' -> 'just, only'
    """
    m = re.match(r'^1\)\s*(.+?)(?:\s*;\s*2\).*)?$', text, re.DOTALL)
    if m:
        return m.group(1).strip()
    return text


def smart_truncate(text: str, max_len: int) -> str:
    """Truncate text at last ; or , before max_len chars. Don't break mid-word."""
    if len(text) <= max_len:
        return text
    # Search backward from max_len for a ; or ,
    sub = text[:max_len]
    # Try ; first (higher-level separator), then ,
    last_semi = sub.rfind(';')
    last_comma = sub.rfind(',')
    cut = max(last_semi, last_comma)
    if cut > 0:
        return text[:cut].rstrip()
    # Fallback: cut at last space to avoid breaking a word
    last_space = sub.rfind(' ')
    if last_space > 0:
        return text[:last_space].rstrip()
    return sub.rstrip()


def clean_grammar_meaning_answer(answer: str) -> str:
    """Apply all grammar cleanup rules to a -meaning correctAnswer."""
    text = answer.strip()

    # 1. Remove Japanese characters in English answers
    if has_japanese(text):
        text = strip_japanese_chars(text)

    # 2. Strip "(also shown as ...)" parentheticals
    text = strip_also_shown_as(text)

    # 3. Strip "(with -ve)" type meta-annotations
    text = strip_with_ve(text)

    # 4. Remove [bracket] style annotations
    text = strip_bracket_annotations(text)

    # 5. Clean numbered lists — take first group only
    text = extract_first_numbered_group(text)

    # 6. Strip outer parentheses (after other cleanup since those may have changed shape)
    text = strip_outer_parens(text)

    # 7. Truncate at 50 chars on last ; or , boundary
    text = smart_truncate(text, 50)

    # Final cleanup — strip trailing separators and whitespace, clean any empty parens
    # that may have been left by other rules (e.g. Japanese stripping inside parens)
    text = text.strip()
    text = re.sub(r'\(\s*\)', '', text)   # clean empty parens
    text = re.sub(r'  +', ' ', text)      # collapse spaces
    text = text.strip().rstrip(';').rstrip(',').strip()

    return text


# ---------------------------------------------------------------------------
# Statement updater
# ---------------------------------------------------------------------------

def update_grammar_statement(statement: str, old_answer: str, new_answer: str) -> str:
    """Update the statement field to embed the new correctAnswer.

    Grammar statements have the pattern:
      "The grammar pattern X means 'OLD_ANSWER'"
    We replace the quoted answer portion.
    """
    if old_answer == new_answer:
        return statement
    # Pattern: means 'OLD' or means "OLD"
    # Use re.escape so special chars in old_answer don't break the pattern
    escaped_old = re.escape(old_answer)
    # Try single-quote wrapping
    result = re.sub(
        r"(means\s+['\"])" + escaped_old + r"(['\"])",
        r"\g<1>" + new_answer.replace('\\', '\\\\') + r"\g<2>",
        statement
    )
    if result != statement:
        return result
    # Fallback: direct string replace (for statements where answer appears verbatim)
    if old_answer in statement:
        return statement.replace(old_answer, new_answer, 1)
    return statement


def update_vocab_statement(statement: str, old_answer: str, new_answer: str) -> str:
    """Update the statement field for a vocab fact.

    Vocab statements have the pattern:
      'WORD (reading) means "OLD_ANSWER" in Japanese'
    We replace the quoted answer portion.
    """
    if old_answer == new_answer:
        return statement
    escaped_old = re.escape(old_answer)
    # Try double-quote wrapping
    result = re.sub(
        r'(means\s+")' + escaped_old + r'(")',
        r'\g<1>' + new_answer.replace('\\', '\\\\') + r'\g<2>',
        statement
    )
    if result != statement:
        return result
    # Fallback: direct replace
    if old_answer in statement:
        return statement.replace(old_answer, new_answer, 1)
    return statement


# ---------------------------------------------------------------------------
# Grammar processing
# ---------------------------------------------------------------------------

def is_meaning_fact(fid: str) -> bool:
    """Return True if this fact ID represents a meaning-type fact.

    Handles both formats:
    - New expanded format: IDs ending in '-meaning' (e.g. 'ja-grammar-n5-002-meaning')
    - Old bare format: IDs with no variant suffix (e.g. 'ja-grammar-n5-002')
      In the old format all facts are meaning-type since fill/recall variants don't exist yet.
    """
    if fid.endswith("-meaning"):
        return True
    # Old format: no variant suffix — none of -meaning/-recall/-fill
    if not (fid.endswith("-recall") or fid.endswith("-fill")):
        return True
    return False


def process_grammar(facts: list) -> tuple[list, dict]:
    """Apply grammar cleanup rules. Returns (updated_facts, change_summary).

    Handles both old (bare ID, 644 facts) and new expanded (with -meaning/-recall/-fill
    suffixes, 1708 facts) grammar-ja.json formats.
    """
    changes = {
        "meaning_cleaned": 0,
        "fill_tilde_stripped": 0,
        "statement_updated": 0,
        "details": [],
    }

    updated = []
    for fact in facts:
        fact = dict(fact)  # shallow copy
        fid = fact.get("id", "")
        answer = fact.get("correctAnswer", "")
        statement = fact.get("statement", "")

        if is_meaning_fact(fid):
            new_answer = clean_grammar_meaning_answer(answer)
            if new_answer != answer:
                new_statement = update_grammar_statement(statement, answer, new_answer)
                changes["meaning_cleaned"] += 1
                if new_statement != statement:
                    changes["statement_updated"] += 1
                changes["details"].append({
                    "id": fid,
                    "type": "meaning",
                    "old": answer,
                    "new": new_answer,
                    "statement_changed": new_statement != statement,
                })
                fact["correctAnswer"] = new_answer
                fact["statement"] = new_statement

        elif fid.endswith("-fill"):
            # Fill answers should NOT have 〜 prefix
            if answer.startswith("〜"):
                new_answer = answer[1:].strip()
                new_statement = update_grammar_statement(statement, answer, new_answer)
                changes["fill_tilde_stripped"] += 1
                if new_statement != statement:
                    changes["statement_updated"] += 1
                changes["details"].append({
                    "id": fid,
                    "type": "fill-tilde",
                    "old": answer,
                    "new": new_answer,
                    "statement_changed": new_statement != statement,
                })
                fact["correctAnswer"] = new_answer
                fact["statement"] = new_statement

        # Recall answers intentionally keep 〜 prefix — no changes

        updated.append(fact)

    return updated, changes


# ---------------------------------------------------------------------------
# Vocab processing
# ---------------------------------------------------------------------------

def clean_vocab_answer(answer: str) -> str:
    """Apply general vocab cleanup: truncate at 40 chars on ; or , boundary, strip whitespace."""
    text = answer.strip()
    text = smart_truncate(text, 40)
    return text.strip()


def process_vocab(facts: list) -> tuple[list, dict]:
    """Apply vocab corrections and general cleanup. Returns (updated_facts, change_summary)."""
    changes = {
        "hardcoded_corrections": 0,
        "auto_truncated": 0,
        "statement_updated": 0,
        "not_found_ids": [],
        "details": [],
    }

    id_set = {f["id"] for f in facts}
    for fid in VOCAB_CORRECTIONS:
        if fid not in id_set:
            changes["not_found_ids"].append(fid)

    updated = []
    for fact in facts:
        fact = dict(fact)
        fid = fact.get("id", "")
        answer = fact.get("correctAnswer", "")
        statement = fact.get("statement", "")

        new_answer = answer

        # Apply hardcoded correction first (takes priority)
        if fid in VOCAB_CORRECTIONS:
            correction = VOCAB_CORRECTIONS[fid]
            corrected = correction["correctAnswer"]
            if corrected != answer:
                new_answer = corrected
                new_statement = update_vocab_statement(statement, answer, new_answer)
                changes["hardcoded_corrections"] += 1
                if new_statement != statement:
                    changes["statement_updated"] += 1
                changes["details"].append({
                    "id": fid,
                    "type": "hardcoded",
                    "old": answer,
                    "new": new_answer,
                    "statement_changed": new_statement != statement,
                })
                fact["correctAnswer"] = new_answer
                fact["statement"] = new_statement
                answer = new_answer
                statement = fact["statement"]

        # General cleanup: truncate long answers (applied to all, including after correction)
        cleaned = clean_vocab_answer(answer)
        if cleaned != answer:
            new_statement = update_vocab_statement(statement, answer, cleaned)
            changes["auto_truncated"] += 1
            if new_statement != statement:
                changes["statement_updated"] += 1
            changes["details"].append({
                "id": fid,
                "type": "truncated",
                "old": answer,
                "new": cleaned,
                "statement_changed": new_statement != statement,
            })
            fact["correctAnswer"] = cleaned
            fact["statement"] = new_statement

        updated.append(fact)

    return updated, changes


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def print_summary(label: str, changes: dict) -> None:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")

    if label.startswith("Grammar"):
        print(f"  Meaning answers cleaned:  {changes['meaning_cleaned']}")
        print(f"  Fill 〜 prefixes stripped: {changes['fill_tilde_stripped']}")
        print(f"  Statements updated:       {changes['statement_updated']}")
    else:
        print(f"  Hardcoded corrections:    {changes['hardcoded_corrections']}")
        print(f"  Auto-truncated (>40ch):   {changes['auto_truncated']}")
        print(f"  Statements updated:       {changes['statement_updated']}")
        if changes["not_found_ids"]:
            print(f"  WARNING — IDs not found:  {changes['not_found_ids']}")

    total = len(changes["details"])
    print(f"  Total changes:            {total}")

    if total > 0:
        print(f"\n  Changes detail:")
        for d in changes["details"]:
            stmt_flag = " [stmt]" if d["statement_changed"] else ""
            print(f"    [{d['type']}] {d['id']}{stmt_flag}")
            print(f"      old: {d['old'][:70]}")
            print(f"      new: {d['new'][:70]}")


def main() -> int:
    print(f"Repo root: {REPO_ROOT}")
    print(f"Grammar file: {GRAMMAR_FILE}")
    print(f"Vocab file:   {VOCAB_FILE}")

    # --- Grammar ---
    if not GRAMMAR_FILE.exists():
        print(f"ERROR: grammar file not found: {GRAMMAR_FILE}", file=sys.stderr)
        return 1

    with open(GRAMMAR_FILE, encoding="utf-8") as fh:
        grammar_facts = json.load(fh)

    grammar_updated, grammar_changes = process_grammar(grammar_facts)
    print_summary("Grammar (grammar-ja.json)", grammar_changes)

    with open(GRAMMAR_FILE, "w", encoding="utf-8") as fh:
        json.dump(grammar_updated, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"\n  Written: {GRAMMAR_FILE}")

    # --- Vocab ---
    if not VOCAB_FILE.exists():
        print(f"ERROR: vocab file not found: {VOCAB_FILE}", file=sys.stderr)
        return 1

    with open(VOCAB_FILE, encoding="utf-8") as fh:
        vocab_facts = json.load(fh)

    vocab_updated, vocab_changes = process_vocab(vocab_facts)
    print_summary("Vocab (vocab-ja.json)", vocab_changes)

    with open(VOCAB_FILE, "w", encoding="utf-8") as fh:
        json.dump(vocab_updated, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"\n  Written: {VOCAB_FILE}")

    # Final summary
    grammar_total = grammar_changes["meaning_cleaned"] + grammar_changes["fill_tilde_stripped"]
    vocab_total = vocab_changes["hardcoded_corrections"] + vocab_changes["auto_truncated"]
    print(f"\n{'='*60}")
    print(f"  DONE — {grammar_total} grammar + {vocab_total} vocab facts updated")
    print(f"{'='*60}\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())

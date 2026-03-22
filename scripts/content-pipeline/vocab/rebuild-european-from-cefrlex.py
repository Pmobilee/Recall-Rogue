#!/usr/bin/env python3
"""
rebuild-european-from-cefrlex.py

Rebuilds 4 European language vocabulary decks (DE, FR, ES, NL) by
cross-referencing CEFRLex level data with our existing Wiktionary-sourced
seed translations.

Strategy:
  - CEFRLex TSV  → authoritative CEFR level per word (no English translation)
  - Existing seed JSON → authoritative English translation (unreliable CEFR level)
  Cross-reference: keep words in BOTH, use CEFRLex for level + seed for translation.

Only A1–B2 facts are kept (C1/C2 are too advanced and lower quality).
Output files OVERWRITE the existing seed files in place.

Usage:
    python3 scripts/content-pipeline/vocab/rebuild-european-from-cefrlex.py
"""

import csv
import json
import re
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3]

# ---------------------------------------------------------------------------
# Language config
# ---------------------------------------------------------------------------

LANGUAGES: dict[str, dict] = {
    "de": {
        "cefrlex_file": REPO_ROOT / "data/references/cefrlex/DAFlex.tsv",
        "seed_file":    REPO_ROOT / "src/data/seed/vocab-de.json",
        "output_file":  REPO_ROOT / "src/data/seed/vocab-de.json",
        "name":         "German",
        "cefrlex_format": "quoted",   # columns are "quoted" strings
        "level_prefix": "german",
        "lang_code":    "de",
        "source_name":  "CEFRLex DAFlex + Kaikki.org",
        # DAFlex/ELELex frequency column names (after quote-stripping)
        "freq_columns": [
            ("a1", "level_freq@a1"),
            ("a2", "level_freq@a2"),
            ("b1", "level_freq@b1"),
            ("b2", "level_freq@b2"),
            ("c1", "level_freq@c1"),
            ("c2", "level_freq@c2"),
        ],
        # German nouns are capitalised in seed but lowercase in CEFRLex —
        # normalise both to lowercase for matching
        "normalize_case": True,
    },
    "fr": {
        "cefrlex_file": REPO_ROOT / "data/references/cefrlex/FLELex_TT_Beacco.tsv",
        "seed_file":    REPO_ROOT / "src/data/seed/vocab-fr.json",
        "output_file":  REPO_ROOT / "src/data/seed/vocab-fr.json",
        "name":         "French",
        "cefrlex_format": "unquoted",  # columns are unquoted plain text
        "level_prefix": "french",
        "lang_code":    "fr",
        "source_name":  "CEFRLex FLELex + Kaikki.org",
        # FLELex has a pre-assigned `level` column — use it directly
        "use_level_column": True,
        "level_column": "level",
        "normalize_case": False,
    },
    "es": {
        "cefrlex_file": REPO_ROOT / "data/references/cefrlex/ELELex.tsv",
        "seed_file":    REPO_ROOT / "src/data/seed/vocab-es.json",
        "output_file":  REPO_ROOT / "src/data/seed/vocab-es.json",
        "name":         "Spanish",
        "cefrlex_format": "quoted",
        "level_prefix": "spanish",
        "lang_code":    "es",
        "source_name":  "CEFRLex ELELex + Kaikki.org",
        # ELELex has only A1–C1 (no C2 column)
        "freq_columns": [
            ("a1", "level_freq@a1"),
            ("a2", "level_freq@a2"),
            ("b1", "level_freq@b1"),
            ("b2", "level_freq@b2"),
            ("c1", "level_freq@c1"),
        ],
        "normalize_case": False,
    },
    "nl": {
        "cefrlex_file": REPO_ROOT / "data/references/cefrlex/NT2Lex-CGN-v01.tsv",
        "seed_file":    REPO_ROOT / "src/data/seed/vocab-nl.json",
        "output_file":  REPO_ROOT / "src/data/seed/vocab-nl.json",
        "name":         "Dutch",
        "cefrlex_format": "unquoted",
        "level_prefix": "dutch",
        "lang_code":    "nl",
        "source_name":  "CEFRLex NT2Lex + Kaikki.org",
        # NT2Lex uses F@A1, F@A2 … F@C1 (no C2)
        "freq_columns": [
            ("a1", "F@A1"),
            ("a2", "F@A2"),
            ("b1", "F@B1"),
            ("b2", "F@B2"),
            ("c1", "F@C1"),
        ],
        "normalize_case": False,
    },
}

# CEFR levels we include in the output (C1/C2 excluded)
KEEP_LEVELS = {"a1", "a2", "b1", "b2"}

# Minimum frequency threshold to count a word as belonging to a level
FREQ_THRESHOLD = 10.0

# Level → (categoryL2 suffix, difficulty)
LEVEL_META: dict[str, tuple[str, int]] = {
    "a1": ("_a1", 1),
    "a2": ("_a2", 1),
    "b1": ("_b1", 2),
    "b2": ("_b2", 3),
}

# Answers that begin with these prefixes are considered unusable
BAD_PREFIXES = (
    "variant of",
    "alternative form",
    "see ",
    "abbr",
    "clipping of",
    "eye dialect",
    "obsolete",
)

# ---------------------------------------------------------------------------
# Answer cleaning  (reused from rebuild-chinese-from-hsk.py with adaptations)
# ---------------------------------------------------------------------------

def clean_answer(raw: str) -> str:
    """Return a quiz-ready answer string from a raw Wiktionary translation.

    1. Strip leading qualifier parens like (formal), (archaic), etc.
    2. Strip trailing "also:" / "also pr." clauses.
    3. Truncate at 25 chars on a top-level comma/semicolon boundary.
    4. Strip trailing "etc." garbage.
    5. Strip trailing punctuation and whitespace.
    6. Remove dangling open parentheticals left after truncation.
    """
    s = raw.strip()

    # 1. Strip leading qualifier parens
    s = re.sub(r'^\((?:formal|informal|archaic|dialectal?|literary|dated|'
               r'figurative|colloquial|regional|old|rare|obsolete|'
               r'transitive|intransitive|also|chiefly)\)\s*', '', s, flags=re.IGNORECASE)

    # 2. Strip trailing "also pr." / "also written" / "also:" clauses
    s = re.sub(r'\s*\([^)]*also pr\.[^)]*\)', '', s)
    s = re.sub(r'\s*[;,]?\s*also pr\..+$', '', s)
    s = re.sub(r'\s*[;,]?\s*also written.+$', '', s)
    s = s.strip()

    # 3. Truncate on top-level (non-parenthesised) comma/semicolon boundary
    def top_level_seps(text: str) -> list[int]:
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
        seps = top_level_seps(s)
        early = [p for p in seps if p <= 24]
        if early:
            s = s[:early[-1]]
        elif seps:
            s = s[:seps[0]]
        else:
            if len(s) > 60:
                s = s[:60].rsplit(' ', 1)[0]

    # 4. Strip trailing "etc." / "etc"
    s = re.sub(r'\s*[;,]?\s*etc\.?$', '', s)

    # 5. Strip trailing punctuation and whitespace
    s = s.rstrip(' ;,').strip()

    # 6. Remove dangling open parentheticals
    for _ in range(10):
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


def is_bad_answer(answer: str) -> bool:
    """Return True if the answer is unusable as a quiz answer."""
    low = answer.lower()
    return any(low.startswith(p) for p in BAD_PREFIXES)


# ---------------------------------------------------------------------------
# Extract L2 word from quizQuestion
# ---------------------------------------------------------------------------

_QUIZ_WORD_RE = re.compile(r'What does "(.+?)"')

def extract_word_from_quiz(quiz_question: str) -> str | None:
    """Extract the L2 word from a quizQuestion string like 'What does "X" mean?'.

    Returns the word between the first pair of double quotes, or None if the
    pattern doesn't match.
    """
    m = _QUIZ_WORD_RE.search(quiz_question)
    if not m:
        return None
    return m.group(1)


# ---------------------------------------------------------------------------
# CEFRLex loader: quoted format (DAFlex / ELELex)
# ---------------------------------------------------------------------------

def load_cefrlex_quoted(path: Path, freq_columns: list[tuple[str, str]],
                        normalize_case: bool) -> dict[str, str]:
    """Load a CEFRLex TSV where columns are quoted strings.

    Returns {word_key: cefr_level_str} where cefr_level_str is one of
    'a1', 'a2', 'b1', 'b2', 'c1', 'c2'.

    word_key is lowercased if normalize_case is True.

    Level assignment: lowest level where frequency > FREQ_THRESHOLD.
    Only the first occurrence of each word (by word_key) is kept — the
    file may contain duplicate word entries with different POS tags; the
    first row usually has the highest total frequency.
    """
    result: dict[str, str] = {}
    seen: set[str] = set()

    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t", quotechar='"')
        for row in reader:
            # Strip surrounding quotes from the word field (DictReader with
            # quotechar='"' should handle this, but some rows double-quote)
            raw_word = row.get("word", "").strip().strip('"')
            if not raw_word or len(raw_word) < 2:
                continue

            word_key = raw_word.lower() if normalize_case else raw_word

            # Skip duplicates — keep first occurrence
            if word_key in seen:
                continue

            # Determine level: lowest level with freq > threshold
            assigned_level: str | None = None
            for level_name, col_name in freq_columns:
                raw_val = row.get(col_name, "0.0").strip().strip('"')
                try:
                    freq = float(raw_val)
                except ValueError:
                    freq = 0.0
                if freq > FREQ_THRESHOLD:
                    assigned_level = level_name
                    break  # freq_columns is ordered A1→C2; first match = lowest level

            if assigned_level is None:
                continue  # word has no significant frequency at any level

            seen.add(word_key)
            result[word_key] = assigned_level

    return result


# ---------------------------------------------------------------------------
# CEFRLex loader: FLELex (unquoted, has a pre-assigned `level` column)
# ---------------------------------------------------------------------------

def load_flelex(path: Path) -> dict[str, str]:
    """Load FLELex TSV (French). Uses the pre-assigned `level` column.

    Returns {word: cefr_level_str} (e.g. 'A1' -> 'a1', normalised to lowercase).
    First occurrence of each word wins on dedup.
    """
    result: dict[str, str] = {}
    seen: set[str] = set()

    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            word = row.get("word", "").strip()
            if not word or len(word) < 2:
                continue
            if word in seen:
                continue

            level_raw = row.get("level", "").strip().upper()
            if not level_raw:
                continue

            # Normalise 'A1' → 'a1', 'B2' → 'b2', etc.
            level = level_raw.lower()
            if level not in {"a1", "a2", "b1", "b2", "c1", "c2"}:
                continue

            seen.add(word)
            result[word] = level

    return result


# ---------------------------------------------------------------------------
# CEFRLex loader: NT2Lex (Dutch, unquoted, F@A1 columns, no C2)
# ---------------------------------------------------------------------------

def load_nt2lex(path: Path, freq_columns: list[tuple[str, str]]) -> dict[str, str]:
    """Load NT2Lex TSV (Dutch). Same logic as quoted format but unquoted.

    NT2Lex uses '-' for missing values instead of '0.0'.
    Multiple rows per word (different POS tags) — keep first occurrence
    that yields a level assignment.
    """
    result: dict[str, str] = {}

    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            word = row.get("word", "").strip()
            if not word or len(word) < 2:
                continue

            # Already have a level for this word? Skip.
            if word in result:
                continue

            assigned_level: str | None = None
            for level_name, col_name in freq_columns:
                raw_val = row.get(col_name, "-").strip()
                if raw_val == "-":
                    freq = 0.0
                else:
                    try:
                        freq = float(raw_val)
                    except ValueError:
                        freq = 0.0
                if freq > FREQ_THRESHOLD:
                    assigned_level = level_name
                    break

            if assigned_level is None:
                continue

            result[word] = assigned_level

    return result


# ---------------------------------------------------------------------------
# Seed loader: build word → best-fact map
# ---------------------------------------------------------------------------

def load_seed(path: Path, normalize_case: bool) -> dict[str, dict]:
    """Load the seed JSON and return {word_key: best_fact} map.

    word_key is derived from quizQuestion (text between the first double
    quotes). If a word appears multiple times, keep the entry with the
    shortest correctAnswer (cleanest translation).

    normalize_case: lowercase the word_key (for German noun matching).
    """
    with open(path, encoding="utf-8") as f:
        entries: list[dict] = json.load(f)

    word_map: dict[str, dict] = {}

    for entry in entries:
        quiz_q = entry.get("quizQuestion", "")
        word = extract_word_from_quiz(quiz_q)
        if not word:
            continue
        if len(word) < 2:
            continue

        word_key = word.lower() if normalize_case else word

        answer = entry.get("correctAnswer", "").strip()
        if not answer:
            continue

        # Dedup: keep shortest / cleanest answer for the same word
        if word_key in word_map:
            existing_answer = word_map[word_key].get("correctAnswer", "")
            if len(answer) >= len(existing_answer):
                continue  # existing is shorter or equal — keep it

        # Store the original (non-normalised) word for use in output
        entry["_word_key"] = word_key
        entry["_word_original"] = word
        word_map[word_key] = entry

    return word_map


# ---------------------------------------------------------------------------
# Fact builder
# ---------------------------------------------------------------------------

def build_fact(idx: int, word: str, level: str, answer: str,
               lang_cfg: dict, seed_entry: dict) -> dict:
    """Build a single fact dict from cross-referenced data."""
    lang_code   = lang_cfg["lang_code"]
    lang_name   = lang_cfg["name"]
    level_suffix, difficulty = LEVEL_META[level]
    category_l2 = f"{lang_cfg['level_prefix']}{level_suffix}"

    # Preserve explanation / fullDefinition from seed if present
    explanation = seed_entry.get("explanation") or f"{word} — {answer}."
    full_def    = seed_entry.get("fullDefinition")

    fact: dict = {
        "id":               f"{lang_code}-cefr-{idx}",
        "type":             "vocabulary",
        "statement":        f"{word} means \"{answer}\" in {lang_name}",
        "explanation":      explanation,
        "quizQuestion":     f"What does \"{word}\" mean?",
        "correctAnswer":    answer,
        "distractors":      [],
        "category":         ["language", category_l2],
        "categoryL1":       "language",
        "categoryL2":       category_l2,
        "rarity":           "common",
        "difficulty":       difficulty,
        "funScore":         5,
        "ageRating":        "kid",
        "sourceName":       lang_cfg["source_name"],
        "sourceUrl":        "https://cental.uclouvain.be/cefrlex/",
        "language":         lang_code,
        "pronunciation":    seed_entry.get("pronunciation"),
        "status":           "approved",
        "contentVolatility": "timeless",
        "tags":             ["vocab", lang_code],
        "variants":         seed_entry.get("variants"),
    }

    if full_def is not None:
        fact["fullDefinition"] = full_def

    return fact


# ---------------------------------------------------------------------------
# Per-language processing
# ---------------------------------------------------------------------------

def process_language(lang_code: str, cfg: dict) -> None:
    lang_name = cfg["name"]
    print(f"\n{'=' * 60}")
    print(f"  {lang_name} ({lang_code.upper()})")
    print(f"{'=' * 60}")

    # ------------------------------------------------------------------
    # Step 1: Load CEFRLex → {word_key: level}
    # ------------------------------------------------------------------
    cefrlex_path: Path = cfg["cefrlex_file"]
    print(f"Loading CEFRLex: {cefrlex_path.name}")

    fmt = cfg["cefrlex_format"]
    normalize = cfg.get("normalize_case", False)

    if cfg.get("use_level_column"):
        # French: FLELex has a pre-assigned level column
        cefrlex_map = load_flelex(cefrlex_path)
    elif fmt == "quoted":
        cefrlex_map = load_cefrlex_quoted(
            cefrlex_path, cfg["freq_columns"], normalize
        )
    else:
        # Dutch: NT2Lex unquoted with F@A1 columns
        cefrlex_map = load_nt2lex(cefrlex_path, cfg["freq_columns"])

    total_cefrlex = len(cefrlex_map)
    print(f"  CEFRLex words loaded: {total_cefrlex:,}")

    # ------------------------------------------------------------------
    # Step 2: Load seed → {word_key: best_fact}
    # ------------------------------------------------------------------
    seed_path: Path = cfg["seed_file"]
    print(f"Loading seed: {seed_path.name}")
    seed_map = load_seed(seed_path, normalize)
    total_seed = len(seed_map)
    print(f"  Seed words loaded:    {total_seed:,}")

    # ------------------------------------------------------------------
    # Step 3: Cross-reference
    # ------------------------------------------------------------------
    level_counts: dict[str, int] = {l: 0 for l in ["a1", "a2", "b1", "b2", "c1", "c2"]}
    matches: list[tuple[str, str, str, dict]] = []  # (word_key, word_original, level, seed_entry)
    skipped_no_answer  = 0
    skipped_bad_answer = 0
    skipped_too_short  = 0
    skipped_c_level    = 0

    for word_key, level in cefrlex_map.items():
        level_counts[level] = level_counts.get(level, 0) + 1

        if word_key not in seed_map:
            continue

        seed_entry = seed_map[word_key]
        raw_answer = seed_entry.get("correctAnswer", "").strip()

        if not raw_answer:
            skipped_no_answer += 1
            continue

        # Clean the answer
        answer = clean_answer(raw_answer)

        if not answer:
            skipped_no_answer += 1
            continue

        if is_bad_answer(answer):
            skipped_bad_answer += 1
            continue

        # Skip C1/C2 — too advanced
        if level in ("c1", "c2"):
            skipped_c_level += 1
            continue

        # Use original (non-normalised) word from the seed entry
        word_original = seed_entry.get("_word_original", word_key)

        matches.append((word_key, word_original, level, seed_entry, answer))

    total_matches = len(matches)
    # Count A1-B2 kept
    kept_by_level: dict[str, int] = {l: 0 for l in ["a1", "a2", "b1", "b2"]}
    for _, _, level, _, _ in matches:
        kept_by_level[level] += 1

    print(f"\n  Cross-reference results:")
    print(f"    Total matches (A1-B2 + C): {total_matches + skipped_c_level:,}")
    print(f"    Skipped C1/C2:             {skipped_c_level:,}")
    print(f"    Skipped (bad answer):      {skipped_bad_answer:,}")
    print(f"    Skipped (no answer):       {skipped_no_answer:,}")
    print(f"    A1-B2 kept:                {total_matches:,}")
    print(f"      A1: {kept_by_level['a1']:,}  A2: {kept_by_level['a2']:,}"
          f"  B1: {kept_by_level['b1']:,}  B2: {kept_by_level['b2']:,}")

    # ------------------------------------------------------------------
    # Step 4: Sort by level rank (A1 first, B2 last)
    # ------------------------------------------------------------------
    level_order = {"a1": 1, "a2": 2, "b1": 3, "b2": 4}
    matches.sort(key=lambda t: level_order[t[2]])

    # ------------------------------------------------------------------
    # Step 5: Build output facts with sequential IDs
    # ------------------------------------------------------------------
    facts: list[dict] = []
    for idx, (word_key, word_original, level, seed_entry, answer) in enumerate(matches, start=1):
        fact = build_fact(idx, word_original, level, answer, cfg, seed_entry)
        facts.append(fact)

    # ------------------------------------------------------------------
    # Step 6: Write output
    # ------------------------------------------------------------------
    out_path: Path = cfg["output_file"]
    print(f"\n  Writing {len(facts):,} facts → {out_path}")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(facts, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"  Done. Final count: {len(facts):,}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("rebuild-european-from-cefrlex.py")
    print(f"Repo root: {REPO_ROOT}")

    for lang_code, cfg in LANGUAGES.items():
        process_language(lang_code, cfg)

    # ------------------------------------------------------------------
    # Post-build: typecheck + build
    # ------------------------------------------------------------------
    print("\n\n" + "=" * 60)
    print("Running typecheck...")
    print("=" * 60)
    result = subprocess.run(
        ["npm", "run", "typecheck"],
        cwd=REPO_ROOT,
        capture_output=False,
    )
    if result.returncode != 0:
        print("\n[WARN] typecheck reported errors — see output above.")
    else:
        print("typecheck passed.")

    print("\n" + "=" * 60)
    print("Running build...")
    print("=" * 60)
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=REPO_ROOT,
        capture_output=False,
    )
    if result.returncode != 0:
        print("\n[WARN] build reported errors — see output above.")
        sys.exit(1)
    else:
        print("build passed.")

    print("\nAll done.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Merge batch 7 knowledge facts into seed files and rebuild the database.
"""
import json
import re
import os
import sys
import subprocess

BASE_DIR = "/Users/damion/CODE/Recall_Rogue"
SEED_DIR = f"{BASE_DIR}/src/data/seed"
TOOL_BASE = "/Users/damion/.claude-intelligents/projects/-Users-damion-CODE-Recall-Rogue/d6791057-8f55-495c-af12-857619d00e29/tool-results"

DOMAIN_MAP = {
    "toolu_015euGREWE6Ze6sRLssAAwft": "animals_wildlife",
    "toolu_01D6brWMojpjrZ8VSw8Xd3jm": "art_architecture",
    "toolu_0152buGgYZZPvKH4ZEdvFoBF": "food_cuisine",
    "toolu_01JYKDF8gair2f5ASuXZcgcx": "general_knowledge",
    "toolu_017kY3X8iTgKuJ6S6jFFLG1u": "geography",
    "toolu_01Nio2eG9sZwqDijzQV5ve3M": "history",
    "toolu_01G3spFEZFHF3LTdcYHZ7dMD": "human_body_health",
    "toolu_011gefM6rdEii2eDWZg9T4nc": "mythology_folklore",
    "toolu_01WnJoC8tMQeNyi9ej9ecKrf": "natural_sciences",
    "toolu_01EGMtUWUG4HirLpXc7GiHgv": "space_astronomy",
}

STRIP_FIELDS = {
    "gaiaComment", "gaiaComments", "gaiaWrongComments", "distractorObjects",
    "relatedFacts", "imagePrompt", "mnemonic", "hasPixelArt", "pixelArtStatus",
    "pixelArtPath", "status", "inGameReports", "verifiedAt", "distractorCount",
    "sourceRecordId", "contentType", "alternateExplanations", "imageUrl",
    "language", "pronunciation", "exampleSentence",
}


def extract_facts_from_text(text: str) -> list:
    """Extract the facts JSON array from potentially markdown-wrapped text."""
    pattern = re.compile(r'\[\s*\{')
    matches = list(pattern.finditer(text))

    for match in matches:
        start = match.start()
        depth = 0
        end = -1
        in_string = False
        escape_next = False
        for i in range(start, len(text)):
            ch = text[i]
            if escape_next:
                escape_next = False
                continue
            if ch == '\\' and in_string:
                escape_next = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    end = i
                    break

        if end == -1:
            continue

        arr_text = text[start:end+1]
        try:
            facts = json.loads(arr_text)
            if (isinstance(facts, list) and len(facts) > 0 and
                    isinstance(facts[0], dict) and 'id' in facts[0]):
                return facts
        except (json.JSONDecodeError, ValueError):
            continue

    return []


def fix_id(fact_id: str) -> str:
    """Convert underscores to hyphens in IDs."""
    return fact_id.replace('_', '-')


def normalize_rarity(rarity) -> str:
    """Normalize rarity values."""
    if isinstance(rarity, (int, float)):
        r = int(rarity)
        if r <= 1:
            return "common"
        elif r == 2:
            return "uncommon"
        elif r == 3:
            return "rare"
        else:
            return "legendary"
    if isinstance(rarity, str):
        if rarity == "epic":
            return "rare"
        return rarity
    return "common"


def normalize_age_rating(rating) -> str:
    if rating == "all":
        return "kid"
    return rating or "kid"


def normalize_content_volatility(vol) -> str:
    if vol in ("slow_change", "stable"):
        return "timeless"
    return vol or "timeless"


def normalize_sensitivity_note(note) -> None | str:
    if note == "" or note is None:
        return None
    return note


def extract_distractor_text(d) -> str:
    """Extract text from distractor object or string."""
    if isinstance(d, dict):
        return d.get("text", str(d))
    return str(d)


def fix_fact(fact: dict, domain: str) -> dict:
    """Apply all schema fixes to a single fact."""
    result = {}

    # Fix ID
    fact_id = fix_id(fact.get("id", ""))
    result["id"] = fact_id

    # Type fix: "fact" -> "knowledge"
    ftype = fact.get("type", "knowledge")
    result["type"] = "knowledge" if ftype == "fact" else ftype

    # Domain/subdomain from categoryL1/categoryL2 or existing domain/subdomain
    cat_l1 = fact.get("categoryL1") or fact.get("domain", "")
    cat_l2 = fact.get("categoryL2") or fact.get("subdomain", "")
    cat_l3 = fact.get("categoryL3", "")

    result["domain"] = cat_l1
    result["subdomain"] = cat_l2
    result["categoryL1"] = cat_l1
    result["categoryL2"] = cat_l2
    result["categoryL3"] = cat_l3 if cat_l3 else ""

    # Core fact fields
    result["statement"] = fact.get("statement", "")
    result["quizQuestion"] = fact.get("quizQuestion", "")

    # Correct answer: handle 'answer' alias
    correct = fact.get("correctAnswer") or fact.get("answer", "")
    # For true/false questions with explanations, strip to just True/False
    if isinstance(correct, str):
        lower = correct.lower().strip()
        if lower.startswith("true") and len(correct) > 10:
            correct = "True"
        elif lower.startswith("false") and len(correct) > 10:
            correct = "False"
    result["correctAnswer"] = correct

    # Distractors: normalize to string array
    raw_distractors = fact.get("distractors", [])
    result["distractors"] = [extract_distractor_text(d) for d in raw_distractors]

    # Acceptable answers
    result["acceptableAnswers"] = fact.get("acceptableAnswers", [])

    # Explanation
    result["explanation"] = fact.get("explanation", "")

    # Wow factor
    result["wowFactor"] = fact.get("wowFactor", "")

    # Variants: fix answer field alias and strip bad fields
    variants = fact.get("variants", [])
    fixed_variants = []
    for v in variants:
        if isinstance(v, dict):
            fv = dict(v)
            if "correctAnswer" in fv and "answer" not in fv:
                fv["answer"] = fv.pop("correctAnswer")
            if "distractors" in fv:
                fv["distractors"] = [extract_distractor_text(d) for d in fv["distractors"]]
            fixed_variants.append(fv)
    result["variants"] = fixed_variants

    # Numeric/scored fields
    result["difficulty"] = fact.get("difficulty", 3)
    result["funScore"] = fact.get("funScore", 5)
    result["noveltyScore"] = fact.get("noveltyScore", 5)

    # Normalized enum fields
    result["ageRating"] = normalize_age_rating(fact.get("ageRating", "kid"))
    result["rarity"] = normalize_rarity(fact.get("rarity", "common"))
    result["contentVolatility"] = normalize_content_volatility(fact.get("contentVolatility", "timeless"))

    # Source
    result["sourceName"] = fact.get("sourceName", "")
    result["sourceUrl"] = fact.get("sourceUrl", "")

    # Sensitivity
    result["sensitivityLevel"] = fact.get("sensitivityLevel", "none")
    result["sensitivityNote"] = normalize_sensitivity_note(fact.get("sensitivityNote"))

    # Visual
    result["visualDescription"] = fact.get("visualDescription", "")

    # Tags
    raw_tags = fact.get("tags", [])
    result["tags"] = raw_tags if isinstance(raw_tags, list) else []

    # Haiku processing metadata
    result["_haikuProcessed"] = True
    result["_haikuProcessedAt"] = "2026-03-15T00:00:00.000Z"

    return result


def load_worker_facts(tool_id: str) -> list:
    """Load and extract facts from a worker output file."""
    filepath = f"{TOOL_BASE}/{tool_id}.json"
    with open(filepath) as f:
        data = json.load(f)

    # Concatenate text from all elements (sometimes split across multiple)
    if isinstance(data, list):
        text = "\n".join(item.get("text", "") for item in data if isinstance(item, dict))
    else:
        text = str(data)

    facts = extract_facts_from_text(text)
    return facts


def merge_into_seed(domain: str, new_facts: list) -> dict:
    """Merge new facts into the existing seed file, deduping by ID."""
    seed_file = f"{SEED_DIR}/knowledge-{domain}.json"

    if os.path.exists(seed_file):
        with open(seed_file) as f:
            existing = json.load(f)
    else:
        existing = []

    # Build ID map for dedup
    existing_ids = {fact["id"] for fact in existing}

    added = 0
    updated = 0
    for fact in new_facts:
        if fact["id"] in existing_ids:
            for i, ex in enumerate(existing):
                if ex["id"] == fact["id"]:
                    existing[i] = fact
                    updated += 1
                    break
        else:
            existing.append(fact)
            existing_ids.add(fact["id"])
            added += 1

    with open(seed_file, "w") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

    return {"total": len(existing), "added": added, "updated": updated}


def main():
    print("=== Batch 7 Knowledge Facts Merge ===\n")

    total_new = 0

    for tool_id, domain in DOMAIN_MAP.items():
        print(f"Processing {domain}...")

        raw_facts = load_worker_facts(tool_id)
        if not raw_facts:
            print(f"  WARNING: No facts extracted for {domain}!")
            continue

        print(f"  Extracted {len(raw_facts)} raw facts")

        fixed_facts = [fix_fact(f, domain) for f in raw_facts]

        stats = merge_into_seed(domain, fixed_facts)

        print(f"  -> Added: {stats['added']}, Updated: {stats['updated']}, "
              f"Total in seed: {stats['total']}")

        total_new += stats["added"]

    print(f"\nTotal new facts added: {total_new}")

    # Rebuild database
    print("\n=== Rebuilding database ===")
    build_script = f"{BASE_DIR}/scripts/build-facts-db.mjs"
    if os.path.exists(build_script):
        result = subprocess.run(
            ["node", build_script],
            cwd=BASE_DIR,
            capture_output=True,
            text=True
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        if result.returncode != 0:
            print(f"ERROR: build-facts-db.mjs exited with code {result.returncode}")
            sys.exit(1)
        else:
            print("Database rebuilt successfully.")
    else:
        print(f"WARNING: Build script not found at {build_script}")


if __name__ == "__main__":
    main()

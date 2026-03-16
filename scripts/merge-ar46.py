#!/usr/bin/env python3
"""
AR-46 fact merge script.
Loads generated facts from various source files, deduplicates against existing seed files,
appends new facts to seed files, saves batch files, and marks entities as processed.
"""

import json
import os
import re
import sys
from datetime import datetime

REPO_ROOT = "/Users/damion/CODE/Recall_Rogue"
SEED_DIR = os.path.join(REPO_ROOT, "src/data/seed")
GENERATED_DIR = os.path.join(REPO_ROOT, "data/generated/knowledge")
CURATED_DIR = os.path.join(REPO_ROOT, "data/curated")
TASK_OUTPUT_DIR = "/private/tmp/claude-501/-Users-damion-CODE-Recall-Rogue/b99a0e50-f1d2-41d7-b84b-ddbcd40ad20d/tasks"

HAIKU_PROCESSED_AT = "2026-03-16T00:00:00.000Z"

# Domain config: key -> (source, seed_file_suffix, entities_dir)
DOMAIN_CONFIG = {
    "history": {
        "source_file": "/tmp/ar46/history_facts.json",
        "source_type": "json_file",
        "seed_suffix": "history",
        "entities_dir": "history",
        "batch_name": "ar46-history-b1",
    },
    "general": {
        "source_file": "/tmp/ar46/general_knowledge_output.json",
        "source_type": "json_file",
        "seed_suffix": "general_knowledge",
        "entities_dir": "general_knowledge",
        "batch_name": "ar46-general-b1",
    },
    "science": {
        "source_file": "/tmp/ar46/natural_sciences_facts.json",
        "source_type": "json_file",
        "seed_suffix": "natural_sciences",
        "entities_dir": "natural_sciences",
        "batch_name": "ar46-science-b1",
    },
    "health": {
        "source_file": "/tmp/ar46/human_body_health_facts.json",
        "source_type": "json_file",
        "seed_suffix": "human_body_health",
        "entities_dir": "human_body_health",
        "batch_name": "ar46-health-b1",
    },
    "geo": {
        "source_file": "/tmp/ar46/geography.json",
        "source_type": "json_file",
        "seed_suffix": "geography",
        "entities_dir": "geography",
        "batch_name": "ar46-geo-b1",
    },
    "myth": {
        "source_file": "/tmp/ar46/mythology_folklore_facts.json",
        "source_type": "json_file",
        "seed_suffix": "mythology_folklore",
        "entities_dir": "mythology_folklore",
        "batch_name": "ar46-myth-b1",
    },
    "art": {
        "source_file": "/tmp/ar46/art_architecture_facts.json",
        "source_type": "json_file",
        "seed_suffix": "art_architecture",
        "entities_dir": "art_architecture",
        "batch_name": "ar46-art-b1",
    },
    "animals": {
        "source_file": os.path.join(TASK_OUTPUT_DIR, "a595bd982f3c6f4d2.output"),
        "source_type": "task_output",
        "seed_suffix": "animals_wildlife",
        "entities_dir": "animals_wildlife",
        "batch_name": "ar46-animals-b1",
    },
    "space": {
        "source_file": os.path.join(TASK_OUTPUT_DIR, "a2f0a4dbfd46dbcba.output"),
        "source_type": "task_output",
        "seed_suffix": "space_astronomy",
        "entities_dir": "space_astronomy",
        "batch_name": "ar46-space-b1",
    },
    "food": {
        "source_file": os.path.join(TASK_OUTPUT_DIR, "a6a99a92c68b3c123.output"),
        "source_type": "task_output",
        "seed_suffix": "food_cuisine",
        "entities_dir": "food_cuisine",
        "batch_name": "ar46-food-b1",
    },
}


def load_json_file(path: str) -> list:
    """Load facts from a plain JSON file (list or object with list value)."""
    with open(path) as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    # Some files wrap the array in an object
    for v in data.values():
        if isinstance(v, list):
            return v
    raise ValueError(f"Cannot find array in {path}")


def load_task_output(path: str) -> list:
    """Extract facts JSON array from a Claude task output JSONL file."""
    with open(path) as f:
        content = f.read()

    lines = content.strip().split("\n")
    texts = []
    for line in lines:
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if obj.get("type") == "assistant":
            for item in obj.get("message", {}).get("content", []):
                if isinstance(item, dict) and item.get("type") == "text":
                    texts.append(item["text"])

    full_text = "".join(texts)

    # Find outermost JSON array
    start = full_text.find("[")
    end = full_text.rfind("]") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON array found in task output: {path}")

    arr_text = full_text[start:end]

    # Clean up trailing commas before } or ] (common LLM output issue)
    arr_text = re.sub(r",\s*([\}\]])", r"\1", arr_text)

    return json.loads(arr_text)


def add_haiku_metadata(facts: list) -> list:
    """Add _haikuProcessed metadata if missing."""
    for fact in facts:
        if not fact.get("_haikuProcessed"):
            fact["_haikuProcessed"] = True
        if not fact.get("_haikuProcessedAt"):
            fact["_haikuProcessedAt"] = HAIKU_PROCESSED_AT
    return facts


def load_seed_file(seed_suffix: str) -> tuple[list, str]:
    """Load existing seed file. Returns (facts, filepath)."""
    path = os.path.join(SEED_DIR, f"knowledge-{seed_suffix}.json")
    if not os.path.exists(path):
        print(f"  WARNING: Seed file not found: {path}, starting empty")
        return [], path
    with open(path) as f:
        data = json.load(f)
    if isinstance(data, list):
        return data, path
    # Shouldn't happen for seed files, but handle gracefully
    return list(data.values()) if isinstance(data, dict) else [], path


def save_batch_file(facts: list, batch_name: str):
    """Save facts to data/generated/knowledge/{batch_name}.json"""
    os.makedirs(GENERATED_DIR, exist_ok=True)
    path = os.path.join(GENERATED_DIR, f"{batch_name}.json")
    with open(path, "w") as f:
        json.dump(facts, f, indent=2, ensure_ascii=False)
    print(f"  Batch saved: {path}")
    return path


def merge_into_seed(new_facts: list, seed_facts: list, seed_path: str) -> tuple[list, int, int]:
    """
    Append new facts to seed, deduplicating by ID.
    Returns (merged_facts, added_count, skipped_count).
    """
    existing_ids = {f["id"] for f in seed_facts if "id" in f}
    added = []
    skipped = 0
    for fact in new_facts:
        fid = fact.get("id")
        if fid and fid in existing_ids:
            skipped += 1
        else:
            added.append(fact)
            if fid:
                existing_ids.add(fid)

    merged = seed_facts + added
    with open(seed_path, "w") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    return merged, len(added), skipped


def mark_entities_processed(entities_dir: str, count: int = 20):
    """Mark the first `count` unprocessed entities as processed=True."""
    path = os.path.join(CURATED_DIR, entities_dir, "entities.json")
    if not os.path.exists(path):
        print(f"  WARNING: entities.json not found at {path}")
        return 0

    with open(path) as f:
        entities = json.load(f)

    marked = 0
    for entity in entities:
        if marked >= count:
            break
        if not entity.get("processed"):
            entity["processed"] = True
            marked += 1

    with open(path, "w") as f:
        json.dump(entities, f, indent=2, ensure_ascii=False)

    print(f"  Marked {marked} entities as processed in {path}")
    return marked


def process_domain(domain_key: str, config: dict) -> dict:
    """Process a single domain. Returns summary dict."""
    print(f"\n=== {domain_key.upper()} ===")

    source_path = config["source_file"]
    if not os.path.exists(source_path):
        print(f"  ERROR: Source file not found: {source_path}")
        return {"domain": domain_key, "error": f"Source not found: {source_path}"}

    # Load facts
    try:
        if config["source_type"] == "task_output":
            facts = load_task_output(source_path)
        else:
            facts = load_json_file(source_path)
    except Exception as e:
        print(f"  ERROR loading facts: {e}")
        return {"domain": domain_key, "error": str(e)}

    print(f"  Loaded {len(facts)} facts from source")

    # Add haiku metadata
    facts = add_haiku_metadata(facts)

    # Save batch file
    save_batch_file(facts, config["batch_name"])

    # Load seed and merge
    seed_facts, seed_path = load_seed_file(config["seed_suffix"])
    print(f"  Seed has {len(seed_facts)} existing facts")

    merged, added, skipped = merge_into_seed(facts, seed_facts, seed_path)
    print(f"  Added: {added}, Skipped (duplicate): {skipped}, Seed total: {len(merged)}")

    # Mark entities as processed
    marked = mark_entities_processed(config["entities_dir"], count=20)

    return {
        "domain": domain_key,
        "loaded": len(facts),
        "added": added,
        "skipped": skipped,
        "seed_total": len(merged),
        "entities_marked": marked,
    }


def main():
    print("AR-46 Fact Merge Script")
    print(f"Repo root: {REPO_ROOT}")
    print(f"Timestamp: {HAIKU_PROCESSED_AT}")

    results = []
    for domain_key, config in DOMAIN_CONFIG.items():
        result = process_domain(domain_key, config)
        results.append(result)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    total_added = 0
    total_skipped = 0
    for r in results:
        if "error" in r:
            print(f"  {r['domain']:15s}  ERROR: {r['error']}")
        else:
            total_added += r["added"]
            total_skipped += r["skipped"]
            print(
                f"  {r['domain']:15s}  loaded={r['loaded']:3d}  "
                f"added={r['added']:3d}  skipped={r['skipped']:2d}  "
                f"seed_total={r['seed_total']:4d}  entities_marked={r['entities_marked']}"
            )

    print(f"\n  TOTAL ADDED: {total_added}  TOTAL SKIPPED: {total_skipped}")
    print("\nDone. Now run: node scripts/build-facts-db.mjs")


if __name__ == "__main__":
    main()

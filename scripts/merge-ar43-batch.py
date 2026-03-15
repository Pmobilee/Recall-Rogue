#!/usr/bin/env python3
"""
merge-ar43-batch.py — AR-43 batch merge script
Extracts facts from worker output files and merges into seed knowledge files.
"""

import json
import re
import os
from datetime import datetime

TASK_DIR = "/private/tmp/claude-501/-Users-damion-CODE-Recall-Rogue/b99a0e50-f1d2-41d7-b84b-ddbcd40ad20d/tasks"
SEED_DIR = "/Users/damion/CODE/Recall_Rogue/src/data/seed"
GENERATED_DIR = "/Users/damion/CODE/Recall_Rogue/data/generated/knowledge"
CURATED_DIR = "/Users/damion/CODE/Recall_Rogue/data/curated"

PROCESSED_AT = "2026-03-16T00:00:00.000Z"

# Map: (task_file_id, domain_label, seed_filename, curated_dir_name, batch_filename)
DOMAINS = [
    ("ac664cf67f0b318c7", "Animals & Wildlife", "knowledge-animals_wildlife.json",      "animals_wildlife",   "ar43-animals-b1.json"),
    ("a86733900ec5c885c", "History",             "knowledge-history.json",               "history",            "ar43-history-b1.json"),
    ("a27ef020bdd6598e3", "General Knowledge",   "knowledge-general_knowledge.json",     "general_knowledge",  "ar43-general-b1.json"),
    ("a12d05130d2577a7f", "Natural Sciences",    "knowledge-natural_sciences.json",      "natural_sciences",   "ar43-science-b1.json"),
    ("a772a0037972a1b9c", "Art & Architecture",  "knowledge-art_architecture.json",      "art_architecture",   "ar43-art-b1.json"),
    ("aaf1500cf869fb298", "Human Body & Health", "knowledge-human_body_health.json",     "human_body_health",  "ar43-health-b1.json"),
    ("a3e396836033495d2", "Geography",           "knowledge-geography.json",             "geography",          "ar43-geo-b1.json"),
    ("a9f18eb5581dc7ecb", "Space & Astronomy",   "knowledge-space_astronomy.json",       "space_astronomy",    "ar43-space-b1.json"),
    ("a3d5a4ff84bc83236", "Mythology & Folklore","knowledge-mythology_folklore.json",    "mythology_folklore", "ar43-myth-b1.json"),
    ("a8321eff4ede65f2f", "Food & Cuisine",      "knowledge-food_cuisine.json",          "food_cuisine",       "ar43-food-b1.json"),
]


def extract_json_from_worker_output(filepath: str) -> list:
    """Read a worker output JSONL file and extract the JSON array from the assistant response."""
    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()

    lines = raw.strip().split("\n")
    assistant_text = None

    # Collect all assistant text blocks (some workers use tool calls first, then a final text response)
    all_assistant_texts = []
    for line in lines:
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = obj.get("message", {})
        if msg.get("role") == "assistant":
            content = msg.get("content", [])
            if isinstance(content, list):
                for block in content:
                    if block.get("type") == "text" and block.get("text", "").strip():
                        all_assistant_texts.append(block["text"])
            elif isinstance(content, str) and content.strip():
                all_assistant_texts.append(content)

    if not all_assistant_texts:
        raise ValueError(f"No assistant text found in {filepath}")

    # Use the last (and typically longest) assistant text, which is the final response
    # Sort by length descending to prefer the one with the JSON array
    all_assistant_texts.sort(key=len, reverse=True)
    assistant_text = all_assistant_texts[0]

    if not assistant_text:
        raise ValueError(f"No assistant text found in {filepath}")

    def clean_and_parse(json_str: str) -> list:
        """Clean common LLM JSON artifacts and parse."""
        # Remove trailing commas before ] or }
        cleaned = re.sub(r",\s*(\])", r"\1", json_str)
        cleaned = re.sub(r",\s*(\})", r"\}", cleaned)
        return json.loads(cleaned)

    # Try to extract from markdown code fence first
    fence_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", assistant_text, re.DOTALL)
    if fence_match:
        return clean_and_parse(fence_match.group(1))

    # Fall back: find the outermost [...] array
    start = assistant_text.find("[")
    end = assistant_text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON array found in assistant text from {filepath}")

    return clean_and_parse(assistant_text[start:end + 1])


def mark_entities_processed(curated_domain_dir: str, count: int = 10):
    """Set processed=true for the first `count` unprocessed entities in the domain."""
    entities_path = os.path.join(CURATED_DIR, curated_domain_dir, "entities.json")
    if not os.path.exists(entities_path):
        print(f"  [WARN] entities.json not found: {entities_path}")
        return 0

    with open(entities_path, "r", encoding="utf-8") as f:
        entities = json.load(f)

    marked = 0
    for entity in entities:
        if marked >= count:
            break
        if not entity.get("processed", False):
            entity["processed"] = True
            marked += 1

    with open(entities_path, "w", encoding="utf-8") as f:
        json.dump(entities, f, indent=2, ensure_ascii=False)

    return marked


def main():
    os.makedirs(GENERATED_DIR, exist_ok=True)
    total_new = 0
    total_dupes = 0

    print(f"\n{'='*60}")
    print("AR-43 Batch Merge")
    print(f"{'='*60}\n")

    for task_id, label, seed_filename, curated_dir, batch_filename in DOMAINS:
        print(f"--- {label} ---")
        task_file = os.path.join(TASK_DIR, f"{task_id}.output")

        # Step 1: Extract facts from worker output
        try:
            new_facts = extract_json_from_worker_output(task_file)
        except Exception as e:
            print(f"  [ERROR] Could not extract facts: {e}")
            continue

        # Step 2: Add processing metadata
        for fact in new_facts:
            fact["_haikuProcessed"] = True
            fact["_haikuProcessedAt"] = PROCESSED_AT

        # Step 3: Save batch file
        batch_path = os.path.join(GENERATED_DIR, batch_filename)
        with open(batch_path, "w", encoding="utf-8") as f:
            json.dump(new_facts, f, indent=2, ensure_ascii=False)
        print(f"  Saved batch: {batch_filename} ({len(new_facts)} facts)")

        # Step 4: Read existing seed file
        seed_path = os.path.join(SEED_DIR, seed_filename)
        if os.path.exists(seed_path):
            with open(seed_path, "r", encoding="utf-8") as f:
                existing_facts = json.load(f)
        else:
            existing_facts = []

        existing_ids = {f["id"] for f in existing_facts}
        print(f"  Existing seed facts: {len(existing_facts)}")

        # Step 5: Check for duplicate IDs
        new_ids = [f["id"] for f in new_facts]
        dupes = [fid for fid in new_ids if fid in existing_ids]
        if dupes:
            print(f"  [WARN] {len(dupes)} duplicate IDs skipped: {dupes[:5]}")
            total_dupes += len(dupes)
            new_facts = [f for f in new_facts if f["id"] not in existing_ids]

        # Step 6: Append and write
        combined = existing_facts + new_facts
        with open(seed_path, "w", encoding="utf-8") as f:
            json.dump(combined, f, indent=2, ensure_ascii=False)

        added = len(new_facts)
        total_new += added
        print(f"  Added: {added} | New seed total: {len(combined)}")

        # Step 7: Mark entities as processed
        marked = mark_entities_processed(curated_dir, count=10)
        print(f"  Entities marked processed: {marked}")
        print()

    print(f"{'='*60}")
    print(f"TOTAL NEW FACTS ADDED: {total_new}")
    if total_dupes:
        print(f"TOTAL DUPLICATES SKIPPED: {total_dupes}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()

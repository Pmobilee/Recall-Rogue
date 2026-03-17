# AR-88: Community Pack Architecture & Steam Workshop [FUTURE RELEASE]

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §15
> **Priority:** POST-LAUNCH
> **Complexity:** Medium
> **Dependencies:** AR-80 (Steam Integration)

## Overview

Community-created fact packs distributed via Steam Workshop. Users create JSON fact packs, share via Workshop, others subscribe and play with those facts in-game.

**Key rule:** Community packs use NO LLM-generated distractors and NO database-pool distractors. Community facts use the **same self-graded quiz system as Anki imports** (AR-85). Pack creators may optionally include their own hand-written distractors for multiple-choice format.

## Pack Format

```json
{
  "packId": "community_japanese_advanced",
  "packName": "Advanced Japanese Vocabulary",
  "author": "username",
  "version": "1.0.0",
  "quizMode": "self_graded",  // or "multiple_choice" if distractors provided
  "facts": [
    {
      "id": "cp-ja-001",
      "quizQuestion": "What does 勉強する mean?",
      "correctAnswer": "to study",
      "distractors": [],        // empty = self-graded mode
      "difficulty": 3,
      "tags": ["jlpt_n4"]
    }
  ]
}
```

## Rules
- Domain: always `"Community"`, categoryL1: `"community_{packId}"`
- Cannot modify mechanics, relics, enemies, or balance — facts only
- FSRS scheduling works identically
- Chain types assigned randomly at run start
- Always free on all platforms

## Architecture (Pre-Launch Prep)
- Define JSON schema for pack validation
- Create `community_packs/` directory convention
- Fact loader scans directory on launch
- Valid packs appear as selectable domains

## GDD Updates

Add "§41. Community Packs & Steam Workshop [PLANNED — Future Release]" with pack format, rules, and Workshop roadmap.

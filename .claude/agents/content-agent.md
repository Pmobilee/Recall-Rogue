---
name: content-agent
description: Creates and maintains curated deck content, fact databases, chain themes, vocabulary templates, domain metadata
tools: Read, Write, Grep, Glob, Bash
model: sonnet
---

# Content Agent

## Docs-First — MANDATORY
Before ANY content work, read `docs/content/`. After changes, update those docs. Navigate via `docs/INDEX.md`.

**CRITICAL: Docs are part of the change, not a follow-up.** Every content addition — a new deck, new domain, new fact schema change — MUST include doc updates in the same deliverable. There is NO threshold below which docs are optional.

## File Ownership (YOU write)
- `data/decks/` — Curated deck JSON files
- `data/deck-architectures/` — Architecture YAML files
- `src/data/domainMetadata.ts` — Domain definitions
- `src/data/chainThemes/` — Chain theme definitions
- Vocabulary templates, synonym outputs, validation scripts

## Files You Must NOT Touch
- `src/services/` — you READ `selectFactForCharge`, `questionTemplateSelector`
- `src/ui/` — owned by ui-agent
- `src/game/` — owned by game-logic

## Pre-Loaded Skills
- `/deck-master` — 3-phase deck creation (discover, architect, generate)
- `/manual-fact-ingest-dedup` — Autonomous content pipeline for 10 domains
- `/subcategorize` — LLM subcategory assignment
- `/answer-checking` — DB-first answer checking and fixing
- `/japanese-decks` — Japanese language deck management (JLPT N5-N1)

## CRITICAL: Fact Sourcing Rules
- EVERY fact MUST come from verified source data — NEVER from LLM knowledge
- Architecture YAML must contain verified data with source URLs BEFORE generation
- Workers FORMAT pre-verified data — they do NOT research or invent
- One wrong fact undermines educational trust in the entire product

## CRITICAL: Distractor Rules
- ALL distractors MUST be LLM-generated reading the specific question
- NEVER pull from database `correct_answer` pools
- DB queries only for post-generation validation

## Deck Quality Checklist
- Answer pools ≥5
- Chain themes ≥8 (knowledge decks), ≥3 themes per run
- Total facts ≥30-50
- Synonyms computed, no dupes
- funScore and difficulty assigned
- No ambiguous answers
- Structural validation after EVERY build

## After Making Changes
1. Run deck validation scripts
2. Flag qa-agent if balance values changed
3. Update `docs/content/` files
4. `npm run registry:sync` if domains changed

#!/usr/bin/env python3
"""
German vocabulary quality-sweep processor.
Fixes distractor quality issues across batches 000-023.
Writes results to data/generated/quality-sweep/results/vocab-de/
"""

import json
import os
import sys

BATCH_DIR = "/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/batches/vocab-de"
RESULT_DIR = "/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/results/vocab-de"

# The generic preposition dump that appears across hundreds of rows
PREPOSITION_DUMP = ["from", "into", "toward", "until", "at", "by", "through", "with"]

def is_garbage_distractor(d: str) -> bool:
    """Return True if a distractor string is garbage."""
    if len(d) > 35:
        return True
    # German phrases or words leaked into English distractors
    german_markers = ["~", "etwas", "Ganz", "oder", "vom ", "Von ", "Zu ",
                      "einer ", "einem ", "eines ",
                      "nicht ", "mehr ", "kann ", "wird ", "beim ",
                      "aber ", "auch ", "fur ", "mit ", "und ", "auf ",
                      "nach ", "uber ", "unter ", "durch ", "bei ", "von ", "aus ",
                      "\u00dc", "\u00f6", "\u00fc", "\u00e4", "\u00df"]
    for marker in german_markers:
        if marker in d:
            return True
    # Topic-irrelevant random words leaked from the fact DB used as distractors
    # for basic vocab questions (nationality/science/institution terms)
    TOPIC_NOISE = {
        "arab", "arab (language)", "arabic", "turkish", "greek", "russian",
        "belgian", "electron", "bacterium", "bundesliga", "semester", "rucksack",
        "pistol", "philosopher", "architecture", "secretary-general", "secretary general",
        "sitzen", "thursday", "mayor", "painter", "pilot", "university",
        "candle", "harbour", "stadium", "museum", "passport",
        "classical", "twelve", "schoolgirl", "schoolboy", "chain",
        "interesting",
        "accompany", "to accompany", "to step back, resign", "to step back",
        "1) ever, each; 2) the more", "ever, each",
        "pattern, model, sample (m~)", "pattern, model, sample",
        "to carry out", "sample, test, rehearsal",
        "bacterium, bacteria",
    }
    d_lower = d.lower().strip()
    if d_lower in TOPIC_NOISE:
        return True
    # Contains parenthetical that looks like a German annotation: (M~) (K~) (Z~) etc.
    import re
    paren_match = re.search(r'\(([^)]+)\)', d)
    if paren_match:
        inner = paren_match.group(1)
        if any(c in inner for c in ["\u00f6", "\u00fc", "\u00e4", "\u00df"]):
            return True
        # German abbreviation hints like (M~), (K~), (Z~), (fli~), (r~), etc.
        if re.match(r'^[A-Za-z]+~$', inner):
            return True
    return False

def needs_replacement(distractors: list) -> bool:
    """Return True if the distractor list needs full replacement."""
    if distractors[:4] == PREPOSITION_DUMP[:4]:
        return True
    garbage_count = sum(1 for d in distractors if is_garbage_distractor(d))
    if garbage_count >= 3:
        return True
    return False

def has_any_garbage(distractors: list) -> bool:
    """Return True if any individual distractors are garbage."""
    return any(is_garbage_distractor(d) for d in distractors)


# ─── Semantic distractor pools by answer type ─────────────────────────────────
# These are human-curated semantically appropriate pools organized by category.
# Each pool is used when we need to rebuild distractors from scratch.

# For prepositions (locative/directional)
PREPOSITIONS = ["above", "below", "beside", "between", "behind", "across", "against",
                "along", "among", "around", "beyond", "despite", "during", "except",
                "inside", "near", "outside", "over", "past", "since", "throughout",
                "toward", "under", "within", "without", "before", "after", "beside",
                "onto", "off", "out of", "next to", "in front of", "behind", "across from"]

# For conjunctions / discourse particles
CONJUNCTIONS = ["and", "but", "or", "yet", "so", "nor", "although", "because", "since",
                "while", "whereas", "unless", "until", "when", "if", "though", "whether",
                "therefore", "however", "moreover", "furthermore", "consequently",
                "nevertheless", "nonetheless", "meanwhile", "otherwise", "instead",
                "meanwhile", "still", "already", "even", "just", "only", "also"]

# For pronouns
PRONOUNS = ["I", "me", "my", "mine", "you", "your", "yours", "he", "him", "his",
            "she", "her", "hers", "it", "its", "we", "us", "our", "ours",
            "they", "them", "their", "theirs", "this", "that", "these", "those",
            "who", "which", "what", "myself", "yourself", "himself", "herself",
            "itself", "ourselves", "themselves", "someone", "anyone", "everyone"]

# For modal/auxiliary verbs (infinitive form)
MODALS = ["to want to", "to have to", "to be able to", "to be allowed to",
          "to be supposed to", "to be going to", "to need to", "to like to",
          "to dare to", "to seem to", "to happen to", "to tend to",
          "to pretend to", "to appear to", "to choose to", "to manage to"]

# For common English verbs (infinitive)
VERBS = ["to go", "to come", "to say", "to get", "to make", "to know", "to think",
         "to take", "to see", "to want", "to give", "to use", "to find", "to tell",
         "to ask", "to seem", "to feel", "to try", "to leave", "to call", "to keep",
         "to let", "to put", "to mean", "to become", "to show", "to hear", "to play",
         "to run", "to move", "to live", "to believe", "to hold", "to bring", "to happen",
         "to write", "to provide", "to sit", "to stand", "to lose", "to pay", "to meet",
         "to include", "to continue", "to set", "to learn", "to change", "to lead",
         "to understand", "to watch", "to follow", "to stop", "to create", "to speak",
         "to read", "to spend", "to grow", "to open", "to walk", "to win", "to offer",
         "to remember", "to decide", "to return", "to explain", "to develop", "to send"]

# For common adjectives
ADJECTIVES = ["good", "bad", "new", "old", "big", "small", "large", "little",
              "high", "low", "long", "short", "great", "strong", "weak", "fast",
              "slow", "hard", "soft", "dark", "light", "warm", "cold", "hot",
              "clean", "dirty", "free", "full", "empty", "open", "closed", "right",
              "wrong", "true", "false", "real", "possible", "important", "different",
              "certain", "clear", "ready", "simple", "special", "whole", "young", "old"]

# For common adverbs
ADVERBS = ["here", "there", "now", "then", "also", "still", "already", "only",
           "always", "never", "often", "soon", "again", "very", "too", "just",
           "even", "however", "already", "still", "yet", "perhaps", "maybe",
           "probably", "certainly", "actually", "finally", "really", "quite",
           "nearly", "almost", "enough", "rather", "so", "well", "much",
           "together", "back", "away", "once", "thus", "indeed", "first"]

# For common nouns (body parts, family, basic)
NOUNS_BASIC = ["day", "year", "time", "man", "woman", "child", "house", "world",
               "country", "city", "water", "food", "work", "hand", "head", "eye",
               "face", "voice", "door", "room", "book", "word", "name", "life",
               "way", "place", "part", "end", "night", "morning", "evening", "week",
               "month", "school", "family", "friend", "thing", "question", "answer",
               "problem", "money", "car", "road", "table", "chair", "window",
               "heart", "body", "arm", "leg", "foot", "back", "mind", "thought"]

# For cardinal / ordinal numbers
NUMBERS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
           "eleven", "twelve", "thirteen", "twenty", "thirty", "hundred",
           "first", "second", "third", "fourth", "fifth", "sixth", "last",
           "once", "twice", "many times", "several times", "few times"]

# For time expressions
TIME_EXPRS = ["then", "now", "later", "soon", "before", "after", "already", "still",
              "always", "never", "often", "sometimes", "rarely", "yesterday", "today",
              "tomorrow", "recently", "currently", "finally", "suddenly", "immediately",
              "gradually", "meanwhile", "eventually", "previously", "now and then"]

# For place/direction phrases
PLACE_PHRASES = ["in the city", "in the house", "at the door", "in the room",
                 "on the street", "in the garden", "at home", "in the world",
                 "at school", "in the car", "in the kitchen", "on the table",
                 "at the table", "at the station", "in the park", "at the market",
                 "in the morning", "in the evening", "at noon", "at night",
                 "on the way", "at the window", "in the office", "at the hospital"]

# For phrase meaning (multi-word translations)
PHRASE_MEANINGS = ["in any case", "on the other hand", "in spite of", "by the way",
                   "at last", "at least", "at most", "more or less", "once more",
                   "for a while", "for the time being", "step by step", "all at once",
                   "as well", "as a result", "by the way", "on the contrary",
                   "sooner or later", "in fact", "of course", "after all",
                   "for example", "such as", "in other words", "at the same time",
                   "in the end", "more and more", "less and less", "more or less",
                   "right away", "in particular", "for good", "once and for all",
                   "first of all", "above all", "in general", "in particular",
                   "as long as", "as far as", "as soon as", "as well as",
                   "both...and", "either...or", "neither...nor", "not only...but also"]


def classify_answer(answer: str, question: str) -> str:
    """Classify the answer type to pick appropriate distractor pool."""
    # Strip parenthetical notes like "(familiar, singular)" for classification
    import re
    a_clean = re.sub(r'\s*\(.*?\)', '', answer).strip().lower()
    a = answer.lower().strip()
    q = question.lower()

    # Pronoun indicators: "formal", "plural", "singular", "familiar" in parens
    if re.search(r'\b(formal|plural|singular|familiar|reflexive)\b', a):
        return "pronoun"

    # Single pronouns
    if a_clean in {"i", "me", "my", "you", "he", "she", "it", "we", "they", "one",
                   "him", "her", "us", "them", "self", "this", "that", "your formal",
                   "your", "our", "their"}:
        return "pronoun"

    # Modal verb answers (including comma-separated forms like "to have to, must")
    modal_answers = {"can", "may", "might", "must", "should", "would", "could", "shall", "will",
                     "to have to", "to be able to", "to want to", "to need to",
                     "to have to, must", "to be able to, can", "should, ought to",
                     "can, be able to", "may, be allowed to"}
    if a_clean in modal_answers or a in modal_answers:
        return "modal"
    # Check first token for modal/infinitive
    first = a_clean.split(",")[0].strip()
    if first in modal_answers:
        return "modal"

    # Infinitive verbs (including comma-separated like "to do, make")
    if first.startswith("to ") and len(first.split()) <= 4:
        return "verb_infinitive"

    # Numbers
    if a_clean in {"one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                   "eleven", "twelve", "first", "second", "third", "times", "once", "twice"}:
        return "number"

    # Discourse particles / conjunctions / adverbs (single word or short combo)
    discourse = {"and", "but", "or", "not", "so", "yet", "nor", "also", "still", "already",
                 "only", "again", "well", "now", "yes", "no", "then", "there", "here",
                 "always", "never", "often", "very", "too", "just", "even", "however",
                 "though", "although", "because", "since", "while", "if", "when",
                 "than", "as", "how", "what", "where", "why", "who", "which",
                 "after", "before", "until", "once more", "virtually",
                 "nevertheless", "nonetheless", "moreover", "furthermore", "therefore",
                 "otherwise", "meanwhile", "indeed", "certainly", "perhaps", "maybe",
                 "probably", "quite", "rather", "nearly", "almost", "enough",
                 "through", "under", "over", "around", "about", "between", "without",
                 "against", "among", "behind", "above", "below", "near", "into", "onto",
                 "of", "at", "to", "for", "by", "from", "with", "in", "on", "up", "down", "off"}
    if a_clean in discourse:
        return "conjunction_prep"
    # Two-word discourse: "however, still", "not only but also" etc.
    if a_clean in {"however, still", "so, thus", "still, yet", "already, still",
                   "not yet", "not at all", "no more", "not so", "as well",
                   "little by little", "step by step"}:
        return "conjunction_prep"

    # Adjectives
    adj_words = {"good", "bad", "new", "old", "big", "small", "large", "first", "last",
                 "own", "free", "right", "whole", "different", "same", "certain",
                 "clear", "true", "false", "real", "possible", "important", "special",
                 "great", "strong", "weak", "long", "short", "high", "low", "young",
                 "necessary", "available", "fundamental", "numerous", "scarce",
                 "various", "several", "alone", "together", "wrong", "open", "closed"}
    if a_clean in adj_words:
        return "adjective"
    # Comma-separated adjective pairs like "big, large, great"
    if all(p.strip() in adj_words for p in a_clean.split(",") if p.strip()):
        return "adjective"
    if "adjective" in q or "the adjective" in q or "adj " in q:
        return "adjective"

    # Adverbs (single)
    adv_words = {"here", "there", "now", "then", "also", "still", "already", "only",
                 "always", "never", "often", "soon", "again", "very", "too", "just",
                 "even", "however", "yet", "perhaps", "maybe", "probably", "certainly",
                 "actually", "finally", "really", "quite", "nearly", "almost", "enough",
                 "rather", "thus", "indeed", "first", "last", "later", "soon", "sometimes"}
    if a_clean in adv_words:
        return "adverb"
    if "adverb" in q or "the adverb" in q:
        return "adverb"

    # German-article nouns (answer starts with die/der/das — these are DE→EN reversed questions)
    if re.match(r'^(die|der|das)\s', a):
        return "noun_de"  # answer IS German; distractors should be German noun forms

    # Nouns with article hint in answer or question
    if a_clean.startswith("the ") or "noun" in q:
        return "noun"

    # Two-word locative phrases
    if a_clean.startswith("in the") or a_clean.startswith("at the") or a_clean.startswith("on the"):
        return "place_phrase"

    # Multi-word idiomatic phrases (3+ words)
    if len(a_clean.split()) >= 3:
        return "phrase"

    # Two-word combinations
    if len(a_clean.split()) == 2:
        return "phrase"

    # Single common nouns
    return "general"


def get_distractor_pool(answer: str, question: str, existing_ok: list) -> list:
    """
    Return a list of semantically appropriate distractors for this answer.
    existing_ok are existing distractors that are already valid.
    """
    import re as _re
    a_lower = answer.lower().strip()
    # Also get the clean base form (without parentheticals) for exclusion matching
    a_base = _re.sub(r'\s*\(.*?\)', '', a_lower).strip()
    # For comma-separated answers, get the first token
    a_first = a_lower.split(",")[0].strip().split(";")[0].strip()
    # For "1) word; 2) word" style, extract first
    numbered = _re.match(r'^1\)\s*(.+?)(?:;|$)', a_lower)
    if numbered:
        a_first = numbered.group(1).strip()

    atype = classify_answer(answer, question)

    if atype == "verb_infinitive":
        pool = [v for v in VERBS if v.lower() not in (a_lower, a_first, a_base)]
    elif atype == "modal":
        pool = [m for m in MODALS if m.lower() not in (a_lower, a_first)]
        # supplement with other verb constructions that aren't in the answer
        pool += [v for v in VERBS if v not in pool and v.lower() not in (a_lower, a_first)]
    elif atype == "number":
        pool = [n for n in NUMBERS if n.lower() != a_base]
    elif atype == "pronoun":
        # Exclude the base pronoun (e.g. "you" from "you (familiar, singular)")
        pool = [p for p in PRONOUNS if p.lower() not in (a_lower, a_base, a_first)]
    elif atype == "conjunction_prep":
        pool = list(CONJUNCTIONS) + [p for p in PREPOSITIONS if len(p.split()) == 1]
        pool = [x for x in pool if x.lower() not in (a_lower, a_base, a_first)]
    elif atype == "adjective":
        pool = [adj for adj in ADJECTIVES if adj != a_lower]
    elif atype == "adverb":
        pool = [adv for adv in ADVERBS if adv != a_lower]
    elif atype == "phrase":
        pool = [ph for ph in PHRASE_MEANINGS if ph != a_lower]
        # Also include time expressions for temporal phrases
        pool += [t for t in TIME_EXPRS if t not in pool and t != a_lower]
    elif atype == "place_phrase":
        pool = [pp for pp in PLACE_PHRASES if pp != a_lower]
    elif atype == "noun":
        pool = [n for n in NOUNS_BASIC if n != a_lower]
    elif atype == "noun_de":
        # Answer IS a German word (die/der/das + noun) — distractors should be German nouns
        # Use the German forms of common nouns as distractors
        GERMAN_NOUNS = [
            "die Zeit", "das Haus", "der Mann", "die Frau", "das Kind", "die Stadt",
            "der Tag", "das Jahr", "die Welt", "der Mensch", "das Leben", "die Hand",
            "der Weg", "die Arbeit", "das Land", "die Frage", "der Fall", "das Wort",
            "die Nacht", "der Abend", "das Geld", "die Schule", "der Freund", "das Auto",
            "die Familie", "der Staat", "das Recht", "die Kunst", "der Teil", "die Seite",
            "das Buch", "der Platz", "die Stunde", "das Herz", "der Kopf", "die Hand",
            "das Ende", "der Name", "die Sprache", "das Feld", "der Grund", "die Natur",
            "das Volk", "der Raum", "die Kraft", "das Amt", "der Schritt", "die Form",
            "das Ziel", "der Blick", "die Meinung", "das Ergebnis", "der Bereich",
            "die Chance", "das Problem", "der Aspekt", "die Lösung", "das System",
            "der Erfolg", "die Idee", "das Thema", "der Prozess", "die Methode",
            "die Daten", "der Einfluss", "die Macht", "der Moment", "die Forderung",
            "die Untersuchung", "der Augenblick", "die Veränderung", "der Begriff",
        ]
        pool = [n for n in GERMAN_NOUNS if n.lower() != a_lower]
    else:
        # General: mix of adjectives, nouns, adverbs
        pool = [adj for adj in ADJECTIVES if adj != a_lower]
        pool += [n for n in NOUNS_BASIC if n not in pool and n != a_lower]
        pool += [adv for adv in ADVERBS if adv not in pool and adv != a_lower]

    # Remove duplicates and the correct answer
    seen = set()
    seen.add(a_lower)
    # Normalize existing_ok
    for d in existing_ok:
        seen.add(d.lower())
    filtered = []
    for item in pool:
        il = item.lower()
        if il not in seen:
            filtered.append(item)
            seen.add(il)

    return filtered


def fix_row(row: dict) -> dict:
    """
    Apply quality fixes to a single row. Returns the output dict.
    id, q, a, d, e, l1, l2, i
    null = no change; "d" always full; "i" = description of changes.
    """
    original_d = row["d"]
    changes = []

    new_q = None  # null = no change
    new_a = None
    new_e = None
    new_l1 = None
    new_l2 = None

    # ── Distractor Quality Check ────────────────────────────────────────────
    full_replace = needs_replacement(original_d)
    partial_fix = not full_replace and has_any_garbage(original_d)

    if full_replace:
        # Build replacement pool
        pool = get_distractor_pool(row["a"], row["q"], [])
        if len(pool) < 6:
            # Fall back to a mixed pool
            pool = (ADJECTIVES + NOUNS_BASIC + ADVERBS)
            pool = [x for x in pool if x.lower() != row["a"].lower()]
        new_d = pool[:8]
        # Ensure exactly 6-8
        if len(new_d) < 6:
            new_d = (new_d + ADJECTIVES + NOUNS_BASIC)[:8]
        changes.append("replaced garbage/template distractors with semantically appropriate alternatives")
    elif partial_fix:
        # Keep good distractors, replace garbage ones
        good = [d for d in original_d if not is_garbage_distractor(d)]
        bad_count = len(original_d) - len(good)
        pool = get_distractor_pool(row["a"], row["q"], good)
        # How many we need to add
        needed = max(6, 8 - len(good))
        replacements = pool[:needed]
        new_d = good + replacements
        new_d = new_d[:8]
        changes.append(f"replaced {bad_count} garbage distractor(s) with semantically coherent alternatives")
    else:
        new_d = original_d
        # Ensure 6-8 count
        if len(new_d) < 6:
            pool = get_distractor_pool(row["a"], row["q"], new_d)
            new_d = new_d + pool[:8-len(new_d)]
            changes.append("padded distractors to minimum 6")
        elif len(new_d) > 8:
            new_d = new_d[:8]
            changes.append("trimmed distractors to maximum 8")

    # ── Question Phrasing Improvements ──────────────────────────────────────
    q = row["q"]
    a = row["a"]

    # Fix "What is the German word for Y?" — rewrite more naturally
    if "What is the German word for" in q:
        # e.g. "What is the German word for 'food'?" → "Which German noun translates as 'food'?" or
        # "How do you say 'food' in German?"
        import re
        m = re.search(r"What is the German word for ['\"]?(.+?)['\"]?\??$", q)
        if m:
            term = m.group(1).strip("'\"? ")
            # Determine POS from answer
            ans = a.lower()
            if ans.startswith("to "):
                new_q = f"How do you say 'to {term}' in German? (verb)"
            elif a[0].isupper() and "die " not in a and "der " not in a and "das " not in a:
                new_q = f"What is the German translation of '{term}'?"
            else:
                art = ""
                if a.startswith("die "):
                    art = " (feminine noun)"
                elif a.startswith("der "):
                    art = " (masculine noun)"
                elif a.startswith("das "):
                    art = " (neuter noun)"
                new_q = f"What is the German word for '{term}'?{art}"
            changes.append("reworded 'What is the German word for X?' to more natural form")

    # Fix "What does X mean in English?" with no context — add POS hint for ambiguous words
    if new_q is None and "What does" in q and "mean" in q:
        # Add POS hints only where helpful and the question is generic
        a_lower = a.lower()
        # Modal verbs — add (modal verb) hint
        if a_lower in ["can", "may", "might", "must", "should", "would", "could", "shall", "will",
                        "to have to, must", "to be able to, can", "should, ought to",
                        "to want to", "to have to"]:
            pass  # These are fine as-is; explanation clarifies
        # Particles that are ambiguous (da, so, doch, etc.)
        # Keep as-is since explanation field covers it

    # ── "What does X mean?" missing "in English" ───────────────────────────
    # Some later batches drop "in English" — that's fine, leave it

    # ── Build output ──────────────────────────────────────────────────────
    info = "; ".join(changes) if changes else ""

    return {
        "id": row["id"],
        "q": new_q,          # null = no change
        "a": new_a,
        "d": new_d,          # always full array
        "e": new_e,
        "l1": new_l1,
        "l2": new_l2,
        "i": info
    }


def process_batch(batch_num: int):
    batch_str = f"{batch_num:03d}"
    input_path = os.path.join(BATCH_DIR, f"batch-{batch_str}.jsonl")
    output_path = os.path.join(RESULT_DIR, f"batch-{batch_str}.jsonl")

    if not os.path.exists(input_path):
        print(f"  SKIP: {input_path} not found")
        return 0, 0

    with open(input_path, "r", encoding="utf-8") as f:
        rows = [json.loads(line) for line in f if line.strip()]

    output_rows = []
    changed = 0
    for row in rows:
        result = fix_row(row)
        output_rows.append(result)
        if result["i"]:
            changed += 1

    os.makedirs(RESULT_DIR, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        for r in output_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"  batch-{batch_str}: {len(rows)} rows, {changed} modified → {output_path}")
    return len(rows), changed


def main():
    print(f"Processing batches 000-023 from {BATCH_DIR}")
    print(f"Writing results to {RESULT_DIR}\n")

    total_rows = 0
    total_changed = 0

    for i in range(24):
        rows, changed = process_batch(i)
        total_rows += rows
        total_changed += changed

    print(f"\nDone. Total: {total_rows} rows, {total_changed} modified.")


if __name__ == "__main__":
    main()

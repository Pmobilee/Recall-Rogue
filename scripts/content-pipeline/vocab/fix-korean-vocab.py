#!/usr/bin/env python3
"""
Fix Korean vocabulary answer quality issues in vocab-ko.json.

Phase 1: Apply 34 manual corrections for confirmed-wrong answers.
Phase 2: Extract clean answers from verbose definitions (pattern-based).
Phase 3: General cleanup (trailing periods, leading articles, quotes, spaces).
"""

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
VOCAB_FILE = REPO_ROOT / "src/data/seed/vocab-ko.json"

# ---------------------------------------------------------------------------
# Phase 1: Manual corrections (confirmed wrong answers from audit)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Phase 1b: Hardcoded fixes for NIKL definitions too vague for pattern extraction
# ---------------------------------------------------------------------------
COMMON_WORD_FIXES = {
    'ko-nikl-198':  'urgent',                   # 급하다
    'ko-nikl-206':  'joy, delight',             # 기쁨
    'ko-nikl-447':  'moment, point in time',    # 때
    'ko-nikl-461':  'to run',                   # 뛰다
    'ko-nikl-600':  'beyond, other side',       # 밖
    'ko-nikl-702':  'secret',                   # 비밀
    'ko-nikl-710':  'to fall in',               # 빠지다
    'ko-nikl-802':  'the world',                # 세계
    'ko-nikl-946':  'uncertain',                # 아무
    'ko-nikl-1000': 'complex, difficult',       # 어렵다
    'ko-nikl-1013': 'sometime',                 # 언젠가
    'ko-nikl-1058': 'zero',                     # 영
    'ko-nikl-1281': 'to write down',            # 적다
    'ko-nikl-1297': 'lunch time',               # 점심시간
    'ko-nikl-1506': 'to grow',                  # 자라다
    'ko-nikl-1592': 'student',                  # 학생
    'ko-nikl-1672': 'strenuous, hard',          # 힘들다
    'ko-nikl-1856': 'high-level',               # 고급
    'ko-nikl-1893': 'everywhere',               # 곳곳
    'ko-nikl-2056': 'recent times',             # 근래
    'ko-nikl-275':  'younger brother',          # 남동생
    'ko-nikl-280':  'husband',                  # 남편
    'ko-nikl-283':  'daytime',                  # 낮
    'ko-nikl-284':  'next year',                # 내년
    'ko-nikl-340':  'different',                # 다르다
    'ko-nikl-341':  'day after tomorrow',       # 모레
    'ko-nikl-418':  'pork',                     # 돼지고기
    'ko-nikl-497':  'bad-tasting',              # 맛없다
    'ko-nikl-518':  'excellent',                # 멋지다
    'ko-nikl-556':  'free (no charge)',         # 무료
    'ko-nikl-579':  'flour',                    # 밀가루
    'ko-nikl-240':  'vase',                     # 꽃병
    'ko-nikl-248':  'end, expiration',          # 끝
    'ko-nikl-306':  'yellow',                   # 노란색
    'ko-nikl-313':  'green',                    # 녹색
}

CORRECTIONS = {
    'ko-nikl-9719': 'swept away',
    'ko-nikl-9228': 'to block, plug up',
    'ko-nikl-9626': 'burn (injury)',
    'ko-nikl-9539': 'futile, vain',
    'ko-nikl-9422': 'to the fullest',
    'ko-nikl-9486': 'tsunami',
    'ko-nikl-9246': 'to be buried',
    'ko-nikl-4787': 'best effort',
    'ko-nikl-4777': 'anxiety',
    'ko-nikl-4674': 'to chase',
    'ko-nikl-4821': 'side, aspect',
    'ko-nikl-5134': 'sunny, clear',
    'ko-nikl-4706': 'sesame oil',
    'ko-nikl-4625': 'zipper',
    'ko-nikl-4595': 'diagnosis',
    'ko-nikl-5201': 'excitement',
    'ko-nikl-4933': 'quite, very',
    'ko-nikl-5073': 'modern era',
    'ko-nikl-3404': 'triangle',
    'ko-nikl-5467': 'fruition',
    'ko-nikl-5241': 'to fade away',
    'ko-nikl-5411': 'half-heartedly',
    'ko-nikl-5233': 'patriarchal',
    'ko-nikl-5395': 'macroscopic',
    'ko-nikl-5575': 'hardship',
    'ko-nikl-6524': 'role, excuse',
    'ko-nikl-7262': 'flaw, defect',
    # Additional from beginner/intermediate audit
    'ko-nikl-1513': 'to ride',
    'ko-nikl-458':  'smart, clever',
    'ko-nikl-1713': 'barely, narrowly',
    'ko-nikl-1159': 'beverage',
    'ko-nikl-5133': 'topic, talking point',
    'ko-nikl-1576': 'to bloom, to smoke',
    'ko-nikl-1230': 'repeatedly',
}


# ---------------------------------------------------------------------------
# Phase 2: Pattern-based extraction for verbose definitions
# ---------------------------------------------------------------------------

def _extract_role_noun(text: str) -> str | None:
    """
    'person whose job it is to X'  →  role noun
    'person who X-s / person who was born as Y'  →  role noun
    """
    # "person whose job it is to sing" → "singer"
    m = re.match(r'person whose job it is to (.+)', text, re.IGNORECASE)
    if m:
        verb = m.group(1).strip().rstrip('.')
        role_map = {
            'sing': 'singer', 'teach': 'teacher', 'cook': 'cook',
            'drive': 'driver', 'act': 'actor', 'write': 'writer',
            'paint': 'painter', 'nurse': 'nurse', 'farm': 'farmer',
            'fish': 'fisher', 'hunt': 'hunter', 'manage': 'manager',
            'clean': 'cleaner', 'guard': 'guard', 'deliver': 'delivery person',
            'bake': 'baker', 'sell': 'seller', 'translate': 'translator',
            'design': 'designer', 'direct': 'director', 'report': 'reporter',
            'research': 'researcher', 'treat patients': 'doctor',
            'heal patients': 'doctor', 'perform surgery': 'surgeon',
        }
        return role_map.get(verb.lower(), verb + 'er' if not verb.endswith('e') else verb + 'r')

    # "person who performs in a movie" → "actor"
    # "person who goes on a tour"      → "tourist"
    # "person who was born as a male"  → "man"
    specific_map = {
        r'person who performs? in a movie': 'actor',
        r'person who goes? on a tour': 'tourist',
        r'person who was born as a male': 'man',
        r'person who was born as a female': 'woman',
        r'person who watches? something': 'spectator',
        r'person who leads? a group': 'leader',
        r'person who is? in charge': 'person in charge',
    }
    for pattern, result in specific_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    return None


def _extract_act_noun(text: str) -> str | None:
    """
    'act of X-ing' / 'action of X-ing'  →  noun form
    """
    act_map = {
        r'act of helping another person': 'help',
        r'act of reaching a destination': 'arrival',
        r'act of teaching students?': 'teaching',
        r'act of choosing among options?': 'choice',
        r'act of moving from one place to another': 'movement',
        r'act of receiving something': 'reception',
        r'act of giving something': 'giving',
        r'act of making something': 'making',
        r'act of meeting someone': 'meeting',
        r'act of buying something': 'purchase',
        r'act of selling something': 'sale',
        r'act of reading': 'reading',
        r'act of writing': 'writing',
        r'act of speaking': 'speaking',
        r'act of studying': 'studying',
        r'act of working': 'work',
        r'act of cooking': 'cooking',
        r'act of eating': 'eating',
        r'act of drinking': 'drinking',
        r'act of sleeping': 'sleeping',
        r'act of traveling': 'travel',
        r'act of returning': 'return',
        r'act of waiting': 'waiting',
        r'act of running': 'running',
        r'act of thinking': 'thinking',
        r'act of deciding': 'decision',
        r'act of preparing': 'preparation',
        r'act of using': 'use',
        r'act of entering': 'entry',
        r'act of leaving': 'departure',
        r'act of starting': 'start',
        r'act of ending': 'end',
        r'act of changing': 'change',
    }
    for pattern, result in act_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic: "act of X-ing" → X-ing
    m = re.match(r'(?:act|action) of (.+)', text, re.IGNORECASE)
    if m:
        action = m.group(1).strip().rstrip('.')
        return action

    return None


def _extract_place(text: str) -> str | None:
    """
    'place where/to X'  →  place type
    """
    place_map = {
        r'place to get on or off a train': 'train station',
        r'place where four roads meet': 'intersection',
        r'place where products are (?:displayed and )?sold': 'store',
        r'place where people worship': 'house of worship',
        r'place where people live': 'residence',
        r'place where students learn': 'school',
        r'place where books are kept': 'library',
        r'place where money is kept': 'bank',
        r'place where sick people go': 'hospital',
        r'place where planes land': 'airport',
        r'place where buses stop': 'bus stop',
        r'place where food is served': 'restaurant',
        r'place where films? (?:are shown|is shown)': 'cinema',
        r'place to sleep': 'bedroom',
        r'place to cook': 'kitchen',
        r'place to eat': 'dining room',
        r'place to park': 'parking lot',
        r'place to exercise': 'gym',
        r'place to swim': 'swimming pool',
    }
    for pattern, result in place_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_food(text: str) -> str | None:
    """
    'meat of pigs eaten as food' → 'pork'
    'Soup made with seaweed'     → 'seaweed soup'
    etc.
    """
    food_map = {
        r'meat of pigs? eaten as food': 'pork',
        r'meat of cows? eaten as food': 'beef',
        r'meat of chickens? eaten as food': 'chicken',
        r'soup that is made with seaweed': 'seaweed soup',
        r'powder made by grinding wheat': 'flour',
        r'medicine used to treat colds?': 'cold medicine',
        r'drink made from fermented rice': 'rice wine',
        r'food made from fermented cabbage': 'kimchi',
        r'soup made with tofu': 'tofu soup',
        r'rice cooked with vegetables': 'bibimbap',
    }
    for pattern, result in food_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic "X eaten as food" → X
    m = re.match(r'(.+?) eaten as food', text, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip('.')

    # Generic "X made from/with Y" — keep as-is if short enough (handled later)
    return None


def _extract_color(text: str) -> str | None:
    """
    'color of a chick or banana' → 'yellow'
    """
    color_map = {
        r'color of (?:a )?chick|color of.*banana': 'yellow',
        r'color of grass|color of.*tree leaves': 'green',
        r'mixed color of red and yellow': 'orange',
        r'color of.*sky': 'blue',
        r'color of.*snow|color of.*milk': 'white',
        r'color of.*night|color of.*coal': 'black',
        r'color of.*blood|color of.*apple': 'red',
        r'color of.*violet|color of.*purple': 'purple',
        r'color of.*pink': 'pink',
        r'color of.*brown': 'brown',
    }
    for pattern, result in color_map.items():
        if re.search(pattern, text, re.IGNORECASE):
            return result

    # Generic "color of X"
    m = re.match(r'color of (.+)', text, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip('.')

    return None


def _extract_state(text: str) -> str | None:
    """
    'state of being X' / 'state of X'  →  X or X-ness
    """
    state_map = {
        r'state of being not far': 'near, close',
        r'state of charging nothing': 'free (no charge)',
        r'state of being free': 'free',
        r'state of being busy': 'busy',
        r'state of being happy': 'happy',
        r'state of being sad': 'sad',
        r'state of being tired': 'tired',
        r'state of being angry': 'angry',
        r'state of being afraid': 'afraid',
        r'state of being healthy': 'healthy',
        r'state of being sick': 'sick',
        r'state of being alone': 'alone',
        r'state of being ready': 'ready',
        r'state of being complete': 'complete',
        r'state of being empty': 'empty',
        r'state of being full': 'full',
        r'state of being loud': 'loud',
        r'state of being quiet': 'quiet',
        r'state of being clean': 'clean',
        r'state of being dirty': 'dirty',
        r'state of being hot': 'hot',
        r'state of being cold': 'cold',
        r'state of being warm': 'warm',
        r'state of being cool': 'cool',
        r'state of being safe': 'safe',
        r'state of being dangerous': 'dangerous',
    }
    for pattern, result in state_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic: "state of being X" → X
    m = re.match(r'state of being (.+)', text, re.IGNORECASE)
    if m:
        adj = m.group(1).strip().rstrip('.')
        return adj

    # Generic: "state of X" → X
    m = re.match(r'state of (.+)', text, re.IGNORECASE)
    if m:
        noun = m.group(1).strip().rstrip('.')
        return noun

    return None


def _extract_family_term(text: str) -> str | None:
    """
    'The mother of one's husband' → 'mother-in-law'
    'One's male child'            → 'son'
    """
    family_map = {
        r"(?:the )?mother of one's husband": 'mother-in-law (husband\'s side)',
        r"(?:the )?father of one's husband": 'father-in-law (husband\'s side)',
        r"(?:the )?mother of one's wife": 'mother-in-law (wife\'s side)',
        r"(?:the )?father of one's wife": 'father-in-law (wife\'s side)',
        r"one's male child": 'son',
        r"one's female child": 'daughter',
        r"one's older brother.*male": 'older brother (for males)',
        r"one's older brother.*female": 'older brother (for females)',
        r"one's older sister.*male": 'older sister (for males)',
        r"one's older sister.*female": 'older sister (for females)',
        r"one's younger sibling": 'younger sibling',
        r"one's husband": 'husband',
        r"one's wife": 'wife',
        r"one's grandfather": 'grandfather',
        r"one's grandmother": 'grandmother',
        r"one's uncle": 'uncle',
        r"one's aunt": 'aunt',
        r"one's cousin": 'cousin',
        r"one's nephew": 'nephew',
        r"one's niece": 'niece',
    }
    for pattern, result in family_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_time(text: str) -> str | None:
    """
    'time from sunrise to sunset' → 'daytime'
    """
    time_map = {
        r'time from sunrise to sunset': 'daytime',
        r'time from sunset to sunrise': 'nighttime',
        r'time before noon': 'morning',
        r'time after noon': 'afternoon',
        r'time in the evening': 'evening',
        r'time at night': 'night',
        r'first part of the day': 'morning',
        r'last part of the day': 'evening',
    }
    for pattern, result in time_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_symptom(text: str) -> str | None:
    """
    'symptom of a pain in the head' → 'headache'
    """
    symptom_map = {
        r'symptom of a pain in the head': 'headache',
        r'symptom of a pain in the stomach': 'stomachache',
        r'symptom of a pain in the back': 'backache',
        r'symptom of a pain in the tooth': 'toothache',
        r'symptom of a high temperature': 'fever',
        r'symptom of difficulty breathing': 'breathing difficulty',
        r'symptom of a runny nose': 'runny nose',
        r'symptom of a sore throat': 'sore throat',
    }
    for pattern, result in symptom_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic "symptom of X" → X
    m = re.match(r'symptom of (.+)', text, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip('.')

    return None


def _extract_not_pattern(text: str) -> str | None:
    """
    'Not too lengthy or complex'       → 'simple'
    'Not different from each other'    → 'same, similar'
    'Not the same as each other'       → 'different'
    """
    not_map = {
        r'not too lengthy or complex': 'simple',
        r'not different from each other': 'same, similar',
        r'not the same as each other': 'different',
        r'not short': 'long',
        r'not long': 'short',
        r'not small': 'large, big',
        r'not large|not big': 'small',
        r'not fast': 'slow',
        r'not slow': 'fast',
        r'not easy': 'difficult',
        r'not difficult|not hard': 'easy',
        r'not old': 'new, young',
        r'not new': 'old',
        r'not near|not close': 'far',
        r'not far': 'near, close',
        r'not heavy': 'light',
        r'not light': 'heavy',
        r'not cheap|not inexpensive': 'expensive',
        r'not expensive': 'cheap',
        r'not dirty': 'clean',
        r'not clean': 'dirty',
        r'not noisy': 'quiet',
        r'not quiet': 'noisy',
        r'not dark': 'bright',
        r'not bright|not light': 'dark',
    }
    for pattern, result in not_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def apply_pattern_extraction(answer: str) -> tuple[str, str] | None:
    """
    Try each extraction rule in order. Returns (new_answer, rule_name) or None.
    Only applies when len(answer) > 20.
    """
    if len(answer) <= 20:
        return None

    text = answer.strip()

    # Rule 1: person whose job / person who
    if re.match(r'person (?:whose|who)', text, re.IGNORECASE):
        result = _extract_role_noun(text)
        if result:
            return result, 'role_noun'

    # Rule 2: act of / action of
    if re.match(r'(?:act|action) of', text, re.IGNORECASE):
        result = _extract_act_noun(text)
        if result:
            return result, 'act_noun'

    # Rule 3: place where/to
    if re.match(r'place (?:where|to)', text, re.IGNORECASE):
        result = _extract_place(text)
        if result:
            return result, 'place'

    # Rule 4: food patterns
    if re.search(r'eaten as food|made from|made with|made by grinding', text, re.IGNORECASE):
        result = _extract_food(text)
        if result:
            return result, 'food'

    # Rule 5: color of
    if re.match(r'(?:mixed )?color of', text, re.IGNORECASE):
        result = _extract_color(text)
        if result:
            return result, 'color'

    # Rule 6: state of being / state of
    if re.match(r'state of', text, re.IGNORECASE):
        result = _extract_state(text)
        if result:
            return result, 'state'

    # Rule 7: family terms
    if re.match(r"(?:the )?(?:mother|father|one's)", text, re.IGNORECASE):
        result = _extract_family_term(text)
        if result:
            return result, 'family'

    # Rule 8: time from X to Y
    if re.match(r'time from|time before|time after|time (?:in|at)', text, re.IGNORECASE):
        result = _extract_time(text)
        if result:
            return result, 'time'

    # Rule 9: symptom of
    if re.match(r'symptom of', text, re.IGNORECASE):
        result = _extract_symptom(text)
        if result:
            return result, 'symptom'

    # Rule 10: Not X patterns
    if re.match(r'not ', text, re.IGNORECASE):
        result = _extract_not_pattern(text)
        if result:
            return result, 'not_pattern'

    return None


# ---------------------------------------------------------------------------
# Phase 3: General cleanup helpers
# ---------------------------------------------------------------------------

def clean_answer(answer: str) -> str:
    """Apply general cleanup rules to any answer."""
    text = answer

    # Strip outer quotes (leading/trailing single or double)
    text = re.sub(r'^["\'](.+)["\']$', r'\1', text.strip())

    # Strip leading "(honorific) " → move to suffix
    m = re.match(r'^\(honorific\)\s+(.+)', text, re.IGNORECASE)
    if m:
        text = m.group(1).strip() + ' (honorific)'

    # Strip trailing period
    text = text.rstrip('.')

    # Strip leading "A " / "An " / "The " from answers ≤ 25 chars
    if len(text) <= 25:
        text = re.sub(r'^(?:A |An |The )(?=\S)', '', text)

    # Normalize double spaces
    text = re.sub(r'  +', ' ', text).strip()

    return text


def fallback_truncate(answer: str) -> tuple[str, str] | None:
    """If > 30 chars and no pattern matched, truncate at last comma/space before 30."""
    if len(answer) <= 30:
        return None
    # Try last comma before char 30
    sub = answer[:30]
    comma_pos = sub.rfind(',')
    if comma_pos > 10:
        return answer[:comma_pos].strip(), 'fallback_truncate'
    # Try last space before char 30
    space_pos = sub.rfind(' ')
    if space_pos > 10:
        return answer[:space_pos].strip(), 'fallback_truncate'
    # Hard cut at 30
    return answer[:30].strip(), 'fallback_truncate'


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Loading {VOCAB_FILE} ...")
    with open(VOCAB_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    total = len(data)
    manual_applied = 0
    pattern_applied = 0
    fallback_applied = 0
    cleanup_applied = 0
    total_changed = 0

    for entry in data:
        entry_id = entry.get('id', '')
        original = entry.get('correctAnswer', '')
        current = original

        # --- Phase 1: Manual corrections ---
        if entry_id in CORRECTIONS:
            new_val = CORRECTIONS[entry_id]
            if current != new_val:
                entry['correctAnswer'] = new_val
                current = new_val
                manual_applied += 1
                print(f"  [manual]   {entry_id}: {original!r} → {new_val!r}")

        # --- Phase 2: Pattern extraction (only on verbose answers > 20 chars) ---
        if len(current) > 20:
            result = apply_pattern_extraction(current)
            if result:
                new_val, rule = result
                # Apply general cleanup to extracted result too
                new_val = clean_answer(new_val)
                if new_val and new_val != current:
                    print(f"  [{rule:<20}] {entry_id}: {current!r} → {new_val!r}")
                    entry['correctAnswer'] = new_val
                    current = new_val
                    pattern_applied += 1

        # --- Phase 2b: Fallback truncation (> 30 chars, no pattern matched) ---
        if len(current) > 30:
            result = fallback_truncate(current)
            if result:
                new_val, rule = result
                new_val = clean_answer(new_val)
                if new_val and new_val != current:
                    print(f"  [fallback_truncate  ] {entry_id}: {current!r} → {new_val!r}")
                    entry['correctAnswer'] = new_val
                    current = new_val
                    fallback_applied += 1

        # --- Phase 3: General cleanup (applied to ALL answers) ---
        cleaned = clean_answer(current)
        if cleaned and cleaned != current:
            entry['correctAnswer'] = cleaned
            current = cleaned
            cleanup_applied += 1

        if current != original:
            total_changed += 1

    # Write back
    print(f"\nWriting corrected data to {VOCAB_FILE} ...")
    with open(VOCAB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print("\n--- Summary ---")
    print(f"  Total entries processed : {total}")
    print(f"  Manual corrections      : {manual_applied}")
    print(f"  Pattern extractions     : {pattern_applied}")
    print(f"  Fallback truncations    : {fallback_applied}")
    print(f"  Cleanup-only changes    : {cleanup_applied}")
    print(f"  Total entries changed   : {total_changed}")


if __name__ == '__main__':
    main()

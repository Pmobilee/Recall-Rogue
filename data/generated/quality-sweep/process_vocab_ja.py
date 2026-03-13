#!/usr/bin/env python3
"""
Japanese vocabulary quality sweep processor.
Processes batches 000-018 of vocab-ja.
Rules:
1. Fix "What does X mean?" questions to add part-of-speech/context hint where possible
2. Fix "What is the Japanese word for Y?" questions (rewrite more naturally)
3. Ensure 6-8 distractors, same semantic field, match answer format
4. Remove nonsense/placeholder distractors (I, X, Y, 'wonder', 'son-in-law', etc. in kana)
"""

import json
import os
import re

# ─────────────────────────────────────────────
# Distractor pools by category/answer type
# ─────────────────────────────────────────────

# Hiragana romaji pool – grouped by row for plausible nearby characters
HIRA_ROMAJI_ALL = [
    'a','i','u','e','o',
    'ka','ki','ku','ke','ko',
    'sa','shi','su','se','so',
    'ta','chi','tsu','te','to',
    'na','ni','nu','ne','no',
    'ha','hi','fu','he','ho',
    'ma','mi','mu','me','mo',
    'ya','yu','yo',
    'ra','ri','ru','re','ro',
    'wa','n',
    'ga','gi','gu','ge','go',
    'za','ji','zu','ze','zo',
    'da','de','do',
    'ba','bi','bu','be','bo',
    'pa','pi','pu','pe','po',
]

# Katakana romaji pool – same as hiragana but also includes extended
KATA_ROMAJI_ALL = HIRA_ROMAJI_ALL + [
    'fa','fi','fe','fo',
    'tchi','ttsu','sha','shu','sho',
    'cha','chu','cho','ja','ju','jo',
    'kya','kyu','kyo','nya','nyu','nyo',
    'hya','hyu','hyo','rya','ryu','ryo',
    'mya','myu','myo','gya','gyu','gyo',
    'bya','byu','byo','pya','pyu','pyo',
]

# Grammar meaning pool – plausible Japanese grammar function words in English
GRAMMAR_MEANINGS = [
    "even so; still", "in that case", "at that time", "as it is",
    "because of that", "although; even though", "after all; in the end",
    "by the time; until", "as a result", "in addition; furthermore",
    "on the contrary", "in other words", "for example", "suddenly; all at once",
    "gradually; little by little", "by any chance", "just then; at that moment",
    "as expected; sure enough", "no wonder; naturally", "perhaps; probably",
    "it seems that; apparently", "supposedly; reportedly", "it goes without saying",
    "not only… but also", "the more… the more", "as long as; provided that",
    "before long; soon", "in spite of; despite", "with that said",
    "of course; needless to say", "once; as soon as", "while; during",
    "since; now that", "as if; as though", "whether or not",
    "somehow; in some way", "right away; immediately", "from now on",
    "up until; as far as", "without doing; instead of", "about; approximately",
    "compared to; in contrast", "at least; if nothing else", "no matter what",
    "regardless of", "it is because", "so that; in order to",
    "even if; even though", "cannot help but", "there is no need to",
    "it is difficult to", "it is easy to", "is said to be",
    "tend to; often", "is supposed to", "it is likely that",
    "let alone; not to mention", "assuming that; if", "or rather; more precisely",
]

# Kanji meaning pool grouped by semantic field
KANJI_NATURE = ["mountain","river","tree","stone","earth","sky","sea","cloud","wind","fire","water","forest","field","valley","island","cave","plain","cliff","root","branch"]
KANJI_PEOPLE = ["person","people","man","woman","child","elder","king","lord","minister","servant","warrior","scholar","merchant","farmer","monk","noble","ancestor","descendant","hero","leader"]
KANJI_BODY = ["head","eye","ear","mouth","hand","foot","heart","body","bone","skin","hair","arm","leg","face","neck","shoulder","back","chest","stomach","finger"]
KANJI_TIME = ["day","night","morning","evening","year","month","week","hour","season","spring","summer","autumn","winter","era","age","moment","period","ancient","future","past"]
KANJI_PLACE = ["house","room","door","gate","road","bridge","castle","village","city","country","capital","temple","shrine","market","field","port","land","territory","border","district"]
KANJI_ACTION = ["go","come","walk","run","stand","sit","eat","drink","see","hear","speak","write","read","work","rest","sleep","rise","fall","open","close"]
KANJI_STATE = ["big","small","high","low","long","short","old","new","good","bad","strong","weak","heavy","light","fast","slow","bright","dark","hard","soft"]
KANJI_ABSTRACT = ["truth","virtue","honor","duty","law","rule","spirit","heart","mind","thought","will","hope","fear","joy","sorrow","anger","beauty","wisdom","power","peace"]
KANJI_MISC = ["number","part","rank","class","type","form","kind","method","reason","purpose","result","amount","value","measure","quality","level","degree","matter","thing","place"]

def get_kanji_distractors(answer: str, existing_d: list) -> list:
    """Generate plausible kanji meaning distractors based on the answer."""
    ans_lower = answer.lower().strip()
    ans_words = set(ans_lower.split())

    # Pick the best pools based on answer content
    candidate_pools = []

    # Always include misc as fallback
    candidate_pools.extend(KANJI_MISC)

    # Add semantic pools based on answer type
    nature_words = {'mountain','river','tree','stone','earth','sky','sea','cloud','wind','fire','water','forest','field','valley','island','cave','plain','cliff','root','branch','sun','moon','star','rain','snow','sand','rock','flower','grass','leaf'}
    people_words = {'person','people','man','woman','child','elder','king','lord','minister','warrior','scholar','noble','ancestor','hero','leader','general','officer','master','slave','ruler','emperor'}
    body_words = {'head','eye','ear','mouth','hand','foot','heart','body','bone','skin','hair','arm','leg','face','neck','shoulder','back','chest','stomach','finger','toe','knee','elbow','wrist'}
    time_words = {'day','night','morning','evening','year','month','week','hour','season','spring','summer','autumn','winter','era','age','moment','period','ancient','future','past','time','dawn','dusk'}
    place_words = {'house','room','door','gate','road','bridge','castle','village','city','country','capital','temple','shrine','market','field','port','land','territory','district','home','place'}
    action_words = {'go','come','walk','run','stand','sit','eat','drink','see','hear','speak','write','read','work','rest','sleep','rise','fall','open','close','carry','hold','give','take','make'}
    state_words = {'big','small','high','low','long','short','old','new','good','bad','strong','weak','heavy','light','fast','slow','bright','dark','hard','soft','deep','shallow','wide','narrow','full','empty'}
    abstract_words = {'truth','virtue','honor','duty','law','rule','spirit','heart','mind','thought','will','hope','fear','joy','sorrow','anger','beauty','wisdom','power','peace','love','hate','faith'}

    if ans_words & nature_words:
        candidate_pools.extend(KANJI_NATURE)
    if ans_words & people_words:
        candidate_pools.extend(KANJI_PEOPLE)
    if ans_words & body_words:
        candidate_pools.extend(KANJI_BODY)
    if ans_words & time_words:
        candidate_pools.extend(KANJI_TIME)
    if ans_words & place_words:
        candidate_pools.extend(KANJI_PLACE)
    if ans_words & action_words:
        candidate_pools.extend(KANJI_ACTION)
    if ans_words & state_words:
        candidate_pools.extend(KANJI_STATE)
    if ans_words & abstract_words:
        candidate_pools.extend(KANJI_ABSTRACT)

    # Add all pools if small answer (ambiguous)
    if len(answer) <= 5:
        for pool in [KANJI_NATURE, KANJI_PEOPLE, KANJI_STATE, KANJI_ACTION, KANJI_ABSTRACT]:
            candidate_pools.extend(pool)

    # Filter out answer itself and duplicates
    seen = {ans_lower}
    seen.update(d.lower() for d in existing_d)
    result = []
    for c in candidate_pools:
        if c.lower() not in seen and c.lower() != ans_lower:
            seen.add(c.lower())
            result.append(c)
        if len(result) >= 8:
            break

    return result[:8]


def get_kana_distractors(answer: str, char_type: str) -> list:
    """Generate valid romaji distractors for a kana character reading."""
    pool = KATA_ROMAJI_ALL if char_type == 'kata' else HIRA_ROMAJI_ALL
    ans = answer.lower().strip()

    # For special cases like 'o/wo (particle)' or 'ha (wa as particle)' or 'n'
    # Extract the core romaji
    core = ans.split('/')[0].split('(')[0].strip()

    seen = {ans, core}
    result = []

    # Prefer phonetically similar distractors
    # Same vowel group
    vowel = core[-1] if core else ''
    same_vowel = [r for r in pool if r.endswith(vowel) and r not in seen]
    # Same consonant group
    consonant = core[:-1] if len(core) > 1 else ''
    same_cons = [r for r in pool if consonant and r.startswith(consonant) and r not in seen]

    # Build priority list
    priority = []
    priority.extend(same_vowel[:4])
    priority.extend(same_cons[:4])
    priority.extend([r for r in pool if r not in seen])

    for c in priority:
        if c not in seen:
            seen.add(c)
            result.append(c)
        if len(result) >= 8:
            break

    return result[:8]


def get_grammar_distractors(answer: str, existing_d: list) -> list:
    """Get plausible grammar meaning distractors."""
    ans_lower = answer.lower().strip()
    seen = {ans_lower}

    # Filter existing good distractors (keep ones that are real grammar meanings)
    good_existing = []
    bad_tokens = {'x-ray', 'x ray', 'home', 'corporal', 'form', 'type', 'class', 'kind',
                  'fairly', 'quite', 'rather', 'likely', 'partly', 'almost', 'barely', 'hardly'}
    for d in existing_d:
        if d.lower() not in bad_tokens and d.lower() != ans_lower and len(d) > 2:
            good_existing.append(d)
            seen.add(d.lower())

    result = list(good_existing)

    for m in GRAMMAR_MEANINGS:
        if m.lower() not in seen:
            seen.add(m.lower())
            result.append(m)
        if len(result) >= 8:
            break

    return result[:8]


def needs_distractor_fix(d: list, answer: str, category: str) -> bool:
    """Check if distractors need replacement."""
    if len(d) < 6:
        return True
    bad_tokens = {'x-ray', 'x', 'y', 'i', 'on', 'of', 'is', 'be', 'to',
                  'wonder', 'son-in-law', 'home', 'form', 'type', 'class', 'kind'}
    bad_count = sum(1 for item in d if item.strip().lower() in bad_tokens)
    if bad_count >= 2:
        return True
    # Check for nonsense kanji distractors like "a type of plant (Genus sp.)"
    nonsense_count = sum(1 for item in d if 'sp.)' in item or 'Genus' in item or 'Rhizoma' in item)
    if nonsense_count >= 1:
        return True
    return False


def fix_question(q: str, answer: str, category: str, fact_id: str) -> tuple[str | None, str]:
    """Improve question phrasing. Returns (new_q or None, description_of_change)."""
    changes = []
    new_q = q

    # Determine JLPT level from ID
    jlpt = ''
    if '-n5-' in fact_id: jlpt = 'N5'
    elif '-n4-' in fact_id: jlpt = 'N4'
    elif '-n3-' in fact_id: jlpt = 'N3'
    elif '-n2-' in fact_id: jlpt = 'N2'
    elif '-n1-' in fact_id: jlpt = 'N1'

    # Grammar questions: "What does the grammar pattern 'X' mean?"
    # → "What is the meaning of the Japanese grammar pattern 'X'? (connective expression)"
    # For grammar, the existing q is fine – it already names the pattern and asks for meaning
    # But we can add usage type hint if the answer reveals it

    # Kanji questions: "What does the kanji 'X' mean?"
    # These are acceptable – kanji meaning questions don't need pos hints
    # But we can add JLPT level for kanji
    if category == 'kanji' and jlpt and "kanji" in q.lower():
        # Add JLPT context to the question
        if f'(JLPT {jlpt})' not in q:
            # Extract the kanji from the question
            m = re.search(r"'([^']+)'", q)
            if m:
                kanji_char = m.group(1)
                new_q = f"What does the kanji '{kanji_char}' mean? (JLPT {jlpt} level)"
                changes.append(f"Added JLPT {jlpt} level context to question")

    if new_q == q:
        return None, ''
    return new_q, '; '.join(changes)


def process_row(row: dict) -> dict:
    """Process one row and return the output delta row."""
    rid = row['id']
    q = row['q']
    a = row['a']
    d = row['d']

    # Determine category
    if rid.startswith('ja-kana-hira'):
        cat = 'hira'
    elif rid.startswith('ja-kana-kata'):
        cat = 'kata'
    elif rid.startswith('ja-kanji'):
        cat = 'kanji'
    elif 'grammar' in rid:
        cat = 'grammar'
    else:
        cat = 'other'

    changes = []
    new_q = None
    new_a = None
    new_d = None
    new_e = None

    # ── Fix specific known bad answers ──
    # ja-grammar-additional-009: answer is "kudaisamasenka" (romaji of くださいませんか)
    if rid == 'ja-grammar-additional-009':
        new_a = 'Could you please (do)…? (polite request)'
        changes.append('Fixed answer from raw romaji to proper English gloss')

    # Fix answers with trailing semicolons
    if a.endswith(';') and new_a is None:
        new_a = a.rstrip(';').strip()
        changes.append('Removed trailing semicolon from answer')

    effective_a = new_a if new_a else a

    # ── Fix distractors ──
    if cat in ('hira', 'kata'):
        if needs_distractor_fix(d, effective_a, cat):
            new_d = get_kana_distractors(effective_a, cat)
            changes.append(f'Replaced nonsense distractors with valid {cat}gana romaji options')
        elif len(d) < 6:
            new_d = get_kana_distractors(effective_a, cat)
            changes.append(f'Padded kana distractors to 6+ (was {len(d)})')
        else:
            # Check for mixed nonsense items: valid kana romaji are short (1-4 chars, no hyphens)
            # and must be known romaji syllables
            valid_romaji_set = set(KATA_ROMAJI_ALL)
            non_romaji = [item for item in d
                          if item.lower() not in valid_romaji_set
                          and item.lower() != effective_a.lower()]
            if non_romaji:
                new_d = get_kana_distractors(effective_a, cat)
                changes.append(f'Replaced mixed nonsense distractors with valid romaji options')

    elif cat == 'kanji':
        if needs_distractor_fix(d, effective_a, cat):
            new_d = get_kanji_distractors(effective_a, d)
            changes.append('Replaced placeholder distractors with semantically plausible kanji meanings')
        elif len(d) < 6:
            extra = get_kanji_distractors(effective_a, d)
            new_d = (d + extra)[:8]
            changes.append(f'Added distractors to reach 6-8 minimum (was {len(d)})')

    elif cat == 'grammar':
        # Grammar distractors: many have mixed quality
        bad_tokens_in_d = {'x-ray', 'x ray', 'home', 'form', 'type', 'class', 'kind',
                           'fairly', 'quite', 'rather', 'likely', 'partly', 'almost',
                           'barely', 'hardly', 'corporal'}
        bad_count = sum(1 for item in d if item.strip().lower() in bad_tokens_in_d)
        if bad_count >= 1 or len(d) < 6:
            new_d = get_grammar_distractors(effective_a, d)
            if bad_count >= 1:
                changes.append(f'Replaced {bad_count} non-grammar distractor(s) with grammar meanings')
            if len(d) < 6:
                changes.append(f'Padded distractors to 6-8 minimum (was {len(d)})')

    # ── Build output ──
    out = {
        'id': rid,
        'q': new_q,
        'a': new_a,
        'd': new_d if new_d else d,  # always output full d array
        'e': new_e,
        'l1': None,
        'l2': None,
        'i': '; '.join(changes) if changes else ''
    }

    # Ensure d has 6-8 items
    if len(out['d']) < 6:
        out['d'] = (out['d'] * 3)[:8]  # emergency pad
        out['i'] = (out['i'] + '; Emergency padded d to 6').strip('; ')

    return out


def process_batch(batch_num: int) -> tuple[int, int, int]:
    """Process one batch. Returns (total, changed, fixed_d)."""
    in_path = f'/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/batches/vocab-ja/batch-{batch_num:03d}.jsonl'
    out_path = f'/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/results/vocab-ja/batch-{batch_num:03d}.jsonl'

    with open(in_path) as f:
        rows = [json.loads(line) for line in f]

    results = []
    changed = 0
    fixed_d = 0

    for row in rows:
        out = process_row(row)
        results.append(out)
        if out['i']:
            changed += 1
        if out['d'] != row['d']:
            fixed_d += 1

    with open(out_path, 'w', encoding='utf-8') as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    return len(rows), changed, fixed_d


if __name__ == '__main__':
    total_rows = 0
    total_changed = 0
    total_fixed_d = 0

    for batch_num in range(19):
        rows, changed, fixed_d = process_batch(batch_num)
        total_rows += rows
        total_changed += changed
        total_fixed_d += fixed_d
        print(f'batch-{batch_num:03d}: {rows} rows, {changed} changed, {fixed_d} d-fixed')

    print(f'\nTotals: {total_rows} rows, {total_changed} changed, {total_fixed_d} d-fixed')

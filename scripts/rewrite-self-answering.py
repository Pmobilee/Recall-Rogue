#!/usr/bin/env python3
"""
Rewrite self-answering quiz questions in curated deck JSON files.
For each flagged fact, removes/replaces the leakedWord from quizQuestion
while preserving meaning. Only modifies quizQuestion field.
"""

import json
import re
import sys
from pathlib import Path

DECKS_DIR = Path('/Users/damion/CODE/Recall_Rogue/data/decks')
BATCHES_FILE = Path('/Users/damion/CODE/Recall_Rogue/data/self-answering-batches.json')

# Domain-aware generic placeholders
DOMAIN_PLACEHOLDERS = {
    'ancient_greece': {
        'person': 'this figure',
        'place': 'this location',
        'event': 'this event',
        'concept': 'this concept',
        'object': 'this structure',
        'default': 'this',
    },
    'ancient_rome': {
        'person': 'this figure',
        'place': 'this location',
        'event': 'this event',
        'concept': 'this concept',
        'object': 'this structure',
        'default': 'this',
    },
    'ap_biology': {
        'process': 'this process',
        'molecule': 'this molecule',
        'cell': 'this cell type',
        'concept': 'this concept',
        'structure': 'this structure',
        'default': 'this property',
    },
    'ap_chemistry': {
        'concept': 'this value',
        'process': 'this process',
        'default': 'this value',
    },
    'ap_physics_1': {
        'quantity': 'this quantity',
        'concept': 'this concept',
        'default': 'this quantity',
    },
    'ap_macroeconomics': {
        'concept': 'this concept',
        'default': 'this',
    },
    'ap_microeconomics': {
        'concept': 'this concept',
        'default': 'this',
    },
    'ap_psychology': {
        'concept': 'this concept',
        'process': 'this process',
        'default': 'this concept',
    },
    'ap_european_history': {
        'event': 'this movement',
        'default': 'this',
    },
    'ap_us_history': {
        'event': 'this event',
        'default': 'this',
    },
    'ap_world_history': {
        'event': 'this event',
        'default': 'this',
    },
    'ap_human_geography': {
        'concept': 'this concept',
        'default': 'this type',
    },
    'human_anatomy': {
        'structure': 'this structure',
        'muscle': 'this muscle',
        'bone': 'this bone',
        'nerve': 'this nerve',
        'default': 'this structure',
    },
    'pharmacology': {
        'drug': 'this drug',
        'process': 'this process',
        'default': 'this',
    },
    'computer_science': {
        'concept': 'this concept',
        'structure': 'this structure',
        'default': 'this concept',
    },
    'philosophy': {
        'concept': 'this concept',
        'default': 'this concept',
    },
    'greek_mythology': {
        'person': 'this figure',
        'place': 'this location',
        'default': 'this',
    },
    'norse_mythology': {
        'person': 'this figure',
        'default': 'this',
    },
    'egyptian_mythology': {
        'person': 'this figure',
        'default': 'this',
    },
    'world_religions': {
        'concept': 'this concept',
        'default': 'this',
    },
    'world_war_ii': {
        'event': 'this operation',
        'default': 'this',
    },
    'medieval_world': {
        'concept': 'this concept',
        'default': 'this',
    },
    'solar_system': {
        'object': 'this body',
        'default': 'this',
    },
    'nasa_missions': {
        'mission': 'this mission',
        'default': 'this mission',
    },
    'constellations': {
        'object': 'this constellation',
        'default': 'this pattern',
    },
    'dinosaurs': {
        'object': 'this species',
        'default': 'this creature',
    },
    'ocean_life': {
        'object': 'this species',
        'default': 'this creature',
    },
    'mammals_world': {
        'object': 'this species',
        'default': 'this animal',
    },
    'famous_inventions': {
        'object': 'this invention',
        'default': 'this device',
    },
    'famous_paintings': {
        'object': 'this work',
        'default': 'this artwork',
    },
    'music_history': {
        'concept': 'this style',
        'default': 'this',
    },
    'movies_cinema': {
        'concept': 'this technique',
        'default': 'this',
    },
    'world_capitals': {
        'place': 'this city',
        'default': 'this capital',
    },
    'test_world_capitals': {
        'place': 'this city',
        'default': 'this capital',
    },
    'world_cuisines': {
        'object': 'this dish',
        'default': 'this food',
    },
    'world_literature': {
        'object': 'this work',
        'default': 'this text',
    },
    'world_wonders': {
        'object': 'this structure',
        'default': 'this wonder',
    },
    'us_presidents': {
        'person': 'this president',
        'default': 'this leader',
    },
}


def get_placeholder(deck_id: str, leaked_word: str, question: str) -> str:
    """Get an appropriate placeholder for the leaked word based on domain context."""
    deck_map = DOMAIN_PLACEHOLDERS.get(deck_id, {'default': 'this'})
    lw = leaked_word.lower()

    # Try to categorize the leaked word
    person_indicators = ['emperor', 'king', 'queen', 'president', 'general', 'philosopher',
                         'scientist', 'poet', 'author', 'artist', 'pharaoh', 'senator', 'consul',
                         'nerva', 'caesar', 'zeus', 'odin', 'ra', 'thor', 'apollo']
    place_indicators = ['city', 'town', 'country', 'region', 'empire', 'kingdom', 'island',
                        'ocean', 'sea', 'river', 'mountain', 'valley', 'forest', 'hellespont',
                        'capitol', 'capital']
    process_indicators = ['osis', 'tion', 'sis', 'lysis', 'genesis', 'synthesis', 'metabolism',
                          'transport', 'diffusion', 'conduction', 'signaling', 'process']
    structure_indicators = ['muscle', 'bone', 'nerve', 'vessel', 'tissue', 'organ', 'cell',
                            'column', 'arch', 'dome', 'tower', 'temple', 'wall', 'bridge',
                            'chamber', 'canal', 'aqueduct', 'forum', 'theater', 'theatre']
    concept_indicators = ['theory', 'law', 'principle', 'theorem', 'hypothesis', 'model',
                          'concept', 'idea', 'system', 'approach', 'method', 'technique',
                          'effect', 'bias', 'fallacy', 'paradox', 'syndrome']

    for pi in person_indicators:
        if pi in lw:
            return deck_map.get('person', deck_map.get('default', 'this'))
    for pi in place_indicators:
        if pi in lw:
            return deck_map.get('place', deck_map.get('default', 'this'))
    for pi in process_indicators:
        if pi in lw:
            return deck_map.get('process', deck_map.get('default', 'this'))
    for pi in structure_indicators:
        if pi in lw:
            return deck_map.get('structure', deck_map.get('object', deck_map.get('default', 'this')))
    for ci in concept_indicators:
        if ci in lw:
            return deck_map.get('concept', deck_map.get('default', 'this'))

    return deck_map.get('default', 'this')


def word_boundary_replace(text: str, word: str, replacement: str) -> str:
    """Replace word at word boundaries (case-insensitive), preserving surrounding punctuation."""
    # Escape special regex characters in the word
    escaped = re.escape(word)
    # Match the word with word boundaries
    pattern = r'(?i)\b' + escaped + r'\b'
    return re.sub(pattern, replacement, text, count=1)


def contains_leaked_word(question: str, leaked_word: str) -> bool:
    """Check if the leaked word appears in the question (case-insensitive, word boundary)."""
    escaped = re.escape(leaked_word.lower())
    pattern = r'\b' + escaped + r'\b'
    return bool(re.search(pattern, question.lower()))


# Specific multi-word phrase rewrites for common patterns
PHRASE_REWRITES = {
    # Economics terms
    ('goods', r'\bcapital goods\b'): ('capital goods', 'capital investment goods'),
    ('goods', r'\bintermediate goods\b'): ('intermediate goods', 'inputs to production'),
    ('goods', r'\bpublic goods\b'): ('public goods', 'non-excludable non-rival goods'),
    ('goods', r'\bnormal goods?\b'): ('normal good', 'normal good'),  # answer contains it - need rephrase
    ('goods', r'\binferior goods?\b'): ('inferior good', 'inferior good'),
    ('sector', r'\bforeign sector\b'): ('foreign sector', 'international trade sector'),
    ('sector', r'\bpublic sector\b'): ('public sector', 'government sector'),
    ('sector', r'\bprivate sector\b'): ('private sector', 'business sector'),

    # Physics
    ('reference', r'\breference frame\b'): ('reference frame', 'frame of observation'),

    # History
    ('italian', r'\bItalian Wars?\b'): ('Italian Wars', 'these peninsular conflicts'),
    ('persian', r'\bPersian ships?\b'): ('Persian ships', 'enemy ships'),
    ('persian', r'\bPersian forces?\b'): ('Persian forces', 'enemy forces'),
    ('persian', r'\bPersian army\b'): ('Persian army', 'enemy army'),
    ('persian', r'\bPersians?\b'): ('Persians', 'the invaders'),

    # Biology
    ('liquid', r'\bliquid water\b'): ('liquid water', 'water in its liquid form'),
    ('solvent', r'\buniversal solvent\b'): ('universal solvent', 'extraordinary dissolving agent'),
    ('molecules', r'\bmirror-image molecules\b'): ('mirror-image molecules', 'non-superimposable reflections'),
}


def apply_phrase_rewrites(question: str, leaked_word: str) -> tuple[str, bool]:
    """Try to apply known multi-word phrase rewrites first. Returns (new_q, was_changed)."""
    lw = leaked_word.lower()
    for (key_word, pattern), (old_phrase, new_phrase) in PHRASE_REWRITES.items():
        if key_word == lw:
            m = re.search(pattern, question, re.IGNORECASE)
            if m:
                start, end = m.span()
                new_q = question[:start] + new_phrase + question[end:]
                if not contains_leaked_word(new_q, leaked_word):
                    return new_q, True
    return question, False


def rewrite_question(question: str, answer: str, leaked_word: str, deck_id: str, fact_id: str) -> str:
    """
    Rewrite the question to remove the leaked word.
    Strategy priority:
    1. Multi-word phrase rewrites (safe known patterns)
    2. Context-aware single word substitution
    3. Structural question rephrasing
    4. Generic placeholder replacement
    """
    lw = leaked_word.lower()

    # Quick check - if leaked word isn't actually in question, skip
    if not contains_leaked_word(question, leaked_word):
        return question

    # Strategy 1: Known phrase rewrites
    new_q, changed = apply_phrase_rewrites(question, leaked_word)
    if changed:
        return new_q

    # Strategy 2: Context-aware substitutions based on the leaked word itself
    substitutions = {
        # Numbers / math
        'zero': 'a value of zero',
        'average': 'the weighted mean',
        'sum': 'the total',
        'product': 'the calculated result',
        'ratio': 'the proportional value',
        'area': 'the measured area',
        'volume': 'the measured volume',
        'frequency': 'the measured rate',
        'amplitude': 'the measured magnitude',
        'acceleration': 'the rate of velocity change',
        'displacement': 'the vector position change',
        'velocity': 'the rate of position change',
        'momentum': 'the product of mass and velocity',
        'weight': 'gravitational force',
        'mass': 'the quantity of matter',
        'force': 'the applied push or pull',
        'energy': 'the capacity to do work',
        'power': 'the rate of energy transfer',
        'pressure': 'force per unit area',
        'temperature': 'the measure of thermal energy',
        'density': 'mass per unit volume',

        # Economics
        'surplus': 'the excess quantity',
        'deficit': 'the shortfall quantity',
        'multiplier': 'the amplification factor',
        'elasticity': 'the sensitivity coefficient',
        'opportunity': 'implicit',  # opportunity cost
        'quantity': 'the output level',
        'output': 'the production level',
        'income': 'earnings',
        'revenue': 'total sales receipts',
        'profit': 'net earnings',
        'cost': 'the expense',
        'price': 'the market price',
        'demand': 'buyer willingness to pay',
        'supply': 'seller willingness to offer',
        'market': 'the trading arena',
        'equilibrium': 'market-clearing balance',
        'inflation': 'the general price level rise',
        'unemployment': 'joblessness',
        'gdp': 'total output',
        'fiscal': 'government budget',
        'monetary': 'money-supply',
        'network': 'the interconnected system',
        'external': 'third-party',
        'externality': 'spillover effect',
        'individual': 'a single agent',
        'discrimination': 'differential treatment',
        'increase': 'a rightward shift',

        # Biology
        'solvent': 'dissolving medium',
        'substrate': 'the reactant molecule',
        'enzyme': 'the biological catalyst',
        'protein': 'the folded polypeptide',
        'dna': 'the genetic material',
        'rna': 'the messenger molecule',
        'cell': 'the basic unit',
        'membrane': 'the lipid bilayer',
        'nucleus': 'the control center',
        'mitochondria': 'the energy organelle',
        'chloroplast': 'the photosynthetic organelle',
        'chromosome': 'the condensed genetic structure',
        'gene': 'the inherited unit',
        'allele': 'the gene variant',
        'mutation': 'the genetic change',
        'evolution': 'heritable change over time',
        'selection': 'differential reproduction',
        'hypothesis': 'the proposed explanation',
        'theory': 'the explanatory framework',
        'survivorship': 'survival pattern',
        'species': 'the taxonomic unit',
        'predator': 'the hunter',
        'prey': 'the hunted organism',
        'parasite': 'the exploiting organism',
        'host': 'the exploited organism',
        'tissue': 'the cellular layer',
        'organ': 'the functional unit',
        'system': 'the organ system',
        'liquid': 'its liquid state',

        # Chemistry
        'element': 'an atom type',
        'compound': 'the bonded substance',
        'molecule': 'the bonded unit',
        'bond': 'the chemical linkage',
        'reaction': 'the chemical transformation',
        'acid': 'the proton donor',
        'base': 'the proton acceptor',
        'ion': 'the charged particle',
        'electron': 'the negative particle',
        'proton': 'the positive particle',
        'neutron': 'the uncharged particle',
        'isotope': 'a variant with different neutrons',
        'isomer': 'a structural variant',

        # Physics
        'inertia': 'resistance to motion change',
        'gravity': 'gravitational attraction',
        'friction': 'opposing surface force',
        'wave': 'the propagating disturbance',
        'light': 'electromagnetic radiation',
        'reflection': 'the bouncing of light',
        'refraction': 'the bending of light',
        'conduction': 'the transmission process',
        'radiation': 'energy emission',
        'spring': 'an elastic restoring device',
        'oscillation': 'periodic motion',
        'period': 'the cycle duration',

        # Psychology
        'twins': 'these siblings',
        'axon': 'the nerve fiber',
        'neuron': 'the nerve cell',
        'synapse': 'the neural junction',
        'cortex': 'the brain region',
        'lobe': 'the brain division',
        'reflex': 'this automatic response',
        'conditioning': 'learned association',
        'reinforcement': 'behavioral consequence',
        'memory': 'stored information',
        'perception': 'sensory interpretation',
        'cognition': 'mental processing',
        'emotion': 'affective state',
        'stress': 'arousal response',

        # History / Humanities
        'civic': 'citizen-centered',
        'states': 'political entities',
        'senators': 'members of the governing body',
        'figures': 'carved images',
        'nerva': 'the first of this dynasty',
        'court': 'judicial body',
        'hellespont': 'the strait',

        # Geography
        'location': 'position type',
        'source': 'data type',
        'region': 'the geographic area',
        'migration': 'population movement',
        'urbanization': 'city growth process',

        # Anatomy
        'muscle': 'this contractile structure',
        'bone': 'this skeletal element',
        'nerve': 'this neural pathway',
        'vessel': 'this conduit',
        'joint': 'this articulation',
        'ligament': 'this connective band',
        'tendon': 'this muscle attachment',
        'cartilage': 'this flexible tissue',

        # Astronomy
        'telescope': 'this optical instrument',
        'orbit': 'the elliptical path',
        'eclipse': 'this celestial alignment',
        'comet': 'this icy body',
        'asteroid': 'this rocky body',
        'planet': 'this planetary body',
        'star': 'this stellar object',
        'galaxy': 'this stellar system',
        'nebula': 'this gas cloud',

        # Computer Science
        'algorithm': 'the computational procedure',
        'data': 'the stored values',
        'array': 'the indexed collection',
        'loop': 'the repetition structure',
        'function': 'the reusable procedure',
        'class': 'the object blueprint',
        'object': 'the instance',
        'variable': 'the named storage',
        'binary': 'base-two',

        # General
        'arch': 'curved structural element',
        'step': 'a procedural stage',
        'same': 'equal',
        'increase': 'upward change',
        'decrease': 'downward change',
        'lose': 'forfeit',
        'cities': 'urban centers',
        'individual': 'a single person',
    }

    # Strategy 2: Direct word substitution
    if lw in substitutions:
        sub = substitutions[lw]
        # Try to preserve capitalization context
        # Find the leaked word in the question to get its case
        m = re.search(r'\b' + re.escape(lw) + r'\b', question.lower())
        if m:
            orig_word = question[m.start():m.end()]
            # If original was capitalized, capitalize the substitution
            if orig_word[0].isupper():
                sub = sub[0].upper() + sub[1:]
            new_q = question[:m.start()] + sub + question[m.end():]
            if not contains_leaked_word(new_q, leaked_word):
                return new_q

    # Strategy 3: Generic placeholder
    placeholder = get_placeholder(deck_id, leaked_word, question)

    # Find and replace the leaked word in the question
    m = re.search(r'\b' + re.escape(lw) + r'\b', question.lower())
    if m:
        orig_word = question[m.start():m.end()]
        # Preserve capitalization
        if orig_word[0].isupper():
            repl = placeholder[0].upper() + placeholder[1:]
        else:
            repl = placeholder
        new_q = question[:m.start()] + repl + question[m.end():]
        if not contains_leaked_word(new_q, leaked_word):
            return new_q

    # Strategy 4: If all else fails, append a clarifying prefix that removes ambiguity
    # by rephrasing the question structure
    # e.g., "What is X?" → "Identify the concept: ..."
    print(f'  WARNING: Could not remove leaked word "{leaked_word}" from fact {fact_id}', file=sys.stderr)
    print(f'    Q: {question[:100]}', file=sys.stderr)
    return question  # Return unchanged, will be flagged


def load_deck(deck_id: str) -> dict:
    """Load a deck JSON file."""
    deck_path = DECKS_DIR / f'{deck_id}.json'
    with open(deck_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_deck(deck_id: str, deck: dict) -> None:
    """Save a deck JSON file."""
    deck_path = DECKS_DIR / f'{deck_id}.json'
    with open(deck_path, 'w', encoding='utf-8') as f:
        json.dump(deck, f, ensure_ascii=False, indent=2)
    print(f'  Saved {deck_path}')


def build_fact_index(deck: dict) -> dict:
    """Build a factId -> fact object mapping for quick lookup."""
    index = {}
    for fact in deck.get('facts', []):
        index[fact["id"]] = fact
    return index


def main():
    # Load all batches
    print('Loading batches...')
    with open(BATCHES_FILE, 'r', encoding='utf-8') as f:
        batches = json.load(f)

    total_facts = sum(len(b) for b in batches)
    print(f'Total batches: {len(batches)}')
    print(f'Total facts to rewrite: {total_facts}')

    # Group facts by deckId
    deck_facts: dict[str, list] = {}
    for batch in batches:
        for fact in batch:
            did = fact['deckId']
            if did not in deck_facts:
                deck_facts[did] = []
            deck_facts[did].append(fact)

    print(f'Unique decks: {len(deck_facts)}')

    # Track stats
    total_rewritten = 0
    total_unchanged = 0
    total_not_found = 0
    failed_rewrites = []  # facts where leaked word still present

    # Process each deck
    for deck_id in sorted(deck_facts.keys()):
        facts_to_fix = deck_facts[deck_id]
        print(f'\nProcessing deck: {deck_id} ({len(facts_to_fix)} facts)')

        # Load deck
        deck = load_deck(deck_id)
        fact_index = build_fact_index(deck)

        deck_rewritten = 0
        deck_unchanged = 0
        deck_not_found = 0

        for batch_fact in facts_to_fix:
            fact_id = batch_fact['factId']
            original_q = batch_fact['question']  # the question from the batch (should match quizQuestion)
            answer = batch_fact['answer']
            leaked_word = batch_fact['leakedWord']

            # Find fact in deck
            if fact_id not in fact_index:
                print(f'  NOT FOUND: {fact_id}')
                deck_not_found += 1
                total_not_found += 1
                continue

            deck_fact = fact_index[fact_id]
            current_q = deck_fact.get('quizQuestion', '')

            # Use the current question from the deck (may differ slightly from batch)
            # But verify the leaked word is actually there
            if not contains_leaked_word(current_q, leaked_word):
                # Try with original from batch
                if not contains_leaked_word(original_q, leaked_word):
                    print(f'  SKIP (no leak found): {fact_id} | leaked: {leaked_word}')
                    deck_unchanged += 1
                    total_unchanged += 1
                    continue
                # Use original_q as the base
                current_q = original_q

            # Rewrite the question
            new_q = rewrite_question(current_q, answer, leaked_word, deck_id, fact_id)

            # Verify the fix worked
            if contains_leaked_word(new_q, leaked_word):
                failed_rewrites.append({
                    'factId': fact_id,
                    'deckId': deck_id,
                    'leakedWord': leaked_word,
                    'question': new_q,
                })
                deck_unchanged += 1
                total_unchanged += 1
            else:
                # Apply the fix to the actual deck fact
                deck_fact['quizQuestion'] = new_q
                deck_rewritten += 1
                total_rewritten += 1

        print(f'  Rewritten: {deck_rewritten}, Unchanged: {deck_unchanged}, Not found: {deck_not_found}')

        # Save the deck
        save_deck(deck_id, deck)

    print(f'\n=== SUMMARY ===')
    print(f'Total rewritten: {total_rewritten}')
    print(f'Total unchanged (no fix needed or failed): {total_unchanged}')
    print(f'Total not found in deck: {total_not_found}')
    print(f'Failed rewrites (leaked word still present): {len(failed_rewrites)}')

    if failed_rewrites:
        print(f'\nFailed rewrites:')
        for fr in failed_rewrites[:20]:
            print(f'  [{fr["deckId"]}] {fr["factId"]} | leaked: {fr["leakedWord"]}')
            print(f'    Q: {fr["question"][:100]}')

    return len(failed_rewrites)


if __name__ == '__main__':
    result = main()
    sys.exit(0 if result == 0 else 1)

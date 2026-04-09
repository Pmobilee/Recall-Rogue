#!/usr/bin/env python3
"""
Fix broken self-answering question rewrites.

A previous pass replaced answer-leaking words with "this quantity/type/concept/etc."
placeholders, creating grammatically broken questions like:
  "Which quantity measures total this quantity length traveled..."
  "For a this quantity launched and landing..."

This script identifies the broken placeholder and reconstructs the question naturally
by extracting the key term from the correct answer and rephrasing the question clause.
"""

import json
import re
import glob
import sys
import os

# Pattern to detect broken placeholder insertions
BROKEN_PATTERNS_RAW = [
    r'\bwhich this\b',
    r'\bthe this\b',
    r'\ba this\b',
    r'\ban this\b',
    r'\bthis structure\b',
    r'\bthis process\b',
    r'\bthis concept\b',
    r'\bthis quantity\b',
    r'\bthis property\b',
    r'\bthis figure\b',
    r'\bthis type\b',
    r'\bthis food\b',
    r'\bthis artwork\b',
    r'\bthis-age\b',
    r'\bThis curve\b',
    r'\bThis reserve\b',
    r'\bThis empire\b',
    r'\bThis plan\b',
    r'\bThis wars\b',
    r'\bThis crisis\b',
    r'\bThis war\b',
    r'\bthis-guided\b',
    r'\bThis Turk\b',
    r'\bThis American\b',
    r'\bThis peninsula\b',
    r'\bThis laws\b',
    r'\bThis lama\b',
    r'\bthis-powered\b',
    r'\bthis funds\b',
    r'\bthis run\b',
    r'\bThis figure\b',
    r'\bThis gun\b',
    r'\bThis guard\b',
    r'\bThis article\b',
    r'\bthis side\b',
    r'\bthis crisis\b',
]

COMBINED = re.compile('|'.join(BROKEN_PATTERNS_RAW), re.I)

# Japanese text detection - questions with Japanese characters are NOT broken English
JAPANESE_PATTERN = re.compile(r'[\u3000-\u9fff\uff00-\uffef]')


def is_broken(question: str) -> bool:
    """Return True if this question has a broken placeholder."""
    if JAPANESE_PATTERN.search(question):
        return False  # Japanese question - "this" occurrences are English context words
    return bool(COMBINED.search(question))


# --------------------------------------------------------------------------
# Core repair function: replace broken "this X" with the correct term
# --------------------------------------------------------------------------
def repair_question(question: str, answer: str, fact_id: str = '') -> str:
    """
    Repair a broken question by replacing 'this quantity/type/concept/etc.'
    with the correct term extracted from the answer, or by rephrasing the
    clause naturally.
    """
    q = question

    # ----------------------------------------------------------------
    # SPECIFIC HIGH-FREQUENCY FIXES
    # Physics - "this quantity" patterns
    # ----------------------------------------------------------------
    q = re.sub(r'total this quantity length traveled', 'total path length traveled', q, flags=re.I)
    q = re.sub(r'includes a this quantity term\)', 'includes a quadratic (½at²) term)', q, flags=re.I)
    q = re.sub(r'horizontal this quantity maximized', 'horizontal range maximized', q, flags=re.I)
    q = re.sub(r"'at this quantity'", "'at rest'", q, flags=re.I)
    q = re.sub(r'\bat this quantity\b', 'at rest', q, flags=re.I)
    q = re.sub(r'For a this quantity launched', 'For a projectile launched', q, flags=re.I)
    q = re.sub(r'What type of this quantity shows ALL forces', 'What diagram shows ALL forces', q, flags=re.I)
    # Specific 'this quantity force' patterns - must run BEFORE generic 'this quantity force'
    q = re.sub(r'balance between this quantity force and the centripetal', 'balance between gravitational force and the centripetal', q, flags=re.I)
    q = re.sub(r'by what factor does the this quantity force between them', 'by what factor does the gravitational force between them', q, flags=re.I)
    q = re.sub(r'the this quantity force satisfy for an object to undergo', 'the net force satisfy for an object to undergo', q, flags=re.I)
    q = re.sub(r"'this quantity force'", "'centripetal force'", q, flags=re.I)
    q = re.sub(r'\bthis quantity force\b', 'centripetal force', q, flags=re.I)
    q = re.sub(r'gravity this quantity and perpendicular', 'gravity parallel and perpendicular', q, flags=re.I)
    q = re.sub(r'For an This quantity machine', 'For an Atwood machine', q, flags=re.I)
    q = re.sub(r'For an this quantity machine', 'For an Atwood machine', q, flags=re.I)
    q = re.sub(r'friction act this quantity to', 'friction act opposite to', q, flags=re.I)
    q = re.sub(r'F_g = This quantity/r²', 'F_g = Gm₁m₂/r²', q, flags=re.I)
    q = re.sub(r'\(massless, this quantity\)', '(massless, frictionless)', q, flags=re.I)
    q = re.sub(r'total this quantity energy', 'total mechanical energy', q, flags=re.I)
    q = re.sub(r'object that this quantity a vertical height', 'object that descends a vertical height', q, flags=re.I)
    q = re.sub(r'the this quantity delivered to an object', 'the impulse delivered to an object', q, flags=re.I)
    q = re.sub(r'what quantities are this quantity\?', 'what quantities are conserved?', q, flags=re.I)
    q = re.sub(r'rate of change of this quantity displacement', 'rate of change of angular displacement', q, flags=re.I)
    q = re.sub(r'rate of change of this quantity velocity', 'rate of change of angular velocity', q, flags=re.I)
    q = re.sub(r'solid disk or a this quantity ring', 'solid disk or a thin ring', q, flags=re.I)
    q = re.sub(r'\bthe this quantity arm\b', 'the moment arm', q, flags=re.I)
    q = re.sub(r'\bthis quantity arm\b', 'moment arm', q, flags=re.I)
    q = re.sub(r'rolling without this quantity\?', 'rolling without slipping?', q, flags=re.I)
    q = re.sub(r'What type of periodic this quantity occurs', 'What type of periodic motion occurs', q, flags=re.I)
    q = re.sub(r'oscillating object have this quantity acceleration', 'oscillating object have maximum acceleration', q, flags=re.I)
    q = re.sub(r'whether an object this quantity or sinks', 'whether an object floats or sinks', q, flags=re.I)
    q = re.sub(r'What is this quantity pressure', 'What is gauge pressure', q, flags=re.I)
    q = re.sub(r"Newton's This quantity Law", "Newton's Third Law", q, flags=re.I)
    q = re.sub(r"Newton's this quantity Law", "Newton's Third Law", q, flags=re.I)
    q = re.sub(r'value of the this quantity of restitution', 'value of the coefficient of restitution', q, flags=re.I)
    q = re.sub(r'placing the this quantity of the second vector', 'placing the tail of the second vector', q, flags=re.I)
    q = re.sub(r'This quantity subtraction A − B', 'Vector subtraction A − B', q, flags=re.I)
    q = re.sub(r'this quantity subtraction A − B', 'Vector subtraction A − B', q, flags=re.I)
    q = re.sub(r'with a this quantity rope', 'with a massless rope', q, flags=re.I)
    q = re.sub(r'On a this quantity energy diagram', 'On a potential energy diagram', q, flags=re.I)
    q = re.sub(r'the this quantity under a Force-versus-displacement graph', 'the area under a Force-versus-displacement graph', q, flags=re.I)
    q = re.sub(r'the this quantity under a Force-versus-time graph', 'the area under a Force-versus-time graph', q, flags=re.I)
    q = re.sub(r'\ba this quantity ring\b', 'a thin ring', q, flags=re.I)
    q = re.sub(r'rotational analog of the this quantity-momentum theorem', 'rotational analog of the impulse-momentum theorem', q, flags=re.I)
    q = re.sub(r'through a this quantity that narrows', 'through a pipe that narrows', q, flags=re.I)
    q = re.sub(r'between a this quantity and a manometer', 'between a barometer and a manometer', q, flags=re.I)
    q = re.sub(r'Why do this quantity in the International Space Station appear weightless', 'Why do astronauts in the International Space Station appear weightless', q, flags=re.I)
    q = re.sub(r'\bthis quantity machine\b', 'Atwood machine', q, flags=re.I)
    q = re.sub(r'\bThis quantity machine\b', 'Atwood machine', q)
    q = re.sub(r'\bthis quantity ring\b', 'thin ring', q, flags=re.I)
    q = re.sub(r'\bthis quantity rope\b', 'massless rope', q, flags=re.I)
    q = re.sub(r'\bthis quantity arm\b', 'moment arm', q, flags=re.I)
    q = re.sub(r'\bThis quantity arm\b', 'moment arm', q)
    q = re.sub(r'rotational analog of the this quantity[-\s]momentum', 'rotational analog of the impulse-momentum', q, flags=re.I)
    q = re.sub(r'\bthis quantity-momentum\b', 'impulse-momentum', q, flags=re.I)

    # AP Biology "this quantity/structure/process/concept" patterns
    q = re.sub(r'\bthis quantity\b', 'the given quantity', q, flags=re.I)
    q = re.sub(r'\bThis quantity\b', 'The given quantity', q)

    # "this type" patterns (AP Human Geography, etc.)
    q = re.sub(r'from the this type birth rate', 'from the crude birth rate', q, flags=re.I)
    q = re.sub(r'a this type called who was forced to flee', 'a displaced person who was forced to flee', q, flags=re.I)
    q = re.sub(r"country's second-largest city is half the this type of the largest", "country's second-largest city is half the population of the largest", q, flags=re.I)
    q = re.sub(r'around a this type station', 'around a transit station', q, flags=re.I)
    q = re.sub(r'wealthy.*nations that dominate \(the this type\)', 'wealthy, industrialized nations that dominate (the core)', q, flags=re.I)

    # "this concept" patterns (Philosophy)
    q = re.sub(r'shadows on a this concept wall for reality', 'shadows on a cave wall for reality', q, flags=re.I)
    q = re.sub(r"a 'this concept of perceptions'", "a 'bundle of perceptions'", q, flags=re.I)
    q = re.sub(r'there is a this concept reason', 'there is a sufficient reason', q, flags=re.I)
    q = re.sub(r"the this concept condition for the unity of experience", "the transcendental condition for the unity of experience", q, flags=re.I)
    q = re.sub(r'the this concept becomes dependent on the slave', 'the master becomes dependent on the slave', q, flags=re.I)
    q = re.sub(r'entirely a this concept and the soul a fiction', 'entirely a machine and the soul a fiction', q, flags=re.I)
    q = re.sub(r'imagines a this concept endowed with one sense', 'imagines a statue endowed with one sense', q, flags=re.I)
    q = re.sub(r"self-developing process of Geist — the This concept not as a static", "self-developing process of Geist — the Absolute not as a static", q, flags=re.I)
    q = re.sub(r"like facial traits in a this concept\.", "like facial traits in a family.", q, flags=re.I)
    q = re.sub(r"like facial traits in a this concept\b", "like facial traits in a family", q, flags=re.I)
    q = re.sub(r'imagined a this concept that gives you any experiences', 'imagined an experience machine that gives you any experiences', q, flags=re.I)
    q = re.sub(r'if you could save a this concept child at trivial cost', 'if you could save a drowning child at trivial cost', q, flags=re.I)
    q = re.sub(r'introduced the This concept formula establishing', 'introduced the Barcan formula establishing', q, flags=re.I)

    # Philosophy specific fixes -- all must run before generic this concept fallback
    q = re.sub(r"major work on this concept, which addresses .What is the good life.", "major work on ethics, which addresses 'What is the good life", q, flags=re.I)
    q = re.sub(r'properly organized this concept community', 'properly organized political community', q, flags=re.I)
    q = re.sub(r'124 philosophical this concept to his friend Lucilius', '124 philosophical letters to his friend Lucilius', q, flags=re.I)
    q = re.sub(r'scriptural this concept —', 'scriptural canon —', q, flags=re.I)
    q = re.sub(r"defines this concept as 'citta vritti nirodha'", "defines yoga as 'citta vritti nirodha'", q, flags=re.I)
    q = re.sub(r"cycle of birth, death, and this concept governed by karma", "cycle of birth, death, and rebirth governed by karma", q, flags=re.I)
    q = re.sub(r"'eighth this concept' that stores karmic seeds", "'eighth consciousness' that stores karmic seeds", q, flags=re.I)
    q = re.sub(r"dialogue with the personified Lady This concept\?", "dialogue with the personified Lady Philosophy?", q, flags=re.I)
    q = re.sub(r"Pseudo-Dionysius's Mystical This concept, holds", "Pseudo-Dionysius's Mystical Theology, holds", q, flags=re.I)
    q = re.sub(r"this concept \(res cogitans, thinking substance\)", "mind (res cogitans, thinking substance)", q, flags=re.I)
    q = re.sub(r"prescriptive 'this concept' conclusion from purely descriptive 'is'", "prescriptive 'ought' conclusion from purely descriptive 'is'", q, flags=re.I)
    q = re.sub(r"that this concept is a habit of the mind, not a rational principle", "that induction is a habit of the mind, not a rational principle", q, flags=re.I)
    q = re.sub(r"whose name puns on the Greek word for 'this concept'", "whose name puns on the Greek word for 'folly'", q, flags=re.I)
    q = re.sub(r"'Act so that you treat this concept, whether in your own person", "'Act so that you treat humanity, whether in your own person", q, flags=re.I)
    q = re.sub(r"meaning this concept always comprehends a world only once it has passed", "meaning philosophy always comprehends a world only once it has passed", q, flags=re.I)
    q = re.sub(r"arguing that the phenomenal world is this concept and the thing-in-itself", "arguing that the phenomenal world is representation and the thing-in-itself", q, flags=re.I)
    q = re.sub(r"is the grandfather of composer Felix This concept\?", "is the grandfather of composer Felix Mendelssohn?", q, flags=re.I)
    q = re.sub(r"argued for This concept cultural nationalism and public education", "argued for German cultural nationalism and public education", q, flags=re.I)
    q = re.sub(r"each treating all others as this concept in themselves\?", "each treating all others as ends in themselves?", q, flags=re.I)
    q = re.sub(r"society may only restrict a person's liberty to prevent this concept to others", "society may only restrict a person's liberty to prevent harm to others", q, flags=re.I)
    q = re.sub(r"argued that the legal subordination of this concept was wrong and harmful", "argued that the legal subordination of women was wrong and harmful", q, flags=re.I)
    q = re.sub(r"Abraham's act of this concept that transcends universal ethical norms", "Abraham's act of faith that transcends universal ethical norms", q, flags=re.I)
    q = re.sub(r"passionate personal commitment is essential for religious this concept", "passionate personal commitment is essential for religious truth", q, flags=re.I)
    q = re.sub(r"arose from the 'this concept revolt' in which the weak revalued", "arose from the 'slave revolt' in which the weak revalued", q, flags=re.I)
    q = re.sub(r"that Greek this concept united rational form with primal creative energy", "that Greek tragedy united rational form with primal creative energy", q, flags=re.I)
    q = re.sub(r"to describe this concept as flowing rather than existing as discrete mental atoms", "to describe consciousness as flowing rather than existing as discrete mental atoms", q, flags=re.I)
    q = re.sub(r"systematically studied mystical and this concept experience and argued", "systematically studied mystical and religious experience and argued", q, flags=re.I)
    q = re.sub(r"that this concept is not just a form of government but a mode of associated living", "that democracy is not just a form of government but a mode of associated living", q, flags=re.I)
    q = re.sub(r"passes through theological, metaphysical, and then positive \(scientific\) this concept", "passes through theological, metaphysical, and then positive (scientific) stages", q, flags=re.I)
    q = re.sub(r"incommensurability between this concept theories\?", "incommensurability between competing theories?", q, flags=re.I)
    q = re.sub(r"that there is something it is this concept to echolocate", "that there is something it is like to echolocate", q, flags=re.I)
    q = re.sub(r"a liberal theory of this concept\?", "a liberal theory of justice?", q, flags=re.I)
    q = re.sub(r"redirect a runaway this concept to kill one person rather than five", "redirect a runaway trolley to kill one person rather than five", q, flags=re.I)
    q = re.sub(r"this concept praise and blame are partly determined by factors beyond one's control", "moral praise and blame are partly determined by factors beyond one's control", q, flags=re.I)
    q = re.sub(r"thinking occurs in an internal system with a this concept structure", "thinking occurs in an internal system with a computational structure", q, flags=re.I)
    q = re.sub(r"that this concept must embrace — rather th", "that existentialism must embrace — rather th", q, flags=re.I)
    q = re.sub(r"What type of this concept did Habermas distinguish from instrumental reason", "What type of rationality did Habermas distinguish from instrumental reason", q, flags=re.I)
    q = re.sub(r"Nishida Kitaro use in 'An Inquiry into the Good' \(1911\) for thi", "Nishida Kitaro introduce in 'An Inquiry into the Good' (1911) for", q, flags=re.I)
    q = re.sub(r"founded in This concept in", "founded in Frankfurt in", q, flags=re.I)
    q = re.sub(r"Hilary Putnam imagined a distant planet identical to This concept except", "Hilary Putnam imagined a distant planet identical to Earth except", q, flags=re.I)


    # Macroeconomics "This/this" patterns
    q = re.sub(r'which this purchases a nation\'s exports', "which sector purchases a nation's exports", q, flags=re.I)
    q = re.sub(r'what share of the this-age population', "what share of the working-age population", q, flags=re.I)
    q = re.sub(r'component of the this \(I\) category in GDP', 'component of the Investment (I) category in GDP', q, flags=re.I)
    q = re.sub(r'What does this cause the This curve to do\?', 'What does this cause the Short-Run Aggregate Supply (SRAS) curve to do?', q, flags=re.I)
    q = re.sub(r'what does this eventually cause the This curve to do', 'what does this eventually cause the SRAS curve to do', q, flags=re.I)
    q = re.sub(r'the This Reserve\'s structure insulates', "the Federal Reserve's structure insulates", q, flags=re.I)
    q = re.sub(r'who is on the this side of this market\?', 'who is on the borrower (demand) side of this market?', q, flags=re.I)
    q = re.sub(r'what happens in the this funds market\?', 'what happens in the loanable funds market?', q, flags=re.I)
    q = re.sub(r'must borrow in the this funds market', 'must borrow in the loanable funds market', q, flags=re.I)
    q = re.sub(r'in the this funds market,', 'in the loanable funds market,', q, flags=re.I)
    q = re.sub(r'\bthis funds market\b', 'loanable funds market', q, flags=re.I)
    q = re.sub(r'inverse relationship between inflation and unemployment in the this run\?', 'inverse relationship between inflation and unemployment in the short run?', q, flags=re.I)
    q = re.sub(r'\bin the this run\b', 'in the short run', q, flags=re.I)
    q = re.sub(r'version of the This curve incorporates', 'version of the Phillips curve incorporates', q, flags=re.I)

    # Microeconomics
    q = re.sub(r'if the monopoly price is below this curve, the firm is operating', 'if the monopoly price is below the ATC curve, the firm is operating', q, flags=re.I)

    # World History patterns
    q = re.sub(r'Which This Turk clan', 'Which Seljuk Turk clan', q, flags=re.I)
    q = re.sub(r'which this in the Valley of Mexico', 'which lake in the Valley of Mexico', q, flags=re.I)
    q = re.sub(r'enriched by trans-Saharan trade under the This Empire,', 'enriched by trans-Saharan trade under the Mali Empire,', q, flags=re.I)
    q = re.sub(r'the law code of Genghis Khan that governed the This Empire', 'the law code of Genghis Khan that governed the Mongol Empire', q, flags=re.I)
    q = re.sub(r'for the This-Safavid military balance', 'for the Ottoman-Safavid military balance', q, flags=re.I)
    q = re.sub(r'what is the this name of that territory\?', 'what is the modern name of that territory?', q, flags=re.I)
    q = re.sub(r'the this of existing Afro-Eurasian trade networks', 'the continuation of existing Afro-Eurasian trade networks', q, flags=re.I)
    q = re.sub(r'\bthis-powered transportation technology\b', 'steam-powered transportation technology', q, flags=re.I)
    q = re.sub(r'The This Canal \(opened 1869\)', 'The Suez Canal (opened 1869)', q, flags=re.I)
    q = re.sub(r'imposed on China after the This Wars', 'imposed on China after the Opium Wars', q, flags=re.I)
    q = re.sub(r'established by European powers at the This Conference', 'established by European powers at the Berlin Conference', q, flags=re.I)
    q = re.sub(r'What was the This Plan, and how did', 'What was the Schlieffen Plan, and how did', q, flags=re.I)
    q = re.sub(r'What 1956 action of his triggered the This Crisis\?', 'What 1956 action of his triggered the Suez Crisis?', q, flags=re.I)
    q = re.sub(r'defined the This War between the United States and the Soviet Union\?', 'defined the Cold War between the United States and the Soviet Union?', q, flags=re.I)
    q = re.sub(r'navigating This War superpower competition', 'navigating Cold War superpower competition', q, flags=re.I)
    q = re.sub(r"the process by which This and African nations ended European rule\?", "the process by which Asian and African nations ended European rule?", q, flags=re.I)
    q = re.sub(r'of the this economy — despite rapid growth', 'of the global economy — despite rapid growth', q, flags=re.I)
    q = re.sub(r'\bThis War\b', 'Cold War', q)
    q = re.sub(r'\b(\w+) this crisis\b', r'\1 refugee crisis', q, flags=re.I)
    q = re.sub(r'\bthis crisis\b', 'the crisis', q, flags=re.I)

    # Solar System patterns
    q = re.sub(r'In which this do all 8 planets orbit the Sun\?', 'In which plane do all 8 planets orbit the Sun?', q, flags=re.I)
    q = re.sub(r'Which this formed from debris after a Mars-sized object', 'Which moon formed from debris after a Mars-sized object', q, flags=re.I)
    q = re.sub(r'Which this is the 5th largest in the solar system\?', 'Which moon is the 5th largest in the solar system?', q, flags=re.I)

    # Movies/Cinema
    q = re.sub(r'both a sequel AND prequel to The This\?', 'both a sequel AND prequel to The Dark Knight?', q, flags=re.I)

    # NASA Missions
    q = re.sub(r'Which this mission was the first to orbit two different celestial bodies', 'Which space mission was the first to orbit two different celestial bodies', q, flags=re.I)
    q = re.sub(r'Which this optical instrument captured the famous Deep Field image', 'Which space telescope captured the famous Deep Field image', q, flags=re.I)

    # Constellations
    q = re.sub(r'in the this pattern coordinate system\?', 'in the celestial coordinate system?', q, flags=re.I)
    q = re.sub(r'formed within the this pattern how many years\?', 'formed within how many years?', q, flags=re.I)
    q = re.sub(r'Which object in This pattern was the first to be widely accepted', 'Which object in this constellation was the first to be widely accepted', q, flags=re.I)
    q = re.sub(r'Approximately how many this pattern larger than the Sun', 'Approximately how many times larger than the Sun', q, flags=re.I)
    q = re.sub(r'carry for This pattern/Jupiter\?', 'carry for Zeus/Jupiter?', q, flags=re.I)
    q = re.sub(r'carry for this pattern/Jupiter\?', 'carry for Zeus/Jupiter?', q, flags=re.I)
    q = re.sub(r'hot, uncomfortable days in late this pattern originates', 'hot, uncomfortable days in late summer originates', q, flags=re.I)
    q = re.sub(r'— which is this pattern\?', '— which is brighter?', q, flags=re.I)
    q = re.sub(r"which of This pattern's famous labors\?", "which of Heracles's famous labors?", q, flags=re.I)
    q = re.sub(r"which of this pattern's famous labors\?", "which of Heracles's famous labors?", q, flags=re.I)
    q = re.sub(r'find what this pattern direction\?', 'find what direction?', q, flags=re.I)
    q = re.sub(r'between This pattern and the Pleiades\?', 'between Orion and the Pleiades?', q, flags=re.I)
    q = re.sub(r'between this pattern and the Pleiades\?', 'between Orion and the Pleiades?', q, flags=re.I)
    q = re.sub(r'one of the _____ this pattern in the sky', 'one of the oldest recognized constellations in the sky', q, flags=re.I)

    # World War II
    q = re.sub(r"Which this of Japan's 1947 constitution", "Which article of Japan's 1947 constitution", q, flags=re.I)
    q = re.sub(r'The This American Cemetery — containing', 'The Normandy American Cemetery — containing', q, flags=re.I)
    q = re.sub(r'official US Army designation for the this popularly known', "official US Army designation for the unit popularly known", q, flags=re.I)
    q = re.sub(r'After the This Uprising collapsed', 'After the Warsaw Uprising collapsed', q, flags=re.I)
    q = re.sub(r'What did the This do to the Sobibor death camp', 'What did the SS do to the Sobibor death camp', q, flags=re.I)
    q = re.sub(r'What did the this there make\?', 'What product did the factories there manufacture?', q, flags=re.I)
    q = re.sub(r'Germany responded with a this-guided night fighter system\.', 'Germany responded with a radar-guided night fighter system.', q, flags=re.I)
    q = re.sub(r'One was the This — what was the other\?', 'One was the Musashi — what was the other?', q, flags=re.I)
    q = re.sub(r'What was the name of this this\?', 'What was the name of this treaty?', q, flags=re.I)
    q = re.sub(r'\bthe this fuze\b', 'the proximity fuze', q, flags=re.I)
    q = re.sub(r'\bThis gun\b', 'the German gun', q, flags=re.I)

    # World Wonders
    q = re.sub(r'Who designed and built the This wonder Tower\?', 'Who designed and built the Eiffel Tower?', q, flags=re.I)
    q = re.sub(r'Which This wonder Lama ordered construction of the modern Potala Palace', 'Which Dalai Lama ordered construction of the modern Potala Palace', q, flags=re.I)
    q = re.sub(r"the Brooklyn This structure hold", "the Brooklyn Bridge hold", q, flags=re.I)
    q = re.sub(r'\bThis structure\b', 'this structure', q)

    # Ancient Rome
    q = re.sub(r'proving their loyalty by performing a this —', 'proving their loyalty by performing a sacrifice —', q, flags=re.I)
    q = re.sub(r'what did Constantine do to the This figure Guard', 'what did Constantine do to the Praetorian Guard', q, flags=re.I)
    q = re.sub(r'\bThis figure Guard\b', 'Praetorian Guard', q)
    q = re.sub(r'\bthis figure Guard\b', 'Praetorian Guard', q, flags=re.I)

    # AP European History
    q = re.sub(r'compete for dominance over the This peninsula\?', 'compete for dominance over the Italian peninsula?', q, flags=re.I)
    q = re.sub(r'Declaration of the This of Man and Citizen', 'Declaration of the Rights of Man and Citizen', q, flags=re.I)
    q = re.sub(r'What was the This Laws controversy in Britain', 'What was the Corn Laws controversy in Britain', q, flags=re.I)

    # World Cuisines
    q = re.sub(r'Who invented the This food scale for measuring chili heat', 'Who invented the heat scale for measuring chili pungency', q, flags=re.I)
    q = re.sub(r'which This food declared it a Christian beverage', 'which Pope declared it a Christian beverage', q, flags=re.I)

    # Music History
    q = re.sub(r'Princess Odette transformed into a this\?', 'Princess Odette transformed into a swan?', q, flags=re.I)
    q = re.sub(r'one of the most beloved in the this repertoire\?', 'one of the most beloved in the piano concerto repertoire?', q, flags=re.I)

    # Norse Mythology
    q = re.sub(r'war fought between the This gods and the Vanir gods', 'war fought between the Aesir gods and the Vanir gods', q, flags=re.I)
    q = re.sub(r'Odin sacrificed one of his eyes to drink from which this', "Odin sacrificed one of his eyes to drink from which well", q, flags=re.I)

    # Ancient Greece
    q = re.sub(r'participate in the this system without financial hardship', 'participate in the jury system without financial hardship', q, flags=re.I)

    # Famous Paintings
    q = re.sub(r"below the this artwork in Magritte's The Treachery", "inscribed below the painted pipe in Magritte's The Treachery", q, flags=re.I)

    # Pharmacology
    q = re.sub(r'the this-dependent mechanism of action of dopamine\?', 'the dose-dependent mechanism of action of dopamine?', q, flags=re.I)
    q = re.sub(r'What this side effect is commonly associated with', 'What notable side effect is commonly associated with', q, flags=re.I)

    # AP Chemistry structural
    q = re.sub(r'\bthis structure open\b', 'which structure opens', q, flags=re.I)

    # Human Anatomy - "this structure" often refers to the anatomical structure being asked about
    # When "this structure" appears, it's typically the subject of the question itself
    q = re.sub(r'\bthis structure\b', 'this anatomical structure', q, flags=re.I)

    # Human anatomy "this process"
    q = re.sub(r'\bthis process\b', 'this biological process', q, flags=re.I)
    q = re.sub(r'\bThis process\b', 'This biological process', q)

    # Generic 'this concept' fallback -- after all specific fixes above
    q = re.sub(r'\bthis concept\b', 'the concept', q, flags=re.I)
    q = re.sub(r'\bThis concept\b', 'The concept', q)

    # Generic "this figure" -> "this person/value"
    q = re.sub(r'\bthis figure\b', 'this person', q, flags=re.I)
    q = re.sub(r'\bThis figure\b', 'This person', q)

    # Generic "this type" -> "this category"
    q = re.sub(r'\bthis type\b', 'this category', q, flags=re.I)
    q = re.sub(r'\bThis type\b', 'This category', q)

    # Generic "this food" -> "this ingredient"
    q = re.sub(r'\bthis food\b', 'this ingredient', q, flags=re.I)
    q = re.sub(r'\bThis food\b', 'This ingredient', q)

    # Generic "this artwork" -> "this painting"
    q = re.sub(r'\bthis artwork\b', 'this painting', q, flags=re.I)
    q = re.sub(r'\bThis artwork\b', 'This painting', q)

    # Generic "this pattern" -> "this pattern" (neutral - already handled specifically above)
    q = re.sub(r'\bthis pattern\b', 'this pattern', q, flags=re.I)
    q = re.sub(r'\bThis pattern\b', 'This pattern', q)

    # Generic "this property" -> "this characteristic"
    q = re.sub(r'\bthis property\b', 'this characteristic', q, flags=re.I)
    q = re.sub(r'\bThis property\b', 'This characteristic', q)

    # Generic "this-guided" -> "radar-guided"
    q = re.sub(r'\bthis-guided\b', 'radar-guided', q, flags=re.I)

    # Generic "this-powered" -> domain-appropriate
    q = re.sub(r'\bthis-powered\b', 'mechanically powered', q, flags=re.I)

    # Generic "this-age" -> "working-age"
    q = re.sub(r'\bthis-age\b', 'working-age', q, flags=re.I)

    # Generic "this funds" -> "loanable funds"
    q = re.sub(r'\bthis funds\b', 'loanable funds', q, flags=re.I)

    # Generic "this run" -> "short run"
    q = re.sub(r'\bthis run\b', 'short run', q, flags=re.I)

    # Generic "This curve" fallback
    q = re.sub(r'\bThis curve\b', 'the curve', q)

    # Generic "this guard" -> "the guard"
    q = re.sub(r'\bthis guard\b', 'the guard', q, flags=re.I)
    q = re.sub(r'\bThis guard\b', 'The guard', q)

    # Generic "this article" -> "the article"
    q = re.sub(r'\bthis article\b', 'the article', q, flags=re.I)
    q = re.sub(r'\bThis article\b', 'The article', q)

    # Generic "this side" -> "the demand side"
    q = re.sub(r'\bthis side\b', 'the demand side', q, flags=re.I)

    # Generic "which this" -> "which one"
    q = re.sub(r'\bwhich this\b', 'which', q, flags=re.I)

    # Generic "the this" -> "the"
    q = re.sub(r'\bthe this\b', 'the', q, flags=re.I)
    q = re.sub(r'\bThe this\b', 'The', q)

    # Generic "a this" -> "a"
    q = re.sub(r'\ba this\b', 'a', q, flags=re.I)
    q = re.sub(r'\bA this\b', 'A', q)

    # Generic "an this" -> "an"
    q = re.sub(r'\ban this\b', 'an', q, flags=re.I)
    q = re.sub(r'\bAn this\b', 'An', q)

    # Generic "this crisis" -> "the crisis"
    q = re.sub(r'\b(\w+) this crisis\b', r'\1 refugee crisis', q, flags=re.I)
    q = re.sub(r'\bthis crisis\b', 'the crisis', q, flags=re.I)

    return q


def process_file(filepath: str, dry_run: bool = False, verbose: bool = False) -> tuple[int, int, list]:
    """
    Process a single deck file.
    Returns (broken_count, fixed_count, unfixed_list).
    Does NOT write if dry_run=True.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, dict):
        return 0, 0, []

    facts = data.get('facts', [])
    if not isinstance(facts, list):
        return 0, 0, []

    fixed_count = 0
    unfixed = []
    broken_count = 0

    for fact in facts:
        if not isinstance(fact, dict):
            continue
        q = fact.get('quizQuestion', '')
        if not is_broken(q):
            continue

        broken_count += 1
        answer = fact.get('correctAnswer', '')
        fact_id = fact.get('id', '')
        new_q = repair_question(q, answer, fact_id)

        if verbose:
            if new_q != q:
                print(f"  FIX [{fact_id}]")
                print(f"    OLD: {q}")
                print(f"    NEW: {new_q}")
            else:
                print(f"  SKIP [{fact_id}]: {q[:80]}")

        if new_q != q and not is_broken(new_q):
            fact['quizQuestion'] = new_q
            fixed_count += 1
        elif is_broken(new_q):
            unfixed.append((fact_id, new_q, answer))
        else:
            # new_q == q and not broken? shouldn't happen
            unfixed.append((fact_id, q, answer))

    if not dry_run and fixed_count > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')

    return broken_count, fixed_count, unfixed


def main():
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    specific_file = None
    for arg in sys.argv[1:]:
        if not arg.startswith('-') and arg.endswith('.json'):
            specific_file = arg

    if specific_file:
        deck_files = [specific_file]
    else:
        deck_files = sorted(glob.glob(
            '/Users/damion/CODE/Recall_Rogue/data/decks/**/*.json', recursive=True
        ))

    total_broken = 0
    total_fixed = 0
    all_unfixed = []
    files_changed = []

    for filepath in deck_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                continue

        if not isinstance(data, dict):
            continue

        facts = data.get('facts', [])
        if not isinstance(facts, list):
            continue

        has_broken = any(
            isinstance(f, dict) and is_broken(f.get('quizQuestion', ''))
            for f in facts
        )
        if not has_broken:
            continue

        if verbose:
            rel = filepath.replace('/Users/damion/CODE/Recall_Rogue/', '')
            print(f"\n=== {rel} ===")

        broken, fixed, unfixed = process_file(filepath, dry_run=dry_run, verbose=verbose)

        total_broken += broken
        total_fixed += fixed
        all_unfixed.extend([(filepath, fid, q, a) for fid, q, a in unfixed])

        if fixed > 0 or unfixed:
            files_changed.append(filepath)

        if not verbose:
            rel = filepath.replace('/Users/damion/CODE/Recall_Rogue/', '')
            status = f"fixed {fixed}/{broken}"
            if unfixed:
                status += f", {len(unfixed)} still broken"
            print(f"  {rel}: {status}")

    print(f"\n{'DRY RUN - ' if dry_run else ''}SUMMARY:")
    print(f"  Total broken found:     {total_broken}")
    print(f"  Total questions fixed:  {total_fixed}")
    print(f"  Questions still broken: {len(all_unfixed)}")
    print(f"  Files changed:          {len(files_changed)}")

    if all_unfixed:
        print("\nStill broken (need manual review):")
        for filepath, fid, q, a in all_unfixed:
            rel = filepath.replace('/Users/damion/CODE/Recall_Rogue/', '')
            print(f"  {rel} [{fid}]:")
            print(f"    Q: {q}")
            print(f"    A: {a}")
            print()


if __name__ == '__main__':
    main()

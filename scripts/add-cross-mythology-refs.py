#!/usr/bin/env python3
"""
Add cross-mythology references (Norse <-> Greek) to the Norse mythology deck.
Appends one sentence to wowFactor or explanation of 12 carefully chosen facts.
"""

import json

NORSE_PATH = "data/decks/norse_mythology.json"

# (fact_id, field, sentence_to_append)
CROSS_REFS = [
    # 1. Odin / Zeus — both kings, both wisdom-obsessed, but very different costs
    (
        "myth_norse_odin_king_aesir",
        "explanation",
        "The Greeks had a close parallel: Zeus was also a wandering, disguise-wearing king-god with a preoccupation with foreknowledge — but where Zeus obtained his throne through war, Odin paid for every scrap of wisdom with personal suffering. Same crown, utterly different cost.",
    ),
    # 2. Odin's eye / Zeus contrast — sacrificing sight vs. inheriting power
    (
        "myth_norse_odin_eye",
        "explanation",
        "Compare this to Zeus, who inherited supreme power after the Titanomachy without sacrificing anything as intimate as his own body. Odin's willingness to mutilate himself for knowledge is one of the sharpest contrasts between the two king-gods: both are all-knowing fathers of the pantheon, but only one paid for it in organs.",
    ),
    # 3. Odin's self-hanging for runes / Prometheus stealing fire for humanity
    (
        "myth_norse_odin_runes",
        "wowFactor",
        "The Greeks had a parallel in Prometheus, who endured eternal torment on a rock — his liver eaten daily by an eagle — as punishment for giving fire to humanity. Both figures suffered extreme, prolonged agony to deliver a civilizational gift (fire; written language) to humans. The Norse version is stranger still: Odin was simultaneously the god, the priest, and the sacrifice.",
    ),
    # 4. Loki bound / Prometheus bound — near-identical punishment structure
    (
        "myth_norse_loki_punishment_binding",
        "wowFactor",
        "The Greeks told almost the same story: Prometheus was chained to a rock and had his liver devoured by an eagle every day — eternally regenerating, eternally punished for defying the divine order. Both figures are trickster-benefactors punished with eternal physical torment, and both are prophesied to be freed at a world-ending event. The parallel is so close that scholars believe both myths descend from a shared Proto-Indo-European story of the bound rebel.",
    ),
    # 5. Hel / Hades — both misunderstood rulers of the dead, not evil
    (
        "myth_norse_hel_underworld_ruler",
        "explanation",
        "The parallel with Hades is striking and often missed: both Hel and Hades are rulers of the dead who are not evil — they are impartial, stern, and powerful, misrepresented as villains in modern retellings. Both were avoided by name (Greeks called Hades 'the Rich One'; people conflate Hel with hellfire). The key difference is origin: Hades drew the short lot at a family lottery; Hel was cast out by her own grandfather.",
    ),
    # 6. Hermóðr's quest / Orpheus's descent — both negotiate with the ruler of the dead
    (
        "myth_norse_hel_baldur_resurrection",
        "explanation",
        "Hermóðr's journey to retrieve Baldur is the Norse answer to Orpheus descending to the Greek Underworld for Eurydice. Both heroes negotiate with the ruler of the dead for a beloved's release, both are given a condition that seems achievable, and both fail at the final obstacle — Orpheus looks back, Loki-as-Þökk refuses to weep. The Norse version is harsher: the sabotage came from outside, not from the hero's own doubt.",
    ),
    # 7. Garm / Cerberus — both monstrous dogs guarding the underworld entrance
    (
        "myth_norse_garm_helheim",
        "explanation",
        "The structural echo of Cerberus is deliberate: both Garm and Cerberus are massive hounds chained at the entrance to the underworld, both are overcome by visitors (Heracles dragged Cerberus out; Orpheus lulled him with music), and both break free or die at the end of their respective mythologies. The difference is in what that ending means: Cerberus is a challenge in a hero's labor; Garm's death at Ragnarök is the closing of the cosmic ledger.",
    ),
    # 8. Ragnarök / Titanomachy — both cosmic wars reshaping the divine order
    (
        "myth_norse_ragnarok_overview",
        "explanation",
        "The closest Greek parallel is the Titanomachy — the ten-year war where Zeus's generation overthrew Kronos and the Titans. Both are cosmic generational conflicts that restructure the divine order. But they run in opposite directions: the Titanomachy is the gods establishing their reign; Ragnarök is their reign ending. Where the Titanomachy is an origin story, Ragnarök is a terminus — followed by a new beginning that Greek mythology never imagined for its gods.",
    ),
    # 9. Fenrir binding / Typhon — both bound chaos-monsters destined to break free
    (
        "myth_norse_fenrir_binding",
        "wowFactor",
        "The Greeks had Typhon — a monster so fearsome he nearly defeated Zeus, severed his divine tendons, and had to be buried under Mount Etna. Like Fenrir, Typhon was a chaos-born creature imprisoned to delay an apocalyptic threat, and like Fenrir, mythology is clear the imprisonment is temporary. Both traditions understood the same dark truth: you cannot kill the end of the world, only postpone it.",
    ),
    # 10. Sigurd / Achilles — both supreme heroes with one fatal unprotected spot
    (
        "myth_norse_sigurd_dragon",
        "wowFactor",
        "The parallel to Achilles is exact: both are the supreme hero of their tradition, both rendered nearly invulnerable by a specific ritual (Achilles dipped in the River Styx; Sigurd bathed in Fafnir's blood), and both are killed through the single spot that protection missed — Achilles' heel, Sigurd's shoulder blade where a leaf fell. Two mythologies, one structural principle: the hero's invulnerability creates his fatal weakness.",
    ),
    # 11. Thor / Heracles — both strongman monster-slayers, both die from venom
    (
        "myth_norse_thor_protector_midgard",
        "wowFactor",
        "The Greeks had Heracles as the exact equivalent: both are the strongman monster-slayers of their pantheon, both defined by campaigns that protect humanity from supernatural threats, both have complicated divine parentage (Heracles half-mortal; Thor half-giant through his mother Jörð), and both die from venom connected to their defining enemy. The Romans explicitly equated them — early accounts of Germanic religion called the Thunder-god 'Hercules' without hesitation.",
    ),
    # 12. Ragnarök renewal / Deucalion's flood — post-catastrophe repopulation
    (
        "myth_norse_ragnarok_world_renewal",
        "explanation",
        "The Greek tradition has no true equivalent — the Olympians do not fall, and the cosmos does not reset. The closest parallel is Deucalion's flood, where Zeus destroys humanity and two survivors repopulate the earth, but the gods remain unchanged on Olympus. Ragnarök is structurally more radical: the gods themselves die, the cosmos is reborn, and a new pantheon inherits the world. Norse mythology treats divine order as mortal in a way Greek mythology never does.",
    ),
]


def main():
    with open(NORSE_PATH, "r", encoding="utf-8") as f:
        deck = json.load(f)

    fact_index = {fact["id"]: i for i, fact in enumerate(deck["facts"])}
    applied = []
    errors = []

    for fact_id, field, sentence in CROSS_REFS:
        if fact_id not in fact_index:
            errors.append(f"MISSING ID: {fact_id}")
            continue

        idx = fact_index[fact_id]
        fact = deck["facts"][idx]
        current = fact.get(field) or ""

        # Guard against double-application
        if sentence[:40] in current:
            errors.append(f"ALREADY APPLIED: {fact_id} [{field}]")
            continue

        # Append sentence with proper spacing
        updated = current.rstrip()
        if updated:
            updated += " " + sentence
        else:
            updated = sentence

        fact[field] = updated
        deck["facts"][idx] = fact
        applied.append((fact_id, field))

    with open(NORSE_PATH, "w", encoding="utf-8") as f:
        json.dump(deck, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"\n=== Cross-mythology references applied: {len(applied)} ===")
    for fact_id, field in applied:
        print(f"  + {fact_id} [{field}]")

    if errors:
        print(f"\nErrors/skipped: {len(errors)}")
        for e in errors:
            print(f"  ! {e}")

    print(f"\nWrote updated deck to {NORSE_PATH}")


if __name__ == "__main__":
    main()

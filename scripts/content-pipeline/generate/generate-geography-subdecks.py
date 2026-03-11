#!/usr/bin/env python3
"""
Generate geography sub-deck JSONL files (capitals + flags) from raw Wikidata JSON.

Reads:  data/raw/geography.json
Writes: data/generated/geography-capitals.jsonl
        data/generated/geography-flags.jsonl
"""

import json
import os
import random
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[3]  # /root/terra-miner
RAW_PATH = ROOT / "data" / "raw" / "geography.json"
OUT_DIR = ROOT / "data" / "generated"
CAPITALS_OUT = OUT_DIR / "geography-capitals.jsonl"
FLAGS_OUT = OUT_DIR / "geography-flags.jsonl"

# ---------------------------------------------------------------------------
# ISO 3166-1 alpha-2 mapping (country name → code)
# ---------------------------------------------------------------------------
ISO_MAP: dict[str, str] = {
    "Afghanistan": "AF",
    "Albania": "AL",
    "Algeria": "DZ",
    "Andorra": "AD",
    "Angola": "AO",
    "Antigua and Barbuda": "AG",
    "Argentina": "AR",
    "Armenia": "AM",
    "Australia": "AU",
    "Austria": "AT",
    "Azerbaijan": "AZ",
    "Bahrain": "BH",
    "Bangladesh": "BD",
    "Barbados": "BB",
    "Belarus": "BY",
    "Belgium": "BE",
    "Belize": "BZ",
    "Benin": "BJ",
    "Bhutan": "BT",
    "Bolivia": "BO",
    "Bosnia and Herzegovina": "BA",
    "Botswana": "BW",
    "Brazil": "BR",
    "Brunei": "BN",
    "Bulgaria": "BG",
    "Burkina Faso": "BF",
    "Burundi": "BI",
    "Cambodia": "KH",
    "Cameroon": "CM",
    "Canada": "CA",
    "Cape Verde": "CV",
    "Central African Republic": "CF",
    "Chad": "TD",
    "Chile": "CL",
    "Colombia": "CO",
    "Comoros": "KM",
    "Costa Rica": "CR",
    "Croatia": "HR",
    "Cuba": "CU",
    "Cyprus": "CY",
    "Czech Republic": "CZ",
    "Democratic Republic of the Congo": "CD",
    "Djibouti": "DJ",
    "Dominica": "DM",
    "Dominican Republic": "DO",
    "Ecuador": "EC",
    "Egypt": "EG",
    "El Salvador": "SV",
    "Equatorial Guinea": "GQ",
    "Eritrea": "ER",
    "Estonia": "EE",
    "Eswatini": "SZ",
    "Ethiopia": "ET",
    "Federated States of Micronesia": "FM",
    "Fiji": "FJ",
    "Finland": "FI",
    "France": "FR",
    "Gabon": "GA",
    "Georgia": "GE",
    "Germany": "DE",
    "Ghana": "GH",
    "Greece": "GR",
    "Grenada": "GD",
    "Guatemala": "GT",
    "Guinea": "GN",
    "Guinea-Bissau": "GW",
    "Guyana": "GY",
    "Haiti": "HT",
    "Honduras": "HN",
    "Hungary": "HU",
    "Iceland": "IS",
    "India": "IN",
    "Indonesia": "ID",
    "Iran": "IR",
    "Iraq": "IQ",
    "Ireland": "IE",
    "Italy": "IT",
    "Ivory Coast": "CI",
    "Jamaica": "JM",
    "Japan": "JP",
    "Jordan": "JO",
    "Kazakhstan": "KZ",
    "Kenya": "KE",
    "Kingdom of Denmark": "DK",
    "Kingdom of the Netherlands": "NL",
    "Kiribati": "KI",
    "Kuwait": "KW",
    "Kyrgyzstan": "KG",
    "Laos": "LA",
    "Latvia": "LV",
    "Lebanon": "LB",
    "Lesotho": "LS",
    "Liberia": "LR",
    "Libya": "LY",
    "Liechtenstein": "LI",
    "Lithuania": "LT",
    "Luxembourg": "LU",
    "Madagascar": "MG",
    "Malawi": "MW",
    "Malaysia": "MY",
    "Maldives": "MV",
    "Mali": "ML",
    "Malta": "MT",
    "Marshall Islands": "MH",
    "Mauritania": "MR",
    "Mauritius": "MU",
    "Mexico": "MX",
    "Moldova": "MD",
    "Monaco": "MC",
    "Mongolia": "MN",
    "Montenegro": "ME",
    "Morocco": "MA",
    "Mozambique": "MZ",
    "Myanmar": "MM",
    "Namibia": "NA",
    "Nauru": "NR",
    "Nepal": "NP",
    "New Zealand": "NZ",
    "Nicaragua": "NI",
    "Niger": "NE",
    "Nigeria": "NG",
    "North Korea": "KP",
    "North Macedonia": "MK",
    "Norway": "NO",
    "Oman": "OM",
    "Pakistan": "PK",
    "Palau": "PW",
    "Palestine": "PS",
    "Panama": "PA",
    "Papua New Guinea": "PG",
    "Paraguay": "PY",
    "People's Republic of China": "CN",
    "Peru": "PE",
    "Philippines": "PH",
    "Poland": "PL",
    "Portugal": "PT",
    "Qatar": "QA",
    "Republic of the Congo": "CG",
    "Romania": "RO",
    "Russia": "RU",
    "Russian Empire": None,  # historical, skip for flags
    "Rwanda": "RW",
    "Saint Kitts and Nevis": "KN",
    "Saint Lucia": "LC",
    "Saint Vincent and the Grenadines": "VC",
    "Samoa": "WS",
    "San Marino": "SM",
    "Saudi Arabia": "SA",
    "Senegal": "SN",
    "Serbia": "RS",
    "Seychelles": "SC",
    "Sierra Leone": "SL",
    "Singapore": "SG",
    "Slovakia": "SK",
    "Slovenia": "SI",
    "Solomon Islands": "SB",
    "Somalia": "SO",
    "South Africa": "ZA",
    "South Korea": "KR",
    "South Sudan": "SS",
    "Spain": "ES",
    "Sri Lanka": "LK",
    "Sudan": "SD",
    "Suriname": "SR",
    "Sweden": "SE",
    "Switzerland": "CH",
    "Syria": "SY",
    "São Tomé and Príncipe": "ST",
    "Taiwan": "TW",
    "Tajikistan": "TJ",
    "Tanzania": "TZ",
    "Thailand": "TH",
    "The Bahamas": "BS",
    "The Gambia": "GM",
    "Timor-Leste": "TL",
    "Togo": "TG",
    "Tonga": "TO",
    "Trinidad and Tobago": "TT",
    "Tunisia": "TN",
    "Turkey": "TR",
    "Turkmenistan": "TM",
    "Tuvalu": "TV",
    "Uganda": "UG",
    "Ukraine": "UA",
    "United Arab Emirates": "AE",
    "United Kingdom": "GB",
    "United States": "US",
    "Uruguay": "UY",
    "Uzbekistan": "UZ",
    "Vanuatu": "VU",
    "Vatican City": "VA",
    "Venezuela": "VE",
    "Vietnam": "VN",
    "Yemen": "YE",
    "Zambia": "ZM",
    "Zimbabwe": "ZW",
}


def to_flag_emoji(iso_code: str) -> str:
    """Convert a 2-letter ISO 3166-1 alpha-2 code to its flag emoji."""
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in iso_code.upper())


def slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    s = text.lower()
    s = re.sub(r"[''ʻ]", "", s)
    s = s.replace("ã", "a").replace("é", "e").replace("í", "i").replace("ô", "o")
    s = s.replace("ü", "u").replace("ä", "a").replace("ö", "o").replace("ê", "e")
    s = s.replace("à", "a").replace("è", "e").replace("ú", "u").replace("ñ", "n")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def difficulty_from_population(pop: int) -> int:
    """Map population to difficulty 1-5."""
    if pop > 100_000_000:
        return 1
    if pop > 30_000_000:
        return 2
    if pop > 5_000_000:
        return 3
    if pop > 500_000:
        return 4
    return 5


def rarity_from_difficulty(diff: int) -> str:
    """Map difficulty to rarity tier."""
    return {1: "common", 2: "uncommon", 3: "rare", 4: "epic", 5: "legendary"}[diff]


def continent_slug(continent: str) -> str:
    """Slugify a continent name."""
    return slugify(continent)


def pick_distractors(
    pool: list[str],
    exclude: str,
    count: int = 8,
    same_continent_pool: list[str] | None = None,
    other_continent_pool: list[str] | None = None,
) -> list[dict]:
    """
    Pick `count` distractors, preferring same-continent options for hard tiers
    and other-continent for easy tiers.

    Returns list of {text, difficultyTier} dicts.
    """
    # Separate same vs other continent candidates
    same = [c for c in (same_continent_pool or []) if c != exclude]
    other = [c for c in (other_continent_pool or []) if c != exclude]

    random.shuffle(same)
    random.shuffle(other)

    # Assign tiers: first 3 easy (other continent), next 3 medium (mix), last 2 hard (same continent)
    result: list[dict] = []
    used: set[str] = set()

    def add(src: list[str], tier: str, n: int) -> None:
        for item in src:
            if len(result) >= count:
                return
            if n <= 0:
                return
            if item not in used:
                result.append({"text": item, "difficultyTier": tier})
                used.add(item)
                n -= 1

    # Easy: from other continents (well-known, obviously wrong)
    add(other, "easy", 3)
    # Medium: mix of same and other
    medium_pool = same[:5] + other[3:8]
    random.shuffle(medium_pool)
    add(medium_pool, "medium", 3)
    # Hard: same continent (similar region, harder to distinguish)
    add(same, "hard", 2)

    # Backfill if we don't have enough
    all_remaining = [c for c in pool if c != exclude and c not in used]
    random.shuffle(all_remaining)
    for item in all_remaining:
        if len(result) >= count:
            break
        result.append({"text": item, "difficultyTier": "medium"})

    return result[:count]


def build_variants_capitals(
    country: str,
    capital: str,
    same_capitals: list[str],
    other_capitals: list[str],
) -> list[dict]:
    """Build 5 quiz variants for a capitals fact."""

    def pick3(pool: list[str], exclude: str) -> list[str]:
        opts = [c for c in pool if c != exclude]
        random.shuffle(opts)
        return opts[:3]

    cap_pool = same_capitals + other_capitals
    country_pool_for_reverse = other_capitals  # We'll use a separate approach for reverse

    forward_dist = pick3(cap_pool, capital)
    reverse_dist = pick3(cap_pool, capital)  # placeholder — reverse uses country names
    neg_dist = [capital] + pick3(cap_pool, capital)[:2]
    fill_dist = pick3(cap_pool, capital)

    return [
        {
            "question": f"What is the capital city of {country}?",
            "type": "forward",
            "correctAnswer": capital,
            "distractors": forward_dist,
        },
        {
            "question": f"{capital} is the capital of which country?",
            "type": "reverse",
            "correctAnswer": country,
            "distractors": reverse_dist,
        },
        {
            "question": f"Which of these is NOT the capital of {country}?",
            "type": "negative",
            "correctAnswer": forward_dist[0] if forward_dist else "N/A",
            "distractors": neg_dist,
        },
        {
            "question": f"The capital of {country} is _____.",
            "type": "fill_blank",
            "correctAnswer": capital,
            "distractors": fill_dist,
        },
        {
            "question": f"The capital of {country} is {capital}.",
            "type": "true_false",
            "correctAnswer": "True",
            "distractors": ["False"],
        },
    ]


def build_variants_flags(
    country: str,
    flag_emoji: str,
    same_countries: list[str],
    other_countries: list[str],
) -> list[dict]:
    """Build 5 quiz variants for a flags fact."""

    def pick3(pool: list[str], exclude: str) -> list[str]:
        opts = [c for c in pool if c != exclude]
        random.shuffle(opts)
        return opts[:3]

    c_pool = same_countries + other_countries
    forward_dist = pick3(c_pool, country)
    reverse_dist = pick3(c_pool, country)
    neg_dist = [country] + pick3(c_pool, country)[:2]
    fill_dist = pick3(c_pool, country)

    return [
        {
            "question": f"Which country does this flag belong to? {flag_emoji}",
            "type": "forward",
            "correctAnswer": country,
            "distractors": forward_dist,
        },
        {
            "question": f"What is the flag of {country}?",
            "type": "reverse",
            "correctAnswer": flag_emoji,
            "distractors": [
                to_flag_emoji(ISO_MAP[d])
                for d in reverse_dist
                if d in ISO_MAP and ISO_MAP[d]
            ][:3],
        },
        {
            "question": f"This flag {flag_emoji} does NOT belong to which country?",
            "type": "negative",
            "correctAnswer": forward_dist[0] if forward_dist else "N/A",
            "distractors": neg_dist,
        },
        {
            "question": f"The flag {flag_emoji} belongs to _____.",
            "type": "fill_blank",
            "correctAnswer": country,
            "distractors": fill_dist,
        },
        {
            "question": f"This flag {flag_emoji} belongs to {country}.",
            "type": "true_false",
            "correctAnswer": "True",
            "distractors": ["False"],
        },
    ]


def main() -> None:
    random.seed(42)  # reproducible output

    # ---- Load & deduplicate ----
    with open(RAW_PATH, "r", encoding="utf-8") as f:
        raw: list[dict] = json.load(f)

    seen: set[str] = set()
    entries: list[dict] = []
    skipped: list[str] = []
    for entry in raw:
        name = entry.get("countryLabel", "")
        if not name or name in seen:
            continue
        if "capitalLabel" not in entry:
            skipped.append(name)
            continue
        seen.add(name)
        entries.append(entry)

    print(f"Loaded {len(raw)} raw entries, {len(entries)} after dedup.")
    if skipped:
        print(f"Skipped (missing capitalLabel): {', '.join(skipped)}")

    # ---- Build continent pools ----
    # capitals grouped by continent
    capitals_by_continent: dict[str, list[str]] = {}
    countries_by_continent: dict[str, list[str]] = {}
    all_capitals: list[str] = []
    all_countries: list[str] = []

    for e in entries:
        cont = e["continentLabel"]
        cap = e["capitalLabel"]
        cname = e["countryLabel"]
        capitals_by_continent.setdefault(cont, []).append(cap)
        countries_by_continent.setdefault(cont, []).append(cname)
        all_capitals.append(cap)
        all_countries.append(cname)

    # ---- Generate facts ----
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cap_count = 0
    flag_count = 0

    with open(CAPITALS_OUT, "w", encoding="utf-8") as cap_f, open(
        FLAGS_OUT, "w", encoding="utf-8"
    ) as flag_f:

        for e in entries:
            country = e["countryLabel"]
            capital = e["capitalLabel"]
            cont = e["continentLabel"]
            pop = int(float(e.get("population", 0)))
            slug = slugify(country)
            cont_s = continent_slug(cont)
            wiki_url = e.get("country", "")

            diff = difficulty_from_population(pop)
            rar = rarity_from_difficulty(diff)

            same_caps = capitals_by_continent.get(cont, [])
            other_caps = [
                c
                for k, v in capitals_by_continent.items()
                if k != cont
                for c in v
            ]
            same_countries = countries_by_continent.get(cont, [])
            other_countries_list = [
                c
                for k, v in countries_by_continent.items()
                if k != cont
                for c in v
            ]

            # ---- Capitals fact ----
            cap_distractors = pick_distractors(
                all_capitals,
                capital,
                count=8,
                same_continent_pool=same_caps,
                other_continent_pool=other_caps,
            )

            cap_variants = build_variants_capitals(
                country, capital, same_caps, other_caps
            )

            cap_fact = {
                "id": f"geo-cap-{slug}-001",
                "type": "fact",
                "statement": f"The capital of {country} is {capital}.",
                "wowFactor": f"{capital} serves as the capital of {country}, located in {cont}.",
                "explanation": f"{capital} is the capital city of {country}.",
                "quizQuestion": f"What is the capital of {country}?",
                "correctAnswer": capital,
                "distractors": cap_distractors,
                "category": ["Geography", "Capitals"],
                "rarity": rar,
                "difficulty": diff,
                "funScore": 6,
                "ageRating": "kid",
                "variants": cap_variants,
                "tags": ["capital", "country", cont_s],
                "sourceName": "Wikidata",
                "sourceUrl": wiki_url,
                "contentType": "knowledge",
            }
            cap_f.write(json.dumps(cap_fact, ensure_ascii=False) + "\n")
            cap_count += 1

            # ---- Flags fact ----
            iso = ISO_MAP.get(country)
            if iso is None:
                continue  # skip countries without ISO code

            flag = to_flag_emoji(iso)

            flag_distractors = pick_distractors(
                all_countries,
                country,
                count=8,
                same_continent_pool=same_countries,
                other_continent_pool=other_countries_list,
            )

            flag_variants = build_variants_flags(
                country, flag, same_countries, other_countries_list
            )

            flag_fact = {
                "id": f"geo-flag-{slug}-001",
                "type": "fact",
                "statement": f"The flag {flag} belongs to {country}.",
                "wowFactor": f"The flag of {country} ({flag}) is a symbol of national identity in {cont}.",
                "explanation": f"{flag} is the national flag of {country}.",
                "quizQuestion": f"Which country does this flag belong to? {flag}",
                "correctAnswer": country,
                "distractors": flag_distractors,
                "category": ["Geography", "Flags"],
                "rarity": rar,
                "difficulty": diff,
                "funScore": 8,
                "ageRating": "kid",
                "variants": flag_variants,
                "tags": ["flag", "country", cont_s],
                "sourceName": "Wikidata",
                "sourceUrl": wiki_url,
                "contentType": "knowledge",
            }
            flag_f.write(json.dumps(flag_fact, ensure_ascii=False) + "\n")
            flag_count += 1

    print(f"\nWrote {cap_count} capitals facts → {CAPITALS_OUT}")
    print(f"Wrote {flag_count} flags facts   → {FLAGS_OUT}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Download CC-licensed illustrations from Wikimedia Commons.

Usage:
    python3 scripts/download-wikimedia-images.py --set dinosaurs
    python3 scripts/download-wikimedia-images.py --set dinosaurs --force-redownload tyrannosaurus

Searches for life-reconstruction illustrations, converts to webp at max 512px wide.
All images must be CC0, CC-BY, CC-BY-SA, or Public Domain.

Images are written to:  public/assets/{set}/
Manifest written to:    public/assets/{set}/image-manifest.json
"""

import argparse
import json
import os
import re
import html
import time
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

VALID_LICENSES = [
    "CC0", "CC BY", "CC-BY", "CC BY-SA", "CC-BY-SA",
    "Public Domain", "PD", "pd-"
]

PREFERRED_ARTISTS = [
    "nobu tamura", "tamura", "steveoc", "steveoc86",
    "dinoguy2", "martyniuk", "bogdanov", "dmitry bogdanov",
    "willoughby", "emily willoughby", "durbed",
    "abelov", "abelov2014", "wierum", "fred wierum",
    "conty", "paleoartist", "dibgd",
    "prehistorica", "julius csotonyi", "csotonyi",
]

GOOD_TITLE_KEYWORDS = [
    "restoration", "reconstruction", "life", "paleoart",
    "illustration", "profile", "bw", "color", "drawing",
    "painting", "artist", "render", "depiction",
]

SKIP_TITLE_KEYWORDS = [
    "fossil", "skeleton", "mount", "skull", "bone", "museum",
    "specimen", "photograph", "femur", "tooth", "teeth", "jaw",
    "vertebra", "cast", "mold", "plaster", "exhibit", "display",
    "holotype", "paratype", "scan", "ct_", "_ct", "x-ray",
    "model", "toy", "replica", "sculpture", "statue", "figure",
    "animatronic", "costume", "logo", "icon", "stamp", "coin",
    "map", "chart", "cladogram", "phylogen", "timeline",
    "oggetto", "muse", "collage", "montage", "reviewer",
]

# ============================================================
# SPECIES SETS
# Add new image sets here.
# Format: list of (filename, display_name, direct_wikimedia_filenames, fallback_search_queries)
# ============================================================
IMAGE_SETS = {
    "dinosaurs": [
        # Must-have (most recognizable)
        ("tyrannosaurus", "Tyrannosaurus", ["Tyrannosaurus_rex_mmartyniuk.png"],
         ["Tyrannosaurus rex life restoration paleoart"]),
        ("triceratops", "Triceratops", ["Triceratops_BW.jpg"],
         ["Triceratops life restoration paleoart"]),
        ("stegosaurus", "Stegosaurus", ["Stegosaurus_stenops_DB.jpg", "Stegosaurus_BW.jpg"],
         ["Stegosaurus life restoration paleoart"]),
        ("velociraptor", "Velociraptor", ["Velociraptor_dinoguy2.jpg"],
         ["Velociraptor mongoliensis life restoration paleoart"]),
        ("brachiosaurus", "Brachiosaurus", ["Brachiosaurus_NT_new.jpg"],
         ["Brachiosaurus life restoration paleoart"]),
        ("diplodocus", "Diplodocus", ["Diplodocus_BW.jpg"],
         ["Diplodocus life restoration paleoart"]),
        ("spinosaurus", "Spinosaurus", ["Spinosaurus_BW2.png", "Spinosaurus_BW.jpg"],
         ["Spinosaurus life restoration paleoart"]),
        ("ankylosaurus", "Ankylosaurus", ["Ankylosaurus_magniventris_reconstruction.png"],
         ["Ankylosaurus life restoration paleoart"]),
        ("pteranodon", "Pteranodon", ["Pteranodon_longiceps_BW.jpg", "Pterodactyl_(PSF).png"],
         ["Pteranodon life restoration paleoart"]),
        ("parasaurolophus", "Parasaurolophus", ["Parasaurolophuspic_steveoc.png"],
         ["Parasaurolophus life restoration paleoart"]),
        # High priority
        ("allosaurus", "Allosaurus", ["Allosaurus_Revised.jpg"],
         ["Allosaurus life restoration paleoart"]),
        ("apatosaurus", "Apatosaurus", ["Apatosaurus33.jpg"],
         ["Apatosaurus life restoration paleoart"]),
        ("carnotaurus", "Carnotaurus", ["Carnotaurus_life_restoration_(mirrored).jpg"],
         ["Carnotaurus life restoration paleoart"]),
        ("pachycephalosaurus", "Pachycephalosaurus",
         ["Pachycephalosaurus_Reconstruction_transparent.png"],
         ["Pachycephalosaurus life restoration paleoart"]),
        ("iguanodon", "Iguanodon", ["Iguanodon_NT.jpg", "Iguanodon_BW.jpg"],
         ["Iguanodon life restoration paleoart"]),
        ("deinonychus", "Deinonychus", ["Deinonychus_Restoration.png"],
         ["Deinonychus life restoration paleoart"]),
        ("dilophosaurus", "Dilophosaurus", ["Dilophosaurus_NT.jpg"],
         ["Dilophosaurus life restoration paleoart"]),
        ("gallimimus", "Gallimimus", ["Gallimimus_Steveoc86.jpg"],
         ["Gallimimus life restoration paleoart"]),
        ("therizinosaurus", "Therizinosaurus", ["Therizinosaurus,_Tylocephale_&_Adasaurus.jpg"],
         ["Therizinosaurus life restoration paleoart"]),
        ("archaeopteryx", "Archaeopteryx", ["Archaeopteryx_NT.jpg"],
         ["Archaeopteryx life restoration paleoart"]),
        ("mosasaurus", "Mosasaurus", ["Mosasaurus_BW.jpg"],
         ["Mosasaurus life restoration paleoart"]),
        ("plesiosaurus", "Plesiosaurus", ["Plesiosaurus_BW.jpg"],
         ["Plesiosaurus life restoration paleoart"]),
        ("quetzalcoatlus", "Quetzalcoatlus", ["Arambourgiania.png"],
         ["Quetzalcoatlus life restoration paleoart"]),
        # Nice to have
        ("compsognathus", "Compsognathus", ["Compsognathus_BW.jpg"],
         ["Compsognathus life restoration paleoart"]),
        ("argentinosaurus", "Argentinosaurus", ["Argentinosaurus_BW.jpg"],
         ["Argentinosaurus life restoration paleoart"]),
        ("baryonyx", "Baryonyx", ["Baryonyx_BW.jpg"],
         ["Baryonyx life restoration paleoart"]),
        ("giganotosaurus", "Giganotosaurus", ["Giganotosaurus_BW.jpg"],
         ["Giganotosaurus life restoration paleoart"]),
        ("carcharodontosaurus", "Carcharodontosaurus", ["Bahariya_Formation_McAfee.jpg"],
         ["Carcharodontosaurus life restoration paleoart"]),
        ("protoceratops", "Protoceratops", ["Protoceratops_reconstruction.png"],
         ["Protoceratops life restoration paleoart"]),
        ("styracosaurus", "Styracosaurus", ["Dinosaur_park_formation_fauna.png"],
         ["Styracosaurus life restoration paleoart"]),
        ("maiasaura", "Maiasaura", ["Maiasaura_BW.jpg"],
         ["Maiasaura life restoration paleoart"]),
        ("corythosaurus", "Corythosaurus", ["Corythosaurus_BW.jpg", "Lambeosaurus_BW.jpg"],
         ["Corythosaurus life restoration paleoart"]),
        ("edmontosaurus", "Edmontosaurus", ["Edmontosaurus_regalis_2.png"],
         ["Edmontosaurus life restoration paleoart"]),
        ("coelophysis", "Coelophysis", ["Coelophysis_BW.jpg", "C%C5%93lophysis_bauri.jpg"],
         ["Coelophysis life restoration paleoart"]),
        ("eoraptor", "Eoraptor", ["Eoraptor_resto._01.png"],
         ["Eoraptor life restoration paleoart"]),
        ("oviraptor", "Oviraptor", ["Oviraptor_digital1.jpg"],
         ["Oviraptor life restoration paleoart"]),
        ("ceratosaurus", "Ceratosaurus", ["Ceratosaurus_nasicornis_DB.jpg"],
         ["Ceratosaurus life restoration paleoart"]),
        ("albertosaurus", "Albertosaurus", ["Albertosaurus_01.JPG"],
         ["Albertosaurus life restoration paleoart"]),
        ("ichthyosaurus", "Ichthyosaurus", ["Ichthyosaurus_BW.jpg"],
         ["Ichthyosaurus life restoration paleoart"]),
    ]
}


def clean_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return " ".join(text.split())[:150]


def is_valid_license(lic: str, lic_url: str) -> bool:
    combined = (lic + " " + lic_url).lower()
    return any(v.lower() in combined for v in VALID_LICENSES)


def score_candidate(title: str, artist: str, license_str: str) -> int:
    score = 0
    title_lower = title.lower()
    artist_lower = artist.lower()
    for pref in PREFERRED_ARTISTS:
        if pref in artist_lower:
            score += 60
            break
    for kw in GOOD_TITLE_KEYWORDS:
        if kw in title_lower:
            score += 10
    if title_lower.endswith(".png"):
        score += 20
    elif title_lower.endswith((".jpg", ".jpeg")):
        score += 5
    if any(x in license_str.lower() for x in ["cc0", "public domain"]):
        score += 5
    return score


def fetch_info_direct(filename: str, wait: float = 2.0) -> dict | None:
    """Get image info for a specific Wikimedia Commons filename."""
    encoded = urllib.parse.quote(f"File:{filename}")
    url = (
        f"https://commons.wikimedia.org/w/api.php"
        f"?action=query&titles={encoded}"
        f"&prop=imageinfo&iiprop=url|extmetadata|size"
        f"&iiurlwidth=512&format=json"
    )
    time.sleep(wait)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RecallRogue/1.0 image-downloader"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            ii = page.get("imageinfo", [{}])[0]
            meta = ii.get("extmetadata", {})
            lic = meta.get("LicenseShortName", {}).get("value", "")
            lic_url = meta.get("LicenseUrl", {}).get("value", "")
            artist = clean_html(meta.get("Artist", {}).get("value", ""))
            thumb_url = ii.get("thumburl", "")
            desc_url = ii.get("descriptionurl", "") or f"https://commons.wikimedia.org/wiki/File:{filename}"
            if is_valid_license(lic, lic_url) and thumb_url:
                return {"title": filename, "license": lic, "licenseUrl": lic_url,
                        "author": artist, "thumbUrl": thumb_url, "descUrl": desc_url}
        return None
    except Exception as e:
        print(f"  API error: {e}")
        return None


def search_and_find(display_name: str, queries: list[str]) -> dict | None:
    """Search Wikimedia Commons and return best scored candidate."""
    for query in queries:
        encoded = urllib.parse.quote(query)
        url = (
            f"https://commons.wikimedia.org/w/api.php"
            f"?action=query&generator=search"
            f"&gsrsearch={encoded}&gsrnamespace=6&gsrlimit=20"
            f"&prop=imageinfo&iiprop=url|extmetadata|size"
            f"&iiurlwidth=512&format=json"
        )
        time.sleep(2.0)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "RecallRogue/1.0 image-downloader"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"  Search error: {e}")
            continue

        candidates = []
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            title = page.get("title", "")
            ii = page.get("imageinfo", [{}])[0]
            meta = ii.get("extmetadata", {})
            lic = meta.get("LicenseShortName", {}).get("value", "")
            lic_url = meta.get("LicenseUrl", {}).get("value", "")
            artist = clean_html(meta.get("Artist", {}).get("value", ""))
            thumb_url = ii.get("thumburl", "")
            desc_url = ii.get("descriptionurl", "") or f"https://commons.wikimedia.org/wiki/{title.replace(' ', '_')}"

            if not is_valid_license(lic, lic_url) or not thumb_url:
                continue
            title_lower = title.lower()
            if any(kw in title_lower for kw in SKIP_TITLE_KEYWORDS):
                continue
            if title_lower.endswith(".svg"):
                continue

            score = score_candidate(title, artist, lic)
            candidates.append({"title": title, "score": score, "license": lic,
                                "licenseUrl": lic_url, "author": artist,
                                "thumbUrl": thumb_url, "descUrl": desc_url})

        if candidates:
            candidates.sort(key=lambda x: x["score"], reverse=True)
            return candidates[0]

    return None


def download_convert(url: str, out_path: Path, retries: int = 4) -> bool:
    """Download image and convert to webp with exponential backoff on 429."""
    tmp = Path("/tmp/dino-downloads/tmp_dl")
    tmp.parent.mkdir(parents=True, exist_ok=True)

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "RecallRogue/1.0 image-downloader"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                tmp.write_bytes(resp.read())
            if tmp.stat().st_size < 1000:
                return False
            r = subprocess.run(["cwebp", "-q", "85", str(tmp), "-o", str(out_path)],
                               capture_output=True)
            if r.returncode == 0:
                return True
            r2 = subprocess.run(["sips", "-s", "format", "webp", str(tmp), "--out", str(out_path)],
                                capture_output=True)
            return r2.returncode == 0
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 10 * (2 ** attempt)
                print(f"  429 rate limit — waiting {wait}s (attempt {attempt+1}/{retries})")
                time.sleep(wait)
            else:
                print(f"  HTTP {e.code}")
                return False
        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(5)
    return False


def run(image_set: str, force_redownload: list[str]) -> None:
    if image_set not in IMAGE_SETS:
        print(f"Unknown image set: {image_set}. Available: {list(IMAGE_SETS.keys())}")
        return

    output_dir = Path(f"/Users/damion/CODE/Recall_Rogue/public/assets/{image_set}")
    manifest_path = output_dir / "image-manifest.json"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load existing manifest
    existing = {}
    if manifest_path.exists():
        try:
            data = json.loads(manifest_path.read_text())
            for e in data.get("images", []):
                existing[e["filename"]] = e
            print(f"Loaded {len(existing)} existing entries")
        except Exception:
            pass

    species_list = IMAGE_SETS[image_set]
    success = fail = skip = 0

    for filename, display_name, direct_files, search_queries in species_list:
        out_path = output_dir / f"{filename}.webp"
        key = f"{filename}.webp"

        if out_path.exists() and key in existing and filename not in force_redownload:
            print(f"SKIP: {filename}")
            skip += 1
            continue

        if filename in force_redownload and out_path.exists():
            out_path.unlink()
            del existing[key]
            print(f"Forcing re-download: {filename}")

        print(f"\n{display_name}")
        info = None

        for wm_file in direct_files:
            print(f"  Direct: {wm_file}")
            info = fetch_info_direct(wm_file, wait=3)
            if info:
                print(f"  Found: {info['license']}, {info['author'][:50]}")
                break

        if info is None:
            print(f"  Searching...")
            info = search_and_find(display_name, search_queries)
            if info:
                print(f"  Found via search: {info['title'][:60]}")

        if info is None:
            print(f"  FAIL: no image found")
            fail += 1
            continue

        print(f"  URL: {info['thumbUrl'][:80]}")
        ok = download_convert(info["thumbUrl"], out_path)

        if ok:
            size_kb = out_path.stat().st_size // 1024
            print(f"  OK ({size_kb}KB)")
            existing[key] = {
                "species": display_name,
                "filename": key,
                "source": "Wikimedia Commons",
                "sourceUrl": info["descUrl"],
                "license": info["license"],
                "licenseUrl": info["licenseUrl"],
                "author": info["author"],
                "originalFilename": info["title"],
            }
            ordered = sorted(existing.values(), key=lambda x: x["species"])
            manifest_path.write_text(
                json.dumps({"images": ordered}, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )
            success += 1
        else:
            print(f"  FAIL: download/convert failed")
            fail += 1

        time.sleep(3)

    ordered = sorted(existing.values(), key=lambda x: x["species"])
    manifest_path.write_text(
        json.dumps({"images": ordered}, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"\nDone: success={success}, skipped={skip}, failed={fail}, total={len(existing)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download CC-licensed images from Wikimedia Commons")
    parser.add_argument("--set", required=True, help="Image set to download (e.g. dinosaurs)")
    parser.add_argument("--force-redownload", nargs="*", default=[],
                        help="Force re-download specific species (e.g. tyrannosaurus triceratops)")
    args = parser.parse_args()
    run(args.set, args.force_redownload)

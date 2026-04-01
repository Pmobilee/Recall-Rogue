# Image Quiz Assets

> **Purpose:** Covers the image asset library for image-based quiz questions (`quizMode: 'image_question'`), where the player identifies a subject from a picture.
> **Last verified:** 2026-04-01
> **Source files:** `public/assets/dinosaurs/`, `public/assets/dinosaurs/image-manifest.json`

---

## Overview

Image quiz questions display an illustration and ask the player to identify it (e.g. "Which dinosaur is shown?"). This mode uses `quizMode: 'image_question'` on `DeckFact` objects.

Images are served from `public/assets/` subdirectories at runtime and are NOT bundled into the JS.

---

## Dinosaur Image Library

**Location:** `public/assets/dinosaurs/`
**Manifest:** `public/assets/dinosaurs/image-manifest.json`
**Format:** webp, max 512px wide, quality 85

### Coverage

39 species as of 2026-04-01:

**Must-have (most recognizable):**
Tyrannosaurus, Triceratops, Stegosaurus, Velociraptor, Brachiosaurus, Diplodocus, Spinosaurus, Ankylosaurus, Pteranodon, Parasaurolophus

**High priority:**
Allosaurus, Apatosaurus, Carnotaurus, Pachycephalosaurus, Iguanodon, Deinonychus, Dilophosaurus, Gallimimus, Therizinosaurus, Archaeopteryx, Mosasaurus, Plesiosaurus, Quetzalcoatlus

**Nice to have:**
Compsognathus, Argentinosaurus, Baryonyx, Giganotosaurus, Carcharodontosaurus, Protoceratops, Styracosaurus, Maiasaura, Corythosaurus, Edmontosaurus, Coelophysis, Eoraptor, Oviraptor, Ceratosaurus, Albertosaurus, Ichthyosaurus

### Manifest Format

```json
{
  "images": [
    {
      "species": "Tyrannosaurus",
      "filename": "tyrannosaurus.webp",
      "source": "Wikimedia Commons",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:...",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
      "author": "Matt Martyniuk",
      "originalFilename": "Tyrannosaurus_rex_mmartyniuk.png",
      "note": "Optional note on image quality or fallback status"
    }
  ]
}
```

### License Notes

All images are CC0, CC-BY, CC-BY-SA, or Public Domain. For commercial use:

- **CC0 / Public Domain**: No attribution required, fully free for commercial use.
- **CC-BY (2.0/2.5/3.0/4.0)**: Attribution required in credits/about screen. Commercial use permitted.
- **CC-BY-SA (2.5/3.0/4.0)**: Attribution required. The ShareAlike clause applies to _derivative works_ — displaying an image as-is in a game is NOT creating a derivative work, so this license is acceptable for image display. The game's code and quiz content do NOT become SA-licensed.

**Attribution requirement**: All CC-BY and CC-BY-SA images must be credited in the game's credits/about screen. The manifest `author` and `sourceUrl` fields provide the necessary attribution data.

### Known Edge Cases

| Species | File used | Note |
|---------|-----------|------|
| Corythosaurus | Lambeosaurus BW.jpg | Close relative hadrosaur used as fallback — replace with dedicated image |
| Quetzalcoatlus | Arambourgiania.png | Related giant azhdarchid used as fallback — replace with dedicated image |
| Therizinosaurus | Multi-species scene | Therizinosaurus is the central dominant figure |
| Carcharodontosaurus | Multi-species scene | Carcharodontosaurus is prominently featured |
| Styracosaurus | Dinosaur park fauna | Multi-species scene featuring Styracosaurus |

---

## Adding New Image Sets

1. Create a subdirectory under `public/assets/` (e.g. `public/assets/marine-life/`)
2. Download images with CC0/CC-BY/CC-BY-SA or Public Domain licenses only
3. Convert to webp at max 512px wide using `cwebp -q 85`
4. Create `image-manifest.json` with the same format as the dinosaur manifest
5. Update this doc with the new library entry
6. Add `quizMode: 'image_question'` and `imageUrl` field to relevant `DeckFact` objects

---

## Download Scripts

| Script | Purpose |
|--------|---------|
| `scripts/download-dino-images.py` | Initial batch download from Wikimedia Commons |
| `scripts/download-dino-retry.py` | Retry failed downloads with known-good filenames |
| `scripts/download-dino-final.py` | Final retry pass with exponential backoff |
| `scripts/download-dino-missing5.py` | Targeted pass for specific missing species |

These scripts use the Wikimedia Commons API to search for CC-licensed illustrations, scoring candidates by preferred paleoartist (Nobu Tamura, Steveoc86, Emily Willoughby, Fred Wierum, etc.) and filtering out skeleton/fossil photos.

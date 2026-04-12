# `capsules/` — Final Steam Assets + Derivation Log

This folder holds every finished graphical asset destined for the Steamworks partner UI, plus the high-res source files we derive from. **Canonical Steam dimensions and the tick-off checklist live in `../README.md`; per-asset art direction lives in `../SPEC.md`. This file just explains what's on disk and where each byte came from.**

All status values are 🟡 *pending user review* unless explicitly marked ✅. Once you approve an asset visually, the README one level up flips it to ✅.

## Final deliverables (exact Steam dimensions)

| File | Dimensions | Target asset | Status | Derivation |
|---|---|---|---|---|
| `main_capsule_1232x706.png` | 1232 × 706 | Store: Main Capsule | 🟡 | Center crop `Edited_Header.jpeg` 3012×1310 → 2287×1310 → Lanczos downscale. Clean 0.54× downscale, no upscale softness. |
| `header_capsule_920x430.png` | 920 × 430 | Store: Header Capsule | 🟡 | Center crop from `../source/banners/banner_3584x1184.jpg` → 2534×1184 → Lanczos resize. |
| `small_capsule_462x174.png` | 462 × 174 | Store: Small Capsule | 🟡 | Center crop `Edited_Header.jpeg` → 3012×1134 → Lanczos downscale. Logo fills ~60% of the capsule width — below Valve's "nearly fills" guidance. May need a recompose if Valve pushes back. |
| `vertical_capsule_748x896.png` | 748 × 896 | Store: Vertical Capsule | 🟡 | Top-anchored crop `library_capsule_source.jpg` → 1696×2031 (from y=0, losing 497 px off the bottom — sacrifices the descending-stairs area to keep the title banner intact) → Lanczos downscale 0.44×. |
| `page_background_1438x810.jpg` | 1438 × 810 | Store: Page Background | 🟡 | Lanczos upscale 1.404× from the in-game title screen `/Users/damion/CODE/Recall_Rogue/public/assets/backgrounds/menu/landscape.webp` (1024×576, exact 16:9 aspect match). Title screen was chosen because it's already designed as ambient hero art, fades to dark at the edges (matches Steam's auto-fade), and carries the knowledge-symbol iconography that identifies the game without any text. JPEG quality 92. |
| `library_capsule_600x900.png` | 600 × 900 | Library: Library Capsule | 🟡 | Center crop `library_capsule_source.jpg` → 1685×2528 (crops 11 px off sides to hit true 2:3 aspect without stretching) → Lanczos downscale 0.36×. Clean. |
| `library_header_920x430.png` | 920 × 430 | Library: Library Header | 🟡 | Byte-identical copy of `header_capsule_920x430.png`. Valve explicitly allows the same file to serve both slots when dimensions match. |
| `library_hero_3840x1240.png` | 3840 × 1240 | Library: Library Hero | 🟡 | Center crop `library_hero_source.png` 2000×629 → 1948×629 (to hit exact 3.097:1 aspect) → Lanczos upscale 1.97×. **Softness warning:** the source was only 2000 wide, so the 2× upscale added detail loss. Regenerate the Gemini hero at higher resolution (≥3840 wide) if possible and reprocess. |
| `library_hero_3840x1240.jpg` | 3840 × 1240 | Library: Library Hero (JPEG alt) | 🟡 | JPEG export of the PNG above. Steam accepts either format; JPEG is smaller. |
| `library_logo_720x720.png` | 720 × 720 | Library: Library Logo | 🟡 | Alpha-extracted from `../source/logos/logo_1024.png` via ImageMagick floodfill (`-fuzz 12% -floodfill +0+0 "#000000"`) → Lanczos downscale. Satisfies Valve's "720 tall" rule. **Format note:** This is the full circular brand emblem (wreath + title). Most successful Steam games use a wide horizontal wordmark instead. Consider a replacement generated in Gemini that strips the wreath and formats the title as a wordmark — see discussion in `../README.md` → "Library Logo" section. |

## Source / master files (high-res, not uploaded directly)

| File | Dimensions | Purpose |
|---|---|---|
| `Edited_Header.jpeg` | 3012 × 1310 | High-res clean header art. User-edited from an earlier banner generation with the "Bramblegate Games" subtitle removed. **Canonical master** for Main Capsule, Header Capsule, and Small Capsule derivations. Keep this file — everything horizontal capsule-shaped derives from it. |
| `library_capsule_source.jpg` | 1696 × 2528 | Gemini Studio output from 2026-04-11 (~11:58 PM generation). Used as the master for Library Capsule and Vertical Capsule. Original filename was `Generated Image April 11, 2026 - 11_58PM.jpg`. |
| `library_hero_source.png` | 2000 × 629 | Gemini Studio output, text-free wide dungeon panorama with extended bookshelves/weapon-rack scene. Master for Library Hero. Quality bottleneck — the 2000-wide source is why the final 3840×1240 is soft. |
| `library_header_920x430.jpg` | 920 × 430 | User-edited 920×430 header variant. Kept as reference. |
| `Library Hero.jpg` | — | Unverified — dropped into the folder at 11:06 today. Not currently part of any derivation chain. Check before using. |
| `Library Logo.png` | — | Unverified — dropped into the folder at 23:23 on 2026-04-11. Not currently part of any derivation chain. Possibly a user wordmark attempt. Check before using. |

## Derivation chain — one glance

```
source/banners/banner_3584x1184.jpg  →  header_capsule_920x430.png  →  library_header_920x430.png
                                                                    ↘
                                                                      (same file)  →  library_header_920x430 slot

Edited_Header.jpeg (3012×1310, subtitle-free, high-res)
    ├──→ main_capsule_1232x706.png   (crop 2287×1310 → downscale)
    ├──→ small_capsule_462x174.png   (crop 3012×1134 → downscale)
    └──→ [candidate for header_capsule refresh — not yet done]

library_capsule_source.jpg (1696×2528 Gemini portrait)
    ├──→ library_capsule_600x900.png (center crop 1685×2528 → downscale)
    └──→ vertical_capsule_748x896.png (top-anchored crop 1696×2031 → downscale)

library_hero_source.png (2000×629 Gemini panorama)
    ├──→ library_hero_3840x1240.png (crop 1948×629 → Lanczos upscale 1.97× — SOFT)
    └──→ library_hero_3840x1240.jpg (JPEG export of the PNG)

../source/logos/logo_1024.png  →  library_logo_720x720.png (alpha floodfill + downscale)

/Users/damion/CODE/Recall_Rogue/public/assets/backgrounds/menu/landscape.webp (1024×576 in-game title screen)
    └──→ page_background_1438x810.jpg (Lanczos upscale 1.404×)
```

## Processing notes and caveats

- **Always use Lanczos** for resizes. `magick ... -filter Lanczos -resize WxH! ...`. The `!` forces exact dimensions without preserving aspect — we always crop to exact target aspect first so the `!` never causes stretching.
- **JPEG quality 92** for all JPEG exports. Lower risks visible banding in the dark stone gradients; higher just wastes bytes.
- **PNG color type 2** (RGB) for opaque outputs to keep file size reasonable. The Library Logo keeps full RGBA (alpha required).
- **Aspect crop first, resize second** — never force-resize mismatched aspects. Always center-crop (or asymmetric-crop for composition reasons, like the Vertical Capsule keeping the title at the top) to the target aspect at the source resolution, then Lanczos-resize to the final dimensions.
- **Valve rejects off-by-one pixel dimensions.** Every deliverable above has been `sips`-verified to the exact target. Don't trust file names — verify dimensions before upload.
- **The 860×380 safe area** on the Library Hero is respected: jellyfish, mummy, and central table are inside the box; golem (far left) and rogue (far right) are flanker characters allowed to extend outside per Valve's own guidance.
- **Small Capsule borderline:** Valve says the logo "should nearly fill" this slot. Ours fills ~60%. Uploading as-is; if Valve rejects or the user's gut says it's too small, recompose with a logo-dominant layout instead.
- **Library Hero softness:** 1.97× Lanczos upscale from a 2000-wide source to 3840 wide adds perceptible softness on a 4K monitor. Regenerating the Gemini source at ≥3840 wide would eliminate it. Second-best: generate left-half and right-half at full resolution and stitch.

## What's next

Back in `../README.md` → "What's Next" — still owed:

1. **Screenshots ×5+** — in-game capture session via `scripts/docker-visual-test.sh --warm` + `__rrScenario.load()`. Combat hero shot, chain combo moment, quiz panel, dungeon map, card reward. Bonus: boss encounter, shop/rest.
2. **Library Logo wordmark variant** — replace the square wreath-emblem with a proper horizontal wordmark.
3. **Library Hero higher-res regen** — optional quality bump.
4. **Visual review pass** — flip 🟡 to ✅ on each file the user approves.

Upload destinations once files are approved: **Steamworks partner UI → App Admin → Store Presence → Graphical Assets** (and **Library Assets** alongside). No CLI — manual drag-and-drop upload. Steam auto-categorizes by dimensions.

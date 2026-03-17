# Desktop Port — AR Index & Dependency Graph

> **Master Spec:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md`
>
> **Every AR in this folder MUST reference the master spec.** Workers implementing these ARs should read the master spec for full context before starting.

## Dependency Graph

```
PHASE 1 — FOUNDATION (no dependencies, do first):
  AR-71: Responsive Layout System
  AR-72: Platform Abstraction & Tauri Wrapper
  AR-83: Asset Specs & Placeholders

PHASE 2 — CORE EXPERIENCE:
  AR-73: Combat Layout (Landscape) ............. depends on AR-71
  AR-74: Input System Overhaul ................. depends on AR-71
  AR-75: Hub / Camp Adaptation ................. depends on AR-71
  AR-77: Map & Navigation Screens .............. depends on AR-71
  AR-78: Modals, Rewards, Shop (Landscape) ..... depends on AR-71
  AR-79: Boot Animation (Landscape) ............ depends on AR-71

PHASE 3 — DEPENDS ON PHASE 2:
  AR-76: Quiz Panel (Landscape) ................ depends on AR-73, AR-74
  AR-82: Accessibility & Colorblind ............ depends on AR-71

PHASE 4 — STEAM & MONETIZATION:
  AR-80: Steam Platform Integration ............ depends on AR-72
  AR-81: Monetization & Entitlements ........... depends on AR-72

PHASE 5 — QA:
  AR-84: Desktop QA Matrix .................... depends on all above
```

## Status

| AR | Title | Status |
|----|-------|--------|
| AR-71 | Responsive Layout System | Not started |
| AR-72 | Platform Abstraction & Tauri | Not started |
| AR-73 | Combat Layout (Landscape) | Not started |
| AR-74 | Input System Overhaul | Not started |
| AR-75 | Hub / Camp Adaptation | Not started |
| AR-76 | Quiz Panel (Landscape) | Not started |
| AR-77 | Map & Navigation Screens | Not started |
| AR-78 | Modals, Rewards, Shop | Not started |
| AR-79 | Boot Animation (Landscape) | Not started |
| AR-80 | Steam Platform Integration | Not started |
| AR-81 | Monetization & Entitlements | Not started |
| AR-82 | Accessibility & Colorblind | Not started |
| AR-83 | Asset Specs & Placeholders | Not started |
| AR-84 | Desktop QA Matrix | Not started |

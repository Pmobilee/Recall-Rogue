# AR-97: Landscape Combat — Full Spec Compliance

> **Master Spec:** `docs/RESEARCH/LANDSCAPE-COMBAT-LAYOUT.md` (the SINGLE SOURCE OF TRUTH)
> **Every sub-AR below MUST reference this spec.** Workers must read it before writing code.

## Gap Analysis: Current State vs Spec

### Three-Strip Layout (§ Overview)
| Spec | Current | Gap |
|------|---------|-----|
| Arena ~65% | Cards at y=810 (75% viewport) | Arena is 75% not 65% — need stats bar between |
| Stats bar ~8% (30-36px) | HP bar floats at y=766, AP at y=612 | NO dedicated stats bar strip — AP/HP/Block scattered |
| Card hand ~27% | Hand at 25vh | Close but needs to shrink slightly |

### Arena (§1)
| Spec | Current | Gap |
|------|---------|-----|
| Enemy CENTER of arena (default) | Enemy at x=85% right panel | **WRONG** — spec says center by default, slides right only during quiz |
| Enemy name centered above sprite | Name at top-right | Needs centering above sprite |
| Intent below name | Intent at top-right | Needs centering below name |
| HP bar below intent, ~40% arena width | HP bar at Phaser coords | Needs horizontal centering |
| Relics TOP-LEFT horizontal row | Relic tray 60px column | Needs horizontal row |
| Pause TOP-RIGHT | Pause button exists | OK |
| Chain counter RIGHT-side column | Not positioned | Needs right-side stacking |
| Combo counter RIGHT-side column | Not positioned | Needs right-side stacking |
| End Turn bottom-right of ARENA | End Turn at bottom-right | OK (approximately) |

### Quiz (§1 Quiz Active + §5)
| Spec | Current | Gap |
|------|---------|-----|
| Quiz LEFT side, 55-60% arena width | Quiz centered in left 70% | Close but needs left alignment |
| Enemy slides RIGHT during quiz | Enemy stays put | **MISSING** — enemy slide animation |
| Enemy slides BACK after quiz | N/A | **MISSING** |
| Answer layout: 3 answers = 3 columns | 2×2 grid | **WRONG** — 3 should be 3 columns |
| Cards dim to 30% during quiz | Dimming not working | Partially implemented |

### Stats Bar (§2)
| Spec | Current | Gap |
|------|---------|-----|
| Dedicated horizontal strip | No strip — elements scattered | **MISSING entirely** |
| AP circle + label LEFT | AP orb floating | Needs stats bar integration |
| Block badge left of HP | Block position unclear | Needs stats bar integration |
| HP bar CENTER, 50-60% width | HP bar 480px floating | Needs stats bar integration |

### Card Hand (§3)
| Spec | Current | Gap |
|------|---------|-----|
| Flat row, no arc, no overlap | Flex row with gaps | OK |
| Card 150-170px, gap 20-30px | Cards 176px, gap via flex | Close |
| Chain glow top-left 28-32px | Chain icon exists | Needs size check |
| AP cost top-right colored by chain | AP cost visible | OK |
| Chain pulse sync | Not verified | Needs verification |

### Card Selection (§4)
| Spec | Current | Gap |
|------|---------|-----|
| Card rises into arena | Card rises -70px | Needs to rise MORE into arena |
| Scale 1.1x | Not verified | Needs verification |
| Charge button ABOVE risen card | Charge button beside card | **WRONG** — should be above |
| NO Quick Play button | Quick Play button exists | **WRONG** — tap selected card = quick play |
| Non-selected dim to 35% | Not verified | Needs verification |

### Surge (§6)
| Spec | Current | Gap |
|------|---------|-----|
| Golden particle border effect | Not implemented for landscape viewport | **MISSING** |

## Sub-ARs

### AR-97A: Stats Bar Strip
Create dedicated stats bar between arena and card hand.

### AR-97B: Arena Layout — Enemy Centered + Right-Side Column
Reposition enemy to center, add chain/combo/EndTurn right column.

### AR-97C: Quiz Panel + Enemy Slide
Quiz slides from left, enemy slides right during quiz, slides back after.

### AR-97D: Card Selection — Rise + Charge Above + No QP Button
Card rises into arena, charge button above, tap-again = quick play.

### AR-97E: Stats Bar Details
AP circle left, block badge, HP bar center.

### AR-97F: Answer Layout Fix
3 answers = 3 columns, 2 = 2 wide, 4 = 2×2.

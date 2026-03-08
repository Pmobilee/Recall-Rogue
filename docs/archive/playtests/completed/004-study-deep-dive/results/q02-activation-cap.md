# Playtest Report: Activation Cap Ceiling

## Session Narrative
I set the save to an at-cap state (`used=5`, `cap=5`) with discovered cards available, then attempted activation from Study Station. The button was clearly disabled and labeled `Cap reached`, so the blocked-state UX was explicit and understandable.

I then boosted mastery states to increase cap and retried activation. Cap moved from 5 to 7 (matching formula behavior), the button became enabled (`Activate`), and learned fact count increased by one.

## Key Observations
- Cap communicated directly in UI (`5/5`, button text `Cap reached`).
- Formula behavior matched expected progression after mastery boost.
- Activation succeeded once headroom existed.

## Measurements
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Initial cap / used | 5 / 5 | At cap | PASS |
| Blocked activation feedback | `Cap reached` disabled button | Clear feedback | PASS |
| Cap after mastery boost | 7 | `5 + floor(mastered/5)` | PASS |
| Learned count after retry | 30 -> 31 | Should increase | PASS |

## Emotional Arc
- Start: neutral
- Mid: clear/controlled
- End: confident

## Issues Found
No blocking issues in this scenario.

## Verdict
**PASS**.

# Study Playthrough Report - Run 16

## Metadata
- Date: 2026-03-07 13:35 UTC
- Run type: study relearning focus
- Scenario: injected session biased toward relearning/lapsed cards
- Injected relearning cards: 6
- Result: PASS (completed, returned to base)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 0 |
| learning | 0 |
| review | 0 |
| relearning | 6 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 0 |
| due_relearning | 6 |
| due_total | 6 |

## Relearning Rating Requirements
- Again on relearning: 2
- Good on relearning: 5
- Requirement met (>=2 each): yes

## Relearning Transition + Lapse Verification
- Relearning -> review transitions after Good: 5
- Relearning answers with unchanged lapseCount: 7/7
- Lapse counter behavior observed: lapseCount remained stable on relearning answers (Again/Good), consistent with SM-2 implementation where lapse increments occur on review->Again lapses.

## Relearning Transition Trace
| # | Fact | Button | State | Lapse | Interval |
|---|---|---|---|---|---|
| 1 | geo-001 | again | relearning -> relearning | 2 -> 2 | 9 -> 9 |
| 2 | cult-002 | again | relearning -> relearning | 4 -> 4 | 10 -> 10 |
| 3 | lsci-001 | good | relearning -> review | 6 -> 6 | 16 -> 11 |
| 4 | hist-001 | good | relearning -> review | 3 -> 3 | 11 -> 8 |
| 5 | cult-001 | good | relearning -> review | 3 -> 3 | 12 -> 8 |
| 6 | geo-001 | good | relearning -> review | 2 -> 2 | 9 -> 6 |
| 7 | cult-002 | good | relearning -> review | 4 -> 4 | 10 -> 7 |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 0 |
| learning | 0 |
| review | 5 |
| relearning | 1 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 0 |
| due_relearning | 1 |
| due_total | 1 |

## Runtime Notes
- Console/page errors captured: 8
- error: WebSocket connection to 'ws://100.74.153.81:5173/?token=g46QBv_K25Kh' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
- error: [vite] failed to connect to websocket (Error: WebSocket closed without opened.). 
- pageerror: WebSocket closed without opened.
- error: Access to fetch at 'http://127.0.0.1:3001/api/facts/packs/all' from origin 'http://127.0.0.1:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- error: Failed to load resource: net::ERR_FAILED

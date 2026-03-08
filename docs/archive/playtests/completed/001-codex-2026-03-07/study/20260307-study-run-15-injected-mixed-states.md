# Playthrough Report - Study Session (Injected Mixed States)

## Metadata
- Date: 2026-03-07 13:30
- Run type: study session with injected mixed states
- Injected cards: 18 total (review 8, learning 4, relearning 3, new 3)
- Prompts processed: 18
- Completion reached: yes
- Result gate: PASS

## Transition Correctness
- Post-injection screen: studySession
- Entered study session: yes
- Completion screen reached: yes
- Returned to base after completion: yes

## Queue Order and Instability Check
- Initial queue length in studyFacts: 18
- Queue match during answered prompts: 18/18
- Review-priority ordering respected: yes
- New-card tail ordering respected: yes
- Instability observations: Learning/relearning/new tail order appears shuffle-derived and non-deterministic by design.

## Prompt Trace (first 18 max)
| # | Progress | Expected Fact ID | Queue Match | Question |
|---|---|---|---|---|
| 1 | 1 / 18 | cult-001 | yes | Why does the Mona Lisa have no eyebrows? |
| 2 | 2 / 18 | cult-002 | yes | What physical condition did Beethoven have when he composed his Ninth Symphony? |
| 3 | 3 / 18 | cult-003 | yes | What did ancient Greeks believe different musical modes could do to people? |
| 4 | 4 / 18 | geo-001 | yes | How many time zones does Russia span? |
| 5 | 5 / 18 | cult-004 | yes | What did Odin sacrifice to gain wisdom from the Well of Wisdom? |
| 6 | 6 / 18 | geo-002 | yes | Which famous human-made structure is often falsely claimed to be visible from space? |
| 7 | 7 / 18 | hist-001 | yes | Which came first — the founding of Oxford University or the Aztec Empire? |
| 8 | 8 / 18 | nsci-001 | yes | How does the temperature of a lightning bolt compare to the surface of the Sun? |
| 9 | 9 / 18 | lsci-002 | yes | What combination of properties makes honey resistant to spoilage? |
| 10 | 10 / 18 | hist-002 | yes | How long did the Anglo-Zanzibar War of 1896 last? |
| 11 | 11 / 18 | lsci-003 | yes | Approximately how far would all the DNA in a human body stretch if uncoiled? |
| 12 | 12 / 18 | geo-003 | yes | Approximately what percentage of all freshwater discharged into Earth's oceans comes from the Amazon River? |
| 13 | 13 / 18 | nsci-002 | yes | How does the number of possible chess games compare to the number of atoms in the observable universe? |
| 14 | 14 / 18 | lsci-001 | yes | What do tardigrades replace their cellular water with to survive extreme conditions? |
| 15 | 15 / 18 | cult-005 | yes | In Japanese New Year food tradition, why do shrimp symbolize longevity? |
| 16 | 16 / 18 | cult-006 | yes | What saved the Eiffel Tower from being demolished in 1909? |
| 17 | 17 / 18 | geo-004 | yes | Which mountain is tallest when measured from its oceanic base to its summit? |
| 18 | 18 / 18 | lsci-004 | yes | What are the underground fungal networks connecting forest trees sometimes called? |

## Console / Runtime Notes
- Console warnings: 4
- Console errors/page errors: 6
- Error samples:
  - WebSocket connection to 'ws://100.74.153.81:5173/?token=g46QBv_K25Kh' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
  - [vite] failed to connect to websocket (Error: WebSocket closed without opened.). 
  - [pageerror] Error: WebSocket closed without opened.
  - Failed to load resource: the server responded with a status of 500 (Internal Server Error)
  - Failed to load resource: the server responded with a status of 404 (Not Found)

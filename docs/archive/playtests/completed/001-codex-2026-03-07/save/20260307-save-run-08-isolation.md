# Save Run 08 - Isolation Check

- Date: 2026-03-07
- Run type: save isolation check
- Scenario: `rich_player` preset -> mutate state -> reload with `mid_game_3_rooms` preset -> reload without preset
- Playthrough count: exactly 1 run
- Evidence: `/tmp/playthrough-save-run-08-isolation.png`

## Actions Performed

1. Loaded `http://localhost:5173?skipOnboarding=true&devpreset=rich_player`.
2. Opened Dev Panel and mutated save via:
   - `+500 Dust`
   - `+3 O2 Tanks`
   - `10 Dives Done`
3. Reloaded with `http://localhost:5173?skipOnboarding=true&devpreset=mid_game_3_rooms`.
4. Reloaded with `http://localhost:5173?skipOnboarding=true` (no preset).

## Before/After Key Fields

| Field | Rich Before | Rich After Mutation | Mid Preset Reload | No Preset Reload |
| --- | ---: | ---: | ---: | ---: |
| `minerals.dust` | 99999 | 100499 | 2400 | 2400 |
| `minerals.shard` | 5000 | 5000 | 80 | 80 |
| `minerals.crystal` | 500 | 500 | 15 | 15 |
| `minerals.geode` | 100 | 100 | 0 | 0 |
| `minerals.essence` | 20 | 20 | 0 | 0 |
| `oxygen` | 3 | 6 | 3 | 3 |
| `knowledgePoints` | 10000 | 10000 | 240 | 240 |
| `stats.totalDivesCompleted` | 50 | 10 | 18 | 18 |
| `stats.currentStreak` | 20 | 20 | 7 | 7 |
| `stats.bestStreak` | 30 | 30 | 10 | 10 |
| `stats.totalFactsLearned` | 50 | 50 | 25 | 25 |
| `learnedFacts.length` | 30 | 30 | 25 | 25 |
| `unlockedRooms.length` | 6 | 6 | 4 | 4 |
| `premiumMaterials.star_dust` | 50 | 50 | null | null |

## Cross-State Contamination Indicators

- `richMutationLeakedDust`: false
- `richMutationLeakedOxygen`: false
- `richMutationLeakedDives`: false
- `richPremiumLeaked`: false
- `richGeodeLeaked`: false
- `richEssenceLeaked`: false

## Verification Notes

- Mid preset values matched expected `mid_game_3_rooms` targets for all checked core fields.
- Reload without preset matched mid preset values for all checked core fields.
- Save key remained `terra_save` throughout; no namespace/key drift observed.

## Verdict

**PASS**

<!--
TEMPORARY FILE — copy/paste the body below into the Steam resubmission notes
field, then delete this file. BuildIDs are filled in after the upload finishes.
-->

# Steam Resubmission — Recall Rogue (App 4547570)

Hi Steam Review Team,

Thanks for the detailed feedback on BuildID 22922005. We've addressed all three failure points and uploaded fresh builds for both macOS and Windows. The new build IDs are at the bottom of this note.

## 1. Online categories mismatch — fixed

We've taken multiplayer out of the v1.0 launch build. There is no online or networked play in this version. Concretely:

- The "Multiplayer" tent on the camp hub is still visible, but clicking it opens a small placeholder screen explaining that the multiplayer modes are in development for a post-launch update. From there the only action is a Back button that returns to the camp hub. There is no path from this screen into a lobby, race mode, or trivia round.
- We left the tent visible (rather than hiding it) so existing players who saw the tent in earlier builds, or anyone who recalls multiplayer being mentioned in earlier marketing, has a clear in-game answer about its status.
- "Online PvP" and "Cross-Platform Multiplayer" have been unchecked under Supported Features in the Basic Info tab.
- The store description, tags, and screenshots have been updated to remove all mentions of multiplayer.

Multiplayer is on our post-launch roadmap. When the servers are reliable for public play we'll resubmit with the appropriate categories re-enabled.

## 2. Political, historical, and mature content — easy to verify in-game

The Content Survey disclosure is accurate. The political, historical, and mature material lives in the curated knowledge decks (World War II, Ancient Greece, World Religions, etc.) that drive the gameplay. Rather than ship a save file, we've made it possible to verify all of it in about 30 seconds using the in-game Library.

### How the content connects to gameplay

Recall Rogue is a card-roguelite where every card the player plays in combat is backed by a real fact from these decks. To play a card, the player answers a quiz question drawn from one of those facts. The Library is the in-game read-only view of the same fact pool the combat cards pull from — so anything visible in the Library is content the player will actually encounter during a normal run.

### Reviewer steps (about 30 seconds)

1. Launch the game from Steam.
2. Click into a profile, or create a new one. There's no long intro to sit through; you'll land on the camp hub within a few seconds.
3. On the camp hub, click the building labeled **Library** (the one with the bookshelf icon).
4. Type any of the words in the table below into the search bar at the top of the Library screen. Matching facts appear instantly.

### Verified search terms

Each of these terms returns real, shipped content. The Library search is a free-text substring match across the fact text, quiz prompts, and answers, so any related word your team wants to spot-check should return matches the same way.

| Search term | What appears |
|---|---|
| `slavery` | World Religions deck — Moses leading the Israelites out of slavery in Egypt |
| `dictator` | Ancient Greece deck — entries on Greek and Roman political structure |
| `propaganda` | WWII deck — Leni Riefenstahl's *Triumph of the Will*, the 1934 Nuremberg rally |
| `holocaust` | WWII deck — multiple entries, including its role in the founding of Israel |
| `atomic bomb` | WWII deck — Truman, the Potsdam Conference, the Trinity test |
| `execution` | Ancient Greece — Socrates' trial; WWII — the Nuremberg Trials |
| `nazi` | WWII deck — leadership, trials, regime structure |
| `persecution` | World Religions — Roman persecution of early Christians under Nero |
| `suicide` | WWII deck — Goebbels and his family, May 1945 |
| `religion` | Returns hits across multiple decks |
| `death` | Returns hundreds of factual entries across the corpus |

If you'd like to spot-check a category we haven't listed, the same search will surface it. We're happy to walk you through any specific keyword if it would speed up the verification.

## 3. Content Survey categories — updated

We've gone through the Content Survey and ticked every category that applies to the shipped build:

- **Frequent Violence** — historical-warfare facts in the WWII and ancient-history decks describe battles, executions, and casualty counts in factual form.
- **General Mature Content** — political, historical, and religious material described factually.
- **References to alcohol, tobacco, or drugs** — chemistry and pharmacology facts describe substances and their effects.

If your team observed a category we still haven't checked, please let us know which one. The Library search above is the fastest way to confirm anything specific, and we can update the survey the same day.

---

**Build IDs in this submission**

- macOS (depot 4547574): **BuildID `22963372`**
- Windows (depot 4547572): **BuildID `22963394`**

Both builds are content-identical at the gameplay level. The platform-specific binaries differ but ship the same disabled-multiplayer state and the same Library content described above.

Thanks again for the careful review. Reply to this ticket if anything else needs clarifying.

— The Recall Rogue team

# Playtest Feedback — Landscape Session 2026-03-22

> **Source:** Live playtest by project lead in landscape (Steam PC target).
> **Scope:** 46 issues covering combat HUD, enemy display, card UX, quiz panel, turn flow, fact system, map, rewards, mystery rooms, animations, status effects, and relics.
> **Rule:** Every AR created from this document MUST reference it and include the user's exact words for each issue it addresses.

---

## Raw Feedback (Verbatim, Numbered)

1. The enemy intention, the gold button at the top which pops out when you click on it, should at all times be stuck to the top-left of the enemy, of course not moving with the enemy as this would be annoying.

2. When clicking the enemy we see a popup with another intention explanation, remove this.

3. When clicking the enemy intention, show the name of the attack in a darker version of the intent color like Screech: Buff self 1 strength for 2 turns.

4. Title of the enemy must be bigger and have a stronger border, including the turn 1 below it, also relatively bigger.

5. The HP bar looks ugly, I dont mind the text, but we need a black border around it and an rpg like 3d effect.

6. The end turn button has a 0 in it for some reason, dunno if this is the chain counter, but if not, we dont need this.

7. We need a nice and clear Chain: to the right of our hand, in the middle of the card row, IF we have any chain, and must have nice black border and must be in the color of that chain!

8. Make the cards just 15% larger.

9. The end turn button, put it stuck to the bottom left.

10. The draw pile and discard pile can be twice as big.

11. Underneath the draw pile as I can see it says Deck: 100, dunno what this is but remove it.

12. The HP bar is enveloped in this horrible black bar, remove the black bar, center our hp bar. Make our hp green or red or orange based on hp percentage left, and make it blue only if we have ANY block!

13. The HP bar must be centered, and be BELOW the cards, meaning we must move up the cards.

14. The AP sphere needs to be twice as big, and moved to about 15% of the screen to the right.

15. We must no longer say BLOCK: 0, if there IS any block, just show the dimmed block icon we have, larger, with a number in it indicating block, stuck to the left of our hp bar, not moving the hp bar.

16. The text of the number of cards in draw and discard also needs to match increase in size.

17. When selecting a card, move it up less, to about half the length up of the card.

18. When selected, the cards have this sort of transparent container around them, make it invisible.

19. When selecting a card it says tap again = quick play, remove this, we have a tutorial.

20. When hovering over a card it says in the middle of the screen underneath the cards stuff like block 1 ap crimson. Have this instead show slightly above the end turn button, stuck to the left of the screen and slightly above the end turn button.

21. When we select a card, the charge button has the + 1 ap in a slight black indicator next to it, I like this one, but put it instead centered slightly above the E of the chargE, that looks better. Make sure that when charging is free, it says + 0 AP, 0 in green. Or when it costs more than 1, in red.

22. Center the charge button exactly centered slightly above the selected card instead of in the middle!

23. When answering a card, see the image I sent, it's very difficult to read! We must make better use of our space! Bigger automatically adjusting font, easy to read etc.

24. When charging and we see the question, the amount of the effect is not correct, it doesn't take into account the charge, for example it shows 6 block instead of 9.

25. Turn should end automatically if there's no AP left and there's no quiz popup.

26. The enemy should wait a second after our turn is ended to perform its intent, right now it happens immediately. Also, I want to see damage indicators nicely on the screen like 8 in red, or 10 in blue when it blocks etc. We also need visual indicators for when it buffs itself, like the sprite flashing red for strength buff etc. We need to dive deep into all the possible attacks enemies can do, and ultra creatively implement any and all of these for the enemies! Big AR for that one.

27. I want the enemy upgrades like strength, etc or dots like bleed poison, basically any and all effects, to show up underneath the health bar of the enemy, not on top.

28. For our own effects applied, they can be above our own hp bar, meaning the cards will go even a bit higher, not too much though, our icons can be a little bit smaller, or not the icons, but the boxes/containers around our icons.

29. From now on, we don't randomly select facts from our pool each time, instead, at the end of each encounter, randomly assign all facts to another card in our deck, no more randomly getting new ones from the pool.

30. When a card has any upgrade and its received a fact we haven't seen before yet, we don't downgrade or go cursed, but only if that card's fact has never been tried before.

31. Curses must travel to following encounters by FACT, not by card. So if a card gets a new fact that was cursed in the previous enemy encounter, it transfers to this other card.

32. When you wait too long to select a reward it automatically seems to skip the reward and go to the map, this is bad!!

33. If you get a card right charged, your next charge OF THAT COLOR is free, NOT EVERY CHARGE!!!

34. I hate the map! I from now on don't want to see the entire map of the floor, I want to see the NEXT options we have each time, even the first time we select, and instead of a blue line I want it to be like a path mark with - - - - -> in off white with black borders leading to the circles. These paths must spring from the last selected node, so all we can see after a while is scroll down and see all our choices in the past, along with all the ones we haven't taken, so we can sort of see how through time, centered in the middle of the screen, our choices got us where we are. No more planning beforehand. This means we disable our map animation at the start, and our entire map view!

35. Even though the map is seeded and the same for that seed every time, we must improve our generation and make sure every path sees an elite, a shop, a rest etc more evenly spread. BUT NOT FORCED, people must be able to take paths in their own way and try to avoid, though not always able to avoid. Basically its already pretty good now but not very balanced.

36. Also, on desktop, floors can be 12 length so change it!

37. Card descriptions are sometimes coming out of the description frame, and it's not centered well vertically, auto scale it with a tiny bit of padding!

38. Right now, for some reason, I sometimes see that a card like my strike has gone purple, and has a green sharp container around it, or rather its invisible with a single pixel dark green outline. Is this a cursed card? If so, make it ghostlike, like ghostly orbs coming from it! Also, when cursed, should it do less damage, it says deal 8 damage so I don't think it's cursed. Also, the color change is not necessary, make it slightly faded instead. If this is not a curse indication, figure out what it is.

39. The sword animation was great in portrait but really weird in landscape, it's also gigantic so scale it to what it is in portrait mode, and move it down and keep it relative to the enemy at all time no matter where it moves.

40. The reward screen with the stone slab and cloth on it needs to be redone by me, just create an AR that requires me to do that so I can remember. Also, those treasure rooms should NOT give cards, instead only give the relics as pickup option, NO HEALTH NO GOLD. Right now a treasure room seems to give two back to back reward screens. One with relics then one with cards, ONLY do the relics.

41. EVERY SINGLE SCREEN must have a walk in animation. But mystery, reward, victory, descent rooms etc, non-combat rooms, must NOT have an exit animation.

42. We have some multi-enemy relics, but never any multiple enemies. If there are less than 5, just change what they do based on their lore and something basic but that we haven't seen before, like more cards is more strength, start with block per turn, boosts damage by 50% with hp under 25% etc.

43. The cards in the reward room, the floating icons and their popup, don't have the latest improvements to how cards are rendered like we mentioned in our skill, and how we do it during combat.

44. I'm fairly certain ALL our mystery rooms are either dead or incomplete. For example I clicked 15 hp for a possible card, but lost no hp and got no card. Also mystery rooms have no background, so create an AR asking me to generate them and add a new tab to our artstudio site with ALL possible mystery rooms, their lore, and exactly the style of prompting we used for all the other backgrounds for enemies, but WITHOUT the doorway at the end.

45. Elites must have a different color healthbar, and so must the bosses, although their healthbar must turn blue as always if they have block.

46. Also, just like our own healthbar, we need to have the faded block icon with a block number inside... you know, fuck it, NO MORE BLOCK ICONS, just show (6) in front of our first number in the healthbar, or the healthbar of the enemy, if they have block.

---

## AR Chapter Groupings

### Chapter A: Combat HUD Layout Overhaul
**Issues:** 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 46
**AR:** AR-218-COMBAT-HUD-LAYOUT-OVERHAUL
**Scope:** End turn button position & "0" removal, chain display relocation, card sizing, draw/discard pile sizing, deck label removal, player HP bar redesign (color by %, no black bar, centered below cards), AP sphere sizing & position, block display (inline HP text), card info tooltip relocation, draw/discard count text sizing.

### Chapter B: Enemy Display & Intent System
**Issues:** 1, 2, 3, 4, 5, 27, 45
**AR:** AR-219-ENEMY-DISPLAY-INTENT-SYSTEM
**Scope:** Intent button position (top-left of enemy), remove enemy click popup, intent click shows attack name in darker intent color, enemy title bigger with stronger border, turn counter bigger, enemy HP bar RPG 3D effect with black border, status effects UNDER enemy HP bar, elite/boss colored HP bars.

### Chapter C: Card Selection & Charge UX
**Issues:** 17, 18, 19, 21, 22, 24, 37, 38
**AR:** AR-220-CARD-SELECTION-CHARGE-UX
**Scope:** Selected card rise distance (half card), remove transparent container, remove "tap again = quick play", charge button AP indicator repositioned above "E", charge cost coloring (green/red), charge button centered above selected card, charge preview shows correct charged values, card description overflow fix, cursed card visual investigation & ghostly orb effect.

### Chapter D: Quiz Panel Redesign
**Issues:** 23 (readability), 23b (auto-resume after answer)
**AR:** AR-221-QUIZ-PANEL-REDESIGN
**Scope:** Better space usage, bigger auto-scaling font, easy to read. Auto-resume after seeing answer with timing based on answer length. Accessibility setting for wait factor and toggle for auto-resume.

### Chapter E: Turn Flow & Combat Feedback
**Issues:** 25, 26
**AR:** AR-222-TURN-FLOW-COMBAT-FEEDBACK
**Scope:** Auto-end turn when no AP and no quiz popup. Enemy action delay (1s after turn end). Damage indicators (red numbers for damage, blue for block). Visual effects for ALL enemy actions — sprite flashing for buffs, creative indicators for every possible enemy action type. Deep dive into all enemy action types with ultra-creative visual implementations.

### Chapter F: Status Effects Display
**Issues:** 27, 28
**AR:** (Merged into AR-219 for enemy effects, AR-218 for player effects)
**Note:** Enemy effects under enemy HP bar (AR-219). Player effects above player HP bar, cards go slightly higher, smaller containers around icons (AR-218).

### Chapter G: Fact Assignment & Curse Mechanics
**Issues:** 29, 30, 31, 33
**AR:** AR-223-FACT-ASSIGNMENT-CURSE-MECHANICS
**Scope:** Facts shuffle between cards at end of encounter (no new pool draws). No downgrade/curse for never-before-seen facts. Curses travel by FACT not by card across encounters. Chain momentum free charge applies only to THAT COLOR chain, not all charges.

### Chapter H: Map Redesign — Progressive Path View
**Issues:** 34, 35, 36
**AR:** AR-224-MAP-REDESIGN-PROGRESSIVE-PATH
**Scope:** Remove full map view, show only NEXT choices. Path marks with dashed arrows in off-white with black borders. Scrollable history of past choices + untaken options. No map animation at start. Improve generation for even distribution of elites/shops/rest (not forced). Desktop floors = 12 length.

### Chapter I: Reward & Treasure Room Fixes
**Issues:** 32, 40, 42, 43
**AR:** AR-225-REWARD-TREASURE-ROOM-FIXES
**Scope:** Fix reward auto-skip timeout. Treasure rooms = relics ONLY (no cards, no health, no gold, no double reward screen). Stone slab redesign (user action required). Multi-enemy relics converted to single-enemy effects (<5 relics). Reward room cards use latest rendering improvements.

### Chapter J: Mystery Room Overhaul
**Issues:** 44
**AR:** AR-226-MYSTERY-ROOM-OVERHAUL
**Scope:** Fix all dead/incomplete mystery room events. Generate mystery room backgrounds (user art generation task — add to artstudio site with lore + prompts, same style as enemy backgrounds but WITHOUT doorway).

### Chapter K: Animation & Screen Transition Polish
**Issues:** 39, 41
**AR:** AR-227-ANIMATION-SCREEN-TRANSITIONS
**Scope:** Fix sword animation for landscape (scale to portrait size, relative to enemy). Every screen gets walk-in animation. Non-combat rooms (mystery, reward, victory, descent) get NO exit animation.

---

## Implementation Order (Suggested)

1. **AR-218** — Combat HUD Layout (foundation for everything else)
2. **AR-219** — Enemy Display (depends on HUD layout)
3. **AR-220** — Card Selection & Charge UX
4. **AR-221** — Quiz Panel Redesign
5. **AR-222** — Turn Flow & Combat Feedback (big creative AR)
6. **AR-223** — Fact Assignment & Curse Mechanics (logic changes)
7. **AR-224** — Map Redesign (major UI overhaul)
8. **AR-225** — Reward & Treasure Room Fixes
9. **AR-226** — Mystery Room Overhaul
10. **AR-227** — Animation & Screen Transitions

# Playtest Feedback — Landscape Session 2 (2026-03-23)

> **Source:** Live playtest by project lead in landscape (Steam PC target), second session after AR-218 through AR-229 implementation.
> **Scope:** ~40 issues covering combat HUD positioning, card selection, charge mechanics, quiz panel, enemy display, reward/shop/mystery rooms, map pathing, damage numbers, question variants, and game flow.

---

## Raw Feedback (Verbatim, Numbered)

### Combat HUD & Positioning

1. The AP button is too low. It needs to be at approximately the same height as the player HP bar — on the same horizontal axis. Not above it, but at the same height.

2. When selecting a card, there is still a semi-transparent container (or drop shadow) visible around it. Make this completely transparent — remove any shadow/glow/background on the selected card container.

3. When selecting a card, it still goes all the way up. It needs to go up only about half the height of the card.

4. The charge button is still in the center of the screen. It needs to be exactly above the selected card, both horizontally and vertically centered above it.

5. I have 1 AP left. The charge on the card says "+0 AP". Yet clicking charge does nothing, even though it charged the previous card successfully.

### Quiz Panel & Enemy During Quiz

6. When in a quiz, the enemy moves to the right correctly, but it clips out of the container. The enemy should be visible, dynamically adjusted in size to fit neatly centered in whatever space remains to the right of the quiz popup.

7. The enemy HP bar and other elements also clip out during quiz. All enemy elements need to be scaled down dynamically to fit the available space.

8. Our own HP bar can be about 5% of the screen lower. Same for the AP sphere — lower by about 5%.

### Enemy Intent Display

9. The enemy intent (when clicked) only shows the name of the attack, not the description. It might be behind the HP bar. The intent tooltip must show BELOW the original intent button, in a nice container, and must NOT be underneath the enemy HP bar.

### Card Selection & Quick Play

10. When a card is selected (moved up), clicking on that same card again must do a NORMAL attack (quick play) — without quiz, without damage bonus, without chain. Currently it seems to trigger a charge attack instead.

### Reward Screen Cards

11. In the reward screen, the floating card icons still don't have the correct layout — the artwork is too low and overlaps on top of the card frame. We need to render reward cards EXACTLY the same way as combat cards.

12. This artwork overlap issue also exists during card selection popup (when card pops up to middle of screen).

### Card Intent Display

13. Remove the "next intent" display from ALL cards. Intent is selected dynamically based on player performance and seed — it's identical for identical runs. Since intents aren't shown on cards (not implemented), remove the field. If any cards break in their upgrade path because of this removal, fix the path.

### Reward Timeout

14. Remove the safety timeout forcing reward completion. Player should be able to take as long as they want.

### Mystery Room Display

15. Mystery room "Lost and Found" — has an icon and says "a basket of lost things" but I cannot see what it actually does. The text or icon clips out. The description/effects must be fully visible.

### Map / Path System

16. The path and node options need to scale beautifully to the size of the screen.

17. My first options were three attack rooms, then I chose a mystery room shown above. I expected to see previous options below on the bottom, with arrows going upward toward the next option. Currently "Choose your path" shows one attack at the very bottom with the arrow going DOWN toward it. The arrows should go upward. Do visual inspection.

18. Change the pathing system so there are ALWAYS at least two options for any room toward the next room. Sometimes three. Never just one.

### Combat Mechanics

19. I had 80 HP, enemy said it would do 25 damage, but I ended up at 60 HP (lost 20, not 25). Check why damage doesn't match the stated intent value.

20. The background (at Thesis Construct) does not fully stretch the height of the screen. Backgrounds must ALWAYS stretch completely to fill the screen.

### Damage Numbers

21. When the enemy attacks, I did NOT see any damage number pop up. There should be red font with black border, RPG style.

22. Damage numbers should fall toward the side and downward in an arc — like how mobile games show damage numbers. Not just floating up. They need to feel impactful, like the number physically gets knocked away.

23. Doing damage TO an enemy does show the damage number, but it should appear to the SIDE of the enemy, not on the enemy itself — otherwise we can't read it.

### Question Variants

24. I'm doing Japanese. Three times in a row for the same fact ("what does bento mean?") I get the same question format. There should be more variation. Maybe force a different variant every time the same fact is asked. (Note: AR-229 found this is tier-gated. But user wants MORE variation even at Tier 1.)

### Card Mechanics

25. Question: "Immunity — absorb next damage up to 8" — why is this different from Block 8? Serious question. (Design question, not a bug.)

26. Question: Relic says "spend 4 HP in a turn, next card blah blah" — is it even possible to spend 4 HP in a turn in our game? (Design question about relic feasibility.)

### Mystery Room Combat

27. "Ambush" mystery room — game gets stuck on "waiting for encounter". Mystery room combat transition doesn't work.

### Shop Issues

28. Card removal in shop says "need more than 5 cards" but we start with ~12 cards. Something is wrong with the card removal check.

29. Memory Nexus, Brass Knuckles etc. clearly state what they do, but Overclock, Emergency Focus etc. — I cannot see exactly what they mean. Their descriptions are cut off or unclear.

30. There's a black border on the right side of the shop — might be trying to show relics. Does not look great. Inspect the shop layout.

31. There should be a downside to haggling: correct answer = 30% off, wrong answer = 30% UP. Haggling does NOT mean buying immediately — just show the corrected price.

### Study / Rest Site

32. When studying at a rest site, the questions are completely random facts from the database, NOT based on the facts we have in our deck. Study questions must come from our deck's facts.

33. Once study is complete, show all upgraded cards with their upgrade icons, hovering below the "study complete" box, so players can see what they improved.

### Card Effect Issues

34. Focus ("next card costs 1 less AP") doesn't seem to get any bonus from charging. Check if Focus interacts correctly with charge.

35. Add a new column to our inspection registry database for "charge inspection" status per card, so we can track which cards have been verified to work correctly with charging.

### Chain Momentum (Still Broken)

36. When I charge correctly, the next charge OUTSIDE of surge is still showing +0 AP for ALL cards. It should only be free for cards of the SAME chain color. Other colors should still cost +1 AP. (AR-223 sub-step 4 may not have applied correctly.)

37. Getting a question WRONG still shows +0 AP on the next charge. Actually wait — it's not free, the +0 AP indicator above the charge button just seems to be broken/always showing +0.

### Enemy Turn Timing

38. When the enemy attacks, remove HP only when the animation plays, not immediately when the enemy turn starts. The HP should decrease in sync with the attack animation hitting.

### Post-Boss Issues

39. After defeating the boss, there was a mystery event that said something but clicking it did nothing — just went to the descent screen. Post-boss mystery events seem broken.

### Descent Screen

40. "Delve deeper" screen says "time is shorter" — remove the "time is shorter" part.

41. The descent screen says I defeated the Magma Worm but I defeated a completely different boss. Fix the text to reference the actual boss defeated.

### Retreat Screen

42. "Retreat — keep all 187 dust" but the dust indicator on campsite shows no changes, still zero. Dust collection on retreat doesn't seem to persist.

---

## AR Chapter Groupings (Preliminary)

### AR-231: Combat HUD Position Fixes (Session 2)
**Issues:** 1, 2, 3, 4, 5, 8
**Scope:** AP sphere height alignment, card selection shadow removal, card rise distance fix (still too high), charge button centering (still not working), charge button +0 AP display bug, HP bar/AP 5% lower

### AR-232: Quiz Panel & Enemy Scaling During Quiz
**Issues:** 6, 7
**Scope:** Enemy sprite scales down during quiz, enemy elements don't clip, dynamic fitting

### AR-233: Card Rendering Parity & Intent Removal
**Issues:** 11, 12, 13
**Scope:** Reward card art overlap fix, selection popup art fix, remove card intent field

### AR-234: Damage Number Improvements
**Issues:** 21, 22, 23
**Scope:** Enemy attack damage numbers not showing, arc animation, position to side of enemy

### AR-235: Map Path System Fixes
**Issues:** 16, 17, 18
**Scope:** Scaling, arrow direction, minimum 2 options per node

### AR-236: Shop & Mystery Room Fixes
**Issues:** 15, 27, 28, 29, 30, 31
**Scope:** Mystery room text clipping, ambush encounter stuck, card removal check, shop descriptions, shop layout, haggling downside

### AR-237: Study System & Rest Site Fixes
**Issues:** 32, 33
**Scope:** Study questions from deck facts, show upgraded cards after study

### AR-238: Chain Momentum Display Fix
**Issues:** 5, 36, 37
**Scope:** +0 AP indicator always showing, chain momentum not color-specific in UI

### AR-239: Enemy Turn Timing & Damage Sync
**Issues:** 19, 38
**Scope:** HP removes before animation, damage mismatch (25 stated, 20 actual)

### AR-240: Post-Boss & Descent Fixes
**Issues:** 39, 40, 41, 42
**Scope:** Post-boss mystery broken, descent text wrong boss name, remove "time shorter", dust not persisting

### AR-241: Background Stretching
**Issues:** 20
**Scope:** Backgrounds must always fill screen height

### Design Questions (Not Bugs)
**Issues:** 9, 10, 24, 25, 26, 34, 35
**Scope:** Intent tooltip position, quick play on selected card, question variant frequency, immunity vs block, relic feasibility, focus+charge interaction, inspection column

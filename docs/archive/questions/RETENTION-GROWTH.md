# Retention & Growth -- 50 Questions for Roadmap Expansion

> These questions explore monetization, player retention, session design,
> growth strategy, and market positioning for Terra Gacha. Answer them to
> build a sustainable game that teaches addictively without compromising
> educational integrity. Each question references specific existing systems
> and includes professional advice grounded in mobile gaming best practices.

---

## A. Session Design & Daily Loops (Questions 1-10)

### Q1: What is your target session length, and should it differ between "dive sessions" and "study sessions"?
**Context**: The current dive loop involves entering a mine, mining blocks through up to 20 layers, answering quizzes, and returning to the dome. Study sessions are 5 or 10 facts. There is no explicit session timer or natural stopping point beyond oxygen depletion.
**My Advice**: Design for two distinct session profiles: a 5-7 minute "quick dive" (1-3 layers, review a few facts, check farm) and a 15-25 minute "deep expedition" (push 10+ layers, extended study session). Most mobile games that retain well have a quick session that fits into a commute or lunch break and a deeper session for evenings. Track median session length in analytics from day one -- if it drifts above 25 minutes, your casual players may feel the game demands too much.

### Q2: What are the natural stopping points within a dive, and how do you prevent mid-dive abandonment?
**Context**: Dives have 20 layers with descent shafts. Oxygen is the primary session-limiting resource. The Point of No Return mechanic was removed per DD-V2-022. Players can surface from any layer.
**My Advice**: Each layer transition (the falling animation + biome title card from Phase 8.5) is your natural stopping point. Consider a "safe return" summary screen after every 3-5 layers showing loot collected, facts found, and a "Continue Diving?" prompt. This mirrors the "floor clear" pattern in Slay the Spire. If a player force-quits mid-layer, auto-save their exact mine state so they can resume -- lost progress is the number one cause of permanent churn in roguelites.

### Q3: How should the "one more dive" hook work without becoming coercive?
**Context**: The game has near-miss mechanics ("Almost Legendary! Epic instead!" from Phase 17.1), progress bars toward next milestones, and GAIA engagement hooks. The design philosophy states learning should never feel forced.
**My Advice**: The healthiest "one more dive" hooks are informational, not manipulative. After surfacing, show: "3 more facts to unlock Trilobite revival", "Your Biology branch is at 48%", or "Unfinished Data Disc: Solar System (7/12 facts)." These appeal to completionist motivation without creating artificial urgency. Avoid Duolingo's guilt-tripping streak loss model -- your GAIA personality is better positioned to say something encouraging like "Rest well, miner. Your tree will be here when you get back."

### Q4: Should oxygen regenerate on a real-world timer, and if so, what is the refill rate?
**Context**: The design doc states "Oxygen refills over time -- play for free with patience" and "top players who ace quizzes can earn enough bonus oxygen to play indefinitely." The current implementation gives starting oxygen tanks but has no real-time regeneration system.
**My Advice**: This is the single most important monetization decision in the game. I recommend 1 oxygen tank every 90-120 minutes, with a maximum bank of 3 tanks. A quick dive costs 1 tank, a medium dive costs 2, a deep expedition costs 3. This gives casual players 3-4 sessions per day for free. Make the quiz mastery path genuinely viable -- if 10% of engaged players can play for free through skill alone, word of mouth about "the education game that rewards you for learning" becomes your best marketing asset.

### Q5: How should the morning and evening Review Rituals integrate with the daily login flow?
**Context**: Review Rituals exist (7-11 AM / 7-11 PM windows, +25 dust bonus). The current implementation has a gold pulsing banner in BaseView with auto-refresh. There is also a daily deal system (3 deals per day seeded by date) and streak tracking.
**My Advice**: Consolidate all daily activities into a single "Daily Briefing" screen that GAIA presents on first login: (1) streak status, (2) review ritual with bonus, (3) today's deals, (4) farm harvest, (5) one-tap dive button. This reduces friction from hunting across dome rooms. Make the review ritual completable in under 2 minutes (5-8 facts) so it never feels like homework. The bonus should be meaningful enough to do (25 dust is roughly 1/4 of a cheap craft), but not so large that skipping it feels punishing.

### Q6: Should there be weekly challenges alongside daily rituals, and what format serves both miners and learners?
**Context**: Phase 17.4 mentions "weekly challenges (mine X blocks, learn X facts, reach layer X)" but no design details exist. The game already has daily deals, streaks, and review rituals.
**My Advice**: Absolutely yes. Weekly challenges are the single most effective mid-term retention mechanic in mobile gaming. Design 3 concurrent weekly challenges: one mining-focused (reach layer 12), one learning-focused (master 5 new facts), and one collecting-focused (find 3 fossils). Completing all 3 gives a "Weekly Expedition" bonus chest with guaranteed rare+ artifact. This creates a 7-day engagement arc that daily rituals alone cannot sustain. Reset on Monday to give weekend players a fresh start.

### Q7: How do you handle players who open the app but do not want to dive -- what is their "zero-effort engagement" path?
**Context**: The dome has extensive systems: farm collection, study sessions, crafting, fossil gallery, cosmetics shop, daily deals, knowledge tree browsing, GAIA interactions. But the primary gameplay is diving.
**My Advice**: Design a "cozy session" flow for days when players just want to tend their dome. Farm collection, a quick 5-card study session, browsing the knowledge tree, and chatting with GAIA should feel like a complete, satisfying 3-minute visit. Track what percentage of sessions include zero dives -- if it is above 40%, your dome content is strong but your dive motivation needs work. If it is below 10%, your dome needs more pull.

### Q8: Should facts have a "due date pressure" indicator, or should reviews feel purely optional?
**Context**: The SM-2 spaced repetition algorithm schedules reviews at optimal intervals. Leaves on the Knowledge Tree wilt when facts are overdue. GAIA says "Your Knowledge Tree is wilting..." as a re-engagement hook.
**My Advice**: Show a gentle count ("12 facts ready for review") but never show a countdown timer or red urgency indicators. The wilting leaves are a perfect subtle nudge. Research on spaced repetition apps shows that guilt-driven review produces worse long-term retention than curiosity-driven review. GAIA should frame overdue facts as exciting opportunities ("I found some connections between your overdue facts -- want to see?") rather than obligations.

### Q9: How long should the first session last from app install to end of tutorial, and what is the critical hook moment?
**Context**: The tutorial is designed for 5 minutes total (DD-V2-040): crash cutscene, GAIA introduction, interest assessment, tutorial mine covering biomes/fossil/artifact/quiz/materializer. The goal statement at the end is "gather 50 facts underground and learn 20 to unlock the next hub."
**My Advice**: 5 minutes is the right target, but measure ruthlessly. The industry benchmark for tutorial completion in mobile games is 60-70%. If your tutorial completion rate is below 50%, it is too long or too confusing. The critical "hook moment" must happen within 90 seconds -- this is the first artifact reveal with GAIA's snarky comment and the gacha animation. If players have not felt a moment of delight by second 90, most will never come back. Consider splitting the tutorial: 90 seconds to the first hook, then progressive unlock of remaining systems over dives 2-4 rather than front-loading everything.

### Q10: Should there be a daily login reward calendar, or do the existing review rituals and daily deals serve that purpose?
**Context**: Currently on daily login: review ritual (+25 dust), daily deals (3 items), streak tracking, farm collection. No explicit "login reward calendar" exists.
**My Advice**: Add a 7-day rotating login calendar with escalating rewards: Day 1 = 50 dust, Day 2 = 1 bomb, Day 3 = 100 dust, Day 4 = streak freeze, Day 5 = shard, Day 6 = random Data Disc, Day 7 = guaranteed uncommon+ artifact. This is separate from review rituals. The key is that Day 7 must be desirable enough that players feel genuine pull toward completing the week. Reset to Day 1 after Day 7, not on missed days -- punishing breaks loses players; rewarding consistency keeps them.

---

## B. Monetization & Economy (Questions 11-20)

### Q11: What is the primary monetization model -- subscription, cosmetics, IAP, or hybrid?
**Context**: The design doc outlines: subscription for unlimited oxygen, premium materializer for special cosmetics, and "free to learn" philosophy. No ads are mentioned. Phase 21 lists "Terra Pass" subscription + IAP + premium currency.
**My Advice**: Go hybrid: a $4.99/month "Terra Pass" subscription (unlimited oxygen + 1 exclusive cosmetic per month + ad-free if you add ads later) plus a la carte cosmetic purchases ($0.99-$4.99 each). Avoid premium currency entirely -- direct pricing builds more trust with educational game audiences. Parents buying this for their kids want transparent pricing, not obfuscated gem systems. The "skill players play free" angle is your best marketing differentiator against every other energy-gated mobile game.

### Q12: Should the game ever show ads, and if so, only opt-in rewarded video?
**Context**: No ad system is mentioned anywhere in the design docs or roadmap. The monetization philosophy is "free to play, free to learn."
**My Advice**: If you must have ads, make them strictly opt-in rewarded ads: "Watch a 30-second ad for +1 oxygen tank" after a dive. Never interrupt gameplay, never interrupt quizzes, never show banners. However, I would recommend launching ad-free entirely and relying on subscription + cosmetics. The educational game market is extremely ad-sensitive -- parents and teachers will actively avoid recommending games with ads, and word of mouth from educators is your highest-value growth channel.

### Q13: Should fact packs and Data Discs be purchasable, or does paywalling knowledge contradict your core philosophy?
**Context**: Data Discs are collectible items found during dives containing 10-20 facts about a specific topic. The design doc says "Can also be purchased in a shop." The philosophy states "free to play, free to learn -- no knowledge is paywalled."
**My Advice**: This is a philosophical line in the sand. I strongly recommend keeping ALL facts free to find in-game. Selling Data Discs directly contradicts "free to learn" and will generate negative press ("education game paywalls knowledge"). Instead, sell cosmetic Data Disc skins (the disc looks different but contains the same free facts), or sell "Data Disc Radar" consumables that increase disc drop rates for 3 dives. The educational credibility of "every fact is free" is worth more than Data Disc revenue.

### Q14: What cosmetic items would players actually pay for, given the pixel art aesthetic and your player demographic?
**Context**: The game has: miner skins, pickaxe skins, dome wallpapers per floor, dome decorations (furniture, plants, trophies), achievement paintings, pet variants (3 premium pets via Premium Materializer), and a cosmetics shop with 8 items and category tabs.
**My Advice**: In pixel art games, the highest-converting cosmetics are: (1) animated pickaxe skins with unique particle trails (players see these constantly during the core loop), (2) pet skins/variants that are visually distinct (golden trilobite, crystal cat), (3) dome themes that transform the entire aesthetic (underwater dome, space station dome, garden dome), and (4) GAIA avatar skins (steampunk GAIA, holographic GAIA). Avoid selling individual wallpapers -- bundle them into themes. Price animated/interactive cosmetics higher ($2.99-$4.99) than static ones ($0.99-$1.99).

### Q15: Is a Battle Pass / Season Pass model ethical for an educational game, and how would you structure the free vs. premium tracks?
**Context**: Phase 23 mentions "Seasonal Events" with exclusive rewards. The open question Q-S2 asks about season/battle pass design. The game targets all ages including kids.
**My Advice**: A season pass can work ethically if it follows strict rules: (1) the free track must contain all educational content and meaningful gameplay rewards, (2) the premium track is cosmetics-only (dome themes, pet skins, GAIA outfits, pickaxe effects), (3) the pass never expires -- players who buy it can complete it at their own pace (no FOMO pressure), and (4) progress is earned through learning milestones, not just playtime. Frame it as a "Knowledge Expedition" that rewards sustained learning over 8-12 weeks. Price it at $4.99 per season.

### Q16: Should there be a one-time "Starter Pack" or "Founder's Pack" purchase for new players?
**Context**: No starter pack exists in the current design. The game has a tutorial that ends with the goal "gather 50 facts and learn 20." New players start with minimal resources.
**My Advice**: A $4.99 one-time Starter Pack is the highest-converting IAP in mobile gaming (typically 8-15% of D7 retained players buy it). Include: 500 dust, 1 guaranteed rare+ artifact, a unique "Founder's Pickaxe" cosmetic skin, and 3 bonus oxygen tanks. Make it available only during the first 7 days after install (creates urgency without being predatory). This single item will likely generate more revenue per user than your first 3 months of cosmetic sales. Do not include any gameplay advantages beyond the consumable resources -- cosmetic exclusivity is the real draw.

### Q17: How should the mineral economy scale to prevent hyperinflation at endgame without punishing casual players?
**Context**: The economy has 5 mineral tiers (dust/shard/crystal/geode/essence), 110:1 conversion ratio, scaling craft costs (1.25x multiplier per craft), mineral decay (2% dust above 500 per dive), dive insurance (15% dust), and daily deals as sinks.
**My Advice**: Your current sinks are solid but the mineral decay mechanic (2% above 500 dust per dive) will frustrate returning players who took a break. Replace decay with a positive framing: a "dome maintenance" cost that scales with dome size, or a "spending bonus" that awards extra items when you spend above thresholds. Add prestigious "gold-tier" cosmetics that cost enormous amounts (50,000 dust) as aspirational sinks for endgame veterans. Monitor your wealth distribution -- if the top 10% of players hold more than 80% of minerals, your sinks are too weak.

### Q18: Does the "mastery = free play" promise actually cannibalize subscription revenue, and is that acceptable?
**Context**: The design promises that "top players who ace quizzes can earn enough bonus oxygen to play indefinitely." Quiz gate milestones (+1 tank at gates 5, 10, 15, 20) allow skilled players to generate net-positive oxygen.
**My Advice**: The mastery path will absolutely reduce subscription conversion among the most engaged learners -- but those are exactly the players you want playing for free as evangelists and content proof. The subscription converts casual players who want more playtime but do not want to study harder. This is healthy segmentation: hardcore learners play free (and become your marketing), casual players subscribe for convenience. Do not weaken the mastery path; it is your competitive moat. Track what percentage of D30 players are "mastery free" vs. "subscriber free" -- if mastery players exceed 30%, tighten the oxygen curve slightly.

### Q19: What is the right price for a "whale" tier, and how do you make big spending feel like patronage rather than exploitation?
**Context**: The game has premium materials (star dust, void crystal, ancient essence) and premium recipes for cosmetics. No ultra-premium pricing tier exists.
**My Advice**: Offer a $24.99 "Patron of Knowledge" bundle once per season: exclusive GAIA dialogue set, a unique dome floor theme, a "Patron" nameplate visible to visitors, and a real-world donation to an educational nonprofit (include the charity name). This appeals to adults who want to support an educational product. Never sell gameplay advantages at any price tier. Also consider a $49.99 annual "Grand Patron" that includes all seasonal cosmetics and a physical pixel art sticker pack mailed to them -- physical rewards drive unusually high conversion in indie games.

### Q20: How do you prevent the "I finished everything" cliff for paying subscribers who exhaust content?
**Context**: Subscribers get unlimited oxygen. The game has 522 facts currently (goal: 5,000-10,000), 25 biomes (3 implemented), 10 fossils. A subscriber who plays 2 hours daily could exhaust content within weeks.
**My Advice**: This is your biggest long-term risk. At 522 facts you are nowhere near enough content for a subscription launch. Target 3,000 facts minimum before opening subscriptions. Mitigate the content cliff with: (1) procedural mine generation provides infinite replay variety, (2) fact mastery via SM-2 is inherently long-term (intervals stretch to 60+ days), (3) content drops every 2 weeks (50-100 new facts), (4) seasonal biome rotations that change the mine meta, and (5) social leaderboards that create infinite competition. A subscriber who runs out of new facts in week 2 will churn and leave a 1-star review.

---

## C. Retention, Churn & Re-engagement (Questions 21-30)

### Q21: What are your D1/D7/D30 retention targets, and which single metric matters most in the first 6 months?
**Context**: Phase 21.3 mentions "Usage analytics (sessions, retention D1/D7/D30)" but sets no targets. The game straddles education (typically D1: 40%, D7: 15%, D30: 5%) and casual gaming (D1: 35%, D7: 15%, D30: 7%).
**My Advice**: Target: D1: 45%, D7: 20%, D30: 10%. But optimize for D7 retention above everything else. D1 tells you if the tutorial works (fixable). D30 tells you if the endgame works (but you need users to reach it first). D7 answers the fundamental question: "After trying the game for a week, did the player form a habit?" If D7 is above 20%, you have product-market fit. If below 12%, no amount of marketing will save you. Every decision in the first 6 months should be evaluated through the lens of "does this improve the chance that today's installer is still playing in 7 days?"

### Q22: At what point in the player journey do you expect the highest churn, and what is the mitigation plan?
**Context**: The game has several complexity ramps: post-tutorial (many new systems), first oxygen depletion (30% loot loss), first failed quiz gate (oxygen cost), and the transition from finding facts to sustained review discipline.
**My Advice**: The highest churn will occur between dive 3 and dive 7 -- after tutorial excitement fades but before the Knowledge Tree and fossil systems create enough invested progression to retain. Mitigation: ensure the first fossil is found by dive 2 (guaranteed spawn), first pet revived by dive 4 (reduced knowledge requirement for the first species), and first dome room unlocked by dive 5 (lower the current threshold). Front-load rewards and slow them down later. The 30% loot loss on first oxygen depletion may also cause rage-quits -- consider 0% loss on the very first depletion as a tutorial grace.

### Q23: How should the game handle a player returning after a 2-week absence?
**Context**: GAIA has return hooks: "Your pet missed you!", "I decoded a fascinating artifact while you were away..." Streak tracking with freeze items (max 3, 200 dust each). Review Rituals reset. Farm caps at 24 hours.
**My Advice**: Create a dedicated "Welcome Back" flow: GAIA greets with personality, shows what changed (farm produced X resources, Y facts are ready for review, pet has a gift). Give a free "Comeback Chest" with a rare artifact and bonus oxygen. Critically, do NOT show the broken streak or wilted Knowledge Tree first -- lead with positive surprises, then gently mention reviews. Extend the farm production cap to 7 days for absent players so they return to a meaningful haul. Shame-based re-engagement drives permanent churn.

### Q24: Should the streak system punish missed days, or only reward maintained streaks?
**Context**: Current implementation: miss one day = lose streak. Streak freezes cost 200 dust (max 3 stored). Milestones at 3/7/14/30/60/100 days with mineral and title rewards. GAIA warns "Your streak ends in 3 hours!"
**My Advice**: Reframe entirely. Instead of "you lost your 47-day streak," use "you completed a 47-day expedition -- start a new one!" Keep all milestone rewards but make them permanent achievements, not reset on streak break. Add a "longest streak" personal record that is never lost. The 200-dust streak freeze is a good design, but the emotional framing matters enormously: Duolingo's streak guilt has become a meme for anxiety. You do not want that association for an educational product. Celebrate streaks; never weaponize them.

### Q25: How aggressively should push notifications be used, and what is the opt-in strategy?
**Context**: Phase 23.4 lists: streak reminders, review ritual nudges, pet needs attention. Phase 15.5 has GAIA-voiced re-engagement hooks. No notification frequency or opt-in design exists.
**My Advice**: Maximum 1 push notification per day, only if the player has not opened the app. Request notification permission AFTER the player completes their first successful dive and artifact reveal -- never during onboarding before they understand the value. Frame the permission as GAIA asking: "Want me to let you know when your tree needs watering or your pet wants to play?" Rotate content between review nudges, streak reminders, and GAIA personality lines. After 7 days of no engagement, stop notifications entirely -- persistent notifications to churned players just accelerate uninstalls.

### Q26: What brings a churned player back 30+ days later -- what is the win-back strategy?
**Context**: The game has no explicit "win-back" system. GAIA's long-absence hooks only fire on app open. The Knowledge Tree wilts. Farm production caps at 24 hours. No email or external communication channel exists.
**My Advice**: External triggers bring back churned players, not in-app features. Invest in: (1) opt-in "GAIA's Letter" emails with pixel art and a fun fact, sent monthly, (2) seasonal event announcements ("The Age of Dinosaurs just started -- 50 new paleo facts!"), (3) social pressure from friends if social features exist. Inside the app, when they do return: the "Welcome Back" flow from Q23, a free oxygen refill, and a special easy dive with boosted rewards. The goal is to remove every possible friction point so the returning player gets back to the fun loop within 30 seconds.

### Q27: How do you retain "completionist" players after they have mastered all available facts?
**Context**: 522 facts exist currently. SM-2 mastery requires 60+ day intervals. A dedicated player studying 20 facts/day could see all 522 facts in a month, with full mastery taking several more months.
**My Advice**: Completionists are your most valuable evangelists. Reward them: (1) "Omniscient" title and exclusive golden dome cosmetic, (2) GAIA personality shift ("You know more than me now, miner. I am genuinely impressed."), (3) access to submit community facts for review, (4) "Mentor" mode where they help new players in knowledge duels. But the real answer is content velocity -- you need to add facts faster than completionists master them. Target 100+ new facts per week post-launch. At 522 facts, you have roughly 5-10 weeks before your most engaged players hit the wall.

### Q28: Is the 30% loot loss on oxygen depletion the right severity, or does it push casual players to quit permanently?
**Context**: When oxygen runs out, the player is pulled to surface and drops 30% of collected loot. Send-up stations allow securing up to 3 items mid-dive. Dive insurance costs 15% dust but keeps 100% items.
**My Advice**: 30% is reasonable for roguelite veterans but may shock casual or education-focused players. Consider a graduated penalty: first oxygen depletion ever = 0% loss (GAIA rescue, tutorial moment), next 3 depletions = 15% loss, then 30% becomes the standard. This gives new players a grace period to learn oxygen management. Also make Send-up Stations more prominent in early layers -- many players will not discover them before their first oxygen depletion. Track the "first depletion churn rate" specifically.

### Q29: How should difficulty scale dynamically to keep both struggling and advanced players in the flow state?
**Context**: Difficulty currently scales via block hardness by depth, quiz distractor similarity, SM-2 scheduling, layer size (20x20 to 40x40), and hazard density. Pickaxe and scanner tiers provide power progression.
**My Advice**: Implement a hidden "engagement score" that tracks session frequency, quiz accuracy, dive depth, and time spent. If quiz accuracy exceeds 90% over 20 questions, dynamically increase distractor difficulty. If accuracy drops below 50%, ease off. For mining, if a player consistently reaches layer 15+ easily, introduce harder biome combinations. The "flow state" zone -- where perceived challenge equals perceived skill -- is where both retention and learning are maximized. Never let the game feel trivially easy or impossibly hard.

### Q30: What happens to the game experience if a player deliberately ignores the learning systems and brute-forces through quiz penalties?
**Context**: Quiz gates are mandatory per layer (DD-V2-026), pop quizzes trigger at 8-10% per block, artifact pickup has quiz chances. Gates open after 2 failures with oxygen penalty. The design goal is "make learning genuinely addictive."
**My Advice**: A player who deliberately fails quizzes pays heavy oxygen penalties but can still technically progress. This is acceptable -- never hard-gate progress on learning. However, make the cost steep enough that learning is clearly the optimal strategy. Track the "quiz skip rate" (intentional wrong answers). If it exceeds 15% of all quiz interactions, your quiz experience is frustrating rather than fun -- investigate distractor quality, question phrasing, and reward balance. The quiz must feel like a welcome puzzle break, not an interruption.

---

## D. Growth, Marketing & Market Position (Questions 31-40)

### Q31: How do you position Terra Gacha in app stores -- Games category or Education category?
**Context**: The game targets "anyone who is curious" with no specific age range. It has deep gaming mechanics (roguelite, gacha, crafting) and deep educational mechanics (spaced repetition, knowledge tree, 25 distractors per fact).
**My Advice**: List in Games (Adventure or Casual subcategory) as primary, with Education as secondary. The Education category has 50% lower organic install rates than Games. Your Terraria/Motherload-style mining is your user acquisition hook; the learning is your retention hook. Marketing should lead with "mine, explore, discover" and reveal the learning as a delightful surprise. Parents will find you via "educational game" searches regardless of category, but gamers will only find you if you are in Games.

### Q32: What are the 5 app store keywords you would prioritize for organic discovery?
**Context**: The game combines mining gameplay, knowledge quizzes, fossil collecting, base building, and pixel art aesthetics. No ASO strategy exists.
**My Advice**: Target: (1) "mining game" (high volume, moderate competition), (2) "pixel art adventure" (enthusiast audience, lower competition), (3) "learn while playing" (education-seeking parents), (4) "fossil collecting game" (unique niche, very low competition), (5) "trivia adventure" (bridges quiz and game audiences). Avoid "roguelite" (niche, hardcore connotation on mobile) and "Anki" (too niche, implies tool not game). Your subtitle should be something like "Mine Deep. Learn Everything." -- clear, intriguing, dual-purpose.

### Q33: What is the launch strategy -- soft launch in limited markets, early access, or global launch?
**Context**: Phase 20 covers mobile launch (Android first, iOS second). Beta testing via TestFlight and Play Console is mentioned. No geographic targeting or phased rollout is designed.
**My Advice**: Soft launch in Philippines, Malaysia, and Colombia (English-speaking, high mobile gaming engagement, representative demographics, low CPI for testing) for 4-6 weeks. Measure D1/D7/D30 retention, tutorial completion, first purchase conversion, and quiz engagement rate. Fix the top 3 drop-off points. Then early access on Google Play (10,000 user cap) for 2-4 weeks to gather store reviews. Full launch with coordinated press push to education bloggers, indie game outlets, and pixel art communities. Never launch globally without soft launch data -- bad early reviews permanently damage rankings.

### Q34: Who are the direct and adjacent competitors, and what specific lessons should you take from each?
**Context**: No competitive analysis exists in the docs. The game combines mechanics from Duolingo (learning), Terraria (mining), Anki (spaced repetition), and gacha games (reward psychology).
**My Advice**: Study: Duolingo (streak psychology -- adopt the habit loop but drop the guilt), Terraria (the "one more layer" exploration hook -- apply this to your descent shaft design), Prodigy Math (classroom integration -- build a teacher dashboard post-launch), Idle Miner Tycoon (prestige/reset systems -- consider a "mine prestige" mechanic where completed biomes give permanent bonuses), and QuizUp (social quiz battles -- your Knowledge Duels should learn from its matchmaking). Avoid: Duolingo's guilt notifications, gacha predatory pricing, and idle game meaningless tapping. Your unique position is that NO competitor combines roguelite mining with spaced repetition learning.

### Q35: Should you partner with educational institutions or teachers for distribution, and when?
**Context**: The interest system supports focused study (category-lock item), age-appropriate content filtering (KID/TEEN/ADULT), and the game is fully offline-playable. Language learning expansion is planned (Phase 24).
**My Advice**: Yes, but post-launch and only after consumer retention proves strong. Create a free "Teacher Dashboard" web portal where teachers can: assign fact categories, see aggregate quiz accuracy, and create custom study groups. Offer a "Classroom License" (free, no monetization) for schools. The viral loop: student plays at school, continues at home with the full game, tells friends, parents download it. Prodigy reached 50 million users this way. But do not chase institutional sales before your consumer product retains -- schools are slow buyers and your product needs to prove itself first.

### Q36: What is the content creator and influencer strategy for a solo-developer indie game?
**Context**: The game has a unique pixel art style, GAIA personality, and the novel "mine for knowledge" hook. It has shareable elements: Knowledge Trees, dome builds, rare artifact reveals.
**My Advice**: Target three tiers: (1) Pixel art / indie game YouTubers (100K-500K subs) -- send early access, they love unique indie games. (2) Education-focused TikTokers ("fun facts" creators with 500K+ followers) -- the game literally IS their content in game form; offer custom fact packs with their branding. (3) Cozy game streamers -- your dome building and fossil collection fits the cozy game trend. Create a "Creator Code" system with a unique cosmetic. For you as a solo developer, TikTok videos showing "facts I learned from my own game" is inherently shareable content that costs nothing to produce.

### Q37: Should the game support user-generated fact packs, and how does quality control work at scale?
**Context**: Phase 23.3 mentions community fact submissions with moderation and a submitter credit system. The fact pipeline uses LLM for distractor generation, categorization, and metadata.
**My Advice**: This is one of your most powerful long-term growth levers. Allow verified users (30+ day streak, 200+ facts mastered) to submit facts through an in-app form. Route submissions through: (1) automated LLM check for accuracy, appropriateness, and duplicate detection, (2) community upvote/downvote from 5 random qualified players, (3) final automated approval if 4/5 approve. Credit the submitter on the fact card. This creates a virtuous cycle: engaged players create content that retains other players who then create more content. Start small with 20 curated community facts per month and scale as quality control proves reliable.

### Q38: Should the game have a web version alongside mobile, and how does that affect user acquisition?
**Context**: The game is built with Vite + Svelte + Phaser 3, making it inherently web-compatible. Primary target is mobile via Capacitor. A dev server runs at localhost:5173.
**My Advice**: Launch a web version as a free demo/teaser on terragacha.com. Include the tutorial + first 5 dives with a prompt to download the mobile app for the full experience. This gives you: (1) a zero-friction try-before-download funnel, (2) SEO traffic from "mining game" and "trivia game" searches, (3) a link for content creators (no app store friction), and (4) a classroom-accessible entry point. Web-to-mobile conversion is underused in educational gaming. Some players will stay on web permanently -- let them, and monetize web separately via subscription.

### Q39: How do you acquire your first 1,000 users cost-effectively as a solo developer?
**Context**: No user acquisition budget or strategy exists in the docs. The game is built by a solo developer.
**My Advice**: Paid UA is premature. Focus on organic: (1) Post weekly pixel art screenshots and GAIA dialogue on X/Twitter, Reddit r/IndieGaming, and r/PixelArt. (2) Create TikTok "fun fact" content using your own game. (3) Submit to indie game festivals (IGF, IndieCade). (4) Post on Hacker News at launch (the "spaced repetition education game" angle resonates with that audience). (5) Cross-post to r/Anki and language learning communities when language features launch. (6) Email education bloggers and "fun facts" newsletter authors. Budget $0 for the first 3 months, then reinvest early revenue into $500-1000/month of targeted Google UAC.

### Q40: What is the ideal content calendar for the first year post-launch?
**Context**: Phase 23.2 mentions "weekly fact batches, monthly biome additions, quarterly major features." 25 biomes are designed (3 implemented). The fact pipeline targets 5,000-10,000 facts.
**My Advice**: Month 1-3: Weekly drops of 100 new facts + 1 new biome per month + bug fixes. Month 4-6: First seasonal event ("Age of Dinosaurs"), language learning beta (Japanese, Spanish), first season pass. Month 7-9: Social features launch (leaderboards, dome visiting), 3 more biomes, second seasonal event. Month 10-12: Knowledge Duels, cooperative dives beta, holiday event. Maintain weekly fact drops throughout. The goal is that every 2 weeks, a returning player finds something new. Never go more than 14 days without a visible content update -- silence kills mobile games faster than bad reviews.

---

## E. Player Psychology, Ethics & Accessibility (Questions 41-50)

### Q41: How do you serve four distinct player archetypes -- learners, miners, collectors, and completionists -- without the game feeling unfocused?
**Context**: The game has parallel progression tracks: Knowledge Tree (learners), mine depth/layer records (miners), fossils and cosmetics (collectors), and branch completion percentages (completionists). The interest system and category-lock item suggest awareness of different motivations.
**My Advice**: Map each archetype to a primary engagement surface and use GAIA to adapt. Learners prioritize study sessions and Knowledge Tree -- GAIA celebrates their knowledge milestones. Miners chase depth records -- GAIA comments on their bravery. Collectors pursue fossils, cosmetics, and Data Discs -- GAIA shows excitement about their gallery. Completionists aim for 100% branch completion. The weekly challenge system (Q6) should always include one quest per archetype. Use early behavioral signals (study-to-mine ratio, collection actions, completion checking) to classify players by day 7 and personalize the experience.

### Q42: How do you prevent the quiz system from feeling like homework rather than a game mechanic?
**Context**: Quizzes trigger during dives (gates, pop quizzes, artifact pickups), during study sessions (voluntary), and during review rituals (daily). The design doc states "players should want to learn more, not feel forced."
**My Advice**: Three rules: (1) Every quiz must have immediate tangible stakes -- correct answers boost artifact rarity, open gates, grant oxygen. Abstract "learning progress" alone is not motivating in the moment. (2) Wrong answers should cost something (oxygen) but never end the run or permanently lock content. (3) After every wrong answer, show the correct answer with GAIA's explanation and mnemonic immediately -- the "aha!" moment must follow the mistake. Frame quizzes as "challenges" not "tests." The difference is psychological: a challenge is something you choose to overcome; a test is something imposed on you.

### Q43: How do you ensure the gacha/reveal mechanics do not cross ethical lines, especially for younger players?
**Context**: Artifacts have rarity tiers (Common 60% to Mythic 0.1%) with escalating reveal animations. The game is called "Terra Gacha." Pet synthesis and Data Discs also have gacha-like reveals. Premium Materializer uses rare materials.
**My Advice**: Establish clear ethical guardrails: (1) all drop rates are displayed in-game (full transparency), (2) no real money directly buys randomized loot -- you buy cosmetics directly or oxygen to play, which may lead to finds (indirect), (3) gacha excitement is earned through gameplay, never purchased, (4) pity system: after 20 artifacts without rare+, guarantee the next one is rare, (5) no "limited time" pressure on gacha items (FOMO drives problematic spending in kids). The name "Terra Gacha" is playful, but be prepared for regulatory scrutiny in Belgium and Netherlands where gacha mechanics face legal challenges.

### Q44: How do you handle content sensitivity across KID/TEEN/ADULT tiers without making the kid version feel shallow?
**Context**: Facts have `age_rating` (kid/teen/adult), `sensitivity_level` (0-5), and `sensitivity_note`. Kid mode filters to "family-safe, no violence, no controversy."
**My Advice**: The kid version must have just as many "wow!" facts as the adult version -- just different topics. Kids should get the most mind-blowing animal facts, space facts, and nature facts (octopus hearts, tardigrade survival, the size of Jupiter). Never make kid mode feel watered-down. Create a dedicated "Kid Wow Score" during fact curation -- a fact rated 9/10 for kids might be 5/10 for adults and vice versa. Also implement parental controls: lock the age setting, set daily play time limits, and surface a summary of what the child learned. This feature alone could drive teacher recommendations.

### Q45: Should the game surface learning analytics to players ("GAIA's Report"), and what is the retention impact?
**Context**: The SM-2 algorithm tracks intervals, ease factors, and repetitions per fact. The Knowledge Tree shows visual progress. No player-facing analytics dashboard exists. Phase 21.3 mentions "learning effectiveness tracking."
**My Advice**: Yes, build a "GAIA's Report" screen in the Archive room showing: facts mastered this week, quiz accuracy by category (radar chart), longest SM-2 interval, and strongest/weakest knowledge areas. Make it beautiful and shareable. Three purposes: (1) players see concrete evidence of learning (intrinsic motivation), (2) parents verify educational value (acquisition driver), (3) the data creates goal-setting ("Can you get Astronomy above 80%?"). Keep it positive-framed: never "you are failing at History," always "History is your next frontier to explore." Share-ready analytics screens drive organic social posting.

### Q46: Should the game support multiple player profiles on one device for families sharing a tablet?
**Context**: The save system uses localStorage with a single PlayerSave object. Guest mode allows play without an account. No profile switching exists.
**My Advice**: Yes, support up to 4 profiles per device. Families sharing an iPad is extremely common for educational games. Each profile needs its own save state, age setting, interest preferences, and Knowledge Tree. This is technically straightforward (keyed localStorage or IndexedDB) but design-critical: a parent playing at Adult difficulty should not see their 8-year-old's KID mode content. Profile switching on the title screen with simple avatar selection. This single feature could double your household penetration -- one family member downloads, four end up playing.

### Q47: What accessibility features are needed for launch versus post-launch?
**Context**: No accessibility design exists in the current docs. The game uses pixel art (small visual elements), quiz overlays, and touch controls. The target audience includes all ages.
**My Advice**: For launch: (1) colorblind-safe rarity indicators (use shapes + colors, not colors alone -- current rarity relies purely on color: white/green/blue/purple/gold/rainbow), (2) scalable text size (critical for aging players and visual impairment), (3) high-contrast mode for quiz text, (4) VoiceOver/TalkBack compatibility for quiz questions. Post-launch: (5) dyslexia-friendly font option (OpenDyslexic), (6) one-handed play mode, (7) reduced motion option (disable screen shake and particle bursts for photosensitive players). Accessible games have 15-20% larger addressable markets -- this is both ethical and strategic.

### Q48: How do you measure whether the game is actually effective at teaching, and should you publish those metrics?
**Context**: The SM-2 algorithm tracks retention intervals per fact. The Knowledge Tree shows mastery progression. No external validation or learning outcome measurement exists.
**My Advice**: Build an internal "Learning Effectiveness Dashboard" tracking: (1) average facts retained at 30-day intervals, (2) quiz accuracy improvement over time per user, (3) category mastery velocity, (4) SM-2 interval distribution (are facts actually reaching 60+ day retention?). Publish an annual "Terra Gacha Learning Report" with aggregate anonymized data -- "Our players retained 78% of learned facts after 30 days, compared to the typical 20% without spaced repetition." This establishes credibility with educators and parents, generates press coverage, and differentiates you from every "educational" game that never proves it works.

### Q49: Should there be a referral mechanic, and what thematic format avoids feeling exploitative?
**Context**: No referral system exists. The game has fossil eggs, pets, and cosmetics as potential referral rewards. Phase 22 covers social features but not referrals specifically.
**My Advice**: "Invite a friend, you both receive a fossil egg" is a clean, thematic referral. The fossil egg is exciting (gacha anticipation), does not break the economy (it is a cosmetic companion start), and rewards both parties. Avoid requiring the invitee to reach a milestone before the inviter is rewarded -- that creates abandonment frustration. Reward both immediately on the invitee's first dive completion, then add a second bonus if the invitee maintains a 7-day streak. Keep referral rewards modest -- the goal is organic sharing, not a pyramid of incentive gaming.

### Q50: What are the 10 most critical analytics events to instrument before any beta test?
**Context**: Phase 21.3 mentions "usage analytics, learning effectiveness, conversion funnel, A/B testing" but no specific instrumentation plan exists.
**My Advice**: Instrument these before any beta user touches the game: (1) tutorial step completion (granular funnel: each step as a named event), (2) first dive completion rate, (3) first artifact ingestion rate, (4) D1/D7/D30 retention cohorts, (5) session length distribution with screen-time breakdown, (6) study session initiation rate (voluntary vs. prompted), (7) streak break events (with streak length at break), (8) purchase funnel (view > tap buy > confirm > complete), (9) oxygen depletion context (loot carried, depth reached, quiz performance at time of death), (10) fact engagement (keep vs. sell ratio, mastery speed by category, "not interesting" flag rate). Without these dashboarded, you are flying blind. Analytics infrastructure must be a Phase 19 prerequisite, not a Phase 21 afterthought.

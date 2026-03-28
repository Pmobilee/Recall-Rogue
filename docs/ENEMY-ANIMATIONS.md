# Enemy Animation Spec — Recall Rogue

## Context
Every enemy currently uses procedural tween animations (bob, breathe, lunge, knockback) driven by 8 archetypes. The LTX-2.3 pipeline (`sprite-gen/scripts/animate-sprite.mjs`) can generate real sprite animations from static sprites. This document specifies **what animations each enemy should have** — up to 8 unique animations + idle — based on their lore, intent pool, and special mechanics.

## LTX Prompt Format (proven working)
```
A {visual description} facing forward on a solid black background. {Animation type} animation.

0-1 seconds: {Setup/windup}

1-2 seconds: {Main action/peak}

2-3 seconds: {Recovery/return to start}

Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background.
```

## Animation Categories
| Anim Key | Trigger | Description |
|----------|---------|-------------|
| `idle` | Default state | Breathing/ambient loop, must seamlessly loop |
| `attack` | `attack` intent | Single-hit strike |
| `multi_attack` | `multi_attack` intent | Rapid multi-hit flurry |
| `defend` | `defend` intent | Shields up / armor hardens |
| `buff` | `buff` intent | Self-enhancement glow/power-up |
| `debuff` | `debuff` intent | Casting curse / poison / hex |
| `heal` | `heal` intent | Recovery / absorption |
| `charge` | `charge` intent | Dramatic power-up windup |
| `hit` | Taking damage | Flinch/recoil reaction |
| `death` | HP reaches 0 | Collapse / dissolve / shatter |
| `phase2` | Phase transition | Dramatic transformation |
| `special` | Quiz-reactive hook | Unique mechanic animation |

**Priority when over 8+idle limit:** idle > hit > death > attack > signature mechanic > multi_attack > defend > debuff > buff > heal > charge > phase2

---

## ACT 1: SHALLOW DEPTHS

### Commons (11)

#### 1. Page Flutter
**Lore:** Common cave bat. Fast and fragile predator.
**Archetype:** swooper | **Intents:** attack, buff, defend

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A small cave bat creature with ragged wings facing forward on a solid black background. Idle breathing animation loop. 0-1s: Wings folded close, subtle chest breathing, eyes darting side to side. 1-2s: Wings twitch open slightly, quick head tilt as if listening, weight shifts on perch. 2-3s: Wings settle back, breathing rhythm returns to starting pose for seamless loop. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A small cave bat creature facing forward on a solid black background. Swooping strike animation. 0-1s: Wings snap open wide, body coils backward preparing to lunge. 1-2s: Dives forward with wings swept back, jaws open, delivering a fast biting strike. 2-3s: Pulls back to center, wings fold in, returns to neutral perched position. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `buff` | A small cave bat creature facing forward on a solid black background. Screeching power-up animation. 0-1s: Head tilts back, mouth opens wide. 1-2s: Lets out a screech, body vibrates with energy, faint glow pulses around wings. 2-3s: Settles back, glow fades, returns to idle stance. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `defend` | A small cave bat creature facing forward on a solid black background. Wing cover defense animation. 0-1s: Wings begin spreading outward. 1-2s: Wings wrap tightly around body forming a protective shell, body hunches. 2-3s: Wings slowly unfurl back to resting position. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `hit` | A small cave bat creature facing forward on a solid black background. Taking damage flinch animation. 0-1s: Impact jolts the body backward, wings flare out in surprise. 1-2s: Body recoils, shakes, eyes squint in pain. 2-3s: Steadies itself, wings fold back to neutral stance. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `death` | A small cave bat creature facing forward on a solid black background. Death collapse animation. 0-1s: Body goes rigid, wings splay outward. 1-2s: Falls forward limply, wings crumpling. 2-3s: Dissolves into scattered feathers and dust particles fading away. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 2. Thesis Construct
**Lore:** Crystal-encrusted paper golem. Slow, blocks then charges heavy spikes. Charge-resistant.
**Archetype:** slammer | **Intents:** attack, defend, charge, multi_attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A crystal-encrusted paper golem facing forward on a solid black background. Idle breathing animation loop. 0-1s: Heavy body sways slightly, crystals catch faint light with tiny sparkles. 1-2s: Shoulders shift, crystal shards on arms glint, a slow grinding sound implied by subtle movement. 2-3s: Returns to original pose, breathing rhythm matches frame 0. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A crystal-encrusted paper golem facing forward on a solid black background. Crystal slam attack animation. 0-1s: Raises one massive crystal-studded fist overhead. 1-2s: Slams fist downward with tremendous force, crystals flash on impact, body compresses from the weight of the blow. 2-3s: Slowly rises back to full height, arm returns to side. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `defend` | A crystal-encrusted paper golem facing forward on a solid black background. Hardening crystals defense animation. 0-1s: Crystals across body begin to glow brighter. 1-2s: New crystal formations sprout and spread across the surface, body hunches into a fortified stance. 2-3s: Glow stabilizes, crystals remain but dim, returns to standing pose. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `charge` | A crystal-encrusted paper golem facing forward on a solid black background. Charging power-up animation. 0-1s: Body hunches, crystals begin glowing intensely from within. 1-2s: Energy builds visibly, crystals vibrate and grow larger, a massive crystal spike forms on one arm. 2-3s: Holds the charged pose, spike fully formed, body trembling with contained power. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `multi_attack` | A crystal-encrusted paper golem facing forward on a solid black background. Crystal barrage multi-hit animation. 0-1s: Arms spread wide, crystals on body glow. 1-2s: Rapid-fire crystal shards launch forward in quick succession, body shudders with each volley. 2-3s: Arms lower, crystal surfaces dim, returns to idle stance. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `hit` | A crystal-encrusted paper golem facing forward on a solid black background. Taking damage reaction. 0-1s: Impact causes crystals to crack, body lurches backward. 1-2s: Crystal fragments break off and scatter, golem staggers. 2-3s: Steadies itself, remaining crystals knit slightly, returns to standing. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 7 | `death` | A crystal-encrusted paper golem facing forward on a solid black background. Death shatter animation. 0-1s: Massive cracks spider across all crystals simultaneously. 1-2s: Body explodes outward — crystals and paper shards scatter in all directions. 2-3s: Debris rains down and fades, leaving nothing. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 3. Mold Puff
**Lore:** Floating puffer fungus. Stacks poison fast.
**Archetype:** caster | **Intents:** attack, debuff (poison), debuff (weakness)

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A round floating puffer mushroom creature facing forward on a solid black background. Idle breathing animation loop. 0-1s: Gently bobs up and down, cap expands and contracts with slow breathing, tiny spores drift from underneath. 1-2s: Slight rotation, more spores release, inner glow pulses faintly. 2-3s: Returns to starting height and pose, breathing rhythm seamless. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A round floating puffer mushroom creature facing forward on a solid black background. Spore burst attack animation. 0-1s: Body inflates rapidly, swelling to nearly double size. 1-2s: Explodes outward releasing a cloud of damaging spores, body contracts sharply from the burst. 2-3s: Slowly re-inflates to normal size, spore cloud dissipates. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `debuff` | A round floating puffer mushroom creature facing forward on a solid black background. Toxic cloud poison animation. 0-1s: Body darkens, green-purple veins pulse across the cap surface. 1-2s: Releases a thick billowing cloud of toxic green vapor forward, body shudders as it expels the poison. 2-3s: Cloud drifts forward, body lightens back to normal color. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `hit` | A round floating puffer mushroom creature facing forward on a solid black background. Taking damage flinch animation. 0-1s: Body compresses from impact, spores burst out involuntarily. 1-2s: Wobbles wildly, nearly deflating, cap crinkles. 2-3s: Stabilizes and re-inflates, returns to floating position. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `death` | A round floating puffer mushroom creature facing forward on a solid black background. Death deflation animation. 0-1s: Body rapidly deflates like a punctured balloon, spores erupting from multiple holes. 1-2s: Crumbles inward, cap wilts and folds. 2-3s: Collapses into a pile of spores that dissipate into nothing. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 4. Ink Slug
**Lore:** Wet slug. Poison seeps from its touch. Tanky.
**Archetype:** lurcher | **Intents:** attack, debuff (poison), defend

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A large slimy ink-black slug creature facing forward on a solid black background. Idle breathing animation loop. 0-1s: Body undulates slowly, leaving a shimmering trail of ink beneath, antennae wave gently. 1-2s: Body contracts then expands in a peristaltic motion, ink droplets bead on the surface. 2-3s: Returns smoothly to starting pose, undulation rhythm matches frame 0. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A large slimy ink-black slug creature facing forward on a solid black background. Mud slash attack animation. 0-1s: Body rears up, gathering momentum. 1-2s: Lunges forward with a heavy slapping strike, ink spatters on impact. 2-3s: Retracts back to resting position, ink dripping. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `debuff` | A large slimy ink-black slug creature facing forward on a solid black background. Bog grasp poison animation. 0-1s: Body darkens, ink begins bubbling across the surface. 1-2s: Toxic ink oozes forward in a spreading pool, body pulses as it secretes poison. 2-3s: Ink pool fades, body returns to normal sheen. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `defend` | A large slimy ink-black slug creature facing forward on a solid black background. Sliming defense animation. 0-1s: Body secretes a thick layer of glistening slime. 1-2s: Slime hardens into a protective coating, body curls inward slightly. 2-3s: Returns to neutral posture, slime coating glistens. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `hit` | A large slimy ink-black slug creature facing forward on a solid black background. Taking damage reaction. 0-1s: Body compresses from impact, ink spatters outward. 1-2s: Recoils, body ripples like jelly, antennae flail. 2-3s: Slowly reforms shape, slime resettles. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `death` | A large slimy ink-black slug creature facing forward on a solid black background. Death dissolve animation. 0-1s: Body goes limp, ink begins pooling outward rapidly. 1-2s: Melts into a spreading puddle of ink, form loses cohesion. 2-3s: Puddle evaporates, nothing remains. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 5. Bookmark Vine
**Lore:** Animated vine roots. Chain-vulnerable. Multi-hit with thorns.
**Archetype:** crawler | **Intents:** multi_attack, debuff (poison), attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A tangled mass of animated vine roots with thorns facing forward on a solid black background. Idle animation loop. 0-1s: Vines writhe slowly, curling and uncurling, thorns glint in ambient light. 1-2s: Root tips probe outward, feeling for prey, a slight coiling motion through the mass. 2-3s: Returns to starting configuration, writhing rhythm seamless. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `multi_attack` | A tangled mass of animated vine roots with thorns facing forward on a solid black background. Vine lash multi-hit animation. 0-1s: Multiple vines rear back like striking snakes. 1-2s: Three vines whip forward in rapid succession, thorns slashing, each strike snapping outward then retracting. 2-3s: All vines retract to center mass, settling back. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `debuff` | A tangled mass of animated vine roots with thorns facing forward on a solid black background. Poisoned thorns animation. 0-1s: Thorns begin oozing green liquid, dripping toxin. 1-2s: Vines shake violently, spraying poisonous droplets forward. 2-3s: Dripping slows, vines settle, thorns still glistening with poison. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `hit` | A tangled mass of animated vine roots with thorns facing forward on a solid black background. Taking damage reaction. 0-1s: Vines jolt from impact, several snap or break. 1-2s: Mass recoils, broken vine segments fall away, remaining vines curl protectively. 2-3s: Slowly re-extends, reforming the tangle. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `death` | A tangled mass of animated vine roots with thorns facing forward on a solid black background. Death wither animation. 0-1s: Vines go rigid, color drains from green to brown. 1-2s: Rapidly withers, vines crumble to dry husks, thorns fall off. 2-3s: Collapses into dust and dead plant matter that fades away. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 6. Staple Bug
**Lore:** Heavy armored beetle. Prefers to block and wait. Charge-resistant.
**Archetype:** trembler | **Intents:** defend, attack, multi_attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A large armored beetle with a heavy metallic carapace facing forward on a solid black background. Idle animation loop. 0-1s: Mandibles click quietly, antennae twitch, body barely moves — rock-solid stance. 1-2s: Slight weight shift, carapace plates adjust with a subtle grinding motion. 2-3s: Returns to motionless guard stance, mandibles click once. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `defend` | A large armored beetle with a heavy metallic carapace facing forward on a solid black background. Shell hardening defense animation. 0-1s: Carapace plates shift, sliding over each other. 1-2s: Plates lock together with an audible click, forming an impenetrable shell, legs tuck under for maximum coverage. 2-3s: Holds defensive posture, plates slightly loosen. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `attack` | A large armored beetle with a heavy metallic carapace facing forward on a solid black background. Mandible snap attack animation. 0-1s: Mandibles open wide, body lowers. 1-2s: Lunges forward with mandibles snapping shut violently, body weight behind the bite. 2-3s: Pulls back, mandibles reset, resumes guard stance. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `hit` | A large armored beetle with a heavy metallic carapace facing forward on a solid black background. Taking damage reaction. 0-1s: Impact dents carapace, body slides back slightly. 1-2s: Shakes off the hit, carapace rings like struck metal, staggers. 2-3s: Plants legs firmly, regains composure. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `death` | A large armored beetle with a heavy metallic carapace facing forward on a solid black background. Death collapse animation. 0-1s: Carapace cracks down the center. 1-2s: Legs buckle, body rolls onto its back, carapace plates scatter. 2-3s: Legs curl inward, body goes still, fades. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 7. Margin Gremlin
**Lore:** Quick limestone imp. Aggressive and annoying. Self-buffs.
**Archetype:** striker | **Intents:** attack, buff, attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A small pale limestone imp with sharp features facing forward on a solid black background. Idle animation loop. 0-1s: Bounces from foot to foot impatiently, claws flexing. 1-2s: Quick darting head movements, eyes scanning, tail flicks irritably. 2-3s: Returns to bouncing stance, energy never stops. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A small pale limestone imp with sharp features facing forward on a solid black background. Nimble jab attack animation. 0-1s: Crouches low, weight on back foot. 1-2s: Darts forward with lightning-fast claw swipe, body blurs with speed. 2-3s: Hops back to starting position, already bouncing again. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `buff` | A small pale limestone imp with sharp features facing forward on a solid black background. Rocky surge self-buff animation. 0-1s: Clenches fists, stone texture on skin begins crackling. 1-2s: Rocky growths emerge on arms and fists, body flexes with newfound power, eyes glow. 2-3s: Settles into stronger stance, rock enhancements remain. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `hit` | A small pale limestone imp with sharp features facing forward on a solid black background. Taking damage flinch. 0-1s: Struck backward, limbs flailing. 1-2s: Tumbles, chips of limestone break off, scrambles mid-air. 2-3s: Lands on feet, shakes head angrily, resumes stance. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `death` | A small pale limestone imp with sharp features facing forward on a solid black background. Death crumble animation. 0-1s: Body freezes, cracks spread across limestone surface. 1-2s: Shatters into limestone chunks and dust. 2-3s: Debris scatters and fades to nothing. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 8. Index Weaver
**Lore:** Venomous cave spider. Fast multi-attacker. Chain-vulnerable.
**Archetype:** crawler | **Intents:** multi_attack, debuff (poison), attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A large venomous cave spider with dripping fangs facing forward on a solid black background. Idle animation loop. 0-1s: Legs shift weight in a slow circular pattern, mandibles click, venom drips from fangs. 1-2s: Front legs tap the ground testing for vibrations, abdomen pulses. 2-3s: Returns to watchful crouch, legs reset to starting positions. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `multi_attack` | A large venomous cave spider with dripping fangs facing forward on a solid black background. Fang barrage multi-hit animation. 0-1s: Front legs lift, body coils. 1-2s: Unleashes rapid-fire strikes — three bites in quick succession, fangs snapping, legs stabbing. 2-3s: Retracts all legs, settles back into crouch. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `debuff` | A large venomous cave spider with dripping fangs facing forward on a solid black background. Web poison animation. 0-1s: Abdomen rises, spinneret activates. 1-2s: Sprays toxic web strands forward, green-tinged silk arcing outward. 2-3s: Web shooting stops, abdomen lowers. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `hit` | A large venomous cave spider with dripping fangs facing forward on a solid black background. Taking damage reaction. 0-1s: Body jolts, legs splay outward from impact. 1-2s: Skitters sideways in pain, a leg buckles. 2-3s: Rights itself, resets legs, resumes crouch. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `death` | A large venomous cave spider with dripping fangs facing forward on a solid black background. Death curl animation. 0-1s: All legs go rigid simultaneously. 1-2s: Legs curl inward beneath the body in classic dead spider pose, body flips. 2-3s: Shrivels and fades away. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 9. Overdue Golem
**Lore:** Bog water and peat golem. Self-healer. Tanky.
**Archetype:** lurcher | **Intents:** heal, debuff (weakness), attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A hulking golem made of dripping bog water and peat moss facing forward on a solid black background. Idle animation loop. 0-1s: Body drips constantly, swamp water pooling, chest cavity rises and falls with heavy wet breathing. 1-2s: One arm shifts with a squelching sound, moss clumps fall and regrow. 2-3s: Returns to shambling stance, drip rhythm matches frame 0. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `heal` | A hulking golem made of dripping bog water and peat moss facing forward on a solid black background. Bog absorption healing animation. 0-1s: Body hunches, drawing moisture inward from the air. 1-2s: Cracks and wounds fill with fresh mud and peat, moss spreads rapidly over damaged areas, body swells. 2-3s: Stands taller, fully reformed, dripping with renewed moisture. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `debuff` | A hulking golem made of dripping bog water and peat moss facing forward on a solid black background. Peat decay weakness animation. 0-1s: Arms reach forward, dripping intensifies. 1-2s: Sprays a wave of fetid bog water forward, dark mist rises from the spray. 2-3s: Arms lower, dripping returns to normal rate. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `attack` | A hulking golem made of dripping bog water and peat moss facing forward on a solid black background. Sludge swing attack animation. 0-1s: Pulls one massive arm back, mud stretching. 1-2s: Swings arm in a wide arc, sludge flying off the fist on impact. 2-3s: Arm retracts, body sways back to center. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `hit` | A hulking golem made of dripping bog water and peat moss facing forward on a solid black background. Taking damage reaction. 0-1s: Impact punches through the body, mud splashes out the back. 1-2s: Hole slowly fills back in, body wobbles like gelatin. 2-3s: Reforms completely, resumes stance. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `death` | A hulking golem made of dripping bog water and peat moss facing forward on a solid black background. Death melt animation. 0-1s: Body loses cohesion, limbs begin dripping away. 1-2s: Collapses into a spreading puddle of mud and bog water. 2-3s: Puddle sinks into nothing, a few bubbles pop and disappear. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 10. Pop Quiz
**Lore:** Quiz-reactive fungus. Correct Charge stuns it. No Charge makes it enrage permanently.
**Archetype:** caster | **Intents:** debuff (poison), debuff (weakness), attack | **Special:** stun on correct charge, enrage on no charge

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A glowing mushroom creature with pulsing cap and question-mark-shaped spots facing forward on a solid black background. Idle animation loop. 0-1s: Cap pulses with bioluminescent light, spores drift upward lazily. 1-2s: Stalk sways, cap rotates slightly, question-mark spots flicker. 2-3s: Returns to starting glow pattern, seamless loop. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `debuff` | A glowing mushroom creature with pulsing cap facing forward on a solid black background. Spore shower poison animation. 0-1s: Cap inflates, darkening with concentrated toxins. 1-2s: Cap bursts open releasing a shower of toxic green spores that rain down forward. 2-3s: Cap reseals, glow returns to normal. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `attack` | A glowing mushroom creature with pulsing cap facing forward on a solid black background. Cap strike attack animation. 0-1s: Stalk coils like a spring. 1-2s: Whips forward headbutting with the hardened cap, impact flash. 2-3s: Bounces back, stalk straightens. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `special_stun` | A glowing mushroom creature with pulsing cap facing forward on a solid black background. Stunned daze animation. 0-1s: Glow flickers and dies, cap droops. 1-2s: Entire body slumps, stars or spirals circle above the cap, completely dazed. 2-3s: Remains slumped and unresponsive, glow dim. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `special_enrage` | A glowing mushroom creature with pulsing cap facing forward on a solid black background. Enrage power-up animation. 0-1s: Cap turns from soft glow to angry red, body trembles. 1-2s: Mushroom grows larger, spines emerge from the stalk, cap spots turn to menacing slits, rage energy radiates outward. 2-3s: Settles into a visibly angrier, larger form. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `hit` | A glowing mushroom creature with pulsing cap facing forward on a solid black background. Taking damage flinch. 0-1s: Cap dents inward from impact, glow flickers. 1-2s: Spores burst out involuntarily, body rocks back. 2-3s: Reforms cap shape, glow stabilizes. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 7 | `death` | A glowing mushroom creature with pulsing cap facing forward on a solid black background. Death wilt animation. 0-1s: Glow extinguishes completely, cap turns grey. 1-2s: Stalk crumbles, cap falls and shatters into dry spore dust. 2-3s: Dust scatters and vanishes. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 11. Eraser Worm
**Lore:** Eyeless worm hunting by vibration. Never stops biting. Chain-vulnerable. Rare.
**Archetype:** crawler | **Intents:** multi_attack (4 hits), debuff (vulnerable), attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A segmented eyeless worm creature with circular mouth of grinding teeth facing forward on a solid black background. Idle animation loop. 0-1s: Body undulates in a constant S-curve motion, segments rippling. 1-2s: Head sweeps left and right sensing vibrations, mouth teeth rotate slowly. 2-3s: Returns to center, undulation rhythm seamless. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `multi_attack` | A segmented eyeless worm creature with circular grinding mouth facing forward on a solid black background. Bite frenzy multi-hit animation. 0-1s: Body coils tightly, mouth teeth spin up to full speed. 1-2s: Strikes forward four times in rapid succession — bite, retract, bite, retract, bite, retract, bite — teeth grinding with each snap. 2-3s: Mouth slows, body uncoils to resting position. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `debuff` | A segmented eyeless worm creature with circular grinding mouth facing forward on a solid black background. Larval grasp debuff animation. 0-1s: Segments split open revealing smaller larvae within. 1-2s: Larvae spray forward in a wave, latching and burrowing. 2-3s: Segments seal shut, body resumes undulation. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `hit` | A segmented eyeless worm creature facing forward on a solid black background. Taking damage reaction. 0-1s: Body snaps straight from impact, segments compress. 1-2s: Thrashes wildly in pain, curling and uncurling. 2-3s: Settles back into undulating motion. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `death` | A segmented eyeless worm creature facing forward on a solid black background. Death split animation. 0-1s: Body goes rigid, segments crack apart. 1-2s: Segments separate and scatter like broken chain links. 2-3s: Each segment shrivels and fades individually. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

---

### Mini-Bosses (5)

#### 12. The Plagiarist
**Lore:** Serpent that enrages after turn 4, permanently gaining +5 damage/turn.
**Archetype:** crawler | **Intents:** attack, attack, debuff (vulnerable) | **Special:** enrage timer

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A coiled serpent creature with stolen scale patterns from other creatures facing forward on a solid black background. Idle animation loop. 0-1s: Body coils and uncoils slowly, tongue flicks testing the air. 1-2s: Scales shimmer, shifting patterns — as if wearing a disguise that doesn't quite fit. 2-3s: Returns to tight coil, tongue retracts. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A coiled serpent creature facing forward on a solid black background. Serpent lunge attack animation. 0-1s: Body tenses, head draws back, coils compress. 1-2s: Explosive forward lunge, jaws open wide, striking with full body force. 2-3s: Recoils back into tight defensive coil. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `debuff` | A coiled serpent creature facing forward on a solid black background. Venom bite debuff animation. 0-1s: Fangs extend, venom drips visibly. 1-2s: Quick targeted bite, fangs sink in, venom pulses from glands. 2-3s: Pulls back, fangs retract, licking lips. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `special_enrage` | A coiled serpent creature facing forward on a solid black background. Enrage transformation animation. 0-1s: Body begins trembling, scales stand on end. 1-2s: Rears up to full height, hood flares open, eyes glow red, body doubles in apparent size from fury. 2-3s: Stays at full height, hissing, permanently enlarged and enraged. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `hit` | A coiled serpent creature facing forward on a solid black background. Taking damage reaction. 0-1s: Body whips from impact, coils scatter. 1-2s: Hisses in pain, body knots briefly. 2-3s: Re-coils defensively. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `death` | A coiled serpent creature facing forward on a solid black background. Death unravel animation. 0-1s: Coils loosen, body goes limp. 1-2s: Stolen scale patterns fade away, revealing a blank worm-like form. 2-3s: Body dissolves into copied fragments that scatter and fade. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 13. The Card Catalogue
**Lore:** Ancient root system. Heals, multi-attacks with root whips. Source of all the vine enemies.
**Archetype:** caster | **Intents:** heal, multi_attack, debuff (poison), attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A massive ancient root system with a central woody eye-like knot facing forward on a solid black background. Idle animation loop. 0-1s: Roots shift slowly underground, central knot pulses with dim amber light. 1-2s: Smaller roots wave like sea anemone tendrils, bark creaks with ancient breathing. 2-3s: Returns to stable root pattern, pulse rhythm seamless. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `heal` | A massive ancient root system facing forward on a solid black background. Root mending healing animation. 0-1s: All roots pull inward, drawing nutrients. 1-2s: New bark grows over wounds, green shoots sprout from damaged areas, amber light intensifies at the core. 2-3s: Growth slows, roots extend back outward, healthier and thicker. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `multi_attack` | A massive ancient root system facing forward on a solid black background. Root whip multi-hit animation. 0-1s: Three massive roots rise from below. 1-2s: Each root cracks forward like a whip in rapid succession — snap, snap, snap. 2-3s: Roots retract underground. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `debuff` | A massive ancient root system facing forward on a solid black background. Entangle poison animation. 0-1s: Thin roots emerge and reach forward. 1-2s: Roots wrap and squeeze, oozing toxic sap from the bark. 2-3s: Roots retreat, leaving poison behind. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `hit` | A massive ancient root system facing forward on a solid black background. Taking damage reaction. 0-1s: Impact splinters bark, core light flickers. 1-2s: Roots flail reflexively, bark chips scatter. 2-3s: Roots settle, bark begins knitting over damage. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `death` | A massive ancient root system facing forward on a solid black background. Death rot animation. 0-1s: Core light extinguishes, bark turns grey. 1-2s: Roots go brittle, crumbling to sawdust from the tips inward. 2-3s: Central knot caves in, everything collapses to dust. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 14. The Headmistress
**Lore:** Colony of iron beetles stacked together. Heavy defender with charge ability.
**Archetype:** slammer | **Intents:** defend, charge, buff, attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A humanoid figure made of hundreds of stacked iron beetles moving as one facing forward on a solid black background. Idle animation loop. 0-1s: Surface shimmers as individual beetles shift positions, maintaining the humanoid shape. 1-2s: Arms cross, beetles click and chitter, a few fly in tight orbits around the form. 2-3s: Beetles resettle, form solidifies back to starting pose. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `defend` | A humanoid figure made of stacked iron beetles facing forward on a solid black background. Fortify shell defense animation. 0-1s: All surface beetles lock their carapaces together. 1-2s: Form hunches, beetles interlocking into a seamless iron shell, impenetrable. 2-3s: Holds position, slight metallic shimmer. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `charge` | A humanoid figure made of stacked iron beetles facing forward on a solid black background. Charging metallic crush animation. 0-1s: Beetles swarm tighter, form grows denser and darker. 1-2s: All beetles vibrate at high frequency, metallic hum builds, form glows red-hot from friction. 2-3s: Holds the charged state, trembling with contained force. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `attack` | A humanoid figure made of stacked iron beetles facing forward on a solid black background. Iron slam attack animation. 0-1s: One arm raises, beetles forming a massive fist. 1-2s: Slams down with the weight of a thousand iron beetles, impact sends shockwave. 2-3s: Arm reforms, beetles scatter then reform the hand. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `buff` | A humanoid figure made of stacked iron beetles facing forward on a solid black background. Hardened rage buff animation. 0-1s: Beetles turn from iron grey to dark red, agitation spreads. 1-2s: Form expands as beetles puff up with rage, thorny protrusions emerge. 2-3s: Settles into larger, angrier silhouette. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `hit` | A humanoid figure made of stacked iron beetles facing forward on a solid black background. Taking damage reaction. 0-1s: Impact scatters beetles outward, form partially disassembles. 1-2s: Staggering, beetles frantically swarm back into position. 2-3s: Form reconstitutes, slightly misshapen temporarily. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 7 | `death` | A humanoid figure made of stacked iron beetles facing forward on a solid black background. Death scatter animation. 0-1s: Central coordination fails, form loses shape. 1-2s: Beetles scatter in all directions, the humanoid silhouette dissolving into a cloud of flying insects. 2-3s: Beetles fly off-screen individually, nothing remains. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 15. The Tutor
**Lore:** Swamp hag. Curses and weakens before bothering to attack. Heals.
**Archetype:** caster | **Intents:** debuff (weakness), debuff (vulnerable), heal, attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A hunched swamp hag creature with gnarled fingers and glowing bog-green eyes facing forward on a solid black background. Idle animation loop. 0-1s: Fingers twitch, mixing invisible concoctions in the air, eyes glow rhythmically. 1-2s: Cackles silently, shoulders shake, moss-covered shawl sways. 2-3s: Returns to hunched watchful pose, eye glow steady. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `debuff` | A hunched swamp hag creature facing forward on a solid black background. Curse casting debuff animation. 0-1s: Raises gnarled hands, dark energy coils between fingers. 1-2s: Thrusts hands forward releasing a wave of purple-green curse energy, eyes flare. 2-3s: Hands lower, cackling, energy dissipates. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `heal` | A hunched swamp hag creature facing forward on a solid black background. Bogwater healing animation. 0-1s: Cups hands together, swamp water rises between palms. 1-2s: Drinks deeply, green energy flows through body, wounds seal, posture straightens briefly. 2-3s: Hunches back down, refreshed and restored. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `attack` | A hunched swamp hag creature facing forward on a solid black background. Curse strike attack animation. 0-1s: One hand crackles with dark energy. 1-2s: Swipes forward with cursed claw, dark energy trailing behind the strike. 2-3s: Hand lowers, energy fades. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `hit` | A hunched swamp hag creature facing forward on a solid black background. Taking damage reaction. 0-1s: Reels backward, shawl fluttering. 1-2s: Snarls in anger, clutches wounded area. 2-3s: Straightens up, scowling, resumes stance. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `death` | A hunched swamp hag creature facing forward on a solid black background. Death dissolve animation. 0-1s: Body stiffens, eyes dim. 1-2s: Disintegrates into swamp mist and moss, form breaking apart like wet paper. 2-3s: Only swamp vapor remains, then nothing. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

#### 16. The Study Group
**Lore:** Crowned fungus colony. Rules through poison. Buffs with spore ascension.
**Archetype:** caster | **Intents:** debuff (poison), buff, defend, attack

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A large crowned mushroom king surrounded by a colony of smaller fungi facing forward on a solid black background. Idle animation loop. 0-1s: Crown-like cap pulses with authority, smaller mushrooms around the base bob in sync. 1-2s: Spores drift upward in a lazy spiral, colony ripples outward then back. 2-3s: Returns to regal stillness, spore pattern loops. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `debuff` | A large crowned mushroom king with its fungal colony facing forward on a solid black background. Toxic bloom poison animation. 0-1s: Crown cap splits open revealing toxic interior. 1-2s: Erupts a massive cloud of poisonous spores, colony mushrooms burst in sympathy. 2-3s: Crown reseals, spore cloud drifts forward. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `buff` | A large crowned mushroom king with its fungal colony facing forward on a solid black background. Spore ascension buff animation. 0-1s: Colony mushrooms lean toward the king, funneling energy. 1-2s: King absorbs the energy, grows taller, crown expands, glowing with amplified power. 2-3s: Settles into empowered stance, colony diminished but king larger. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `defend` | A large crowned mushroom king with colony facing forward on a solid black background. Cap shield defense animation. 0-1s: Crown cap tilts forward, colony mushrooms gather close. 1-2s: Forms a layered shield of overlapping mushroom caps, hardened and dense. 2-3s: Holds shield formation. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `hit` | A large crowned mushroom king with colony facing forward on a solid black background. Taking damage reaction. 0-1s: Impact knocks crown askew, several colony mushrooms pop. 1-2s: Reels, shedding spores involuntarily, crown wobbles. 2-3s: Straightens crown, new colony mushrooms sprout. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `death` | A large crowned mushroom king with colony facing forward on a solid black background. Death decomposition animation. 0-1s: Crown falls off, king's stalk cracks. 1-2s: Entire colony rots simultaneously, melting into dark mulch. 2-3s: Only spores remain drifting, then nothing. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

---

### Elite (1)

#### 17. The Librarian
**Lore:** Thick-hided troll-like guardian. Slow temper, enrages in phase 2 (40% HP). Gains multi-attack and charge.
**Archetype:** slammer | **Intents P1:** attack, defend, charge, buff | **Intents P2:** attack, multi_attack, charge

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A massive thick-hided troll creature with stone-like skin and small spectacles facing forward on a solid black background. Idle animation loop. 0-1s: Breathes heavily, shoulders rise and fall, adjusts tiny spectacles perched on a massive nose. 1-2s: Cracks knuckles slowly, shifts weight from one foot to the other with a rumbling footstep. 2-3s: Returns to standing watch, spectacles glinting. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A massive troll creature with stone skin facing forward on a solid black background. Club smash attack animation. 0-1s: Raises enormous stone club overhead with both hands. 1-2s: Brings it crashing down with devastating force, ground implied to shake. 2-3s: Heaves club back to shoulder, panting. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `defend` | A massive troll creature with stone skin facing forward on a solid black background. Hunkering defense animation. 0-1s: Lowers body, tucking chin. 1-2s: Skin hardens further, stone plating spreading, arms cross defensively. 2-3s: Holds defensive crouch. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `charge` | A massive troll creature facing forward on a solid black background. Charging devastating roar animation. 0-1s: Plants feet wide, draws breath, chest expands. 1-2s: Lets out a massive roar, veins bulging, energy visibly building, eyes glowing. 2-3s: Holds breath, trembling with stored energy. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `buff` | A massive troll creature facing forward on a solid black background. Troll rage buff animation. 0-1s: Face contorts, skin reddens under the stone. 1-2s: Muscles swell visibly, spectacles crack, body grows more imposing. 2-3s: Settles into rage stance, permanently angrier. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `phase2` | A massive troll creature facing forward on a solid black background. Enrage phase transition animation. 0-1s: Spectacles shatter, eyes glow red. 1-2s: Body convulses, muscles double in size, stone skin cracks revealing molten veins beneath, club shatters into dual claws. 2-3s: Stands at full enraged height, barely recognizable, steam rising. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 7 | `hit` | A massive troll creature facing forward on a solid black background. Taking damage reaction. 0-1s: Barely flinches, head turns slowly toward the source. 1-2s: Grunts, stone chips fly off, annoyed rather than hurt. 2-3s: Resumes stance, glaring. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 8 | `death` | A massive troll creature facing forward on a solid black background. Death petrify animation. 0-1s: Movement slows, body stiffens completely. 1-2s: Turns fully to stone, cracks propagate across the surface. 2-3s: Shatters into massive stone fragments that crumble to gravel. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

---

### Bosses (2)

#### 18. The Final Exam
**Lore:** Old mining rig, still running. Phase 2 at 40% HP adds charge and stronger multi-attacks.
**Archetype:** slammer | **Intents P1:** attack, multi_attack, defend, debuff | **P2:** attack, multi_attack, defend, charge

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A massive rusted mining rig machine with spinning drill arms and belching smokestacks facing forward on a solid black background. Idle animation loop. 0-1s: Engine chugs rhythmically, drills spin slowly, smoke puffs from stacks at regular intervals. 1-2s: Gears grind, hydraulics hiss, the whole machine shudders with its own vibration. 2-3s: Returns to steady engine rhythm, exhaust puffs match frame 0 timing. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A massive mining rig machine with drill arms facing forward on a solid black background. Drill charge attack animation. 0-1s: One drill arm revs to high speed, sparks flying. 1-2s: Thrusts the spinning drill forward with pneumatic force, metal screaming. 2-3s: Retracts drill arm, smoke venting from the effort. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `multi_attack` | A massive mining rig machine facing forward on a solid black background. Grinding gears multi-hit animation. 0-1s: All drill arms activate simultaneously. 1-2s: Four rapid drill strikes in succession, each from a different arm, metal sparking with every hit. 2-3s: Arms retract, smoke billows from overheated joints. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `defend` | A massive mining rig machine facing forward on a solid black background. Reinforcing plating defense animation. 0-1s: Panels on the hull begin shifting. 1-2s: Metal plates slide into reinforced position, rivets tighten autonomously, hull becomes a solid wall. 2-3s: Locks into armored configuration. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `debuff` | A massive mining rig machine facing forward on a solid black background. Oil slick debuff animation. 0-1s: Pipes groan, black oil leaks from joints. 1-2s: Sprays a jet of black oil forward, coating everything in slick residue. 2-3s: Pipes seal, dripping stops. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `charge` | A massive mining rig machine facing forward on a solid black background. Overdrive charge animation. 0-1s: Engine roars to life at maximum RPM, smokestacks belch black smoke. 1-2s: All systems overload, red warning lights flash, drill arms spin at blinding speed, body glows from internal heat. 2-3s: Holds overdrive state, vibrating violently. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 7 | `phase2` | A massive mining rig machine facing forward on a solid black background. Overdrive phase transition animation. 0-1s: Safety limiters crack and fall away, bolts shear off. 1-2s: Engine screams at impossible RPM, hull glows red-hot, new weapon systems deploy from hidden compartments. 2-3s: Fully transformed into overdrive mode, faster, more dangerous, trailing sparks. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 8 | `hit` | A massive mining rig machine facing forward on a solid black background. Taking damage reaction. 0-1s: Impact dents hull, sparks fly, a drill arm jolts. 1-2s: Machine stutters, engine misfires once, smoke vents from damage. 2-3s: Self-corrects, engine resumes, damaged area still smoking. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

*Note: death animation exceeds 8+idle limit. Use `hit` reaction with extended fadeout for death.*

#### 19. The Burning Deadline
**Lore:** Molten rock given shape. Poison and strength stacking. Phase 2 at 40% HP.
**Archetype:** trembler | **Intents P1:** attack, attack, debuff (poison), buff | **P2:** attack, multi_attack, debuff (poison)

| # | Animation | LTX Prompt |
|---|-----------|------------|
| 1 | `idle` | A living mass of molten rock with a vaguely humanoid shape, lava veins pulsing across its surface facing forward on a solid black background. Idle animation loop. 0-1s: Lava veins pulse brighter then dim, molten rock drips and reforms constantly. 1-2s: Body shifts mass, one area cooling to dark rock while another cracks open revealing fresh lava. 2-3s: Returns to base glow pattern, drip rate matches frame 0. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 2 | `attack` | A molten rock creature facing forward on a solid black background. Lava splash attack animation. 0-1s: One arm pulls back, molten rock dripping from the fist. 1-2s: Swings forward, releasing a spray of lava droplets on impact. 2-3s: Arm reforms, cooling and reheating. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 3 | `debuff` | A molten rock creature facing forward on a solid black background. Searing heat poison animation. 0-1s: Body glows intensely, heat waves ripple outward. 1-2s: Releases a wave of superheated toxic gas and embers forward, air visibly distorts from the heat. 2-3s: Temperature drops slightly, glow returns to normal. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 4 | `buff` | A molten rock creature facing forward on a solid black background. Magma surge buff animation. 0-1s: Internal pressure builds, body swells. 1-2s: Fresh lava erupts through cracks, body grows larger and hotter, veins pulse with renewed intensity. 2-3s: Settles at new, higher temperature baseline. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 5 | `multi_attack` | A molten rock creature facing forward on a solid black background. Magma rain multi-hit animation. 0-1s: Body arches backward, building pressure. 1-2s: Erupts upward, sending four molten rock projectiles arcing forward in rapid succession. 2-3s: Collapses back to form, steaming. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 6 | `phase2` | A molten rock creature facing forward on a solid black background. Volcanic phase transition animation. 0-1s: Entire body fractures, revealing a core of white-hot magma. 1-2s: Explodes outward then reforms twice as large, rock shell gone, now pure flowing lava with burning eyes. 2-3s: New form stabilizes, perpetually dripping and erupting. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 7 | `hit` | A molten rock creature facing forward on a solid black background. Taking damage reaction. 0-1s: Impact cracks the cooling rock surface, lava sprays out. 1-2s: Stumbles, body partially liquefies from the force. 2-3s: Reforms, crack seals with fresh lava. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |
| 8 | `death` | A molten rock creature facing forward on a solid black background. Death cooling animation. 0-1s: All lava veins dim simultaneously, heat dying. 1-2s: Rapidly cools to dark obsidian, body freezes mid-motion. 2-3s: Frozen form cracks and crumbles to cold rubble that fades. Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background. |

---

## REMAINING ENEMIES — CONDENSED FORMAT

For the remaining 68 enemies (Acts 2-3), I'm using a condensed table format since the LTX prompt structure is identical. Each row gives the animation key and a **motion description** that slots into the proven 3-segment prompt template.

### ACT 2: DEEP CAVERNS — Commons (14)

#### 20. The Crib Sheet (lurcher, glass HP)
*Mirror enemy: wrong Charge reflects damage back.*

| Anim | Visual Description | Motion Summary |
|------|--------------------|----------------|
| `idle` | A dark shadowy mirror-like creature with a reflective surface | Shimmering surface ripples like disturbed water. Reflection distorts and shifts. |
| `attack` | Shadow strike | Shadow arms reach forward, striking with reflected image of the player's own attack. |
| `multi_attack` | Flurry of shadows (3 hits) | Surface shatters into three shadow copies that each lunge forward rapidly. |
| `debuff` | Expose weakness | Surface focuses into a beam, scanning and revealing vulnerable points. |
| `special_mirror` | Mirror damage reaction | Surface flashes bright white, player's own attack visibly reverses direction, rebounds outward. |
| `hit` | Reflective surface cracks, image distorts, slowly reforms. |
| `death` | Mirror shatters into a thousand reflective shards that scatter and wink out. |

#### 21. The Citation Needed (lurcher, tanky)
*Steals player block on wrong Charge.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Bone-covered scavenger hunches over a pile, gnawing, bones clinking. |
| `attack` | Lunges with bone-shard claw slash. |
| `heal` | Consumes bone fragments, body swells with absorbed nutrients. |
| `defend` | Arranges bones into a layered rib-cage shield. |
| `special_steal` | Wrong Charge: ghostly hand reaches forward, grabs glowing shield energy, pulls it back and absorbs it. |
| `hit` | Bones crack and scatter, scrambles to reassemble. |
| `death` | Skeleton collapses into a heap of loose bones that crumble to dust. |

#### 22. The Grade Curve (caster, tanky)
*Knowledge siphon: gains +2 STR per correct Charge.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Crystalline brain-shaped caster floats, neural pathways flickering with stolen knowledge. |
| `attack` | Fires concentrated knowledge beam from core. |
| `defend` | Crystalline shell thickens, neural pathways dim behind armor. |
| `special_siphon` | Correct Charge: tendrils reach out to absorb the knowledge energy, body visibly grows larger and brighter with each absorption. |
| `hit` | Crystal facets crack, leaking light. |
| `death` | Overloads with stolen knowledge, explodes in a burst of light fragments. |

#### 23. The Crambot (crawler, charge-resistant)
*Basalt-skinned reptile. Balanced attacker/defender.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Basalt lizard shifts weight between clawed feet, stone plates grinding. |
| `attack` | Basalt bite — lunges forward with armored jaws. |
| `defend` | Curls into a ball, basalt plates interlocking. |
| `hit` | Basalt chips fly off, staggers sideways. |
| `death` | Stone shell crumbles, revealing nothing inside — collapses to rubble. |

#### 24. The All-Nighter (caster)
*Salt crystal haunting. Weakness debuffer.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Cluster of floating salt crystals orbiting a central void, faintly humming. |
| `attack` | Salt shards fire forward like needles. |
| `debuff` | Crystals dissolve into a sapping mist that drains color and energy forward. |
| `hit` | Several crystals shatter, orbit destabilizes. |
| `death` | All crystals lose orbit, crash together, and dissolve into brine. |

#### 25. The Spark Note (striker)
*Burning coal creature. Poison through burns.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Glowing coal imp flickers with internal fire, embers drifting upward constantly. |
| `attack` | Quick jab leaving a trail of sparks. |
| `debuff` | Body erupts, spraying burning embers that leave lingering burn-poison trails. |
| `hit` | Fire dims, coal cracks, quickly re-ignites. |
| `death` | Fire goes out permanently, coal crumbles to cold ash. |

#### 26. The Watchdog (striker, charge-resistant, uncommon)
*Stone wolf. Multi-biter.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Stone wolf paces tightly, ears perked, tail low, constantly alert. |
| `multi_attack` | Three rapid bites — snap snap snap — body coils between each strike. |
| `attack` | Full-body pounce, jaws clamping. |
| `hit` | Stone chips from flank, yelps silently, spins to face attacker. |
| `death` | Legs lock, body turns fully to stone, topples and shatters. |

#### 27. The Red Herring (floater, tanky)
*Vent creature. Dual debuffer — poison + vulnerable.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Luminous deep-sea vent fish drifts lazily, bioluminescent lure pulsing. |
| `debuff` | Releases toxic chemical cloud from gill vents, staining the air. |
| `attack` | Darts forward with bioluminescent flash, bites. |
| `hit` | Light flickers, body tumbles, rights itself. |
| `death` | Light extinguishes, body sinks and dissolves into thermal plume. |

#### 28. The Anxiety Tick (lurcher, tanky)
*Magma feeder. Self-healer.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Bloated tick creature clings to nothing, legs twitching, body pulsing with absorbed magma. |
| `attack` | Lunge-bite, engorging further on impact. |
| `buff` | Internal magma brightens, body swells with heat energy. |
| `heal` | Sinks proboscis into the ground, draws up magma, body visibly fills and wounds seal. |
| `hit` | Body compresses, magma sprays from puncture, slowly reseals. |
| `death` | Bursts like an overfilled balloon, magma splattering in all directions. |

#### 29. The Trick Question (floater, uncommon)
*Wrong Charge heals it 8 HP + locks a card for 2 turns.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Anglerfish-like creature with a glowing lure shaped like a question mark, drifting. |
| `attack` | Quick fin slash, deceptively fast. |
| `debuff` | Lure pulses, emitting disorienting light that exposes weaknesses. |
| `special_trick` | Wrong Charge: body glows with satisfaction, lure brightens, visibly grows healthier while a chain appears briefly (card lock). |
| `hit` | Lure dims, body jolts, fins flare defensively. |
| `death` | Lure goes dark forever, body deflates and sinks into void. |

#### 30. The Dropout (trembler, charge-resistant, tanky)
*Crustacean in geode shell. Stubborn blocker.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Hermit-crab-like creature inside a sparkling geode shell, claws tapping the shell rim. |
| `defend` | Retreats fully inside geode, crystals seal the opening. |
| `attack` | One massive claw emerges, snaps forward. |
| `hit` | Shell rings like a bell, creature recoils deeper inside. |
| `death` | Shell splits in half, creature falls out limp, both crumble. |

#### 31. The Brain Fog (floater, uncommon)
*Mastery eroder: erodes card mastery if player doesn't Charge correctly.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Amorphous fog cloud with faintly visible neural patterns flickering within. |
| `debuff` | Fog billows forward, toxic vapors seeping out, obscuring everything. |
| `attack` | A tendril of concentrated fog lashes out like a whip. |
| `special_erode` | Neural patterns in fog reach out like fingers, touching invisible cards — light drains from the touched areas (mastery draining). |
| `hit` | Fog disperses briefly from impact point, reforms. |
| `death` | Fog thins rapidly, neural patterns fade, disperses to nothing. |

#### 32. The Thesis Dragon (swooper, rare, chain-vulnerable)
*Ceiling-dropping fast attacker.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Small dragon hanging upside-down, wings folded, tail swaying, eyes tracking. |
| `multi_attack` | Drops from ceiling, three rapid claw swipes while falling, lands and flips back up. |
| `attack` | Drops headfirst in a devastating dive, pulls up at last moment. |
| `hit` | Knocked from ceiling perch, flaps frantically to reattach. |
| `death` | Falls from perch, wings fail, crumbles mid-fall into dust. |

#### 33. The Burnout (swooper)
*Moth on fire. Scorch-poison on contact.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | A moth engulfed in perpetual flame, wings beating slowly, embers trailing from wingtips. |
| `attack` | Swoops forward leaving a trail of fire, wing-strike. |
| `debuff` | Shakes burning scales loose, creating a cloud of burning embers that drift forward (burn-poison). |
| `hit` | Flames gutter, moth tumbles, reignites. |
| `death` | Fire consumes the moth entirely, wings curl to ash, ember floats up and winks out. |

---

### ACT 2: DEEP CAVERNS — Mini-Bosses (6)

#### 34. The Tenure Guardian (trembler)
*Crystal golem, no-charge punisher (+1 STR).*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Massive crystal-armored golem stands like a sentinel, crystals humming faintly. |
| `attack` | Crystal fist slams forward, shards flying. |
| `defend` | Crystals grow outward forming a geode shield wall. |
| `special_punish` | No Charge: crystals pulse angrily, body grows slightly, permanent strength gained — red energy absorbed. |
| `hit` | Crystal armor cracks, revealing dim core beneath. |
| `death` | Crystal matrix fails, entire body collapses like a hollow geode. |

#### 35. The Proctor (slammer)
*Stone warrior. Charge-focused, no-charge punisher.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Ancient stone warrior in a martial stance, stone sword across knees, barely breathing. |
| `attack` | Heavy overhead sword swing, stone cleaving air. |
| `defend` | Plants sword tip-down, crouches behind it like a wall. |
| `charge` | Raises sword skyward, lightning-like energy channels through the stone blade. |
| `buff` | Stone hardens further, runes activate on the surface. |
| `special_punish` | No Charge: stands taller, stone sword glows with absorbed knowledge energy. |
| `hit` | Stone chips from shoulder, barely acknowledges. |
| `death` | Sword falls first, then warrior crumbles into rubble around it. |

#### 36. The Harsh Grader (caster)
*Crystallized sulfur given authority. Poison queen.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Crown of sulfur crystals atop a wasp-like body, yellow-green glow, stinger dripping. |
| `debuff` | Crown crystals shatter and reform as poison cloud, launched forward. |
| `multi_attack` | Three rapid stinger strikes, each leaving green toxin trails. |
| `attack` | Crown-empowered sting, full body behind the thrust. |
| `hit` | Sulfur crystals crack, wasp body recoils, crown wobbles. |
| `death` | Sulfur ignites, body burns in its own chemicals, collapses to ash. |

#### 37. The Textbook (slammer)
*Hardcover armor mechanic: 16 starting armor, correct Charge -4, wrong Charge +2.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Massive stone golem encased in book-like hardcover plates, pages visible between armor seams. |
| `defend` | Hardcover plates shift and reinforce, seams seal. |
| `charge` | Pages flutter with energy, entire body vibrates, preparing devastating granite slam. |
| `attack` | Heavy stone fist strike, hardcover plate on fist acts as a battering ram. |
| `special_crack` | Correct Charge: hardcover visibly cracks (-4 armor), light shows through the gap. |
| `special_reinforce` | Wrong Charge: fresh stone pages slot into gaps (+2 armor), body becomes more encased. |
| `special_break` | Armor reaches 0: all hardcover plates explode off simultaneously, revealing vulnerable body, Vulnerable status visible. |
| `hit` | Armor absorbs blow, pages scatter from seams. |

#### 38. The Imposter Syndrome (striker)
*Deep cave predator. Patient then very fast.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Shadowy predator crouched in stillness, only eyes visible, muscles coiled. |
| `multi_attack` | Explodes from stillness into three blindingly fast strikes. |
| `debuff` | Eyes glow, an aura of doubt radiates outward, exposing vulnerability. |
| `attack` | Single devastating lunge from absolute stillness. |
| `hit` | Knocked from crouch, recovers instantly into new hiding position. |
| `death` | Shadow form dissipates, revealing nothing was ever truly there. |

#### 39. The Pressure Cooker (crawler)
*Lava-formed lizard. Bites and burns.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Magma lizard paces, leaving cooling footprints, internal pressure causes steam venting. |
| `attack` | Magma bite, jaw unhinges, lava drips from mouth. |
| `debuff` | Body pressure releases scalding steam in a forward cone. |
| `defend` | Lava shell hardens, cooling to dark obsidian shield. |
| `hit` | Armor cracks, fresh lava bleeds through. |
| `death` | Pressure fails, body deflates and hardens into a cold lava husk. |

---

### ACT 2: DEEP CAVERNS — Elites (2)

#### 40. The Deadline Serpent (lurcher, phase 2 at 50%)
*Lava cobra. Poison + multi-attack phase 2.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Massive lava cobra in striking coil, hood flared with molten veins pulsing, tongue flicking flames. |
| `attack` | Lightning-fast fang strike, lava venom dripping. |
| `debuff` | Hood fans wide, spraying burning venom mist. |
| `multi_attack` | Two rapid strikes, hood flaring between each. |
| `charge` | (Phase 2) Body coils impossibly tight, molten eruption builds at the throat. |
| `phase2` | Sheds outer skin revealing pure molten serpent form, twice as fast, hood permanently flared. |
| `hit` | Recoils, lava blood sprays from wound, hood folds briefly. |
| `death` | Coils loosen, body cools to obsidian from tail to head, shatters. |

#### 41. The Standardized Test (slammer)
*Basalt column. Charge-focused tank.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Living basalt pillar with rudimentary face, stands impossibly still, tiny rocks orbit it. |
| `defend` | Orbiting rocks form a wall, new layers of basalt grow from the base. |
| `charge` | Entire pillar glows from base upward, building to white-hot at the peak. |
| `buff` | Basalt surface ripples, growing thicker and more imposing. |
| `attack` | Topples forward like a felled tree, crushing everything beneath, then rights itself. |
| `hit` | Chunk breaks off, stoically regenerates the missing piece. |
| `death` | Cracks spiral from top to bottom, then collapses into a pile of basalt rubble. |

---

### ACT 2: THE ABYSS — Commons (11)

#### 42. Writer's Block (floater, chain-vulnerable)
*Obsidian shard. Multi-volley attacker.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Sharp obsidian shard floats, rotating slowly, light catches razor edges. |
| `multi_attack` | Shard splits into four pieces that fire forward in sequence, then reassemble. |
| `attack` | Full shard lunges edge-first like a thrown knife. |
| `hit` | Knocked off axis, spins wildly, restabilizes. |
| `death` | Shatters into obsidian dust that scatters. |

#### 43. Information Overload (lurcher)
*Purposeful lava blob. Burn-poison.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Amorphous lava blob pulses, slowly reshaping, internal bubbles pop on surface. |
| `attack` | Extends a pseudopod and slaps forward with molten force. |
| `debuff` | Surface bubbles burst simultaneously, spraying molten droplets (poison). |
| `hit` | Impact crater forms, slowly fills back in. |
| `death` | Loses heat, solidifies mid-motion, cracks apart. |

#### 44. Rote Memory (caster, charge-resistant)
*Pure crystal. Balanced defender.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Perfect geometric crystal rotates slowly, casting prismatic light, humming with resonance. |
| `defend` | Additional crystal facets grow outward, forming a geodesic shield. |
| `attack` | Fires a concentrated light beam refracted through internal facets. |
| `buff` | Internal light intensifies, crystal grows marginally. |
| `hit` | Facets crack, internal light leaks, slowly reforms. |
| `death` | Resonance frequency shatters it from within, prismatic explosion. |

#### 45. Outdated Fact (striker, chain-vulnerable)
*Dinosaur skeleton. Fast and relentless.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Raptor skeleton stalks, jaw snapping, claws tapping, bones rattling with each movement. |
| `multi_attack` | Three claw-slash strikes in a predatory combo — slash, slash, bite. |
| `debuff` | Roars, jaw unhinging, fear-inducing display that exposes vulnerability. |
| `attack` | Full raptor pounce, claws forward. |
| `hit` | Bones scatter from impact point, skeleton reassembles magnetically. |
| `death` | Animating force leaves, skeleton collapses into a neat fossil pile. |

#### 46. Hidden Gem (trembler, charge-resistant)
*Crystalline shell fortress. Heavy blocker.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Geode creature barely visible inside thick crystal shell, faint inner glow. |
| `defend` | Shell grows thicker, crystals extending outward, nearly impenetrable. |
| `attack` | One crystal spike extends through shell, stabs forward, retracts. |
| `hit` | Shell absorbs impact with a deep resonating ring. |
| `death` | Shell implodes inward, crushing whatever was inside, crystals collapse. |

#### 47. Rushing Student (crawler, chain-vulnerable)
*Magma centipede. Burn-trail.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Glowing magma centipede undulates, hundreds of legs rippling, leaving cooling lava trail. |
| `debuff` | Body erupts molten segments that spray forward (burn-poison trail). |
| `multi_attack` | Coils and strikes three times with different body segments. |
| `attack` | Full body charge, segments compressing then launching like a spring. |
| `hit` | Several segments cool and crack, ripple of pain down the body. |
| `death` | Fire goes out segment by segment from tail to head, collapses into a chain of cold rocks. |

#### 48. Echo Chamber (swooper, uncommon)
*Crystal-winged swooper. Each swoop is a blade.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Crystal-winged creature hovers, wings chiming like wind chimes, prismatic light refracting. |
| `attack` | Dive-bombs forward, crystal wings slicing the air audibly. |
| `multi_attack` | Three rapid swoops in a figure-eight pattern, wings cutting. |
| `hit` | Wing crystal cracks, flight destabilizes, recovers. |
| `death` | Wings shatter mid-flight, body drops and dissolves. |

#### 49. Blank Spot (crawler)
*Gains 8 block on wrong Charge.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Featureless smooth creature with a void-like surface, details seem to slide off it. |
| `attack` | Surface hardens into a fist shape, strikes forward. |
| `defend` | Surface becomes mirror-smooth, reflecting attacks away. |
| `heal` | Absorbs ambient energy, blank surface glows briefly. |
| `special_block` | Wrong Charge: surface solidifies dramatically, a thick barrier materializes around it, visibly more fortified. |
| `hit` | Surface ripples like disturbed water. |
| `death` | Surface peels away in strips, revealing nothing underneath, strips evaporate. |

#### 50. Burnout Phantom (caster)
*Ash elemental. Vulnerable debuffer.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Humanoid shape of swirling ash and embers, features constantly reforming and dissolving. |
| `debuff` | Ash coalesces into a focused beam that strips defenses (vulnerability). |
| `attack` | Ember strike — arm extends as a whip of burning ash. |
| `hit` | Ash disperses from impact, reforms more diffuse. |
| `death` | A final wind scatters the ash permanently, embers wink out one by one. |

#### 51. Prismatic Jelly (floater, uncommon)
*Iridescent jellyfish. Dual debuffer: weakness + vulnerable.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Rainbow-shifting jellyfish pulses, tentacles trailing, colors cycling. |
| `debuff` | Tentacles extend forward, color shifts to sickly hue, stinging with weakness/vulnerability. |
| `attack` | Full-body slam, gelatinous impact. |
| `hit` | Colors flicker to monochrome briefly, body deforms, reforms. |
| `death` | Colors drain to transparent, body deflates, tentacles curl and vanish. |

#### 52. Ember Skeleton (striker, rare, chain-vulnerable)
*Self-buffing burning skeleton.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Skeleton wreathed in perpetual flame, jawbone clacking, fire dancing in eye sockets. |
| `attack` | Burning bone fist punch, fire trailing. |
| `multi_attack` | Three rapid strikes — punch, slash, headbutt — each trailing more fire. |
| `buff` | Flames intensify, skeleton stands taller as fire surges brighter. |
| `hit` | Bones scatter from impact, fire briefly dies, skeleton magnetically reassembles and reignites. |
| `death` | Flames extinguish, bones fall apart and crumble to charred dust. |

---

### ACT 2: THE ABYSS — Mini-Bosses (4)

#### 53. The Perfectionist (slammer, no-charge punisher)
*Obsidian glass armor. Blocks then cuts.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Obsidian knight, mirror-polished surface, deliberate minimal movement. |
| `defend` | Glass panels align into perfect geometric shield. |
| `charge` | Obsidian blade forms from arm, body vibrates with controlled precision. |
| `attack` | Perfect single diagonal cut, surgical precision, obsidian blade. |
| `special_punish` | No Charge: body absorbs ambient energy through glass surface, grows stronger. |
| `hit` | Surface spiderwebs with cracks but holds shape. |
| `death` | Obsidian shatters into a million razor shards that scatter like thrown glass. |

#### 54. The Hydra Problem (lurcher)
*Three crystal heads. Always healing.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Three-headed crystal serpent, each head sways independently, crystals chiming. |
| `multi_attack` | All three heads strike simultaneously from different angles. |
| `defend` | Heads weave into a protective knot, forming a crystal wall. |
| `heal` | One head dips down, absorbs mineral energy, crystal growth spreads across wounds. |
| `attack` | Center head lunges, other two provide flanking menace. |
| `hit` | One head recoils, others hiss protectively. |
| `death` | Heads strike each other in confused death throes, crystal shatters. |

#### 55. The Ivory Tower (swooper)
*Ancient reanimated wyvern. Fast dropper.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Ancient bone wyvern soars with rotting wing membranes, jaw hanging open, ethereal energy holds it aloft. |
| `multi_attack` | Three swooping passes, each dropping bone fragments like bombs. |
| `debuff` | Fossilizing aura radiates from wings, petrifying gaze (vulnerability). |
| `attack` | Full power dive, bone talons extended. |
| `hit` | Wing bone snaps, flight wobbles, ethereal energy compensates. |
| `death` | Ethereal energy fails, skeleton falls apart mid-flight, bones scatter. |

#### 56. The Helicopter Parent (crawler)
*Lava spider. Spawns swarm + poison.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Massive lava spider, egg sac glowing on abdomen, legs planted wide, baby spiders crawl across body. |
| `multi_attack` | Releases swarm of baby spiders that rush forward in waves. |
| `debuff` | Egg sac bursts, spraying toxic magma spawn forward (poison). |
| `defend` | Curls legs around egg sac protectively, magma hardens into shield. |
| `attack` | Brood-mother lunge, all eight legs striking. |
| `hit` | Baby spiders scatter defensively, parent recoils. |
| `death` | Body cools, egg sac goes dark, legs curl inward, baby spiders flee. |

---

### ACT 2: THE ABYSS — Elites (3)

#### 57. The Emeritus (trembler, phase 2 at 50%)
*Crystal-built royal. Hard to kill, dangerous at half HP.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Crystal king on a crystal throne-like growth, regal and barely moving, crown glinting. |
| `defend` | Crystal throne extends upward, forming walls around the king. |
| `heal` | Absorbs crystal from surroundings, body fills in damaged areas. |
| `buff` | Crown glows, royal power intensifies, crystal body hardens. |
| `attack` | Crystal scepter strike, precise and powerful. |
| `phase2` | Stands from throne, throne shatters into weapons, body doubles in size, eyes blaze. |
| `charge` | (Phase 2) Geode avalanche builds — crystals orbit then converge. |
| `hit` | Crystal facets chip, reacts with regal displeasure. |

#### 58. The Student Debt (lurcher, phase 2 at 40%)
*Deep-abyss serpent. Abandons defense when wounded.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Massive deep-sea serpent, bioluminescent markings, coiling in the dark, impossible to see fully. |
| `attack` | Leviathan bite from the darkness. |
| `multi_attack` | Tentacle-like coils strike from multiple angles. |
| `debuff` | Bioluminescence shifts to vulnerability-inducing frequency. |
| `phase2` | Eyes go red, all pretense of caution abandoned, body surges forward, permanently aggressive. |
| `hit` | Recoils into darkness, wounded glow visible. |
| `death` | Bioluminescence fades from tail to head, sinks into the void. |

#### 59. The Publish-or-Perish (caster, domain-immune: natural_sciences)
*Crystal lich. Immune to natural science cards.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Skeletal figure encased in crystal growths, staff topped with rotating crystal orb, arcane energy crackles. |
| `debuff` | Staff points forward, curses fly as dark crystal shards (weakness/vulnerability). |
| `heal` | Drains life force through staff into body, crystal wounds seal. |
| `attack` | Crystal bolt from staff tip, precise and cold. |
| `hit` | Crystal armor absorbs blow, lich barely notices, adjusts grip on staff. |
| `death` | Staff breaks, crystal prison shatters, skeleton collapses, arcane energy dissipates in a flash. |

---

### ACT 2: THE ABYSS — Bosses (4)

#### 60. The Algorithm (caster, phase 2 at 50%, quiz phase)
*Old archive AI. Self-repairing. Quiz phase at half HP.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Floating geometric AI core, holographic data streams orbiting, calculating constantly. |
| `attack` | Fires concentrated data beam forward. |
| `defend` | Holographic firewall materializes as hexagonal grid. |
| `debuff` | Scans target with red laser grid, exposes vulnerable points (system scan). |
| `heal` | Pulls fragments back together, data streams repair damaged sectors. |
| `phase2` | Red alert mode: color shifts from blue to red, data streams accelerate wildly, new weapon systems deploy. |
| `multi_attack` | (Phase 2) Rapid-fire data queries, four beams in sequence. |
| `hit` | Holographic glitch, static burst, briefly distorts. |

#### 61. The Curriculum (slammer, phase 2 at 50%)
*Crystal boss. Phase 2: Quick Play deals 0 damage.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Massive crystal construct, prismatic light refracting through body, slow and deliberate. |
| `attack` | Prismatic slash — arm sweeps in an arc, light trailing. |
| `defend` | Crystal barrier grows from the ground upward, fortress-like. |
| `multi_attack` | Shard storm — body vibrates, dozens of crystal shards fire outward. |
| `heal` | Crystal matrix regenerates, new growth fills gaps. |
| `phase2` | "Final Exam mode" — entire body transforms, crystal becomes opaque and impenetrable to quick attacks, red runes appear, size increases dramatically. |
| `hit` | Crystal fractures visibly, rainbow light leaks from crack. |
| `death` | Crystal resonance fails, entire body rings like a bell then shatters into prismatic dust. |

#### 62. The Group Project (lurcher, phase 2 at 50%)
*Multi-headed shadow serpent. Second head wakes at half HP.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | One active serpent head weaving, second head dormant on the body, shadow tendrils drifting. |
| `attack` | Active head strikes from shadow, fangs bared. |
| `multi_attack` | Active head strikes three times rapidly, body coiling between strikes. |
| `debuff` | Venom drips from both mouths (even dormant one leaks), toxic cloud forms. |
| `phase2` | Second head snaps awake, both heads roar simultaneously, body doubles in menace. |
| `multi_attack_p2` | Both heads strike in coordinated dual assault. |
| `hit` | Active head recoils, dormant head twitches. |
| `death` | Both heads strike each other in death throes, body dissolves into shadow. |

#### 63. The Rabbit Hole (caster)
*Void entity. Hand disruption. Weakness + vulnerable focus.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | A tear in reality — swirling void with tentacle-like distortions reaching out, stars visible within. |
| `attack` | Void bolt — concentrated darkness fires forward, distorting space around it. |
| `multi_attack` | Reality fractures in three places, each emitting a void strike simultaneously. |
| `debuff` | Reality tears wider, pulling at the edges of the player's existence (weakness/vulnerability). |
| `defend` | Collapses inward, becoming a dense point nearly impossible to strike. |
| `hit` | Void ripples, dimension cracks appear and seal. |
| `death` | Void implodes, reality snaps back together with a flash, silence. |

---

## ACT 3: THE ARCHIVE — Commons (11)

#### 64. Thesis Djinn (floater, charge-resistant)
*Compressed air elemental. Pressure opens wounds.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Translucent air elemental, visible only by dust and debris trapped within, pressure distortions. |
| `attack` | Air burst — concentrated pressure wave fires forward. |
| `debuff` | Pressure drop exposes vulnerabilities, air visibly distorts around target. |
| `hit` | Form dissipates momentarily, reforms from surrounding air. |
| `death` | Final depressurization — explosive decompression, debris scatters, nothing remains. |

#### 65. Gut Feeling (lurcher)
*Iron-bodied worm. Multi-biter.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Segmented iron worm, metallic sheen, segments grinding against each other. |
| `attack` | Full lunge, iron mandibles clamping. |
| `multi_attack` | Three rapid bites from different angles, body corkscrewing. |
| `hit` | Iron segment dents, screeches of metal. |
| `death` | Segments separate, each rusts rapidly and crumbles. |

#### 66. Bright Idea (floater)
*Bioluminescent jellyfish. Weakness stinger.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Glowing jellyfish pulses with brilliant light, tentacles trailing, mesmerizing rhythm. |
| `debuff` | Tentacles reach forward, light shifts to draining frequency (weakness sting). |
| `attack` | Full-body luminous slam. |
| `hit` | Light flickers off, reforms dimmer. |
| `death` | Light fades in waves from center outward, transparent body vanishes. |

#### 67. Sacred Text (trembler, charge-resistant)
*Massive plated beetle. Nearly impenetrable shell.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Enormous beetle with inscribed stone plates, hieroglyphs glow faintly, barely moves. |
| `defend` | Plates interlock, hieroglyphs glow brighter forming a magic seal. |
| `attack` | Charges forward with armored headbutt, ground shaking. |
| `hit` | Plates ring like gongs, barely moves, inscription flickers. |
| `death` | Inscriptions go dark one by one, beetle crumbles to inscribed rubble. |

#### 68. Devil's Advocate (striker, uncommon)
*Mantle-born demon. Burns, poisons, and self-buffs.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Small horned demon wreathed in hellfire, tail flicking, grinning with too many teeth. |
| `attack` | Quick molten jab with clawed hand. |
| `debuff` | Breathes magma burn forward (poison). |
| `buff` | Absorbs surrounding heat, body glows hotter, grows slightly. |
| `hit` | Knocked back, snarls, fires dim briefly. |
| `death` | Fires consume from inside out, skeleton visible briefly, collapses to ember pile. |

#### 69. Institution (slammer, charge-resistant)
*Pure iron golem. Dense, absorbs damage.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Massive featureless iron golem, surface reflective, barely perceptible breathing implied by metal creaking. |
| `defend` | Iron plating thickens, surface becomes mirror-smooth. |
| `attack` | Seismic core slam, full weight behind a single punch. |
| `charge` | Iron glows red-hot from internal pressure, building to iron crush. |
| `hit` | Fist-shaped dent appears, slowly pops back out. |
| `death` | Rusts in fast-forward — entire body oxidizes and crumbles in seconds. |

#### 70. Rosetta Slab (floater, uncommon)
*Inscribed floating stone tablet. Curse debuffer.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Stone tablet floats, ancient inscriptions scrolling across surface, faint hum. |
| `defend` | Inscriptions form a circular ward around the tablet. |
| `debuff` | Inscriptions glow malevolently, curse glyphs fly forward. |
| `attack` | Tablet spins and strikes edge-first like a frisbee. |
| `hit` | Tablet cracks, inscriptions scramble, reforms. |
| `death` | Inscriptions fade, tablet splits into fragments, crumbles to sand. |

#### 71. Moth of Enlightenment (swooper)
*Book-eating moth. Leaves targets vulnerable.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Large moth with wings made of book pages, papyrus dust trailing from wingbeats. |
| `attack` | Paper flurry — swoops forward, razor-page wings cutting. |
| `debuff` | Papyrus curse — dust from wings settles on target, ancient writing appearing on skin (vulnerability). |
| `hit` | Pages scatter from wings, flutters erratically. |
| `death` | Wings crumble to loose pages that blow away, body dissolves to ink. |

#### 72. Hyperlink (crawler, uncommon)
*Runic spider. Poison webs.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Spider with glowing runic markings, weaving web that pulses with magic symbols. |
| `multi_attack` | Fires three web strands in rapid succession, each connecting and pulling. |
| `debuff` | Bites, injecting runic poison that writes itself across the wound. |
| `attack` | Full-body lunge, runic fangs extended. |
| `hit` | Web network shakes, spider skitters sideways. |
| `death` | Runes go dark, web dissolves, spider curls and fades. |

#### 73. Unknown Unknown (caster, rare)
*Void tendril. Dual debuffer.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | A single tendril emerging from a void tear, tip searching blindly, reality warping around it. |
| `debuff` | Tendril touches target, draining essence (weakness) or exposing reality (vulnerability). |
| `attack` | Tendril whips forward with impossible speed. |
| `hit` | Tendril recoils into void, re-emerges elsewhere. |
| `death` | Void seal closes, tendril is severed, writhing half fades to nothing. |

#### 74. Fake News (lurcher, charge-resistant)
*Tome that moves like a predator.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | A large book with teeth along its pages, legs made of bookmark ribbons, stalking. |
| `attack` | Pages slash forward like a jaw snapping. |
| `multi_attack` | Book opens and pages fire out like projectiles, three paper-cut strikes. |
| `defend` | Slams shut, hardcover forming a shield. |
| `hit` | Pages scatter, cover dents, scrambles to collect itself. |
| `death` | Spine breaks, pages flutter away, cover falls flat. |

---

## ACT 3: THE ARCHIVE — Mini-Bosses (7)

#### 75. The First Question (lurcher, phase 2 at 50%)
*Ancient serpent. Old enough to remember the world's formation.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Primordial serpent covered in ancient barnacles and fossils, slow deliberate movement, eyes ancient. |
| `attack` | Ancient bite, jaws creaking open with geological slowness then snapping shut instantly. |
| `multi_attack` | Coils and strikes three times, each strike from a different era of motion. |
| `charge` | Body glows with primordial energy, the weight of eons building. |
| `phase2` | Sheds ancient barnacles, reveals sleek prehistoric form, faster and deadlier. |
| `hit` | Fossils crack and fall off, ancient blood seeps. |
| `death` | Body fossilizes rapidly, turns to stone mid-coil, crumbles to sediment. |

#### 76. The Dean (caster, no-charge punisher)
*Iron-forged magnetic being. Balanced fighter.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Iron angel-like figure floating, magnetic field visible as shimmering aura, debris orbiting. |
| `attack` | Magnetically launched iron shard strike. |
| `defend` | Magnetic field intensifies, creating visible barrier. |
| `buff` | Absorbs nearby metal, growing more imposing. |
| `debuff` | Magnetic field reverses, pulling defenses away (expose weakness). |
| `special_punish` | No Charge: field pulses, permanently absorbing ambient power (+1 STR). |
| `hit` | Magnetic field destabilizes, orbiting debris scatters. |
| `death` | Magnetic field collapses, iron form disintegrates to filings that scatter. |

#### 77. The Dissertation (slammer)
*Ultra-dense pressure golem. Barely flinches.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Impossibly dense stone figure, ground beneath implied to buckle, air compressed around it. |
| `defend` | Pressure intensifies, visible shockwave ring. |
| `charge` | Internal pressure builds to critical, body glows from compression heat. |
| `attack` | Single devastating slam, pressure wave implied. |
| `hit` | Surface dents microscopically, shows zero reaction. |
| `death` | Pressure releases in a violent decompression, body explodes outward. |

#### 78. The Eureka (floater)
*Bioluminescent butterfly. Curse-healer.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Enormous luminous butterfly, wings shifting through impossible colors, ancient and ethereal. |
| `debuff` | Wing dust showers down, each mote carrying a tiny curse (weakness/vulnerability). |
| `heal` | Wings fold inward, absorbing light, wounds seal with new luminous tissue. |
| `attack` | Wing-buffet sending blinding light forward. |
| `hit` | One wing dims, flight becomes asymmetric. |
| `death` | Light drains from wing edges inward, becomes transparent, vanishes. |

#### 79. The Paradigm Shift (slammer)
*Living earthquake. Stone given will.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Humanoid form of tectonic plates constantly grinding against each other, magma visible in seams. |
| `attack` | Earthquake slam, body compresses then releases seismic force downward. |
| `charge` | Tectonic plates build pressure, magma glows brighter, the big one is coming. |
| `multi_attack` | Plates break apart and strike independently, three seismic impacts. |
| `hit` | A plate cracks, magma bleeds through, quickly seals. |
| `death` | All plates separate, magma cools mid-air, pieces fall and go cold. |

#### 80. The Ancient Tongue (trembler, no-charge punisher)
*Rune guardian. Tank-healer.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Stone golem covered in glowing protective runes, each rune pulses in sequence. |
| `defend` | Runes blaze brighter, forming layered magical barriers. |
| `heal` | Runes cycle through healing pattern, stone regenerates. |
| `buff` | New runes inscribe themselves, adding power layers. |
| `attack` | Rune-empowered fist strike, glyphs trailing. |
| `special_punish` | No Charge: runes absorb ambient knowledge energy, permanently strengthening. |
| `hit` | Several runes go dark on impact, slowly relight. |
| `death` | All runes extinguish simultaneously, stone crumbles without their support. |

#### 81. The Lost Thesis (caster)
*Librarian ghost. Curses while cataloguing.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Translucent ghostly librarian, endlessly sorting invisible books, occasionally looking up with hollow eyes. |
| `debuff` | Hurls a spectral book that impacts as a curse (weakness). |
| `attack` | Spectral hand reaches through reality to strike. |
| `defend` | Wraps in ghostly book pages, becoming more translucent. |
| `heal` | Absorbs memories from the air, form solidifies slightly. |
| `hit` | Form distorts, briefly reveals the skeleton beneath, reforms. |
| `death` | Finally finds the book it was looking for, reads it, smiles, fades peacefully to nothing. |

---

## ACT 3: THE ARCHIVE — Elites (2)

#### 82. The Dunning-Kruger (swooper)
*Chain multiplier nullifier. Knowledge Chains flatline at 1.0x.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Overconfident creature puffed up beyond its size, strutting, radiating an aura of false competence. |
| `attack` | Nullification strike — slashes with claws that leave void trails, cutting through knowledge chains. |
| `debuff` | Chain disruption — radiates a disruptive field that flattens all multipliers visually. |
| `defend` | Puffs up even larger, null barrier visible as flat grey zone. |
| `hit` | Deflates slightly, looks shocked that something could hurt it. |
| `death` | Reality check hits — rapidly shrinks to true tiny size, looks terrified, pops like a bubble. |

#### 83. The Singularity (caster)
*Quick Play resistant (30% damage). Must Charge.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Dense gravitational anomaly, light bending around it, books and debris orbiting at high speed. |
| `attack` | Gravitational pulse flings debris forward. |
| `buff` | Gravitational pull increases, more debris captured, field strengthens. |
| `defend` | Event horizon darkens, light cannot escape, attacks absorbed. |
| `hit` | Orbit destabilizes briefly, debris flies off, restabilizes. |
| `death` | Gravity reverses, everything blasts outward, singularity winks out. |

---

## ACT 3: THE ARCHIVE — Bosses (2)

#### 84. The Omnibus (slammer)
*Built from compressed books. Wrong answers feed it power.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Massive golem made of thousands of compressed books, pages riffling, text scrolling across its surface. |
| `attack` | Tome slam — one book-fist crashes down with the weight of a library. |
| `defend` | Pages fan out forming a wall of text, each page a shield. |
| `buff` | Absorbs text from the air, growing larger and more defined. |
| `charge` | Every page opens simultaneously, energy converging for tome avalanche. |
| `hit` | Pages scatter from impact, text blurs, reforms. |
| `death` | Books lose their binding, pages flutter away in a massive paper storm, cover falls empty. |

#### 85. The Final Lesson (caster, phase 2 at 33%, dual quiz phases)
*Final guardian. Quiz phases at 66% and 33% HP. Second is Rapid Fire.*

| Anim | Motion Summary |
|------|----------------|
| `idle` | Ancient ethereal guardian — crystalline body with rotating knowledge spheres orbiting, serene and terrifying. |
| `attack` | Cataloguing strike — knowledge sphere launches as a projectile. |
| `multi_attack` | Archive barrage — four spheres fire in rapid sequence. |
| `debuff` | Forgotten lore — waves hand, memories blur and distort (weakness). |
| `buff` | Ancient wisdom — absorbs surrounding knowledge, body crystallizes further. |
| `heal` | Restoration protocol — damaged crystals regrow from light. |
| `phase2` | Body transforms from crystalline to pure energy form, knowledge spheres multiply, eyes open across body. |
| `special_quiz` | Quiz phase trigger — all movement stops, body opens revealing a lectern of light, quiz portal manifests. |

---

## Deprecated Enemies (not in active pools — animation optional)

- **The Bookwyrm** (deprecated elite) — lurcher, phase 2
- **The Peer Reviewer** (deprecated elite) — trembler, no-charge punisher

*These are kept in ENEMY_TEMPLATES for save compatibility only. Generate animations only if resources permit.*

---

## Implementation Notes

1. **Total animations**: ~87 enemies x ~6 avg animations = ~522 animations
2. **Priority order**: Bosses first, then elites, then mini-bosses, then commons
3. **Batch by archetype**: Enemies sharing an archetype can share `hit` and `death` animations as fallbacks
4. **Pipeline**: Use `sprite-gen/scripts/animate-sprite.mjs` with `--prompt` flag per animation
5. **File naming**: `{enemy_id}_{anim_key}` (e.g., `page_flutter_idle`, `page_flutter_attack`)
6. **Output**: Spritesheet PNG for Phaser integration, APNG for preview

## Verification
- Cross-reference this doc against `ACT_ENEMY_POOLS` in `src/data/enemies.ts` to confirm all 87 active enemies are covered
- Verify each enemy's animation list matches their actual `intentPool` types
- Test sample prompts through the LTX pipeline to confirm quality before batch processing
- After generation, wire spritesheets into `EnemySpriteSystem.ts` to replace procedural tweens

# AR-256: World War II Curated Deck

**Revised 2026-03-25**: Expanded to ~970 facts across 16 subdecks. Encyclopedic scale per deck-master skill (Deep domain, user requested 800-1200 facts). Every subdeck 50-70 facts. Major figures get 5-8 facts each. Full narrative arcs for every campaign.

## Overview
- **Goal**: Build the definitive WWII curated deck (H-02) — encyclopedic depth where players truly "know WWII"
- **Domain**: `history`, **subDomain**: `world_war_ii`
- **Scale**: ~970 facts across 16 subdecks (50-70 facts each)
- **Dependencies**: None — curated deck system is fully implemented
- **Complexity**: Very large (content generation + assembly, no code changes needed)

---

## 🚨🚨🚨 SOURCING RULE — READ BEFORE ANY GENERATION 🚨🚨🚨

**EVERY fact in this deck MUST be generated from pre-verified source data, NEVER from LLM training knowledge.**

On 2026-03-25, an initial batch of ~270 facts was thrown away because workers generated facts from their training knowledge with fake Wikipedia URLs they never actually consulted. This wasted hours of compute.

### Required workflow for EACH subdeck:
1. **Research phase**: Orchestrator or Explore agent looks up EVERY data point from Wikipedia/Wikidata using WebSearch/WebFetch. Dates, casualty figures, names, quotes, superlatives — ALL verified.
2. **Architecture YAML**: Verified data written into `world_war_ii_arch.yaml` with source URLs for each claim.
3. **Fact generation**: Workers receive the verified source data IN THEIR PROMPT and FORMAT it into DeckFact JSON. Workers COPY data from verified sources. They do NOT recall, approximate, or invent ANY factual content.
4. **QA review**: Every fact checked against the original source URLs.

### What this means practically:
- Before generating Road to War facts → verify every date, every name, every claim against Wikipedia/Wikidata
- Before generating Eastern Front facts → look up every battle date, casualty figure, commander name
- Before generating Holocaust facts → verify every camp's death toll, every rescue figure, every date against USHMM/Wikipedia
- Numbers like "6 million Jews", "80,000 at Hiroshima", "338,000 at Dunkirk" → MUST come from a verified source, not LLM memory
- Quotes like "sleeping giant", "day of infamy", "we shall fight on the beaches" → verify the actual quote and attribution

### Workers are FORMATTERS, not RESEARCHERS.
They take verified data → produce JSON. That is their ONLY job.

---

## SubDeck Structure

| # | SubDeck ID | Name | Facts | Description |
|---|-----------|------|-------|-------------|
| 1 | `road_to_war` | Road to War (1919-1939) | 60 | Interwar period, rise of fascism, appeasement, Japanese expansion |
| 2 | `western_front` | Western Front | 70 | Fall of France, D-Day, Liberation, push into Germany |
| 3 | `eastern_front` | Eastern Front | 70 | Barbarossa, Stalingrad, Kursk, Bagration, fall of Berlin |
| 4 | `pacific_theater` | Pacific Theater | 70 | Pearl Harbor, Midway, island-hopping, atomic bombs, surrender |
| 5 | `china_southeast_asia` | China & Southeast Asia | 50 | Sino-Japanese War, Burma campaign, SEA occupation |
| 6 | `north_africa_mediterranean` | North Africa & Mediterranean | 50 | Desert war, El Alamein, Sicily, Italian campaign |
| 7 | `allied_leaders` | Allied Leaders & Commanders | 60 | Churchill, FDR, Stalin, Eisenhower, Montgomery, Zhukov, etc. |
| 8 | `axis_leaders` | Axis Leaders & Commanders | 50 | Hitler, Mussolini, Tojo, Rommel, Yamamoto, Himmler, etc. |
| 9 | `the_holocaust` | The Holocaust | 60 | Genocide progression, camps, ghettos, resistance, rescue, memory |
| 10 | `technology_weapons` | Technology & Weapons | 60 | Tanks, aircraft, ships, atomic bomb, radar, medicine, codebreaking |
| 11 | `naval_air_warfare` | Naval & Air Warfare | 55 | Battle of Atlantic, Pacific naval, strategic bombing campaigns |
| 12 | `home_front_civilians` | Home Front & Civilians | 55 | US, UK, USSR, Germany, Japan, China civilian experience |
| 13 | `resistance_espionage` | Resistance & Espionage | 55 | Resistance movements worldwide + intelligence operations |
| 14 | `alliances_diplomacy` | Alliances & Diplomacy | 50 | Conferences, treaties, wartime politics, neutral nations |
| 15 | `aftermath_legacy` | Aftermath & Legacy | 55 | Nuremberg, Cold War, decolonization, cultural memory |
| 16 | `wartime_culture_propaganda` | Wartime Culture & Propaganda | 50 | Films, posters, music, literature, correspondents, propaganda |

---

## Sub-Steps

### 1. Create/Update Architecture YAML
**File**: `data/deck-architectures/world_war_ii_arch.yaml`
**Acceptance**: All 16 subdecks have comprehensive source data entries.

### 2. Generate SubDeck 1: Road to War (1919-1939) — 60 facts
**Scope**: Treaty of Versailles (war guilt clause, reparations, territorial losses, Article 231), Hitler's rise (Beer Hall Putsch, Mein Kampf, Chancellor appointment, Enabling Act, Reichstag fire, Night of the Long Knives), Mussolini's rise (March on Rome, fascist ideology, Ethiopia invasion), Japanese imperialism (Manchuria invasion, China invasion 1937, Rape of Nanking, League departure), Appeasement (Chamberlain, Munich Agreement, "peace for our time"), Kristallnacht, Anschluss, Rhineland remilitarization, Spanish Civil War (Guernica, testing ground, International Brigades), Molotov-Ribbentrop Pact (and secret protocol), Nuremberg Laws, Anti-Comintern Pact, Rome-Berlin Axis, Weimar Republic (hyperinflation, political instability, culture, Bauhaus), Sudetenland crisis, Czechoslovakia dismemberment, German rearmament, Hitler Youth, Nazi propaganda (Goebbels early role, book burnings), League of Nations failures, Locarno Treaties, Kellogg-Briand Pact (failure), Abyssinia Crisis, Stresa Front collapse, Polish Corridor, Danzig crisis, Polish-British mutual defense pact, Soviet-Japanese border conflicts (Khalkhin Gol), Economic factors (Great Depression fueling extremism), Rise of militarism in Japan.

**Narrative arcs**: Hitler's rise (8+ connected facts), appeasement failure arc, Japanese imperial expansion arc, Versailles consequences arc, Weimar to Nazi transition.

### 3. Generate SubDeck 2: Western Front — 70 facts
**Scope**: Fall of France (Sedan breakthrough, Ardennes, armistice, Vichy regime, Free French), Dunkirk evacuation (miracle, little ships, 338K, Churchill speech), Battle of Britain (RAF, "The Few", Blitz begins), Phoney War, Norway/Denmark invasion (1940), D-Day planning (deception ops, Fortitude, weather decision), D-Day execution (5 beaches, Omaha bloodiest, airborne drops, Rangers at Pointe du Hoc), Normandy breakout (Operation Cobra, hedgerow fighting, Falaise Pocket), Liberation of Paris (Aug 25, de Gaulle's march, FFI uprising), Market Garden ("Bridge Too Far", Arnhem disaster), Battle of the Bulge (surprise, Bastogne "Nuts!", Malmedy massacre), Hürtgen Forest (forgotten battle, high casualties), Rhine crossing (Remagen bridge, Operation Plunder), Liberation of Western Europe (Belgium, Netherlands), Fall of Berlin from Western perspective (link-up at Elbe), V-E Day (May 8 1945, celebrations worldwide), Maginot Line (why it failed — bypassed via Belgium), Channel Islands (only British soil occupied), Dieppe Raid (1942, lessons for D-Day), Atlantic Wall defenses, Bocage fighting, Operation Dragoon (Southern France invasion), Colmar Pocket, Siegfried Line, Ruhr Pocket (300K German POWs), Liberation of concentration camps (Dachau, Bergen-Belsen — Allied soldiers' shock), German surrender at Reims (May 7), Aftermath in France (collaboration trials, épuration), Occupation of Germany begins.

Plus: French Resistance D-Day role, Belgian Resistance, Dutch Resistance (Arnhem), civilian casualties in France, bombing of French cities, V-1/V-2 attacks on London/Antwerp, war correspondents on Western Front.

**Narrative arcs**: Fall of France arc (5+ facts), D-Day through liberation arc (10+ facts), Battle of the Bulge arc, Western Allied advance to Germany.

### 4. Generate SubDeck 3: Eastern Front — 70 facts
**Scope**: Operation Barbarossa (3 army groups, scale, initial success, Soviet surprise), Battle of Moscow (Dec 1941, Soviet counteroffensive, General Winter), Siege of Leningrad (900 days, Road of Life, 1M+ civilian dead), Battle of Stalingrad (encirclement, Paulus surrender, turning point, urban warfare), Battle of Kursk (largest tank battle, Prokhorovka, Soviet defense in depth), Operation Bagration (1944, destruction of Army Group Center, larger than D-Day), Soviet advance through Eastern Europe (1944-45), Fall of Berlin (Soviet assault, Reichstag flag, Hitler's suicide), Siege of Sevastopol, Kharkov battles (multiple), Partisan warfare behind German lines, Soviet scorched earth policy, Soviet war production (moved factories east), Soviet women in combat (snipers, pilots, soldiers), Lend-Lease to Soviet Union (significance, controversy), Eastern Front brutality (no quarter, Commissar Order), Generalplan Ost (Nazi plans for Eastern Europe), Soviet POW treatment by Germans (3.3M died in captivity), German POW treatment by Soviets, Operation Citadel, Demyansk Pocket, Caucasus campaign (oil), Crimea campaigns, Liberation of Ukraine, Vistula-Oder Offensive, Soviet entry into Prague, Katyn massacre (Soviet murder of Polish officers), Warsaw Uprising (1944, Soviet betrayal), Romania switches sides (1944), Hungary (Arrow Cross, Budapest siege), Finnish continuation war, Soviet-Finnish armistice, Yugoslavia liberation, Breslau siege, Königsberg, Order 227 ("Not one step back"), Penalty battalions, Zhukov's role throughout.

Plus: Scorched earth retreat, winter warfare challenges, scale comparison to Western Front (80% of German casualties on Eastern Front), Soviet logistics, Soviet tank production (T-34 mass production), Katyusha rockets in battle.

**Narrative arcs**: Barbarossa to Moscow arc, Stalingrad arc (6+ facts), Kursk through Bagration arc, Soviet march to Berlin arc, siege arcs (Leningrad, Stalingrad, Sevastopol).

### 5. Generate SubDeck 4: Pacific Theater — 70 facts
**Scope**: Pearl Harbor (attack details, "day of infamy", fleet damage, conspiracy theories), Battle of Midway (turning point, codebreaking, 4 carriers sunk), Guadalcanal (first offensive, Henderson Field, naval battles), Island-hopping strategy (bypass and isolate), Iwo Jima (flag-raising, strategic importance, casualties), Battle of Okinawa (bloodiest, civilian casualties, kamikaze), Hiroshima (Little Boy, Enola Gay, 80K immediate, long-term effects), Nagasaki (Fat Man, Bock's Car, debate over second bomb), Manhattan Project (Trinity test, Los Alamos, Oppenheimer, secrecy), Bataan Death March (atrocity, POW suffering), V-J Day (Aug 15, dancing in streets), USS Missouri surrender (Sep 2, formal ceremony), Doolittle Raid (morale, retaliation), Kamikaze (origin, effectiveness, at Okinawa), Burma Road/campaign (Merrill's Marauders, Chindits, Wingate), Battle of Leyte Gulf (largest naval battle, 4 engagements), Fall of Singapore ("worst disaster", 80K POWs), Kokoda Track (Australian defense), Tokyo firebombing (March 1945, 100K dead, more than either atomic bomb), Battle of Tarawa (bloody assault, lessons learned), Battle of the Philippine Sea ("Great Marianas Turkey Shoot"), Mariana Islands (B-29 bases), Battle of Saipan (civilian suicides), Battle of Peleliu (controversial, unnecessary?), Corregidor (fall and return), POW camps (Changi, Cabanatuan, conditions), Thai-Burma Railway ("Bridge on River Kwai", 12K+ Allied POWs died), Comfort women, Wake Island defense, Flying Tigers (Chennault, AVG, China), MacArthur's return to Philippines, Soviet entry (Aug 8), Japanese holdouts (Onoda, decades later), Potsdam Declaration, Atomic bomb debate (Stimson, Truman, invasion estimates), Firebombing campaign (LeMay, 67 cities), Submarine warfare (US subs destroyed Japanese merchant fleet), Battle of the Coral Sea (first carrier vs carrier), Japanese code (Purple, Magic), Greater East Asia Co-Prosperity Sphere, Japanese occupation brutality, Australian war in Pacific, New Zealand at Pacific, Liberation of Philippines, Japanese balloon bombs, Enola Gay crew, Bockscar crew, Tinian Island (B-29 base), Imperial Conference (surrender decision), Hirohito's radio address.

**Narrative arcs**: Pacific turning point (Pearl Harbor → Coral Sea → Midway), island campaign progression, atomic bomb decision arc (5+ facts), fall of Japan arc, POW experience arc.

### 6. Generate SubDeck 5: China & Southeast Asia — 50 facts
**Scope**: Second Sino-Japanese War (1937-1945, scale, casualties 15-20M Chinese), Rape of Nanking (1937, atrocity, 200K-300K killed), Marco Polo Bridge Incident (war begins), Battle of Shanghai (1937), Chongqing bombing (strategic bombing of Chinese capital), Burma campaign (3 campaigns, Stilwell, Slim), Fall of Burma (1942), Chindits (Wingate's long-range penetration), Merrill's Marauders, Imphal-Kohima (turning point, "Stalingrad of the East"), Reconquest of Burma (1944-45), Fall of Malaya (bicycle blitzkrieg), Fall of Hong Kong (Christmas 1941), Fall of Dutch East Indies, Thailand's role (alliance with Japan), French Indochina under Japan, Siam-Burma Railway, Comfort women in occupied territories, Japanese occupation of Philippines, Bataan (cross-ref Pacific), Chinese Communist-Nationalist cooperation (and tensions), Mao's guerrilla tactics, Stilwell vs Chiang Kai-shek (Vinegar Joe), The Hump (aerial supply over Himalayas), Ledo Road (replacing Burma Road), Indian National Army (Bose, collaboration), Battle of Singapore (cross-ref), Malayan People's Anti-Japanese Army, Indonesia under Japan, Vietnamese resistance (Ho Chi Minh, Viet Minh origins), Korean forced labor, Unit 731 (biological warfare experiments, war crime), Indian Ocean raids (Japanese navy), Battle of the Java Sea, Sook Ching massacre (Singapore), Chinese Expeditionary Force in Burma, Operation Ichi-Go (1944, Japanese offensive in China), Dixie Mission (US observers with Chinese Communists), Famine in Bengal (1943, 2-3M dead, British responsibility debate), SEAC (Southeast Asia Command, Mountbatten), Force 136 (SOE in Asia), Atomic bombs' role in preventing Soviet invasion of Japan, Legacy: seeds of Chinese Civil War, Vietnamese independence, Korean division, Indonesian independence.

**Narrative arcs**: China's forgotten war arc, Burma campaign arc, Japanese conquest of Southeast Asia, decolonization seeds.

### 7. Generate SubDeck 6: North Africa & Mediterranean — 50 facts
**Scope**: Italian entry into war (June 1940, disaster in Libya and Greece), British Western Desert Force (O'Connor, Compass), Rommel arrives in Africa (Feb 1941), Siege of Tobruk ("Rats of Tobruk", Australian defense), Operation Crusader, Battle of Gazala (Rommel's masterpiece), Fall of Tobruk (June 1942, Churchill's "disgrace"), First Battle of El Alamein (July 1942, stopping Rommel), Second El Alamein (Oct 1942, Montgomery's victory, "beginning of the end"), Operation Torch (Nov 1942, Eisenhower, US entry), Kasserine Pass (US first defeat, lessons), Tunisia campaign (final Axis surrender, 230K+ POWs), Invasion of Sicily (Husky, Patton vs Montgomery, Mafia connection), Fall of Mussolini (July 1943, Grand Council vote), Italian armistice (Sep 1943), German occupation of Italy, Salerno landings, Anzio (Jan 1944, beachhead stalemate, breakout), Gustav Line, Monte Cassino (4 battles, monastery bombing controversy), Gothic Line, Liberation of Rome (Jun 4 1944, overshadowed by D-Day), Bologna and Po Valley, Italian partisans (CLN, 1943-45), Mussolini's rescue by Skorzeny, Italian Social Republic (Salò), Greek campaign (1940-41, Italian failure, German intervention), Battle of Crete (first airborne invasion, pyrrhic German victory), Malta siege (most-bombed, George Cross), Taranto raid (British carrier attack, blueprint for Pearl Harbor), Italian navy, Long Range Desert Group, SAS origins (Stirling), French North Africa politics (Vichy, Darlan Deal), Free French forces (Leclerc, Bir Hakeim), Desert warfare (logistics, terrain, water), Suez Canal strategic importance, Mediterranean supply routes, Gibraltar's role, North Africa as stepping stone to Europe, Italian East Africa (Ethiopia, Eritrea, Somalia), Allied logistics achievement.

**Narrative arcs**: Desert war arc (Compass → Rommel → El Alamein → Torch → Tunisia), Italian campaign arc (Sicily → Salerno → Cassino → Rome → Gothic Line), Mediterranean naval arc.

### 8. Generate SubDeck 7: Allied Leaders & Commanders — 60 facts
Multi-fact coverage:
- **Churchill** (6-8): Becomes PM May 1940, "we shall fight on the beaches" speech, "their finest hour", relationship with FDR, wartime leadership style (cigar, bunker, morale), disagreements with generals, Iron Curtain speech, electoral defeat 1945
- **FDR** (5-6): Arsenal of Democracy, Lend-Lease architect, Four Freedoms, relationship with Churchill, Yalta health, death April 1945 (Truman inherits)
- **Stalin** (5-6): Purge of Red Army officers, paranoia (ignored Barbarossa warnings), Order 227, wartime recovery, Stalingrad obsession, postwar territorial demands
- **Eisenhower** (4-5): Supreme Commander selection, D-Day weather decision, D-Day message to troops, broad front strategy, liberation of camps reaction
- **Truman** (3-4): Becomes president unexpectedly, atomic bomb decision, Potsdam, recognition of Israel
- **Montgomery** (3): El Alamein, D-Day ground commander, Market Garden, rivalry with Patton
- **Patton** (3-4): Third Army speed, Battle of the Bulge relief, slapping incident, personality/quotes
- **Zhukov** (3-4): Defense of Moscow, Stalingrad planning, Berlin capture, most decorated Soviet commander
- **MacArthur** (3-4): Philippines "I shall return", island-hopping commander, Japan occupation architect, ego/controversy
- **Nimitz** (2-3): Pacific Fleet, Midway decision, island-hopping vs MacArthur debate
- **de Gaulle** (2-3): Free French, liberation march, postwar France
- **Marshall** (2): Army Chief of Staff, Marshall Plan architect
- **Mountbatten** (1-2): SEAC commander
- **Slim** (1-2): Burma campaign, "forgotten army"
- **Chiang Kai-shek** (2): China theater, tensions with Stilwell, postwar loss to communists
- **Tito** (2): Yugoslav partisans, unique resistance
- **King** (1): Mackenzie King, Canadian contribution
- **Curtin** (1): Australian PM, turned to US for defense

### 9. Generate SubDeck 8: Axis Leaders & Commanders — 50 facts
Multi-fact coverage:
- **Hitler** (8-10): Beer Hall Putsch, Mein Kampf, Chancellor appointment, Night of the Long Knives, military decision-making (overriding generals), Stalingrad obsession, Fortress Europe delusion, assassination attempts (July 20 plot), bunker final days, suicide Apr 30 1945, "Nero Decree" (scorched earth)
- **Mussolini** (4-5): March on Rome, fascist ideology, Ethiopia conquest, war disasters, overthrow, rescue by Skorzeny, execution by partisans
- **Tojo** (3): Prime Minister, Pearl Harbor decision, war crimes trial/execution
- **Rommel** (3-4): Desert Fox reputation, tactical genius, forced suicide (July 20 connection), chivalry reputation (debate)
- **Yamamoto** (3): Pearl Harbor planner, "sleeping giant" quote, killed 1943 (codebreaking)
- **Hirohito** (3): Role debate (figurehead vs decision-maker), radio surrender (first time heard), postwar immunity
- **Himmler** (2-3): SS head, Holocaust architect, attempted surrender negotiation, suicide
- **Goebbels** (2-3): Propaganda minister, total war speech, family murder-suicide in bunker
- **Göring** (2): Luftwaffe commander, promised to destroy RAF, Nuremberg trial, suicide
- **Dönitz** (2): U-boat commander, succeeded Hitler, surrendered Germany
- **Heydrich** (2): "Butcher of Prague", Wannsee Conference chair, assassination (Operation Anthropoid)
- **Speer** (1-2): Armaments minister, Nuremberg "the good Nazi" myth
- **Guderian** (1-2): Panzer pioneer, Blitzkrieg architect
- **Manstein** (1): Eastern Front strategist
- **Kesselring** (1): Mediterranean/Italian theater
- **Yamashita** (1): "Tiger of Malaya", war crimes trial

### 10. Generate SubDeck 9: The Holocaust — 60 facts
**SENSITIVITY**: funScore 5-7 only. Dignified explanations contextualizing human impact. No flippant distractors. Include resistance/rescue. No graphic violence in visualDescription.

**Scope**: 6 million Jews murdered (two-thirds of European Jews), Auschwitz-Birkenau (1.1M killed, largest camp, selection process), Treblinka (800K+, second deadliest), Sobibor (uprising, prisoner revolt succeeded), Majdanek, Belzec, Chelmno (first extermination camp), Wannsee Conference (Jan 1942, bureaucratic planning), Kristallnacht (cross-ref), Nuremberg Laws progression, Anne Frank (diary, hiding, betrayal, Bergen-Belsen death), Warsaw Ghetto (conditions, 400K people in 3.4 km², uprising 1943), Lodz Ghetto (last to be liquidated), Roma/Sinti genocide (Porajmos, 220K-500K), Einsatzgruppen (mobile killing, 1.5M+), Babi Yar (33,771 in 2 days, largest single massacre), Raoul Wallenberg (Swedish passports, disappeared), Oskar Schindler (~1200 saved), Irena Sendler (2500 children from Warsaw Ghetto), Kindertransport (10K children to Britain), Righteous Among the Nations (Yad Vashem program), Holocaust/Shoah terminology, T4 euthanasia program (disabled first victims, 70K), Pink triangle persecution (homosexual men), Jehovah's Witnesses persecution, Political prisoners (red triangle), IBM punch cards, Mengele's experiments, Death marches (1944-45, thousands died), Bergen-Belsen liberation (British shock, bulldozers), Auschwitz liberation (Soviet, Jan 27 1945 — now Holocaust Remembrance Day), Buchenwald liberation (prisoners' self-liberation), Dachau liberation, Nuremberg Trials principle ("following orders" no defense), Eichmann trial (1961, Jerusalem, Arendt's "banality of evil"), Nuremberg Laws to Final Solution — escalation timeline, Jewish partisan fighters (Bielski brothers), Sonderkommando revolt (Auschwitz, Oct 1944), Ghettoization process across Europe, "Final Solution" terminology, Jewish Councils (Judenräte, impossible choices), Transit camps (Westerbork, Drancy), Rescue in Denmark (~7000 evacuated to Sweden), Bulgarian rescue (prevented deportation), Le Chambon-sur-Lignon (French village, sheltered thousands), Concentration vs extermination camp distinction, Slave labor system, Gold teeth and property theft, Post-war displaced persons, Denial and remembrance, Yad Vashem memorial, Stumbling stones (Stolpersteine), "Never again" — lessons and failures.

**Narrative arcs**: Escalation arc (laws → boycotts → Kristallnacht → ghettos → Einsatzgruppen → Wannsee → death camps), resistance arc, rescue arc, liberation arc, memory/justice arc.

### 11. Generate SubDeck 10: Technology & Weapons — 60 facts
**Scope**: Manhattan Project (Trinity test, Los Alamos, Oppenheimer "destroyer of worlds", scale, secrecy), Radar (Chain Home, cavity magnetron, given to US), Enigma machine (Polish origins Rejewski, Turing's Bombe, Ultra intelligence), V-2 rocket (von Braun, first ballistic missile, London attacks), V-1 buzz bomb (first cruise missile), Spitfire (Battle of Britain icon), Hurricane (workhorse of Battle of Britain), Me 262 (first operational jet fighter), B-29 Superfortress (pressurized, long range, atomic delivery), B-17 Flying Fortress (daylight bombing backbone), Lancaster bomber (RAF), Zero fighter (Japanese, early superiority), P-51 Mustang (escort fighter, changed air war), M4 Sherman (reliable, mass-produced, "Ronsons"), Tiger I tank (feared, 88mm), Panther tank (best all-around?), T-34 (Soviet, most influential tank design), Panzer III/IV (Blitzkrieg), Jeep (640K+, iconic), DUKW amphibious vehicle, Higgins boat (D-Day landing craft, "the boat that won the war"), Aircraft carriers (replaced battleships), Submarines (Type VII U-boat, Gato-class), Battleships (obsolescence), Katyusha rockets ("Stalin's Organ"), Penicillin mass production (first mass use), Blood banks (battlefield transfusion), Sulfa drugs, Plastic surgery advances (McIndoe, Guinea Pig Club), ENIAC (early computer, artillery tables), Sonar/ASDIC (U-boat detection), Proximity fuze (VT fuze, most important invention after atomic bomb?), Napalm (first combat use), Flamethrowers (Pacific bunker warfare), Norden bombsight (precision myth), Nuclear physics race (Heisenberg, Farm Hall), Bazookas and Panzerfausts, Jerrican (fuel container design), Amphetamines (Pervitin, used by all sides), Penicillin vs sulfa debate, Fire control computers, IFF (identification friend or foe), Synthetic rubber and oil, German rocket program (Mittelbau-Dora slave labor), Bouncing bomb (Barnes Wallis), Tallboy and Grand Slam bombs, Mulberry harbors (artificial ports for D-Day), PLUTO pipeline (fuel under the Channel), Bailey bridge (engineering marvel), Norden vs area bombing debate, Operational research (scientific management of warfare).

### 12. Generate SubDeck 11: Naval & Air Warfare — 55 facts
**Scope**: Battle of the Atlantic (1939-45, longest campaign, 3 phases), U-boat wolf packs (Dönitz's strategy), "Happy Time" (1940-41), Convoy system (protection, routing), Escort carriers (closing the air gap), Liberty ships (mass production, one per day), Battle of the Coral Sea (first carrier-vs-carrier, ships never saw each other), Battle of Midway (4 carriers in one day, codebreaking), Pearl Harbor naval impact (8 battleships, carriers survived), Sinking of Bismarck (Hood destroyed, chase, torpedo), Tirpitz (threat in Norwegian fjords, final sinking), Yamato (largest battleship, futile last mission), Battle of Leyte Gulf (largest naval battle, 4 separate engagements), Taranto raid (carrier attack on Italian fleet, Pearl Harbor blueprint), Battle of the Java Sea, Arctic convoys (PQ-17 disaster, Murmansk run), D-Day armada (6000+ vessels), PT boats (JFK's PT-109), Kamikaze at Okinawa (1900+ attacks), Battle of the Philippine Sea (Marianas Turkey Shoot), Tokyo Express (Guadalcanal resupply), US submarine campaign (devastated Japanese merchant fleet, 55% losses), German E-boats (Channel attacks), Italian frogmen (daring harbor attacks), Strategic bombing debate (area vs precision), Bomber Command (Harris, area bombing, moral debate), Mighty Eighth (daylight precision bombing), Schweinfurt-Regensburg (heavy losses, temporary halt), Hamburg firebombing (Operation Gomorrah, firestorm), Dresden firebombing (controversy), Tokyo firebombing (deadliest air raid), Berlin bombing campaign, Ploesti oil raids (Romanian refineries), Doolittle's strategy (P-51 escorts, fight the Luftwaffe), Bomber crew survival rates (most dangerous service), Dam Busters (617 Squadron, bouncing bombs), Berlin Airlift (1948-49, candy bombers), Coastal Command (anti-submarine), Night fighter operations, Pathfinder Force (marking targets), Window/chaff (radar countermeasures), Mosquito (de Havilland, "wooden wonder"), Catalina flying boats (maritime patrol), Air transport (Hump, paratroops), Luftwaffe's decline (fuel, pilots, overwhelming numbers).

### 13. Generate SubDeck 12: Home Front & Civilians — 55 facts
**Scope**: Rosie the Riveter (women in factories), Japanese American internment (120K+, Korematsu), The Blitz (1940-41, Underground shelters, spirit), Rationing (victory gardens, "make do and mend"), US war production miracle (Arsenal of Democracy), GI Bill (1944, transformed America), British child evacuation (1.5M+, Operation Pied Piper), Tuskegee Airmen (332nd, Red Tails), Navajo Code Talkers (unbreakable code), "Loose lips sink ships", War bonds campaigns, Double V campaign (victory abroad and at home), Bracero Program (Mexican workers), Zoot Suit Riots (1943), Rosie the Riveter (real woman, Rosie Monroe), Oak Ridge secrecy (75K, Manhattan Project city), Soviet civilian mobilization (total war), Leningrad civilians (starvation, 1M+ dead), Chinese civilian casualties (15-20M total), German civilian experience (bombing, rationing, fear), Japanese civilian experience (firebombing, rationing, militarism), Women in Soviet military (800K served, snipers, pilots), Night Witches (588th Regiment), Lend-Lease ($50B, trucks, food, planes), Manhattan Project compartmentalization, War correspondents (Ernie Pyle, Murrow, Margaret Bourke-White), USO entertainment (Bob Hope, morale), MS St. Louis (refugees turned away), Dunkirk spirit (civilian boats), Coventry bombing, Dresden civilian deaths, Propaganda (US: posters/bonds, UK: "Keep Calm", Soviet: motherland), Axis propaganda (Goebbels machine, Tokyo Rose, Lord Haw-Haw, Axis Sally), Conscientious objectors (Desmond Doss, Hacksaw Ridge), Children's wartime experience, War gardens/victory gardens across nations, Clothing rationing and utility fashion, Wartime romance and "Dear John" letters, Gold Star families, Displaced persons (millions), Refugees and population transfers, Forced labor (millions of civilians), Bengal Famine (1943, 2-3M), Warsaw civilian destruction, Firebombing refugees in Japan, V-weapon terror (V-1/V-2 on London), Returning veterans' challenges (PTSD, reintegration), Baby boom begins.

### 14. Generate SubDeck 13: Resistance & Espionage — 55 facts
**Scope**: French Resistance (maquis, FFI, Jean Moulin, D-Day sabotage), SOE ("set Europe ablaze", training, operations), OSS (Donovan, CIA predecessor), Norwegian heavy water sabotage (Telemark heroes), Ultra intelligence (strategic impact, kept secret until 1974), Enigma Polish origins (Rejewski cracked it first, shared with Britain), Bletchley Park (Turing, Bombe, Colossus, 10K staff, mostly women), Double Cross System (MI5 turned every German agent), Operation Mincemeat (dead body, fake plans, Sicily deception), Operation Fortitude (D-Day deception, phantom army), White Rose (Hans and Sophie Scholl, students executed), Polish Underground State (Home Army, largest resistance), Warsaw Uprising (1944, 63 days, Soviet betrayal), Danish Jewish evacuation (~7K to Sweden in boats), Witold Pilecki (volunteered for Auschwitz, intelligence reports), Dutch Resistance (300K people hidden), Richard Sorge (warned Stalin about Barbarossa, ignored, executed), Philippine guerrillas (tying down Japanese), Jedburgh teams (3-man teams behind lines), Noor Inayat Khan (SOE radio operator, executed Dachau), Nancy Wake ("White Mouse", most decorated servicewoman), Virginia Hall (American, SOE/OSS, artificial leg "Cuthbert"), Canaris (Abwehr chief, secret anti-Hitler), July 20 Plot (Stauffenberg, nearly killed Hitler), Operation Anthropoid (assassination of Heydrich, reprisals Lidice), Italian partisans (CLN, captured Mussolini), Greek resistance (ELAS/EDES, civil war seeds), Yugoslav partisans (Tito, liberated own country), Soviet partisans (behind German lines, massive scale), Belgian Resistance (Comet Line, helping downed airmen), Enigma beyond (Japanese Purple cipher, "Magic"), Bletchley Park women (70%+ of staff), SOE women agents in France (Violette Szabo, Odette), Resistance newspapers (clandestine press), Force 136 (SOE in Asia), Betrayal and collaboration (complexity — Vichy milice, Dutch police), Spy networks in neutral countries (Switzerland, Sweden, Portugal), D-Day intelligence preparation, Coastwatchers (Pacific, behind Japanese lines), Codebreaking at Arlington Hall (US), Camp X (Canadian training), OSS Detachment 101 (Burma, Kachin Rangers), Escape and evasion networks (MI9), "Spy vs Spy" — competing intelligence services.

### 15. Generate SubDeck 14: Alliances & Diplomacy — 50 facts
**Scope**: Atlantic Charter (1941, FDR-Churchill, war aims before US entry), Yalta Conference (Feb 1945, Poland's fate, UN agreement, Soviet Far East entry), Potsdam Conference (Jul 1945, Truman reveals bomb hint, Germany's future), Casablanca Conference (1943, unconditional surrender policy), Tehran Conference (1943, first Big Three, D-Day commitment), Tripartite Pact (1940, formal Axis), Lend-Lease (evolution, $50B, significance), United Nations founding (San Francisco 1945, 51 nations), Declaration of the United Nations (Jan 1942, 26 nations), Big Three dynamics (trust, suspicion, necessity), Axis Powers formation (Anti-Comintern → Tripartite → co-belligerents), Roosevelt-Churchill "special relationship" (personal friendship, disagreements), Stalin's distrust (second front delays, separate peace fears), Four Freedoms (FDR Jan 1941 speech), Unconditional surrender policy (debate, prolonged war?), Bretton Woods (1944, IMF, World Bank, dollar as reserve), Dumbarton Oaks (UN structure), Quebec Conferences (1943, 1944), Cairo Conference (1943, terms for Japan), Percentages Agreement (Churchill-Stalin, Balkans carve-up), Soviet-Japanese Neutrality Pact (1941, broken Aug 1945), Poland's betrayal (allies couldn't protect, Yalta sellout), Finland's position (co-belligerent, not Axis member), Neutral nations roles (Switzerland banking, Sweden iron ore, Spain wolfram, Turkey chrome), Argentina's Axis sympathies, Brazil's contribution (FEB in Italy), India's contribution (2.5M volunteer army, largest ever), Chinese theater diplomacy (Stilwell vs Chiang, competing priorities), War aims divergence (democracy vs communism, seeds of Cold War), Second front pressure (Stalin demanded, Western delays), Italian co-belligerency (1943-45, switching sides), Vichy France diplomatic status, De Gaulle's exclusion from conferences, War crimes emerging as legal concept, Atlantic convoys (US-UK cooperation before Pearl Harbor), Destroyers-for-bases deal (1940, pre-Lend-Lease), Cash and carry, US neutrality acts (and erosion), Pearl Harbor's diplomatic impact (unified US), Latin American declarations of war, Arab world during WWII, Economic warfare (blockades, strategic materials), Diplomatic code-breaking (reading allied communications too), Post-war planning during war (Morgenthau Plan controversy).

### 16. Generate SubDeck 15: Aftermath & Legacy — 55 facts
**Scope**: Nuremberg Trials (1945-46, 22 defendants, 12 death sentences, crimes against humanity established), Tokyo War Crimes Trials (Class A criminals, 7 executions, Tojo), Marshall Plan ($13B, European recovery, Cold War motivation), Cold War origins (wartime tensions, competing ideologies), German occupation zones (4 zones, eventual 2 Germanys), Berlin Blockade (1948-49, airlift, candy bombers), Iron Curtain (Churchill's Fulton speech, 1946), NATO formation (1949, collective defense), Truman Doctrine (1947, containment, Greece/Turkey), Israel creation (1948, Holocaust connection, Arab-Israeli conflict begins), Japanese pacifist constitution (Article 9, renouncing war), Japan under occupation (MacArthur as "American Caesar"), Japan's economic miracle (devastation to 2nd largest economy), Operation Paperclip (von Braun, German scientists to US), Denazification (varied success, Cold War compromised it), Displaced persons (millions of refugees, years in camps), Division of Korea (38th parallel, seeds of Korean War), Chinese Civil War (Communist victory 1949, Mao), Decolonization wave (India 1947, Indonesia, Vietnam, Africa), United Nations (1945, Security Council, Universal Declaration 1948), Geneva Conventions revision (1949), Total death toll (60-85M, largest conflict ever), Rape of Berlin (Soviet troops, mass sexual violence), Women's rights impact (Rosie's legacy, suffrage movements), Baby boom (1946-64, demographic shift), Technological legacy (jet age, nuclear age, computer age, space race seeds), Cultural impact (war literature — Catch-22, Slaughterhouse-Five), War films (evolving portrayal — triumphalist to questioning), War memorials worldwide (Arlington, Normandy, Hiroshima), European Coal and Steel Community (1951, EU origins), Lesson of appeasement (Munich analogy in foreign policy), Lasting territorial changes (Poland shifted west, Kaliningrad), War graves (Commonwealth War Graves Commission), Nuremberg principles (international law precedent), Holocaust education (mandatory in many countries), Comfort women recognition movement, POW repatriation (forced repatriation to USSR, tragedy), German expulsions (12M+ ethnic Germans expelled), Reparations debates, Occupation of Austria, Japanese war guilt debate (textbook controversies), Berlin Wall (1961, Cold War's physical manifestation), Nuclear arms race (H-bomb, MAD doctrine), UN peacekeeping origins, Post-war European recovery timeline, American GI Bill transforming society, Veterans' stories and oral history projects, "Greatest Generation" concept, Legacy of strategic bombing debate, Continuing discoveries (unexploded ordnance, mass graves).

### 17. Generate SubDeck 16: Wartime Culture & Propaganda — 50 facts
**Scope**: Goebbels' propaganda machine (total control, big lie technique), "Keep Calm and Carry On" (actually unused until 2000s), Rosie the Riveter poster (J. Howard Miller, Norman Rockwell version), War bond drives (Hollywood stars, nationwide), Radio propaganda (Tokyo Rose, Lord Haw-Haw, Axis Sally), BBC World Service (coded messages to resistance), Edward R. Murrow ("This is London", bringing war home), Ernie Pyle (GI's correspondent, killed at Ie Shima), Margaret Bourke-White (first female war correspondent accredited), Robert Capa (D-Day photos, "Magnificent Eleven"), "We'll Meet Again" (Vera Lynn, Forces' Sweetheart), "Lili Marleen" (song beloved by both sides), Bob Hope USO tours, Hollywood goes to war (Why We Fight series, Frank Capra), Casablanca (1942, wartime classic), Mrs. Miniver (1942, pro-British propaganda), Nazi propaganda films (Triumph of the Will, Riefenstahl), Soviet propaganda (patriotic war, motherland posters), Japanese propaganda (bushido, sacrifice), V for Victory campaign (Churchill, BBC, morse code ·· · ·−), Kilroy Was Here (GI graffiti), Pin-up culture (Betty Grable, morale), Stars and Stripes newspaper, SHAEF psychological warfare, Leaflet drops (surrender passes), Tokyo firebombing leaflet warnings, Comfort and entertainment for troops, Wartime fashion (utility clothing, make do and mend), Victory gardens (grow your own food, patriotic duty), Wartime rationing culture (recipes, substitutes), Comics (Captain America punching Hitler, Superman), Wartime music (boogie-woogie, swing, Glenn Miller's disappearance), Wartime literature (The Diary of Anne Frank, postwar publication), War poetry (compared to WWI, less prominent), Art during war (war artists program, Paul Nash), Photography's role (documenting atrocities, changing opinion), Censorship (all sides, controlling information), Careless talk campaigns (multiple nations), Children's wartime experience (gas masks, games, play), Disney at war (training films, propaganda), Women in media (rising roles during war), Post-war culture (film noir, existentialism, war's shadow), War on screen evolution (from propaganda to nuance), Band of Brothers / Saving Private Ryan (modern cultural memory), Holocaust in culture (Schindler's List, Maus), Atomic age anxiety in culture, War museums and memory tourism.

---

## Answer Type Pools (expanded for 970 facts)

| Pool ID | Label | Format | ~Size |
|---------|-------|--------|-------|
| `person_names` | Historical Figures | name | 100+ |
| `battle_names` | Battles & Operations | name | 80+ |
| `year_dates` | Years & Dates | year | 60+ |
| `place_names` | Places & Locations | place | 70+ |
| `military_terms` | Military & Political Terms | term | 50+ |
| `country_names` | Countries & Nations | name | 30+ |
| `organization_names` | Organizations & Groups | name | 30+ |
| `weapon_vehicle_names` | Weapons & Vehicles | name | 40+ |
| `number_stats` | Numbers & Statistics | number | 40+ |
| `treaty_conference_names` | Treaties & Conferences | name | 20+ |
| `cultural_works` | Cultural Works & Media | name | 25+ |
| `codename_names` | Operation Codenames | name | 30+ |

## Chain Theme Mapping

| chainThemeId | Theme | Description |
|---|---|---|
| 0 | Allied Powers | US, UK, Soviet Union, Free France, China |
| 1 | Axis Powers | Germany, Japan, Italy |
| 2 | Battles & Campaigns | Military engagements and operations |
| 3 | Human Cost | Holocaust, civilians, atrocities, home front |
| 4 | Technology & Intelligence | Weapons, codebreaking, espionage |
| 5 | Diplomacy & Aftermath | Conferences, treaties, postwar order, culture |

## Difficulty Distribution Target
- Difficulty 1 (universally known): ~12% (~116 facts)
- Difficulty 2 (commonly taught): ~25% (~243 facts)
- Difficulty 3 (requires genuine interest): ~30% (~291 facts)
- Difficulty 4 (specialist knowledge): ~22% (~213 facts)
- Difficulty 5 (expert/counterintuitive): ~11% (~107 facts)

## Sensitivity Guidelines
- **Holocaust facts**: funScore 5-7, dignified explanations, include resistance/rescue, no graphic visualDescriptions
- **Atomic bombings**: factual record with context, plausible distractors
- **War crimes (all sides)**: educational gravity, focus on consequences and lessons
- **Sexual violence**: mention existence for completeness, no graphic detail, focus on justice/recognition
- **Multiple perspectives**: Soviet, Chinese, colonial, civilian, Axis civilian viewpoints

---

## Fact Format Reference

Each fact follows `DeckFact` from `src/data/curatedDeckTypes.ts` plus `variants`:

```json
{
  "id": "wwii_pearl_harbor_date",
  "correctAnswer": "December 7, 1941",
  "acceptableAlternatives": ["Dec 7 1941", "12/7/1941"],
  "chainThemeId": 1,
  "answerTypePoolId": "year_dates",
  "difficulty": 1,
  "funScore": 9,
  "quizQuestion": "On what date did Japan attack Pearl Harbor, bringing the United States into World War II?",
  "explanation": "Japan launched a surprise military strike on Pearl Harbor, Hawaii, on December 7, 1941. President Roosevelt called it 'a date which will live in infamy.' The US declared war on Japan the next day.",
  "visualDescription": "Naval harbor under aerial assault, explosions rising from battleships, planes swooping overhead, thick black smoke",
  "sourceName": "Wikipedia",
  "sourceUrl": "https://en.wikipedia.org/wiki/Attack_on_Pearl_Harbor",
  "volatile": false,
  "distractors": ["June 6, 1944", "September 1, 1939", "August 6, 1945", "December 25, 1941", "November 11, 1941", "October 7, 1941", "January 7, 1942", "March 7, 1941"],
  "variants": [
    {"type": "reverse", "question": "What happened on December 7, 1941?", "correctAnswer": "Japan attacked Pearl Harbor", "distractors": ["Germany invaded Poland", "D-Day landings began", "Germany surrendered"]},
    {"type": "context", "question": "Roosevelt called this date 'a date which will live in infamy.' What happened?", "correctAnswer": "Japan attacked Pearl Harbor", "distractors": ["Germany invaded the Soviet Union", "The atomic bomb was dropped", "D-Day began"]},
    {"type": "true_false", "question": "True or false: Japan attacked Pearl Harbor on December 7, 1941.", "correctAnswer": "True", "distractors": ["False"]},
    {"type": "fill_blank", "question": "Japan attacked Pearl Harbor on ___, bringing the US into WWII.", "correctAnswer": "December 7, 1941", "distractors": ["June 6, 1944", "September 1, 1939", "August 6, 1945"]}
  ]
}
```

---

## Files Affected
- **Create**: `data/deck-architectures/world_war_ii_arch.yaml` (already done, needs expansion)
- **Create**: `data/decks/world_war_ii.json`
- **Modify**: `data/decks/manifest.json`

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Deck loads in dev server
- [ ] All 16 subdecks visible
- [ ] Quiz flow works
- [ ] All answer type pools have >= 5 members
- [ ] Full QA review completed (every fact checked)
- [ ] Holocaust content appropriately toned
- [ ] Cross-subdeck references present (20%+)

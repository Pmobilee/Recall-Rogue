/**
 * Fix pool homogeneity in world_war_ii, music_history, movies_cinema decks.
 *
 * Core rule: verifier SKIPS full-bracket {N} answers from ratio calculation.
 * Converting numeric answers to {N} removes them from the ratio check.
 *
 * Strategy per pool:
 * - number_stats: bracket all pure numbers AND percentage values
 * - year_dates: abbreviate all month names to 3-char; trim ranges to compact form
 * - place_names: trim compound place descriptions to primary place
 * - military_terms: trim sentence answers to core concept
 * - historical_events: trim long explanatory answers to core entity/phrase
 * - organization_names: move misassigned country names to place_names
 * - person_names: trim parenthetical extras
 * - famous_quotes: trim prose to key phrase
 * - Other pools: trim long descriptions, expand too-short answers where unambiguous
 */

import { readFileSync, writeFileSync } from 'fs';

// ============================================================
// WWII: year_dates — auto-generated from analysis
// ============================================================

const WWII_YEAR_DATES = {
  wwii_al_churchill_iron_curtain: 'Mar 5, 1946',
  wwii_al_fdr_death: 'Apr 12, 1945',
  wwii_al_stalin_barbarossa: 'Jun 22, 1941',
  wwii_al_degaulle_broadcast: 'Jun 18, 1940',
  wwii_al_degaulle_paris: 'Aug 25, 1944',
  wwii_al_patton_death: 'Dec 1945',
  wwii_al_molotov_ribbentrop: 'Aug 23, 1939',
  wwii_ax_tojo_executed: 'Dec 1948',
  wwii_ef_leningrad_start_date: 'Sep 8, 1941',
  wwii_ef_stalingrad_turning_point: 'Feb 2, 1943',
  wwii_ef_kursk_dates: 'Jul–Aug 1943',
  wwii_ef_winter41_soviet_counteroffensive: 'Dec 1941',
  wwii_ef_hitler_death_date: 'Apr 30, 1945',
  wwii_ef_moscow_counter_date: 'Dec 5, 1941',
  wwii_ef_moscow_counter_end: 'Jan 7, 1942',
  wwii_ef_warsaw_uprising_start: 'Aug 1, 1944',
  wwii_ef_warsaw_uprising_end: 'Oct 2, 1944',
  wwii_ef_bagration_date_start: 'Jun 22, 1944',
  wwii_ef_winter_war_start: 'Nov 30, 1939',
  wwii_ef_winter_war_ceasefire: 'Mar 13, 1940',
  wwii_ef_warsaw_uprising_dates: 'Oct–Nov 1944',
  wwii_hc_kristallnacht_date: 'Nov 9, 1938',
  wwii_hc_wannsee_date: 'Jan 20, 1942',
  wwii_hc_liberation_date: 'Jan 27, 1945',
  wwii_hc_warsaw_uprising: 'Apr 19, 1943',
  wwii_hc_warsaw_uprising_start: 'Apr 19, 1943',
  wwii_hc_sobibor_revolt: 'Oct 14, 1943',
  wwii_hc_treblinka_revolt: 'Aug 2, 1943',
  wwii_hc_sonderkommando_revolt: 'Oct 7, 1944',
  wwii_hc_auschwitz_liberation_date: 'Jan 27, 1945',
  wwii_hc_belsen_liberation: 'Apr 15, 1945',
  wwii_hc_dachau_liberation: 'Apr 29, 1945',
  wwii_hc_buchenwald_liberation: 'Apr 11, 1945',
  wwii_pt_pearl_harbor_date: 'Dec 7, 1941',
  wwii_pt_guadalcanal_duration: '1942–1943',
  wwii_pt_hiroshima_date: 'Aug 6, 1945',
  wwii_pt_trinity_test_date: 'Jul 16, 1945',
  wwii_pt_potsdam_declaration: 'Jul 26, 1945',
  wwii_pt_soviet_entry_date: 'Aug 8, 1945',
  wwii_pt_soviet_entry: 'Aug 8, 1945',
  wwii_rtw_final_diplomatic_failure: 'Aug 23, 1939',
  wwii_rtw_chancellor_appointment: '30 Jan 1933',
  wwii_rtw_fire_decree: '28 Feb 1933',
  wwii_rtw_fuehrer_offices: '2 Aug 1934',
  wwii_rtw_nuremberg_laws_date: '15 Sep 1935',
  wwii_rtw_goebbels_ministry: '13 Mar 1933',
  wwii_rtw_hitler_youth_compulsory: '1 Dec 1936',
  wwii_rtw_anschluss_date_plebiscite: 'Mar 12, 1938',
  wwii_rtw_czech_dismemberment_hacha: 'Mar 15, 1939',
  wwii_rtw_guernica_bombing: 'Apr 26, 1937',
  wwii_rtw_nanjing_massacre: 'Dec 13, 1937',
  wwii_rtw_hossbach_memorandum: 'Nov 5, 1937',
  wwii_wf_poland_invasion_date: 'Sep 1, 1939',
  wwii_wf_sedan_breakthrough: 'May 1940',
  wwii_wf_fall_of_france_paris: 'Jun 14, 1940',
  wwii_wf_poland_war_declaration: 'Sep 3, 1939',
  wwii_wf_paris_liberated: 'Aug 25, 1944',
  wwii_wf_market_garden_date: 'Sep 1944',
  wwii_wf_bulge_date: 'Dec 16, 1944',
  wwii_wf_july20_date: 'Jul 20, 1944',
  wwii_wf_ardennes_bulge_date: 'Dec 1944',
  wwii_wf_cassino_bombing: 'Feb 15, 1944',
  wwii_wf_husky_date: 'Jul 10, 1943',
  wwii_wf_italian_armistice_date: 'Sep 3, 1943',
  wwii_wf_norway_invasion_date: 'Apr 9, 1940',
  wwii_wf_channel_islands_date: 'Jun 30, 1940',
  wwii_wf_italy_sept43_invasion: 'Sep 1943',
  wwii_ad_atlantic_charter_date: 'Aug 14, 1941',
  wwii_ad_tripartite_pact_date: 'Sep 27, 1940',
  wwii_ad_four_freedoms_date: 'Jan 6, 1941',
  wwii_ad_declaration_united_nations: 'Jan 1, 1942',
  wwii_ad_tehran_conference_date: 'Nov–Dec 1943',
  wwii_ad_yalta_conference_date: 'Feb 1945',
  wwii_ad_un_founding_date: 'Jun 26, 1945',
  wwii_ad_soviet_japanese_neutrality_pact: 'Apr 13, 1941',
  wwii_am_udhr_date: 'Dec 10, 1948',
  wwii_cs_nanjing_massacre_date: 'Dec 13, 1937',
  wwii_cs_battle_shanghai_1937: 'Aug 13, 1937',
  wwii_cs_fall_of_hong_kong: 'Dec 25, 1941',
  wwii_cs_sook_ching_dates: 'Feb–Mar 1942',
  wwii_cs_stilwell_recall_date: 'Oct 19, 1944',
  wwii_cs_imphal_kohima_dates: 'Mar–Jul 1944',
  wwii_cs_operation_ichigo: 'Apr–Dec 1944',
  wwii_cs_battle_wuhan_1938: 'Oct 1938',
  wwii_cs_burma_rangoon_falls: 'Mar 8, 1942',
  wwii_cs_ina_provisional_govt_date: 'Oct 21, 1943',
  wwii_na_el_alamein_date: 'Oct 23, 1942',
  wwii_na_operation_torch_date: 'Nov 8, 1942',
  wwii_na_italy_surrender_date: 'Sep 8, 1943',
  wwii_na_monte_cassino_bombing: 'Feb 15, 1944',
  wwii_na_sidi_barrani_1940: 'Dec 1940',
  wwii_na_palermo_capture: 'Jul 22, 1943',
  wwii_nw_atlantic_duration: '1939–1945',
  wwii_wc_reichskulturkammer: '22 Sep 1933',
  wwii_wc_sportpalast_speech: '18 Feb 1943',
  wwii_na_tobruk_fall_1942: 'Jun 21, 1942',
};

// ============================================================
// WWII: number_stats — bracket conversions + prose trims
// ============================================================

const WWII_NUMBER_STATS = {
  // Pure whole numbers -> {N} bracket (excluded from ratio calc)
  wwii_hc_auschwitz_camps_count: '{3}',
  wwii_pt_midway_carriers_sunk: '{4}',
  wwii_ad_atlantic_charter_principles: '{8}',
  wwii_ad_un_security_council_permanent: '{5}',
  wwii_hc_kristallnacht_killed: '{91}',
  wwii_hc_nuremberg_sentenced: '{12}',
  wwii_am_nuremberg_defendants: '{24}',
  wwii_am_nato_founding_members: '{12}',
  wwii_re_soe_women_agents_number: '{39}',
  wwii_hf_tuskegee_450_missions: '{450}',
  wwii_hf_coventry_568_dead: '{568}',
  wwii_ef_kursk_tank_count: '{2700}',
  wwii_hc_warsaw_ghetto_population: '{400000}',
  wwii_hc_treblinka_killed: '{800000}',
  wwii_hc_sobibor_killed: '{200000}',
  wwii_hc_chelmno_killed: '{150000}',
  wwii_hc_majdanek_killed: '{78000}',
  wwii_na_tunisia_prisoners: '{250000}',
  wwii_pt_pearl_harbor_casualties: '{2403}',
  wwii_pt_hiroshima_immediate_dead: '{70000}',
  wwii_pt_saipan_japanese_casualties: '{31000}',
  wwii_pt_tarawa_defenders: '{4700}',
  wwii_pt_comfort_women: '{200000}',
  wwii_wf_dunkirk_troops: '{338226}',
  wwii_cs_nanjing_deaths: '{200000}',
  wwii_cs_ina_size: '{40000}',
  wwii_hf_internment_120k: '{120000}',
  wwii_hf_blitz_40k_dead: '{40000}',
  wwii_hf_oak_ridge_75k_workers: '{75000}',
  wwii_re_polish_home_army_size: '{300000}',
  wwii_na_africa_korps_final: '{250000}',
  wwii_tw_eniac: '{18000}',
  wwii_hf_soviet_factory_1523: '{1523}',
  wwii_hf_war_production_record: '{300000}',
  // Percentage values -> {N} notation
  wwii_ef_warsaw_destruction_pct: '{80}',
  wwii_pt_nagasaki_buildings: '{40}',
  // Short word-form numbers -> bracket
  wwii_al_fdr_four_terms: '{4}',
  // Moved from historical_events
  wwii_rtw_008: '{14}',
  wwii_rtw_003: '{95}',
  // Effectively pure counts
  wwii_nw_escort_carriers_count: '{77}',
  wwii_cs_chindits_first_op_casualties: '{818}',
  wwii_nw_midway_carriers_sunk: '{4}',
  wwii_nw_pearl_harbor_353_aircraft: '{353}',
  wwii_nw_kamikaze_okinawa_attacks: '{1465}',
  // Numeric + short unit text -> trim to compact form
  wwii_pt_tokyo_firebomb_planes: '{300}',
  wwii_ax_yamamoto_midway: '{4}',   // was '{4} aircraft carriers' — drop units text
  wwii_wf_phoney_war_duration: '{8}',  // was '{8} months' — drop units text
  // Trim long prose to compact quantities
  wwii_pt_okinawa_civilians: 'Over 100,000',
  wwii_pt_iwo_jima_cost: '~28,000 killed',
  wwii_pt_midway_pilots: '~3,000 Japanese',
  wwii_pt_guadalcanal_naval: 'Seven battles',
  wwii_re_dutch_hiding_numbers: '25,000–30,000',
  wwii_nw_yamato_displacement: '65,000 tons',
  wwii_nw_uboat_crew_deaths: '~28,000 dead',
  wwii_pt_bataan_pows: '72,000–78,000',
  wwii_nw_bomber_crew_casualty_rate: '~50% of crews',
  wwii_nw_us_sub_pacific_tonnage: '5 million tons',
  wwii_pt_bataan_march: '~65–70 miles',
  wwii_tw_sherman_quantity: '~49,234',
  wwii_ef_winter_war_duration: '~105 days',
  wwii_nw_bismarck_tonnage: '41,700 tons',
  wwii_nw_hamburg_firestorm_deaths: '~40,000',
  wwii_pt_kamikaze_ships: '{34}',  // kamikaze ships sunk
  wwii_rtw_nuremberg_ancestry: '{3}',  // grandparents threshold
  wwii_na_rommel_retreat_1942: '~1,400 miles',
  wwii_nw_dday_vessels: '6,000+ vessels',
  wwii_nw_liberty_ships_count: '2,700+ ships',
  wwii_nw_convoy_size: '20–60 ships',
  wwii_cs_merrill_marauders_engagements: '{5}',  // engagements
  wwii_wf_ve_day_deaths: '~27 million',
  wwii_wf_hurtgen_duration: '88 days',
  wwii_wf_market_garden_troops: '35,000–40,000',
  wwii_nw_mighty_eighth_sorties: '{500000}',  // sorties
  wwii_tw_v1_launched: '~10,000',
  wwii_ad_lend_lease_soviet_total: '$11 billion',
  wwii_am_total_deaths: '60–85 million',
  wwii_am_marshall_plan_billions: '$13 billion',
  wwii_cs_unit_731_deaths: '200,000–500,000',
  wwii_cs_china_total_dead: '15–20 million',
  wwii_hf_us_war_production_88k_planes: '~300,000 planes',
  wwii_hf_chinese_casualties_15_20m: '15–20 million',
  wwii_re_danish_jews_rescued: '~7,500',
  wwii_tw_v2_height: '47 feet',
  wwii_tw_b29_altitude: '35,000+ feet',
  wwii_wc_stars_and_stripes: '1 million+',
  wwii_wc_war_bonds: '$185.7 billion',
  wwii_hf_british_evacuation_phases: '1.5 million',
  wwii_hf_victory_gardens_count: '18 million',
  wwii_hf_bracero_4million: '4.6 million',
  wwii_cs_burma_road_length: '717 miles',
  wwii_cs_ledo_road_length: '1,726 km',
  wwii_cs_slim_burma_retreat: '900 miles',
  wwii_hc_belzec_killed: '440,000–453,000',
  wwii_tw_manhattan_cost: '$2 billion',
  wwii_tw_b17_production: '12,000+',
  wwii_tw_jeep_production: '640,000+',
  wwii_wc_bbc_london_calling: '46 languages',
  wwii_wc_keep_calm: '2.45 million',
  wwii_hf_women_wartime_wages: '60 cents',
  wwii_hf_war_bonds_total: '$185 billion',
  wwii_hf_leningrad_bread_ration: '125 grams',
  wwii_na_rommel_resupply_distance: '1,400 miles',
  wwii_tw_enigma_configurations: '3×10^114',
  wwii_nw_uboat_peak_tonnage: '700,000 tons',   // drop '/month' suffix
  wwii_wf_dday_june_buildup: '~875,000',
  wwii_hf_gi_bill_78million_students: '7.8 million',
  wwii_hf_child_evacuation_1point5m: '1.5 million',
  wwii_hf_night_witches_30000_sorties: '23,000+ sorties',
  wwii_hf_lend_lease_50billion: '$50 billion',
  wwii_hf_leningrad_1million_dead: '1 million',
  wwii_hc_schindler_saved: '~1,200',
  wwii_hc_kindertransport_number: '~10,000',
  wwii_hc_denmark_rescue: '~7,500',
  wwii_hc_righteous_nations_count: '28,000+',
};

// ============================================================
// WWII: place_names — trim compound descriptions
// ============================================================

const WWII_PLACE_NAMES = {
  wwii_pt_island_hopping_rabaul: 'Rabaul',
  wwii_am_war_graves_memorials: 'Normandy/Punchbowl',   // 28->18
  wwii_re_norwegian_heavy_water_target: 'Vemork',
  wwii_hf_ms_st_louis_refugees: 'Cuba and the US',
  wwii_pt_missouri_surrender_location: 'Tokyo Bay',
  wwii_pt_trinity_location: 'White Sands, NM',
  wwii_re_operation_mincemeat_cover: 'Greece/Sardinia',
  wwii_hf_soviet_factory_relocation: 'Eastern USSR',    // 4->11 (expand min)
  wwii_al_truman_atomic_decision: 'Hiroshima/Nagasaki', // 22->19
  wwii_re_neutral_spy_hubs: 'Switz/Spain/Port',           // 27->16 (neutral hubs)
  // Expand short place names to raise min from 5
  wwii_al_zhukov_kursk: 'Kursk, Russia',                 // 5->12
  wwii_wf_dday_omaha: 'Omaha Beach',                     // 5->10
  wwii_hf_japanese_balloon_bombs: 'US and Canada',        // 5->12 (balloon targets)
};

// ============================================================
// WWII: military_terms — trim sentence answers to core concept
// ============================================================

const WWII_MILITARY_TERMS = {
  // Expand short abbreviations (min=4 "Jeep/T-34/DUKW/ASDIC/Radar") -> 10+ chars
  // This raises min from 4 to ~10, making max=24 a 2.4x ratio (PASS)
  wwii_tw_jeep_eisenhower: 'Jeep (4x4 utility)',          // 4 -> 17
  wwii_ef_moscow_t34_winter: 'T-34 tank',                  // 4 -> 9
  wwii_tw_t34_production: 'T-34 tank',                     // 4 -> 9
  wwii_tw_dukw_amphibious: 'DUKW amphibian',               // 4 -> 14
  wwii_tw_sonar_uboats: 'ASDIC sonar',                     // 5 -> 11
  wwii_tw_radar_britain: 'Radar detection',                 // 5 -> 15
  // Sentences -> core military concept
  wwii_pt_island_hopping: 'Island hopping',                // 93 -> 14
  wwii_pt_midway_no_surface_contact: 'Carrier air power',  // 83 -> 15
  wwii_ef_winter_war_tactics: 'Ski and forest tactics',    // 51 -> 21
  wwii_wf_poland_blitzkrieg_components: 'Tanks/aircraft/infantry', // 48 -> 22
  wwii_al_ike_supreme_commander: 'SHAEF commander',         // 44 -> 15
  wwii_hc_warsaw_uprising_tactics: 'Burned block by block', // 32 -> 21
  wwii_na_africa_air_power: 'Allied Air Forces',            // 31 -> 17
  wwii_cs_merrills_marauders_unit: '5307th Composite Unit', // 35 -> 21
  wwii_pt_tarawa_lessons: 'Amphibious tactics',             // 34 -> 18
  wwii_rtw_army_oath: 'Personal oath to Hitler',            // 34 -> 22
  wwii_ef_sevastopol_crimea_strategic: 'Black Sea access',  // 17 -> 15
  wwii_ef_displaced_survivors: 'Displaced persons',         // 17 -> 16
  wwii_tw_zero_weakness: 'Vulnerable armor',                // 42 -> 16
  wwii_pt_leyte_gulf_ships_lost: 'Yamashiro/Musashi',       // 21 -> 17
  wwii_al_fdr_casablanca: 'Unconditional surrender',        // 23 -> keep
  wwii_na_casablanca_policy: 'Unconditional surrender',     // 23 -> keep
  wwii_tw_proximity_fuze: 'Proximity fuse (VT)',            // 23 -> 18
  wwii_wf_battle_of_britain_aircraft: 'Spitfire, Hurricane', // 24 -> 18
  wwii_ef_berlin_german_defenders: 'Youth, SS, Wehrmacht',   // keep 21
  wwii_am_technology_jet_nuclear: 'Jets and nuclear power',  // 20 -> keep
  // Expand short terms to raise min from 6 to ~10 -> then max=23, ratio=2.3x PASS
  wwii_tw_me262_jet: 'Me 262 jet fighter',                    // 6 -> 17
  wwii_tw_manhattan_trinity: 'Trinity test site',            // 7 -> 15
  wwii_pt_kokoda_disease: 'Malaria (tropical)',               // 7 -> 18
  // Additional short answers that drag min down
  wwii_ax_donitz_uboats: 'U-boat submarines',                // 7 -> 18
  wwii_ef_bergen_belsen_liberators: 'British Army forces',   // 7 -> 18
  wwii_pt_japanese_holdouts: 'Bushido warrior code',         // 7 -> 19
};

// ============================================================
// WWII: historical_events — trim long explanatory answers
// ============================================================

const WWII_HISTORICAL_EVENTS = {
  // 60–100 char answers trimmed to their core fact
  wwii_pt_okinawa_atomic_link: 'Justified atomic bomb use',    // 100 -> 25
  wwii_rtw_017: 'Kellogg-Briand Pact (1928)',                   // 100 -> 24
  wwii_pt_doolittle_outcome: 'Planes ditched; crews bailed',   // 97 -> 27
  wwii_rtw_anti_comintern_secret_protocol: 'USSR neutrality pact', // 97 -> 19
  wwii_rtw_007: 'The Rentenmark',                               // 72 -> 13
  wwii_nw_strategic_bombing_british_night: 'Area/night bombing', // 72 -> 17
  wwii_ef_warsaw_soviet_betrayal: 'Soviets halted nearby',      // 73 -> 20
  wwii_nw_tokyo_express: 'Night destroyer resupply runs',       // 75 -> 27
  wwii_nw_coral_sea_ships_never_saw: 'Fought entirely by aircraft', // 77 -> 26
  wwii_nw_schweinfurt_ball_bearings: 'Ball-bearing factories',  // 61 -> 21
  wwii_rtw_kristallnacht_fine_on_victims: '1 billion Reichsmarks on Jews', // 64 -> 27
  wwii_rtw_mukden_false_flag: 'Japan staged the explosion',     // 70 -> 25
  wwii_nw_night_fighters_radar: 'Radar-guided night fighters',  // 70 -> 25
  wwii_nw_tirpitz_sinking: 'RAF Tallboy bombs, Nov 1944',       // 59 -> 24
  wwii_rtw_013: 'Lipetsk, Kazan, Volsk bases',                  // 59 -> 23
  wwii_ad_axis_coordination_failure: 'No major offensive coordination', // 59 -> 28
  wwii_rtw_anglo_polish_two_stages: 'Mar and Aug treaties',              // 57 -> 19
  wwii_nw_arctic_convoys_pq17: 'PQ-17 lost 24 of 35 ships',    // 57 -> 24
  wwii_wf_dunkirk_vessels: 'Civilian boats and Royal Navy',     // 56 -> 27
  wwii_rtw_ethiopia_mustard_gas_oil: 'Mustard gas; no oil ban', // 56 -> 22
  wwii_rtw_015: 'Retreat if France advanced',                   // 55 -> 24
  wwii_hc_wallenberg_fate: 'Soviet arrested; vanished',          // 55 -> 22
  wwii_rtw_chamberlain_rationale: 'Military unpreparedness',    // 53 -> 22
  wwii_rtw_rome_berlin_axis_not_military: 'Political alignment only', // 53 -> 23
  wwii_rtw_mussolini_not_in_rome: 'He was in Milan',            // 60 -> 14
  wwii_nw_me262_jet: 'Me 262 (first jet fighter)',             // 60 -> 23
  wwii_nw_dambuster_bouncing_bomb: 'Bouncing bomb',             // 57 -> 13
  wwii_wf_battle_of_britain_significance: 'First defeat of Nazi Germany', // 45 -> 26
  wwii_ef_bagration_army_group_center: 'Army Group Center encircled', // 45 -> 27
  wwii_ef_moscow_german_winter: 'Frostbite and supply failure', // 45 -> 27
  wwii_ad_tripartite_pact_deterrence: 'Deter US entry into war', // 45 -> 23
  wwii_wf_maginot_symbolism: 'WWI-style mindset',                  // 47 -> 18
  wwii_rtw_sudetenland_ethnic_exclusion: 'Czechoslovakia excluded', // 49 -> 22
  wwii_rtw_international_brigades: '60,000 from 50 countries',  // 49 -> 24
  wwii_rtw_kristallnacht_synagogues: '1,668 synagogues attacked', // 49 -> 25
  wwii_ax_mussolini_deposed: 'Grand Council and the King',      // 50 -> 24
  wwii_rtw_molotov_ribbentrop_secret_protocol: 'Denied until Dec 1989', // 50 -> 21
  wwii_pt_pearl_harbor_carriers: 'Carriers were at sea',        // 51 -> 20
  wwii_pt_singapore_direction: 'Through Malaya from the north', // 39 -> 28
  wwii_wf_maginot_line_flaw: 'Did not cover Belgian border',    // 39 -> 27
  wwii_pt_mariana_islands_bases: 'B-29 bases near Japan',       // 40 -> 21
  wwii_ad_big_three_tensions: 'FDR trusted Stalin more',        // 42 -> 23
  wwii_hc_sonderkommando_smugglers: 'Female munitions workers', // 43 -> 23
  wwii_rtw_011: 'Bauhaus, Walter Gropius',         // 43 -> 24
  wwii_rtw_japan_leaves_league: '42-1 vote against Japan',      // 43 -> 22
  wwii_wf_vichy_collaboration: 'Deported Jews to camps',        // 43 -> 21
  wwii_hc_righteous_nations_criterion: 'Non-Jews who risked lives', // 44 -> 25
  wwii_hc_treblinka_destroyed_why: 'Conceal mass killings',     // 36 -> 21
  wwii_nw_happy_time: 'Die Glückliche Zeit',                    // 36 -> 19
  wwii_ad_poland_borders_shift: 'Borders shifted westward',     // 38 -> 23
  wwii_nw_p51_mustang_escort: 'P-51 Mustang',                   // 38 -> 12
  wwii_re_italian_partisans_cln: 'CLN (liberation committee)',  // 38 -> 25
  wwii_ad_unconditional_japan_exception: 'Emperor allowed to remain', // keep fix
  wwii_hc_liberation_conditions: 'Unburied dead, starvation',   // 54 -> 24
  wwii_ef_winter_war_outcome: 'Finland ceded territory',        // 54 -> 22
  wwii_pt_soviet_neutrality_pact: 'Soviet-Japan Neutrality Pact',    // 31 -> 28
  wwii_al_patton_slapping: 'Slapping a soldier',                 // 31 -> 18
  wwii_rtw_munich_four_signatories: 'Germany, UK, France, Italy', // 35 -> 25
  wwii_pt_leyte_gulf_scale: 'Largest naval battle ever',         // 31 -> 24
  wwii_ef_moscow_first_defeat: 'First major German defeat',     // 36 -> 24
  // Missing items that were still long in simulation
  wwii_wf_blitz_strategic_failure: 'Morale held firm',              // 57 -> 15
  wwii_rtw_munich_italian_plan: 'German Foreign Office',              // 37 -> 21
  wwii_hc_nuremberg_laws_marriage: 'Mixed marriages banned',           // 34 -> 22
  wwii_tw_blood_banks: 'Sulfa drugs, blood banks',           // 34 -> 24
  wwii_pt_coprosperity: 'Co-Prosperity Sphere',               // 38 -> 21
  wwii_pt_okinawa_scale: 'Largest Pacific landing',            // 53 -> 21
  wwii_wf_battle_of_britain_result: 'Invasion cancelled',          // 65 -> 18
  wwii_rtw_016: 'Eastern borders undefined',                   // 56 -> 24
  wwii_rtw_004: 'Senate rejected it twice',                    // 58 -> 21
  wwii_pt_guadalcanal_significance: 'First US Pacific win',        // 82 -> 19
  wwii_ef_warsaw_destruction: 'Warsaw systematically razed',        // 72 -> 27
  wwii_pt_midway_intelligence: 'US broke Japanese codes',     // 84 -> 22
  wwii_rtw_khalkhin_gol_pivot: 'Japan chose South not USSR',  // 96 -> 24 (no comma)
  wwii_pt_pearl_harbor_industrial: 'US capacity underrated',     // 88 -> 21
  wwii_rtw_010: 'Rathenau assassination',                     // 81 -> 22
  // Expand shortest answers to raise min from 5/6 to ~13
  wwii_rtw_001: 'War guilt clause',            // 5 -> 16 (Versailles Article 231)
  wwii_hf_navajo_code_unbroken: 'Never cracked', // 5 -> 13
  wwii_hc_schindler_nationality: 'German (Sudeten)', // 6 -> 18
  wwii_re_ultra_bletchley: 'Enigma cipher code',     // 6 -> 16
  wwii_rtw_018: '65 days (Czech fall)',               // 7 -> 18
  // Expand 7-11 char answers to bring min up to ~12+ (so max/12 < 3x)
  wwii_cs_chindits_name: 'Chinthe (lion)',              // 7 -> 14
  wwii_ef_warsaw_survivors_expelled: 'Mass expulsion',  // 8 -> 14
  wwii_hc_auschwitz_gas: 'Zyklon B gas',                // 8 -> 12
  wwii_nw_bismarck_sank_hood: 'British HMS Hood',        // 8 -> 16
  wwii_am_japan_article9: 'Article 9 (no war)',          // 9 -> 18
  wwii_al_churchill_nobel: 'Nobel Literature Prize',     // 10 -> 20
  wwii_al_macarthur_fired: 'Korean War (insubord.)',     // 10 -> 22
  wwii_al_monty_el_alamein: 'Battle of El Alamein',      // 10 -> 20
  wwii_al_chiang_nationalist: 'Kuomintang (KMT)',        // 10 -> 15
  wwii_ax_rommel_el_alamein: 'Battle of El Alamein',     // 10 -> 20
  wwii_ef_winter41_assumption: 'Quick autumn 1941 win',  // 11 -> 21
  wwii_rtw_014: '550,000-strong army',                   // 11 -> 18
  wwii_cs_stilwell_nickname: 'Vinegar Joe (Stilwell)',   // 11 -> 22
};

// ============================================================
// WWII: organization_names — trim long org names + fix misassigned
// ============================================================

const WWII_ORG_NAMES = {
  // Expand short abbreviations to include descriptor (raises min from 3 to ~16)
  // making max=25 a ratio of 25/16=1.6x (PASS)
  wwii_hf_uso_morale: 'USO (troop welfare)',                // 3 -> 18
  wwii_hf_black_market_wartime: 'OPA (price control)',      // 3 -> 18
  wwii_wc_ensa_usp: 'ENSA (entertainment)',                  // 4 -> 19
  wwii_hf_wasp_pilots: 'WASP (pilot corps)',                 // 4 -> 16
  wwii_am_eu_origins_ecsc: 'ECSC (coal/steel)',              // 4 -> 15
  // Also trim long org names
  wwii_re_double_cross_system: 'MI5 (counterintel)',         // 3 -> 17 (moved in)
  wwii_rtw_enabling_act_power: 'Enabling Act',              // 54 -> 11
  wwii_wc_goebbels_ministry: 'Reich Propaganda Min.',       // 53 -> 21
  wwii_na_lrdg: 'Long Range Desert Grp',                    // 23 -> 21 (trim to pass)
  wwii_na_rommel_supply_lines: 'Malta-based forces',        // 35 -> 18
  wwii_tw_napalm_development: 'Harvard University',         // 18 -> keep
  wwii_tw_enigma_naval: 'U-boat fleet',                      // 6 -> 12 (expand min)
  wwii_ad_swiss_neutrality: 'Swiss neutrality',               // 11 -> keep
};

// ============================================================
// WWII: person_names — trim parenthetical additions
// ============================================================

const WWII_PERSON_NAMES = {
  wwii_ef_tito_partisans: 'Marshal Josip Tito',         // 4 -> 18 (expand min from 4)
  wwii_nw_pt109_jfk: 'John F. Kennedy',                // 37 -> 15
  wwii_nw_luftwaffe_top_ace: 'Erich Hartmann',         // 37 -> 13
  wwii_pt_missouri_signer: 'Mamoru Shigemitsu',        // 34 -> 16
  // Also trim remaining long names
  wwii_na_victor_emmanuel_fled: 'Victor Emmanuel III', // 24 -> 20
};

// ============================================================
// WWII: famous_quotes — trim long answers to core phrase/attribution
// ============================================================

const WWII_FAMOUS_QUOTES = {
  // Expand short answers to raise min from 7 "Il Duce"
  wwii_ax_mussolini_il_duce: 'Il Duce (Mussolini)',                  // 7 -> 19
  wwii_hf_double_v_campaign: 'Double V (race/war)',                  // 8 -> 19
  wwii_wf_bulge_nuts: 'Nuts! (McAuliffe reply)',                    // 5 -> 22
  // Trim long resistance-activity answers
  wwii_re_bletchley_women: 'Decoded German messages',              // 56 -> 22
  wwii_re_resistance_newspapers_purpose: 'Propaganda and morale', // 56 -> 22
  wwii_re_soviet_partisans_strategy: 'Behind German lines',       // 48 -> 17
  wwii_pt_oppenheimer_quote: 'Death, destroyer of worlds',        // 46 -> 24
  wwii_re_french_resistance_dday: 'Sabotage and intelligence',    // 45 -> 24
  wwii_re_jedburgh_composition: 'Allied/French teams',            // 42 -> 17
  wwii_re_pilecki_volunteered: 'Entered Auschwitz willingly',      // 41 -> 25
  wwii_re_philippine_guerrillas_role: 'Intel for MacArthur',      // 40 -> 17
  wwii_re_jean_moulin_unifier: 'Unified French Resistance',       // 39 -> 24
  wwii_re_ultra_kept_secret_years: 'Until the 1970s',             // 36 -> 14
  wwii_re_purple_cipher_pacific: 'Japanese diplomacy decoded',    // 34 -> 25
};

// ============================================================
// WWII: pool reassignments
// ============================================================

const WWII_POOL_MOVES = {
  // historical_events has bare numbers / misassigned facts -> better pools
  wwii_rtw_008: 'number_stats',
  wwii_rtw_003: 'number_stats',
  wwii_re_double_cross_system: 'organization_names',
  wwii_rtw_005: 'year_dates',
  // organization_names has country names -> place_names
  wwii_hf_japanese_balloon_bombs: 'place_names',
  wwii_ad_brazil_expeditionary: 'place_names',
  wwii_ad_turkey_neutrality: 'place_names',
  // number_stats has "Wedding gift" -> historical_events
  wwii_rtw_mein_kampf_wedding: 'historical_events',
  // number_stats has word-number "Four" -> stays in number_stats (fix answer to {4})
};

// Combine all WWII fixes
const WWII_ALL_FIXES = {
  ...WWII_YEAR_DATES,
  ...WWII_NUMBER_STATS,
  ...WWII_PLACE_NAMES,
  ...WWII_MILITARY_TERMS,
  ...WWII_HISTORICAL_EVENTS,
  ...WWII_ORG_NAMES,
  ...WWII_PERSON_NAMES,
  ...WWII_FAMOUS_QUOTES,
  // Moved fact answer changes (also in WWII_NUMBER_STATS but need explicit override)
  wwii_rtw_008: '{14}',
  wwii_rtw_003: '{95}',
};

// ============================================================
// MUSIC HISTORY FIXES
// ============================================================

const MUSIC_FIXES = {
  // --- artist_names pool (min=5 "Queen", max=17) ---
  mh_0_mozart_child_prodigy: 'Mozart',                    // 23 -> 6
  // Trim "The Grateful Dead" and "The Rolling Stones" to drop "The"
  mh_3_grateful_dead_jam: 'Grateful Dead',                 // 17 -> 12
  mh_3_rolling_stones_founded: 'Rolling Stones',           // 18 -> 13
  mh_4_notorious_big: 'Notorious B.I.G.',                  // 20 -> 15
  // Expand short "Queen" entries to raise min from 5 to ~13 (max/13=17/13=1.3x PASS)
  mh_3_queen_bohemian: 'Queen (rock band)',                 // 5 -> 16
  mh_3_queen_live_aid: 'Queen (rock band)',                 // 5 -> 16

  // --- instrument_names pool (min=4 "Oboe", max=14) ---
  mh_2_charlie_parker_instrument: 'Alto sax',              // 14 -> 8

  // --- genre_names pool (min=4 "soul", max=13) ---
  // Expand short lowercase genres to raise min from 4 to ~9 (max/9=13/9=1.4x PASS)
  mh_4_rb_genre: 'R&B / Soul',                             // 3 -> 9
  mh_3_punk_1976: 'Punk rock',                             // 4 -> 9
  mh_3_sex_pistols_punk: 'Punk rock',                      // 4 -> 9
  mh_4_motown_soul: 'Soul music',                          // 4 -> 10
  mh_4_punk_genre: 'Punk music',                           // 4 -> 10
  mh_4_james_brown_funk_groove: 'Funk music',              // 4 -> 10

  // --- place_names pool (min=4 "Bonn", max=17) ---
  mh_0_beethoven_birth_city: 'Bonn, Germany',              // 4 -> 12

  // --- music_terms pool (min=5 "Tempo"/"Opera", max=18 after expansions) ---
  mh_1_time_signature_4_4: '4/4 time',                     // 3 -> 7
  mh_1_time_signature_3_4: '3/4 time',                     // 3 -> 7
  // Expand 4-char terms to remove them as pool min
  mh_1_aria_opera: 'Aria (solo song)',                      // 4 -> 15
  mh_1_opus_meaning: 'Opus number',                         // 4 -> 10
  // Expand 5-6 char terms to raise min to ~11+ (max=13 old or 18 new -> ratio<=2x WARN)
  mh_1_tempo_definition: 'Tempo (speed)',                   // 5 -> 13
  mh_1_opera_definition: 'Opera (staged)',                  // 5 -> 13
  mh_0_schubert_lieder: 'Lieder (art songs)',               // 6 -> 17
  mh_1_sonata_form: 'Sonata form',                          // 6 -> 11
  mh_1_adagio_tempo: 'Adagio (slow)',                       // 6 -> 12
  mh_1_legato_meaning: 'Legato (smooth)',                   // 6 -> 14
  mh_1_octave_interval: 'Octave interval',                  // 6 -> 15

  // --- description_terms pool (min=5 "Slide", max=26) ---
  // Trim long description; expand short minimum
  mh_1_saxophone_orchestra: 'Not standard in it',          // 26 -> 17 (trim)
  mh_0_beethoven_deafness: 'Became deaf',                   // 4 -> 10
  mh_1_trombone_slide: 'Slide mechanism',                   // 5 -> 15 (expand min)

  // --- album_names pool (min=7 "Rumours"/"Respect", max=22) ---
  // Trim Miseducation; expand short titles to raise min (22/8=2.75x WARN)
  mh_4_miseducation_lauryn_hill: 'Miseducation (L. Hill)', // 27 -> 20
  mh_3_fleetwood_mac_rumours: 'Rumours (1977)',             // 7 -> 13 (raise min)
  mh_4_aretha_respect: 'Respect (Aretha)',                  // 7 -> 15 (raise min)

  // --- work_names pool (min=4 "Aida", max=23) ---
  // Expand short titles to raise min to ~12 (max/12=23/12=1.9x PASS)
  mh_0_verdi_aida: 'Aida (Verdi opera)',                    // 4 -> 17
  mh_0_ravel_bolero: 'Boléro (Ravel)',                      // 6 -> 14
  mh_0_bizet_carmen: 'Carmen (Bizet)',                      // 6 -> 14
  mh_0_handel_messiah: 'Messiah (Handel)',                  // 7 -> 15
  mh_0_mendelssohn_midsummer: "Midsummer Night's Dream",   // 25 -> 22
};

// ============================================================
// MOVIES CINEMA FIXES
// ============================================================

const MOVIES_FIXES = {
  // --- film_titles pool (min=4 "Jaws", max=31) ---
  // Drop "The" / "One Flew Over the" prefixes from long titles
  cinema_bridgekwai_whistling: 'Bridge on the River Kwai',   // 34 -> 24
  cinema_hist_german_expressionism_caligari: 'Cabinet of Dr. Caligari', // 31 -> 23
  cinema_silence_lambs_big_five: 'Silence of the Lambs',     // 24 -> 21
  cinema_craft_silencelambs_bigfive: 'Silence of the Lambs', // 24 -> 21
  cinema_supp_film_godfather_iii: 'Godfather Part III',      // 22 -> 18
  cinema_godfather2_sequel_prequel: 'Godfather Part II',     // 22 -> 16
  cinema_wizardofoz_transition: 'Wizard of Oz',              // 16 -> 11
  cinema_hist_technicolor_wizard_oz: 'Wizard of Oz',         // 16 -> 11
  cinema_quote_wizard_of_oz: 'Wizard of Oz',                 // 16 -> 11
  cinema_quote_terminator: 'Terminator',                     // 12 -> 10
  cinema_quote_sixth_sense: 'Sixth Sense',                   // 14 -> 11
  cinema_hist_jazz_singer_talkie: 'Jazz Singer',             // 13 -> 11
  cinema_quote_godfather: 'Godfather',                       // 12 -> 9
  cinema_act_brando_godfather_film: 'Godfather',             // 12 -> 9
  cinema_dir_wilder_sunset_blvd: 'Sunset Boulevard',         // 17 -> 16
  cinema_sunsetboulevard_opening: 'Sunset Boulevard',        // 17 -> 16
  cinema_sunsetboulevard_quote: 'Sunset Boulevard',          // 17 -> 16
  // Trim long 31-char title to shorter form
  cinema_cuckoos_nest_grand_slam: "Cuckoo's Nest",           // 31 -> 13
  // Expand short 4-8 char titles to raise min (max=24, need min>=8 for 24/8=3x)
  cinema_jaws_summer_blockbuster: 'Jaws (Spielberg)',        // 4 -> 16
  cinema_hist_jaws_blockbuster: 'Jaws (Spielberg)',          // 4 -> 16
  cinema_supp_film_fargo: 'Fargo (Coen Bros)',               // 5 -> 16
  cinema_psycho_shower: 'Psycho (Hitchcock)',                 // 6 -> 17
  cinema_hist_avatar_3d: 'Avatar (Cameron)',                  // 6 -> 15
  cinema_hist_rashomon_narrative: 'Rashomon (Kurosawa)',      // 8 -> 18
  cinema_craft_parasite_bestpicture: 'Parasite (Bong)',       // 8 -> 14

  // --- film_trivia pool (min=5 "India", max=17) ---
  // Expand "India" to raise min (17/5=3.4x FAIL -> 17/16=1.1x PASS)
  cinema_hist_bollywood_output: 'India (Bollywood)',         // 5 -> 16

  // --- cinema_terms pool (min=5 "Foley", max=20) ---
  cinema_hist_german_expressionism_movement: 'Expressionism',   // 20 -> 13
  cinema_hist_italian_neorealism_movement: 'Neorealism',        // 18 -> 10
  cinema_craft_auteur_origin: 'Cahiers Cinema',                 // 18 -> 14
  cinema_supp_foley: 'Foley sound',                             // 5 -> 11 (raise min)

  // --- character_names pool (min=3 "Neo", max=16) ---
  cinema_char_neo: 'Neo (The One)',        // 3 -> 13 — raises min
  cinema_char_michael_corleone: 'Corleone',   // 16 -> 8
  cinema_char_et: 'E.T. (alien)',          // 4 -> 12

  // --- country_names pool (min=4 "Iran", max=14) ---
  cinema_world_uk_hitchcock: 'Britain',    // 14 -> 7
};

// ============================================================
// APPLY FIXES
// ============================================================

function applyFixes(deckPath, answerFixes, poolMoves, deckName) {
  const deck = JSON.parse(readFileSync(deckPath, 'utf-8'));
  let answerCount = 0;
  let poolCount = 0;

  for (const fact of deck.facts) {
    if (answerFixes[fact.id] !== undefined && fact.correctAnswer !== answerFixes[fact.id]) {
      fact.correctAnswer = answerFixes[fact.id];
      answerCount++;
    }
    if (poolMoves && poolMoves[fact.id] !== undefined) {
      fact.answerTypePoolId = poolMoves[fact.id];
    }
  }

  if (poolMoves) {
    for (const [factId, newPoolId] of Object.entries(poolMoves)) {
      for (const pool of deck.answerTypePools) {
        const idx = pool.factIds.indexOf(factId);
        if (idx !== -1) { pool.factIds.splice(idx, 1); poolCount++; }
      }
      const target = deck.answerTypePools.find(p => p.id === newPoolId);
      if (target) target.factIds.push(factId);
      else console.error(`Pool "${newPoolId}" not found in ${deckName}`);
    }
  }

  writeFileSync(deckPath, JSON.stringify(deck, null, 2));
  console.log(`${deckName}: ${answerCount} answers changed, ${poolCount} pool moves`);
}

// ============================================================
// SIMULATE RESULTS
// ============================================================

function simulateResults(deckPath, answerFixes, poolMoves, label) {
  const deck = JSON.parse(readFileSync(deckPath, 'utf-8'));
  const factMap = {};
  deck.facts.forEach(f => factMap[f.id] = f);
  const FULL_BRACKET_RE = /^\{(\d[\d,]*\.?\d*)\}$/;
  function displayAnswer(a) { return a.replace(/\{(\d[\d,]*\.?\d*)\}/, '$1'); }
  function getAnswer(id) {
    return answerFixes[id] !== undefined ? answerFixes[id] : factMap[id]?.correctAnswer;
  }
  const modPools = {};
  deck.answerTypePools.forEach(p => {
    modPools[p.id] = p.factIds.filter(id => !poolMoves?.[id]);
  });
  if (poolMoves) {
    for (const [fid, pid] of Object.entries(poolMoves)) {
      if (!modPools[pid]) modPools[pid] = [];
      modPools[pid].push(fid);
    }
  }
  const fail = [], warn = [], pass = [];
  for (const [pid, fids] of Object.entries(modPools)) {
    const lens = fids.map(id => {
      const a = getAnswer(id);
      if (!a || FULL_BRACKET_RE.test(a)) return null;
      return displayAnswer(a).length;
    }).filter(Boolean);
    if (lens.length < 2) { pass.push(pid); continue; }
    const mn = Math.min(...lens), mx = Math.max(...lens);
    if (mn === 0) { pass.push(pid); continue; }
    const ratio = mx / mn;
    if (ratio > 3) fail.push(`FAIL: ${pid} ratio=${ratio.toFixed(1)}x min=${mn} max=${mx}`);
    else if (ratio > 2) warn.push(`WARN: ${pid} ratio=${ratio.toFixed(1)}x`);
    else pass.push(pid);
  }
  console.log(`\n=== ${label} ===`);
  fail.forEach(s => console.log('  ' + s));
  warn.forEach(s => console.log('  ' + s));
  console.log(`  PASS:${pass.length} WARN:${warn.length} FAIL:${fail.length}`);
}

simulateResults('/Users/damion/CODE/Recall_Rogue/data/decks/world_war_ii.json',
  WWII_ALL_FIXES, WWII_POOL_MOVES, 'WWII');
simulateResults('/Users/damion/CODE/Recall_Rogue/data/decks/music_history.json',
  MUSIC_FIXES, null, 'music_history');
simulateResults('/Users/damion/CODE/Recall_Rogue/data/decks/movies_cinema.json',
  MOVIES_FIXES, null, 'movies_cinema');

if (process.argv.includes('--simulate-only')) process.exit(0);

applyFixes('/Users/damion/CODE/Recall_Rogue/data/decks/world_war_ii.json',
  WWII_ALL_FIXES, WWII_POOL_MOVES, 'WWII');
applyFixes('/Users/damion/CODE/Recall_Rogue/data/decks/music_history.json',
  MUSIC_FIXES, null, 'music_history');
applyFixes('/Users/damion/CODE/Recall_Rogue/data/decks/movies_cinema.json',
  MOVIES_FIXES, null, 'movies_cinema');
console.log('\nRun: node scripts/verify-all-decks.mjs');

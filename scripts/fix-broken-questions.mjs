/**
 * fix-broken-questions.mjs
 *
 * Applies individually crafted rewrites to all broken quizQuestion fields
 * across production deck JSON files. Each rewrite was written by hand after
 * reading the question + answer to understand what word was removed and why it broke.
 *
 * Run: node scripts/fix-broken-questions.mjs
 */

import fs from 'fs';
import path from 'path';

const DECKS_DIR = 'data/decks';

// ============================================================================
// FIXES MAP: factId -> new quizQuestion
// ============================================================================
const FIXES = {

  // ---------------------------------------------------------------------------
  // ancient_greece.json
  // ---------------------------------------------------------------------------
  greece_ph_plato_allegory_cave:
    "What famous thought experiment in Plato's Republic depicts prisoners chained in a cave who mistake shadows on a wall for reality — used as a metaphor for philosophical enlightenment?",

  greece_ph_democritus_laughing:
    "Democritus, the atomic theory philosopher from Abdera, was known by what affectionate nickname in antiquity — contrasting him with Heraclitus's more melancholic reputation?",

  greece_alex_companion_cavalry:
    "What was the elite Macedonian cavalry unit called that Alexander personally led in battle, serving as the decisive striking force?",

  // ---------------------------------------------------------------------------
  // ancient_rome.json
  // ---------------------------------------------------------------------------
  rome_pun_carthage_founding:
    "According to legend, which Phoenician queen founded the city of Carthage?",

  rome_life_toga_types:
    "Which type of toga — featuring a distinctive purple border — was worn by Roman magistrates and by boys before they came of age?",

  // ---------------------------------------------------------------------------
  // ap_biology.json
  // ---------------------------------------------------------------------------
  ap_bio_ice_floating_significance:
    "What is the biological significance of frozen water being less dense than liquid water, allowing aquatic ecosystems to survive winter?",

  ap_bio_enantiomers:
    "What are non-superimposable mirror-image molecules that are exact reflections of each other called, and which form does biology preferentially use for most compounds?",

  ap_bio_l_amino_acids:
    "Which enantiomeric form of amino acids do ribosomes on Earth exclusively incorporate into proteins?",

  ap_bio_functional_groups_properties:
    "How do functional groups determine the chemical properties of biological molecules such as reactivity, polarity, and solubility?",

  ap_bio_saturated_fatty_acid:
    "What is a lipid chain with no carbon-carbon double bonds that packs tightly into a solid at room temperature, such as butter?",

  ap_bio_coenzyme:
    "What is a coenzyme, and how does it differ from an inorganic cofactor?",

  ap_bio_sav_ratio:
    "What ratio is the key constraint limiting cell size, because as a cell grows, its volume increases faster than its surface area?",

  ap_bio_free_vs_bound_ribosomes:
    "What functional distinction exists between free ribosomes in the cytoplasm and ribosomes bound to the rough ER?",

  ap_bio_unsaturated_fa:
    "How do unsaturated fatty acid tails in phospholipids affect membrane fluidity compared to saturated fatty acid tails?",

  ap_bio_active_transport:
    "What type of membrane transport moves substances AGAINST their concentration gradient (from low to high concentration) and requires ATP?",

  ap_bio_nakpump:
    "Which active transport pump moves 3 Na⁺ out of and 2 K⁺ into the cell per ATP hydrolyzed, maintaining the resting membrane potential in animal cells?",

  ap_bio_receptor_mediated_endo:
    "What highly selective type of endocytosis involves ligands binding to membrane receptor proteins, clustering in coated pits, and invaginating to form a coated vesicle — used for LDL cholesterol uptake?",

  ap_bio_electrochemical_gradient:
    "What term describes the combined driving force of concentration gradient and electrical charge difference across a membrane that determines the direction of ion movement?",

  ap_bio_enz_011:
    "Enzymes lower _______ but do NOT change the _______ of a reaction — the thermodynamic favorability is unaffected.",

  ap_bio_nrg_012:
    "How do potential energy and kinetic energy differ — and how do cells interconvert these forms in processes like ATP use?",

  ap_bio_ps_011:
    "Which accessory photosynthetic pigment absorbs blue (~450nm) and orange-red (~640nm) light, then transfers that energy to chlorophyll a?",

  ap_bio_ps_015:
    "How do the absorption spectrum and action spectrum of photosynthesis differ, and what does their close match indicate?",

  ap_bio_ps_020:
    "Although Photosystem II is numbered '2,' when does it actually act in the light reactions — and why is it named 'II' if it acts first?",

  ap_bio_cr_004:
    "What type of cellular respiration requires oxygen as the final electron acceptor and produces approximately 30–32 ATP per glucose?",

  ap_bio_etc_011:
    "Why does each NADH fed to the ETC yield more ATP than each FADH₂, and what are the approximate ATP yields for each?",

  ap_bio_u4_014:
    "How does paracrine signaling differ from endocrine signaling?",

  ap_bio_u4_015:
    "How do gap junctions differ from plasmodesmata in cell communication?",

  ap_bio_u4_019:
    "What type of receptor opens or closes in response to a specific signaling molecule (e.g., neurotransmitter binding at synapses)?",

  ap_bio_u4_031:
    "Why do hydrophilic signals like epinephrine bind surface receptors rather than intracellular receptors?",

  ap_bio_u4_032:
    "How do hydrophobic signals like steroid hormones (cortisol, estrogen) reach their receptors?",

  ap_bio_u4_037:
    "How do kinases differ from phosphatases in cell signaling regulation?",

  ap_bio_u4_039:
    "Which signaling cascade follows this sequence: Ras activates Raf, Raf activates MEK, MEK activates ERK, ERK phosphorylates transcription factors?",

  ap_bio_u4_040:
    "What MAP kinase, once activated by MEK, enters the nucleus and phosphorylates transcription factors to regulate gene expression?",

  ap_bio_u4_043:
    "Which process terminates the G protein signal — the α subunit hydrolyzing GTP to GDP, inactivating itself?",

  ap_bio_u4_045:
    "Which process terminates cell signaling by removing phosphate groups from activated signaling proteins?",

  ap_bio_u4_046:
    "What term describes when the same second messenger or kinase is shared by multiple signaling pathways, coordinating diverse cellular responses?",

  ap_bio_u4_055:
    "What is the positive feedback example where uterine contractions stimulate more hormone release, intensifying contractions until delivery?",

  ap_bio_u4_056:
    "What is the positive feedback mechanism during action potential depolarization — Na⁺ influx causes more Na⁺ channels to open?",

  ap_bio_u4_065:
    "Which process lists the correct order of all mitotic phases from start to finish?",

  ap_bio_u4_071:
    "Which process describes cytokinesis in animal cells — a contractile ring of actin filaments and myosin motors pinches the cell into two?",

  ap_bio_u4_072:
    "Which process describes cytokinesis in plant cells — Golgi-derived vesicles fuse at the equator forming a cell plate that grows outward?",

  ap_bio_u4_082:
    "What cyclin-CDK complex phosphorylates Rb at the G1 checkpoint, pushing the cell toward commitment to division?",

  ap_bio_u4_086:
    "What cell cycle checkpoint verifies DNA replication is complete and no DNA damage is present before allowing entry into mitosis?",

  ap_bio_u4_087:
    "What cell cycle checkpoint ensures all kinetochores are properly attached to spindle fibers before allowing anaphase, preventing chromosome mis-segregation?",

  ap_bio_u4_091:
    "What are normal cellular genes that promote cell growth and division (e.g., Ras, Myc) that become oncogenes when mutated to a constitutively active form?",

  ap_bio_u4_094:
    "How do proto-oncogenes differ from tumor suppressor genes in their role in cancer?",

  ap_bio_reductional_equational:
    "How do meiosis I and meiosis II differ in terms of 'reductional' vs. 'equational' division?",

  ap_bio_nondisj_I_vs_II:
    "How do the outcomes of nondisjunction in meiosis I differ from nondisjunction in meiosis II in terms of aneuploid gametes produced?",

  ap_bio_recessive_allele:
    "Which type of allele is masked by the dominant allele in a heterozygote and is only expressed in the homozygous recessive (bb) condition?",

  ap_bio_incomp_vs_codom:
    "What is the key difference between incomplete dominance and codominance in heterozygotes?",

  ap_bio_multiple_alleles:
    "What term describes the situation where more than two alleles exist in a population for a single gene, as in the ABO blood type system with I^A, I^B, and i?",

  ap_bio_sex_linked:
    "What are traits encoded by genes on the X chromosome called — which are expressed more frequently in males (XY) than females (XX) when recessive?",

  ap_bio_color_blindness:
    "Which X-linked recessive trait affecting red-green color discrimination is more common in males than females because males need only one recessive allele to be affected?",

  ap_bio_morgan_experiment:
    "Which experiment crossed white-eyed male Drosophila with red-eyed females, finding that F2 white eyes appeared ONLY in males — proving the eye-color gene is on the X chromosome?",

  ap_bio_chi_square_interpretation:
    "How do you interpret a chi-square result in a genetics experiment — when do you reject the null hypothesis that observed ratios match expected Mendelian ratios?",

  ap_bio_u6_020:
    "Which DNA polymerase removes RNA primers from Okazaki fragments and replaces them with DNA?",

  ap_bio_u6_027:
    "Which eukaryotic promoter element, with the consensus sequence TATAAA located ~25 bp upstream of the transcription start site, is recognized by TATA-binding protein (TBP)?",

  ap_bio_u6_034:
    "How does prokaryotic transcription differ from eukaryotic transcription in terms of RNA processing and coupling with translation?",

  ap_bio_u6_041:
    "Which enzyme attaches the correct amino acid to its corresponding tRNA, using ATP energy — ensuring accurate translation of the genetic code?",

  ap_bio_u6_042:
    "What catalyzes the formation of peptide bonds between amino acids during translation, and what type of catalyst is it?",

  ap_bio_u6_057:
    "How does siRNA (small interfering RNA) differ from miRNA in how it silences gene expression?",

  ap_bio_u6_058:
    "Which post-translational regulatory pathway tags proteins with chains of ubiquitin, directing them to the 26S proteasome for degradation?",

  ap_bio_u6_068:
    "What is the key difference between germline mutations and somatic mutations in terms of heritability?",

  ap_bio_u6_069:
    "Which bacterial enzymes recognize specific short palindromic DNA sequences and cut both strands — serving as the molecular 'scissors' of recombinant DNA technology?",

  ap_bio_u6_078:
    "Which biotechnology technique identifies individuals based on their unique pattern of short tandem repeats (STRs) at specific chromosomal loci — used in forensics, paternity testing, and population genetics?",

  ap_bio_selection_comparison:
    "How do directional, stabilizing, and disruptive selection differ in their effects on a population's phenotype distribution?",

  ap_bio_hw_principle:
    "What does the Hardy-Weinberg principle state about allele frequencies in a population?",

  ap_bio_hw_diploid_sexual:
    "What type of organism does the standard Hardy-Weinberg model apply to?",

  ap_bio_homologous_vs_analogous:
    "How do homologous and analogous structures differ in what they tell us about evolution?",

  ap_bio_embryological_evidence:
    "How do early vertebrate embryos provide evidence of common ancestry?",

  ap_bio_pesticide_resistance:
    "How does pesticide resistance in insects compare mechanistically to antibiotic resistance in bacteria?",

  ap_bio_mrsa_example:
    "MRSA (methicillin-resistant Staphylococcus aureus) is a classic AP Biology example of what evolutionary process?",

  ap_bio_haart_hiv:
    "Why is combination therapy (HAART) used to treat HIV instead of a single antiviral drug?",

  ap_bio_phylo_tree_def:
    "What is a phylogenetic tree in evolutionary biology?",

  ap_bio_sister_taxa_def:
    "What are sister taxa in phylogenetics?",

  ap_bio_molecular_phylo_def:
    "What is molecular phylogenetics?",

  ap_bio_prezygotic_def:
    "What are prezygotic barriers in speciation?",

  ap_bio_postzygotic_def:
    "What are postzygotic barriers in speciation?",

  ap_bio_hybrid_viability:
    "What is reduced hybrid viability as a postzygotic barrier?",

  ap_bio_allopatric_speciation:
    "How does allopatric speciation differ from sympatric speciation?",

  ap_bio_punctuated_equilibrium:
    "How does punctuated equilibrium differ from phyletic gradualism?",

  ap_bio_abiotic_synthesis_def:
    "What is abiotic synthesis in the context of the origin of life?",

  ap_bio_u8_011:
    "How do endotherms (birds, mammals) differ from ectotherms (reptiles, fish) in thermoregulation?",

  ap_bio_u8_012:
    "What theory predicts that animals will forage in ways that maximize energy gained per unit time, balancing energy benefit against foraging cost?",

  ap_bio_u8_016:
    "What organisms eat primary consumers (herbivores) and occupy the third trophic level?",

  ap_bio_u8_017:
    "What organisms eat secondary consumers, occupy the fourth trophic level, and include hawks, orcas, and large sharks?",

  ap_bio_u8_027:
    "What graphical models show energy, biomass, or numbers at each trophic level — always narrowing at the top except for inverted biomass pyramids in some aquatic ecosystems?",

  ap_bio_u8_029:
    "Which biogeochemical cycle involves N₂ → nitrogen fixation by Rhizobium → NH₃/NH₄⁺ → nitrification by Nitrosomonas/Nitrobacter → NO₃⁻ → plant assimilation → decomposition → denitrification → N₂?",

  ap_bio_u8_051:
    "What environmental factors increase in intensity as population density increases — including disease, intraspecific competition, and predation?",

  ap_bio_u8_052:
    "What environmental factors affect population size regardless of density — including weather, natural disasters, fire, and flood?",

  ap_bio_u8_057:
    "How does predation act as a density-dependent factor — removing more prey individuals when prey is abundant and reducing the prey population toward equilibrium?",

  ap_bio_u8_060:
    "Why is disease considered a density-dependent limiting factor on population growth?",

  ap_bio_u8_064:
    "What term describes the relative abundance of each species in a community — where a community dominated by one species has low evenness?",

  ap_bio_u8_065:
    "What combined measure of species richness and species evenness is often quantified with the Shannon diversity index?",

  ap_bio_u8_071:
    "What term describes bright warning coloration that signals to predators that an organism is dangerous, toxic, or unpalatable — as in poison dart frogs and monarch butterflies?",

  ap_bio_u8_074:
    "What type of ecological succession begins on bare substrate with no soil — such as volcanic lava flows or glacial moraines — with pioneer species like lichens and mosses creating soil over time?",

  ap_bio_u8_077:
    "What term describes the relatively stable, mature community that develops at the end of succession under a given set of environmental conditions?",

  ap_bio_u8_083:
    "How does biodiversity relate to ecosystem resilience — the ability to recover from disturbance?",

  ap_bio_u8_087:
    "What concept holds that biodiversity has inherent value independent of any direct benefit to humans — an ethical argument for conservation?",

  ap_bio_u8_090:
    "What process breaks continuous habitat into smaller, isolated patches — reducing gene flow, increasing edge effects, and making species vulnerable to extinction?",

  ap_bio_u8_097:
    "What process occurs when CO₂ dissolves in seawater to form carbonic acid (H₂CO₃), lowering ocean pH and dissolving calcium carbonate structures of corals and shellfish?",

  ap_bio_u8_098:
    "What process involves chlorofluorocarbons (CFCs) breaking down ozone (O₃) molecules in the stratosphere, reducing UV absorption and increasing UV reaching Earth's surface?",

  ap_bio_specific_heat:
    "Which property of water allows it to absorb or release large amounts of heat with only small changes in temperature, helping living organisms maintain homeostatic body temperature?",

  ap_bio_heat_vaporization:
    "When humans sweat, water evaporating from the skin carries away large amounts of heat. Which property of water makes this evaporative cooling mechanism effective for maintaining body temperature?",

  ap_bio_cohesion_adhesion:
    "Water molecules form hydrogen bonds with each other, resulting in a tendency to stick together. What is the term for this property of water that contributes to the transport of water up tall plant stems?",

  ap_bio_active_transport_def:
    "What type of membrane transport requires direct input of metabolic energy (ATP) and can move molecules against their concentration gradient, from low to high concentration?",

  ap_bio_compartmentalization_benefit:
    "Internal membranes and membrane-bound organelles in eukaryotic cells contribute to compartmentalization in two main ways: separating competing reactions and providing specialized enzymatic environments.",

  ap_bio_enzyme_competitive_inhibitor:
    "What type of enzyme inhibitor binds reversibly to the active site, directly blocking substrate access, and can be overcome by increasing substrate concentration?",

  ap_bio_enzyme_noncompetitive_inhibitor:
    "What type of enzyme inhibitor binds to the allosteric site (not the active site), changing the enzyme's shape and reducing its activity regardless of substrate concentration?",

  ap_bio_signal_transduction_three_steps:
    "What are the three sequential stages of a signal transduction pathway?",

  ap_bio_transduction_intracellular_domain:
    "After a ligand binds to the extracellular domain of a receptor protein, what structural change occurs in the receptor to begin the transduction phase?",

  ap_bio_cell_cycle_checkpoint_three:
    "At which three points in the cell cycle do internal control checkpoints verify that conditions are appropriate before the cell is allowed to proceed to the next stage?",

  ap_bio_spindle_checkpoint_purpose:
    "What does the spindle assembly checkpoint (M checkpoint) verify before allowing the cell to proceed from metaphase to anaphase?",

  ap_bio_g1_checkpoint_commitment:
    "Which cell cycle checkpoint is considered the primary commitment point — sometimes called the restriction point — at which the cell decides whether to proceed with DNA replication or exit to G0?",

  ap_bio_three_sources_genetic_variation:
    "According to AP Biology CED, what are the three mechanisms by which sexual reproduction generates genetic variation among offspring?",

  ap_bio_nondisjunction_meiosis_I_vs_II:
    "If nondisjunction occurs during meiosis I (homologs fail to separate), how many of the four resulting gametes will have an abnormal chromosome number?",

  ap_bio_transcription_direction:
    "In what direction does RNA polymerase read the DNA template strand, and in what direction is the mRNA strand synthesized?",

  ap_bio_intron_exon_splicing:
    "During eukaryotic RNA processing, what happens to introns and exons in the pre-mRNA transcript?",

  ap_bio_genetic_code_degeneracy:
    "What property of the genetic code is described by the fact that most amino acids are specified by more than one codon?",

  ap_bio_transcription_factor:
    "What term describes the proteins that bind to specific DNA sequences near a gene's promoter or enhancer to control whether RNA polymerase initiates transcription?",

  ap_bio_mutation_source_random:
    "AP Biology emphasizes which key principle about how mutations occur and their effect on fitness?",

  ap_bio_phenotypic_variation_substrate:
    "Natural selection acts on which type of variation in a population — the observable differences among individuals that may be heritable?",

  ap_bio_fossil_record_evidence:
    "What preserved physical evidence of past life, dated by rock age and radiometric isotope decay rates, provides a chronological record of morphological change in lineages over millions of years?",

  ap_bio_shared_derived_character:
    "What term describes a trait that evolved in the common ancestor of a group and is shared by all descendants of that ancestor, used to identify clades and reconstruct phylogenetic trees?",

  ap_bio_low_diversity_extinction:
    "When a population has very low genetic diversity — such as after a severe bottleneck or in a small, isolated colony — what consequence does the AP Biology CED identify as a direct risk?",

  ap_bio_nitrogen_fixation:
    "Certain bacteria (including Rhizobium in root nodules) convert atmospheric N2 into ammonia (NH3), which ionizes to ammonium (NH4+). What is this process called?",

  ap_bio_nitrogen_cycle_steps:
    "Certain anaerobic bacteria convert nitrate (NO3-) back into nitrogen gas (N2), returning it to the atmosphere and completing the nitrogen cycle. What is this process called?",

  ap_bio_trophic_cascade:
    "When sea otters were hunted to near-extinction off the Pacific coast, sea urchin populations exploded and consumed kelp forests, which collapsed — destroying habitat for hundreds of species. This chain reaction of effects across trophic levels is called what?",

  ap_bio_eutrophication:
    "Fertilizer runoff from farms enters a lake, causing explosive algal blooms. When the algae die and decompose, bacteria consume all the dissolved oxygen, creating a dead zone where fish cannot survive. What is this process called?",

  // ---------------------------------------------------------------------------
  // ap_chemistry.json
  // ---------------------------------------------------------------------------
  ap_chem_1_4_mixture_vs_pure_substance:
    "What distinguishes a mixture from a pure substance in terms of composition?",

  ap_chem_115_valence_electrons_nitrogen:
    "Nitrogen (atomic number 7) has the electron configuration 1s²2s²2p³. How many valence electrons does a neutral nitrogen atom have?",

  ap_chem_116_pes_peak_height_electrons:
    "In a PES spectrum, the relative height (intensity) of each peak is proportional to what property of the corresponding subshell?",

  ap_chem_116_pes_number_of_peaks:
    "Magnesium has the electron configuration 1s²2s²2p⁶3s². How many distinct peaks would appear in the PES spectrum of a magnesium atom?",

  ap_chem_117_effective_nuclear_charge:
    "The net positive nuclear charge experienced by an electron after accounting for the shielding effect of inner electrons is called what?",

  ap_chem_117_metallic_character_trend:
    "Moving down a group on the periodic table, what happens to metallic character?",

  ap_chem_u2_bond_length_inverse_order:
    "As the bond order between two atoms increases from single to double to triple, what happens to the bond length?",

  ap_chem_u2_alloy_substitutional:
    "In brass, zinc atoms replace some copper atoms in the crystal lattice because the atoms are similar in size. What type of alloy is brass?",

  ap_chem_u2_alloy_interstitial:
    "Steel is formed when small carbon atoms occupy the gaps between iron atoms in the metal lattice. What type of alloy is steel?",

  ap_chem_u2_lewis_polyatomic_charge_electrons:
    "When drawing the Lewis structure of a negatively charged polyatomic ion like NO3–, how do you account for the negative charge in the total electron count?",

  ap_chem_u2_formal_charge_minimize:
    "When choosing among multiple valid Lewis structures for the same molecule, the preferred (most accurate) structure is the one that does what with formal charges?",

  ap_chem_u2_hybridization_sp2:
    "A carbon atom in ethylene (C2H4) has three electron domains — two C–H bonds and one C=C bond. What hybridization does this carbon adopt?",

  ap_chem_u2_sigma_pi_bonds:
    "A double bond between two atoms consists of how many sigma bonds and how many pi bonds?",

  ap_chem_3_1_hydrogen_bonding_requirement:
    "What structural requirement must a molecule meet to participate in hydrogen bonding as the donor?",

  ap_chem_3_2_covalent_network_solid:
    "Diamond, quartz (SiO2), and silicon carbide (SiC) are examples of what type of solid, characterized by extremely high melting points and a continuous lattice of covalent bonds?",

  ap_chem_3_7_molarity_definition:
    "Molarity (M) is defined as the number of moles of solute divided by what quantity?",

  ap_chem_3_7_molality_definition:
    "Molality (m) is a concentration unit defined as moles of solute per what?",

  ap_chem_4_5_percent_yield_formula:
    "What is the formula for percent yield in a chemical reaction?",

  ap_chem_4_8_amphoteric_water:
    "Water can act as either an acid (donating H+) or a base (accepting H+). What property does this give water?",

  ap_chem_5_1_disappearance_vs_appearance:
    "When writing rate expressions using Δ[concentration]/Δt, what sign convention applies to reactants versus products?",

  ap_chem_5_3_half_life_order_comparison:
    "How do the half-life formulas differ between zero-order and second-order reactions?",

  ap_chem_6_7_bond_enthalpy_gas_phase_only:
    "Bond enthalpy calculations for ΔHrxn are estimates that are strictly valid only for reactions in which physical state?",

  ap_chem_7_4_Kc_from_concentration_data:
    "Given experimentally measured equilibrium concentrations of all species, what is the procedure for calculating the equilibrium constant Kc?",

  ap_chem_7_4_five_percent_approximation:
    "In ICE table problems where K is very small, what mathematical shortcut allows students to avoid solving a quadratic equation, and what percentage threshold is used to check its validity?",

  ap_chem_7_5_K_much_greater_than_1:
    "When the equilibrium constant K is much greater than 1 (K >> 1), what does this indicate about the relative amounts of products and reactants at equilibrium?",

  ap_chem_7_7_ICE_table_setup:
    "In an ICE table, what information is entered in each of the three rows — I, C, and E — when solving an equilibrium problem from initial conditions?",

  ap_chem_7_7_equilibrium_concentrations_from_K:
    "Given K and initial concentrations, describe the complete procedure for calculating the equilibrium concentrations of each species.",

  ap_chem_7_11_ksp_definition:
    "The equilibrium constant for the dissolution of a slightly soluble ionic compound in water is called the ___.",

  ap_chem_7_13_ph_no_effect_strong_acid_salt:
    "Unlike salts with basic anions, the solubility of which type of slightly soluble salt is NOT affected by changes in pH?",

  ap_chem_8_2_strong_base_ph_method:
    "To calculate the pH of a strong base solution, what is the correct two-step method?",

  ap_chem_8_6_binary_acid_hf_hcl_hbr_hi_strength:
    "Going down the halogen group (HF → HCl → HBr → HI), binary acid strength increases because what bond property decreases?",

  ap_chem_8_6_hf_weak_acid_despite_electronegativity:
    "Which hydrogen halide is classified as a weak acid despite fluorine being the most electronegative halogen?",

  ap_chem_8_8_buffer_range_pka_plus_minus_1:
    "The effective buffering range of a weak acid/conjugate base buffer system spans what interval?",

  // ---------------------------------------------------------------------------
  // ap_human_geography.json
  // ---------------------------------------------------------------------------
  aphg_u1_overlapping_regions:
    "The fact that a city can simultaneously be in the 'Sunbelt,' the 'Bible Belt,' and a state's political district demonstrates which key property of geographic regions?",

  aphg_u2_imr:
    "Which development indicator measures the number of infant deaths per 1,000 live births in a given year?",

  aphg_u2_women_dtm_progression:
    "Which factor — linked to DTM Stage 3 — is most closely associated with women's changing demographic role?",

  aphg_u3_assimilation:
    "When a minority group fully adopts the culture, language, and customs of the majority culture, losing its original cultural identity, what process is occurring?",

  aphg_u3_sino_tibetan:
    "Which language family, cited in the CED, includes Mandarin Chinese, Tibetan, and Burmese and is the second-largest by number of native speakers?",

  aphg_u5_hearth_east_asia:
    "Millet and rice were first cultivated in what region, making it an early agricultural hearth?",

  aphg_u5_second_agricultural_revolution:
    "What agricultural transformation, occurring in Europe from the 1700s onward, introduced crop rotation, selective livestock breeding, and improved tools that increased productivity?",

  aphg_u5_mixed_crop_livestock:
    "What agricultural system integrates crop growing and animal raising on the same farm, cycling nutrients between them?",

  aphg_u5_soil_salinization:
    "What process describes the buildup of salt in soil from excessive irrigation, reducing fertility over time?",

  aphg_u5_fair_trade:
    "What market-based movement ensures producers in developing countries receive fair prices and better labor conditions?",

  aphg_u5_carrying_capacity_agriculture:
    "What land capacity measure has agricultural technology increased, allowing land to support larger populations?",

  aphg_u6_burgess_model:
    "Which urban land-use model depicts cities as a series of concentric rings expanding outward from the Central Business District?",

  aphg_u6_multiple_nuclei_model:
    "Which urban land-use model, developed by Harris and Ullman, argues that cities have multiple centers of activity rather than a single CBD?",

  aphg_u6_southeast_asian_city_model:
    "Which urban model describes a port zone as the dominant center, surrounded by a commercial zone and ethnic quarters radiating outward, reflecting colonial-era Southeast Asian cities?",

  aphg_u6_environmental_injustice:
    "What term describes the disproportionate burden of environmental hazards on low-income communities and communities of color?",

  aphg_u6_inclusionary_zoning:
    "What urban housing policy requires developers to include affordable housing units in new market-rate residential projects?",

  aphg_u7_export_processing_zones:
    "Industrial areas, common in LDCs, where goods are assembled for export using cheap labor with minimal environmental and labor regulations are called ___.",

  aphg_u7_sustainable_development:
    "Development that meets the needs of the present without compromising the ability of future generations to meet their own needs is the UN definition of ___.",

  aphg_u7_sdgs:
    "The 17 goals adopted by the United Nations in 2015 to end poverty, protect the planet, and ensure prosperity for all by 2030 are called the ___.",

  // ---------------------------------------------------------------------------
  // ap_macroeconomics.json
  // ---------------------------------------------------------------------------
  ap_macro_2a_gdp_final_vs_intermediate:
    "Which type of goods are EXCLUDED from GDP to avoid double-counting — for example, the steel used by a car manufacturer to build a vehicle?",

  ap_macro_2a_gdp_final_goods_included:
    "GDP includes only which type of goods and services — those purchased by the ultimate end-user rather than used as inputs in further production?",

  ap_macro_5a_adaptive_expectations:
    "What model of expectations assumes people base their predictions of future inflation primarily on past inflation rates?",

  ap_macro_5b_complete_crowding_out:
    "What type of crowding out occurs when government spending rises by exactly as much as private investment falls, leaving total spending and GDP unchanged?",

  ap_macro_5b_partial_crowding_out:
    "What type of crowding out occurs when government spending raises interest rates only partially, so GDP still rises but by less than the simple multiplier predicts?",

  // ---------------------------------------------------------------------------
  // ap_microeconomics.json
  // ---------------------------------------------------------------------------
  ap_micro_3b_027:
    "What type of industry has an upward-sloping long-run supply curve because entry bids up the price of specialized inputs?",

  ap_micro_4a_010:
    "After finding the profit-maximizing quantity using MR = MC, where does a monopolist look to determine the price it will charge?",

  ap_micro_4a_040:
    "Under fair-return regulation (P = ATC), what happens to deadweight loss compared to the unregulated monopoly — and why doesn't this regulation fully solve the efficiency problem?",

  ap_micro_4b_023:
    "Which type of inefficiency occurs in monopolistic competition because price exceeds marginal cost, meaning too little output is produced relative to the social optimum?",

  ap_micro_4b_024:
    "Which type of inefficiency is shown by excess capacity in monopolistic competition — the firm produces below the minimum point on its ATC curve?",

  ap_micro_4b_026:
    "What type of oligopoly sells essentially identical products — like steel, cement, or crude oil — so firms compete mainly on price?",

  ap_micro_4b_027:
    "What type of oligopoly sells distinguishable products — like automobiles or smartphones — giving firms some pricing power beyond pure price competition?",

  ap_micro_4b_031:
    "What type of game requires all players to choose their strategies at the same time, without observing what rivals decide — typically displayed as a payoff matrix?",

  // ---------------------------------------------------------------------------
  // ap_physics_1.json
  // ---------------------------------------------------------------------------
  ap_phys1_component_addition:
    "When adding two vectors using the component method, what is the correct procedure?",

  ap_phys1_deceleration_misconception:
    "Why is 'deceleration' not the same as 'negative acceleration' in physics?",

  ap_phys1_relative_velocity_concept:
    "If object A moves at velocity vA and object B moves at velocity vB (both measured relative to the ground), what is the velocity of A as seen by B?",

  ap_phys1_system_internal_external:
    "In systems thinking, what is the difference between internal forces and external forces?",

  ap_phys1_cm_symmetry:
    "Where is the center of mass located in an object with uniform density and symmetric shape?",

  ap_phys1_normal_force_not_always_weight:
    "Why is it incorrect to always assume the normal force equals the object's weight?",

  ap_phys1_static_vs_kinetic_friction:
    "What is the key difference between static friction and kinetic friction?",

  ap_phys1_banked_curve:
    "On a banked curve with no friction, what force provides the centripetal acceleration for a car?",

  ap_phys1_incline_component_forces:
    "For an object on a frictionless incline of angle θ, how do you decompose the weight into components?",

  ap_phys1_system_single_object:
    "When is it valid to treat a multi-object system as a single object in Newton's 2nd law?",

  ap_phys1_friction_independent_area:
    "Does the kinetic friction force change if you increase the contact area between two surfaces (same material, same normal force)?",

  ap_phys1_tension_rope_mass:
    "Under what condition is the tension in a rope uniform (the same at every point)?",

  ap_phys1_spring_series_parallel:
    "How does the effective spring constant differ for springs connected in series vs. in parallel?",

  ap_phys1_angle_friction_starts_sliding:
    "At what angle of an incline does an object just begin sliding, and how is that angle related to the coefficient of static friction?",

  ap_phys1_drag_qualitative:
    "Qualitatively, how does air drag affect a falling object, and what is terminal velocity?",

  ap_phys1_circular_speed_radius:
    "For an object moving in a circular path with fixed centripetal force and mass, how does speed change if the radius doubles?",

  ap_phys1_fbd_contact_vs_field:
    "What is the distinction between contact forces and field forces, and which appear on free-body diagrams?",

  ap_phys1_energy_bar_charts:
    "What does an energy bar chart (LOL diagram) represent in AP Physics 1?",

  ap_phys1_work_spring:
    "How much work is required to compress or stretch a spring by displacement x from its natural length?",

  ap_phys1_ke_speed_quadrupling:
    "If a car's speed doubles, by what factor does its kinetic energy change?",

  ap_phys1_height_to_speed:
    "Using conservation of energy, what is the speed of an object that falls from height h starting from rest?",

  ap_phys1_energy_forms:
    "What are the four main forms of energy tracked in AP Physics 1 conservation problems?",

  ap_phys1_gravitational_pe_reference:
    "Why can you choose any reference level for gravitational potential energy?",

  ap_phys1_pe_gravity_path_indep:
    "Does the work done by gravity depend on whether a ball rolls down a ramp or falls straight down the same vertical distance?",

  ap_phys1_recoil_gun:
    "A bullet is fired from a stationary gun at rest. Why does the gun recoil backward?",

  ap_phys1_ke_loss_formula_inelastic:
    "In a perfectly inelastic collision, what is the easiest method to find kinetic energy lost?",

  ap_phys1_equal_mass_elastic:
    "What happens in a perfectly elastic 1D collision between two equal-mass balls when one is initially stationary?",

  ap_phys1_seesaw_torque_balance:
    "A heavy person sits 1 m from the pivot of a seesaw; where must a lighter person sit to balance it?",

  ap_phys1_disk_vs_ring_faster:
    "A solid disk and a hollow ring of equal mass and radius roll down an incline. Which reaches the bottom first?",

  ap_phys1_torque_zero_cases:
    "Under what conditions does a force produce zero torque about a given axis?",

  ap_phys1_pivot_choice_strategy:
    "What is the strategic advantage of choosing a smart pivot point when writing the torque equation for static equilibrium?",

  ap_phys1_rolling_ke_total:
    "What is the total kinetic energy of an object rolling without slipping?",

  ap_phys1_figure_skater_angular_momentum:
    "Why does a figure skater spin faster when they pull their arms in?",

  ap_phys1_cons_ang_momentum_condition:
    "Under what condition is the angular momentum of a system conserved?",

  ap_phys1_satellite_orbit_speed:
    "What is the orbital speed of a satellite at orbital radius r around a planet of mass M?",

  ap_phys1_kepler3_application:
    "If a satellite's orbital radius doubles, by what factor does its orbital period increase?",

  ap_phys1_pendulum_mass_independence:
    "A 100 kg pendulum bob and a 1 kg bob on identical strings are released from the same small angle. Which has a longer period?",

  ap_phys1_gauge_absolute_pressure:
    "A tire gauge reads 30 PSI (gauge). What is the actual absolute pressure inside the tire?",

  ap_phys1_hydrostatic_shape_independence:
    "A narrow cylinder and a wide tank are both filled with water to the same height. Which has greater pressure at the bottom?",

  ap_phys1_bernoulli_applications:
    "What are three real-world applications of the Bernoulli effect (faster fluid speed = lower pressure)?",

  ap_phys1_viscosity_laminar_turbulent:
    "What is viscosity, and what distinguishes laminar from turbulent flow?",

  ap_phys1_neutral_buoyancy:
    "What is neutral buoyancy and how do submarines achieve it?",

  // ---------------------------------------------------------------------------
  // ap_psychology.json
  // ---------------------------------------------------------------------------
  ap_psych_sleep_freud_dreams:
    "Sigmund Freud argued in 'The Interpretation of Dreams' (1899) that dreams are the 'royal road to the unconscious' and represent the disguised expression of repressed desires. He called this phenomenon what?",

  ap_psych_diathesis_stress:
    "Which model proposes that a psychological disorder emerges when a genetic or biological predisposition (diathesis) is combined with sufficient environmental stress or adversity?",

  // ---------------------------------------------------------------------------
  // ap_us_history.json
  // ---------------------------------------------------------------------------
  apush_p3_elastic_clause:
    "What constitutional provision grants Congress the power to make all laws 'necessary and proper' for carrying out its enumerated powers, allowing broad federal action beyond specifically listed powers?",

  apush_p4_war_of_1812_causes:
    "What was one of the primary causes of the War of 1812 — the British practice of seizing American sailors from their ships and forcing them into the Royal Navy?",

  apush_p7_committee_public_information:
    "Which WWI government agency, led by George Creel, used propaganda posters, pamphlets, and 'Four Minute Men' speakers to mobilize American public opinion in support of the war?",

  apush_p7_double_v_campaign:
    "What was the name of the WWII-era campaign promoted by the Pittsburgh Courier calling for victory against fascism abroad and victory against racial discrimination at home?",

  apush_p9_sdi_star_wars:
    "What Reagan defense program, nicknamed 'Star Wars,' proposed developing space-based and ground-based systems to intercept and destroy incoming Soviet nuclear missiles?",

  // ---------------------------------------------------------------------------
  // ap_world_history.json
  // ---------------------------------------------------------------------------
  apwh_7_004:
    "What type of warfare on the Western Front created a stalemate for most of World War I, characterized by soldiers living and fighting in dug-out trenches?",

  apwh_1_061:
    "The Aztec Empire used human sacrifice on a massive scale. What religious rationale justified this practice in Aztec cosmology?",

  apwh_3_047:
    "Why did the Ottoman conquest of Constantinople (1453) motivate European powers to seek alternative sea routes to Asia?",

  apwh_9_022:
    "The Syrian Civil War (2011–present) created the largest refugee crisis since World War II. Approximately how many Syrian civilians were displaced internationally?",

  apush_p8_voting_rights_act:
    "What August 1965 law signed by President Johnson prohibited discriminatory voting practices such as literacy tests, and required federal oversight of elections in states with a history of discrimination?",

  apwh_8_014:
    "The Tet Offensive of January 1968, in which North Vietnamese and Viet Cong forces attacked over 100 South Vietnamese cities simultaneously, had what key effect on US public opinion?",

};

// ============================================================================
// Apply fixes to each deck file
// ============================================================================

const files = [
  'ancient_greece.json',
  'ancient_rome.json',
  'ap_biology.json',
  'ap_chemistry.json',
  'ap_european_history.json',
  'ap_human_geography.json',
  'ap_macroeconomics.json',
  'ap_microeconomics.json',
  'ap_physics_1.json',
  'ap_psychology.json',
  'ap_us_history.json',
  'ap_world_history.json',
];

let totalFixed = 0;
let notFound = [];

for (const filename of files) {
  const filepath = path.join(DECKS_DIR, filename);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  let fixedInFile = 0;

  for (const fact of data.facts) {
    if (FIXES[fact.id]) {
      const oldQ = fact.quizQuestion;
      fact.quizQuestion = FIXES[fact.id];
      fixedInFile++;
      totalFixed++;
    }
  }

  if (fixedInFile > 0) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`${filename}: fixed ${fixedInFile} questions`);
  } else {
    console.log(`${filename}: no fixes applied`);
  }
}

// Check for IDs in FIXES that weren't found in any file
for (const [id] of Object.entries(FIXES)) {
  let found = false;
  for (const filename of files) {
    const filepath = path.join(DECKS_DIR, filename);
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    if (data.facts.some(f => f.id === id)) {
      found = true;
      break;
    }
  }
  if (!found) {
    notFound.push(id);
  }
}

console.log(`\nTotal fixed: ${totalFixed}`);
if (notFound.length > 0) {
  console.log('IDs in FIXES not found in any file:', notFound);
}

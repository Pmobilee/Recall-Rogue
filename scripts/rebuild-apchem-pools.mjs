/**
 * rebuild-apchem-pools.mjs
 *
 * Redesigns all answer type pool assignments for the AP Chemistry deck.
 * Each pool must contain only members that could plausibly be confused with each other.
 *
 * Pool strategy:
 *   bracket_numbers       — numeric answers with {N} notation (keep as-is)
 *   equation_formulas     — named equations written as math (PV=nRT, E=hν, etc.)
 *   named_laws_principles — named laws/principles (Boyle's Law, Hess's Law, etc.)
 *   chemistry_concepts    — short terms/concepts ≤ ~3 words
 *   bond_and_imf_types    — bond types and IMF types
 *   molecular_geometries  — VSEPR geometry names
 *   element_names         — element names
 *   compound_names        — compound names/formulas
 *   reaction_types        — types of reactions and evidence of reaction
 *   equilibrium_concepts  — equilibrium-specific short terms (Q<K, shifts right, K, Ka, pKa…)
 *   process_types         — physical/thermodynamic process terms
 *   electrochemistry_terms— electrochemistry cell parts and terms
 *   periodic_trend_terms  — atomic structure / periodic trend short labels
 *   unique_answers        — answers > 40 chars or otherwise non-poolable
 */

import { readFileSync, writeFileSync } from 'fs';

const DECK_PATH = new URL('../data/decks/ap_chemistry.json', import.meta.url).pathname;
const deck = JSON.parse(readFileSync(DECK_PATH, 'utf8'));

// ─── Manual assignment map: factId → newPoolId ────────────────────────────────
// Every fact is listed. Assignments determined by examining correctAnswer.

const assignments = {
  // ── Unit 1: Stoichiometry & Atomic Structure ──────────────────────────────
  ap_chem_1_1_avogadro_number:              'bracket_numbers',
  ap_chem_1_1_mole_definition:              'chemistry_concepts',       // "amount of substance"
  ap_chem_1_1_molar_mass_carbon:            'bracket_numbers',
  ap_chem_1_1_molar_mass_water:             'bracket_numbers',
  ap_chem_1_1_moles_to_grams_conversion:    'chemistry_concepts',       // "multiply by molar mass"
  ap_chem_1_1_molar_mass_nacl:              'bracket_numbers',
  ap_chem_1_1_particles_from_moles:         'bracket_numbers',
  ap_chem_1_1_molar_mass_units:             'chemistry_concepts',       // "g/mol"
  ap_chem_1_2_isotope_definition:           'chemistry_concepts',       // "same protons, different neutrons"
  ap_chem_1_2_mass_spectrum_x_axis:         'chemistry_concepts',       // "mass-to-charge ratio"
  ap_chem_1_2_average_atomic_mass_calculation: 'chemistry_concepts',   // "weighted average of isotope masses"
  ap_chem_1_2_carbon_12_isotope:            'bracket_numbers',
  ap_chem_1_2_chlorine_isotopes:            'compound_names',           // "chlorine-35 and chlorine-37"
  ap_chem_1_2_relative_abundance_y_axis:    'chemistry_concepts',       // "relative abundance"
  ap_chem_1_3_percent_composition_formula:  'unique_answers',           // "(mass of element / molar mass) × 100" — 44 chars
  ap_chem_1_3_empirical_formula_definition: 'chemistry_concepts',       // "simplest whole-number ratio"
  ap_chem_1_3_molecular_vs_empirical:       'chemistry_concepts',       // "whole-number multiple of empirical"
  ap_chem_1_3_combustion_analysis_products: 'compound_names',           // "CO₂ and H₂O"
  ap_chem_1_3_percent_composition_co2:      'bracket_numbers',
  ap_chem_1_3_empirical_formula_steps:      'unique_answers',           // 38 chars — borderline but procedural
  ap_chem_1_4_mass_percent_definition:      'unique_answers',           // "(mass of component / total mass) × 100" 41 chars
  ap_chem_1_4_mole_fraction_definition:     'chemistry_concepts',       // "moles of component / total moles"
  ap_chem_1_4_purity_definition:            'unique_answers',           // 43 chars
  ap_chem_1_4_mole_fraction_sum:            'bracket_numbers',
  ap_chem_1_4_mixture_vs_pure_substance:    'chemistry_concepts',       // "variable composition"

  // ── Unit 1.5: Electron Configuration ─────────────────────────────────────
  ap_chem_115_atomic_number_protons:        'periodic_trend_terms',     // "Atomic number"
  ap_chem_115_mass_number_definition:       'periodic_trend_terms',     // "Protons and neutrons"
  ap_chem_115_isotopes_definition:          'periodic_trend_terms',     // "Number of neutrons"
  ap_chem_115_aufbau_principle:             'named_laws_principles',    // "Aufbau principle"
  ap_chem_115_pauli_exclusion:              'named_laws_principles',    // "Pauli exclusion principle"
  ap_chem_115_hunds_rule:                   'named_laws_principles',    // "Hund's rule"
  ap_chem_115_valence_electrons_nitrogen:   'bracket_numbers',
  ap_chem_115_core_vs_valence:              'periodic_trend_terms',     // "Core electrons"
  ap_chem_115_electron_config_chlorine:     'periodic_trend_terms',     // "[Ne]3s²3p⁵"
  ap_chem_115_orbital_capacity_d_subshell:  'bracket_numbers',

  // ── Unit 1.6: PES ─────────────────────────────────────────────────────────
  ap_chem_116_pes_peak_subshells:           'periodic_trend_terms',     // "Subshells"
  ap_chem_116_pes_binding_energy_distance:  'periodic_trend_terms',     // "Higher binding energy"
  ap_chem_116_pes_peak_height_electrons:    'periodic_trend_terms',     // "Number of electrons in that subshell"
  ap_chem_116_pes_number_of_peaks:          'bracket_numbers',
  ap_chem_116_pes_identify_element:         'periodic_trend_terms',     // "Electron configuration"

  // ── Unit 1.7: Periodic Trends ─────────────────────────────────────────────
  ap_chem_117_ie_across_period:             'periodic_trend_terms',     // "Increases"
  ap_chem_117_ie_down_group:                'periodic_trend_terms',     // "Decreases"
  ap_chem_117_highest_electronegativity:    'element_names',            // "Fluorine"
  ap_chem_117_electronegativity_trend_period:'periodic_trend_terms',   // "Increases"
  ap_chem_117_atomic_radius_across_period:  'periodic_trend_terms',     // "Decreases"
  ap_chem_117_atomic_radius_down_group:     'periodic_trend_terms',     // "Increases"
  ap_chem_117_effective_nuclear_charge:     'periodic_trend_terms',     // "Effective nuclear charge"
  ap_chem_117_shielding_effect:             'periodic_trend_terms',     // "Shielding effect"
  ap_chem_117_metallic_character_trend:     'periodic_trend_terms',     // "Increases"
  ap_chem_117_electron_affinity_fluorine_vs_chlorine: 'element_names', // "Chlorine"

  // ── Unit 1.8: Ions ────────────────────────────────────────────────────────
  ap_chem_118_valence_electrons_from_group: 'periodic_trend_terms',     // "Group number"
  ap_chem_118_cation_formation:             'periodic_trend_terms',     // "Loses electrons"
  ap_chem_118_anion_formation:              'periodic_trend_terms',     // "Gains electrons"
  ap_chem_118_calcium_ion_charge:           'chemistry_concepts',       // "2+"
  ap_chem_118_ionic_compound_formula_nacl:  'chemistry_concepts',       // "NaCl"

  // ── Unit 2: Bonding ───────────────────────────────────────────────────────
  ap_chem_u2_bond_type_electronegativity_ionic:  'bond_and_imf_types',  // "Ionic bond"
  ap_chem_u2_bond_type_nonpolar_range:           'bond_and_imf_types',  // "Nonpolar covalent bond"
  ap_chem_u2_bond_type_metallic_electron_sea:    'bond_and_imf_types',  // "Electron sea model" → belongs with bond types
  ap_chem_u2_bond_type_polar_covalent_range:     'bond_and_imf_types',  // "Polar covalent bond"
  ap_chem_u2_bond_type_covalent_partners:        'chemistry_concepts',  // "Two nonmetals"
  ap_chem_u2_bond_energy_equilibrium_distance:   'chemistry_concepts',  // "Equilibrium bond length"
  ap_chem_u2_bond_order_strength:                'bond_and_imf_types',  // "Triple bond"
  ap_chem_u2_bond_energy_endothermic_breaking:   'process_types',       // "Endothermic"
  ap_chem_u2_bond_length_inverse_order:          'chemistry_concepts',  // "Bond length decreases" — a relationship, not law
  ap_chem_u2_ionic_solid_lattice:                'chemistry_concepts',  // "Crystal lattice"
  ap_chem_u2_lattice_energy_charge:              'chemistry_concepts',  // "Increases"
  ap_chem_u2_ionic_solid_properties_brittle:     'chemistry_concepts',  // "Brittle"
  ap_chem_u2_ionic_conductivity_dissolved:       'unique_answers',      // 41 chars "When dissolved in water or melted"
  ap_chem_u2_alloy_substitutional:               'chemistry_concepts',  // "Substitutional alloy"
  ap_chem_u2_alloy_interstitial:                 'chemistry_concepts',  // "Interstitial alloy"
  ap_chem_u2_metallic_malleability:              'chemistry_concepts',  // "Malleability and ductility"
  ap_chem_u2_lewis_octet_rule:                   'chemistry_concepts',  // "Eight electrons"
  ap_chem_u2_lewis_bf3_exception:                'compound_names',      // "BF3"
  ap_chem_u2_lewis_sf6_expanded:                 'compound_names',      // "SF6"
  ap_chem_u2_lewis_polyatomic_charge_electrons:  'chemistry_concepts',  // "Add one electron per negative charge"
  ap_chem_u2_lewis_lone_pairs_vs_bonding:        'chemistry_concepts',  // "Lone pairs"
  ap_chem_u2_resonance_ozone:                    'compound_names',      // "Ozone (O3)"
  ap_chem_u2_formal_charge_formula:              'unique_answers',      // 76 chars
  ap_chem_u2_resonance_delocalized:              'chemistry_concepts',  // "Delocalized electrons"
  ap_chem_u2_formal_charge_minimize:             'chemistry_concepts',  // "Minimizes formal charges"
  ap_chem_u2_vsepr_tetrahedral_geometry:         'molecular_geometries',
  ap_chem_u2_vsepr_trigonal_pyramidal:           'molecular_geometries',
  ap_chem_u2_hybridization_sp2:                  'bond_and_imf_types',  // "sp2" — hybridization type
  ap_chem_u2_sigma_pi_bonds:                     'chemistry_concepts',  // "One sigma bond and one pi bond"
  ap_chem_u2_vsepr_octahedral_sf6:               'molecular_geometries',

  // ── Unit 3: IMF, Gases, Solutions ─────────────────────────────────────────
  ap_chem_3_1_london_dispersion_def:             'bond_and_imf_types',  // "London dispersion forces"
  ap_chem_3_1_ldf_molar_mass:                    'chemistry_concepts',  // "molar mass"
  ap_chem_3_1_dipole_dipole_def:                 'bond_and_imf_types',  // "dipole-dipole forces"
  ap_chem_3_1_hydrogen_bonding_requirement:      'bond_and_imf_types',  // "hydrogen bonded to F, O, or N"
  ap_chem_3_1_imf_strength_order:                'unique_answers',      // "LDF < dipole-dipole < hydrogen bonding" 39 chars — keep as unique
  ap_chem_3_1_boiling_point_imf:                 'chemistry_concepts',  // "boiling point"
  ap_chem_3_1_ion_dipole:                        'bond_and_imf_types',  // "ion-dipole forces"
  ap_chem_3_1_vapor_pressure_imf:                'chemistry_concepts',  // "vapor pressure"
  ap_chem_3_2_ionic_solid_properties:            'bond_and_imf_types',  // "ionic solid"
  ap_chem_3_2_molecular_solid_properties:        'bond_and_imf_types',  // "molecular solid"
  ap_chem_3_2_covalent_network_solid:            'bond_and_imf_types',  // "covalent network solid"
  ap_chem_3_2_metallic_solid:                    'bond_and_imf_types',  // "metallic solid"
  ap_chem_3_2_solid_type_conductor:              'bond_and_imf_types',  // "metallic solid"
  ap_chem_3_3_boiling_definition:                'unique_answers',      // 42 chars "vapor pressure equals atmospheric pressure"
  ap_chem_3_3_heating_curve_plateau:             'chemistry_concepts',  // "temperature remains constant"
  ap_chem_3_3_sublimation_def:                   'process_types',       // "sublimation"
  ap_chem_3_3_vapor_pressure_temperature:        'chemistry_concepts',  // "increases"
  ap_chem_3_3_deposition_def:                    'process_types',       // "deposition"
  ap_chem_3_4_ideal_gas_law:                     'equation_formulas',   // "PV = nRT"
  ap_chem_3_4_gas_constant_R:                    'bracket_numbers',
  ap_chem_3_4_stp_molar_volume:                  'bracket_numbers',
  ap_chem_3_4_boyles_law:                        'named_laws_principles',
  ap_chem_3_4_charles_law:                       'named_laws_principles',
  ap_chem_3_4_stp_definition:                    'chemistry_concepts',  // "0°C and 1 atm"
  ap_chem_3_5_kmt_avg_ke:                        'chemistry_concepts',  // "average kinetic energy"
  ap_chem_3_5_maxwell_boltzmann:                 'named_laws_principles',
  ap_chem_3_5_kmt_elastic_collisions:            'chemistry_concepts',  // "elastic collisions"
  ap_chem_3_6_real_gas_high_pressure:            'chemistry_concepts',  // "high pressure"
  ap_chem_3_6_real_gas_low_temperature:          'chemistry_concepts',  // "low temperature"
  ap_chem_3_6_van_der_waals:                     'named_laws_principles',
  ap_chem_3_7_like_dissolves_like:               'named_laws_principles',
  ap_chem_3_7_molarity_definition:               'unique_answers',      // "moles of solute per liter of solution" 37 chars — poolable actually
  ap_chem_3_7_molality_definition:               'unique_answers',      // "moles of solute per kilogram of solvent" 39 chars
  ap_chem_3_7_polar_solvent_example:             'compound_names',      // "water"
  ap_chem_3_7_solute_solvent_roles:              'chemistry_concepts',  // "solvent"
  ap_chem_3_8_vant_hoff_factor:                  'unique_answers',      // 73 chars
  ap_chem_3_8_boiling_point_elevation:           'equation_formulas',   // "ΔTb = i·Kb·m"
  ap_chem_3_8_freezing_point_depression:         'equation_formulas',   // "ΔTf = i·Kf·m"
  ap_chem_3_8_osmotic_pressure:                  'equation_formulas',   // "π = iMRT"
  ap_chem_3_8_raoults_law_vapor_pressure:        'named_laws_principles', // "vapor pressure lowering" — Raoult's Law concept
  ap_chem_3_9_distillation_principle:            'chemistry_concepts',  // "differences in boiling points"
  ap_chem_3_9_chromatography_principle:          'unique_answers',      // 60 chars
  ap_chem_3_9_filtration_principle:              'chemistry_concepts',  // "differences in particle size"
  ap_chem_3_9_evaporation_separation:            'process_types',       // "evaporation"
  ap_chem_3_10_solubility_rules_nitrate:         'chemistry_concepts',  // "soluble"
  ap_chem_3_10_insoluble_chloride_exceptions:    'compound_names',      // "AgCl, PbCl₂, Hg₂Cl₂"
  ap_chem_3_10_henry_law:                        'equation_formulas',   // "C = kH·P"
  ap_chem_3_10_solubility_temperature_solids:    'chemistry_concepts',  // "increases for most solids"
  ap_chem_3_10_saturated_solution:               'chemistry_concepts',  // "saturated"
  ap_chem_3_11_em_spectrum_order:                'unique_answers',      // 62 chars
  ap_chem_3_11_wavelength_frequency_relationship: 'equation_formulas',  // "c = λν"
  ap_chem_3_11_higher_frequency_higher_energy:   'chemistry_concepts',  // "gamma rays"
  ap_chem_3_11_ir_molecular_vibrations:          'chemistry_concepts',  // "infrared (IR)"
  ap_chem_3_12_planck_equation:                  'equation_formulas',   // "E = hν"
  ap_chem_3_12_plancks_constant_value:           'bracket_numbers',
  ap_chem_3_12_line_spectra_electron_transitions: 'unique_answers',     // 55 chars
  ap_chem_3_12_absorption_vs_emission_spectra:   'chemistry_concepts',  // "absorption spectrum"
  ap_chem_3_13_beer_lambert_law:                 'equation_formulas',   // "A = εlc"
  ap_chem_3_13_absorbance_concentration_relationship: 'chemistry_concepts', // "linear"
  ap_chem_3_13_spectrophotometer_use:            'unique_answers',      // 91 chars

  // ── Unit 4: Reactions ─────────────────────────────────────────────────────
  ap_chem_4_1_evidence_precipitate:             'reaction_types',
  ap_chem_4_1_evidence_color_change:            'reaction_types',
  ap_chem_4_1_evidence_temperature_change:      'reaction_types',
  ap_chem_4_1_chemical_vs_physical_molecular:   'unique_answers',       // 45 chars
  ap_chem_4_2_spectator_ions_definition:         'chemistry_concepts',  // "spectator ions"
  ap_chem_4_2_strong_electrolyte_dissociation:   'chemistry_concepts',  // "completely (100%)"
  ap_chem_4_2_net_ionic_precipitation:           'unique_answers',      // chemical equation — too specific
  ap_chem_4_2_net_ionic_acid_base:               'chemistry_concepts',  // "H+(aq) + OH-(aq) → H2O(l)"
  ap_chem_4_2_molecular_to_net_ionic_steps:      'unique_answers',      // 63 chars
  ap_chem_4_3_balanced_equation_conservation:    'named_laws_principles', // "conservation of mass"
  ap_chem_4_3_coefficients_mole_ratios:          'chemistry_concepts',  // "mole ratios"
  ap_chem_4_3_particulate_diagram_products:      'chemistry_concepts',  // "products"
  ap_chem_4_3_balancing_subscripts_vs_coefficients: 'chemistry_concepts', // "only change coefficients"
  ap_chem_4_4_physical_change_melting:           'process_types',       // "physical change"
  ap_chem_4_4_chemical_change_combustion:        'process_types',       // "chemical change"
  ap_chem_4_4_dissolving_salt_molecular_level:   'chemistry_concepts',  // "intermolecular forces change"
  ap_chem_4_4_oxidation_chemical_change:         'process_types',       // "chemical change"
  ap_chem_4_5_limiting_reagent_definition:       'chemistry_concepts',  // "limiting reagent"
  ap_chem_4_5_excess_reagent_definition:         'chemistry_concepts',  // "excess reagent"
  ap_chem_4_5_percent_yield_formula:             'unique_answers',      // 41 chars
  ap_chem_4_5_theoretical_yield_definition:      'chemistry_concepts',  // "theoretical yield"
  ap_chem_4_5_mole_ratio_conversion:             'chemistry_concepts',  // "mole ratio from balanced equation"
  ap_chem_4_5_limiting_reagent_identification:   'unique_answers',      // 55 chars
  ap_chem_4_5_percent_yield_calculation:         'bracket_numbers',
  ap_chem_4_5_theoretical_yield_from_limiting:   'unique_answers',      // 62 chars
  ap_chem_4_6_titration_definition:              'chemistry_concepts',  // "equivalence point"
  ap_chem_4_6_endpoint_vs_equivalence:           'chemistry_concepts',  // "endpoint"
  ap_chem_4_6_buret_purpose:                     'chemistry_concepts',  // "buret"
  ap_chem_4_6_standardization:                   'chemistry_concepts',  // "standardization"
  ap_chem_4_6_titrant_analyte:                   'chemistry_concepts',  // "analyte"
  ap_chem_4_7_synthesis_reaction:                'reaction_types',      // "synthesis"
  ap_chem_4_7_decomposition_reaction:            'reaction_types',      // "decomposition"
  ap_chem_4_7_single_replacement:                'reaction_types',      // "activity series"
  ap_chem_4_7_double_replacement:                'reaction_types',      // "double replacement"
  ap_chem_4_7_combustion_products:               'reaction_types',      // "carbon dioxide and water"
  ap_chem_4_7_precipitation_reaction:            'reaction_types',      // "precipitate"
  ap_chem_4_7_combustion_balancing:              'bracket_numbers',
  ap_chem_4_8_arrhenius_acid:                    'chemistry_concepts',  // "hydrogen ions in water"
  ap_chem_4_8_bronsted_lowry_acid:               'chemistry_concepts',  // "proton donor"
  ap_chem_4_8_conjugate_pairs:                   'chemistry_concepts',  // "conjugate base"
  ap_chem_4_8_amphoteric_water:                  'chemistry_concepts',  // "amphoteric"
  ap_chem_4_8_neutralization:                    'chemistry_concepts',  // "water and a salt"
  ap_chem_4_8_conjugate_acid:                    'chemistry_concepts',  // "conjugate acid"
  ap_chem_4_8_strong_vs_weak_acid:               'chemistry_concepts',  // "completely"
  ap_chem_4_9_oil_rig:                           'chemistry_concepts',  // "OIL RIG"
  ap_chem_4_9_oxidizing_agent:                   'electrochemistry_terms',
  ap_chem_4_9_reducing_agent:                    'electrochemistry_terms',
  ap_chem_4_9_oxidation_state_rules:             'chemistry_concepts',  // "+2"
  ap_chem_4_9_half_reactions:                    'chemistry_concepts',  // "half-reactions"
  ap_chem_4_9_oxygen_oxidation_state:            'chemistry_concepts',  // "-2"

  // ── Unit 5: Kinetics ──────────────────────────────────────────────────────
  ap_chem_5_1_rate_definition:                   'chemistry_concepts',  // "change in concentration over time"
  ap_chem_5_1_rate_units:                        'chemistry_concepts',  // "M/s"
  ap_chem_5_1_disappearance_vs_appearance:       'unique_answers',      // 45 chars
  ap_chem_5_1_instantaneous_rate:                'chemistry_concepts',  // "instantaneous rate"
  ap_chem_5_2_rate_law_form:                     'equation_formulas',   // "rate = k[A]^m[B]^n"
  ap_chem_5_2_order_experimentally:              'chemistry_concepts',  // "experimentally"
  ap_chem_5_2_overall_order:                     'chemistry_concepts',  // "sum of all individual reaction orders"
  ap_chem_5_2_rate_constant_k:                   'chemistry_concepts',  // "rate constant"
  ap_chem_5_2_determining_order_method:          'named_laws_principles', // "method of initial rates"
  ap_chem_5_3_first_order_integrated:            'equation_formulas',   // "ln[A] = −kt + ln[A]₀"
  ap_chem_5_3_zero_order_integrated:             'equation_formulas',   // "[A] = −kt + [A]₀"
  ap_chem_5_3_second_order_integrated:           'equation_formulas',   // "1/[A] = kt + 1/[A]₀"
  ap_chem_5_3_first_order_half_life:             'equation_formulas',   // "t½ = 0.693/k"
  ap_chem_5_3_half_life_order_comparison:        'unique_answers',      // 52 chars
  ap_chem_5_3_graphical_test:                    'unique_answers',      // 76 chars
  ap_chem_5_4_molecularity_def:                  'unique_answers',      // 63 chars
  ap_chem_5_4_elementary_rate_law:               'unique_answers',      // 86 chars
  ap_chem_5_4_rate_determining_step:             'chemistry_concepts',  // "rate-determining step"
  ap_chem_5_5_activation_energy_collision:       'chemistry_concepts',  // "activation energy"
  ap_chem_5_5_orientation_requirement:           'chemistry_concepts',  // "proper orientation"
  ap_chem_5_5_temperature_rate_effect:           'unique_answers',      // 52 chars
  ap_chem_5_5_concentration_collision_frequency: 'chemistry_concepts',  // "collision frequency"
  ap_chem_5_6_activation_energy_profile:         'chemistry_concepts',  // "activation energy"
  ap_chem_5_6_exo_endo_profile:                  'unique_answers',      // 89 chars
  ap_chem_5_6_transition_state:                  'chemistry_concepts',  // "transition state"
  ap_chem_5_7_mechanism_definition:              'chemistry_concepts',  // "elementary steps"
  ap_chem_5_7_intermediate_definition:           'chemistry_concepts',  // "intermediate"
  ap_chem_5_7_rate_determining_step:             'chemistry_concepts',  // "rate-determining step"
  ap_chem_5_8_rate_law_from_mechanism:           'chemistry_concepts',  // "rate-determining step"
  ap_chem_5_8_pre_equilibrium_intermediate:      'chemistry_concepts',  // "equilibrium constant expression"
  ap_chem_5_8_mechanism_consistency:             'chemistry_concepts',  // "experimentally determined"
  ap_chem_5_9_steady_state_condition:            'named_laws_principles', // "steady-state approximation"
  ap_chem_5_9_ssa_vs_pre_equilibrium:            'chemistry_concepts',  // "does not accumulate"
  ap_chem_5_10_energy_profile_intermediate:      'chemistry_concepts',  // "local minimum"
  ap_chem_5_10_overall_ea_multistep:             'chemistry_concepts',  // "highest energy transition state"
  ap_chem_5_10_delta_h_energy_profile:           'chemistry_concepts',  // "products minus reactants"
  ap_chem_5_11_catalyst_ea:                      'chemistry_concepts',  // "lowers the activation energy"
  ap_chem_5_11_homogeneous_heterogeneous_catalyst: 'chemistry_concepts', // "homogeneous"
  ap_chem_5_11_enzyme_catalyst_type:             'chemistry_concepts',  // "enzymes"
  ap_chem_5_11_catalyst_in_mechanism:            'chemistry_concepts',  // "regenerated"

  // ── Unit 6: Thermochemistry ───────────────────────────────────────────────
  ap_chem_6_1_endothermic_sign:                  'process_types',       // "positive"
  ap_chem_6_1_exothermic_sign:                   'process_types',       // "negative"
  ap_chem_6_1_system_surroundings_heat:          'equation_formulas',   // "q_system = –q_surroundings"
  ap_chem_6_1_feels_cold_endothermic:            'process_types',       // "endothermic"
  ap_chem_6_2_ea_energy_diagram:                 'chemistry_concepts',  // "activation energy"
  ap_chem_6_2_reaction_progress_axis:            'chemistry_concepts',  // "reaction coordinate"
  ap_chem_6_2_transition_state_diagram:          'chemistry_concepts',  // "transition state"
  ap_chem_6_3_heat_flow_direction:               'chemistry_concepts',  // "high temperature to low temperature"
  ap_chem_6_3_thermal_equilibrium:               'chemistry_concepts',  // "thermal equilibrium"
  ap_chem_6_3_zeroth_law:                        'named_laws_principles',
  ap_chem_6_4_specific_heat_water:               'bracket_numbers',
  ap_chem_6_4_q_equals_mcdeltaT:                 'equation_formulas',   // "q = mcΔT"
  ap_chem_6_4_coffee_cup_calorimeter:            'chemistry_concepts',  // "constant pressure"
  ap_chem_6_4_bomb_calorimeter_constant_volume:  'chemistry_concepts',  // "constant volume"
  ap_chem_6_4_heat_capacity_equation:            'equation_formulas',   // "q = CΔT"
  ap_chem_6_5_enthalpy_fusion_water:             'bracket_numbers',
  ap_chem_6_5_enthalpy_vaporization_water:       'bracket_numbers',
  ap_chem_6_5_no_temp_change_phase:              'chemistry_concepts',  // "no temperature change"
  ap_chem_6_5_vap_greater_than_fus:              'chemistry_concepts',  // "ΔHvap > ΔHfus"
  ap_chem_6_6_deltah_rxn_definition:             'chemistry_concepts',  // "Hproducts − Hreactants"
  ap_chem_6_6_state_function:                    'chemistry_concepts',  // "state function"
  ap_chem_6_6_exothermic_sign:                   'process_types',       // "negative"
  ap_chem_6_6_endothermic_sign:                  'process_types',       // "positive"
  ap_chem_6_7_bond_enthalpy_equation:            'equation_formulas',   // "Σ(bonds broken) − Σ(bonds formed)"
  ap_chem_6_7_bond_breaking_endothermic:         'process_types',       // "endothermic"
  ap_chem_6_7_bond_enthalpy_gas_phase_only:      'chemistry_concepts',  // "gas phase"
  ap_chem_6_7_stronger_bond_larger_enthalpy:     'chemistry_concepts',  // "larger bond enthalpy"
  ap_chem_6_8_standard_enthalpy_formation_definition: 'unique_answers', // 50 chars
  ap_chem_6_8_element_standard_state_zero:       'bracket_numbers',
  ap_chem_6_8_hess_from_formation:               'equation_formulas',   // "ΣΔHf°(products) − ΣΔHf°(reactants)"
  ap_chem_6_8_coefficients_multiply_deltahf:     'unique_answers',      // 42 chars
  ap_chem_6_9_hess_law_definition:               'named_laws_principles',
  ap_chem_6_9_reverse_reaction_sign:             'chemistry_concepts',  // "sign of ΔH reverses"
  ap_chem_6_9_multiply_reaction_multiplies_deltah: 'chemistry_concepts', // "ΔH is multiplied by the same factor"
  ap_chem_6_9_hess_law_state_function:           'chemistry_concepts',  // "enthalpy is a state function"

  // ── Unit 7: Equilibrium ───────────────────────────────────────────────────
  ap_chem_7_1_dynamic_equilibrium_def:           'chemistry_concepts',  // "Dynamic equilibrium"
  ap_chem_7_1_closed_system_required:            'chemistry_concepts',  // "Closed system"
  ap_chem_7_1_reversible_reaction_symbol:        'chemistry_concepts',  // "Double arrow (⇌)"
  ap_chem_7_1_concentrations_constant_not_equal: 'unique_answers',      // 43 chars
  ap_chem_7_2_delta_g_spontaneous_direction:     'chemistry_concepts',  // "Gibbs free energy (ΔG)"
  ap_chem_7_2_conditions_shift_equilibrium:      'chemistry_concepts',  // "Temperature"
  ap_chem_7_2_all_reactions_reversible:          'unique_answers',      // 41 chars
  ap_chem_7_3_reaction_quotient_Q_def:           'chemistry_concepts',  // "Reaction quotient (Q)"
  ap_chem_7_3_Q_less_than_K_shift:               'equilibrium_concepts', // "Shifts right (toward products)"
  ap_chem_7_3_Q_greater_than_K_shift:            'equilibrium_concepts', // "Shifts left (toward reactants)"
  ap_chem_7_3_Q_expression_form:                 'unique_answers',      // 67 chars
  ap_chem_7_4_ICE_table_method:                  'named_laws_principles', // "ICE table"
  ap_chem_7_4_pure_solids_liquids_excluded:      'chemistry_concepts',  // "Pure solids and pure liquids"
  ap_chem_7_4_Kp_vs_Kc_relationship:             'equation_formulas',   // "Kp = Kc(RT)^Δn"
  ap_chem_7_4_Kc_from_concentration_data:        'unique_answers',      // 69 chars
  ap_chem_7_4_five_percent_approximation:        'bracket_numbers',
  ap_chem_7_5_K_much_greater_than_1:             'equilibrium_concepts', // "Products are favored"
  ap_chem_7_5_K_much_less_than_1:                'equilibrium_concepts', // "Reactants are favored"
  ap_chem_7_5_K_near_1_interpretation:           'unique_answers',      // 62 chars
  ap_chem_7_6_reverse_reaction_K:                'chemistry_concepts',  // "1/K (reciprocal of K)"
  ap_chem_7_6_multiply_equation_by_n:            'bracket_numbers',
  ap_chem_7_6_adding_equations_K:                'unique_answers',      // 49 chars
  ap_chem_7_7_ICE_table_setup:                   'unique_answers',      // 86 chars
  ap_chem_7_7_quadratic_when_approximation_fails: 'named_laws_principles', // "Quadratic formula"
  ap_chem_7_7_equilibrium_concentrations_from_K: 'unique_answers',      // 109 chars
  ap_chem_7_8_q_vs_k_direction:                  'equilibrium_concepts', // "Q < K"
  ap_chem_7_8_bar_graph_equilibrium:             'chemistry_concepts',  // "constant concentrations"
  ap_chem_7_9_le_chatelier_definition:           'named_laws_principles',
  ap_chem_7_9_temperature_shift_endothermic:     'equilibrium_concepts', // "right (toward products)"
  ap_chem_7_9_pressure_volume_shift:             'equilibrium_concepts', // "fewer moles of gas"
  ap_chem_7_10_adding_reactant_shift:            'equilibrium_concepts', // "Q < K"
  ap_chem_7_10_removing_product_shift:           'equilibrium_concepts', // "right (toward products)"
  ap_chem_7_10_catalyst_equilibrium:             'equilibrium_concepts', // "no shift in equilibrium position"
  ap_chem_7_10_temperature_changes_K:            'equilibrium_concepts', // "K changes"
  ap_chem_7_11_ksp_definition:                   'chemistry_concepts',  // "solubility product constant"
  ap_chem_7_11_ksp_excludes_solid:               'chemistry_concepts',  // "pure solid"
  ap_chem_7_11_molar_solubility_from_ksp:        'chemistry_concepts',  // "molar solubility"
  ap_chem_7_11_ksp_saturated_only:               'chemistry_concepts',  // "saturated solution"
  ap_chem_7_12_common_ion_effect:                'chemistry_concepts',  // "decreases"
  ap_chem_7_12_common_ion_le_chatelier:          'equilibrium_concepts', // "left (toward solid)"
  ap_chem_7_12_common_ion_does_not_change_ksp:   'chemistry_concepts',  // "Ksp remains constant"
  ap_chem_7_13_acid_increases_solubility:        'chemistry_concepts',  // "basic anions"
  ap_chem_7_13_ph_no_effect_strong_acid_salt:    'compound_names',      // "chloride salts"
  ap_chem_7_14_delta_g_ksp_relationship:         'equation_formulas',   // "ΔG° = -RT ln Ksp"
  ap_chem_7_14_entropy_drives_dissolution:       'chemistry_concepts',  // "entropy increase"

  // ── Unit 8: Acids & Bases ─────────────────────────────────────────────────
  ap_chem_8_1_arrhenius_acid_definition:         'chemistry_concepts',  // "produces H+ ions in water"
  ap_chem_8_1_bronsted_lowry_base_definition:    'chemistry_concepts',  // "proton acceptor"
  ap_chem_8_1_conjugate_acid_base_pair:          'chemistry_concepts',  // "differ by one proton (H+)"
  ap_chem_8_1_strong_acids_list:                 'compound_names',      // "HCl, HBr, HI, HNO3, H2SO4, HClO4"
  ap_chem_8_1_strong_bases_group:                'unique_answers',      // 45 chars
  ap_chem_8_2_ph_definition:                     'equation_formulas',   // "pH = -log[H+]"
  ap_chem_8_2_kw_value:                          'bracket_numbers',
  ap_chem_8_2_ph_poh_sum:                        'bracket_numbers',
  ap_chem_8_2_strong_acid_ph_calculation:        'equation_formulas',   // "pH = -log[HA]"
  ap_chem_8_2_strong_base_ph_method:             'unique_answers',      // "find pOH first, then pH = 14 - pOH" 35 chars — borderline
  ap_chem_8_3_ka_expression:                     'equation_formulas',   // "Ka = [H+][A-] / [HA]"
  ap_chem_8_3_ka_kb_relationship:                'equation_formulas',   // "Ka × Kb = Kw"
  ap_chem_8_3_acetic_acid_ka:                    'bracket_numbers',
  ap_chem_8_3_percent_ionization:                'equation_formulas',   // "([H+]equilibrium / [HA]initial) × 100%"
  ap_chem_8_3_ice_table_weak_acid:               'chemistry_concepts',  // "ICE table (Initial, Change, Equilibrium)"
  ap_chem_8_4_strong_strong_neutralization:      'chemistry_concepts',  // "neutral salt and water (pH = 7)"
  ap_chem_8_4_buffer_composition:                'chemistry_concepts',  // "weak acid and its conjugate base"
  ap_chem_8_4_weak_acid_strong_base_salt:        'chemistry_concepts',  // "basic solution (pH > 7)"
  ap_chem_8_4_strong_acid_weak_base_salt:        'chemistry_concepts',  // "acidic solution (pH < 7)"
  ap_chem_8_4_buffer_action_mechanism:           'unique_answers',      // 76 chars
  ap_chem_8_5_strong_strong_equivalence_ph:      'bracket_numbers',
  ap_chem_8_5_weak_acid_strong_base_equivalence_ph: 'bracket_numbers',
  ap_chem_8_5_half_equivalence_ph_equals_pka:    'equation_formulas',   // "pH = pKa"
  ap_chem_8_5_weak_base_strong_acid_equivalence_ph: 'bracket_numbers',
  ap_chem_8_5_indicator_selection_principle:     'unique_answers',      // 80 chars
  ap_chem_8_6_binary_acid_hf_hcl_hbr_hi_strength: 'chemistry_concepts', // "bond strength"
  ap_chem_8_6_oxyacid_strength_more_oxygen:      'chemistry_concepts',  // "more oxygen atoms"
  ap_chem_8_6_electronegativity_oxyacid_central_atom: 'chemistry_concepts', // "more electronegative central atom"
  ap_chem_8_6_hf_weak_acid_despite_electronegativity: 'compound_names', // "HF"
  ap_chem_8_7_pka_definition:                    'equation_formulas',   // "pKa = -log(Ka)"
  ap_chem_8_7_half_equivalence_ph_equals_pka:    'equation_formulas',   // "pH = pKa"
  ap_chem_8_7_dilution_increases_percent_ionization: 'chemistry_concepts', // "percent ionization increases"
  ap_chem_8_7_lower_pka_stronger_acid:           'chemistry_concepts',  // "stronger acid"
  ap_chem_8_8_buffer_range_pka_plus_minus_1:     'bracket_numbers',
  ap_chem_8_8_buffer_resists_ph_change:          'unique_answers',      // 61 chars
  ap_chem_8_8_optimal_buffer_equal_concentrations: 'equation_formulas', // "pH = pKa"
  ap_chem_8_8_effective_buffer_ratio_range:      'bracket_numbers',
  ap_chem_8_9_henderson_hasselbalch_equation:    'equation_formulas',   // "pH = pKa + log([A-]/[HA])"
  ap_chem_8_9_adding_acid_to_buffer_effect:      'chemistry_concepts',  // "decreases [A-] and increases [HA]"
  ap_chem_8_9_adding_base_to_buffer_effect:      'chemistry_concepts',  // "increases [A-] and decreases [HA]"
  ap_chem_8_9_hh_equal_concentrations_simplification: 'equation_formulas', // "pH = pKa"
  ap_chem_8_10_buffer_capacity_definition:       'unique_answers',      // 74 chars
  ap_chem_8_10_higher_concentration_more_capacity: 'chemistry_concepts', // "higher total buffer concentration"
  ap_chem_8_10_maximum_capacity_equal_concentrations: 'chemistry_concepts', // "when [A-] = [HA]"
  ap_chem_8_10_buffer_capacity_exceeded:         'unique_answers',      // 61 chars

  // ── Unit 9: Entropy, Gibbs, Electrochemistry ─────────────────────────────
  ap_chem_9_1_entropy_definition:                'chemistry_concepts',  // "entropy"
  ap_chem_9_1_second_law_spontaneous:            'chemistry_concepts',  // "increases"
  ap_chem_9_1_entropy_phase_order:               'chemistry_concepts',  // "gas"
  ap_chem_9_1_entropy_more_moles_gas:            'chemistry_concepts',  // "increases"
  ap_chem_9_2_third_law_entropy:                 'named_laws_principles', // "zero" — Third Law result
  ap_chem_9_2_standard_molar_entropy_sign:       'chemistry_concepts',  // "always positive"
  ap_chem_9_2_delta_s_rxn_formula:               'equation_formulas',   // "ΣS°(products) − ΣS°(reactants)"
  ap_chem_9_3_gibbs_free_energy_equation:        'equation_formulas',   // "ΔG = ΔH − TΔS"
  ap_chem_9_3_delta_g_negative_meaning:          'chemistry_concepts',  // "spontaneous"
  ap_chem_9_3_always_spontaneous_case:           'process_types',       // "exothermic and entropy increasing"
  ap_chem_9_3_spontaneous_high_temp:             'process_types',       // "endothermic and entropy increasing"
  ap_chem_9_3_delta_g_equilibrium:               'chemistry_concepts',  // "zero"
  ap_chem_9_4_spontaneous_not_fast:              'chemistry_concepts',  // "kinetics"
  ap_chem_9_4_diamond_graphite:                  'compound_names',      // "graphite"
  ap_chem_9_4_catalyst_thermodynamics:           'chemistry_concepts',  // "does not change"
  ap_chem_9_5_delta_g_standard_K_equation:       'equation_formulas',   // "ΔG° = −RT ln K"
  ap_chem_9_5_K_greater_one_delta_g:             'chemistry_concepts',  // "negative"
  ap_chem_9_5_delta_g_not_standard_equilibrium:  'chemistry_concepts',  // "ΔG (not ΔG°)"
  ap_chem_9_6_ksp_free_energy:                   'equation_formulas',   // "ΔG° = −RT ln Ksp"
  ap_chem_9_6_endothermic_dissolution_entropy:   'chemistry_concepts',  // "entropy"
  ap_chem_9_7_coupled_reactions_delta_g:         'chemistry_concepts',  // "sum of individual ΔG values"
  ap_chem_9_7_atp_hydrolysis_coupling:           'chemistry_concepts',  // "ATP hydrolysis"
  ap_chem_9_7_metal_smelting_coupling:           'chemistry_concepts',  // "carbon oxidation"
  ap_chem_9_8_galvanic_cell_spontaneity:         'electrochemistry_terms',
  ap_chem_9_8_anode_oxidation:                   'electrochemistry_terms',
  ap_chem_9_8_salt_bridge_function:              'electrochemistry_terms',
  ap_chem_9_8_electrolytic_cell_requirement:     'electrochemistry_terms',
  ap_chem_9_8_electrolytic_anode_polarity:       'electrochemistry_terms',
  ap_chem_9_9_ecell_formula:                     'equation_formulas',   // "E°cathode − E°anode"
  ap_chem_9_9_delta_g_ecell_relationship:        'equation_formulas',   // "ΔG° = −nFE°cell"
  ap_chem_9_9_faraday_constant_value:            'bracket_numbers',
  ap_chem_9_9_positive_ecell_spontaneous:        'chemistry_concepts',  // "positive E°cell"
  ap_chem_9_10_nernst_equation:                  'equation_formulas',   // "E = E° − (0.0592/n) log Q"
  ap_chem_9_10_nernst_at_equilibrium:            'bracket_numbers',
  ap_chem_9_10_concentration_cell:               'electrochemistry_terms',
  ap_chem_9_10_q_increases_e_decreases:          'chemistry_concepts',  // "decreases"
  ap_chem_9_11_faradays_law_formula:             'equation_formulas',   // "moles = It/nF"
  ap_chem_9_11_electrolysis_water_products:      'reaction_types',      // "hydrogen and oxygen"
  ap_chem_9_11_molten_vs_aqueous_electrolysis:   'unique_answers',      // 62 chars
  ap_chem_9_11_electroplating_principle:         'electrochemistry_terms',
};

// ─── Apply assignments ────────────────────────────────────────────────────────
let unassigned = [];
deck.facts.forEach(fact => {
  const newPool = assignments[fact.id];
  if (!newPool) {
    unassigned.push(fact.id);
  } else {
    fact.answerTypePoolId = newPool;
  }
});

if (unassigned.length > 0) {
  console.error('ERROR: unassigned facts:', unassigned);
  process.exit(1);
}

// ─── Rebuild answerTypePools from scratch ─────────────────────────────────────
const poolDefs = {
  bracket_numbers: {
    description: 'Numeric answers using {N} notation — quantities, constants, and measurements',
  },
  equation_formulas: {
    description: 'Named equations and formulas expressed as mathematical expressions',
  },
  named_laws_principles: {
    description: 'Named laws, principles, and rules (e.g., Boyle\'s Law, Hess\'s Law, Aufbau principle)',
  },
  chemistry_concepts: {
    description: 'Short chemistry terms and concepts (≤ ~5 words) that could plausibly be confused with each other',
  },
  bond_and_imf_types: {
    description: 'Bond types and intermolecular force types students might confuse',
  },
  molecular_geometries: {
    description: 'VSEPR molecular geometry names',
    minimumSize: 3,
  },
  element_names: {
    description: 'Element names when the correct answer is a single element',
    minimumSize: 2,
  },
  compound_names: {
    description: 'Specific compound names or formulas',
  },
  reaction_types: {
    description: 'Types of chemical reactions and observable evidence of reactions',
  },
  equilibrium_concepts: {
    description: 'Equilibrium-specific directional and qualitative answers (Q vs K, shift direction, K interpretation)',
  },
  process_types: {
    description: 'Physical and thermodynamic process types (endothermic, exothermic, sublimation, etc.)',
  },
  electrochemistry_terms: {
    description: 'Electrochemistry cell components and terms (anode, cathode, galvanic cell, etc.)',
  },
  periodic_trend_terms: {
    description: 'Atomic structure properties and periodic trend labels',
  },
  unique_answers: {
    description: 'Facts with long or unique answers (>40 chars) that require pre-generated distractors',
  },
};

// Build factIds per pool
const poolFactIds = {};
Object.keys(poolDefs).forEach(pid => poolFactIds[pid] = []);

deck.facts.forEach(fact => {
  poolFactIds[fact.answerTypePoolId].push(fact.id);
});

// Build members (unique correctAnswer values) per pool
function buildMembers(poolId) {
  const seen = new Set();
  const members = [];
  poolFactIds[poolId].forEach(fid => {
    const f = deck.facts.find(x => x.id === fid);
    if (f && !seen.has(f.correctAnswer)) {
      seen.add(f.correctAnswer);
      members.push(f.correctAnswer);
    }
  });
  return members;
}

deck.answerTypePools = Object.entries(poolDefs).map(([id, meta]) => {
  const fids = poolFactIds[id];
  const members = buildMembers(id);
  const pool = {
    id,
    description: meta.description,
    factIds: fids,
    members,
  };
  if (meta.minimumSize !== undefined) pool.minimumSize = meta.minimumSize;
  return pool;
});

// ─── Add syntheticDistractors for small pools (< 8 members) ────────────────────
const syntheticDistractorsMap = {
  molecular_geometries: [
    'Linear',
    'Bent',
    'Trigonal bipyramidal',
    'T-shaped',
    'See-saw',
    'Square planar',
    'Square pyramidal',
    'Trigonal planar',
  ],
  element_names: [
    'Nitrogen',
    'Oxygen',
    'Sulfur',
    'Phosphorus',
    'Bromine',
    'Iodine',
    'Carbon',
    'Silicon',
  ],
};

deck.answerTypePools.forEach(p => {
  const synth = syntheticDistractorsMap[p.id];
  if (synth) {
    // Only add items not already in members
    const existing = new Set(p.members);
    const extras = synth.filter(s => !existing.has(s));
    p.syntheticDistractors = extras;
    console.log(`  Added ${extras.length} syntheticDistractors to ${p.id}`);
  }
});

// ─── Validate & report ────────────────────────────────────────────────────────
console.log('\n=== Pool Summary After Rebuild ===');
deck.answerTypePools.forEach(p => {
  const memberCount = p.members.length;
  const synthCount = (p.syntheticDistractors || []).length;
  const totalPool = memberCount + synthCount;
  const factCount = p.factIds.length;
  const warn = totalPool < 5 ? ' WARNING: POOL TOO SMALL (<5 total)' : '';
  console.log(`  ${p.id}: ${factCount} facts, ${memberCount} members + ${synthCount} synth = ${totalPool} total${warn}`);
});

// Count unique_answers facts and check they all have >=8 distractors
const uniqueFacts = deck.facts.filter(f => f.answerTypePoolId === 'unique_answers');
console.log(`\n  unique_answers facts: ${uniqueFacts.length}`);
const underDistracted = uniqueFacts.filter(f => (f.distractors || []).length < 8);
if (underDistracted.length > 0) {
  console.warn('  WARNING: unique_answers facts with <8 distractors:');
  underDistracted.forEach(f => console.warn(`    ${f.id}: ${(f.distractors||[]).length} distractors`));
}

// ─── Write output ─────────────────────────────────────────────────────────────
writeFileSync(DECK_PATH, JSON.stringify(deck, null, 2));
console.log('\nDeck written to', DECK_PATH);

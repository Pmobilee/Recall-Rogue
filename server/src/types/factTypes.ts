/**
 * Shared TypeScript interfaces for fact database rows used across
 * server services (pipeline, quality gate, dashboard, delta sync).
 */

export type FactStatus = 'draft' | 'approved' | 'archived';
export type DistractorTier = 'easy' | 'medium' | 'hard';
export type QualityGateStatus = 'pass' | 'fail' | 'needs_edit';
export type DifficultyTier = 'novice' | 'explorer' | 'scholar' | 'expert';
export type ContentVolatility = 'timeless' | 'slow_change' | 'current_events';
export type SourceQuality = 'primary' | 'secondary' | 'generated' | 'community';

/** Full server-side fact row shape (snake_case, matches DB columns). */
export interface FactRow {
  id: string;
  type: string;
  status: FactStatus;
  in_game_reports: number;
  statement: string;
  wow_factor: string | null;
  explanation: string;
  alternate_explanations: string | null; // JSON string[]
  gaia_comments: string | null;          // JSON array
  gaia_wrong_comments: string | null;    // JSON object
  quiz_question: string;
  correct_answer: string;
  acceptable_answers: string | null;     // JSON string[]
  distractor_count: number;
  category_l1: string;
  category_l2: string;
  category_l3: string;
  rarity: string;
  difficulty: number;
  difficulty_tier: DifficultyTier;
  fun_score: number;
  novelty_score: number;
  age_rating: string;
  sensitivity_level: number;
  sensitivity_note: string | null;
  content_volatility: ContentVolatility;
  source_name: string | null;
  source_url: string | null;
  source_quality: SourceQuality;
  source_doi: string | null;
  related_facts: string | null;          // JSON string[]
  tags: string | null;                   // JSON string[]
  mnemonic: string | null;
  image_prompt: string | null;
  visual_description: string | null;
  image_url: string | null;
  has_pixel_art: number;
  pixel_art_status: string;
  language: string | null;
  pronunciation: string | null;
  example_sentence: string | null;
  quality_gate_status: QualityGateStatus | null;
  quality_score: number | null;
  quality_gate_ran_at: number | null;
  quality_gate_failure_reason: string | null;
  bundle_tag: string | null;
  seed_topic: string | null;
  db_version: number;
  created_at: number;
  updated_at: number;
  last_reviewed_at: number | null;
}

/** Server-side distractor row shape. */
export interface DistractorRow {
  id: number;
  fact_id: string;
  text: string;
  difficulty_tier: DistractorTier;
  distractor_confidence: number;
  is_approved: number;
  similarity_to_answer: number | null;
  gate_approved: number;
}

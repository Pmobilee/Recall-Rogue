# Analytics Events Reference

This document is the source of truth for Recall Rogue soft-launch tracking events.

## Ingestion

- Client endpoint: `POST /api/analytics/events`
- Batch shape:
  - `sessionId`: UUID v4
  - `events`: array of `{ name, properties }`
- Batching policy:
  - Flush every `30s`
  - Immediate flush at `50` queued events

## Run Funnel Events

- `domain_select`
  - `primary`, `secondary`, `archetype`, `run_number`, `starter_deck_size`, `starting_ap`, `early_boost_active`
- `run_start`
  - `domain_primary`, `domain_secondary`, `archetype`, `starting_ap`, `starter_deck_size`, `run_number`
- `run_complete`
  - `result`, `floor`, `accuracy`, `facts_answered`, `facts_correct`, `best_combo`, `cards_earned`, `bounties_completed`
- `run_death`
  - `floor`, `cause`, `accuracy`, `encounters_won`
- `cash_out`
  - `floor`, `gold`, `accuracy?`, `reason?`, `decision?`

## Combat / Deck Events

- `card_reward`
  - `option_types`, `floor`, `encounter`
- `card_reward_reroll`
  - `card_type`, `floor`, `encounter`
- `card_type_selected`
  - `card_type`, `fact_id`, `floor`, `encounter`
- `card_play`
  - `fact_id`, `card_type`, `tier`, `correct`, `combo`, `response_time_ms`, `floor`, `encounter`
- `answer_correct`
  - `fact_id`, `card_type`, `response_time_ms`, `floor`
- `answer_incorrect`
  - `fact_id`, `card_type`, `response_time_ms`, `floor`
- `tier_upgrade`
  - `fact_id`, `old_tier`, `new_tier`
- `shop_visit`
  - `floor`, `options`, `currency`
- `shop_sell`
  - `fact_id`, `card_type`, `tier`, `gold`, `floor`
- `room_selected`
  - `room`, `floor`, `encounter`

## Account / Settings / Feedback

- `settings_change`
  - `setting`, `value`
- `account_created`
  - `method`, `has_cloud_sync`
- `invite_code_validated`
  - `code`, `accepted`
- `feedback_submitted`
  - `length`
- `share_card_generated`
  - `template`, `platform`, `facts_mastered`, `tree_completion_pct`

## Experiment Events

- `experiment_assigned`
  - `experiment_key`, `variant`, `session_id`

Active experiments:
- `slow_reader_default`
- `starting_ap_3_vs_4`
- `starter_deck_15_vs_18`

## Dashboard Endpoints

- `GET /api/analytics/dashboard`
- `GET /api/analytics/retention?cohortDate=YYYY-MM-DD`
- `GET /api/analytics/funnels/:key` (admin)
- `GET /api/analytics/experiments/:key` (admin)

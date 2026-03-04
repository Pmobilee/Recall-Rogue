-- ============================================================
-- referrals.sql — Phase 22: Social & Multiplayer
-- Referral programme: invitations and reward audit log.
-- All timestamps are Unix epoch integers (milliseconds).
-- ============================================================

-- referrals
-- Tracks each referral relationship: who invited whom, and
-- the current reward-pipeline status for that invitation.
CREATE TABLE IF NOT EXISTS referrals (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    referrer_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_name    TEXT        NOT NULL,                            -- denormalised for display
    referral_code   TEXT        NOT NULL,                            -- the code the invitee used
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK(status IN (
                                    'pending',
                                    'dive_reward_sent',
                                    'streak_reward_sent',
                                    'completed',
                                    'flagged'
                                )),
    -- IP/device fingerprint hash for anti-abuse (never raw PII stored)
    device_hash     TEXT,
    created_at      INTEGER     NOT NULL,                            -- epoch ms
    updated_at      INTEGER     NOT NULL,                            -- epoch ms
    UNIQUE(invitee_id)                                               -- one referrer per invitee
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer     ON referrals(referrer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_code         ON referrals(referral_code);

-- referral_rewards_log
-- Immutable audit trail of every reward grant made through the referral system.
-- Used for fraud detection and reconciliation.
CREATE TABLE IF NOT EXISTS referral_rewards_log (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    referral_id     TEXT        NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    recipient_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type     TEXT        NOT NULL,                            -- e.g. 'dive_bonus', 'streak_bonus', 'dust_grant'
    -- JSON payload describing the reward (e.g. { dustAmount: 500 })
    reward_payload  TEXT        NOT NULL,
    granted_at      INTEGER     NOT NULL                             -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral   ON referral_rewards_log(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_recipient  ON referral_rewards_log(recipient_id, granted_at DESC);

-- ============================================================
-- Phase 42.2: Referral System Optimization — additional tables
-- Enhanced attribution tracking, fraud prevention, and tier rewards.
-- IP addresses stored ONLY as SHA-256 hashes — never raw PII.
-- ============================================================

-- referral_codes
-- Permanent per-player referral codes (stable across account migrations).
CREATE TABLE IF NOT EXISTS referral_codes (
    code          TEXT PRIMARY KEY,
    player_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_player ON referral_codes(player_id);

-- referral_clicks
-- Records each unique link click (deduplicated by code+ip_hash+day).
-- Used for attribution window enforcement.
CREATE TABLE IF NOT EXISTS referral_clicks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    code          TEXT NOT NULL REFERENCES referral_codes(code) ON DELETE CASCADE,
    clicked_at    INTEGER NOT NULL,   -- epoch ms
    ip_hash       TEXT NOT NULL,      -- SHA-256(ip) — never raw IP
    user_agent    TEXT,
    UNIQUE (code, ip_hash, date(clicked_at / 1000, 'unixepoch'))
);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON referral_clicks(code, ip_hash, clicked_at DESC);

-- referral_installs
-- Records each attributed install (one per referred player).
CREATE TABLE IF NOT EXISTS referral_installs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_player_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_hash             TEXT NOT NULL,  -- SHA-256(ip)
    installed_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE (referred_player_id)         -- one referrer per install
);
CREATE INDEX IF NOT EXISTS idx_referral_installs_referrer ON referral_installs(referrer_id, installed_at DESC);

-- player_referral_stats
-- Per-player referral counters and yearly cap tracking.
CREATE TABLE IF NOT EXISTS player_referral_stats (
    player_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    qualified_count   INTEGER NOT NULL DEFAULT 0,
    yearly_count      INTEGER NOT NULL DEFAULT 0,
    yearly_reset_date INTEGER NOT NULL DEFAULT (strftime('%s', date((strftime('%Y', 'now') + 1) || '-01-01')) * 1000)
);

-- player_badges
-- Tracks earned achievement badges per player.
CREATE TABLE IF NOT EXISTS player_badges (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id    TEXT NOT NULL,
    earned_at   INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    is_visible  INTEGER NOT NULL DEFAULT 1,  -- 0 = hidden by player, 1 = public
    UNIQUE (player_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_player_badges_player ON player_badges(player_id, earned_at DESC);

-- aso_keyword_ranks
-- Nightly keyword rank snapshots from App Store Connect / Google Play.
CREATE TABLE IF NOT EXISTS aso_keyword_ranks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword     TEXT NOT NULL,
    platform    TEXT NOT NULL CHECK(platform IN ('ios', 'android')),
    rank        INTEGER,               -- null = not in top 250
    checked_at  INTEGER NOT NULL,      -- epoch ms
    UNIQUE (keyword, platform, date(checked_at / 1000, 'unixepoch'))
);
CREATE INDEX IF NOT EXISTS idx_aso_keyword_ranks_keyword ON aso_keyword_ranks(keyword, platform, checked_at DESC);

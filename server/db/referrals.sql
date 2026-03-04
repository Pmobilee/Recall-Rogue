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

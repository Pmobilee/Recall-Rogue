-- ============================================================
-- social.sql — Phase 22: Social & Multiplayer
-- Hub visits, guestbook entries, gifts, and friend connections.
-- All timestamps are Unix epoch integers (milliseconds).
-- ============================================================

-- hub_visits
-- Records every time a player visits another player's dome hub.
CREATE TABLE IF NOT EXISTS hub_visits (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    visitor_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    host_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visited_at      INTEGER     NOT NULL,                           -- epoch ms
    duration_ms     INTEGER     NOT NULL DEFAULT 0                  -- time spent in the hub
);

CREATE INDEX IF NOT EXISTS idx_hub_visits_host_id       ON hub_visits(host_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_visits_visitor_id    ON hub_visits(visitor_id, visited_at DESC);

-- guestbook_entries
-- Messages left by visitors in a player's dome guestbook.
-- Limited to 50 entries per host (enforced at application layer).
CREATE TABLE IF NOT EXISTS guestbook_entries (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    host_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name     TEXT        NOT NULL,                           -- denormalised display name at time of writing
    message         TEXT        NOT NULL CHECK(length(message) <= 280),
    is_deleted      INTEGER     NOT NULL DEFAULT 0,                 -- soft-delete (1 = hidden)
    created_at      INTEGER     NOT NULL                            -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_guestbook_host_id ON guestbook_entries(host_id, created_at DESC);

-- gifts
-- Mineral bundles or fact-link cards sent between players.
-- Unclaimed gifts expire after 30 days (enforced at application layer).
CREATE TABLE IF NOT EXISTS gifts (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    sender_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gift_type       TEXT        NOT NULL CHECK(gift_type IN ('minerals', 'fact_link')),
    -- JSON payload: { amount?: number; factId?: string; factPreview?: string }
    payload         TEXT        NOT NULL,
    sent_at         INTEGER     NOT NULL,                           -- epoch ms
    claimed         INTEGER     NOT NULL DEFAULT 0,                 -- 0 = pending, 1 = claimed
    claimed_at      INTEGER                                         -- epoch ms, null if unclaimed
);

CREATE INDEX IF NOT EXISTS idx_gifts_receiver_id ON gifts(receiver_id, claimed, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_gifts_sender_id   ON gifts(sender_id, sent_at DESC);

-- friend_connections
-- Bidirectional friendship graph.
-- A friendship is canonical when status = 'accepted'.
CREATE TABLE IF NOT EXISTS friend_connections (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    requester_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK(status IN ('pending', 'accepted', 'declined', 'blocked')),
    created_at      INTEGER     NOT NULL,                           -- epoch ms
    updated_at      INTEGER     NOT NULL,                           -- epoch ms
    UNIQUE(requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_addressee ON friend_connections(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_requester ON friend_connections(requester_id, status);

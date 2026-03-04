-- ============================================================
-- trading.sql — Phase 22: Social & Multiplayer
-- Artifact card inventory, peer-to-peer trade offers,
-- and marketplace listings.
-- All timestamps are Unix epoch integers (milliseconds).
-- ============================================================

-- artifact_cards
-- Each row is a unique instance of an artifact card owned by a player.
-- isSoulbound cards cannot be traded or listed.
CREATE TABLE IF NOT EXISTS artifact_cards (
    instance_id     TEXT        PRIMARY KEY,                         -- UUID v4
    owner_id        TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact_id         TEXT        NOT NULL,                            -- references facts DB
    rarity          TEXT        NOT NULL,                            -- 'common'|'uncommon'|'rare'|'epic'|'legendary'|'mythic'
    discovered_at   INTEGER     NOT NULL,                            -- epoch ms
    is_soulbound    INTEGER     NOT NULL DEFAULT 0,                  -- 1 = untradeable
    is_listed       INTEGER     NOT NULL DEFAULT 0,                  -- 1 = listed on marketplace
    list_price      INTEGER,                                         -- dust price; null if not listed
    listed_at       INTEGER,                                         -- epoch ms; null if not listed
    created_at      INTEGER     NOT NULL,                            -- epoch ms
    updated_at      INTEGER     NOT NULL                             -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_artifact_cards_owner     ON artifact_cards(owner_id, rarity);
CREATE INDEX IF NOT EXISTS idx_artifact_cards_fact_id   ON artifact_cards(fact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_cards_listed    ON artifact_cards(is_listed, rarity, list_price) WHERE is_listed = 1;

-- trade_offers
-- Direct peer-to-peer card swap proposals.
-- One side offers a card, the other side's card is requested in return.
CREATE TABLE IF NOT EXISTS trade_offers (
    id                          TEXT        PRIMARY KEY,             -- UUID v4
    offerer_id                  TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id                 TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offered_card_instance_id    TEXT        NOT NULL REFERENCES artifact_cards(instance_id) ON DELETE CASCADE,
    requested_card_instance_id  TEXT        NOT NULL REFERENCES artifact_cards(instance_id) ON DELETE CASCADE,
    additional_dust             INTEGER     NOT NULL DEFAULT 0 CHECK(additional_dust >= 0),
    status                      TEXT        NOT NULL DEFAULT 'pending'
                                            CHECK(status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at                  INTEGER     NOT NULL,                -- epoch ms
    expires_at                  INTEGER     NOT NULL,                -- epoch ms (72 h after creation)
    resolved_at                 INTEGER                              -- epoch ms, null if unresolved
);

CREATE INDEX IF NOT EXISTS idx_trade_offers_offerer   ON trade_offers(offerer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver  ON trade_offers(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_offers_expires   ON trade_offers(expires_at) WHERE status = 'pending';

-- marketplace_listings
-- Public open-market listings for artifact cards.
-- A listing is created when a player sets is_listed = 1 on their artifact_card.
-- Denormalised for fast marketplace query without joining artifact_cards.
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    seller_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    instance_id     TEXT        NOT NULL REFERENCES artifact_cards(instance_id) ON DELETE CASCADE,
    fact_id         TEXT        NOT NULL,                            -- denormalised for filtering
    rarity          TEXT        NOT NULL,                            -- denormalised for sorting
    price_dust      INTEGER     NOT NULL CHECK(price_dust > 0),
    status          TEXT        NOT NULL DEFAULT 'active'
                                CHECK(status IN ('active', 'sold', 'cancelled')),
    buyer_id        TEXT        REFERENCES users(id) ON DELETE SET NULL,
    created_at      INTEGER     NOT NULL,                            -- epoch ms
    sold_at         INTEGER,                                         -- epoch ms; null if unsold
    cancelled_at    INTEGER                                          -- epoch ms; null if not cancelled
);

CREATE INDEX IF NOT EXISTS idx_marketplace_active      ON marketplace_listings(status, rarity, price_dust) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_seller      ON marketplace_listings(seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_fact_id     ON marketplace_listings(fact_id, status) WHERE status = 'active';

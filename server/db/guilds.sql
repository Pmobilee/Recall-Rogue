-- ============================================================
-- guilds.sql — Phase 22: Social & Multiplayer
-- Guilds, membership, weekly challenges, and invites.
-- All timestamps are Unix epoch integers (milliseconds).
-- ============================================================

-- guilds
-- A player-created guild (clan/group).
CREATE TABLE IF NOT EXISTS guilds (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    name            TEXT        NOT NULL UNIQUE,
    tag             TEXT        NOT NULL UNIQUE CHECK(length(tag) BETWEEN 2 AND 5),
    emblem_id       INTEGER     NOT NULL DEFAULT 0,
    description     TEXT        NOT NULL DEFAULT '',
    is_open         INTEGER     NOT NULL DEFAULT 1,                  -- 1 = anyone can join; 0 = invite-only
    member_count    INTEGER     NOT NULL DEFAULT 1,
    rank            INTEGER     NOT NULL DEFAULT 0,                  -- global rank (computed)
    gkp             INTEGER     NOT NULL DEFAULT 0,                  -- guild knowledge points
    max_members     INTEGER     NOT NULL DEFAULT 30,
    founded_by      TEXT        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at      INTEGER     NOT NULL,                            -- epoch ms
    updated_at      INTEGER     NOT NULL                             -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_guilds_rank ON guilds(rank);
CREATE INDEX IF NOT EXISTS idx_guilds_gkp  ON guilds(gkp DESC);

-- guild_members
-- Player membership in a guild.
CREATE TABLE IF NOT EXISTS guild_members (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    guild_id        TEXT        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL DEFAULT 'member'
                                CHECK(role IN ('leader', 'officer', 'member')),
    gkp_contributed INTEGER     NOT NULL DEFAULT 0,                  -- this member's GKP contribution
    joined_at       INTEGER     NOT NULL,                            -- epoch ms
    updated_at      INTEGER     NOT NULL,                            -- epoch ms
    UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_members_guild  ON guild_members(guild_id, role);
CREATE INDEX IF NOT EXISTS idx_guild_members_user   ON guild_members(user_id);

-- guild_challenges
-- Weekly collaborative challenges for a guild.
-- One row per (guild, challenge_type, week_start) combination.
CREATE TABLE IF NOT EXISTS guild_challenges (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    guild_id        TEXT        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    challenge_type  TEXT        NOT NULL,                            -- e.g. 'facts_mastered', 'dives_completed'
    target          INTEGER     NOT NULL,
    progress        INTEGER     NOT NULL DEFAULT 0,
    is_completed    INTEGER     NOT NULL DEFAULT 0,                  -- 1 = target reached
    week_start      INTEGER     NOT NULL,                            -- epoch ms of Monday 00:00 UTC
    created_at      INTEGER     NOT NULL,                            -- epoch ms
    updated_at      INTEGER     NOT NULL                             -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_guild_challenges_guild ON guild_challenges(guild_id, week_start DESC);

-- guild_invites
-- Pending invitations sent to players to join a guild.
CREATE TABLE IF NOT EXISTS guild_invites (
    id              TEXT        PRIMARY KEY,                         -- UUID v4
    guild_id        TEXT        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    inviter_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK(status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at      INTEGER     NOT NULL,                            -- epoch ms
    expires_at      INTEGER     NOT NULL,                            -- epoch ms (7 days after creation)
    resolved_at     INTEGER,                                         -- epoch ms; null if unresolved
    UNIQUE(guild_id, invitee_id, status)
);

CREATE INDEX IF NOT EXISTS idx_guild_invites_invitee ON guild_invites(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_guild_invites_guild   ON guild_invites(guild_id, status);

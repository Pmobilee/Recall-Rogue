-- ============================================================
-- duels.sql — Phase 22: Social & Multiplayer
-- Asynchronous knowledge duels between players.
-- All timestamps are Unix epoch integers (milliseconds).
-- ============================================================

-- duels
-- Represents a single async quiz duel challenge.
-- Both challenger and opponent answer the same question set independently.
-- Results are resolved when both submit or the duel expires.
CREATE TABLE IF NOT EXISTS duels (
    id                  TEXT        PRIMARY KEY,                     -- UUID v4
    challenger_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK(status IN (
                                        'pending',
                                        'challenger_done',
                                        'opponent_done',
                                        'completed',
                                        'timed_out',
                                        'declined'
                                    )),
    wager_dust          INTEGER     NOT NULL DEFAULT 0 CHECK(wager_dust >= 0),
    -- JSON array of fact IDs used in this duel (snapshot so facts can change later)
    question_fact_ids   TEXT        NOT NULL,
    challenger_score    INTEGER,                                     -- null until challenger submits
    opponent_score      INTEGER,                                     -- null until opponent submits
    -- JSON object: { winnerId: string | null; dustTransferred: number }
    outcome             TEXT,                                        -- null until completed
    created_at          INTEGER     NOT NULL,                        -- epoch ms
    expires_at          INTEGER     NOT NULL,                        -- epoch ms (48 h after creation)
    completed_at        INTEGER                                      -- epoch ms, null if not finished
);

CREATE INDEX IF NOT EXISTS idx_duels_challenger  ON duels(challenger_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_opponent    ON duels(opponent_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_expires_at  ON duels(expires_at) WHERE status IN ('pending', 'challenger_done', 'opponent_done');

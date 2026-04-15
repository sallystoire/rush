import { pool } from "@workspace/db";
import { logger } from "./logger";

const SQL = `
  CREATE TABLE IF NOT EXISTS players (
    id         SERIAL PRIMARY KEY,
    username   TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    color      TEXT NOT NULL DEFAULT '#FF5733',
    level      INTEGER NOT NULL DEFAULT 1,
    best_time  REAL,
    team_id    INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS teams (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    captain_id          INTEGER NOT NULL,
    max_members         INTEGER NOT NULL DEFAULT 4,
    min_level_required  INTEGER NOT NULL DEFAULT 1,
    level               INTEGER NOT NULL DEFAULT 1,
    best_time           REAL,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS boost_codes (
    id         SERIAL PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    boost_type TEXT NOT NULL,
    value      INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS player_boosts (
    id         SERIAL PRIMARY KEY,
    player_id  INTEGER NOT NULL,
    boost_type TEXT NOT NULL,
    value      INTEGER NOT NULL DEFAULT 1,
    used       BOOLEAN NOT NULL DEFAULT FALSE,
    code_id    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id            SERIAL PRIMARY KEY,
    player_id     INTEGER NOT NULL,
    mode          TEXT NOT NULL,
    team_id       INTEGER,
    current_level INTEGER NOT NULL DEFAULT 1,
    started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    status        TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS code_redemptions (
    id          SERIAL PRIMARY KEY,
    player_id   INTEGER NOT NULL,
    code_id     INTEGER NOT NULL,
    redeemed_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`;

export async function runMigrations(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    logger.warn("DATABASE_URL not set — skipping migrations");
    return;
  }

  try {
    logger.info("Running schema migrations…");
    await pool.query(SQL);
    logger.info("Schema migrations complete");
  } catch (err) {
    logger.error({ err }, "Schema migration failed — server continues");
  }
}

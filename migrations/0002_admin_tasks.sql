-- Adds: tasks, ban flag, forced-crash admin control, bot settings/broadcasts

ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  link        TEXT NOT NULL,
  reward      INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS user_tasks (
  user_id      INTEGER NOT NULL,
  task_id      INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'started', -- started | claimed
  started_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  claimed_at   INTEGER,
  PRIMARY KEY (user_id, task_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Single-row key/value settings store (bot start message, broadcast defaults, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Lets an admin force the outcome of the *next* round (e.g. crash at 1.28x).
CREATE TABLE IF NOT EXISTS game_control (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  forced_crash_point REAL
);
INSERT OR IGNORE INTO game_control (id, forced_crash_point) VALUES (1, NULL);

CREATE TABLE IF NOT EXISTS broadcasts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text        TEXT,
  image_url   TEXT,
  buttons     TEXT, -- JSON
  sent_count  INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

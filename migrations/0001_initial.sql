-- Crash Game D1 schema

CREATE TABLE IF NOT EXISTS users (
  id               INTEGER PRIMARY KEY,          -- Telegram user id
  username         TEXT,
  first_name       TEXT,
  photo_url        TEXT,
  balance          INTEGER NOT NULL DEFAULT 0,   -- Telegram Stars, integer
  total_wagered    INTEGER NOT NULL DEFAULT 0,
  total_won        INTEGER NOT NULL DEFAULT 0,
  total_deposited  INTEGER NOT NULL DEFAULT 0,
  total_withdrawn  INTEGER NOT NULL DEFAULT 0,
  referrer_id      INTEGER,                      -- direct (level 1) referrer
  referral_earned  INTEGER NOT NULL DEFAULT 0,    -- lifetime credited referral earnings
  referral_pending INTEGER NOT NULL DEFAULT 0,    -- accrued, not yet credited (paid every 30 min)
  invited_count    INTEGER NOT NULL DEFAULT 0,
  first_deposit_at INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (referrer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);

-- Referral chain (levels 1/2/3) kept explicit for fast turnover crediting
CREATE TABLE IF NOT EXISTS referral_links (
  user_id     INTEGER NOT NULL,   -- the player who is generating turnover
  ancestor_id INTEGER NOT NULL,   -- who benefits
  level       INTEGER NOT NULL,   -- 1, 2 or 3
  PRIMARY KEY (user_id, level),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ancestor_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_reflinks_ancestor ON referral_links(ancestor_id);

CREATE TABLE IF NOT EXISTS rounds (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  crash_point  REAL NOT NULL,
  server_seed  TEXT NOT NULL,
  hash         TEXT NOT NULL,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  total_bets   INTEGER NOT NULL DEFAULT 0,
  total_wagered INTEGER NOT NULL DEFAULT 0,
  total_payout INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id          INTEGER NOT NULL,
  user_id           INTEGER NOT NULL,
  amount            INTEGER NOT NULL,
  auto_cashout_at   REAL,
  cashout_multiplier REAL,
  win_amount        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'placed', -- placed | won | lost
  created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (round_id) REFERENCES rounds(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_bets_round ON bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,   -- deposit | withdraw | bet | win | referral | admin_adjust
  amount      INTEGER NOT NULL, -- positive = credit, negative = debit
  meta        TEXT,             -- JSON string with extra context
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);

CREATE TABLE IF NOT EXISTS withdraw_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  handled_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS deposits (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL,
  amount                INTEGER NOT NULL,
  telegram_charge_id    TEXT UNIQUE,
  status                TEXT NOT NULL DEFAULT 'paid',
  created_at            INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

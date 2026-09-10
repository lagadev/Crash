-- Economy settings (joining bonus, first-deposit bonus), game "tuning" knobs
-- (multiplayer/big-bet crash bias), and TON wallet deposits.

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('joining_bonus', '0'),
  ('first_deposit_bonus_percent', '0'),
  ('ton_wallet_address', ''),
  ('star_to_ton_rate', '200'),          -- how many Stars 1 TON buys
  ('game_tuning', '{"bigBetThreshold":2000,"bigBetMaxCrash":1.5,"multiplayerThreshold":5,"multiplayerMinCrash":3}');

CREATE TABLE IF NOT EXISTS ton_deposits (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  tx_hash        TEXT UNIQUE NOT NULL,
  amount_nanoton TEXT NOT NULL,
  stars_credited INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'confirmed',
  created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- A "pay exactly this amount" invoice: TonConnect's sendTransaction() only
-- returns a signed BOC, not a ready-to-match tx hash, and building a valid
-- on-chain comment cell needs the full TON SDK. Instead, each deposit gets a
-- unique nanoton amount (base amount + a small random offset) so the Worker
-- can find the matching on-chain transfer by exact value alone.
CREATE TABLE IF NOT EXISTS ton_deposit_intents (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  stars             INTEGER NOT NULL,
  exact_amount_nanoton TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | expired
  created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  expires_at        INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

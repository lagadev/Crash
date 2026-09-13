-- Withdrawal fee + a third deposit method: a TK (Taka) payment gateway
-- ("UglyPay"-style invoice API), alongside the existing Telegram Stars and
-- TON/GRAM deposit paths.

ALTER TABLE withdraw_requests ADD COLUMN fee_percent REAL NOT NULL DEFAULT 0;
ALTER TABLE withdraw_requests ADD COLUMN net_amount INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('withdraw_fee_percent', '0'),
  ('tk_to_star_rate', '1'),          -- how many stars 1 TK buys
  ('uglypay_base_url', ''),          -- e.g. https://uglypay.devugly.workers.dev
  ('uglypay_callback_url', '');      -- your own public webhook URL, passed as callbackUrl

CREATE TABLE IF NOT EXISTS tk_deposits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  reference       TEXT UNIQUE NOT NULL,
  amount_tk       INTEGER NOT NULL,
  stars_credited  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | verified | failed
  trx_id          TEXT,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  verified_at     INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

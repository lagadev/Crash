-- Referral bonus settings become admin-configurable instead of hardcoded:
--   referral_deposit_bonus_percent - % of a referred user's FIRST deposit
--                                     paid to the referrer (was a fixed 10%)
--   referral_flat_bonus            - flat stars paid to the referrer the
--                                     instant someone joins via their link

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('referral_deposit_bonus_percent', '10'),
  ('referral_flat_bonus', '5');

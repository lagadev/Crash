import { Hono } from "hono";
import type { Env } from "../env";
import { authenticate } from "./auth";
import { ok, fail } from "../utils/response";
import { TelegramBotApi } from "../utils/telegram";
import { isPositiveInt } from "../utils/validation";

export const walletApi = new Hono<{ Bindings: Env }>();

walletApi.get("/balance", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);
  const row = await c.env.DB.prepare(`SELECT balance FROM users WHERE id = ?`).bind(user.id).first<{
    balance: number;
  }>();
  return ok({ balance: row?.balance ?? 0 });
});

/** Creates a Telegram Stars invoice link the Mini App opens via Telegram.WebApp.openInvoice(). */
walletApi.post("/deposit", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const body = await c.req.json().catch(() => ({}));
  const stars = Number(body.stars);
  if (!isPositiveInt(stars) || stars < 50 || stars > 20000) {
    return fail("Amount must be between 50 and 20,000 stars", 400);
  }

  const bot = new TelegramBotApi(c.env.BOT_TOKEN);
  const payload = `deposit_${user.id}_${Date.now()}`;
  const link = await bot.createStarsInvoiceLink(
    "Crash Game Top-up",
    `Add ${stars} \u2b50 to your Crash Game balance`,
    payload,
    stars
  );
  return ok({ invoiceLink: link, payload });
});

walletApi.post("/withdraw", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const body = await c.req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const min = Number(c.env.MIN_WITHDRAW_STARS || "50");

  if (!isPositiveInt(amount) || amount < min) {
    return fail(`Minimum withdrawal is ${min} \u2b50`, 400);
  }

  const row = await c.env.DB.prepare(`SELECT balance FROM users WHERE id = ?`).bind(user.id).first<{
    balance: number;
  }>();
  if (!row || row.balance < amount) return fail("Insufficient balance", 400);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE users SET balance = balance - ? WHERE id = ?`).bind(amount, user.id),
    c.env.DB.prepare(`INSERT INTO withdraw_requests (user_id, amount) VALUES (?, ?)`).bind(user.id, amount),
    c.env.DB.prepare(
      `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'withdraw', ?, '{"status":"pending"}')`
    ).bind(user.id, -amount),
  ]);

  return ok({ message: "Withdrawal request submitted", amount });
});

walletApi.get("/referral", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const row = await c.env.DB.prepare(
    `SELECT invited_count, referral_earned, referral_pending FROM users WHERE id = ?`
  )
    .bind(user.id)
    .first<{ invited_count: number; referral_earned: number; referral_pending: number }>();

  const settingsRows = await c.env.DB.prepare(
    `SELECT key, value FROM settings WHERE key IN ('referral_deposit_bonus_percent', 'referral_flat_bonus')`
  ).all<{ key: string; value: string }>();
  const settingsMap = Object.fromEntries((settingsRows.results ?? []).map((r) => [r.key, r.value]));

  return ok({
    invited: row?.invited_count ?? 0,
    earned: row?.referral_earned ?? 0,
    pending: row?.referral_pending ?? 0,
    link: `https://t.me/${c.env.BOT_USERNAME}?start=ref_${user.id}`,
    depositBonusPercent: Number(settingsMap.referral_deposit_bonus_percent ?? "10"),
    flatBonus: Number(settingsMap.referral_flat_bonus ?? "5"),
  });
});

/** Recent transactions + withdrawal requests, for the Wallet tab. */
walletApi.get("/history", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const [tx, withdrawals] = await Promise.all([
    c.env.DB.prepare(`SELECT type, amount, meta, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 30`)
      .bind(user.id)
      .all(),
    c.env.DB.prepare(`SELECT id, amount, status, created_at FROM withdraw_requests WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
      .bind(user.id)
      .all(),
  ]);

  return ok({ transactions: tx.results ?? [], withdrawals: withdrawals.results ?? [] });
});

/** Top 50 referrers, ranked by lifetime referral earnings. */
walletApi.get("/leaderboard", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const rows = await c.env.DB.prepare(
    `SELECT id, username, first_name, invited_count, referral_earned
     FROM users WHERE invited_count > 0 OR referral_earned > 0
     ORDER BY referral_earned DESC, invited_count DESC LIMIT 50`
  ).all();

  return ok({ leaderboard: rows.results ?? [] });
});

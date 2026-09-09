import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { usersApi } from "./api/users";
import { walletApi } from "./api/wallet";
import { gameApi } from "./api/game";
import { botApi } from "./api/bot";
import { adminApi } from "./api/admin";
import { tasksApi } from "./api/tasks";

export { CrashRoom } from "./game/CrashRoom";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

app.route("/api/users", usersApi);
app.route("/api/wallet", walletApi);
app.route("/api/game", gameApi);
app.route("/api/tasks", tasksApi);
app.route("/api/admin", adminApi);
app.route("/telegram", botApi);

app.get("/api/health", (c) => c.json({ ok: true, time: Date.now() }));

// Everything else (the Mini App UI) is served from /public via the ASSETS binding.
app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,

  /**
   * Cron trigger (every 30 minutes): moves each user's accrued
   * `referral_pending` turnover share into their spendable `balance` /
   * `referral_earned`, per the referral program's payout cadence.
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(payOutPendingReferrals(env));
  },
};

async function payOutPendingReferrals(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT id, referral_pending FROM users WHERE referral_pending >= 0.01`
  ).all<{ id: number; referral_pending: number }>();

  for (const row of rows.results ?? []) {
    const amount = Math.floor(row.referral_pending);
    if (amount <= 0) continue;
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE users SET balance = balance + ?, referral_earned = referral_earned + ?, referral_pending = referral_pending - ?
         WHERE id = ?`
      ).bind(amount, amount, amount, row.id),
      env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'referral', ?, '{"reason":"turnover_payout"}')`
      ).bind(row.id, amount),
    ]);
  }
}

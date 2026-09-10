import { Hono } from "hono";
import type { Env } from "../env";
import { ok, fail } from "../utils/response";
import { TelegramBotApi } from "../utils/telegram";

export const adminApi = new Hono<{ Bindings: Env }>();

// Every admin route requires the X-Admin-Key header to match the ADMIN_KEY secret.
adminApi.use("*", async (c, next) => {
  const key = c.req.header("X-Admin-Key");
  if (!key || key !== c.env.ADMIN_KEY) return fail("Unauthorized", 401);
  await next();
});

// ---------------- Dashboard ----------------
adminApi.get("/dashboard", async (c) => {
  const [users, wagered, deposited, withdrawn, pendingWithdrawals, round] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(total_wagered),0) AS n FROM users`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(total_deposited),0) AS n FROM users`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(total_withdrawn),0) AS n FROM users`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM withdraw_requests WHERE status = 'pending'`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT id, crash_point, started_at, ended_at FROM rounds ORDER BY id DESC LIMIT 1`).first(),
  ]);

  return ok({
    totalUsers: users?.n ?? 0,
    totalWagered: wagered?.n ?? 0,
    totalDeposited: deposited?.n ?? 0,
    totalWithdrawn: withdrawn?.n ?? 0,
    pendingWithdrawals: pendingWithdrawals?.n ?? 0,
    lastRound: round ?? null,
  });
});

// ---------------- User management ----------------
adminApi.get("/users", async (c) => {
  const q = c.req.query("q")?.trim();
  const limit = Math.min(100, Number(c.req.query("limit") || 30));
  let stmt;
  if (q) {
    const like = `%${q}%`;
    stmt = c.env.DB.prepare(
      `SELECT id, username, first_name, balance, total_wagered, total_won, banned, created_at
       FROM users WHERE CAST(id AS TEXT) LIKE ? OR username LIKE ? OR first_name LIKE ?
       ORDER BY created_at DESC LIMIT ?`
    ).bind(like, like, like, limit);
  } else {
    stmt = c.env.DB.prepare(
      `SELECT id, username, first_name, balance, total_wagered, total_won, banned, created_at
       FROM users ORDER BY created_at DESC LIMIT ?`
    ).bind(limit);
  }
  const rows = await stmt.all();
  return ok({ users: rows.results ?? [] });
});

adminApi.get("/users/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first();
  if (!user) return fail("User not found", 404);
  const recentTx = await c.env.DB.prepare(
    `SELECT type, amount, meta, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 20`
  )
    .bind(id)
    .all();
  return ok({ user, transactions: recentTx.results ?? [] });
});

adminApi.post("/users/:id/balance", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json().catch(() => ({}));
  const mode = body.mode === "set" ? "set" : "adjust"; // "adjust" adds/subtracts, "set" overwrites
  const amount = Number(body.amount);
  if (!Number.isFinite(amount)) return fail("Invalid amount", 400);

  if (mode === "set") {
    await c.env.DB.prepare(`UPDATE users SET balance = ? WHERE id = ?`).bind(Math.max(0, Math.floor(amount)), id).run();
  } else {
    await c.env.DB.prepare(`UPDATE users SET balance = MAX(0, balance + ?) WHERE id = ?`)
      .bind(Math.floor(amount), id)
      .run();
  }
  await c.env.DB.prepare(
    `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'admin_adjust', ?, ?)`
  )
    .bind(id, Math.floor(amount), JSON.stringify({ mode }))
    .run();

  const row = await c.env.DB.prepare(`SELECT balance FROM users WHERE id = ?`).bind(id).first<{ balance: number }>();
  return ok({ balance: row?.balance ?? 0 });
});

adminApi.post("/users/:id/ban", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(`UPDATE users SET banned = 1 WHERE id = ?`).bind(id).run();
  return ok({ banned: true });
});

adminApi.post("/users/:id/unban", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(`UPDATE users SET banned = 0 WHERE id = ?`).bind(id).run();
  return ok({ banned: false });
});

// ---------------- Withdrawals ----------------
adminApi.get("/withdrawals", async (c) => {
  const status = c.req.query("status");
  const stmt = status
    ? c.env.DB.prepare(
        `SELECT w.*, u.username, u.first_name FROM withdraw_requests w JOIN users u ON u.id = w.user_id
         WHERE w.status = ? ORDER BY w.id DESC LIMIT 200`
      ).bind(status)
    : c.env.DB.prepare(
        `SELECT w.*, u.username, u.first_name FROM withdraw_requests w JOIN users u ON u.id = w.user_id
         ORDER BY w.id DESC LIMIT 200`
      );
  const rows = await stmt.all();
  return ok({ withdrawals: rows.results ?? [] });
});

adminApi.post("/withdrawals/:id/approve", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(
    `UPDATE withdraw_requests SET status = 'approved', handled_at = strftime('%s','now') WHERE id = ?`
  )
    .bind(id)
    .run();
  const req = await c.env.DB.prepare(`SELECT user_id, amount FROM withdraw_requests WHERE id = ?`).bind(id).first<{
    user_id: number;
    amount: number;
  }>();
  if (req) {
    await c.env.DB.prepare(`UPDATE users SET total_withdrawn = total_withdrawn + ? WHERE id = ?`)
      .bind(req.amount, req.user_id)
      .run();
    new TelegramBotApi(c.env.BOT_TOKEN)
      .sendMessage(req.user_id, `\u2705 Your withdrawal of ${req.amount} \u2b50 has been approved and paid.`)
      .catch(() => {});
  }
  return ok({ status: "approved" });
});

adminApi.post("/withdrawals/:id/reject", async (c) => {
  const id = Number(c.req.param("id"));
  const req = await c.env.DB.prepare(`SELECT user_id, amount, status FROM withdraw_requests WHERE id = ?`)
    .bind(id)
    .first<{ user_id: number; amount: number; status: string }>();
  if (!req) return fail("Not found", 404);
  if (req.status !== "pending") return fail("Already handled", 400);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE withdraw_requests SET status = 'rejected', handled_at = strftime('%s','now') WHERE id = ?`).bind(id),
    c.env.DB.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`).bind(req.amount, req.user_id),
  ]);
  new TelegramBotApi(c.env.BOT_TOKEN)
    .sendMessage(req.user_id, `\u274c Your withdrawal of ${req.amount} \u2b50 was rejected and refunded to your balance.`)
    .catch(() => {});
  return ok({ status: "rejected" });
});

// ---------------- Task management ----------------
adminApi.get("/tasks", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM tasks ORDER BY sort_order ASC, id DESC`).all();
  return ok({ tasks: rows.results ?? [] });
});

adminApi.post("/tasks", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.name || !b.link) return fail("name and link are required", 400);
  const res = await c.env.DB.prepare(
    `INSERT INTO tasks (name, logo_url, link, reward, active, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(b.name, b.logoUrl || null, b.link, Number(b.reward) || 0, b.active === false ? 0 : 1, Number(b.sortOrder) || 0)
    .run();
  return ok({ id: res.meta.last_row_id });
});

adminApi.put("/tasks/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const b = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare(
    `UPDATE tasks SET name = ?, logo_url = ?, link = ?, reward = ?, active = ?, sort_order = ? WHERE id = ?`
  )
    .bind(
      b.name,
      b.logoUrl || null,
      b.link,
      Number(b.reward) || 0,
      b.active === false ? 0 : 1,
      Number(b.sortOrder) || 0,
      id
    )
    .run();
  return ok({ updated: true });
});

adminApi.delete("/tasks/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM user_tasks WHERE task_id = ?`).bind(id).run();
  return ok({ deleted: true });
});

// ---------------- Game management ----------------
adminApi.get("/game", async (c) => {
  const rounds = await c.env.DB.prepare(
    `SELECT id, crash_point, total_bets, total_wagered, total_payout, started_at, ended_at
     FROM rounds ORDER BY id DESC LIMIT 30`
  ).all();
  const control = await c.env.DB.prepare(`SELECT forced_crash_point FROM game_control WHERE id = 1`).first<{
    forced_crash_point: number | null;
  }>();
  return ok({ rounds: rounds.results ?? [], forcedCrashPoint: control?.forced_crash_point ?? null });
});

adminApi.post("/game/force-crash", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const multiplier = Number(b.multiplier);
  if (!Number.isFinite(multiplier) || multiplier < 1) return fail("multiplier must be >= 1", 400);
  await c.env.DB.prepare(`UPDATE game_control SET forced_crash_point = ? WHERE id = 1`).bind(multiplier).run();
  return ok({ forcedCrashPoint: multiplier });
});

adminApi.post("/game/clear-force-crash", async (c) => {
  await c.env.DB.prepare(`UPDATE game_control SET forced_crash_point = NULL WHERE id = 1`).run();
  return ok({ forcedCrashPoint: null });
});

// ---------------- Economy & game-tuning settings ----------------
adminApi.get("/settings", async (c) => {
  const keys = ["joining_bonus", "first_deposit_bonus_percent", "ton_wallet_address", "star_to_ton_rate", "game_tuning"];
  const rows = await c.env.DB.prepare(
    `SELECT key, value FROM settings WHERE key IN (${keys.map(() => "?").join(",")})`
  )
    .bind(...keys)
    .all<{ key: string; value: string }>();
  const map = Object.fromEntries((rows.results ?? []).map((r) => [r.key, r.value]));

  return ok({
    joiningBonus: Number(map.joining_bonus ?? "0"),
    firstDepositBonusPercent: Number(map.first_deposit_bonus_percent ?? "0"),
    tonWalletAddress: map.ton_wallet_address ?? "",
    starToTonRate: Number(map.star_to_ton_rate ?? "200"),
    gameTuning: map.game_tuning
      ? JSON.parse(map.game_tuning)
      : { bigBetThreshold: 2000, bigBetMaxCrash: 1.5, multiplayerThreshold: 5, multiplayerMinCrash: 3 },
  });
});

adminApi.post("/settings", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const entries: [string, string][] = [
    ["joining_bonus", String(Math.max(0, Math.floor(Number(b.joiningBonus) || 0)))],
    ["first_deposit_bonus_percent", String(Math.max(0, Number(b.firstDepositBonusPercent) || 0))],
    ["ton_wallet_address", String(b.tonWalletAddress || "")],
    ["star_to_ton_rate", String(Math.max(1, Number(b.starToTonRate) || 200))],
    [
      "game_tuning",
      JSON.stringify({
        bigBetThreshold: Math.max(1, Number(b.gameTuning?.bigBetThreshold) || 2000),
        bigBetMaxCrash: Math.max(1, Number(b.gameTuning?.bigBetMaxCrash) || 1.5),
        multiplayerThreshold: Math.max(1, Number(b.gameTuning?.multiplayerThreshold) || 5),
        multiplayerMinCrash: Math.max(1, Number(b.gameTuning?.multiplayerMinCrash) || 3),
      }),
    ],
  ];

  await c.env.DB.batch(
    entries.map(([key, value]) => c.env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).bind(key, value))
  );

  return ok({ saved: true });
});

// ---------------- Bot settings / start message ----------------
adminApi.get("/bot-settings", async (c) => {
  const row = await c.env.DB.prepare(`SELECT value FROM settings WHERE key = 'start_message'`).first<{
    value: string;
  }>();
  return ok({ startMessage: row?.value ? JSON.parse(row.value) : null });
});

adminApi.post("/bot-settings", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const payload = { text: b.text || "", imageUrl: b.imageUrl || null, buttons: b.buttons || [] };
  await c.env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('start_message', ?)`)
    .bind(JSON.stringify(payload))
    .run();
  return ok({ saved: true });
});

// ---------------- Broadcast ----------------
adminApi.post("/broadcast", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const text: string = b.text || "";
  const imageUrl: string | null = b.imageUrl || null;
  const buttons: { text: string; url?: string; style?: string }[][] = b.buttons || [];

  const users = await c.env.DB.prepare(`SELECT id FROM users WHERE banned = 0`).all<{ id: number }>();
  const bot = new TelegramBotApi(c.env.BOT_TOKEN);
  const replyMarkup = buttons.length ? { inline_keyboard: buttons.map((row) => row.map(styledButton)) } : undefined;

  let sent = 0;
  let failed = 0;
  for (const u of users.results ?? []) {
    try {
      if (imageUrl) {
        await bot.sendPhotoBroadcast(u.id, imageUrl, text, replyMarkup);
      } else {
        await bot.sendMessage(u.id, text, { reply_markup: replyMarkup });
      }
      sent++;
    } catch {
      failed++;
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO broadcasts (text, image_url, buttons, sent_count, failed_count) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(text, imageUrl, JSON.stringify(buttons), sent, failed)
    .run();

  return ok({ sent, failed, total: (users.results ?? []).length });
});

/**
 * Telegram's Bot API inline keyboard buttons don't currently support a
 * native color/"style" property, so we degrade `style` into a small visual
 * prefix (this keeps the JSON shape the admin sends - {text, style} -
 * useful if a future Bot API / client version adds real styled buttons).
 */
function styledButton(btn: { text: string; url?: string; style?: string }) {
  const prefix = btn.style === "success" ? "\u2705 " : btn.style === "danger" ? "\u26d4 " : btn.style === "primary" ? "\u25b6\ufe0f " : "";
  return { text: `${prefix}${btn.text}`, url: btn.url || undefined };
}

import { Hono } from "hono";
import type { Env } from "../env";
import { ok, fail } from "../utils/response";
import { upsertUser } from "./auth";
import { creditDeposit } from "./deposits";
import { TelegramBotApi } from "../utils/telegram";

export const botProxyApi = new Hono<{ Bindings: Env }>();

// All routes here are for the companion crash-game-bot project only,
// authenticated with the BOT_SHARED_KEY secret (never exposed to end users).
botProxyApi.use("*", async (c, next) => {
  const key = c.req.header("X-Bot-Key");
  if (!key || !c.env.BOT_SHARED_KEY || key !== c.env.BOT_SHARED_KEY) return fail("Unauthorized", 401);
  await next();
});

/**
 * Ensures a user row exists for someone who messaged the bot directly
 * (i.e. never opened the Mini App first) - same upsert + joining-bonus +
 * referral-linking logic the Mini App's initData path uses.
 */
botProxyApi.post("/ensure-user", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return fail("Missing id", 400);

  const banned = await upsertUser(
    c.env,
    { id, username: body.username, first_name: body.firstName || "", photo_url: body.photoUrl },
    body.startParam || ""
  );
  if (banned) return fail("User is banned", 403);
  return ok({ ensured: true });
});

/** Credits a Telegram Stars payment the bot's webhook received (successful_payment). Idempotent on chargeId. */
botProxyApi.post("/credit-payment", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const userId = Number(body.userId);
  const stars = Number(body.stars);
  const chargeId = String(body.chargeId || "");
  if (!userId || !stars || !chargeId) return fail("Missing userId/stars/chargeId", 400);

  const already = await c.env.DB.prepare(`SELECT id FROM deposits WHERE telegram_charge_id = ?`)
    .bind(chargeId)
    .first();
  if (already) return ok({ credited: false, reason: "already processed" });

  await c.env.DB.prepare(`INSERT INTO deposits (user_id, amount, telegram_charge_id) VALUES (?, ?, ?)`)
    .bind(userId, stars, chargeId)
    .run();
  await c.env.DB.prepare(`INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'deposit', ?, ?)`)
    .bind(userId, stars, JSON.stringify({ chargeId, source: "bot" }))
    .run();

  const bot = new TelegramBotApi(c.env.BOT_TOKEN);
  await creditDeposit(c.env, userId, stars, bot, "Telegram Stars");
  return ok({ credited: true });
});

/** The admin-configured /start message (image/text/buttons), so the bot project can render the same welcome. */
botProxyApi.get("/start-message", async (c) => {
  const row = await c.env.DB.prepare(`SELECT value FROM settings WHERE key = 'start_message'`).first<{
    value: string;
  }>();
  return ok({ startMessage: row?.value ? JSON.parse(row.value) : null });
});


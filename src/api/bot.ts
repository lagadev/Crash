import { Hono } from "hono";
import type { Env } from "../env";
import { TelegramBotApi } from "../utils/telegram";
import { ok } from "../utils/response";

export const botApi = new Hono<{ Bindings: Env }>();

botApi.post("/webhook", async (c) => {
  const update = await c.req.json().catch(() => null);
  if (!update) return ok({});

  const bot = new TelegramBotApi(c.env.BOT_TOKEN);

  // 1) Telegram always requires an immediate OK to pre_checkout_query.
  if (update.pre_checkout_query) {
    await bot.answerPreCheckoutQuery(update.pre_checkout_query.id, true);
    return ok({});
  }

  // 2) Successful Stars payment -> credit the game wallet.
  const sp = update.message?.successful_payment;
  if (sp) {
    const userId = update.message.from.id as number;
    const stars = Number(sp.total_amount); // XTR amounts are already integer stars
    const chargeId = sp.telegram_payment_charge_id as string;

    const already = await c.env.DB.prepare(`SELECT id FROM deposits WHERE telegram_charge_id = ?`)
      .bind(chargeId)
      .first();
    if (!already) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          `UPDATE users SET balance = balance + ?, total_deposited = total_deposited + ? WHERE id = ?`
        ).bind(stars, stars, userId),
        c.env.DB.prepare(
          `INSERT INTO deposits (user_id, amount, telegram_charge_id) VALUES (?, ?, ?)`
        ).bind(userId, stars, chargeId),
        c.env.DB.prepare(
          `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'deposit', ?, ?)`
        ).bind(userId, stars, JSON.stringify({ chargeId })),
      ]);

      await maybeCreditFirstDepositBonus(c.env, userId, stars, bot);
    }
    await bot.sendMessage(userId, `\u2705 ${stars} \u2b50 added to your Crash Game balance!`);
    return ok({});
  }

  // 3) /start (optionally with a referral deep-link payload).
  const text: string | undefined = update.message?.text;
  if (text && text.startsWith("/start")) {
    const chatId = update.message.chat.id as number;
    await bot.sendMessage(chatId, "\ud83d\ude80 Welcome to <b>Crash Game</b>! Tap below to play.", {
      reply_markup: {
        inline_keyboard: [[{ text: "\ud83c\udfae Open Crash Game", web_app: { url: `https://${c.req.header("host")}/` } }]],
      },
    });
  }

  return ok({});
});

/** First deposit ever -> the direct (level-1) referrer instantly gets 10% of it. */
async function maybeCreditFirstDepositBonus(env: Env, userId: number, stars: number, bot: TelegramBotApi) {
  const user = await env.DB.prepare(`SELECT referrer_id, first_deposit_at FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ referrer_id: number | null; first_deposit_at: number | null }>();
  if (!user || user.first_deposit_at) return;

  await env.DB.prepare(`UPDATE users SET first_deposit_at = strftime('%s','now') WHERE id = ?`)
    .bind(userId)
    .run();

  if (!user.referrer_id) return;

  const bonus = Math.floor(stars * 0.1);
  if (bonus <= 0) return;

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users SET balance = balance + ?, referral_earned = referral_earned + ? WHERE id = ?`
    ).bind(bonus, bonus, user.referrer_id),
    env.DB.prepare(
      `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'referral', ?, ?)`
    ).bind(user.referrer_id, bonus, JSON.stringify({ reason: "first_deposit", fromUser: userId })),
  ]);

  await bot
    .sendMessage(user.referrer_id, `\ud83c\udf81 Your referral made their first deposit! You earned ${bonus} \u2b50.`)
    .catch(() => {});
}

import type { Env } from "../env";
import { TelegramBotApi } from "../utils/telegram";

/**
 * Shared "a deposit just landed" logic, used by both the Telegram Stars
 * webhook and the TON wallet deposit route:
 *  1. Credits the deposited amount to the user's balance.
 *  2. Applies the admin-configured "first deposit bonus %" to the
 *     depositor themselves (once, on their very first deposit).
 *  3. Pays the direct referrer 10% of a brand-new user's first deposit.
 */
export async function creditDeposit(env: Env, userId: number, stars: number, bot: TelegramBotApi, source: string) {
  await env.DB.prepare(
    `UPDATE users SET balance = balance + ?, total_deposited = total_deposited + ? WHERE id = ?`
  )
    .bind(stars, stars, userId)
    .run();

  const user = await env.DB.prepare(`SELECT referrer_id, first_deposit_at FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ referrer_id: number | null; first_deposit_at: number | null }>();

  if (user && !user.first_deposit_at) {
    await env.DB.prepare(`UPDATE users SET first_deposit_at = strftime('%s','now') WHERE id = ?`)
      .bind(userId)
      .run();

    // Own first-deposit bonus (admin configurable %, e.g. "deposit 100, get 110").
    const pctRow = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'first_deposit_bonus_percent'`).first<{
      value: string;
    }>();
    const pct = Number(pctRow?.value ?? "0");
    const ownBonus = Math.floor(stars * (pct / 100));
    if (ownBonus > 0) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`).bind(ownBonus, userId),
        env.DB.prepare(
          `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'first_deposit_bonus', ?, ?)`
        ).bind(userId, ownBonus, JSON.stringify({ percent: pct, source })),
      ]);
      await bot.sendMessage(userId, `\ud83c\udf89 First deposit bonus: +${ownBonus} \u2b50 (${pct}%)`).catch(() => {});
    }

    // Referrer's 10% first-deposit bonus.
    if (user.referrer_id) {
      const refBonus = Math.floor(stars * 0.1);
      if (refBonus > 0) {
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE users SET balance = balance + ?, referral_earned = referral_earned + ? WHERE id = ?`
          ).bind(refBonus, refBonus, user.referrer_id),
          env.DB.prepare(
            `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'referral', ?, ?)`
          ).bind(user.referrer_id, refBonus, JSON.stringify({ reason: "first_deposit", fromUser: userId, source })),
        ]);
        await bot
          .sendMessage(user.referrer_id, `\ud83c\udf81 Your referral made their first deposit! You earned ${refBonus} \u2b50.`)
          .catch(() => {});
      }
    }
  }

  await bot.sendMessage(userId, `\u2705 ${stars} \u2b50 added to your Crash Game balance! (${source})`).catch(() => {});
}

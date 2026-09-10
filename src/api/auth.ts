import type { Context } from "hono";
import type { Env } from "../env";
import { verifyInitData, type TelegramUser } from "../utils/telegram";

export interface AuthedUser extends TelegramUser {}

/**
 * Verifies the `X-Telegram-Init-Data` header, upserts the user row, and
 * (for brand-new users) wires up the 3-level referral chain from the
 * `start_param` (format: `ref_<inviterId>`).
 *
 * Returns the Telegram user, or null if auth failed.
 */
export async function authenticate(c: Context<{ Bindings: Env }>): Promise<TelegramUser | null> {
  const initData = c.req.header("X-Telegram-Init-Data") || (await safeBodyInitData(c));
  if (!initData) return null;

  const user = await verifyInitData(initData, c.env.BOT_TOKEN);
  if (!user) return null;

  const params = new URLSearchParams(initData);
  const startParam = params.get("start_param") || "";

  const existing = await c.env.DB.prepare(`SELECT id, banned FROM users WHERE id = ?`).bind(user.id).first<{
    id: number;
    banned: number;
  }>();
  if (existing?.banned) return null;

  if (!existing) {
    const joiningBonusRow = await c.env.DB.prepare(`SELECT value FROM settings WHERE key = 'joining_bonus'`).first<{
      value: string;
    }>();
    const joiningBonus = Math.max(0, Math.floor(Number(joiningBonusRow?.value ?? "0")));

    await c.env.DB.prepare(
      `INSERT INTO users (id, username, first_name, photo_url, balance) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(user.id, user.username ?? null, user.first_name ?? null, user.photo_url ?? null, joiningBonus)
      .run();

    if (joiningBonus > 0) {
      await c.env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'joining_bonus', ?, '{}')`
      )
        .bind(user.id, joiningBonus)
        .run();
    }

    const m = startParam.match(/^ref_(\d+)$/);
    if (m) {
      const referrerId = Number(m[1]);
      if (referrerId !== user.id) {
        await linkReferral(c.env, user.id, referrerId);
      }
    }
  } else {
    await c.env.DB.prepare(
      `UPDATE users SET username = ?, first_name = ?, photo_url = ? WHERE id = ?`
    )
      .bind(user.username ?? null, user.first_name ?? null, user.photo_url ?? null, user.id)
      .run();
  }

  return user;
}

async function safeBodyInitData(c: Context): Promise<string | null> {
  try {
    const clone = c.req.raw.clone();
    const body: any = await clone.json();
    return body?.initData ?? null;
  } catch {
    return null;
  }
}

async function linkReferral(env: Env, newUserId: number, level1ReferrerId: number) {
  const referrer = await env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(level1ReferrerId).first();
  if (!referrer) return;

  await env.DB.prepare(`UPDATE users SET referrer_id = ? WHERE id = ?`).bind(level1ReferrerId, newUserId).run();
  await env.DB.prepare(`UPDATE users SET invited_count = invited_count + 1 WHERE id = ?`)
    .bind(level1ReferrerId)
    .run();

  // Build the 3-level ancestor chain: level1 = direct referrer, level2/3 = their up-line.
  await env.DB.prepare(
    `INSERT OR REPLACE INTO referral_links (user_id, ancestor_id, level) VALUES (?, ?, 1)`
  )
    .bind(newUserId, level1ReferrerId)
    .run();

  const l1 = await env.DB.prepare(`SELECT referrer_id FROM users WHERE id = ?`).bind(level1ReferrerId).first<{
    referrer_id: number | null;
  }>();
  if (l1?.referrer_id) {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO referral_links (user_id, ancestor_id, level) VALUES (?, ?, 2)`
    )
      .bind(newUserId, l1.referrer_id)
      .run();

    const l2 = await env.DB.prepare(`SELECT referrer_id FROM users WHERE id = ?`).bind(l1.referrer_id).first<{
      referrer_id: number | null;
    }>();
    if (l2?.referrer_id) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO referral_links (user_id, ancestor_id, level) VALUES (?, ?, 3)`
      )
        .bind(newUserId, l2.referrer_id)
        .run();
    }
  }
}

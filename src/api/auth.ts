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
  // Trusted path for the companion bot project (crash-game-bot): it knows the
  // Telegram user id directly from the bot update (no initData exists in a
  // plain chat), so it authenticates with a shared secret instead. This lets
  // the bot reuse all of this Worker's wallet/referral logic over HTTP
  // rather than duplicating it against the database directly.
  const botKey = c.req.header("X-Bot-Key");
  if (botKey) {
    if (!c.env.BOT_SHARED_KEY || botKey !== c.env.BOT_SHARED_KEY) return null;
    const userId = Number(c.req.header("X-Telegram-User-Id"));
    if (!userId) return null;
    const row = await c.env.DB.prepare(`SELECT id, username, first_name, photo_url, banned FROM users WHERE id = ?`)
      .bind(userId)
      .first<{ id: number; username: string | null; first_name: string | null; photo_url: string | null; banned: number }>();
    if (!row || row.banned) return null;
    return { id: row.id, username: row.username ?? undefined, first_name: row.first_name ?? "", photo_url: row.photo_url ?? undefined };
  }

  const initData = c.req.header("X-Telegram-Init-Data") || (await safeBodyInitData(c));
  if (!initData) return null;

  const user = await verifyInitData(initData, c.env.BOT_TOKEN);
  if (!user) return null;

  const params = new URLSearchParams(initData);
  const startParam = params.get("start_param") || "";

  const banned = await upsertUser(c.env, user, startParam);
  if (banned) return null;

  return user;
}

/**
 * Creates the user row (with joining bonus + referral linking) if it
 * doesn't exist yet, or refreshes their cached name/photo if it does.
 * Shared by the initData path above and the bot's `/api/bot/ensure-user`
 * endpoint. Returns true if the user is banned (caller should reject).
 */
export async function upsertUser(env: Env, user: TelegramUser, startParam: string): Promise<boolean> {
  const existing = await env.DB.prepare(`SELECT id, banned FROM users WHERE id = ?`).bind(user.id).first<{
    id: number;
    banned: number;
  }>();
  if (existing?.banned) return true;

  if (!existing) {
    const joiningBonusRow = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'joining_bonus'`).first<{
      value: string;
    }>();
    const joiningBonus = Math.max(0, Math.floor(Number(joiningBonusRow?.value ?? "0")));

    await env.DB.prepare(
      `INSERT INTO users (id, username, first_name, photo_url, balance) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(user.id, user.username ?? null, user.first_name ?? null, user.photo_url ?? null, joiningBonus)
      .run();

    if (joiningBonus > 0) {
      await env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'joining_bonus', ?, '{}')`
      )
        .bind(user.id, joiningBonus)
        .run();
    }

    const m = startParam.match(/^ref_(\d+)$/);
    if (m) {
      const referrerId = Number(m[1]);
      if (referrerId !== user.id) {
        await linkReferral(env, user.id, referrerId);
      }
    }
  } else {
    await env.DB.prepare(`UPDATE users SET username = ?, first_name = ?, photo_url = ? WHERE id = ?`)
      .bind(user.username ?? null, user.first_name ?? null, user.photo_url ?? null, user.id)
      .run();
  }
  return false;
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

  // Flat "X stars per invite" bonus, paid immediately (admin configurable),
  // capped at N per referrer per day to prevent abuse.
  const [flatRow, capRow] = await Promise.all([
    env.DB.prepare(`SELECT value FROM settings WHERE key = 'referral_flat_bonus'`).first<{ value: string }>(),
    env.DB.prepare(`SELECT value FROM settings WHERE key = 'referral_daily_cap'`).first<{ value: string }>(),
  ]);
  const flatBonus = Math.max(0, Math.floor(Number(flatRow?.value ?? "5")));
  const dailyCap = Math.max(0, Math.floor(Number(capRow?.value ?? "30")));

  if (flatBonus > 0) {
    const todayCount = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM transactions
       WHERE user_id = ? AND type = 'referral' AND meta LIKE '%new_invite%'
       AND created_at >= strftime('%s', 'now', 'start of day')`
    )
      .bind(level1ReferrerId)
      .first<{ n: number }>();

    if ((todayCount?.n ?? 0) < dailyCap) {
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE users SET balance = balance + ?, referral_earned = referral_earned + ? WHERE id = ?`
        ).bind(flatBonus, flatBonus, level1ReferrerId),
        env.DB.prepare(
          `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'referral', ?, ?)`
        ).bind(level1ReferrerId, flatBonus, JSON.stringify({ reason: "new_invite", fromUser: newUserId })),
      ]);
    }
  }

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

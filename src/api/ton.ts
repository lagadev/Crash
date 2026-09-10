import { Hono } from "hono";
import type { Env } from "../env";
import { authenticate } from "./auth";
import { ok, fail } from "../utils/response";
import { TelegramBotApi } from "../utils/telegram";
import { creditDeposit } from "./deposits";

export const tonApi = new Hono<{ Bindings: Env }>();

async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

/** Public deposit config the Mini App needs before it can build a TonConnect transaction. */
tonApi.get("/config", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const [address, rate] = await Promise.all([
    getSetting(c.env, "ton_wallet_address"),
    getSetting(c.env, "star_to_ton_rate"),
  ]);

  if (!address) return fail("TON deposits are not configured yet", 503);
  return ok({ walletAddress: address, starToTonRate: Number(rate ?? "200") });
});

/**
 * Creates a "pay exactly this amount" deposit intent. TonConnect's
 * sendTransaction() only returns a signed BOC (no ready tx hash), and
 * building a valid on-chain comment cell needs the full TON SDK - so
 * instead each intent gets a unique nanoton amount (base + a small random
 * offset), and the Worker later matches the on-chain transfer by that exact
 * value. The offset is a few billionths of a TON: negotiable dust, but
 * unique enough to disambiguate concurrent deposits.
 */
tonApi.post("/create-intent", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const body = await c.req.json().catch(() => ({}));
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 50 || stars > 20000) {
    return fail("Amount must be between 50 and 20,000 stars", 400);
  }

  const address = await getSetting(c.env, "ton_wallet_address");
  const rate = Number((await getSetting(c.env, "star_to_ton_rate")) ?? "200");
  if (!address) return fail("TON deposits are not configured", 503);

  const baseNanoton = Math.floor((stars / rate) * 1_000_000_000);
  const offset = 1000 + Math.floor(Math.random() * 8999); // 1,000-9,999 nanoton of dust
  const exactAmount = baseNanoton + offset;
  const expiresAt = Math.floor(Date.now() / 1000) + 20 * 60; // 20 minutes to complete payment

  await c.env.DB.prepare(
    `INSERT INTO ton_deposit_intents (user_id, stars, exact_amount_nanoton, expires_at) VALUES (?, ?, ?, ?)`
  )
    .bind(user.id, stars, String(exactAmount), expiresAt)
    .run();

  return ok({ walletAddress: address, exactAmountNanoton: String(exactAmount), exactAmountTon: exactAmount / 1e9, expiresAt });
});

/**
 * Looks up the house wallet's recent transactions for one whose value
 * exactly matches a pending intent's `exact_amount_nanoton`, and credits
 * Stars if found. The on-chain transaction hash is stored (UNIQUE) so a
 * given payment can only ever be credited once.
 */
tonApi.post("/verify-intent", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const intent = await c.env.DB.prepare(
    `SELECT id, stars, exact_amount_nanoton, expires_at FROM ton_deposit_intents
     WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`
  )
    .bind(user.id)
    .first<{ id: number; stars: number; exact_amount_nanoton: string; expires_at: number }>();

  if (!intent) return fail("No pending deposit found - start a new one", 404);
  if (intent.expires_at < Math.floor(Date.now() / 1000)) {
    await c.env.DB.prepare(`UPDATE ton_deposit_intents SET status = 'expired' WHERE id = ?`).bind(intent.id).run();
    return fail("This deposit request expired - start a new one", 410);
  }

  const address = await getSetting(c.env, "ton_wallet_address");
  if (!address) return fail("TON deposits are not configured", 503);

  try {
    const params = new URLSearchParams({ address, limit: "40", archival: "true" });
    const headers: Record<string, string> = {};
    if (c.env.TON_API_KEY) headers["X-API-Key"] = c.env.TON_API_KEY;

    const res = await fetch(`https://toncenter.com/api/v2/getTransactions?${params}`, { headers });
    const data: any = await res.json();
    const tx = (data?.result ?? []).find((t: any) => String(t.in_msg?.value ?? "") === intent.exact_amount_nanoton);

    if (!tx) return fail("Payment not seen yet - it may still be confirming, try again in a few seconds", 404);

    const txHash: string = tx.transaction_id?.hash || tx.hash;
    const already = await c.env.DB.prepare(`SELECT id FROM ton_deposits WHERE tx_hash = ?`).bind(txHash).first();
    if (already) return fail("This transaction has already been credited", 400);

    await c.env.DB.prepare(`UPDATE ton_deposit_intents SET status = 'confirmed' WHERE id = ?`).bind(intent.id).run();
    await c.env.DB.prepare(
      `INSERT INTO ton_deposits (user_id, tx_hash, amount_nanoton, stars_credited) VALUES (?, ?, ?, ?)`
    )
      .bind(user.id, txHash, intent.exact_amount_nanoton, intent.stars)
      .run();
    await c.env.DB.prepare(
      `INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'deposit', ?, ?)`
    )
      .bind(user.id, intent.stars, JSON.stringify({ txHash, nanoton: intent.exact_amount_nanoton }))
      .run();

    const bot = new TelegramBotApi(c.env.BOT_TOKEN);
    await creditDeposit(c.env, user.id, intent.stars, bot, "TON Wallet");

    return ok({ stars: intent.stars });
  } catch (e: any) {
    return fail(`Verification failed: ${e.message || e}`, 502);
  }
});

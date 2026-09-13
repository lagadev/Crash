import { Hono } from "hono";
import type { Env } from "../env";
import { authenticate } from "./auth";
import { ok, fail } from "../utils/response";
import { TelegramBotApi } from "../utils/telegram";
import { creditDeposit } from "./deposits";

export const uglypayApi = new Hono<{ Bindings: Env }>();

async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

/**
 * Creates a TK-denominated invoice via an UglyPay-compatible gateway
 * (https://uglypay.devugly.workers.dev or your own instance) and returns
 * the pay page URL for the Mini App / bot to send the user to.
 */
uglypayApi.post("/create", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const body = await c.req.json().catch(() => ({}));
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1) return fail("Invalid amount", 400);

  const [baseUrl, callbackUrl, rate] = await Promise.all([
    getSetting(c.env, "uglypay_base_url"),
    getSetting(c.env, "uglypay_callback_url"),
    getSetting(c.env, "tk_to_star_rate"),
  ]);
  if (!baseUrl || !c.env.UGLYPAY_API_KEY) return fail("TK deposits are not configured yet", 503);

  const starRate = Number(rate ?? "1");
  const amountTk = Math.max(1, Math.ceil(stars / starRate));
  const reference = `crash_${user.id}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.env.UGLYPAY_API_KEY}` },
    body: JSON.stringify({ amount: amountTk, reference, callbackUrl: callbackUrl || undefined }),
  });
  if (!res.ok) return fail(`Payment gateway error (${res.status})`, 502);
  const invoice: any = await res.json();
  if (!invoice.payUrl) return fail("Payment gateway did not return a pay URL", 502);

  await c.env.DB.prepare(
    `INSERT INTO tk_deposits (user_id, reference, amount_tk, stars_credited) VALUES (?, ?, ?, ?)`
  )
    .bind(user.id, reference, amountTk, stars)
    .run();

  return ok({ payUrl: invoice.payUrl, reference, amountTk });
});

/**
 * Webhook the payment gateway calls once an invoice is paid. Verified via
 * HMAC-SHA256 over the raw JSON body, signed with YOUR OWN gateway API key
 * (UGLYPAY_API_KEY) - not ADMIN_KEY or BOT_TOKEN.
 */
uglypayApi.post("/webhook", async (c) => {
  const raw = await c.req.text();
  const signature = c.req.header("x-signature") || "";

  if (!c.env.UGLYPAY_API_KEY) return fail("Not configured", 503);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(c.env.UGLYPAY_API_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (signature !== expected) return fail("Invalid signature", 401);

  const body = JSON.parse(raw);
  if (body.event !== "invoice.verified") return ok({});

  const { reference, trxId } = body;
  const deposit = await c.env.DB.prepare(
    `SELECT id, user_id, stars_credited, status FROM tk_deposits WHERE reference = ?`
  )
    .bind(reference)
    .first<{ id: number; user_id: number; stars_credited: number; status: string }>();
  if (!deposit || deposit.status === "verified") return ok({}); // unknown or already processed - stay idempotent

  await c.env.DB.prepare(
    `UPDATE tk_deposits SET status = 'verified', trx_id = ?, verified_at = strftime('%s','now') WHERE id = ?`
  )
    .bind(trxId ?? null, deposit.id)
    .run();
  await c.env.DB.prepare(`INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'deposit', ?, ?)`)
    .bind(deposit.user_id, deposit.stars_credited, JSON.stringify({ reference, trxId, gateway: "uglypay" }))
    .run();

  const bot = new TelegramBotApi(c.env.BOT_TOKEN);
  await creditDeposit(c.env, deposit.user_id, deposit.stars_credited, bot, "TK Payment");

  return ok({});
});

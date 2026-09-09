import { Hono } from "hono";
import type { Env } from "../env";
import { authenticate } from "./auth";
import { ok, fail } from "../utils/response";

export const usersApi = new Hono<{ Bindings: Env }>();

usersApi.get("/me", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const row = await c.env.DB.prepare(
    `SELECT id, username, first_name, photo_url, balance, total_wagered, total_won,
            total_deposited, total_withdrawn, invited_count, referral_earned,
            referral_pending, created_at
     FROM users WHERE id = ?`
  )
    .bind(user.id)
    .first();

  if (!row) return fail("User not found", 404);
  return ok({ user: row });
});

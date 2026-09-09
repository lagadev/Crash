import { Hono } from "hono";
import type { Env } from "../env";
import { authenticate } from "./auth";
import { ok, fail } from "../utils/response";

export const tasksApi = new Hono<{ Bindings: Env }>();

tasksApi.get("/", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);

  const tasks = await c.env.DB.prepare(
    `SELECT id, name, logo_url, link, reward FROM tasks WHERE active = 1 ORDER BY sort_order ASC, id DESC`
  ).all();
  const mine = await c.env.DB.prepare(`SELECT task_id, status FROM user_tasks WHERE user_id = ?`)
    .bind(user.id)
    .all<{ task_id: number; status: string }>();

  const statusByTask = new Map((mine.results ?? []).map((r) => [r.task_id, r.status]));
  const merged = (tasks.results ?? []).map((t: any) => ({
    ...t,
    status: statusByTask.get(t.id) || "new", // new | started | claimed
  }));

  return ok({ tasks: merged });
});

tasksApi.post("/:id/start", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);
  const id = Number(c.req.param("id"));

  const task = await c.env.DB.prepare(`SELECT id FROM tasks WHERE id = ? AND active = 1`).bind(id).first();
  if (!task) return fail("Task not found", 404);

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO user_tasks (user_id, task_id, status) VALUES (?, ?, 'started')`
  )
    .bind(user.id, id)
    .run();

  return ok({ status: "started" });
});

tasksApi.post("/:id/claim", async (c) => {
  const user = await authenticate(c);
  if (!user) return fail("Unauthorized", 401);
  const id = Number(c.req.param("id"));

  const task = await c.env.DB.prepare(`SELECT id, reward FROM tasks WHERE id = ? AND active = 1`)
    .bind(id)
    .first<{ id: number; reward: number }>();
  if (!task) return fail("Task not found", 404);

  const existing = await c.env.DB.prepare(`SELECT status FROM user_tasks WHERE user_id = ? AND task_id = ?`)
    .bind(user.id, id)
    .first<{ status: string }>();
  if (!existing) return fail("Start the task first", 400);
  if (existing.status === "claimed") return fail("Already claimed", 400);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE user_tasks SET status = 'claimed', claimed_at = strftime('%s','now') WHERE user_id = ? AND task_id = ?`).bind(
      user.id,
      id
    ),
    c.env.DB.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`).bind(task.reward, user.id),
    c.env.DB.prepare(`INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'task', ?, ?)`).bind(
      user.id,
      task.reward,
      JSON.stringify({ taskId: id })
    ),
  ]);

  return ok({ status: "claimed", reward: task.reward });
});

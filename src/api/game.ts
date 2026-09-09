import { Hono } from "hono";
import type { Env } from "../env";
import { authenticate } from "./auth";
import { fail } from "../utils/response";

export const gameApi = new Hono<{ Bindings: Env }>();

function roomStub(env: Env) {
  const id = env.CRASH_ROOM.idFromName("global-crash-room");
  return env.CRASH_ROOM.get(id);
}

gameApi.get("/state", async (c) => {
  const stub = roomStub(c.env);
  const res = await stub.fetch("https://crash-room/state");
  return new Response(res.body, res);
});

/**
 * WebSocket upgrade endpoint. Auth is done here (initData passed as a query
 * param, since browsers can't set custom headers on a WebSocket handshake),
 * then the verified identity is forwarded to the Durable Object via headers.
 */
gameApi.get("/ws", async (c) => {
  const initData = c.req.query("initData");
  if (!initData) return fail("Missing initData", 401);

  const fakeReq = new Request(c.req.url, { headers: { "X-Telegram-Init-Data": initData } });
  const ctxLike = { req: { header: (k: string) => fakeReq.headers.get(k), raw: fakeReq }, env: c.env } as any;
  const user = await authenticate(ctxLike);
  if (!user) return fail("Unauthorized", 401);

  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") return fail("Expected websocket", 426);

  const stub = roomStub(c.env);
  const doReq = new Request("https://crash-room/ws", {
    headers: {
      Upgrade: "websocket",
      "X-User-Id": String(user.id),
      "X-Username": user.username || user.first_name || "player",
      "X-Photo-Url": user.photo_url || "",
    },
  });
  return stub.fetch(doReq);
});

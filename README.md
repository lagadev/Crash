# 🚀 Crash Game — Telegram Mini App (single Cloudflare Worker deploy)

A real-time multiplayer Crash game for Telegram: a Mini App front-end, a
Durable-Object-powered game room broadcasting over WebSockets, D1 for
persistence, Telegram **Stars** deposits, star withdrawals, and a 3-level
referral program — all deployed as **one Cloudflare Worker**.

## What's inside

```
crash-game/
├── src/                  Worker (TypeScript, Hono)
│   ├── index.ts          entry point, routes, cron handler
│   ├── api/              auth.ts, game.ts, wallet.ts, users.ts, bot.ts
│   ├── game/             CrashRoom.ts (Durable Object), engine.ts, multiplier.ts, types.ts
│   └── utils/            telegram.ts, response.ts, validation.ts
├── public/               Mini App front-end, served by the Worker's ASSETS binding
│   ├── index.html
│   ├── styles/main.css
│   ├── src/app.js, src/services/api.js, src/services/socket.js
│   └── assets/           drop flying.gif / crashed.gif here (optional, has fallback)
├── migrations/0001_initial.sql
└── wrangler.toml
```

> **Note on the front-end stack:** the brief sketched a Vue + Vite front-end.
> To keep this a genuinely **single-command deploy** with zero build step,
> the UI here is plain HTML/CSS/JS served straight from `public/` via
> Workers Static Assets — same pages/components/services structure in
> spirit, no bundler required. If you'd rather have the Vue/Vite version,
> it's a drop-in swap: point `[assets] directory` in `wrangler.toml` at
> `frontend/dist` and add a `vite build` step.

> **Note on game art:** the flying rocket / crash explosion are emoji-based
> CSS animations by default (🚀 / 💥) so the game works immediately with no
> extra assets. Drop your own `flying.gif` and `crashed.gif` into
> `public/assets/` and the app will use them automatically instead.

## How it works

1. **Home screen** — single-row "🎮 Play Crash Game" button, a "👤 Profile"
   / "💰 Withdraw" row, and a "⭐️ Refer Program" button, per the spec.
2. **Crash game** — every round: 5s betting countdown → rocket climbs while
   the multiplier rises → crash. Bets, cash-outs, the multiplier and the
   live "who bet what" list are all pushed in real time over one shared
   WebSocket room (`CrashRoom` Durable Object), so every player in the Mini
   App sees the same round at the same time.
3. **Wallet** — deposits are Telegram **Stars** invoices (currency `XTR`)
   opened with `Telegram.WebApp.openInvoice`; the bot webhook credits the
   balance on `successful_payment`. Withdrawals require a **minimum of 50 ⭐**
   and are queued in `withdraw_requests` for manual/admin payout.
4. **Referral program** — a friend's *first deposit* instantly credits you
   10%. After that, 0.5% / 0.2% / 0.1% of their (and their sub-referrals')
   wager turnover accrues into `referral_pending`; a Cron Trigger runs every
   30 minutes and moves anything ≥ 0.01 ⭐ into spendable balance.
5. **Provably fair** — each round's crash point is derived from a random
   server seed hashed with the round id; the hash is published to clients
   before the round starts (`serverHash`) so results can be verified after
   the seed would be revealed.

## Setup

### 1. Create the bot & the Mini App
1. Create a bot with **@BotFather**, grab the token.
2. `/setmenubutton` or `/newapp` to attach a Mini App to your bot, pointing
   at your Worker's URL (you'll get this after the first deploy).
3. Make sure **Payments → Stars** is enabled for the bot (it is by default;
   `createInvoiceLink` with `currency: "XTR"` just works).

### 2. Install & configure

```bash
npm install
npx wrangler login

# Create the D1 database, then paste the returned database_id into wrangler.toml
npx wrangler d1 create crash_game_db

# Apply the schema
npm run db:migrate:remote

# Secrets
npx wrangler secret put BOT_TOKEN     # token from @BotFather
npx wrangler secret put ADMIN_KEY     # any strong random string, for future admin routes
```

Edit `wrangler.toml`:
- `database_id` → the id printed by `wrangler d1 create`
- `BOT_USERNAME` → your bot's @username (used to build referral links)
- `MIN_WITHDRAW_STARS` / `HOUSE_EDGE` → tweak if you like

### 3. Deploy (single command)

```bash
npm run deploy
```

That's it — the same Worker serves the REST API, the WebSocket game room,
and the Mini App's static files.

### 4. Point the bot at your Worker

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/telegram/webhook"
```

Then open your bot in Telegram, tap **/start**, and launch the Mini App.

## Local development

```bash
npm run dev
```

`wrangler dev` serves the Worker (API + WebSocket + static UI) on
`localhost:8787`. Telegram's `initData` verification will fail outside a
real Telegram client/WebView, so for local UI iteration you'll mostly be
testing the game loop with the WebSocket console; do full auth testing via
Telegram's Mini App preview.

## Database schema

See `migrations/0001_initial.sql` — `users`, `referral_links` (level 1-3
ancestor lookup for O(1) turnover crediting), `rounds`, `bets`,
`transactions`, `withdraw_requests`, `deposits`.

## Extending

- **Admin panel**: add routes under `/api/admin/*` gated by the `ADMIN_KEY`
  secret to approve/reject `withdraw_requests` and adjust balances.
- **Multiple rooms / stakes tiers**: `CrashRoom` is already looked up by
  name (`idFromName("global-crash-room")`) — spin up more named rooms for
  e.g. high-stakes tables.
- **Vue front-end**: swap `public/` for a Vite build output as noted above
  if you want the componentized Vue structure from the original brief.

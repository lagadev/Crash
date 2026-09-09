# 🚀 Crash Game — Telegram Mini App + Admin Panel (single Cloudflare Worker)

A real-time multiplayer Crash game for Telegram: a tabbed Mini App (Crash /
Task / Refer / Wallet / Profile), a Durable-Object game room, D1 storage,
Telegram **Stars** deposits & withdrawals, a 3-level referral program with a
Top-50 leaderboard, an earn-task system, and a full **Admin Panel** — all in
one Cloudflare Worker.

## What's new in this rebuild

- **New tabbed layout**: bottom nav with **Crash · Task · Refer · Wallet ·
  Profile**, replacing the old single home-menu screen.
- **Fixed: history disappearing.** The last-10 crash history is now read
  straight from the `rounds` table in D1 on every new round, instead of
  living only in the Durable Object's memory — so it survives DO
  eviction/restarts and is always populated.
- **Fixed: 5-second countdown not visibly counting.** The room now
  broadcasts the countdown on every tick while betting is open (previously
  it only broadcast once at the very start of the round, so the number
  never updated).
- **"Connecting to server…" state** on the Crash tab while the WebSocket is
  establishing, so the UI never looks frozen before the live round loads.
- **Premium card redesign**: gradient glass cards, soft shadows, and color
  grading across the multiplier chips, live bet list, stat cards, etc.
- **Minimum bet is now 1 star** (was 50). Minimum withdrawal stays **50 stars**.
- **Task tab**: task name, logo, reward and a Start -> Claim flow.
- **Refer tab**: a promo card in the style of the reference screenshot
  ("Invite friends and earn **10%** from their deposits!") plus your real
  turnover-based earnings, and a **Top 50 leaderboard** ranked by referral
  earnings.
- **Wallet tab**: balance, deposit, withdraw, plus withdrawal-request status
  and a recent-transactions list.
- **Profile tab**: full ID details (Telegram ID, username, first name, join
  date) plus lifetime stats.
- **Admin Panel** at **`/admin/`** — see below.

## Admin Panel (`/admin/`)

A single static page (no separate deploy) gated by an **admin key** you set
as a secret. Enter the key once in the browser; it's stored in
`localStorage` and sent as `X-Admin-Key` on every admin API call, which the
Worker checks against the `ADMIN_KEY` secret.

- **Dashboard** - total users, total wagered/deposited/withdrawn, pending
  withdrawals, last round summary.
- **Users** - search by ID / username / name, view a user's stats, **adjust
  balance** (add/subtract or set an exact value), **ban / unban**.
- **Withdrawals** - filter by status, **approve** (marks paid, notifies the
  user) or **reject** (auto-refunds the user's balance, notifies them).
- **Tasks** - add / edit / delete tasks: name, logo URL, link, reward,
  active toggle.
- **Game Management** - recent rounds (crash point, bets, wagered, payout),
  and a **force-next-crash** control: type e.g. `1.28` and the *next* round
  will crash at exactly that multiplier (clears itself after one use).
- **Bot & Broadcast**:
  - Edit the `/start` message: image URL, text, and a button builder
    (text + URL + style: primary / success / danger).
  - Send a broadcast to every non-banned user with the same image/text/
    button builder, and see a sent/failed count afterward.

  > **On button "style":** Telegram's Bot API doesn't currently expose a
  > native colored/styled inline button - there's no `style` field it
  > accepts. So the admin panel still lets you pick **primary / success /
  > danger** per button (matching the `{"text":"Confirm","style":"success"}`
  > shape you specified), and the Worker degrades that into a small visual
  > prefix (checkmark / stop / play) on the button label today. If a future
  > Bot API / Telegram client version adds real colored buttons, this is
  > the one place (`styledButton()` in `src/api/admin.ts`, and the matching
  > code in `src/api/bot.ts`) you'd update to send the native style
  > property instead - the admin UI and stored JSON shape don't need to
  > change.

**Security note:** the `/admin/` page itself is reachable by anyone who
knows the URL (it's a static file), but every admin API call is rejected
without the correct `ADMIN_KEY`. For extra protection, put Cloudflare
Access (or similar) in front of `/admin/*`.

## Project structure

```
crash-game/
|-- src/                     Worker (TypeScript, Hono)
|   |-- index.ts             entry point, routes, cron handler
|   |-- api/                 auth.ts, game.ts, wallet.ts, users.ts, tasks.ts, admin.ts, bot.ts
|   |-- game/                CrashRoom.ts (Durable Object), engine.ts, multiplier.ts, types.ts
|   `-- utils/               telegram.ts, response.ts, validation.ts
|-- public/                  Mini App + Admin Panel, served by the Worker's ASSETS binding
|   |-- index.html, styles/main.css, src/app.js, src/services/*, src/icons.js
|   |-- admin/               index.html, admin.css, admin.js
|   `-- assets/              drop flying.gif / crashed.gif here (optional, has fallback)
|-- migrations/              0001_initial.sql, 0002_admin_tasks.sql
`-- wrangler.toml
```

## Setup

### 1. Bot & Mini App
1. Create a bot with **@BotFather**, grab the token.
2. Attach a Mini App pointing at your Worker's URL.
3. Stars payments are enabled by default (`currency: "XTR"` just works).

### 2. Install & configure

```bash
npm install
npx wrangler login

npx wrangler d1 create crash_game_db   # paste the id into wrangler.toml
npm run db:migrate:remote              # applies both migration files

npx wrangler secret put BOT_TOKEN      # token from @BotFather
npx wrangler secret put ADMIN_KEY      # any strong random string - this is your admin panel password
```

Edit `wrangler.toml`: `database_id`, `BOT_USERNAME`, and optionally
`HOUSE_EDGE` / `MIN_WITHDRAW_STARS`.

### 3. Deploy

```bash
npm run deploy
```

One Worker serves the REST API, the WebSocket game room, the Mini App, and
the Admin Panel.

### 4. Point the bot at your Worker

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/telegram/webhook"
```

Then open the bot, tap **/start**, launch the Mini App - and open
`https://<your-worker>.workers.dev/admin/` to sign in with your `ADMIN_KEY`.

### 5. Seed some tasks (optional)

Use the Admin Panel's **Tasks** tab, or call the API directly:

```bash
curl -X POST https://<your-worker>.workers.dev/api/admin/tasks \
  -H "X-Admin-Key: <your admin key>" -H "Content-Type: application/json" \
  -d '{"name":"Join our channel","link":"https://t.me/yourchannel","reward":10}'
```

## Local development

```bash
npm run dev
```

Telegram's `initData` verification needs a real Telegram WebView, so do
full auth testing via Telegram's Mini App preview; the Admin Panel
(`/admin/`) works fully locally against `wrangler dev` since it only needs
your `ADMIN_KEY`.

## Notes on game art

The rocket / crash visuals fall back to a built-in animated emoji (rocket /
explosion). Drop `flying.gif` / `crashed.gif` into `public/assets/` to use
your own - no code changes needed.

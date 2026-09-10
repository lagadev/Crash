# Crash Game — Telegram Mini App + Admin Panel (single Cloudflare Worker)

A real-time multiplayer Crash game for Telegram: a tabbed Mini App (Crash /
Task / Refer / Wallet / Profile), a Durable-Object game room, D1 storage,
Telegram Stars **and** TON/GRAM wallet deposits, a 3-level referral program
with a Top-50 leaderboard, an earn-task system, and a full Admin Panel — all
in one Cloudflare Worker.

## What changed in this pass

**A real bug, found and fixed:** every icon across the whole app (bottom tab
bar, admin sidebar, buttons) was rendering blank. The cause: `icons.js`
declared `const ICONS = {...}`, and the bootstrap script that filled
`[data-icon]` elements read `window.ICONS` — but a top-level `const` in a
classic `<script>` never becomes a `window` property (only `var`/function
declarations do). So `window.ICONS` was always `undefined` and every icon
silently rendered empty. Fixed by explicitly exporting
`window.ICONS = ICONS` at the end of `icons.js`. This alone accounts for a
lot of the "unfinished" look from before.

Everything else requested:

- **Real Telegram profile photos** now render in the live bet list (and the
  Profile tab), falling back to a gradient-initial avatar if a user has no
  photo or it fails to load.
- **Live growing winnings** replace the old prize-emoji column: while a bet
  is in play, its row shows `amount × current multiplier` ticking up in
  real time, right up until cashout or crash.
- **A real-feeling Stars icon**: I don't have access to Telegram's actual
  Star PNG asset, so I built a crafted gold-gradient vector star used
  everywhere a balance is shown. The code tries `/assets/star.png` first
  (same drop-in pattern as `flying.gif`/`crashed.gif` below) and only falls
  back to the vector icon if that file is missing — so dropping in the real
  asset later needs zero code changes.
- **Two deposit methods**: the existing Telegram Stars flow, plus a new
  **TON / GRAM** tab with real TonConnect wallet integration (see below).
- **45-degree launch angle**: the rocket now animates along a diagonal
  (ascend, not straight up), matching the reference screenshots.
- **Fixed the gif "Copy Link" leak**: the flying/crashed visuals are no
  longer `<img>` tags — they're `background-image` divs with
  `pointer-events: none` and `-webkit-touch-callout: none`, so long-pressing
  them in Telegram's in-app browser can no longer surface a raw file-link
  context menu. Falls back to a small built-in emoji animation if the gif
  files are missing.
- **"About the game" removed**, per your request.
- **General visual pass**: layered glow/shadow on the stage, star-field
  backdrop, richer bet-row treatment (flash tint on win/loss), consistent
  icons now that the bug above is fixed, deposit tabs, etc. "As beautiful as
  I can make it" is inherently subjective — tell me specifically what still
  looks off and I'll keep iterating.
- **Admin Panel → Settings**: joining bonus, first-deposit bonus %, TON
  wallet address + rate, and the "gamer logic" tuning knobs, all in one
  place.
- **"Gamer logic"**: crash-point is now finalized the instant betting closes
  (not before), and is biased by that round's actual bets — see below.

## "Gamer logic" — how the crash point is actually decided

Previously the crash point was drawn once, before betting even opened
(needed for a pure "commit the hash up front" provably-fair scheme). That
can't react to how a round's bets end up looking, so it's been restructured:

1. At round start, a provably-fair base value is still drawn from a random
   seed (kept for internal auditing / your own records).
2. The instant the 5-second betting window closes, `resolveCrashPoint()`
   looks at that round's actual bets and applies your **Settings → Game
   Tuning** values:
   - any single bet **≥ Big Bet Threshold** → crash fast, randomly between
     1.00x and **Big Bet Max Crash**.
   - otherwise, **≥ Multiplayer Threshold** players in the round → crash is
     boosted to at least around **Multiplayer Min Crash** (with some random
     variance so it's not a flat, predictable floor).
   - otherwise → the plain provably-fair base value is used as-is.
3. An admin's manual "force next crash" override (Game tab) always wins
   over all of the above.

**Worth knowing:** this makes the game's outcome deliberately
house-managed rather than statistically pure/independently verifiable —
that's inherent to what was asked for ("more players → longer round, one
big bet → fast crash"), and it's why the old provably-fair "About the game"
verification messaging was dropped along with that page. If you operate in
a jurisdiction with gambling regulation, get local legal advice before
running this for real money — manipulated-odds games can carry different
obligations than pure-RNG ones.

## TON / GRAM wallet deposits — how it works, and its real limits

TonConnect's `sendTransaction()` only returns a signed BOC, not a ready
transaction hash, and building a valid on-chain **comment** cell needs the
full TON SDK (too heavy to pull in here). So instead of matching by
comment, each deposit gets a **unique payment amount**:

1. Frontend calls `/api/ton/create-intent` with a Stars amount.
2. The Worker computes the TON equivalent, adds a few thousand nanoTON of
   random "dust" so the exact amount is unique, stores that as a pending
   intent, and returns it.
3. The Mini App sends *exactly* that amount via the connected wallet
   (TonConnect UI, loaded from `unpkg.com/@tonconnect/ui`).
4. The Mini App polls `/api/ton/verify-intent`, which asks the TonCenter
   API for the house wallet's recent transactions and looks for one whose
   value matches exactly. When found, it's credited once (the on-chain tx
   hash is stored as a UNIQUE key so replay/double-verification can't
   double-credit).

**Please treat this as an MVP, not a production-hardened payment rail**:
- It depends on the free TonCenter API's rate limits and indexing lag; set
  `TON_API_KEY` (a Worker secret) if you have one, for higher limits.
- "Unique amount" matching can collide in pathological cases (e.g. someone
  else also happens to send the exact same nanoTON amount independently) —
  extremely unlikely, but not mathematically impossible.
- There's no reorg handling. For real money at scale, put a dedicated
  indexer/webhook (or a paid TonCenter/tonapi.io plan) in front of this.
- Test with small amounts (or TON testnet) before trusting it with real
  funds, and update `public/tonconnect-manifest.json`'s URLs to your real
  deployed domain before going live — wallets validate that manifest.

Configure the house wallet address and the Star-to-TON rate from
**Admin Panel → Settings**.

## On "protecting the source code so no one can view it"

Being fully transparent here rather than overpromising: **any JavaScript
that runs in a user's browser can always be read** — via browser devtools,
"view source", or just fetching the file directly. No amount of minifying
or obfuscating changes that; it's a property of how browsers work, not a
limitation of this project specifically.

What I *did* do:
- `npm run minify` bundles+minifies `public/src/*.js` and
  `public/admin/admin.js` into `*.min.js` siblings (via esbuild), which
  raises the bar for casual copy-pasting. Swap the `<script src="...">` tags
  to the `.min.js` versions if you want this in production. It's optional
  and off by default so nothing breaks if you forget to run it.
- Far more importantly: **every actual secret already lives only in the
  Worker**, which the browser never receives — `BOT_TOKEN`, `ADMIN_KEY`,
  the crash-point algorithm (`applyGameTuning`, `deriveCrashPoint`), D1
  access, and all game-economy math. A user reading the client JS can see
  *how the UI works*, but can't see or influence how a round actually
  resolves, because that never leaves the server. That server-side
  boundary — not obfuscation — is what actually protects the game.

## Project structure

```
crash-game/
|-- src/                     Worker (TypeScript, Hono)
|   |-- index.ts             entry point, routes, cron handler
|   |-- api/                 auth.ts, game.ts, wallet.ts, users.ts, tasks.ts,
|   |                        ton.ts, deposits.ts, admin.ts, bot.ts
|   |-- game/                CrashRoom.ts (Durable Object), engine.ts, multiplier.ts, types.ts
|   `-- utils/               telegram.ts, response.ts, validation.ts
|-- public/                  Mini App + Admin Panel, served by the Worker's ASSETS binding
|   |-- index.html, styles/main.css, src/app.js, src/services/*, src/icons.js
|   |-- admin/               index.html, admin.css, admin.js
|   |-- tonconnect-manifest.json
|   `-- assets/              drop flying.gif / crashed.gif / star.png here (optional, has fallback)
|-- migrations/              0001_initial.sql, 0002_admin_tasks.sql, 0003_economy_ton.sql
|-- scripts/minify-frontend.js
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
npm run db:migrate:remote              # applies all three migration files

npx wrangler secret put BOT_TOKEN      # token from @BotFather
npx wrangler secret put ADMIN_KEY      # any strong random string - your admin panel password
npx wrangler secret put TON_API_KEY    # optional - higher TonCenter rate limits
```

Edit `wrangler.toml`: `database_id`, `BOT_USERNAME`, and optionally
`HOUSE_EDGE` / `MIN_WITHDRAW_STARS`. Edit `public/tonconnect-manifest.json`
to your real deployed URL before enabling TON deposits.

### 3. Deploy

```bash
npm run deploy
```

### 4. Point the bot at your Worker

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/telegram/webhook"
```

Then open the bot, tap **/start**, launch the Mini App — and open
`https://<your-worker>.workers.dev/admin/` to sign in with your `ADMIN_KEY`
and set your joining bonus, first-deposit bonus, TON wallet address, and
game tuning from **Settings**.

## Local development

```bash
npm run dev
```

Telegram's `initData` verification needs a real Telegram WebView, so do
full auth testing via Telegram's Mini App preview; the Admin Panel works
fully locally against `wrangler dev` since it only needs your `ADMIN_KEY`.

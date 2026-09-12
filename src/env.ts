export interface Env {
  DB: D1Database;
  CRASH_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;

  BOT_TOKEN: string;
  ADMIN_KEY: string;
  BOT_USERNAME: string;
  APP_SHORT_NAME?: string;
  MIN_WITHDRAW_STARS: string;
  HOUSE_EDGE: string;
  TON_API_KEY?: string;
}

// Telegram WebApp initData verification + thin Bot API client.
// Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

/**
 * Verifies the `initData` string sent by the Telegram Mini App and returns
 * the parsed user, or null if the signature is invalid / expired.
 */
export async function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): Promise<TelegramUser | null> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const dataCheckArr: string[] = [];
    // Sort keys alphabetically, per Telegram spec
    const keys = [...params.keys()].sort();
    for (const key of keys) dataCheckArr.push(`${key}=${params.get(key)}`);
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
    const computedHash = toHex(await hmacSha256(secretKey, dataCheckString));

    if (computedHash !== hash) return null;

    const authDate = Number(params.get("auth_date") || 0);
    if (maxAgeSeconds > 0 && Date.now() / 1000 - authDate > maxAgeSeconds) return null;

    const userJson = params.get("user");
    if (!userJson) return null;
    return JSON.parse(userJson) as TelegramUser;
  } catch {
    return null;
  }
}

export class TelegramBotApi {
  constructor(private token: string) {}

  private async call<T = any>(method: string, body?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json: any = await res.json();
    if (!json.ok) throw new Error(`Telegram API ${method} failed: ${JSON.stringify(json)}`);
    return json.result as T;
  }

  sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
    return this.call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
  }

  /** Creates a Telegram Stars invoice link (currency XTR) for depositing into the game wallet. */
  createStarsInvoiceLink(title: string, description: string, payload: string, stars: number) {
    return this.call<string>("createInvoiceLink", {
      title,
      description,
      payload,
      currency: "XTR",
      prices: [{ label: title, amount: stars }],
    });
  }

  answerPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string) {
    return this.call("answerPreCheckoutQuery", {
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage,
    });
  }

  setWebhook(url: string, secretToken?: string) {
    return this.call("setWebhook", { url, secret_token: secretToken });
  }
}

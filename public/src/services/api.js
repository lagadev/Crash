// Thin REST client for the Crash Game Worker API.
const API = (() => {
  function initData() {
    return window.Telegram?.WebApp?.initData || "";
  }

  async function request(path, opts = {}) {
    const res = await fetch(`/api${path}`, {
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData(),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  return {
    me: () => request("/users/me"),
    balance: () => request("/wallet/balance"),
    deposit: (stars) => request("/wallet/deposit", { method: "POST", body: { stars } }),
    withdraw: (amount) => request("/wallet/withdraw", { method: "POST", body: { amount } }),
    referral: () => request("/wallet/referral"),
    leaderboard: () => request("/wallet/leaderboard"),
    walletHistory: () => request("/wallet/history"),
    gameState: () => request("/game/state"),
    tasks: () => request("/tasks"),
    startTask: (id) => request(`/tasks/${id}/start`, { method: "POST" }),
    claimTask: (id) => request(`/tasks/${id}/claim`, { method: "POST" }),
    tonConfig: () => request("/ton/config"),
    tonCreateIntent: (stars) => request("/ton/create-intent", { method: "POST", body: { stars } }),
    tonVerifyIntent: () => request("/ton/verify-intent", { method: "POST" }),
    wsUrl: () => {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${location.host}/api/game/ws?initData=${encodeURIComponent(initData())}`;
    },
  };
})();

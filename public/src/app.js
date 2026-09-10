// ============================================================
// Crash Game Mini App - main application logic
// ============================================================

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor?.("#0a0c14");
tg?.setBackgroundColor?.("#0a0c14");

const state = {
  balance: 0,
  me: null,
  round: null,
  myBetPlaced: false,
  betSheetAmount: 0,
  autoCashoutOn: false,
  autoCashoutValue: 2.0,
  depositAmount: 100,
  tonAmount: 100,
  tonRate: 200,
  tonWalletAddress: "",
  socketStarted: false,
  serverConnected: false,
  referralLink: null,
};

// ---------------- Tab navigation ----------------
function showTab(id) {
  document.querySelectorAll(".tab-screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tab-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
  document.getElementById("crash-bottom-bar").style.display = id === "tab-crash" ? "block" : "none";

  if (id === "tab-crash" && !state.socketStarted) {
    state.socketStarted = true;
    setupStageVisuals();
    startGame();
  }
  if (id === "tab-task") loadTasks();
  if (id === "tab-refer") loadReferral();
  if (id === "tab-wallet") loadWallet();
  if (id === "tab-profile") loadProfile();
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------------- Boot ----------------
async function boot() {
  try {
    const { user } = await API.me();
    state.me = user;
    state.balance = user.balance;
    refreshBalanceUI();
    showTab("tab-crash");
  } catch (e) {
    console.error("auth failed", e);
    toast("Could not connect to server");
  }
}
boot();

function refreshBalanceUI() {
  ["crash-balance", "task-balance", "refer-balance", "wallet-balance"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = state.balance;
  });
  const sheetBal = document.getElementById("sheet-balance");
  if (sheetBal) sheetBal.textContent = state.balance;
}

function avatarHtml(photoUrl, name, gradient) {
  if (photoUrl) {
    return `<div class="avatar"><img src="${escapeAttr(photoUrl)}" alt="" draggable="false" oncontextmenu="return false" onerror="this.parentNode.style.background='linear-gradient(135deg,${gradient})';this.parentNode.textContent='${(name || "?")[0].toUpperCase()}'"/></div>`;
  }
  return `<div class="avatar" style="background:linear-gradient(135deg,${gradient})">${(name || "?")[0].toUpperCase()}</div>`;
}

// ---------------- Profile ----------------
async function loadProfile() {
  try {
    const { user } = await API.me();
    state.me = user;
    state.balance = user.balance;
    refreshBalanceUI();

    const avatarEl = document.getElementById("profile-avatar");
    if (user.photo_url) {
      avatarEl.style.background = "none";
      avatarEl.innerHTML = `<img src="${escapeAttr(user.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:999px" draggable="false" oncontextmenu="return false" onerror="this.parentNode.style.background='var(--accent-grad)';this.parentNode.textContent='${(user.first_name || "?")[0].toUpperCase()}'"/>`;
    } else {
      avatarEl.textContent = (user.first_name || "?")[0].toUpperCase();
    }

    document.getElementById("profile-name").textContent = user.first_name || "Player";
    document.getElementById("profile-username").textContent = user.username ? "@" + user.username : `ID ${user.id}`;
    document.getElementById("stat-balance").textContent = user.balance;
    document.getElementById("stat-wagered").textContent = user.total_wagered;
    document.getElementById("stat-won").textContent = user.total_won;
    document.getElementById("profile-id").textContent = user.id;
    document.getElementById("profile-uname").textContent = user.username ? "@" + user.username : "—";
    document.getElementById("profile-fname").textContent = user.first_name || "—";
    document.getElementById("profile-since").textContent = new Date(user.created_at * 1000).toLocaleDateString();
    document.getElementById("profile-deposited").innerHTML = `${user.total_deposited} ${starTag()}`;
    document.getElementById("profile-withdrawn").innerHTML = `${user.total_withdrawn} ${starTag()}`;
    document.getElementById("profile-ref-earned").innerHTML = `${user.referral_earned} ${starTag()}`;
    document.getElementById("profile-invited").textContent = user.invited_count;
  } catch (e) {
    toast("Failed to load profile");
  }
}

// ---------------- Wallet ----------------
async function loadWallet() {
  refreshBalanceUI();
  try {
    const { transactions, withdrawals } = await API.walletHistory();
    renderTxHistory(transactions);
    renderWithdrawHistory(withdrawals);
  } catch (e) {
    toast("Failed to load wallet history");
  }
}

function renderTxHistory(list) {
  const el = document.getElementById("tx-history");
  if (!list.length) return (el.innerHTML = '<div class="no-bets">No transactions yet</div>');
  el.innerHTML = list
    .map((t) => {
      const pos = t.amount >= 0;
      const when = new Date(t.created_at * 1000).toLocaleString();
      return `<div class="tx-row">
        <div><div class="type">${t.type.replace(/_/g, " ")}</div><div class="meta">${when}</div></div>
        <div class="amt ${pos ? "pos" : "neg"}">${pos ? "+" : ""}${t.amount} ${starTag()}</div>
      </div>`;
    })
    .join("");
}

function renderWithdrawHistory(list) {
  const el = document.getElementById("withdraw-history");
  if (!list.length) return (el.innerHTML = '<div class="no-bets">No requests yet</div>');
  el.innerHTML = list
    .map((w) => {
      const when = new Date(w.created_at * 1000).toLocaleString();
      return `<div class="tx-row">
        <div><div class="type">Withdraw #${w.id}</div><div class="meta">${when}</div></div>
        <div style="text-align:right">
          <div class="amt neg">-${w.amount} ${starTag()}</div>
          <span class="withdraw-status ${w.status}">${w.status}</span>
        </div>
      </div>`;
    })
    .join("");
}

async function submitWithdraw() {
  const amount = Number(document.getElementById("withdraw-amount").value);
  if (!amount || amount < 50) return toast("Minimum withdrawal is 50 stars");
  try {
    await API.withdraw(amount);
    state.balance -= amount;
    refreshBalanceUI();
    document.getElementById("withdraw-amount").value = "";
    toast("Withdrawal request submitted");
    loadWallet();
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- Referral ----------------
async function loadReferral() {
  try {
    const r = await API.referral();
    document.getElementById("ref-invited").textContent = r.invited;
    document.getElementById("ref-earned").textContent = r.earned;
    document.getElementById("ref-pending").textContent = r.pending.toFixed ? r.pending.toFixed(2) : r.pending;
    state.referralLink = r.link;
  } catch (e) {
    toast("Failed to load referral info");
  }
  try {
    const { leaderboard } = await API.leaderboard();
    renderLeaderboard(leaderboard);
  } catch (e) {
    /* non-fatal */
  }
}

function renderLeaderboard(rows) {
  const el = document.getElementById("leaderboard-list");
  if (!rows.length) return (el.innerHTML = '<div class="no-bets">No referrals yet — be the first!</div>');
  el.innerHTML = rows
    .map((r, i) => {
      const name = r.username ? "@" + r.username : r.first_name || `User ${r.id}`;
      return `<div class="leader-row">
        <div class="leader-rank">${i + 1}</div>
        <div class="who">${escapeHtml(name)}</div>
        <div class="stat"><b>${r.referral_earned} ${starTag()}</b>${r.invited_count} invited</div>
      </div>`;
    })
    .join("");
}

function copyReferralLink() {
  if (!state.referralLink) return toast("Loading your link…");
  navigator.clipboard?.writeText(state.referralLink);
  tg?.HapticFeedback?.notificationOccurred?.("success");
  toast("Referral link copied!");
}

function inviteFriends() {
  if (!state.referralLink) return toast("Loading your link…");
  const text = "Join me on Crash Game and grab your bonus!";
  const url = `https://t.me/share/url?url=${encodeURIComponent(state.referralLink)}&text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

// ---------------- Tasks ----------------
async function loadTasks() {
  try {
    const { tasks } = await API.tasks();
    renderTasks(tasks);
  } catch (e) {
    toast("Failed to load tasks");
  }
}

function renderTasks(tasks) {
  const el = document.getElementById("task-list");
  if (!tasks.length) return (el.innerHTML = '<div class="no-bets">No tasks right now — check back later</div>');
  el.innerHTML = tasks
    .map((t) => {
      const logo = t.logo_url
        ? `<img src="${escapeAttr(t.logo_url)}" alt="" onerror="this.style.display='none'"/>`
        : icon("task");
      let btn;
      if (t.status === "claimed") btn = `<button class="task-btn done" disabled>Done</button>`;
      else if (t.status === "started") btn = `<button class="task-btn claim" onclick="claimTask(${t.id})">Claim</button>`;
      else btn = `<button class="task-btn start" onclick="startTask(${t.id}, '${escapeAttr(t.link)}')">Start</button>`;
      return `<div class="task-row">
        <div class="task-logo">${logo}</div>
        <div class="task-info"><div class="name">${escapeHtml(t.name)}</div><div class="reward">+${t.reward} ${starTag()}</div></div>
        ${btn}
      </div>`;
    })
    .join("");
}

async function startTask(id, link) {
  if (tg?.openLink) tg.openLink(link);
  else window.open(link, "_blank");
  try {
    await API.startTask(id);
    loadTasks();
  } catch (e) {
    toast(e.message);
  }
}

async function claimTask(id) {
  try {
    const res = await API.claimTask(id);
    state.balance += res.reward;
    refreshBalanceUI();
    toast(`+${res.reward} stars claimed!`);
    loadTasks();
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- Deposit sheet: Stars / TON tabs ----------------
function openDepositSheet() {
  document.getElementById("deposit-sheet-backdrop").classList.add("active");
}
function closeDepositSheet() {
  document.getElementById("deposit-sheet-backdrop").classList.remove("active");
}
function switchDepositTab(which) {
  document.getElementById("deposit-tab-stars").classList.toggle("active", which === "stars");
  document.getElementById("deposit-tab-ton").classList.toggle("active", which === "ton");
  document.getElementById("deposit-pane-stars").classList.toggle("active", which === "stars");
  document.getElementById("deposit-pane-ton").classList.toggle("active", which === "ton");
  if (which === "ton") initTonUi();
}
function setDepositAmount(v) {
  state.depositAmount = v;
  document.getElementById("deposit-amount-display").textContent = v;
}
async function confirmDeposit() {
  try {
    const { invoiceLink } = await API.deposit(state.depositAmount);
    closeDepositSheet();
    if (tg?.openInvoice) {
      tg.openInvoice(invoiceLink, async (status) => {
        if (status === "paid") {
          toast("Payment successful! Refreshing balance…");
          setTimeout(async () => {
            const { user } = await API.me();
            state.balance = user.balance;
            refreshBalanceUI();
          }, 1500);
        }
      });
    } else {
      window.open(invoiceLink, "_blank");
    }
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- TON / GRAM deposit ----------------
let tonUiReady = false;
async function initTonUi() {
  TonWallet.init();
  TonWallet.onChange((address) => {
    document.getElementById("ton-not-connected").style.display = address ? "none" : "block";
    document.getElementById("ton-connected").style.display = address ? "block" : "none";
    if (address) document.getElementById("ton-address-short").textContent = TonWallet.shortAddress();
  });
  if (!tonUiReady) {
    try {
      const cfg = await API.tonConfig();
      state.tonRate = cfg.starToTonRate;
      state.tonWalletAddress = cfg.walletAddress;
      tonUiReady = true;
    } catch (e) {
      /* deposits via TON not configured yet - button will surface the error on click */
    }
  }
  updateTonRateHint();
}
async function connectTonWallet() {
  try {
    await TonWallet.connect();
  } catch (e) {
    toast(e.message);
  }
}
async function disconnectTonWallet() {
  await TonWallet.disconnect();
}
function setTonAmount(v) {
  state.tonAmount = v;
  document.getElementById("ton-amount-display").textContent = v;
  updateTonRateHint();
}
function updateTonRateHint() {
  const el = document.getElementById("ton-rate-hint");
  if (!el) return;
  if (!state.tonRate) return (el.textContent = "Loading rate…");
  const ton = (state.tonAmount / state.tonRate).toFixed(4);
  el.textContent = `\u2248 ${ton} TON at the current rate`;
}
async function payWithTon() {
  if (!TonWallet.address) return toast("Connect your wallet first");
  try {
    const intent = await API.tonCreateIntent(state.tonAmount);
    toast("Confirm the payment in your wallet…");
    await TonWallet.sendExact(intent.walletAddress, intent.exactAmountNanoton);
    toast("Payment sent — confirming on-chain…");
    await pollTonVerify();
  } catch (e) {
    toast(e.message);
  }
}
async function pollTonVerify(attempt = 0) {
  try {
    const res = await API.tonVerifyIntent();
    state.balance += res.stars;
    refreshBalanceUI();
    toast(`+${res.stars} stars credited!`);
    closeDepositSheet();
  } catch (e) {
    if (attempt < 6) {
      setTimeout(() => pollTonVerify(attempt + 1), 5000);
    } else {
      toast("Still confirming on-chain — check your Wallet tab shortly");
    }
  }
}

// ================================================================
// CRASH GAME
// ================================================================

/** Preloads flying.gif / crashed.gif; falls back to a CSS emoji animation if missing. */
function setupStageVisuals() {
  const rocket = document.getElementById("rocket-visual");
  const crash = document.getElementById("crash-visual");

  const flyingImg = new Image();
  flyingImg.onload = () => {
    rocket.style.backgroundImage = `url('/assets/flying.gif')`;
  };
  flyingImg.onerror = () => {
    rocket.classList.add("emoji-fallback");
    rocket.innerHTML = `<span>\ud83d\ude80</span>`;
  };
  flyingImg.src = "/assets/flying.gif";

  const crashedImg = new Image();
  crashedImg.onload = () => {
    crash.style.backgroundImage = `url('/assets/crashed.gif')`;
  };
  crashedImg.onerror = () => {
    crash.classList.add("emoji-fallback");
    crash.textContent = "\ud83d\udca5";
  };
  crashedImg.src = "/assets/crashed.gif";
}

function startGame() {
  GameSocket.on("open", () => setConnected(true));
  GameSocket.on("close", () => setConnected(false));
  GameSocket.on("state", (payload) => { setConnected(true); renderRound(payload); });
  GameSocket.on("round_start", (payload) => renderRound(payload));
  GameSocket.on("countdown", ({ countdownSeconds }) => {
    if (state.round) state.round.phase = "waiting";
    const el = document.getElementById("countdown-num");
    if (el) el.textContent = countdownSeconds;
  });
  GameSocket.on("tick", ({ multiplier }) => updateLiveMultiplier(multiplier));
  GameSocket.on("crash", (payload) => renderCrash(payload));
  GameSocket.on("balance", (balance) => { state.balance = balance; refreshBalanceUI(); });
  GameSocket.on("cashed_out", ({ userId, multiplier }) => {
    if (state.me && userId === state.me.id) toast(`Cashed out at x${multiplier.toFixed(2)}!`);
  });
  GameSocket.on("error", (msg) => toast(msg));
  GameSocket.connect();
}

function setConnected(isConnected) {
  state.serverConnected = isConnected;
  const overlay = document.getElementById("connecting-overlay");
  overlay.classList.toggle("hidden", isConnected);
}

function setStage(mode) {
  document.getElementById("stage-waiting").style.display = mode === "waiting" ? "flex" : "none";
  document.getElementById("stage-flying").style.display = mode === "running" ? "block" : "none";
  document.getElementById("stage-crashed").style.display = mode === "crashed" ? "block" : "none";
}

function renderRound(payload) {
  state.round = payload;

  if (payload.phase === "waiting") {
    setStage("waiting");
    document.getElementById("countdown-num").textContent = payload.countdownSeconds;
    const mine = payload.bets.find((b) => state.me && b.userId === state.me.id);
    state.myBetPlaced = !!mine;
    updatePrimaryButton();
  } else if (payload.phase === "running") {
    setStage("running");
    updateLiveMultiplier(payload.multiplier);
    const mine = payload.bets.find((b) => state.me && b.userId === state.me.id);
    state.myBetPlaced = !!mine && mine.status === "placed";
    updatePrimaryButton();
  } else if (payload.phase === "crashed") {
    renderCrash(payload);
  }

  renderHistory(payload.history || []);
  renderBetList(payload.bets || []);
}

function updateLiveMultiplier(m) {
  const el = document.getElementById("live-multiplier");
  if (el) el.textContent = `${m.toFixed(2)}x`;
  updatePrimaryButton(m);
  growPendingBets(m);
}

/** Updates every still-in-play bet row's live winnings without a full re-render, for smooth 10x/sec growth. */
function growPendingBets(multiplier) {
  document.querySelectorAll(".grow-amt[data-pending]").forEach((el) => {
    const amount = Number(el.dataset.amount);
    const now = Math.floor(amount * multiplier);
    el.querySelector(".n").textContent = now;
  });
  document.querySelectorAll(".bet-row .mult.pending").forEach((el) => {
    el.textContent = `x${multiplier.toFixed(2)}`;
  });
}

function renderCrash(payload) {
  setStage("crashed");
  document.getElementById("crashed-multiplier").textContent = `${(payload.crashPoint ?? 1).toFixed(2)}x`;
  state.myBetPlaced = false;
  updatePrimaryButton();
  renderHistory(payload.history || []);
  renderBetList(payload.bets || []);
}

function renderHistory(history) {
  const row = document.getElementById("history-row");
  row.innerHTML = "";
  // Always keep (and show) the last 10 rounds - the server is now the source of truth for this.
  history.slice(0, 10).forEach((h, i) => {
    const chip = document.createElement("div");
    const cls = h < 2 ? "" : h < 5 ? "mid" : "high";
    chip.className = `chip ${cls} ${i === 0 ? "current" : ""}`;
    chip.textContent = `x${h.toFixed(2)}`;
    row.appendChild(chip);
  });
}

function renderBetList(bets) {
  const list = document.getElementById("bet-list");
  if (!bets.length) { list.innerHTML = '<div class="no-bets">No bets yet</div>'; return; }
  list.innerHTML = "";
  const colors = ["#ff7a59,#ff4f81", "#4facfe,#00f2fe", "#a8ff78,#78ffd6", "#f7971e,#ffd200"];
  bets.forEach((b, i) => {
    const row = document.createElement("div");
    const pending = b.status === "placed";
    row.className = `bet-row ${b.status === "won" ? "win-flash" : b.status === "lost" ? "lost-flash" : ""}`;
    const grad = colors[i % colors.length];
    const multClass = b.status === "won" ? "win" : b.status === "lost" ? "lost" : "pending";
    const multSymbol = b.status === "won" ? "\u2713" : b.status === "lost" ? "\u2717" : "";
    row.innerHTML = `
      ${avatarHtml(b.photoUrl, b.username, grad)}
      <div class="who"><div class="name">${escapeHtml(b.username)}</div><div class="amt">${starTag()} ${b.amount}</div></div>
      <div class="mult ${multClass}">${pending ? "" : `x${b.multiplier.toFixed(2)} ${multSymbol}`}</div>
      <div class="grow-col">
        <div class="grow-amt" ${pending ? `data-pending data-amount="${b.amount}"` : ""}>
          <span class="n">${b.winningsNow ?? b.amount}</span>${starTag()}
        </div>
      </div>`;
    list.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, "&#39;"); }

// ---------------- Primary bottom button ----------------
function updatePrimaryButton(liveMultiplier) {
  const btn = document.getElementById("place-bet-btn");
  const phase = state.round?.phase;

  if (phase === "running" && state.myBetPlaced) {
    const m = liveMultiplier ?? state.round?.multiplier ?? 1;
    btn.textContent = `Cash Out · x${m.toFixed(2)}`;
    btn.className = "btn-primary cashout";
    btn.disabled = false;
  } else if (phase === "running" && !state.myBetPlaced) {
    btn.textContent = "Round in progress…";
    btn.className = "btn-primary";
    btn.disabled = true;
  } else if (phase === "waiting" && state.myBetPlaced) {
    btn.textContent = "Bet placed \u2713 waiting for launch…";
    btn.className = "btn-primary";
    btn.disabled = true;
  } else if (phase === "crashed") {
    btn.textContent = "Round crashed — next round soon";
    btn.className = "btn-primary";
    btn.disabled = true;
  } else {
    btn.textContent = "Place bet";
    btn.className = "btn-primary";
    btn.disabled = false;
  }
}

function onPrimaryActionClick() {
  const phase = state.round?.phase;
  if (phase === "running" && state.myBetPlaced) GameSocket.cashout();
  else if (!phase || phase === "waiting") openBetSheet();
}

// ---------------- Bet sheet ----------------
function openBetSheet() {
  state.betSheetAmount = 0;
  document.getElementById("bet-amount-display").textContent = "0";
  document.getElementById("sheet-balance").textContent = state.balance;
  document.getElementById("bet-sheet-backdrop").classList.add("active");
}
function closeBetSheet() { document.getElementById("bet-sheet-backdrop").classList.remove("active"); }
function addBetAmount(v) {
  state.betSheetAmount = Math.min(20000, state.betSheetAmount + v);
  document.getElementById("bet-amount-display").textContent = state.betSheetAmount;
}
function toggleAutoCashout() {
  state.autoCashoutOn = !state.autoCashoutOn;
  document.getElementById("auto-cashout-checkbox").classList.toggle("checked", state.autoCashoutOn);
}
function bumpAutoCashout(delta) {
  state.autoCashoutValue = Math.max(1.1, Math.round((state.autoCashoutValue + delta) * 100) / 100);
  document.getElementById("auto-cashout-value").textContent = `x ${state.autoCashoutValue.toFixed(2)}`;
}
function confirmPlaceBet() {
  const amount = state.betSheetAmount;
  if (amount < 1) return toast("Minimum bet is 1 star");
  if (amount > state.balance) return toast("Insufficient balance");
  GameSocket.placeBet(amount, state.autoCashoutOn ? state.autoCashoutValue : null);
  closeBetSheet();
}

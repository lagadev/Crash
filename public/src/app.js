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
    startGame();
  }
  if (id === "tab-task") loadTasks();
  if (id === "tab-refer") loadReferral();
  if (id === "tab-wallet") loadWallet();
  if (id === "tab-profile") loadProfile();
}

function showModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }

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

// ---------------- Profile ----------------
async function loadProfile() {
  try {
    const { user } = await API.me();
    state.me = user;
    state.balance = user.balance;
    refreshBalanceUI();

    document.getElementById("profile-avatar").textContent = (user.first_name || "?")[0].toUpperCase();
    document.getElementById("profile-name").textContent = user.first_name || "Player";
    document.getElementById("profile-username").textContent = user.username ? "@" + user.username : `ID ${user.id}`;
    document.getElementById("stat-balance").textContent = user.balance;
    document.getElementById("stat-wagered").textContent = user.total_wagered;
    document.getElementById("stat-won").textContent = user.total_won;
    document.getElementById("profile-id").textContent = user.id;
    document.getElementById("profile-uname").textContent = user.username ? "@" + user.username : "—";
    document.getElementById("profile-fname").textContent = user.first_name || "—";
    document.getElementById("profile-since").textContent = new Date(user.created_at * 1000).toLocaleDateString();
    document.getElementById("profile-deposited").textContent = `${user.total_deposited} \u2b50`;
    document.getElementById("profile-withdrawn").textContent = `${user.total_withdrawn} \u2b50`;
    document.getElementById("profile-ref-earned").textContent = `${user.referral_earned} \u2b50`;
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
        <div><div class="type">${t.type}</div><div class="meta">${when}</div></div>
        <div class="amt ${pos ? "pos" : "neg"}">${pos ? "+" : ""}${t.amount} \u2b50</div>
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
          <div class="amt neg">-${w.amount} \u2b50</div>
          <span class="withdraw-status ${w.status}">${w.status}</span>
        </div>
      </div>`;
    })
    .join("");
}

async function submitWithdraw() {
  const amount = Number(document.getElementById("withdraw-amount").value);
  if (!amount || amount < 50) return toast("Minimum withdrawal is 50 \u2b50");
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
        <div class="stat"><b>${r.referral_earned} \u2b50</b>${r.invited_count} invited</div>
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
  const text = "Join me on Crash Game and grab your bonus! \ud83d\ude80";
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
        <div class="task-info"><div class="name">${escapeHtml(t.name)}</div><div class="reward">+${t.reward} \u2b50</div></div>
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
    toast(`+${res.reward} \u2b50 claimed!`);
    loadTasks();
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- Deposit (Telegram Stars) ----------------
function openDepositSheet() { document.getElementById("deposit-sheet-backdrop").classList.add("active"); }
function closeDepositSheet() { document.getElementById("deposit-sheet-backdrop").classList.remove("active"); }
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

// ================================================================
// CRASH GAME
// ================================================================
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
    row.className = "bet-row";
    const initial = (b.username || "?")[0].toUpperCase();
    const grad = colors[i % colors.length];
    const multClass = b.status === "won" ? "win" : b.status === "lost" ? "lost" : "pending";
    const multSymbol = b.status === "won" ? "\u2713" : b.status === "lost" ? "\u2717" : "";
    row.innerHTML = `
      <div class="avatar" style="background:linear-gradient(135deg,${grad})">${initial}</div>
      <div class="who"><div class="name">${escapeHtml(b.username)}</div><div class="amt">\u2b50 ${b.amount}</div></div>
      <div class="mult ${multClass}">x${b.multiplier.toFixed(2)} ${multSymbol}</div>
      <div class="prize">${b.prizeEmoji || ""}</div>`;
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
  if (amount < 1) return toast("Minimum bet is 1 \u2b50");
  if (amount > state.balance) return toast("Insufficient balance");
  GameSocket.placeBet(amount, state.autoCashoutOn ? state.autoCashoutValue : null);
  closeBetSheet();
}

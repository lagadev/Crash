// ============================================================
// Crash Game Mini App - main application logic
// ============================================================

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor?.("#0b0e17");
tg?.setBackgroundColor?.("#0b0e17");

const state = {
  balance: 0,
  me: null,
  round: null,       // last full round view from the server
  myBetPlaced: false,
  myBetAmount: 0,
  betSheetAmount: 0,
  autoCashoutOn: false,
  autoCashoutValue: 2.0,
  depositAmount: 100,
  socketStarted: false,
};

// ---------------- Screen navigation ----------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.getElementById("crash-bottom-bar").style.display = id === "screen-crash" ? "block" : "none";

  if (id === "screen-crash" && !state.socketStarted) {
    state.socketStarted = true;
    startGame();
  }
  if (id === "screen-profile") loadProfile();
  if (id === "screen-withdraw") document.getElementById("withdraw-balance").textContent = state.balance;
  if (id === "screen-referral") loadReferral();
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
  } catch (e) {
    console.error("auth failed", e);
    toast("Could not connect to server");
  }
}
boot();

function refreshBalanceUI() {
  document.getElementById("home-balance").textContent = state.balance;
  document.getElementById("crash-balance").textContent = state.balance;
  document.getElementById("sheet-balance").textContent = state.balance;
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
    document.getElementById("profile-deposited").textContent = `${user.total_deposited} ⭐`;
    document.getElementById("profile-withdrawn").textContent = `${user.total_withdrawn} ⭐`;
    document.getElementById("profile-ref-earned").textContent = `${user.referral_earned} ⭐`;
    document.getElementById("profile-since").textContent = new Date(user.created_at * 1000).toLocaleDateString();
  } catch (e) {
    toast("Failed to load profile");
  }
}

// ---------------- Withdraw ----------------
async function submitWithdraw() {
  const amount = Number(document.getElementById("withdraw-amount").value);
  if (!amount || amount < 50) return toast("Minimum withdrawal is 50 ⭐");
  try {
    await API.withdraw(amount);
    state.balance -= amount;
    refreshBalanceUI();
    document.getElementById("withdraw-balance").textContent = state.balance;
    document.getElementById("withdraw-amount").value = "";
    toast("Withdrawal request submitted ✅");
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
}

function copyReferralLink() {
  if (!state.referralLink) return;
  navigator.clipboard?.writeText(state.referralLink);
  tg?.HapticFeedback?.notificationOccurred?.("success");
  toast("Referral link copied!");
}

// ---------------- Deposit (Telegram Stars) ----------------
function openDepositSheet() {
  document.getElementById("deposit-sheet-backdrop").classList.add("active");
}
function closeDepositSheet() {
  document.getElementById("deposit-sheet-backdrop").classList.remove("active");
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

// ================================================================
// CRASH GAME
// ================================================================
function startGame() {
  GameSocket.on("state", (payload) => renderRound(payload));
  GameSocket.on("round_start", (payload) => renderRound(payload));
  GameSocket.on("tick", ({ multiplier }) => updateLiveMultiplier(multiplier));
  GameSocket.on("crash", (payload) => renderCrash(payload));
  GameSocket.on("balance", (balance) => {
    state.balance = balance;
    refreshBalanceUI();
  });
  GameSocket.on("cashed_out", ({ userId, multiplier }) => {
    if (state.me && userId === state.me.id) toast(`Cashed out at x${multiplier.toFixed(2)}! 🎉`);
  });
  GameSocket.on("error", (msg) => toast(msg));
  GameSocket.connect();
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
  document.getElementById("live-multiplier").textContent = `${m.toFixed(2)}x`;
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
  history.forEach((h, i) => {
    const chip = document.createElement("div");
    const cls = h < 2 ? "low" : h < 5 ? "mid" : "high";
    chip.className = `chip ${cls} ${i === 0 ? "current" : ""}`;
    chip.textContent = `x${h.toFixed(2)}`;
    row.appendChild(chip);
  });
}

function renderBetList(bets) {
  const list = document.getElementById("bet-list");
  if (!bets.length) {
    list.innerHTML = '<div class="no-bets">No bets yet</div>';
    return;
  }
  list.innerHTML = "";
  const colors = ["#ff7a59,#ff4f81", "#4facfe,#00f2fe", "#a8ff78,#78ffd6", "#f7971e,#ffd200"];
  bets.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "bet-row";
    const initial = (b.username || "?")[0].toUpperCase();
    const grad = colors[i % colors.length];
    const multClass = b.status === "won" ? "win" : b.status === "lost" ? "lost" : "pending";
    const multSymbol = b.status === "won" ? "✅" : b.status === "lost" ? "❌" : "";
    row.innerHTML = `
      <div class="avatar" style="background:linear-gradient(135deg,${grad})">${initial}</div>
      <div class="who">
        <div class="name">${escapeHtml(b.username)}</div>
        <div class="amt">⭐ ${b.amount}</div>
      </div>
      <div class="mult ${multClass}">x${b.multiplier.toFixed(2)} ${multSymbol}</div>
      <div class="prize">${b.prizeEmoji || ""}</div>`;
    list.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

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
    btn.textContent = "Bet placed ✓ waiting for launch…";
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
  if (phase === "running" && state.myBetPlaced) {
    GameSocket.cashout();
  } else if (!phase || phase === "waiting") {
    openBetSheet();
  }
}

// ---------------- Bet sheet ----------------
function openBetSheet() {
  state.betSheetAmount = 0;
  document.getElementById("bet-amount-display").textContent = "0";
  document.getElementById("sheet-balance").textContent = state.balance;
  document.getElementById("bet-sheet-backdrop").classList.add("active");
}
function closeBetSheet() {
  document.getElementById("bet-sheet-backdrop").classList.remove("active");
}
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
  if (amount < 50) return toast("Minimum bet is 50 ⭐");
  if (amount > state.balance) return toast("Insufficient balance");
  GameSocket.placeBet(amount, state.autoCashoutOn ? state.autoCashoutValue : null);
  closeBetSheet();
}

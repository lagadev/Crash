// ============================================================
// Crash Game — Admin Panel logic
// ============================================================

let ADMIN_KEY = localStorage.getItem("crashAdminKey") || "";

async function adminRequest(path, opts = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", "X-Admin-Key": ADMIN_KEY },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { doLogout(); throw new Error("Unauthorized"); }
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function fmtDate(unixSeconds) { return unixSeconds ? new Date(unixSeconds * 1000).toLocaleString() : "—"; }

// ---------------- Login ----------------
async function doLogin() {
  const key = document.getElementById("login-key").value.trim();
  if (!key) return;
  ADMIN_KEY = key;
  try {
    await adminRequest("/dashboard");
    localStorage.setItem("crashAdminKey", key);
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-shell").classList.add("active");
    initAdmin();
  } catch (e) {
    document.getElementById("login-error").style.display = "block";
  }
}
function doLogout() {
  localStorage.removeItem("crashAdminKey");
  ADMIN_KEY = "";
  document.getElementById("admin-shell").classList.remove("active");
  document.getElementById("login-screen").style.display = "flex";
}

window.addEventListener("DOMContentLoaded", () => {
  if (ADMIN_KEY) {
    adminRequest("/dashboard")
      .then(() => {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("admin-shell").classList.add("active");
        initAdmin();
      })
      .catch(() => { document.getElementById("login-screen").style.display = "flex"; });
  }
  document.getElementById("login-key").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
});

function initAdmin() {
  loadDashboard();
}

// ---------------- View switching ----------------
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".nav-item[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === id));

  if (id === "view-dashboard") loadDashboard();
  if (id === "view-users") loadUsers();
  if (id === "view-withdrawals") loadWithdrawals();
  if (id === "view-tasks") loadTasks();
  if (id === "view-game") loadGame();
  if (id === "view-bot") loadBotSettings();
}

function closeModal(id) { document.getElementById(id).classList.remove("active"); }
function openModal(id) { document.getElementById(id).classList.add("active"); }

// ---------------- Dashboard ----------------
async function loadDashboard() {
  try {
    const d = await adminRequest("/dashboard");
    const stats = [
      ["profile", d.totalUsers, "Total Users"],
      ["game", d.totalWagered, "Total Wagered \u2b50"],
      ["plus", d.totalDeposited, "Total Deposited \u2b50"],
      ["withdraw", d.totalWithdrawn, "Total Withdrawn \u2b50"],
      ["withdraw", d.pendingWithdrawals, "Pending Withdrawals"],
    ];
    document.getElementById("dashboard-stats").innerHTML = stats
      .map(([ic, n, l]) => `<div class="stat-card"><div class="icon">${icon(ic)}</div><div class="n">${n}</div><div class="l">${l}</div></div>`)
      .join("");

    const r = d.lastRound;
    document.getElementById("dashboard-last-round").outerHTML = r
      ? `<div class="table-wrap" id="dashboard-last-round"><table><tbody>
          <tr><th>Round ID</th><td>#${r.id}</td></tr>
          <tr><th>Crash Point</th><td>x${Number(r.crash_point).toFixed(2)}</td></tr>
          <tr><th>Started</th><td>${fmtDate(r.started_at)}</td></tr>
          <tr><th>Ended</th><td>${r.ended_at ? fmtDate(r.ended_at) : "in progress"}</td></tr>
        </tbody></table></div>`
      : `<div class="empty-state" id="dashboard-last-round">No rounds yet</div>`;
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- Users ----------------
let userSearchTimer = null;
function debouncedUserSearch() {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(loadUsers, 300);
}

async function loadUsers() {
  const q = document.getElementById("user-search").value.trim();
  try {
    const { users } = await adminRequest(`/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    document.getElementById("users-tbody").innerHTML = users.length
      ? users
          .map(
            (u) => `<tr>
        <td><b>${escapeHtml(u.username ? "@" + u.username : u.first_name || "—")}</b><br/><span style="color:var(--muted);font-size:11px">ID ${u.id}</span></td>
        <td>${u.balance} \u2b50</td>
        <td>${u.total_wagered}</td>
        <td>${u.total_won}</td>
        <td>${u.banned ? '<span class="badge danger">Banned</span>' : '<span class="badge ok">Active</span>'}</td>
        <td style="color:var(--muted)">${fmtDate(u.created_at)}</td>
        <td><button class="btn ghost sm" onclick="openUserModal(${u.id})">Manage</button></td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="7"><div class="empty-state">No users found</div></td></tr>`;
  } catch (e) {
    toast(e.message);
  }
}

async function openUserModal(id) {
  try {
    const { user } = await adminRequest(`/users/${id}`);
    document.getElementById("user-modal-title").textContent = user.username ? "@" + user.username : `User ${user.id}`;
    document.getElementById("user-modal-body").innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
        <div class="stat-card"><div class="n">${user.balance}</div><div class="l">Balance</div></div>
        <div class="stat-card"><div class="n">${user.total_wagered}</div><div class="l">Wagered</div></div>
        <div class="stat-card"><div class="n">${user.total_won}</div><div class="l">Won</div></div>
      </div>
      <div class="panel" style="margin-bottom:14px">
        <h3>Change Balance</h3>
        <div class="field-row">
          <div class="field"><label>Mode</label><select id="bal-mode"><option value="adjust">Adjust (+/-)</option><option value="set">Set exact</option></select></div>
          <div class="field"><label>Amount</label><input type="number" id="bal-amount" placeholder="e.g. 100 or -50" /></div>
        </div>
        <button class="btn primary" onclick="adjustBalance(${user.id})">Apply</button>
      </div>
      <div style="display:flex;gap:10px">
        ${
          user.banned
            ? `<button class="btn success" style="flex:1;justify-content:center" onclick="unbanUser(${user.id})">Unban User</button>`
            : `<button class="btn danger" style="flex:1;justify-content:center" onclick="banUser(${user.id})"><span class="icon" data-icon="ban"></span>Ban User</button>`
        }
      </div>`;
    document.querySelectorAll("#user-modal-body [data-icon]").forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ""));
    openModal("user-modal");
  } catch (e) {
    toast(e.message);
  }
}

async function adjustBalance(id) {
  const mode = document.getElementById("bal-mode").value;
  const amount = Number(document.getElementById("bal-amount").value);
  if (!Number.isFinite(amount)) return toast("Enter a valid amount");
  try {
    await adminRequest(`/users/${id}/balance`, { method: "POST", body: { mode, amount } });
    toast("Balance updated");
    closeModal("user-modal");
    loadUsers();
  } catch (e) {
    toast(e.message);
  }
}
async function banUser(id) {
  await adminRequest(`/users/${id}/ban`, { method: "POST" }).catch((e) => toast(e.message));
  toast("User banned");
  closeModal("user-modal");
  loadUsers();
}
async function unbanUser(id) {
  await adminRequest(`/users/${id}/unban`, { method: "POST" }).catch((e) => toast(e.message));
  toast("User unbanned");
  closeModal("user-modal");
  loadUsers();
}

// ---------------- Withdrawals ----------------
async function loadWithdrawals() {
  const status = document.getElementById("withdraw-filter").value;
  try {
    const { withdrawals } = await adminRequest(`/withdrawals${status ? `?status=${status}` : ""}`);
    document.getElementById("withdrawals-tbody").innerHTML = withdrawals.length
      ? withdrawals
          .map((w) => {
            const badgeClass = w.status === "pending" ? "warn" : w.status === "approved" || w.status === "paid" ? "ok" : "danger";
            const actions =
              w.status === "pending"
                ? `<button class="btn success sm" onclick="approveWithdraw(${w.id})">Approve</button>
                   <button class="btn danger sm" onclick="rejectWithdraw(${w.id})">Reject</button>`
                : "";
            return `<tr>
              <td><b>${escapeHtml(w.username ? "@" + w.username : w.first_name || "—")}</b><br/><span style="color:var(--muted);font-size:11px">ID ${w.user_id}</span></td>
              <td>${w.amount} \u2b50</td>
              <td><span class="badge ${badgeClass}">${w.status}</span></td>
              <td style="color:var(--muted)">${fmtDate(w.created_at)}</td>
              <td style="display:flex;gap:6px">${actions}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="5"><div class="empty-state">No withdrawal requests</div></td></tr>`;
  } catch (e) {
    toast(e.message);
  }
}
async function approveWithdraw(id) {
  try { await adminRequest(`/withdrawals/${id}/approve`, { method: "POST" }); toast("Approved"); loadWithdrawals(); }
  catch (e) { toast(e.message); }
}
async function rejectWithdraw(id) {
  try { await adminRequest(`/withdrawals/${id}/reject`, { method: "POST" }); toast("Rejected & refunded"); loadWithdrawals(); }
  catch (e) { toast(e.message); }
}

// ---------------- Tasks ----------------
async function loadTasks() {
  try {
    const { tasks } = await adminRequest("/tasks");
    document.getElementById("tasks-tbody").innerHTML = tasks.length
      ? tasks
          .map(
            (t) => `<tr>
        <td><b>${escapeHtml(t.name)}</b></td>
        <td>${t.reward} \u2b50</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)">${escapeHtml(t.link)}</td>
        <td>${t.active ? '<span class="badge ok">Active</span>' : '<span class="badge muted">Hidden</span>'}</td>
        <td style="display:flex;gap:6px">
          <button class="btn ghost sm" onclick='openTaskModal(${JSON.stringify(t).replace(/'/g, "&#39;")})'><span class="icon" data-icon="edit"></span></button>
          <button class="btn danger sm" onclick="deleteTask(${t.id})"><span class="icon" data-icon="trash"></span></button>
        </td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="5"><div class="empty-state">No tasks yet — add one</div></td></tr>`;
    document.querySelectorAll("#tasks-tbody [data-icon]").forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ""));
  } catch (e) {
    toast(e.message);
  }
}

function openTaskModal(task) {
  document.getElementById("task-modal-title").textContent = task ? "Edit Task" : "Add Task";
  document.getElementById("task-id").value = task?.id || "";
  document.getElementById("task-name").value = task?.name || "";
  document.getElementById("task-logo").value = task?.logo_url || "";
  document.getElementById("task-link").value = task?.link || "";
  document.getElementById("task-reward").value = task?.reward ?? 0;
  document.getElementById("task-active").value = task ? String(task.active) : "1";
  openModal("task-modal");
}

async function saveTask() {
  const id = document.getElementById("task-id").value;
  const body = {
    name: document.getElementById("task-name").value.trim(),
    logoUrl: document.getElementById("task-logo").value.trim(),
    link: document.getElementById("task-link").value.trim(),
    reward: Number(document.getElementById("task-reward").value) || 0,
    active: document.getElementById("task-active").value === "1",
  };
  if (!body.name || !body.link) return toast("Name and link are required");
  try {
    if (id) await adminRequest(`/tasks/${id}`, { method: "PUT", body });
    else await adminRequest("/tasks", { method: "POST", body });
    toast("Task saved");
    closeModal("task-modal");
    loadTasks();
  } catch (e) {
    toast(e.message);
  }
}
async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  try { await adminRequest(`/tasks/${id}`, { method: "DELETE" }); toast("Task deleted"); loadTasks(); }
  catch (e) { toast(e.message); }
}

// ---------------- Game ----------------
async function loadGame() {
  try {
    const { rounds, forcedCrashPoint } = await adminRequest("/game");
    document.getElementById("forced-crash-banner").innerHTML = forcedCrashPoint
      ? `<div class="badge warn" style="margin-bottom:12px">Override active — next round will crash at x${Number(forcedCrashPoint).toFixed(2)}</div>`
      : "";
    document.getElementById("rounds-tbody").innerHTML = rounds.length
      ? rounds
          .map(
            (r) => `<tr>
        <td>#${r.id}</td><td>x${Number(r.crash_point).toFixed(2)}</td><td>${r.total_bets}</td>
        <td>${r.total_wagered} \u2b50</td><td>${r.total_payout} \u2b50</td><td style="color:var(--muted)">${fmtDate(r.started_at)}</td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="6"><div class="empty-state">No rounds yet</div></td></tr>`;
  } catch (e) {
    toast(e.message);
  }
}
async function setForcedCrash() {
  const multiplier = Number(document.getElementById("force-crash-input").value);
  if (!multiplier || multiplier < 1) return toast("Enter a multiplier >= 1");
  try {
    await adminRequest("/game/force-crash", { method: "POST", body: { multiplier } });
    toast(`Next round will crash at x${multiplier}`);
    loadGame();
  } catch (e) {
    toast(e.message);
  }
}
async function clearForcedCrash() {
  try { await adminRequest("/game/clear-force-crash", { method: "POST" }); toast("Override cleared"); loadGame(); }
  catch (e) { toast(e.message); }
}

// ---------------- Bot settings & Broadcast ----------------
const BUTTON_STYLES = [
  ["primary", "Primary"],
  ["success", "Success"],
  ["danger", "Danger"],
];

function addButtonRow(containerId, prefill) {
  const container = document.getElementById(containerId);
  const row = document.createElement("div");
  row.className = "btn-row-editor";
  row.innerHTML = `
    <div class="field"><label>Text</label><input type="text" class="btn-text" placeholder="Confirm" value="${escapeHtml(prefill?.text || "")}" /></div>
    <div class="field"><label>URL</label><input type="url" class="btn-url" placeholder="https://…" value="${escapeHtml(prefill?.url || "")}" /></div>
    <div class="field" style="max-width:130px"><label>Style</label><select class="btn-style">${BUTTON_STYLES.map(
      ([v, l]) => `<option value="${v}" ${prefill?.style === v ? "selected" : ""}>${l}</option>`
    ).join("")}</select></div>
    <button class="btn danger sm" onclick="this.closest('.btn-row-editor').remove()"><span class="icon" data-icon="trash"></span></button>`;
  container.appendChild(row);
  row.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ""));
}

function readButtonsEditor(containerId) {
  const rows = [...document.getElementById(containerId).querySelectorAll(".btn-row-editor")];
  const buttons = rows
    .map((r) => ({
      text: r.querySelector(".btn-text").value.trim(),
      url: r.querySelector(".btn-url").value.trim(),
      style: r.querySelector(".btn-style").value,
    }))
    .filter((b) => b.text);
  return buttons.length ? [buttons] : []; // single row of buttons, Telegram inline_keyboard shape: rows of buttons
}

async function loadBotSettings() {
  try {
    const { startMessage } = await adminRequest("/bot-settings");
    document.getElementById("start-image").value = startMessage?.imageUrl || "";
    document.getElementById("start-text").value = startMessage?.text || "";
    document.getElementById("start-buttons-editor").innerHTML = "";
    (startMessage?.buttons || []).flat().forEach((b) => addButtonRow("start-buttons-editor", b));
  } catch (e) {
    toast(e.message);
  }
}

async function saveStartMessage() {
  const body = {
    imageUrl: document.getElementById("start-image").value.trim(),
    text: document.getElementById("start-text").value.trim(),
    buttons: readButtonsEditor("start-buttons-editor"),
  };
  try { await adminRequest("/bot-settings", { method: "POST", body }); toast("Start message saved"); }
  catch (e) { toast(e.message); }
}

async function sendBroadcast() {
  const body = {
    imageUrl: document.getElementById("bcast-image").value.trim(),
    text: document.getElementById("bcast-text").value.trim(),
    buttons: readButtonsEditor("bcast-buttons-editor"),
  };
  if (!body.text && !body.imageUrl) return toast("Add some text or an image");
  if (!confirm("Send this broadcast to every user?")) return;
  try {
    const res = await adminRequest("/broadcast", { method: "POST", body });
    document.getElementById("bcast-result").textContent = `Sent to ${res.sent}/${res.total} users (${res.failed} failed)`;
    toast("Broadcast sent");
  } catch (e) {
    toast(e.message);
  }
}

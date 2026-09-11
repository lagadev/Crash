// Full Mini App markup as a template string, injected into #app by app.js
// after confirming we're actually running inside Telegram. Keeping this out
// of index.html is what lets index.html stay a tiny, near-empty shell.
function appShellHtml() {
  return `
  <!-- ================= CRASH ================= -->
  <section id="tab-crash" class="tab-screen active">
    <div class="topbar">
      <div class="title">Crash</div>
      <div class="balance-pill">
        <span class="star-ic" id="crash-star-ic"></span><span id="crash-balance">0</span>
        <span class="plus" onclick="openDepositSheet()"><span class="icon" data-icon="plus"></span></span>
      </div>
    </div>

    <div class="stage" id="stage">
      <div class="falling-stars" id="falling-stars"></div>

      <div class="connecting-overlay" id="connecting-overlay">
        <div class="spinner"></div>
        <div class="txt">Connecting to server…</div>
        <div class="sub">সার্ভারে সংযোগ হচ্ছে…</div>
      </div>

      <div id="stage-waiting">
        <div style="text-align:center">
          <div class="countdown-num" id="countdown-num">5</div>
          <div class="countdown-label">Place your bet — round starts soon</div>
        </div>
      </div>
      <div id="stage-flying" style="display:none" class="flight-track">
        <div class="rocket-visual" id="rocket-visual"></div>
        <div class="crash-multiplier live" id="live-multiplier">1.00x</div>
      </div>
      <div id="stage-crashed" style="display:none">
        <div class="crash-visual" id="crash-visual"></div>
        <div class="crash-multiplier crashed" id="crashed-multiplier">1.00x</div>
      </div>
    </div>

    <div class="history-row" id="history-row"></div>

    <div class="bet-panel">
      <div class="bet-panel-head"><span>Bet</span><span>Winnings</span></div>
      <div class="bet-list" id="bet-list">
        <div class="no-bets">No bets yet</div>
      </div>
    </div>
  </section>

  <!-- ================= TASK ================= -->
  <section id="tab-task" class="tab-screen">
    <div class="topbar">
      <div class="title">Tasks</div>
      <div class="balance-pill"><span class="star-ic" id="task-star-ic"></span><span id="task-balance">0</span></div>
    </div>
    <div class="card" style="text-align:center;color:var(--muted);font-size:13px">
      Complete tasks below to earn free Stars.
    </div>
    <div id="task-list"></div>
  </section>

  <!-- ================= REFER ================= -->
  <section id="tab-refer" class="tab-screen">
    <div class="topbar">
      <div class="title">Refer &amp; Earn</div>
      <div class="balance-pill"><span class="star-ic" id="refer-star-ic"></span><span id="refer-balance">0</span></div>
    </div>

    <div class="refer-hero">
      <h2>Invite friends and earn<br /><span class="pct" id="refer-pct-badge">10%</span> from their first deposit!</h2>
      <p>Plus <span class="b" id="refer-flat-badge">5 stars</span> instantly for every friend who joins with your link.
      Then keep earning from their play — <span class="b">0.5%</span> of your direct friend's turnover,
      <span class="b">0.2%</span> from their friends, and <span class="b">0.1%</span> beyond that.<br/>
      Credited automatically every 30 minutes (from 0.01 <span class="star-ic" data-star-inline></span>).</p>
      <div class="refer-actions">
        <button class="invite-btn" onclick="inviteFriends()"><span class="icon" data-icon="share"></span>Invite</button>
        <button class="icon-btn" onclick="copyReferralLink()"><span class="icon" data-icon="copy"></span></button>
      </div>
    </div>

    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat-box"><div class="n" id="ref-invited">0</div><div class="l">Invited</div></div>
      <div class="stat-box"><div class="n" id="ref-earned">0</div><div class="l">Earned</div></div>
      <div class="stat-box"><div class="n" id="ref-pending">0</div><div class="l">Pending</div></div>
    </div>

    <div class="card">
      <h3 style="display:flex;align-items:center;gap:8px"><span class="icon" data-icon="trophy"></span>Top 50 Leaderboard</h3>
      <div id="leaderboard-list"></div>
    </div>
  </section>

  <!-- ================= WALLET ================= -->
  <section id="tab-wallet" class="tab-screen">
    <div class="topbar"><div class="title">Wallet</div></div>

    <div class="card" style="text-align:center">
      <div style="color:var(--muted);font-size:13px;font-weight:600">Available Balance</div>
      <div style="font-size:38px;font-weight:800;margin-top:6px"><span class="star-ic lg" id="wallet-star-ic"></span> <span id="wallet-balance">0</span></div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="invite-btn" style="flex:1" onclick="openDepositSheet()"><span class="icon" data-icon="plus"></span>Deposit</button>
        <button class="invite-btn" style="flex:1;background:var(--card-strong);color:var(--text);box-shadow:none" onclick="document.getElementById('withdraw-card').scrollIntoView({behavior:'smooth'})"><span class="icon" data-icon="withdraw"></span>Withdraw</button>
      </div>
    </div>

    <div class="card" id="withdraw-card">
      <h3>Withdraw</h3>
      <input type="number" id="withdraw-amount" placeholder="Minimum 50 stars" min="50" />
      <div class="hint">Minimum withdrawal is 50 stars. Requests are reviewed and paid to your Telegram account.</div>
      <button class="btn-primary" onclick="submitWithdraw()">Request Withdraw</button>
    </div>

    <div class="card">
      <h3>Withdrawal Requests</h3>
      <div id="withdraw-history"><div class="no-bets">No requests yet</div></div>
    </div>

    <div class="card">
      <h3>Recent Transactions</h3>
      <div id="tx-history"><div class="no-bets">No transactions yet</div></div>
    </div>
  </section>

  <!-- ================= PROFILE ================= -->
  <section id="tab-profile" class="tab-screen">
    <div class="topbar"><div class="title">Profile</div></div>

    <div class="card" style="text-align:center">
      <div class="avatar" style="width:72px;height:72px;font-size:24px;margin:0 auto 10px;background:var(--accent-grad)" id="profile-avatar">?</div>
      <div style="font-weight:800;font-size:18px" id="profile-name">—</div>
      <div style="color:var(--muted);font-size:13px" id="profile-username">—</div>
    </div>

    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat-box"><div class="n" id="stat-balance">0</div><div class="l">Balance</div></div>
      <div class="stat-box"><div class="n" id="stat-wagered">0</div><div class="l">Wagered</div></div>
      <div class="stat-box"><div class="n" id="stat-won">0</div><div class="l">Won</div></div>
    </div>

    <div class="card">
      <h3>ID Details</h3>
      <div class="row-line"><span>Telegram ID</span><span class="v" id="profile-id">—</span></div>
      <div class="row-line"><span>Username</span><span class="v" id="profile-uname">—</span></div>
      <div class="row-line"><span>First Name</span><span class="v" id="profile-fname">—</span></div>
      <div class="row-line"><span>Member Since</span><span class="v" id="profile-since">—</span></div>
    </div>

    <div class="card">
      <h3>Account Summary</h3>
      <div class="row-line"><span>Total Deposited</span><span class="v" id="profile-deposited">0</span></div>
      <div class="row-line"><span>Total Withdrawn</span><span class="v" id="profile-withdrawn">0</span></div>
      <div class="row-line"><span>Referral Earned</span><span class="v" id="profile-ref-earned">0</span></div>
      <div class="row-line"><span>Invited Friends</span><span class="v" id="profile-invited">0</span></div>
    </div>
  </section>

  <!-- ================= Bottom tab bar ================= -->
  <div class="tabbar">
    <button class="tab-item active" data-tab="tab-crash" onclick="showTab('tab-crash')"><span class="icon" data-icon="rocket"></span><span>Crash</span></button>
    <button class="tab-item" data-tab="tab-task" onclick="showTab('tab-task')"><span class="icon" data-icon="task"></span><span>Task</span></button>
    <button class="tab-item" data-tab="tab-refer" onclick="showTab('tab-refer')"><span class="icon" data-icon="users"></span><span>Refer</span></button>
    <button class="tab-item" data-tab="tab-wallet" onclick="showTab('tab-wallet')"><span class="icon" data-icon="wallet"></span><span>Wallet</span></button>
    <button class="tab-item" data-tab="tab-profile" onclick="showTab('tab-profile')"><span class="icon" data-icon="profile"></span><span>Profile</span></button>
  </div>

  <!-- Crash bottom action bar (only visible on Crash tab) -->
  <div class="bottom-bar" id="crash-bottom-bar">
    <button class="btn-primary" id="place-bet-btn" onclick="onPrimaryActionClick()">Place bet</button>
  </div>

  <!-- ============ New Bet sheet ============ -->
  <div class="sheet-backdrop" id="bet-sheet-backdrop">
    <div class="sheet">
      <div class="sheet-head"><h3>New Bet</h3><button class="sheet-close" onclick="closeBetSheet()"><span class="icon" data-icon="close"></span></button></div>
      <div class="balance-pill" style="margin:0 auto 6px;width:fit-content"><span class="star-ic" id="sheet-star-ic"></span><span id="sheet-balance">0</span></div>
      <div class="amount-hero"><span class="num" id="bet-amount-display">0</span><span class="unit">stars</span></div>
      <input type="number" id="bet-amount-input" class="custom-amount-input" placeholder="Or type a custom amount" min="1" max="20000" oninput="onBetAmountTyped(this.value)" />
      <div class="quick-amounts">
        <button onclick="addBetAmount(10)">+ 10</button>
        <button onclick="addBetAmount(100)">+ 100</button>
        <button onclick="addBetAmount(500)">+ 500</button>
      </div>
      <div class="hint">From 1 to 20,000 stars</div>
      <div class="auto-cashout-row">
        <div class="left"><button class="checkbox" id="auto-cashout-checkbox" onclick="toggleAutoCashout()"><span class="icon" data-icon="check"></span></button><span>Auto cashout</span></div>
        <div class="stepper"><button onclick="bumpAutoCashout(-0.1)">−</button><span id="auto-cashout-value">x 2.00</span><button onclick="bumpAutoCashout(0.1)">+</button></div>
      </div>
      <button class="btn-primary" onclick="confirmPlaceBet()">Place bet</button>
    </div>
  </div>

  <!-- ============ Deposit sheet (Stars / TON) ============ -->
  <div class="sheet-backdrop" id="deposit-sheet-backdrop">
    <div class="sheet">
      <div class="sheet-head"><h3>Add Balance</h3><button class="sheet-close" onclick="closeDepositSheet()"><span class="icon" data-icon="close"></span></button></div>

      <div class="deposit-tabs">
        <button class="deposit-tab active" id="deposit-tab-stars" onclick="switchDepositTab('stars')"><span class="icon" data-icon="star"></span>Telegram Stars</button>
        <button class="deposit-tab" id="deposit-tab-ton" onclick="switchDepositTab('ton')"><span class="icon" data-icon="ton"></span>TON / GRAM</button>
      </div>

      <div class="deposit-pane active" id="deposit-pane-stars">
        <div class="amount-hero"><span class="num" id="deposit-amount-display">100</span><span class="unit">stars</span></div>
        <input type="number" id="deposit-amount-input" class="custom-amount-input" placeholder="Or type a custom amount" min="50" max="20000" oninput="onDepositAmountTyped(this.value)" />
        <div class="quick-amounts"><button onclick="setDepositAmount(100)">100</button><button onclick="setDepositAmount(500)">500</button><button onclick="setDepositAmount(2500)">2,500</button></div>
        <div class="hint">From 50 to 20,000 stars · paid with Telegram Stars</div>
        <button class="btn-primary" onclick="confirmDeposit()">Pay with Stars</button>
      </div>

      <div class="deposit-pane" id="deposit-pane-ton">
        <div id="ton-not-connected">
          <div class="wallet-box">
            <div class="icon" data-icon="ton" style="color:#0098ea;margin:0 auto 8px;width:32px;height:32px"></div>
            <div style="font-weight:700;font-size:14px">No wallet connected</div>
            <div style="color:var(--muted);font-size:12px;margin-top:4px">Connect your TON wallet to deposit GRAM/TON</div>
          </div>
          <button class="wallet-connect-btn" onclick="connectTonWallet()"><span class="icon" data-icon="wallet"></span>Connect Wallet</button>
        </div>
        <div id="ton-connected" style="display:none">
          <div style="text-align:center;margin-bottom:14px">
            <span class="wallet-connected-pill"><span class="icon" data-icon="walletcheck"></span><span id="ton-address-short">—</span></span>
          </div>
          <div class="amount-hero"><span class="num" id="ton-amount-display">100</span><span class="unit">stars</span></div>
          <input type="number" id="ton-amount-input" class="custom-amount-input" placeholder="Or type a custom amount" min="50" max="20000" oninput="onTonAmountTyped(this.value)" />
          <div class="quick-amounts"><button onclick="setTonAmount(100)">100</button><button onclick="setTonAmount(500)">500</button><button onclick="setTonAmount(2500)">2,500</button></div>
          <div class="rate-hint" id="ton-rate-hint">—</div>
          <button class="btn-primary" onclick="payWithTon()">Pay &amp; Deposit</button>
          <button class="btn-ghost" style="width:100%;justify-content:center;margin-top:10px" onclick="disconnectTonWallet()">Disconnect</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ============ How it works (shown once, on first launch) ============ -->
  <div class="sheet-backdrop" id="how-it-works-backdrop">
    <div class="sheet">
      <div class="sheet-head" style="justify-content:center;position:relative">
        <h3 style="color:var(--muted);font-weight:700">How it works</h3>
        <button class="sheet-close" style="position:absolute;right:0;top:0" onclick="closeHowItWorks()"><span class="icon" data-icon="close"></span></button>
      </div>
      <div class="howto-steps">
        <div class="howto-step"><div class="howto-num">1</div><div class="howto-text"><b>Before the start, you place a bet in stars</b></div></div>
        <div class="howto-step"><div class="howto-num">2</div><div class="howto-text"><b>When the round starts, the multiplier grows</b><span>x1.10, x1.25, x1.50, x2.00, etc.</span></div></div>
        <div class="howto-step"><div class="howto-num">3</div><div class="howto-text"><b>You can cash out at any moment</b><span>Win = bet × current multiplier</span></div></div>
        <div class="howto-step"><div class="howto-num">4</div><div class="howto-text"><b>If the rocket crashes before you cash out, the bet is lost</b></div></div>
        <div class="howto-step"><div class="howto-num">5</div><div class="howto-text"><b>You can set auto cashout at the target multiplier so the system cashes out automatically</b></div></div>
      </div>
      <div class="howto-note">The reward is calculated like this: we count the current number of stars (bet × current multiplier). Round results are determined on the server. Sometimes, due to a poor connection, what you see on the screen may differ from the actual server result. In disputed cases, the result recorded by the server is final.</div>
      <button class="btn-primary" onclick="closeHowItWorks()">I see</button>
    </div>
  </div>

  <!-- ============ Outside-Telegram error screen ============ -->
  <div id="telegram-only-error" style="display:none"></div>

  <div class="toast" id="toast"></div>
  `;
}

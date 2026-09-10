// TonConnect wallet integration for the "TON / GRAM" deposit tab.
// Uses the official @tonconnect/ui UMD bundle (loaded via <script> in index.html).
const TonWallet = (() => {
  let ui = null;
  let address = null;
  let onChangeCb = null;

  function init() {
    if (ui || !window.TON_CONNECT_UI) return;
    ui = new window.TON_CONNECT_UI.TonConnectUI({
      manifestUrl: `${location.origin}/tonconnect-manifest.json`,
    });
    ui.onStatusChange((wallet) => {
      address = wallet?.account?.address || null;
      onChangeCb && onChangeCb(address);
    });
    if (ui.account?.address) address = ui.account.address;
  }

  function onChange(cb) {
    onChangeCb = cb;
  }

  async function connect() {
    init();
    if (!ui) throw new Error("Wallet connector failed to load");
    await ui.openModal();
  }

  async function disconnect() {
    if (ui) await ui.disconnect();
    address = null;
  }

  function shortAddress() {
    if (!address) return "";
    return `${address.slice(0, 4)}\u2026${address.slice(-4)}`;
  }

  /**
   * Sends exactly `nanoton` (a string of whole nanoTON) to `toAddress`.
   * No comment/payload is needed - deposits are matched server-side by
   * this exact, uniquely-generated amount (see /api/ton/create-intent).
   */
  async function sendExact(toAddress, nanoton) {
    if (!ui || !address) throw new Error("Connect your wallet first");
    await ui.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [{ address: toAddress, amount: String(nanoton) }],
    });
  }

  return {
    init,
    onChange,
    connect,
    disconnect,
    sendExact,
    shortAddress,
    get address() {
      return address;
    },
  };
})();

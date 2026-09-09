// WebSocket connection to the live CrashRoom, with auto-reconnect.
const GameSocket = (() => {
  let ws = null;
  let handlers = {};
  let reconnectDelay = 1000;

  function connect() {
    ws = new WebSocket(API.wsUrl());

    ws.onopen = () => {
      reconnectDelay = 1000;
      handlers.open && handlers.open();
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        handlers[msg.type] && handlers[msg.type](msg.payload);
      } catch (e) {
        console.error("bad ws message", e);
      }
    };
    ws.onclose = () => {
      handlers.close && handlers.close();
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
    };
    ws.onerror = () => ws.close();
  }

  function send(type, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  function on(type, cb) {
    handlers[type] = cb;
  }

  return {
    connect,
    on,
    placeBet: (amount, autoCashoutAt) => send("bet", { amount, autoCashoutAt }),
    cashout: () => send("cashout"),
  };
})();

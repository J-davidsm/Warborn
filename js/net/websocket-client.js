// Warborn direct WebSocket transport for local/LAN multiplayer.
let warbornSocket = null;
let warbornRelayUrl = 'ws://127.0.0.1:8787';
let warbornSocketIntent = null;
let warbornSocketConnected = false;
let warbornSocketClientId = null;
let warbornSocketUrl = null;

function normalizeRelayUrl(rawValue) {
  let raw = (rawValue || '').trim();
  if (!raw) return warbornRelayUrl;
  raw = raw.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  if (!/^wss?:\/\//i.test(raw)) raw = `ws://${raw}`;
  const url = new URL(raw);
  if (url.hostname === '0.0.0.0') {
    throw new Error('Use the host computer IP address, not 0.0.0.0.');
  }
  if (!url.port) url.port = '8787';
  url.pathname = url.pathname === '/' ? '' : url.pathname;
  return url.toString().replace(/\/$/, '');
}

function getRelayUrlInputValue() {
  const input = document.getElementById('relayUrlInput');
  const url = normalizeRelayUrl(input && input.value ? input.value : '');
  if (input) input.value = url;
  return url;
}

function setRelayStatus(message, color = '#d7c287') {
  const el = document.getElementById('onlineRelayStatus');
  if (el) {
    el.textContent = message;
    el.style.color = color;
  }
  updateConnectionStatus(message, color);
}

function updateOnlineRoomFields() {
  const roomInput = document.getElementById('onlineRoomIdInput');
  if (roomInput && gameId) roomInput.value = gameId;
  const code = document.getElementById('onlineRoomCode');
  if (code) code.textContent = gameId ? `Room: ${gameId} • Relay: ${warbornRelayUrl}` : `Relay: ${warbornRelayUrl}`;
}

function setRelayPlayers(players) {
  try {
    window.hexPlayers = players || window.hexPlayers || {};
    updateGameIdModal();
  } catch (e) {
    console.warn('Failed to update relay players:', e);
  }
}

function sendRelayMessage(payload) {
  if (!warbornSocket || warbornSocket.readyState !== WebSocket.OPEN) return false;
  try {
    warbornSocket.send(JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('Relay send failed:', e);
    return false;
  }
}

function relayDispatchToExistingHandlers(msg) {
  try {
    window.dispatchEvent(new MessageEvent('message', { data: msg }));
  } catch (e) {
    console.warn('Relay dispatch failed:', e);
  }
}

function handleRelayMessage(msg) {
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case 'hello':
      warbornSocketClientId = msg.clientId || warbornSocketClientId;
      if (msg.relayUrl) {
        warbornRelayUrl = msg.relayUrl;
        const relayInput = document.getElementById('relayUrlInput');
        if (relayInput && !relayInput.dataset.touched) relayInput.value = msg.relayUrl;
      }
      return;
    case 'roomCreated':
    case 'roomJoined':
      gameId = msg.gameId || gameId;
      myRole = msg.role || myRole;
      opponentType = 'HUMAN';
      gameMode = 'online-2p';
      if (msg.role === 'P2') currentTeam = msg.latestState && msg.latestState.currentTeam ? msg.latestState.currentTeam : currentTeam;
      setRelayPlayers(msg.players);
      updateOnlineRoomFields();
      setRelayStatus(myRole === 'P1' ? 'Hosting room' : 'Joined room', '#4ecdc4');
      if (msg.latestState) relayDispatchToExistingHandlers({ type: 'gameState', data: msg.latestState, gameId });
      startHeartbeat();
      try { updateUI(); } catch (e) {}
      return;
    case 'playerJoined':
      setRelayPlayers(msg.players);
      setRelayStatus('Player connected', '#4ecdc4');
      relayDispatchToExistingHandlers(msg);
      if (myRole === 'P1') setTimeout(() => postGameState(), 100);
      return;
    case 'heartbeatResponse':
      setRelayPlayers(msg.players);
      relayDispatchToExistingHandlers(msg);
      return;
    case 'actionConfirmation':
    case 'actionRejected':
    case 'connectionLost':
    case 'endTurn':
    case 'gameState':
      relayDispatchToExistingHandlers(msg);
      return;
    case 'error':
      setRelayStatus(msg.reason || 'Relay error', '#ff6b6b');
      console.warn('Warborn relay error:', msg.reason);
      return;
    default:
      console.debug('Unknown relay message:', msg);
  }
}

function connectRelay(intent) {
  warbornSocketIntent = intent || warbornSocketIntent;
  try {
    warbornRelayUrl = getRelayUrlInputValue();
  } catch (e) {
    setRelayStatus(e.message || 'Invalid relay URL', '#ff6b6b');
    return Promise.reject(e);
  }
  if (warbornSocket && warbornSocketUrl === warbornRelayUrl && (warbornSocket.readyState === WebSocket.OPEN || warbornSocket.readyState === WebSocket.CONNECTING)) {
    return Promise.resolve(warbornSocket);
  }
  if (warbornSocket && warbornSocket.readyState !== WebSocket.CLOSED) {
    try { warbornSocket.close(); } catch (e) {}
  }
  setRelayStatus('Connecting to relay...', '#d7c287');
  return new Promise((resolve, reject) => {
    try {
      warbornSocket = new WebSocket(warbornRelayUrl);
      warbornSocketUrl = warbornRelayUrl;
    } catch (e) {
      setRelayStatus('Invalid relay URL', '#ff6b6b');
      reject(e);
      return;
    }
    warbornSocket.onopen = () => {
      warbornSocketConnected = true;
      isConnectedToHub = true;
      lastHeartbeat = Date.now();
      setRelayStatus('Relay connected', '#4ecdc4');
      updateOnlineRoomFields();
      resolve(warbornSocket);
      if (warbornSocketIntent) sendRelayMessage(warbornSocketIntent);
    };
    warbornSocket.onmessage = event => {
      try {
        handleRelayMessage(JSON.parse(event.data));
      } catch (e) {
        console.warn('Bad relay message:', event.data, e);
      }
    };
    warbornSocket.onclose = () => {
      warbornSocketConnected = false;
      isConnectedToHub = false;
      setRelayStatus('Relay disconnected', '#ff6b6b');
    };
    warbornSocket.onerror = event => {
      setRelayStatus('Connection blocked or failed. Use ws://host-ip:8787 and allow local network access.', '#ff6b6b');
      reject(event);
    };
  });
}

function hostOnlineGame() {
  opponentType = 'HUMAN';
  gameMode = 'online-2p';
  myRole = 'P1';
  if (!gameId) gameId = `WB${Math.floor(100000 + Math.random() * 900000)}`;
  setupGame();
  updateOnlineRoomFields();
  connectRelay({ type: 'createRoom', gameId, clientId: localClientId });
}

function joinOnlineGame() {
  const input = document.getElementById('onlineRoomIdInput');
  const requested = input && input.value ? input.value.trim().toUpperCase() : '';
  if (!requested) {
    setRelayStatus('Enter a room code to join', '#ffb347');
    return;
  }
  opponentType = 'HUMAN';
  gameMode = 'online-2p';
  myRole = 'P2';
  gameId = requested;
  updateOnlineRoomFields();
  connectRelay({ type: 'joinRoom', gameId, role: 'P2', clientId: localClientId });
}

function leaveOnlineGame() {
  sendRelayMessage({ type: 'leaveRoom', gameId, role: myRole, clientId: localClientId });
  try { if (warbornSocket) warbornSocket.close(); } catch (e) {}
  warbornSocket = null;
  warbornSocketConnected = false;
  setRelayStatus('Offline', '#888');
}

function wireOnlineMultiplayerControls() {
  const hostBtn = document.getElementById('hostOnlineGameBtn');
  const joinBtn = document.getElementById('joinOnlineGameBtn');
  const leaveBtn = document.getElementById('leaveOnlineGameBtn');
  const relayInput = document.getElementById('relayUrlInput');
  if (hostBtn && !hostBtn.dataset.wired) {
    hostBtn.dataset.wired = 'true';
    hostBtn.addEventListener('click', hostOnlineGame);
  }
  if (joinBtn && !joinBtn.dataset.wired) {
    joinBtn.dataset.wired = 'true';
    joinBtn.addEventListener('click', joinOnlineGame);
  }
  if (leaveBtn && !leaveBtn.dataset.wired) {
    leaveBtn.dataset.wired = 'true';
    leaveBtn.addEventListener('click', leaveOnlineGame);
  }
  if (relayInput && !relayInput.dataset.wired) {
    relayInput.dataset.wired = 'true';
    relayInput.value = warbornRelayUrl;
    relayInput.addEventListener('input', () => { relayInput.dataset.touched = 'true'; });
  }
  updateOnlineRoomFields();
}

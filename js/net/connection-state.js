// Warborn source split from the original game.js.
// Section: js/net/connection-state.js

// Heartbeat system to detect disconnections
function startHeartbeat() {
  if (typeof OnlineMatch !== "undefined" && OnlineMatch.active) return;
  // Only start heartbeat for human opponents
  if (opponentType === 'AI') {
    console.log('Skipping heartbeat - playing against AI');
    return;
  }
  
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - lastHeartbeat;
    
    try {
      if (typeof sendRelayMessage === 'function' && warbornSocketConnected) {
        sendRelayMessage({ type: 'heartbeat', gameId, timestamp: now, role: myRole });
      } else {
        if (!window.parent || window.parent === window) return;
        window.parent.postMessage({ 
          type: 'heartbeat', 
          gameId,
          timestamp: now,
          role: myRole
        }, '*');
      }
    } catch(e) {
      console.warn('Heartbeat failed:', e);
      handleConnectionLoss();
    }
    
    // Check if we haven't received a heartbeat response in too long
    if (timeSinceLastHeartbeat > 10000) { // 10 seconds
      console.warn('No heartbeat response for 10s - connection may be lost');
      handleConnectionLoss();
    }
  }, 3000); // Send heartbeat every 3 seconds
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function handleConnectionLoss() {
  if (isReconnecting) return;
  
  // Don't handle connection loss for AI games
  if (opponentType === 'AI') {
    console.log('Ignoring connection loss - playing against AI');
    return;
  }
  
  isConnectedToHub = false;
  console.warn('Connection to hub lost - attempting to reconnect');
  
  // Show connection status in UI
  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    statusEl.textContent = 'Connection lost - reconnecting...';
    statusEl.style.color = '#ff6b6b';
  }
  
  attemptReconnection();
}

function attemptReconnection() {
  // Don't attempt reconnection for AI games
  if (opponentType === 'AI') {
    console.log('Skipping reconnection attempt - playing against AI');
    return;
  }
  
  if (connectionRetryCount >= maxRetries) {
    console.error('Max reconnection attempts reached');
    showConnectionError();
    return;
  }
  
  isReconnecting = true;
  connectionRetryCount++;
  
  setTimeout(() => {
    console.log(`Reconnection attempt ${connectionRetryCount}/${maxRetries}`);
    
    // Try to re-establish connection
    if (typeof connectRelay === 'function' && gameId) {
      try {
        connectRelay({ type: 'reconnect', gameId, role: myRole, clientId: localClientId });
        lastHeartbeat = Date.now();
        isReconnecting = false;
      } catch(e) {
        console.warn('Relay reconnection failed:', e);
        isReconnecting = false;
        attemptReconnection();
      }
    } else if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ 
          type: 'reconnect', 
          gameId,
          role: myRole,
          clientId: localClientId
        }, '*');
        
        // Reset heartbeat
        lastHeartbeat = Date.now();
        isReconnecting = false;
        
        // If successful, reset retry count
        setTimeout(() => {
          if (isConnectedToHub) {
            connectionRetryCount = 0;
            updateConnectionStatus('Connected', '#4ecdc4');
          }
        }, 2000);
        
      } catch(e) {
        console.warn('Reconnection failed:', e);
        isReconnecting = false;
        attemptReconnection();
      }
    } else {
      isReconnecting = false;
      attemptReconnection();
    }
  }, 2000 * connectionRetryCount); // Exponential backoff
}

function showConnectionError() {
  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    statusEl.textContent = 'Connection failed - please refresh';
    statusEl.style.color = '#ff4757';
  }
  
  // Could show a modal here for better UX
  console.error('Connection permanently lost - user should refresh');
}

function updateConnectionStatus(message, color) {
  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = color;
  }
}

// Optimistic update system
function saveGameState() {
  const state = {
    timestamp: Date.now(),
    units: JSON.parse(JSON.stringify(units)),
    settlements: JSON.parse(JSON.stringify(settlements)),
    terrain: JSON.parse(JSON.stringify(terrain)),
    resources: JSON.parse(JSON.stringify(resources)),
    currentTeam: currentTeam,
    gameOver: gameOver
  };
  
  gameStateHistory.push(state);
  if (gameStateHistory.length > maxHistorySize) {
    gameStateHistory.shift();
  }
  
  return state;
}

function createOptimisticUpdate(actionType, actionData) {
  const actionId = `${localClientId}_${++actionIdCounter}_${Date.now()}`;
  const originalState = saveGameState();
  
  pendingUpdates.set(actionId, {
    actionType,
    actionData,
    originalState,
    timestamp: Date.now()
  });
  
  // Clean up old pending updates (older than 30 seconds)
  const thirtySecondsAgo = Date.now() - 30000;
  for (const [id, update] of pendingUpdates) {
    if (update.timestamp < thirtySecondsAgo) {
      console.warn('Removing stale pending update:', id);
      pendingUpdates.delete(id);
    }
  }
  
  return actionId;
}

function confirmOptimisticUpdate(actionId) {
  if (pendingUpdates.has(actionId)) {
    console.debug('Confirmed optimistic update:', actionId);
    pendingUpdates.delete(actionId);
  }
}

function rollbackOptimisticUpdate(actionId) {
  const update = pendingUpdates.get(actionId);
  if (!update) {
    console.warn('Cannot rollback - update not found:', actionId);
    return false;
  }
  
  console.warn('Rolling back optimistic update:', actionId, update.actionType);
  /**
  // Restore the original state
  units = JSON.parse(JSON.stringify(update.originalState.units));
  settlements = JSON.parse(JSON.stringify(update.originalState.settlements));
  terrain = JSON.parse(JSON.stringify(update.originalState.terrain));
  resources = JSON.parse(JSON.stringify(update.originalState.resources));
  currentTeam = update.originalState.currentTeam;
  gameOver = update.originalState.gameOver;
  
  pendingUpdates.delete(actionId);
  selectedUnit = null;
  updateUI();
  **/
  return true;
}

function rollbackAllPendingUpdates() {
  console.warn('Rolling back all pending updates');
  const sortedUpdates = Array.from(pendingUpdates.entries())
    .sort((a, b) => b[1].timestamp - a[1].timestamp); // Newest first
  
  for (const [actionId] of sortedUpdates) {
    rollbackOptimisticUpdate(actionId);
  }
}

// Input validation for incoming game state
function validateGameStateMessage(msg) {
  if (!msg || typeof msg !== 'object') return false;
  
  // Normalize snapshot object
  let snapshot = null;
  if(msg.data && msg.data.snapshot) snapshot = msg.data.snapshot;
  else if(msg.data && (msg.data.units || msg.data.settlements || msg.data.currentTeam || msg.data.ts)) snapshot = msg.data;
  else snapshot = msg;
  
  if (!snapshot) return false;
  
  // Validate timestamp
  if (snapshot.ts && (typeof snapshot.ts !== 'number' || snapshot.ts < 0 || snapshot.ts > Date.now() + 60000)) {
    console.warn('Invalid timestamp in gameState:', snapshot.ts);
    return false;
  }
  
  // Validate units array
  if (snapshot.units && !Array.isArray(snapshot.units)) {
    console.warn('Invalid units array in gameState');
    return false;
  }
  
  if (snapshot.units) {
    for (const unit of snapshot.units) {
      if (!validateUnit(unit)) {
        console.warn('Invalid unit in gameState:', unit);
        return false;
      }
    }
  }
  
  // Validate settlements array
  if (snapshot.settlements && !Array.isArray(snapshot.settlements)) {
    console.warn('Invalid settlements array in gameState');
    return false;
  }
  
  // Validate currentTeam
  if (snapshot.currentTeam && !['PLAYER', 'PLAYER2', 'AI'].includes(snapshot.currentTeam)) {
    console.warn('Invalid currentTeam in gameState:', snapshot.currentTeam);
    return false;
  }
  
  // Validate resources
  if (snapshot.resources && typeof snapshot.resources !== 'object') {
    console.warn('Invalid resources in gameState:', snapshot.resources);
    return false;
  }
  
  return true;
}

function validateUnit(unit) {
  if (!unit || typeof unit !== 'object') return false;
  
  // Required fields
  if (typeof unit.name !== 'string' || unit.name.length === 0) return false;
  if (!['PLAYER', 'PLAYER2', 'AI'].includes(unit.team)) return false;
  if (typeof unit.col !== 'number' || unit.col < 0 || unit.col >= COLS) return false;
  if (typeof unit.row !== 'number' || unit.row < 0 || unit.row >= ROWS) return false;
  if (typeof unit.hp !== 'number' || unit.hp < 0) return false;
  if (typeof unit.maxHp !== 'number' || unit.maxHp <= 0 || unit.hp > unit.maxHp) return false;
  
  // Optional fields with validation
  if (unit.morale !== undefined && (typeof unit.morale !== 'number' || unit.morale < 0)) return false;
  if (unit.cost !== undefined) {
    if (typeof unit.cost === 'number') {
      if (unit.cost < 0) return false;
    } else if (typeof unit.cost === 'object') {
      if (unit.cost.food < 0 || unit.cost.gold < 0 || unit.cost.materials < 0) return false;
    } else {
      return false; // Cost must be number or object
    }
  }
  
  return true;
}

function ensureGameIdModal(){
  if(gameIdModalOverlay) return gameIdModalOverlay;
  try{
    const overlay = document.createElement('div');
    overlay.id = 'gameIdModalOverlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0'; overlay.style.top = '0'; overlay.style.right = '0'; overlay.style.bottom = '0';
    overlay.style.background = 'rgba(4,6,10,0.85)';
    overlay.style.display = 'none';
    overlay.style.zIndex = 100000;
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.flexDirection = 'column';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'auto';
    overlay.style.display = 'none';
    overlay.style.display = 'flex';

    const modal = document.createElement('div');
    modal.id = 'gameIdModal';
    modal.style.maxWidth = '720px';
    modal.style.width = 'min(92%,720px)';
    modal.style.background = '#071225';
    modal.style.color = '#e6eef6';
    modal.style.padding = '28px';
    modal.style.borderRadius = '12px';
    modal.style.textAlign = 'center';
    modal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.6)';

    const title = document.createElement('div');
    title.style.fontSize = '20px'; title.style.fontWeight = '700'; title.style.marginBottom = '12px';
    title.textContent = 'Waiting for opponent to join';

    const subtitle = document.createElement('div');
    subtitle.style.fontSize = '14px'; subtitle.style.color = '#9aa6b2'; subtitle.style.marginBottom = '18px';
    subtitle.textContent = 'Share this game ID with your friend so they can join.';

    const idBlock = document.createElement('div');
    idBlock.style.fontSize = '28px'; idBlock.style.fontWeight = '800'; idBlock.style.letterSpacing = '1px'; idBlock.style.marginBottom = '12px';
    idBlock.id = 'gameIdModalCode';

    const urlBlock = document.createElement('div');
    urlBlock.style.fontSize = '13px'; urlBlock.style.color = '#9aa6b2'; urlBlock.style.marginBottom = '16px';
    urlBlock.id = 'gameIdModalURL';

    const btnRow = document.createElement('div'); btnRow.style.display='flex'; btnRow.style.justifyContent='center'; btnRow.style.gap='10px';
    const copyBtn = document.createElement('button'); copyBtn.className='btn'; copyBtn.textContent='Copy ID';
    copyBtn.onclick = () => {
      if(!gameId) return;
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(gameId); }
      else { const ta=document.createElement('textarea'); ta.value=gameId; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      copyBtn.textContent='Copied!'; setTimeout(()=>copyBtn.textContent='Copy ID',1200);
    };
  const closeBtn = document.createElement('button'); closeBtn.className='small'; closeBtn.textContent='Close';
  // Allow the user to manually dismiss the modal; set a flag so it doesn't immediately reappear
  closeBtn.disabled = false; closeBtn.style.opacity = '1';
  closeBtn.onclick = ()=>{ try{ modalManuallyClosed = true; overlay.style.display = 'none'; } catch(e){} };

    btnRow.appendChild(copyBtn); btnRow.appendChild(closeBtn);

    const note = document.createElement('div'); note.style.fontSize='12px'; note.style.color='#9aa6b2'; note.style.marginTop='12px';
    note.textContent = 'This modal will remain until the other player connects.';

    modal.appendChild(title); modal.appendChild(subtitle); modal.appendChild(idBlock); modal.appendChild(urlBlock); modal.appendChild(btnRow); modal.appendChild(note);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    gameIdModalOverlay = overlay;
  }catch(e){ console.warn('Failed to create gameId modal', e); }
  return gameIdModalOverlay;
}

function updateGameIdModal(){
  try{
    // Only show modal for human opponent games
    if(!gameId) return;
    if(opponentType !== 'HUMAN') return;
    const overlay = ensureGameIdModal(); if(!overlay) return;
    const players = window.hexPlayers || {};
    const p2 = players.P2;
    const modalCode = document.getElementById('gameIdModalCode');
    const modalURL = document.getElementById('gameIdModalURL');
    const closeBtn = overlay.querySelector('button.small');
    if(modalCode) modalCode.textContent = gameId;
    if(modalURL){
      try{
        const joinUrl = location.origin + location.pathname + '?gameId=' + encodeURIComponent(gameId) + (opponentType ? '&opponent=HUMAN' : '');
        modalURL.textContent = joinUrl;
      }catch(e){ modalURL.textContent = '' }
    }
  // Show overlay if P2 not connected. Be permissive: some hubs send name/id instead of a boolean
  const connected = !!(p2 && (p2.connected || p2.name || p2.id || p2.uid || p2.online));
  // Respect manual close by user: if they closed it manually, don't re-show until reload
  if(modalManuallyClosed){ overlay.style.display = 'none'; return; }
  if(!connected){ overlay.style.display = 'flex'; }
  else { overlay.style.display = 'none'; }
  }catch(e){ console.warn('updateGameIdModal failed', e); }
}

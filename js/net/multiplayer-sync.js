// Warborn source split from the original game.js.
// Section: js/net/multiplayer-sync.js

// Send a minimal game state snapshot to the parent/hub for persistence/broadcast.
function postGameState(actionId = null, retryCount = 0){
  if (typeof OnlineMatch !== "undefined" && OnlineMatch.playing) return OnlineMatch.publish(actionId);
  const maxRetries = 3;
  const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff
  
  try{
    // Don't sync state for AI games
    if (opponentType === 'AI') {
      console.debug('Skipping state sync - playing against AI');
      if (actionId) confirmOptimisticUpdate(actionId); // Confirm the action since no network sync needed
      return;
    }
    
    const gid = gameId || (new URLSearchParams(window.location.search)).get('gameId');
    if (!gid) {
      console.debug('No gameId - skipping state sync');
      if (actionId) rollbackOptimisticUpdate(actionId);
      return;
    }
    
    const snapshot = {
      type: 'gameState',
      gameId: gid,
      ts: Date.now(),
      senderId: localClientId,
      actionId: actionId, // Include actionId for optimistic update tracking
      currentTeam: currentTeam,
      resources: resources,
      diplomacy: diplomacy,
      victoryCondition: currentVictoryCondition,
      gameOver: gameOver,
      units: units.map(u => ({ 
        id: u.id, name: u.name, team: u.team, col: u.col, row: u.row, 
        hp: u.hp, maxHp: u.maxHp, morale: u.morale, 
        hasMoved: u.hasMoved, hasActed: u.hasActed, 
        cost: u.cost, atkRange: u.atkRange, move: u.move, dmg: u.dmg
      })),
      settlements: settlements,
      terrain: terrain
    };
    
    lastSnapshotTs = snapshot.ts;
    console.debug('postGameState ->', gid, 'units=', snapshot.units.length, 'team=', currentTeam, 'actionId=', actionId);
    if (typeof sendRelayMessage === 'function' && warbornSocketConnected) {
      sendRelayMessage(JSON.parse(JSON.stringify(snapshot)));
    } else if(!window.parent || window.parent === window) {
      console.debug('No parent window available for multiplayer sync');
      if (actionId) rollbackOptimisticUpdate(actionId);
      return;
    } else {
      window.parent.postMessage(JSON.parse(JSON.stringify(snapshot)), '*');
    }
    
    // Set up confirmation timeout for optimistic updates
    if (actionId) {
      setTimeout(() => {
        if (pendingUpdates.has(actionId)) {
          console.warn('Action not confirmed after 5s, considering it failed:', actionId);
          rollbackOptimisticUpdate(actionId);
        }
      }, 5000);
    }
    
  }catch(e){ 
    console.error('postGameState failed:', e, 'retryCount:', retryCount);
    
    if (retryCount < maxRetries) {
      console.log(`Retrying postGameState in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
      setTimeout(() => {
        postGameState(actionId, retryCount + 1);
      }, retryDelay);
    } else {
      console.error('Max retries reached for postGameState');
      if (actionId) {
        console.warn('Rolling back failed action:', actionId);
        rollbackOptimisticUpdate(actionId);
      }
      handleConnectionLoss();
    }
  }
}

// Consolidated message handler for all multiplayer communication
window.addEventListener('message', (ev) => {
  if (typeof OnlineMatch !== 'undefined' && OnlineMatch.active) return;
  const msg = ev.data || {};
  if (!msg || !msg.type) return;

  // Handle different message types
  switch (msg.type) {
    case 'heartbeatResponse':
      // Update connection status (only for human opponents)
      if (opponentType === 'HUMAN') {
        lastHeartbeat = Date.now();
        isConnectedToHub = true;
        connectionRetryCount = 0;
        isReconnecting = false;
        updateConnectionStatus('Connected', '#4ecdc4');
      }
      return;
      
    case 'actionConfirmation':
      // Confirm optimistic update
      if (msg.actionId) {
        confirmOptimisticUpdate(msg.actionId);
      }
      return;
      
    case 'actionRejected':
      // Rollback optimistic update
      if (msg.actionId) {
        console.warn('Action rejected by server:', msg.actionId, msg.reason);
        rollbackOptimisticUpdate(msg.actionId);
      }
      return;
      
    case 'endTurn':
      // Advance the game turn when parent requests it
      endTurn();
      return;
      
    case 'playerJoined':
    case 'dismissJoinModal':
      try{
        // Update internal players structure to reflect connection (best-effort)
        if(!window.hexPlayers) window.hexPlayers = {};
        window.hexPlayers.P2 = window.hexPlayers.P2 || {};
        window.hexPlayers.P2.connected = true;
        // Hide the modal immediately
        updateGameIdModal();
      }catch(e){ console.warn('playerJoined handler failed', e); }
      return;
      
    case 'connectionLost':
      handleConnectionLoss();
      return;
      
    case 'forceSync':
      // Force a full state sync
      try { postGameState(); } catch(e) { console.warn('Force sync failed:', e); }
      return;
      
    case 'gameState':
      // Apply incoming full gameState snapshots broadcast by the hub
      break; // Continue to gameState handling below
      
    default:
      console.debug('Unknown message type:', msg.type);
      return; // Ignore unknown message types
  }
  
    // GameState handling with enhanced validation
  try{
    // Accept multiple wrapping shapes: msg.data may be the snapshot, or msg.data.snapshot, or msg itself may contain units
    const incomingGameId = msg.gameId || (msg.data && (msg.data.gameId || msg.data.snapshot && msg.data.snapshot.gameId)) || null;
    const localGid = (new URLSearchParams(window.location.search)).get('gameId');
    if(localGid && incomingGameId && String(localGid) !== String(incomingGameId)) return;

    // Validate message structure
    if (!validateGameStateMessage(msg)) {
      console.warn('Invalid gameState message structure:', msg);
      return;
    }    // Normalize snapshot object
    let snapshot = null;
    if(msg.data && msg.data.snapshot) snapshot = msg.data.snapshot;
    else if(msg.data && (msg.data.units || msg.data.settlements || msg.data.currentTeam || msg.data.ts)) snapshot = msg.data;
    else snapshot = msg;

    console.debug('incoming gameState normalized snapshot:', snapshot && (snapshot.gameId || snapshot.ts));

    // Determine sender and timestamp
    const incomingSender = snapshot && (snapshot.senderId || msg.senderId || msg.data && msg.data.senderId) || null;
    const incomingTs = snapshot && (snapshot.ts || msg.ts || (msg.data && msg.data.ts)) || null;

    // Ignore snapshots that were sent by ourselves to avoid re-applying our own broadcast
    if (incomingSender && incomingSender === localClientId) return;

    // If timestamp exists, use it for freshness checks. If missing, accept anyway but log.
    if (incomingTs && incomingTs < lastSnapshotTs) {
      console.debug('Incoming snapshot older than last applied - ignoring', incomingTs, lastSnapshotTs);
      return;
    }

    // Apply settlements
    if(snapshot && Array.isArray(snapshot.settlements)){
      settlements = snapshot.settlements.slice();
    } else {
      settlements = Array(COLS * ROWS).fill(null);
    }
    
    if(snapshot && snapshot.resources && typeof snapshot.resources === 'object') {
      resources = JSON.parse(JSON.stringify(snapshot.resources));
    }
    
    if(snapshot && Array.isArray(snapshot.terrain)) {
      terrain = snapshot.terrain.slice();
    }
    
    if(snapshot && snapshot.diplomacy && typeof snapshot.diplomacy === 'object') {
      diplomacy = JSON.parse(JSON.stringify(snapshot.diplomacy));
    }
    
    if(snapshot && snapshot.victoryCondition && typeof snapshot.victoryCondition === 'object') {
      currentVictoryCondition = normalizeVictoryCondition(snapshot.victoryCondition);
    }

    // Rebuild units array from snapshot; support col/row or x/y naming, preserve id/team
    units = [];
    const unitList = Array.isArray(snapshot && snapshot.units) ? snapshot.units : (Array.isArray(msg.units) ? msg.units : []);
    unitList.forEach(inc => {
      try{
        const col = (typeof inc.col === 'number') ? inc.col : (typeof inc.x === 'number' ? inc.x : 0);
        const row = (typeof inc.row === 'number') ? inc.row : (typeof inc.y === 'number' ? inc.y : 0);
        const opts = {
          id: ('id' in inc) ? inc.id : undefined,
          hp: (typeof inc.hp !== 'undefined') ? inc.hp : (typeof inc.maxHp !== 'undefined' ? inc.maxHp : 1),
          maxHp: (typeof inc.maxHp !== 'undefined') ? inc.maxHp : ((typeof inc.hp !== 'undefined') ? inc.hp : 1),
          morale: (typeof inc.morale !== 'undefined') ? inc.morale : 100,
          cost: (typeof inc.cost !== 'undefined') ? inc.cost : 0
        };
        const team = (typeof inc.team === 'string') ? inc.team : (inc.team === null ? 'AI' : (msg.team || 'AI'));
        const u = makeUnit(inc.name || 'Unit', team, col, row, opts);
        u.hasMoved = !!inc.hasMoved; u.hasActed = !!inc.hasActed;
        u.morale = (typeof inc.morale !== 'undefined') ? inc.morale : u.morale;
        units.push(u);
      }catch(e){ console.warn('Failed to recreate unit from snapshot', inc, e); }
    });

    if(snapshot && snapshot.currentTeam) currentTeam = snapshot.currentTeam;

    // Update lastSnapshotTs so future incoming snapshots are compared
    if(incomingTs) lastSnapshotTs = Math.max(lastSnapshotTs, incomingTs);

    // Clear selection and refresh UI
    selectedUnit = null;
    updateUI();
  }catch(e){ console.warn('Failed to apply incoming gameState', e); }
});

// Notify parent window about current turn whenever it changes
let __lastNotifiedTurn = null;
const turnUpdateInterval = setInterval(() => {
  if (currentTeam !== __lastNotifiedTurn) {
    try {
      if (typeof sendRelayMessage === 'function' && warbornSocketConnected) {
        sendRelayMessage({ type: 'turnUpdate', current: currentTeam, gameId, role: myRole });
      } else if (window.parent) {
        window.parent.postMessage({ type: 'turnUpdate', current: currentTeam }, '*');
      }
    } catch (e) {}
    __lastNotifiedTurn = currentTeam;
  }
}, 300);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  stopHeartbeat();
  if (turnUpdateInterval) clearInterval(turnUpdateInterval);
  
  // Notify parent about disconnection
  if (typeof sendRelayMessage === 'function' && warbornSocketConnected) {
    try {
      sendRelayMessage({
        type: 'clientDisconnecting',
        gameId,
        role: myRole,
        clientId: localClientId
      });
    } catch(e) {}
  } else if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ 
        type: 'clientDisconnecting', 
        gameId,
        role: myRole,
        clientId: localClientId
      }, '*');
    } catch(e) {}
  }
});

// Handle visibility changes (tab switching, etc.)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page became hidden - reduce heartbeat frequency
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (typeof sendRelayMessage === 'function' && warbornSocketConnected) {
          sendRelayMessage({ type: 'heartbeat', gameId, timestamp: Date.now(), role: myRole, hidden: true });
          return;
        }
        if (!window.parent || window.parent === window) return;
        try {
          window.parent.postMessage({ 
            type: 'heartbeat', 
            gameId,
            timestamp: Date.now(),
            role: myRole,
            hidden: true
          }, '*');
        } catch(e) {}
      }, 10000); // 10 second intervals when hidden
    }
  } else {
    // Page became visible - restore normal heartbeat
    startHeartbeat();
  }
});

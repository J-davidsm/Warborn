// Warborn source split from the original game.js.
// Section: js/boot/p5-setup.js

function setup(){
  const canvasSize = getGameCanvasSize();
  const canvas = createCanvas(canvasSize.w, canvasSize.h).parent('game');
  
  // Make canvas focusable and add focus/blur handlers
  canvas.elt.tabIndex = 0; // Make canvas focusable
  canvas.elt.style.outline = 'none'; // Remove default focus outline
  canvas.elt.style.border = '0';
  canvas.elt.style.borderRadius = '0';
  canvas.elt.style.transition = 'box-shadow 0.2s ease';
  
  canvas.elt.addEventListener('focus', () => {
    mapCanvasFocused = true;
    canvas.elt.style.boxShadow = 'inset 0 0 0 2px rgba(78,205,196,0.45)';
  });
  
  canvas.elt.addEventListener('blur', () => {
    mapCanvasFocused = false;
    canvas.elt.style.boxShadow = 'none';
  });
  
  canvas.elt.addEventListener('click', () => {
    canvas.elt.focus(); // Focus canvas when clicked
  });
  
  // Initialize multiplayer connection system only for human opponents
  if (window.parent && window.parent !== window && opponentType === 'HUMAN') {
    startHeartbeat();
    isConnectedToHub = true;
    document.getElementById('connectionStatus').style.display = 'block';
    updateConnectionStatus('Connecting...', '#ffa726');
    
    // Initial connection attempt
    setTimeout(() => {
      if (isConnectedToHub) {
        updateConnectionStatus('Connected', '#4ecdc4');
      }
    }, 2000);
  } else if (opponentType === 'AI') {
    // For AI games, hide connection status entirely
    document.getElementById('connectionStatus').style.display = 'none';
  }
  
  turnLabelEl=select('#turnLabel'); selNameEl=select('#selName');
  selDetailsEl=select('#selDetails'); selHPEl=select('#selHP');
  selNumsEl=select('#selNums');
  editorModeBtn=select('#editorModeBtn');
  wireEditorModeButton();
  select('#endTurnBtn').mousePressed(()=>{if(!gameOver)endTurn();});
  select('#restartBtn').mousePressed(()=>{
    if (campaignMode.active) {
      loadCurrentScenario(); // Restart current scenario
    } else {
      setupGame(); // Normal restart
    }
  });
  
  
  // Add convert teams button for debugging
  select('#convertTeamsBtn').mousePressed(() => {
    console.log('DEBUG: Manual team conversion triggered');
    units.forEach(unit => {
      if (unit.team === 'AI') {
        console.log('DEBUG: Converting', unit.name, 'from AI to PLAYER2');
        unit.team = 'PLAYER2';
      }
    });
    updateUI();
  });
  
  select('#gameModeSelect').value(gameMode);
  
  // Initialize UI controls based on current game mode
  switchGameMode(gameMode);
  
  // Initialize AI count display
  const aiCountDisplay = select('#aiCountDisplay');
  if (aiCountDisplay) {
    aiCountDisplay.html(currentAIPlayers.toString());
  }
  // Initialize settlements and terrain arrays with correct size
  if (!settlements) settlements = Array(COLS * ROWS).fill(null);
  if (!terrain) terrain = Array(COLS * ROWS).fill(null);
  
  // Editor controls
  select('#decSizeBtn').mousePressed(() => updateMapSize(-1));
  select('#incSizeBtn').mousePressed(() => updateMapSize(1));
  
  // Initialize terrain controls
  select('#woodsBtn').mousePressed(() => setTerrainType('WOODS'));
  select('#mountainBtn').mousePressed(() => setTerrainType('MOUNTAIN'));
  select('#swampBtn').mousePressed(() => setTerrainType('SWAMP'));
  select('#desertBtn').mousePressed(() => setTerrainType('DESERT'));
  select('#waterBtn').mousePressed(() => setTerrainType('WATER'));
  select('#fountainBtn').mousePressed(() => setTerrainType('FOUNTAIN'));
  select('#farmBtn').mousePressed(() => setTerrainType('FARM'));
  select('#bridgeBtn').mousePressed(() => setTerrainType('BRIDGE'));
  select('#clearTerrainBtn').mousePressed(() => setTerrainType('CLEAR'));
  select('#saveLevelBtn').mousePressed(saveLevel);
  select('#loadLevelBtn').mousePressed(loadLevel);
  select('#saveNamedLevelBtn').mousePressed(saveNamedLevel);
  
  // Setup unit placement buttons
  // Unit buttons: use selected team from the teamSelect dropdown
  // selectedTeam will be read when placing units
  select('#soldierBtn').mousePressed(() => setPlacingUnit('Soldier', selectedTeam));
  select('#archerBtn').mousePressed(() => setPlacingUnit('Archer', selectedTeam));
  select('#knightBtn').mousePressed(() => setPlacingUnit('Knight', selectedTeam));
  select('#catapultBtn').mousePressed(() => setPlacingUnit('Catapult', selectedTeam));
  select('#spearmanBtn').mousePressed(() => setPlacingUnit('Spearman', selectedTeam));
  select('#swordsmanBtn').mousePressed(() => setPlacingUnit('Swordsman', selectedTeam));
  select('#assassinBtn').mousePressed(() => setPlacingUnit('Assassin', selectedTeam));
  select('#dragonBtn').mousePressed(() => setPlacingUnit('Dragon', selectedTeam));
  select('#clericBtn').mousePressed(() => setPlacingUnit('Cleric', selectedTeam));
  select('#crownBtn').mousePressed(() => setPlacingUnit('Crown', selectedTeam));
  select('#stockadeBtn').mousePressed(() => setPlacingUnit('Stockade', selectedTeam));
  select('#castleBtn').mousePressed(() => setPlacingUnit('Castle', selectedTeam));
  select('#heavyFortressBtn').mousePressed(() => setPlacingUnit('Heavy Fortress', selectedTeam));
  // Update unit palette labels to include cost (read from makeUnit defaults)
  try {
    const paletteMap = [
      ['#soldierBtn','Soldier'], ['#archerBtn','Archer'], ['#knightBtn','Knight'], ['#catapultBtn','Catapult'],
      ['#spearmanBtn','Spearman'], ['#swordsmanBtn','Swordsman'], ['#assassinBtn','Assassin'], ['#dragonBtn','Dragon'], ['#clericBtn','Cleric'], 
      ['#stockadeBtn','Stockade'], ['#castleBtn','Castle'], ['#heavyFortressBtn','Heavy Fortress']
    ];
    paletteMap.forEach(([sel,name])=>{
      const btn = select(sel);
      if(btn){
        const unitCost = makeUnit(name,'PLAYER',0,0).cost || 1;
        // Format cost display - handle both single cost and two-resource cost
        let costDisplay;
        if (typeof unitCost === 'number') {
          costDisplay = unitCost; // Single resource cost
        } else {
          const parts = [];
          if (unitCost.gold > 0) parts.push(`${unitCost.gold}G`);
          if (unitCost.materials > 0) parts.push(`${unitCost.materials}M`);
          costDisplay = parts.join('/') || '0';
        }
        // Keep existing emoji / label from HTML, but append cost
        const text = btn.html().split('</')[0]; // attempt to preserve emoji label (best-effort)
        btn.html(`${btn.html()} <span style="color:var(--muted);font-size:11px;">(${costDisplay})</span>`);
      }
    });
  } catch(e){ /* ignore if makeUnit not available yet */ }
  // Initialize and wire team select
  const teamSelect = select('#teamSelect');
  if (teamSelect) {
    // Configure options depending on opponent type
    if (opponentType === 'AI') {
      teamSelect.html('<option value="PLAYER">Player</option><option value="AI">AI</option>');
      selectedTeam = 'PLAYER';
    } else {
      teamSelect.html('<option value="PLAYER">Player</option><option value="PLAYER2">Player 2</option>');
      selectedTeam = 'PLAYER';
    }
    teamSelect.value(selectedTeam);
    teamSelect.changed(() => {
      selectedTeam = teamSelect.value();
      if (select('#placingLabel') && placingUnitType) select('#placingLabel').html('Selected: ' + placingUnitType + ' (' + selectedTeam + ')');
      if (select('#placingLabel') && placingSettlement && placingSettlement !== 'CLEAR') select('#placingLabel').html('Selected: ' + placingSettlement + ' (' + getTeamDisplayName(selectedTeam) + ')');
    });
  }
  // team select wiring below (initialized further down)

  // Settlement buttons
  select('#hamletBtn').mousePressed(() => setPlacingSettlement('HAMLET'));
  select('#villageBtn').mousePressed(() => setPlacingSettlement('VILLAGE'));
  select('#cityBtn').mousePressed(() => setPlacingSettlement('CITY'));
  select('#portBtn').mousePressed(() => setPlacingSettlement('PORT'));
  select('#clearSettlementBtn').mousePressed(() => setPlacingSettlement('CLEAR'));

  // ensure placingLabel exists
  if(!select('#placingLabel')){
    const pl = createDiv('Selected: None'); pl.id('placingLabel'); pl.parent(select('#editorControls'));
  }
  // Try to load saved level data
  const savedLevel = localStorage.getItem('customLevel');
  if(savedLevel) {
    select('#loadLevelBtn').style('display', 'block');
  }

  // Ensure mapSize label and tile sizing are consistent
  COLS = mapSize.cols;
  ROWS = mapSize.rows;
  TILE = BOARD_SIZE / COLS;
  updateHexSize();
  select('#mapSizeLabel').html(`${mapSize.cols} x ${mapSize.rows}`);
  
  updateTeamSelector(); // Initialize team selector with correct options

  console.log('Setup values:', { BOARD_SIZE, COLS, ROWS, TILE, canvasW: width, canvasH: height });

  // Saved levels UI
  refreshSavedLevelsList();
  
  // Load saved Learning AI data
  const learningDataLoaded = loadLearningAIData();
  if (learningDataLoaded) {
    console.log('Learning AI data loaded from localStorage');
  }
  
  setupGame(); frameRate(30);
  wireMainMenu();
  wireEndScreenButtons();
  wireVictoryEditor();
  wireEditorDrawerTab();
  wireOnlineMultiplayerControls();
  
  // Initialize collapsible sections for editor mode
  initializeCollapsibleSections();

  // Create a small gameId badge (hidden by default). It will be shown when the page is fullscreen.
  try {
    let gidBadge = document.getElementById('gameIdBadge');
    if(!gidBadge){
      gidBadge = document.createElement('div');
      gidBadge.id = 'gameIdBadge';
      gidBadge.style.position = 'fixed';
      gidBadge.style.left = '12px';
      gidBadge.style.bottom = '12px';
      gidBadge.style.padding = '8px 10px';
      gidBadge.style.background = 'rgba(0,0,0,0.6)';
      gidBadge.style.color = '#fff';
      gidBadge.style.borderRadius = '8px';
      gidBadge.style.zIndex = 99999;
      gidBadge.style.fontSize = '13px';
      gidBadge.style.display = 'none';
      // Allow interaction so users can tap/click to copy
      gidBadge.style.pointerEvents = 'auto';
      gidBadge.style.cursor = 'pointer';
      gidBadge.setAttribute('role','button');
      gidBadge.setAttribute('tabindex','0');
      gidBadge.title = 'Tap to copy game ID';
      document.body.appendChild(gidBadge);

      // Copy helper with fallback
      function copyTextToClipboard(text){
        if(!text) return Promise.reject('no text');
        if(navigator.clipboard && navigator.clipboard.writeText){
          return navigator.clipboard.writeText(text);
        }
        // Fallback: textarea + execCommand
        return new Promise((resolve, reject) => {
          try{
            const ta = document.createElement('textarea'); ta.value = text;
            ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta);
            ta.select(); ta.setSelectionRange(0, ta.value.length);
            const ok = document.execCommand('copy'); ta.remove(); if(ok) resolve(); else reject('execCommand failed');
          } catch(err){ reject(err); }
        });
      }

      // Click/tap handler to copy the gameId and show a temporary feedback message
      gidBadge.addEventListener('click', (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        if(!gameId) return;
        copyTextToClipboard(gameId).then(()=>{
          const prev = gidBadge.textContent;
          gidBadge.textContent = 'Copied!';
          setTimeout(()=>{ gidBadge.textContent = 'Game ID: ' + gameId; }, 1400);
        }).catch(()=>{
          // fallback UI
          const prev = gidBadge.textContent;
          gidBadge.textContent = 'Copy failed';
          setTimeout(()=>{ gidBadge.textContent = prev; }, 1400);
        });
      });

      // keyboard support (Enter/Space)
      gidBadge.addEventListener('keydown', (ev) => {
        if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); gidBadge.click(); }
      });
    }
    function updateGidBadge(){
      const el = document.getElementById('gameIdBadge'); if(!el) return;
      if(!gameId) { el.style.display = 'none'; return; }
      el.textContent = 'Game ID: ' + gameId;
      // Show only when in fullscreen
      const fs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      el.style.display = fs ? 'block' : 'none';
    }
    // Update on fullscreen changes
    ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(evt => {
      document.addEventListener(evt, updateGidBadge);
    });
    // Initial update (in case already fullscreen)
    updateGidBadge();
    // Update modal visibility on initial load
    try{ updateGameIdModal(); } catch(e){}
  } catch(e){ console.warn('Failed to create gameId badge', e); }
}

// Handle messages from parent
window.addEventListener('message',(ev)=>{
  if (typeof OnlineMatch !== 'undefined' && OnlineMatch.active) return;
  const msg = ev.data||{};
  if(msg.type==='setRole'){
    // role: 'P1' or 'P2', opponent: 'AI'|'HUMAN'
    if(msg.opponent) opponentType = msg.opponent;
    // If this client is P2 and opponent is HUMAN, allow manual turns
    if(msg.role==='P2' && opponentType==='HUMAN'){
      // set currentTeam so player can act when appropriate -- parent manages turns
      // Show waiting banner until both players connected
      myRole = 'P2';
      const wb = document.getElementById('waitingBanner'); if(wb) wb.style.display='block';
    }
  }
  if(msg.type==='playersUpdate'){
    // msg.players expected to be an object with P1 and P2 entries
    const players = msg.players || {};
    console.debug('playersUpdate received in iframe:', players);
    const wb = document.getElementById('waitingBanner');
    // If opponent type is HUMAN, hide waiting banner when P2.connected is true
    if(opponentType === 'HUMAN'){
      const p2 = players.P2;
      if(p2 && p2.connected) {
        if(wb) wb.style.display='none';
      } else {
        if(wb) wb.style.display='block';
      }
    }
    // If this client is P1 and P2 connected, parent may start the match; ensure currentTeam is correct
    if(players && players.P2 && players.P2.connected && myRole === 'P1'){
      // Ensure the UI reflects active state
      document.getElementById('turnLabel').textContent = currentTeam;
    }
    // If parent sent settlements or full gameData, apply normalized settlements to local state
    if (msg.settlements || (msg.gameData && msg.gameData.settlements)) {
      const incoming = msg.settlements || msg.gameData.settlements;
      if (Array.isArray(incoming)) {
        // Normalize to our internal object format
        settlements = Array(COLS * ROWS).fill(null);
        for (let i = 0; i < Math.min(incoming.length, settlements.length); i++) {
          const s = incoming[i];
          if (!s) { settlements[i] = null; }
          else if (typeof s === 'string') { settlements[i] = { type: s, owner: null }; }
          else if (typeof s === 'object') { settlements[i] = { type: s.type || null, owner: s.owner || null }; }
        }
        updateUI();
      }
    }
    // Keep a local copy of players for display (P1 -> PLAYER, P2/AI -> opponent)
    try { window.hexPlayers = players || {}; } catch (e) { window.hexPlayers = {}; }
    // Update join-code modal visibility when players change
    try{ updateGameIdModal(); } catch(e){}
  }
});

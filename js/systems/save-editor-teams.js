// Warborn source split from the original game.js.
// Section: js/systems/save-editor-teams.js

// Map internal team codes to friendly display names using latest players info from parent
function getTeamDisplayName(team) {
  if(team==='PLAYER3'||team==='PLAYER4')return window.hexPlayers?.['P'+team.slice(6)]?.name||'Player '+team.slice(6);
  try {
    const players = window.hexPlayers || {};
    if (team === 'PLAYER') return (players.P1 && players.P1.name) ? players.P1.name : 'Player 1';
    if (isAITeam(team)) {
      const idx = aiTeamNames.indexOf(team);
      return `AI${idx + 1}`;
    }
    // Treat AI or PLAYER2 as P2/opponent
    if (team === 'PLAYER2' || team === 'P2') return (players.P2 && players.P2.name) ? players.P2.name : (opponentType === 'AI' ? 'AI1' : 'Player 2');
    return team;
  } catch (e) { return team; }
}

function ensureGridValid(){
  // enforce sane bounds
  if(!isFinite(COLS) || COLS < 1) COLS = 4;
  if(!isFinite(ROWS) || ROWS < 1) ROWS = 4;
  COLS = constrain(round(COLS), 4, 50);
  ROWS = constrain(round(ROWS), 4, 50);
  mapSize = { cols: COLS, rows: ROWS };
  if(!isFinite(TILE) || TILE <= 0) TILE = BOARD_SIZE / COLS;
  // keep tile based on columns
  TILE = BOARD_SIZE / COLS;
  updateHexSize();
  
  // Ensure settlements array exists and has correct size
  if (!settlements || settlements.length !== COLS * ROWS) {
    const newSettlements = Array(COLS * ROWS).fill(null);
    if (settlements) {
      // Copy over any existing settlements that are in bounds
      const oldLength = settlements.length;
      const oldCols = floor(sqrt(oldLength)); // Estimate previous dimensions
      const oldRows = oldCols;
      for(let r = 0; r < Math.min(oldRows, ROWS); r++) {
        for(let c = 0; c < Math.min(oldCols, COLS); c++) {
          const oldIdx = r * oldCols + c;
          const newIdx = r * COLS + c;
          if (oldIdx < oldLength) {
            newSettlements[newIdx] = settlements[oldIdx];
          }
        }
      }
    }
    settlements = newSettlements;
  }
}

function saveLevel() {
  const terrainCount = terrain.filter(t => t !== null).length;
  console.log('DEBUG: Saving level - terrain array length:', terrain.length, 'non-null terrain tiles:', terrainCount);
  
  const levelData = createLevelData();
  
  console.log('DEBUG: Level data terrain preview:', terrain.slice(0, 10));
  localStorage.setItem('customLevel', JSON.stringify(levelData));
  select('#loadLevelBtn').style('display', 'block');
}

function loadLevel() {
  const savedLevel = localStorage.getItem('customLevel');
  if(!savedLevel) return;
  
  applyLevelData(JSON.parse(savedLevel));
  captureScenarioSnapshot();
}

// ---------- Enhanced Persistent Saved Levels System ----------
function getPersistentStorage() {
  // Try multiple storage methods for maximum persistence
  const methods = ['localStorage', 'sessionStorage', 'indexedDB'];
  
  // First try localStorage (most common)
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      return {
        type: 'localStorage',
        get: (key) => localStorage.getItem(key),
        set: (key, value) => localStorage.setItem(key, value),
        remove: (key) => localStorage.removeItem(key)
      };
    }
  } catch(e) {}
  
  // Fallback to sessionStorage
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem) {
      return {
        type: 'sessionStorage',
        get: (key) => sessionStorage.getItem(key),
        set: (key, value) => sessionStorage.setItem(key, value),
        remove: (key) => sessionStorage.removeItem(key)
      };
    }
  } catch(e) {}
  
  // Final fallback to memory storage (least persistent but works)
  const memoryStorage = {};
  return {
    type: 'memory',
    get: (key) => memoryStorage[key] || null,
    set: (key, value) => memoryStorage[key] = value,
    remove: (key) => delete memoryStorage[key]
  };
}

function getSavedLevels(){
  const storage = getPersistentStorage();
  try {
    // Try multiple keys for backwards compatibility and redundancy
    const legacyPrefix = 'micro' + 'Strategy';
    const keys = ['savedLevels', 'warborn_savedLevels', `${legacyPrefix}_savedLevels`, 'gameState_levels'];
    
    for (const key of keys) {
      const data = storage.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Found valid data, also save to other keys for redundancy
          keys.forEach(backupKey => {
            if (backupKey !== key) {
              try { storage.set(backupKey, data); } catch(e) {}
            }
          });
          return parsed;
        }
      }
    }
    
    return [];
  } catch(e) {
    console.warn('Failed to load saved levels:', e);
    return [];
  }
}

function setSavedLevels(list) {
  const storage = getPersistentStorage();
  const dataString = JSON.stringify(list);
  
  // Save to multiple keys for redundancy
  const keys = ['savedLevels', 'warborn_savedLevels', 'gameState_levels'];
  let successCount = 0;
  
  keys.forEach(key => {
    try {
      storage.set(key, dataString);
      successCount++;
    } catch(e) {
      console.warn(`Failed to save to ${key}:`, e);
    }
  });
  
  // Also try to save to a backup location in the browser
  try {
    // Create a downloadable backup file that user can save
    if (list.length > 0) {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        levels: list
      };
      
      // Store in a more persistent browser location
      const backupString = JSON.stringify(backupData);
      storage.set('warborn_backup', backupString);
      
      // Auto-download backup file every 5 saves
      const saveCount = parseInt(storage.get('warborn_saveCount') || '0') + 1;
      storage.set('warborn_saveCount', saveCount.toString());
      
      if (saveCount % 5 === 0) {
        createBackupFile(backupData);
      }
    }
  } catch(e) {
    console.warn('Backup creation failed:', e);
  }
  
  console.log(`Saved levels to ${successCount} storage locations`);
}

function createBackupFile(backupData) {
  try {
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `warborn_levels_${new Date().toISOString().split('T')[0]}.json`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    console.log('Backup file created successfully');
  } catch(e) {
    console.warn('Failed to create backup file:', e);
  }
}

function saveNamedLevel(){
  const nameEl = select('#levelNameInput'); if(!nameEl) return;
  const name = nameEl.value().trim();
  if(!name){ showPopup('Invalid Name', 'Please enter a name for the level.', 'error'); return; }

  const list = getSavedLevels();
  // if name exists, confirm overwrite
  const existing = list.find(l=>l.name===name);
  const data = createLevelData(name);
  if(existing){ if(!confirm('Overwrite existing level?')) return; existing.data = data; }
  else list.push({name, data});
  setSavedLevels(list);
  refreshSavedLevelsList();
}

function refreshSavedLevelsList(){
  const panel = select('#savedLevelsPanel'); const listEl = select('#savedLevelsList');
  if(!panel||!listEl) return;
  const list = getSavedLevels();
  if(list.length===0){ panel.style('display','none'); return; }
  panel.style('display','block'); listEl.html('');
  list.forEach((it,idx)=>{
    const row = createDiv(); row.style('display','flex'); row.style('gap','8px'); row.style('align-items','center');
    const aiCount = (it.data && it.data.aiPlayerCount) ? it.data.aiPlayerCount : 1;
    const titleText = `${it.name} (${aiCount} AI)`;
    const title = createDiv(titleText); title.style('flex','1'); title.style('font-size','13px');
    const loadBtn = createButton('Load'); loadBtn.mousePressed(()=>loadSavedLevel(idx)); loadBtn.addClass('small');
    const playBtn = createButton('Play'); playBtn.mousePressed(()=>playSavedLevel(idx)); playBtn.addClass('small');
    const delBtn = createButton('Delete'); delBtn.mousePressed(()=>{ if(confirm('Delete level?')){ deleteSavedLevel(idx); } }); delBtn.addClass('small');
    row.child(title); row.child(loadBtn); row.child(playBtn); row.child(delBtn);
    row.parent(listEl);
  });
}

function loadSavedLevel(idx){
  const list = getSavedLevels(); if(!list[idx]) return;
  const data = list[idx].data || list[idx];
  applyLevelData(data);
  captureScenarioSnapshot();
  lastPlayedSavedLevelIndex = idx;
  // If embedded in hub with a gameId, inform parent so it can persist this level to Firestore
  try {
    if (window.parent && window.parent !== window) {
      const terrainCount = terrain.filter(t => t !== null).length;
      console.log('DEBUG: Sending level to database - terrain tiles:', terrainCount);
      
      const levelData = createLevelData();
      const gid = (new URLSearchParams(window.location.search)).get('gameId');
      console.log('DEBUG: Posting to parent - gameId:', gid, 'terrain sample:', terrain.slice(0, 5));
      window.parent.postMessage({ type: 'localLevelLoaded', gameId: gid, levelData }, '*');
    }
  } catch (e) { console.warn('Failed to post localLevelLoaded', e); }
}

function playSavedLevel(idx){
  loadSavedLevel(idx);
  if (isEditorMode) toggleEditorMode();
}

function deleteSavedLevel(idx){ const list = getSavedLevels(); list.splice(idx,1); setSavedLevels(list); refreshSavedLevelsList(); }

// ---------- Editor Mode ----------
function wireEditorModeButton() {
  const button = document.getElementById('editorModeBtn');
  if (!button || button.dataset.editorModeWired) return;
  button.dataset.editorModeWired = 'true';
  button.addEventListener('pointerdown', event => {
    event.stopPropagation();
  });
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    toggleEditorMode();
  });
}

function toggleEditorMode() {
  console.log('Toggling editor mode');
  isEditorMode = !isEditorMode;
  if (isEditorMode && hasAIDiplomacy() && !isDiplomacyActive()) {
    initializeDiplomacy();
  } else if (isEditorMode && hasAIDiplomacy()) {
    ensureDiplomacyForActiveTeams();
  }
  document.body.classList.toggle('editor-mode', isEditorMode);
  document.body.classList.toggle('editor-drawer-collapsed', false);
  if (editorDrawerTab) editorDrawerTab.style.display = isEditorMode ? 'block' : 'none';
  console.log('Editor mode is now:', isEditorMode);
  if (!isEditorMode) {
    readVictoryConditionFromUI();
    captureScenarioSnapshot();
  }
  
  editorModeBtn.html(isEditorMode ? "Play Mode" : "Editor Mode");
  selectedUnit = null;
  placingUnitType = null;
  placingUnitTeam = null;
  
  // Update UI state based on mode
  select('#endTurnBtn').style('display', isEditorMode ? 'none' : 'block');
  select('#gameControls').style('display', isEditorMode ? 'none' : 'block');
  select('#editorControls').style('display', isEditorMode ? 'block' : 'none');
  select('#saveLevelBtn').style('display', isEditorMode ? 'block' : 'none');
  select('#saveNamedLevelBtn').style('display', isEditorMode ? 'block' : 'none');
  select('#levelNameInput').style('display', isEditorMode ? 'block' : 'none');
  
  // Reset all unit placement button styles
  const buttons = ['soldierBtn', 'archerBtn', 'knightBtn', 'gruntBtn', 'skirmBtn', 'bruteBtn', 'stockadeBtn', 'castleBtn', 'heavyFortressBtn'];
  buttons.forEach(id => { const el = select('#' + id); if (el) el.style('background', ''); });
  
  updateUI();
  wireVictoryEditor();
  renderStartingDiplomacyEditor();
}

function wireEditorDrawerTab() {
  if (editorDrawerTab) return;
  const panel = document.getElementById('panel');
  if (panel && !panel.dataset.inputGuarded) {
    panel.dataset.inputGuarded = 'true';
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'wheel'].forEach(eventName => {
      panel.addEventListener(eventName, event => event.stopPropagation());
    });
  }
  editorDrawerTab = document.createElement('button');
  editorDrawerTab.id = 'editorDrawerTab';
  editorDrawerTab.type = 'button';
  editorDrawerTab.textContent = 'Editor Tools';
  editorDrawerTab.style.display = 'none';
  editorDrawerTab.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.toggle('editor-drawer-collapsed');
  });
  document.body.appendChild(editorDrawerTab);
}

// ---------- Multi-AI Team Management ----------
function getActiveTeams() {
  if(typeof OnlineMatch!=='undefined'&&OnlineMatch.active&&opponentType==='HUMAN')return [...OnlineMatch.teams];
  const teams = ['PLAYER'];
  
  if (opponentType === 'HUMAN' || opponentType === 'LOCAL_2P') {
    teams.push('PLAYER2');
  } else {
    // Add AI teams based on currentAIPlayers
    for (let i = 0; i < currentAIPlayers; i++) {
      teams.push(aiTeamNames[i]);
    }
  }
  
  return teams;
}

function isAITeam(team) {
  return aiTeamNames.includes(team);
}

function hasAIDiplomacy() {
  return getActiveTeams().some(team => isAITeam(team));
}

function isDiplomacyActive() {
  return !!(diplomacy && diplomacy.trust && Object.keys(diplomacy.trust).length > 0);
}

function ensureDiplomacyForActiveTeams() {
  const allTeams = getActiveTeams();
  const newlyDefaultedPairs = [];
  if (!diplomacy || typeof diplomacy !== 'object') diplomacy = {};
  if (!diplomacy.trust || typeof diplomacy.trust !== 'object') diplomacy.trust = {};
  if (!diplomacy.reputation || typeof diplomacy.reputation !== 'object') diplomacy.reputation = {};
  if (!Array.isArray(diplomacy.treaties)) diplomacy.treaties = [];
  if (!Array.isArray(diplomacy.warDeclarations)) diplomacy.warDeclarations = [];
  if (!Array.isArray(diplomacy.aiMessages)) diplomacy.aiMessages = [];
  if (!Array.isArray(diplomacy.diplomaticHistory)) diplomacy.diplomaticHistory = [];
  if (!diplomacy.espionage || typeof diplomacy.espionage !== 'object') diplomacy.espionage = {};
  if (!diplomacy.personalities || typeof diplomacy.personalities !== 'object') diplomacy.personalities = {};
  if (typeof diplomacy.unreadMessages !== 'number') diplomacy.unreadMessages = 0;

  allTeams.forEach(team1 => {
    if (!diplomacy.trust[team1]) diplomacy.trust[team1] = {};
    allTeams.forEach(team2 => {
      if (team1 !== team2 && diplomacy.trust[team1][team2] === undefined) {
        diplomacy.trust[team1][team2] = -85;
        const pairKey = [team1, team2].sort().join('|');
        if (!newlyDefaultedPairs.includes(pairKey)) newlyDefaultedPairs.push(pairKey);
      }
    });
    if (diplomacy.reputation[team1] === undefined) diplomacy.reputation[team1] = 0;
    if (isAITeam(team1) && !diplomacy.personalities[team1]) {
      diplomacy.personalities[team1] = 'BALANCED';
    }
  });

  newlyDefaultedPairs.forEach(pairKey => {
    const [team1, team2] = pairKey.split('|');
    const hasActiveWar = diplomacy.warDeclarations.some(war =>
      war.active &&
      ((war.attacker === team1 && war.target === team2) ||
       (war.attacker === team2 && war.target === team1))
    );
    if (hasActiveWar) return;
    diplomacy.warDeclarations.push({
      attacker: team1,
      target: team2,
      declaredTurn: 0,
      canAttackTurn: 0,
      active: true,
      reason: 'Default scenario start'
    });
  });
}

function clearDiplomacyBetween(faction1, faction2) {
  ensureDiplomacyForActiveTeams();
  diplomacy.warDeclarations.forEach(war => {
    if (war.active &&
        ((war.attacker === faction1 && war.target === faction2) ||
         (war.attacker === faction2 && war.target === faction1))) {
      war.active = false;
      war.endedTurn = turnNumber || 0;
      war.endReason = 'Scenario editor relationship change';
    }
  });
  diplomacy.treaties.forEach(treaty => {
    if (treaty.active && treaty.participants.includes(faction1) && treaty.participants.includes(faction2)) {
      treaty.active = false;
      treaty.endedTurn = turnNumber || 0;
      treaty.endReason = 'Scenario editor relationship change';
    }
  });
}

function getStartingDiplomacyRelation(faction1, faction2) {
  ensureDiplomacyForActiveTeams();
  if (isAtWar(faction1, faction2)) return 'WAR';
  if (hasTreaty(faction1, faction2, 'DEFENSIVE_PACT')) return 'DEFENSIVE_PACT';
  return 'WAR';
}

function setStartingDiplomacyRelation(faction1, faction2, relation) {
  ensureDiplomacyForActiveTeams();
  clearDiplomacyBetween(faction1, faction2);
  const normalized = relation === 'WAR' || relation === 'DEFENSIVE_PACT' ? relation : 'NEUTRAL';

  if (normalized === 'WAR') {
    diplomacy.trust[faction1][faction2] = -85;
    diplomacy.trust[faction2][faction1] = -85;
    diplomacy.warDeclarations.push({
      target: faction2,
      attacker: faction1,
      declaredTurn: 0,
      canAttackTurn: 0,
      active: true,
      reason: 'Scenario start'
    });
  } else if (normalized === 'DEFENSIVE_PACT') {
    diplomacy.trust[faction1][faction2] = 70;
    diplomacy.trust[faction2][faction1] = 70;
    diplomacy.treaties.push({
      id: `scenario-${faction1}-${faction2}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'DEFENSIVE_PACT',
      participants: [faction1, faction2],
      turnsRemaining: 999,
      active: true,
      createdTurn: 0,
      scenarioStart: true
    });
  } else {
    diplomacy.trust[faction1][faction2] = 0;
    diplomacy.trust[faction2][faction1] = 0;
  }

  diplomacy.diplomaticHistory.push({
    turn: turnNumber || 0,
    action: `Scenario editor set ${faction1} and ${faction2} to ${normalized}`,
    participants: [faction1, faction2],
    relation: normalized
  });
  updateDiplomacyUI();
}

function renderStartingDiplomacyEditor() {
  const container = document.getElementById('startingDiplomacyEditor');
  if (!container) return;
  if (!isEditorMode || !hasAIDiplomacy()) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  ensureDiplomacyForActiveTeams();
  const teams = getActiveTeams();
  const rows = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) rows.push([teams[i], teams[j]]);
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div style="margin:0 0 10px 0;padding:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);border-radius:6px;">
      <div style="color:var(--accent);font-weight:700;margin-bottom:6px;">Scenario Starting Diplomacy</div>
      <div style="color:var(--muted);font-size:11px;margin-bottom:8px;">Choose how each faction pair begins when this scenario is played or saved.</div>
      <div id="startingDiplomacyRows" style="display:flex;flex-direction:column;gap:6px;"></div>
    </div>
  `;

  const rowsEl = document.getElementById('startingDiplomacyRows');
  rows.forEach(([team1, team2]) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center;';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:11px;line-height:1.25;';
    label.innerHTML = `<span style="color:${getTeamColorHex(team1)};font-weight:700;">${getTeamDisplayName(team1)}</span> vs <span style="color:${getTeamColorHex(team2)};font-weight:700;">${getTeamDisplayName(team2)}</span>`;
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;padding:5px 6px;border-radius:5px;border:1px solid #555;background:#1a2332;color:#fff;font-size:11px;';
    [
      ['WAR', 'At War'],
      ['NEUTRAL', 'Neutral'],
      ['DEFENSIVE_PACT', 'Defensive Pact']
    ].forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      if (getStartingDiplomacyRelation(team1, team2) === value) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', event => setStartingDiplomacyRelation(team1, team2, event.target.value));
    row.appendChild(label);
    row.appendChild(select);
    rowsEl.appendChild(row);
  });
}

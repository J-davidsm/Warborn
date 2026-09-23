// Warborn source split from the original game.js.
// Section: js/core/level-state.js

// ---------- Setup ----------
/**
 * Creates a new unit instance with specified properties
 * @param {string} name - Unit type name from UNIT_TEMPLATES
 * @param {string} team - Team identifier ('PLAYER', 'AI', 'PLAYER2') 
 * @param {number} col - Grid column position (0-based)
 * @param {number} row - Grid row position (0-based)
 * @param {Object} opts - Optional property overrides
 * @returns {Object} Complete unit object ready for game use
 */
function makeUnit(name, team, col, row, opts={}) {

  // Get stats from global UNIT_TEMPLATES (single source of truth)
  const template = UNIT_TEMPLATES[name];
  const defaultStats = template ? {
    maxHp: template.hp,
    move: template.move,
    atkRange: template.atkRange, 
    dmg: template.dmg,
    cost: template.cost,
    isWaterUnit: template.isWaterUnit || false
  } : { maxHp: 100, move: 3, atkRange: 1, dmg: 25, cost: 8, isWaterUnit: false }; // fallback for unknown types
  
  return {
    // preserve an explicit id when provided (used during snapshot rehydrate)
    id: opts.id || Math.random().toString(36).slice(2,9),
    name, team, col, row,
    // allow callers to set current HP via opts.hp; fall back to opts.maxHp or defaults
    hp: (typeof opts.hp !== 'undefined') ? opts.hp : (opts.maxHp ?? defaultStats.maxHp),
    maxHp: opts.maxHp ?? defaultStats.maxHp,
    move: (template?.fortress || name==='Fortress') ? 0 : (opts.move ?? defaultStats.move),
    atkRange: opts.atkRange ?? defaultStats.atkRange,
    dmg: opts.dmg ?? defaultStats.dmg,
    cost: opts.cost ?? defaultStats.cost ?? 1,
    // New units spawned during gameplay should be immobile (opts.justSpawned=true)
    // Units from saves/setup should be able to move (opts.justSpawned not set)
    hasMoved: opts.justSpawned === true ? true : (opts.hasMoved ?? false),
    hasActed: opts.justSpawned === true ? true : (opts.hasActed ?? false),
    morale: (typeof opts.morale !== 'undefined') ? opts.morale : (name === 'Dragon' ? 150 : 100),
    isWaterUnit: opts.isWaterUnit ?? defaultStats.isWaterUnit ?? false,
    experience: opts.experience ?? 0,
    promotionLevel: opts.promotionLevel ?? 0
  };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeVictoryCondition(condition = {}) {
  const merged = { ...DEFAULT_VICTORY_CONDITION, ...(condition || {}) };
  merged.holdCol = Number.isFinite(parseInt(merged.holdCol)) ? parseInt(merged.holdCol) : 0;
  merged.holdRow = Number.isFinite(parseInt(merged.holdRow)) ? parseInt(merged.holdRow) : 0;
  merged.holdTurns = Math.max(1, parseInt(merged.holdTurns) || 3);
  merged.surviveTurns = Math.max(1, parseInt(merged.surviveTurns) || 10);
  merged.killTurnLimit = Math.max(1, parseInt(merged.killTurnLimit) || 10);
  merged.holdProgress = Math.max(0, parseInt(merged.holdProgress) || 0);
  merged.lastHoldTurn = Math.max(0, parseInt(merged.lastHoldTurn) || 0);
  if (!merged.targetTeam || merged.targetTeam === 'PLAYER') {
    merged.targetTeam = getActiveTeams().find(team => team !== 'PLAYER') || 'AI';
  }
  return merged;
}

function inferVictoryConditionFromText(text = '') {
  const lowered = String(text || '').toLowerCase();
  if (lowered.includes('survive')) {
    const match = lowered.match(/(\d+)/);
    return { ...DEFAULT_VICTORY_CONDITION, type: 'SURVIVE_TURNS', surviveTurns: match ? parseInt(match[1]) : 10 };
  }
  return { ...DEFAULT_VICTORY_CONDITION };
}

function getVictoryConditionLabel(condition = currentVictoryCondition) {
  const vc = normalizeVictoryCondition(condition);
  switch (vc.type) {
    case 'ANNIHILATE_TEAM':
      return `Annihilate ${getTeamDisplayName(vc.targetTeam)} and take their settlements`;
    case 'HOLD_TILE':
      return `Hold tile ${vc.holdCol},${vc.holdRow} for ${vc.holdTurns} turns`;
    case 'SURVIVE_TURNS':
      return `Survive until turn ${vc.surviveTurns}`;
    case 'KILL_UNIT_LIMIT': {
      const target = units.find(u => u.id === vc.targetUnitId);
      return `Kill ${target ? `${getTeamDisplayName(target.team)} ${target.name}` : 'the specified enemy unit'} by turn ${vc.killTurnLimit}`;
    }
    case 'ANNIHILATE_ALL':
    default:
      return 'Annihilate all enemy units and take their settlements';
  }
}

function serializeUnits() {
  return units.map(u => ({
    id: u.id,
    name: u.name,
    team: u.team,
    col: u.col,
    row: u.row,
    hp: u.hp,
    maxHp: u.maxHp,
    move: u.move,
    atkRange: u.atkRange,
    dmg: u.dmg,
    cost: u.cost || 1,
    morale: u.morale,
    isWaterUnit: u.isWaterUnit || false,
    experience: u.experience || 0,
    promotionLevel: u.promotionLevel || 0
  }));
}

function createLevelData(name = null) {
  readVictoryConditionFromUI();
  if (hasAIDiplomacy()) ensureDiplomacyForActiveTeams();
  const data = {
    mapSize: clonePlain(mapSize),
    settlements: clonePlain(settlements || []),
    terrain: clonePlain(terrain || []),
    startingResources: clonePlain(startingResources || {}),
    aiPlayerCount: currentAIPlayers,
    diplomacy: clonePlain(diplomacy || {}),
    victoryCondition: normalizeVictoryCondition(currentVictoryCondition),
    units: serializeUnits()
  };
  if (name) data.name = name;
  return data;
}

function captureScenarioSnapshot() {
  activeScenarioSnapshot = createLevelData('active-scenario');
}

function applyVictoryConditionToUI() {
  currentVictoryCondition = normalizeVictoryCondition(currentVictoryCondition);
  const typeEl = document.getElementById('victoryConditionType');
  if (!typeEl) return;
  
  typeEl.value = currentVictoryCondition.type;
  refreshVictoryEditorOptions();
  
  const targetTeamEl = document.getElementById('victoryTargetTeam');
  const holdColEl = document.getElementById('victoryHoldCol');
  const holdRowEl = document.getElementById('victoryHoldRowInput');
  const holdTurnsEl = document.getElementById('victoryHoldTurns');
  const surviveTurnsEl = document.getElementById('victorySurviveTurns');
  const targetUnitEl = document.getElementById('victoryTargetUnit');
  const killTurnsEl = document.getElementById('victoryKillTurns');
  
  if (targetTeamEl) targetTeamEl.value = currentVictoryCondition.targetTeam;
  if (holdColEl) holdColEl.value = currentVictoryCondition.holdCol;
  if (holdRowEl) holdRowEl.value = currentVictoryCondition.holdRow;
  if (holdTurnsEl) holdTurnsEl.value = currentVictoryCondition.holdTurns;
  if (surviveTurnsEl) surviveTurnsEl.value = currentVictoryCondition.surviveTurns;
  if (targetUnitEl && currentVictoryCondition.targetUnitId) targetUnitEl.value = currentVictoryCondition.targetUnitId;
  if (killTurnsEl) killTurnsEl.value = currentVictoryCondition.killTurnLimit;
  updateVictoryEditorVisibility(false);
}

function readVictoryConditionFromUI() {
  const typeEl = document.getElementById('victoryConditionType');
  if (!typeEl) return currentVictoryCondition;
  
  currentVictoryCondition = normalizeVictoryCondition({
    ...currentVictoryCondition,
    type: typeEl.value,
    targetTeam: document.getElementById('victoryTargetTeam')?.value || currentVictoryCondition.targetTeam,
    holdCol: document.getElementById('victoryHoldCol')?.value ?? currentVictoryCondition.holdCol,
    holdRow: document.getElementById('victoryHoldRowInput')?.value ?? currentVictoryCondition.holdRow,
    holdTurns: document.getElementById('victoryHoldTurns')?.value ?? currentVictoryCondition.holdTurns,
    surviveTurns: document.getElementById('victorySurviveTurns')?.value ?? currentVictoryCondition.surviveTurns,
    targetUnitId: document.getElementById('victoryTargetUnit')?.value || currentVictoryCondition.targetUnitId,
    killTurnLimit: document.getElementById('victoryKillTurns')?.value ?? currentVictoryCondition.killTurnLimit
  });
  return currentVictoryCondition;
}

function refreshVictoryEditorOptions() {
  const targetTeamEl = document.getElementById('victoryTargetTeam');
  if (targetTeamEl) {
    const enemies = getActiveTeams().filter(team => team !== 'PLAYER');
    targetTeamEl.innerHTML = enemies.map(team => `<option value="${team}">${getTeamDisplayName(team)}</option>`).join('');
    if (!enemies.includes(currentVictoryCondition.targetTeam)) {
      currentVictoryCondition.targetTeam = enemies[0] || 'AI';
    }
  }
  
  const targetUnitEl = document.getElementById('victoryTargetUnit');
  if (targetUnitEl) {
    const enemyUnits = units.filter(u => u.team !== 'PLAYER' && u.hp > 0);
    targetUnitEl.innerHTML = enemyUnits.map(u => {
      const label = `${getTeamDisplayName(u.team)} ${u.name} at ${u.col},${u.row}`;
      return `<option value="${u.id}">${label}</option>`;
    }).join('');
    if (enemyUnits.length && !enemyUnits.some(u => u.id === currentVictoryCondition.targetUnitId)) {
      currentVictoryCondition.targetUnitId = enemyUnits[0].id;
    }
  }
}

function updateVictoryEditorVisibility(shouldRead = true) {
  if (shouldRead) readVictoryConditionFromUI();
  const type = currentVictoryCondition.type;
  const rows = {
    targetTeam: document.getElementById('victoryTargetTeamRow'),
    hold: document.getElementById('victoryHoldRow'),
    survive: document.getElementById('victorySurviveRow'),
    kill: document.getElementById('victoryKillUnitRow')
  };
  if (rows.targetTeam) rows.targetTeam.style.display = type === 'ANNIHILATE_TEAM' ? 'block' : 'none';
  if (rows.hold) rows.hold.style.display = type === 'HOLD_TILE' ? 'block' : 'none';
  if (rows.survive) rows.survive.style.display = type === 'SURVIVE_TURNS' ? 'block' : 'none';
  if (rows.kill) rows.kill.style.display = type === 'KILL_UNIT_LIMIT' ? 'block' : 'none';
}

function wireVictoryEditor() {
  const ids = [
    'victoryConditionType', 'victoryTargetTeam', 'victoryHoldCol', 'victoryHoldRowInput',
    'victoryHoldTurns', 'victorySurviveTurns', 'victoryTargetUnit', 'victoryKillTurns'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.victoryWired) return;
    el.dataset.victoryWired = 'true';
    el.addEventListener('change', () => updateVictoryEditorVisibility(true));
    el.addEventListener('input', () => updateVictoryEditorVisibility(true));
  });
  applyVictoryConditionToUI();
}

function applyLevelData(data) {
  if (!data) return;
  mapSize = data.mapSize || mapSize;
  COLS = mapSize.cols;
  ROWS = mapSize.rows;
  TILE = BOARD_SIZE / COLS;
  updateHexSize();
  resizeGameCanvas();
  select('#mapSizeLabel')?.html(`${mapSize.cols} x ${mapSize.rows}`);
  
  settlements = Array(COLS * ROWS).fill(null);
  if (data.settlements) {
    for (let i = 0; i < Math.min(data.settlements.length, settlements.length); i++) {
      const s = data.settlements[i];
      if (!s) settlements[i] = null;
      else if (typeof s === 'string') settlements[i] = { type: s, owner: null };
      else settlements[i] = { type: s.type, owner: s.owner || null };
    }
  }
  
  terrain = Array(COLS * ROWS).fill(null);
  if (data.terrain) {
    for (let i = 0; i < Math.min(data.terrain.length, terrain.length); i++) terrain[i] = data.terrain[i];
  }
  
  if (data.startingResources) startingResources = clonePlain(data.startingResources);
  if (data.aiPlayerCount && data.aiPlayerCount >= 1 && data.aiPlayerCount <= maxAIPlayers) {
    setAIPlayerCount(data.aiPlayerCount);
  }
  if (data.diplomacy) diplomacy = clonePlain(data.diplomacy);
  if (hasAIDiplomacy()) ensureDiplomacyForActiveTeams();
  currentVictoryCondition = normalizeVictoryCondition(data.victoryCondition);
  currentVictoryCondition.holdProgress = 0;
  currentVictoryCondition.lastHoldTurn = 0;
  
  units = (data.units || []).map(u => makeUnit(u.name, u.team, u.col, u.row, {
    id: u.id,
    hp: typeof u.hp !== 'undefined' ? u.hp : u.maxHp,
    maxHp: u.maxHp,
    move: u.move,
    atkRange: u.atkRange,
    dmg: u.dmg,
    cost: u.cost,
    morale: u.morale,
    isWaterUnit: u.isWaterUnit || false,
    experience: u.experience || 0,
    promotionLevel: u.promotionLevel || 0
  }));
  if (currentVictoryCondition.type === 'KILL_UNIT_LIMIT' &&
      !units.some(u => u.id === currentVictoryCondition.targetUnitId) &&
      units.some(u => u.team !== 'PLAYER')) {
    currentVictoryCondition.targetUnitId = units.find(u => u.team !== 'PLAYER').id;
  }
  
  selectedUnit = null;
  gameOver = false;
  endScreenShown = false;
  gameEndResult = null;
  currentTeam = 'PLAYER';
  currentTurnIndex = 0;
  turnNumber = 1;
  calculateTurnOrder();
  updateTeamSelector();
  applyVictoryConditionToUI();
  hideEndScreen();
  updateUI();
}

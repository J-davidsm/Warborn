// Warborn source split from the original game.js.
// Section: js/systems/campaign.js

// CAMPAIGN FUNCTIONS
// ========================================

function openCampaignEditor() {
  openCampaignPage();
}

function openCampaignPage() {
  normalizeCampaignData();
  const page = document.getElementById('campaignPage');
  if (page) page.classList.add('visible');
  document.getElementById('mainMenu')?.classList.add('hidden');
  const nameInput = document.getElementById('campaignNameInput');
  if (nameInput) nameInput.value = campaignMode.campaignData.name;
  renderScenariosEditor();
}

function closeCampaignEditor() {
  closeCampaignPage();
}

function closeCampaignPage(showMenu = true) {
  const page = document.getElementById('campaignPage');
  if (page) page.classList.remove('visible');
  if (showMenu) document.getElementById('mainMenu')?.classList.remove('hidden');
}

function normalizeCampaignData() {
  if (!campaignMode.campaignData) campaignMode.campaignData = { name: 'My Campaign', scenarios: [] };
  if (!Array.isArray(campaignMode.campaignData.scenarios)) campaignMode.campaignData.scenarios = [];
  campaignMode.campaignData.scenarios.forEach((scenario, index) => {
    if (!scenario.name) scenario.name = `Scenario ${index + 1}`;
    if (!scenario.description) scenario.description = '';
    if (!scenario.victory) scenario.victory = 'Defeat all enemies';
    if (!scenario.difficulty) scenario.difficulty = index === 0 ? 'Easy' : 'Standard';
    if (!scenario.aiCount) scenario.aiCount = 1;
    if (!scenario.mapSize) scenario.mapSize = { cols: 10, rows: 8 };
    if (!scenario.startingUnits) {
      scenario.startingUnits = {
        PLAYER: [{ type: 'Knight', col: 1, row: 2 }],
        AI: [{ type: 'Archer', col: 7, row: 5 }]
      };
    }
    if (!scenario.startingResources) {
      scenario.startingResources = {
        PLAYER: { gold: 25, materials: 5 },
        AI: { gold: 25, materials: 5 }
      };
    }
  });
}

function renderScenariosEditor() {
  const scenariosList = document.getElementById('scenariosList');
  if (!scenariosList) return;
  normalizeCampaignData();
  scenariosList.innerHTML = '';
  
  campaignMode.campaignData.scenarios.forEach((scenario, scenarioIndex) => {
    createScenarioEditor(scenariosList, scenario, scenarioIndex);
  });
  renderCampaignPageSummary();
}

function renderCampaignPageSummary() {
  const summary = document.getElementById('campaignPageSummary');
  if (!summary) return;
  const count = campaignMode.campaignData.scenarios.length;
  const difficulties = campaignMode.campaignData.scenarios.map(s => s.difficulty || 'Standard').join(' • ');
  summary.textContent = `${count} scenario${count === 1 ? '' : 's'} in this campaign${difficulties ? `: ${difficulties}` : ''}`;
}

function createScenarioEditor(parentElement, scenario, scenarioIndex) {
  const scenarioDiv = document.createElement('div');
  scenarioDiv.className = 'scenario-editor';
  
  // Header with title and remove button
  const headerDiv = document.createElement('div');
  headerDiv.className = 'scenario-card-header';
  
  const titleWrap = document.createElement('div');
  const titleSpan = document.createElement('div');
  titleSpan.className = 'scenario-card-title';
  titleSpan.textContent = scenario.name || `Scenario ${scenarioIndex + 1}`;
  const subtitle = document.createElement('div');
  subtitle.className = 'scenario-card-subtitle';
  subtitle.textContent = `Scenario ${scenarioIndex + 1}`;
  titleWrap.appendChild(titleSpan);
  titleWrap.appendChild(subtitle);
  
  const difficultyBadge = document.createElement('div');
  difficultyBadge.className = 'difficulty-badge';
  difficultyBadge.textContent = scenario.difficulty || 'Standard';
  
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.style.cssText = 'background: #ff4757; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 10px;';
  removeBtn.addEventListener('click', () => removeScenario(scenarioIndex));
  
  headerDiv.appendChild(titleWrap);
  headerDiv.appendChild(difficultyBadge);
  headerDiv.appendChild(removeBtn);
  scenarioDiv.appendChild(headerDiv);
  
  // Name input
  const nameContainer = createInputField('Name', 'text', scenario.name, (value) => {
    updateScenarioProperty(scenarioIndex, 'name', value);
    titleSpan.textContent = value || `Scenario ${scenarioIndex + 1}`;
  });
  scenarioDiv.appendChild(nameContainer);
  
  const difficultyContainer = createInputField('Difficulty Rating', 'text', scenario.difficulty || 'Standard', (value) => {
    const rating = value.trim() || 'Standard';
    updateScenarioProperty(scenarioIndex, 'difficulty', rating);
    difficultyBadge.textContent = rating;
    renderCampaignPageSummary();
  });
  scenarioDiv.appendChild(difficultyContainer);
  
  // Description textarea
  const descContainer = createTextareaField('Description', scenario.description, (value) => {
    updateScenarioProperty(scenarioIndex, 'description', value);
  });
  scenarioDiv.appendChild(descContainer);
  
  // Victory condition input
  const victoryContainer = createInputField('Victory Condition', 'text', scenario.victory, (value) => {
    updateScenarioProperty(scenarioIndex, 'victory', value);
  });
  scenarioDiv.appendChild(victoryContainer);
  
  // AI Count selector
  const aiContainer = createSelectField('AI Count', [
    {value: 1, label: '1 AI'},
    {value: 2, label: '2 AIs'}, 
    {value: 3, label: '3 AIs'},
    {value: 4, label: '4 AIs'}
  ], scenario.aiCount, (value) => {
    updateScenarioProperty(scenarioIndex, 'aiCount', parseInt(value));
  });
  scenarioDiv.appendChild(aiContainer);
  
  // Action buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
  
  const testBtn = document.createElement('button');
  testBtn.textContent = '🎮 Test Scenario';
  testBtn.style.cssText = 'background: #ff7675; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px; font-weight: 600;';
  testBtn.addEventListener('click', () => testScenario(scenarioIndex));
  
  const editBtn = document.createElement('button');
  editBtn.textContent = '⚙️ Advanced Edit';
  editBtn.style.cssText = 'background: #74b9ff; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px; font-weight: 600;';
  editBtn.addEventListener('click', () => openAdvancedScenarioEditor(scenarioIndex));
  
  actionsDiv.appendChild(testBtn);
  actionsDiv.appendChild(editBtn);
  scenarioDiv.appendChild(actionsDiv);
  
  parentElement.appendChild(scenarioDiv);
}

function createInputField(label, type, value, onUpdate) {
  const container = document.createElement('div');
  container.style.cssText = 'margin-bottom: 10px;';
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label + ':';
  labelEl.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600; color: #ccc;';
  
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.style.cssText = 'width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #1a2332; color: #fff; font-size: 12px; box-sizing: border-box;';
  
  input.addEventListener('input', (e) => onUpdate(e.target.value));
  input.addEventListener('blur', (e) => onUpdate(e.target.value));
  
  container.appendChild(labelEl);
  container.appendChild(input);
  return container;
}

function createTextareaField(label, value, onUpdate) {
  const container = document.createElement('div');
  container.style.cssText = 'margin-bottom: 10px;';
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label + ':';
  labelEl.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600; color: #ccc;';
  
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.cssText = 'width: 100%; height: 80px; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #1a2332; color: #fff; font-size: 12px; resize: vertical; box-sizing: border-box; font-family: inherit;';
  
  textarea.addEventListener('input', (e) => onUpdate(e.target.value));
  textarea.addEventListener('blur', (e) => onUpdate(e.target.value));
  
  container.appendChild(labelEl);
  container.appendChild(textarea);
  return container;
}

function createSelectField(label, options, value, onUpdate) {
  const container = document.createElement('div');
  container.style.cssText = 'margin-bottom: 10px;';
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label + ':';
  labelEl.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600; color: #ccc;';
  
  const select = document.createElement('select');
  select.style.cssText = 'width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #1a2332; color: #fff; font-size: 12px;';
  
  options.forEach(option => {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    if (option.value == value) optionEl.selected = true;
    select.appendChild(optionEl);
  });
  
  select.addEventListener('change', (e) => onUpdate(e.target.value));
  
  container.appendChild(labelEl);
  container.appendChild(select);
  return container;
}

function addScenario() {
  const scenarioNumber = campaignMode.campaignData.scenarios.length + 1;
  const newScenario = {
    name: `Scenario ${scenarioNumber}`,
    description: `Write your story and objectives for scenario ${scenarioNumber} here. Explain what the player needs to accomplish and why.`,
    victory: "Defeat all enemies",
    difficulty: "Standard",
    startingUnits: {
      PLAYER: [{type: "Knight", col: 1, row: 2}], 
      AI: [{type: "Knight", col: 6, row: 5}]
    },
    startingResources: {
      PLAYER: {gold: 25, materials: 5},
      AI: {gold: 25, materials: 5}
    },
    aiCount: 1,
    mapSize: {cols: 10, rows: 8}
  };
  
  campaignMode.campaignData.scenarios.push(newScenario);
  renderScenariosEditor();
  
  // Scroll to the new scenario
  setTimeout(() => {
    const scenariosList = document.getElementById('scenariosList');
    if (scenariosList.lastElementChild) {
      scenariosList.lastElementChild.scrollIntoView({behavior: 'smooth'});
    }
  }, 100);
  
  showPopup("Scenario Added", `New scenario created! Use the "Advanced Edit" button to set up units and terrain.`, "success");
}

function removeScenario(index) {
  if (campaignMode.campaignData.scenarios.length > 1) {
    campaignMode.campaignData.scenarios.splice(index, 1);
    renderScenariosEditor();
  } else {
    showPopup("Cannot Remove", "Campaign must have at least one scenario.", "warning");
  }
}

function updateScenarioProperty(index, property, value) {
  if (campaignMode.campaignData.scenarios[index]) {
    campaignMode.campaignData.scenarios[index][property] = value;
    console.log(`Updated scenario ${index} ${property} to:`, value);
    renderCampaignPageSummary();
  }
}

function clampScenarioInt(value, minValue, maxValue, fallback) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minValue, Math.min(maxValue, parsed));
}

function createScenarioRng(seedText) {
  let seed = 2166136261;
  String(seedText || Date.now()).split('').forEach(char => {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  });
  return function rng() {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
}

function pickScenarioItem(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function getScenarioDifficultyProfile(difficulty) {
  const key = String(difficulty || 'Standard').toLowerCase();
  const profiles = {
    easy: {
      label: 'Easy',
      targetPressure: 0.72,
      maxPressure: 0.95,
      playerUnits: ['Knight', 'Archer', 'Spearman', 'Cleric', 'Soldier', 'Soldier'],
      playerBonus: ['Archer', 'Soldier', 'Cleric'],
      aiUnits: ['Soldier', 'Soldier', 'Archer'],
      aiReinforcements: ['Soldier', 'Spearman', 'Archer'],
      playerResources: { gold: 36, materials: 10 },
      aiResources: { gold: 16, materials: 3 },
      playerSettlement: 'CITY',
      aiSettlement: 'VILLAGE',
      neutralSettlements: 4,
      terrainBlobs: 5,
      hostileTerrainBias: 0.55
    },
    standard: {
      label: 'Standard',
      targetPressure: 1.08,
      maxPressure: 1.35,
      playerUnits: ['Knight', 'Archer', 'Spearman', 'Soldier', 'Cleric'],
      playerBonus: ['Soldier', 'Archer'],
      aiUnits: ['Knight', 'Archer', 'Spearman', 'Soldier'],
      aiReinforcements: ['Swordsman', 'Soldier', 'Archer', 'Spearman'],
      playerResources: { gold: 28, materials: 7 },
      aiResources: { gold: 26, materials: 6 },
      playerSettlement: 'VILLAGE',
      aiSettlement: 'VILLAGE',
      neutralSettlements: 5,
      terrainBlobs: 7,
      hostileTerrainBias: 0.8
    },
    hard: {
      label: 'Hard',
      targetPressure: 1.55,
      maxPressure: 2.05,
      playerUnits: ['Knight', 'Archer', 'Soldier', 'Spearman'],
      playerBonus: ['Soldier'],
      aiUnits: ['Knight', 'Swordsman', 'Archer', 'Spearman', 'Soldier'],
      aiReinforcements: ['Catapult', 'Swordsman', 'Knight', 'Assassin'],
      playerResources: { gold: 22, materials: 5 },
      aiResources: { gold: 34, materials: 9 },
      playerSettlement: 'HAMLET',
      aiSettlement: 'CITY',
      neutralSettlements: 4,
      terrainBlobs: 9,
      hostileTerrainBias: 1.05
    },
    brutal: {
      label: 'Brutal',
      targetPressure: 2.25,
      maxPressure: 3.2,
      playerUnits: ['Knight', 'Archer', 'Soldier'],
      playerBonus: ['Soldier'],
      aiUnits: ['Knight', 'Swordsman', 'Catapult', 'Spearman', 'Archer'],
      aiReinforcements: ['Dragon', 'Heavy Fortress', 'Catapult', 'Assassin', 'Cleric'],
      playerResources: { gold: 18, materials: 4 },
      aiResources: { gold: 44, materials: 13 },
      playerSettlement: 'HAMLET',
      aiSettlement: 'CITY',
      neutralSettlements: 3,
      terrainBlobs: 11,
      hostileTerrainBias: 1.25
    }
  };
  return profiles[key] || profiles.standard;
}

const GENERATED_UNIT_POWER = {
  Soldier: 22,
  Archer: 24,
  Spearman: 28,
  Knight: 46,
  Swordsman: 45,
  Assassin: 38,
  Catapult: 56,
  Cleric: 26,
  Dragon: 110,
  Stockade: 52,
  Castle: 86,
  'Heavy Fortress': 126
};

function getGeneratedUnitPower(unitType) {
  return GENERATED_UNIT_POWER[unitType] || 25;
}

function getGeneratedTeamPower(unitList) {
  return (unitList || []).reduce((total, unit) => total + getGeneratedUnitPower(unit.type || unit.name), 0);
}

function getGeneratedScenarioPressure(startingUnits) {
  const playerPower = Math.max(1, getGeneratedTeamPower(startingUnits.PLAYER));
  const aiPower = Object.keys(startingUnits)
    .filter(team => team !== 'PLAYER')
    .reduce((sum, team) => sum + getGeneratedTeamPower(startingUnits[team]), 0);
  return aiPower / playerPower;
}

function getScenarioTeams(aiCount) {
  return ['PLAYER', ...aiTeamNames.slice(0, aiCount)];
}

function getScenarioAnchors(cols, rows, aiCount, profile) {
  const margin = Math.max(2, Math.floor(Math.min(cols, rows) * 0.12));
  const closeShift = profile.label === 'Hard' ? 1 : profile.label === 'Brutal' ? 2 : 0;
  const right = Math.max(margin + 2, cols - margin - 1 - closeShift);
  const left = Math.min(cols - margin - 2, margin);
  const top = margin;
  const bottom = rows - margin - 1;
  const middleRow = Math.floor(rows / 2);
  const anchors = {
    PLAYER: { col: left, row: middleRow }
  };
  const aiAnchors = [
    { col: right, row: middleRow },
    { col: right, row: top },
    { col: right, row: bottom },
    { col: Math.floor(cols * 0.58), row: top },
    { col: Math.floor(cols * 0.58), row: bottom }
  ];
  aiTeamNames.slice(0, aiCount).forEach((team, index) => {
    anchors[team] = aiAnchors[index] || aiAnchors[0];
  });
  return anchors;
}

function scenarioIndex(cols, col, row) {
  return row * cols + col;
}

function isScenarioInBounds(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function isNearScenarioAnchor(anchors, col, row, radius) {
  return Object.values(anchors).some(anchor => {
    const dx = col - anchor.col;
    const dy = row - anchor.row;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  });
}

function paintScenarioTerrainBlob(grid, cols, rows, type, center, radiusX, radiusY, rng, anchors) {
  const lobes = 2 + Math.floor(rng() * 3);
  for (let lobe = 0; lobe < lobes; lobe++) {
    const cx = Math.round(center.col + (rng() - 0.5) * radiusX * 0.9);
    const cy = Math.round(center.row + (rng() - 0.5) * radiusY * 0.9);
    const rx = Math.max(2, radiusX * (0.65 + rng() * 0.55));
    const ry = Math.max(2, radiusY * (0.65 + rng() * 0.55));
    for (let row = Math.floor(cy - ry - 1); row <= Math.ceil(cy + ry + 1); row++) {
      for (let col = Math.floor(cx - rx - 1); col <= Math.ceil(cx + rx + 1); col++) {
        if (!isScenarioInBounds(cols, rows, col, row)) continue;
        if (isNearScenarioAnchor(anchors, col, row, 2.2)) continue;
        const dx = (col - cx) / rx;
        const dy = (row - cy) / ry;
        const edgeNoise = 0.78 + rng() * 0.42;
        if (dx * dx + dy * dy <= edgeNoise) {
          grid[scenarioIndex(cols, col, row)] = type;
        }
      }
    }
  }
}

function clearScenarioArea(grid, cols, rows, center, radius) {
  for (let row = center.row - radius; row <= center.row + radius; row++) {
    for (let col = center.col - radius; col <= center.col + radius; col++) {
      if (!isScenarioInBounds(cols, rows, col, row)) continue;
      const dx = col - center.col;
      const dy = row - center.row;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        grid[scenarioIndex(cols, col, row)] = null;
      }
    }
  }
}

function generateScenarioTerrain(cols, rows, aiCount, profile, anchors, rng) {
  const grid = Array(cols * rows).fill(null);
  const terrainTypes = ['WOODS', 'MOUNTAIN', 'SWAMP', 'DESERT', 'WATER'];
  const blobCount = Math.max(4, profile.terrainBlobs + Math.floor((cols * rows) / 95));
  for (let i = 0; i < blobCount; i++) {
    const type = terrainTypes[Math.floor(rng() * terrainTypes.length) % terrainTypes.length];
    const towardEnemy = rng() < profile.hostileTerrainBias / 1.4;
    const baseCol = towardEnemy ? Math.floor(cols * (0.45 + rng() * 0.42)) : Math.floor(cols * (0.15 + rng() * 0.72));
    const center = {
      col: Math.max(1, Math.min(cols - 2, baseCol)),
      row: Math.max(1, Math.min(rows - 2, Math.floor(rows * (0.12 + rng() * 0.76))))
    };
    const rx = Math.max(2, Math.floor(cols * (0.08 + rng() * 0.10)));
    const ry = Math.max(2, Math.floor(rows * (0.08 + rng() * 0.12)));
    paintScenarioTerrainBlob(grid, cols, rows, type, center, rx, ry, rng, anchors);
  }

  Object.values(anchors).forEach(anchor => clearScenarioArea(grid, cols, rows, anchor, 2));
  return grid;
}

function findScenarioOpenTile(cols, rows, terrainGrid, occupied, center, maxRadius, rng, options = {}) {
  const avoidWater = options.avoidWater !== false;
  const candidates = [];
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let row = center.row - radius; row <= center.row + radius; row++) {
      for (let col = center.col - radius; col <= center.col + radius; col++) {
        if (!isScenarioInBounds(cols, rows, col, row)) continue;
        const idx = scenarioIndex(cols, col, row);
        if (occupied.has(idx)) continue;
        if (avoidWater && terrainGrid[idx] === 'WATER') continue;
        const distance = Math.abs(col - center.col) + Math.abs(row - center.row);
        if (distance <= radius) candidates.push({ col, row, idx, distance });
      }
    }
    if (candidates.length) {
      candidates.sort((a, b) => a.distance - b.distance || rng() - 0.5);
      const pick = candidates[Math.floor(rng() * Math.min(candidates.length, 5))];
      occupied.add(pick.idx);
      return { col: pick.col, row: pick.row };
    }
  }
  return { col: center.col, row: center.row };
}

function addGeneratedUnit(startingUnits, team, type, position) {
  if (!startingUnits[team]) startingUnits[team] = [];
  startingUnits[team].push({
    id: `generated-${team}-${startingUnits[team].length}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    col: position.col,
    row: position.row
  });
}

function addGeneratedUnitGroup(startingUnits, team, unitTypes, anchor, cols, rows, terrainGrid, occupied, rng) {
  unitTypes.forEach((type, index) => {
    const ring = index < 1 ? 0 : index < 7 ? 1 : 2;
    const jitter = {
      col: anchor.col + Math.round((rng() - 0.5) * (ring + 1) * 2),
      row: anchor.row + Math.round((rng() - 0.5) * (ring + 1) * 2)
    };
    const position = findScenarioOpenTile(cols, rows, terrainGrid, occupied, jitter, 3 + ring, rng);
    addGeneratedUnit(startingUnits, team, type, position);
  });
}

function addGeneratedSettlement(settlementsList, occupied, cols, rows, terrainGrid, center, type, owner, rng) {
  const position = findScenarioOpenTile(cols, rows, terrainGrid, occupied, center, 4, rng);
  settlementsList.push({
    type,
    owner,
    col: position.col,
    row: position.row,
    index: scenarioIndex(cols, position.col, position.row)
  });
}

function createGeneratedStartingResources(teams, profile, aiCount) {
  const resourcesByTeam = {};
  teams.forEach(team => {
    if (team === 'PLAYER') {
      resourcesByTeam[team] = {
        gold: profile.playerResources.gold + Math.max(0, aiCount - 1) * 5,
        materials: profile.playerResources.materials + Math.max(0, aiCount - 1) * 2
      };
    } else {
      resourcesByTeam[team] = { ...profile.aiResources };
    }
  });
  return resourcesByTeam;
}

function createDefaultWarDiplomacy(teams) {
  const diplomaticState = {
    trust: {},
    reputation: {},
    treaties: [],
    warDeclarations: [],
    unreadMessages: 0,
    aiMessages: [],
    espionage: {},
    personalities: {},
    diplomaticHistory: []
  };
  teams.forEach(team1 => {
    diplomaticState.trust[team1] = {};
    diplomaticState.reputation[team1] = 0;
    if (isAITeam(team1)) diplomaticState.personalities[team1] = 'BALANCED';
    teams.forEach(team2 => {
      if (team1 !== team2) diplomaticState.trust[team1][team2] = -85;
    });
  });
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      diplomaticState.warDeclarations.push({
        attacker: teams[i],
        target: teams[j],
        declaredTurn: 0,
        canAttackTurn: 0,
        active: true,
        reason: 'Generated scenario start'
      });
    }
  }
  return diplomaticState;
}

function balanceGeneratedScenario(startingUnits, teams, profile, rng) {
  let pressure = getGeneratedScenarioPressure(startingUnits);
  let guard = 0;
  while (pressure < profile.targetPressure && guard < 24) {
    const aiTeams = teams.filter(team => team !== 'PLAYER');
    const weakest = aiTeams.sort((a, b) => getGeneratedTeamPower(startingUnits[a]) - getGeneratedTeamPower(startingUnits[b]))[0];
    const reinforcement = pickScenarioItem(profile.aiReinforcements, rng);
    startingUnits[weakest].push({
      id: `generated-${weakest}-reinforcement-${guard}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: reinforcement,
      col: startingUnits[weakest][0].col,
      row: startingUnits[weakest][0].row,
      needsPlacement: true
    });
    pressure = getGeneratedScenarioPressure(startingUnits);
    guard++;
  }

  guard = 0;
  while (pressure > profile.maxPressure && guard < 16) {
    const aiTeams = teams.filter(team => team !== 'PLAYER' && startingUnits[team].length > 2);
    if (!aiTeams.length) break;
    const strongest = aiTeams.sort((a, b) => getGeneratedTeamPower(startingUnits[b]) - getGeneratedTeamPower(startingUnits[a]))[0];
    startingUnits[strongest].sort((a, b) => getGeneratedUnitPower(a.type) - getGeneratedUnitPower(b.type));
    startingUnits[strongest].pop();
    pressure = getGeneratedScenarioPressure(startingUnits);
    guard++;
  }
  return pressure;
}

function generateScenario(options = {}) {
  const profile = getScenarioDifficultyProfile(options.difficulty);
  const aiCount = clampScenarioInt(options.aiCount, 1, 4, 1);
  const cols = clampScenarioInt(options.cols, 8, 50, 16);
  const rows = clampScenarioInt(options.rows, 8, 50, 16);
  const scenarioNumber = campaignMode.campaignData.scenarios.length + 1;
  const rng = createScenarioRng(`${profile.label}-${aiCount}-${cols}-${rows}-${Date.now()}-${Math.random()}`);
  const teams = getScenarioTeams(aiCount);
  const anchors = getScenarioAnchors(cols, rows, aiCount, profile);
  const terrainGrid = generateScenarioTerrain(cols, rows, aiCount, profile, anchors, rng);
  const occupied = new Set();
  const startingUnits = {};
  const settlementsList = [];

  addGeneratedUnitGroup(
    startingUnits,
    'PLAYER',
    [...profile.playerUnits, ...profile.playerBonus.slice(0, Math.max(0, aiCount - 1))],
    anchors.PLAYER,
    cols,
    rows,
    terrainGrid,
    occupied,
    rng
  );
  addGeneratedSettlement(settlementsList, occupied, cols, rows, terrainGrid, anchors.PLAYER, profile.playerSettlement, 'PLAYER', rng);

  aiTeamNames.slice(0, aiCount).forEach((team, index) => {
    const aiUnits = [...profile.aiUnits];
    if (profile.label === 'Brutal' && index === 0 && cols * rows >= 140) aiUnits.push('Dragon');
    addGeneratedUnitGroup(startingUnits, team, aiUnits, anchors[team], cols, rows, terrainGrid, occupied, rng);
    addGeneratedSettlement(settlementsList, occupied, cols, rows, terrainGrid, anchors[team], profile.aiSettlement, team, rng);
  });

  const neutralCount = Math.max(2, profile.neutralSettlements + Math.floor((cols * rows) / 160));
  for (let i = 0; i < neutralCount; i++) {
    const center = {
      col: Math.floor(cols * (0.25 + rng() * 0.55)),
      row: Math.floor(rows * (0.15 + rng() * 0.70))
    };
    addGeneratedSettlement(settlementsList, occupied, cols, rows, terrainGrid, center, rng() > 0.72 ? 'CITY' : rng() > 0.45 ? 'VILLAGE' : 'HAMLET', null, rng);
  }

  const pressure = balanceGeneratedScenario(startingUnits, teams, profile, rng);
  // Reposition any reinforcement units that were added at their team's anchor.
  teams.filter(team => team !== 'PLAYER').forEach(team => {
    startingUnits[team].forEach(unit => {
      if (!unit.needsPlacement) return;
      const position = findScenarioOpenTile(cols, rows, terrainGrid, occupied, anchors[team], 5, rng);
      unit.col = position.col;
      unit.row = position.row;
      delete unit.needsPlacement;
    });
  });

  const terrainList = [];
  terrainGrid.forEach((type, index) => {
    if (!type) return;
    terrainList.push({
      type,
      col: index % cols,
      row: Math.floor(index / cols),
      index
    });
  });

  const victoryCondition = normalizeVictoryCondition({ type: 'ANNIHILATE_ALL' });
  const scenario = {
    name: `${profile.label} Generated War ${scenarioNumber}`,
    description: `Generated ${profile.label.toLowerCase()} scenario for ${aiCount} AI faction${aiCount === 1 ? '' : 's'} on a ${cols}x${rows} map. Terrain is built from clustered regions, armies start in grouped formations, and the AI pressure score is ${pressure.toFixed(2)}.`,
    victory: getVictoryConditionLabel(victoryCondition),
    difficulty: profile.label,
    startingUnits,
    startingResources: createGeneratedStartingResources(teams, profile, aiCount),
    aiCount,
    mapSize: { cols, rows },
    settlements: settlementsList,
    terrain: terrainList,
    diplomacy: createDefaultWarDiplomacy(teams),
    victoryCondition,
    generated: true,
    balanceScore: Number(pressure.toFixed(2))
  };
  return scenario;
}

function generateScenarioFromControls() {
  normalizeCampaignData();
  const difficulty = document.getElementById('scenarioGeneratorDifficulty')?.value || 'Standard';
  const aiCount = document.getElementById('scenarioGeneratorAI')?.value || 1;
  const cols = document.getElementById('scenarioGeneratorCols')?.value || 16;
  const rows = document.getElementById('scenarioGeneratorRows')?.value || 16;
  const scenario = generateScenario({ difficulty, aiCount, cols, rows });
  campaignMode.campaignData.scenarios.push(scenario);
  renderScenariosEditor();
  saveCampaign();
  setTimeout(() => {
    const scenariosList = document.getElementById('scenariosList');
    if (scenariosList.lastElementChild) scenariosList.lastElementChild.scrollIntoView({ behavior: 'smooth' });
  }, 100);
  showPopup('Scenario Generated', `${scenario.name} created with ${scenario.aiCount} AI faction${scenario.aiCount === 1 ? '' : 's'}, ${scenario.terrain.length} clustered terrain tiles, and ${Object.values(scenario.startingUnits).flat().length} grouped units.`, 'success');
}

function saveCampaign() {
  normalizeCampaignData();
  campaignMode.campaignData.name = document.getElementById('campaignNameInput')?.value || campaignMode.campaignData.name;
  localStorage.setItem('customCampaign', JSON.stringify(campaignMode.campaignData));
  showPopup("Campaign Saved", "Your campaign has been saved locally.", "success");
  renderScenariosEditor();
}

function loadCampaign() {
  const savedCampaign = localStorage.getItem('customCampaign');
  if (savedCampaign) {
    try {
      campaignMode.campaignData = JSON.parse(savedCampaign);
      normalizeCampaignData();
      const nameInput = document.getElementById('campaignNameInput');
      if (nameInput) nameInput.value = campaignMode.campaignData.name;
      renderScenariosEditor();
      showPopup("Campaign Loaded", "Your saved campaign has been loaded.", "success");
    } catch (e) {
      showPopup("Load Failed", "Failed to load campaign data.", "error");
    }
  } else {
    showPopup("No Campaign", "No saved campaign found.", "info");
  }
}

function startCampaign() {
  try { SoundManager.startBackgroundMusic(); } catch (e) {}
  saveCampaign();
  campaignMode.active = true;
  campaignMode.currentScenarioIndex = 0;
  gameMode = 'campaign';
  document.getElementById('gameModeSelect').value = 'campaign';
  closeCampaignPage(false);
  loadCurrentScenario();
  updateCampaignUI();
}

function loadCurrentScenario() {
  const scenario = campaignMode.campaignData.scenarios[campaignMode.currentScenarioIndex];
  currentVictoryCondition = normalizeVictoryCondition(scenario.victoryCondition || inferVictoryConditionFromText(scenario.victory));
  
  // Show scenario description popup
  showPopup(
    scenario.name,
    scenario.description + `\n\nVictory Condition: ${scenario.victory}`,
    "info"
  );
  
  // Set up the game based on scenario parameters
  currentAIPlayers = scenario.aiCount || currentAIPlayers;
  COLS = scenario.mapSize.cols;
  ROWS = scenario.mapSize.rows;
  mapSize = { cols: COLS, rows: ROWS };
  
  // Override starting resources
  Object.keys(scenario.startingResources).forEach(team => {
    resources[team] = { ...scenario.startingResources[team] };
    startingResources[team] = { ...scenario.startingResources[team] };
  });
  
  // Start the game (this initializes empty settlements and terrain)
  setupGame();
  if (scenario.diplomacy) {
    diplomacy = clonePlain(scenario.diplomacy);
    ensureDiplomacyForActiveTeams();
  }
  
  // Restore settlements from scenario
  if (scenario.settlements) {
    scenario.settlements.forEach(settlementData => {
      const index = settlementData.row * COLS + settlementData.col;
      if (index >= 0 && index < settlements.length) {
        settlements[index] = {
          type: settlementData.type,
          owner: settlementData.owner
        };
      }
    });
  }
  
  // Restore terrain from scenario
  if (scenario.terrain) {
    scenario.terrain.forEach(terrainData => {
      const index = terrainData.row * COLS + terrainData.col;
      if (index >= 0 && index < terrain.length) {
        terrain[index] = terrainData.type;
      }
    });
  }
  
  // Clear default units and place scenario-specific units
  units = [];
  if (scenario.startingUnits) {
    Object.keys(scenario.startingUnits).forEach(team => {
      scenario.startingUnits[team].forEach(unitData => {
        units.push(makeUnit(unitData.type, team, unitData.col, unitData.row, { id: unitData.id }));
      });
    });
  }
  if (currentVictoryCondition.type === 'KILL_UNIT_LIMIT' &&
      !units.some(u => u.id === currentVictoryCondition.targetUnitId) &&
      units.some(u => u.team !== 'PLAYER')) {
    currentVictoryCondition.targetUnitId = units.find(u => u.team !== 'PLAYER').id;
  }
  
  applyVictoryConditionToUI();
  updateUI();
  captureScenarioSnapshot();
}

function changeScenario(direction) {
  const newIndex = campaignMode.currentScenarioIndex + direction;
  if (newIndex >= 0 && newIndex < campaignMode.campaignData.scenarios.length) {
    campaignMode.currentScenarioIndex = newIndex;
    loadCurrentScenario();
    updateCampaignUI();
  }
}

function nextScenario() {
  if (campaignMode.currentScenarioIndex < campaignMode.campaignData.scenarios.length - 1) {
    campaignMode.currentScenarioIndex++;
    showPopup("Scenario Complete!", "Moving to the next scenario.", "success");
    loadCurrentScenario();
    updateCampaignUI();
  } else {
    showPopup("Campaign Complete!", "Congratulations! You have completed the entire campaign!", "success");
    campaignMode.active = false;
  }
}

function updateCampaignUI() {
  const campaignControls = document.getElementById('campaignControls');
  const currentScenarioDisplay = document.getElementById('currentScenarioDisplay');
  const scenarioNameDisplay = document.getElementById('scenarioNameDisplay');
  const prevBtn = document.getElementById('prevScenarioBtn');
  const nextBtn = document.getElementById('nextScenarioBtn');
  
  // Check if elements exist before updating
  if (!campaignControls || !currentScenarioDisplay || !scenarioNameDisplay || !prevBtn || !nextBtn) {
    return;
  }
  
  if (campaignMode.active && campaignMode.campaignData.scenarios.length > 0) {
    campaignControls.style.setProperty('display', 'block', 'important');
    campaignControls.style.visibility = 'visible';
    const scenario = campaignMode.campaignData.scenarios[campaignMode.currentScenarioIndex];
    currentScenarioDisplay.textContent = `${campaignMode.currentScenarioIndex + 1} / ${campaignMode.campaignData.scenarios.length}`;
    scenarioNameDisplay.textContent = scenario.name;
    
    prevBtn.disabled = campaignMode.currentScenarioIndex === 0;
    nextBtn.disabled = campaignMode.currentScenarioIndex === campaignMode.campaignData.scenarios.length - 1;
  } else {
    campaignControls.style.setProperty('display', 'none', 'important');
    campaignControls.style.visibility = 'hidden';
  }
}

function exportCampaign() {
  const campaignJson = JSON.stringify(campaignMode.campaignData, null, 2);
  const blob = new Blob([campaignJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${campaignMode.campaignData.name.replace(/\s+/g, '_')}_campaign.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showPopup("Campaign Exported", "Campaign file has been downloaded.", "success");
}

function importCampaign() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = function(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const importedCampaign = JSON.parse(e.target.result);
          
          // Validate campaign structure
          if (!importedCampaign.name || !Array.isArray(importedCampaign.scenarios)) {
            throw new Error("Invalid campaign format");
          }
          
          campaignMode.campaignData = importedCampaign;
          normalizeCampaignData();
          const nameInput = document.getElementById('campaignNameInput');
          if (nameInput) nameInput.value = campaignMode.campaignData.name;
          renderScenariosEditor();
          
          showPopup("Campaign Imported", `Campaign "${importedCampaign.name}" has been imported successfully.`, "success");
        } catch (error) {
          showPopup("Import Failed", "Failed to import campaign. Please check the file format.", "error");
        }
      };
      reader.readAsText(file);
    }
  };
  
  input.click();
}

function createNewCampaign() {
  campaignMode.campaignData = {
    name: "My New Campaign",
    scenarios: [
      {
        name: "Opening Battle",
        description: "Your journey begins here. Learn the basics of combat and strategy as you face your first challenge.",
        victory: "Defeat all enemies",
        difficulty: "Easy",
        startingUnits: {
          PLAYER: [{type: "Knight", col: 1, row: 2}],
          AI: [{type: "Archer", col: 7, row: 5}]
        },
        startingResources: {
          PLAYER: {gold: 30, materials: 5},
          AI: {gold: 20, materials: 0}
        },
        aiCount: 1,
        mapSize: {cols: 10, rows: 8}
      }
    ]
  };
  
  const nameInput = document.getElementById('campaignNameInput');
  if (nameInput) nameInput.value = campaignMode.campaignData.name;
  renderScenariosEditor();
  showPopup("New Campaign Created", "A blank campaign has been created. Add more scenarios and customize them!", "success");
}

function testScenario(index) {
  saveCampaign();
  campaignMode.active = true;
  campaignMode.currentScenarioIndex = index;
  gameMode = 'campaign';
  document.getElementById('gameModeSelect').value = 'campaign';
  closeCampaignPage(false);
  loadCurrentScenario();
  updateCampaignUI();
}

function openAdvancedScenarioEditor(scenarioIndex) {
  const scenario = campaignMode.campaignData.scenarios[scenarioIndex];
  
  // Update modal title
  document.getElementById('advancedScenarioTitle').textContent = `⚙️ Advanced Editor - Scenario ${scenarioIndex + 1}`;
  
  // Create the modal content
  const content = document.getElementById('advancedScenarioContent');
  content.innerHTML = `
    <div style="margin-bottom: 16px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px;">
      <div style="margin-bottom: 8px; color: var(--accent); font-weight: 600;">Current Scenario:</div>
      <div style="font-size: 14px; line-height: 1.4;">
        <strong>Name:</strong> ${scenario.name}<br>
        <strong>Description:</strong> ${scenario.description}<br>
        <strong>Victory:</strong> ${scenario.victory}<br>
        <strong>AI Count:</strong> ${scenario.aiCount}
      </div>
    </div>
    
    <div style="margin-bottom: 16px; padding: 12px; background: rgba(100, 150, 255, 0.1); border-radius: 8px; border-left: 4px solid #6c5ce7;">
      <div style="margin-bottom: 8px; color: #6c5ce7; font-weight: 600;">📝 How to Create Your Scenario:</div>
      <ol style="margin: 0; padding-left: 20px; line-height: 1.6;">
        <li>Close this modal and switch to <strong>Editor Mode</strong> in the main game</li>
        <li>Set up your scenario: place units, add terrain features, create settlements</li>
        <li>Come back here and click <strong>"📸 Capture Current Setup"</strong></li>
        <li>This will save your exact game layout to this scenario</li>
      </ol>
    </div>
    
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button onclick="captureCurrentGameState(${scenarioIndex})" style="background: #00b894; color: white; border: none; border-radius: 6px; padding: 10px 16px; cursor: pointer; font-weight: 600; font-size: 14px;">
        📸 Capture Current Setup
      </button>
      <button onclick="loadScenarioForEditing(${scenarioIndex})" style="background: #6c5ce7; color: white; border: none; border-radius: 6px; padding: 10px 16px; cursor: pointer; font-weight: 600; font-size: 14px;">
        📋 Load for Editing
      </button>
    </div>
  `;
  
  // Show the modal
  document.getElementById('advancedScenarioModal').style.display = 'block';
}

function closeAdvancedScenarioEditor() {
  const modal = document.getElementById('advancedScenarioModal');
  if (modal) modal.style.display = 'none';
}

function captureCurrentGameState(scenarioIndex) {
  const scenario = campaignMode.campaignData.scenarios[scenarioIndex];
  readVictoryConditionFromUI();
  
  // Capture current map size
  scenario.mapSize = {cols: COLS, rows: ROWS};
  if (hasAIDiplomacy()) ensureDiplomacyForActiveTeams();
  scenario.diplomacy = clonePlain(diplomacy || {});
  scenario.victoryCondition = normalizeVictoryCondition(currentVictoryCondition);
  
  // Capture starting units from current game state
  scenario.startingUnits = {};
  if (units && units.length > 0) {
    units.forEach(unit => {
      if (!scenario.startingUnits[unit.team]) {
        scenario.startingUnits[unit.team] = [];
      }
      scenario.startingUnits[unit.team].push({
        id: unit.id,
        type: unit.name,
        col: unit.col,
        row: unit.row
      });
    });
  }
  
  // Capture settlements
  scenario.settlements = [];
  if (settlements && settlements.length > 0) {
    settlements.forEach((settlement, index) => {
      if (settlement) {
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        scenario.settlements.push({
          type: settlement.type,
          owner: settlement.owner,
          col: col,
          row: row,
          index: index
        });
      }
    });
  }
  
  // Capture terrain
  scenario.terrain = [];
  if (terrain && terrain.length > 0) {
    terrain.forEach((terrainType, index) => {
      if (terrainType) {
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        scenario.terrain.push({
          type: terrainType,
          col: col,
          row: row,
          index: index
        });
      }
    });
  }
  
  // Capture starting resources
  scenario.startingResources = JSON.parse(JSON.stringify(resources));
  scenario.victoryCondition = normalizeVictoryCondition(currentVictoryCondition);
  scenario.victory = getVictoryConditionLabel(scenario.victoryCondition);
  
  // Update AI count based on active teams
  const aiTeams = getActiveTeams().filter(team => isAITeam(team));
  scenario.aiCount = Math.max(aiTeams.length, 1); // Ensure at least 1 AI
  
  // Close the advanced editor modal
  closeAdvancedScenarioEditor();
  
  // Count captured elements
  const unitCount = units ? units.length : 0;
  const settlementCount = scenario.settlements ? scenario.settlements.length : 0;
  const terrainCount = scenario.terrain ? scenario.terrain.length : 0;
  
  // Show success message
  showPopup("Setup Captured!", `Scenario "${scenario.name}" has been updated with:\n• ${unitCount} units\n• ${settlementCount} settlements\n• ${terrainCount} terrain features\n• Map size: ${COLS}×${ROWS}\n• ${aiTeams.length} AI opponents`, "success");
  
  // Refresh the editor display
  renderScenariosEditor();
  saveCampaign();
}

function loadScenarioForEditing(scenarioIndex) {
  const scenario = campaignMode.campaignData.scenarios[scenarioIndex];
  
  try {
    currentVictoryCondition = normalizeVictoryCondition(scenario.victoryCondition || inferVictoryConditionFromText(scenario.victory));
    // Set map size
    COLS = scenario.mapSize?.cols || 10;
    ROWS = scenario.mapSize?.rows || 8;
    mapSize = { cols: COLS, rows: ROWS };
    
    // Set AI count
    aiPlayerCount = scenario.aiCount || 1;
    currentAIPlayers = aiPlayerCount;
    
    // Apply resources
    if (scenario.startingResources) {
      Object.keys(scenario.startingResources).forEach(team => {
        resources[team] = {...scenario.startingResources[team]};
        startingResources[team] = {...scenario.startingResources[team]};
      });
    }
    
    // Initialize empty settlements and terrain arrays
    settlements = Array(COLS * ROWS).fill(null);
    terrain = Array(COLS * ROWS).fill(null);
    
    // Restore settlements
    if (scenario.settlements) {
      scenario.settlements.forEach(settlementData => {
        const index = settlementData.row * COLS + settlementData.col;
        if (index >= 0 && index < settlements.length) {
          settlements[index] = {
            type: settlementData.type,
            owner: settlementData.owner
          };
        }
      });
    }
    
    // Restore terrain
    if (scenario.terrain) {
      scenario.terrain.forEach(terrainData => {
        const index = terrainData.row * COLS + terrainData.col;
        if (index >= 0 && index < terrain.length) {
          terrain[index] = terrainData.type;
        }
      });
    }
    
    // Clear and place units
    units = [];
    if (scenario.startingUnits) {
      Object.keys(scenario.startingUnits).forEach(team => {
        scenario.startingUnits[team].forEach(unitData => {
          units.push(makeUnit(unitData.type, team, unitData.col, unitData.row, { id: unitData.id }));
        });
      });
    }
    if (currentVictoryCondition.type === 'KILL_UNIT_LIMIT' &&
        !units.some(u => u.id === currentVictoryCondition.targetUnitId) &&
        units.some(u => u.team !== 'PLAYER')) {
      currentVictoryCondition.targetUnitId = units.find(u => u.team !== 'PLAYER').id;
    }
    
    // Initialize multi-AI system
    initializeResourcesForActiveTeams();
    calculateTurnOrder();
    if (scenario.diplomacy) {
      diplomacy = clonePlain(scenario.diplomacy);
      ensureDiplomacyForActiveTeams();
    } else if (hasAIDiplomacy()) {
      initializeDiplomacy();
    }
    
    // Switch to editor mode
    isEditorMode = true;
    currentTeam = 'PLAYER';
    selectedUnit = null;
    
    // Close the advanced editor modal
    closeAdvancedScenarioEditor();
    
    // Update UI
    updateUI();
    applyVictoryConditionToUI();
    
    // Count loaded elements
    const settlementCount = scenario.settlements ? scenario.settlements.length : 0;
    const terrainCount = scenario.terrain ? scenario.terrain.length : 0;
    
    showPopup("Scenario Loaded", `Scenario "${scenario.name}" loaded for editing:\n• ${units.length} units\n• ${settlementCount} settlements\n• ${terrainCount} terrain features\nYou are now in Editor Mode.`, "success");
    
  } catch (error) {
    console.error('Error loading scenario:', error);
    showPopup("Load Failed", "Failed to load scenario for editing. Please check the scenario data.", "error");
  }
}

function upgradeSelectedUnitToWater() {
  if(isAITeam(currentTeam)||isFortressUnit(selectedUnit)||selectedUnit?.name==='Dragon')return;
  if (!selectedUnit || selectedUnit.team !== currentTeam) {
    console.log('No valid unit selected for water upgrade');
    return;
  }
  
  if (selectedUnit.isWaterUnit) {
    console.log('Unit is already a water unit');
    return;
  }
  
  if (getGold(currentTeam) < 2) {
    console.log('Not enough gold for water upgrade (need 2)');
    return;
  }
  
  // Upgrade the unit
  selectedUnit.isWaterUnit = true;
  deductResources(currentTeam, { gold: 2 });
  
  console.log(`Upgraded ${selectedUnit.name} to water unit for 2 gold`);
  updateUI();
}

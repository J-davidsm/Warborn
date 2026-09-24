// Warborn source split from the original game.js.
// Section: js/systems/economy-research.js

// Economy: resources per team
// two-resource economy: Gold, Materials
let resources = { 
  PLAYER: { gold: 0, materials: 0 },
  AI: { gold: 0, materials: 0 },
  PLAYER2: { gold: 0, materials: 0 }
};

// Research system: tracks what units each team has researched
let researchedUnits = {
  PLAYER: new Set(['Soldier']), // Start with only basic soldier
  AI: new Set(['Soldier']),
  PLAYER2: new Set(['Soldier'])
};

// Research costs for each unit type (gold only)
const RESEARCH_COSTS = {
  // Basic units
  'Spearman': 5,
  'Archer': 4,
  'Swordsman': 8,
  
  // Advanced units
  'Assassin': 22,
  'Knight': 15,
  'Catapult': 20,
  'Dragon': 30,
  'Cleric': 12,
  
  // Naval units
  'Sloop': 8,
  'Man-of-War': 18,
  'Battleship': 25,
  
  // Fortresses
  'Stockade': 6,
  'Castle': 15,
  'Heavy Fortress': 25
};

// Resource utility functions
function getResources(team) {
  return resources[team] || { gold: 0, materials: 0 };
}

function hasResources(team, cost) {
  const teamRes = getResources(team);
  return (teamRes.gold >= (cost.gold || 0)) &&
         (teamRes.materials >= (cost.materials || 0));
}

function spendResources(team, cost) {
  if (!hasResources(team, cost)) return false;
  const teamRes = resources[team];
  teamRes.gold -= (cost.gold || 0);
  teamRes.materials -= (cost.materials || 0);
  return true;
}

function addResources(team, amount) {
  if (!resources[team]) {
    resources[team] = { gold: 0, materials: 0 };
  }
  resources[team].gold += (amount.gold || 0);
  resources[team].materials += (amount.materials || 0);
}

function getResourceTotal(teamOrResources) {
  const value = typeof teamOrResources === 'string' ? getResources(teamOrResources) : teamOrResources;
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return 0;
  return (value.gold || 0) + (value.materials || 0);
}

function getResourceValue(teamOrResources) {
  const value = typeof teamOrResources === 'string' ? getResources(teamOrResources) : teamOrResources;
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return 0;
  return (value.gold || 0) * 1.4 + (value.materials || 0) * 1.8;
}

function getGold(team) {
  const teamRes = getResources(team);
  return typeof teamRes === 'number' ? teamRes : (teamRes.gold || 0);
}

function canAfford(team, cost) {
  if (!resources[team]) return false;
  
  const effectiveCost = getEffectiveCost(cost);
  
  // Handle single cost (legacy land units) - use gold
  if (typeof effectiveCost === 'number') {
    return resources[team].gold >= effectiveCost;
  }
  
  // Handle two-resource cost (naval units and new system)
  if (typeof effectiveCost === 'object') {
    return (resources[team].gold >= (effectiveCost.gold || 0)) &&
           (resources[team].materials >= (effectiveCost.materials || 0));
  }
  
  return false;
}

function deductResources(team, cost) {
  if (!resources[team]) {
    resources[team] = { gold: 0, materials: 0 };
  }
  
  const effectiveCost = getEffectiveCost(cost);
  
  // Handle single cost (legacy land units) - deduct from gold
  if (typeof effectiveCost === 'number') {
    resources[team].gold -= effectiveCost;
    return;
  }
  
  // Handle two-resource cost
  if (typeof effectiveCost === 'object') {
    resources[team].gold -= (effectiveCost.gold || 0);
    resources[team].materials -= (effectiveCost.materials || 0);
  }
}

function hasFarmsOnMap() {
  if (!terrain) return false;
  return terrain.some(t => t === 'FARM');
}

function getEffectiveCost(unitCost) {
  return typeof unitCost==='object' ? {gold:unitCost.gold||0,materials:unitCost.materials||0} : unitCost;
}

function formatCost(cost) {
  const effectiveCost = getEffectiveCost(cost);
  
  // Handle single cost (legacy land units)
  if (typeof effectiveCost === 'number') {
    return `${effectiveCost}G`;
  }
  
  // Handle two-resource cost
  if (typeof effectiveCost === 'object') {
    const parts = [];
    if (effectiveCost.gold > 0) parts.push(`${effectiveCost.gold}G`);
    if (effectiveCost.materials > 0) parts.push(`${effectiveCost.materials}M`);
    return parts.join('/') || '0';
  }
  
  return '0';
}

// Research system functions
function hasResearched(team, unitType) {
  // Auto-initialize research for new AI teams
  if (!researchedUnits[team]) {
    researchedUnits[team] = new Set(['Soldier']); // All teams start with Soldier
  }
  return researchedUnits[team] && researchedUnits[team].has(unitType);
}

function canResearch(team, unitType) {
  if (hasResearched(team, unitType)) return false;
  const cost = RESEARCH_COSTS[unitType];
  if (!cost) return false; // Unit doesn't require research
  return resources[team] && resources[team].gold >= cost;
}

function researchUnit(team, unitType) {
  const cost = RESEARCH_COSTS[unitType];
  if (!canResearch(team, unitType)) return false;
  
  resources[team].gold -= cost;
  if (!researchedUnits[team]) researchedUnits[team] = new Set();
  researchedUnits[team].add(unitType);
  
  console.log(`${team} researched ${unitType} for ${cost} gold`);
  return true;
}

function getResearchableUnits(team) {
  return Object.keys(RESEARCH_COSTS).filter(unitType => !hasResearched(team, unitType));
}

// Every new battle and replay starts with an empty treasury.
function resetStartingEconomy() {
  const empty = () => Object.fromEntries(getActiveTeams().map(team => [team, {gold:0, materials:0}]));
  resources = empty();
  startingResources = empty();
}

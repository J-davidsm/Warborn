// Warborn source split from the original game.js.
// Section: js/ui/popups-and-assets.js

// Custom Popup System
function showPopup(title, message, type = 'info') {
  // Remove any existing popup
  const existingPopup = document.getElementById('customPopup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'customPopup';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  `;
  
  // Create popup container
  const popup = document.createElement('div');
  popup.style.cssText = `
    background: #2a3440;
    border: 2px solid #4ecdc4;
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    color: white;
    font-family: inherit;
    pointer-events: auto;
  `;
  popup.onclick = (e) => e.stopPropagation();
  
  // Create title
  const titleElement = document.createElement('div');
  titleElement.style.cssText = `
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 16px;
    color: #4ecdc4;
  `;
  titleElement.textContent = title;
  
  // Create message
  const messageElement = document.createElement('div');
  messageElement.style.cssText = `
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 20px;
    white-space: pre-line;
  `;
  messageElement.textContent = message;
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.style.cssText = `
    background: #4ecdc4;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    color: #1e2933;
    font-weight: bold;
    cursor: pointer;
    float: right;
  `;
  closeButton.textContent = 'Close';
  closeButton.onclick = () => overlay.remove();
  
  // Assemble popup
  popup.appendChild(titleElement);
  popup.appendChild(messageElement);
  popup.appendChild(closeButton);
  overlay.appendChild(popup);
  
  // Add to document
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  };
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Comprehensive settlement definitions - single source of truth for all settlement properties
 * Each settlement type provides income, healing, and defensive bonuses to occupying units
 */
const SETTLEMENTS = {
  /** Basic settlement - provides modest income and healing */
  HAMLET: { 
    healPct: 0.03,     // Heals 3% of unit's max HP per turn
    emoji: '🏡',       // Display icon
    defense: 0.05,     // 5% damage reduction for occupying units
    income: { food: 0, gold: 1, materials: 0 } // Resources generated per turn
  },
  
  /** Intermediate settlement - better bonuses than hamlet */
  VILLAGE: { 
    healPct: 0.05,     // Heals 5% of unit's max HP per turn  
    emoji: '🏘️',       // Display icon
    defense: 0.10,     // 10% damage reduction for occupying units
    income: { food: 0, gold: 2, materials: 0 } // Resources generated per turn
  },
  
  /** Advanced settlement - maximum bonuses and strategic value */
  CITY: { 
    healPct: 0.07,     // Heals 7% of unit's max HP per turn
    emoji: '🏰',       // Display icon  
    defense: 0.15,     // 15% damage reduction for occupying units
    income: { food: 0, gold: 3, materials: 2 } // Resources generated per turn
  },
  
  /** Naval settlement - can build ships, must be on coast */
  PORT: { 
    healPct: 0.05,     // Heals 5% of unit's max HP per turn
    emoji: '⚓',        // Display icon  
    defense: 0.12,     // 12% damage reduction for occupying units
    income: { food: 0, gold: 4, materials: 3 }, // Resources generated per turn
    allowsNaval: true  // Can build naval units
  }
};

// Image assets map: populated by preloadImages().
const IMAGES = {};
const IMAGE_LOAD_STATUS = {}; // 'loading' | 'loaded' | 'error'

function preloadImages(mapping){
  // mapping: { 'Soldier': 'assets/soldier.png', ... }
  Object.keys(mapping).forEach(name => {
    const url = mapping[name];
    IMAGE_LOAD_STATUS[name] = 'loading';
    const img = new Image();
    img.onload = () => { IMAGES[name] = img; IMAGE_LOAD_STATUS[name] = 'loaded'; };
    img.onerror = () => { IMAGE_LOAD_STATUS[name] = 'error'; console.warn('Failed to load image for', name, url); };
    img.src = url;
  });
}

// Default mapping for Warborn's unit art.
const DEFAULT_IMAGE_MAP = {
  'Soldier': 'assets/soldier.png',
  'Archer': 'assets/archer.png',
  'Knight': 'assets/knight.png',
  'Catapult': 'assets/catapult.png',
  'Spearman': 'assets/spearman.png',
  'Swordsman': 'assets/swordsman.png',
  'Assassin': 'assets/assassin.png',
  'Dragon': 'assets/dragon.png',
  'Cleric': 'assets/cleric.png',
  'Stockade': 'assets/stockade.png',
  'Castle': 'assets/castle.png',
  'Heavy Fortress': 'assets/heavy_fortress.png'
};

try{ preloadImages(DEFAULT_IMAGE_MAP); } catch(e){ console.warn('Image preload failed', e); }

const INDICATOR_IMAGES = {};
const INDICATOR_IMAGE_STATUS = {};
const INDICATOR_IMAGE_MAP = {
  rank_0: 'assets/indicators/rank_0.png',
  rank_1: 'assets/indicators/rank_1.png',
  rank_2: 'assets/indicators/rank_2.png',
  rank_3: 'assets/indicators/rank_3.png',
  rank_4: 'assets/indicators/rank_4.png',
  morale_0: 'assets/indicators/morale_0.png',
  morale_1: 'assets/indicators/morale_1.png',
  morale_2: 'assets/indicators/morale_2.png',
  morale_3: 'assets/indicators/morale_3.png',
  morale_4: 'assets/indicators/morale_4.png'
};

function preloadIndicatorImages() {
  Object.entries(INDICATOR_IMAGE_MAP).forEach(([name, url]) => {
    const img = new Image();
    INDICATOR_IMAGE_STATUS[name] = 'loading';
    img.onload = () => { INDICATOR_IMAGES[name] = img; INDICATOR_IMAGE_STATUS[name] = 'loaded'; };
    img.onerror = () => { INDICATOR_IMAGE_STATUS[name] = 'error'; console.warn('Failed to load indicator image for', name, url); };
    img.src = url;
  });
}

try{ preloadIndicatorImages(); } catch(e){ console.warn('Indicator preload failed', e); }

const TERRAIN_ART_IMAGES = {};
const TERRAIN_ART_STATUS = {};
const TERRAIN_ART_MAP = {
  desertBlock: 'assets/terrain/desert_block.png',
  marshBlock: 'assets/terrain/marsh_block.png',
  desertHexes: [
    'assets/terrain/desert_hex_0.png',
    'assets/terrain/desert_hex_1.png',
    'assets/terrain/desert_hex_2.png',
    'assets/terrain/desert_hex_3.png',
    'assets/terrain/desert_hex_4.png',
    'assets/terrain/desert_hex_5.png',
    'assets/terrain/desert_hex_6.png',
    'assets/terrain/desert_hex_7.png',
    'assets/terrain/desert_hex_8.png',
    'assets/terrain/desert_hex_9.png'
  ],
  forestHexes: [
    'assets/terrain/forest_hex_0.png',
    'assets/terrain/forest_hex_1.png',
    'assets/terrain/forest_hex_2.png',
    'assets/terrain/forest_hex_3.png',
    'assets/terrain/forest_hex_4.png',
    'assets/terrain/forest_hex_5.png',
    'assets/terrain/forest_hex_6.png',
    'assets/terrain/forest_hex_7.png',
    'assets/terrain/forest_hex_8.png',
    'assets/terrain/forest_hex_9.png'
  ],
  marshHexes: [
    'assets/terrain/marsh_hex_0.png',
    'assets/terrain/marsh_hex_1.png',
    'assets/terrain/marsh_hex_2.png',
    'assets/terrain/marsh_hex_3.png',
    'assets/terrain/marsh_hex_4.png',
    'assets/terrain/marsh_hex_5.png',
    'assets/terrain/marsh_hex_6.png',
    'assets/terrain/marsh_hex_7.png',
    'assets/terrain/marsh_hex_8.png',
    'assets/terrain/marsh_hex_9.png'
  ],
  mountains: [
    'assets/terrain/mountain_0.png',
    'assets/terrain/mountain_1.png',
    'assets/terrain/mountain_2.png',
    'assets/terrain/mountain_3.png',
    'assets/terrain/mountain_4.png',
    'assets/terrain/mountain_5.png',
    'assets/terrain/mountain_6.png',
    'assets/terrain/mountain_7.png',
    'assets/terrain/mountain_8.png'
  ],
  trees: [
    'assets/terrain/tree_0.png',
    'assets/terrain/tree_1.png',
    'assets/terrain/tree_3.png',
    'assets/terrain/tree_4.png',
    'assets/terrain/tree_5.png',
    'assets/terrain/tree_6.png',
    'assets/terrain/tree_7.png',
    'assets/terrain/tree_8.png'
  ]
};

function preloadTerrainArt() {
  const assetName = (url, fallback) => {
    const file = String(url || '').split('/').pop() || fallback;
    return file.replace(/\.png$/i, '') || fallback;
  };
  const load = (name, url) => {
    TERRAIN_ART_STATUS[name] = 'loading';
    const img = new Image();
    img.onload = () => { TERRAIN_ART_IMAGES[name] = img; TERRAIN_ART_STATUS[name] = 'loaded'; };
    img.onerror = () => { TERRAIN_ART_STATUS[name] = 'error'; console.warn('Failed to load terrain art for', name, url); };
    img.src = url;
  };
  load('desertBlock', TERRAIN_ART_MAP.desertBlock);
  load('marshBlock', TERRAIN_ART_MAP.marshBlock);
  TERRAIN_ART_MAP.desertHexes.forEach((url, index) => load(assetName(url, `desert_hex_${index}`), url));
  TERRAIN_ART_MAP.forestHexes.forEach((url, index) => load(assetName(url, `forest_hex_${index}`), url));
  TERRAIN_ART_MAP.marshHexes.forEach((url, index) => load(assetName(url, `marsh_hex_${index}`), url));
  TERRAIN_ART_MAP.mountains.forEach((url, index) => load(assetName(url, `mountain_${index}`), url));
  TERRAIN_ART_MAP.trees.forEach((url, index) => load(assetName(url, `tree_${index}`), url));
}

// Load legacy artwork only when this build is used without the blended renderer.
document.addEventListener('DOMContentLoaded', () => {
  if (typeof drawBlendedTerrainBoard !== 'function') {
    try { preloadTerrainArt(); } catch (e) { console.warn('Terrain art preload failed', e); }
  }
});

// Map of owner -> flag emoji for visual ownership marker
const SETTLEMENT_FLAGS = {
  PLAYER: '🚩',
  AI: '🏴',
  PLAYER2: '🚩'
};
// Terrain types and their effects
const TERRAIN = {
  WOODS: { 
    emoji: '🌲',
    getDefense: () => 0.30, // Good defensive terrain for all units
    assassinBonus: true, // Assassins deal double damage to units in woods
    knightPenalty: true // Knights deal only 75% damage when attacking from woods
  },
  MOUNTAIN: {
    emoji: '⛰️',
    getDefense: (attacker) => {
      return attacker && ['Knight', 'Grunt'].includes(attacker.name) ? 0.50 : 0.30; // 50% vs knights/grunts, 30% vs others
    }
  },
  SWAMP: {
    emoji: '🐸',
    getDefense: () => 0.10, // Good defensive terrain
    blockedUnits: ['Knight','Catapult'], // Knights and Catapults cannot enter swamps
    noAttack: true, // Units in swamps cannot attack (except assassins get double damage)
    assassinBonus: true // Assassins deal double damage to units in swamps
  },
  DESERT: {
    emoji: '🏜️',
    getDefense: () => -0.10, // Poor defensive terrain
    damagePerTurn: 10 // Units lose 10 health per turn in desert
  },
  WATER: {
    emoji: '🌊',
    getDefense: () => -0.05, // Minimal defense
    waterOnly: true // Only water units can enter
  },
  FOUNTAIN: {
    emoji: '⛲',
    getDefense: () => 0.20, // Moderate defense
    healPerTurn: 6 // Heals 6 health per turn
  },
  BRIDGE: {
    emoji: '🌉',
    getDefense: () => -0.10, // Poor defensive terrain
    damageMultiplier: 1.1 // Units on bridges take 1.1x damage
  },
  FARM: {
    emoji: '🌾',
    getDefense: () => 0.05, // Minimal defense
    foodProduction: 10 // Produces 10 food per turn when controlled
  }
};

// ========================================
// CAMPAIGN SYSTEM
// ========================================

let campaignMode = {
  active: false,
  currentScenarioIndex: 0,
  campaignData: {
    name: "Default Campaign",
    scenarios: [
      {
        name: "Tutorial: First Steps",
        description: "Learn the basics of commanding your forces. Build your first units and capture settlements to expand your kingdom.",
        victory: "Capture 3 settlements",
        difficulty: "Easy",
        startingUnits: {PLAYER: [{type: "Knight", col: 1, row: 2}], AI: [{type: "Archer", col: 6, row: 5}]},
        startingResources: {PLAYER: {food: 15, gold: 20, materials: 0}, AI: {food: 10, gold: 15, materials: 0}},
        aiCount: 1,
        mapSize: {cols: 8, rows: 8}
      },
      {
        name: "The Border Conflict",
        description: "Neighboring kingdoms threaten your borders. Use strategic thinking and multiple unit types to defeat your enemies.",
        victory: "Eliminate all enemy forces",
        difficulty: "Medium",
        startingUnits: {PLAYER: [{type: "Knight", col: 1, row: 3}, {type: "Archer", col: 2, row: 2}], AI: [{type: "Knight", col: 6, row: 4}, {type: "Footman", col: 7, row: 5}]},
        startingResources: {PLAYER: {food: 20, gold: 25, materials: 5}, AI: {food: 20, gold: 25, materials: 5}},
        aiCount: 1,
        mapSize: {cols: 10, rows: 8}
      },
      {
        name: "The Final Stand",
        description: "Face overwhelming odds as multiple enemies unite against you. This is the ultimate test of your strategic mastery.",
        victory: "Survive 15 turns and control the center",
        difficulty: "Hard",
        startingUnits: {PLAYER: [{type: "Knight", col: 2, row: 4}, {type: "Cleric", col: 1, row: 4}, {type: "Archer", col: 3, row: 3}], AI: [{type: "Knight", col: 7, row: 2}], AI2: [{type: "Footman", col: 8, row: 6}]},
        startingResources: {PLAYER: {food: 30, gold: 40, materials: 15}, AI: {food: 25, gold: 30, materials: 10}, AI2: {food: 25, gold: 30, materials: 10}},
        aiCount: 2,
        mapSize: {cols: 12, rows: 10}
      }
    ]
  }
};

// Grids of settlements and terrain, null means none
// settlements holds either null or an object: { type: 'HAMLET'|'VILLAGE'|'CITY', owner: null|'PLAYER'|'AI'|'PLAYER2' }
let settlements = null; // Will be initialized in setup()
let terrain = null; // Will be initialized in setup()
let turnLabelEl, selNameEl, selDetailsEl, selHPEl, selNumsEl, editorModeBtn;
// Timestamp of the last-applied outbound/inbound snapshot. Used to avoid applying
// older snapshots that would overwrite newer local state (e.g. HP changes).
let lastSnapshotTs = 0;
// Unique id for this client instance; used to ignore our own rebroadcasted snapshots
const localClientId = Math.random().toString(36).slice(2,9);

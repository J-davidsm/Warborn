// Warborn source split from the original game.js.
// Section: js/systems/diplomacy-data.js

// Multi-AI system
let maxAIPlayers = 4; // Maximum number of AI players allowed
let currentAIPlayers = 1; // Current number of AI players (starts with 1 for backward compatibility)
let aiTeamNames = ['AI', 'AI2', 'AI3', 'AI4']; // Names for AI teams

// ========== DIPLOMACY SYSTEM ==========

// Core diplomatic relationships between all factions
let diplomacy = {
  // Trust: bilateral relationship score (-100 to 100)
  trust: {},
  // Reputation: global perception of each faction (-100 to 100)
  reputation: {},
  // Treaties and agreements between factions
  treaties: [],
  // War declarations: { attacker: 'FACTION', target: 'FACTION', declaredTurn: number, canAttackTurn: number }
  warDeclarations: [],
  // Unread messages counter for UI notification bubble
  unreadMessages: 0,
  // AI-generated messages for events
  aiMessages: [],
  // Spy networks and espionage activities
  espionage: {},
  // AI personality archetypes
  personalities: {},
  // Negotiation history and diplomatic actions
  diplomaticHistory: []
};

// AI Personality Archetypes
const AI_PERSONALITIES = {
  AGGRESSIVE: {
    name: 'Warmonger',
    type: 'AGGRESSIVE',
    description: 'Seeks conflict and expansion through force',
    treatyBreakChance: 0.05,
    warlikeness: 0.8,
    trustDecayRate: 1.2,
    coalitionTrigger: 0.6,
    cooperativeness: 0.2,
    friendlyResponses: [
      "Strength respects strength. Your words have merit.",
      "Perhaps there is wisdom in your approach... for now.",
      "I appreciate directness. Speak plainly and we may find common ground."
    ],
    neutralResponses: [
      "Your message is noted. Actions will determine our future relations.",
      "Words are wind. Show me your true intentions through deeds.",
      "I hear you. Time will reveal whether you speak truth or deception."
    ],
    hostileResponses: [
      "You dare threaten me? Your words will be answered with steel!",
      "Insolence! You will regret crossing my path.",
      "Such arrogance deserves a swift and brutal response."
    ]
  },
  DEFENSIVE: {
    name: 'Guardian',
    type: 'DEFENSIVE',
    description: 'Focuses on protection and stability',
    treatyBreakChance: 0.01,
    warlikeness: 0.2,
    trustDecayRate: 0.8,
    coalitionTrigger: 0.3,
    cooperativeness: 0.7,
    friendlyResponses: [
      "Your peaceful words bring hope in these troubled times.",
      "I welcome your desire for harmony between our peoples.",
      "Such diplomacy is refreshing. Let us build lasting peace together."
    ],
    neutralResponses: [
      "Stability is precious. I hope your intentions align with peace.",
      "I remain cautiously optimistic about our future relations.",
      "Your words are considered. I value measured discourse."
    ],
    hostileResponses: [
      "I do not seek conflict, but will defend my people if necessary.",
      "Your aggression saddens me, but I will not be intimidated.",
      "Violence should be the last resort. Reconsider your path."
    ]
  },
  TRADER: {
    name: 'Merchant Prince',
    type: 'TRADER',
    description: 'Values commerce and mutual prosperity',
    treatyBreakChance: 0.02,
    warlikeness: 0.3,
    trustDecayRate: 0.9,
    coalitionTrigger: 0.4,
    cooperativeness: 0.8,
    friendlyResponses: [
      "Excellent! Cooperation enriches all parties involved.",
      "Your proposal has the ring of profit... I mean, mutual benefit.",
      "Now we're talking business! I appreciate pragmatic partners."
    ],
    neutralResponses: [
      "Interesting proposition. What are the terms of this arrangement?",
      "I'm always willing to negotiate. What do you offer?",
      "Business is business. Let's discuss the practical details."
    ],
    hostileResponses: [
      "Hostility is bad for business. This benefits no one.",
      "Your aggressive stance disrupts profitable trade routes.",
      "War costs gold that could be better spent on commerce."
    ]
  },
  IDEOLOGICAL: {
    name: 'Zealot',
    type: 'IDEOLOGICAL',
    description: 'Driven by strong beliefs and principles',
    treatyBreakChance: 0.03,
    warlikeness: 0.5,
    trustDecayRate: 1.1,
    coalitionTrigger: 0.5,
    cooperativeness: 0.4,
    friendlyResponses: [
      "Your words align with the righteous path. I am pleased.",
      "Finally, someone who understands the greater purpose.",
      "Yes! Together we can achieve what is truly important."
    ],
    neutralResponses: [
      "Your motives remain unclear. I must judge your actions carefully.",
      "I will consider whether your goals serve the greater good.",
      "Interesting perspective. Time will reveal your true nature."
    ],
    hostileResponses: [
      "Your corrupt ways disgust me! You represent everything wrong.",
      "Such evil cannot be tolerated! You are an enemy of progress.",
      "Your moral bankruptcy is evident. Prepare for righteous judgment!"
    ]
  },
  BALANCED: {
    name: 'Diplomat',
    type: 'BALANCED',
    description: 'Seeks balanced and reasonable solutions',
    treatyBreakChance: 0.01,
    warlikeness: 0.4,
    trustDecayRate: 1.0,
    coalitionTrigger: 0.45,
    cooperativeness: 0.6,
    friendlyResponses: [
      "Your diplomatic approach is commendable. Let us work together.",
      "Cooperation benefits all. I welcome your constructive dialogue.",
      "Wise words. Balance and mutual respect should guide us."
    ],
    neutralResponses: [
      "I acknowledge your message. Our relationship requires careful consideration.",
      "Your words are noted. I prefer measured responses to hasty actions.",
      "Interesting. I believe in finding reasonable solutions to disputes."
    ],
    hostileResponses: [
      "Such hostility is regrettable but I will defend my interests.",
      "I had hoped for better relations, but will respond appropriately.",
      "Your aggression forces my hand. I prefer diplomacy to conflict."
    ]
  }
};

// Treaty types with their properties
const TREATY_TYPES = {
  NON_AGGRESSION: {
    name: 'Non-Aggression Pact',
    duration: 10, // turns
    breakPenalty: -30,
    trustRequirement: -20
  },
  DEFENSIVE_PACT: {
    name: 'Defensive Pact',
    duration: 15,
    breakPenalty: -40,
    trustRequirement: 20
  },
  TRADE_AGREEMENT: {
    name: 'Trade Agreement',
    duration: 8,
    breakPenalty: -20,
    trustRequirement: 0
  },
  RESEARCH_SHARING: {
    name: 'Research Sharing',
    duration: 12,
    breakPenalty: -25,
    trustRequirement: 10
  }
};

// Trade proposal system
const TRADE_PROPOSAL_TYPES = {
  RESOURCE_EXCHANGE: {
    name: 'Resource Exchange',
    description: 'Trade resources (Gold, Materials) with another faction'
  },
  UNIT_TRADE: {
    name: 'Unit Trade',
    description: 'Exchange military units with another faction'
  },
  TRIBUTE: {
    name: 'Tribute Payment',
    description: 'One-time resource payment for diplomatic favor'
  }
};

// Active trade proposals (pending acceptance/rejection)
let tradeProposals = [];

// When a menu is opened from a mouse press, the subsequent click event can fire and
// immediately close it. Use this flag to ignore the next click after opening the menu.
const SPAWN_OVERLAY_ID = 'spawnOverlay';
let isEditorMode=false;
let placingUnitType=null, placingUnitTeam=null;
let placingTerrain=null;
let mapSize={cols:16, rows:16}; // Good size for 12x12 viewport with some scrollable area
let inspectedTerrain = null; // Stores {col, row} of inspected terrain
let selectedTeam = 'PLAYER'; // Selected team in editor placement
let skipNextClick = false; // Flag to prevent menu-opening clicks from immediately closing the menu

// Starting resources for each team in editor mode - will be dynamically expanded for multi-AI
let startingResources = { 
  PLAYER: { gold: 10, materials: 0 },
  AI: { gold: 10, materials: 0 },
  PLAYER2: { gold: 10, materials: 0 }
};

// Event deduplication system to prevent multiple input methods from triggering the same action
let lastEventTime = 0;
let lastEventCoords = { x: -1, y: -1 };
const EVENT_DEDUP_MS = 50; // Events within 50ms at same coordinates are considered duplicates

// Editor action deduplication - prevent double unit creation/deletion
let lastEditorAction = { time: 0, col: -1, row: -1, action: '' };
const EDITOR_DEDUP_MS = 200; // Longer delay for editor actions

function isEventDuplicate(clientX, clientY) {
  const now = Date.now();
  const timeSinceLastEvent = now - lastEventTime;
  const sameCoords = Math.abs(clientX - lastEventCoords.x) < 5 && Math.abs(clientY - lastEventCoords.y) < 5;
  
  if (sameCoords && timeSinceLastEvent < EVENT_DEDUP_MS) {
    return true; // This is likely a duplicate event
  }
  
  lastEventTime = now;
  lastEventCoords = { x: clientX, y: clientY };
  return false;
}
// Determine opponent type and game mode from query params when embedded
let opponentType = 'AI'; // default
let gameMode = 'vs-ai'; // default: vs-ai, local-2p, online-2p
try{
  const params = new URLSearchParams(window.location.search);
  const opp = params.get('opponent');
  if(opp) opponentType = opp.toUpperCase() === 'HUMAN' ? 'HUMAN' : 'AI';
  
  const mode = params.get('mode');
  if(mode) {
    gameMode = mode.toLowerCase();
    // Sync opponentType with gameMode for backwards compatibility
    if(gameMode === 'local-2p') {
      opponentType = 'LOCAL_2P';
      console.log('DEBUG: URL parameter set mode to local-2p, opponentType:', opponentType);
    }
    else if(gameMode === 'online-2p') opponentType = 'HUMAN';
    else if(gameMode === 'vs-ai') opponentType = 'AI';
  }
  console.log('DEBUG: Initial game setup - gameMode:', gameMode, 'opponentType:', opponentType);
}catch(e){ /* ignore when file:// or other issues */ }

// This static distribution supports local play; a relay requires its own server.
if (gameMode !== 'vs-ai' || opponentType !== 'AI') {
  gameMode = 'vs-ai';
  opponentType = 'AI';
}

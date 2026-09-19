// Warborn source split from the original game.js.
// Section: js/core/state-and-grid.js

/**
 * ========================================
 * WARBORN - Turn-Based Strategy Game
 * ========================================
 * 
 * A comprehensive turn-based strategy game with AI opponents, multiplayer support,
 * and complex combat mechanics. Built with p5.js for rendering and vanilla JS for game logic.
 * 
 * CODE ORGANIZATION:
 * ==================
 * 
 * 1. CONSTANTS & CONFIGURATION
 *    - Game dimensions, rendering settings
 *    - Unit templates and settlement definitions
 *    - Combat and economic balance parameters
 * 
 * 2. GAME STATE MANAGEMENT  
 *    - Core game variables (units, settlements, resources)
 *    - Turn management and team switching
 *    - Save/load and state persistence
 * 
 * 3. MULTIPLAYER & NETWORKING
 *    - Connection handling and heartbeat system
 *    - Optimistic updates and rollback for smooth multiplayer
 *    - Message validation and synchronization
 * 
 * 4. CORE GAME MECHANICS
 *    - Unit creation and stat management
 *    - Movement system with pathfinding (prevents moving through enemies)
 *    - Combat system with damage modifiers and special abilities
 *    - Settlement claiming and resource generation
 * 
 * 5. ARTIFICIAL INTELLIGENCE
 *    - Strategic analysis and decision making
 *    - Unit building prioritization 
 *    - Movement tactics (retreat, formation, terrain usage)
 *    - Combat target selection and threat assessment
 *    - Cleric healing logic for support gameplay
 * 
 * 6. USER INTERFACE
 *    - Canvas rendering with p5.js
 *    - Interactive unit selection and highlighting
 *    - Spawn menus and build systems
 *    - Resource and turn indicators
 * 
 * 7. INPUT HANDLING
 *    - Mouse, touch, and pointer event support
 *    - Cross-platform compatibility (desktop, mobile, tablet)
 *    - Keyboard shortcuts and menu controls
 * 
 * KEY FEATURES:
 * =============
 * - 9 unique unit types with distinct roles and abilities
 * - Complex combat with health scaling, morale, and unit matchups
 * - Fortress building system for defensive gameplay  
 * - Cleric healing mechanics for tactical depth
 * - Smart AI that adapts strategy based on board state
 * - Movement pathfinding prevents exploitative unit stacking
 * - Settlement system provides economic and healing benefits
 * - Multiplayer with optimistic updates for responsive gameplay
 */

// ========================================
// GAME CONSTANTS & CONFIGURATION
// ========================================

/** @const {number} Canvas rendering offset for border aesthetics */
const OFFSET = 0;

/** @const {number} Total canvas size - balanced for visibility and performance */
const BOARD_SIZE = 900; // Large map surface; zoom/pan controls visibility.

// ========================================
// CORE GAME STATE VARIABLES  
// ========================================

/** @type {number} Grid dimensions - now supports large scrollable maps */
let COLS = 16, ROWS = 16;

/** @type {number} Dynamic tile size - scales with grid dimensions */
let TILE = BOARD_SIZE / COLS;

// ========================================
// CAMERA/VIEWPORT SYSTEM FOR SCROLLABLE MAPS
// ========================================

/** @type {number} Camera position in world coordinates (tiles) */
let cameraX = 0, cameraY = 0;

/** @type {number} Base viewport size - scaled by zoom level */
let BASE_VIEWPORT_COLS = 20, BASE_VIEWPORT_ROWS = 20;

/** @type {function} Calculate dynamic viewport size based on zoom level */
function getViewportSize() {
  return {
    cols: COLS,
    rows: ROWS
  };
}

function getGameCanvasSize() {
  return {
    w: Math.max(640, Math.floor(window.innerWidth || document.documentElement.clientWidth || BOARD_SIZE)),
    h: Math.max(480, Math.floor(window.innerHeight || document.documentElement.clientHeight || BOARD_SIZE))
  };
}

function getMapOrigin() {
  return {
    x: (width - BOARD_SIZE) / 2,
    y: (height - BOARD_SIZE) / 2
  };
}

function resizeGameCanvas() {
  if (typeof resizeCanvas !== 'function') return;
  const size = getGameCanvasSize();
  resizeCanvas(size.w, size.h);
  clampPanToMap();
}

/** @type {number} Scroll speed for arrow key navigation */
const SCROLL_SPEED = 1;

/** @type {Array} Key states for smooth scrolling */
let keysPressed = {};

/** @type {Array} All active game units - central game state */
let units = [];

// ========================================
// HEXAGON GRID UTILITIES
// ========================================

/** @type {boolean} The map now uses flat-top hex tiles throughout rendering and gameplay */
let useHexGrid = true;

/** @type {number} Hexagon size - radius from center to vertex */
let HEX_SIZE = TILE * 0.55; // Initial value, will be updated by updateHexSize()

/**
 * Convert hex grid coordinates (col, row) to pixel coordinates (x, y)
 * Uses "flat-top" hexagon orientation
 */
function hexToPixel(col, row) {
  const x = HEX_SIZE * (3/2) * col;
  const y = HEX_SIZE * Math.sqrt(3) * (row + 0.5 * (col & 1));
  return {x, y};
}

/**
 * Convert pixel coordinates to hex grid coordinates
 * Returns the hex containing the given pixel
 * This is the inverse of hexToPixel() which uses odd-column offset coordinates
 * Uses a more robust algorithm to minimize floating-point precision issues
 */
function pixelToHex(x, y) {
  // Use a more direct approach that matches the hexToPixel function exactly
  // This eliminates the precision issues from multiple coordinate system conversions
  
  // First, try a direct approach by testing nearby hex candidates
  // Calculate an approximate hex position
  const approxCol = Math.round(x / (HEX_SIZE * 1.5));
  const approxRow = Math.round((y - HEX_SIZE * Math.sqrt(3) * 0.5 * (approxCol & 1)) / (HEX_SIZE * Math.sqrt(3)));
  
  // Test the candidate hex and its immediate neighbors to find the closest one
  let bestCol = approxCol;
  let bestRow = approxRow;
  let bestDistance = Number.MAX_VALUE;
  
  // Check a 3x3 grid of hexes around the approximate position
  for (let testCol = approxCol - 1; testCol <= approxCol + 1; testCol++) {
    for (let testRow = approxRow - 1; testRow <= approxRow + 1; testRow++) {
      // Convert this hex back to pixel coordinates
      const hexPixel = hexToPixel(testCol, testRow);
      
      // Calculate distance from click point to hex center
      const dx = x - hexPixel.x;
      const dy = y - hexPixel.y;
      const distance = dx * dx + dy * dy;
      
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCol = testCol;
        bestRow = testRow;
      }
    }
  }
  
  return { col: bestCol, row: bestRow };
}

/**
 * Convert mouse screen coordinates to world hex/grid coordinates
 * Handles both hex and square grid modes consistently
 */
function mouseToWorldCoords(mouseX, mouseY) {
  // First convert screen coordinates to world coordinates accounting for zoom and pan
  const worldPos = screenToWorld(mouseX, mouseY);
  
  if (useHexGrid) {
    // Convert mouse position to hex coordinates, accounting for hex grid offset
    const offset = getHexGridOffset();
    const adjustedMouseX = worldPos.x - OFFSET - offset.x;
    const adjustedMouseY = worldPos.y - OFFSET - offset.y;
    const mouseHex = pixelToHex(adjustedMouseX, adjustedMouseY);
    
    // Calculate world coordinates
    const worldCol = mouseHex.col + cameraX;
    const worldRow = mouseHex.row + cameraY;

    return {
      col: worldCol,
      row: worldRow
    };
  } else {
    // Square grid logic with zoom and pan support
    const screenCol = Math.floor((worldPos.x - OFFSET) / TILE);
    const screenRow = Math.floor((worldPos.y - OFFSET) / TILE);
    return {
      col: screenCol + cameraX,
      row: screenRow + cameraY
    };
  }
}

/**
 * Calculate hex distance between two hex coordinates
 * Converts from offset coordinates to axial coordinates for proper distance calculation
 */
function hexDistance(col1, row1, col2, row2) {
  // Convert odd-column offset coordinates to axial coordinates
  const q1 = col1;
  const r1 = row1 - (col1 - (col1 & 1)) / 2;
  const q2 = col2;
  const r2 = row2 - (col2 - (col2 & 1)) / 2;
  
  // Calculate distance in axial coordinates
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

/**
 * Draw a hexagon at the given pixel coordinates
 */
function drawHexagon(centerX, centerY, size) {
  beginShape();
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const x = centerX + size * Math.cos(angle);
    const y = centerY + size * Math.sin(angle);
    vertex(x, y);
  }
  endShape(CLOSE);
}

/**
 * Get hexagonal neighbor directions (6 neighbors instead of 4)
 * Returns array of [dx, dy] offsets for hex grid neighbors
 */
function getHexNeighbors(col, row) {
  // Odd-column offset coordinates matching hexToPixel().
  const isEvenCol = (col % 2) === 0;
  
  if (isEvenCol) {
    return [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, -1],
      [-1, 0],
      [0, 1]
    ];
  }
  return [
    [1, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1]
  ];
}

/**
 * Update hex size when tile size changes
 * Calculates hex size based on available space to prevent overflow
 */
function updateHexSize() {
  const cols = Math.max(1, COLS || 1);
  const rows = Math.max(1, ROWS || 1);
  const availableWidth = BOARD_SIZE * 0.96;
  const availableHeight = BOARD_SIZE * 0.96;
  const widthFactor = (cols - 1) * 1.5 + 2;
  const hasOddColumn = cols > 1;
  const heightFactor = Math.sqrt(3) * (rows + (hasOddColumn ? 0.5 : 0));
  const calculatedHexSize = Math.min(availableWidth / widthFactor, availableHeight / heightFactor);
  HEX_SIZE = Math.max(7, Math.min(TILE * 0.72, calculatedHexSize));
}

function getHexApothem(size = HEX_SIZE) {
  return Math.sqrt(3) * size / 2;
}

function getHexGridMetrics(size = HEX_SIZE, cols = COLS, rows = ROWS) {
  const safeCols = Math.max(0, cols || 0);
  const safeRows = Math.max(0, rows || 0);
  const apothem = getHexApothem(size);
  if (safeCols === 0 || safeRows === 0) {
    return { width: 0, height: 0, apothem };
  }
  const width = (safeCols - 1) * 1.5 * size + 2 * size;
  const hasOddColumn = safeCols > 1;
  const height = (safeRows - 1) * Math.sqrt(3) * size +
    (hasOddColumn ? apothem : 0) + 2 * apothem;
  return { width, height, apothem };
}

/**
 * Calculate hex grid translation offset to center the grid better
 * Returns {x, y} offset values based on actual hex grid dimensions
 */
function getHexGridOffset() {
  const metrics = getHexGridMetrics();
  return {
    x: Math.max(HEX_SIZE, (BOARD_SIZE - metrics.width) / 2 + HEX_SIZE),
    y: Math.max(metrics.apothem, (BOARD_SIZE - metrics.height) / 2 + metrics.apothem)
  };
}

function getMapWorldBounds() {
  if (!useHexGrid) {
    return { x: OFFSET, y: OFFSET, width: BOARD_SIZE, height: BOARD_SIZE };
  }
  const offset = getHexGridOffset();
  const metrics = getHexGridMetrics();
  return {
    x: OFFSET + offset.x - HEX_SIZE,
    y: OFFSET + offset.y - metrics.apothem,
    width: metrics.width,
    height: metrics.height
  };
}

function getTileCenterLocal(col, row) {
  if (useHexGrid) {
    const offset = getHexGridOffset();
    const p = hexToPixel(col, row);
    return { x: offset.x + p.x, y: offset.y + p.y };
  }
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function isAdjacentTile(col1, row1, col2, row2) {
  return useHexGrid
    ? hexDistance(col1, row1, col2, row2) === 1
    : Math.max(Math.abs(col1 - col2), Math.abs(row1 - row2)) === 1;
}

function getAdjacentCoords(col, row, includeDiagonalsForSquare = true) {
  const dirs = useHexGrid
    ? getHexNeighbors(col, row)
    : (includeDiagonalsForSquare
      ? [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]]
      : [[1,0], [-1,0], [0,1], [0,-1]]);
  return dirs
    .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
    .filter(p => p.col >= 0 && p.col < COLS && p.row >= 0 && p.row < ROWS);
}

/**
 * Keep legacy callers from turning the hex map back into square mode.
 */
function toggleGridType() {
  useHexGrid = true;
  updateHexSize();
}

/** @type {Object|null} Currently selected unit for player actions */
let selectedUnit = null;

/** @type {string} Current active team ('PLAYER', 'AI', 'PLAYER2') */
let currentTeam = 'PLAYER';

/** @type {number} Global turn counter for diplomacy and game state tracking */
let turnNumber = 1;

/** @type {Array<string>} Array of active team names in turn order */
let turnOrder = [];

/** @type {number} Index of current team in turnOrder array */
let currentTurnIndex = 0;

/** @type {boolean} Game over state - prevents further actions */
let gameOver = false;
let endScreenShown = false;
let gameEndResult = null;
let activeScenarioSnapshot = null;
let lastPlayedSavedLevelIndex = null;

const DEFAULT_VICTORY_CONDITION = {
  type: 'ANNIHILATE_ALL',
  targetTeam: 'AI',
  holdCol: 0,
  holdRow: 0,
  holdTurns: 3,
  surviveTurns: 10,
  targetUnitId: null,
  killTurnLimit: 10,
  holdProgress: 0,
  lastHoldTurn: 0
};
let currentVictoryCondition = JSON.parse(JSON.stringify(DEFAULT_VICTORY_CONDITION));

// Build mode state: when true, clicking eligible adjacent tiles will open build menu
let buildMode = false;
let buildModeUnitId = null;
// Read gameId from query string so we can display/join via the hub
let gameId = (new URLSearchParams(window.location.search)).get('gameId') || null;

// AI Turn timeout mechanism - automatically end AI turn if no action for 1 second
let aiTurnTimeoutId = null;
let aiLastActionTime = 0;
const AI_TURN_TIMEOUT_MS = 1000; // 1 second

// Learning AI System - Observes and learns from human gameplay
const LEARNING_AI = {
  enabled: false,
  gameplayData: [],
  patterns: {
    openings: new Map(), // Opening moves by game state
    tactics: new Map(),  // Successful tactical patterns
    strategies: new Map(), // Long-term strategic patterns
    responses: new Map() // Response patterns to opponent moves
  },
  currentGameRecord: {
    moves: [],
    startState: null,
    winner: null,
    gameLength: 0
  }
};
// Role assigned by parent hub (P1 or P2). Default to P1 until parent says otherwise.
let myRole = 'P1';
// Modal overlay element used to show a prominent join code until a human opponent connects
let gameIdModalOverlay = null;
let modalManuallyClosed = false;
// Connection state tracking
let isConnectedToHub = false;
let lastHeartbeat = Date.now();
let heartbeatInterval = null;
let connectionRetryCount = 0;
let maxRetries = 3;
let isReconnecting = false;

// Zoom and pan variables for smooth map interaction
let zoomLevel = 1.0;
let targetZoom = 1.0;
let minZoom = 0.3;
let maxZoom = 8.0;
let zoomSpeed = 0.15;
let panX = 0;
let panY = 0;
let targetPanX = 0;
let targetPanY = 0;
let panSpeed = 0.12;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let mapCanvasFocused = false;
let suppressClickAfterDrag = false;
let editorDrawerTab = null;

// Optimistic updates and rollback system
let pendingUpdates = new Map(); // actionId -> { action, originalState, timestamp }
let actionIdCounter = 0;
let gameStateHistory = []; // Keep last 10 states for rollback
const maxHistorySize = 10;

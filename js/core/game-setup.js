// Warborn source split from the original game.js.
// Section: js/core/game-setup.js

function setupGame(){
  activeAITurn=null;
  resetStartingEconomy();
  ActionEffects.reset();
  units=[];
  
  // Initialize turn tracking
  turnNumber = 1;
  currentTurnIndex = 0;
  gameOver = false;
  endScreenShown = false;
  gameEndResult = null;
  hideEndScreen();
  currentVictoryCondition = normalizeVictoryCondition(currentVictoryCondition);
  currentVictoryCondition.holdProgress = 0;
  currentVictoryCondition.lastHoldTurn = 0;
  
  // Skip default unit setup if in campaign mode (units are placed by loadCurrentScenario)
  if (campaignMode.active) {
    // Initialize multi-AI system for campaign
    initializeResourcesForActiveTeams();
    calculateTurnOrder();
    
    // Initialize diplomacy system whenever AI factions are present
    if (hasAIDiplomacy()) {
      initializeDiplomacy();
    }
    
    selectedUnit=null; 
    currentTeam='PLAYER'; 
    gameOver=false;
    
    // Reset settlements for new game (neutral by default)
    settlements = Array(COLS * ROWS).fill(null);
    
    updateUI();
    captureScenarioSnapshot();
    return; // Campaign scenario will handle unit placement
  }
  
  // Initialize multi-AI system
  initializeResourcesForActiveTeams();
  calculateTurnOrder();
  
  // Initialize diplomacy system whenever AI factions are present
  if (hasAIDiplomacy()) {
    initializeDiplomacy();
  }
  
  // Player units - initial setup
  units.push(makeUnit('Knight','PLAYER',1,2));

  // Opponent units - initial setup
  if (opponentType === 'HUMAN' || opponentType === 'LOCAL_2P') {
    // Human opponent
    units.push(makeUnit('Knight','PLAYER2',6,5));
  } else {
    // AI opponents - create initial units for each AI team
    const activeAITeams = getActiveTeams().filter(team => isAITeam(team));
    console.log('DEBUG: Setting up AI teams:', activeAITeams);
    
    // Place AI units in different starting positions
    const startingPositions = [
      {col: 6, row: 5},   // AI
      {col: 5, row: 7},   // AI2  
      {col: 7, row: 3},   // AI3
      {col: 3, row: 6}    // AI4
    ];
    
    activeAITeams.forEach((team, index) => {
      const pos = startingPositions[index] || {col: 6, row: 5}; // fallback position
      units.push(makeUnit('Knight', team, pos.col, pos.row));
      console.log(`Created initial Knight for ${team} at (${pos.col}, ${pos.row})`);
    });
  }
  
  selectedUnit=null; currentTeam='PLAYER'; gameOver=false;
  
  // Reset settlements for new game (neutral by default)
  settlements = Array(COLS * ROWS).fill(null);
  // Income is earned during play, never awarded by setup or restart.
  
  // Initialize Learning AI for new game if human players are present
  if (hasHumanPlayers() && !LEARNING_AI.enabled) {
    LEARNING_AI.enabled = true;
    console.log('Auto-enabled Learning AI for new game with human players');
  }
  
  // Start new learning session
  if (LEARNING_AI.enabled && shouldLearnFromCurrentGame()) {
    LEARNING_AI.currentGameRecord = {
      gameId: Date.now(),
      startTime: Date.now(),
      moves: [],
      winner: null,
      gameLength: 0
    };
    console.log('Learning AI: Started new game record');
  }
  
  updateUI();
  captureScenarioSnapshot();
}

// ========================================

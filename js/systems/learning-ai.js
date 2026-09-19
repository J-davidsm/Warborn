// Warborn source split from the original game.js.
// Section: js/systems/learning-ai.js

// Learning AI Data Collection Functions
function recordHumanAction(actionType, actionData) {
  // Only record if the current team is a human player (not AI)
  if (!isHumanTeam(currentTeam)) return;
  
  // Auto-enable learning when human players are involved
  if (!LEARNING_AI.enabled && hasHumanPlayers()) {
    LEARNING_AI.enabled = true;
  }
  
  // Don't record if no learning should happen (pure AI vs AI games)
  if (!shouldLearnFromCurrentGame()) return;
  
  const gameState = {
    turnNumber: turnNumber,
    currentTeam: currentTeam,
    boardState: captureBoardState(),
    resources: JSON.parse(JSON.stringify(teamResources)),
    unitCount: getTeamUnitCounts(),
    territoryControl: calculateTerritoryControl()
  };
  
  const actionRecord = {
    timestamp: Date.now(),
    turn: turnNumber,
    team: currentTeam,
    actionType: actionType,
    actionData: actionData,
    gameState: gameState,
    outcome: null // Will be filled later when we know the result
  };
  
  LEARNING_AI.currentGameRecord.moves.push(actionRecord);
  console.log(`Learning AI recorded ${actionType} action for ${currentTeam}`);
  
  // Auto-save every 10 actions to prevent data loss
  if (LEARNING_AI.currentGameRecord.moves.length % 10 === 0) {
    console.log('Auto-saving Learning AI data...');
    saveLearningAIData();
  }
}

// Helper functions for Learning AI
function isHumanTeam(team) {
  return team === 'PLAYER' || team === 'PLAYER2';
}

function hasHumanPlayers() {
  const activeTeams = getActiveTeams();
  return activeTeams.some(team => isHumanTeam(team));
}

function shouldLearnFromCurrentGame() {
  // Only learn if there's at least one human player in the game
  return hasHumanPlayers();
}

function captureBoardState() {
  return {
    units: units.map(u => ({
      name: u.name,
      team: u.team,
      col: u.col,
      row: u.row,
      hp: u.hp,
      morale: u.morale,
      experience: u.experience
    })),
    settlements: Object.keys(settlements).map(key => {
      const idx = parseInt(key);
      const settlement = settlements[idx];
      if (settlement) {
        return {
          col: idx % COLS,
          row: Math.floor(idx / COLS),
          type: settlement.type,
          team: settlement.team,
          level: settlement.level
        };
      }
      return null;
    }).filter(s => s !== null),
    terrain: Object.keys(terrain).map(key => {
      const idx = parseInt(key);
      if (terrain[idx]) {
        return {
          col: idx % COLS,
          row: Math.floor(idx / COLS),
          type: terrain[idx]
        };
      }
      return null;
    }).filter(t => t !== null)
  };
}

function getTeamUnitCounts() {
  const counts = {};
  units.forEach(u => {
    if (u.hp > 0) {
      counts[u.team] = (counts[u.team] || 0) + 1;
    }
  });
  return counts;
}

function calculateTerritoryControl() {
  const control = {};
  Object.keys(settlements).forEach(key => {
    const settlement = settlements[key];
    if (settlement && settlement.team) {
      control[settlement.team] = (control[settlement.team] || 0) + 1;
    }
  });
  return control;
}

function isTeamDead(team) {
  // Check if team has any living units
  const hasUnits = units.some(u => u.team === team && u.hp > 0);
  
  // Check if team has any settlements
  const hasSettlements = settlements.some(s => s && s.owner === team);
  
  // Team is dead if it has neither units nor settlements
  return !hasUnits && !hasSettlements;
}

function getTeamColor(team) {
  const teamColors = {
    'PLAYER': { fill: [40, 180, 230], stroke: [8, 84, 98] },     // Blue
    'AI': { fill: [235, 85, 85], stroke: [120, 20, 20] },        // Red
    'AI2': { fill: [85, 235, 85], stroke: [20, 120, 20] },       // Green
    'AI3': { fill: [235, 235, 85], stroke: [120, 120, 20] },     // Yellow
    'AI4': { fill: [235, 85, 235], stroke: [120, 20, 120] },     // Magenta
    'PLAYER2': { fill: [255, 165, 0], stroke: [128, 82, 0] }     // Orange
  };
  
  return teamColors[team] || { fill: [128, 128, 128], stroke: [64, 64, 64] }; // Default gray
}

function getTeamColorHex(team) {
  const color = getTeamColor(team);
  const toHex = (rgb) => '#' + rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
  return toHex(color.fill);
}

function generateAITeamDisplay(count) {
  const aiTeams = [];
  for (let i = 1; i <= count; i++) {
    const teamName = i === 1 ? 'AI' : `AI${i + 1}`;
    const color = getTeamColorHex(teamName);
    aiTeams.push(`<span style="color: ${color}; font-weight: bold;">●</span>`);
  }
  return `${count} ${aiTeams.join('')}`;
}

// ========== LEARNING AI SYSTEM ==========

// Learning AI Pattern Recognition and Analysis
function analyzeGameplayPatterns() {
  if (LEARNING_AI.gameplayData.length < 3) return; // Need at least 3 games to analyze
  
  console.log(`Analyzing patterns from ${LEARNING_AI.gameplayData.length} recorded games...`);
  
  // Analyze opening strategies
  analyzeOpeningPatterns();
  
  // Analyze successful tactical combinations
  analyzeTacticalPatterns();
  
  // Analyze winning strategies
  analyzeStrategicPatterns();
  
  // Analyze response patterns
  analyzeResponsePatterns();
}

function analyzeOpeningPatterns() {
  LEARNING_AI.gameplayData.forEach(game => {
    if (game.moves.length < 5) return;
    
    const openingMoves = game.moves.slice(0, 5);
    const openingKey = generateOpeningSignature(openingMoves);
    
    if (!LEARNING_AI.patterns.openings.has(openingKey)) {
      LEARNING_AI.patterns.openings.set(openingKey, {
        moves: openingMoves,
        winRate: 0,
        gamesPlayed: 0,
        successfulOutcomes: 0
      });
    }
    
    const pattern = LEARNING_AI.patterns.openings.get(openingKey);
    pattern.gamesPlayed++;
    
    // Check if this opening led to victory
    if (game.winner && openingMoves.some(move => move.team === game.winner)) {
      pattern.successfulOutcomes++;
    }
    
    pattern.winRate = pattern.successfulOutcomes / pattern.gamesPlayed;
  });
}

function analyzeTacticalPatterns() {
  LEARNING_AI.gameplayData.forEach(game => {
    // Look for sequences of 2-4 moves that led to significant advantage
    for (let i = 0; i < game.moves.length - 3; i++) {
      const sequence = game.moves.slice(i, i + 3);
      const tacticalKey = generateTacticalSignature(sequence);
      
      if (!LEARNING_AI.patterns.tactics.has(tacticalKey)) {
        LEARNING_AI.patterns.tactics.set(tacticalKey, {
          sequence: sequence,
          effectiveness: 0,
          usageCount: 0,
          avgResourceGain: 0
        });
      }
      
      const pattern = LEARNING_AI.patterns.tactics.get(tacticalKey);
      pattern.usageCount++;
      
      // Evaluate effectiveness by looking at resource/territory changes
      const effectiveness = evaluateSequenceEffectiveness(sequence);
      pattern.effectiveness = (pattern.effectiveness + effectiveness) / 2;
    }
  });
}

function analyzeStrategicPatterns() {
  LEARNING_AI.gameplayData.forEach(game => {
    if (!game.winner || game.moves.length < 10) return;
    
    const winnerMoves = game.moves.filter(move => move.team === game.winner);
    const strategicKey = generateStrategicSignature(winnerMoves, game);
    
    if (!LEARNING_AI.patterns.strategies.has(strategicKey)) {
      LEARNING_AI.patterns.strategies.set(strategicKey, {
        approach: categorizeStrategy(winnerMoves),
        winRate: 0,
        avgGameLength: 0,
        gamesUsed: 0
      });
    }
    
    const pattern = LEARNING_AI.patterns.strategies.get(strategicKey);
    pattern.gamesUsed++;
    pattern.avgGameLength = (pattern.avgGameLength + game.gameLength) / 2;
    pattern.winRate = 1.0; // This is a winning strategy by definition
  });
}

function analyzeResponsePatterns() {
  LEARNING_AI.gameplayData.forEach(game => {
    for (let i = 1; i < game.moves.length; i++) {
      const previousMove = game.moves[i - 1];
      const responseMove = game.moves[i];
      
      if (previousMove.team !== responseMove.team) {
        const responseKey = generateResponseSignature(previousMove, responseMove);
        
        if (!LEARNING_AI.patterns.responses.has(responseKey)) {
          LEARNING_AI.patterns.responses.set(responseKey, {
            trigger: previousMove,
            response: responseMove,
            successRate: 0,
            timesUsed: 0
          });
        }
        
        const pattern = LEARNING_AI.patterns.responses.get(responseKey);
        pattern.timesUsed++;
        
        // Evaluate if this response was successful
        const wasSuccessful = evaluateResponseSuccess(previousMove, responseMove, game, i);
        if (wasSuccessful) {
          pattern.successRate = (pattern.successRate * (pattern.timesUsed - 1) + 1) / pattern.timesUsed;
        } else {
          pattern.successRate = (pattern.successRate * (pattern.timesUsed - 1)) / pattern.timesUsed;
        }
      }
    }
  });
}

// Pattern Analysis Helper Functions
function generateOpeningSignature(moves) {
  return moves.map(move => `${move.actionType}:${JSON.stringify(move.actionData)}`).join('|');
}

function generateTacticalSignature(sequence) {
  return sequence.map(move => `${move.actionType}:${move.team}`).join('->');
}

function generateStrategicSignature(moves, game) {
  const unitTypes = {};
  const settlements = {};
  
  moves.forEach(move => {
    if (move.actionType === 'unitSpawn') {
      unitTypes[move.actionData.unitType] = (unitTypes[move.actionData.unitType] || 0) + 1;
    } else if (move.actionType === 'settlementCapture') {
      settlements[move.actionData.settlementType] = (settlements[move.actionData.settlementType] || 0) + 1;
    }
  });
  
  return `strategy:${JSON.stringify({unitTypes, settlements, gameLength: game.gameLength})}`;
}

function generateResponseSignature(trigger, response) {
  return `${trigger.actionType}->${response.actionType}`;
}

function evaluateSequenceEffectiveness(sequence) {
  if (sequence.length < 2) return 0;
  
  const startState = sequence[0].gameState;
  const endState = sequence[sequence.length - 1].gameState;
  
  // Calculate resource gain
  const team = sequence[0].team;
  const startResources = startState.resources[team] || {food: 0, gold: 0, materials: 0};
  const endResources = endState.resources[team] || {food: 0, gold: 0, materials: 0};
  
  const resourceGain = (endResources.food + endResources.gold + endResources.materials) - 
                      (startResources.food + startResources.gold + startResources.materials);
  
  // Calculate territory gain
  const startTerritory = startState.territoryControl[team] || 0;
  const endTerritory = endState.territoryControl[team] || 0;
  const territoryGain = endTerritory - startTerritory;
  
  // Calculate unit advantage
  const startUnits = startState.unitCount[team] || 0;
  const endUnits = endState.unitCount[team] || 0;
  const unitAdvantage = endUnits - startUnits;
  
  return (resourceGain * 0.3) + (territoryGain * 5) + (unitAdvantage * 2);
}

function categorizeStrategy(moves) {
  const actionCounts = {};
  moves.forEach(move => {
    actionCounts[move.actionType] = (actionCounts[move.actionType] || 0) + 1;
  });
  
  if ((actionCounts.attack || 0) > (actionCounts.unitSpawn || 0)) {
    return 'aggressive';
  } else if ((actionCounts.settlementCapture || 0) > (actionCounts.attack || 0)) {
    return 'expansionist';
  } else if ((actionCounts.unitSpawn || 0) > (actionCounts.move || 0)) {
    return 'defensive';
  } else {
    return 'balanced';
  }
}

function evaluateResponseSuccess(trigger, response, game, moveIndex) {
  // Look at the next few moves to see if this response was effective
  const futureMovesCount = Math.min(3, game.moves.length - moveIndex - 1);
  if (futureMovesCount === 0) return false;
  
  const futureMoves = game.moves.slice(moveIndex + 1, moveIndex + 1 + futureMovesCount);
  const responseTeam = response.team;
  
  // Check if the responding team gained advantage in subsequent moves
  let advantageGained = 0;
  futureMoves.forEach(move => {
    if (move.team === responseTeam) {
      if (move.actionType === 'attack' && move.actionData.success) advantageGained += 2;
      if (move.actionType === 'settlementCapture') advantageGained += 3;
      if (move.actionType === 'unitSpawn') advantageGained += 1;
    }
  });
  
  return advantageGained > 2;
}

// Adaptive AI Decision Making
function applyLearnedStrategy(aiTeam, strategicAnalysis) {
  console.log(`Applying learned strategies for ${aiTeam}...`);
  
  // Find the most successful strategy pattern that matches current situation
  let bestStrategy = null;
  let highestWinRate = 0;
  
  LEARNING_AI.patterns.strategies.forEach((pattern, key) => {
    if (pattern.winRate > highestWinRate && pattern.gamesUsed >= 2) {
      const situationMatch = evaluateStrategicMatch(pattern, strategicAnalysis);
      if (situationMatch > 0.7) {
        bestStrategy = pattern;
        highestWinRate = pattern.winRate;
      }
    }
  });
  
  if (bestStrategy) {
    console.log(`Found matching strategy: ${bestStrategy.approach} (win rate: ${bestStrategy.winRate})`);
    
    // Modify AI behavior based on learned strategy
    if (bestStrategy.approach === 'aggressive') {
      aiStrategicAnalysis.aggressiveness = Math.max(aiStrategicAnalysis.aggressiveness, 0.8);
      aiStrategicAnalysis.preferredTargets = 'units';
    } else if (bestStrategy.approach === 'expansionist') {
      aiStrategicAnalysis.aggressiveness = Math.min(aiStrategicAnalysis.aggressiveness, 0.4);
      aiStrategicAnalysis.preferredTargets = 'settlements';
    } else if (bestStrategy.approach === 'defensive') {
      aiStrategicAnalysis.aggressiveness = Math.min(aiStrategicAnalysis.aggressiveness, 0.3);
      aiStrategicAnalysis.preferredTargets = 'defensive';
    }
    
    // Apply learned opening patterns if it's early game
    if (turnNumber <= 5) {
      applyLearnedOpening(aiTeam);
    }
    
    // Apply learned tactical responses
    applyLearnedTactics(aiTeam, strategicAnalysis);
  }
}

function evaluateStrategicMatch(pattern, currentSituation) {
  // Compare current game state with the pattern's context
  let matchScore = 0.5; // Base match
  
  // Check game length similarity
  const lengthDiff = Math.abs(turnNumber - (pattern.avgGameLength / 4));
  matchScore += (1 - Math.min(lengthDiff / 10, 1)) * 0.2;
  
  // Check resource situation similarity
  if (currentSituation.resourceAdvantage && pattern.approach === 'aggressive') {
    matchScore += 0.3;
  } else if (!currentSituation.resourceAdvantage && pattern.approach === 'defensive') {
    matchScore += 0.3;
  }
  
  return Math.min(matchScore, 1.0);
}

function applyLearnedOpening(aiTeam) {
  if (LEARNING_AI.patterns.openings.size === 0) return;
  
  // Find the highest win-rate opening pattern
  let bestOpening = null;
  let highestWinRate = 0;
  
  LEARNING_AI.patterns.openings.forEach((pattern, key) => {
    if (pattern.winRate > highestWinRate && pattern.gamesPlayed >= 3) {
      bestOpening = pattern;
      highestWinRate = pattern.winRate;
    }
  });
  
  if (bestOpening && bestOpening.moves.length > turnNumber) {
    const nextMove = bestOpening.moves[turnNumber - 1];
    console.log(`Applying learned opening move: ${nextMove.actionType}`);
    
    // Try to execute the learned opening move if possible
    if (nextMove.actionType === 'unitSpawn') {
      // Prioritize spawning the same unit type
      window.aiPreferredUnitType = nextMove.actionData.unitType;
    } else if (nextMove.actionType === 'move') {
      // Prefer similar movement patterns
      window.aiPreferredMovement = nextMove.actionData;
    }
  }
}

function applyLearnedTactics(aiTeam, strategicAnalysis) {
  if (LEARNING_AI.patterns.tactics.size === 0) return;
  
  // Find the most effective tactical patterns
  const effectiveTactics = [];
  LEARNING_AI.patterns.tactics.forEach((pattern, key) => {
    if (pattern.effectiveness > 5 && pattern.usageCount >= 2) {
      effectiveTactics.push(pattern);
    }
  });
  
  if (effectiveTactics.length > 0) {
    // Sort by effectiveness
    effectiveTactics.sort((a, b) => b.effectiveness - a.effectiveness);
    const bestTactic = effectiveTactics[0];
    
    console.log(`Applying learned tactic with effectiveness: ${bestTactic.effectiveness}`);
    
    // Store the tactical preference for AI units to use
    window.aiPreferredTactic = bestTactic.sequence;
  }
}

// Game End Processing for Learning AI
function finalizeGameForLearning(winner) {
  // Don't finalize if this was a pure AI vs AI game with no human involvement
  if (!shouldLearnFromCurrentGame() || LEARNING_AI.currentGameRecord.moves.length === 0) return;
  
  // Mark the winner and game length
  LEARNING_AI.currentGameRecord.winner = winner;
  LEARNING_AI.currentGameRecord.gameLength = turnNumber;
  
  // Evaluate outcomes for each recorded move
  LEARNING_AI.currentGameRecord.moves.forEach(move => {
    if (move.team === winner) {
      move.outcome = 'victory';
    } else {
      move.outcome = 'defeat';
    }
  });
  
  // Store the completed game record
  LEARNING_AI.gameplayData.push({
    ...LEARNING_AI.currentGameRecord,
    endTime: Date.now()
  });
  
  console.log(`Learning AI: Game completed. Winner: ${winner}. Recorded ${LEARNING_AI.currentGameRecord.moves.length} moves.`);
  
  // Analyze patterns with the new data
  analyzeGameplayPatterns();
  
  // Auto-save the updated Learning AI data
  saveLearningAIData();
  
  // Reset for next game
  LEARNING_AI.currentGameRecord = {
    moves: [],
    startState: null,
    winner: null,
    gameLength: 0
  };
}

// Find best learned response for AI unit
function findBestLearnedResponse(unit, team) {
  if (LEARNING_AI.patterns.responses.size === 0) return null;
  
  // Look for recent opponent moves to respond to
  const recentMoves = LEARNING_AI.currentGameRecord.moves.slice(-3);
  const opponentMoves = recentMoves.filter(move => move.team !== team);
  
  if (opponentMoves.length === 0) return null;
  
  const lastOpponentMove = opponentMoves[opponentMoves.length - 1];
  
  // Find learned responses to this type of move
  let bestResponse = null;
  let highestSuccessRate = 0;
  
  LEARNING_AI.patterns.responses.forEach((pattern, key) => {
    if (pattern.trigger.actionType === lastOpponentMove.actionType && 
        pattern.successRate > highestSuccessRate &&
        pattern.timesUsed >= 2) {
      
      // Check if this response is applicable to current unit
      if (canExecuteLearnedAction(unit, pattern.response)) {
        bestResponse = pattern.response;
        highestSuccessRate = pattern.successRate;
      }
    }
  });
  
  if (bestResponse && highestSuccessRate > 0.6) {
    console.log(`AI applying learned response: ${bestResponse.actionType} (success rate: ${highestSuccessRate})`);
    
    // Show learning activity in UI
    const activity = document.getElementById('learningActivity');
    if (activity) {
      activity.style.display = 'block';
      activity.textContent = `🧠 AI using learned tactic: ${bestResponse.actionType} (${Math.round(highestSuccessRate * 100)}% success rate)`;
      setTimeout(() => {
        if (activity.style.display !== 'none') {
          activity.style.display = 'none';
        }
      }, 3000);
    }
    
    return bestResponse;
  }
  
  return null;
}

function canExecuteLearnedAction(unit, action) {
  if (action.actionType === 'attack') {
    return !unit.hasActed && unit.atkRange > 0;
  } else if (action.actionType === 'move') {
    return !unit.hasMoved && unit.move > 0;
  } else if (action.actionType === 'unitSpawn') {
    // Can't spawn with existing units, but can influence AI building decisions
    return false;
  }
  return false;
}

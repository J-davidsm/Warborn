// Warborn source split from the original game.js.
// Section: js/systems/mechanics.js

// CORE GAME MECHANICS & UTILITIES
// ========================================

/**
 * Finds a living unit at the specified grid coordinates
 * @param {number} c - Grid column (0-based)
 * @param {number} r - Grid row (0-based) 
 * @returns {Object|undefined} Unit object if found and alive, undefined otherwise
 */
function getUnitAt(c, r) { 
  return units.find(u => u.col === c && u.row === r && u.hp > 0); 
}

/**
 * Calculates grid distance between two points (works for both square and hex grids)
 * @param {number} x1 - First point X coordinate
 * @param {number} y1 - First point Y coordinate  
 * @param {number} x2 - Second point X coordinate
 * @param {number} y2 - Second point Y coordinate
 * @returns {number} Grid distance (Manhattan for squares, hex distance for hexagons)
 */
function manhattan(x1, y1, x2, y2) { 
  if (useHexGrid) {
    return hexDistance(x1, y1, x2, y2);
  } else {
    return abs(x1 - x2) + abs(y1 - y2); 
  }
}

/**
 * Advanced pathfinding - checks if unit can reach destination without passing through enemies
 * Uses breadth-first search to find valid paths that avoid enemy unit positions
 * Allows movement through friendly units but blocks enemy units completely
 * 
 * @param {Object} unit - The unit attempting to move
 * @param {number} targetCol - Destination column coordinate
 * @param {number} targetRow - Destination row coordinate
 * @returns {boolean} True if a valid path exists within movement range
 */
function canMoveTo(unit, targetCol, targetRow) {
  return !!findMovementPath(unit, targetCol, targetRow);
}

function findMovementPath(unit, targetCol, targetRow) {
  if(unit && (unit.fortress || ['Stockade','Castle','Heavy Fortress','Fortress'].includes(unit.name)))return false;
  const flying=unit?.name==='Dragon';
  if (!unit || !Number.isInteger(targetCol) || !Number.isInteger(targetRow) ||
      targetCol < 0 || targetCol >= COLS || targetRow < 0 || targetRow >= ROWS) {
    return false;
  }
  // A unit may attack an occupied enemy tile, but may never move onto it.
  // Keeping this check at the pathfinder boundary prevents every caller from
  // accidentally treating an enemy as an empty destination.
  const targetUnit = getUnitAt(targetCol, targetRow);
  if (targetUnit && targetUnit.id !== unit.id) return false;
  const startCol = unit.col;
  const startRow = unit.row;
  let maxMove = unit.move;
  
  // Check terrain-based movement restrictions
  const startTerrainIdx = startRow * COLS + startCol;
  const startTerrain = terrain[startTerrainIdx];
  const targetTerrainIdx = targetRow * COLS + targetCol;
  const targetTerrain = terrain[targetTerrainIdx];
  const crown=unit.name==='Crown';
  const grass=t=>!t||t==='GRASS';
  if(crown)maxMove=2;
  
  // Mountain still restricts to 1 space
  if (!flying && !crown && startTerrain === 'MOUNTAIN') {
    maxMove = 1;
  }
  
  // Swamp movement rules: 1 step through swamp terrain, except Assassins get full range
  if (!flying && !crown && startTerrain === 'SWAMP') {
    if (unit.name === 'Assassin') {
      // Assassins can move full range in swamps (no restriction)
      maxMove = unit.move;
    } else {
      maxMove = 1; // Other units restricted to 1 space in swamps
    }
  }
  
  // Water is exclusively naval terrain. Land units can cross only a BRIDGE;
  // they cannot step onto water or path through it on the way to land.
  if (!flying && targetTerrain === 'WATER' && !unit.isWaterUnit) return false;
  // Ships stay on water. Anchored land units can embark and disembark.
  const naval=['Sloop','Man-of-War','Battleship'].includes(unit.name);
  if (!flying && naval && targetTerrain !== 'WATER') return false;
  
  // Check if destination is within movement range
  const directDist = manhattan(startCol, startRow, targetCol, targetRow);
  //console.log('DEBUG: canMoveTo - Direct distance:', directDist, 'Max move:', maxMove, 'Use hex:', useHexGrid);
  if (directDist > maxMove) {
    console.log('DEBUG: canMoveTo - REJECTED by distance check');
    return false;
  }
  
  // Use breadth-first search to find if there's a clear path
  const queue = [{col: startCol, row: startRow, steps: 0}];
  const visited = new Set();
  const costs = new Map([[`${startCol},${startRow}`,0]]);
  const paths = new Map([[`${startCol},${startRow}`, [{col:startCol,row:startRow}]]]);
  
  while (queue.length > 0) {
    queue.sort((a,b)=>a.steps-b.steps);
    const {col, row, steps} = queue.shift();
    const currentKey=`${col},${row}`;
    if(visited.has(currentKey))continue;
    visited.add(currentKey);
    
    // If we reached the target, path is clear
    if (col === targetCol && row === targetRow) {
      return paths.get(`${col},${row}`);
    }
    
    // If we've used all movement, stop exploring this path
    if (steps >= maxMove) {
      continue;
    }
    
    // Check all adjacent tiles
    let directions;
    if (useHexGrid) {
      directions = getHexNeighbors(col, row);
    } else {
      directions = [[0,1], [0,-1], [1,0], [-1,0]];
    }
    
    for (const [dx, dy] of directions) {
      const newCol = col + dx;
      const newRow = row + dy;
      const key = `${newCol},${newRow}`;
      
      // Skip if out of bounds or already visited
      if (newCol < 0 || newCol >= COLS || newRow < 0 || newRow >= ROWS || visited.has(key)) {
        continue;
      }
      
      const unitAtPos = getUnitAt(newCol, newRow);
      
      // Pass through our own formation, but never stop on an occupied tile.
      // Other factions remain blockers, including diplomatic allies.
      if (unitAtPos && unitAtPos.id !== unit.id && unitAtPos.team !== unit.team) continue;
      
      // Check terrain restrictions
      const terrainIdx = newRow * COLS + newCol;
      const terrainType = terrain[terrainIdx];
      if (!flying && naval && terrainType !== 'WATER') continue;
      if (terrainType) {
        const terrainData = TERRAIN[terrainType];
        if (terrainData && !flying) {
          // Check if unit type is blocked by this terrain
          if (terrainData.blockedUnits && terrainData.blockedUnits.includes(unit.name)) {
            continue; // Unit cannot enter this terrain
          }
          
          // Check if water terrain requires water unit
          if (terrainData.waterOnly && !unit.isWaterUnit) {
            continue; // Only water units can enter water
          }
        }
      }
      
      // Calculate movement cost for this terrain
      let moveCost = 1; // Default cost
      
      // Swamp terrain costs: 1 movement per swamp tile, except Assassins move normally
      if (terrainType === 'SWAMP' && unit.name !== 'Assassin') {
        moveCost = 1; // Each swamp tile costs 1 movement point for non-Assassins
      }
      
      if(crown)moveCost=grass(startTerrain)&&grass(terrainType)?1:2;
      const total=steps+moveCost;
      if(total>maxMove||total>=(costs.get(key)??Infinity))continue;
      costs.set(key,total);
      paths.set(key, [...paths.get(`${col},${row}`), {col:newCol,row:newRow}]);
      queue.push({col: newCol, row: newRow, steps: steps + moveCost});
    }
  }
  
  return false; // No clear path found
}

function findNearestSafeSettlement(unit, enemies) {
  let bestSpot = null;
  let minDist = Infinity;
  
  // Check each settlement
  for(let r = 0; r < ROWS; r++) {
    for(let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
  const settlement = settlements[idx];
  if(!settlement) continue; // Skip non-settlements
      
      // Skip if another unit is already there
      if(getUnitAt(c, r)) continue;
      
      // Calculate minimum distance to any enemy
      let minEnemyDist = Infinity;
      for(const enemy of enemies) {
        const dist = manhattan(c, r, enemy.col, enemy.row);
        minEnemyDist = min(minEnemyDist, dist);
      }
      
      // Consider it safe if it's far from enemies
      if(minEnemyDist > 2) {
        const distToUnit = manhattan(c, r, unit.col, unit.row);
        if(distToUnit < minDist && distToUnit <= unit.move) { // Make sure it's reachable
          minDist = distToUnit;
          bestSpot = {col: c, row: r, settlement: settlement};
        }
      }
    }
  }
  return bestSpot;
}

function findNearestClaimableSettlement(unit, team) {
  let bestSpot = null;
  let minDist = Infinity;
  let consideredSettlements = [];
  
  // Check each settlement
  for(let r = 0; r < ROWS; r++) {
    for(let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const settlement = settlements[idx];
      if(!settlement) continue; // Skip non-settlements
      
      const distToUnit = manhattan(c, r, unit.col, unit.row);
      const occupied = getUnitAt(c, r);
      const canReach = canMoveTo(unit, c, r);
      
      consideredSettlements.push({
        pos: `[${c},${r}]`,
        owner: settlement.owner || 'neutral',
        dist: distToUnit,
        occupied: !!occupied,
        canReach: canReach,
        inRange: distToUnit <= unit.move
      });
      
      // Skip if another unit is already there
      if(occupied) continue;
      
      // Only consider settlements that are neutral or enemy-owned (not our own)
      if(settlement.owner === team) continue;
      
      if(distToUnit < minDist && distToUnit <= unit.move && canReach) { // Make sure it's reachable via clear path
        minDist = distToUnit;
        bestSpot = {col: c, row: r, settlement: settlement};
      }
    }
  }
  
  // Debug logging
  if (consideredSettlements.length > 0) {
    console.log(`AI ${unit.name} at [${unit.col},${unit.row}] settlement analysis:`, 
      consideredSettlements.map(s => `${s.pos}(${s.owner},d=${s.dist},occ=${s.occupied},reach=${s.canReach})`).join(' | '));
  }
  
  return bestSpot;
}

function getUnitRole(unit) {
  // Determine tactical role based on unit type and stats
  if (unit.name === 'Archer') return 'ranged';
  if (unit.name === 'Knight') return 'heavy';
  if (unit.name === 'Spearman') return 'anti-cavalry';
  if (unit.atkRange > 1) return 'ranged';
  if (unit.move >= 3) return 'mobile';
  if (unit.hp > 80) return 'tank';
  return 'infantry';
}

function analyzeStrategicSituation() {
  const playerUnits = units.filter(u => u.team === 'PLAYER' && u.hp > 0);
  const aiUnits = units.filter(u => u.team === 'AI' && u.hp > 0);
  const player2Units = units.filter(u => u.team === 'PLAYER2' && u.hp > 0);
  
  const totalEnemyUnits = playerUnits.length + (opponentType === 'HUMAN' || opponentType === 'LOCAL_2P' ? player2Units.length : 0);
  const totalAiUnits = aiUnits.length + (opponentType === 'AI' ? player2Units.length : 0);
  
  // Settlement analysis
  const playerSettlements = settlements.filter(s => s && s.owner === 'PLAYER').length;
  const aiSettlements = settlements.filter(s => s && (s.owner === 'AI' || (opponentType === 'AI' && s.owner === 'PLAYER2'))).length;
  const neutralSettlements = settlements.filter(s => s && !s.owner).length;
  
  // Resource analysis
  const aiResources = getResourceValue('AI') + (opponentType === 'AI' ? getResourceValue('PLAYER2') : 0);
  const playerResources = getResourceValue('PLAYER');
  
  return {
    unitAdvantage: totalAiUnits - totalEnemyUnits,
    settlementAdvantage: aiSettlements - playerSettlements,
    neutralSettlements,
    resourceAdvantage: aiResources - playerResources,
    totalEnemyUnits,
    totalAiUnits,
    isWinning: totalAiUnits > totalEnemyUnits * 0.8 && aiSettlements >= playerSettlements * 0.8,
    isLosing: totalAiUnits < totalEnemyUnits * 0.5 && aiSettlements < playerSettlements,
    shouldExpand: neutralSettlements > 0 && aiResources > 2,
    shouldDefend: totalAiUnits < totalEnemyUnits && aiSettlements > 0
  };
}

function calculateTargetPriority(aiUnit, enemies, strategy) {
  // Get AI personality for behavior modifications
  const personality = diplomacy.personalities[aiUnit.team] ? 
    AI_PERSONALITIES[diplomacy.personalities[aiUnit.team]] : AI_PERSONALITIES.BALANCED;
  
  // Score each enemy based on multiple factors
  const targetScores = enemies.map(enemy => {
    const distance = manhattan(aiUnit.col, aiUnit.row, enemy.col, enemy.row);
    let score = 0;
    
    // Base priority: closer enemies are higher priority
    score += (10 - Math.min(distance, 10)) * 10;
    
    // Wounded enemies are easier targets
    const healthRatio = enemy.hp / enemy.maxHp;
    if (healthRatio < 0.5) score += 50;
    else if (healthRatio < 0.8) score += 25;
    
    // Target high-value units (higher damage dealers)
    score += (enemy.dmg || 20) * 2;
    
    // If we're losing, prioritize threatening units
    if (strategy.isLosing) {
      score += (enemy.dmg || 20) * 3;
    }
    
    // If enemy is on a settlement, higher priority to kick them out
    const enemyIdx = enemy.row * COLS + enemy.col;
    if (settlements[enemyIdx] && settlements[enemyIdx].owner !== enemy.team) {
      score += 30;
    }
    
    // Can we actually reach this enemy to attack?
    const canAttack = distance <= aiUnit.atkRange && !aiUnit.hasActed;
    if (canAttack) score += 100;
    
    // Can we reach this enemy in one move?
    const canReachInOneMove = distance <= aiUnit.move + aiUnit.atkRange;
    if (canReachInOneMove) score += 50;
    
    // PERSONALITY-BASED TARGET PREFERENCES
    switch (personality.type) {
      case 'AGGRESSIVE':
        // Warmongers prioritize high-damage targets and wounded enemies
        score += (enemy.dmg || 20) * 2;
        if (enemy.hp < enemy.maxHp * 0.6) score += 100; // Hunt the wounded
        if (enemy.name === 'Dragon' || enemy.name === 'Knight') score += 75; // Elite targets
        break;
        
      case 'DEFENSIVE':
        // Guardians prioritize immediate threats and settlement defenders
        if (distance <= 3) score += 100; // Nearby targets priority
        const enemyIdx = enemy.row * COLS + enemy.col;
        if (settlements[enemyIdx] && settlements[enemyIdx].owner === aiUnit.team) {
          score += 200; // Extremely high priority for settlement defenders
        }
        break;
        
      case 'TRADER':
        // Merchant Princes prefer cost-effective targets
        const killEfficiency = (aiUnit.dmg || 20) / Math.max(enemy.hp, 1);
        score += killEfficiency * 100; // Prefer easy kills
        if (enemy.name === 'Soldier' || enemy.name === 'Archer') score += 50; // Lower-value targets
        break;
        
      case 'IDEOLOGICAL':
        // Zealots target leaders and symbols of power
        if (enemy.name === 'Dragon') score += 150; // Symbols of power
        if (enemy.name === 'Knight') score += 100; // Leaders
        // More willing to take risks for symbolic victories
        if (distance > aiUnit.atkRange) score += 30; // Pursue even distant targets
        break;
        
      case 'BALANCED':
      default:
        // Diplomats prefer tactical efficiency
        const tacticalValue = (enemy.dmg || 20) * (1 - (enemy.hp / enemy.maxHp));
        score += tacticalValue * 0.5;
        break;
    }
    
    return { enemy, score, distance, canAttack, canReachInOneMove };
  });
  
  // Sort by score (highest first)
  targetScores.sort((a, b) => b.score - a.score);
  
  return {
    primaryTarget: targetScores[0].enemy,
    allTargets: targetScores,
    bestScore: targetScores[0].score
  };
}

function selectBestTarget(aiUnit, enemiesInRange, strategy) {
  if (enemiesInRange.length === 1) return enemiesInRange[0];
  
  // Get AI personality for behavior modifications
  const personality = diplomacy.personalities[aiUnit.team] ? 
    AI_PERSONALITIES[diplomacy.personalities[aiUnit.team]] : AI_PERSONALITIES.BALANCED;
  
  // Score each target based on tactical value
  const targetScores = enemiesInRange.map(enemy => {
    let score = 0;
    
    // Prioritize enemies we can kill
    const canKill = (aiUnit.dmg || 20) >= enemy.hp;
    if (canKill) score += 1000;
    
    // Prioritize wounded enemies (easier to finish off)
    const healthRatio = enemy.hp / enemy.maxHp;
    score += (1 - healthRatio) * 200;
    
    // Prioritize high-damage enemies (remove threats)
    score += (enemy.dmg || 20) * 3;
    
    // Prioritize enemies on our settlements
    const enemyIdx = enemy.row * COLS + enemy.col;
    if (settlements[enemyIdx] && settlements[enemyIdx].owner === aiUnit.team) {
      score += 150; // Get them off our territory!
    }
    
    // If we're losing, focus on biggest threats
    if (strategy.isLosing) {
      score += (enemy.dmg || 20) * 5;
    }
    
    // Consider unit type matchups
    if (aiUnit.name === 'Archer' && enemy.name === 'Knight') score -= 50; // Archers avoid knights
    if (aiUnit.name === 'Knight' && enemy.name === 'Archer') score += 100; // Knights hunt archers
    if (aiUnit.name === 'Spearman' && enemy.name === 'Knight') score += 100; // Spears vs cavalry
    
    // PERSONALITY-BASED COMBAT PREFERENCES
    switch (personality.type) {
      case 'AGGRESSIVE':
        // Warmongers always attack the strongest available target
        if (canKill) score += 200; // Extra bonus for kills
        score += (enemy.dmg || 20) * 3; // Prioritize dangerous targets
        break;
        
      case 'DEFENSIVE':
        // Guardians prioritize protecting territory and removing immediate threats
        const enemyIdx = enemy.row * COLS + enemy.col;
        if (settlements[enemyIdx] && settlements[enemyIdx].owner === aiUnit.team) {
          score += 300; // Extremely high priority for settlement defense
        }
        // Prefer safer targets when possible
        if (enemy.hp <= (aiUnit.dmg || 20)) score += 150; // Safe kills
        break;
        
      case 'TRADER':
        // Merchant Princes optimize for resource efficiency
        const damageEfficiency = (aiUnit.dmg || 20) / Math.max(enemy.hp, 1);
        score += damageEfficiency * 200; // Heavily weight efficient attacks
        if (canKill && enemy.name !== 'Dragon') score += 100; // Avoid costly fights
        break;
        
      case 'IDEOLOGICAL':
        // Zealots take calculated risks for glory
        if (enemy.name === 'Dragon') score += 250; // Will risk everything for dragons
        if (enemy.name === 'Knight') score += 150; // Target leaders
        // Less concerned with efficiency, more with symbolic victories
        break;
        
      case 'BALANCED':
      default:
        // Diplomats seek tactical advantages
        if (canKill) score += 100; // Standard kill bonus
        break;
    }
    
    return { enemy, score };
  });
  
  // Return the best target
  targetScores.sort((a, b) => b.score - a.score);
  return targetScores[0].enemy;
}

function shouldRetreat(unit, enemies, strategy) {
  // Get AI personality for behavior modifications
  const personality = diplomacy.personalities[unit.team] ? 
    AI_PERSONALITIES[diplomacy.personalities[unit.team]] : AI_PERSONALITIES.BALANCED;
  
  const healthRatio = unit.hp / unit.maxHp;
  const nearbyEnemies = enemies.filter(enemy => 
    manhattan(unit.col, unit.row, enemy.col, enemy.row) <= 2
  );
  
  // Base retreat thresholds modified by personality
  let retreatHealthThreshold = 0.25;
  let retreatEnemyThreshold = 3;
  
  switch (personality.type) {
    case 'AGGRESSIVE':
      // Warmongers retreat much less often
      retreatHealthThreshold = 0.10; // Fight to near death
      retreatEnemyThreshold = 4; // Need to be severely outnumbered
      break;
      
    case 'DEFENSIVE':
      // Guardians retreat earlier to preserve forces
      retreatHealthThreshold = 0.40; // Retreat when moderately wounded
      retreatEnemyThreshold = 2; // Retreat when outnumbered 2:1
      break;
      
    case 'TRADER':
      // Merchant Princes make cost-benefit decisions
      retreatHealthThreshold = 0.35; // Retreat to preserve investment
      retreatEnemyThreshold = 2;
      // Consider unit value in retreat decision
      if (unit.name === 'Dragon' || unit.name === 'Knight') {
        retreatHealthThreshold = 0.50; // Valuable units retreat earlier
      }
      break;
      
    case 'IDEOLOGICAL':
      // Zealots fight for glory, retreat less
      retreatHealthThreshold = 0.15;
      retreatEnemyThreshold = 4;
      // Never retreat Dragons - symbols of power
      if (unit.name === 'Dragon') return false;
      break;
      
    case 'BALANCED':
    default:
      // Diplomats use standard tactical retreat
      retreatHealthThreshold = 0.25;
      retreatEnemyThreshold = 3;
      break;
  }
  
  // Apply personality-modified retreat logic
  if (healthRatio < retreatHealthThreshold && nearbyEnemies.length >= retreatEnemyThreshold) return true;
  
  // Consider retreating only if certain death next turn and severely outnumbered
  const dangerousEnemies = nearbyEnemies.filter(enemy => 
    (enemy.dmg || 20) >= unit.hp && manhattan(unit.col, unit.row, enemy.col, enemy.row) <= enemy.atkRange + enemy.move
  );
  
  if (dangerousEnemies.length >= retreatEnemyThreshold && healthRatio < retreatHealthThreshold * 1.2) return true;
  
  return false;
}

function findSafeRetreatPosition(unit, enemies, friendlyUnits) {
  const possibleRetreatSpots = [];
  
  for (let dr = -unit.move; dr <= unit.move; dr++) {
    for (let dc = -unit.move; dc <= unit.move; dc++) {
      const newRow = unit.row + dr;
      const newCol = unit.col + dc;
      const distance = manhattan(unit.col, unit.row, newCol, newRow);
      
      if (distance === 0 || distance > unit.move) continue;
      if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) continue;
      if (getUnitAt(newCol, newRow)) continue;
      if (!canMoveTo(unit, newCol, newRow)) continue;
      
      // SETTLEMENT PROTECTION: Don't abandon settlements even when retreating
      if (wouldAbandonSettlement(unit, newCol, newRow)) continue;
      
      // Calculate safety score
      let safetyScore = 0;
      
      // Bonus for distance from enemies
      const minEnemyDistance = Math.min(...enemies.map(enemy => 
        manhattan(newCol, newRow, enemy.col, enemy.row)
      ));
      safetyScore += minEnemyDistance * 20;
      
      // Bonus for being near friendly units (protection)
      const nearestAlly = friendlyUnits.find(ally => 
        manhattan(newCol, newRow, ally.col, ally.row) <= 2
      );
      if (nearestAlly) safetyScore += 50;
      
      // Bonus for defensive terrain
      const terrainIdx = newRow * COLS + newCol;
      if (terrain[terrainIdx] === 'mountain') safetyScore += 40;
      if (terrain[terrainIdx] === 'forest') safetyScore += 25;
      
      // Bonus for our settlements (can heal there)
      if (settlements[terrainIdx] && settlements[terrainIdx].owner === unit.team) {
        safetyScore += 60;
      }
      
      possibleRetreatSpots.push({ 
        row: newRow, 
        col: newCol, 
        safetyScore,
        reason: 'Tactical retreat'
      });
    }
  }
  
  if (possibleRetreatSpots.length === 0) return null;
  
  // Return the safest retreat position
  possibleRetreatSpots.sort((a, b) => b.safetyScore - a.safetyScore);
  return possibleRetreatSpots[0];
}

function findFormationMove(unit, friendlyUnits, strategy) {
  // Find friendly units to coordinate with
  const nearbyFriendlies = friendlyUnits.filter(ally => 
    ally !== unit && manhattan(unit.col, unit.row, ally.col, ally.row) <= 4
  );
  
  if (nearbyFriendlies.length === 0) return null;
  
  // Try to move to support positions near allies
  const possibleMoves = [];
  for (let dr = -unit.move; dr <= unit.move; dr++) {
    for (let dc = -unit.move; dc <= unit.move; dc++) {
      const newRow = unit.row + dr;
      const newCol = unit.col + dc;
      const distance = manhattan(unit.col, unit.row, newCol, newRow);
      
      if (distance === 0 || distance > unit.move) continue;
      if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) continue;
      if (getUnitAt(newCol, newRow)) continue;
      if (!canMoveTo(unit, newCol, newRow)) continue;
      
      // SETTLEMENT PROTECTION: Don't abandon settlements for formation moves
      if (wouldAbandonSettlement(unit, newCol, newRow)) continue;
      
      // Score this position based on formation benefits
      let score = 0;
      
      // Bonus for being adjacent to allies (mutual support)
      nearbyFriendlies.forEach(ally => {
        const distToAlly = manhattan(newCol, newRow, ally.col, ally.row);
        if (distToAlly === 1) score += 100; // Adjacent support
        else if (distToAlly === 2) score += 50; // Close support
      });
      
      // Bonus for defensive terrain
      const terrainIdx = newRow * COLS + newCol;
      if (terrain[terrainIdx] === 'mountain') score += 30;
      if (terrain[terrainIdx] === 'forest') score += 20;
      
      // Bonus for settlements we own
      if (settlements[terrainIdx] && settlements[terrainIdx].owner === unit.team) {
        score += 40;
      }
      
      if (score > 0) {
        possibleMoves.push({ row: newRow, col: newCol, score, reason: 'Formation support' });
      }
    }
  }
  
  if (possibleMoves.length === 0) return null;
  
  // Return the best formation move
  possibleMoves.sort((a, b) => b.score - a.score);
  return possibleMoves[0];
}

// ---------- Zoom and Pan Event Handlers ----------

function mouseReleased() {
  isDragging = false;
}

function mouseDragged() {
  if (isDragging && !isMenuBlockingGameInput()) {
    // Pan the camera based on mouse movement
    const deltaX = mouseX - lastMouseX;
    const deltaY = mouseY - lastMouseY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) suppressClickAfterDrag = true;
    panCamera(deltaX, deltaY);
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    return false;
  }
  
  // Update last mouse position
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function mouseWheel(event) {
  const canvasEl = document.querySelector('#game canvas');
  if (!canvasEl) return true;
  const rect = canvasEl.getBoundingClientRect();
  const overCanvas = mouseX >= 0 && mouseY >= 0 && mouseX <= rect.width && mouseY <= rect.height;
  if (!overCanvas || isMenuBlockingGameInput()) return true;
  const zoomFactor = event.delta > 0 ? 0.88 : 1.14;
  setZoom(targetZoom * zoomFactor, mouseX, mouseY);
  return false;
}

function keyPressed() {
  // Only respond to zoom/pan keys if canvas is focused
  if (mapCanvasFocused) {
    // Keyboard controls for zoom and pan
    if (key === 'z' || key === 'Z') {
      // Reset zoom to 1.0
      setZoom(1.0);
      targetPanX = 0;
      targetPanY = 0;
      return false; // Prevent default behavior
    } else if (key === '+' || key === '=') {
      // Zoom in
      setZoom(targetZoom * 1.2);
      return false; // Prevent default behavior
    } else if (key === '-' || key === '_') {
      // Zoom out
      setZoom(targetZoom * 0.8);
      return false; // Prevent default behavior
    }
    
    // Arrow keys for panning
    const panAmount = 50;
    if (keyCode === UP_ARROW) {
      panCamera(0, panAmount);
      return false; // Prevent page scrolling
    } else if (keyCode === DOWN_ARROW) {
      panCamera(0, -panAmount);
      return false; // Prevent page scrolling
    } else if (keyCode === LEFT_ARROW) {
      panCamera(panAmount, 0);
      return false; // Prevent page scrolling
    } else if (keyCode === RIGHT_ARROW) {
      panCamera(-panAmount, 0);
      return false; // Prevent page scrolling
    }
  }
  
  if (key === 'h' || key === 'H') return false;
}

/**
 * Strategic AI unit selection - chooses the best unit type based on current battlefield situation
 * Considers: enemy threats, existing unit composition, tactical needs, settlement position
 * Adds randomization to prevent predictable builds while maintaining strategic coherence
 */
function selectBestUnitForSituation(team, allowedUnits, woundedAllies, hasCleric, settlement, col, row) {
  if (allowedUnits.length === 0) return null;
  if (allowedUnits.length === 1) return allowedUnits[0];
  
  // Get AI personality for decision making
  const personality = diplomacy.personalities[team] ? AI_PERSONALITIES[diplomacy.personalities[team]] : AI_PERSONALITIES.BALANCED;
  
  // Check if AI has accumulated a lot of resources (double typical income)
  const currentIncome = computeIncomeForTeam(team);
  const currentIncomeTotal = getResourceTotal(currentIncome);
  const currentResources = getResourceTotal(team);
  const hasAbundantResources = currentResources >= (currentIncomeTotal * 2);
  
  // If AI has abundant resources, prioritize based on personality
  if (hasAbundantResources) {
    // Aggressive personalities prefer Dragons and expensive combat units
    if (personality.type === 'AGGRESSIVE' && allowedUnits.includes('Dragon')) {
      console.log(`${personality.name} AI has abundant resources, buying DRAGON for conquest!`);
      return 'Dragon';
    }
    
    // Trader personalities prefer cost-efficient units but will buy expensive ones with surplus
    if (personality.type === 'TRADER') {
      const costEfficient = allowedUnits.filter(unit => {
        const template = UNIT_TEMPLATES[unit];
        const totalCost = getTotalCost(unit);
        return template && totalCost > 0 && (template.dmg / totalCost) > 4; // Good damage per cost ratio
      });
      if (costEfficient.length > 0) {
        console.log(`${personality.name} AI buying cost-efficient unit with surplus resources`);
        return costEfficient[0];
      }
    }
    
    // Defensive personalities prefer defensive units even with abundant resources
    if (personality.type === 'DEFENSIVE') {
      if (allowedUnits.includes('Cleric') && !hasCleric) {
        console.log(`${personality.name} AI prioritizes Cleric for defense even with abundant resources`);
        return 'Cleric';
      }
      if (allowedUnits.includes('Archer')) {
        console.log(`${personality.name} AI prioritizes defensive Archer`);
        return 'Archer';
      }
    }
    
    // Default: buy most expensive available
    if (allowedUnits.includes('Dragon')) {
      console.log(`AI has abundant resources (${currentResources} >= ${currentIncomeTotal * 2}), buying DRAGON (top priority)!`);
      return 'Dragon';
    }
    
    const mostExpensive = allowedUnits.reduce((maxUnit, unit) => {
      const maxTotalCost = getTotalCost(maxUnit);
      const unitTotalCost = getTotalCost(unit);
      return unitTotalCost > maxTotalCost ? unit : maxUnit;
    });
    console.log(`AI has abundant resources (${currentResources} >= ${currentIncomeTotal * 2}), buying most expensive: ${mostExpensive}`);
    return mostExpensive;
  }
  
  // Analyze current battlefield situation
  const myUnits = units.filter(u => u.team === team && u.hp > 0);
  const enemies = units.filter(u => u.team !== team && u.hp > 0);
  const nearbyEnemies = enemies.filter(e => manhattan(col, row, e.col, e.row) <= 4);
  
  // Get unit composition analysis
  const unitCounts = {};
  myUnits.forEach(u => unitCounts[u.name] = (unitCounts[u.name] || 0) + 1);
  
  // Score each allowed unit type
  const unitScores = {};
  
  for (const unitType of allowedUnits) {
    let score = 0;
    const template = UNIT_TEMPLATES[unitType];
    
    // 1. HEALING PRIORITY - Cleric for wounded allies
    if (unitType === 'Cleric') {
      if (woundedAllies.length > 0 && !hasCleric) {
        score += 1000; // Very high priority for first cleric
      } else if (woundedAllies.length > 3 && (unitCounts['Cleric'] || 0) < 2) {
        score += 500; // Second cleric for many wounded
      } else {
        score -= 300; // Avoid too many clerics
      }
    }
    
    // 2. THREAT RESPONSE - Counter nearby enemies
    if (nearbyEnemies.length > 0) {
      const avgEnemyRange = nearbyEnemies.reduce((sum, e) => sum + (e.atkRange || 1), 0) / nearbyEnemies.length;
      const avgEnemyDamage = nearbyEnemies.reduce((sum, e) => sum + (e.dmg || 20), 0) / nearbyEnemies.length;
      
      // High-damage units against close threats
      if (unitType === 'Knight' || unitType === 'Swordsman') {
        score += nearbyEnemies.length * 200;
      }
      
      // Ranged units against melee threats - reduced bonus
      if ((unitType === 'Archer' || unitType === 'Catapult') && avgEnemyRange <= 1) {
        score += nearbyEnemies.length * 75; // Reduced from 150 to 75
      }
      
      // Spearmen against cavalry/knights
      if (unitType === 'Spearman' && nearbyEnemies.some(e => e.name === 'Knight')) {
        score += 300;
      }
    }
    
    // 3. ARMY COMPOSITION BALANCE
    const currentCount = unitCounts[unitType] || 0;
    
    // Prefer diverse army composition - increased bonuses
    if (currentCount === 0) score += 150; // New unit type bonus (increased from 100)
    else if (currentCount === 1) score += 50; // Small bonus for 2nd of type
    else if (currentCount >= 3) score -= 300; // Stronger penalty for over-stacking (increased from 200)
    
    // Ensure basic unit types are represented - reduced bonus
    if (myUnits.length < 2 && (unitCounts['Soldier'] || 0) === 0) {
      if (unitType === 'Soldier') score += 75; // Only if no soldiers yet
    }
    if (myUnits.length < 2 && (unitCounts['Archer'] || 0) === 0) {
      if (unitType === 'Archer') score += 75; // Only if no archers yet  
    }
    
    // 4. SETTLEMENT POSITION TACTICAL VALUE
    const isEdgePosition = col === 0 || col === COLS-1 || row === 0 || row === ROWS-1;
    const isCenterPosition = Math.abs(col - COLS/2) <= 2 && Math.abs(row - ROWS/2) <= 2;
    
    // Mobile units for edge positions
    if (isEdgePosition && (unitType === 'Knight' || unitType === 'Assassin')) {
      score += 100;
    }
    
    // Defensive units for center positions
    if (isCenterPosition && (unitType === 'Spearman' || unitType === 'Swordsman')) {
      score += 80;
    }
    
    // 5. RESOURCE EFFICIENCY vs POWER - Adjusted to favor stronger units
    const costEfficiency = getCostEfficiency(unitType);
    score += costEfficiency; // Reduced multiplier
    
    // Add raw power bonus to favor stronger units
    const rawPower = template.hp * template.dmg;
    score += rawPower * 0.5; // Bonus for absolute power regardless of cost
    
    // Tier bonus - favor higher cost units when we can afford them
    const totalCost = getTotalCost(unitType);
    if (totalCost >= 8) score += 200; // High tier bonus
    else if (totalCost >= 5) score += 100; // Mid tier bonus
    else if (totalCost >= 3) score += 50; // Low tier bonus
    
    // 6. SPECIAL UNIT CONSIDERATIONS
    if (unitType === 'Dragon') {
      // DRAGONS ARE TOP PRIORITY - massive bonus to ensure AI always builds them when possible
      score += 20000; // Huge bonus to make Dragons highest priority
      
      // Additional bonuses for Dragons
      if (currentCount === 0) score += 10000; // Extra bonus for first Dragon
      if (myUnits.length >= 3) score += 5000; // Build Dragons once we have some army
      
      console.log(`Dragon scoring: base=2000, first=${currentCount === 0 ? 1000 : 0}, army=${myUnits.length >= 3 ? 500 : 0}, total=${score}`);
    }
    
    if (unitType === 'Assassin') {
      // Assassins for harassment and hit-and-run
      if (enemies.length > myUnits.length) score += 250; // Good when outnumbered
    }
    
    if (unitType === 'Catapult') {
      // Siege units for entrenched enemies
      const enemyInSettlements = enemies.filter(e => {
        const idx = e.row * COLS + e.col;
        return settlements[idx] !== null;
      }).length;
      score += enemyInSettlements * 100;
    }
    
    // 6. PERSONALITY-BASED MODIFIERS
    const personalityModifier = getPersonalityUnitPreference(personality, unitType, currentResources, myUnits, enemies);
    score += personalityModifier;
    console.log(`${personality.name} AI: ${unitType} gets personality modifier +${personalityModifier}`);
    
    unitScores[unitType] = score;
  }
  
  // 7. ADD RANDOMIZATION - Sort by score but add some variability
  const scoredUnits = allowedUnits.map(unit => ({
    unit,
    score: unitScores[unit],
    randomBonus: Math.random() * 40
  }));
  
  // Sort by total score (strategic + random)
  scoredUnits.sort((a, b) => (b.score + b.randomBonus) - (a.score + a.randomBonus));
  
  // Mostly pick the best strategic option, with a small top-two variation to avoid being fully predictable.
  const finalSelection = Math.random() < 0.15 && scoredUnits.length >= 2 
    ? scoredUnits[Math.floor(Math.random() * 2)].unit 
    : scoredUnits[0].unit;
  
  console.log(`AI strategic unit selection for ${team}:`, 
    scoredUnits.map(u => `${u.unit}(${u.score.toFixed(0)}+${u.randomBonus.toFixed(0)})`).join(', '),
    `→ Selected: ${finalSelection}`);
  
  return finalSelection;
}

/**
 * Calculate personality-based unit preference modifiers
 * Returns a score modifier based on the AI's personality and current situation
 */
function getPersonalityUnitPreference(personality, unitType, currentResources, myUnits, enemies) {
  let modifier = 0;
  
  switch (personality.type) {
    case 'AGGRESSIVE':
      // Warmongers prefer high-damage offensive units
      if (unitType === 'Dragon') modifier += 500;
      if (unitType === 'Knight') modifier += 300;
      if (unitType === 'Swordsman') modifier += 200;
      if (unitType === 'Catapult') modifier += 150;
      if (unitType === 'Assassin') modifier += 250;
      // Less preference for defensive units
      if (unitType === 'Cleric') modifier -= 100;
      if (unitType === 'Spearman') modifier -= 50;
      break;
      
    case 'DEFENSIVE':
      // Guardians prefer defensive and support units
      if (unitType === 'Cleric') modifier += 400;
      if (unitType === 'Spearman') modifier += 300;
      if (unitType === 'Archer') modifier += 250;
      if (unitType === 'Soldier') modifier += 150;
      // Less preference for aggressive units
      if (unitType === 'Assassin') modifier -= 200;
      if (unitType === 'Knight') modifier -= 100;
      break;
      
    case 'TRADER':
      // Merchant Princes prefer cost-efficient units
      const template = UNIT_TEMPLATES[unitType];
      if (template) {
        const efficiency = (template.hp * template.dmg) / template.cost;
        modifier += efficiency * 50; // Bonus for cost efficiency
        
        // Specific preferences
        if (unitType === 'Soldier') modifier += 200; // Cheap and reliable
        if (unitType === 'Archer') modifier += 150; // Good value
        if (unitType === 'Dragon' && currentResources >= 12) modifier += 300; // Only when very wealthy
      }
      break;
      
    case 'IDEOLOGICAL':
      // Zealots prefer specialized and unique units
      if (unitType === 'Dragon') modifier += 400; // Symbols of power
      if (unitType === 'Cleric') modifier += 300; // Religious significance
      if (unitType === 'Catapult') modifier += 200; // Impressive siege weapons
      // Avoid basic units unless necessary
      if (unitType === 'Soldier' && myUnits.length > 2) modifier -= 100;
      break;
      
    case 'BALANCED':
    default:
      // Diplomats prefer balanced compositions
      const unitCounts = {};
      myUnits.forEach(u => unitCounts[u.name] = (unitCounts[u.name] || 0) + 1);
      
      // Encourage variety
      if (!unitCounts[unitType]) modifier += 150; // New unit type
      else if (unitCounts[unitType] >= 2) modifier -= 100; // Avoid over-stacking
      
      // Situational bonuses
      if (enemies.length > myUnits.length) {
        if (unitType === 'Knight' || unitType === 'Swordsman') modifier += 100;
      }
      break;
  }
  
  // Additional personality traits
  if (personality.warlikeness > 0.6) {
    // Very warlike personalities get extra combat unit bonuses
    if (['Knight', 'Swordsman', 'Dragon', 'Catapult'].includes(unitType)) {
      modifier += personality.warlikeness * 100;
    }
  }
  
  if (personality.cooperativeness > 0.6) {
    // Cooperative personalities prefer support units
    if (['Cleric', 'Archer'].includes(unitType)) {
      modifier += personality.cooperativeness * 100;
    }
  }
  
  return Math.round(modifier);
}

/**
 * Finds the best move to aggressively pursue a target enemy
 * Prioritizes getting closer to the enemy while avoiding bad terrain when possible
 */
function findAggressivePursuitMove(unit, targetEnemy, isInSwamp) {
  let bestMove = null;
  let bestScore = -Infinity;
  
  // Look at all possible moves
  for(let r = max(0, unit.row - unit.move); r <= min(ROWS - 1, unit.row + unit.move); r++) {
    for(let c = max(0, unit.col - unit.move); c <= min(COLS - 1, unit.col + unit.move); c++) {
      if(manhattan(unit.col, unit.row, c, r) > unit.move) continue; // Too far
      if(getUnitAt(c, r)) continue; // Occupied
      if(!canMoveTo(unit, c, r)) continue; // No clear path
      
      let score = 0;
      const idx = r * COLS + c;
      const newTerrain = terrain[idx];
      
      // PRIORITY 1: Get closer to the target enemy (massive bonus)
      const distToTarget = manhattan(c, r, targetEnemy.col, targetEnemy.row);
      const currentDistToTarget = manhattan(unit.col, unit.row, targetEnemy.col, targetEnemy.row);
      
      if (distToTarget < currentDistToTarget) {
        score += (currentDistToTarget - distToTarget) * 100; // Huge bonus for getting closer
      } else if (distToTarget > currentDistToTarget) {
        score -= 50; // Penalty for moving away
      }
      
      // PRIORITY 2: Swamp avoidance (but not at the expense of pursuit)
      if (isInSwamp && newTerrain !== 'SWAMP' && unit.name !== 'Assassin') {
        score += 30; // Bonus for getting out of swamp
      } else if (!isInSwamp && newTerrain === 'SWAMP' && unit.name !== 'Assassin') {
        score -= 20; // Small penalty for entering swamp (but pursuit is more important)
      }
      
      // PRIORITY 3: Perfect attack positioning
      if (distToTarget === unit.atkRange) {
        score += 50; // Big bonus for ending up in attack range
      } else if (distToTarget === unit.atkRange + 1) {
        score += 25; // Medium bonus for being 1 step away from attack range
      }
      
      // PRIORITY 4: Terrain advantages (minor compared to pursuit)
      if (newTerrain === 'MOUNTAIN') score += 5;
      else if (newTerrain === 'WOODS') score += 3;
      
      // PRIORITY 5: Settlement bonuses (minor)
      if (settlements[idx]) {
        const t = settlements[idx].type;
        if (t === 'CITY') score += 5;
        else if (t === 'VILLAGE') score += 3;
        else if (t === 'HAMLET') score += 2;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = {col: c, row: r, score: score};
      }
    }
  }
  
  return bestMove;
}

function findBestTerrainMove(unit, enemies) {
  let bestMove = null;
  let bestScore = -Infinity;
  
  // Look at all possible moves
  for(let r = max(0, unit.row - unit.move); r <= min(ROWS - 1, unit.row + unit.move); r++) {
    for(let c = max(0, unit.col - unit.move); c <= min(COLS - 1, unit.col + unit.move); c++) {
      if(manhattan(unit.col, unit.row, c, r) > unit.move) continue; // Too far
      if(getUnitAt(c, r)) continue; // Occupied
      if(!canMoveTo(unit, c, r)) continue; // No clear path
      
      // SETTLEMENT PROTECTION: Don't abandon settlements for terrain moves
      if (wouldAbandonSettlement(unit, c, r)) continue;
      
      let score = 0;
      const idx = r * COLS + c;
      
      // Prefer terrain with defensive bonuses
      if(terrain[idx] === 'MOUNTAIN') score += 3;
      else if(terrain[idx] === 'WOODS') score += 2;
      
      // Prefer settlements
      if(settlements[idx]){
        const t = settlements[idx].type;
        if(t === 'CITY') score += 4;
        else if(t === 'VILLAGE') score += 3;
        else if(t === 'HAMLET') score += 2;
      }
      
      // Consider distance to nearest enemy
      let minEnemyDist = Infinity;
      for(const enemy of enemies) {
        const dist = manhattan(c, r, enemy.col, enemy.row);
        minEnemyDist = min(minEnemyDist, dist);
      }
      
      // If unit is weak, prefer staying away from enemies unless in good defensive position
      if(unit.hp < unit.maxHp / 3) {
        if(minEnemyDist <= unit.atkRange && !terrain[idx] && !settlements[idx]) {
          score -= 5; // Heavily penalize exposed positions when weak
        }
      } else {
        // Balance between attack range and defensive position
        if(minEnemyDist <= unit.atkRange) score += 2;
        if(minEnemyDist === unit.atkRange) score += 1; // Perfect attack range
      }
      
      if(score > bestScore) {
        bestScore = score;
        bestMove = {col: c, row: r};
      }
    }
  }
  return bestMove;
}

/**
 * Finds the best aggressive advance move toward the nearest enemy
 * Only used when no higher priority objectives (settlements, formations, etc.) are available
 * Uses pathfinding to ensure valid movement and maximizes distance covered toward enemy
 * 
 * @param {Object} unit - The unit seeking to advance
 * @param {Array} enemies - Array of enemy units to consider
 * @returns {Object|null} Best move position {col, row} or null if no valid moves
 */
function findBestAdvanceMove(unit, enemies) {
  if (enemies.length === 0) return null;
  
  // Find the nearest enemy to target for advance
  let nearestEnemy = enemies[0];
  let minDist = manhattan(unit.col, unit.row, nearestEnemy.col, nearestEnemy.row);
  
  for (const enemy of enemies) {
    const dist = manhattan(unit.col, unit.row, enemy.col, enemy.row);
    if (dist < minDist) {
      minDist = dist;
      nearestEnemy = enemy;
    }
  }
  
  let bestMove = null;
  let bestDistance = minDist; // Start with current distance to beat
  
  // Check all possible positions within movement range
  for (let r = max(0, unit.row - unit.move); r <= min(ROWS - 1, unit.row + unit.move); r++) {
    for (let c = max(0, unit.col - unit.move); c <= min(COLS - 1, unit.col + unit.move); c++) {
      // Skip current position
      if (c === unit.col && r === unit.row) continue;
      
      // Check if move is within range and valid
      if (manhattan(unit.col, unit.row, c, r) > unit.move) continue;
      if (getUnitAt(c, r)) continue; // Position occupied
      if (!canMoveTo(unit, c, r)) continue; // No clear path
      
      // SETTLEMENT PROTECTION: Don't abandon settlements to enemy capture
      if (wouldAbandonSettlement(unit, c, r)) continue;
      
      // Calculate distance to nearest enemy from this position
      const distToEnemy = manhattan(c, r, nearestEnemy.col, nearestEnemy.row);
      
      // We want the position that gets us CLOSEST to the enemy (smallest distance)
      if (distToEnemy < bestDistance) {
        bestDistance = distToEnemy;
        bestMove = { col: c, row: r };
      }
    }
  }
  
  return bestMove;
}

function getTerrainInfoText(col, row) {
  const idx = row * COLS + col;
  let info = [];
  
  // Get settlement info
  if (settlements[idx]) {
    const settlement = settlements[idx];
    const t = settlement.type;
    const owner = settlement.owner;
    if (t === 'HAMLET') info.push('Hamlet: -10% damage');
    else if (t === 'VILLAGE') info.push('Village: -20% damage');
    else if (t === 'CITY') info.push('City: -30% damage');
    if (owner) info.push('Owned by: ' + owner);
  }
  
  // Get terrain info
  if (terrain[idx]) {
    const terrainType = terrain[idx];
    if (terrainType === 'WOODS') {
      info.push('Woods:', 
                '• -30% damage from most units',
                '• +15% damage from archers/skirms',
                '• -70% damage from knights/grunts');
    } else if (terrainType === 'MOUNTAIN') {
      info.push('Mountain:', 
                '• -30% damage from most units',
                '• -50% damage from knights/grunts');
    }
  }
  
  return info.length > 0 ? info.join('\n') : null;
}

function getDefenseModifiers(attacker, defender) {
  const idx = defender.row * COLS + defender.col;
  let totalDefense = 0;

  // Check for settlement defense
  if (settlements[idx]) {
    const settlement = settlements[idx];
    const t = settlement.type;
    if (t === 'HAMLET') totalDefense += SETTLEMENTS.HAMLET.defense;
    else if (t === 'VILLAGE') totalDefense += SETTLEMENTS.VILLAGE.defense;
    else if (t === 'CITY') totalDefense += SETTLEMENTS.CITY.defense;
  }

  // Check for terrain defense - handle all terrain types
  if (terrain[idx]) {
    const terrainType = terrain[idx];
    const terrainData = TERRAIN[terrainType];
    if (terrainData && terrainData.getDefense) {
      totalDefense += terrainData.getDefense(attacker);
    }
  }

  return totalDefense;
}

function getTerrainDamageMultiplier(unit) {
  const idx = unit.row * COLS + unit.col;
  let multiplier = 1.0;
  
  if (terrain[idx]) {
    const terrainType = terrain[idx];
    const terrainData = TERRAIN[terrainType];
    if (terrainData && terrainData.damageMultiplier) {
      multiplier *= terrainData.damageMultiplier;
    }
  }
  
  return multiplier;
}

/**
 * Determines whether the AI should upgrade a unit to a water unit
 * Considers tactical advantages, resource efficiency, and strategic positioning
 */
function shouldAIUpgradeToWater(unit, playerId) {
  // Only upgrade if we have enough gold
  if ((resources[playerId] || 0) < 2) {
    return false;
  }
  
  // Don't upgrade units that are already water units
  if (unit.waterUnit) {
    return false;
  }
  const unitPos = unit.row * COLS + unit.col;
  
  // Check if there's water terrain within 3 spaces (potential tactical advantage)
  let nearbyWater = false;
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      const checkRow = unit.row + dr;
      const checkCol = unit.col + dc;
      if (checkRow >= 0 && checkRow < ROWS && checkCol >= 0 && checkCol < COLS) {
        if (manhattan(unit.col, unit.row, checkCol, checkRow) > 3) continue;
        const checkIdx = checkRow * COLS + checkCol;
        if (terrain[checkIdx] === 'WATER') {
          nearbyWater = true;
          break;
        }
      }
    }
    if (nearbyWater) break;
  }
  
  // If no nearby water, don't upgrade unless blocked by water
  if (!nearbyWater) {
    // Check if unit is blocked by water and needs upgrade to proceed
    let blockedByWater = false;
    for (const tile of getAdjacentCoords(unit.col, unit.row, true)) {
      const checkIdx = tile.row * COLS + tile.col;
      if (terrain[checkIdx] === 'WATER' && !getUnitAt(tile.col, tile.row)) {
        blockedByWater = true;
        break;
      }
    }
    
    if (!blockedByWater) {
      return false;
    }
  }
  
  // Check if upgrade provides strategic value
  let strategicValue = 0;
  
  // Higher value for units near enemies who might benefit from water mobility
  const enemies = units.filter(u => u.playerId !== playerId);
  let nearestEnemyDist = Infinity;
  for (const enemy of enemies) {
    const dist = manhattan(unit.col, unit.row, enemy.col, enemy.row);
    nearestEnemyDist = Math.min(nearestEnemyDist, dist);
  }
  
  // More likely to upgrade if enemies are nearby (tactical advantage)
  if (nearestEnemyDist <= 4) {
    strategicValue += 20;
  }
  
  // Higher value for more expensive units (protect investment)
  if (unit.type && UNIT_TEMPLATES[unit.type]) {
    const unitCost = UNIT_TEMPLATES[unit.type].cost || 0;
    if (unitCost >= 8) {
      strategicValue += 15; // Protect expensive units
    } else if (unitCost >= 5) {
      strategicValue += 10; // Moderate protection for mid-tier units
    }
  }
  
  // Higher value if we have plenty of gold (less resource pressure)
  if ((resources[playerId] || 0) >= 10) {
    strategicValue += 10;
  } else if ((resources[playerId] || 0) >= 6) {
    strategicValue += 5;
  }
  
  // Chance-based decision with strategic weighting
  const upgradeChance = Math.min(80, strategicValue); // Cap at 80% chance
  return Math.random() * 100 < upgradeChance;
}

/**
 * Master unit template definitions - single source of truth for all unit stats
 * Contains complete stats for all unit types including movement, combat, and special abilities
 * Used by spawn menus, AI decision making, and unit creation
 */

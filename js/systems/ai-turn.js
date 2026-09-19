// Warborn source split from the original game.js.
// Section: js/systems/ai-turn.js

function startAITimeout() {
  if (currentTeam !== 'AI') return; // Only set timeout during AI turns
  
  clearTimeout(aiTurnTimeoutId); // Clear any existing timeout
  aiTurnTimeoutId = setTimeout(() => {
    endAITurnDueToTimeout();
  }, AI_TURN_TIMEOUT_MS);
}

async function aiTakeTurn(aiTeam = 'AI') {
  console.log(`aiTakeTurn invoked for team ${aiTeam}. units length:`, units.length, 'opponentType:', opponentType);
  
  // Ensure the AI team matches the current team
  if (currentTeam !== aiTeam) {
    console.warn(`AI team mismatch: aiTakeTurn called for ${aiTeam} but currentTeam is ${currentTeam}`);
    return;
  }
  
  // Set up AI turn timeout - automatically end turn if no action for 1 second
  aiLastActionTime = Date.now();
  clearTimeout(aiTurnTimeoutId); // Clear any existing timeout
  
  const startAITimeout = () => {
    aiTurnTimeoutId = setTimeout(() => {
      if (isAITeam(currentTeam) && Date.now() - aiLastActionTime >= AI_TURN_TIMEOUT_MS) {
        console.log(`AI turn timeout for team ${currentTeam} - no action for 1 second, ending turn`);
        // Jump directly to turn end logic
        endAITurnDueToTimeout();
      }
    }, AI_TURN_TIMEOUT_MS);
  };
  
  startAITimeout(); // Start the timeout
  
  // For multi-AI games, every decision below should focus on the team whose turn this is.
  const currentAITeam = aiTeam;
  
  // Helper function to add visual delays between AI actions for player observation
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  
  // Timing constant - milliseconds between AI actions (balance between speed and watchability)
  const AI_ACTION_DELAY = 50;
  
  // Enhanced AI strategic analysis with learning integration
  const aiStrategicAnalysis = analyzeStrategicSituation();
  
  // Apply learned patterns if learning AI has data and there are human opponents
  if (LEARNING_AI.patterns.strategies.size > 0 && hasHumanPlayers()) {
    applyLearnedStrategy(currentAITeam, aiStrategicAnalysis);
  }
  
  // Income is already granted in endTurn() - no need to grant again here
  console.log(`${currentAITeam} starting turn with ${resources[currentAITeam] ? Object.values(resources[currentAITeam]).join(',') : 'unknown'} resources`);
  
  // AI STRATEGIC RESEARCH LOGIC: Balance research vs unit production based on battlefield analysis
  try {
    const currentResources = resources[currentAITeam] || { food: 0, gold: 0, materials: 0 };
    const researchableUnits = getResearchableUnits(currentAITeam);
    console.log(`${currentAITeam} can research: ${researchableUnits.join(', ')}, gold: ${currentResources.gold}`);
    
    // Analyze strategic situation to decide research vs building priority
    const myUnits = units.filter(u => u.team === currentAITeam && u.hp > 0);
    const enemies = units.filter(u => u.team !== currentAITeam && u.hp > 0);
    const mySettlements = settlements.filter(s => s && s.owner === currentAITeam).length;
    
    // Calculate military strength ratios
    const myStrength = myUnits.reduce((sum, u) => sum + (u.hp * u.dmg), 0);
    const enemyStrength = enemies.reduce((sum, u) => sum + (u.hp * u.dmg), 0);
    const strengthRatio = enemyStrength > 0 ? myStrength / enemyStrength : 2.0;
    
    // Decide whether to research or prioritize unit building
    const shouldResearch = (
      myUnits.length >= enemies.length && // Don't research if severely outnumbered
      strengthRatio > 0.7 && // Don't research if much weaker
      currentResources.gold >= 8 && // Need sufficient gold reserves
      mySettlements >= 2 // Need economic foundation
    );
    
    if (shouldResearch && researchableUnits.length > 0) {
      // Prioritize research by strategic value and cost
      const researchPriority = [
        'Spearman', 'Archer', // Basic counters
        'Cleric', // Healing support
        'Swordsman', 'Knight', // Strong units
        'Catapult', // Siege
        'Assassin', 'Dragon' // Advanced units
      ];
      
      for (const unitType of researchPriority) {
        if (researchableUnits.includes(unitType) && canResearch(currentAITeam, unitType)) {
          const success = researchUnit(currentAITeam, unitType);
          if (success) {
            console.log(`${currentAITeam} researched ${unitType} (strategic research phase)`);
            break; // Only research one unit per turn to pace progression
          }
        }
      }
    } else {
      console.log(`${currentAITeam} skipping research - need more units! (Units: ${myUnits.length} vs ${enemies.length}, Strength ratio: ${strengthRatio.toFixed(2)})`);
    }
  } catch(e) { 
    console.warn(`AI research failed for ${currentAITeam}:`, e); 
  }
  
  const aiUnits = units.filter(u => u.team === currentAITeam && u.hp > 0);
  console.log(`${currentAITeam} units to act:`, aiUnits.map(u=>`${u.name}[${u.team}]@${u.col},${u.row}`));

  // Check if any AI units can actually act (have morale > 0)
  const aiUnitsCanAct = aiUnits.filter(u => u.morale > 0);
  if (aiUnitsCanAct.length === 0) {
    console.log(`All ${aiUnits.length} AI units have 0 morale - skipping AI actions, will continue to building phase`);
    // Continue to building phase, then end turn properly
  } else {
    console.log(`${aiUnitsCanAct.length} of ${aiUnits.length} AI units can act (have morale > 0)`);
    // Process units that can act
    // Process units that can act
    for (const u of aiUnits) {
      if (u.morale <= 0) {
        console.log(`${currentAITeam} ${u.name} at (${u.col},${u.row}) has 0 morale, skipping`);
        continue; // fleeing handled elsewhere
      }

      console.log(`${currentAITeam} ${u.name} at (${u.col},${u.row}) processing turn - morale: ${u.morale}, moved: ${u.hasMoved}, acted: ${u.hasActed}`);

    // Small pause before the AI considers this unit
    await sleep(AI_ACTION_DELAY / 2);

    // Apply learned patterns to AI decision making
    let learnedAction = null;
    if (LEARNING_AI.enabled && LEARNING_AI.patterns.responses.size > 0) {
      learnedAction = findBestLearnedResponse(u, currentAITeam);
    }

    const enemies = units.filter(e => e.team !== currentAITeam && e.hp > 0);
    
    // Diplomacy-aware enemy filtering
    const diplomaticEnemies = enemies.filter(enemy => {
      // Check war declaration requirement first
      if (!canAttack(currentAITeam, enemy.team)) {
        // AI needs to declare war first
        const myPower = calculateFactionPower(currentAITeam);
        const enemyPower = calculateFactionPower(enemy.team);  
        const powerRatio = myPower / Math.max(enemyPower, 1);
        const personality = diplomacy.personalities[currentAITeam] ? AI_PERSONALITIES[diplomacy.personalities[currentAITeam]] : AI_PERSONALITIES.BALANCED;
        
        // AI declares war based on power and personality
        const trust = getTrust(currentAITeam, enemy.team);
        let warChance = 0;
        let powerThreshold = 2.0;
        
        switch (personality.type) {
          case 'AGGRESSIVE':
            // Warmongers declare war more easily
            powerThreshold = 1.3;
            warChance = Math.min(0.8, powerRatio * 0.4); // Up to 80% chance
            if (trust < 20) warChance += 0.2; // More likely if distrustful
            break;
            
          case 'DEFENSIVE':
            // Guardians only declare war when significantly threatened
            powerThreshold = 3.0;
            warChance = Math.min(0.3, (powerRatio - 2.0) * 0.2); // Conservative
            if (trust > 50) warChance *= 0.5; // Less likely against trusted factions
            break;
            
          case 'TRADER':
            // Merchant Princes consider economic factors
            powerThreshold = 2.5;
            warChance = Math.min(0.5, (powerRatio - 1.5) * 0.25);
            // More likely to attack if they need resources
            if (getResourceTotal(currentAITeam) < 3) warChance += 0.2;
            break;
            
          case 'IDEOLOGICAL':
            // Zealots declare war for principles, not just power
            powerThreshold = 1.8;
            warChance = Math.min(0.6, powerRatio * 0.3);
            if (trust < 30) warChance += 0.3; // Ideological enemies
            break;
            
          case 'BALANCED':
          default:
            // Diplomats use standard logic
            powerThreshold = 2.0;
            warChance = Math.min(0.4, (powerRatio - 1.5) * 0.2);
            break;
        }
        
        if (powerRatio > powerThreshold && Math.random() < warChance) {
          console.log(`${personality.name} AI (${currentAITeam}) declares war on ${enemy.team} - Power ratio: ${powerRatio.toFixed(2)}, War chance: ${warChance.toFixed(2)}`);
          declareWar(currentAITeam, enemy.team);
          return false; // Can't attack this turn, but will next turn
        }
        return false; // No war declaration, can't attack
      }
      
      // Check for non-aggression pacts (if war already declared, these are void)
      if (hasTreaty(currentAITeam, enemy.team, 'NON_AGGRESSION')) {
        // AI may still break treaty based on personality
        if (!evaluateDiplomaticAction(currentAITeam, enemy.team, 'BREAK_TREATY')) {
          return false; // Honor the treaty
        } else {
          // Break the treaty
          const treaty = diplomacy.treaties.find(t => 
            t.active && t.type === 'NON_AGGRESSION' &&
            t.participants.includes(currentAITeam) && t.participants.includes(enemy.team)
          );
          if (treaty) {
            breakTreaty(treaty, currentAITeam, 'Strategic opportunity');
          }
        }
      }
      
      // Consider trust levels in targeting priority
      const trust = getTrust(currentAITeam, enemy.team);
      if (trust > 30) {
        return Math.random() < 0.2; // Less likely to attack trusted factions
      }
      
      return true;
    });
    
    console.log(`${currentAITeam} detects ${enemies.length} potential enemies: ${enemies.map(e => `${e.name}[${e.team}]`).join(', ')}`);
    console.log(`${currentAITeam} will consider attacking ${diplomaticEnemies.length} targets after diplomacy filtering`);
    
    // AI can still move and capture settlements even without valid attack targets
    const hasValidTargets = diplomaticEnemies.length > 0;
    
    // PHASE 0: WATER UPGRADE - Check if unit should be upgraded to water unit
    if (!u.isWaterUnit && getGold(u.team) >= 2) {
      const shouldUpgrade = shouldAIUpgradeToWater(u, u.team);
      if (shouldUpgrade) {
        console.log(`AI upgrading ${u.name} to water unit for strategic advantage`);
        u.isWaterUnit = true;
        deductResources(u.team, { gold: 2 });
        
        // Update AI action timestamp and reset timeout
        aiLastActionTime = Date.now();
        startAITimeout();
        
        await sleep(AI_ACTION_DELAY);
      }
    }

    // Enhanced target selection based on strategy (even if just for positioning)
    let nearest = null;
    let minDist = 0;
    
    if (hasValidTargets) {
      const targetPriority = calculateTargetPriority(u, diplomaticEnemies, aiStrategicAnalysis);
      nearest = targetPriority.primaryTarget;
      minDist = manhattan(u.col, u.row, nearest.col, nearest.row);

      // PHASE 1: IMMEDIATE ATTACK - Attack first if any enemies in range, no questions asked
      const inRangeForImmediate = diplomaticEnemies.filter(e => manhattan(u.col, u.row, e.col, e.row) <= u.atkRange);
    if (inRangeForImmediate.length > 0 && !u.hasActed) {
      // Check if unit can attack from current terrain (swamp restriction)
      const attackerTerrainIdx = u.row * COLS + u.col;
      const attackerTerrain = terrain[attackerTerrainIdx];
      const canAttackFromTerrain = !(attackerTerrain === 'SWAMP' && TERRAIN.SWAMP.noAttack && u.name !== 'Assassin');
      
      if (canAttackFromTerrain) {
        // Always attack if enemies are in range - maximum aggression
        const target = selectBestTarget(u, inRangeForImmediate, aiStrategicAnalysis);
        console.log(`AI ${u.name} immediately attacks ${target.name} from current position`);
        const res = attackUnit(u, target) || {};
        u.hasActed = true;
        moraleCheck(u);
        moraleCheck(target);
      } else {
        console.log(`AI ${u.name} cannot attack from ${attackerTerrain} terrain (except Assassins)`);
        // Don't mark as acted so unit can try to move to better position
      }
      
      // Update AI action timestamp and reset timeout
      aiLastActionTime = Date.now();
      startAITimeout();
      
      await sleep(AI_ACTION_DELAY);
      
      // Knights get an extra attack if they score a kill (but only once per turn)
      if (u.name === 'Knight' && res.didKill && !u.usedBonusAttack) {
        u.hasActed = false; // allow another attack
        u.usedBonusAttack = true; // prevent further bonus attacks this turn
        console.log(`Knight ${u.name} gets bonus attack after kill!`);
      }
    }
    } // End of hasValidTargets conditional for immediate attack phase

    // PHASE 2: MOVEMENT DECISIONS - Now consider tactical positioning
    const friendlyUnits = units.filter(unit => unit.team === u.team);
    
    // SETTLEMENT EVACUATION: Move out healthy units from settlements if safe
    if (!u.hasMoved && u.hp >= u.maxHp * 0.8) { // At least 80% health
      const currentIdx = u.row * COLS + u.col;
      const currentSettlement = settlements[currentIdx];
      
      if (currentSettlement && currentSettlement.owner === u.team) {
        // Check if settlement could benefit from building a new unit
        const currentIncome = computeIncomeForTeam(u.team);
        const teamResources = resources[u.team] || { food: 0, gold: 0, materials: 0 };
        const totalResources = (teamResources.food || 0) + (teamResources.gold || 0) + (teamResources.materials || 0);
        const canAffordUnit = totalResources >= 3; // Can afford basic units
        
        // Check for immediate threats only (within striking distance)
        let immediateThreats = 0;
        for (const enemy of enemies) {
          const distToSettlement = manhattan(enemy.col, enemy.row, u.col, u.row);
          // Only consider enemies that can attack THIS turn
          if (distToSettlement <= enemy.atkRange && !enemy.hasActed) {
            immediateThreats++;
          }
          // Or enemies very close that could reach next turn
          else if (distToSettlement <= enemy.move + 1) {
            immediateThreats++;
          }
        }
        
        // Evacuate if: (1) we can afford to build AND (2) no immediate threats AND (3) strategic value
        const shouldEvacuate = canAffordUnit && immediateThreats === 0;
        
        if (shouldEvacuate) {
          // Find a good position to move to that's not another occupied settlement
          let bestEvacSpot = null;
          let bestEvacScore = -Infinity;
          
          for (let dr = -u.move; dr <= u.move; dr++) {
            for (let dc = -u.move; dc <= u.move; dc++) {
              if (dr === 0 && dc === 0) continue; // Don't stay in same spot
              const newRow = u.row + dr;
              const newCol = u.col + dc;
              
              if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) continue;
              if (manhattan(u.col, u.row, newCol, newRow) > u.move) continue;
              if (getUnitAt(newCol, newRow)) continue; // Occupied
              if (!canMoveTo(u, newCol, newRow)) continue; // No clear path
              
              let score = 0;
              const newIdx = newRow * COLS + newCol;
              
              // Prefer moving toward strategic objectives
              const closestEnemy = enemies.reduce((closest, enemy) => {
                const dist = manhattan(newCol, newRow, enemy.col, enemy.row);
                return !closest || dist < closest.dist ? {enemy, dist} : closest;
              }, null);
              
              if (closestEnemy) {
                // Move toward enemies but not too close (optimal attack range)
                const optimalDist = Math.max(u.atkRange, 3); // Stay at attack range or 3 tiles away
                const distDiff = Math.abs(closestEnemy.dist - optimalDist);
                score += (5 - distDiff) * 15; // Higher score for optimal positioning
              }
              
              // Look for neutral/enemy settlements to capture
              const targetSettlement = settlements[newIdx];
              if (targetSettlement && targetSettlement.owner !== u.team) {
                score += 50; // High priority for capturing settlements
              }
              
              // Bonus for terrain advantages
              if (terrain[newIdx] === 'WOODS') score += 25;
              else if (terrain[newIdx] === 'MOUNTAIN') score += 35;
              
              // Moderate penalty for moving too far (allow aggressive advancement)
              const distFromSettlement = manhattan(newCol, newRow, u.col, u.row);
              score -= distFromSettlement * 3; // Reduced penalty to encourage movement
              
              if (score > bestEvacScore) {
                bestEvacScore = score;
                bestEvacSpot = {col: newCol, row: newRow};
              }
            }
          }
          
          if (bestEvacSpot) {
            console.log(`AI STRATEGIC EVACUATION: ${u.name} leaving ${currentSettlement.type} at [${u.col},${u.row}] → [${bestEvacSpot.col},${bestEvacSpot.row}] (score: ${bestEvacScore}) - Settlement freed for building, ${immediateThreats} immediate threats`);
            u.col = bestEvacSpot.col;
            u.row = bestEvacSpot.row;
            checkSettlementCaptureAfterMove(u, u.col, u.row); // Claim new position if it's a settlement
            u.hasMoved = true;
            
            // Update AI action timestamp and reset timeout
            aiLastActionTime = Date.now();
            startAITimeout();
            
            await sleep(AI_ACTION_DELAY);
            continue; // Skip to next unit
          }
        }
      }
    }
    
    if (!u.hasMoved && shouldRetreat(u, enemies, aiStrategicAnalysis)) {
      const retreatSpot = findSafeRetreatPosition(u, enemies, friendlyUnits);
      if (retreatSpot && manhattan(u.col, u.row, retreatSpot.col, retreatSpot.row) <= u.move) {
        console.log(`AI unit ${u.name} executing strategic retreat to [${retreatSpot.col}, ${retreatSpot.row}] (Safety score: ${retreatSpot.safetyScore})`);
        u.col = retreatSpot.col;
        u.row = retreatSpot.row;
        checkSettlementCaptureAfterMove(u, u.col, u.row);
        u.hasMoved = true;
        
        // Update AI action timestamp and reset timeout
        aiLastActionTime = Date.now();
        startAITimeout();
        
        await sleep(AI_ACTION_DELAY);
        continue; // Skip to next unit
      }
    }
    
    // If didn't retreat and hasn't moved, try to claim nearby settlements
    if (!u.hasMoved) {
      // Look for unclaimed or enemy settlements to capture  
      const claimableSettlement = findNearestClaimableSettlement(u, u.team);
      console.log(`AI ${u.name} looking for claimable settlements:`, claimableSettlement ? `Found at [${claimableSettlement.col}, ${claimableSettlement.row}] owner: ${claimableSettlement.settlement.owner}` : 'None found');
      
      if (claimableSettlement && manhattan(u.col, u.row, claimableSettlement.col, claimableSettlement.row) <= u.move) {
        // Only claim if it's safer than attacking or if no enemies in immediate range
        const enemiesNearSettlement = diplomaticEnemies.filter(e => 
          manhattan(e.col, e.row, claimableSettlement.col, claimableSettlement.row) <= 2
        );
        
        // Claim if: no enemies near settlement, OR settlement is neutral (safe to claim), OR we outnumber nearby enemies
        const shouldClaim = enemiesNearSettlement.length === 0 || 
                           !claimableSettlement.settlement.owner || 
                           minDist > u.atkRange;
        
        if (shouldClaim) {
          console.log(`AI unit ${u.name} claiming settlement at [${claimableSettlement.col}, ${claimableSettlement.row}] (was owned by: ${claimableSettlement.settlement.owner || 'neutral'})`);
          u.col = claimableSettlement.col;
          u.row = claimableSettlement.row;
          checkSettlementCaptureAfterMove(u, u.col, u.row);
          u.hasMoved = true;
          
          // Update AI action timestamp and reset timeout
          aiLastActionTime = Date.now();
          startAITimeout();
          
          await sleep(AI_ACTION_DELAY);
        }
      } else {
        // Second priority: AGGRESSIVE PURSUIT for healthy units (>50% HP)
        const healthPct = u.hp / u.maxHp;
        const currentTerrain = terrain[u.row * COLS + u.col];
        const isInSwamp = currentTerrain === 'SWAMP';
        
        if (healthPct > 0.5 || isInSwamp) {
          // WAR-PRIORITY TARGETING: Prioritize enemies we're officially at war with
          let nearestEnemy = null;
          let nearestDist = Infinity;
          
          // First pass: Look for war targets
          const warEnemies = diplomaticEnemies.filter(enemy => isAtWar(currentAITeam, enemy.team));
          
          if (warEnemies.length > 0) {
            console.log(`${currentAITeam} ${u.name} prioritizing war targets: ${warEnemies.map(e => e.team).join(', ')}`);
            for (const enemy of warEnemies) {
              const dist = manhattan(u.col, u.row, enemy.col, enemy.row);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
              }
            }
          } else {
            // Second pass: Regular enemy targeting if no war targets
            for (const enemy of diplomaticEnemies) {
              const dist = manhattan(u.col, u.row, enemy.col, enemy.row);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
              }
            }
          }
          
          if (nearestEnemy) {
            const pursuitMove = findAggressivePursuitMove(u, nearestEnemy, isInSwamp);
            // War bonus: AI units get +1 movement when pursuing war targets
            const isWarTarget = isAtWar(currentAITeam, nearestEnemy.team);
            const effectiveMove = isWarTarget ? u.move + 1 : u.move;
            
            if (pursuitMove && manhattan(u.col, u.row, pursuitMove.col, pursuitMove.row) <= effectiveMove) {
              u.col = pursuitMove.col;
              u.row = pursuitMove.row;
              checkSettlementCaptureAfterMove(u, u.col, u.row);
              minDist = manhattan(u.col, u.row, nearestEnemy.col, nearestEnemy.row);
              u.hasMoved = true;
              const warStatus = isWarTarget ? " (WAR TARGET)" : "";
              console.log(`AI ${u.name} aggressively pursuing ${nearestEnemy.name}[${nearestEnemy.team}]${warStatus} to [${u.col}, ${u.row}]`);
              
              // Update AI action timestamp and reset timeout
              aiLastActionTime = Date.now();
              startAITimeout();
              
              await sleep(AI_ACTION_DELAY);
            } else {
              // Fallback: tactical move if aggressive pursuit fails
              const tacticalMove = findBestTerrainMove(u, enemies);
              if (tacticalMove && manhattan(u.col, u.row, tacticalMove.col, tacticalMove.row) <= u.move) {
                u.col = tacticalMove.col;
                u.row = tacticalMove.row;
                checkSettlementCaptureAfterMove(u, u.col, u.row);
                minDist = manhattan(u.col, u.row, nearestEnemy.col, nearestEnemy.row);
                u.hasMoved = true;
                console.log(`AI ${u.name} made tactical move to [${u.col}, ${u.row}]`);
                
                // Update AI action timestamp and reset timeout
                aiLastActionTime = Date.now();
                startAITimeout();
                
                await sleep(AI_ACTION_DELAY);
              }
            }
          }
        } else {
          // Weak units use defensive tactical moves
          const tacticalMove = findBestTerrainMove(u, enemies);
          if (tacticalMove && manhattan(u.col, u.row, tacticalMove.col, tacticalMove.row) <= u.move) {
            u.col = tacticalMove.col;
            u.row = tacticalMove.row;
            checkSettlementCaptureAfterMove(u, u.col, u.row);
            if (nearest) minDist = manhattan(u.col, u.row, nearest.col, nearest.row);
            u.hasMoved = true;
            console.log(`AI ${u.name} made defensive tactical move to [${u.col}, ${u.row}]`);
            
            // Update AI action timestamp and reset timeout
            aiLastActionTime = Date.now();
            startAITimeout();
            
            await sleep(AI_ACTION_DELAY);
          }
        }
        
        if (!u.hasMoved) {
          // Third priority: Try formation movement with allied units
          const friendlyUnits = units.filter(unit => unit.team === u.team);
          const formationMove = findFormationMove(u, friendlyUnits, aiStrategicAnalysis);
          
          if (formationMove && manhattan(u.col, u.row, formationMove.col, formationMove.row) <= u.move) {
            u.col = formationMove.col;
            u.row = formationMove.row;
            checkSettlementCaptureAfterMove(u, u.col, u.row);
            if (nearest) minDist = manhattan(u.col, u.row, nearest.col, nearest.row);
            u.hasMoved = true;
            console.log(`AI ${u.name} moved for formation support to [${u.col}, ${u.row}]`);
            
            // Update AI action timestamp and reset timeout
            aiLastActionTime = Date.now();
            startAITimeout();
            
            await sleep(AI_ACTION_DELAY);
          } else {
            // Fourth priority: Aggressive advance toward nearest enemy
            const advanceMove = findBestAdvanceMove(u, enemies);
            if (advanceMove && manhattan(u.col, u.row, advanceMove.col, advanceMove.row) <= u.move) {
              u.col = advanceMove.col;
              u.row = advanceMove.row;
              checkSettlementCaptureAfterMove(u, u.col, u.row);
              u.hasMoved = true;
              console.log(`AI ${u.name} advances toward enemy to [${u.col}, ${u.row}]`);
              
              // Update AI action timestamp and reset timeout
              aiLastActionTime = Date.now();
              startAITimeout();
              
              await sleep(AI_ACTION_DELAY);
            } else {
              // Final fallback: mark as moved even if no good move found
              u.hasMoved = true;
              console.log(`AI ${u.name} finds no good moves, staying put`);
            }
          }
      }
    }

    // Cleric healing logic - heal ALL wounded allies in range
    if (u.name === 'Cleric' && !u.hasActed) {
      const friendlyUnits = units.filter(ally => 
        ally.team === u.team && 
        ally.hp > 0 && 
        ally.hp < ally.maxHp && 
        ally !== u && // Don't try to heal self
        manhattan(u.col, u.row, ally.col, ally.row) <= u.atkRange
      );
      
      if (friendlyUnits.length > 0) {
        // Sort by lowest health percentage first (most critical patients)
        friendlyUnits.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
        
        console.log(`AI Cleric ${u.name} found ${friendlyUnits.length} wounded allies to heal`);
        
        // Heal ALL wounded units in range, not just one
        for (const targetToHeal of friendlyUnits) {
          console.log(`AI Cleric ${u.name} healing ${targetToHeal.name} (${targetToHeal.hp}/${targetToHeal.maxHp} HP)`);
          healUnit(u, targetToHeal);
          
          // Update AI action timestamp and reset timeout
          aiLastActionTime = Date.now();
          startAITimeout();
          
          await sleep(AI_ACTION_DELAY / 2); // Shorter delay between multiple heals
        }
        
        u.hasActed = true;
      } else {
        // No units to heal - mark as acted so Cleric doesn't get stuck
        console.log(`AI Cleric ${u.name} has no units to heal in range`);
        u.hasActed = true;
      }
    }

    // PHASE 3: POST-MOVEMENT ATTACK - Check for enemies in range after moving (only if we have valid targets)
    if (hasValidTargets) {
      const inRangeAfterMove = diplomaticEnemies.filter(e => manhattan(u.col, u.row, e.col, e.row) <= u.atkRange);
      if (inRangeAfterMove.length > 0 && !u.hasActed) {
      // Check if unit can attack from current terrain (swamp restriction)
      const attackerTerrainIdx = u.row * COLS + u.col;
      const attackerTerrain = terrain[attackerTerrainIdx];
      const canAttackFromTerrain = !(attackerTerrain === 'SWAMP' && TERRAIN.SWAMP.noAttack && u.name !== 'Assassin');
      
      if (canAttackFromTerrain) {
        // Attack any enemies in range after movement - still aggressive but after positioning
        const target = selectBestTarget(u, inRangeAfterMove, aiStrategicAnalysis);
        console.log(`AI ${u.name} attacks ${target.name} after repositioning`);
        const res = attackUnit(u, target) || {};
        u.hasActed = true;
        moraleCheck(u);
        moraleCheck(target);
      } else {
        console.log(`AI ${u.name} cannot attack from ${attackerTerrain} terrain after moving (except Assassins)`);
        u.hasActed = true; // Mark as acted since movement is done
      }
      
      // Update AI action timestamp and reset timeout
      aiLastActionTime = Date.now();
      startAITimeout();
      
      await sleep(AI_ACTION_DELAY);
      
      // Knights get an extra attack if they score a kill (but only once per turn)
      if (u.name === 'Knight' && res.didKill && !u.usedBonusAttack) {
        u.hasActed = false; // allow another attack
        u.usedBonusAttack = true; // prevent further bonus attacks this turn
        console.log(`Knight ${u.name} gets bonus attack after kill!`);
      }
      }
    } // End of hasValidTargets conditional

      // small pause between processing units so actions are readable
      await sleep(AI_ACTION_DELAY / 2);
    }
  } // End of else block for AI units that can act

  // AI building logic: AFTER unit actions so settlements are freed up
  // for each AI-controlled team, try to build up to a small cap
  // at settlements it owns. Pick the most expensive affordable unit allowed by the
  // settlement type. Spawned units are marked as having moved/acted so they can't
  // act the same turn.
  const aiTeams = getActiveTeams().filter(team => isAITeam(team));
  try {
    const buildsByTeam = {};
    for (const team of aiTeams) buildsByTeam[team] = 0;

    for (let idx = 0; idx < settlements.length; idx++) {
      const s = settlements[idx];
      if (!s || !aiTeams.includes(s.owner)) continue;
      const row = Math.floor(idx / COLS);
      const col = idx % COLS;
      // skip if tile already occupied
      if (getUnitAt(col, row)) {
        console.log(`AI settlement at [${col},${row}] occupied - cannot build here yet`);
        continue;
      }
      const team = s.owner;
      // Dynamic build limit based on war status
      const isAtWarWithAnyone = getActiveTeams().some(otherTeam => 
        otherTeam !== team && isAtWar(team, otherTeam)
      );
      const perTeamBuildLimit = isAtWarWithAnyone ? 8 : 5; // Build more units when at war
      
      if (buildsByTeam[team] >= perTeamBuildLimit) continue;
      
      // Debug: Show settlement and resources
      console.log(`AI checking settlement at [${col},${row}]: ${s.type}, owner: ${s.owner}, resources: ${resources[team]}`);
      
      // find affordable units allowed at this settlement (with research requirements)
      const allAllowed = allowedUnitsForSettlement(s.type, team);
      const affordable = allAllowed.filter(n => canAfford(team, UNIT_TEMPLATES[n].cost));
      console.log(`Settlement ${s.type}: All allowed: ${allAllowed.join(', ')}, Can afford: ${affordable.join(', ')}`);
      const allowed = affordable;
      if (allowed.length === 0) {
        console.log(`${team} cannot build at ${s.type} settlement - no researched & affordable units available`);
        continue;
      }
      
      // ANTI-STOCKPILING LOGIC: More aggressive resource spending
      const currentIncome = computeIncomeForTeam(team);
      const currentResources = resources[team] || { food: 0, gold: 0, materials: 0 };
      const totalResources = (currentResources.food || 0) + (currentResources.gold || 0) + (currentResources.materials || 0);
      const totalIncome = (currentIncome.food || 0) + (currentIncome.gold || 0) + (currentIncome.materials || 0);
      
      const myUnits = units.filter(u => u.team === team && u.hp > 0);
      const enemies = units.filter(u => u.team !== team && u.hp > 0);
      
      // AI should build if it has significant resources to prevent stockpiling
      const isStockpiling = totalResources >= Math.max(8, totalIncome * 2); // Threshold for "too many resources"
      const needsMoreUnits = myUnits.length <= enemies.length + 1;
      const hasBasicResources = totalResources >= 2; // Can afford basic units
      
      const shouldBuild = isStockpiling || needsMoreUnits || (hasBasicResources && Math.random() < 0.7);
      
      if (!shouldBuild) {
        console.log(`AI ${team} skipping build at settlement - ${myUnits.length} units vs ${enemies.length} enemies, ${totalResources} resources, stockpiling: ${isStockpiling}`);
        continue;
      } else {
        console.log(`AI ${team} proceeding with build - ${myUnits.length} units vs ${enemies.length} enemies, ${totalResources} resources, stockpiling prevention: ${isStockpiling}`);
      }
      
      // Check if we have wounded units that could benefit from healing
      const woundedAllies = units.filter(u => u.team === team && u.hp > 0 && u.hp < u.maxHp);
      const hasCleric = units.some(u => u.team === team && u.name === 'Cleric' && u.hp > 0);
      
      let pick = selectBestUnitForSituation(team, allowed, woundedAllies, hasCleric, s, col, row);
      const cost = UNIT_TEMPLATES[pick].cost;
      // Deduct cost and create unit without triggering UI alerts
      deductResources(team, cost);
      const u = makeUnit(pick, team, col, row, { maxHp: UNIT_TEMPLATES[pick].hp, atkRange: UNIT_TEMPLATES[pick].atkRange, dmg: UNIT_TEMPLATES[pick].dmg, cost, justSpawned: true });
      units.push(u);
      buildsByTeam[team]++;
      console.log('AI auto-built', pick, 'for', team, 'at', col, row, 'cost', cost);
      
      // Update AI action timestamp and reset timeout
      aiLastActionTime = Date.now();
      startAITimeout();
      // If we've reached limits for all AI teams, stop early
      // Check each team's specific war-based build limit
      const allTeamsAtLimit = aiTeams.every(team => {
        const isAtWarWithAnyone = getActiveTeams().some(otherTeam => 
          otherTeam !== team && isAtWar(team, otherTeam)
        );
        const teamBuildLimit = isAtWarWithAnyone ? 8 : 5;
        return buildsByTeam[team] >= teamBuildLimit;
      });
      if (allTeamsAtLimit) break;
    }
    // Persist and reflect any resource/unit changes
    updateUI();
    try{ postGameState(); } catch(e){}
  } catch(e) { console.warn('AI build logic error', e); }

  // FORTRESS BUILDING LOGIC: If AI has surplus resources but can't build units, build fortresses
  try {
    for (const team of aiTeams) {
      const currentResources = resources[team] || { food: 0, gold: 0, materials: 0 };
      const totalResources = (currentResources.food || 0) + (currentResources.gold || 0) + (currentResources.materials || 0);
      
      // Only build fortresses if AI has significant surplus (stockpiling)
      if (totalResources >= 12) { // High threshold for fortress building
        console.log(`AI ${team} considering fortress building with ${totalResources} resources`);
        
        // Find empty tiles adjacent to friendly units or settlements for fortress placement
        const myUnits = units.filter(u => u.team === team && u.hp > 0);
        const mySettlements = [];
        settlements.forEach((s, idx) => {
          if (s && s.owner === team) {
            mySettlements.push({ col: idx % COLS, row: Math.floor(idx / COLS) });
          }
        });
        
        let fortressBuilt = false;
        
        // Try to build fortress near strategic locations
        for (const unit of myUnits) {
          if (fortressBuilt) break;
          
          // Check adjacent tiles to units
          for (const tile of getAdjacentCoords(unit.col, unit.row, true)) {
              if (fortressBuilt) break;
              const newRow = tile.row;
              const newCol = tile.col;
              if (getUnitAt(newCol, newRow)) continue;
              if (terrain[newRow * COLS + newCol]) continue;
              if (settlements[newRow * COLS + newCol]) continue;
              
              // Try to build best affordable fortress
              const fortressTypes = ['Heavy Fortress', 'Castle', 'Stockade'];
              for (const fortType of fortressTypes) {
                const template = UNIT_TEMPLATES[fortType];
                if (template && canAfford(team, template.cost)) {
                  console.log(`AI ${team} building ${fortType} at [${newCol},${newRow}] to use surplus resources`);
                  deductResources(team, template.cost);
                  const fortress = makeUnit(fortType, team, newCol, newRow, { 
                    maxHp: template.hp, 
                    atkRange: template.atkRange, 
                    dmg: template.dmg, 
                    cost: template.cost,
                    justSpawned: true
                  });
                  units.push(fortress);
                  fortressBuilt = true;
                  break;
                }
              }
          }
        }
      }
    }
  } catch(e) { console.warn('AI fortress building error', e); }

  // --- PROPER TURN TRANSITION LOGIC ---
  // Use the standard endTurn() function to properly cycle through all teams
  
  console.log(`${aiTeam} turn completed, calling endTurn() to cycle to next team`);
  clearTimeout(aiTurnTimeoutId); // Clear timeout since turn is ending normally
  selectedUnit = null;
  
  // Call the standard endTurn function which handles:
  // - Morale recovery and healing for current team
  // - Turn cycling through all active teams  
  // - Income granting for next team
  // - Resetting action flags for next team
  // - Auto-flee for next team
  // - Checking for AI turns
  endTurn();
}

/**
 * Handles AI turn timeout - called when no AI action has been taken for 3 seconds
 * Immediately ends the AI turn and switches to player turn
 */
function endAITurnDueToTimeout() {
  console.log(`Ending ${currentTeam} turn due to timeout - no action for 1 second`);
  
  if (!isAITeam(currentTeam)) {
    console.log('Not an AI team turn anymore, ignoring timeout');
    return;
  }
  
  // Clear the timeout to prevent multiple calls
  clearTimeout(aiTurnTimeoutId);
  aiTurnTimeoutId = null;
  
  console.log(`${currentTeam} turn timeout - calling endTurn() to cycle to next team`);
  selectedUnit = null;
  
  // Use the standard endTurn function for proper turn cycling
  endTurn();
}
}

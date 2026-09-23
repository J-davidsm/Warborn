// Warborn source split from the original game.js.
// Section: js/systems/combat-turns.js

function hasCrownAura(unit) {
  return units.some(c=>c!==unit&&c.name==='Crown'&&c.hp>0&&areFriendlyTeams(c.team,unit.team)&&manhattan(c.col,c.row,unit.col,unit.row)===1);
}
function applyCrownDeath(crown) {
  if(crown.name!=='Crown'||crown.hp>0)return;
  const fallen=currentVictoryCondition.crownFallenTeams ||= [];
  if(fallen.includes(crown.team))return;
  fallen.push(crown.team);
  if(isAITeam(crown.team)){
    for(const u of units)if(u.team===crown.team&&u.name!=='Dragon')u.morale=0;
  }else{
    gameOver=true;
    checkEndGame();
  }
}
function attackUnit(a, d) {
  if(!a||!d||areFriendlyTeams(a.team,d.team))return {blocked:true};
  if(a.name==='Crown')return {blocked:true,reason:'The Crown cannot attack'};
  // Safety check: prevent units that have already acted from attacking
  if (a.hasActed && !(a.name === 'Knight' && !a.usedBonusAttack)) {
    console.log(`DEBUG: Attack blocked - ${a.name} has already acted this turn (hasActed: ${a.hasActed}, usedBonusAttack: ${a.usedBonusAttack})`);
    return { blocked: true, reason: 'Unit has already acted' };
  }
  
  // Check war declaration requirement (only in multi-player diplomatic games)
  if (isDiplomacyActive() && diplomacy.warDeclarations && diplomacy.trust[a.team] && diplomacy.trust[a.team][d.team] !== undefined) {
    if (!canAttack(a.team, d.team)) {
      console.log(`${a.team} cannot attack ${d.team} - no valid war declaration`);
      if (a.team === 'PLAYER') {
        showPopup('War Declaration Required', `You must declare war on ${d.team} before attacking! Use the diplomacy menu to declare war (attacks possible next turn).`, 'error');
      }
      return { blocked: true };
    }
  }

  // Preserve attacker's original state to prevent position changes during combat
  const origCol = a.col, origRow = a.row;
  const origHasMoved = !!a.hasMoved;
  const origHasActed = !!a.hasActed;
  
  // Start with base damage from unit stats
  let dmg = a.dmg;
  if(hasCrownAura(a))dmg*=1.10;
  if(a.name==='Assassin'&&d.name==='Crown')dmg*=2;

  // Calculate health percentage (0-1)
  const healthPct = a.hp / a.maxHp;

  // Scale damage by health percentage, but never below 40%
  let healthMod = max(healthPct, 0.4);
  dmg = floor(dmg * healthMod);

  // Apply morale modifiers (Dragon is immune to being scared; its morale stays high)
  if(a.name !== 'Dragon'){
    if(a.morale <= 30) dmg = floor(dmg * 0.6);
    if(a.morale >= 120) dmg = floor(dmg * 1.4);
  } else {
    // Dragons always have top morale
    a.morale = 150;
  }

  // Knight vs Dragon: Knights do double damage against Dragons
  if (a.name === 'Knight' && d.name === 'Dragon') {
    dmg = floor(dmg * 2);
  }

  // Dragon defensive mechanics: 20% reduction against all units except special cases
  if (d.name === 'Dragon') {
    if (a.name === 'Archer') {
      // Archers do 10% extra damage to Dragons
      dmg = floor(dmg * 1.1);
    } else if (a.name === 'Catapult') {
      // Catapults do only 50% damage to Dragons
      dmg = floor(dmg * 0.5);
    } else if (a.name !== 'Knight') {
      // All other units (except Knights, which already got their bonus) do 20% less damage
      dmg = floor(dmg * 0.8);
    }
  }

  // Apply spearman adjacency defense reduction for defender if applicable
  const isSpearmanDefender = d.name === 'Spearman';
  if (isSpearmanDefender) {
    // Check if adjacent friendly spearman exists
    const hasAdjacentAllySpearman = !!units.find(u => u !== d && u.team === d.team && u.name === 'Spearman' && manhattan(u.col, u.row, d.col, d.row) === 1);
    if (hasAdjacentAllySpearman) {
      // Apply 30% damage reduction (take only 70%)
      dmg = floor(dmg * 0.7);
    }
  }

  // Special terrain bonuses: Assassins deal double damage to units in swamps and woods
  const defenderTerrainIdx = d.row * COLS + d.col;
  const defenderTerrain = terrain[defenderTerrainIdx];
  if (a.name === 'Assassin' && ((defenderTerrain === 'SWAMP' && TERRAIN.SWAMP.assassinBonus) || 
                                (defenderTerrain === 'WOODS' && TERRAIN.WOODS.assassinBonus))) {
    dmg = dmg * 2; // Double damage for assassins attacking units in swamps or woods
  }
  
  // Knight penalty: Knights deal only 75% damage when attacking from woods
  const attackerTerrainIdx = a.row * COLS + a.col;
  const attackerTerrain = terrain[attackerTerrainIdx];
  if (a.name === 'Knight' && attackerTerrain === 'WOODS' && TERRAIN.WOODS.knightPenalty) {
    dmg = floor(dmg * 0.75); // Knights deal 75% damage when attacking from woods
  }
  
  // Apply terrain and settlement defense modifiers
  let defenseModifier = getDefenseModifiers(a, d);
  // Catapults ignore settlement defenses and fortresses' damage reduction
  const defenderIdx = d.row * COLS + d.col;
  const defenderSettlement = settlements[defenderIdx];
  if (a.name === 'Catapult') {
    // Ignore settlement defense entirely
    defenseModifier = 0;
  }
  if (defenseModifier !== 0) {
    dmg = floor(dmg * (1 - defenseModifier));
  }

  // Apply terrain damage multipliers (like bridge 1.1x damage)
  const terrainMultiplier = getTerrainDamageMultiplier(d);
  if (terrainMultiplier !== 1.0) {
    dmg = floor(dmg * terrainMultiplier);
  }

  // Fortress special: certain fortress types reduce incoming damage (unless attacker is a Catapult)
  if (isFortressUnit(d) && a.name !== 'Catapult') {
    const props = getFortressPropsByName(d.name);
    const reduction = props && props.damageReduction ? props.damageReduction : 0;
    if (reduction > 0) {
      dmg = floor(dmg * (1 - reduction));
    }
  }

  // Store target's previous HP to check for kill
  if(hasCrownAura(d))dmg=floor(dmg*0.75);
  const prevHP = d.hp;

  try{ console.debug('attackUnit - pre-damage', { attacker: { id: a.id, col: a.col, row: a.row, hp: a.hp }, defender: { id: d.id, col: d.col, row: d.row, hp: d.hp } }); } catch(e){}

  // Apply damage
  d.hp -= dmg;
  try { SoundManager.playAttack(a.name); } catch (e) {}
  
  try{ console.debug('attackUnit - after damage', { dmg, defenderHP: d.hp, defenderId: d.id }); } catch(e){}
  // Create a floating damage popup for visual feedback when damage occurs
  if (dmg > 0) {
    try {
      ActionEffects.damage(d.col,d.row,dmg);
    } catch (e) { /* ignore popup errors */ }
  }
  // Assassin special: if attacker is Assassin and target is NOT an Assassin, target morale falls to 0 instantly
  // Dragons are immune to morale drops
  if (d.name !== 'Dragon') {
    if (a.name === 'Assassin' && d.name !== 'Assassin') {
      d.morale = 0;
    } else {
      d.morale -= 15;
    }
  }
  if(d.hp < 0) d.hp = 0;

  // If defender is a Fortress and still alive, it retaliates immediately.
  // Ensure fortresses always retaliate out to at least 2 tiles (two spaces away).
  const FORTRESS_MIN_RETALIATE = 2;
  const fortRetRange = Math.max(FORTRESS_MIN_RETALIATE, (d.atkRange || 0));
  if (isFortressUnit(d) && d.hp > 0 && a.hp > 0 && manhattan(d.col, d.row, a.col, a.row) <= fortRetRange) {
    // Calculate counter damage from fortress: scale by fortress health (with same 40% floor)
    let counterDmg = d.dmg;
    const fortHealthPct = max(d.hp / d.maxHp, 0.4);
    counterDmg = floor(counterDmg * fortHealthPct);
    // Apply defender morale modifiers to counter (treat fortress as non-dragon)
    if (d.morale <= 30) counterDmg = floor(counterDmg * 0.6);
    if (d.morale >= 120) counterDmg = floor(counterDmg * 1.4);
    // Apply terrain/settlement defense for the attacker being on their tile
    const atkDefenseForAttacker = getDefenseModifiers(d, a);
    if (atkDefenseForAttacker !== 0) counterDmg = floor(counterDmg * (1 - atkDefenseForAttacker));
    // Apply spearman adjacency reduction if attacker is a Spearman with ally shield (defensive)
    if (a.name === 'Spearman') {
      const hasAdjacentAllySpearman = !!units.find(u => u !== a && u.team === a.team && u.name === 'Spearman' && manhattan(u.col, u.row, a.col, a.row) === 1);
      if (hasAdjacentAllySpearman) counterDmg = floor(counterDmg * 0.7);
    }
  // Subtract counter damage from attacker
  if(hasCrownAura(d))counterDmg=floor(counterDmg*1.10);
  if(hasCrownAura(a))counterDmg=floor(counterDmg*0.75);
  a.hp -= counterDmg;
  if (a.hp < 0) a.hp = 0;
  // Attacker morale penalty from being hit (Dragons are immune)
  if (a.name !== 'Dragon') a.morale -= 15;
    // If counter killed the attacker, boost fortress morale
    if (a.hp === 0) {
      d.morale = min(150, d.morale + 50);
    }
  }

  // Boost morale if unit got a kill (target went from >0 to 0 HP)
  let didKill = false;
  if(prevHP > 0 && d.hp === 0) {
    didKill = true;
    a.morale = min(150, a.morale + 50); // Add 50 morale, capped at 150
    
    // Award experience for kill
    awardExperience(a, EXPERIENCE_GAINS.KILL_UNIT, 'unit kill');
    
    // Trigger AI messages for unit death
    if (a.team === 'PLAYER' && isAITeam(d.team)) {
      // Player killed AI unit
      const messages = [
        `You will pay for spilling our blood! This act of aggression demands vengeance!`,
        `Our fallen warrior's sacrifice will not be forgotten. Prepare for retribution.`,
        `Your victory today breeds tomorrow's conflict. We will not forget this.`
      ];
      addAIMessage(d.team, messages[Math.floor(Math.random() * messages.length)], 'UNIT_KILLED');
    } else if (isAITeam(a.team) && d.team === 'PLAYER') {
      // AI killed player unit
      const messages = [
        `Your forces crumble before our superior tactics!`,
        `Another of your warriors falls. Your defeat approaches.`,
        `Our strength grows while yours diminishes. Submit now or suffer more.`
      ];
      addAIMessage(a.team, messages[Math.floor(Math.random() * messages.length)], 'UNIT_VICTORY');
    }
  }
  // Remove dead units entirely from the units array so their object references
  // don't linger and inadvertently affect other units. After rebuilding the
  // array, restore the attacker's coordinates by locating it by id so we handle
  // cases where object identity changed.
  applyCrownDeath(d);
  applyCrownDeath(a);
  const beforeCount = units.length;
  const attackerId = a.id;
  try{ console.debug('attackUnit - about to rebuild units array. beforeCount=', beforeCount, 'attackerId=', attackerId); } catch(e){}
  units = units.filter(u => u.hp > 0);
  try{ console.debug('attackUnit - after rebuild units length=', units.length, 'expect attackerId present?', !!units.find(u=>u.id===attackerId)); } catch(e){}
  // Find attacker in the new units array by id and restore coords
  const attackerNow = units.find(u => u.id === attackerId);
  if (attackerNow) {
    try{ console.debug('attackUnit - attackerNow BEFORE restore', { id: attackerNow.id, col: attackerNow.col, row: attackerNow.row, hasMoved: attackerNow.hasMoved, hasActed: attackerNow.hasActed }); } catch(e){}
    attackerNow.col = origCol;
    attackerNow.row = origRow;
    // Restore movement flag but ensure unit is marked as having acted after attack
    attackerNow.hasMoved = origHasMoved;
    // Always mark as acted after attacking (Knight bonus attacks are handled by caller)
    attackerNow.hasActed = true;
    try{ console.debug('attackUnit - attackerNow AFTER restore', { id: attackerNow.id, col: attackerNow.col, row: attackerNow.row, hasMoved: attackerNow.hasMoved, hasActed: attackerNow.hasActed }); } catch(e){}
    // If the local selectedUnit was pointing to an old object, reassign it to the refreshed one
    try { if (selectedUnit && selectedUnit.id === attackerId) selectedUnit = attackerNow; } catch(e){}
  }
  // If selection referenced a now-dead unit, clear selection
  if (units.length !== beforeCount) {
    if (selectedUnit && selectedUnit.hp <= 0) selectedUnit = null;
    updateUI();
  }
  
  // Diplomatic consequences of combat
  if (diplomacy && diplomacy.trust && a.team !== d.team) {
    // Attacking reduces trust between factions
    modifyTrust(a.team, d.team, -5, `${a.team} attacked ${d.team}`);
    
    // Killing units has more severe diplomatic consequences
    if (didKill) {
      modifyTrust(a.team, d.team, -10, `${a.team} killed ${d.team} unit`);
      modifyReputation(a.team, -2, `Killed ${d.team} unit`);
      
      // Other factions may view the killing negatively
      getActiveTeams().forEach(observer => {
        if (observer !== a.team && observer !== d.team) {
          const observerTrust = getTrust(observer, a.team);
          if (observerTrust > 0) {
            modifyTrust(observer, a.team, -3, `Witnessed ${a.team} kill ${d.team} unit`);
          }
        }
      });
    }
  }
  
  try{ postGameState(); } catch(e){}
  return { didKill };
}

// Healing function for Clerics, Boost unit by 50 morale and 20 health.
function healUnit(healer, target) {
  if (!healer || !target || !areFriendlyTeams(healer.team,target.team)) return { didHeal: false };
  if (target.hp >= target.maxHp) return { didHeal: false };
  
  const healAmount = 20;
  const prevHP = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + healAmount);
  const actualHeal = target.hp - prevHP;
  
  console.log(`Cleric healed ${target.name} for ${actualHeal} HP (${prevHP} -> ${target.hp})`);
  
  // Boost morale for both healer and target
  healer.morale = Math.min(150, healer.morale + 10);
  target.morale = Math.min(150, target.morale + 50);
  return { didHeal: true, healAmount: actualHeal };
}

function moraleCheck(u){
  if(!u||u.hp<=0) return;
  // Dragons never lose morale
  if (u.name === 'Dragon') { u.morale = 150; return; }
  let penalty=0;
  const adj=units.filter(v=>v.team!==u.team&&v.hp>0&&manhattan(u.col,u.row,v.col,v.row)===1);
  penalty+=adj.length*10;
  if (useHexGrid) {
    const dirs = getHexNeighbors(u.col, u.row);
    for (let i = 0; i < 3; i++) {
      const [dcA, drA] = dirs[i];
      const [dcB, drB] = dirs[i + 3];
      const a = getUnitAt(u.col + dcA, u.row + drA);
      const b = getUnitAt(u.col + dcB, u.row + drB);
      if (a && b && a.team !== u.team && b.team !== u.team) penalty += 15;
    }
  } else {
    const L=getUnitAt(u.col-1,u.row),R=getUnitAt(u.col+1,u.row);
    const U=getUnitAt(u.col,u.row-1),D=getUnitAt(u.col,u.row+1);
    if(L&&R&&L.team!==u.team&&R.team!==u.team) penalty+=15;
    if(U&&D&&U.team!==u.team&&D.team!==u.team) penalty+=15;
    const NW=getUnitAt(u.col-1,u.row-1),SE=getUnitAt(u.col+1,u.row+1);
    const NE=getUnitAt(u.col+1,u.row-1),SW=getUnitAt(u.col-1,u.row+1);
    if(NW&&SE&&NW.team!==u.team&&SE.team!==u.team) penalty+=15;
    if(NE&&SW&&NE.team!==u.team&&SW.team!==u.team) penalty+=15;
  }
  u.morale-=penalty; u.morale=constrain(u.morale,0,150);
}

// ---------- Turn ----------
let lastHumanEndTurn=0;
function endTurn(expectedAITeam = null) {
  if(gameOver || (isAITeam(currentTeam) && expectedAITeam!==currentTeam))return;
  if(expectedAITeam && expectedAITeam!==currentTeam)return;
  if(!expectedAITeam){if(Date.now()-lastHumanEndTurn<350)return;lastHumanEndTurn=Date.now();}
  if (typeof OnlineMatch !== "undefined" && !OnlineMatch.canAct()) return;
  console.log('endTurn called. currentTeam before switch:', currentTeam, 'opponentType:', opponentType);
  
  // Update communication lockouts (reduce remaining turns)
  Object.keys(communicationLockouts).forEach(target => {
    const lockout = communicationLockouts[target];
    const turnsLeft = lockout.endTurn - turnNumber;
    if (turnsLeft <= 1) {
      // Lockout will expire this turn
      delete communicationLockouts[target];
      console.log(`${target} is now willing to speak with you again.`);
    }
  });
  
  // Clean up expired trade proposals
  cleanupExpiredTradeProposals();
  // In multiplayer, validate that it's actually this player's turn
  if (opponentType === 'HUMAN') {
    const isMyTurn = (myRole === 'P1' && currentTeam === 'PLAYER') || 
                     (myRole === 'P2' && currentTeam === 'PLAYER2');
    if (!isMyTurn) {
      console.warn('Attempted to end turn when it\'s not our turn. Role:', myRole, 'currentTeam:', currentTeam);
      return; // Don't allow ending turn if it's not our turn
    }
  }
  // For LOCAL_2P mode, no role validation needed - the device is passed between players
  
  // Process team-specific healing and effects for the team that just finished
  units.forEach(u => {
    if (u.team === currentTeam) {
      // Morale recovery (only for team that just finished their turn)
      u.morale = Math.min(150, u.morale + 5);
      
      // Check if unit is in a settlement and heal if so
      const idx = u.row * COLS + u.col;
      const settlement = settlements[idx];
      if (settlement && u.hp < u.maxHp) {
        const pct = SETTLEMENTS[settlement.type] && SETTLEMENTS[settlement.type].healPct ? SETTLEMENTS[settlement.type].healPct : 0;
        const heal = Math.max(1, Math.ceil((u.maxHp || 1) * pct));
        u.hp = Math.min(u.maxHp, u.hp + heal);
        // Visual feedback could be added here
      }
      // Fortress passive healing (per-type)
      if (isFortressUnit(u) && u.hp > 0 && u.hp < u.maxHp) {
        const props = getFortressPropsByName(u.name);
        const heal = props && props.healPerTurn ? props.healPerTurn : 0;
        if (heal > 0) u.hp = Math.min(u.maxHp, u.hp + heal);
      }
      
      // Assassin passive healing: heal 5 HP per turn (only on their own team's turn)
      if (u.name === 'Assassin' && u.hp > 0 && u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + 5);
      }
      
      // Terrain effects per turn (only for current team)
      const terrainIdx = u.row * COLS + u.col;
      const terrainType = terrain[terrainIdx];
      if (terrainType && TERRAIN[terrainType]) {
        const terrainData = TERRAIN[terrainType];
        
        // Desert damage: lose 10 health per turn
        if (terrainData.damagePerTurn && u.hp > 0) {
          u.hp = Math.max(1, u.hp - terrainData.damagePerTurn); // Don't kill units, leave at 1 HP
        }
        
        // Fountain healing: heal 6 health per turn
        if (terrainData.healPerTurn && u.hp > 0 && u.hp < u.maxHp) {
          u.hp = Math.min(u.maxHp, u.hp + terrainData.healPerTurn);
        }
      }
    }
  });
  // NUCLEAR SOLUTION: Auto-capture all settlements with team units before income
  try { captureSettlementsWithUnits(currentTeam); } catch(e) { console.warn('captureSettlementsWithUnits failed', e); }
  
  // Grant income for the team that is starting now
  try { grantIncomeForTeam(currentTeam); } catch(e) { console.warn('grantIncomeForTeam failed', e); }

  // switch turn
  const previousTeam = currentTeam;
  
  // Calculate turn order and advance to next team
  calculateTurnOrder(); // Ensure we have the current turn order
  currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
  currentTeam = turnOrder[currentTurnIndex];
  
  // Increment global turn number when we complete a full cycle (back to first team)
  if (currentTurnIndex === 0) {
    turnNumber++;
    console.log('New turn cycle started - Turn Number:', turnNumber);
    
    // Process diplomacy updates only once per full turn cycle
    if (isDiplomacyActive()) {
      processDiplomaticTurnEnd();
    }
  }
  
  console.log('DEBUG: Turn switched - Previous:', previousTeam, 'Current:', currentTeam, 'Turn Order:', turnOrder, 'OpponentType:', opponentType);
  console.log('DEBUG: Active teams:', getActiveTeams(), 'currentAIPlayers:', currentAIPlayers, 'isAITeam(currentTeam):', isAITeam(currentTeam));

  // Grant income for the team that is starting now
  //try { grantIncomeForTeam(currentTeam); } catch(e) { console.warn('grantIncomeForTeam failed', e); }

  // reset action flags for the team that is starting now
  console.log(`DEBUG: Resetting movement for team ${currentTeam}. Total units: ${units.length}`);
  let resetCount = 0;
  units.forEach(u => {
    if (u.team === currentTeam) {
      console.log(`DEBUG: Resetting unit ${u.name} at (${u.col},${u.row}) - hasMoved: ${u.hasMoved} -> false, hasActed: ${u.hasActed} -> false`);
      u.hasMoved = false;
      u.hasActed = false;
      u.usedBonusAttack = false; // Reset Knight bonus attack flag
      resetCount++;
    }
  });
  console.log(`DEBUG: Reset movement for ${resetCount} units of team ${currentTeam}`);

  // auto-flee for broken morale units on the new team
  autoFlee(currentTeam);

  selectedUnit = null;
  // Reset build mode at end of turn to avoid accidental builds by the other player
  buildMode = false; buildModeUnitId = null;
  updateUI();
  checkEndGame();
  if (gameOver) {
    try{ postGameState(); } catch(e){}
    return;
  }

  try{ postGameState(); } catch(e){}

  // Decide what to do when it's an AI team's turn depending on opponent type
  if (isAITeam(currentTeam)) {
    console.log(`DEBUG: It's ${currentTeam}'s turn - isAITeam: ${isAITeam(currentTeam)}, opponentType: ${opponentType}`);
    
    // Check if AI team is dead (no units and no settlements)
    if (isTeamDead(currentTeam)) {
      console.log(`${currentTeam} is dead (no units or settlements) - skipping turn and advancing to next team`);
      const skippedTeam=currentTeam, skippedTurn=turnNumber;
      setTimeout(() => {if(currentTeam===skippedTeam&&turnNumber===skippedTurn)endTurn(skippedTeam);},100); // Skip turn immediately
      return;
    }
    
    if (opponentType === 'AI') {
      // Always run AI locally when the opponent is AI (embedded or standalone)
      console.log(`Scheduling aiTakeTurn for team ${currentTeam} (opponentType=AI)`);
      const scheduledTeam=currentTeam, scheduledTurn=turnNumber;
      setTimeout(() => {if(currentTeam===scheduledTeam&&turnNumber===scheduledTurn)aiTakeTurn(scheduledTeam);},300);
      // Also inform parent that turn changed so the hub UI can sync
      try { window.parent.postMessage({ type: 'turnUpdate', current: currentTeam }, '*'); } catch (e) {}
    }
    // If opponentType === 'HUMAN', do nothing here (parent controls turns for both players)
  }
  
  // For local 2-player mode, show a turn notification
  if (opponentType === 'LOCAL_2P') {
    showTurnNotification(currentTeam);
  }
  
  // SAFETY CHECK: Ensure PLAYER units have movement reset when it's their turn
  if (currentTeam === 'PLAYER') {
    console.log(`DEBUG: SAFETY CHECK - Ensuring PLAYER units can move`);
    units.forEach(u => {
      if (u.team === 'PLAYER') {
        if (u.hasMoved || u.hasActed) {
          console.log(`DEBUG: SAFETY - Resetting movement for PLAYER unit ${u.name} at (${u.col},${u.row})`);
          u.hasMoved = false;
          u.hasActed = false;
        }
      }
    });
  }
}

function autoFlee(team) {
  // Get all fleeing units and sort them by distance to enemies (furthest first)
  let fleeing = units.filter(u => u.team === team && u.hp > 0 && u.morale <= 0 && !isFortressUnit(u));
  const enemies = units.filter(e => e.hp > 0 && canAttack(e.team,team));
  
  console.log(`autoFlee called for team ${team}: ${fleeing.length} fleeing units, ${enemies.length} enemies`);
  if (fleeing.length > 0) {
    console.log('Fleeing units:', fleeing.map(u => `${u.name}@${u.col},${u.row} (morale: ${u.morale})`));
  }
  
  if (enemies.length === 0) return;

  // Calculate each unit's closest enemy distance for sorting
  fleeing = fleeing.map(u => {
    let minDist = Infinity;
    for (const e of enemies) {
      const d = manhattan(u.col, u.row, e.col, e.row);
      minDist = Math.min(minDist, d);
    }
    return { unit: u, minEnemyDist: minDist };
  })
  // Sort so units closest to enemies move first (they need to escape more urgently)
  .sort((a, b) => a.minEnemyDist - b.minEnemyDist)
  .map(x => x.unit);

  // Keep track of chosen destinations to prevent overlap
  const chosenDests = new Set();

  for (const u of fleeing) {
    // Find nearest enemy for this unit
    let nearest = enemies[0];
    let minDist = manhattan(u.col, u.row, nearest.col, nearest.row);
    for (const e of enemies) {
      const d = manhattan(u.col, u.row, e.col, e.row);
      if (d < minDist) { minDist = d; nearest = e; }
    }

    // Get appropriate movement directions based on grid type
    let dirs;
    if (useHexGrid) {
      dirs = getHexNeighbors(u.col, u.row);
    } else {
      // Include diagonal moves for more escape options
      dirs = [
        [1,0], [-1,0], [0,1], [0,-1],  // orthogonal
        [1,1], [1,-1], [-1,1], [-1,-1]  // diagonal
      ];
    }

    // Find best move that increases distance and isn't already taken
    let bestMove = {col: u.col, row: u.row, dist: minDist};
    for (const [dx,dy] of dirs) {
      const nc = u.col+dx, nr = u.row+dy;
      // Skip if out of bounds or occupied
      if (nc<0 || nc>=COLS || nr<0 || nr>=ROWS) continue;
      if (getUnitAt(nc,nr)) continue;
      
      // Skip if unit cannot move to this terrain (respects terrain restrictions)
      if (!canMoveTo(u, nc, nr)) continue;
      
      // Skip if this destination is already chosen by another fleeing unit
      const destKey = `${nc},${nr}`;
      if (chosenDests.has(destKey)) continue;

      const d = manhattan(nc,nr,nearest.col,nearest.row);
      // Only consider moves that increase distance from enemy
      if (d > bestMove.dist) bestMove = {col:nc,row:nr,dist:d};
    }

    // If we found a valid move, mark it as taken and move the unit
      if (bestMove.col !== u.col || bestMove.row !== u.row) {
      chosenDests.add(`${bestMove.col},${bestMove.row}`);
      if(!canMoveTo(u,bestMove.col,bestMove.row))continue;
      ActionEffects.move(u,bestMove.col,bestMove.row);
      u.col = bestMove.col;
      u.row = bestMove.row;
      checkSettlementCaptureAfterMove(u, u.col, u.row);
    }
    u.hasMoved = true;
    u.hasActed = true;
  }
}

function findRetreatTile(u){
  let best={col:u.col,row:u.row,score:-1};
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    if(getUnitAt(c,r)) continue;
    let minDist=Infinity;
    for(const e of units.filter(x=>x.team!==u.team&&x.hp>0)){
      minDist=min(minDist,manhattan(c,r,e.col,e.row));
    }
    if(minDist>best.score){ best={col:c,row:r,score:minDist}; }
  }
  return best;
}

// Claim a settlement at (col,row) for a given owner (team). If no settlement, do nothing.
/**
 * Settlement Protection Logic - ensures AI doesn't abandon settlements to enemy capture
 * Checks if moving a unit out of a settlement would allow an enemy to capture it
 * @param {object} unit - The unit considering movement 
 * @param {number} newCol - Target column position
 * @param {number} newRow - Target row position
 * @returns {boolean} true if the move would endanger a settlement, false if safe
 */
function wouldAbandonSettlement(unit, newCol, newRow) {
  // Check if unit is currently on a settlement owned by their team
  const currentIdx = unit.row * COLS + unit.col;
  const currentSettlement = settlements[currentIdx];
  
  if (!currentSettlement || currentSettlement.owner !== unit.team) {
    return false; // Not on owned settlement, no protection needed
  }
  
  // Check if there are other friendly units that can protect this settlement
  const otherProtectors = units.filter(u => 
    u.team === unit.team && 
    u !== unit && 
    u.hp > 0 &&
    manhattan(u.col, u.row, unit.col, unit.row) <= 1 // Adjacent or same tile
  );
  
  if (otherProtectors.length > 0) {
    return false; // Other units can protect the settlement
  }
  
  // Check if any enemy units can reach the settlement if we move away
  const enemies = units.filter(u => u.team !== unit.team && u.hp > 0);
  for (const enemy of enemies) {
    const distToSettlement = manhattan(enemy.col, enemy.row, unit.col, unit.row);
    // Only prevent movement if enemy can reach settlement THIS turn (immediate threat)
    // Changed from enemy.move to enemy.move only if they haven't moved yet
    const enemyCanReachThisTurn = distToSettlement <= enemy.move && !enemy.hasMoved;
    
    // Also consider if enemy is very close (within 2 tiles) as immediate threat
    const isImmediateThreat = distToSettlement <= 2;
    
    if (enemyCanReachThisTurn || isImmediateThreat) {
      console.log(`AI ${unit.name} refuses to abandon ${currentSettlement.type} at [${unit.col},${unit.row}] - enemy ${enemy.name} at distance ${distToSettlement} poses immediate threat`);
      return true; // Would abandon settlement to enemy capture
    }
  }
  
  console.log(`AI ${unit.name} is safe to leave ${currentSettlement.type} at [${unit.col},${unit.row}] - no immediate enemy threats`);
  return false; // Safe to move, no immediate threat
}

function claimSettlementAt(col, row, owner){
  console.log('DEBUG: claimSettlementAt called with', {col, row, owner});
  if(col<0||col>=COLS||row<0||row>=ROWS) {
    console.log('DEBUG: claimSettlementAt - coordinates out of bounds');
    return;
  }
  const idx = row * COLS + col;
  const s = settlements[idx];
  console.log('DEBUG: Settlement found at', col, row, ':', s);
  if(!s) {
    console.log('DEBUG: claimSettlementAt - no settlement at this location');
    return;
  }
  if(s.owner !== owner && !areFriendlyTeams(s.owner,owner)){
    const previousOwner = s.owner;
    s.owner = owner;
    console.log('DEBUG: Settlement ownership changed from', previousOwner, 'to', owner);
    console.log('Settlement at',col,row,'now owned by',owner);
    
    // Trigger AI messages for settlement capture
    if (owner === 'PLAYER' && previousOwner && previousOwner !== 'PLAYER') {
      // Player captured from AI
      const messages = [
        `You dare seize our sacred grounds! This transgression will not be forgotten!`,
        `Our settlement falls to your forces... but this is far from over.`,
        `Your expansion comes at a great cost. We will remember this insult.`
      ];
      addAIMessage(previousOwner, messages[Math.floor(Math.random() * messages.length)], 'SETTLEMENT_LOST');
    } else if (isAITeam(owner) && previousOwner === 'PLAYER') {
      // AI captured from player
      const messages = [
        `Your settlement is now ours! Your borders shrink before our might.`,
        `Another strategic position secured. Your realm weakens.`,
        `This land belongs to us now. Prepare to lose more.`
      ];
      addAIMessage(owner, messages[Math.floor(Math.random() * messages.length)], 'SETTLEMENT_CAPTURED');
    }
    // If embedded in a parent hub, notify it so ownership can be persisted for multiplayer
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'settlementClaimed', gameId: (new URLSearchParams(window.location.search)).get('gameId'), col, row, owner, settlementType: s.type }, '*');
      }
    } catch (e) {
      console.warn('Failed to post settlementClaimed to parent', e);
    }
  } else {
    console.log('DEBUG: Settlement already owned by', owner, '- no ownership change');
  }
}

/**
 * NEW FUNCTION: Checks if a unit just moved into a settlement and captures it immediately
 * Called after every unit movement to ensure settlements are captured reliably
 */
function checkSettlementCaptureAfterMove(unit, newCol, newRow) {
  console.log(`DEBUG: Checking settlement capture for ${unit.name} (${unit.team}) at (${newCol},${newRow})`);
  
  // Verify coordinates are valid
  if (newCol < 0 || newCol >= COLS || newRow < 0 || newRow >= ROWS) {
    console.log('DEBUG: Invalid coordinates for settlement capture check');
    return;
  }
  
  // Check if there's a settlement at the new position
  const settlementIndex = newRow * COLS + newCol;
  const settlement = settlements[settlementIndex];
  
  if (!settlement) {
    console.log('DEBUG: No settlement at movement destination');
    return;
  }
  
  console.log(`DEBUG: Found settlement at destination: type=${settlement.type}, owner=${settlement.owner}`);
  
  // If unit's team doesn't own this settlement, capture it
  if (settlement.owner !== unit.team && !areFriendlyTeams(settlement.owner,unit.team)) {
    const previousOwner = settlement.owner;
    settlement.owner = unit.team;
    console.log(`SUCCESS: ${unit.team} ${unit.name} captured ${settlement.type} from ${previousOwner} at (${newCol},${newRow})`);
    
    // Trigger diplomatic messages for settlement capture
    if (unit.team === 'PLAYER' && previousOwner && previousOwner !== 'PLAYER') {
      // Player captured from AI
      const messages = [
        `You dare seize our sacred grounds! This transgression will not be forgotten!`,
        `Our settlement falls to your forces... but this is far from over.`,
        `Your expansion comes at a great cost. We will remember this insult.`
      ];
      addAIMessage(previousOwner, messages[Math.floor(Math.random() * messages.length)], 'SETTLEMENT_LOST');
    } else if (isAITeam(unit.team) && previousOwner === 'PLAYER') {
      // AI captured from player
      const messages = [
        `Your settlement is now ours! Your borders shrink before our might.`,
        `Another strategic position secured. Your realm weakens.`,
        `This land belongs to us now. Prepare to lose more.`
      ];
      addAIMessage(unit.team, messages[Math.floor(Math.random() * messages.length)], 'SETTLEMENT_CAPTURED');
    }
    
    // Notify parent for multiplayer persistence
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'settlementClaimed', gameId: (new URLSearchParams(window.location.search)).get('gameId'), col: newCol, row: newRow, owner: unit.team, settlementType: settlement.type }, '*');
      }
    } catch (e) {
      console.warn('Failed to post settlementClaimed to parent', e);
    }
  } else {
    console.log(`DEBUG: Settlement already owned by ${unit.team}, no capture needed`);
  }
}

// NUCLEAR SOLUTION: Auto-capture all settlements where team has units
function captureSettlementsWithUnits(team) {
  console.log('NUCLEAR: Auto-capturing settlements for team', team);
  let capturedCount = 0;
  
  // Check every settlement on the map
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      const settlement = settlements[idx];
      
      // Skip if no settlement at this position
      if (!settlement) continue;
      
      // Check if there's a unit from this team at this position
      const unitAtPosition = getUnitAt(col, row);
      if (unitAtPosition && unitAtPosition.team === team && unitAtPosition.hp > 0) {
        // Only capture if settlement isn't already owned by this team
        if (settlement.owner !== team && !areFriendlyTeams(settlement.owner,team)) {
          const previousOwner = settlement.owner;
          settlement.owner = team;
          capturedCount++;
          
          console.log(`NUCLEAR: Captured ${settlement.type} at (${col},${row}) from ${previousOwner || 'neutral'} for ${team}`);
          
          // Trigger the same AI messages as normal capture
          if (team === 'PLAYER' && previousOwner && previousOwner !== 'PLAYER') {
            const messages = [
              `You dare seize our sacred grounds! This transgression will not be forgotten!`,
              `Our settlement falls to your forces... but this is far from over.`,
              `Your expansion comes at a great cost. We will remember this insult.`
            ];
            addAIMessage(previousOwner, messages[Math.floor(Math.random() * messages.length)], 'SETTLEMENT_LOST');
          } else if (isAITeam(team) && previousOwner === 'PLAYER') {
            const messages = [
              `Your settlement is now ours! Your borders shrink before our might.`,
              `Another strategic position secured. Your realm weakens.`,
              `This land belongs to us now. Prepare to lose more.`
            ];
            addAIMessage(team, messages[Math.floor(Math.random() * messages.length)], 'SETTLEMENT_CAPTURED');
          }
        }
      }
    }
  }
  
  if (capturedCount > 0) {
    console.log(`NUCLEAR: Team ${team} auto-captured ${capturedCount} settlements`);
  }
}

// Small capture banner UI
function showCaptureBanner(col, row, owner, settlementType) {
  let b = document.getElementById('captureBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'captureBanner';
    b.style.position = 'absolute';
    b.style.left = '50%';
    b.style.top = '12px';
    b.style.transform = 'translateX(-50%)';
    b.style.padding = '8px 12px';
    b.style.background = 'rgba(0,0,0,0.6)';
    b.style.color = 'white';
    b.style.borderRadius = '8px';
    b.style.zIndex = 9999;
    document.body.appendChild(b);
  }
  b.textContent = `${owner} captured ${settlementType || 'settlement'} at (${col},${row})`;
  b.style.opacity = '1';
  clearTimeout(b._hideTimer);
  b._hideTimer = setTimeout(()=>{ b.style.transition='opacity 400ms'; b.style.opacity='0'; }, 2200);
}

/**
 * Main AI decision-making system - handles complete AI turn execution
 * 
 * AI Turn Phases:
 * 1. Strategic Analysis - evaluate current board state and determine overall strategy
 * 2. Unit Building - spawn new units at settlements based on resources and needs  
 * 3. Unit Actions - for each AI unit, determine optimal move and action:
 *    a. Cleric Healing - prioritize healing wounded allies
 *    b. Movement - retreat if threatened, claim settlements, or advance tactically
 *    c. Combat - attack enemies in range with smart target selection
 * 4. Turn Transition - apply healing, reset flags, switch to player turn
 * 
 * The AI uses multiple decision layers:
 * - Strategic (board-wide): resource management, territorial control
 * - Tactical (unit-level): positioning, target selection, formation fighting  
 * - Reactive (immediate): threat response, retreat decisions
 */

/**
 * Starts or restarts the AI turn timeout
 * Should be called whenever the AI performs any action to reset the 3-second timer
 */

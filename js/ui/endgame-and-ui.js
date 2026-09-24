// Warborn source split from the original game.js.
// Section: js/ui/endgame-and-ui.js

// ---------- Menu and End Game ----------
function wireMainMenu() {
  const playBtn = document.getElementById('menuPlayBtn');
  const campaignBtn = document.getElementById('menuCampaignBtn');
  const backCampaignBtn = document.getElementById('campaignBackBtn');
  const mainMenu = document.getElementById('mainMenu');
  if (mainMenu && !mainMenu.dataset.inputGuarded) {
    mainMenu.dataset.inputGuarded = 'true';
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend'].forEach(eventName => {
      mainMenu.addEventListener(eventName, event => event.stopPropagation());
    });
  }
  if (!playBtn || playBtn.dataset.wired) return;
  playBtn.dataset.wired = 'true';
  playBtn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    try { SoundManager.startBackgroundMusic(); } catch (e) {}
    gameInputBlockedUntil = Date.now() + 500;
    document.getElementById('mainMenu')?.classList.add('hidden');
    hideEndScreen();
    if (gameOver) {
      replayCurrentScenario();
    }
  });
  if (campaignBtn && !campaignBtn.dataset.wired) {
    campaignBtn.dataset.wired = 'true';
    campaignBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      gameInputBlockedUntil = Date.now() + 500;
      openCampaignPage();
    });
  }
  if (backCampaignBtn && !backCampaignBtn.dataset.wired) {
    backCampaignBtn.dataset.wired = 'true';
    backCampaignBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      closeCampaignPage(true);
    });
  }
}

function wireEndScreenButtons() {
  const replayBtn = document.getElementById('replayScenarioBtn');
  const menuBtn = document.getElementById('backToMenuBtn');
  const continueBtn = document.getElementById('continueCampaignBtn');
  if (replayBtn && !replayBtn.dataset.wired) {
    replayBtn.dataset.wired = 'true';
    replayBtn.addEventListener('click', () => {
      try { SoundManager.startBackgroundMusic(); } catch (e) {}
      replayCurrentScenario();
    });
  }
  if (continueBtn && !continueBtn.dataset.wired) {
    continueBtn.dataset.wired = 'true';
    continueBtn.addEventListener('click', () => {
      try { SoundManager.startBackgroundMusic(); } catch (e) {}
      hideEndScreen();
      nextScenario();
    });
  }
  if (menuBtn && !menuBtn.dataset.wired) {
    menuBtn.dataset.wired = 'true';
    menuBtn.addEventListener('click', () => {
      hideEndScreen();
      document.getElementById('mainMenu')?.classList.remove('hidden');
    });
  }
}

function hideEndScreen() {
  const endScreen = document.getElementById('endScreen');
  const continueBtn = document.getElementById('continueCampaignBtn');
  if (!endScreen) return;
  endScreen.classList.remove('visible', 'victory', 'defeat');
  if (continueBtn) continueBtn.style.display = 'none';
}

function showEndScreen(result) {
  if (!result || endScreenShown) return;
  endScreenShown = true;
  gameEndResult = result;
  
  const endScreen = document.getElementById('endScreen');
  const title = document.getElementById('endScreenTitle');
  const explanation = document.getElementById('endScreenExplanation');
  const continueBtn = document.getElementById('continueCampaignBtn');
  if (!endScreen || !title || !explanation) return;
  
  const won = result.outcome === 'victory';
  endScreen.classList.remove('victory', 'defeat');
  endScreen.classList.add(won ? 'victory' : 'defeat');
  title.textContent = won ? 'Victory' : 'Defeat';
  explanation.textContent = result.explanation || (won ? 'You achieved the objective.' : 'The objective failed.');
  const canContinueCampaign = won &&
    campaignMode.active &&
    campaignMode.currentScenarioIndex < campaignMode.campaignData.scenarios.length - 1;
  if (continueBtn) continueBtn.style.display = canContinueCampaign ? 'inline-block' : 'none';
  requestAnimationFrame(() => endScreen.classList.add('visible'));
}

function replayCurrentScenario() {
  hideEndScreen();
  if (activeScenarioSnapshot) {
    applyLevelData(clonePlain(activeScenarioSnapshot));
    captureScenarioSnapshot();
  } else if (campaignMode.active) {
    loadCurrentScenario();
  } else if (lastPlayedSavedLevelIndex !== null) {
    loadSavedLevel(lastPlayedSavedLevelIndex);
  } else {
    setupGame();
  }
}

function teamHasLife(team) {
  return units.some(u => u.team === team && u.hp > 0) || settlements.some(s => s && s.owner === team);
}

function isTeamConquered(team) {
  return !units.some(u => u.team === team && u.hp > 0) && !settlements.some(s => s && s.owner === team);
}

function playerControlsTile(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  const idx = row * COLS + col;
  const settlement = settlements[idx];
  if (settlement && settlement.owner === 'PLAYER') return true;
  return units.some(u => u.team === 'PLAYER' && u.hp > 0 && u.col === col && u.row === row);
}

function evaluateVictoryCondition() {
  if(currentVictoryCondition.crownFallenTeams?.includes('PLAYER'))return {outcome:'defeat',explanation:'Your Crown has fallen. Your kingdom is defeated.'};
  const vc = normalizeVictoryCondition(currentVictoryCondition);
  const enemies = getActiveTeams().filter(team => team !== 'PLAYER');
  const playerAlive = teamHasLife('PLAYER');
  
  if (!playerAlive) {
    return { outcome: 'defeat', explanation: 'You lost all surviving units and controlled settlements.' };
  }
  
  switch (vc.type) {
    case 'ANNIHILATE_TEAM':
      if (isTeamConquered(vc.targetTeam)) {
        return { outcome: 'victory', explanation: `${getTeamDisplayName(vc.targetTeam)} has no surviving units or settlements left to rally from.` };
      }
      break;
      
    case 'HOLD_TILE': {
      const controlled = playerControlsTile(vc.holdCol, vc.holdRow);
      if (controlled && vc.lastHoldTurn !== turnNumber) {
        vc.holdProgress += 1;
        vc.lastHoldTurn = turnNumber;
      } else if (!controlled) {
        vc.holdProgress = 0;
      }
      currentVictoryCondition = vc;
      if (vc.holdProgress >= vc.holdTurns) {
        return { outcome: 'victory', explanation: `You held tile ${vc.holdCol},${vc.holdRow} for ${vc.holdTurns} consecutive turns.` };
      }
      break;
    }
      
    case 'SURVIVE_TURNS':
      if (turnNumber >= vc.surviveTurns) {
        return { outcome: 'victory', explanation: `You survived until turn ${vc.surviveTurns}.` };
      }
      break;
      
    case 'KILL_UNIT_LIMIT': {
      let target = units.find(u => u.id === vc.targetUnitId);
      if (!target) {
        target = units.find(u => u.team !== 'PLAYER');
        if (target) {
          vc.targetUnitId = target.id;
          currentVictoryCondition = vc;
        }
      }
      if (!target || target.hp <= 0) {
        return { outcome: 'victory', explanation: `The specified enemy unit was killed by turn ${vc.killTurnLimit}.` };
      }
      if (turnNumber > vc.killTurnLimit) {
        return { outcome: 'defeat', explanation: `${getTeamDisplayName(target.team)} ${target.name} survived past turn ${vc.killTurnLimit}.` };
      }
      break;
    }
      
    case 'ANNIHILATE_ALL':
    default:
      if (enemies.length > 0 && enemies.every(team => isTeamConquered(team))) {
        return { outcome: 'victory', explanation: 'Every enemy army has been destroyed and every enemy settlement has fallen.' };
      }
      break;
  }
  
  const winner = getWinner();
  if (winner && winner !== 'PLAYER') {
    return { outcome: 'defeat', explanation: `${getTeamDisplayName(winner)} achieved battlefield dominance before your objective was complete.` };
  }
  
  return null;
}

/**
 * Determines game winner - requires eliminating BOTH units AND settlements
 * A team is eliminated when they have no living units AND no owned settlements
 * This prevents situations where a team can rebuild after losing all units
 */
/**
 * Determines game winner - requires eliminating BOTH units AND settlements
 * A team is eliminated when they have no living units AND no owned settlements
 * Neutral settlements (unowned) don't prevent victory
 */
function getWinner(){
  const activeTeams = getActiveTeams();
  const aliveTeams = [];
  
  // Check each active team to see if they're still alive
  activeTeams.forEach(team => {
    const hasUnits = units.some(u => u.team === team && u.hp > 0);
    const hasSettlements = settlements.some(s => s && s.owner === team);
    
    // A team is alive if they have EITHER units OR owned settlements
    if (hasUnits || hasSettlements) {
      aliveTeams.push(team);
    }
  });
  
  // Debug logging to see what's happening
  const neutralSettlements = settlements.filter(s => s && !s.owner).length;
  const teamStatus = {};
  activeTeams.forEach(team => {
    teamStatus[team] = {
      units: units.filter(u => u.team === team && u.hp > 0).length,
      settlements: settlements.filter(s => s && s.owner === team).length,
      alive: aliveTeams.includes(team)
    };
  });
  
  console.log('WIN CHECK:', {
    activeTeams: activeTeams,
    aliveTeams: aliveTeams,
    teamStatus: teamStatus,
    neutralSettlements: neutralSettlements,
    totalLivingUnits: units.filter(u => u.hp > 0).length,
    totalOwnedSettlements: settlements.filter(s => s && s.owner).length
  });
  
  // Victory requires being the only team alive
  if (aliveTeams.length === 1) {
    return aliveTeams[0];
  } else if (aliveTeams.length === 0) {
    return 'DRAW'; // Everyone eliminated simultaneously
  }
  
  return null; // No winner yet - multiple teams still alive
}
function checkEndGame(){
  if (typeof OnlineMatch !== "undefined" && OnlineMatch.playing) { OnlineMatch.finish(); return; }
  if (gameOver && endScreenShown) return;
  
  const result = evaluateVictoryCondition();
  if (!result) return;
  
  gameOver = true;
  const learningWinner = result.outcome === 'victory' ? 'PLAYER' : (getWinner() || 'AI');
  if (LEARNING_AI.enabled) {
    finalizeGameForLearning(learningWinner);
  }
  showEndScreen(result);
}

function checkCampaignVictory() {
  if (!campaignMode.active || !campaignMode.campaignData.scenarios[campaignMode.currentScenarioIndex]) {
    return;
  }
  
  const scenario = campaignMode.campaignData.scenarios[campaignMode.currentScenarioIndex];
  const victory = scenario.victory.toLowerCase();
  
  if (victory.includes('capture') && victory.includes('settlements')) {
    // Extract number from victory condition like "Capture 3 settlements"
    const match = victory.match(/(\d+)/);
    const targetCount = match ? parseInt(match[1]) : 3;
    
    const playerSettlements = settlements.filter(s => s && s.owner === 'PLAYER').length;
    if (playerSettlements >= targetCount) {
      gameOver = true;
      showPopup("Victory!", `You have captured ${playerSettlements} settlements and achieved victory!`, "success");
      setTimeout(() => {
        nextScenario();
      }, 2000);
    }
  } else if (victory.includes('survive') && victory.includes('turns')) {
    // Extract number from victory condition like "Survive 15 turns and control the center"
    const match = victory.match(/(\d+)/);
    const targetTurns = match ? parseInt(match[1]) : 15;
    
    if (turnNumber >= targetTurns) {
      // Check if player controls center (if specified)
      if (victory.includes('center')) {
        const centerCol = Math.floor(COLS / 2);
        const centerRow = Math.floor(ROWS / 2);
        const centerIndex = centerRow * COLS + centerCol;
        const centerSettlement = settlements[centerIndex];
        
        if (centerSettlement && centerSettlement.owner === 'PLAYER') {
          gameOver = true;
          showPopup("Victory!", `You have survived ${turnNumber} turns and control the center!`, "success");
          setTimeout(() => {
            nextScenario();
          }, 2000);
        } else if (turnNumber === targetTurns) {
          showPopup("Objective", "You must control the center settlement to achieve victory!", "warning");
        }
      } else {
        gameOver = true;
        showPopup("Victory!", `You have survived ${turnNumber} turns and achieved victory!`, "success");
        setTimeout(() => {
          nextScenario();
        }, 2000);
      }
    }
  }
}

// ========================================
// USER INTERFACE MANAGEMENT
// ========================================

/**
 * Updates all UI elements to reflect current game state
 * Called after any significant game state change (moves, attacks, turn changes)
 * Handles: turn indicator, resource display, unit selection panel, health bars
 */
function updateUI() {
  const modeSummary=document.getElementById("modeSummary");
  if(modeSummary)modeSummary.textContent=opponentType==="HUMAN"?"Online match":"vs AI";
  for(const table of [resources,startingResources])for(const team of Object.keys(table))table[team]=getEffectiveCost(table[team]);
  const endButton=document.getElementById('endTurnBtn');
  if(endButton)endButton.disabled=gameOver||isAITeam(currentTeam)||(typeof OnlineMatch!=='undefined'&&!OnlineMatch.canAct());
  // Update turn indicator to show whose turn it is
  let turnDisplay = currentTeam;
  if(opponentType==='HUMAN')turnDisplay=currentTeam.replace(/^PLAYER(\d*)$/,(_,n)=>'Player '+(n||1));
  if (opponentType === 'LOCAL_2P') {
    turnDisplay = currentTeam === 'PLAYER' ? 'Player 1' : 'Player 2';
  }
  turnLabelEl.html(turnDisplay);
  const bannerTeam = getLocalPlayableTeam();
  const ownResources = resources[bannerTeam] || {gold:0,materials:0};
  const goldBanner = select('#bannerGold'), materialsBanner = select('#bannerMaterials');
  if(goldBanner)goldBanner.html(String(ownResources.gold));
  if(materialsBanner)materialsBanner.html(String(ownResources.materials));
  
  // Update resource counters for all teams (if element exists)
  const resLabel = select('#resourceLabel');
  if (resLabel) {
    const activeTeams = getActiveTeams();
    const resourceParts = activeTeams.map(team => {
      const teamResources = resources[team] || { gold: 0, materials: 0 };
      const color = getTeamColorHex(team);
      const shortName = team.replace(/^PLAYER(\d*)$/,(_,n)=>'P'+(n||'1'));
      
      // Add diplomacy indicator for AI teams
      let dipIcon = '';
      if (team !== 'PLAYER' && team !== 'PLAYER2' && isAITeam(team)) {
        const trust = getTrust('PLAYER', team);
        const theirTrust = getTrust(team, 'PLAYER');
        const avgTrust = (trust + theirTrust) / 2;
        
        if (avgTrust > 40) dipIcon = '🤝';
        else if (avgTrust > 20) dipIcon = '😊';
        else if (avgTrust > -20) dipIcon = '😐';
        else if (avgTrust > -40) dipIcon = '😠';
        else dipIcon = '⚔️';
      }
      
      return `<span style="color: ${color}; font-weight: bold">${shortName}:💰${teamResources.gold}•⚒️${teamResources.materials}${dipIcon}</span>`;
    });
    
    resLabel.html(resourceParts.join(' • '));
  }
  
  // Update campaign UI if in campaign mode
  if (campaignMode.active) {
    updateCampaignUI();
  }
  
  if(selectedUnit){
    const unitName = getUnitDisplayName(selectedUnit);
    const xpProgress = getPromotionProgress(selectedUnit);
    const xpDisplay = xpProgress.nextRank !== 'Max Level' ? ` • XP ${xpProgress.current}/${xpProgress.needed}` : ' • Max Level';
    
    selNameEl.html(unitName);
    
    // Format cost display - handle both single cost and multi-resource cost
    let costDisplay;
    const unitCost = selectedUnit.cost || 1;
    if (typeof unitCost === 'number') {
      costDisplay = unitCost; // Single resource cost (gold)
    } else {
      const parts = [];
      if (unitCost.gold > 0) parts.push(`${unitCost.gold}G`);
      if (unitCost.materials > 0) parts.push(`${unitCost.materials}M`);
      costDisplay = parts.join('/') || '0';
    }
    
    selDetailsEl.html(`Team: ${getTeamDisplayName(selectedUnit.team)} • Move:${selectedUnit.move} • Range:${selectedUnit.atkRange} • Cost:${costDisplay}${xpDisplay}`);
    if(selectedUnit.name==='Crown')selDetailsEl.html('👑 Crown • 2 grassland / 1 other terrain • Cannot attack or be bought • Adjacent friendly units: +25% defense, +10% attack • Assassin damage ×2 • Protect your Crown!');
    selHPEl.style('width',(selectedUnit.hp/selectedUnit.maxHp*100)+"%");
    selNumsEl.html(`HP ${selectedUnit.hp}/${selectedUnit.maxHp} • Morale ${selectedUnit.morale} (${moraleLabel(selectedUnit)})`);

  } else {
    selNameEl.html("No unit selected"); selDetailsEl.html("Click a friendly unit to select it.");
    selHPEl.style('width',"0%"); selNumsEl.html("HP —");
  }
  // Unit list removed per user request
  // Build widget: show a small circular button at the bottom when it's the player's turn
  try{
    let buildWidget = document.getElementById('buildWidget');
    // Show the widget when it's the player's turn and either buildMode is active or a friendly unit is selected
    const shouldShowWidget = (currentTeam === 'PLAYER' && (buildMode || (selectedUnit && selectedUnit.team === currentTeam && selectedUnit.hp > 0 && selectedUnit.morale > 0)));
    if(shouldShowWidget){
      if(!buildWidget){
        buildWidget = document.createElement('div'); buildWidget.id='buildWidget';
        buildWidget.style.position='fixed'; buildWidget.style.left='50%'; buildWidget.style.bottom='12px';
        buildWidget.style.transform='translateX(-50%)'; buildWidget.style.width='44px'; buildWidget.style.height='44px';
        buildWidget.style.borderRadius='50%'; buildWidget.style.background='rgba(24,120,220,0.95)';
        buildWidget.style.display='flex'; buildWidget.style.alignItems='center'; buildWidget.style.justifyContent='center';
        buildWidget.style.cursor='pointer'; buildWidget.style.zIndex=9999; buildWidget.title='Build Fortresses & Ships (toggle)';
        buildWidget.innerText = '🏗️'; buildWidget.style.fontSize='20px';
        buildWidget.onclick = function(){
          buildMode = !buildMode;
          if (buildMode) {
            buildModeUnitId = selectedUnit ? selectedUnit.id : null;
            // Deselect any unit so players can't move/select while building
            selectedUnit = null;
          } else {
            buildModeUnitId = null;
          }
          this.style.boxShadow = buildMode ? '0 0 0 10px rgba(24,120,220,0.18)' : 'none';
          try{ updateUI(); } catch(e){}
        };
        document.body.appendChild(buildWidget);
      }
      
      // Water upgrade widget: show when a friendly unit is selected
      let waterUpgradeWidget = document.getElementById('waterUpgradeWidget');
      const shouldShowWaterWidget = selectedUnit && !isFortressUnit(selectedUnit) && selectedUnit.name!=='Dragon' && selectedUnit.team === currentTeam && selectedUnit.hp > 0;
      if (shouldShowWaterWidget) {
        if (!waterUpgradeWidget) {
          waterUpgradeWidget = document.createElement('div'); waterUpgradeWidget.id = 'waterUpgradeWidget';
          waterUpgradeWidget.style.position = 'fixed'; waterUpgradeWidget.style.left = '12px'; waterUpgradeWidget.style.bottom = '12px';
          waterUpgradeWidget.style.width = '44px'; waterUpgradeWidget.style.height = '44px';
          waterUpgradeWidget.style.borderRadius = '50%'; 
          waterUpgradeWidget.style.display = 'flex'; waterUpgradeWidget.style.alignItems = 'center'; waterUpgradeWidget.style.justifyContent = 'center';
          waterUpgradeWidget.style.cursor = 'pointer'; waterUpgradeWidget.style.zIndex = 9999; 
          waterUpgradeWidget.style.fontSize = '20px';
          waterUpgradeWidget.onclick = function() { upgradeSelectedUnitToWater(); };
          document.body.appendChild(waterUpgradeWidget);
        }
        
        // Update button appearance based on unit and resources
        if (selectedUnit.isWaterUnit) {
          waterUpgradeWidget.style.background = 'rgba(74,170,100,0.95)'; // Green for already upgraded
          waterUpgradeWidget.innerText = '⚓';
          waterUpgradeWidget.title = 'Water Unit (Already Upgraded)';
          waterUpgradeWidget.style.cursor = 'default';
      } else {
        const canAfford = getGold(currentTeam) >= 2;
        waterUpgradeWidget.style.background = canAfford ? 'rgba(220,120,24,0.95)' : 'rgba(100,100,100,0.95)';
        waterUpgradeWidget.innerText = '⚓';
        waterUpgradeWidget.title = canAfford ? 'Water Upgrade (2 Gold)' : 'Water Upgrade (Need 2 Gold)';
          waterUpgradeWidget.style.cursor = canAfford ? 'pointer' : 'not-allowed';
        }
        waterUpgradeWidget.style.display = 'flex';
      } else if (waterUpgradeWidget) {
        waterUpgradeWidget.style.display = 'none';
      }
    } else {
      if(buildWidget) {
        buildWidget.remove();
        // If widget removed from UI, cancel build mode
        buildMode = false; buildModeUnitId = null;
      }
    }
  }catch(e){/* ignore UI build widget errors */}
  
  // Update diplomacy UI if diplomacy system is active
  if (isDiplomacyActive()) {
    updateDiplomacyUI();
  }
  
  // Update AI player count display
  const aiCountDisplay = select('#aiCountDisplay');
  if (aiCountDisplay) {
    aiCountDisplay.html(currentAIPlayers.toString());
  }
  
}

function processDiplomaticTurnEnd() {
  const allTeams = getActiveTeams();
  
  console.log(`Processing diplomatic turn end - Turn ${turnNumber}, Active treaties: ${diplomacy.treaties.filter(t => t.active).length}`);
  
  // Process treaty durations
  diplomacy.treaties.forEach(treaty => {
    if (treaty.active) {
      const oldTurns = treaty.turnsRemaining;
      treaty.turnsRemaining--;
      console.log(`${TREATY_TYPES[treaty.type].name} between ${treaty.participants.join(' and ')}: ${oldTurns} -> ${treaty.turnsRemaining} turns remaining`);
      if (treaty.turnsRemaining <= 0) {
        treaty.active = false;
        console.log(`${TREATY_TYPES[treaty.type].name} between ${treaty.participants.join(' and ')} has expired`);
      }
    }
  });
  
  applyTreatyTurnBenefits();
  
  // Natural trust decay over time (relationships require maintenance)
  allTeams.forEach(team1 => {
    allTeams.forEach(team2 => {
      if (team1 !== team2 && diplomacy.trust[team1] && diplomacy.trust[team1][team2] !== undefined) {
        const currentTrust = diplomacy.trust[team1][team2];
        
        // Positive relationships decay slightly toward neutral
        if (currentTrust > 10) {
          diplomacy.trust[team1][team2] = Math.max(10, currentTrust - 1);
        }
        // Negative relationships also gradually improve toward neutral (grudges fade)
        else if (currentTrust < -10) {
          diplomacy.trust[team1][team2] = Math.min(-10, currentTrust + 0.5);
        }
      }
    });
  });
  
  // Check for coalition formation against powerful factions
  checkForCoalitions();
  
  // Enhanced AI diplomatic decision making with power considerations
  allTeams.forEach(team => {
    if (isAITeam(team)) {
      enhancedConsiderDiplomaticActions(team);
    }
  });
  
  // Generate contextual AI messages
  generateContextualAIMessages();
}

function considerDiplomaticActions(aiTeam) {
  const allTeams = getActiveTeams().filter(t => t !== aiTeam);
  
  allTeams.forEach(otherTeam => {
    const trust = getTrust(aiTeam, otherTeam);
    const reputation = getReputation(otherTeam);
    
    // Consider proposing treaties
    if (trust > 20 && !hasTreaty(aiTeam, otherTeam, 'NON_AGGRESSION')) {
      if (evaluateDiplomaticAction(aiTeam, otherTeam, 'PROPOSE_TREATY')) {
        createTreaty(aiTeam, otherTeam, 'NON_AGGRESSION');
      }
    }
    
    if (trust > 40 && hasTreaty(aiTeam, otherTeam, 'NON_AGGRESSION') && !hasTreaty(aiTeam, otherTeam, 'TRADE_AGREEMENT')) {
      if (evaluateDiplomaticAction(aiTeam, otherTeam, 'PROPOSE_TREATY')) {
        createTreaty(aiTeam, otherTeam, 'TRADE_AGREEMENT');
      }
    }
    
    // Consider resource sharing with trade agreement partners
    if (hasTreaty(aiTeam, otherTeam, 'TRADE_AGREEMENT') && trust > 30) {
      const aiResources = getResourceTotal(aiTeam);
      const otherResources = getResourceTotal(otherTeam);
      
      // Share resources if AI has surplus and other team needs it
      if (aiResources > 15 && otherResources < 5) {
        const shareAmount = Math.min(3, Math.floor(aiResources * 0.2));
        if (getGold(aiTeam) >= shareAmount) {
          deductResources(aiTeam, { gold: shareAmount });
          addResources(otherTeam, { gold: shareAmount });
          modifyTrust(aiTeam, otherTeam, 5, `${aiTeam} shared resources with ${otherTeam}`);
          console.log(`${aiTeam} shared ${shareAmount} gold with ${otherTeam} due to trade agreement`);
        }
      }
    }
  });
}

// Power evaluation and coalition system
function calculateFactionPower(faction) {
  let power = 0;
  
  // Unit power calculation
  const factionUnits = units.filter(u => u.team === faction && u.hp > 0);
  factionUnits.forEach(unit => {
    let unitPower = (unit.hp / unit.maxHp) * unit.dmg;
    // Special units get power bonuses
    if (unit.name === 'Dragon') unitPower *= 3;
    if (unit.name === 'Knight') unitPower *= 1.5;
    if (unit.name === 'Catapult') unitPower *= 1.3;
    power += unitPower;
  });
  
  // Settlement power calculation
  for (let i = 0; i < settlements.length; i++) {
    const settlement = settlements[i];
    if (settlement && settlement.owner === faction) {
      if (settlement.type === 'CITY') power += 50;
      else if (settlement.type === 'VILLAGE') power += 30;
      else if (settlement.type === 'HAMLET') power += 15;
    }
  }
  
  // Resource power
  power += getResourceValue(faction) * 2;
  
  return power;
}

function evaluateThreatLevel(faction, allTeams) {
  const factionPower = calculateFactionPower(faction);
  const totalOtherPower = allTeams.filter(t => t !== faction).reduce((sum, t) => sum + calculateFactionPower(t), 0);
  const averageOtherPower = totalOtherPower / (allTeams.length - 1);
  
  return factionPower / Math.max(averageOtherPower, 1);
}

function checkForCoalitions() {
  const allTeams = getActiveTeams();
  if (allTeams.length < 3) return;
  
  // Find the most powerful faction
  let mostPowerful = null;
  let highestThreat = 0;
  
  allTeams.forEach(team => {
    const threatLevel = evaluateThreatLevel(team, allTeams);
    if (threatLevel > highestThreat) {
      highestThreat = threatLevel;
      mostPowerful = team;
    }
  });
  
  // If someone is significantly more powerful (1.5x+ average), form coalitions
  if (highestThreat > 1.5 && mostPowerful) {
    const otherTeams = allTeams.filter(t => t !== mostPowerful && isAITeam(t));
    
    otherTeams.forEach(team1 => {
      otherTeams.forEach(team2 => {
        if (team1 !== team2 && !hasTreaty(team1, team2, 'DEFENSIVE_PACT')) {
          const trust = getTrust(team1, team2);
          if (trust > -10) { // Even former enemies might ally against a greater threat
            createTreaty(team1, team2, 'DEFENSIVE_PACT');
            console.log(`Coalition formed: ${team1} and ${team2} allied against powerful ${mostPowerful}`);
            
            // Send threatening message to the powerful faction if it's the player
            if (mostPowerful === 'PLAYER') {
              addAIMessage(team1, `Your growing power concerns us. We have formed alliances to ensure balance.`, 'COALITION_WARNING');
            }
          }
        }
      });
    });
  }
}

function enhancedConsiderDiplomaticActions(aiTeam) {
  const allTeams = getActiveTeams().filter(t => t !== aiTeam);
  const personality = diplomacy.personalities[aiTeam] ? AI_PERSONALITIES[diplomacy.personalities[aiTeam]] : AI_PERSONALITIES.BALANCED;
  
  allTeams.forEach(otherTeam => {
    const trust = getTrust(aiTeam, otherTeam);
    const myPower = calculateFactionPower(aiTeam);
    const theirPower = calculateFactionPower(otherTeam);
    const powerRatio = myPower / Math.max(theirPower, 1);
    
    // PERSONALITY-BASED DIPLOMACY DECISIONS
    switch (personality.type) {
      case 'AGGRESSIVE':
        // Warmongers seek conquest opportunities
        if (powerRatio > 1.6 && !isAtWar(aiTeam, otherTeam) && trust < 30) {
          const warChance = Math.min(0.4, (powerRatio - 1.5) * 0.3);
          if (Math.random() < warChance) {
            console.log(`${personality.name} AI (${aiTeam}) declares aggressive war on ${otherTeam} - Power ratio: ${powerRatio.toFixed(2)}`);
            declareWar(aiTeam, otherTeam);
            return; // Skip other diplomatic actions this turn
          }
        }
        // Less likely to form treaties
        if (trust > 40 && !hasTreaty(aiTeam, otherTeam, 'NON_AGGRESSION') && Math.random() < 0.2) {
          createTreaty(aiTeam, otherTeam, 'NON_AGGRESSION');
        }
        break;
        
      case 'DEFENSIVE':
        // Guardians seek security through alliances
        if (powerRatio < 0.7 && !hasTreaty(aiTeam, otherTeam, 'DEFENSIVE_PACT') && trust > -10) {
          const allianceChance = Math.min(0.6, (0.8 - powerRatio) * 0.8);
          if (Math.random() < allianceChance) {
            console.log(`${personality.name} AI (${aiTeam}) seeks defensive alliance with ${otherTeam} - Power ratio: ${powerRatio.toFixed(2)}`);
            createTreaty(aiTeam, otherTeam, 'DEFENSIVE_PACT');
          }
        }
        // Very unlikely to declare war unless desperate
        if (powerRatio > 2.5 && trust < 10 && Math.random() < 0.1) {
          declareWar(aiTeam, otherTeam);
          return;
        }
        break;
        
      case 'TRADER':
        // Merchant Princes focus on economic partnerships
        if (trust > 20 && !hasTreaty(aiTeam, otherTeam, 'TRADE_AGREEMENT')) {
          if (Math.random() < 0.5) {
            console.log(`${personality.name} AI (${aiTeam}) proposes trade agreement with ${otherTeam}`);
            createTreaty(aiTeam, otherTeam, 'TRADE_AGREEMENT');
          }
        }
        // War only for economic necessity or overwhelming advantage
        if ((powerRatio > 2.2 && trust < 20) || (getResourceTotal(aiTeam) < 2 && powerRatio > 1.5)) {
          if (Math.random() < 0.25) {
            console.log(`${personality.name} AI (${aiTeam}) declares economic war on ${otherTeam}`);
            declareWar(aiTeam, otherTeam);
            return;
          }
        }
        break;
        
      case 'IDEOLOGICAL':
        // Zealots make decisions based on trust and principles
        if (trust < 10 && powerRatio > 1.4 && Math.random() < 0.35) {
          console.log(`${personality.name} AI (${aiTeam}) declares ideological war on ${otherTeam} - Trust: ${trust}`);
          declareWar(aiTeam, otherTeam);
          return;
        }
        // Form strong alliances with trusted factions
        if (trust > 50 && !hasTreaty(aiTeam, otherTeam, 'DEFENSIVE_PACT') && Math.random() < 0.4) {
          console.log(`${personality.name} AI (${aiTeam}) forms ideological alliance with ${otherTeam}`);
          createTreaty(aiTeam, otherTeam, 'DEFENSIVE_PACT');
        }
        break;
        
      case 'BALANCED':
      default:
        // Diplomats use balanced approach
        if (powerRatio > 2.0 && trust < 20 && Math.random() < 0.2) {
          declareWar(aiTeam, otherTeam);
          return;
        }
        if (powerRatio < 0.6 && trust > 10 && !hasTreaty(aiTeam, otherTeam, 'DEFENSIVE_PACT') && Math.random() < 0.3) {
          createTreaty(aiTeam, otherTeam, 'DEFENSIVE_PACT');
        }
        break;
    }
    
    // Standard treaty considerations (existing logic)
    if (trust > 20 && !hasTreaty(aiTeam, otherTeam, 'NON_AGGRESSION')) {
      if (evaluateDiplomaticAction(aiTeam, otherTeam, 'PROPOSE_TREATY')) {
        createTreaty(aiTeam, otherTeam, 'NON_AGGRESSION');
      }
    }
  });
}

function generateContextualAIMessages() {
  const allTeams = getActiveTeams();
  
  allTeams.forEach(aiTeam => {
    if (!isAITeam(aiTeam)) return;
    
    const personality = diplomacy.personalities[aiTeam] ? AI_PERSONALITIES[diplomacy.personalities[aiTeam]] : AI_PERSONALITIES.BALANCED;
    
    // PROCESS POWER-BASED DIPLOMATIC BEHAVIORS
    processAIPowerBasedDiplomacy(aiTeam);
    
    // PROCESS TRADE PROPOSALS
    processTradeProposals(aiTeam);
    
    // Check for recent player actions that might trigger messages
    const playerUnits = units.filter(u => u.team === 'PLAYER' && u.hp > 0);
    const playerSettlements = settlements.filter(s => s && s.owner === 'PLAYER');
    
    // Occasionally send threats or comments based on player power
    if (Math.random() < 0.1) { // 10% chance per turn per AI
      const playerPower = calculateFactionPower('PLAYER');
      const aiPower = calculateFactionPower(aiTeam);
      
      if (playerPower > aiPower * 1.3) {
        // Player is getting strong
        const messages = [
          "Your expansion does not go unnoticed. Perhaps it's time we reconsidered our relationship.",
          "Your growing strength is... concerning. Tread carefully.",
          "Impressive military buildup. Are you preparing for something?"
        ];
        addAIMessage(aiTeam, messages[Math.floor(Math.random() * messages.length)], 'POWER_WARNING');
      } else if (aiPower > playerPower * 1.5) {
        // AI is dominant
        const messages = [
          "Your realm seems quite... vulnerable. Perhaps we should discuss terms.",
          "My armies grow strong while yours remain weak. Consider this a warning.",
          "The balance of power has shifted. You would be wise to seek our friendship."
        ];
        if (personality.type === 'AGGRESSIVE') {
          addAIMessage(aiTeam, messages[Math.floor(Math.random() * messages.length)], 'DOMINANCE_FLEX');
        }
      }
    }
  });
}

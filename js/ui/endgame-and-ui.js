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
    startIntroScenario(false);
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
  let art=document.getElementById('endScreenArtwork');
  if(!art){art=document.createElement('img');art.id='endScreenArtwork';art.alt='';endScreen.prepend(art);}
  art.src=won?'assets/victory.jpg':'assets/defeat.jpg';
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
  if(typeof Endless!=='undefined'&&Endless.active){Endless.restart();return;}
  if (typeof OnlineMatch !== 'undefined' && OnlineMatch.active) return;
  hideEndScreen();
  if (activeScenarioSnapshot) {
    applyLevelData(clonePlain(activeScenarioSnapshot));
  } else if (campaignMode.active) {
    loadCurrentScenario();
  } else if (lastPlayedSavedLevelIndex !== null) {
    loadSavedLevel(lastPlayedSavedLevelIndex);
  } else {
    setupGame();
  }
}

function teamHasLife(team) {
  return units.some(u => u.team === team && u.hp > 0 && !u.rogue && !u.ruins) || settlements.some(s => s && s.owner === team);
}

function isTeamConquered(team) {
  return !units.some(u => u.team === team && u.hp > 0 && !u.rogue && !u.ruins) && !settlements.some(s => s && s.owner === team);
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
  const enemies = getActiveTeams().filter(team => team !== 'PLAYER' && !areFriendlyTeams('PLAYER', team));
  const playerAlive = teamHasLife('PLAYER');
  
  if (!playerAlive) {
    return { outcome: 'defeat', explanation: 'You lost all surviving units and controlled settlements.' };
  }
  
  switch (vc.type) {
    case 'CAPTURE_TOWN':
      if (settlements[vc.holdRow * COLS + vc.holdCol]?.owner === 'PLAYER') return {outcome:'victory', explanation:`You captured ${vc.targetName || 'the objective town'}.`};
      break;
    case 'KILL_CROWN':
      if (currentVictoryCondition.crownFallenTeams?.includes(vc.targetTeam) || !units.some(u=>u.id===vc.targetUnitId && u.hp>0)) return {outcome:'victory', explanation:`The enemy Crown has fallen. The mission is complete.`};
      break;
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
      if (!vc.targetUnitId) {
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
        return { outcome: 'defeat', explanation: `${getTeamDisplayName(target.team)} ${getUnitDisplayName(target)} survived past turn ${vc.killTurnLimit}.` };
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
    const hasUnits = units.some(u => u.team === team && u.hp > 0 && !u.rogue && !u.ruins);
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
      units: units.filter(u => u.team === team && u.hp > 0 && !u.rogue && !u.ruins).length,
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
  if(typeof Endless!=='undefined'&&Endless.active){Endless.check();return;}
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
  if(typeof Territory!=='undefined')Territory.render();
  if(typeof markScenarioPlaying==='function'&&!isEditorMode&&(turnNumber>1||units.some(u=>!u.ruins&&!u.rogue&&(u.hasMoved||u.hasActed))))markScenarioPlaying();
  if(typeof BattleGuide!=='undefined')BattleGuide.refresh();
  if(typeof Endless!=='undefined')Endless.refresh();
  const modeSummary=document.getElementById("modeSummary");
  if(modeSummary)modeSummary.textContent=typeof Endless!=='undefined'&&Endless.active?(typeof OnlineMatch!=='undefined'&&OnlineMatch.coop?'Co-op Endless':'Endless Mode'):opponentType==="HUMAN"?"Online match":"vs AI";
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
  const researchBanner=select('#bannerResearchPoints');
  if(researchBanner)researchBanner.html(String(getResearchPoints(bannerTeam)));
  
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
    const xpDisplay = xpProgress.nextRank !== 'Max Level' ? ` • ⭐ ${xpProgress.current}/${xpProgress.needed}` : ' • Max Level';
    
    selNameEl.elt.textContent = unitName;
    
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
    
    selDetailsEl.html(`🚩 ${getTeamDisplayName(selectedUnit.team)} • 👣${selectedUnit.move} • 🎯${selectedUnit.atkRange} • 💰${costDisplay}${xpDisplay}`);
    if(selectedUnit.name==='Crown')selDetailsEl.html('👑 Crown • 2 grassland / 1 other terrain • Cannot attack or be bought • Adjacent friendly units: +25% defense, +10% attack • Assassin damage ×2 • Protect your Crown!');
    if(typeof BattleGuide!=='undefined')selDetailsEl.html(BattleGuide.unitDetails(selectedUnit));
    selHPEl.style('width',(selectedUnit.hp/selectedUnit.maxHp*100)+"%");
    selNumsEl.html(`❤️ ${selectedUnit.hp}/${selectedUnit.maxHp} • 🔥 ${selectedUnit.morale} (${moraleLabel(selectedUnit)})`);

  } else {
    selNameEl.html("No unit selected"); selDetailsEl.html("Click a friendly unit to select it.");
    selHPEl.style('width',"0%"); selNumsEl.html("HP —");
  }
  // Unit list removed per user request
  // Keep unit actions present so unavailable actions remain discoverable.
  try {
    const localTurn = currentTeam === getLocalPlayableTeam();
    const canAct = localTurn && !gameOver && !isEditorMode &&
      (typeof OnlineMatch === 'undefined' || OnlineMatch.canAct());
    const friendlyUnit = selectedUnit && selectedUnit.team === currentTeam && selectedUnit.hp > 0;
    if (!canAct && buildMode) { buildMode = false; buildModeUnitId = null; }
    let buildWidget = document.getElementById('buildWidget');
    if (!buildWidget) {
      buildWidget = document.createElement('button');
      buildWidget.id = 'buildWidget'; buildWidget.type = 'button';
      buildWidget.innerHTML = '<img src="assets/ui/fortress-button.png" alt="" draggable="false">';
      buildWidget.setAttribute('aria-label', 'Build fortresses and ships');
      buildWidget.onclick = function() {
        if (this.disabled) return;
        buildMode = !buildMode;
        buildModeUnitId = buildMode && selectedUnit ? selectedUnit.id : null;
        if (buildMode) selectedUnit = null;
        updateUI();
      };
      (document.getElementById('unitActions') || document.body).appendChild(buildWidget);
    }
    const canBuyBuilding = ['Stockade', 'Castle', 'Heavy Fortress', 'Sloop', 'Man-of-War', 'Battleship']
      .some(name => UNIT_TEMPLATES[name] && isUnitUnlocked(getLocalPlayableTeam(),name) && canAfford(getLocalPlayableTeam(), getEffectiveUnitCostForTeam(getLocalPlayableTeam(),name)));
    buildWidget.disabled = !canAct || (!buildMode && (!friendlyUnit || selectedUnit.morale <= 0 || !canBuyBuilding));
    buildWidget.title = !canAct ? 'Build: wait for your turn' : buildMode ? 'Cancel building' :
      !friendlyUnit ? 'Build: select a friendly unit' : selectedUnit.morale <= 0 ? 'Build: select a unit with morale' :
      !canBuyBuilding ? 'Build: requires an unlocked doctrine and sufficient resources' : 'Build fortresses and ships';
    buildWidget.setAttribute('aria-pressed', String(buildMode));

    let waterUpgradeWidget = document.getElementById('waterUpgradeWidget');
    if (!waterUpgradeWidget) {
      waterUpgradeWidget = document.createElement('button');
      waterUpgradeWidget.id = 'waterUpgradeWidget'; waterUpgradeWidget.type = 'button';
      waterUpgradeWidget.innerHTML = '<img src="assets/ui/anchor-button.png" alt="" draggable="false">';
      waterUpgradeWidget.onclick = function() { if (!this.disabled) upgradeSelectedUnitToWater(); };
      (document.getElementById('unitActions') || document.body).appendChild(waterUpgradeWidget);
    }
    const eligible = friendlyUnit && !isFortressUnit(selectedUnit) && selectedUnit.name !== 'Dragon';
    const upgraded = !!(friendlyUnit && selectedUnit.isWaterUnit);
    waterUpgradeWidget.disabled = !canAct || !eligible || upgraded || getGold(currentTeam) < 2;
    waterUpgradeWidget.title = !canAct ? 'Anchor: wait for your turn' : !friendlyUnit ? 'Anchor: select a friendly unit' :
      !eligible ? 'This unit cannot be anchored' : upgraded ? 'Water unit: already upgraded' :
      getGold(currentTeam) < 2 ? 'Water Upgrade (Need 2 Gold)' : 'Water Upgrade (2 Gold)';
    waterUpgradeWidget.setAttribute('aria-label', waterUpgradeWidget.title);
    waterUpgradeWidget.setAttribute('aria-pressed', String(upgraded));
  } catch(e) { console.warn('Could not update unit actions', e); }

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

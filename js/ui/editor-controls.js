// Warborn source split from the original game.js.
// Section: js/ui/editor-controls.js

function initializeResourcesForActiveTeams() {
  const activeTeams = getActiveTeams();
  
  // Initialize resources for all active teams
  activeTeams.forEach(team => {
    if (!(team in resources)) {
      resources[team] = { gold: 0, materials: 0 };
    }
    if (!(team in startingResources)) {
      startingResources[team] = { gold: 0, materials: 0 }; // No starting bonus
    }
  });
  
  // Clean up resources for inactive teams
  Object.keys(resources).forEach(team => {
    if (!activeTeams.includes(team)) {
      delete resources[team];
    }
  });
}

function calculateTurnOrder() {
  turnOrder = typeof OnlineMatch !== 'undefined' && OnlineMatch.playing ? [...OnlineMatch.turnOrder] : getActiveTeams();
  // Ensure currentTeam is in the turn order
  if (!turnOrder.includes(currentTeam)) {
    currentTeam = turnOrder[0]; // Reset to first team if current team is invalid
  }
  currentTurnIndex = turnOrder.indexOf(currentTeam);
}

function setAIPlayerCount(count) {
  count = Math.max(1, Math.min(maxAIPlayers, count));
  if (count !== currentAIPlayers) {
    console.log(`Changing AI player count from ${currentAIPlayers} to ${count}`);
    currentAIPlayers = count;
    initializeResourcesForActiveTeams();
    calculateTurnOrder();
    if (hasAIDiplomacy()) ensureDiplomacyForActiveTeams();
    
    // Update learning AI status based on whether humans are present
    if (hasHumanPlayers() && !LEARNING_AI.enabled) {
      LEARNING_AI.enabled = true;
      console.log('Auto-enabled Learning AI due to human player presence');
    } else if (!hasHumanPlayers() && LEARNING_AI.enabled) {
      console.log('Learning AI remains enabled but will not record AI vs AI games');
    }
    
    updateUI();
  }
}

// ---------- Collapsible Sections ----------
function toggleCollapsible(sectionId) {
  const content = document.getElementById(sectionId + 'Content');
  const arrow = document.getElementById(sectionId + 'Arrow');
  
  if (content.classList.contains('collapsed')) {
    // Expand
    content.classList.remove('collapsed');
    arrow.classList.remove('collapsed');
    arrow.textContent = '▼';
  } else {
    // Collapse
    content.classList.add('collapsed');
    arrow.classList.add('collapsed');
    arrow.textContent = '▶';
  }
}

function initializeCollapsibleSections() {
  // Set initial states - you can customize which sections start collapsed
  const defaultCollapsedSections = ['terrain', 'settlements', 'savedLevels']; // Start with terrain, settlements, and saved levels collapsed
  
  // Check if we have AI players - if so, expand diplomacy section by default
  const activeTeams = getActiveTeams();
  const hasAIPlayers = activeTeams.some(team => team !== 'PLAYER' && team !== 'PLAYER2' && isAITeam(team));
  
  if (!hasAIPlayers) {
    defaultCollapsedSections.push('diplomacy'); // Collapse diplomacy if no AI players
  } else {
    const diplomacyContent = document.getElementById('diplomacyContent');
    const diplomacyArrow = document.getElementById('diplomacyArrow');
    if (diplomacyContent) diplomacyContent.classList.remove('collapsed');
    if (diplomacyArrow) {
      diplomacyArrow.classList.remove('collapsed');
      diplomacyArrow.textContent = '▼';
    }
  }
  
  defaultCollapsedSections.forEach(sectionId => {
    const content = document.getElementById(sectionId + 'Content');
    const arrow = document.getElementById(sectionId + 'Arrow');
    if (content && arrow) {
      content.classList.add('collapsed');
      arrow.classList.add('collapsed');
      arrow.textContent = '▶';
    }
  });
}

// Learning AI Control Functions
function toggleLearningAI() {
  LEARNING_AI.enabled = !LEARNING_AI.enabled;
  
  const btn = document.getElementById('enableLearningBtn');
  const status = document.getElementById('learningStatus');
  
  if (LEARNING_AI.enabled) {
    btn.textContent = 'Disable Learning';
    btn.style.background = '#ff6b6b';
    status.textContent = 'Active - Observing gameplay';
    status.style.color = '#4ecdc4';
    
    // Initialize current game record
    LEARNING_AI.currentGameRecord = {
      moves: [],
      startState: captureBoardState(),
      winner: null,
      gameLength: 0
    };
    
    console.log('Learning AI enabled - will observe and learn from gameplay');
  } else {
    btn.textContent = 'Enable Learning';
    btn.style.background = '';
    status.textContent = 'Disabled';
    status.style.color = '#888';
    console.log('Learning AI disabled');
  }
  
  updateLearningStats();
}

function updateLearningStats() {
  const stats = document.getElementById('learningStats');
  if (stats) {
    const gamesRecorded = LEARNING_AI.gameplayData.length;
    const totalPatterns = LEARNING_AI.patterns.openings.size + 
                         LEARNING_AI.patterns.tactics.size + 
                         LEARNING_AI.patterns.strategies.size + 
                         LEARNING_AI.patterns.responses.size;
    
    stats.textContent = `Games recorded: ${gamesRecorded} | Patterns learned: ${totalPatterns}`;
  }
}

// Learning AI Data Persistence Functions
function saveLearningAIData() {
  try {
    const learningData = {
      version: '1.0',
      enabled: LEARNING_AI.enabled,
      gameplayData: LEARNING_AI.gameplayData,
      patterns: {
        openings: Array.from(LEARNING_AI.patterns.openings.entries()),
        tactics: Array.from(LEARNING_AI.patterns.tactics.entries()),
        strategies: Array.from(LEARNING_AI.patterns.strategies.entries()),
        responses: Array.from(LEARNING_AI.patterns.responses.entries())
      },
      lastSaved: Date.now()
    };
    
    localStorage.setItem('learningAI_Data', JSON.stringify(learningData));
    
    // Create backup every 5 saves or when significant data is present
    const saveCount = parseInt(localStorage.getItem('learningAI_SaveCount') || '0') + 1;
    localStorage.setItem('learningAI_SaveCount', saveCount.toString());
    
    if (saveCount % 5 === 0 || LEARNING_AI.gameplayData.length >= 10) {
      createLearningDataBackup(learningData, saveCount);
    }
    
    console.log(`Learning AI data saved successfully (save #${saveCount})`);
    
    // Show save confirmation in UI
    const status = document.getElementById('learningStatus');
    if (status) {
      const originalText = status.textContent;
      status.textContent = 'Data saved!';
      status.style.color = '#4ecdc4';
      setTimeout(() => {
        status.textContent = originalText;
        status.style.color = LEARNING_AI.enabled ? '#4ecdc4' : '#888';
      }, 2000);
    }
  } catch (error) {
    console.error('Failed to save Learning AI data:', error);
  }
}

function loadLearningAIData() {
  try {
    const savedData = localStorage.getItem('learningAI_Data');
    if (!savedData) {
      console.log('No saved Learning AI data found');
      return false;
    }
    
    const learningData = JSON.parse(savedData);
    const version = learningData.version || '1.0';
    console.log(`Loading Learning AI data (version ${version})`);
    
    // Data validation and migration
    if (!validateLearningData(learningData)) {
      console.warn('Learning AI data failed validation, skipping load');
      return false;
    }
    
    // Migrate data if needed for newer versions
    const migratedData = migrateLearningData(learningData, version);
    
    // Restore gameplay data
    LEARNING_AI.gameplayData = migratedData.gameplayData || [];
    
    // Restore patterns from arrays back to Maps
    LEARNING_AI.patterns.openings = new Map(migratedData.patterns.openings || []);
    LEARNING_AI.patterns.tactics = new Map(migratedData.patterns.tactics || []);
    LEARNING_AI.patterns.strategies = new Map(migratedData.patterns.strategies || []);
    LEARNING_AI.patterns.responses = new Map(migratedData.patterns.responses || []);
    
    const gamesCount = LEARNING_AI.gameplayData.length;
    const patternsCount = getTotalPatternsCount();
    
    console.log(`Loaded Learning AI data: ${gamesCount} games, ${patternsCount} patterns`);
    
    // Update UI to reflect loaded data
    updateLearningStats();
    
    // Show load confirmation if significant data was loaded
    if (gamesCount > 0 || patternsCount > 0) {
      const stats = document.getElementById('learningStats');
      if (stats) {
        const originalText = stats.textContent;
        stats.textContent = `Data loaded: ${gamesCount} games, ${patternsCount} patterns`;
        setTimeout(() => updateLearningStats(), 3000);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to load Learning AI data:', error);
    
    // Try to recover by clearing corrupted data
    const shouldClear = confirm(
      'Learning AI data appears to be corrupted. Would you like to clear it and start fresh?\n\n' +
      'This will permanently delete all saved learning data.'
    );
    
    if (shouldClear) {
      localStorage.removeItem('learningAI_Data');
      console.log('Cleared corrupted Learning AI data');
    }
    
    return false;
  }
}

function validateLearningData(data) {
  // Check required structure
  if (!data || typeof data !== 'object') return false;
  if (!data.patterns || typeof data.patterns !== 'object') return false;
  if (!Array.isArray(data.gameplayData)) return false;
  
  // Check patterns structure
  const requiredPatterns = ['openings', 'tactics', 'strategies', 'responses'];
  for (const pattern of requiredPatterns) {
    if (!Array.isArray(data.patterns[pattern])) return false;
  }
  
  return true;
}

function migrateLearningData(data, version) {
  // Currently only version 1.0, but this allows for future migrations
  if (version === '1.0') {
    return data; // No migration needed
  }
  
  // Future version migrations would go here
  console.log(`Migrating Learning AI data from version ${version} to 1.0`);
  return data;
}

function getTotalPatternsCount() {
  return LEARNING_AI.patterns.openings.size + 
         LEARNING_AI.patterns.tactics.size + 
         LEARNING_AI.patterns.strategies.size + 
         LEARNING_AI.patterns.responses.size;
}

function clearLearningAIData() {
  if (confirm('Are you sure you want to clear all Learning AI data? This cannot be undone.')) {
    LEARNING_AI.gameplayData = [];
    LEARNING_AI.patterns.openings.clear();
    LEARNING_AI.patterns.tactics.clear();
    LEARNING_AI.patterns.strategies.clear();
    LEARNING_AI.patterns.responses.clear();
    LEARNING_AI.currentGameRecord = {
      moves: [],
      startState: null,
      winner: null,
      gameLength: 0
    };
    
    localStorage.removeItem('learningAI_Data');
    updateLearningStats();
    
    console.log('Learning AI data cleared');
    
    // Show clear confirmation
    const stats = document.getElementById('learningStats');
    if (stats) {
      stats.textContent = 'Data cleared - ready for new learning';
      setTimeout(() => updateLearningStats(), 2000);
    }
  }
}

function createLearningDataBackup(data, saveCount) {
  try {
    const backupKey = `learningAI_Backup_${saveCount}`;
    const backupData = {
      ...data,
      backupCreated: Date.now(),
      backupSaveCount: saveCount
    };
    
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    
    // Keep only the 3 most recent backups to save space
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys.filter(key => key.startsWith('learningAI_Backup_'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[2]);
        const numB = parseInt(b.split('_')[2]);
        return numB - numA; // Sort descending
      });
    
    // Remove old backups beyond the 3 most recent
    backupKeys.slice(3).forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed old Learning AI backup: ${key}`);
    });
    
    console.log(`Created Learning AI backup: ${backupKey}`);
  } catch (error) {
    console.warn('Failed to create Learning AI backup:', error);
  }
}

function restoreFromBackup() {
  try {
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys.filter(key => key.startsWith('learningAI_Backup_'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[2]);
        const numB = parseInt(b.split('_')[2]);
        return numB - numA; // Sort descending (most recent first)
      });
    
    if (backupKeys.length === 0) {
      showPopup('No Backups', 'No backups found', 'info');
      return;
    }
    
    const selectedBackup = backupKeys[0]; // Use most recent backup
    const backupData = JSON.parse(localStorage.getItem(selectedBackup));
    const backupDate = new Date(backupData.backupCreated).toLocaleString();
    
    if (confirm(`Restore from backup created on ${backupDate}?\n\nThis will replace all current Learning AI data.`)) {
      // Remove backup-specific metadata
      delete backupData.backupCreated;
      delete backupData.backupSaveCount;
      
      // Restore the data
      localStorage.setItem('learningAI_Data', JSON.stringify(backupData));
      
      // Reload the data
      loadLearningAIData();
      
      showPopup('Backup Restored', `Successfully restored Learning AI data from backup created on ${backupDate}`, 'success');
      console.log(`Restored Learning AI data from backup: ${selectedBackup}`);
    }
  } catch (error) {
    console.error('Failed to restore from backup:', error);
    showPopup('Restore Failed', 'Failed to restore backup: ' + error.message, 'error');
  }
}

// Learning AI Data Export/Import Functions
function exportLearningAIData() {
  try {
    const learningData = {
      version: '1.0',
      exported: new Date().toISOString(),
      gameplayData: LEARNING_AI.gameplayData,
      patterns: {
        openings: Array.from(LEARNING_AI.patterns.openings.entries()),
        tactics: Array.from(LEARNING_AI.patterns.tactics.entries()),
        strategies: Array.from(LEARNING_AI.patterns.strategies.entries()),
        responses: Array.from(LEARNING_AI.patterns.responses.entries())
      },
      stats: {
        gamesRecorded: LEARNING_AI.gameplayData.length,
        totalPatterns: getTotalPatternsCount()
      }
    };
    
    const dataStr = JSON.stringify(learningData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `learningAI_data_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    
    console.log('Learning AI data exported successfully');
  } catch (error) {
    console.error('Failed to export Learning AI data:', error);
    showPopup('Export Failed', 'Failed to export data: ' + error.message, 'error');
  }
}

function importLearningAIData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate data structure
        if (!importedData.patterns || !importedData.gameplayData) {
          throw new Error('Invalid Learning AI data format');
        }
        
        // Ask user about merge vs replace
        const shouldMerge = confirm(
          `Import ${importedData.stats?.gamesRecorded || 0} games and ${importedData.stats?.totalPatterns || 0} patterns?\n\n` +
          'OK = Merge with existing data\n' +
          'Cancel = Replace existing data'
        );
        
        if (shouldMerge) {
          // Merge with existing data
          LEARNING_AI.gameplayData.push(...importedData.gameplayData);
          
          // Merge patterns
          importedData.patterns.openings.forEach(([key, value]) => {
            LEARNING_AI.patterns.openings.set(key, value);
          });
          importedData.patterns.tactics.forEach(([key, value]) => {
            LEARNING_AI.patterns.tactics.set(key, value);
          });
          importedData.patterns.strategies.forEach(([key, value]) => {
            LEARNING_AI.patterns.strategies.set(key, value);
          });
          importedData.patterns.responses.forEach(([key, value]) => {
            LEARNING_AI.patterns.responses.set(key, value);
          });
        } else {
          // Replace existing data
          LEARNING_AI.gameplayData = importedData.gameplayData || [];
          LEARNING_AI.patterns.openings = new Map(importedData.patterns.openings || []);
          LEARNING_AI.patterns.tactics = new Map(importedData.patterns.tactics || []);
          LEARNING_AI.patterns.strategies = new Map(importedData.patterns.strategies || []);
          LEARNING_AI.patterns.responses = new Map(importedData.patterns.responses || []);
        }
        
        // Save and update UI
        saveLearningAIData();
        updateLearningStats();
        
        console.log('Learning AI data imported successfully');
        showPopup('Data Imported', `Successfully imported ${importedData.stats?.gamesRecorded || 0} games and ${importedData.stats?.totalPatterns || 0} patterns!`, 'success');
        
      } catch (error) {
        console.error('Failed to import Learning AI data:', error);
        showPopup('Import Failed', 'Failed to import data: ' + error.message, 'error');
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

// ---------- Game Mode Management ----------
function switchGameMode(newMode) {
  console.log('Switching game mode from', gameMode, 'to', newMode);
  gameMode = newMode;
  
  // Show/hide learning AI controls
  const learningControls = document.getElementById('learningAIControls');
  if (learningControls) {
    if (newMode === 'learning-ai' || newMode === 'local-2p') {
      learningControls.style.display = 'block';
    } else {
      learningControls.style.display = 'none';
    }
  }
  
  // Auto-enable learning for modes with human players
  if (newMode === 'vs-ai' || newMode === 'local-2p' || newMode === 'online-2p' || newMode === 'learning-ai') {
    if (!LEARNING_AI.enabled) {
      LEARNING_AI.enabled = true;
      console.log('Auto-enabled Learning AI for human player mode');
    }
  }
  
  // Show/hide AI player count controls
  const aiPlayerControls = document.getElementById('aiPlayerControls');
  if (aiPlayerControls) {
    if (newMode === 'vs-ai') {
      aiPlayerControls.style.display = 'flex';
    } else {
      aiPlayerControls.style.display = 'none';
    }
  }

  const onlineControls = document.getElementById('onlineMultiplayerControls');
  if (onlineControls) {
    onlineControls.style.display = newMode === 'online-2p' ? 'block' : 'none';
  }
  
  // Show/hide campaign controls
  const campaignControls = document.getElementById('campaignControls');
  if (campaignControls) {
    if (newMode === 'campaign') {
      campaignControls.style.display = 'block';
      if (!campaignMode.active) {
        campaignMode.active = true;
        campaignMode.currentScenarioIndex = 0;
      }
      updateCampaignUI();
    } else {
      campaignControls.style.display = 'none';
      campaignMode.active = false;
    }
  }
  
  // Update opponentType based on game mode
  if (gameMode === 'vs-ai') {
    opponentType = 'AI';
  } else if (gameMode === 'local-2p') {
    opponentType = 'LOCAL_2P';
  } else if (gameMode === 'online-2p') {
    opponentType = 'HUMAN';
    try {
      wireOnlineMultiplayerControls();
      updateOnlineRoomFields();
      setRelayStatus('Choose Host or Join', '#d7c287');
    } catch(e) {}
  } else if (gameMode === 'learning-ai') {
    opponentType = 'LOCAL_2P'; // Learning AI observes local human vs human games
    // Auto-enable learning AI when this mode is selected
    if (!LEARNING_AI.enabled) {
      setTimeout(() => toggleLearningAI(), 100); // Delay to ensure UI is ready
    }
    // Set up for 2-player local mode
    currentAIPlayers = 0;
  } else if (gameMode === 'campaign') {
    opponentType = 'AI';
    if (!campaignMode.active) {
      campaignMode.active = true;
      loadCurrentScenario();
    }
  }
  
  console.log('DEBUG: Updated opponentType to', opponentType);
  
  // If we have existing units, convert their teams instead of resetting the game
  if (units && units.length > 0) {
    if (gameMode === 'local-2p') {
      units.forEach(unit => {
        if (unit.team === 'AI') {
          console.log('DEBUG: Converting AI unit', unit.name, 'to PLAYER2');
          unit.team = 'PLAYER2';
        }
      });
      console.log('DEBUG: Team conversion complete, updating UI');
      updateUI();
    }
    else if (gameMode === 'vs-ai') {
      units.forEach(unit => {
        if (unit.team === 'PLAYER2') {
          console.log('DEBUG: Converting PLAYER2 unit', unit.name, 'to AI');
          unit.team = 'AI';
        }
      });
      updateUI();
    }
    else {
      // For online multiplayer, reset the game
      setupGame();
    }
  } else {
    // No existing units, do a full setup
    setupGame();
  }
  
  // Show/hide convert button based on mode
  const convertBtn = select('#convertTeamsBtn');
  if (convertBtn) {
    convertBtn.style('display', gameMode === 'local-2p' ? 'inline-block' : 'none');
  }
  
  // Update URL to reflect new mode
  try {
    const url = new URL(window.location);
    url.searchParams.set('mode', newMode);
    if (newMode === 'vs-ai') {
      url.searchParams.set('opponent', 'AI');
    } else if (newMode === 'local-2p') {
      url.searchParams.set('opponent', 'LOCAL_2P');
    } else if (newMode === 'online-2p') {
      url.searchParams.set('opponent', 'HUMAN');
    }
    window.history.replaceState({}, '', url);
  } catch(e) { /* ignore for file:// */ }
  
  // Update collapsible sections based on new game mode
  initializeCollapsibleSections();
  
  console.log('Game mode switched to:', gameMode, 'opponentType:', opponentType);
}

function showTurnNotification(team) {
  // Create a prominent turn notification for local 2-player games
  const playerName = team === 'PLAYER' ? 'Player 1' : 'Player 2';
  const color = getTeamColorHex(team);
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'turnNotification';
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${color};
    color: white;
    padding: 20px 40px;
    border-radius: 12px;
    font-size: 24px;
    font-weight: bold;
    z-index: 15000;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    text-align: center;
    animation: fadeInOut 3s ease-in-out;
  `;
  notification.innerHTML = `
    <div>${playerName}'s Turn</div>
    <div style="font-size: 14px; margin-top: 8px; opacity: 0.8;">
      Pass the device to ${team === 'PLAYER' ? 'Player 1' : 'Player 2'}
    </div>
  `;
  
  // Add CSS animation if it doesn't exist
  if (!document.getElementById('turnNotificationStyle')) {
    const style = document.createElement('style');
    style.id = 'turnNotificationStyle';
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Remove any existing notification
  const existing = document.getElementById('turnNotification');
  if (existing) existing.remove();
  
  // Add to page
  document.body.appendChild(notification);
  
  // Remove after animation completes
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

function setPlacingUnit(type, team) {
  console.log('Setting placing unit:', { type, team });
  
  // Reset all button styles and clear settlement and terrain placing
  const buttons = [
    // Units
    'soldierBtn', 'archerBtn', 'knightBtn', 'catapultBtn', 'spearmanBtn',
    'swordsmanBtn', 'assassinBtn', 'dragonBtn', 'stockadeBtn', 'castleBtn', 'heavyFortressBtn',
    // Other buttons
    'hamletBtn', 'villageBtn', 'cityBtn', 'portBtn', 'clearSettlementBtn',
    'woodsBtn', 'mountainBtn', 'swampBtn', 'desertBtn', 'waterBtn', 'fountainBtn', 'farmBtn', 'bridgeBtn', 'clearTerrainBtn'
  ];
  buttons.forEach(id => { const el = select('#' + id); if (el) el.style('background', ''); });
  placingSettlement = null;
  placingTerrain = null;
  
  // If clicking the same unit type again, deselect it
  if (type === placingUnitType && team === placingUnitTeam) {
    console.log('Deselecting unit');
    placingUnitType = null;
    placingUnitTeam = null;
    if(select('#placingLabel')) select('#placingLabel').html('Selected: None');
  } else {
    console.log('Selecting new unit');
    placingUnitType = type;
    placingUnitTeam = team;
    // Highlight the selected button
    const btnId = type.toLowerCase() + 'Btn';
    select('#' + btnId).style('background', 'var(--accent)');
    if(select('#placingLabel')) select('#placingLabel').html('Selected: ' + type + ' (' + team + ')');
  }
}

function setPlacingSettlement(type) {
  console.log('Setting placing settlement:', type);
  
  // Reset all button styles and clear unit placing
  const buttons = ['soldierBtn', 'archerBtn', 'knightBtn', 'gruntBtn', 'skirmBtn', 'bruteBtn',
                  'hamletBtn', 'villageBtn', 'cityBtn', 'portBtn', 'clearSettlementBtn'];
  buttons.forEach(id => { const el = select('#' + id); if (el) el.style('background', ''); });
  placingUnitType = null;
  placingUnitTeam = null;
  
  // If clicking the same settlement type, deselect it
  if (type === placingSettlement) {
    placingSettlement = null;
    if(select('#placingLabel')) select('#placingLabel').html('Selected: None');
  } else {
    placingSettlement = type;  // Don't convert CLEAR to null anymore
    let btnId;
    // Map settlement types to button IDs
    switch(type) {
      case 'HAMLET': btnId = 'hamletBtn'; break;
      case 'VILLAGE': btnId = 'villageBtn'; break;
      case 'CITY': btnId = 'cityBtn'; break;
      case 'PORT': btnId = 'portBtn'; break;
      case 'CLEAR': btnId = 'clearSettlementBtn'; break;
      default: btnId = type.toLowerCase() + 'Btn'; break;
    }
    // Highlight the selected button, including Clear
    select('#' + btnId).style('background', 'var(--accent)');
    if(select('#placingLabel')) {
      const ownerText = type === 'CLEAR' ? '' : ` (${getTeamDisplayName(selectedTeam || 'PLAYER')})`;
      select('#placingLabel').html('Selected: ' + (type === 'CLEAR' ? 'Clear Settlement' : type + ownerText));
    }
  }
}

let placingSettlement = null;  // Add this near other state variables

function setTerrainType(type) {
  console.log('Setting placing terrain:', type);
  
  // Reset all button styles
  const buttons = ['soldierBtn', 'archerBtn', 'knightBtn', 'gruntBtn', 'skirmBtn', 'bruteBtn',
                  'hamletBtn', 'villageBtn', 'cityBtn', 'portBtn', 'clearSettlementBtn',
                  'woodsBtn', 'mountainBtn', 'swampBtn', 'desertBtn', 'waterBtn', 'fountainBtn', 'farmBtn', 'bridgeBtn', 'clearTerrainBtn'];
  buttons.forEach(id => { const el = select('#' + id); if (el) el.style('background', ''); });
  
  // Clear all placement states
  placingSettlement = null;
  placingUnitType = null;
  placingUnitTeam = null;
  
  // If clicking the same terrain type, deselect it
  if (type === placingTerrain) {
    placingTerrain = null;
    if(select('#placingLabel')) select('#placingLabel').html('Selected: None');
  } else {
    placingTerrain = type;
    let btnId;
    // Map terrain types to button IDs
    switch(type) {
      case 'WOODS': btnId = 'woodsBtn'; break;
      case 'MOUNTAIN': btnId = 'mountainBtn'; break;
      case 'CLEAR': btnId = 'clearTerrainBtn'; break;
      default: btnId = type.toLowerCase() + 'Btn'; break;
    }
    // Highlight the selected button
    select('#' + btnId).style('background', 'var(--accent)');
    const displayName = type === 'CLEAR' ? 'Clear Terrain' : type;
    if(select('#placingLabel')) select('#placingLabel').html('Selected: ' + displayName + ' <span style="color:#888;font-size:11px;">(Shift+click to fill map)</span>');
  }
}

function handleEditorClick(c, r, shiftKey = false) {
  console.log('Editor click:', { c, r, isEditorMode, placingUnitType, placingUnitTeam, placingSettlement, placingTerrain, shiftKey });
  
  // Check if click is within bounds
  if(c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  
  // Prevent duplicate editor actions at same location
  const now = Date.now();
  if (now - lastEditorAction.time < EDITOR_DEDUP_MS && 
      lastEditorAction.col === c && lastEditorAction.row === r) {
    console.log('Duplicate editor action prevented at', c, r);
    return;
  }
  
  const idx = r * COLS + c;
  
  // Handle settlement placement or clearing
  if (placingSettlement !== null) {
      if (placingSettlement === 'CLEAR') {
        // Clear mode: remove any existing settlement
        settlements[idx] = null;
      } else {
        // Place new settlement for the currently selected editor team.
        settlements[idx] = { type: placingSettlement, owner: selectedTeam || 'PLAYER' };
      }
    lastEditorAction = { time: now, col: c, row: r, action: 'settlement' };
    updateUI();
    return;
  }
  
  // Handle terrain placement or clearing
  if (placingTerrain !== null) {
    if (shiftKey) {
      // Shift-click: Fill entire map with selected terrain
      console.log('Shift-click detected: Filling entire map with', placingTerrain);
      for (let fillIdx = 0; fillIdx < ROWS * COLS; fillIdx++) {
        if (placingTerrain === 'CLEAR') {
          terrain[fillIdx] = null;
        } else {
          terrain[fillIdx] = placingTerrain;
        }
      }
      lastEditorAction = { time: now, col: -1, row: -1, action: 'terrain-fill' };
    } else {
      // Normal click: Place terrain on single tile
      if (placingTerrain === 'CLEAR') {
        // Clear mode: remove any existing terrain
        terrain[idx] = null;
      } else {
        // Place new terrain
        terrain[idx] = placingTerrain;
      }
      lastEditorAction = { time: now, col: c, row: r, action: 'terrain' };
    }
    updateUI();
    return;
  }

  const clicked = getUnitAt(c,r);
  if(clicked) {
    console.log('Removing unit:', clicked);
    // Remove unit when clicked in editor mode
    units = units.filter(u => u !== clicked);
    lastEditorAction = { time: now, col: c, row: r, action: 'removeUnit' };
    refreshVictoryEditorOptions();
  } else if(placingUnitType && placingUnitTeam) {
    console.log('Placing unit:', { type: placingUnitType, team: placingUnitTeam });
    console.log('Available unit templates:', Object.keys(UNIT_TEMPLATES));
    // Place new unit with appropriate stats based on unit type
    let opts = {};
    switch(placingUnitType) {
      case 'Archer':
        opts = {move:3, atkRange:2, dmg:20, maxHp:60};
        break;
      case 'Knight':
        opts = {move:2, atkRange:1, dmg:28, maxHp:120};
        break;
      case 'Grunt':
        opts = {dmg:18, maxHp:90};
        break;
      case 'Skirm':
        opts = {move:3, atkRange:2, dmg:16, maxHp:60};
        break;
      case 'Brute':
        opts = {dmg:34, maxHp:140};
        break;
      case 'Fortress':
        // Fortress is immobile, high HP, low damage
        opts = { move: 0, atkRange: 1, dmg: 10, maxHp: 150 };
        break;
      default: // Soldier
        opts = {};
    }
    const newUnit = makeUnit(placingUnitType, placingUnitTeam, c, r, opts);
    console.log('Created unit:', newUnit);
    console.log('Units array before push:', units.length);
    units.push(newUnit);
    console.log('Units array after push:', units.length);
    lastEditorAction = { time: now, col: c, row: r, action: 'placeUnit' };
    refreshVictoryEditorOptions();
  } else {
    console.log('Not placing unit. Reasons:', {
      placingUnitType: placingUnitType,
      placingUnitTeam: placingUnitTeam,
      clickedExistingUnit: !!clicked,
      editorMode: isEditorMode
    });
  }
  updateUI();
  // If we just placed a unit in editor mode, claim any settlement underneath
  if (!clicked && placingUnitType && placingUnitTeam) {
    claimSettlementAt(c, r, placingUnitTeam);
  }
}

function updateMapSize(delta) {
  const oldCols = COLS;
  const oldRows = ROWS;
  
  // Update the mapSize object first - allow much larger maps for scrollable gameplay
  mapSize.cols = constrain(mapSize.cols + delta, 4, 50);
  mapSize.rows = constrain(mapSize.rows + delta, 4, 50);
  
  // Update the global variables
  COLS = mapSize.cols;
  ROWS = mapSize.rows;
  
  // Update tile size to maintain constant board size
  TILE = BOARD_SIZE / COLS;
  updateHexSize();
  
  // Create new settlements and terrain arrays with new size
  const newSettlements = Array(COLS * ROWS).fill(null);
  const newTerrain = Array(COLS * ROWS).fill(null);
  
  // Copy over existing settlements and terrain that are still in bounds
  for(let r = 0; r < Math.min(oldRows, ROWS); r++) {
    for(let c = 0; c < Math.min(oldCols, COLS); c++) {
      const oldIdx = r * oldCols + c;
      const newIdx = r * COLS + c;
      newSettlements[newIdx] = settlements[oldIdx];
      newTerrain[newIdx] = terrain[oldIdx];
    }
  }
  settlements = newSettlements;
  terrain = newTerrain;
  
  resizeGameCanvas();
  select('#mapSizeLabel').html(`${mapSize.cols} x ${mapSize.rows}`);
  
  // Remove any units that would be outside the new bounds
  units = units.filter(u => u.col < COLS && u.row < ROWS);
  updateUI();
}

function updateAICount(delta) {
  const newCount = Math.max(1, Math.min(maxAIPlayers, currentAIPlayers + delta));
  if (newCount !== currentAIPlayers) {
    console.log(`Updating AI count from ${currentAIPlayers} to ${newCount}`);
    setAIPlayerCount(newCount);
    
    // Update team selector in editor to include new AI teams
    updateTeamSelector();
  }
}

function updateTeamSelector() {
  const teamSelect = select('#teamSelect');
  if (teamSelect) {
    const previousValue = selectedTeam || teamSelect.value();
    let options = '<option value="PLAYER">Player</option>';
    
    if (opponentType === 'HUMAN' || opponentType === 'LOCAL_2P') {
      options += '<option value="PLAYER2">Player 2</option>';
    } else {
      // Add options for all active AI teams
      for (let i = 0; i < currentAIPlayers; i++) {
        const teamName = aiTeamNames[i];
        const displayName = `AI${i + 1}`;
        options += `<option value="${teamName}">${displayName}</option>`;
      }
    }
    
    teamSelect.html(options);
    
    // Reset selected team if it's no longer valid
    const activeTeams = getActiveTeams();
    if (!activeTeams.includes(previousValue)) {
      teamSelect.value('PLAYER');
      selectedTeam = 'PLAYER';
    } else {
      teamSelect.value(previousValue);
      selectedTeam = previousValue;
    }
    refreshVictoryEditorOptions();
  }
}

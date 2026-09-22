// Warborn source split from the original game.js.
// Section: js/input/mouse-actions.js

// ---------- Input ----------
// Use mousePressed to update inspectedTerrain briefly (no action) and
// use mouseClicked (fires on release) for actual game/editor clicks so UI menus
// open reliably after a click instead of only while the mouse is held.
function mousePressed(event){
  if (isMenuBlockingGameInput()) return;
  
  // Store mouse position for dragging
  lastMouseX = mouseX;
  lastMouseY = mouseY;

  const canvasEl = document.querySelector('#game canvas');
  const overCanvas = canvasEl && mouseX >= 0 && mouseY >= 0 && mouseX <= width && mouseY <= height;
  const eventStartedOnCanvas = !event || !event.target || event.target === canvasEl;
  if (overCanvas && eventStartedOnCanvas && (mouseButton === LEFT || mouseButton === CENTER || mouseButton === RIGHT)) {
    mapCanvasFocused = true;
    isDragging = true;
    suppressClickAfterDrag = false;
    if (mouseButton === RIGHT) return false; // Prevent context menu
  }
  
  // Update inspected terrain for quick hover-like feedback (no action taken here)
  if(mouseX<OFFSET||mouseY<OFFSET) return;
  
  const worldCoords = mouseToWorldCoords(mouseX, mouseY);
  if(worldCoords.col < 0 || worldCoords.col >= COLS || worldCoords.row < 0 || worldCoords.row >= ROWS) return;
  inspectedTerrain = { col: worldCoords.col, row: worldCoords.row };
}

// Debounce system to prevent rapid-fire clicks from causing issues
let lastActionTime = 0;
let lastActionCoords = { col: -1, row: -1 };
let gameInputBlockedUntil = 0;
const ACTION_DEBOUNCE_MS = 150; // Minimum time between actions
const SAME_TILE_DEBOUNCE_MS = 300; // Extra protection for same tile clicks

function isMenuBlockingGameInput() {
  if (typeof OnlineMatch !== "undefined" && OnlineMatch.blocksMapInput()) return true;
  const mainMenu = document.getElementById('mainMenu');
  const endScreen = document.getElementById('endScreen');
  return Date.now() < gameInputBlockedUntil ||
    (mainMenu && !mainMenu.classList.contains('hidden')) ||
    (endScreen && endScreen.classList.contains('visible'));
}

function isActionAllowed(col = -1, row = -1) {
  const now = Date.now();
  const timeSinceLastAction = now - lastActionTime;
  
  // If clicking the same tile recently, apply longer debounce
  if (col === lastActionCoords.col && row === lastActionCoords.row) {
    return timeSinceLastAction >= SAME_TILE_DEBOUNCE_MS;
  }
  
  return timeSinceLastAction >= ACTION_DEBOUNCE_MS;
}

function recordAction(col = -1, row = -1) {
  lastActionTime = Date.now();
  lastActionCoords = { col, row };
}

function mouseClicked(){
  console.log('Mouse clicked:', { x: mouseX, y: mouseY, isEditorMode });
  if (isMenuBlockingGameInput()) return;
  if (suppressClickAfterDrag) {
    suppressClickAfterDrag = false;
    return;
  }
  if(mouseX<OFFSET||mouseY<OFFSET) return;
  
  // Convert screen coordinates to world coordinates using camera
  const worldCoords = mouseToWorldCoords(mouseX, mouseY);
  const c = worldCoords.col;
  const r = worldCoords.row;
  console.log('World coordinates:', { c, r, camera: { cameraX, cameraY } });
  if(c<0||c>=COLS||r<0||r>=ROWS) return;

  // Prevent duplicate handling if pointer events are also active
  if (isEventDuplicate(mouseX + OFFSET, mouseY + OFFSET)) {
    console.log('Mouse click is duplicate of pointer event, ignoring');
    return;
  }

  // Update inspected terrain
  inspectedTerrain = { col: c, row: r };
  console.log('Grid coordinates on click:', { c, r });
  
  // Additional debugging for hex coordinate issues
  if (useHexGrid) {
    const unitsAtPosition = units.filter(u => u.col === c && u.row === r && u.hp > 0);
    if (unitsAtPosition.length > 0) {
      console.log('DEBUG: Units found at clicked position:', unitsAtPosition.map(u => ({
        id: u.id,
        name: u.name,
        team: u.team,
        position: { col: u.col, row: u.row }
      })));
    }
    
    // Check for nearby units that might be incorrectly selected
    const nearbyUnits = units.filter(u => {
      const dist = hexDistance(c, r, u.col, u.row);
      return dist <= 1 && u.hp > 0;
    });
    if (nearbyUnits.length > 0) {
      console.log('DEBUG: Units within 1 hex of click:', nearbyUnits.map(u => ({
        id: u.id,
        name: u.name,
        team: u.team,
        position: { col: u.col, row: u.row },
        distance: hexDistance(c, r, u.col, u.row)
      })));
    }
  }
  
  if(isEditorMode) {
    console.log('Handling editor click via mouse');
    handleEditorClick(c, r, keyIsDown(SHIFT));
  } else {
    console.log('Handling game click via mouse');
    handleGridClick(c, r);
  }
}
// (editor click handler with placement exists earlier in the file)
function handleGridClick(c,r){
  if (typeof OnlineMatch !== "undefined" && !OnlineMatch.canAct()) return;
  console.log('DEBUG: handleGridClick called - pos:', c, r, 'currentTeam:', currentTeam, 'opponentType:', opponentType, 'gameMode:', gameMode);
  
  if(gameOver) {
    console.log('DEBUG: Game is over, ignoring click');
    return;
  }
  
  // Prevent rapid-fire actions that can cause state inconsistencies
  /*
  if (!isActionAllowed(c, r)) {
    console.log('Action blocked - too soon after last action or same tile click');
    return;
  }
  */
  // In multiplayer, validate it's this player's turn
  if (opponentType === 'HUMAN') {
    const canAct = (myRole === 'P1' && currentTeam === 'PLAYER') || 
                   (myRole === 'P2' && currentTeam === 'PLAYER2');
    if (!canAct) {
      console.log('Not your turn - ignoring click. Role:', myRole, 'currentTeam:', currentTeam);
      return;
    }
  } else if (opponentType === 'LOCAL_2P') {
    // Local 2-player mode - allow actions for the current team (no role restrictions)
    // Actions are controlled by currentTeam switching between PLAYER and PLAYER2
  } else {
    // Single player or vs AI - only allow PLAYER team actions
    if (currentTeam !== 'PLAYER') {
      console.log('DEBUG: Blocking action - not PLAYER turn in single-player/AI mode');
      return;
    }
  }
  const clicked=getUnitAt(c,r);
  console.log('DEBUG: Clicked unit:', clicked ? `${clicked.name} (team: ${clicked.team})` : 'none');
  
  // Check for settlement upgrade (Shift+Click on owned settlement)
  const idx = r * COLS + c;
  const s = settlements[idx];
  if (keyIsDown(SHIFT) && s && s.owner === currentTeam && !clicked) {
    console.log('DEBUG: Attempting settlement upgrade at', c, r);
    upgradeSettlement(c, r, currentTeam);
    return;
  }
  
  // Check for settlement interaction first: if tile is an owned settlement and empty,
  // open the spawn menu unless the currently selected unit can move there (then move it).
  console.log('DEBUG: Settlement interaction check - clicked:', !!clicked, 'settlement:', !!s, 'settlement owner:', s?.owner, 'currentTeam:', currentTeam);
  if(!clicked && s && s.owner === currentTeam){
    // If player has a unit selected that can move to this tile, prefer moving the unit
    if(selectedUnit && !selectedUnit.hasMoved && canMoveTo(selectedUnit, c, r)){
      recordAction(c, r); // Record this as a significant action
      
      // Create optimistic update for unit movement
      const actionId = createOptimisticUpdate('unitMove', {
        unitId: selectedUnit.id,
        fromCol: selectedUnit.col,
        fromRow: selectedUnit.row,
        toCol: c,
        toRow: r
      });
      
      selectedUnit.col = c; selectedUnit.row = r; selectedUnit.hasMoved = true;
      try { SoundManager.playMove(selectedUnit); } catch (e) {}
      
      // NEW: Immediate settlement capture check after movement
      checkSettlementCaptureAfterMove(selectedUnit, c, r);
      
      updateUI();
      try{ postGameState(actionId); } catch(e){}
      return;
    }
    // Otherwise open spawn menu
    openSpawnMenu(c, r, s);
    return;
  }
  // Check for Cleric healing before unit selection (cannot heal self)
  if(selectedUnit && selectedUnit.name === 'Cleric' && clicked && clicked.team === selectedUnit.team && 
     clicked.id !== selectedUnit.id && manhattan(selectedUnit.col,selectedUnit.row,c,r) <= selectedUnit.atkRange && !selectedUnit.hasActed && clicked.hp < clicked.maxHp){
    
    recordAction(c, r); // Record this as a significant action
    
    // Create optimistic update for healing
    const actionId = createOptimisticUpdate('unitHeal', {
      healerId: selectedUnit.id,
      targetId: clicked.id,
      healerCol: selectedUnit.col,
      healerRow: selectedUnit.row,
      targetCol: clicked.col,
      targetRow: clicked.row
    });
    
    console.log('HEAL CLICK - pre-heal', { healerId: selectedUnit.id, targetId: clicked.id, targetHP: clicked.hp, targetMaxHP: clicked.maxHp });
    selectedUnit.morale = Math.min(150, selectedUnit.morale + 5);
    const res = healUnit(selectedUnit, clicked) || {};
    console.log('HEAL CLICK - post-heal', { healerId: selectedUnit.id, targetId: clicked.id, targetHP: clicked.hp, didHeal: res.didHeal });
    
    // Mark acted
    if (selectedUnit) selectedUnit.hasActed = true;
    
    // Deselect
    selectedUnit = null;
    updateUI();
    try{ postGameState(actionId); } catch(e){}
    return;
  }
  
  if(clicked && clicked.team === currentTeam){
    console.log('DEBUG: Unit clicked - Team:', clicked.team, 'Current Team:', currentTeam, 'OpponentType:', opponentType);
    console.log('DEBUG: Selected unit details:', {
      id: clicked.id,
      name: clicked.name,
      position: { col: clicked.col, row: clicked.row },
      clickedPosition: { col: c, row: r },
      positionMatch: clicked.col === c && clicked.row === r
    });
    if (buildMode) { console.log('Build mode active — selection disabled'); return; }
    if(clicked.morale<=0) return; // too scared to select
    selectedUnit=clicked; updateUI(); return;
  } else if (clicked) {
    console.log('DEBUG: Unit clicked but not selectable - Unit Team:', clicked.team, 'Current Team:', currentTeam, 'OpponentType:', opponentType);
    console.log('DEBUG: Wrong team unit details:', {
      id: clicked.id,
      name: clicked.name,
      position: { col: clicked.col, row: clicked.row },
      clickedPosition: { col: c, row: r },
      positionMatch: clicked.col === c && clicked.row === r
    });
  }
  // If the clicked tile is empty, allow building Fortresses on it only if it's
  // completely empty (no unit, no terrain, no settlement) and adjacent (8-neighbor)
  // to at least one friendly, alive unit.
  if(!clicked){
    try{
      const idxCheck = r * COLS + c;
      const isOccupied = !!getUnitAt(c,r);
      const hasTerrain = !!terrain[idxCheck];
      const hasSettlement = !!settlements[idxCheck];
      const isWater = normalizeTerrainType(terrain[idxCheck]) === 'WATER';
      const nearOwnedPort = isNearOwnedPort(c, r, currentTeam);
      
      const adjAllowed = units.some(u => u.team === currentTeam && u.hp > 0 && isAdjacentTile(u.col, u.row, c, r));
      
      // Allow building if:
      // 1. Normal fortress conditions (empty land tile with adjacent unit), OR
      // 2. Water tile near owned port (for ships)
      const canBuildFortress = !isOccupied && !hasTerrain && !hasSettlement && adjAllowed;
      const canBuildShips = !isOccupied && !hasSettlement && isWater && nearOwnedPort;
      
      if(canBuildFortress || canBuildShips){
        if(buildMode){
          openBuildMenu(c, r);
          // exit build mode after opening menu
          buildMode = false; buildModeUnitId = null;
          return;
        } else {
          // If buildMode is not active, a click here should cancel any buildMode
          buildMode = false; buildModeUnitId = null;
        }
      }
    }catch(e){/* ignore */}
  }
  if(!selectedUnit) return;
  const dist=manhattan(selectedUnit.col,selectedUnit.row,c,r);
  console.log('DEBUG: Click handling - Distance:', dist, 'Max move:', selectedUnit.move, 'Use hex:', useHexGrid);
  // attack (Clerics cannot attack, units in swamps cannot attack except Assassins)
  const attackerTerrainIdx = selectedUnit.row * COLS + selectedUnit.col;
  const attackerTerrain = terrain[attackerTerrainIdx];
  const canAttackFromTerrain = !(attackerTerrain === 'SWAMP' && TERRAIN.SWAMP.noAttack && selectedUnit.name !== 'Assassin');
  
  if(selectedUnit.name !== 'Cleric' && clicked && clicked.team !== selectedUnit.team && dist<=selectedUnit.atkRange && !selectedUnit.hasActed && canAttackFromTerrain){
    
    console.log(`DEBUG: Attack initiated - ${selectedUnit.name} (hasActed: ${selectedUnit.hasActed}) attacking ${clicked.name}`);
    recordAction(c, r); // Record this as a significant action
    
    // Create optimistic update for attack
    const actionId = createOptimisticUpdate('unitAttack', {
      attackerId: selectedUnit.id,
      defenderId: clicked.id,
      attackerCol: selectedUnit.col,
      attackerRow: selectedUnit.row,
      defenderCol: clicked.col,
      defenderRow: clicked.row
    });
    
    // Preserve attacker state in case units array is rebuilt inside attackUnit
    const attackerId = selectedUnit.id;
    const preHasMoved = !!selectedUnit.hasMoved;
    const preHasActed = !!selectedUnit.hasActed;
    const preCol = selectedUnit.col, preRow = selectedUnit.row;

    console.log('ATTACK CLICK - pre-attack', { attackerId, preCol, preRow, preHasMoved, preHasActed, attackerHP: selectedUnit.hp, target: { id: clicked.id, col: clicked.col, row: clicked.row, hp: clicked.hp } });
    const res = attackUnit(selectedUnit, clicked) || {};

    // Record human attack for learning AI
    if (!isAITeam(selectedUnit.team)) {
      recordHumanAction('attack', {
        attackerType: selectedUnit.name,
        defenderType: clicked.name,
        attackerCol: preCol,
        attackerRow: preRow,
        defenderCol: clicked.col,
        defenderRow: clicked.row,
        distance: manhattan(preCol, preRow, clicked.col, clicked.row),
        success: res && !res.blocked,
        defenderKilled: res && res.defenderKilled
      });
    }

    // Re-bind selectedUnit to the possibly new object instance in units[]
    const fresh = units.find(u => u.id === attackerId);
    if (fresh) {
      // Force coordinates and movement flags back to pre-attack values
      fresh.col = preCol; fresh.row = preRow;
      fresh.hasMoved = preHasMoved; fresh.hasActed = preHasActed;
      try{ if (selectedUnit && selectedUnit.id === attackerId) selectedUnit = fresh; }catch(e){}
    }

    // Diagnostic output to detect unexpected movement
    try{
      const freshLog = fresh ? { id: fresh.id, col: fresh.col, row: fresh.row, hasMoved: fresh.hasMoved, hasActed: fresh.hasActed } : null;
      console.log('ATTACK CLICK - post-attack rebind', { attackerId, fresh: freshLog, res });
      if (fresh && (fresh.col !== preCol || fresh.row !== preRow)) {
        console.warn('ATTACK CLICK - attacker moved unexpectedly after attack', { attackerId, preCol, preRow, newCol: fresh.col, newRow: fresh.row });
      }
    }catch(e){ console.warn('ATTACK CLICK - logging failed', e); }

    // Mark acted on the local selection (we'll allow Knight extra-attack handling below)
    if (selectedUnit) {
      selectedUnit.hasActed = true;
      console.log(`DEBUG: Unit ${selectedUnit.name} marked as hasActed = true after attack`);
    }
    moraleCheck(selectedUnit); moraleCheck(clicked);
    // Knights get an extra attack if they score a kill (but only once per turn)
    if (selectedUnit && selectedUnit.name === 'Knight' && res.didKill && !selectedUnit.usedBonusAttack) {
      selectedUnit.hasActed = false; // allow another attack
      selectedUnit.usedBonusAttack = true; // prevent further bonus attacks this turn
      console.log(`Knight ${selectedUnit.name} gets bonus attack after kill!`);
      // Don't deselect so player can use bonus attack
      updateUI(); checkEndGame(); 
      try{ postGameState(actionId); } catch(e){}
      return;
    }
    // Deselect immediately to avoid any UI/selection side-effects that can
    // cause the attacker to appear to move onto the killed unit's tile.
    selectedUnit = null;
    updateUI(); checkEndGame(); 
    try{ postGameState(actionId); } catch(e){}
    return;
  }
  // move
  console.log('DEBUG: Movement check - selectedUnit:', !!selectedUnit, 'clicked:', !!clicked, 'hasMoved:', selectedUnit?.hasMoved, 'distance:', dist, 'maxMove:', selectedUnit?.move);
  if(!clicked && !selectedUnit.hasMoved && dist<=selectedUnit.move){
    // When in build mode, do not allow units to move until build mode is turned off
    if (buildMode) {
      console.log('Build mode active — movement disabled');
      return;
    }
    const canMoveResult = canMoveTo(selectedUnit, c, r);
    console.log('DEBUG: Movement validation - canMoveTo result:', canMoveResult);
    console.log('DEBUG: Settlement at target:', s ? `type: ${s.type}, owner: ${s.owner}` : 'none');
    if(!getUnitAt(c,r) && canMoveResult){
      
      recordAction(c, r); // Record this as a significant action
      
      // Create optimistic update for regular movement
      const actionId = createOptimisticUpdate('unitMove', {
        unitId: selectedUnit.id,
        fromCol: selectedUnit.col,
        fromRow: selectedUnit.row,
        toCol: c,
        toRow: r
      });
      
      console.log('DEBUG: Moving unit from', selectedUnit.col, selectedUnit.row, 'to', c, r);
      selectedUnit.col=c; selectedUnit.row=r; selectedUnit.hasMoved=true;
      try { SoundManager.playMove(selectedUnit); } catch (e) {}
      
      // Record human action for learning AI
      if (!isAITeam(selectedUnit.team)) {
        recordHumanAction('move', {
          unitType: selectedUnit.name,
          fromCol: selectedUnit.col,
          fromRow: selectedUnit.row,
          toCol: c,
          toRow: r,
          distance: manhattan(selectedUnit.col, selectedUnit.row, c, r)
        });
      }
      
      // Claim settlement if present
      console.log('DEBUG: Attempting to claim settlement at', c, r, 'for team', selectedUnit.team);
      console.log('DEBUG: Settlement at position:', s ? `type: ${s.type}, owner: ${s.owner}` : 'none');
      claimSettlementAt(c, r, selectedUnit.team);
      updateUI();
      try{ postGameState(actionId); } catch(e){}
    } else {
      console.log('DEBUG: Movement blocked - Unit at target:', !!getUnitAt(c,r), 'canMove:', canMoveResult);
    }
  } else {
    console.log('DEBUG: Movement conditions not met - clicked:', !!clicked, 'hasMoved:', selectedUnit?.hasMoved, 'distance:', dist, 'maxMove:', selectedUnit?.move, 'withinRange:', dist <= (selectedUnit?.move || 0));
  }
}

// ========================================

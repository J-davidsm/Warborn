// Warborn source split from the original game.js.
// Section: js/input/global-events.js

// GLOBAL INPUT EVENT HANDLING
// ========================================

/**
 * Keyboard shortcuts and global menu controls
 * - Escape: Close spawn/build menus
 * - Click outside menus: Close menus (prevents UI clutter)
 */
window.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'Escape') { 
    closeSpawnMenu(); 
  }
  
  if (e.key === 'H' || e.key === 'h') e.preventDefault();
  
  // Camera scrolling with arrow keys
  if (mapCanvasFocused && e.key.startsWith('Arrow')) e.preventDefault();
  handleCameraMovement(e.key, true);
  keysPressed[e.key] = true;
});

window.addEventListener('keyup', (e) => {
  keysPressed[e.key] = false;
});

/**
 * Handle camera movement with arrow keys
 * Allows scrolling around large maps while keeping viewport centered
 */
function handleCameraMovement(key, isPressed) {
  if (!isPressed) return;
  
  let moved = false;
  const viewport = getViewportSize();
  const maxCameraX = Math.max(0, COLS - viewport.cols);
  const maxCameraY = Math.max(0, ROWS - viewport.rows);
  
  switch(key) {
    case 'ArrowLeft':
      if (cameraX > 0) {
        cameraX = Math.max(0, cameraX - SCROLL_SPEED);
        moved = true;
      }
      break;
    case 'ArrowRight':
      if (cameraX < maxCameraX) {
        cameraX = Math.min(maxCameraX, cameraX + SCROLL_SPEED);
        moved = true;
      }
      break;
    case 'ArrowUp':
      if (cameraY > 0) {
        cameraY = Math.max(0, cameraY - SCROLL_SPEED);  
        moved = true;
      }
      break;
    case 'ArrowDown':
      if (cameraY < maxCameraY) {
        cameraY = Math.min(maxCameraY, cameraY + SCROLL_SPEED);
        moved = true;
      }
      break;
  }
  
  if (moved) {
    console.log(`Camera moved to (${cameraX}, ${cameraY})`);
  }
}

window.addEventListener('click', (ev) => {
  const m = document.getElementById('spawnMenu'); 
  if (!m) return;
  
  if (skipNextClick) { 
    skipNextClick = false; 
    return; 
  }
  
  // Close spawn menu if clicking outside of it (but not on small buttons)
  if (!m.contains(ev.target) && !ev.target.closest('.small')) {
    closeSpawnMenu();
  }
});

// ========================================
// CROSS-PLATFORM INPUT SUPPORT
// ========================================

/**
 * Touch and pointer event handling for mobile/tablet compatibility
 * Maps touch/pointer events to the same game logic as mouse clicks
 * Handles both game interactions and UI menu interactions
 * Essential for iPad and mobile device support
 */
// to close it (mirrors the click handler).
function processPointerPress(clientX, clientY){
  try{
    if (isMenuBlockingGameInput()) return;
    const canvasEl = document.querySelector('#game canvas');
    if(!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldCoords = mouseToWorldCoords(localX, localY);
    const c = worldCoords.col;
    const r = worldCoords.row;
    if(c<0||c>=COLS||r<0||r>=ROWS) return;
    inspectedTerrain = { col: c, row: r };
  }catch(e){/* ignore */}
}

function processPointerClick(clientX, clientY, shiftKey = false){
  try{
    if (isMenuBlockingGameInput()) return;
    // Prevent duplicate events from multiple input systems
    if (isEventDuplicate(clientX, clientY)) {
      console.log('Duplicate event detected, ignoring');
      return;
    }
    
    const canvasEl = document.querySelector('#game canvas');
    if(!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldCoords = mouseToWorldCoords(localX, localY);
    const c = worldCoords.col;
    const r = worldCoords.row;
    if(c<0||c>=COLS||r<0||r>=ROWS) return;
    inspectedTerrain = { col: c, row: r };
    
    // The debounce check is now handled inside handleGridClick and handleEditorClick
    if(isEditorMode) {
      console.log('Handling editor click via pointer');
      handleEditorClick(c, r, shiftKey);
    } else {
      console.log('Handling game click via pointer');
      handleGridClick(c, r);
    }
  }catch(e){console.warn('pointer click failed', e)}
}

// Map touchstart -> press (for hover/inspect) and touchend -> click (on release)
window.addEventListener('touchstart', function(ev){
  if(!ev.touches || ev.touches.length===0) return;
  const t = ev.touches[0];
  // Only prevent default and handle if touch is over the game canvas
  try{
    const canvasEl = document.querySelector('#game canvas');
    if(canvasEl){
      if(ev.target !== canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      if(t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom){
        try{ ev.preventDefault(); } catch(e){}
        processPointerPress(t.clientX, t.clientY);
      }
    }
  }catch(e){/* ignore */}
}, { passive: false });

window.addEventListener('touchend', function(ev){
  // Use changedTouches to get the touch that ended
  if(!ev.changedTouches || ev.changedTouches.length===0) return;
  const t = ev.changedTouches[0];
  // If spawn menu is open and we recently opened it, respect skipNextClick semantics
  const m = document.getElementById('spawnMenu');
  if(m){
    if(skipNextClick){ skipNextClick = false; return; }
    // If the touch ended outside the menu, close it
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if(!m.contains(el) && !(el && el.closest && el.closest('.small'))){ closeSpawnMenu(); return; }
  }
  try{
    const canvasEl = document.querySelector('#game canvas');
    if(canvasEl){
      if(ev.target !== canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      if(t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom){
        try{ ev.preventDefault(); } catch(e){}
        processPointerClick(t.clientX, t.clientY, false); // Touch events don't support shift key
      }
    }
  }catch(e){ console.warn('touch click failed', e) }
}, { passive: false });

// Pointer events: prefer pointer events when available (covers iPadOS with Apple Pencil/trackpad too)
// Use a small guard so we don't process both touch and pointer events for the same interaction.
let activePointerId = null;
let pointerPanLastX = 0;
let pointerPanLastY = 0;
let pointerPanMoved = false;
let pointerPanDistance = 0;
window.addEventListener('pointerdown', function(ev){
  try{
    // Only handle primary pointers (ignore secondary touches)
    if(ev.isPrimary === false) return;
    // Only process pointer events when over the canvas; otherwise let UI buttons receive clicks
    const canvasEl = document.querySelector('#game canvas');
    if(canvasEl){
      if(ev.target !== canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      if(ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom){
        activePointerId = ev.pointerId;
        pointerPanLastX = ev.clientX;
        pointerPanLastY = ev.clientY;
        pointerPanMoved = false;
        pointerPanDistance = 0;
        suppressClickAfterDrag = false;
        mapCanvasFocused = true;
        isDragging = true;
        try{ canvasEl.setPointerCapture(ev.pointerId); }catch(e){}
        try{ ev.preventDefault(); } catch(e){}
        processPointerPress(ev.clientX, ev.clientY);
      }
    }
  }catch(e){ /* ignore */ }
}, { passive: false });

window.addEventListener('pointerup', function(ev){
  try{
    if(activePointerId !== null && ev.pointerId !== activePointerId){ return; }
    const pointerStartedOnMap = activePointerId !== null && ev.pointerId === activePointerId;
    if(!pointerStartedOnMap) return;
    const didPan = pointerPanMoved;
    if(activePointerId === ev.pointerId) {
      activePointerId = null;
      pointerPanMoved = false;
      pointerPanDistance = 0;
      isDragging = false;
      try{
        const captureCanvas = document.querySelector('#game canvas');
        if(captureCanvas) captureCanvas.releasePointerCapture(ev.pointerId);
      }catch(e){}
    }
    // Only handle pointerup if the event was over the canvas
    const canvasEl = document.querySelector('#game canvas');
    if(canvasEl){
      const rect = canvasEl.getBoundingClientRect();
      if(ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom){
        try{ ev.preventDefault(); } catch(e){}
        if (didPan) {
          return;
        }
        // If spawn menu open, handle skipNextClick semantics similar to touchend
        const m = document.getElementById('spawnMenu');
        if(m){
          if(skipNextClick){ skipNextClick = false; return; }
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          if(!m.contains(el) && !(el && el.closest && el.closest('.small'))){ closeSpawnMenu(); return; }
        }
        processPointerClick(ev.clientX, ev.clientY, ev.shiftKey);
      }
    }
  }catch(e){ /* ignore */ }
}, { passive: false });

window.addEventListener('pointercancel', function(ev){
  try{
    if(activePointerId === ev.pointerId) {
      activePointerId = null;
      pointerPanMoved = false;
      pointerPanDistance = 0;
      isDragging = false;
    }
  }catch(e){}
});

// Update inspected terrain on pointer move, and pan while dragging from the map.
window.addEventListener('pointermove', function(ev){
  try{
    if(ev.isPrimary === false) return;
    const canvasEl = document.querySelector('#game canvas');
    if(!canvasEl) return;
    if(activePointerId !== null && ev.pointerId === activePointerId && !isMenuBlockingGameInput()){
      const deltaX = ev.clientX - pointerPanLastX;
      const deltaY = ev.clientY - pointerPanLastY;
      if(Math.abs(deltaX) + Math.abs(deltaY) > 0){
        panCamera(deltaX, deltaY);
        pointerPanDistance += Math.abs(deltaX) + Math.abs(deltaY);
        if(pointerPanDistance > 2) {
          pointerPanMoved = true;
          suppressClickAfterDrag = true;
        }
        pointerPanLastX = ev.clientX;
        pointerPanLastY = ev.clientY;
      }
      try{ ev.preventDefault(); }catch(e){}
      return;
    }
    const rect = canvasEl.getBoundingClientRect();
    const localX = ev.clientX - rect.left;
    const localY = ev.clientY - rect.top;
    // Convert to board-relative coordinates (account for drawing OFFSET)
    const relX = localX - OFFSET;
    const relY = localY - OFFSET;
    if(relX < 0 || relY < 0) return;
    const c = Math.floor(relX / TILE);
    const r = Math.floor(relY / TILE);
    if(c<0||c>=COLS||r<0||r>=ROWS) return;
    //inspectedTerrain = { col: c, row: r };
  }catch(e){/* ignore */}
}, { passive: false });

/**
 * Core combat system - handles all attack calculations and special combat mechanics
 * 
 * Combat involves multiple damage calculation steps:
 * 1. Base damage from attacker's stats
 * 2. Health-based damage scaling (wounded units deal less damage)  
 * 3. Morale modifiers (high/low morale affects damage output)
 * 4. Unit-specific combat bonuses/penalties (Knight vs Dragon, etc.)
 * 5. Defensive bonuses from formations (adjacent Spearmen)
 * 6. Fortress damage reduction and terrain bonuses
 * 
 * @param {Object} a - Attacking unit object
 * @param {Object} d - Defending unit object  
 * @returns {Object} Combat result with damage dealt and kill status
 */

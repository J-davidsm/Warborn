// Warborn source split from the original game.js.
// Section: js/rendering/renderer.js

// ---------- Zoom and Pan Functions ----------

// Smooth zoom and pan update function
function updateZoomAndPan() {
  cameraX = 0;
  cameraY = 0;
  // Smooth zoom interpolation
  zoomLevel = lerp(zoomLevel, targetZoom, zoomSpeed);
  
  // Smooth pan interpolation
  panX = lerp(panX, targetPanX, panSpeed);
  panY = lerp(panY, targetPanY, panSpeed);
  clampPanToMap();
}

// Convert screen coordinates to world coordinates considering zoom and pan
function screenToWorld(screenX, screenY) {
  const origin = getMapOrigin();
  const worldX = (screenX - origin.x - panX) / zoomLevel;
  const worldY = (screenY - origin.y - panY) / zoomLevel;
  
  return { x: worldX, y: worldY };
}

// Convert world coordinates to screen coordinates considering zoom and pan
function worldToScreen(worldX, worldY) {
  const origin = getMapOrigin();
  const screenX = origin.x + panX + worldX * zoomLevel;
  const screenY = origin.y + panY + worldY * zoomLevel;
  
  return { x: screenX, y: screenY };
}

// Set zoom level with bounds checking
function setZoom(newZoom, centerX = width/2, centerY = height/2) {
  const oldZoom = zoomLevel; // Use current zoom, not target zoom
  const newZoomClamped = constrain(newZoom, minZoom, maxZoom);
  
  // Only adjust pan if zoom actually changed
  if (oldZoom !== newZoomClamped && centerX !== undefined && centerY !== undefined) {
    // Get the world point under the cursor before zooming
    const worldPoint = screenToWorld(centerX, centerY);
    
    // Set new zoom
    targetZoom = newZoomClamped;
    zoomLevel = newZoomClamped; // Update immediately for calculation
    
    // Calculate where that world point is now on screen
    const newScreenPoint = worldToScreen(worldPoint.x, worldPoint.y);
    
    // Adjust pan to move that point back under the cursor
    targetPanX += centerX - newScreenPoint.x;
    targetPanY += centerY - newScreenPoint.y;
    panX = targetPanX; // Update immediately for stability
    panY = targetPanY;
  } else {
    targetZoom = newZoomClamped;
  }
  clampPanToMap();
}

// Pan the camera by specified amounts
function panCamera(deltaX, deltaY) {
  targetPanX += deltaX;
  targetPanY += deltaY;
  clampPanToMap();
}

function clampPanToMap() {
  const z = Math.max(0.01, targetZoom || zoomLevel || 1);
  const origin = getMapOrigin();
  const bounds = getMapWorldBounds();
  const margin = 80;
  const leftLimit = margin - origin.x - bounds.x * z;
  const rightLimit = width - margin - origin.x - (bounds.x + bounds.width) * z;
  const topLimit = margin - origin.y - bounds.y * z;
  const bottomLimit = height - margin - origin.y - (bounds.y + bounds.height) * z;
  const minPanX = Math.min(leftLimit, rightLimit);
  const maxPanX = Math.max(leftLimit, rightLimit);
  const minPanY = Math.min(topLimit, bottomLimit);
  const maxPanY = Math.max(topLimit, bottomLimit);
  targetPanX = constrain(targetPanX, minPanX, maxPanX);
  targetPanY = constrain(targetPanY, minPanY, maxPanY);
  panX = constrain(panX, minPanX, maxPanX);
  panY = constrain(panY, minPanY, maxPanY);
}

// ---------- Draw ----------
function drawTerrainInfo() {
  if (!inspectedTerrain) return;
  const info = getTerrainInfoText(inspectedTerrain.col, inspectedTerrain.row);
  if (!info) return;

  push();
  // Position in upper right corner
  translate(width - 12, 12);
  
  // Draw background
  fill(20, 36, 48, 240);
  stroke(255, 40);
  strokeWeight(1);
  const lines = info.split('\n');
  const padding = 10;
  const lineHeight = 20;
  const boxWidth = 200;
  const boxHeight = lines.length * lineHeight + padding * 2;
  rect(- boxWidth, 0, boxWidth, boxHeight, 8);
  
  // Draw text
  fill(255);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(12);
  lines.forEach((line, i) => {
    text(line, - boxWidth + padding, padding + i * lineHeight);
  });
  pop();
}

function draw(){
  ensureGridValid();
  background(14,20,30);
  
  // Update smooth zoom and pan
  updateZoomAndPan();
  
  // Apply zoom and pan transformations
  push();
  const origin = getMapOrigin();
  translate(origin.x + panX, origin.y + panY);
  scale(zoomLevel);
  
  drawGrid(); drawUnits(); drawHighlights();
  
  pop();
  // image load status indicator (small, top-right)
  push(); noStroke(); fill(255,200); textSize(12); textAlign(RIGHT, TOP);
  const totalImgs = Object.keys(DEFAULT_IMAGE_MAP).length;
  const loadedImgs = Object.values(IMAGE_LOAD_STATUS).filter(s=>s==='loaded').length || 0;
  const errImgs = Object.values(IMAGE_LOAD_STATUS).filter(s=>s==='error').length || 0;
  text(`Sprites: ${loadedImgs}/${totalImgs}${errImgs? ' (err:'+errImgs+')':''}`, width - 12, 8);
  text('Grid: HEX', width - 12, 24);
  pop();
  drawTerrainInfo();
  if(gameOver) drawGameOver();
}

function windowResized() {
  resizeGameCanvas();
}

function normalizeTerrainType(type) {
  if (!type) return null;
  const normalized = String(type).toUpperCase();
  if (normalized === 'FOREST') return 'WOODS';
  if (normalized === 'MARSH') return 'SWAMP';
  return normalized;
}

function terrainHash(col, row, salt = 0) {
  let h = ((col + 1) * 374761393) ^ ((row + 1) * 668265263) ^ ((salt + 1) * 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function terrainRand(col, row, salt = 0) {
  return terrainHash(col, row, salt) / 4294967295;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function jitterColor(base, col, row, salt, variance = 18, alpha = 255) {
  const swing = (terrainRand(col, row, salt) - 0.5) * variance * 2;
  return [
    clampByte(base[0] + swing),
    clampByte(base[1] + swing),
    clampByte(base[2] + swing),
    alpha
  ];
}

function getTerrainBaseColor(terrainType) {
  switch (normalizeTerrainType(terrainType)) {
    case 'WATER': return [40, 87, 118];
    case 'DESERT': return [176, 134, 74];
    case 'SWAMP': return [78, 94, 64];
    case 'MOUNTAIN': return [86, 92, 76];
    case 'WOODS': return [54, 91, 51];
    case 'FOUNTAIN': return [58, 103, 91];
    case 'FARM': return [88, 119, 54];
    case 'BRIDGE': return [100, 88, 66];
    default: return [70, 112, 62];
  }
}

function drawTerrainNoiseTile(x, y, w, h, terrainType, col, row) {
  const type = normalizeTerrainType(terrainType);
  const base = getTerrainBaseColor(type);
  const baseJitter = jitterColor(base, col, row, 1, type === 'WATER' ? 10 : 16, 255);
  noStroke();
  fill(baseJitter[0], baseJitter[1], baseJitter[2], baseJitter[3]);
  rect(x, y, w, h);

  const patchCount = type === 'WATER' ? 12 : 9;
  for (let i = 0; i < patchCount; i++) {
    const rx = x + terrainRand(col, row, 10 + i) * w;
    const ry = y + terrainRand(col, row, 30 + i) * h;
    const rw = w * (0.12 + terrainRand(col, row, 50 + i) * 0.35);
    const rh = h * (0.08 + terrainRand(col, row, 70 + i) * 0.30);
    const tintColor = jitterColor(base, col, row, 90 + i, type === 'WATER' ? 28 : 24, type === 'WATER' ? 48 : 38);
    fill(tintColor[0], tintColor[1], tintColor[2], tintColor[3]);
    if (type === 'WATER') {
      ellipse(rx, ry, rw, rh);
    } else {
      rect(rx - rw / 2, ry - rh / 2, rw, rh);
    }
  }

  if (type === 'WATER') {
    stroke(152, 205, 226, 28);
    strokeWeight(Math.max(0.5, TILE * 0.012));
    for (let i = 0; i < 3; i++) {
      const waveY = y + h * (0.25 + terrainRand(col, row, 120 + i) * 0.55);
      const startX = x + w * terrainRand(col, row, 140 + i) * 0.25;
      line(startX, waveY, startX + w * (0.35 + terrainRand(col, row, 160 + i) * 0.35), waveY + (terrainRand(col, row, 180 + i) - 0.5) * h * 0.08);
    }
    noStroke();
  }
}

function drawTerrainImage(img, x, y, w, h, alpha = 1, centered = false) {
  if (!img || !(img.complete || img.width)) return false;
  const ctx = typeof drawingContext !== 'undefined'
    ? drawingContext
    : (document.querySelector('canvas') || {}).getContext?.('2d');
  if (!ctx || typeof ctx.drawImage !== 'function') return false;
  try {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(img, centered ? x - w / 2 : x, centered ? y - h / 2 : y, w, h);
    ctx.restore();
    return true;
  } catch (e) {
    try{ ctx.restore(); }catch(_){}
    console.warn('Terrain image draw failed', e);
    return false;
  }
}

function drawTerrainBlockArt(imageName, x, y, w, h, alpha = 220) {
  const img = TERRAIN_ART_IMAGES[imageName];
  if (!img || TERRAIN_ART_STATUS[imageName] !== 'loaded') return false;
  return drawTerrainImage(img, x - w * 0.08, y - h * 0.08, w * 1.16, h * 1.16, alpha / 255, false);
}

function getTerrainHexVariantName(type, col, row) {
  const prefix = type === 'DESERT' ? 'desert_hex_' : type === 'WOODS' ? 'forest_hex_' : type === 'SWAMP' ? 'marsh_hex_' : null;
  if (!prefix) return null;
  const available = Object.keys(TERRAIN_ART_IMAGES)
    .filter(name => name.startsWith(prefix) && TERRAIN_ART_STATUS[name] === 'loaded')
    .sort();
  if (!available.length) return null;
  const index = Math.floor(terrainRand(col, row, 910 + prefix.length) * available.length) % available.length;
  return available[index];
}

function drawTerrainHexVariant(type, centerX, centerY, col, row, alpha = 1) {
  const imageName = getTerrainHexVariantName(type, col, row);
  const img = imageName ? TERRAIN_ART_IMAGES[imageName] : null;
  if (!img) return false;

  const apothem = getHexApothem();
  const flatW = HEX_SIZE * 2.08;
  const flatH = apothem * 2.10;
  const ctx = drawingContext;
  if (!ctx || typeof ctx.drawImage !== 'function') return false;
  try {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(centerX, centerY);
    // The provided terrain sheets use point-top hexes; the game uses flat-top
    // hexes. Rotate the artwork once so the supplied hex art fills our cells.
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -flatH / 2, -flatW / 2, flatH, flatW);
    ctx.restore();
    return true;
  } catch (e) {
    try { ctx.restore(); } catch (_) {}
    console.warn('Terrain hex variant draw failed', { type, col, row, imageName, error: e });
    return false;
  }
}

function drawTerrainScatter(kind, x, y, w, h, col, row) {
  const prefix = kind === 'mountain' ? 'mountain_' : 'tree_';
  const available = Object.keys(TERRAIN_ART_IMAGES)
    .filter(name => name.startsWith(prefix) && TERRAIN_ART_STATUS[name] === 'loaded');
  // fixed six scatter items per tile
  const count = 6;

  if (!available.length) {
    noStroke();
    for (let i = 0; i < count; i++) {
      const cx = x + w * (0.26 + terrainRand(col, row, 240 + i) * 0.44);
      const cy = y + h * (0.30 + terrainRand(col, row, 260 + i) * 0.40);
      // primitive fallback sizes: mountains ~3x, trees ~2x, scaled down to 70%
      const size = w * (kind === 'mountain' ? 0.22 * 3 : 0.18 * 2) * 0.7;
      fill(kind === 'mountain' ? 116 : 38, kind === 'mountain' ? 112 : 104, kind === 'mountain' ? 96 : 42, 210);
      if (kind === 'mountain') triangle(cx, cy - size, cx - size, cy + size, cx + size, cy + size);
      else ellipse(cx, cy, size * 1.4, size * 1.2);
    }
    return;
  }

  const placements = [];
  for (let i = 0; i < count; i++) {
    placements.push({
      cx: x + w * (0.22 + terrainRand(col, row, 340 + i) * 0.56),
      cy: y + h * (0.26 + terrainRand(col, row, 360 + i) * 0.48),
      imageName: available[Math.floor(terrainRand(col, row, 380 + i) * available.length) % available.length],
      // mountains scaled ~3x, trees scaled ~2x, then reduced to 70%
      size: w * (kind === 'mountain'
        ? (0.30 + terrainRand(col, row, 400 + i) * 0.16) * 3 * 0.7
        : (0.25 + terrainRand(col, row, 420 + i) * 0.15) * 2 * 0.7)
    });
  }

  placements.sort((a, b) => a.cy - b.cy);
  placements.forEach(item => {
    const img = TERRAIN_ART_IMAGES[item.imageName];
    if (!img) return;
    const ratio = Math.min(item.size / (img.width || item.size), item.size / (img.height || item.size));
    const dw = (img.width || item.size) * ratio;
    const dh = (img.height || item.size) * ratio;
    drawTerrainImage(img, item.cx, item.cy, dw, dh, kind === 'mountain' ? 0.93 : 0.89, true);
  });
}

function drawRealisticTerrainTile(screenX, screenY, terrainType, col, row) {
  const type = normalizeTerrainType(terrainType);
  if (useHexGrid) {
    drawHexTerrainBase(screenX, screenY, type, col, row);
    drawHexTerrainOverlay(screenX, screenY, type, col, row);
    return;
  }

  drawTerrainBaseTile(screenX, screenY, TILE, TILE, type, col, row);
  drawTerrainOverlayTile(screenX, screenY, TILE, TILE, type, col, row);
}

function drawTerrainBaseTile(x, y, w, h, terrainType, col, row) {
  const type = normalizeTerrainType(terrainType);
  try {
    drawTerrainNoiseTile(x, y, w, h, type, col, row);
  } catch (e) {
    console.warn('Terrain base draw failed; using safe fallback', { type, col, row, error: e });
    const base = getTerrainBaseColor(type);
    noStroke();
    fill(base[0], base[1], base[2], 255);
    rect(x, y, w, h);
  }
}

function drawTerrainOverlayTile(x, y, w, h, terrainType, col, row) {
  const type = normalizeTerrainType(terrainType);
  try {
    if (type === 'DESERT') {
      drawTerrainBlockArt('desertBlock', x, y, w, h, 208);
    } else if (type === 'SWAMP') {
      drawTerrainBlockArt('marshBlock', x, y, w, h, 216);
    } else if (type === 'MOUNTAIN') {
      drawTerrainScatter('mountain', x, y, w, h, col, row);
    } else if (type === 'WOODS') {
      drawTerrainScatter('tree', x, y, w, h, col, row);
    }
  } catch (e) {
    console.warn('Terrain overlay draw failed; base tile preserved', { type, col, row, error: e });
  }
}

function beginHexCanvasPath(centerX, centerY, size) {
  const ctx = drawingContext;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const x = centerX + size * Math.cos(angle);
    const y = centerY + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function withHexClip(centerX, centerY, size, drawFn) {
  const ctx = drawingContext;
  ctx.save();
  beginHexCanvasPath(centerX, centerY, size);
  ctx.clip();
  try {
    drawFn();
  } finally {
    ctx.restore();
  }
}

function drawHexTerrainBase(centerX, centerY, terrainType, col, row) {
  const type = normalizeTerrainType(terrainType);
  if (type === 'DESERT' || type === 'WOODS' || type === 'SWAMP') {
    const drewVariant = drawTerrainHexVariant(type, centerX, centerY, col, row, 1);
    if (drewVariant) return;
  }

  const apothem = getHexApothem();
  withHexClip(centerX, centerY, HEX_SIZE, () => {
    drawTerrainBaseTile(
      centerX - HEX_SIZE,
      centerY - apothem,
      HEX_SIZE * 2,
      apothem * 2,
      terrainType,
      col,
      row
    );
  });
}

function drawHexTerrainOverlay(centerX, centerY, terrainType, col, row) {
  const type = normalizeTerrainType(terrainType);
  if (type === 'DESERT' || type === 'WOODS' || type === 'SWAMP') return;
  const apothem = getHexApothem();

  if (type === 'MOUNTAIN') {
    const spill = HEX_SIZE * 0.22;
    drawTerrainOverlayTile(
      centerX - HEX_SIZE - spill,
      centerY - apothem - spill,
      HEX_SIZE * 2 + spill * 2,
      apothem * 2 + spill * 2,
      type,
      col,
      row
    );
    return;
  }

  const spill = HEX_SIZE * 0.08;
  withHexClip(centerX, centerY, HEX_SIZE * 1.03, () => {
    drawTerrainOverlayTile(
      centerX - HEX_SIZE - spill,
      centerY - apothem - spill,
      HEX_SIZE * 2 + spill * 2,
      apothem * 2 + spill * 2,
      type,
      col,
      row
    );
  });
}

function drawSettlementMarker(settlement, screenX, screenY) {
  if (!settlement) return;
  noStroke();
  fill(255);
  const markerScale = useHexGrid ? HEX_SIZE * 1.4 : TILE;
  textSize(markerScale * 0.5);
  const emoji = SETTLEMENTS[settlement.type].emoji;
  if (useHexGrid) {
    text(emoji, screenX, screenY);
  } else {
    text(emoji, screenX + TILE/2, screenY + TILE/2);
  }
  const owner = settlement.owner;
  let flagColor = [0,0,0];
  if (owner) {
    const teamColor = getTeamColor(owner);
    flagColor = teamColor.fill;
  }
  const cx = useHexGrid ? screenX : screenX + TILE/2;
  const cy = useHexGrid ? screenY + markerScale*0.28 : screenY + TILE/2 + TILE*0.28;
  const poleHeight = Math.max(10, markerScale * 0.18);
  const poleX = cx - Math.max(8, markerScale * 0.08);
  const poleTop = cy - poleHeight;
  stroke(30);
  strokeWeight(Math.max(1.5, markerScale * 0.03));
  const poleBottom = cy + Math.max(4, markerScale * 0.06);
  line(poleX, poleBottom, poleX, poleTop);
  noStroke();
  fill(flagColor[0], flagColor[1], flagColor[2]);
  const fw = Math.max(10, markerScale * 0.18);
  const fh = Math.max(8, markerScale * 0.10);
  rect(poleX + 3, poleTop + (fh * 0.15), fw, fh, 2);
}

function clampNumber(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function getRankIndicatorKey(unit) {
  const level = clampNumber(Math.floor(unit.promotionLevel || 0), 0, 4);
  return `rank_${level}`;
}

function getMoraleIndicatorKey(unit) {
  const morale = unit && Number.isFinite(unit.morale) ? unit.morale : 100;
  if (morale <= 0) return 'morale_4';
  if (morale <= 30) return 'morale_3';
  if (morale <= 75) return 'morale_2';
  if (morale >= 120) return 'morale_0';
  return 'morale_1';
}

function drawIndicatorImage(key, centerX, centerY, maxWidth, maxHeight) {
  const img = INDICATOR_IMAGES[key];
  if (!img || INDICATOR_IMAGE_STATUS[key] !== 'loaded') return;
  const iw = img.width || maxWidth;
  const ih = img.height || maxHeight;
  const ratio = Math.min(maxWidth / iw, maxHeight / ih);
  const drawW = iw * ratio;
  const drawH = ih * ratio;
  try {
    imageMode(CENTER);
    image(img, centerX, centerY, drawW, drawH);
    imageMode(CORNER);
  } catch (e) {
    try {
      const ctx = (document.querySelector('canvas') || {}).getContext('2d');
      if (ctx) ctx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
    } catch (ignored) {}
  }
}

function drawUnitStatusIndicators(unit, x, y, unitScale) {
  const apothem = useHexGrid ? getHexApothem() : TILE / 2;
  const rankMaxW = useHexGrid
    ? clampNumber(HEX_SIZE * 0.78, 16, 30)
    : clampNumber(TILE * 0.38 * unitScale, 16, 30);
  const rankMaxH = useHexGrid
    ? clampNumber(apothem * 0.50, 12, 22)
    : clampNumber(TILE * 0.27 * unitScale, 12, 22);
  const moraleSize = useHexGrid
    ? clampNumber(HEX_SIZE * 0.58, 15, 26)
    : clampNumber(TILE * 0.31 * unitScale, 15, 26);

  const rankX = useHexGrid ? x - HEX_SIZE * 0.43 : x - TILE * 0.32 * unitScale;
  const moraleX = useHexGrid ? x + HEX_SIZE * 0.45 : x + TILE * 0.32 * unitScale;
  const topY = useHexGrid ? y - apothem * 0.58 : y - TILE * 0.33 * unitScale;

  drawIndicatorImage(getRankIndicatorKey(unit), rankX, topY, rankMaxW, rankMaxH);
  drawIndicatorImage(getMoraleIndicatorKey(unit), moraleX, topY, moraleSize, moraleSize);
}

function getLocalPlayableTeam() {
  if (opponentType === 'HUMAN') return myRole === 'P2' ? 'PLAYER2' : 'PLAYER';
  if (gameMode === 'local-2p' || opponentType === 'LOCAL_2P') return currentTeam;
  return 'PLAYER';
}

function shouldShowUnitTurnIndicator(unit) {
  if (!unit || unit.hp <= 0 || gameOver || isEditorMode) return false;
  if (typeof isAITeam === 'function' && isAITeam(unit.team)) return false;
  if (opponentType === 'HUMAN') {
    const localTeam = getLocalPlayableTeam();
    return unit.team === localTeam && currentTeam === localTeam;
  }
  return unit.team === currentTeam;
}

function canUnitAttackFromCurrentPosition(unit) {
  if (!shouldShowUnitTurnIndicator(unit)) return false;
  if (unit.hasActed || unit.name === 'Cleric' || !unit.atkRange || unit.atkRange <= 0) return false;

  const attackerTerrain = normalizeTerrainType(terrain[unit.row * COLS + unit.col]);
  if (attackerTerrain === 'SWAMP' && TERRAIN.SWAMP && TERRAIN.SWAMP.noAttack && unit.name !== 'Assassin') {
    return false;
  }

  return units.some(target => {
    if (!target || target.hp <= 0 || target.team === unit.team) return false;
    if (manhattan(unit.col, unit.row, target.col, target.row) > unit.atkRange) return false;
    try {
      return typeof canAttack !== 'function' || canAttack(unit.team, target.team);
    } catch (e) {
      return true;
    }
  });
}

function getStableUnitVisualSeed(unit) {
  const source = String((unit && unit.id) || `${unit.name || 'unit'}-${unit.col || 0}-${unit.row || 0}`);
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 997);
}

function getUnitMoveBobOffset(unit) {
  if (!shouldShowUnitTurnIndicator(unit) || unit.hasMoved || !unit.move || unit.move <= 0) return 0;
  const phase = (frameCount * 0.12) + (getStableUnitVisualSeed(unit) * 0.07);
  return Math.sin(phase) * Math.max(2.5, TILE * 0.045);
}

function drawGrid(){
  push(); translate(OFFSET,OFFSET);
  
  // Add hex grid offset to position it better on screen
  if (useHexGrid) {
    const offset = getHexGridOffset();
    translate(offset.x, offset.y); // Move hex grid down and right
  }
  
  const startCol = 0;
  const endCol = COLS;
  const startRow = 0;
  const endRow = ROWS;
  const viewport = getViewportSize();
  
  // board outline (only draw viewport area)
  noFill(); stroke(255,40); strokeWeight(1);
  if (!useHexGrid) {
    rect(0, 0, viewport.cols*TILE, viewport.rows*TILE, 6);
  }
  
  // draw grid cells and settlements (only visible tiles)
  textAlign(CENTER, CENTER);
  textSize(TILE * 0.4);
  const blendedTerrain = typeof drawBlendedTerrainBoard === 'function' && drawBlendedTerrainBoard();
  
  for(let r = startRow; r < endRow; r++) {
    for(let c = startCol; c < endCol; c++) {
      // Calculate screen position relative to camera
      let screenX, screenY;
      
      if (useHexGrid) {
        // For hexagonal grid, use hex-to-pixel conversion
        const hexCoords = hexToPixel(c - cameraX, r - cameraY);
        screenX = hexCoords.x;
        screenY = hexCoords.y;
      } else {
        // For square grid, use traditional calculation
        screenX = (c - cameraX) * TILE;
        screenY = (r - cameraY) * TILE;
      }
      
    const idx = r * COLS + c;
    
    // Save state before cell drawing
    push();
    
    // Get terrain type
    const terrainType = normalizeTerrainType(terrain[idx]);
    if (!blendedTerrain && useHexGrid) {
      drawHexTerrainBase(screenX, screenY, terrainType, c, r);
    } else if (!blendedTerrain) {
      drawTerrainBaseTile(screenX, screenY, TILE, TILE, terrainType, c, r);
    }
    noFill();
    stroke(255, 255, 255, blendedTerrain ? 7 : (useHexGrid ? 20 : 12));
    strokeWeight(Math.max(0.35, TILE * 0.006));
    if (useHexGrid) {
      drawHexagon(screenX, screenY, HEX_SIZE);
    } else {
      rect(screenX, screenY, TILE, TILE);
    }

    // Restore state after each cell
    pop();
    }
  }

  for(let r = startRow; r < endRow; r++) {
    for(let c = startCol; c < endCol; c++) {
      let screenX, screenY;
      if (useHexGrid) {
        const hexCoords = hexToPixel(c - cameraX, r - cameraY);
        screenX = hexCoords.x;
        screenY = hexCoords.y;
      } else {
        screenX = (c - cameraX) * TILE;
        screenY = (r - cameraY) * TILE;
      }

      const idx = r * COLS + c;
      const terrainType = normalizeTerrainType(terrain[idx]);
      push();
      if (!blendedTerrain && useHexGrid) {
        drawHexTerrainOverlay(screenX, screenY, terrainType, c, r);
      } else if (!blendedTerrain) {
        drawTerrainOverlayTile(screenX, screenY, TILE, TILE, terrainType, c, r);
      }
      pop();
    }
  }

  for(let r = startRow; r < endRow; r++) {
    for(let c = startCol; c < endCol; c++) {
      const idx = r * COLS + c;
      const settlement = settlements[idx];
      if (!settlement) continue;
      let screenX, screenY;
      if (useHexGrid) {
        const hexCoords = hexToPixel(c - cameraX, r - cameraY);
        screenX = hexCoords.x;
        screenY = hexCoords.y;
      } else {
        screenX = (c - cameraX) * TILE;
        screenY = (r - cameraY) * TILE;
      }
      push();
      drawSettlementMarker(settlement, screenX, screenY);
      pop();
    }
  }
  
  pop();
}
function drawUnits(){
  push(); translate(OFFSET,OFFSET);
  
  // Add hex grid offset to position it better on screen
  if (useHexGrid) {
    const offset = getHexGridOffset();
    translate(offset.x, offset.y); // Move hex grid down and right
  }
  
  // Draw and update any damage popups
  if (!window.damagePopups) window.damagePopups = [];
  // Update popups: move up and fade
  for (let i = window.damagePopups.length - 1; i >= 0; i--) {
    const p = window.damagePopups[i];
    p.y -= p.dy; p.alpha -= p.fade;
    p.ttl -= 1;
    if (p.alpha <= 0 || p.ttl <= 0) window.damagePopups.splice(i, 1);
  }
  for(const u of units){
    if(u.hp<=0)continue;
    
    // Calculate screen position relative to camera
    let x, y;
    if (useHexGrid) {
      const hexCoords = hexToPixel(u.col - cameraX, u.row - cameraY);
      x = hexCoords.x;
      y = hexCoords.y;
    } else {
      const screenX = (u.col - cameraX) * TILE;
      const screenY = (u.row - cameraY) * TILE;
      x = screenX + TILE/2;
      y = screenY + TILE/2;
    }
    const animated = ActionEffects.position(u, tile => useHexGrid
      ? hexToPixel(tile.col-cameraX,tile.row-cameraY)
      : {x:(tile.col-cameraX)*TILE+TILE/2,y:(tile.row-cameraY)*TILE+TILE/2});
    x=animated.x;y=animated.y;
    // Adjust unit size based on grid type
    const unitScale = useHexGrid ? 0.8 : 1.0; // Make units 20% smaller in hex mode
    const teamColor = getTeamColor(u.team);
    const canAttackNow = canUnitAttackFromCurrentPosition(u);
    const blinkPulse = canAttackNow ? (0.5 + 0.5 * Math.sin(frameCount * 0.18)) : 0;
    const backingAlpha = canAttackNow ? 88 + blinkPulse * 116 : 92;
    const strokeAlpha = canAttackNow ? 168 + blinkPulse * 82 : 180;
    fill(teamColor.fill[0], teamColor.fill[1], teamColor.fill[2], backingAlpha);
    stroke(teamColor.stroke[0], teamColor.stroke[1], teamColor.stroke[2], strokeAlpha);
    strokeWeight(canAttackNow ? 2.6 + blinkPulse * 1.6 : 2);
    if (useHexGrid) {
      drawHexagon(x, y, HEX_SIZE * 0.82);
    } else {
      rectMode(CENTER);
      rect(x, y, TILE * 0.94, TILE * 0.94, 6);
      rectMode(CORNER);
    }
    
    // Define unit emojis
    const unitEmojis = {
      'Soldier': '⚔️',
      'Archer': '🏹',
      'Knight': '🛡️',
      'Catapult': '☄️',
      'Spearman': '🔱',
      'Swordsman': '🗡️',
      'Assassin': '🥷',
      'Dragon': '🐉',
      'Cleric': '⛑️',
      'Sloop': '⛵',
      'Man-of-War': '🚢',
      'Battleship': '🛳️',
      'Fortress': '🏰',
      'Stockade': '🛖',
      'Castle': '🏰',
      'Heavy Fortress': '🛕'
    };
    
    // Draw unit image if available, otherwise fallback to emoji
    noStroke(); fill(255); textAlign(CENTER,CENTER);
    const img = IMAGES[u.name];
    const spriteY = y + getUnitMoveBobOffset(u);
    if (img && IMAGE_LOAD_STATUS[u.name] === 'loaded') {
      // Scale image to fit inside the owning tile while preserving aspect ratio.
      const maxSize = TILE * (isFortressUnit(u) ? 0.9 : 0.84) * unitScale;
      const iw = img.width || maxSize;
      const ih = img.height || maxSize;
      const ratio = Math.min(maxSize / iw, maxSize / ih);
      const w = iw * ratio;
      const h = ih * ratio;
      // Try p5 image() first if available
      if (typeof image === 'function') {
        try{ imageMode(CENTER); image(img, x, spriteY, w, h); imageMode(CORNER); }
        catch(e){
          // fallback to direct canvas drawImage
          try{ const ctx = (document.querySelector('canvas')||{}).getContext('2d'); if(ctx) ctx.drawImage(img, x + OFFSET - w/2, spriteY + OFFSET - h/2, w, h); }
          catch(e2){ textSize(TILE*0.25); text(unitEmojis[u.name], x, spriteY-2); }
        }
      } else {
  // No p5 image(); try direct canvas drawImage (account for p5 translate(OFFSET,OFFSET))
  try{ 
    const ctx = (document.querySelector('canvas')||{}).getContext('2d'); 
    if(ctx) {
      ctx.drawImage(img, x + OFFSET - w/2, spriteY + OFFSET - h/2, w, h); 
    } else { 
      const emojiScale = u.isWaterUnit ? 0.35 : 0.25;
      textSize(TILE * emojiScale * unitScale); 
      text(unitEmojis[u.name], x, spriteY-2); 
    } 
  }
  catch(e){ 
    const emojiScale = u.isWaterUnit ? 0.35 : 0.25;
    textSize(TILE * emojiScale * unitScale); 
    text(unitEmojis[u.name], x, spriteY-2); 
  }
      }
    } else {
      // Make naval units bigger
      const emojiScale = u.isWaterUnit ? 0.35 : 0.25;
      textSize(TILE * emojiScale * unitScale);
      text(unitEmojis[u.name], x, spriteY-2);
    }
    
    drawUnitStatusIndicators(u, x, y, unitScale);
    
    // Draw water unit anchor in bottom-right corner if unit is water-upgraded
    if (u.isWaterUnit) {
      textSize(TILE*0.25*unitScale);
      text('⚓', x + TILE*0.2*unitScale, y + TILE*0.2*unitScale);
    }
    
    // Draw spearman adjacency shield in top-left if adjacent ally Spearman exists
    if (u.name === 'Spearman') {
      const hasAdjacentAllySpearman = !!units.find(v => v !== u && v.team === u.team && v.name === 'Spearman' && manhattan(v.col, v.row, u.col, u.row) === 1);
      if (hasAdjacentAllySpearman) {
        textSize(TILE*0.18*unitScale);
        text('🛡️', x - TILE*0.28*unitScale, y + TILE*0.20*unitScale);
      }
    }
    const barW=TILE*0.6*unitScale,hpY=y+TILE*0.44*unitScale;
    fill(255,255,255,16); rect(x-barW/2,hpY,barW,8*unitScale,4);
    const pct=constrain(u.hp/u.maxHp,0,1);
    fill(pct>0.5?'#22c55e':pct>0.25?'#facc15':'#f43f5e');
    rect(x-barW/2,hpY,barW*pct,8*unitScale,4);
    // small icons for actions
    textSize(10*unitScale); fill(255);
    if(u.hasMoved) text("🚶",x-18*unitScale,y+4*unitScale);
    if(u.hasActed) text("⚔️",x+18*unitScale,y+4*unitScale);
  } pop();
  // Render popups on top
  push(); translate(OFFSET, OFFSET); textAlign(CENTER, CENTER);
  for (const p of (window.damagePopups || [])) {
    push();
    translate(p.x, p.y);
    textAlign(CENTER, CENTER);
    // subtle shadow for readability
    noStroke();
    fill(0, Math.min(200, Math.floor(p.alpha * 0.7)));
    textSize(TILE * 0.34);
    text(p.text, 2, 2);
    // main white text
    fill(255, Math.max(0, Math.floor(p.alpha)));
    textSize(TILE * 0.32);
    text(p.text, 0, 0);
    pop();
  }
  pop();
}
function moraleLabel(u){
  if(!u) return 'Neutral';
  if(u.morale<=0)return"Broken";
  if(u.morale<=30)return"Scared";
  if(u.morale<=75)return"Neutral";
  if(u.morale>=120)return"Very Happy";
  return"Happy";
}
function drawHighlights(){
  push(); translate(OFFSET,OFFSET);
  
  // Add hex grid offset to position it better on screen
  if (useHexGrid) {
    const offset = getHexGridOffset();
    translate(offset.x, offset.y); // Move hex grid down and right
  }
  
  if(isEditorMode) {
    // In editor mode, highlight the grid cell under the mouse
    const worldCoords = mouseToWorldCoords(mouseX, mouseY);
    const worldCol = worldCoords.col;
    const worldRow = worldCoords.row;
    const screenCol = worldCol - cameraX;
    const screenRow = worldRow - cameraY;
    
    if(worldCol >= 0 && worldCol < COLS && worldRow >= 0 && worldRow < ROWS) {
      noFill(); stroke(80,200,255); strokeWeight(2);
      if (useHexGrid) {
        const hexCoords = hexToPixel(worldCol - cameraX, worldRow - cameraY);
        push();
        translate(hexCoords.x, hexCoords.y);
        drawHexagon(0, 0, HEX_SIZE * 0.9);
        pop();
      } else {
        rect(screenCol*TILE+4, screenRow*TILE+4, TILE-8, TILE-8, 8);
      }
      
      // Draw placement preview
      if(placingUnitType && !getUnitAt(worldCol, worldRow)) {
        const previewColor = getTeamColor(placingUnitTeam);
        fill(previewColor.fill[0], previewColor.fill[1], previewColor.fill[2], 128);
        stroke(255,255,255,100);
        strokeWeight(2);
        
        if (useHexGrid) {
          const hexCoords = hexToPixel(worldCol - cameraX, worldRow - cameraY);
          ellipse(hexCoords.x, hexCoords.y, HEX_SIZE * 1.3);
          fill(255,255,255,200);
          noStroke();
          textAlign(CENTER,CENTER);
          textSize(12);
          text(placingUnitType[0], hexCoords.x, hexCoords.y-4);
        } else {
          const x=screenCol*TILE+TILE/2, y=screenRow*TILE+TILE/2;
          ellipse(x,y,TILE*0.65);
          fill(255,255,255,200);
          noStroke();
          textAlign(CENTER,CENTER);
          textSize(12);
          text(placingUnitType[0],x,y-4);
        }
      }
    }
    pop();
    return;
  }
  
  // Draw selected unit highlights (only if there's a selected unit and not in build mode)
  if(selectedUnit && !buildMode) {
    noFill(); stroke(255,220,120); strokeWeight(2.5);
    
    if (useHexGrid) {
      const hexCoords = hexToPixel(selectedUnit.col - cameraX, selectedUnit.row - cameraY);
      ellipse(hexCoords.x, hexCoords.y, HEX_SIZE * 1.6);
    } else {
      rect((selectedUnit.col - cameraX)*TILE+4,(selectedUnit.row - cameraY)*TILE+4,TILE-8,TILE-8,8);
    }
    // movement tiles
    if(!selectedUnit.hasMoved){
      fill(80,150,220,60); noStroke();
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
        if(!getUnitAt(c,r) && manhattan(selectedUnit.col,selectedUnit.row,c,r)<=selectedUnit.move && canMoveTo(selectedUnit, c, r)){
          // Only highlight tiles in viewport
          const viewport = getViewportSize();
          if (c >= cameraX && c < cameraX + viewport.cols && r >= cameraY && r < cameraY + viewport.rows) {
            if (useHexGrid) {
              const hexCoords = hexToPixel(c - cameraX, r - cameraY);
              push();
              translate(hexCoords.x, hexCoords.y);
              drawHexagon(0, 0, HEX_SIZE * 0.9);
              pop();
            } else {
              rect((c - cameraX)*TILE,(r - cameraY)*TILE,TILE,TILE,6);
            }
          }
        }
      }
    }
    // attack/heal tiles
    if(!selectedUnit.hasActed){
      if(selectedUnit.name === 'Cleric') {
        // Cleric healing - highlight friendly units that can be healed (green circles)
        stroke(60,255,60); strokeWeight(3); noFill();
        for(const f of units.filter(u=>u.team===selectedUnit.team&&u.hp>0&&u.hp<u.maxHp&&u.id!==selectedUnit.id)){
          if(manhattan(selectedUnit.col,selectedUnit.row,f.col,f.row)<=selectedUnit.atkRange){
            // Only highlight units in viewport
            const viewport = getViewportSize();
            if (f.col >= cameraX && f.col < cameraX + viewport.cols && f.row >= cameraY && f.row < cameraY + viewport.rows) {
              if (useHexGrid) {
                const hexCoords = hexToPixel(f.col - cameraX, f.row - cameraY);
                ellipse(hexCoords.x, hexCoords.y, HEX_SIZE * 1.6);
              } else {
                ellipse((f.col - cameraX)*TILE+TILE/2,(f.row - cameraY)*TILE+TILE/2,TILE*1.0);
              }
            }
          }
        }
      } else {
        // Check if unit can attack (swamp restriction)
        const attackerTerrainIdx = selectedUnit.row * COLS + selectedUnit.col;
        const attackerTerrain = terrain[attackerTerrainIdx];
        const canAttackFromHere = !(attackerTerrain === 'SWAMP' && TERRAIN.SWAMP.noAttack && selectedUnit.name !== 'Assassin');
        
        if (canAttackFromHere) {
          // Normal attack - highlight enemy units (red circles)
          stroke(255,60,60); strokeWeight(3); noFill();
          for(const e of units.filter(u=>u.team!==selectedUnit.team&&u.hp>0)){
            if(manhattan(selectedUnit.col,selectedUnit.row,e.col,e.row)<=selectedUnit.atkRange){
              // Only highlight units in viewport
              const viewport = getViewportSize();
              if (e.col >= cameraX && e.col < cameraX + viewport.cols && e.row >= cameraY && e.row < cameraY + viewport.rows) {
                if (useHexGrid) {
                  const hexCoords = hexToPixel(e.col - cameraX, e.row - cameraY);
                  ellipse(hexCoords.x, hexCoords.y, HEX_SIZE * 1.6);
                } else {
                  ellipse((e.col - cameraX)*TILE+TILE/2,(e.row - cameraY)*TILE+TILE/2,TILE*1.0);
                }
              }
            }
          }
        }
      }
    }
  }
  // If build mode is active, highlight eligible fortress build tiles with a bright blue glow
  if (buildMode) {
    console.log('Build mode is active, checking tiles...');
    noStroke();
    let highlightedCount = 0;
    for (let rr = 0; rr < ROWS; rr++) {
      for (let cc = 0; cc < COLS; cc++) {
        const idx = rr * COLS + cc;
        const isOccupied = !!getUnitAt(cc, rr);
        const hasTerrain = !!terrain[idx];
        const hasSettlement = !!settlements[idx];
        const isWater = normalizeTerrainType(terrain[idx]) === 'WATER';
        const nearOwnedPort = isNearOwnedPort(cc, rr, currentTeam);
        
        // adjacency: check if tile is adjacent to any friendly unit (always show all buildable locations)
        const adj = units.some(u => u.team === currentTeam && u.hp > 0 && isAdjacentTile(u.col, u.row, cc, rr));
        
        // Highlight if we can build fortresses OR ships
        const canBuildFortress = !isOccupied && !hasTerrain && !hasSettlement && adj;
        const canBuildShips = !isOccupied && !hasSettlement && isWater && nearOwnedPort;
        
        if (canBuildFortress || canBuildShips) {
          highlightedCount++;
          // Only highlight tiles in viewport
          const viewport = getViewportSize();
          if (cc >= cameraX && cc < cameraX + viewport.cols && rr >= cameraY && rr < cameraY + viewport.rows) {
            // Draw a prominent blue highlight for fortress building locations
            if (useHexGrid) {
              const hexCoords = hexToPixel(cc - cameraX, rr - cameraY);
              fill(24, 120, 220, 90);
              push();
              translate(hexCoords.x, hexCoords.y);
              drawHexagon(0, 0, HEX_SIZE * 0.9);
              pop();
              // Bright inner highlight
              fill(64, 160, 255, 65);
              push();
              translate(hexCoords.x, hexCoords.y);
              drawHexagon(0, 0, HEX_SIZE * 0.7);
              pop();
              // Central glow
              fill(100, 180, 255, 40);
              push();
              translate(hexCoords.x, hexCoords.y);
              drawHexagon(0, 0, HEX_SIZE * 0.5);
              pop();
            } else {
              fill(24, 120, 220, 90);  // Using p5.js color format instead of rgba string
              rect((cc - cameraX)*TILE+1, (rr - cameraY)*TILE+1, TILE-2, TILE-2, 8);
              // Bright inner highlight
              fill(64, 160, 255, 65);
              rect((cc - cameraX)*TILE+4, (rr - cameraY)*TILE+4, TILE-8, TILE-8, 6);
              // Central glow
              fill(100, 180, 255, 40);
              rect((cc - cameraX)*TILE+8, (rr - cameraY)*TILE+8, TILE-16, TILE-16, 4);
            }
          }
        }
      }
    }
    if (highlightedCount > 0) {
      console.log(`Highlighted ${highlightedCount} buildable tiles`);
    } else {
      console.log('No buildable tiles found. Current team:', currentTeam, 'Units:', units.filter(u => u.team === currentTeam && u.hp > 0).length);
    }
  }
  
  pop();
}
function drawGameOver(){
  fill(0,0,0,160); rect(0,0,width,height);
  fill(255); textAlign(CENTER,CENTER); textSize(32);
  const w = getWinner();
  let msg = 'Game Over';
  
  if (w === 'PLAYER') {
    msg = 'You Win!';
  } else if (w === 'PLAYER2') {
    msg = 'Player 2 Wins!';
  } else if (w === 'DRAW') {
    msg = 'Draw - All Teams Eliminated!';
  } else if (w && isAITeam(w)) {
    // Handle any AI team win
    const teamDisplayName = getTeamDisplayName(w);
    msg = `${teamDisplayName} Wins!`;
  } else if (w) {
    // Fallback for any other team
    msg = `${w} Wins!`;
  }
  
  text(msg, width/2, height/2);
}

// Warborn terrain art v2. Six original paintings per surface, blended in map space.
// Cached separately from units, selection and UI: no per-frame image processing.
const TERRAIN_V2_TYPES = ['GRASS', 'WOODS', 'MOUNTAIN', 'SWAMP', 'DESERT', 'WATER', 'FOUNTAIN', 'BRIDGE', 'FARM'];
// Inspected travel direction in each painting (not the long side of its art).
// Paintings 1, 4 and 6 have north-south paths over an east-west stream.
const TERRAIN_V2_BRIDGE_DECK_ANGLES = [90, 0, 0, 90, 0, 90];
const TERRAIN_V2 = {
  images: {}, loaded: 0, failed: 0, revision: 0, layer: null, key: '',
  variants: null, variantsKey: '', stamps: new Map(), builds: 0
};

function terrainV2Type(value) {
  const type = normalizeTerrainType(value) || 'GRASS';
  return TERRAIN_V2_TYPES.includes(type) ? type : 'GRASS';
}

function preloadTerrainV2() {
  for (const type of TERRAIN_V2_TYPES) {
    TERRAIN_V2.images[type] = Array(6).fill(null);
    for (let variant = 0; variant < 6; variant++) {
      const img = new Image();
      img.onload = () => {
        // Retain a game-resolution surface, not 54 full-resolution bitmaps.
        // Full-size source paintings remain in the terrain pack for editing.
        const surface = terrainV2Canvas(384, 384);
        const context = surface.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(img, 0, 0, 384, 384);
        TERRAIN_V2.images[type][variant] = surface;
        if (TERRAIN_V2.images[type].every(Boolean)) terrainV2MatchPalette(type);
        TERRAIN_V2.loaded++;
        TERRAIN_V2.revision++;
        TERRAIN_V2.stamps.clear();
      };
      img.onerror = () => {
        TERRAIN_V2.failed++;
        TERRAIN_V2.revision++;
        console.warn('Terrain v2 image missing:', type, variant + 1);
      };
      img.src = `assets/terrain/v2/${type.toLowerCase()}-${variant + 1}.jpg${type === 'WOODS' ? '?v=lightforest1' : ''}`;
    }
  }
}

// Match the six paintings' average color while preserving their individual
// detail. This prevents a pale water painting forming a bright hex-shaped
// patch when it happens to sit between five darker water paintings.
function terrainV2MatchPalette(type) {
  const surfaces = TERRAIN_V2.images[type];
  const records = surfaces.map(surface => {
    const ctx = surface.getContext('2d', {willReadFrequently:true});
    const pixels = ctx.getImageData(0, 0, surface.width, surface.height);
    const mean = [0, 0, 0];
    for (let i = 0; i < pixels.data.length; i += 4) for (let k = 0; k < 3; k++) mean[k] += pixels.data[i + k];
    const count = pixels.data.length / 4;
    return {ctx, pixels, mean:mean.map(n => n / count)};
  });
  const target = [0, 1, 2].map(k => records.reduce((sum, r) => sum + r.mean[k], 0) / records.length);
  const amount = ['WATER', 'GRASS'].includes(type) ? 1 : 0.8;
  for (const record of records) {
    const data = record.pixels.data;
    const contrast = type === 'WATER' ? 0.76 : 1;
    for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) {
      data[i+k] = Math.max(0, Math.min(255, record.mean[k] + (data[i+k] - record.mean[k]) * contrast + (target[k] - record.mean[k]) * amount));
    }
    record.ctx.putImageData(record.pixels, 0, 0);
  }
}

// Greedy deterministic coloring avoids identical artwork in adjacent cells.
// Includes square diagonals and all six odd-column hex neighbors.
function terrainV2Variants(cols, rows) {
  const key = `${cols}:${rows}`;
  if (TERRAIN_V2.variantsKey === key) return TERRAIN_V2.variants;
  const result = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const used = new Set();
      if (c) used.add(result[r * cols + c - 1]);
      if (r) {
        for (let dc = -1; dc <= 1; dc++) {
          if (c + dc >= 0 && c + dc < cols) used.add(result[(r - 1) * cols + c + dc]);
        }
      }
      let index = terrainHash(c, r, 7429) % 6;
      while (used.has(index)) index = (index + 1) % 6;
      result[r * cols + c] = index;
    }
  }
  TERRAIN_V2.variants = result;
  TERRAIN_V2.variantsKey = key;
  return result;
}

function terrainV2Canvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

// Infer the stream axis from neighboring water in map coordinates, then put
// the bridge deck perpendicular to it. Two rings also handle wider channels.
function terrainV2BridgeAngle(col, row, cols, rows, hex, values, parity = 0) {
  const position = (c, r) => hex
    ? {x: 1.5 * c, y: Math.sqrt(3) * (r + 0.5 * ((c - parity) & 1))}
    : {x: 2 * c, y: 2 * r};
  // Treat a connected bridge crossing as one structure when finding the
  // channel direction, so adjoining bridge tiles do not point different ways.
  const group = [[col, row]], seen = new Set([row * cols + col]);
  for (let i = 0; i < group.length && i < 100; i++) {
    const [c, r] = group[i];
    const dirs = !hex ? [[1,0],[-1,0],[0,1],[0,-1]] : ((c-parity)&1)
      ? [[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]]
      : [[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]];
    for (const [dc,dr] of dirs) {
      const x=c+dc,y=r+dr,k=y*cols+x;
      if(x<0||x>=cols||y<0||y>=rows||seen.has(k)||terrainV2Type(values[k])!=='BRIDGE')continue;
      seen.add(k);group.push([x,y]);
    }
  }
  if (group.length > 1) {
    const points=group.map(([c,r])=>position(c,r));
    const cx=points.reduce((sum,p)=>sum+p.x,0)/points.length,cy=points.reduce((sum,p)=>sum+p.y,0)/points.length;
    let xx=0,xy=0,yy=0;
    const left=Math.max(0,Math.min(...group.map(p=>p[0]))-3),right=Math.min(cols-1,Math.max(...group.map(p=>p[0]))+3);
    const top=Math.max(0,Math.min(...group.map(p=>p[1]))-3),bottom=Math.min(rows-1,Math.max(...group.map(p=>p[1]))+3);
    for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++){
      if(terrainV2Type(values[r*cols+c])!=='WATER')continue;
      const p=position(c,r),dx=p.x-cx,dy=p.y-cy,w=1/Math.max(1,dx*dx+dy*dy);
      xx+=dx*dx*w;xy+=dx*dy*w;yy+=dy*dy*w;
    }
    if(xx+yy>0)return Math.round((0.5*Math.atan2(2*xy,xx-yy)+Math.PI/2)/(Math.PI/12))*Math.PI/12;
  }
  const center = position(col, row);
  let xx = 0, xy = 0, yy = 0, total = 0;
  for (let r = Math.max(0, row - 2); r <= Math.min(rows - 1, row + 2); r++) {
    for (let c = Math.max(0, col - 2); c <= Math.min(cols - 1, col + 2); c++) {
      if (terrainV2Type(values[r * cols + c]) !== 'WATER') continue;
      const p = position(c, r), dx = p.x - center.x, dy = p.y - center.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.01 || d2 > (hex ? 12.01 : 16.01)) continue;
      const weight = 1 / (d2 * d2);
      xx += dx * dx * weight; xy += dx * dy * weight; yy += dy * dy * weight;
      total += 1 / d2;
    }
  }
  if (!total || Math.hypot(xx - yy, 2 * xy) < total * 0.08) return 0;
  const riverAngle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const deckAngle = riverAngle + Math.PI / 2;
  // Quantize to 15 degrees to keep the stamp cache bounded for winding rivers.
  return Math.round(deckAngle / (Math.PI / 12)) * Math.PI / 12;
}

function terrainV2Stamp(type, variant, hex, angle = 0) {
  const key = `${type}:${variant}:${hex}:${angle.toFixed(4)}`;
  if (TERRAIN_V2.stamps.has(key)) return TERRAIN_V2.stamps.get(key);
  const size = 192;
  const stamp = terrainV2Canvas(size, size);
  const ctx = stamp.getContext('2d', { willReadFrequently: true });
  const images = TERRAIN_V2.images[type] || [];
  const image = images[variant] || images.find(Boolean);
  if (image) {
    const rotation = angle - (type === 'BRIDGE' ? TERRAIN_V2_BRIDGE_DECK_ANGLES[variant] * Math.PI / 180 : 0);
    ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(rotation);
    // Cover all corners at any rotation without transparent wedges.
    const coverage = Math.abs(Math.cos(rotation)) + Math.abs(Math.sin(rotation));
    const span = size * coverage;
    ctx.drawImage(image, -span / 2, -span / 2, span, span);
    ctx.restore();
  }
  else {
    const color = getTerrainBaseColor(type === 'GRASS' ? null : type);
    ctx.fillStyle = `rgb(${color.join(',')})`;
    ctx.fillRect(0, 0, size, size);
  }
  const pixels = ctx.getImageData(0, 0, size, size);
  // Stamp extends 25% beyond the cell. Use exact polygon distance, not a blur
  // of the artwork, to keep interior foliage, rocks and structures crisp.
  const softSurface = ['WATER', 'GRASS'].includes(type);
  const extent = softSurface ? 1.5 : 1.25;
  const apothem = Math.sqrt(3) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = ((x + 0.5) / size * 2 - 1) * extent;
      const py = ((y + 0.5) / size * 2 - 1) * extent;
      const distance = hex
        ? Math.max(Math.abs(py), Math.abs(apothem * px + 0.5 * py), Math.abs(apothem * px - 0.5 * py)) / apothem
        : Math.max(Math.abs(px), Math.abs(py));
      const t = Math.max(0, Math.min(1, ((softSurface ? 1.35 : 1.18) - distance) / (softSurface ? 0.7 : 0.36)));
      const weight = t * t * (3 - 2 * t);
      // Additive compositing sums premultiplied RGB and weights. Keep the sum
      // below 1 so the canvas never clamps; normalize once after all stamps.
      pixels.data[(y * size + x) * 4 + 3] = Math.round(weight * 60);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  TERRAIN_V2.stamps.set(key, stamp);
  return stamp;
}

function terrainV2CellPath(ctx, x, y, radius, hex) {
  if (!hex) { ctx.rect(x - radius, y - radius, radius * 2, radius * 2); return; }
  ctx.moveTo(x + radius, y);
  for (let i = 1; i < 6; i++) ctx.lineTo(x + radius * Math.cos(i * Math.PI / 3), y + radius * Math.sin(i * Math.PI / 3));
  ctx.closePath();
}

function buildTerrainV2Layer(cols, rows, hex, values, parity = 0) {
  const apothem = Math.sqrt(3) / 2;
  const widthUnits = hex ? 1.5 * (cols - 1) + 2 : cols * 2;
  const heightUnits = hex ? Math.sqrt(3) * (rows + (cols > 1 || parity ? 0.5 : 0)) : rows * 2;
  // Keep backing-store memory bounded even on 50x50 editor maps.
  const radius = Math.min(70, 2304 / Math.max(widthUnits, heightUnits));
  const width = Math.ceil(widthUnits * radius);
  const height = Math.ceil(heightUnits * radius);
  const layer = terrainV2Canvas(width, height);
  const ctx = layer.getContext('2d', { willReadFrequently: true });
  const variants = terrainV2Variants(cols, rows);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = 'lighter';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = terrainV2Type(values[r * cols + c]);
      const variant = variants[r * cols + c];
      const x = hex ? (1 + 1.5 * c) * radius : (2 * c + 1) * radius;
      const y = hex ? (apothem + Math.sqrt(3) * (r + 0.5 * ((c - parity) & 1))) * radius : (2 * r + 1) * radius;
      const angle = type === 'BRIDGE' ? terrainV2BridgeAngle(c, r, cols, rows, hex, values, parity) : 0;
      const stamp = terrainV2Stamp(type, variant, hex, angle);
      ctx.save(); ctx.translate(x, y);
      // Keep bridges and fountains upright; organic textures get stable flips.
      if (!['BRIDGE', 'FOUNTAIN', 'FARM'].includes(type)) {
        const orientation = terrainHash(c, r, 9731);
        ctx.scale(orientation & 1 ? -1 : 1, orientation & 2 ? -1 : 1);
      }
      const extent = ['WATER', 'GRASS'].includes(type) ? 1.5 : 1.25;
      ctx.drawImage(stamp, -radius * extent, -radius * extent, radius * extent * 2, radius * extent * 2);
      ctx.restore();
    }
  }
  const pixels = ctx.getImageData(0, 0, width, height);
  // getImageData returns unpremultiplied RGB: the accumulated alpha already
  // divided each pixel by its total weight. Restore opaque board coverage.
  for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] ? 255 : 0;
  ctx.putImageData(pixels, 0, 0);
  // Exact board silhouette. Feathering crosses internal edges only.
  const mask = terrainV2Canvas(width, height);
  const m = mask.getContext('2d');
  m.fillStyle = '#fff'; m.beginPath();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = hex ? (1 + 1.5 * c) * radius : (2 * c + 1) * radius;
    const y = hex ? (apothem + Math.sqrt(3) * (r + 0.5 * ((c - parity) & 1))) * radius : (2 * r + 1) * radius;
    terrainV2CellPath(m, x, y, radius + 0.35, hex);
  }
  m.fill(); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mask, 0, 0);
  TERRAIN_V2.builds++;
  return { canvas: layer, radius, widthUnits, heightUnits };
}

function drawBlendedTerrainBoard() {
  if (!terrain || !Number.isFinite(COLS) || !Number.isFinite(ROWS) || COLS < 1 || ROWS < 1) return false;
  const parity = useHexGrid ? cameraX & 1 : 0;
  const artRevision = TERRAIN_V2.loaded + TERRAIN_V2.failed === 54 ? TERRAIN_V2.revision : 0;
  const key = `${COLS}:${ROWS}:${useHexGrid}:${parity}:${artRevision}:${terrain.join('|')}`;
  if (!TERRAIN_V2.layer || TERRAIN_V2.key !== key) {
    TERRAIN_V2.layer = buildTerrainV2Layer(COLS, ROWS, useHexGrid, terrain, parity);
    TERRAIN_V2.key = key;
  }
  const layer = TERRAIN_V2.layer;
  const radius = useHexGrid ? HEX_SIZE : TILE / 2;
  const x = useHexGrid ? -HEX_SIZE - cameraX * 1.5 * HEX_SIZE : -cameraX * TILE;
  const y = useHexGrid ? -getHexApothem() - cameraY * Math.sqrt(3) * HEX_SIZE : -cameraY * TILE;
  drawingContext.drawImage(layer.canvas, x, y, layer.widthUnits * radius, layer.heightUnits * radius);
  return true;
}

preloadTerrainV2();

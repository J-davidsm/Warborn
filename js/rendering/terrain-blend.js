// Warborn terrain art v2. Six original paintings per surface, blended in map space.
// Cached separately from units, selection and UI: no per-frame image processing.
const TERRAIN_V2_BRIDGE_IMAGE = 'assets/terrain/v3/bridge-stone.png';
const TERRAIN_V2_TYPES = ['GRASS', 'WOODS', 'MOUNTAIN', 'SWAMP', 'DESERT', 'WATER', 'FOUNTAIN', 'BRIDGE', 'FARM'];
// New bridge paintings all run edge-to-edge from left to right.
const TERRAIN_V2_BRIDGE_DECK_ANGLES = [0, 0, 0, 0, 0, 0];
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
    const count = type === 'BRIDGE' ? 1 : 6;
    TERRAIN_V2.images[type] = Array(count).fill(null);
    for (let variant = 0; variant < count; variant++) {
      const img = new Image();
      img.onload = () => {
        // Retain a game-resolution surface, not 54 full-resolution bitmaps.
        // Full-size source paintings remain in the terrain pack for editing.
        const surface = terrainV2Canvas(384, 384);
        const context = surface.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(img, 0, 0, 384, 384);
        TERRAIN_V2.images[type][variant] = surface;
        if (type !== 'BRIDGE' && TERRAIN_V2.images[type].every(Boolean)) terrainV2MatchPalette(type);
        TERRAIN_V2.loaded++;
        TERRAIN_V2.revision++;
        TERRAIN_V2.stamps.clear();
      };
      img.onerror = () => {
        TERRAIN_V2.failed++;
        TERRAIN_V2.revision++;
        console.warn('Terrain v2 image missing:', type, variant + 1);
      };
      img.src = type === 'BRIDGE'
        ? TERRAIN_V2_BRIDGE_IMAGE
        : `assets/terrain/v2/${type.toLowerCase()}-${variant + 1}.jpg${['WOODS','SWAMP'].includes(type) ? '?v=training1' : ''}`;
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

function terrainV2FadeWeight(type, distance) {
  const natureSurface = !['BRIDGE', 'FARM', 'FOUNTAIN'].includes(type);
  const innerEdge = natureSurface ? 1.62 : 1.18;
  const featherWidth = natureSurface ? 1.02 : 0.36;
  const t = Math.max(0, Math.min(1, (innerEdge - distance) / featherWidth));
  return t * t * (3 - 2 * t);
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
    let gx=0,gy=0,gxy=0;
    for(const p of points){const dx=p.x-cx,dy=p.y-cy;gx+=dx*dx;gy+=dy*dy;gxy+=dx*dy;}
    if(Math.hypot(gx-gy,2*gxy)>(gx+gy)*0.65)return Math.round((0.5*Math.atan2(2*gxy,gx-gy))/(Math.PI/12))*Math.PI/12;
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
  const size = 384;
  const stamp = terrainV2Canvas(size, size);
  const ctx = stamp.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const images = TERRAIN_V2.images[type] || [];
  const image = images[variant] || images.find(Boolean);
  if (image) {
    const rotation = 0;
    ctx.save(); ctx.translate(size / 2, size / 2);
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
  // Nature surfaces overlap well beyond a cell edge. This keeps biome
  // transitions broad and continuous without blurring the artwork itself.
  // Built features remain more local so bridges and farms stay legible.
  const extent = !['BRIDGE', 'FARM', 'FOUNTAIN'].includes(type) ? 1.8 : 1.25;
  const apothem = Math.sqrt(3) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = ((x + 0.5) / size * 2 - 1) * extent;
      const py = ((y + 0.5) / size * 2 - 1) * extent;
      const distance = hex
        ? Math.max(Math.abs(py), Math.abs(apothem * px + 0.5 * py), Math.abs(apothem * px - 0.5 * py)) / apothem
        : Math.max(Math.abs(px), Math.abs(py));
      const weight = terrainV2FadeWeight(type, distance);
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

// Neighbor-facing ports meet at the exact shared edge, even on staggered hexes.
// Curves approach each port perpendicular to that edge, so the next tile's
// deck and parapets continue smoothly instead of ending at different heights.
function terrainV2BridgeTiles(cols,rows,hex,values,parity=0) {
  const pos=(c,r)=>hex?{x:1+1.5*c,y:Math.sqrt(3)*(r+.5*((c-parity)&1)) + Math.sqrt(3)/2}:{x:2*c+1,y:2*r+1};
  const tiles=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    if(terrainV2Type(values[r*cols+c])!=='BRIDGE')continue;
    const center=pos(c,r),dirs=!hex?[[1,0],[-1,0],[0,1],[0,-1]]:((c-parity)&1)?[[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]]:[[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]];
    const edges=dirs.map(([dc,dr])=>{
      const nc=c+dc,nr=r+dr,p=pos(nc,nr);
      return {x:(center.x+p.x)/2,y:(center.y+p.y)/2,neighborC:nc,neighborR:nr,type:nc<0||nc>=cols||nr<0||nr>=rows?'VOID':terrainV2Type(values[nr*cols+nc])};
    });
    const ports=edges.filter(p=>p.type==='BRIDGE');
    const directionScore=(p,angle)=>((p.x-center.x)*Math.cos(angle)+(p.y-center.y)*Math.sin(angle))/Math.hypot(p.x-center.x,p.y-center.y);
    function exit(angle,preferBank){
      const candidates=edges.filter(p=>!ports.includes(p));
      const banks=candidates.filter(p=>!['BRIDGE','WATER','VOID'].includes(p.type)&&directionScore(p,angle)>.25);
      const choices=preferBank&&banks.length?banks:candidates;
      const best=choices.reduce((a,b)=>!a||directionScore(b,angle)>directionScore(a,angle)+1e-8?b:a,null);
      if(best)ports.push(best);
    }
    if(ports.length===1){
      exit(Math.atan2(center.y-ports[0].y,center.x-ports[0].x),true);
    }else if(!ports.length){
      const angle=terrainV2BridgeAngle(c,r,cols,rows,hex,values,parity);
      exit(angle,true);
      // Isolated tiles remain straight and span the full cell between edges.
      exit(Math.atan2(center.y-ports[0].y,center.x-ports[0].x),false);
    }
    const paths=ports.length===2?[{from:ports[0],control:center,to:ports[1]}]
      :ports.map(p=>({from:p,control:{x:(p.x+center.x)/2,y:(p.y+center.y)/2},to:center}));
    tiles.push({c,r,center,ports,paths});
  }
  return tiles;
}

// Reuse the existing stone painting as masonry rather than stretching a
// complete bridge over a crossing. One material stays consistent at all bends.
function terrainV2BridgeMasonry(ctx,art,radius) {
  const texture=terrainV2Canvas(Math.max(1,Math.ceil(radius*1.6)),Math.max(1,Math.ceil(radius*.34)));
  const t=texture.getContext('2d');t.imageSmoothingQuality='high';
  t.drawImage(art,0,art.height*.39,art.width,art.height*.20,0,0,texture.width,texture.height);
  return ctx.createPattern(texture,'repeat');
}

function drawTerrainV2BridgeDecks(ctx,cols,rows,hex,values,parity,radius) {
  const tiles=terrainV2BridgeTiles(cols,rows,hex,values,parity);
  if(!tiles.length)return;
  const art=TERRAIN_V2.images.BRIDGE[0];
  ctx.save();ctx.globalCompositeOperation='source-over';
  // Restrict the connected artwork to bridge terrain; no invented crossings
  // through nearby water, and bank-facing ends stop at the shoreline.
  ctx.beginPath();for(const tile of tiles)terrainV2CellPath(ctx,tile.center.x*radius,tile.center.y*radius,radius+.25,hex);ctx.clip();
  ctx.beginPath();
  for(const tile of tiles)for(const path of tile.paths){
    ctx.moveTo(path.from.x*radius,path.from.y*radius);
    ctx.quadraticCurveTo(path.control.x*radius,path.control.y*radius,path.to.x*radius,path.to.y*radius);
  }
  ctx.lineCap='round';ctx.lineJoin='round';
  // Stroke the entire network in passes: junctions stay open without parapets
  // drawn across the middle, and neighboring sections share the same width.
  ctx.strokeStyle='#353b39';ctx.lineWidth=radius*.82;ctx.stroke();
  ctx.strokeStyle='#bbb9ab';ctx.lineWidth=radius*.75;ctx.stroke();
  ctx.strokeStyle='#666b64';ctx.lineWidth=radius*.60;ctx.stroke();
  ctx.strokeStyle=art?terrainV2BridgeMasonry(ctx,art,radius):'#95958a';ctx.lineWidth=radius*.56;ctx.stroke();
  ctx.restore();
}

// Quantized screen-density cache: preserve detail at zoom and on Retina displays.
// Bound both dimensions and total pixels so large editor maps remain affordable.
function terrainV2Resolution(cols, rows, hex, parity = 0, requestedRadius = 70) {
  const widthUnits = hex ? 1.5 * (cols - 1) + 2 : cols * 2;
  const heightUnits = hex ? Math.sqrt(3) * (rows + (cols > 1 || parity ? 0.5 : 0)) : rows * 2;
  const tier = Math.min(256, 64 * Math.pow(2, Math.max(0, Math.ceil(Math.log2(Math.max(1, requestedRadius) / 64)))));
  const radius = Math.min(tier, 4095 / Math.max(widthUnits, heightUnits),
    Math.sqrt(8000000 / (widthUnits * heightUnits)));
  return {radius, widthUnits, heightUnits};
}

function buildTerrainV2Layer(cols, rows, hex, values, parity = 0, requestedRadius = 70) {
  const apothem = Math.sqrt(3) / 2;
  const {radius, widthUnits, heightUnits} = terrainV2Resolution(cols, rows, hex, parity, requestedRadius);
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
      const rawType = terrainV2Type(values[r * cols + c]);
      const type = rawType === 'BRIDGE' ? 'WATER' : rawType;
      const variant = variants[r * cols + c];
      const x = hex ? (1 + 1.5 * c) * radius : (2 * c + 1) * radius;
      const y = hex ? (apothem + Math.sqrt(3) * (r + 0.5 * ((c - parity) & 1))) * radius : (2 * r + 1) * radius;
      const stamp = terrainV2Stamp(type, variant, hex, 0);
      ctx.save(); ctx.translate(x, y);
      // Preserve the original artwork orientation in every hex.
      const extent = !['BRIDGE', 'FARM', 'FOUNTAIN'].includes(type) ? 1.8 : 1.25;
      ctx.drawImage(stamp, -radius * extent, -radius * extent, radius * extent * 2, radius * extent * 2);
      ctx.restore();
    }
  }
  const pixels = ctx.getImageData(0, 0, width, height);
  // getImageData returns unpremultiplied RGB: the accumulated alpha already
  // divided each pixel by its total weight. Restore opaque board coverage.
  for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] ? 255 : 0;
  ctx.putImageData(pixels, 0, 0);
  drawTerrainV2BridgeDecks(ctx,cols,rows,hex,values,parity,radius);
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
  const artRevision = TERRAIN_V2.loaded + TERRAIN_V2.failed === 49 ? TERRAIN_V2.revision : 0;
  const key = `${COLS}:${ROWS}:${useHexGrid}:${parity}:${artRevision}:${terrain.join('|')}`;
  const worldRadius = useHexGrid ? HEX_SIZE : TILE / 2;
  const transform = drawingContext.getTransform();
  const screenScale = Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d));
  const requestedRadius = Math.max(70, worldRadius * screenScale);
  const desired = terrainV2Resolution(COLS, ROWS, useHexGrid, parity, requestedRadius);
  // Reuse the sharper cache when zooming out; panning never rebuilds it.
  if (!TERRAIN_V2.layer || TERRAIN_V2.key !== key || desired.radius > TERRAIN_V2.layer.radius + 0.01) {
    TERRAIN_V2.layer = buildTerrainV2Layer(COLS, ROWS, useHexGrid, terrain, parity, requestedRadius);
    TERRAIN_V2.key = key;
  }
  const layer = TERRAIN_V2.layer;
  const radius = useHexGrid ? HEX_SIZE : TILE / 2;
  const x = useHexGrid ? -HEX_SIZE - cameraX * 1.5 * HEX_SIZE : -cameraX * TILE;
  const y = useHexGrid ? -getHexApothem() - cameraY * Math.sqrt(3) * HEX_SIZE : -cameraY * TILE;
  drawingContext.save();
  drawingContext.imageSmoothingEnabled = true;
  drawingContext.imageSmoothingQuality = 'high';
  drawingContext.drawImage(layer.canvas, x, y, layer.widthUnits * radius, layer.heightUnits * radius);
  drawingContext.restore();
  return true;
}

preloadTerrainV2();

/* Pure, seeded multiplayer map generation. Even column counts make a 180-degree
   rotation an exact symmetry of the game's odd-column-offset hex grid. */
(function(root) {
  function generate(seed, cols = 20, rows = 16) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 16 || cols > 32 || rows < 12 || rows > 24 || cols % 2 || rows % 2) throw new Error('Map dimensions must be even.');
    let value = 2166136261;
    for (const c of String(seed)) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
    const random = () => { value += 0x6D2B79F5; let t = Math.imul(value ^ value >>> 15, 1 | value); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const terrain = Array(cols * rows).fill(null), settlements = Array(cols * rows).fill(null);
    const mirror = (c, r) => [cols - 1 - c, rows - 1 - r];
    const pair = (array, c, r, a, b = a) => { const [mc,mr] = mirror(c,r); array[r*cols+c] = a; array[mr*cols+mc] = b; };
    const types = ['WOODS','WOODS','MOUNTAIN','SWAMP','DESERT'];
    for (let i = 0; i < 26; i++) {
      const c = 1 + Math.floor(random() * (cols / 2 - 3)), r = Math.floor(random() * rows), type = types[Math.floor(random()*types.length)];
      for (let y = Math.max(0,r-1); y <= Math.min(rows-1,r+1); y++) for (let x = Math.max(0,c-1); x <= Math.min(cols/2-2,c+1); x++) if (random() < .8) pair(terrain,x,y,type);
    }
    const mid = rows/2-1;
    for (let r = 0; r < rows; r++) pair(terrain,cols/2-1,r,'WATER');
    // A guaranteed traversable, symmetric route between the two capitals.
    for (let c = 0; c < cols; c++) pair(terrain,c,mid,c===cols/2-1||c===cols/2?'BRIDGE':null);
    for (let r = mid-3; r <= mid+2; r++) for (let c = 0; c <= 5; c++) pair(terrain,c,r,null);
    pair(terrain,4,mid-2,'FOUNTAIN'); pair(terrain,4,mid+2,'FARM');
    pair(settlements,2,mid,{type:'CITY',owner:'PLAYER'},{type:'CITY',owner:'PLAYER2'});
    pair(settlements,6,mid-3,{type:'VILLAGE',owner:null},{type:'VILLAGE',owner:null});
    pair(settlements,6,mid+2,{type:'HAMLET',owner:null},{type:'HAMLET',owner:null});
    for(let i=0;i<settlements.length;i++) if(settlements[i]) terrain[i]=null;
    const units = [];
    [['Knight',2,mid],['Soldier',3,mid],['Soldier',2,mid+1],['Archer',1,mid],['Spearman',2,mid-1]].forEach(([name,c,r],i) => {
      const [mc,mr]=mirror(c,r); pair(terrain,c,r,null);
      units.push({id:`p1-${i}`,name,team:'PLAYER',col:c,row:r},{id:`p2-${i}`,name,team:'PLAYER2',col:mc,row:mr});
    });
    // Online matches begin with no stockpiled resources. Players must earn
    // income from the symmetric starting settlements before recruiting.
    const zeroResources = { food: 0, gold: 0, materials: 0 };
    return {seed:String(seed),cols,rows,terrain,settlements,units,
      resources:{PLAYER:{...zeroResources},PLAYER2:{...zeroResources}},
      firstTeam:random()<.5?'PLAYER':'PLAYER2'};
  }
  const api = {generate};
  if(typeof module!=='undefined') module.exports=api;
  else root.FairMap=api;
})(typeof window==='undefined'?globalThis:window);

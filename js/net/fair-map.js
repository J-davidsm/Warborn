/* Pure, seeded multiplayer map generation. Even dimensions make a 180-degree
   rotation an exact symmetry of the game's odd-column-offset hex grid. */
(function(root) {
  const THEMES = [
    {id:'highlands', name:'Highlands', dominant:'MOUNTAIN', coverage:.88, accents:['MOUNTAIN','MOUNTAIN','WOODS',null]},
    {id:'dunes', name:'Desert Expanse', dominant:'DESERT', coverage:.90, accents:['DESERT','DESERT','MOUNTAIN',null]},
    {id:'archipelago', name:'Island Chain', dominant:'WATER', coverage:.82, accents:['WATER','WATER',null,'WOODS','SWAMP']},
    {id:'wildwood', name:'Ancient Forest', dominant:'WOODS', coverage:.88, accents:['WOODS','WOODS',null,'SWAMP','MOUNTAIN']},
    {id:'wetlands', name:'Flooded Marsh', dominant:'SWAMP', coverage:.84, accents:['SWAMP','SWAMP','WATER',null,'WOODS']},
    {id:'frontier', name:'Open Frontier', dominant:null, coverage:.65, accents:[null,null,'WOODS','MOUNTAIN','DESERT','SWAMP']}
  ];

  function generate(seed, cols = 20, rows = 16) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 16 || cols > 32 || rows < 12 || rows > 24 || cols % 2 || rows % 2) throw new Error('Map dimensions must be even.');
    let value = 2166136261;
    for (const c of String(seed)) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
    const random = () => { value += 0x6D2B79F5; let t = Math.imul(value ^ value >>> 15, 1 | value); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const pick = values => values[Math.floor(random() * values.length)];
    const terrain = Array(cols * rows).fill(null), settlements = Array(cols * rows).fill(null);
    const mirror = (c, r) => [cols - 1 - c, rows - 1 - r];
    const pair = (array, c, r, a, b = a) => { const [mc,mr] = mirror(c,r); array[r*cols+c] = a; array[mr*cols+mc] = b; };
    const theme = pick(THEMES);

    // Establish a strong visual identity, then soften it with clustered accent
    // regions. Only one half is painted directly; pair() mirrors every change.
    for (let r=0; r<rows; r++) for (let c=0; c<cols/2; c++) {
      pair(terrain,c,r,random()<theme.coverage ? theme.dominant : pick(theme.accents));
    }
    for (let i=0; i<10; i++) {
      const cx=Math.floor(random()*(cols/2)), cy=Math.floor(random()*rows);
      const rx=1+Math.floor(random()*2), ry=1+Math.floor(random()*2), type=pick(theme.accents);
      for (let y=Math.max(0,cy-ry);y<=Math.min(rows-1,cy+ry);y++) for (let x=Math.max(0,cx-rx);x<=Math.min(cols/2-1,cx+rx);x++) {
        const oval=((x-cx)*(x-cx))/(rx*rx)+((y-cy)*(y-cy))/(ry*ry);
        if(oval<=1 && random()<.82) pair(terrain,x,y,type);
      }
    }

    const mid=rows/2-1;
    // Two mirrored lanes guarantee that every theme remains playable.
    for (let c=0;c<cols;c++) pair(terrain,c,mid,null);
    const channels=theme.id==='archipelago' ? [5,cols/2-1] : [cols/2-1];
    for(const channel of channels) {
      for(let r=0;r<rows;r++) pair(terrain,channel,r,'WATER');
      pair(terrain,channel,mid,'BRIDGE');
    }

    const units=[];
    const formation=[['Knight',2,mid],['Soldier',3,mid],['Soldier',2,mid+1],['Archer',1,mid],['Spearman',2,mid-1]];
    // Clear room around each army without disturbing rotational symmetry.
    for(let r=mid-3;r<=mid+2;r++) for(let c=0;c<=4;c++) pair(terrain,c,r,null);
    formation.forEach(([name,c,r],i)=>{const [mc,mr]=mirror(c,r);pair(terrain,c,r,null);units.push({id:`p1-${i}`,name,team:'PLAYER',col:c,row:r},{id:`p2-${i}`,name,team:'PLAYER2',col:mc,row:mr});});

    // Every game has exactly 3, 4, or 5 settlements. Owned capitals are a
    // mirrored pair. Odd totals use one neutral equidistant objective; its
    // mirrored tile is also cleared so terrain remains perfectly symmetric.
    const settlementCount=3+Math.floor(random()*3);
    pair(settlements,2,mid,{type:'CITY',owner:'PLAYER'},{type:'CITY',owner:'PLAYER2'});
    if(settlementCount>=4) {
      const [c,r]=pick([[6,mid-3],[6,mid+2],[7,2],[7,rows-4]]);
      const low=Math.min(r,mid), high=Math.max(r,mid);
      for(let y=low;y<=high;y++) pair(terrain,c,y,null);
      pair(settlements,c,r,{type:pick(['HAMLET','VILLAGE']),owner:null});
    }
    if(settlementCount%2===1) {
      const central=[cols/2,mid-3], mirrored=mirror(...central);
      const [c,r]=random()<.5 ? central : mirrored;
      for(let y=central[1];y<=mid;y++) pair(terrain,central[0],y,y===mid?'BRIDGE':null);
      settlements[r*cols+c]={type:pick(['HAMLET','VILLAGE','CITY']),owner:null};
    }
    for(let i=0;i<settlements.length;i++) if(settlements[i]) terrain[i]=null;

    // Decorative resource terrain stays paired and never replaces a settlement.
    for(const [c,r,type] of [[4,mid-2,'FOUNTAIN'],[4,mid+2,'FARM']]) if(!settlements[r*cols+c]) pair(terrain,c,r,type);
    const zeroResources={food:0,gold:0,materials:0};
    return {seed:String(seed),theme:{id:theme.id,name:theme.name},cols,rows,terrain,settlements,units,
      resources:{PLAYER:{...zeroResources},PLAYER2:{...zeroResources}},firstTeam:random()<.5?'PLAYER':'PLAYER2'};
  }
  const api={generate,themes:THEMES.map(({id,name})=>({id,name}))};
  if(typeof module!=='undefined') module.exports=api;
  else root.FairMap=api;
})(typeof window==='undefined'?globalThis:window);

const assert=require('node:assert/strict');
const {generate,themes}=require('../js/net/fair-map.js');
const dirs=c=>c%2===0?[[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]]:[[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]];
const opposite=t=>t==='PLAYER'?'PLAYER2':t==='PLAYER2'?'PLAYER':t;
const cube=(c,r)=>{const z=r-(c-(c&1))/2;return[c,-c-z,z];};
const distance=(a,b)=>Math.max(...cube(...a).map((v,i)=>Math.abs(v-cube(...b)[i])));
const layouts=new Set(),seenThemes=new Set(),seenCounts=new Set();
for(let seed=0;seed<250;seed++) {
 const m=generate(seed),{cols:C,rows:R}=m;layouts.add(JSON.stringify(m.terrain));seenThemes.add(m.theme.id);assert.deepEqual(m,generate(seed));
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){
  const i=r*C+c,j=(R-1-r)*C+C-1-c;assert.equal(m.terrain[i],m.terrain[j]);
  for(const [dc,dr]of dirs(c)){const x=c+dc,y=r+dr;if(x<0||x>=C||y<0||y>=R)continue;assert(dirs(C-1-c).some(([dx,dy])=>C-1-c+dx===C-1-x&&R-1-r+dy===R-1-y));}
 }
 for(const u of m.units)assert(m.units.some(v=>v.name===u.name&&v.team===opposite(u.team)&&v.col===C-1-u.col&&v.row===R-1-u.row));
 assert.deepEqual(m.resources.PLAYER,m.resources.PLAYER2);
 assert.deepEqual(m.resources.PLAYER,{gold:0,materials:0});
 const a=m.units[0],b=m.units[1],seen=new Set([a.row*C+a.col]),q=[[a.col,a.row]];
 for(let n=0;n<q.length;n++){const [c,r]=q[n];for(const [dc,dr]of dirs(c)){const x=c+dc,y=r+dr,i=y*C+x;if(x<0||x>=C||y<0||y>=R||seen.has(i)||m.terrain[i]==='WATER')continue;seen.add(i);q.push([x,y]);}}
 assert(seen.has(b.row*C+b.col),'armies must have a connected path');
 const placed=m.settlements.flatMap((s,i)=>s?[{...s,col:i%C,row:Math.floor(i/C)}]:[]);seenCounts.add(placed.length);assert(placed.length>=3&&placed.length<=5);assert.equal(placed.filter(s=>s.owner==='PLAYER').length,1);assert.equal(placed.filter(s=>s.owner==='PLAYER2').length,1);
 for(const s of placed)assert(seen.has(s.row*C+s.col),'every settlement must be reachable from Player 1');
 const neutral=placed.filter(s=>!s.owner),unpaired=neutral.filter(s=>!neutral.some(t=>t.col===C-1-s.col&&t.row===R-1-s.row));
 assert.equal(unpaired.length,placed.length%2);if(unpaired.length)assert.equal(distance([unpaired[0].col,unpaired[0].row],[a.col,a.row]),distance([unpaired[0].col,unpaired[0].row],[b.col,b.row]));
 const expected={highlands:'MOUNTAIN',dunes:'DESERT',archipelago:'WATER',wildwood:'WOODS',wetlands:'SWAMP',frontier:null}[m.theme.id];
 assert(m.terrain.filter(t=>t===expected).length/m.terrain.length>.28,`${m.theme.name} should retain its dominant terrain`);
}
assert(layouts.size>240);assert.equal(seenThemes.size,themes.length);assert.deepEqual([...seenCounts].sort(),[3,4,5]);assert.throws(()=>generate('bad',19,16));console.log('250 deterministic maps: six terrain themes, 3–5 fair settlements, symmetry, reachable objectives, zero resources, and diverse layouts pass.');

const assert=require('node:assert/strict');
const {generate}=require('../js/net/fair-map.js');
const dirs=c=>c%2===0?[[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]]:[[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]];
const opposite=t=>t==='PLAYER'?'PLAYER2':t==='PLAYER2'?'PLAYER':t;
const layouts=new Set();
for(let seed=0;seed<250;seed++) {
 const m=generate(seed),{cols:C,rows:R}=m;layouts.add(JSON.stringify(m.terrain));assert.deepEqual(m,generate(seed));
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){
  const i=r*C+c,j=(R-1-r)*C+C-1-c;assert.equal(m.terrain[i],m.terrain[j]);
  const a=m.settlements[i],b=m.settlements[j];assert.equal(a?.type,b?.type);assert.equal(opposite(a?.owner),b?.owner);
  for(const [dc,dr]of dirs(c)){const x=c+dc,y=r+dr;if(x<0||x>=C||y<0||y>=R)continue;assert(dirs(C-1-c).some(([dx,dy])=>C-1-c+dx===C-1-x&&R-1-r+dy===R-1-y));}
 }
 for(const u of m.units)assert(m.units.some(v=>v.name===u.name&&v.team===opposite(u.team)&&v.col===C-1-u.col&&v.row===R-1-u.row));
 assert.deepEqual(m.resources.PLAYER,m.resources.PLAYER2);
 const a=m.units[0],b=m.units[1],seen=new Set([a.row*C+a.col]),q=[[a.col,a.row]];
 for(let n=0;n<q.length;n++){const [c,r]=q[n];for(const [dc,dr]of dirs(c)){const x=c+dc,y=r+dr,i=y*C+x;if(x<0||x>=C||y<0||y>=R||seen.has(i)||['WATER','SWAMP'].includes(m.terrain[i]))continue;seen.add(i);q.push([x,y]);}}
 assert(seen.has(b.row*C+b.col),'armies must have a connected path');
}
assert(layouts.size>240);assert.throws(()=>generate('bad',19,16));console.log('250 deterministic maps: mirrored hex adjacency, terrain, settlements, armies, resources, reachable capitals, and diverse layouts pass.');

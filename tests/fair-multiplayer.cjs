const assert=require('node:assert/strict'),{generateForPlayers}=require('../js/net/fair-map.js');
const dirs=c=>c%2===0?[[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]]:[[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]];
for(const count of [3,4])for(let seed=0;seed<150;seed++){
 const m=generateForPlayers(seed,count),C=m.cols;
 assert.deepEqual(m,generateForPlayers(seed,count));
 const orbit=(q,r)=>count===3?[[q,r],[-q-r,q],[r,-q-r]]:[[q,r],[r,q],[-q,-r],[-r,-q]];
 const tile=(q,r)=>({col:q+10,row:r+Math.floor(q/2)+10});
 const index=(q,r)=>{const t=tile(q,r);return t.row*C+t.col;};
 for(let q=-10;q<=10;q++)for(let r=-10;r<=10;r++){
  if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))>10)continue;
  const i=index(q,r);for(const [a,b]of orbit(q,r))assert.equal(m.terrain[i],m.terrain[index(a,b)],'terrain has exact player-count symmetry');
 }
 const teams=Object.keys(m.resources);assert.equal(teams.length,count);assert.equal(new Set(m.units.map(u=>u.row*C+u.col)).size,count*5);
 const capitals=m.settlements.flatMap((s,i)=>s?.owner?[i]:[]);assert.equal(capitals.length,count);
 assert(m.settlements.filter(Boolean).length>=3&&m.settlements.filter(Boolean).length<=5);
 let firstDistances;
 for(const team of teams){
  assert.deepEqual(m.resources[team],{gold:0,materials:0});assert.deepEqual(m.units.filter(u=>u.team===team).map(u=>u.name).sort(),['Archer','Knight','Soldier','Soldier','Spearman']);
  const start=capitals.find(i=>m.settlements[i].owner===team),dist=new Map([[start,0]]),queue=[start];
  for(let n=0;n<queue.length;n++){
   const i=queue[n],c=i%C,r=Math.floor(i/C);
   for(const [dc,dr]of dirs(c)){const x=c+dc,y=r+dr,j=y*C+x;if(x<0||y<0||x>=C||y>=m.rows||dist.has(j)||['VOID','WATER'].includes(m.terrain[j]))continue;dist.set(j,dist.get(i)+1);queue.push(j);}
  }
  const distances=capitals.map(i=>dist.get(i)).sort((a,b)=>a-b);assert(distances.every(Number.isFinite),'each capital is reachable');
  if(firstDistances)assert.deepEqual(distances,firstDistances,'every player has equivalent travel distances to opponents');else firstDistances=distances;
  const center=10*C+10;assert(dist.has(center));if(m.settlements[center])assert.equal(dist.get(center),7,'neutral objective is equally reachable');
 }
}
console.log('300 maps: exact 3/4-player hex symmetry, identical armies/income, 3–5 settlements and equal reachable objectives pass.');

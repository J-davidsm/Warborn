const assert=require('node:assert/strict'),G=require('../js/net/battle-generator.js');
let checked=0;
for(const count of [2,4])for(let size=8;size<=20;size++)for(const terrain of G.terrains)for(let seed=0;seed<3;seed++){
 const settings={...G.defaults(),size,terrain},m=G.generate(seed,count,settings);
 assert.deepEqual(m,G.generate(seed,count,settings));assert.equal(m.cols,size);assert.equal(m.rows,size);
 const axial=i=>[i%size,Math.floor(i/size)-Math.floor(i%size/2)],idx=(q,r)=>(r+Math.floor(q/2))*size+q;
 const d=(a,b)=>{const [q,r]=axial(a),[x,y]=axial(b);return Math.max(Math.abs(q-x),Math.abs(r-y),Math.abs(q+r-x-y));};
 let q2=size-1,r2=count===2?size-1-Math.floor((size-2)/2):Math.round((size-1)/2);if(count===4&&(q2-r2)%2)r2--;
 const orbit=i=>{const[q,r]=axial(i);return(count===2?[[q,r],[q2-q,r2-r]]:[[q,r],[r+(q2-r2)/2,q+(r2-q2)/2],[q2-q,r2-r],[(q2+r2)/2-r,(q2+r2)/2-q]]).map(([q,r])=>idx(q,r));};
 const homes=m.settlements.flatMap((s,i)=>s?[i]:[]);
 for(let i=0;i<m.terrain.length;i++)if(m.terrain[i]!=='VOID')for(const j of orbit(i))assert.equal(m.terrain[i],m.terrain[j]);
 for(const i of homes)for(const j of homes)if(i!==j)assert(d(i,j)>1,'no adjacent settlements');
 const baseline=m.units.filter(u=>u.team==='PLAYER').map(u=>u.name).sort();
 for(const team of Object.keys(m.resources)){
  assert.deepEqual(m.units.filter(u=>u.team===team).map(u=>u.name).sort(),baseline);
  assert.equal(m.settlements.filter(s=>s?.owner===team).length,2);
 }
 assert.equal(new Set(m.units.map(u=>u.row*size+u.col)).size,count*5);
 // Every starting piece and settlement is linked by a legal land corridor.
 const seen=new Set([homes[0]]),queue=[homes[0]];
 for(let h=0;h<queue.length;h++){const[q,r]=axial(queue[h]);for(const[a,b]of [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){const x=q+a,y=r+b+Math.floor(x/2),j=y*size+x;if(x<0||x>=size||y<0||y>=size||seen.has(j)||['VOID','WATER','SWAMP'].includes(m.terrain[j]))continue;seen.add(j);queue.push(j);}}
 for(const i of [...homes,...m.units.map(u=>u.row*size+u.col)])assert(seen.has(i));checked++;
}
assert(!G.valid({...G.defaults(),size:21}));assert(!G.valid({...G.defaults(),army:{Dragon:13}}));assert(!G.valid({...G.defaults(),settlements:{CITY:6}}));
for(const count of [2,4]){const m=G.generate('full',count,{size:20,terrain:'MOUNTAIN',army:{Soldier:4,Dragon:4,Catapult:4},settlements:{HAMLET:2,VILLAGE:2,CITY:1}});assert.equal(m.units.length,count*12);assert.equal(m.settlements.filter(Boolean).length,count*5);}
assert.throws(()=>G.generate('dense',4,{...G.defaults(),size:8,army:{Soldier:12}}),/too small/);
console.log(`${checked} maps: exact hex symmetry, sizes 8–20, identical starts, spacing, connectivity and generation limits pass.`);

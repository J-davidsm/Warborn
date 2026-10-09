/* Pure configurable maps. Axial reflections preserve actual hex distances,
   unlike quarter-turns of a square array. VOID clips only symmetric edges. */
(function(root){
 const unitNames=['Soldier','Spearman','Archer','Swordsman','Assassin','Knight','Catapult','Dragon','Cleric','Crown'];
 const terrains=['GRASS','WOODS','MOUNTAIN','WATER','SWAMP','DESERT'];
 const defaults=()=>({size:16,terrain:'GRASS',army:{Soldier:2,Knight:1,Archer:1,Spearman:1},settlements:{HAMLET:2}});
 function valid(s){return !!s&&Number.isInteger(s.size)&&s.size>=8&&s.size<=20&&terrains.includes(s.terrain)&&counts(s.army,unitNames,12,1)&&counts(s.settlements,['HAMLET','VILLAGE','CITY'],5,1);}
 function counts(obj,names,max,min){return obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.entries(obj).every(([k,v])=>names.includes(k)&&Number.isInteger(v)&&v>=0&&v<=max)&&Object.values(obj).reduce((a,b)=>a+b,0)>=min&&Object.values(obj).reduce((a,b)=>a+b,0)<=max;}
 function generate(seed,count,settings){
  if(![2,4].includes(count)||!valid(settings))throw Error('Choose 2 or 4 players, size 8–20, 1–12 units and 1–5 settlements per side.');
  const n=settings.size,q2=n-1;
  let r2=count===2?n-1-Math.floor((n-2)/2):Math.round((n-1)/2);
  if(count===4&&(q2-r2)%2)r2--;
  const index=(q,r)=>(r+Math.floor(q/2))*n+q;
  const point=i=>({col:i%n,row:Math.floor(i/n)});
  const axial=i=>[i%n,Math.floor(i/n)-Math.floor(i%n/2)];
  const dist=(a,b)=>{const [q,r]=axial(a),[x,y]=axial(b);return Math.max(Math.abs(q-x),Math.abs(r-y),Math.abs(q+r-x-y));};
  const orbit=(q,r)=>count===2?[[q,r],[q2-q,r2-r]]:[[q,r],[r+(q2-r2)/2,q+(r2-q2)/2],[q2-q,r2-r],[(q2+r2)/2-r,(q2+r2)/2-q]];
  const inside=([q,r])=>Number.isInteger(q)&&Number.isInteger(r)&&q>=0&&q<n&&r+Math.floor(q/2)>=0&&r+Math.floor(q/2)<n;
  const groups=[],seen=new Set(),terrain=Array(n*n).fill('VOID'),settlements=Array(n*n).fill(null),units=[];
  let value=2166136261;for(const c of String(seed))value=Math.imul(value^c.charCodeAt(0),16777619);
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  for(let i=0;i<n*n;i++){
   if(seen.has(i))continue;let [q,r]=axial(i);let pts=orbit(q,r);if(!pts.every(inside))continue;
   const ids=[...new Set(pts.map(([a,b])=>index(a,b)))];ids.forEach(j=>seen.add(j));
   const t=random()<.83?settings.terrain:terrains[Math.floor(random()*terrains.length)];ids.forEach(j=>terrain[j]=t);
   if(ids.length!==count)continue;
   // Canonical home sector; other seats are exact transforms of it.
   const first=ids.sort((a,b)=>{const [x,y]=axial(a),[u,v]=axial(b);return (u-q2/2)*3+(v-r2/2)-(x-q2/2)*3-(y-r2/2);})[0];
   groups.push(orbit(...axial(first)).map(([a,b])=>index(a,b)));
  }
  const army=Object.entries(settings.army).flatMap(([name,k])=>Array(k).fill(name));
  const homes=Object.entries(settings.settlements).flatMap(([type,k])=>Array(k).fill(type));
  if(groups.length<army.length)throw Error('This map is too small for that army with exact four-side hex symmetry. Reduce units or increase map size.');
  const middle=index(Math.floor(q2/2),Math.floor(r2/2));
  groups.sort((a,b)=>dist(b[0],middle)-dist(a[0],middle));
  const chosen=[];
  // Backtracking is bounded to five settlements and usually succeeds greedily.
  let attempts=0;
  function place(start){if(chosen.length===homes.length)return true;if(++attempts>25000)return false;
   for(let k=start;k<groups.length;k++){const g=groups[k];if(g.some((i,a)=>g.some((j,b)=>a!==b&&dist(i,j)<=1))||chosen.some(h=>h.some(i=>g.some(j=>dist(i,j)<=1))))continue;
    chosen.push(g);if(place(k+1))return true;chosen.pop();
   }return false;}
  if(!place(0))throw Error('These settlements cannot fit without touching. Increase the map size or reduce settlements.');
  const teams=['PLAYER','PLAYER2','PLAYER3','PLAYER4'].slice(0,count);
  chosen.forEach((g,k)=>g.forEach((i,p)=>{settlements[i]={type:homes[k],owner:teams[p]};terrain[i]='GRASS';}));
  groups.sort((a,b)=>Math.min(...chosen.map(g=>dist(a[0],g[0])))-Math.min(...chosen.map(g=>dist(b[0],g[0])))||a[0]-b[0]);
  groups.slice(0,army.length).forEach((g,k)=>g.forEach((i,p)=>{units.push({id:`p${p+1}-${k}`,name:army[k],team:teams[p],...point(i)});if(['WATER','SWAMP'].includes(terrain[i]))terrain[i]='GRASS';}));
  const neighbors=i=>{const [q,r]=axial(i);return [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]].map(([a,b])=>[q+a,r+b]).filter(inside).map(([a,b])=>index(a,b)).filter(j=>terrain[j]!=='VOID');};
  // Connect every settlement/start to the central meeting area. Convert only
  // water to bridges (or marsh to grass); preserve mountain/forest identities.
  const goal=[...seen].sort((a,b)=>dist(a,middle)-dist(b,middle))[0];
  for(const start of [...chosen.map(g=>g[0]),...groups.slice(0,army.length).map(g=>g[0])]){
   const queue=[start],prev=new Map([[start,null]]);for(let h=0;h<queue.length&&!prev.has(goal);h++)for(const j of neighbors(queue[h]))if(!prev.has(j)){prev.set(j,queue[h]);queue.push(j);}
   if(!prev.has(goal))throw Error('Unable to connect symmetric starting territories. Try another size.');
   for(let i=goal;i!==null;i=prev.get(i))for(const [q,r] of orbit(...axial(i))){const j=index(q,r);if(terrain[j]==='WATER')terrain[j]='BRIDGE';else if(terrain[j]==='SWAMP')terrain[j]='GRASS';}
  }
  return {seed:String(seed),settings:JSON.parse(JSON.stringify(settings)),playerCount:count,cols:n,rows:n,terrain,settlements,units,theme:{id:'custom',name:'Generated '+settings.terrain.toLowerCase()+' battlefield'},resources:Object.fromEntries(teams.map(t=>[t,{gold:0,materials:0}])),firstTeam:teams[Math.floor(random()*count)]};
 }
 const api={defaults,valid,generate,unitNames,terrains};if(typeof module!=='undefined')module.exports=api;else root.BattleGenerator=api;
})(typeof window==='undefined'?globalThis:window);

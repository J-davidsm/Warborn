// Persistent marching claims; settlement/fortress protection is derived from the board.
const Territory=(()=>{
 const costs={Soldier:1,Archer:2,Spearman:2,Swordsman:2,Assassin:3,Cleric:3,Knight:3,Catapult:4,Dragon:4,Sloop:2,'Man-of-War':3,Battleship:4};
 let claims=[],streak={},processed={},rogueTurns={},dimensions='',seeded=false,cacheKey='',owners=[];
 const eligible=u=>u&&u.hp>0&&!u.rogue&&!u.ruins&&!['Cleric','Assassin'].includes(u.name);
 const value=t=>t==='VOID'?0:['MOUNTAIN','DESERT'].includes(t)?1:['WATER','BRIDGE'].includes(t)?.5:t==='FARM'?3:2;
 const distance=(a,b)=>manhattan(a.col,a.row,b.col,b.row);
 function reset(){claims=[];streak={};processed={};rogueTurns={};dimensions='';seeded=false;cacheKey='';}
 function prepare(){
  if(dimensions!==`${COLS}:${ROWS}`){claims=Array(COLS*ROWS).fill(null);dimensions=`${COLS}:${ROWS}`;seeded=false;cacheKey='';}
  if(!seeded){for(const u of units)if(eligible(u)&&!isFortressUnit(u))claims[u.row*COLS+u.col]=u.team;seeded=true;}
 }
 function ownership(){
  if(!Array.isArray(terrain)||!Array.isArray(settlements))return Array(COLS*ROWS).fill(null);
  prepare();
  const key=JSON.stringify([claims,settlements,terrain,units.map(u=>[u.team,u.col,u.row,u.hp>0,u.name,u.rogue,u.ruins])]);
  if(key===cacheKey)return owners;
  cacheKey=key;owners=claims.slice();const distances=Array(COLS*ROWS).fill(Infinity),sources=[];
  settlements.forEach((s,i)=>{if(s?.owner)sources.push({team:s.owner,col:i%COLS,row:Math.floor(i/COLS),radius:s.type==='CITY'?(COLS<=8&&ROWS<=8?2:3):s.type==='HAMLET'?1:(COLS<=8&&ROWS<=8?1:2)});});
  for(const u of units)if(eligible(u)&&isFortressUnit(u))sources.push({...u,radius:u.name==='Stockade'?0:1});
  // Nearest source wins overlapping auras. Equal opposing claims are neutral.
  for(const s of sources)for(let r=Math.max(0,s.row-s.radius);r<=Math.min(ROWS-1,s.row+s.radius);r++)for(let c=Math.max(0,s.col-s.radius);c<=Math.min(COLS-1,s.col+s.radius);c++){
   const i=r*COLS+c,d=distance(s,{col:c,row:r});if(d>s.radius||terrain[i]==='VOID')continue;
   if(d<distances[i]){distances[i]=d;owners[i]=s.team;}else if(d===distances[i]&&owners[i]!==s.team)owners[i]=null;
  }
  for(const u of units)if(u.hp>0){const i=u.row*COLS+u.col;if(u.ruins)owners[i]=null;else if(eligible(u))owners[i]=u.team;}
  owners=owners.map((o,i)=>terrain[i]==='VOID'?null:o);return owners;
 }
 function stats(team){const tiles=ownership();let capacity=0;tiles.forEach((o,i)=>{if(o===team)capacity+=value(terrain[i]);});return {capacity,used:units.filter(u=>u.team===team&&u.hp>0&&!u.rogue&&!u.ruins).reduce((n,u)=>n+(costs[u.name]||0),0),streak:streak[team]||0};}
 function canRecruit(team,name){const s=stats(team),cost=costs[name]||0;return !cost||s.used+cost<=s.capacity*1.25||s.used<=s.capacity;}
 function march(u,path){if(!eligible(u))return;prepare();for(const p of path||[])if(p.col>=0&&p.row>=0&&p.col<COLS&&p.row<ROWS&&terrain[p.row*COLS+p.col]!=='VOID')claims[p.row*COLS+p.col]=u.team;cacheKey='';}
 function finishTurn(team){
  const key=String(turnNumber);if(processed[team]===key)return;processed[team]=key;
  const s=stats(team);streak[team]=s.used>s.capacity?(streak[team]||0)+1:0;
  if(streak[team])for(const u of units)if(u.team===team&&!u.ruins&&!u.rogue){u.morale=Math.max(0,u.morale-25);if(streak[team]>=3&&u.name==='Dragon'){u.rogue=true;u.morale=150;}}
  actRogues(team);
 }
 function actRogues(team=null){
  // Rogue Dragons act once on their former kingdom's turn, with no faction allegiance.
  for(const u of [...units])if((team===null||u.team===team)&&u.rogue&&u.hp>0&&rogueTurns[u.id]!==turnNumber){
   rogueTurns[u.id]=turnNumber;
   const targets=units.filter(t=>t!==u&&t.hp>0&&!t.ruins&&distance(u,t)<=u.atkRange).sort((a,b)=>a.id.localeCompare(b.id));
   if(targets.length){let h=2166136261;for(const c of `${u.id}:${turnNumber}`)h=Math.imul(h^c.charCodeAt(0),16777619);u.hasActed=false;attackUnit(u,targets[(h>>>0)%targets.length]);}u.hasMoved=true;u.hasActed=true;
  }
 }
 function snapshot(){prepare();return {claims:claims.slice(),streak:{...streak},processed:{...processed},rogueTurns:{...rogueTurns},cols:COLS,rows:ROWS};}
 function restore(data){reset();if(data&&data.cols===COLS&&data.rows===ROWS&&Array.isArray(data.claims)&&data.claims.length===COLS*ROWS){dimensions=`${COLS}:${ROWS}`;claims=data.claims.map(t=>typeof t==='string'?t:null);streak=Object.fromEntries(Object.entries(data.streak||{}).filter(([t,v])=>Number.isSafeInteger(v)&&v>=0));processed=Object.fromEntries(Object.entries(data.processed||{}).filter(([t,v])=>typeof v==='string')); rogueTurns={...data.rogueTurns};seeded=true;}}
 function shift(){prepare();claims=[...Array(COLS).fill(null),...claims.slice(0,COLS*(ROWS-1))];cacheKey='';}
 function render(){
  if(typeof document==='undefined'||!document.body||!Array.isArray(terrain)||!Array.isArray(settlements))return;
  let box=document.getElementById('armyUpkeep');if(!box){box=document.createElement('aside');box.id='armyUpkeep';document.body.appendChild(box);}
  const menu=document.getElementById('mainMenu');box.hidden=!!(menu&&!menu.classList.contains('hidden'));
  const team=typeof getLocalPlayableTeam==='function'?getLocalPlayableTeam():currentTeam,s=stats(team),over=s.used>s.capacity;
  box.className=over?'over-capacity':'';
  box.innerHTML=`<strong>Army upkeep</strong><div>${s.used} / ${s.capacity} territory</div><progress max="${Math.max(1,s.capacity)}" value="${s.used}"></progress><small>${over?`Over capacity: −25 morale/turn<br>Dragon rebellion: ${s.streak}/3 turns`:'March to expand your territory'}</small>`;
  box.title='Soldier 1 · Archer/Spearman/Swordsman 2 · Assassin/Cleric/Knight 3 · Catapult/Dragon 4. Ships 2/3/4; Crowns and fortresses 0. Recruitment permits 25% overflow, or one extra unit from within capacity.';
 }
 return {costs,value,eligible,stats,ownership,canRecruit,march,finishTurn,actRogues,snapshot,restore,reset,shift,render,warning:team=>streak[team]||0};
})();

// Ruins retain the original unit identity and veteran stats; rebuilding restores ownership.
const FortressRuins=(()=>{
 function adjacent(team,u){return units.some(a=>a!==u&&a.team===team&&a.hp>0&&!a.rogue&&!a.ruins&&manhattan(a.col,a.row,u.col,u.row)===1);}
 function rebuild(u,team,currency,conqueror=false){
  if(!u?.ruins||!units.includes(u)||(!conqueror&&!adjacent(team,u))||!['gold','materials'].includes(currency)||(resources[team]?.[currency]||0)<3)return false;
  resources[team][currency]-=3;u.ruins=false;u.team=team;u.hp=u.maxHp;u.hasMoved=true;u.hasActed=true;u.morale=100;return true;
 }
 function useful(u,team){return settlements.some((s,i)=>s?.owner===team&&manhattan(u.col,u.row,i%COLS,Math.floor(i/COLS))<=4)||units.some(a=>a.team===team&&!a.ruins&&a.hp>0&&manhattan(a.col,a.row,u.col,u.row)<=2);}
 function aiRepair(team){for(const u of units)if(u.ruins&&adjacent(team,u)&&useful(u,team))rebuild(u,team,(resources[team]?.materials||0)>=3?'materials':'gold');}
 function show(u,team,conqueror=false){
  if(!u?.ruins||(!conqueror&&!adjacent(team,u)))return;
  document.getElementById('ruinChoice')?.remove();const box=document.createElement('div');box.id='ruinChoice';box.className='ruin-choice';
  const title=document.createElement('strong');title.textContent=`Ruins of ${u.name}`;box.appendChild(title);
  for(const currency of ['materials','gold']){const b=document.createElement('button');b.textContent=`Rebuild · 3 ${currency}`;b.disabled=(resources[team]?.[currency]||0)<3;b.onclick=()=>{if(currentTeam!==team||(typeof OnlineMatch!=='undefined'&&!OnlineMatch.canAct())||!rebuild(units.find(a=>a.id===u.id),team,currency,conqueror))return;box.remove();updateUI();postGameState();};box.appendChild(b);}
  if(conqueror){const b=document.createElement('button');b.textContent='Raze';b.onclick=()=>{if(currentTeam!==team||(typeof OnlineMatch!=='undefined'&&!OnlineMatch.canAct()))return;units=units.filter(a=>a.id!==u.id||!a.ruins);box.remove();updateUI();postGameState();};box.appendChild(b);}
  const leave=document.createElement('button');leave.textContent='Leave ruins';leave.onclick=()=>box.remove();box.appendChild(leave);document.body.appendChild(box);
 }
 function destroyed(dead,killer){
  if(!dead||dead.hp>0||dead.ruins||!isFortressUnit(dead))return;
  const ruin={...dead,team:null,hp:1,ruins:true,hasMoved:true,hasActed:true};units.push(ruin);
  if(killer?.hp>0&&!killer.rogue){if(isAITeam(killer.team)){if(useful(ruin,killer.team))rebuild(ruin,killer.team,(resources[killer.team]?.materials||0)>=3?'materials':'gold',true);}else show(ruin,killer.team,true);}
 }
 return {adjacent,rebuild,aiRepair,show,destroyed};
})();

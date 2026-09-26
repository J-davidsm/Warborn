const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={console,Math,Date,aiTeamNames:['AI','AI2','AI3','AI4'],isAITeam:t=>t.startsWith('AI'),units:[],currentVictoryCondition:{},getActiveTeams:()=>['PLAYER','AI','AI2'],DEFAULT_VICTORY_CONDITION:{type:'ANNIHILATE_ALL'},getTeamDisplayName:t=>t};vm.createContext(ctx);
for(const f of ['js/systems/campaign.js','js/data/campaign-catalog.js','js/core/level-state.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const catalog=ctx.buildCampaignCatalog();assert.equal(catalog.length,3);assert.equal(JSON.stringify(catalog),JSON.stringify(ctx.buildCampaignCatalog()),'retries reproduce authored maps');
const signatures=new Set();
for(const chapter of catalog){assert.equal(chapter.scenarios.length,7);for(const s of chapter.scenarios){
 const {cols,rows}=s.mapSize,grid=Array(cols*rows).fill(null),used=new Set();for(const t of s.terrain)grid[t.row*cols+t.col]=t.type;
 signatures.add(JSON.stringify(s.terrain));
 assert.equal(Object.keys(s.startingUnits).length,s.aiCount+1);
 for(const [team,army] of Object.entries(s.startingUnits)){
  assert.deepEqual(JSON.parse(JSON.stringify(s.startingResources[team])),{gold:0,materials:0});
  assert(army.some(u=>u.type==='Crown'));
  for(const u of army){assert(u.col>=0&&u.row>=0&&u.col<cols&&u.row<rows);const k=u.row*cols+u.col;assert(!used.has(k),'no overlapping starts');used.add(k);assert.equal(grid[k],null,'starts on safe ground');}
 }
 const start=s.startingUnits.PLAYER[0],queue=[start],seen=new Set([start.row*cols+start.col]);
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const c=queue[i].col+dx,r=queue[i].row+dy,k=r*cols+c;if(c<0||r<0||c>=cols||r>=rows||seen.has(k)||grid[k]==='WATER'||grid[k]==='SWAMP')continue;seen.add(k);queue.push({col:c,row:r});}
 for(const t of s.settlements)assert(seen.has(t.row*cols+t.col),'settlement reachable on foot: '+s.name);
 const vc=s.victoryCondition;
 if(vc.type==='KILL_CROWN')assert(s.startingUnits.AI.some(u=>u.id===vc.targetUnitId&&u.type==='Crown'));
 if(['CAPTURE_TOWN','HOLD_TILE'].includes(vc.type))assert(s.settlements.some(t=>t.col===vc.holdCol&&t.row===vc.holdRow));
 const pact=(a,b)=>s.diplomacy.treaties.some(t=>t.participants.includes(a)&&t.participants.includes(b));
 assert.equal(pact('PLAYER','AI2'),s.ally);
 for(const t of s.diplomacy.treaties)assert(!s.diplomacy.warDeclarations.some(w=>t.participants.includes(w.attacker)&&t.participants.includes(w.target)));
}}
assert.equal(signatures.size,21);
const missions=catalog.flatMap(c=>c.scenarios);
const signatureOfArmy=s=>s.startingUnits.PLAYER.map(u=>u.type).sort().join('|');
assert.equal(new Set(missions.map(signatureOfArmy)).size,21,'every player starting army is distinct');
assert.equal(new Set(missions.map(s=>JSON.stringify(s.settlements))).size,21,'every settlement layout is distinct');
for(const chapter of catalog){
 assert(new Set(chapter.scenarios.map(s=>s.startingUnits.PLAYER.length)).size>=3,'army sizes vary within each campaign');
 assert(new Set(chapter.scenarios.map(s=>s.settlements.length)).size>=3,'settlement counts vary within each campaign');
 assert.equal(new Set(chapter.scenarios.map(s=>JSON.stringify(s.mapSize))).size,7);
}
for(const s of missions){
 const keys=new Set();
 for(const t of s.settlements){
  assert(t.col>=0&&t.row>=0&&t.col<s.mapSize.cols&&t.row<s.mapSize.rows);
  const key=t.row*s.mapSize.cols+t.col;assert(!keys.has(key),'towns cannot overlap');keys.add(key);
 }
 const target=s.settlements.find(t=>t.col===s.victoryCondition.holdCol&&t.row===s.victoryCondition.holdRow);
 if(s.victoryCondition.type==='CAPTURE_TOWN')assert.equal(target.owner,'AI');
 if(s.victoryCondition.type==='HOLD_TILE')assert.equal(target.owner,null);
}

// Objective outcomes must not require eliminating uninvolved factions or allies.
Object.assign(ctx,{areFriendlyTeams:(a,b)=>a===b||b==='AI2',teamHasLife:()=>true,isTeamConquered:()=>false,getWinner:()=>null,settlements:Array(16).fill(null),COLS:4,turnNumber:1});
vm.runInContext(fs.readFileSync('js/ui/endgame-and-ui.js','utf8'),ctx);
ctx.teamHasLife=()=>true;ctx.isTeamConquered=t=>t==='AI';ctx.getWinner=()=>null;
ctx.currentVictoryCondition={type:'ANNIHILATE_ALL'};assert.equal(ctx.evaluateVictoryCondition().outcome,'victory','allied kingdom can remain');
ctx.currentVictoryCondition={type:'CAPTURE_TOWN',holdCol:2,holdRow:2,targetName:'Gate'};ctx.settlements[10]={owner:'AI'};assert.equal(ctx.evaluateVictoryCondition(),null);ctx.settlements[10].owner='PLAYER';assert.equal(ctx.evaluateVictoryCondition().outcome,'victory');
ctx.currentVictoryCondition={type:'KILL_CROWN',targetTeam:'AI',targetUnitId:'crown'};ctx.units=[{id:'crown',hp:200},{id:'other-enemy',hp:50}];assert.equal(ctx.evaluateVictoryCondition(),null);ctx.units.shift();assert.equal(ctx.evaluateVictoryCondition().outcome,'victory');
ctx.currentVictoryCondition.crownFallenTeams=['PLAYER'];assert.equal(ctx.evaluateVictoryCondition().outcome,'defeat','own Crown loss overrides objective');
console.log('21 reproducible missions: valid rosters, zero resources, routes, alliances, unique geography, town and Crown objectives pass.');
// The setup snapshot reads stale editor settings: loading must restore this mission's rules afterward.
Object.assign(ctx,{campaignMode:{active:true,currentScenarioIndex:1,campaignData:catalog[0]},resources:{},startingResources:{},researchedUnits:{},currentAIPlayers:1,aiTurnTimeoutId:null,clearTimeout(){},closeSpawnMenu(){},showPopup(){},clonePlain:x=>JSON.parse(JSON.stringify(x)),ensureDiplomacyForActiveTeams(){},setupGame(){ctx.currentVictoryCondition={type:'ANNIHILATE_ALL'};ctx.settlements=Array(ctx.COLS*ctx.ROWS).fill(null);},makeUnit:(name,team,col,row,opts)=>({name,team,col,row,id:opts.id,hp:200}),applyVictoryConditionToUI(){},updateUI(){},captureScenarioSnapshot(){},terrain:Array(800).fill('WATER')});
ctx.loadCurrentScenario();assert.equal(ctx.currentVictoryCondition.type,'KILL_CROWN');assert.equal(ctx.currentVictoryCondition.targetUnitId,catalog[0].scenarios[1].victoryCondition.targetUnitId);assert.equal(ctx.terrain.length,catalog[0].scenarios[1].mapSize.cols*catalog[0].scenarios[1].mapSize.rows);assert.equal(ctx.terrain.filter(Boolean).length,catalog[0].scenarios[1].terrain.length);
ctx.campaignMode.currentScenarioIndex=2;ctx.loadCurrentScenario();assert.equal(ctx.currentVictoryCondition.type,'HOLD_TILE');assert.equal(ctx.currentVictoryCondition.holdCol,catalog[0].scenarios[2].victoryCondition.holdCol);
console.log('Mission load and transitions restore authored objectives after setup, with no stale terrain.');

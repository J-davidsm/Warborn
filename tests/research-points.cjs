const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console:{log(){},warn(){},debug(){}},Math,Date,abs:Math.abs,min:Math.min,max:Math.max,floor:Math.floor,COLS:10,ROWS:10,units:[],terrain:Array(100).fill(null),settlements:Array(100).fill(null),TERRAIN:{},useHexGrid:false,getHexNeighbors:()=>[],currentVictoryCondition:{type:'ANNIHILATE_ALL'},diplomacy:{personalities:{AI:'BALANCED'},warDeclarations:[],trust:{},aiMessages:[]},isAITeam:t=>t.startsWith('AI'),hasTreaty:()=>false,isDiplomacyActive:()=>false,addAIMessage(){},setTimeout(){},showPopup(){},updateUI(){},window:{},isEditorMode:false,currentTeam:'PLAYER',turnNumber:1,gameOver:false,ActionEffects:{move(){}},closeSpawnMenu(){},postGameState(){}};
vm.createContext(c);const run=s=>vm.runInContext(s,c);
run(fs.readFileSync('js/ui/popups-and-assets.js','utf8').match(/const SETTLEMENTS = \{[\s\S]*?\n\};/)[0]);
for(const f of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js','js/systems/mechanics.js','js/systems/diplomacy.js','js/systems/combat-turns.js','js/systems/settlements.js','js/systems/move-undo.js'])run(fs.readFileSync(f,'utf8'));
const reset=()=>{c.units=[];c.settlements.fill(null);c.isEditorMode=false;run("resetResearch(['PLAYER','AI']);resources={PLAYER:{gold:100,materials:100},AI:{gold:100,materials:100}};hasTreaty=()=>false;isDiplomacyActive=()=>false;");};
const make=(name,team,col=0)=>{const u=c.makeUnit(name,team,col,0);c.units.push(u);return u;};
c.modifyTrust=()=>{};c.modifyReputation=()=>{};c.awardExperience=()=>{};c.addAIMessage=()=>{};c.closeSpawnMenu=()=>{};c.selectedUnit=null;c.getActiveTeams=()=>['PLAYER','AI'];
for(const [name,reward]of [['Soldier',1],['Stockade',1],['Castle',2],['Heavy Fortress',3],['Fortress',2]]){
 reset();const killer=make('Catapult','PLAYER'),victim=make(name,'AI',1);victim.hp=1;
 c.attackUnit(killer,victim);assert.equal(c.getResearchPoints('PLAYER'),reward,name);assert.equal(c.getResearchPoints('AI'),0);
 killer.hasActed=false;c.attackUnit(killer,victim);c.awardKillResearch(killer,victim);assert.equal(c.getResearchPoints('PLAYER'),reward,'no duplicate reward');
}
reset();let attacker=make('Soldier','PLAYER'),victim=make('Soldier','AI',1);c.attackUnit(attacker,victim);assert.equal(c.getResearchPoints('PLAYER'),0,'damage only');
reset();c.restoreResearch({AI:['fieldworks','garrison_training']});c.ActionEffects.damage=()=>{};attacker=make('Soldier','PLAYER');victim=make('Castle','AI',1);attacker.hp=1;c.attackUnit(attacker,victim);assert.equal(c.getResearchPoints('AI'),1,'fortress retaliation');assert.equal(c.getResearchPoints('PLAYER'),0);
reset();attacker=make('Soldier','PLAYER');victim=make('Soldier','PLAYER',1);victim.hp=0;assert(!c.awardKillResearch(attacker,victim));
victim.team='AI';c.areFriendlyTeams=()=>true;assert(!c.awardKillResearch(attacker,victim));c.areFriendlyTeams=(a,b)=>!!a&&a===b;
for(const capture of [
 ()=>c.claimSettlementAt(0,0,'PLAYER'),
 ()=>c.checkSettlementCaptureAfterMove(c.units[0],0,0),
 ()=>c.captureSettlementsWithUnits('PLAYER')
]){
 for(const owner of [null,'AI','PLAYER']){
  reset();make('Soldier','PLAYER');c.settlements[0]={type:'HAMLET',owner};capture();assert.equal(c.getResearchPoints('PLAYER'),owner==='PLAYER'?0:owner?2:1);
  capture();assert.equal(c.getResearchPoints('PLAYER'),owner==='PLAYER'?0:owner?2:1,'same owner no award');
  if(owner!=='PLAYER'){c.claimSettlementAt(0,0,'AI');capture();assert.equal(c.getResearchPoints('PLAYER'),owner?2:1,'recapture cannot farm');}
 }
}
reset();c.settlements[0]={type:'HAMLET',owner:'PLAYER',researchCaptureTeams:['PLAYER']};
assert(c.purchaseSettlementUpgrade(0,0,'PLAYER'));assert.equal(c.getResearchPoints('PLAYER'),1);assert.deepEqual(c.settlements[0].researchCaptureTeams,['PLAYER']);assert(c.getGold('PLAYER')<100);
run('resources.PLAYER.gold=0');assert(!c.purchaseSettlementUpgrade(0,0,'PLAYER'));assert(!c.purchaseSettlementUpgrade(0,0,'AI'));assert.equal(c.getResearchPoints('PLAYER'),1,'failed upgrades earn nothing');
c.settlements[0].type='CITY';assert(!c.purchaseSettlementUpgrade(0,0,'PLAYER'));
reset();const u=make('Soldier','PLAYER');c.settlements[1]={type:'HAMLET',owner:null};const undo=run('MoveUndo');
undo.begin(u);u.col=1;c.checkSettlementCaptureAfterMove(u,1,0);undo.finish();assert.equal(c.getResearchPoints('PLAYER'),1);assert(undo.undo());assert.equal(c.getResearchPoints('PLAYER'),0);assert.equal(c.settlements[1].owner,null);assert(!c.settlements[1].researchCaptureTeams);
undo.begin(u);u.col=1;c.checkSettlementCaptureAfterMove(u,1,0);undo.finish();assert.equal(c.getResearchPoints('PLAYER'),1,'redo earns exactly original reward');
c.awardResearchPoints('PLAYER',1);assert(!undo.undo(),'later RP event invalidates undo');
const before=c.getResearchPoints('PLAYER');c.computeIncomeForTeam('PLAYER');c.addResources('PLAYER',{gold:5,materials:5});make('Archer','PLAYER');assert.equal(c.getResearchPoints('PLAYER'),before,'income and spawning earn no RP');
const healer=make('Cleric','PLAYER');u.hp=1;c.healUnit(healer,u);assert.equal(c.getResearchPoints('PLAYER'),before,'healing earns no RP');
reset();assert(!c.canResearchTech('PLAYER','spear_doctrine'),'gold cannot buy research');c.awardResearchPoints('PLAYER',2);assert(c.researchTech('PLAYER','spear_doctrine'));assert.equal(c.getGold('PLAYER'),100);assert.equal(c.getResearchPoints('PLAYER'),0);
c.isEditorMode=true;assert(!c.awardResearchPoints('PLAYER',2));assert(!c.researchTech('PLAYER','archery'));c.isEditorMode=false;
for(const team of ['NEUTRAL','__proto__',null])assert(!c.awardResearchPoints(team,1));for(const n of [-1,0,.5,Infinity])assert(!c.awardResearchPoints('PLAYER',n));
c.restoreResearchPoints({PLAYER:5,AI:2,PLAYER2:-1,AI2:1.5});assert.equal(c.getResearchPoints('PLAYER'),5);assert.equal(c.getResearchPoints('AI'),2);assert.equal(c.getResearchPoints('PLAYER2'),0);c.restoreResearchPoints();assert.equal(c.getResearchPoints('PLAYER'),0,'old saves default zero');
console.log('RP combat/fortress retaliation, all three capture paths, anti-farming, upgrades, Undo, currency isolation, healing, editor and validation checks pass.');
// Timed study uses the owning team's turns, never gold or RP; switching resets it.
reset();assert(!c.startDoctrineResearch('PLAYER','longbows'));assert(c.startDoctrineResearch('PLAYER','field_training'));
c.turnNumber=1;c.advanceDoctrineResearch('PLAYER');c.advanceDoctrineResearch('PLAYER');assert.equal(run('activeResearch.PLAYER.progress'),1);
const job=JSON.parse(run('JSON.stringify(activeResearch)'));c.restoreActiveResearch(job);assert.equal(run('activeResearch.PLAYER.progress'),1);
assert(c.startDoctrineResearch('PLAYER','spear_doctrine'));assert.equal(run('activeResearch.PLAYER.progress'),0);
assert(c.startDoctrineResearch('PLAYER','field_training'));assert.equal(run('activeResearch.PLAYER.progress'),0);
c.turnNumber=2;c.advanceDoctrineResearch('AI');assert.equal(run('activeResearch.PLAYER.progress'),0);c.advanceDoctrineResearch('PLAYER');
c.turnNumber=3;c.advanceDoctrineResearch('PLAYER');assert(c.hasTech('PLAYER','field_training'));assert.equal(c.getResearchPoints('PLAYER'),0);assert.equal(c.getGold('PLAYER'),100);assert(!run('activeResearch.PLAYER'));
assert(c.startDoctrineResearch('PLAYER','forced_march'));c.awardResearchPoints('PLAYER',3);assert(c.researchTech('PLAYER','forced_march'));assert(!run('activeResearch.PLAYER'));
// Fortress response is opt-in, within actual range, and emits damage at both tiles.
for(const [doctrine,range,name] of [[false,1,'Castle'],[true,1,'Castle'],[true,5,'Castle'],[true,1,'Soldier']]){
 reset();if(doctrine)c.restoreResearch({AI:['fieldworks','garrison_training']});const hits=[];c.ActionEffects.damage=(col,row,n)=>hits.push({col,n});
 const a=make('Soldier','PLAYER'),d=make(name,'AI',range);c.attackUnit(a,d);
 const retaliates=doctrine&&name==='Castle'&&range<=d.atkRange;
 assert.equal(hits.some(h=>h.col===a.col&&h.n>0),retaliates);assert(hits.some(h=>h.col===d.col));assert.equal(a.hp<a.maxHp,retaliates);
}
console.log('Timed study, switches, no duplicate advancement, instant completion and fortress-only damage effects pass.');

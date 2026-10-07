const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,clearTimeout,ActionEffects:{reset(){}},closeSpawnMenu(){},buildMode:true,buildModeUnitId:'old',activeAITurn:{},aiTurnTimeoutId:null,BOARD_SIZE:600,mapSize:{cols:3,rows:3},maxAIPlayers:4,currentAIPlayers:1,resources:{PLAYER:{gold:17,materials:4},AI:{gold:12,materials:2}},startingResources:{PLAYER:{gold:17,materials:4},AI:{gold:12,materials:2}},researchedUnits:{PLAYER:new Set(['Soldier','Archer']),AI:new Set(['Soldier'])},terrain:Array(9).fill(null),settlements:Array(9).fill(null),units:[],diplomacy:{},currentVictoryCondition:{type:'ANNIHILATE_ALL'},getActiveTeams:()=>['PLAYER','AI'],readVictoryConditionFromUI(){},hasAIDiplomacy:()=>false,updateHexSize(){},resizeGameCanvas(){},select:()=>null,setAIPlayerCount(){},document:{getElementById:()=>null},calculateTurnOrder(){},updateTeamSelector(){},hideEndScreen(){},updateUI(){},selectedUnit:null,gameOver:false,endScreenShown:false,gameEndResult:null,currentTeam:'PLAYER',currentTurnIndex:0,turnNumber:1,activeScenarioSnapshot:null,campaignMode:{active:false},lastPlayedSavedLevelIndex:null,setupGame(){throw Error('Must not use default Knights');}};
vm.createContext(c);
for(const f of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
vm.runInContext('resources={PLAYER:{gold:17,materials:4},AI:{gold:12,materials:2}};restoreResearch(null,{PLAYER:["Soldier","Archer"],AI:["Soldier"]});',c);
Object.defineProperty(c,'resources',{get:()=>vm.runInContext('resources',c)});
Object.defineProperty(c,'researchedUnits',{get:()=>vm.runInContext('researchedUnits',c)});
c.closeSpawnMenu=()=>{};c.normalizeVictoryCondition=x=>structuredClone(x);c.applyVictoryConditionToUI=()=>{};
vm.runInContext(fs.readFileSync('js/ui/endgame-and-ui.js','utf8').match(/function replayCurrentScenario\(\) \{[\s\S]*?\n\}/)[0],c);
c.units=[c.makeUnit('Archer','PLAYER',0,0,{id:'archer',promotionLevel:2,personalName:'Hawkeye'}),c.makeUnit('Dragon','AI',2,2,{id:'dragon'})];c.settlements[0]={owner:'PLAYER',type:'CITY'};c.terrain[4]='WOODS';c.captureScenarioSnapshot();const original=JSON.stringify(c.activeScenarioSnapshot);
for(let attempt=0;attempt<2;attempt++){
 c.units[0].hp=1;c.units.push(c.makeUnit('Soldier','PLAYER',1,1));c.resources.PLAYER.gold=0;c.resources.AI.materials=99;c.researchedUnits.PLAYER.add('Dragon');c.settlements[0].owner='AI';c.terrain[4]='WATER';c.currentTeam='AI';c.turnNumber=7;c.activeAITurn={};
 c.replayCurrentScenario();assert.equal(c.units.length,2);assert.equal(c.units[0].name,'Archer');assert.equal(c.units[0].hp,50);assert.equal(c.resources.PLAYER.gold,0);assert.equal(c.resources.AI.materials,0);assert(!c.researchedUnits.PLAYER.has('Dragon'));assert(c.researchedUnits.PLAYER.has('Archer'));assert.equal(c.settlements[0].owner,'PLAYER');assert.equal(c.terrain[4],'WOODS');assert.equal(c.currentTeam,'PLAYER');assert.equal(c.turnNumber,1);assert.equal(c.activeAITurn,null);assert.equal(JSON.stringify(c.activeScenarioSnapshot),original,'restarts do not mutate original snapshot');
}
assert.equal(c.units[0].personalName,'Hawkeye');assert.equal(c.units[0].promotionLevel,2);
const legacy=structuredClone(c.activeScenarioSnapshot);delete legacy.resources;delete legacy.research;delete legacy.researchedTechs;delete legacy.units[0].personalName;c.applyLevelData(legacy);assert.equal(c.resources.PLAYER.gold,0);assert.deepEqual([...c.researchedUnits.PLAYER],['Soldier','Swordsman']);assert(c.units[0].personalName);
console.log('Repeated scenario restarts restore armies, health, ownership, terrain, resources, research and turn state; legacy levels also start with zero balances.');
vm.runInContext("resources.PLAYER.gold=20;restoreResearchPoints({PLAYER:10});researchTech('PLAYER','field_training');researchTech('PLAYER','forced_march');",c);
c.units.push(c.makeUnit('Soldier','PLAYER',1,1,{id:'doctrine-soldier'}));
c.startDoctrineResearch('PLAYER','reconnaissance');c.advanceDoctrineResearch('PLAYER');
let doctrineSave=c.createLevelData();
doctrineSave.settlements[0].researchCaptureTeams=['PLAYER'];
for(let i=0;i<4;i++){
 c.applyLevelData(JSON.parse(JSON.stringify(doctrineSave)));
 const u=c.units.find(u=>u.id==='doctrine-soldier');assert.equal(u.maxHp,60);assert.equal(u.move,4);assert(c.hasTech('PLAYER','forced_march'));assert.equal(c.getResearchPoints('PLAYER'),5);assert.equal(c.makeUnit('Soldier','PLAYER',2,1).move,4);
 doctrineSave=c.createLevelData();
 assert.equal(vm.runInContext('activeResearch.PLAYER.progress',c),1);
 assert(c.settlements[0].researchCaptureTeams.includes('PLAYER'),'capture history survives save/load');
}
const oldLevel=JSON.parse(JSON.stringify(doctrineSave));delete oldLevel.researchPoints;delete oldLevel.researchPointReceipts;c.applyLevelData(oldLevel);assert.equal(c.getResearchPoints('PLAYER'),0);
oldLevel.startingResearchPoints={PLAYER:7,AI:3};c.applyLevelData(oldLevel);assert.equal(c.getResearchPoints('PLAYER'),7);assert.equal(c.getResearchPoints('AI'),3);
console.log('Full level save/load preserves doctrine state and bonuses through four cycles without stacking.');

Object.assign(c.units[0],{streakBonus:.6,streakMisses:1,streakKilled:true,streakProcessedTurn:8,spawnMoveLimit:2,usedBonusAttack:true,hasMoved:true,hasActed:false});c.turnNumber=9;c.currentTeam='AI';
const combatSave=c.createLevelData();c.applyLevelData(JSON.parse(JSON.stringify(combatSave)));
for(const [field,value]of Object.entries({streakBonus:.6,streakMisses:1,streakKilled:true,streakProcessedTurn:8,spawnMoveLimit:2,usedBonusAttack:true,hasMoved:true,hasActed:false}))assert.equal(c.units[0][field],value,field+' save/load');
assert.equal(c.turnNumber,9);assert.equal(c.currentTeam,'AI');

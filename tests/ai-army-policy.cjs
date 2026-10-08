const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={console:{log(){},warn(){},debug(){}},Math,Date,COLS:12,ROWS:8,terrain:Array(96).fill(null),settlements:Array(96).fill(null),units:[],useHexGrid:false,abs:Math.abs,min:Math.min,max:Math.max,floor:Math.floor,
 currentTeam:'AI',turnNumber:1,gameOver:false,isEditorMode:false,aiTurnTimeoutId:null,currentVictoryCondition:{type:'ANNIHILATE_ALL'},
 diplomacy:{warDeclarations:[],trust:{},personalities:{AI:'BALANCED'}},isDiplomacyActive:()=>false,hasTreaty:()=>false,
 updateUI(){},checkEndGame(){},showPopup(){},addAIMessage(){},window:{},ActionEffects:{move(){},damage(){}},
 isAITeam:t=>t.startsWith('AI'),clearTimeout(){},setTimeout:fn=>fn(),getHexNeighbors:()=>[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]],TERRAIN:{WATER:{waterOnly:true},MOUNTAIN:{blockedUnits:['Catapult']},WOODS:{assassinBonus:2,knightPenalty:.75}},
 campaignMode:{campaignData:{scenarios:[{difficulty:'Hard'}]},currentScenarioIndex:0}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/ui/popups-and-assets.js','utf8').match(/const SETTLEMENTS = \{[\s\S]*?\n\};/)[0],ctx);
for(const f of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js','js/systems/mechanics.js','js/systems/diplomacy.js','js/systems/combat-turns.js','js/systems/settlements.js','js/systems/ai-logistics.js','js/systems/ai-turn.js','js/systems/ai-commander.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx),ai=run('AICommander');let next=0;
const unit=(name,col,row,team='AI')=>ctx.makeUnit(name,team,col,row,{id:'u'+(++next)});
const reset=()=>{ctx.COLS=12;ctx.ROWS=8;ctx.units=[];ctx.terrain=Array(96).fill(null);ctx.settlements=Array(96).fill(null);ctx.currentVictoryCondition={type:'ANNIHILATE_ALL'};ctx.turnNumber=1;ctx.useHexGrid=false;ai.reset();run("resetResearch(['AI']);resources.AI={gold:0,materials:0};hasTreaty=()=>false;isDiplomacyActive=()=>false;");};

// Military strength targets use the nearest hostile kingdom, excluding forts/Crowns.
reset();ctx.settlements[0]={owner:'AI',type:'CITY'};ctx.settlements[5]={owner:'AI2',type:'CITY'};ctx.settlements[95]={owner:'PLAYER',type:'CITY'};
ctx.units=[unit('Soldier',0,1),...Array.from({length:8},(_,i)=>unit('Soldier',5+i%3,1+Math.floor(i/3),'AI2')),unit('Dragon',11,7,'PLAYER'),unit('Crown',0,0),unit('Castle',1,0)];
let needs=ctx.aiMilitaryNeeds('AI');assert.equal(needs.neighbor,'AI2');assert.equal(needs.defense,ctx.aiMilitary('AI2').reduce((s,u)=>s+ctx.aiStrength(u),0)*.9);assert.equal(ctx.aiMilitary('AI').length,1);
// No hard cap, including a city with far more than four mobile troops.
reset();ctx.settlements[0]={owner:'AI',type:'CITY'};ctx.units=Array.from({length:9},(_,i)=>unit('Soldier',2+i%3,2+Math.floor(i/3)));run('resources.AI={gold:100,materials:100}');ctx.aiRecruit('AI');assert.equal(ctx.aiMilitary('AI').length,10);
// Weak surplus receives attacking orders; expensive support and Crown stay protected.
reset();ctx.settlements[0]={owner:'AI',type:'CITY'};ctx.settlements[95]={owner:'PLAYER',type:'CITY'};
const weak=Array.from({length:9},(_,i)=>unit('Soldier',2+i%3,2+Math.floor(i/3))),medic=unit('Cleric',1,3),crown=unit('Crown',0,0);
ctx.units=[...weak,medic,crown,unit('Soldier',11,7,'PLAYER')];let plan=ai.build('AI');const vanguard=plan.groups.find(g=>g.type==='VANGUARD');assert(vanguard&&vanguard.unitIds.length);assert(!vanguard.unitIds.includes(medic.id));assert(!vanguard.unitIds.includes(crown.id));
const brave=ctx.units.find(u=>vanguard.unitIds.includes(u.id));brave.hp=10;assert.equal(ctx.aiRecoveryClerics(brave).length,0,'excess weak troops press the attack instead of joining the hospital queue');
reset();ctx.settlements[0]={owner:'AI',type:'CITY'};ctx.settlements[95]={owner:'PLAYER',type:'CITY'};ctx.units=[...Array.from({length:4},(_,i)=>unit('Soldier',2,i+1)),...Array.from({length:8},(_,i)=>unit('Castle',4+i%4,2+Math.floor(i/4)))];assert(!ai.build('AI').groups.some(g=>g.type==='VANGUARD'),'fortresses do not trigger surplus');
// Mountains limit this turn, not the long-term decision to capture a nearby town.
reset();const marcher=unit('Soldier',1,1);ctx.units=[marcher];ctx.terrain[13]='MOUNTAIN';ctx.settlements[15]={owner:null,type:'VILLAGE'};ai.build('AI');let move=ctx.aiChoosePosition(marcher);assert.equal(move.col,3);assert.equal(move.row,1);assert(ctx.canMoveTo(marcher,move.col,move.row));ctx.aiMoveWithGarrison(marcher,move);assert.equal(ctx.settlements[15].owner,'AI');
// Upgrade multiple towns and build strong, spaced defenses without crowding roads.
reset();ctx.settlements[26]={owner:'AI',type:'HAMLET'};ctx.settlements[69]={owner:'AI',type:'VILLAGE'};run("restoreResearch(null,{AI:['Heavy Fortress']});resources.AI={gold:100,materials:100}");ctx.aiRecruit('AI');assert(ctx.aiAssets('AI').every(h=>h.type==='CITY'));assert(ctx.getGold('AI')<70);assert(ctx.units.some(u=>u.name==='Heavy Fortress'));
for(const f of ctx.units.filter(ctx.isFortressUnit))assert(!ctx.units.some(g=>g!==f&&ctx.isFortressUnit(g)&&ctx.aiDistance(f,g)<=2));
reset();ctx.terrain[3*12+4]='BRIDGE';assert(!ctx.aiFortressSite('AI',{col:4,row:2}),'never obstruct bridge entrance');
ctx.terrain=Array(96).fill('WATER');for(let col=0;col<12;col++)ctx.terrain[3*12+col]=null;assert(!ctx.aiFortressSite('AI',{col:5,row:3}),'one-tile land corridor remains open');
ctx.terrain.fill(null);assert(ctx.aiFortressSite('AI',{col:5,row:3}),'open land is buildable');
// Engineering doctrines result in recruited, upgraded siege units with escorts.
reset();ctx.diplomacy.personalities.AI='TRADER';ctx.settlements[0]={owner:'AI',type:'CITY'};ctx.units=[unit('Swordsman',2,2),unit('Spearman',2,3),unit('Swordsman',3,2)];run("restoreResearch(null,{AI:['Catapult']});completeDoctrine('AI','siege_mobility');resources.AI={gold:100,materials:100}");ctx.aiRecruit('AI');assert(ctx.units.some(u=>u.name==='Catapult'&&u.move===2));
reset();ctx.settlements[0]={owner:'AI',type:'CITY'};run("restoreResearch(null,{AI:['Dragon','Catapult']});resources.AI={gold:100,materials:100}");assert.equal(ctx.aiRecruitChoice('AI','CITY'),'Catapult','non-mountain kingdoms can specialize in Catapults');ctx.terrain[0]='MOUNTAIN';assert.equal(ctx.aiRecruitChoice('AI','CITY'),'Dragon','mountain kingdoms favor Dragon recruitment');
// AI gets two timed progress per turn; humans one, without double ticking on load.
reset();run("resetResearch(['PLAYER','AI']);completeDoctrine('PLAYER','engineering_corps');completeDoctrine('AI','engineering_corps');currentTeam='AI'");assert(ctx.startDoctrineResearch('AI','siege_engineering'));run("currentTeam='PLAYER'");assert(ctx.startDoctrineResearch('PLAYER','siege_engineering'));ctx.turnNumber=1;ctx.advanceDoctrineResearch('AI');ctx.advanceDoctrineResearch('PLAYER');assert.equal(run('activeResearch.AI.progress'),2);assert.equal(run('activeResearch.PLAYER.progress'),1);const saved=JSON.parse(run('JSON.stringify(activeResearch)'));ctx.restoreActiveResearch(saved);ctx.advanceDoctrineResearch('AI');assert.equal(run('activeResearch.AI.progress'),2);ctx.turnNumber=2;ctx.advanceDoctrineResearch('AI');assert(ctx.hasTech('AI','siege_engineering'));assert(!ctx.hasTech('PLAYER','siege_engineering'));
console.log('Uncapped armies, nearest-neighbor strength, weak vanguards, fortress exclusion, mountain captures, spending, safe strongpoints, siege recruitment, and twice-speed persistent AI research pass.');

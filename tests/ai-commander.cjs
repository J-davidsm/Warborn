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
reset();let soldier=unit('Soldier',1,3);ctx.units=[soldier];
for(let r=0;r<8;r++)ctx.terrain[r*12+4]='WATER';
assert.equal(ai.pathCost(soldier,{col:6,row:3}),Infinity,'land cannot cross water');
ai.reset();ctx.terrain[7*12+4]='BRIDGE';assert(ai.pathCost(soldier,{col:6,row:3})>10,'bridge detour affects strategic distance');
ai.reset();ctx.terrain[7*12+4]='WATER';soldier.isWaterUnit=true;assert.equal(ai.pathCost(soldier,{col:6,row:3}),5,'anchored land can cross and disembark');
assert.equal(ai.pathCost(unit('Dragon',1,3),{col:6,row:3}),5);
assert.equal(ai.pathCost(unit('Castle',1,3),{col:6,row:3}),Infinity);
assert.equal(ai.pathCost(unit('Sloop',4,0),{col:4,row:7}),7);
assert.equal(ai.pathCost(unit('Sloop',4,0),{col:10,row:7}),Infinity,'naval units cannot cross land');
reset();ctx.useHexGrid=true;assert.equal(ai.pathCost(unit('Soldier',1,3),{col:3,row:1}),2,'hex adjacency used');
reset();ctx.terrain[1]='MOUNTAIN';ctx.ROWS=1;ctx.terrain=ctx.terrain.slice(0,12);assert.equal(ai.pathCost(unit('Catapult',0,0),{col:3,row:0}),Infinity,'blocked unit terrain');
reset();ctx.units=Array.from({length:9},(_,i)=>unit(i===7?'Cleric':i===8?'Archer':'Soldier',1+i%3,2+Math.floor(i/3)));
ctx.settlements[0]={owner:'AI',type:'CITY'};ctx.settlements[84]={owner:'AI',type:'VILLAGE'};ctx.settlements[47]={owner:'PLAYER',type:'CITY'};
let plan=ai.build('AI');assert.equal(plan.level,2);assert(plan.groups.some(g=>g.type==='RESERVE'));assert(plan.groups.some(g=>g.unitIds.length>=3&&g.type==='CAPTURE'),'coherent assault');
const ids=plan.groups.flatMap(g=>g.unitIds);assert.equal(new Set(ids).size,ids.length,'one group per unit');
const primary=plan.objectives[0].id;ctx.turnNumber++;assert.equal(ai.build('AI').objectives[0].id,primary,'retain useful objective');
const saved=JSON.stringify(ai.snapshot());ai.reset();ai.restore(JSON.parse(saved));assert.equal(JSON.stringify(ai.snapshot()),saved,'plans round trip');
ctx.settlements[47].owner='AI';assert(!ai.build('AI').objectives.some(o=>o.id==='capture:47'),'completed objective removed');
ai.restore(undefined);assert.equal(ai.get('AI'),undefined,'old saves need no planner data');
reset();const archer=unit('Archer',2,2),melee=unit('Soldier',3,3),victim=unit('Cleric',4,2,'PLAYER');victim.hp=30;
ctx.units=[archer,melee,victim];plan=ai.build('AI');assert(plan.attacks.length>=2,'multiple attackers needed');assert.equal(plan.attacks[0].unitId,archer.id,'ranged attack opens');assert(plan.attacks.every(a=>a.targetId===victim.id));
assert.equal(new Set(plan.attacks.map(a=>a.tile.col+','+a.tile.row)).size,plan.attacks.length,'firing positions do not collide');
victim.hp=0;assert.equal(ai.order(archer),undefined,'dead targets release orders');
ctx.campaignMode.campaignData.scenarios[0].difficulty='Easy';assert.equal(ai.build('AI').attacks.length,0);ctx.campaignMode.campaignData.scenarios[0].difficulty='Hard';
reset();ctx.units=[unit('Soldier',2,2),unit('Soldier',2,3),unit('Castle',10,7,'PLAYER')];ctx.settlements[0]={owner:'AI',type:'CITY'};
plan=ai.build('AI');assert.equal(plan.researchGoal,'engineering_corps');assert.equal(plan.economicGoal,null,'RP goals never hold gold');
run('resources.AI={gold:2,materials:0}');ctx.aiRecruit('AI');assert(ctx.units.some(u=>u.name==='Soldier'&&u.col===0&&u.row===0),'no RP does not block recruiting');
reset();ctx.units=[unit('Soldier',2,2),unit('Soldier',2,3),unit('Castle',10,7,'PLAYER')];ctx.settlements[0]={owner:'AI',type:'CITY'};
run('resources.AI={gold:0,materials:0};restoreResearchPoints({AI:5})');ai.build('AI');ctx.aiRecruit('AI');assert(ctx.hasTech('AI','engineering_corps'));
ctx.turnNumber++;ai.build('AI');run('resources.AI={gold:100,materials:100}');ctx.aiRecruit('AI');assert(ctx.hasTech('AI','siege_engineering'));const garrison=ctx.getUnitAt(0,0);if(garrison){garrison.col=3;garrison.row=4;}ctx.turnNumber++;ctx.aiRecruit('AI');assert(ctx.units.some(u=>u.name==='Catapult'&&u.team==='AI'),'researched siege units are recruited on the next production turn');

reset();ctx.units=[unit('Soldier',2,2),unit('Soldier',2,3),unit('Dragon',1,0,'PLAYER')];ctx.settlements[0]={owner:'AI',type:'CITY'};assert.equal(ai.build('AI').economicGoal,null,'emergency cancels savings');
reset();const crown=unit('Crown',2,2);ctx.units=[crown,unit('Soldier',3,2),unit('Soldier',3,3),unit('Soldier',10,2,'PLAYER')];ctx.settlements[0]={owner:'AI',type:'CITY'};ai.build('AI');assert.equal(ai.group(crown).type,'GUARD');
ctx.diplomacy.personalities.AI='TRADER';assert.equal(ai.build('AI').style,'ECONOMIC');ctx.diplomacy.personalities.AI='IDEOLOGICAL';assert.equal(ai.build('AI').style,'CUNNING');
// A 50x50 map with 80 troops checks bounded planning cost, not UI animation time.
reset();ctx.COLS=50;ctx.ROWS=50;ctx.terrain=Array(2500).fill(null);ctx.settlements=Array(2500).fill(null);
for(let i=0;i<40;i++){ctx.units.push(unit(i%5?'Soldier':'Archer',i%10,Math.floor(i/10)));ctx.units.push(unit('Soldier',35+i%10,35+Math.floor(i/10),'PLAYER'));}
for(let i=0;i<8;i++)ctx.settlements[(i<4?5:40)*50+i*5]={owner:i<4?'AI':'PLAYER',type:'CITY'};
const start=performance.now();plan=ai.build('AI');const elapsed=performance.now()-start;assert(elapsed<5000,`planning took ${elapsed}ms`);
console.log(`Commander routes, groups, persistence, focus fire, economy, personalities, difficulty, and 80-unit planning pass (${Math.round(elapsed)}ms).`);
reset();ctx.diplomacy.personalities.AI='BALANCED';const shooter=unit('Archer',2,2),finisher=unit('Soldier',3,3),target=unit('Cleric',4,2,'PLAYER');target.hp=30;ctx.units=[shooter,finisher,target];
const hits=[];ctx.attackUnit=(u,e)=>{assert(ctx.aiDistance(u,e)<=u.atkRange);assert(!u.hasActed);hits.push(u.id);e.hp=Math.max(0,e.hp-ai.damage(u,e));u.hasActed=true;};
let ended=0;ctx.endTurn=()=>ended++;
ctx.aiTakeTurn('AI').then(()=>{assert.equal(target.hp,0,'coordinated execution kills target');assert.deepEqual(hits,[shooter.id,finisher.id]);assert.equal(ended,1);console.log('Full AI turn executes ranged opening and melee finish and ends exactly once.');}).catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={console:{log(){},warn(){},debug(){}},Math,Date,COLS:7,ROWS:5,terrain:Array(35).fill(null),settlements:Array(35).fill(null),units:[],useHexGrid:false,abs:Math.abs,
 currentTeam:'AI',turnNumber:1,gameOver:false,isEditorMode:false,aiTurnTimeoutId:null,currentVictoryCondition:{type:'ANNIHILATE_ALL'},
 diplomacy:{warDeclarations:[],trust:{}},isDiplomacyActive:()=>false,hasTreaty:(a,b)=>[a,b].includes('AI')&&[a,b].includes('PLAYER'),
 updateUI(){},checkEndGame(){},showPopup(){},addAIMessage(){},window:{},ActionEffects:{move(){},damage(){}},
 isAITeam:t=>t.startsWith('AI'),clearTimeout(){},setTimeout:fn=>{ctx.wake=fn;},getHexNeighbors:()=>[],TERRAIN:{WATER:{waterOnly:true}},
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/ui/popups-and-assets.js','utf8').match(/const SETTLEMENTS = \{[\s\S]*?\n\};/)[0],ctx);
for(const file of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js','js/systems/mechanics.js','js/systems/diplomacy.js','js/systems/combat-turns.js','js/systems/settlements.js','js/systems/ai-turn.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
// Use a defensive alliance with no active war; other teams remain hostile.
run("hasTreaty=(a,b)=>a!==b&&[a,b].includes('AI')&&[a,b].includes('PLAYER');isDiplomacyActive=()=>false;addAIMessage=()=>{};");
const unit=(name,team,col,row)=>ctx.makeUnit(name,team,col,row);
let dragon=unit('Dragon','AI',0,1);ctx.units=[dragon];ctx.terrain[7]='SWAMP';ctx.terrain[8]='WATER';ctx.terrain[9]='MOUNTAIN';
assert(ctx.canMoveTo(dragon,3,1),'dragon keeps full movement across all terrain');
const castle=unit('Castle','AI',0,1,{move:5});castle.move=5;ctx.units=[castle];assert.equal(ctx.canMoveTo(castle,1,1),false,'legacy promoted fortresses cannot move');
run('promoteUnit(units[0],1)');assert.equal(castle.move,0);
ctx.terrain.fill(null);
const soldier=unit('Soldier','AI',1,1);ctx.units=[soldier];ctx.settlements[8]={owner:'PLAYER',type:'VILLAGE'};
ctx.claimSettlementAt(1,1,'AI');ctx.checkSettlementCaptureAfterMove(soldier,1,1);ctx.captureSettlementsWithUnits('AI');assert.equal(ctx.settlements[8].owner,'PLAYER','all capture paths protect allied towns');
assert.equal(ctx.canAttack('AI','PLAYER'),false);
ctx.settlements.fill(null);ctx.settlements[8]={owner:'AI',type:'CITY'};const enemy=unit('Knight','AI2',4,1);ctx.units=[soldier,enemy];
assert.equal(ctx.aiMayLeave(soldier,{col:4,row:4}),false,'last defender cannot abandon threatened town');
const guard=unit('Spearman','AI',1,2);ctx.units.push(guard);assert.equal(ctx.aiMayLeave(soldier,{col:4,row:4}),false,'nearby units cannot replace a town garrison');
const ally=unit('Soldier','PLAYER',4,3);ctx.units.push(ally);assert(ctx.aiObjectives(soldier).some(o=>o.col===ally.col&&o.row===ally.row&&o.weight>=85),'threatened ally attracts support');
const cleric=unit('Cleric','AI',3,3);ctx.units.push(cleric);ally.hp=10;ctx.aiHeal(cleric);assert.equal(ally.hp,30);assert(cleric.hasActed,'cleric spends its action healing');
ctx.currentVictoryCondition={type:'KILL_UNIT_LIMIT',targetUnitId:soldier.id};assert.equal(ctx.aiProtectedUnit('AI'),soldier);assert(ctx.aiObjectives(guard).some(o=>o.col===soldier.col&&o.row===soldier.row&&o.weight===150));
const anchor=unit('Soldier','AI',2,3);ctx.units=[anchor,enemy];ctx.terrain[3*7+3]='WATER';ctx.settlements.fill(null);run("resources.AI={gold:10,materials:0}");ctx.aiAnchor(anchor);assert(anchor.isWaterUnit);assert.equal(run('resources.AI.gold'),8);assert(ctx.canMoveTo(anchor,3,3),'anchored land units can enter water');anchor.col=3;assert(ctx.canMoveTo(anchor,4,3),'anchored land units can disembark');
// Legacy food values neither gate purchases nor get retained by normalized costs.
run("resources.AI={gold:10,materials:3};");assert(ctx.canAfford('AI',{food:999,gold:5}));ctx.deductResources('AI',{food:999,gold:5});assert.equal(run('resources.AI.gold'),5);assert.equal(JSON.stringify(ctx.getEffectiveCost({food:999,gold:2,materials:1})),JSON.stringify({gold:2,materials:1}));
ctx.currentVictoryCondition={type:'ANNIHILATE_ALL'};ctx.terrain.fill(null);ctx.settlements[0]={owner:'AI',type:'CITY'};
ctx.units=[unit('Soldier','AI',1,0),unit('Soldier','AI',2,0),unit('Soldier','AI',3,0)];run("resources.AI={gold:100,materials:100}");ctx.aiRecruit('AI');assert.equal(ctx.aiMobile('AI').length,3,'army cap is 3 per settlement');
ctx.units.pop();ctx.aiRecruit('AI');assert(ctx.units.some(u=>u.name==='Cleric'),'AI researches and recruits a cleric');assert.equal(ctx.aiMobile('AI').length,3);
ctx.units=[unit('Soldier','AI',1,0),unit('Cleric','AI',2,0)];run("resources.AI={gold:100,materials:100}");ctx.aiRecruit('AI');assert(ctx.units.some(u=>u.name==='Dragon'),'AI researches and purchases high-tier units');
ctx.settlements.fill(null);ctx.units=[];ctx.aiRecruit('AI');assert.equal(ctx.units.length,0,'no towns means no mobile recruitment');
// End Turn from the UI must stop before any side effects during an AI turn.
ctx.settlements[8]={owner:'AI',type:'HAMLET'};
ctx.settlements[12]={owner:'PLAYER',type:'HAMLET'};
assert(ctx.aiExpansionMode('AI'),'equal income triggers expansion');
ctx.settlements[12].type='CITY';assert(ctx.aiExpansionMode('AI'),'lower income triggers expansion');
ctx.settlements[8].type='CITY';ctx.settlements[12].type='HAMLET';assert.equal(ctx.aiExpansionMode('AI'),false,'higher income uses ordinary tactics');
ctx.settlements[8].type='HAMLET';ctx.settlements[12]={owner:null,type:'CITY'};
ctx.units=[unit('Soldier','AI',1,1)];run('resources.AI={gold:0,materials:0}');
assert.equal(ctx.aiMayLeave(ctx.units[0],{col:2,row:1}),false,'safe towns also retain their garrison');
run('resources.AI={gold:2,materials:0}');
assert(ctx.aiMoveWithGarrison(ctx.units[0],{col:2,row:1}),'funded defender can leave');
const replacement=ctx.getUnitAt(1,1);
assert(replacement&&replacement.team==='AI'&&replacement.dmg>0,'replacement is immediately on the town tile');
assert(replacement.hasMoved&&replacement.hasActed,'replacement cannot act on its recruitment turn');
assert.equal(run('resources.AI.gold'),0,'replacement cost deducted');
ctx.units.push(unit('Soldier','AI',0,0));run('resources.AI={gold:100,materials:100}');
assert.equal(ctx.aiGarrisonReplacement(replacement),null,'replacement honors army cap');
ctx.units=[unit('Soldier','AI',2,1)];ctx.settlements[12]={owner:'AI2',type:'HAMLET'};ctx.settlements[34]={owner:'PLAYER',type:'CITY'};
const chosen=ctx.aiChoosePosition(ctx.units[0]);
assert.equal(chosen.col,5);assert.equal(chosen.row,1,'expansion unit prioritizes capturing reachable enemy settlement');
// Aggression applies equally to human and AI enemies, including when richer.
run('hasTreaty=()=>false;');
for(const enemyTeam of ['PLAYER','AI2']){
  ctx.settlements.fill(null);ctx.settlements[28]={owner:'AI',type:'CITY'};
  const attacker=unit('Soldier','AI',0,1),target=unit('Soldier',enemyTeam,4,1);
  ctx.units=[attacker,target];
  assert.equal(ctx.aiExpansionMode('AI'),false,'attacker earns more than player');
  const attackPosition=ctx.aiChoosePosition(attacker);
  assert(ctx.aiDistance(attackPosition,target)<=attacker.atkRange,'AI actively closes to attack '+enemyTeam+' while richer');
  ctx.settlements[12]={owner:enemyTeam,type:'HAMLET'};
  assert(ctx.aiObjectives(attacker).some(o=>o.capture&&o.col===5&&o.row===1&&o.weight>=240),'enemy towns stay high priority while richer');
}
run("hasTreaty=(a,b)=>a!==b&&[a,b].includes('AI')&&[a,b].includes('PLAYER');");
ctx.settlements[12]={owner:'PLAYER',type:'HAMLET'};
assert(!ctx.aiObjectives(ctx.units[0]).some(o=>o.capture&&o.col===5&&o.row===1),'aggression still excludes allied settlements');
assert(!ctx.aiHostile('AI','PLAYER'),'allied players are not hostile');
console.log('Aggression against human and AI enemies, alliance protection, and immediate capped garrison replacements pass.');
// Retreat below half health, remain in care past half health, then rejoin combat.
ctx.settlements.fill(null);ctx.terrain.fill(null);
const medic=unit('Cleric','AI',0,2),wounded=unit('Soldier','AI',4,2),foe=unit('Soldier','AI2',6,2);
ctx.units=[medic,wounded,foe];wounded.hp=24;
let retreat=ctx.aiChoosePosition(wounded);
assert(ctx.aiDistance(retreat,medic)<=medic.atkRange,'wounded soldier retreats into cleric range');
wounded.col=retreat.col;wounded.row=retreat.row;ctx.aiHeal(medic);
assert.equal(wounded.hp,44);assert.equal(ctx.aiRecoveryClerics(wounded).length,1,'continues recovering above half health');
let waiting=ctx.aiChoosePosition(wounded);assert(ctx.aiDistance(waiting,medic)<=medic.atkRange,'waits near healer until fully healed');
medic.hasActed=false;ctx.aiHeal(medic);assert.equal(wounded.hp,50);
assert.equal(ctx.aiRecoveryClerics(wounded).length,0,'full health releases recovery');
const advance=ctx.aiChoosePosition(wounded);assert(ctx.aiDistance(advance,foe)<ctx.aiDistance(wounded,foe),'healed unit rejoins battle');
wounded.hp=25;assert.equal(ctx.aiRecoveryClerics(wounded).length,0,'exactly half health does not initiate retreat');
wounded.hp=20;medic.hp=0;assert.equal(ctx.aiRecoveryClerics(wounded).length,0,'dead clerics cannot attract retreaters');
medic.hp=medic.maxHp;medic.col=3;medic.row=2;wounded.col=4;wounded.row=2;
const rear=ctx.aiChoosePosition(medic);
assert.equal(ctx.aiThreat(rear,'AI'),0,'cleric chooses safe ground even with wounded frontline patient');
assert(ctx.aiDistance(rear,foe)>ctx.aiDistance(wounded,foe),'cleric stays behind combat troops');
assert(ctx.makeUnit('Soldier','AI',0,0,{aiRecovering:true}).aiRecovering,'recovery survives rehydration');
console.log('Cleric rear positioning, retreat threshold, continued healing, and return to combat pass.');
ctx.settlements.fill(null);ctx.units=[];
ctx.currentTeam='AI';ctx.endTurn();ctx.endTurn();assert.equal(ctx.currentTeam,'AI');
console.log('Alliance capture protection, defense and support, clerics, VIP protection, recruitment caps, elite spending, anchoring, flight, fortresses, food removal and turn guards pass.');
(async()=>{
  ctx.terrain.fill(null);ctx.settlements.fill(null);ctx.units=[unit('Cleric','AI',1,1)];ctx.currentTeam='AI';
  let ended=0;ctx.endTurn=()=>{ended++;};
  const turn=ctx.aiTakeTurn('AI');
  await ctx.aiTakeTurn('AI'); // A second invocation must not create another worker.
  ctx.currentTeam='PLAYER';ctx.wake();await turn;
  assert.equal(ended,0,'a stale async AI continuation must not end a player turn');
  ctx.currentTeam='AI';ctx.turnNumber++;
  const next=ctx.aiTakeTurn('AI');ctx.wake();await next;
  assert.equal(ended,1,'an uninterrupted AI turn ends exactly once');
  console.log('Duplicate AI calls and stale async turns are safely rejected.');
})().catch(e=>{console.error(e);process.exitCode=1;});

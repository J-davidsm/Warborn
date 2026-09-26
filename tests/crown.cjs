const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={console:{log(){},debug(){},warn(){}},Math,max:Math.max,min:Math.min,floor:Math.floor,abs:Math.abs,
 COLS:7,ROWS:3,terrain:Array(21).fill(null),settlements:Array(21).fill(null),units:[],useHexGrid:false,
 TERRAIN:{WATER:{waterOnly:true}},selectedUnit:null,gameOver:false,currentVictoryCondition:{type:'ANNIHILATE_ALL'},
 areFriendlyTeams:(a,b)=>a===b,isAITeam:t=>t.startsWith('AI'),isDiplomacyActive:()=>false,
 diplomacy:{trust:{}},updateUI(){},showPopup(){},addAIMessage(){},modifyTrust(){},modifyReputation(){},
 getActiveTeams:()=>['PLAYER','AI','AI2'],getTrust:()=>0,setTimeout(){},checkEndGame(){ctx.ended=true;}};
vm.createContext(ctx);
for(const f of ['js/data/units-and-build.js','js/core/level-state.js','js/systems/mechanics.js','js/systems/combat-turns.js'])
 vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx), unit=(n,t,c,r=1)=>ctx.makeUnit(n,t,c,r);
for(const type of ['HAMLET','VILLAGE','CITY','PORT'])assert(!ctx.allowedUnitsForSettlement(type).includes('Crown'));
ctx.spawnUnitAt('Crown','PLAYER',0,0);assert.equal(ctx.units.length,0);
let crown=unit('Crown','PLAYER',0);assert.equal(crown.hp,200);ctx.units=[crown];
assert(ctx.canMoveTo(crown,2,1));assert(!ctx.canMoveTo(crown,3,1));
for(const type of ['WOODS','MOUNTAIN','SWAMP','DESERT','BRIDGE','FARM','FOUNTAIN']){
 ctx.terrain.fill(null);ctx.terrain[8]=type;
 assert(ctx.canMoveTo(crown,1,1),type+' allows one step');assert(!ctx.canMoveTo(crown,2,1),type+' cannot be crossed in two steps');
 ctx.terrain.fill(null);ctx.terrain[7]=type;assert(ctx.canMoveTo(crown,1,1));assert(!ctx.canMoveTo(crown,2,1));
}
ctx.terrain.fill(null);ctx.terrain[8]='WATER';assert(!ctx.canMoveTo(crown,1,1));crown.isWaterUnit=true;
assert(ctx.canMoveTo(crown,1,1));assert(!ctx.canMoveTo(crown,2,1));ctx.terrain.fill(null);
ctx.promoteUnit(crown);assert.equal(crown.move,2);assert.equal(crown.dmg,0);
assert.equal(unit('Crown','AI',0).atkRange,0);
const hacked=ctx.makeUnit('Crown','PLAYER',0,0,{dmg:100,move:9,atkRange:5});
assert.equal(hacked.dmg,0);assert.equal(hacked.move,2);
const enemy=unit('Soldier','AI',1);ctx.units=[crown,enemy];
assert(ctx.attackUnit(crown,enemy).blocked);assert.equal(enemy.hp,50);
function hit(name,aura){
 const a=unit(name,'PLAYER',2),d=unit('Soldier','AI',3);d.hp=d.maxHp=500;
 ctx.units=[a,d];
 if(aura==='attack')ctx.units.push(unit('Crown','PLAYER',1));
 if(aura==='defense')ctx.units.push(unit('Crown','AI',4));
 ctx.attackUnit(a,d);return 500-d.hp;
}
assert.equal(hit('Soldier','attack'),Math.floor(hit('Soldier')*1.10));
assert.equal(hit('Soldier','defense'),Math.floor(hit('Soldier')*.75));
const assassin=unit('Assassin','PLAYER',2),royal=unit('Crown','AI',3);
ctx.units=[assassin,royal];ctx.attackUnit(assassin,royal);assert.equal(royal.hp,120);
const own=unit('Soldier','AI',5),dragon=unit('Dragon','AI',6),other=unit('Soldier','AI2',0);
ctx.units.push(own,dragon,other);royal.hp=1;assassin.hasActed=false;ctx.attackUnit(assassin,royal);
assert.equal(own.morale,0);assert.equal(dragon.morale,150);assert.equal(other.morale,100);
assert(!ctx.gameOver,'AI crown loss shatters kingdom without ending game');
ctx.currentVictoryCondition={type:'ANNIHILATE_ALL'};const playerCrown=unit('Crown','PLAYER',1),killer=unit('Assassin','AI',2);
playerCrown.hp=1;ctx.units=[playerCrown,killer];ctx.attackUnit(killer,playerCrown);
assert(ctx.gameOver&&ctx.ended);assert(ctx.currentVictoryCondition.crownFallenTeams.includes('PLAYER'));
vm.runInContext(fs.readFileSync('js/ui/endgame-and-ui.js','utf8'),ctx);
assert.equal(ctx.evaluateVictoryCondition().outcome,'defeat');
console.log('Crown purchase block, movement, promotions, aura, assassin vulnerability, and both death outcomes pass.');
ctx.gameOver=false;ctx.currentVictoryCondition={type:'ANNIHILATE_ALL'};ctx.checkEndGame=()=>{};
assert.equal(unit('Catapult','PLAYER',1).maxHp,160);
for(const target of ['Soldier','Stockade','Castle','Heavy Fortress']){
 const siege=unit('Catapult','PLAYER',1),defender=unit(target,'AI',3);defender.hp=defender.maxHp=1000;
 ctx.units=[siege,defender];ctx.attackUnit(siege,defender);
 assert.equal(1000-defender.hp,target==='Soldier'?35:70,'siege damage against '+target);
}
console.log('Catapult has 160 HP, deals 70 damage against all fortress tiers, and keeps 35 damage against ordinary units.');

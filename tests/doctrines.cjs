const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console:{log(){},warn(){}},Math,Date,abs:Math.abs,min:Math.min,max:Math.max,floor:Math.floor,COLS:10,ROWS:10,units:[],terrain:Array(100).fill(null),settlements:Array(100).fill(null),TERRAIN:{},useHexGrid:false,getHexNeighbors:()=>[],currentVictoryCondition:{type:'ANNIHILATE_ALL'},diplomacy:{personalities:{AI:'BALANCED'},warDeclarations:[],trust:{}},isAITeam:t=>t.startsWith('AI'),hasTreaty:()=>false,isDiplomacyActive:()=>false,addAIMessage(){},setTimeout(){},showPopup(){},updateUI(){},window:{}};
vm.createContext(c);const run=s=>vm.runInContext(s,c);
run(fs.readFileSync('js/ui/popups-and-assets.js','utf8').match(/const SETTLEMENTS = \{[\s\S]*?\n\};/)[0]);
for(const f of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js','js/systems/mechanics.js','js/systems/diplomacy.js','js/systems/combat-turns.js','js/systems/settlements.js','js/systems/ai-logistics.js','js/systems/ai-turn.js','js/systems/ai-commander.js'])run(fs.readFileSync(f,'utf8'));
const reset=()=>{c.units=[];c.terrain.fill(null);c.settlements.fill(null);run("resetResearch(['PLAYER','AI']);restoreResearchPoints({PLAYER:1000,AI:1000});resources={PLAYER:{gold:1000,materials:100},AI:{gold:1000,materials:100}};hasTreaty=()=>false;isDiplomacyActive=()=>false;");};
const buy=(id,team='PLAYER')=>{for(const next of c.getResearchPath(team,id))assert(c.researchTech(team,next),next);};
const make=(name,team='PLAYER')=>{const u=c.makeUnit(name,team,0,0);c.units.push(u);return u;};
reset();assert(c.isUnitUnlocked('PLAYER','Soldier'));assert(c.isUnitUnlocked('PLAYER','Swordsman'));assert(!c.isUnitUnlocked('PLAYER','Archer'));assert(!c.researchTech('PLAYER','archery'));assert.equal(c.getGold('PLAYER'),1000);assert(!c.researchTech('PLAYER','unknown'));
const soldier=make('Soldier'),sword=make('Swordsman');buy('steel_arms');assert.equal(c.getGold('PLAYER'),1000);assert.equal(c.getResearchPoints('PLAYER'),996);assert.equal(soldier.dmg,15);assert.equal(sword.dmg,20);assert(!c.researchTech('PLAYER','steel_arms'));assert.equal(soldier.dmg,15);assert.equal(c.makeUnit('Soldier','PLAYER',0,0).dmg,15);
const defender=c.makeUnit('Soldier','AI',1,0);c.units=[sword,defender];sword.hp=1;
assert.equal(c.calculateCombatDamage(sword,defender).damage,20,'Iron Strength ignores wounds');
assert(c.calculateCombatDamage(sword,defender).modifiers.some(m=>m.label.includes('Iron Strength')));
sword.morale=20;assert.equal(c.calculateCombatDamage(sword,defender).damage,12,'morale penalties still apply');
const oldSteelSword=c.makeUnit('Swordsman','PLAYER',0,0,{id:'legacy',dmg:28,promotionLevel:3});assert.equal(oldSteelSword.dmg,26,'remove retired +2, preserve veteran damage');
const ironReload=c.makeUnit('Swordsman','PLAYER',0,0,JSON.parse(JSON.stringify(oldSteelSword)));assert.equal(ironReload.dmg,26,'migration runs once');
c.units=[soldier,sword];sword.morale=100;
buy('field_training');assert.equal(soldier.maxHp,60);assert.equal(soldier.hp,60);buy('forced_march');assert.equal(soldier.move,4);assert(c.canMoveTo(soldier,4,0),'pathfinding sees real movement bonus');
buy('volley_fire');const archer=make('Archer');assert.equal(archer.atkRange,3);assert.equal(archer.dmg,20);
const knight=make('Knight');buy('heavy_cavalry');assert.equal(knight.move,3);buy('maneuver_warfare');assert.equal(knight.move,3);assert.equal(c.makeUnit('Knight','PLAYER',1,1).move,3);assert.equal(c.makeUnit('Assassin','PLAYER',1,1).move,5);
const assassin=make('Assassin');buy('master_assassins');assert.equal(assassin.maxHp,60);
const stockade=make('Stockade');buy('fieldworks');assert.equal(stockade.maxHp,50);assert.equal(c.makeUnit('Stockade','PLAYER',1,1).maxHp,50);
buy('artillery');assert.equal(c.makeUnit('Catapult','PLAYER',1,1).dmg,40);assert(!c.researchTech('PLAYER','rapid_mobilization'),'both engineering prerequisites required');buy('mass_production');assert(c.researchTech('PLAYER','rapid_mobilization'));assert(c.researchTech('PLAYER','dragon_corps'));assert(c.isUnitUnlocked('PLAYER','Dragon'));
buy('counterweight_engines');const cat=c.makeUnit('Catapult','PLAYER',1,1);assert.equal(cat.move,2);assert.equal(cat.atkRange,4);assert.equal(cat.maxHp,190);for(const n of ['Sloop','Man-of-War','Battleship'])assert(c.isUnitUnlocked('PLAYER',n));
assert.deepEqual(JSON.parse(JSON.stringify(c.getEffectiveUnitCostForTeam('PLAYER','Knight'))),{gold:6,materials:2});assert.equal(c.getEffectiveUnitCostForTeam('PLAYER','Soldier').gold,1);assert.equal(c.getEffectiveUnitCostForTeam('PLAYER','Soldier').materials,0);assert.equal(run('UNIT_TEMPLATES.Knight.cost.gold'),7,'templates unchanged');
const gold=c.getGold('PLAYER'),rp=c.getResearchPoints('PLAYER');buy('garrison_training');assert.equal(gold,c.getGold('PLAYER'),'Research never costs gold');assert.equal(rp-c.getResearchPoints('PLAYER'),3,'Logistics never discounts RP research');
c.settlements[0]={owner:'PLAYER',type:'CITY'};const defense=c.getDefenseModifiers(archer,soldier);c.settlements[0].owner='AI';assert.equal(defense,c.getDefenseModifiers(archer,soldier));c.settlements[0]=null;assert.equal(c.getDefenseModifiers(archer,soldier),0);
buy('battlefield_medicine');soldier.hp=10;c.healUnit(make('Cleric'),soldier);assert.equal(soldier.hp,38);
// Promotion changes stay in the serialized stats. Rehydrate repeatedly without
// buying anything: doctrine bonuses and names must never accumulate.
c.promoteUnit(soldier);const stats=[soldier.maxHp,soldier.dmg,soldier.move,soldier.personalName];const savedTechs=JSON.parse(JSON.stringify(c.serializeResearch()));
let saved=JSON.parse(JSON.stringify(soldier));for(let i=0;i<4;i++){c.restoreResearch(savedTechs);saved=JSON.parse(JSON.stringify(c.makeUnit(saved.name,saved.team,saved.col,saved.row,saved)));assert.deepEqual([saved.maxHp,saved.dmg,saved.move,saved.personalName],stats);}
assert(c.hasTech('PLAYER','forced_march'));assert.equal(c.makeUnit('Soldier','PLAYER',1,1).move,4);
reset();c.restoreResearch(null,{PLAYER:['Archer','Knight','Battleship','Dragon','bogus']});assert(c.hasTech('PLAYER','archery'));assert(c.hasTech('PLAYER','steel_arms'));assert(c.hasTech('PLAYER','maneuver_warfare'));assert(c.hasTech('PLAYER','master_assassins'));assert(c.validResearchState(c.serializeResearch()));assert(!c.validResearchState({PLAYER:['dragon_corps']}));
const legacy=c.makeUnit('Soldier','PLAYER',0,0,{dmg:15,move:3,maxHp:50,hp:40});assert.equal(legacy.dmg,15,'legacy serialized stats grandfathered');
reset();run('SETTLEMENTS.HAMLET.upgradeCost.materials=2');const unitCost=c.getEffectiveUnitCostForTeam('PLAYER','Knight');buy('engineering_corps');assert.equal(c.getSettlementUpgradeCost('PLAYER','HAMLET').materials,1);assert.equal(c.getSettlementUpgradeCost('PLAYER','HAMLET').gold,8);assert.deepEqual(c.getEffectiveUnitCostForTeam('PLAYER','Knight'),unitCost,'Engineering Corps does not discount units');buy('mass_production');assert.equal(c.getSettlementUpgradeCost('PLAYER','HAMLET').materials,1,'Logistics/Mass Production do not discount upgrades');
reset();c.units=[c.makeUnit('Dragon','PLAYER',8,8)];assert.equal(c.chooseAIResearch('AI'),'spear_doctrine');for(let i=0;i<3;i++){const id=c.chooseAIResearch('AI');assert(c.canResearchTech('AI',id));c.researchTech('AI',id);}assert(c.isUnitUnlocked('AI','Knight'),'AI walks counter prerequisites');
for(const [style,id]of [['AGGRESSIVE','engineering_corps'],['DEFENSIVE','fieldworks'],['TRADER','engineering_corps'],['IDEOLOGICAL','engineering_corps']]){reset();c.diplomacy.personalities.AI=style;assert.equal(c.chooseAIResearch('AI'),id);}
reset();c.diplomacy.personalities.AI='BALANCED';c.units=[c.makeUnit('Knight','PLAYER',8,8)];assert.equal(c.chooseAIResearch('AI'),'spear_doctrine');buy('spear_doctrine','AI');assert(c.isUnitUnlocked('AI','Spearman'));
reset();assert.equal(c.aiPreferredHeavyUnit('AI'),'Catapult');assert.equal(c.aiPreferredHeavyUnit('AI2'),'Dragon','different kingdoms get different heavy-unit doctrines');c.settlements[0]={owner:'AI',type:'VILLAGE'};c.terrain[0]='MOUNTAIN';assert.equal(c.aiPreferredHeavyUnit('AI'),'Dragon','mountain kingdoms favor Dragons');
console.log('Doctrine prerequisites, unlocks, exact stats, promotions, repeat load, legacy migration, cost isolation, healing, friendly defense, and AI choices pass.');
// Exercise the actual end-turn passive-healing path, including team ownership.
reset();buy('master_assassins');const patient=make('Assassin'),other=make('Assassin','AI');patient.hp=20;other.hp=20;
Object.assign(c,{currentTeam:'PLAYER',gameOver:false,opponentType:'AI',communicationLockouts:{},turnNumber:1,turnOrder:['PLAYER','AI'],currentTurnIndex:0,currentAIPlayers:1,cleanupExpiredTradeProposals(){},calculateTurnOrder(){},getActiveTeams:()=>['PLAYER','AI'],captureSettlementsWithUnits(){},grantIncomeForTeam(){},autoFlee(){},checkEndGame(){},postGameState(){},isTeamDead:()=>false});
c.endTurn();assert.equal(patient.hp,28);assert.equal(other.hp,20,'passive healing only on owning turn');
// Research order never adds a second point to the Knight movement floor.
reset();const k=make('Knight');buy('maneuver_warfare');buy('heavy_cavalry');assert.equal(k.move,3);
reset();const ship=make('Sloop','PLAYER');ship.col=9;ship.row=9;c.settlements[0]={owner:'AI',type:'PORT'};c.terrain[1]='WATER';
assert(c.aiRecruitNaval('AI',c.aiAssets('AI')));assert(c.units.some(u=>u.team==='AI'&&['Sloop','Man-of-War','Battleship'].includes(u.name)&&u.col===1&&u.row===0));
console.log('Actual end-turn Assassin healing, reverse-order Knight doctrines and port-based naval production pass.');
reset();buy('longbows');let bow=make('Archer'),victim=make('Soldier','AI');victim.col=3;
c.modifyTrust=()=>{};c.modifyReputation=()=>{};c.awardExperience=()=>{};
const estimate=run('AICommander');
assert.equal(estimate.damage(bow,victim),12);c.attackUnit(bow,victim);assert.equal(victim.hp,38,'actual distance-3 hit is 12 instead of 16');
bow.hasActed=false;bow.morale=100;victim.hp=50;victim.col=2;assert.equal(estimate.damage(bow,victim),16);c.attackUnit(bow,victim);assert.equal(victim.hp,34,'distance-2 damage unchanged');
buy('volley_fire');bow.hasActed=false;bow.morale=100;victim.hp=50;victim.col=3;assert.equal(estimate.damage(bow,victim),15);c.attackUnit(bow,victim);assert.equal(victim.hp,35,'Volley Fire long shot is 15 instead of 20');
reset();const engine=make('Catapult');buy('counterweight_engines');assert.equal(engine.move,2);assert.equal(engine.atkRange,4);assert.equal(engine.maxHp,190);
const engineSave=JSON.parse(JSON.stringify(engine)),engineTechs=c.serializeResearch();for(let i=0;i<3;i++){c.restoreResearch(engineTechs);const loaded=c.makeUnit('Catapult','PLAYER',0,0,engineSave);assert.equal(loaded.move,2);assert.equal(loaded.atkRange,4);assert.equal(loaded.maxHp,190);}
assert(!c.researchTech('PLAYER','naval_engineering'),'retired ship nodes cannot be bought');
c.restoreResearch({PLAYER:['naval_engineering','warships','naval_supremacy']});assert(c.isUnitUnlocked('PLAYER','Battleship'));assert(!c.hasTech('PLAYER','reinforced_carriages'),'obsolete ship IDs do not grant unrelated siege bonuses');
console.log('Longbows actual combat and AI estimates agree at ranges 2/3; siege upgrades persist without stacking; retired ship IDs load safely.');
reset();assert(c.canResearchTech('PLAYER','spear_doctrine'));assert(!c.canResearchTech('PLAYER','steel_arms'));buy('spear_doctrine');assert(c.isUnitUnlocked('PLAYER','Spearman'));assert.equal(c.makeUnit('Soldier','PLAYER',0,0).dmg,15);assert(c.canResearchTech('PLAYER','steel_arms'));assert(!c.canResearchTech('PLAYER','cavalry_training'));buy('steel_arms');assert(c.canResearchTech('PLAYER','cavalry_training'));
reset();buy('reinforced_carriages');assert.equal(c.makeUnit('Catapult','PLAYER',0,0).maxHp,190);assert.equal(c.makeUnit('Catapult','PLAYER',0,0).atkRange,3);assert(c.canResearchTech('PLAYER','counterweight_engines'));buy('counterweight_engines');assert.equal(c.makeUnit('Catapult','PLAYER',0,0).atkRange,4);
console.log('Spear Doctrine is the Warfare root; Steel Arms gates cavalry; Reinforced Carriages precedes the final Counterweight Engines range upgrade.');

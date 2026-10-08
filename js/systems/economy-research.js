// Warborn source split from the original game.js.
// Section: js/systems/economy-research.js

// Economy: resources per team
// two-resource economy: Gold, Materials
let resources = { 
  PLAYER: { gold: 0, materials: 0 },
  AI: { gold: 0, materials: 0 },
  PLAYER2: { gold: 0, materials: 0 }
};

// Compatibility mirror for older network clients; doctrine IDs are authoritative.
let researchedUnits = {
  PLAYER: new Set(['Soldier']), // Start with only basic soldier
  AI: new Set(['Soldier']),
  PLAYER2: new Set(['Soldier'])
};

let researchedTechs = {};
let activeResearch = {};
function restoreActiveResearch(state={}) {
  activeResearch={};
  for(const [team,job] of Object.entries(state||{})){
    const tech=Object.hasOwn(RESEARCH_TREE,job?.id)?RESEARCH_TREE[job.id]:null;
    if(validResearchTeam(team)&&tech&&!hasTech(team,job.id)&&tech.requires.every(id=>hasTech(team,id))&&Number.isInteger(job.progress)&&job.progress>=0&&job.progress<tech.cost)activeResearch[team]={id:job.id,progress:job.progress,lastTurn:Number.isInteger(job.lastTurn)?job.lastTurn:null};
  }
}
function startDoctrineResearch(team,id) {
  const tech=Object.hasOwn(RESEARCH_TREE,id)?RESEARCH_TREE[id]:null;
  if(!validResearchTeam(team)||!tech||hasTech(team,id)||!tech.requires.every(p=>hasTech(team,p))||!canMutateResearch()||(typeof currentTeam!=='undefined'&&currentTeam!==team))return false;
  if(activeResearch[team]?.id===id)return true;
  activeResearch[team]={id,progress:0,lastTurn:null};
  if(typeof markScenarioPlaying==='function')markScenarioPlaying();
  refreshResearchState();return true;
}
function advanceDoctrineResearch(team) {
  const job=activeResearch[team];
  if(!job||!canMutateResearch()||job.lastTurn===turnNumber)return;
  job.lastTurn=turnNumber;job.progress+=/^AI\d*$/.test(team)?2:1;
  if(job.progress>=RESEARCH_TREE[job.id].cost){
    const name=RESEARCH_TREE[job.id].name;completeDoctrine(team,job.id);

  }
  refreshResearchState();
}
// A separate battlefield ledger: never included in production/trade resources.
let researchPoints = {};
let researchPointReceipts = {};
let researchSyncEpoch = 0, researchSyncQueued = false;
const RESEARCH_REWARDS = {unit:1,neutralCapture:1,enemyCapture:2,upgrade:1,Stockade:1,Castle:2,Fortress:2,'Heavy Fortress':3};
function validResearchTeam(team) { return typeof team==='string'&&/^(PLAYER|AI)\d*$/.test(team); }
function getResearchPoints(team) { return validResearchTeam(team)?researchPoints[team]||0:0; }
function validResearchPoints(state) {
  return state&&typeof state==='object'&&!Array.isArray(state)&&Object.entries(state).every(([t,n])=>validResearchTeam(t)&&Number.isSafeInteger(n)&&n>=0);
}
function canMutateResearch() {
  return !(typeof isEditorMode!=='undefined'&&isEditorMode)&&
    (typeof OnlineMatch==='undefined'||!OnlineMatch.playing||OnlineMatch.canAct()||OnlineMatch.canRunAI());
}
function refreshResearchState() {
  if(typeof updateUI==='function')updateUI();
  // Publish after the enclosing combat/capture/upgrade has finished atomically.
  // Receiving snapshots never calls this helper, so clients cannot re-award RP.
  if(researchSyncQueued)return;
  researchSyncQueued=true;const epoch=researchSyncEpoch;
  Promise.resolve().then(()=>{
    if(epoch!==researchSyncEpoch)return;
    researchSyncQueued=false;
    if(canMutateResearch()&&typeof postGameState==='function')postGameState();
  });
}
function showResearchReceipt(team,receipt) {
  const local=typeof getLocalPlayableTeam==='function'?getLocalPlayableTeam():typeof OnlineMatch!=='undefined'&&OnlineMatch.playing?OnlineMatch.localTeam:'PLAYER';
  if(team===local&&typeof BattleGuide!=='undefined'&&BattleGuide.notify)BattleGuide.notify(`📜 +${receipt.amount} Research Point${receipt.amount===1?'':'s'} — ${receipt.reason}`);
}
function awardResearchPoints(team,amount,reason='Battlefield accomplishment') {
  if(!validResearchTeam(team)||!Number.isSafeInteger(amount)||amount<=0||!canMutateResearch())return false;
  if(!Number.isSafeInteger(getResearchPoints(team)+amount))return false;
  researchPoints[team]=getResearchPoints(team)+amount;
  const receipt={serial:(researchPointReceipts[team]?.serial||0)+1,amount,reason:String(reason).slice(0,120)};
  researchPointReceipts[team]=receipt;refreshResearchState();showResearchReceipt(team,receipt);return true;
}
function restoreResearchPoints(points={},receipts={},notify=false) {
  const old=researchPointReceipts;researchPoints={};researchPointReceipts={};researchSyncEpoch++;researchSyncQueued=false;
  for(const [team,value]of Object.entries(points||{}))if(validResearchTeam(team)&&Number.isSafeInteger(value)&&value>=0)researchPoints[team]=value;
  for(const [team,r]of Object.entries(receipts||{}))if(validResearchTeam(team)&&r&&Number.isSafeInteger(r.serial)&&r.serial>0&&Number.isSafeInteger(r.amount)&&r.amount>0&&typeof r.reason==='string'){
    researchPointReceipts[team]={serial:r.serial,amount:r.amount,reason:r.reason.slice(0,120)};
    if(notify&&r.serial>(old[team]?.serial||0))showResearchReceipt(team,researchPointReceipts[team]);
  }
}
function awardKillResearch(killer,victim) {
  if(killer?.rogue||killer?.ruins||victim?.ruins)return false;
  if(!killer||!victim||victim.hp>0||victim.researchRewardClaimed||killer.team===victim.team||areFriendlyTeams(killer.team,victim.team)||!canAttack(killer.team,victim.team))return false;
  const amount=RESEARCH_REWARDS[victim.name]||RESEARCH_REWARDS.unit;
  if(!awardResearchPoints(killer.team,amount,isFortressUnit(victim)?`${victim.name} destroyed`:'Enemy defeated'))return false;
  victim.researchRewardClaimed=true;return true;
}
function awardCaptureResearch(settlement,team,previousOwner) {
  if(!settlement||settlement.owner!==team||previousOwner===team||(previousOwner&&(areFriendlyTeams(previousOwner,team)||!canAttack(team,previousOwner)))||!canMutateResearch())return false;
  const rewarded=Array.isArray(settlement.researchCaptureTeams)?settlement.researchCaptureTeams:[];
  if(rewarded.includes(team))return false;
  if(!awardResearchPoints(team,previousOwner?RESEARCH_REWARDS.enemyCapture:RESEARCH_REWARDS.neutralCapture,previousOwner?'Enemy settlement captured':'Neutral settlement captured'))return false;
  // Metadata travels with the settlement when Endless scrolls or it is traded.
  settlement.researchCaptureTeams=[...rewarded,team];return true;
}
const RESEARCH_TREE = Object.fromEntries([
  ['spear_doctrine','Spear Doctrine','warfare',2,[],'Unlock Spearman.','Spearman'],
  ['steel_arms','Iron Strength','warfare',2,['spear_doctrine'],'Swordsmen deal full damage even when wounded.'],
  ['archery','Archery','warfare',2,['spear_doctrine'],'Unlock Archer.','Archer'],
  ['cavalry_training','Cavalry Training','warfare',4,['steel_arms'],'Unlock Knight.','Knight'],
  ['longbows','Longbows','warfare',3,['archery'],'Archer range increases to 3. Shots at distance 3 deal 25% less damage.',null,{units:['Archer'],atkRange:1}],
  ['heavy_cavalry','Heavy Cavalry','warfare',4,['cavalry_training'],'Knight movement becomes 3; does not stack with Maneuver Warfare.',null,{units:['Knight'],moveFloor:3}],
  ['volley_fire','Volley Fire','warfare',4,['longbows'],'Archers gain +4 damage (base 20).',null,{units:['Archer'],dmg:4}],
  ['field_training','Field Training','command',2,[],'Soldiers gain +10 maximum and current HP.',null,{units:['Soldier'],maxHp:10}],
  ['forced_march','Forced March','command',3,['field_training'],'Soldiers, Spearmen and Swordsmen gain +1 permanent movement.',null,{units:['Soldier','Spearman','Swordsman'],move:1}],
  ['reconnaissance','Phalanx Warriors','command',2,['field_training'],'Spearmen with two adjacent friendly Spearmen gain an additional 15% defense. Opens Shadow Warfare.'],
  ['maneuver_warfare','Maneuver Warfare','command',4,['forced_march'],'Assassin movement becomes 5; Knight movement becomes 3.',null,{moveFloors:{Assassin:5,Knight:3}}],
  ['shadow_warfare','Shadow Warfare','command',4,['reconnaissance'],'Unlock Assassin.','Assassin'],
  ['master_assassins','Master Assassins','command',5,['shadow_warfare'],'Assassins gain +10 HP and heal 8 HP per turn instead of 5.',null,{units:['Assassin'],maxHp:10}],
  ['fieldworks','Fieldworks','defense',2,[],'Unlock Stockade.','Stockade'],
  ['garrison_training','Retaliation','defense',3,['fieldworks'],'Surviving fortresses retaliate when their attacker is within attack range. Only fortresses can retaliate.'],
  ['healing_orders','Healing Orders','defense',3,['fieldworks'],'Unlock Cleric.','Cleric'],
  ['stone_fortifications','Stone Fortifications','defense',4,['fieldworks'],'Unlock Castle.','Castle'],
  ['battlefield_medicine','Battlefield Medicine','defense',4,['healing_orders'],'Clerics heal 28 HP instead of 20.'],
  ['citadel_engineering','Citadel Engineering','defense',5,['stone_fortifications'],'Unlock Heavy Fortress.','Heavy Fortress'],
  ['engineering_corps','Engineering Corps','engineering',2,[],'Settlement upgrades cost 1 fewer material (minimum 0).'],
  ['siege_engineering','Siege Engineering','engineering',3,['engineering_corps'],'Unlock Catapult.','Catapult'],
  ['logistics','Logistics','engineering',3,['engineering_corps'],'Unit production costs 1 fewer gold (minimum 1).'],
  ['siege_mobility','Siege Mobility','engineering',2,['siege_engineering'],'Catapult movement becomes 2 permanently.',null,{units:['Catapult'],moveFloor:2}],
  ['artillery','Artillery','engineering',4,['siege_engineering'],'Catapults gain +5 damage (base 40).',null,{units:['Catapult'],dmg:5}],
  ['mass_production','Recycling','engineering',4,['logistics'],'Unit production costs 1 fewer material (minimum 0).'],
  ['reinforced_carriages','Reinforced Carriages','engineering',6,['siege_mobility'],'Catapults gain +30 maximum and current HP.',null,{units:['Catapult'],maxHp:30}],
  ['rapid_mobilization','Mass Production','engineering',6,['artillery','mass_production'],'New units can move half their normal movement (rounded down) when built, but cannot attack.'],
  ['dragon_corps','Dragon Corps','command',6,['maneuver_warfare','master_assassins'],'Unlock Dragon. Requires both parent doctrines.','Dragon'],
  ['counterweight_engines','Counterweight Engines','engineering',4,['reinforced_carriages'],'Catapult attack range becomes 4.',null,{units:['Catapult'],atkRange:1}]
].map(([id,name,branch,cost,requires,description,unlockUnit,effect])=>[id,{id,name,branch,cost,requires,description,unlockUnit,effect}]));
const UNIT_DOCTRINES = Object.fromEntries(Object.values(RESEARCH_TREE).filter(t=>t.unlockUnit).map(t=>[t.unlockUnit,t.id]));
// Legacy callers request a unit; they now buy one prerequisite at a time.
const RESEARCH_COSTS = Object.fromEntries(Object.entries(UNIT_DOCTRINES).map(([name,id])=>[name,RESEARCH_TREE[id].cost]));

function hasTech(team,id) { return researchedTechs[team]?.has(id) || false; }
// Older saved units already include Steel Arms' retired +2 stat increase.
// Stamp the migration so promotions and repeated saves cannot subtract it twice.
function migrateIronStrength(unit) {
  if(unit.ironStrengthVersion===1)return;
  if(['Soldier','Swordsman'].includes(unit.name)&&hasTech(unit.team,'steel_arms')&&unit.dmg>=UNIT_TEMPLATES[unit.name].dmg+2)unit.dmg-=2;
  unit.ironStrengthVersion=1;
}
function getDoctrineAttackMultiplier(attacker,defender) {
  return attacker.name==='Archer'&&hasTech(attacker.team,'longbows')&&manhattan(attacker.col,attacker.row,defender.col,defender.row)===3?.75:1;
}
function isUnitUnlocked(team,name) { return !UNIT_DOCTRINES[name] || hasTech(team,UNIT_DOCTRINES[name]); }
function canResearchTech(team,id) {
  const tech=Object.hasOwn(RESEARCH_TREE,id)?RESEARCH_TREE[id]:null;
  return validResearchTeam(team)&&!!tech&&!hasTech(team,id)&&tech.requires.every(p=>hasTech(team,p))&&getResearchPoints(team)>=tech.cost;
}
function getAvailableResearch(team) { return Object.values(RESEARCH_TREE).filter(t=>!hasTech(team,t.id)&&t.requires.every(id=>hasTech(team,id))); }
function serializeResearch() { return Object.fromEntries(Object.entries(researchedTechs).map(([t,ids])=>[t,[...ids]])); }
function validResearchState(state) {
  return state&&typeof state==='object'&&!Array.isArray(state)&&Object.values(state).every(ids=>Array.isArray(ids)&&ids.length<=Object.keys(RESEARCH_TREE).length&&new Set(ids).size===ids.length&&ids.every(id=>Object.hasOwn(RESEARCH_TREE,id)&&RESEARCH_TREE[id].requires.every(p=>ids.includes(p))));
}
function refreshResearchMirror(team) { researchedUnits[team]=new Set(['Soldier','Swordsman',...Object.keys(UNIT_DOCTRINES).filter(n=>isUnitUnlocked(team,n))]); }
function restoreResearch(techs,legacy={},teams=[]) {
  researchedTechs={};researchedUnits={};
  for(const team of new Set([...teams,...Object.keys(techs||{}),...Object.keys(legacy||{})])){
    if(!/^(PLAYER|AI)\d*$/.test(team))continue;
    const known=new Set();
    const add=id=>{if(!Object.hasOwn(RESEARCH_TREE,id))return;const t=RESEARCH_TREE[id];if(known.has(id))return;t.requires.forEach(add);known.add(id);};
    // Missing ancestors are repaired for old unit unlocks and imported levels.
    if(Array.isArray(techs?.[team]))techs[team].forEach(add);
    else if(Array.isArray(legacy?.[team]))legacy[team].forEach(n=>add(UNIT_DOCTRINES[n]));
    researchedTechs[team]=known;refreshResearchMirror(team);
  }
}
function resetResearch(teams=[]) { restoreResearch({}, {}, teams);restoreResearchPoints();restoreActiveResearch(); }
function getResearchPath(team,id,seen=new Set()) {
  const t=Object.hasOwn(RESEARCH_TREE,id)?RESEARCH_TREE[id]:null;if(!t||hasTech(team,id)||seen.has(id))return [];
  seen.add(id);return [...t.requires.flatMap(p=>getResearchPath(team,p,seen)),id];
}
function getUnitResearchCost(team,name) { return getResearchPath(team,UNIT_DOCTRINES[name]).reduce((sum,id)=>sum+RESEARCH_TREE[id].cost,0); }

// A weighted destination chooses an army specialization; only the first legal
// prerequisite is purchased. No AI-only unlocks, discounts, or movement rules.
function aiDoctrineFocus(team) {
  const personality=diplomacy.personalities?.[team]||'BALANCED';
  if(personality==='DEFENSIVE')return 'defense';
  if(['TRADER','AGGRESSIVE','IDEOLOGICAL','ECONOMIC','CUNNING'].includes(personality))return 'engineering';
  return [...team].reduce((sum,c)=>sum+c.charCodeAt(0),0)%2?'defense':'engineering';
}
// Keep a stable battlefield specialization for the whole match. Mountain
// kingdoms favor Dragons because they can fly over the terrain that limits
// ordinary armies; other kingdoms split between Dragons and Catapults so the
// AI does not converge on siege weapons every game.
function aiPreferredHeavyUnit(team) {
  const name=String(team||'AI'),personality=diplomacy.personalities?.[team]||'BALANCED';
  let mountain=false;
  if(typeof Territory!=='undefined'&&typeof Territory.ownership==='function'&&Array.isArray(terrain)){
    const owners=Territory.ownership();
    mountain=owners.some((owner,i)=>owner===team&&terrain[i]==='MOUNTAIN');
  }
  if(!mountain&&Array.isArray(terrain)){
    const anchors=[];
    for(let i=0;i<(settlements?.length||0);i++)if(settlements[i]?.owner===team)anchors.push({col:i%COLS,row:Math.floor(i/COLS)});
    for(const u of units||[])if(u.team===team&&u.hp>0&&!u.ruins)anchors.push(u);
    mountain=anchors.some(a=>{
      for(let r=Math.max(0,a.row-2);r<=Math.min(ROWS-1,a.row+2);r++)for(let c=Math.max(0,a.col-2);c<=Math.min(COLS-1,a.col+2);c++)if(terrain[r*COLS+c]==='MOUNTAIN')return true;
      return false;
    });
  }
  if(mountain)return 'Dragon';
  const seed=[...name].reduce((sum,c)=>sum+c.charCodeAt(0),0);
  // A stable faction hash gives occasional Dragon specialists without making
  // every aggressive personality converge on the same research path.
  return seed%4===0?'Dragon':'Catapult';
}
function chooseAIResearch(team) {
  const foes=units.filter(u=>u.hp>0&&aiHostile(team,u.team)),army=units.filter(u=>u.hp>0&&u.team===team);
  const personality=diplomacy.personalities?.[team]||'BALANCED';
  const preferences={AGGRESSIVE:['cavalry_training','heavy_cavalry','volley_fire','forced_march'],DEFENSIVE:['fieldworks','garrison_training','healing_orders','stone_fortifications','battlefield_medicine','citadel_engineering'],TRADER:['engineering_corps','logistics','mass_production','forced_march'],IDEOLOGICAL:['forced_march','shadow_warfare','maneuver_warfare','dragon_corps'],BALANCED:['field_training','archery','healing_orders','logistics']};
  const focus=aiDoctrineFocus(team);
  const weights=new Map(Object.values(RESEARCH_TREE).map(t=>[t.id,5]));
  (preferences[personality]||preferences.BALANCED).forEach((id,i)=>weights.set(id,65-i*5));
  const prefer=(id,score)=>weights.set(id,Math.max(weights.get(id),score));
  if(foes.some(u=>u.name==='Knight'))prefer('spear_doctrine',170);
  if(foes.some(u=>u.name==='Dragon'))prefer('cavalry_training',180);
  if(foes.some(isFortressUnit))prefer('siege_engineering',175);
  if(army.filter(u=>u.hp<u.maxHp*.7).length>=2)prefer('healing_orders',125);
  if(army.some(u=>u.name==='Cleric')&&army.filter(u=>u.hp<u.maxHp*.7).length>=3)prefer('battlefield_medicine',115);
  if(army.some(u=>u.name==='Catapult')){
    prefer('siege_mobility',80);prefer('counterweight_engines',85);
    if(army.some(u=>u.name==='Catapult'&&u.hp<u.maxHp*.7))prefer('reinforced_carriages',90);
  }
  const heavyUnit=aiPreferredHeavyUnit(team);
  if(heavyUnit==='Dragon'){
    prefer('dragon_corps',178);prefer('maneuver_warfare',150);prefer('master_assassins',148);
  }else if(personality!=='DEFENSIVE'){
    prefer('siege_engineering',150);prefer('artillery',135);prefer('siege_mobility',125);
  }
  for(const tech of Object.values(RESEARCH_TREE))if(tech.branch===focus&&!hasTech(team,tech.id))prefer(tech.id,140);
  const target=[...weights].filter(([id])=>!hasTech(team,id)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];
  return getResearchPath(team,target)[0]||null;
}
function getEffectiveUnitCostForTeam(team,name) {
  const base=UNIT_TEMPLATES[name]?.cost??0,cost=typeof base==='number'?{gold:base,materials:0}:{...base};
  return {gold:Math.max(base===0?0:1,(cost.gold||0)-(hasTech(team,'logistics')?1:0)),materials:Math.max(0,(cost.materials||0)-(hasTech(team,'mass_production')?1:0))};
}
function getSettlementUpgradeCost(team,type) {
  const base=SETTLEMENTS[type]?.upgradeCost||{};
  return {gold:base.gold||0,materials:Math.max(0,(base.materials||0)-(hasTech(team,'engineering_corps')?1:0))};
}
function applyDoctrineEffect(unit,id) {
  const e=RESEARCH_TREE[id]?.effect;if(!e)return;
  if(e.units?.includes(unit.name)){
    unit.maxHp+=e.maxHp||0;unit.hp+=e.maxHp||0;
    unit.dmg+=e.dmg||0;unit.atkRange+=e.atkRange||0;unit.move+=e.move||0;
    if(e.moveFloor)unit.move=Math.max(unit.move,e.moveFloor);
  }
  if(e.moveFloors?.[unit.name])unit.move=Math.max(unit.move,e.moveFloors[unit.name]);
}
function getDoctrineUnitStats(team,name) {
  const t=UNIT_TEMPLATES[name];if(!t)return null;
  const u={name,maxHp:t.hp,hp:t.hp,dmg:t.dmg,move:t.move,atkRange:t.atkRange};
  for(const id of researchedTechs[team]||[])applyDoctrineEffect(u,id);
  return {...t,hp:u.maxHp,dmg:u.dmg,move:u.move,atkRange:u.atkRange,cost:getEffectiveUnitCostForTeam(team,name)};
}
function researchTech(team,id) {
  if(!canResearchTech(team,id)||!canMutateResearch())return false;
  if(typeof markScenarioPlaying==='function')markScenarioPlaying();
  researchPoints[team]=getResearchPoints(team)-RESEARCH_TREE[id].cost;
  return completeDoctrine(team,id);
}
function completeDoctrine(team,id) {
  if(hasTech(team,id))return false;
  if(activeResearch[team]?.id===id)delete activeResearch[team];
  (researchedTechs[team]??=new Set()).add(id);refreshResearchMirror(team);
  // Saved units already carry their stats. Apply only this new purchase, never
  // replay this loop during restoration. Promotions retain their existing bonuses.
  for(const u of typeof units==='undefined'?[]:units)if(u.team===team&&u.hp>0&&!u.rogue&&!u.ruins)applyDoctrineEffect(u,id);
  if(typeof AICommander!=='undefined')AICommander.invalidateRoutes();
  if(typeof BattleGuide!=='undefined'&&team===(typeof getLocalPlayableTeam==='function'?getLocalPlayableTeam():'PLAYER'))BattleGuide.notify(RESEARCH_TREE[id].name+' research completed.');
  refreshResearchState();
  return true;
}

// Resource utility functions
function getResources(team) {
  return resources[team] || { gold: 0, materials: 0 };
}

function hasResources(team, cost) {
  const teamRes = getResources(team);
  return (teamRes.gold >= (cost.gold || 0)) &&
         (teamRes.materials >= (cost.materials || 0));
}

function spendResources(team, cost) {
  if (!hasResources(team, cost)) return false;
  if(typeof markScenarioPlaying==='function')markScenarioPlaying();
  const teamRes = resources[team];
  teamRes.gold -= (cost.gold || 0);
  teamRes.materials -= (cost.materials || 0);
  return true;
}

function addResources(team, amount) {
  if (!resources[team]) {
    resources[team] = { gold: 0, materials: 0 };
  }
  resources[team].gold += (amount.gold || 0);
  resources[team].materials += (amount.materials || 0);
}

function getResourceTotal(teamOrResources) {
  const value = typeof teamOrResources === 'string' ? getResources(teamOrResources) : teamOrResources;
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return 0;
  return (value.gold || 0) + (value.materials || 0);
}

function getResourceValue(teamOrResources) {
  const value = typeof teamOrResources === 'string' ? getResources(teamOrResources) : teamOrResources;
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return 0;
  return (value.gold || 0) * 1.4 + (value.materials || 0) * 1.8;
}

function getGold(team) {
  const teamRes = getResources(team);
  return typeof teamRes === 'number' ? teamRes : (teamRes.gold || 0);
}

function canAfford(team, cost) {
  if (!resources[team]) return false;
  
  const effectiveCost = getEffectiveCost(cost);
  
  // Handle single cost (legacy land units) - use gold
  if (typeof effectiveCost === 'number') {
    return resources[team].gold >= effectiveCost;
  }
  
  // Handle two-resource cost (naval units and new system)
  if (typeof effectiveCost === 'object') {
    return (resources[team].gold >= (effectiveCost.gold || 0)) &&
           (resources[team].materials >= (effectiveCost.materials || 0));
  }
  
  return false;
}

function deductResources(team, cost) {
  if(typeof markScenarioPlaying==='function')markScenarioPlaying();
  if (!resources[team]) {
    resources[team] = { gold: 0, materials: 0 };
  }
  
  const effectiveCost = getEffectiveCost(cost);
  
  // Handle single cost (legacy land units) - deduct from gold
  if (typeof effectiveCost === 'number') {
    resources[team].gold -= effectiveCost;
    return;
  }
  
  // Handle two-resource cost
  if (typeof effectiveCost === 'object') {
    resources[team].gold -= (effectiveCost.gold || 0);
    resources[team].materials -= (effectiveCost.materials || 0);
  }
}

function hasFarmsOnMap() {
  if (!terrain) return false;
  return terrain.some(t => t === 'FARM');
}

function getEffectiveCost(unitCost) {
  return typeof unitCost==='object' ? {gold:unitCost.gold||0,materials:unitCost.materials||0} : unitCost;
}

function formatCost(cost) {
  const effectiveCost = getEffectiveCost(cost);
  
  // Handle single cost (legacy land units)
  if (typeof effectiveCost === 'number') {
    return `${effectiveCost}G`;
  }
  
  // Handle two-resource cost
  if (typeof effectiveCost === 'object') {
    const parts = [];
    if (effectiveCost.gold > 0) parts.push(`${effectiveCost.gold}G`);
    if (effectiveCost.materials > 0) parts.push(`${effectiveCost.materials}M`);
    return parts.join('/') || '0';
  }
  
  return '0';
}

// Research system functions
function hasResearched(team, unitType) {
  return isUnitUnlocked(team,unitType);
}

function canResearch(team, unitType) {
  return canResearchTech(team,getResearchPath(team,UNIT_DOCTRINES[unitType])[0]);
}

function researchUnit(team, unitType) {
  return researchTech(team,getResearchPath(team,UNIT_DOCTRINES[unitType])[0]);
}

function getResearchableUnits(team) {
  return Object.keys(RESEARCH_COSTS).filter(unitType => !hasResearched(team, unitType));
}

// Every new battle and replay starts with an empty treasury.
function resetStartingEconomy() {
  if(typeof Territory!=='undefined')Territory.reset();
  const empty = () => Object.fromEntries(getActiveTeams().map(team => [team, {gold:0, materials:0}]));
  resources = empty();
  startingResources = empty();
}

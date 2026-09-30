const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console:{log(){},debug(){},warn(...args){throw Error(args.join(' '));},error(...args){throw Error(args.join(' '));}},Math,setTimeout(){},isFortressUnit:u=>['Stockade','Castle','Heavy Fortress','Fortress'].includes(u.name),campaignMode:{active:false,campaignData:{}},units:[]};
vm.createContext(c);
for(const f of ['js/data/units-and-build.js','js/core/level-state.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const pools=vm.runInContext('VETERAN_NAMES',c);
for(const type of Object.keys(pools))for(const team of ['PLAYER','AI']){
 const u=c.makeUnit(type,team,0,0,{id:`${team}-${type}`});
 assert.equal(u.personalName,undefined);assert.equal(c.getUnitDisplayName(u),type);
 const base={hp:u.hp,dmg:u.dmg,move:u.move};
 c.awardExperience(u,15);assert.equal(u.promotionLevel,1);assert(pools[type].includes(u.personalName));
 const name=u.personalName;assert.equal(c.getUnitDisplayName(u),`Private ${name} the ${type}`);
 assert.equal(u.hp,base.hp+8);assert.equal(u.dmg,type==='Crown'?0:base.dmg+2);
 c.promoteUnit(u);c.promoteUnit(u);assert.equal(u.personalName,name);assert.equal(c.getUnitDisplayName(u),`Sergeant ${name} the ${type}`);
 c.units=[u];const saved=JSON.parse(JSON.stringify(c.serializeUnits()))[0];
 const loaded=c.makeUnit(saved.name,saved.team,saved.col,saved.row,saved);
 assert.equal(loaded.personalName,name);assert.equal(loaded.hp,u.hp);assert.equal(loaded.dmg,u.dmg);assert.equal(loaded.promotionLevel,3);
 c.promoteUnit(loaded);assert.equal(loaded.personalName,name);
 const legacy={...saved};delete legacy.personalName;
 const a=c.makeUnit(type,team,0,0,legacy),b=c.makeUnit(type,team,0,0,legacy);assert.equal(a.personalName,b.personalName);
 assert.equal(c.makeUnit(type,team,0,0,{personalName:name}).personalName,undefined,'recruits stay unnamed');
}
c.campaignMode.active=true;
assert.equal(c.makeUnit('Knight','AI',2,4,{promotionLevel:1}).personalName,c.makeUnit('Knight','AI',2,4,{promotionLevel:1}).personalName,'legacy saves without IDs migrate consistently');
const veteran=c.makeUnit('Knight','PLAYER',0,0,{id:'recurring-knight'});c.promoteUnit(veteran);const remembered=veteran.personalName;
c.campaignMode.campaignData=JSON.parse(JSON.stringify(c.campaignMode.campaignData));
const later=c.makeUnit('Knight','PLAYER',3,5,{id:'recurring-knight',promotionLevel:2});assert.equal(later.personalName,remembered);
assert.equal(c.makeUnit('Knight','PLAYER',3,5,{id:'new-knight'}).personalName,undefined);
console.log('All unit pools, player/AI promotion, unchanged stats, save roundtrips, legacy migration and recurring campaign identity pass.');
// Exercise the legacy hub's actual serializer and rehydration handler.
const handlers={};let packet;
Object.assign(c,{URLSearchParams,window:{location:{search:'?gameId=test'},parent:{postMessage(p){packet=JSON.parse(JSON.stringify(p));}},addEventListener(k,v){handlers[k]=v;}},document:{addEventListener(){}},setInterval(){},opponentType:'HUMAN',gameId:'test',localClientId:'sender',currentTeam:'PLAYER',resources:{},diplomacy:{},currentVictoryCondition:{},gameOver:false,terrain:[],settlements:[],lastSnapshotTs:0,COLS:8,ROWS:8,validateGameStateMessage:()=>true,normalizeVictoryCondition:x=>x,updateUI(){}});
vm.runInContext(fs.readFileSync('js/net/multiplayer-sync.js','utf8'),c);
c.units=[later];c.postGameState();assert.equal(packet.units[0].personalName,remembered);
c.localClientId='receiver';handlers.message({data:packet});assert.equal(c.units[0].personalName,remembered);assert.equal(c.units[0].promotionLevel,2);assert.equal(c.units[0].dmg,later.dmg);
console.log('Legacy multiplayer roundtrip retains the veteran name, rank and stats.');

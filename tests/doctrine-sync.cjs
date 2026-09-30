const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {client,tick}=require('./multiplayer-harness.cjs');
const host=client('Host'),guest=client('Guest');
for(const p of [host,guest])for(const f of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js'])vm.runInContext(fs.readFileSync(f,'utf8'),p.ctx);
for(const p of [host,guest]){p.ctx.normalizeVictoryCondition=x=>x;p.ctx.closeSpawnMenu=()=>{};}
host.el('lobbyCapacity').value='2';host.el('menuOnlineBtn').onclick();host.el('lobbyCreate').onclick();tick();guest.run(`OnlineMatch.join('${host.el('lobbyRoom').textContent}')`);tick();host.el('lobbyReady').onclick();guest.el('lobbyReady').onclick();tick();host.el('lobbyStart').onclick();tick();
const actor=host.ctx.currentTeam==='PLAYER'?host:guest,team=actor.ctx.currentTeam;
actor.run(`resources.${team}.gold=100;restoreResearchPoints({'${team}':20});researchTech('${team}','field_training');researchTech('${team}','forced_march');researchTech('${team}','engineering_corps');researchTech('${team}','logistics');OnlineMatch.publish()`);tick();
for(const p of [host,guest]){
 assert(p.run(`hasTech('${team}','forced_march')`));assert.equal(p.run(`getGold('${team}')`),100);assert.equal(p.run(`getResearchPoints('${team}')`),10);
 assert(p.run(`units.filter(u=>u.team==='${team}'&&u.name==='Soldier').every(u=>u.move===4&&u.maxHp===60)`));
 assert.equal(p.run(`makeUnit('Soldier','${team}',0,0).move`),4);
 assert.equal(p.run(`getEffectiveUnitCostForTeam('${team}','Soldier').gold`),1);
}
const before=host.run('JSON.stringify(units)');for(let i=0;i<3;i++){actor.run('OnlineMatch.publish()');tick();assert.equal(host.run('JSON.stringify(units)'),before,'sync never reapplies bonuses');}
const observer=actor===host?guest:host;
assert.equal(observer.run("awardResearchPoints('PLAYER',3)"),false,'non-acting client cannot award');
actor.run(`awardResearchPoints('${team}',3,'Heavy Fortress destroyed');settlements.find(Boolean).researchCaptureTeams=['${team}'];OnlineMatch.publish()`);tick();
for(let i=0;i<3;i++){
 actor.run('OnlineMatch.publish()');tick();
 for(const p of [host,guest]){assert.equal(p.run(`getResearchPoints('${team}')`),13,'incoming snapshot does not duplicate awards');assert(p.run(`settlements.find(Boolean).researchCaptureTeams.includes('${team}')`));}
}
actor.run(`startDoctrineResearch('${team}','spear_doctrine');advanceDoctrineResearch('${team}');OnlineMatch.publish()`);tick();
for(const p of [host,guest]){assert.equal(p.run(`activeResearch['${team}'].id`),'spear_doctrine');assert.equal(p.run(`activeResearch['${team}'].progress`),1);}
actor.run('OnlineMatch.publish()');tick();assert.equal(observer.run(`activeResearch['${team}'].progress`),1);
host.el('lobbyLeave').onclick();tick();console.log('Doctrines, upgraded unit stats and discounted future spawns survive repeated multiplayer synchronization.');

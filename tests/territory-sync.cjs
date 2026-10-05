const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {client,tick}=require('./multiplayer-harness.cjs');
const host=client('Host'),guest=client('Guest');
for(const p of [host,guest])for(const f of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js','js/systems/territory.js'])vm.runInContext(fs.readFileSync(f,'utf8'),p.ctx);
for(const p of [host,guest]){p.ctx.normalizeVictoryCondition=x=>x;p.ctx.closeSpawnMenu=()=>{};}
host.el('lobbyCapacity').value='2';host.el('menuOnlineBtn').onclick();host.el('lobbyCreate').onclick();tick();guest.run(`OnlineMatch.join('${host.el('lobbyRoom').textContent}')`);tick();host.el('lobbyReady').onclick();guest.el('lobbyReady').onclick();tick();host.el('lobbyStart').onclick();tick();
const actor=host.ctx.currentTeam==='PLAYER'?host:guest,team=actor.ctx.currentTeam;
actor.run(`
const i=terrain.findIndex((t,i)=>t!=='VOID'&&!units.some(u=>u.row*COLS+u.col===i));
units.push(makeUnit('Castle',null,i%COLS,Math.floor(i/COLS),{id:'ruin-test',ruins:true,hp:1}));
const j=terrain.findIndex((t,i)=>t!=='VOID'&&!units.some(u=>u.row*COLS+u.col===i));
units.push(makeUnit('Dragon','${team}',j%COLS,Math.floor(j/COLS),{id:'rogue-test',rogue:true}));
Territory.march(units.find(u=>u.team==='${team}'&&!u.rogue),[{col:1,row:1}]);
diplomacy.leaders={AI:'farid'};OnlineMatch.publish();`);tick();
for(let n=0;n<3;n++){
 actor.run('OnlineMatch.publish()');tick();
 for(const p of [host,guest]){assert(p.run("units.find(u=>u.id==='rogue-test').rogue"));assert(p.run("units.find(u=>u.id==='ruin-test').ruins"));assert.equal(p.run("units.find(u=>u.id==='ruin-test').team"),null);assert.equal(p.run('Territory.snapshot().claims[COLS+1]'),team);assert.equal(p.ctx.diplomacy.leaders.AI,'farid');}
}
host.el('lobbyLeave').onclick();tick();console.log('Territory, rogue Dragons, neutral ruins and leader selections survive repeated real host/guest synchronization.');

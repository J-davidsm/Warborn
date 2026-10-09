const assert=require('node:assert/strict'),{client,tick,peers}=require('./multiplayer-harness.cjs');
const players=Array.from({length:4},(_,i)=>client('Player '+i,false,undefined,true,true)),h=players[0];
for(const p of players)p.ctx.UNIT_TEMPLATES.Catapult={};
let now=Date.now();for(const p of players)p.ctx.Date=class extends Date{static now(){return now;}};
h.el('lobbyCapacity').value='4';h.el('lobbyCreate').onclick();tick();
for(const g of players.slice(1)){g.run(`OnlineMatch.join('${h.el('lobbyRoom').textContent}')`);tick();}
players.forEach(p=>p.el('lobbyReady').onclick());tick();assert(h.el('lobbyStart').disabled);
h.run('OnlineMatch.generateBattle()');tick();players.forEach(p=>p.el('lobbyReady').onclick());tick();assert(!h.el('lobbyStart').disabled);
const old=h.run('OnlineMatch.generation.revision');
players[1].run("OnlineMatch.changeSettings({...OnlineMatch.generation.settings,size:12,terrain:'MOUNTAIN',army:{Dragon:2,Catapult:2,Soldier:3}})");tick();
assert.equal(h.run('OnlineMatch.generation.settings.size'),16,'suggestion does not replace host settings');
h.run('OnlineMatch.acceptSuggestion()');tick();assert(h.el('lobbyStart').disabled);assert(players.every(p=>p.run('OnlineMatch.generation.settings.size')===12));
peers[1].conn.send({protocol:2,type:'ready',ready:true,settingsRevision:old});tick();assert(h.el('lobbyStart').disabled,'stale agreement rejected');
h.run('OnlineMatch.generateBattle()');tick();players.forEach(p=>p.el('lobbyReady').onclick());tick();h.el('lobbyStart').onclick();tick();
assert(players.every(p=>p.run('OnlineMatch.playing')&&p.ctx.COLS===12&&p.ctx.units.length===28));
const current=h.ctx.currentTeam;now+=119000;h.intervals.at(-1)();tick();assert.equal(h.ctx.currentTeam,current);
now+=1001;h.intervals.at(-1)();tick();assert.notEqual(h.ctx.currentTeam,current);assert(players.every(p=>p.ctx.currentTeam===h.ctx.currentTeam));
const next=h.ctx.currentTeam;h.intervals.at(-1)();tick();assert.equal(h.ctx.currentTeam,next,'expiry advances exactly once');
// Disconnect freezes remaining time, including a long wait and rejoin.
now+=20000;peers[1].conn.close();tick();now+=300000;h.intervals.at(-1)();assert.equal(h.ctx.currentTeam,next);
players[1].timers.findLast(t=>t.delay===2000).fn();tick();now+=99000;h.intervals.at(-1)();tick();assert.equal(h.ctx.currentTeam,next);
now+=1001;h.intervals.at(-1)();tick();assert.notEqual(h.ctx.currentTeam,next);
console.log('Shared suggestions, host acceptance, stale-agreement rejection, generated 4-player start and timed/disconnected turns pass.');

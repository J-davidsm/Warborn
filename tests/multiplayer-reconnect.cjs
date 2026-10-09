const assert=require('node:assert/strict');
const {client,tick,peers}=require('./multiplayer-harness.cjs');
const h=client('Host'),guests=[client('Two'),client('Three'),client('Four')];
h.el('lobbyCapacity').value='4';h.el('lobbyCreate').onclick();tick();
const code=h.el('lobbyRoom').textContent;
for(const g of guests){g.run(`OnlineMatch.join('${code}')`);tick();}
for(const c of [h,...guests])c.el('lobbyReady').onclick();tick();h.el('lobbyStart').onclick();tick();
const original=JSON.stringify(h.ctx.units);
const retry=g=>{const timer=g.timers.findLast(t=>t.delay===2000);assert(timer,'reconnect scheduled');timer.fn();tick();};
const verify=()=>{for(const c of [h,...guests]){assert(c.run('OnlineMatch.playing'));assert(c.el('onlineLobby').hidden);assert.equal(JSON.stringify(c.ctx.units),JSON.stringify(h.ctx.units));assert.equal(c.run('OnlineMatch.canAct()'),c.ctx.currentTeam===c.run('OnlineMatch.localTeam'));}};
// Reproduce staggered drops: every seat must recover without restarting.
for(let i=0;i<guests.length;i++){
 const g=guests[i],team=g.run('OnlineMatch.localTeam');peers[i+1].conn.close();tick();
 assert(!h.run('OnlineMatch.canAct()'));assert(!h.el('onlineLobby').hidden);
 retry(g);assert.equal(g.run('OnlineMatch.localTeam'),team);verify();
}
assert.equal(JSON.stringify(h.ctx.units),original,'disconnect never regenerates map or army');
// Two missing players: the first rejoin must not prematurely resume the room.
peers[1].conn.close();peers[2].conn.close();tick();retry(guests[0]);assert(!h.el('onlineLobby').hidden);retry(guests[1]);verify();
// Signaling loss with healthy channels does not eject anyone.
for(const p of peers.slice(0,4)){p.emit('error',{type:'socket-closed'});p.emit('disconnected');}tick();verify();
// A stranger cannot claim a reserved player seat during a battle.
const stranger=client('Intruder');stranger.run(`OnlineMatch.join('${code}')`);tick();assert(!stranger.run('OnlineMatch.playing'));assert.match(stranger.el('lobbyStatus').textContent,/full/);verify();
// A delayed callback on a superseded channel cannot disconnect the new one.
peers[1].connections[0].emit('close');tick();verify();
// Real update after reconnect still follows the original authority and revision.
const actor=[h,...guests].find(c=>c.run('OnlineMatch.canAct()'));
actor.ctx.units[0].hp-=3;actor.run('OnlineMatch.publish()');tick();verify();
// Keepalive runs on idle channels and receives replies without publishing turns.
for(const c of [h,...guests])c.intervals[0]();tick();verify();
assert(peers[1].conn.sent.some(m=>m.type==='ping'));
assert(peers[1].conn.sent.some(m=>m.type==='pong'));
// Run fifteen minutes of idle connection checks using a deterministic clock.
let now=Date.now();for(const c of [h,...guests])c.ctx.Date=class extends Date{static now(){return now;}};
for(let i=0;i<60;i++){now+=15000;for(const c of [h,...guests]){c.intervals[0]();c.intervals.at(-1)();}tick();verify();}
// A sleeping local browser must not evict all its healthy remote peers on wake.
now+=360000;for(const c of [h,...guests]){c.intervals[0]();c.intervals.at(-1)();}tick();verify();
// Detect a silently dead channel, then recover the same seat and game.
peers[1].conn.send=()=>{};
for(let i=0;i<8;i++){now+=15000;h.intervals[0]();tick();}
assert(!h.el('onlineLobby').hidden);retry(guests[0]);verify();
console.log('Four-player staggered and simultaneous reconnects preserve seats, state, turn authority; strangers rejected; signaling loss and idle keepalives safe.');
// A refreshed guest page can reclaim its credential-protected seat.
const token=peers[1].conn.other.metadata.sessionToken;peers[1].destroy();tick();
const refreshed=client('Refreshed');refreshed.ctx.sessionStorage={getItem:()=>token,setItem(){}};
refreshed.run(`OnlineMatch.join('${code}')`);tick();
assert(refreshed.run('OnlineMatch.playing'));assert.equal(refreshed.run('OnlineMatch.localTeam'),'PLAYER2');
assert.equal(JSON.stringify(refreshed.ctx.units),JSON.stringify(h.ctx.units));assert(h.el('onlineLobby').hidden);
// Cooperative reconnection restores the same wave and host-only AI authority.
const coopIndex=peers.length,ch=client('Coop host',true),cg=client('Coop guest',true);
ch.el('lobbyMode').value='coop';ch.el('lobbyCreate').onclick();tick();cg.run(`OnlineMatch.join('${ch.el('lobbyRoom').textContent}')`);tick();
ch.el('lobbyReady').onclick();cg.el('lobbyReady').onclick();tick();ch.el('lobbyStart').onclick();tick();
ch.ctx.currentTeam='AI';ch.ctx.currentTurnIndex=2;ch.run('OnlineMatch.publish()');tick();
const wave=ch.run('Endless.wave');peers[coopIndex+1].conn.close();tick();assert(!ch.run('OnlineMatch.canRunAI()'));
retry(cg);assert(ch.run('OnlineMatch.canRunAI()'));assert(!cg.run('OnlineMatch.canRunAI()'));
assert.equal(cg.run('Endless.wave'),wave);assert.equal(JSON.stringify(ch.ctx.units),JSON.stringify(cg.ctx.units));
console.log('Guest refresh restores its reserved seat; cooperative reconnect preserves wave and host-only AI.');
// Browser reload/discard recovery: checkpoint the authority as well as the seat.
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const hs=storage(),gs=storage(),base=peers.length;
let rh=client('Persistent host',false,hs),rg=client('Persistent guest',false,gs);
rh.el('lobbyCreate').onclick();tick();const room=rh.el('lobbyRoom').textContent;rg.run(`OnlineMatch.join('${room}')`);tick();
rh.el('lobbyReady').onclick();rg.el('lobbyReady').onclick();tick();rh.el('lobbyStart').onclick();tick();
const checkpoint=JSON.stringify(rh.ctx.units),savedTurn=rh.ctx.currentTeam;
peers[base].destroy();tick();rh=client('Persistent host',false,hs);tick();retry(rg);
assert(rh.run('OnlineMatch.playing'));assert(rh.el('onlineLobby').hidden);assert(rg.el('onlineLobby').hidden);
assert.equal(JSON.stringify(rh.ctx.units),checkpoint);assert.equal(rh.ctx.currentTeam,savedTurn);
peers[base+1].destroy();tick();rg=client('Persistent guest',false,gs,false);assert(!rg.run('OnlineMatch.playing'),'reload waits for canvas setup');rg.handlers['warborn:ready']();tick();
assert(rg.run('OnlineMatch.playing'));assert(rg.el('onlineLobby').hidden);assert.equal(rg.run('OnlineMatch.localTeam'),'PLAYER2');assert.equal(JSON.stringify(rg.ctx.units),checkpoint);
assert.equal(rg.el('lobbyRoom').textContent,room);
rh.el('onlineReturnLobby').onclick();tick();assert.equal(hs.getItem('warborn.online-session.v1'),null);assert.equal(gs.getItem('warborn.online-session.v1'),null);
console.log('Host and guest browser reloads automatically restore the existing battle; explicit return clears automatic recovery.');

const assert=require('node:assert/strict');const {client,tick}=require('./multiplayer-harness.cjs');
const h=client('Host'),g=client('Guest');h.el('lobbyCreate').onclick();tick();g.run(`OnlineMatch.join('${h.el('lobbyRoom').textContent}')`);tick();h.el('lobbyReady').onclick();g.el('lobbyReady').onclick();tick();h.el('lobbyStart').onclick();tick();
// Ensure the host owns the turn, then hand it to the guest while their page is hidden.
if(h.ctx.currentTeam!=='PLAYER'){g.ctx.currentTeam='PLAYER';g.ctx.currentTurnIndex=g.ctx.turnOrder.indexOf('PLAYER');g.run('OnlineMatch.publish()');tick();}
g.ctx.document.hidden=true;g.handlers.visibilitychange();
h.ctx.units.filter(u=>u.team==='PLAYER2').forEach(u=>{u.hasMoved=false;u.hasActed=false;});h.ctx.currentTeam='PLAYER2';h.ctx.currentTurnIndex=h.ctx.turnOrder.indexOf('PLAYER2');h.run('OnlineMatch.publish()');tick();
// Simulate stale client flags after throttling; resume must fetch authority, not guess resets.
g.ctx.units.filter(u=>u.team==='PLAYER2').forEach(u=>{u.hasMoved=true;u.hasActed=true;});g.ctx.document.hidden=false;g.handlers.visibilitychange();tick();
assert(g.run('OnlineMatch.canAct()'));assert(g.ctx.units.filter(u=>u.team==='PLAYER2').every(u=>!u.hasMoved&&!u.hasActed));
// A unit already spent on the host must stay spent; waking cannot grant extra actions.
h.ctx.units.find(u=>u.team==='PLAYER2').hasMoved=true;g.handlers.visibilitychange();tick();assert(!g.ctx.units.find(u=>u.team==='PLAYER2').hasMoved,'resume uses accepted state, not unsent host mutations');
console.log('Hidden-tab turn handoff restores the latest authoritative movement and attack flags.');

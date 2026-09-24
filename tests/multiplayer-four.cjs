const assert=require('node:assert/strict');
const {client,tick,peers}=require('./multiplayer-harness.cjs');
for(const count of [3,4]){
 const players=Array.from({length:count},(_,i)=>client('Commander '+(i+1))),h=players[0];
 h.el('lobbyCapacity').value=String(count);h.el('menuOnlineBtn').onclick();h.el('lobbyCreate').onclick();tick();
 for(const g of players.slice(1)){g.run(`OnlineMatch.join('${h.el('lobbyRoom').textContent}')`);tick();}
 assert.equal(h.el('lobbyPlayers').children.length,count);
 players.forEach(p=>p.el('lobbyReady').onclick());tick();assert(!h.el('lobbyStart').disabled);h.el('lobbyStart').onclick();tick();
 for(const p of players){assert(p.run('OnlineMatch.playing'));assert.equal(p.ctx.units.length,count*5);assert.equal(p.ctx.COLS,21);}
 // Signaling reconnection must retain established game connections.
 const connections=peers.map(p=>p.connections.length);
 peers.filter(p=>!p.destroyed).forEach(p=>p.emit('open',p.id));tick();
 assert.deepEqual(peers.map(p=>p.connections.length),connections);
 assert(players.every(p=>p.run('OnlineMatch.playing')));
 for(let step=0;step<count*2;step++){
  const actor=players.find(p=>p.run('OnlineMatch.localTeam')===h.ctx.currentTeam);
  assert(actor.run('OnlineMatch.canAct()'));
  for(const p of players)if(p!==actor)assert(!p.run('OnlineMatch.canAct()'));
  const id=actor.ctx.units[0].id;actor.ctx.units[0].hp--;
  actor.run(`ActionEffects.receive([{id:'hit-${count}-${step}',type:'damage',col:1,row:1,amount:1}]);OnlineMatch.publish()`);tick();
  for(const p of players){assert.equal(p.ctx.units.find(u=>u.id===id).hp,actor.ctx.units[0].hp);assert.equal(p.ctx.window.damagePopups.at(-1).text,'-1');}
  actor.ctx.currentTurnIndex=(actor.ctx.currentTurnIndex+1)%count;actor.ctx.currentTeam=actor.ctx.turnOrder[actor.ctx.currentTurnIndex];actor.run('OnlineMatch.publish()');tick();
  assert(players.every(p=>p.ctx.currentTeam===actor.ctx.currentTeam));
 }
 // A fifth visitor cannot occupy a full four-player room (same check for three).
 const extra=client('Extra');extra.run(`OnlineMatch.join('${h.el('lobbyRoom').textContent}')`);tick();assert.match(extra.el('lobbyStatus').textContent,/full/);
 // Last surviving kingdom gets victory on its own device and defeat everywhere else.
 const winner=players.find(p=>p.run('OnlineMatch.localTeam')===h.ctx.currentTeam);
 for(const p of players)p.ctx.showEndScreen=result=>{p.result=result;};
 winner.ctx.units=winner.ctx.units.filter(u=>u.team===winner.ctx.currentTeam);
 winner.ctx.settlements=winner.ctx.settlements.map(s=>s?.owner===winner.ctx.currentTeam?s:null);
 winner.run('OnlineMatch.finish();OnlineMatch.publish()');tick();
 for(const p of players){assert(p.ctx.gameOver);assert.equal(p.result.outcome,p===winner?'victory':'defeat');}
 // A departing guest pauses every client, rather than advancing without them.
 const lastGuest=peers.find(p=>p.conn&&p.id!==peers.at(-1).id&&p.conn.peer==='warborn-v2-'+h.el('lobbyRoom').textContent);
 lastGuest.conn.close();tick();assert(players.every(p=>!p.run('OnlineMatch.canAct()')));
 h.el('onlineReturnLobby').onclick();tick();assert(!h.run('OnlineMatch.playing'));assert(h.el('lobbyStart').disabled);
}
console.log('3- and 4-player slots, full-room rejection, all-player state/effect sync, turn ownership and disconnect pause pass.');

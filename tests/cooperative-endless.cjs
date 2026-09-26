const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {client,tick,peers}=require('./multiplayer-harness.cjs');
for(const count of [2,3,4])for(const difficulty of ['easy','medium','hard','impossible']){
 const ps=Array.from({length:count},(_,i)=>client('Ally '+i,true)),h=ps[0];
 h.el('lobbyCapacity').value=String(count);h.el('lobbyMode').value='coop';h.el('lobbyDifficulty').value=difficulty;
 h.el('menuOnlineBtn').onclick();h.el('lobbyCreate').onclick();tick();
 for(const g of ps.slice(1)){g.run(`OnlineMatch.join('${h.el('lobbyRoom').textContent}')`);tick();}
 ps.forEach(p=>p.el('lobbyReady').onclick());tick();h.el('lobbyStart').onclick();tick();
 for(const p of ps){
  assert(p.run('OnlineMatch.coop && Endless.active'));assert.equal(p.ctx.COLS,8*count+2);assert.equal(p.ctx.ROWS,20);
  assert.equal(p.el('lobbyMode').value,'coop');assert.equal(p.el('lobbyDifficulty').value,difficulty);
  assert.equal(p.run('Endless.difficulty'),difficulty);assert.equal(p.ctx.turnOrder.length,count+1);
  assert.equal(p.ctx.units.filter(u=>u.team==='AI'&&u.row===0).length,count*({easy:1,medium:1,hard:2,impossible:3}[difficulty]));
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(units)')),JSON.parse(h.run('JSON.stringify(units)')));
  for(const t of p.run('Endless.players')){assert.equal(p.ctx.resources[t].gold,0);assert.equal(p.ctx.resources[t].materials,0);assert.equal(p.ctx.units.filter(u=>u.team===t).length,difficulty==='easy'?6:5);assert(p.ctx.settlements.some(s=>s?.owner===t));}
  vm.runInContext(fs.readFileSync('js/systems/diplomacy.js','utf8'),p.ctx);
  assert(p.run("areFriendlyTeams('PLAYER','PLAYER2')"));assert(!p.run("canAttack('PLAYER','PLAYER2')"));assert(p.run("canAttack('AI','PLAYER2')"));
 }
 // Each human hands off once, AI only runs on the host after the final player.
 for(let i=0;i<count;i++){
  const actor=ps[i];assert(actor.run('OnlineMatch.canAct()'));
  actor.ctx.currentTurnIndex++;actor.ctx.currentTeam=actor.ctx.turnOrder[actor.ctx.currentTurnIndex];actor.run('OnlineMatch.publish()');tick();
  assert.equal(h.run('Endless.wave'),1);
 }
 assert.equal(h.ctx.currentTeam,'AI');assert(h.run('OnlineMatch.canRunAI()'));
 assert(ps.slice(1).every(p=>!p.run('OnlineMatch.canRunAI()')));
 h.timers.filter(t=>t.delay===300).forEach(t=>t.fn());assert.equal(h.ctx.aiRuns,1);
 // AI effects and movement replicate, then host scrolls exactly once at the round boundary.
 h.ctx.units.find(u=>u.team==='AI').row++;
 h.run("ActionEffects.receive([{id:'coop-hit',type:'damage',col:2,row:2,amount:7}]);OnlineMatch.publish()");tick();
 assert(ps.every(p=>p.ctx.window.damagePopups.at(-1).text==='-7'));
 h.ctx.currentTeam='PLAYER';h.ctx.currentTurnIndex=0;h.ctx.turnNumber=2;h.run('Endless.advance();Endless.advance();OnlineMatch.publish()');tick();
 for(const p of ps){assert.equal(p.run('Endless.wave'),2);assert.equal(p.ctx.turnNumber,2);assert.deepEqual(JSON.parse(p.run('JSON.stringify(terrain)')),JSON.parse(h.run('JSON.stringify(terrain)')));}
 // Clients cannot introduce a wave/map shift.
 const guest=ps[1];guest.ctx.turnNumber=3;guest.run('Endless.advance()');assert.equal(guest.run('Endless.wave'),2);guest.ctx.turnNumber=2;
 // Losing one kingdom doesn't end the cooperative game.
 for(const p of ps){p.ctx.units=p.ctx.units.filter(u=>u.team!=='PLAYER2');p.ctx.settlements=p.ctx.settlements.map(s=>s?.owner==='PLAYER2'?null:s);p.run('Endless.check();OnlineMatch.finish()');assert(!p.ctx.gameOver);}
 // One enemy at the back defeats everybody, with the same explanation.
 ps.forEach(p=>p.ctx.showEndScreen=r=>p.result=r);
 h.ctx.units.find(u=>u.team==='AI').row=19;h.run('Endless.check();OnlineMatch.publish()');tick();
 for(const p of ps){assert(p.ctx.gameOver);assert.equal(p.result.outcome,'defeat');assert.match(p.result.explanation,/back edge/);}
 h.el('onlineReturnLobby').onclick();tick();assert(ps.every(p=>!p.run('Endless.active || OnlineMatch.playing')));
 h.el('lobbyLeave').onclick();tick();
}
console.log('Co-op 2/3/4 players × all difficulties: equal armies, zero resources, scaling, alliances, host AI, shared waves/effects/defeat and lobby cleanup pass.');

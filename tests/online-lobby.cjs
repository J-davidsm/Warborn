const assert=require('node:assert/strict');
const {client,tick,peers}=require('./multiplayer-harness.cjs');
const h=client('Host'),g=client('Guest');h.el('menuOnlineBtn').onclick();h.el('lobbyCreate').onclick();tick();
g.el('lobbyCode').value=h.el('lobbyRoom').textContent;g.el('menuOnlineBtn').onclick();g.el('lobbyJoin').onclick();tick();
assert.equal(h.el('lobbyPlayers').children.length,2);assert.equal(h.el('lobbyStart').disabled,true);
h.el('lobbyReady').onclick();tick();assert.equal(h.el('lobbyStart').disabled,true);g.el('lobbyReady').onclick();tick();assert.equal(h.el('lobbyStart').disabled,false);
h.el('lobbyStart').onclick();tick();assert.equal(g.run('OnlineMatch.playing'),true);
const equal=()=>assert.equal(JSON.stringify(h.ctx.units),JSON.stringify(g.ctx.units));equal();assert.equal(g.ctx.units[0].promotionLevel,2);
assert.deepEqual(h.ctx.resources.PLAYER,{gold:0,materials:0});assert.deepEqual(h.ctx.resources.PLAYER2,{gold:0,materials:0});
assert.match(h.el('onlineMatchStatus').textContent,/Highlands|Desert Expanse|Island Chain|Ancient Forest|Flooded Marsh|Open Frontier/);
let current=h.ctx.currentTeam==='PLAYER'?h:g,other=current===h?g:h;
function checkEffects(actor,observer,tag) {
 actor.run(`ActionEffects.receive([{id:'move-${tag}',type:'move',unitId:'p1-0',path:[{col:2,row:7},{col:3,row:7},{col:3,row:8}]},{id:'damage-${tag}',type:'damage',col:4,row:4,amount:23}]);OnlineMatch.publish()`);tick();
 assert.equal(observer.ctx.window.damagePopups.at(-1).text,'-23');
 assert.equal(observer.run("ActionEffects.position({id:'p1-0',col:3,row:8},p=>({x:p.col,y:p.row}),75).x"),2.5);
 const count=actor.ctx.window.damagePopups.length;actor.run('OnlineMatch.publish()');tick();assert.equal(actor.ctx.window.damagePopups.length,count);assert.equal(observer.ctx.window.damagePopups.length,count);
}
checkEffects(current,other,'first');
assert.equal(other.run('OnlineMatch.canAct()'),false);current.ctx.units[0].experience=38;current.ctx.units[0].hp=47;current.run('OnlineMatch.publish()');tick();equal();assert.equal(other.ctx.units[0].experience,38);
// Older host revisions cannot overwrite newer guest state.
const hostConn=peers[1].conn.other;
const startState=hostConn.sent.find(m=>m.type==='start').state;
hostConn.send({protocol:2,type:'state',state:startState,revision:0});tick();equal(); // stale host state ignored
current.ctx.currentTeam=current===h?'PLAYER2':'PLAYER';current.ctx.currentTurnIndex=current.ctx.turnOrder.indexOf(current.ctx.currentTeam);current.ctx.turnNumber=3;current.ctx.researchedUnits.PLAYER.add('Archer');current.run('OnlineMatch.publish()');tick();assert.equal(h.ctx.currentTeam,g.ctx.currentTeam);assert.equal(other.ctx.turnNumber,3);assert(other.ctx.researchedUnits.PLAYER.has('Archer'));
checkEffects(other,current,'second');
const terrain=JSON.stringify(h.ctx.terrain);h.el('onlineReturnLobby').onclick();tick();assert.equal(g.run('OnlineMatch.playing'),false);assert.equal(g.run('OnlineMatch.canAct()'),false);assert.equal(h.el('lobbyStart').disabled,true);
h.el('lobbyReady').onclick();g.el('lobbyReady').onclick();tick();h.el('lobbyStart').onclick();tick();assert.notEqual(JSON.stringify(h.ctx.terrain),terrain);equal();
peers[1].conn.close();tick();assert.equal(h.run('OnlineMatch.canAct()'),false);assert.equal(g.run('OnlineMatch.canAct()'),false);
console.log('Two-client lobby, ready gate, shared start, complete unit stats, research, turn sync, input lock, and fresh rematch pass.');

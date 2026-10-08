const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {client,tick,peers}=require('./multiplayer-harness.cjs');
const h=client('Host'),g=client('Guest');
const maps=h.ctx.FairMap;h.ctx.FairMap={...maps,generateForPlayers:(...args)=>({...maps.generateForPlayers(...args),firstTeam:'PLAYER'})};
for(const p of [h,g]){
 Object.assign(p.ctx,{ensureVeteranName(){},isActionAllowed:()=>true,recordAction(){},recordHumanAction(){},showPopup(){},getEffectiveCost:c=>c});
 p.ctx.getUnitAt=(col,row)=>p.ctx.units.find(u=>u.col===col&&u.row===row);
 for(const file of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js'])vm.runInContext(fs.readFileSync(file,'utf8'),p.ctx);
 p.ctx.normalizeVictoryCondition=x=>x;p.ctx.closeSpawnMenu=()=>{};p.ctx.postGameState=()=>p.run('OnlineMatch.publish()');
}
h.el('lobbyCreate').onclick();tick();g.run(`OnlineMatch.join('${h.el('lobbyRoom').textContent}')`);tick();
h.el('lobbyReady').onclick();g.el('lobbyReady').onclick();tick();h.el('lobbyStart').onclick();tick();
assert.equal(peers[1].conn.serialization,'binary');
// A realistically growing state exceeds the old 16 KB limit, even before recruitment.
h.run(`for(const t of ['PLAYER','PLAYER2'])resources[t]={gold:1000,materials:1000};
 restoreResearch({PLAYER:Object.keys(RESEARCH_TREE),PLAYER2:Object.keys(RESEARCH_TREE)}, {}, ['PLAYER','PLAYER2']);
 diplomacy.history=Array.from({length:100},(_,i)=>({text:'Battle report '+i+' '.repeat(100)}));OnlineMatch.publish()`);tick();
const equal=()=>assert.equal(h.run('JSON.stringify({units,resources})'),g.run('JSON.stringify({units,resources})'));
for(const p of [h,g]){
 if(!p.run('OnlineMatch.canAct()')){const other=p===h?g:h;other.run(`currentTeam='${p===h?'PLAYER':'PLAYER2'}';currentTurnIndex=turnOrder.indexOf(currentTeam);OnlineMatch.publish()`);tick();}
 for(const name of JSON.parse(p.run('JSON.stringify(Object.keys(UNIT_TEMPLATES).filter(n=>!UNIT_TEMPLATES[n].editorOnly))'))){
  const tile=p.ctx.terrain.findIndex((t,i)=>t!=='VOID'&&!p.ctx.units.some(u=>u.row*20+u.col===i));
  const count=p.ctx.units.length;p.run(`spawnUnitAt(${JSON.stringify(name)},OnlineMatch.localTeam,${tile%20},${Math.floor(tile/20)})`);tick();
  assert.equal(p.ctx.units.length,count+1,name+' bought');equal();assert(p.run('OnlineMatch.canAct()'));assert(p.el('onlineLobby').hidden);
 }
}
assert(peers[1].conn.sent.some(m=>m.type==='proposal'&&Buffer.byteLength(JSON.stringify(m))>16300));
// Delay the acknowledgement beyond twelve seconds without dropping the connection.
g.ctx.units[0].hp--;g.run('OnlineMatch.publish()');g.timers.filter(t=>t.delay===12000).at(-1).fn();
assert(g.el('onlineLobby').hidden);tick();equal();assert(g.run('OnlineMatch.canAct()'));
// Display/serialization/signaling errors must not evict either player.
h.ctx.updateUI=()=>{throw Error('display failure');};g.ctx.units[0].hp--;g.run('OnlineMatch.publish()');tick();equal();
h.ctx.updateUI=()=>{};g.ctx.units[0].hp--;g.run('OnlineMatch.publish()');tick();equal();
peers[1].conn.emit('error',{type:'message-too-big'});peers[1].emit('error',{type:'webrtc'});assert(peers[1].conn.open);assert(g.el('onlineLobby').hidden);
// Real transport loss still preserves and pauses the battle for reconnection.
peers[1].conn.close();assert(!g.el('onlineLobby').hidden);assert(!h.el('onlineLobby').hidden);assert(g.run('OnlineMatch.playing'));assert(!g.run('OnlineMatch.canAct()'));
console.log('All recruitable units sync for both players above 16 KB; slow ACKs and display errors do not kick; real disconnects pause.');

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const registry=new Map(), peers=[], queue=[];
const tick=()=>{while(queue.length)queue.shift()();};
class Connection extends EventEmitter {constructor(){super();this.open=true;this.sent=[];}send(msg){this.sent.push(structuredClone(msg));const data=structuredClone(msg);queue.push(()=>this.other.emit('data',data));}close(){this.open=false;this.other.open=false;this.emit('close');this.other.emit('close');}}
class Peer extends EventEmitter {constructor(id){super();this.id=id||`guest-${peers.length}`;registry.set(this.id,this);peers.push(this);queue.push(()=>this.emit('open',this.id));}connect(id){const a=new Connection(),b=new Connection();a.other=b;b.other=a;this.conn=a;queue.push(()=>{registry.get(id).emit('connection',b);a.emit('open');b.emit('open');});return a;}destroy(){this.destroyed=true;registry.delete(this.id);}reconnect(){}}
function client(name){
 const els={},handlers={},intervals=[];const elem=id=>els[id]??=( {id,value:id==='lobbyName'?name:'',hidden:id==='onlineLobby',textContent:'',disabled:false,addEventListener(){},children:[],classList:{add(){},remove(){}},replaceChildren(){this.children=[];},append(e){this.children.push(e);},focus(){}} );
 const ctx={console:{log(){},warn(){}},Peer,URL,URLSearchParams,crypto:require('node:crypto').webcrypto,location:{href:'https://game.test/',search:''},history:{replaceState(){}},navigator:{},document:{getElementById:elem,createElement:()=>({}),body:elem('body'),addEventListener:(n,f)=>handlers[n]=f,querySelector:()=>elem('canvas')},window:{addEventListener(){}},setTimeout:()=>0,clearTimeout(){},setInterval:f=>intervals.push(f),FairMap:require('../js/net/fair-map.js'),
 currentTeam:'PLAYER',COLS:20,ROWS:16,mapSize:{},useHexGrid:true,units:[],terrain:[],settlements:[],resources:{},startingResources:{},researchedUnits:{},diplomacy:{},currentVictoryCondition:{},gameOver:false,turnNumber:1,currentTurnIndex:0,turnOrder:['PLAYER','PLAYER2'],communicationLockouts:{},selectedUnit:null,buildMode:false,buildModeUnitId:null,gameInputBlockedUntil:0,opponentType:'AI',gameMode:'vs-ai',myRole:'P1',gameId:null,isConnectedToHub:false,modalManuallyClosed:false,campaignMode:{},isEditorMode:false,LEARNING_AI:{},pendingUpdates:new Map(),UNIT_TEMPLATES:Object.fromEntries(['Knight','Soldier','Archer','Spearman'].map(n=>[n,{}])),
 stopHeartbeat(){},hideEndScreen(){},switchGameMode(){},closeSpawnMenu(){},updateUI(){},getWinner:()=>null,showEndScreen(){},setupGame(){},calculateTurnOrder(){},normalizeVictoryCondition:x=>x,createDefaultWarDiplomacy:()=>({}),makeUnit:(name,team,col,row,{id})=>({id,name,team,col,row,hp:100,maxHp:100,dmg:20,experience:7,promotionLevel:2}),confirmOptimisticUpdate(id){ctx.pendingUpdates.delete(id);},rollbackOptimisticUpdate(){throw Error('unexpected rollback');}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../js/net/online-lobby.js'),'utf8'),ctx);handlers.DOMContentLoaded();
 return {ctx,els,el:elem,run:s=>vm.runInContext(s,ctx),intervals};
}
const h=client('Host'),g=client('Guest');h.el('menuOnlineBtn').onclick();h.el('lobbyCreate').onclick();tick();
g.el('lobbyCode').value=h.el('lobbyRoom').textContent;g.el('menuOnlineBtn').onclick();g.el('lobbyJoin').onclick();tick();
assert.equal(h.el('lobbyPlayers').children.length,2);assert.equal(h.el('lobbyStart').disabled,true);
h.el('lobbyReady').onclick();tick();assert.equal(h.el('lobbyStart').disabled,true);g.el('lobbyReady').onclick();tick();assert.equal(h.el('lobbyStart').disabled,false);
h.el('lobbyStart').onclick();tick();assert.equal(g.run('OnlineMatch.playing'),true);
const equal=()=>assert.equal(JSON.stringify(h.ctx.units),JSON.stringify(g.ctx.units));equal();assert.equal(g.ctx.units[0].promotionLevel,2);
assert.deepEqual(h.ctx.resources.PLAYER,{food:0,gold:0,materials:0});assert.deepEqual(h.ctx.resources.PLAYER2,{food:0,gold:0,materials:0});
assert.match(h.el('onlineMatchStatus').textContent,/Highlands|Desert Expanse|Island Chain|Ancient Forest|Flooded Marsh|Open Frontier/);
let current=h.ctx.currentTeam==='PLAYER'?h:g,other=current===h?g:h;
assert.equal(other.run('OnlineMatch.canAct()'),false);current.ctx.units[0].experience=38;current.ctx.units[0].hp=47;current.run('OnlineMatch.publish()');tick();equal();assert.equal(other.ctx.units[0].experience,38);
// Older host revisions cannot overwrite newer guest state.
const hostConn=peers[1].conn.other;
const startState=hostConn.sent.find(m=>m.type==='start').state;
hostConn.send({protocol:1,type:'state',state:startState,revision:0});tick();equal(); // stale host state ignored
current.ctx.currentTeam=current===h?'PLAYER2':'PLAYER';current.ctx.currentTurnIndex=current.ctx.turnOrder.indexOf(current.ctx.currentTeam);current.ctx.turnNumber=3;current.ctx.researchedUnits.PLAYER.add('Archer');current.run('OnlineMatch.publish()');tick();assert.equal(h.ctx.currentTeam,g.ctx.currentTeam);assert.equal(other.ctx.turnNumber,3);assert(other.ctx.researchedUnits.PLAYER.has('Archer'));
const terrain=JSON.stringify(h.ctx.terrain);h.el('onlineReturnLobby').onclick();tick();assert.equal(g.run('OnlineMatch.playing'),false);assert.equal(g.run('OnlineMatch.canAct()'),false);assert.equal(h.el('lobbyStart').disabled,true);
h.el('lobbyReady').onclick();g.el('lobbyReady').onclick();tick();h.el('lobbyStart').onclick();tick();assert.notEqual(JSON.stringify(h.ctx.terrain),terrain);equal();
peers[1].conn.close();tick();assert.equal(h.run('OnlineMatch.canAct()'),false);assert.equal(g.run('OnlineMatch.canAct()'),false);
console.log('Two-client lobby, ready gate, shared start, complete unit stats, research, turn sync, input lock, and fresh rematch pass.');

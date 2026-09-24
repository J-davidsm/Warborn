const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const registry=new Map(), peers=[], queue=[];
const tick=()=>{while(queue.length)queue.shift()();};
class Connection extends EventEmitter {constructor(){super();this.open=true;this.sent=[];}send(msg){this.sent.push(structuredClone(msg));const data=structuredClone(msg);queue.push(()=>this.other.emit('data',data));}close(){this.open=false;this.other.open=false;this.emit('close');this.other.emit('close');}}
class Peer extends EventEmitter {
 constructor(id){super();this.id=id||`guest-${peers.length}`;this.connections=[];peers.push(this);
  if(registry.has(this.id)){queue.push(()=>this.emit('error',{type:'unavailable-id'}));return;}
  registry.set(this.id,this);queue.push(()=>{if(!this.destroyed)this.emit('open',this.id);});}
 connect(id){const a=new Connection(),b=new Connection();a.other=b;b.other=a;a.peer=id;b.peer=this.id;this.conn=a;this.connections.push(a);
  queue.push(()=>{const remote=registry.get(id);if(!remote){this.emit('error',{type:'peer-unavailable'});return;}remote.connections.push(b);remote.emit('connection',b);a.emit('open');b.emit('open');});return a;}
 destroy(){this.destroyed=true;if(registry.get(this.id)===this)registry.delete(this.id);for(const c of this.connections)if(c.open)c.close();}reconnect(){}
}

function client(name){
 const els={},handlers={},intervals=[],timers=[];const elem=id=>els[id]??=( {id,value:id==='lobbyName'?name:'',hidden:id==='onlineLobby',textContent:'',disabled:false,addEventListener(){},children:[],classList:{add(){},remove(){}},replaceChildren(){this.children=[];},append(...e){this.children.push(...e);},focus(){}} );
 const ctx={console:{log(){},warn(){}},Peer,URL,URLSearchParams,crypto:require('node:crypto').webcrypto,location:{href:'https://game.test/',search:''},history:{replaceState(){}},navigator:{},document:{getElementById:elem,createElement:()=>({children:[],append(...e){this.children.push(...e);},replaceChildren(){this.children=[];}}),body:elem('body'),addEventListener:(n,f)=>handlers[n]=f,querySelector:()=>elem('canvas')},window:{addEventListener(){}},setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout(){},setInterval:f=>intervals.push(f),FairMap:require('../js/net/fair-map.js'),
 currentTeam:'PLAYER',COLS:20,ROWS:16,mapSize:{},useHexGrid:true,units:[],terrain:[],settlements:[],resources:{},startingResources:{},researchedUnits:{},diplomacy:{},currentVictoryCondition:{},gameOver:false,turnNumber:1,currentTurnIndex:0,turnOrder:['PLAYER','PLAYER2'],communicationLockouts:{},selectedUnit:null,buildMode:false,buildModeUnitId:null,gameInputBlockedUntil:0,opponentType:'AI',gameMode:'vs-ai',myRole:'P1',gameId:null,isConnectedToHub:false,modalManuallyClosed:false,campaignMode:{},isEditorMode:false,LEARNING_AI:{},pendingUpdates:new Map(),UNIT_TEMPLATES:Object.fromEntries(['Knight','Soldier','Archer','Spearman'].map(n=>[n,{}])),
 stopHeartbeat(){},hideEndScreen(){},switchGameMode(){},closeSpawnMenu(){},updateUI(){},getWinner:()=>null,showEndScreen(){},setupGame(){},calculateTurnOrder(){},normalizeVictoryCondition:x=>x,createDefaultWarDiplomacy:()=>({}),makeUnit:(name,team,col,row,{id})=>({id,name,team,col,row,hp:100,maxHp:100,dmg:20,experience:7,promotionLevel:2}),confirmOptimisticUpdate(id){ctx.pendingUpdates.delete(id);},rollbackOptimisticUpdate(){throw Error('unexpected rollback');}};
 ctx.isAITeam=team=>team.startsWith('AI');ctx.performance={now:()=>0};ctx.getTileCenterLocal=(col,row)=>({x:col*40,y:row*40});
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../js/rendering/action-effects.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(require.resolve('../js/net/online-lobby.js'),'utf8'),ctx);handlers.DOMContentLoaded();
 return {ctx,els,el:elem,run:s=>vm.runInContext(s,ctx),intervals,timers,handlers};
}

module.exports={client,tick,peers,registry};
